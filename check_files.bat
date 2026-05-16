@echo off
echo === Checking App.jsx ===
findstr /n "voltageWaveform\|window.location.origin\|localhost:5001" "client\src\App.jsx"
echo.
echo === Checking dataProcessor.js ===
findstr /n "voltageWaveform\|currentWaveform" "server\services\dataProcessor.js"
echo.
pause
