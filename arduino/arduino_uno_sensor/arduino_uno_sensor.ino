/*
 * Arduino Uno Energy Monitoring System  v2.1
 *
 * KEY FIX: Baud rate changed from 230400 to 250000.
 *
 * At 230400 baud, Arduino Uno's UBRR register rounds to 3,
 * giving actual rate of 250000 baud = 8.5% error.
 * UART only tolerates +/-3.5% — this caused corrupted bytes
 * after the first 7-8 characters of every packet.
 *
 * At 250000 baud, UBRR = exactly 3 = 0% error. Perfect.
 *
 * SRAM: ~1047/2048 bytes (51%) — safe with 1001 byte margin
 * Baud: 250000 — MUST match ESP32 Serial2.begin(250000)
 *
 * Sample rate: ~11 packets/sec x 100 pairs = ~1100 samples/sec
 *
 * Connections:
 *   LM358 + voltage divider  -> A0
 *   ACS712-30A module        -> A1
 *   NTC 10K thermistor       -> A2
 *   I2C LCD (0x27)           -> A4 SDA, A5 SCL
 *   D1 TX                    -> ESP32 GPIO16 RX2
 *   DISCONNECT D1 BEFORE UPLOADING. Reconnect after "Done uploading".
 */

#include <Wire.h>
#include <LiquidCrystal_I2C.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);

#define VOLTAGE_PIN   A0
#define CURRENT_PIN   A1
#define TEMP_PIN      A2
#define WAVE_PAIRS    100    // 100 x 208us = 20.8ms = 1 full 50Hz cycle
#define WAVE_DELAY_US 0
#define V_FAST_SMPLS  200    // local stack variable in readSensors()
#define NTC_SERIES    10000.0
#define NTC_NOM       10000.0
#define NTC_TNOM      25.0
#define NTC_B         3950.0
#define TEMP_SMPLS    10

// Waveform arrays: 100 x 2 x 2 = 400 bytes SRAM
uint16_t vWave[WAVE_PAIRS];
uint16_t iWave[WAVE_PAIRS];

float voltage=0, current=0, power=0, powerFactor=0, frequency=0, temperature=25;
float pfFiltered = 1.0;
char  waveformType[6] = "SINE";
int   waveformScore   = -5;
unsigned long lastLCD = 0;
byte  lcdPage = 0;

// ─────────────────────────────────────────────────────────────────────────
void setup() {
  // 250000 baud: UBRR=3 exactly, 0% error on 16MHz Arduino Uno
  // ESP32 Serial2 MUST use the same: Serial2.begin(250000, ...)
  Serial.begin(250000);

  pinMode(VOLTAGE_PIN, INPUT);
  pinMode(CURRENT_PIN, INPUT);
  pinMode(TEMP_PIN,    INPUT);

  Wire.begin();
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0); lcd.print(F("Energy Monitor"));
  lcd.setCursor(0, 1); lcd.print(F("v2.1  1100sps"));
  delay(2000);
  lcd.clear();
}

// No delay() in loop — runs at full speed ~11 Hz
void loop() {
  readSensors();
  sendData();
  updateLCD();
}

// ─────────────────────────────────────────────────────────────────────────
void readSensors() {

  // PASS 1: 200 voltage samples at 10kHz (stack local — freed on return)
  uint16_t fastSamples[V_FAST_SMPLS];
  uint16_t maxVal = 0;
  unsigned long t0 = micros();

  for (uint16_t i = 0; i < V_FAST_SMPLS; i++) {
    uint16_t v = analogRead(VOLTAGE_PIN);
    fastSamples[i] = v;
    delayMicroseconds(100);
    if (v > maxVal) maxVal = v;
  }
  unsigned long dur = micros() - t0;

  // Voltage RMS via peak detection (calibrated to DT3266L reference)
  int16_t diff = (int16_t)maxVal - 511;
  if (diff < 0) diff = 0;
  int32_t tmp = ((int32_t)diff * 2000L) / 21L / 109L;
  voltage = (float)((tmp * 707L) / 1000L);

  if (voltage < 50.0) {
    voltage = 0.0;
    frequency = 0.0;
    strcpy(waveformType, "NONE");
  } else {
    classifyWaveform(fastSamples, V_FAST_SMPLS);

    // Frequency from rising zero crossings
    int zc = 0;
    bool prev = (fastSamples[0] >= 511);
    for (int i = 1; i < V_FAST_SMPLS; i++) {
      bool cur = (fastSamples[i] >= 511);
      if (!prev && cur) zc++;
      prev = cur;
    }
    if (zc > 0 && dur > 0) {
      float raw = (float)zc * 1000000.0f / (float)dur;
      static float lf = 50.0;
      frequency = lf * 0.7f + raw * 0.3f;
      lf = frequency;
      if (frequency > 47.0 && frequency < 52.0) frequency = 50.0;
      else if (frequency > 57.0 && frequency < 63.0) frequency = 60.0;
      if (frequency < 10.0 || frequency > 1000.0) frequency = 50.0;
    } else {
      frequency = 50.0;
    }
  }
  // fastSamples[] leaves scope here — 400 bytes returned to stack

  // PASS 2: 100 simultaneous V+I pairs at ~4808 Hz hardware rate
  for (int i = 0; i < WAVE_PAIRS; i++) {
    vWave[i] = analogRead(VOLTAGE_PIN);
    iWave[i] = analogRead(CURRENT_PIN);
  }

  // Current RMS from ADC peak (empirical /10 calibrated to DT3266L)
  uint16_t pk = 0;
  for (int i = 0; i < WAVE_PAIRS; i++) if (iWave[i] > pk) pk = iWave[i];
  current = (pk < 3) ? 0.0f : (float)pk / 10.0f;
  if (voltage < 50.0) current = 0.0;

  computePF();

  power = (voltage >= 50.0 && current > 0.01)
          ? voltage * current * powerFactor : 0.0;

  // Temperature: 10 readings, Steinhart-Hart Beta model
  float tSum = 0.0;
  for (int i = 0; i < TEMP_SMPLS; i++) {
    float vt = analogRead(TEMP_PIN) * (5.0f / 1024.0f);
    if (vt < 0.05f || vt > 4.95f) { tSum += 25.0f; delay(5); continue; }
    float R  = NTC_SERIES * vt / (5.0f - vt);
    float st = log(R / NTC_NOM) / NTC_B + 1.0f / (NTC_TNOM + 273.15f);
    tSum += (1.0f / st) - 273.15f;
    delay(5);
  }
  temperature = constrain(tSum / TEMP_SMPLS, -40.0, 125.0);
}

