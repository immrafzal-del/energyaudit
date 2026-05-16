/*
 * I2C Scanner Sketch
 * 
 * This sketch scans the I2C bus to find connected devices
 * and displays their addresses in the Serial Monitor.
 * 
 * Use this to find your LCD's I2C address (usually 0x27 or 0x3F)
 * 
 * Connections:
 * - LCD SDA -> Arduino A4
 * - LCD SCL -> Arduino A5
 * - LCD VCC -> Arduino 5V
 * - LCD GND -> Arduino GND
 * 
 * Instructions:
 * 1. Upload this sketch to Arduino Uno
 * 2. Open Serial Monitor (9600 baud)
 * 3. Note the address shown (e.g., 0x27 or 0x3F)
 * 4. Update the address in arduino_uno_sensor.ino
 */

#include <Wire.h>

void setup() {
  Wire.begin();
  Serial.begin(9600);
  
  while (!Serial);  // Wait for Serial Monitor to open
  
  Serial.println("\n=================================");
  Serial.println("I2C Scanner - LCD Address Finder");
  Serial.println("=================================\n");
  Serial.println("Scanning I2C bus...\n");
}

void loop() {
  byte error, address;
  int nDevices = 0;
  
  Serial.println("Scanning...");
  
  for(address = 1; address < 127; address++) {
    // Try to communicate with device at this address
    Wire.beginTransmission(address);
    error = Wire.endTransmission();
    
    if (error == 0) {
      Serial.print("✓ I2C device found at address 0x");
      if (address < 16) {
        Serial.print("0");
      }
      Serial.print(address, HEX);
      Serial.println(" !");
      
      // Common I2C addresses
      if (address == 0x27 || address == 0x3F) {
        Serial.println("  → This is likely your LCD display!");
        Serial.println("  → Use this address in your code:");
        Serial.print("     LiquidCrystal_I2C lcd(0x");
        if (address < 16) Serial.print("0");
        Serial.print(address, HEX);
        Serial.println(", 16, 2);");
      }
      
      nDevices++;
    }
    else if (error == 4) {
      Serial.print("✗ Unknown error at address 0x");
      if (address < 16) {
        Serial.print("0");
      }
      Serial.println(address, HEX);
    }
  }
  
  Serial.println();
  
  if (nDevices == 0) {
    Serial.println("✗ No I2C devices found!");
    Serial.println("\nTroubleshooting:");
    Serial.println("1. Check wiring:");
    Serial.println("   - SDA to A4");
    Serial.println("   - SCL to A5");
    Serial.println("   - VCC to 5V");
    Serial.println("   - GND to GND");
    Serial.println("2. Verify LCD has I2C module attached");
    Serial.println("3. Check for loose connections");
  }
  else {
    Serial.print("✓ Scan complete! Found ");
    Serial.print(nDevices);
    Serial.println(" device(s).");
  }
  
  Serial.println("\n=================================");
  Serial.println("Scanning again in 5 seconds...\n");
  
  delay(5000);  // Wait 5 seconds before next scan
}
