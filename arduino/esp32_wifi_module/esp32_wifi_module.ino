/*
 * ESP32 WiFi Module  v2.5  — baud rate fix
 *
 * Changed Serial2 from 230400 to 250000 to match Arduino's actual
 * transmission rate (UBRR=3 gives exactly 250000 on 16MHz Uno).
 * At 230400, Arduino sent at 250000 (8.5% error) causing corrupted bytes.
 */

#include <WiFi.h>
#include <WebSocketsClient.h>

const char* ssid       = "Star Link";
const char* password   = "@catchme@12345";
const char* serverIP   = "192.168.100.25";
const int   serverPort = 5001;

#define RXD2 16
#define TXD2 17

WebSocketsClient webSocket;
bool wifiConnected  = false;
bool wsConnected    = false;
bool justConnected  = false;

static char rxBuf[1300];
static int  rxLen = 0;
static char txBuf[1400];

uint32_t sentCount = 0;
uint32_t dropCount = 0;

// ─────────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(300);

  Serial2.setRxBufferSize(2048);
  // 250000 baud = exact match for Arduino Uno 16MHz (UBRR=3, 0% error)
  Serial2.begin(250000, SERIAL_8N1, RXD2, TXD2);

  Serial.println("\n=== ESP32 Energy Monitor v2.5 ===");
  Serial.print("Server: "); Serial.print(serverIP);
  Serial.print(":"); Serial.println(serverPort);
  Serial.println("UART2: 250000 baud (0% error on Arduino Uno 16MHz)");

  connectWiFi();

  if (wifiConnected) {
    webSocket.begin(serverIP, serverPort,
                    "/socket.io/?EIO=3&transport=websocket");
    webSocket.onEvent(webSocketEvent);
    webSocket.setReconnectInterval(3000);
  }
}

// ─────────────────────────────────────────────────────────────────────────
void loop() {
  webSocket.loop();

  if (WiFi.status() != WL_CONNECTED) {
    if (wifiConnected) {
      wifiConnected = false; wsConnected = false;
      rxLen = 0;
      Serial.println("[WiFi] Lost. Reconnecting...");
    }
    connectWiFi();
    delay(500); return;
  }

  // While not connected: drain Serial2 so it never overflows
  if (!wsConnected) {
    while (Serial2.available()) Serial2.read();
    rxLen = 0;
    return;
  }

  // One extra drain iteration right after connection is established
  if (justConnected) {
    justConnected = false;
    while (Serial2.available()) Serial2.read();
    rxLen = 0;
    return;
  }

  // Non-blocking: one byte per loop iteration
  // webSocket.loop() runs again immediately — never starved
  if (!Serial2.available()) return;

  char c = (char)Serial2.read();

  if (c == '\n') {
    rxBuf[rxLen] = '\0';

    // Valid if: starts {, ends }, long enough to contain waveform data
    if (rxLen > 100 &&
        rxBuf[0]       == '{' &&
        rxBuf[rxLen-1] == '}') {
      forwardToServer();
    } else if (rxLen > 0) {
      dropCount++;
    }
    rxLen = 0;

  } else if (c != '\r') {
    if (rxLen < (int)sizeof(rxBuf) - 1) {
      rxBuf[rxLen++] = c;
    } else {
      rxLen = 0;
      dropCount++;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────
void forwardToServer() {
  int pre = snprintf(txBuf, sizeof(txBuf), "42[\"energy-data\",");
  if (pre + rxLen + 2 >= (int)sizeof(txBuf)) {
    Serial.println("[ERR] txBuf overflow"); return;
  }
  memcpy(txBuf + pre, rxBuf, rxLen);
  txBuf[pre + rxLen]     = ']';
  txBuf[pre + rxLen + 1] = '\0';

  bool sent = webSocket.sendTXT(txBuf);

  if (sent) {
    sentCount++;
    if (sentCount % 50 == 0) {
      Serial.print("[OK] Sent:"); Serial.print(sentCount);
      Serial.print(" Drop:"); Serial.print(dropCount);
      Serial.print(" Heap:"); Serial.println(ESP.getFreeHeap());
    }
  } else {
    wsConnected = false;
    dropCount++;
    Serial.println("[WARN] sendTXT failed — will reconnect");
  }
}

// ─────────────────────────────────────────────────────────────────────────
void webSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {

    case WStype_DISCONNECTED:
      wsConnected   = false;
      justConnected = false;
      rxLen = 0;
      Serial.println("[WS] Disconnected");
      break;

    case WStype_CONNECTED:
      Serial.print("[WS] TCP connected: ");
      Serial.println((char*)payload);
      break;

    case WStype_TEXT: {
      if (payload[0] == '0') {
        Serial.println("[WS] Handshake...");
      }
      else if (length >= 2 && payload[0] == '4' && payload[1] == '0') {
        // Namespace join confirmed
        // Flush any stale bytes that arrived during handshake
        while (Serial2.available()) Serial2.read();
        rxLen         = 0;
        justConnected = true;   // drain once more in next loop iteration
        wsConnected   = true;
        Serial.println("[WS] READY — forwarding data");
      }
      else if (payload[0] == '2') {
        webSocket.sendTXT("3");
      }
      else if (length >= 2 && payload[0] == '4' && payload[1] == '1') {
        wsConnected = false;
        Serial.println("[WS] Namespace disconnected");
      }
      break;
    }

    case WStype_ERROR:
      wsConnected = false;
      Serial.println("[WS] Error");
      break;

    default: break;
  }
}

// ─────────────────────────────────────────────────────────────────────────
void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) { wifiConnected = true; return; }
  Serial.print("[WiFi] Connecting to "); Serial.println(ssid);
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  for (int i = 0; i < 30 && WiFi.status() != WL_CONNECTED; i++) {
    delay(500); Serial.print(".");
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    Serial.print("[WiFi] IP="); Serial.println(WiFi.localIP());
  } else {
    wifiConnected = false;
    Serial.println("[WiFi] FAILED");
  }
}
