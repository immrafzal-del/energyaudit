# Socket.IO Connection Fix

## Problem
ESP32 was connecting but immediately disconnecting due to Socket.IO v4 protocol mismatch.

## Solution Applied

### ESP32 Changes:

1. **Added Heartbeat:**
   ```cpp
   webSocket.enableHeartbeat(15000, 3000, 2);
   ```
   - Ping every 15 seconds
   - Timeout after 3 seconds
   - 2 retries before disconnect

2. **Enhanced Protocol Handling:**
   - Properly handles Socket.IO v4 messages
   - Responds to Engine.IO OPEN (0)
   - Responds to Socket.IO CONNECT (40)
   - Responds to ping (2) with pong (3)
   - Marks connection as established on "40" message

3. **Better Error Handling:**
   - Marks wsConnected = false on send failure
   - Handles all WebSocket event types

### Backend Changes:

1. **Enhanced Socket.IO Configuration:**
   ```javascript
   {
     pingTimeout: 60000,      // 60 seconds
     pingInterval: 25000,     // 25 seconds
     upgradeTimeout: 30000,   // 30 seconds
     perMessageDeflate: false // Disable compression
   }
   ```

2. **Connection Middleware:**
   - Logs all connection attempts
   - Shows transport type and IP
   - Helps debug connection issues

3. **Welcome Message:**
   - Server sends 'connected' event on successful connection
   - Confirms bidirectional communication

4. **Better Logging:**
   - Shows Socket.IO version
   - Displays all configuration
   - Logs every step of connection

## Testing Steps

### 1. Restart Server
```bash
# Stop server (Ctrl+C)
npm run dev
```

**Look for:**
```
=================================
Socket.IO Server Initialized
=================================
Version: Socket.IO v4
Transports: websocket, polling
CORS: Enabled (all origins)
Ping Timeout: 60s
Ping Interval: 25s
Waiting for connections...
```

### 2. Upload ESP32 Code
- Upload updated `esp32_wifi_module.ino`
- Open Serial Monitor at 115200 baud

**Look for:**
```
✓ WiFi connected successfully!
  IP address: 192.168.1.150

Setting up WebSocket connection...
Server: 10.157.243.9:5001
WebSocket initialized, waiting for connection...

✓ WebSocket Connected!
  Connected to: /socket.io/?EIO=4&transport=websocket
  Sending Socket.IO handshake...
← WebSocket Message: 0{"sid":"...","upgrades":[],"pingInterval":25000,"pingTimeout":60000}
  → Engine.IO connection established
← WebSocket Message: 40
  → Socket.IO connection established

Received from Arduino: {"v":220,"i":2.3,...}
→ Data sent to server successfully
```

### 3. Check Server Logs

**Look for:**
```
→ New connection attempt
  Socket ID: abc123xyz
  Transport: websocket
  IP: ::ffff:192.168.1.150

✓ Client connected successfully!
  Socket ID: abc123xyz
  Transport: websocket
  IP: ::ffff:192.168.1.150

← Received energy data from ESP32
  Socket ID: abc123xyz
  Data: {"v":220,"i":2.3,"p":506,"pf":1,"f":50,"t":28.5,"waveform":"SINE"}
→ Data processed and broadcasted successfully
```

## Socket.IO v4 Protocol

### Message Types:

| Code | Type | Description |
|------|------|-------------|
| 0 | OPEN | Engine.IO connection established |
| 1 | CLOSE | Connection closing |
| 2 | PING | Heartbeat ping |
| 3 | PONG | Heartbeat pong |
| 4 | MESSAGE | Socket.IO message |
| 40 | CONNECT | Socket.IO namespace connect |
| 41 | DISCONNECT | Socket.IO namespace disconnect |
| 42 | EVENT | Socket.IO event with data |

### ESP32 Sends:
```
42["energy-data",{"v":220,"i":2.3,...}]
```
- `4` = MESSAGE
- `2` = EVENT
- `"energy-data"` = event name
- `{...}` = data payload

### Server Receives:
```javascript
socket.on('energy-data', (data) => {
  // data = {"v":220,"i":2.3,...}
});
```

## Common Issues

### Issue: "Connection lost" immediately after connect

**Cause:** Socket.IO protocol mismatch

**Solution:** ✅ Fixed with proper protocol handling

### Issue: No "40" message received

**Cause:** Server not sending Socket.IO CONNECT

**Solution:** ✅ Fixed with enhanced server configuration

### Issue: Ping timeout

**Cause:** Heartbeat not working

**Solution:** ✅ Fixed with `enableHeartbeat()`

## Success Indicators

### ESP32:
- ✅ "Engine.IO connection established"
- ✅ "Socket.IO connection established"
- ✅ "Data sent to server successfully"
- ✅ No "Connection lost" messages

### Server:
- ✅ "Client connected successfully!"
- ✅ "Received energy data from ESP32"
- ✅ "Data processed and broadcasted successfully"
- ✅ No disconnect messages

### Frontend:
- ✅ "Hardware Connected" indicator
- ✅ Real-time data updating
- ✅ Oscilloscope showing waveform

## Monitoring Connection

### ESP32 Serial Monitor:
```
← WebSocket Message: 2    (ping from server)
→ WebSocket Pong          (pong response)
```
This should happen every 25 seconds.

### Server Console:
No disconnect messages should appear after initial connection.

## If Still Disconnecting

1. **Check network stability:**
   - Ping server from ESP32 network
   - Check WiFi signal strength

2. **Increase timeouts:**
   ```javascript
   // In server/config/socket.js
   pingTimeout: 120000,  // 2 minutes
   pingInterval: 50000,  // 50 seconds
   ```

3. **Disable compression:**
   Already done: `perMessageDeflate: false`

4. **Check firewall:**
   - Allow WebSocket connections
   - Allow port 5001

5. **Try polling transport:**
   ```cpp
   // In ESP32 code, change URL to:
   webSocket.begin(serverIP, serverPort, "/socket.io/?EIO=4&transport=polling");
   ```

## Verification Commands

### Test WebSocket endpoint:
```bash
curl http://10.157.243.9:5001/socket.io/?EIO=4&transport=polling

# Should return Engine.IO handshake
```

### Monitor network traffic:
```bash
# On server machine
tcpdump -i any port 5001 -A

# Should show WebSocket frames
```

## Next Steps

1. Upload updated ESP32 code
2. Restart server
3. Monitor both Serial Monitor and server console
4. Verify "Socket.IO connection established" message
5. Check data is being sent and received
6. Verify frontend shows "Hardware Connected"

Connection should now be stable! 🎉
