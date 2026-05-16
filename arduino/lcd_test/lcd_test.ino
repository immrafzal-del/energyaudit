/*
 * Simple LCD Test Sketch
 * 
 * Use this to verify your LCD is working correctly
 * 
 * Wiring:
 * LCD VCC -> Arduino 5V
 * LCD GND -> Arduino GND
 * LCD SDA -> Arduino A4
 * LCD SCL -> Arduino A5
 * 
 * Instructions:
 * 1. Upload this sketch
 * 2. LCD should show "LCD Test OK!" and a counter
 * 3. If blank, try changing I2C address below (0x27 or 0x3F)
 * 4. Adjust contrast potentiometer on LCD module if needed
 */

#include <Wire.h>
#include <LiquidCrystal_I2C.h>

// Try 0x27 first, if doesn't work try 0x3F
LiquidCrystal_I2C lcd(0x27, 16, 2);

int counter = 0;

void setup() {
  Serial.begin(9600);
  Serial.println("LCD Test Starting...");
  
  // Initialize I2C
  Wire.begin();
  
  // Initialize LCD
  lcd.init();
  lcd.backlight();
  lcd.clear();
  
  // Test message
  lcd.setCursor(0, 0);
  lcd.print("LCD Test OK!");
  lcd.setCursor(0, 1);
  lcd.print("Counter: 0");
  
  Serial.println("LCD initialized");
  delay(2000);
}

void loop() {
  counter++;
  
  lcd.setCursor(0, 0);
  lcd.print("LCD Working!    ");
  
  lcd.setCursor(0, 1);
  lcd.print("Count: ");
  lcd.print(counter);
  lcd.print("    ");
  
  Serial.print("Counter: ");
  Serial.println(counter);
  
  delay(1000);
  
  // Blink test
  if (counter % 2 == 0) {
    lcd.noBacklight();
    delay(100);
    lcd.backlight();
  }
}
