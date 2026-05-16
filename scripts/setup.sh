#!/bin/bash

echo "=================================="
echo "Energy Monitoring System Setup"
echo "=================================="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi
echo "✅ Node.js $(node --version) found"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed"
    exit 1
fi
echo "✅ npm $(npm --version) found"

# Check MongoDB
if ! command -v mongod &> /dev/null; then
    echo "⚠️  MongoDB not found in PATH"
    echo "Install MongoDB:"
    echo "  brew install mongodb-community"
    echo "  OR"
    echo "  docker run -d -p 27017:27017 --name mongodb mongo:latest"
else
    echo "✅ MongoDB found"
fi

echo ""
echo "Installing dependencies..."
echo ""

# Install server dependencies
echo "📦 Installing server dependencies..."
npm install

# Install client dependencies
echo "📦 Installing client dependencies..."
cd client
npm install
cd ..

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo ""
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "✅ .env file created"
else
    echo "✅ .env file already exists"
fi

echo ""
echo "=================================="
echo "✅ Setup Complete!"
echo "=================================="
echo ""
echo "Next steps:"
echo "1. Start MongoDB:"
echo "   brew services start mongodb-community"
echo ""
echo "2. Upload Arduino code:"
echo "   - Arduino Uno: arduino/arduino_uno_sensor/"
echo "   - ESP32: arduino/esp32_wifi_module/"
echo "   - Update WiFi credentials in ESP32 code"
echo ""
echo "3. Start the application:"
echo "   npm run dev"
echo ""
echo "4. Open browser to http://localhost:3000"
echo ""
echo "Note: System runs in simulation mode without hardware"
echo ""
