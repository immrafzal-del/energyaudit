# Energy Monitoring System

Professional real-time energy monitoring system with Arduino Uno and ESP32 WiFi module, featuring oscilloscope-like waveform visualization, power analysis, and consumption tracking.

## System Architecture

```
┌─────────────┐      ┌──────────────┐      ┌──────────────┐      ┌──────────┐
│   PT/CT     │─────▶│  Arduino Uno │─────▶│    ESP32     │─────▶│  Node.js │
│  Sensors    │      │   (Sensors)  │ TX/RX│  WiFi Module │ WiFi │  Server  │
│  (LM358,    │      │              │      │  (WebSocket) │      │          │
│  ACS712)    │      │              │      │              │      │          │
└─────────────┘      └──────────────┘      └──────────────┘      └──────────┘
                                                                        │
                                                                        ▼
                                                                  ┌──────────┐
                                                                  │ MongoDB  │
                                                                  └──────────┘
                                                                        │
                                                                        ▼
                                                                  ┌──────────┐
                                                                  │  React   │
                                                                  │  Web App │
                                                                  └──────────┘
```

## Features

- **Real-time Monitoring**: Live voltage, current, power, frequency, and temperature readings
- **Oscilloscope Display**: Real-time waveform visualization with automatic waveform type detection (sine, square, triangle)
- **WiFi Communication**: Fast wireless data transmission from ESP32 to server via WebSocket
- **Power Analysis**: Historical power consumption charts
- **Consumption Tracking**: Daily and monthly energy consumption with MongoDB storage
- **Professional UI**: Clean, minimal dashboard with dark theme
- **Hardware Integration**: Arduino Uno with PT (LM358), CT (ACS712 30A), temperature sensors, and ESP32 WiFi module

## Prerequisites

- Node.js (v16 or higher)
- MongoDB (local or cloud)
- Arduino IDE (for Arduino Uno and ESP32 programming)
- Arduino Uno
- ESP32 Development Board
- Hardware sensors (PT, CT, temperature sensor)
- WiFi network

## Installation

### 1. Clone and Install Dependencies

```bash
# Install server dependencies
npm install

# Install client dependencies
cd client
npm install
cd ..
```

### 2. Setup MongoDB

```bash
# Install MongoDB (macOS)
brew install mongodb-community
brew services start mongodb-community

# Or use Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/energy_monitoring
```

### 4. Upload Arduino Code

#### Arduino Uno (Sensor Reader)
1. Open `arduino/arduino_uno_sensor/arduino_uno_sensor.ino` in Arduino IDE
2. Install ArduinoJson library (Tools → Manage Libraries → Search "ArduinoJson")
3. Connect Arduino Uno via USB
4. Select board: Arduino Uno
5. Select port
6. Upload code

#### ESP32 (WiFi Module)
1. Open `arduino/esp32_wifi_module/esp32_wifi_module.ino` in Arduino IDE
2. Install ESP32 board support and libraries:
   - ArduinoJson
   - WebSockets by Markus Sattler
3. Update WiFi credentials in code:
   ```cpp
   const char* ssid = "YOUR_WIFI_SSID";
   const char* password = "YOUR_WIFI_PASSWORD";
   const char* serverIP = "192.168.1.100";  // Your server IP
   ```
4. Connect ESP32 via USB
5. Select board: ESP32 Dev Module
6. Upload code

### 5. Hardware Setup

#### Connections:

**Arduino Uno:**
- PT (via LM358) → A0
- CT (ACS712) → A1
- Temperature Sensor → A2
- TX → ESP32 RX (GPIO 16)
- GND → ESP32 GND

**ESP32:**
- RX (GPIO 16) → Arduino Uno TX
- GND → Arduino Uno GND
- Power via USB or external 5V

See `arduino/CIRCUIT_DIAGRAM.md` for detailed wiring.

## Running the Application

### Development Mode

```bash
# Terminal 1: Start MongoDB (if local)
mongod

# Terminal 2: Start server and client
npm run dev
```

The application will open at `http://localhost:3000`

### Production Mode

```bash
# Build client
npm run build

# Start server
npm start
```

## Data Flow

1. **Sensors → Arduino Uno**: PT, CT, and temperature sensors connected to Arduino analog pins
2. **Arduino Uno → ESP32**: JSON data sent via Serial (TX/RX) at 9600 baud
3. **ESP32 → Server**: Data forwarded via WiFi WebSocket connection
4. **Server → MongoDB**: Data stored in database
5. **Server → React App**: Real-time updates via Socket.IO
6. **React App**: Displays data in dashboard with oscilloscope and charts

## Data Format

Arduino Uno sends to ESP32:
```json
{
  "v": 230.5,
  "i": 2.3,
  "f": 50.1,
  "t": 28.5,
  "w": [512, 600, 700, ...]
}
```

ESP32 forwards to server via WebSocket as Socket.IO event:
```
42["energy-data",{"v":230.5,"i":2.3,"f":50.1,"t":28.5,"w":[...]}]
```

## Calibration

### Voltage Calibration
1. Connect a known AC voltage source
2. Measure with multimeter
3. Adjust `VOLTAGE_CALIBRATION` in Arduino Uno code
4. Re-upload to Arduino Uno

### Current Calibration
1. Connect a known load (e.g., 100W bulb)
2. Measure actual current with clamp meter
3. Adjust `CURRENT_CALIBRATION` in Arduino Uno code
4. Re-upload to Arduino Uno

## Testing Without Hardware

The system includes a simulation mode that generates test data when no ESP32 is connected. Just start the server and it will automatically enter simulation mode after 5 seconds.

## Troubleshooting

### ESP32 not connecting to WiFi
- Check WiFi credentials in ESP32 code
- Ensure WiFi network is 2.4GHz (ESP32 doesn't support 5GHz)
- Check server IP address is correct

### No data on dashboard
- Check ESP32 serial monitor for connection status
- Verify Arduino Uno is sending data (check Arduino serial monitor)
- Ensure MongoDB is running
- System will auto-start simulation mode if no hardware detected

### Arduino Uno not sending data
- Check serial connection between Arduino and ESP32
- Verify TX/RX pins are correctly connected
- Check baud rate is 9600 on both devices

## Safety Warning

⚠️ **DANGER: HIGH VOLTAGE**

This system works with mains AC voltage which can be lethal. Always:
- Use proper isolation transformers
- Never work on live circuits
- Ensure all connections are properly insulated
- Follow local electrical codes
- Consult a licensed electrician if unsure

## License

MIT
