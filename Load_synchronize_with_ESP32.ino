#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <SoftwareSerial.h>

// SoftwareSerial for ESP32 communication
SoftwareSerial espSerial(10, 11); // RX, TX (connect to ESP32: Arduino TX->ESP32 RX, Arduino RX->ESP32 TX)

LiquidCrystal_I2C lcd(0x27, 20, 4);

// Pin Definitions
const int ReadAC_V  = A13;
const int solarPin = A10;
const int windPin  = A9;
const int batPin   = A8;
const int ct1Pin   = A11;
const int ct2Pin   = A12;
const int pulsePin = 2;
const int relayGridFeeding = 5; // Active Low
const int relayLoadSync    = 4; // Active Low

volatile unsigned long pulseCount = 0; 
float units = 0.0;
const float pulsesPerUnit = 3200.0;
uint16_t AC_Volt = 0; 
#define samples 200

// Data variables for JSON
int solarV = 0;
int windV = 0;
int batV = 0;
float amp1 = 0;
float amp2 = 0;
float totalAmps = 0;
String syncStatus = "";
bool relayGridState = false;
bool relaySyncState = false;

void countPulse() { pulseCount++; }

void setup() {
  // Initialize SoftwareSerial for ESP32
  espSerial.begin(9600);
  
  pinMode(relayGridFeeding, OUTPUT);
  pinMode(relayLoadSync, OUTPUT);

  digitalWrite(relayGridFeeding, HIGH);
  digitalWrite(relayLoadSync, HIGH);
  pinMode(pulsePin, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(pulsePin), countPulse, FALLING);
  lcd.init();
  lcd.backlight();
  
  // Intro Screen
  lcd.setCursor(0, 0);
  lcd.print("Load synchronization");
  lcd.setCursor(0, 1);
  lcd.print("   With Three ");
  lcd.setCursor(0, 2);
  lcd.print("  Power Sources  ");
  delay(2500);
  lcd.clear();
}

void loop() {
  AC_read();
  units = (float)pulseCount / pulsesPerUnit;

  // Voltage Readings
  solarV = analogRead(solarPin) * (25.0 / 1023.0);
  windV  = analogRead(windPin)  * (25.0 / 1023.0);
  batV   = analogRead(batPin)   * (25.0 / 1023.0);

  // CT Sensor Reading
  amp1 = readCT_Ams(ct1Pin);
  amp2 = readCT_Ams(ct2Pin);
  totalAmps = amp1 + amp2;

  // Reset if AC voltage < 50V
  if (AC_Volt < 50) {
    AC_Volt = 0;
    totalAmps = 0.0;
  }

  // Relay Logic
  if (solarV > 10.0 && windV > 10.0 && totalAmps <= 0.9 && AC_Volt > 150) {
    digitalWrite(relayGridFeeding, LOW);
    relayGridState = true;
  } 
  else if (totalAmps > 0.8 || solarV < 10.0 || windV < 10.0 || AC_Volt < 150) {
    digitalWrite(relayGridFeeding, HIGH);
    relayGridState = false;
  }

  // Determine Sync Status
  if (totalAmps > 0.1 && totalAmps <= 0.4) {
    syncStatus = "SOL";
    digitalWrite(relayLoadSync, HIGH);
    relaySyncState = false;
  } 
  else if (totalAmps > 0.4 && totalAmps <= 0.9) {
    syncStatus = "SOL+WIN";
    digitalWrite(relayLoadSync, LOW);
    relaySyncState = true;
  } 
  else if (totalAmps > 0.9) {
    syncStatus = "SOL+WIN+WAP";
    digitalWrite(relayLoadSync, LOW);
    relaySyncState = true;
  } 
  else {
    if (AC_Volt > 150) {
      syncStatus = "Normal";
    } else {
      syncStatus = "OFF";
    }
  }

  // LCD Display Update
  lcd.setCursor(0, 0);
  lcd.print("Sol_V=");
  lcd.print(solarV, 1);
  lcd.print(" ");
  lcd.setCursor(10, 0);
  lcd.print("Win_V=");
  lcd.print(windV, 1);

  lcd.setCursor(0, 1);
  lcd.print("Bat_V="); lcd.print(batV, 1);
  lcd.setCursor(10, 1);
  lcd.print("Wap="); 
  lcd.print(AC_Volt);
  lcd.print("     ");

  lcd.setCursor(0, 2);
  lcd.print("AMP="); 
  lcd.print(totalAmps, 1);
  lcd.print("A "); 
  lcd.setCursor(9, 2);
  lcd.print("Unit=");
  if(units < 10) lcd.print("000");
  else if(units < 100) lcd.print("00");
  lcd.print(units, 1);

  lcd.setCursor(0, 3);
  lcd.print("St:");
  lcd.print(syncStatus);
  lcd.print(" ");
  lcd.print(relayGridState ? "G:ON" : "G:OFF");

  // Send data to ESP32 via SoftwareSerial
  sendDataToESP32();

  delay(500);
}

void sendDataToESP32() {
  // Format: JSON-like string for easy parsing
  // DATA:solarV,windV,batV,AC_Volt,totalAmps,units,syncStatus,relayGrid,relaySync
  espSerial.print("DATA:");
  espSerial.print(solarV);
  espSerial.print(",");
  espSerial.print(windV);
  espSerial.print(",");
  espSerial.print(batV);
  espSerial.print(",");
  espSerial.print(AC_Volt);
  espSerial.print(",");
  espSerial.print(totalAmps, 2);
  espSerial.print(",");
  espSerial.print(units, 2);
  espSerial.print(",");
  espSerial.print(syncStatus);
  espSerial.print(",");
  espSerial.print(relayGridState ? "1" : "0");
  espSerial.print(",");
  espSerial.println(relaySyncState ? "1" : "0");
}

float readCT_Ams(int pin) {
    uint16_t maxVal = 0;
    for(int i = 0; i < 400; i++){
        uint16_t adc = analogRead(pin);
        if(adc > maxVal) maxVal = adc;
        delayMicroseconds(100);
    }
    
    if(maxVal < 3) return 0.0;
    float current = (float)maxVal * 0.045; 
    return current;
}

void AC_read(void) {
  uint16_t maxVal = 0, adc_val;
  int16_t diff;
  int32_t tmp;
  for (uint8_t i = 0; i < samples; i++) {
    adc_val = analogRead(ReadAC_V);
    delayMicroseconds(500);
    if (adc_val > maxVal) maxVal = adc_val;
  }
  diff = (int16_t)maxVal - 511;
  if (diff < 0) diff = 0;
  tmp = (int32_t)diff * 2000;
  tmp = tmp / 21;
  tmp = tmp / 109;
  tmp = (tmp * 707) / 1000;
  AC_Volt = (uint16_t)tmp;
}