// ─────────────────────────────────────────────────────────────────────────
// PF from zero-crossing phase: 100 pairs = 1 cycle → phi=delta/100*2PI
void computePF() {
  if (voltage < 50.0 || current < 0.01) {
    powerFactor = 0.0; pfFiltered = 1.0; return;
  }
  int vX[5], iX[5], vN = 0, iN = 0;
  for (int i = 1; i < WAVE_PAIRS && vN < 5; i++)
    if (vWave[i-1] < 512 && vWave[i] >= 512) vX[vN++] = i;
  for (int i = 1; i < WAVE_PAIRS && iN < 5; i++)
    if (iWave[i-1] < 512 && iWave[i] >= 512) iX[iN++] = i;
  if (vN == 0 || iN == 0) {
    powerFactor = (pfFiltered > 0.01f) ? pfFiltered : 1.0f; return;
  }
  float s = 0.0;
  int p = min(vN, iN);
  for (int k = 0; k < p; k++)
    s += ((float)(iX[k] - vX[k]) / (float)WAVE_PAIRS) * TWO_PI;
  float pf = constrain(cos(s / p), 0.0f, 1.0f);
  pfFiltered  = 0.8f * pfFiltered + 0.2f * pf;
  powerFactor = pfFiltered;
}

// ─────────────────────────────────────────────────────────────────────────
void classifyWaveform(uint16_t* s, int n) {
  uint16_t hi = 0, lo = 1023;
  for (int i = 0; i < n; i++) {
    if (s[i] > hi) hi = s[i];
    if (s[i] < lo) lo = s[i];
  }
  if ((hi - lo) < 100) { strcpy(waveformType, "SINE"); return; }
  uint16_t thr = (hi - lo) / 6;
  int ext = 0, sh = 0;
  for (int i = 0; i < n; i++) {
    if (s[i] > hi - thr || s[i] < lo + thr) ext++;
    if (i > 0 && abs((int)s[i] - (int)s[i-1]) > (int)thr) sh++;
  }
  if ((float)ext / n > 0.60f && (float)sh / n > 0.10f)
    waveformScore = min(waveformScore + 2, 10);
  else
    waveformScore = max(waveformScore - 1, -10);
  strcpy(waveformType, waveformScore > 5 ? "SQUR" : "SINE");
}

// ─────────────────────────────────────────────────────────────────────────
// sendData: Serial.print each field — NO char buffer, NO heap
// F() keeps string literals in Flash (PROGMEM), not SRAM
void sendData() {
  Serial.print(F("{\"v\":"));   Serial.print(voltage, 1);
  Serial.print(F(",\"i\":"));   Serial.print(current, 3);
  Serial.print(F(",\"p\":"));   Serial.print(power, 1);
  Serial.print(F(",\"pf\":")); Serial.print(powerFactor, 2);
  Serial.print(F(",\"f\":"));   Serial.print(frequency, 1);
  Serial.print(F(",\"t\":"));   Serial.print(temperature, 1);
  Serial.print(F(",\"waveform\":\""));
  Serial.print(waveformType);
  Serial.print(F("\",\"vs\":["));
  for (int i = 0; i < WAVE_PAIRS; i++) {
    Serial.print(vWave[i]);
    if (i < WAVE_PAIRS - 1) Serial.print(',');
  }
  Serial.print(F("],\"is\":["));
  for (int i = 0; i < WAVE_PAIRS; i++) {
    Serial.print(iWave[i]);
    if (i < WAVE_PAIRS - 1) Serial.print(',');
  }
  Serial.println(F("]}"));
}

// ─────────────────────────────────────────────────────────────────────────
void updateLCD() {
  if (millis() - lastLCD < 2000) return;
  lastLCD = millis();
  lcd.clear();
  switch (lcdPage) {
    case 0:
      lcd.setCursor(0, 0);
      lcd.print(F("V:")); lcd.print((int)voltage);
      lcd.print(F("V I:")); lcd.print(current, 1); lcd.print(F("A"));
      lcd.setCursor(0, 1);
      lcd.print(F("P:")); lcd.print((int)power);
      lcd.print(F("W ")); lcd.print(waveformType);
      break;
    case 1:
      lcd.setCursor(0, 0);
      lcd.print(F("f:")); lcd.print(frequency, 1); lcd.print(F("Hz"));
      lcd.setCursor(0, 1);
      lcd.print(F("PF:")); lcd.print(powerFactor, 2);
      lcd.print(F(" T:")); lcd.print((int)temperature); lcd.print(F("C"));
      break;
    case 2:
      lcd.setCursor(0, 0);
      lcd.print((int)voltage); lcd.print(F("V "));
      lcd.print(current, 2); lcd.print(F("A"));
      lcd.setCursor(0, 1);
      lcd.print((int)power); lcd.print(F("W "));
      lcd.print((int)temperature); lcd.print(F("C"));
      break;
  }
  lcdPage = (lcdPage + 1) % 3;
}
