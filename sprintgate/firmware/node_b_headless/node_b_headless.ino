/*
 * Copyright (C) 2026 Velocity Lab
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

#include <WiFi.h>
#include <WebServer.h>
#include <WebSocketsServer.h>
#include <esp_now.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ESPmDNS.h>
#include <ArduinoOTA.h>
#include <queue>

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

const int LDR_PIN = 4;
const int BUZZER_PIN = 5;

const char* ssid = "Velocity_Lab";
const char* password = "Vlab@123";

unsigned long startTimestamps[10];
volatile int activeRunners = 0;
int buzzerMode = 1; // 0=Mute, 1=Race, 2=Alignment

volatile bool newResult = false;
volatile float lastTime = 0.0;

volatile uint32_t lastReactionTime = 0;
volatile bool newSplit = false;
volatile uint8_t lastSplitNodeId = 0;
volatile float lastSplitTime = 0.0;

volatile bool newRfidScan = false;
char lastRfidUid[12] = "";

typedef struct {
    uint8_t nodeId;
    uint8_t eventType;
    uint32_t reactionTime;
} SprintEvent;

typedef struct {
    uint8_t nodeId;
    uint8_t eventType;
    char uid[12];
} RfidEvent;

WebServer server(80);
WebSocketsServer webSocket = WebSocketsServer(81);

std::queue<String> wsBuffer;
const size_t MAX_BUFFER_SIZE = 50;
unsigned long previousMillisWiFi = 0;
const long intervalWiFi = 5000;
bool wifiWasConnected = false;

unsigned long lastStartTriggerTime = 0;
volatile unsigned long lastFinishInterruptTime = 0;
volatile bool finishTriggered = false;
volatile bool newGunFired = false;

enum DisplayState { DISPLAY_IP, DISPLAY_READY, DISPLAY_RUNNING, DISPLAY_RESULT, DISPLAY_FAULT, DISPLAY_OFFLINE };
DisplayState currentDisplayState = DISPLAY_OFFLINE;
unsigned long stateChangeTime = 0;

void broadcastState() {
  int ldrStatus = digitalRead(LDR_PIN) == HIGH ? 1 : 0;
  String json = "{\"ldr_status\":" + String(ldrStatus) + 
                ",\"active_runners\":" + String(activeRunners) +
                ",\"new_result\":" + String(newResult ? "true" : "false") +
                ",\"time\":" + String(lastTime, 3) +
                ",\"reaction_time\":" + String(lastReactionTime) +
                ",\"new_split\":" + String(newSplit ? "true" : "false") +
                ",\"split_node\":" + String(lastSplitNodeId) +
                ",\"rfid_scan\":" + String(newRfidScan ? ("\"" + String(lastRfidUid) + "\"") : "null") +
                ",\"gun_fired\":" + String(newGunFired ? "true" : "false") +
                ",\"split_time\":" + String(lastSplitTime, 3) + "}";
                
  // Stream continuous JSON telemetry over USB-C Serial (115200 baud) for zero-latency direct cable connection
  Serial.println(json);

  if (webSocket.connectedClients() > 0) {
    webSocket.broadcastTXT(json);
  } else {
    // Only buffer if it contains an actual racing event (result, split, scan, gun)
    if (newResult || newSplit || newRfidScan || newGunFired) {
      if (wsBuffer.size() >= MAX_BUFFER_SIZE) {
        wsBuffer.pop(); // Drop oldest
      }
      wsBuffer.push(json);
    }
  }
  
  if (newSplit) newSplit = false;
  if (newRfidScan) newRfidScan = false;
  if (newGunFired) newGunFired = false;
}

void webSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
  if (type == WStype_CONNECTED) {
    // Flush buffered offline events to the newly connected client
    while (!wsBuffer.empty()) {
      webSocket.sendTXT(num, wsBuffer.front());
      wsBuffer.pop();
    }
    broadcastState(); // Send current state to new client immediately
  } else if (type == WStype_TEXT) {
    // Handle incoming client commands and bidirectional keepalive pings
    String msg = String((char*)payload);
    msg.trim();
    if (msg.indexOf("ping") != -1) {
      int currentLdr = digitalRead(LDR_PIN) == HIGH ? 1 : 0;
      webSocket.sendTXT(num, "{\"type\":\"pong\",\"ldr_status\":" + String(currentLdr) + ",\"active_runners\":" + String(activeRunners) + "}");
    } else if (msg.indexOf("reset") != -1) {
      activeRunners = 0;
      updateDisplay(DISPLAY_READY);
      broadcastState();
    } else if (msg.indexOf("start") != -1) {
      registerStart();
    }
  }
}

void updateDisplay(DisplayState newState) {
  currentDisplayState = newState;
  stateChangeTime = millis();
}

void registerStart() {
  if (millis() - lastStartTriggerTime > 1000) {
    lastStartTriggerTime = millis();
    if (activeRunners < 10) {
      startTimestamps[activeRunners] = millis();
      activeRunners++;
      updateDisplay(DISPLAY_RUNNING);
      broadcastState();
    }
  }
}

// Support for both old and new ESP32 core callback signatures
#if ESP_IDF_VERSION >= ESP_IDF_VERSION_VAL(5, 0, 0)
void OnDataRecv(const esp_now_recv_info_t *esp_now_info, const uint8_t *incomingData, int len) {
#else
void OnDataRecv(const uint8_t * mac, const uint8_t *incomingData, int len) {
#endif
  if (len > 0) {
    uint8_t eventType = incomingData[1];
    
    if (eventType == 2 && len == sizeof(RfidEvent)) {
      RfidEvent event;
      memcpy(&event, incomingData, sizeof(event));
      strncpy((char*)lastRfidUid, event.uid, 12);
      newRfidScan = true;
      broadcastState();
    } else if (eventType == 3 && len == sizeof(SprintEvent)) {
      newGunFired = true;
      broadcastState();
    } else if (eventType == 1 && len == sizeof(SprintEvent)) {
      SprintEvent event;
      memcpy(&event, incomingData, sizeof(event));
      
      if (event.nodeId == 0) { // Node A Start
        lastReactionTime = event.reactionTime;
        registerStart();
      }
      else if (event.nodeId >= 2) { // Split node
        if (activeRunners > 0) {
          lastSplitNodeId = event.nodeId;
          lastSplitTime = (millis() - startTimestamps[0]) / 1000.0;
          newSplit = true;
          broadcastState();
        }
      }
    } else if (incomingData[0] == 1) {
      // Legacy support
      lastReactionTime = 0;
      registerStart();
    }
  }
}

void IRAM_ATTR handleFinishInterrupt() {
  unsigned long interruptTime = millis();
  if (interruptTime - lastFinishInterruptTime > 1000) {
    lastFinishInterruptTime = interruptTime;
    finishTriggered = true;
  }
}

void sendCORS() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "*");
}

void setup() {
  Serial.begin(115200);
  pinMode(LDR_PIN, INPUT_PULLUP);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, HIGH); // Ensure active-low buzzer is OFF on boot
  
  if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("SSD1306 allocation failed");
  }
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("SprintGate Node B");
  display.println("MAC: d4:e9:f4:e1:ed:94");
  display.println("Connecting Hotspot...");
  display.println("USB-C: Ready (115200)");
  display.display();

  // Dual mode: Connect to Phone Hotspot ("Velocity_Lab"), plus broadcast Emergency SoftAP ("SprintGate-Finish")
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP("SprintGate-Finish", "sprintgate123");
  WiFi.setAutoReconnect(true);
  WiFi.begin(ssid, password);
  
  if (esp_now_init() == ESP_OK) {
    esp_now_register_recv_cb(OnDataRecv);
  }

  attachInterrupt(digitalPinToInterrupt(LDR_PIN), handleFinishInterrupt, RISING);

  // Still keep HTTP /data for backwards compatibility or initial poll
  server.on("/data", HTTP_GET, []() {
    sendCORS();
    int ldrStatus = digitalRead(LDR_PIN) == HIGH ? 1 : 0;
    String json = "{\"ldr_status\":" + String(ldrStatus) + 
                  ",\"active_runners\":" + String(activeRunners) +
                  ",\"new_result\":" + String(newResult ? "true" : "false") +
                  ",\"time\":" + String(lastTime, 3) + "}";
    server.send(200, "application/json", json);
    if (newResult) newResult = false;
  });
  server.on("/data", HTTP_OPTIONS, []() { sendCORS(); server.send(204); });

  server.on("/config", HTTP_GET, []() {
    sendCORS();
    if (server.hasArg("mode")) {
      buzzerMode = server.arg("mode").toInt();
    }
    String json = "{\"mode\":" + String(buzzerMode) + ",\"beam_broken\":" + String(digitalRead(LDR_PIN) == HIGH ? "true" : "false") + "}";
    server.send(200, "application/json", json);
  });
  server.on("/config", HTTP_OPTIONS, []() { sendCORS(); server.send(204); });

  server.on("/start", HTTP_GET, []() {
    sendCORS();
    registerStart();
    server.send(200, "text/plain", "OK");
  });
  server.on("/start", HTTP_OPTIONS, []() { sendCORS(); server.send(204); });

  server.on("/reset", HTTP_GET, []() {
    sendCORS();
    activeRunners = 0;
    updateDisplay(DISPLAY_READY);
    broadcastState();
    server.send(200, "text/plain", "Queue Reset");
  });
  server.on("/reset", HTTP_OPTIONS, []() { sendCORS(); server.send(204); });

  server.begin();
  
  webSocket.begin();
  webSocket.onEvent(webSocketEvent);
  webSocket.enableHeartbeat(2000, 4000, 2);
  
  updateDisplay(DISPLAY_OFFLINE);
}

void loop() {
  // 1. Process USB-C Serial Incoming Commands from Web Serial API
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    if (cmd == "reset" || cmd.indexOf("\"reset\"") != -1) {
      activeRunners = 0;
      updateDisplay(DISPLAY_READY);
      broadcastState();
    } else if (cmd == "start" || cmd.indexOf("\"start\"") != -1) {
      registerStart();
    }
  }

  unsigned long currentMillis = millis();
  if (WiFi.status() != WL_CONNECTED) {
    if (currentMillis - previousMillisWiFi >= 5000) {
      previousMillisWiFi = currentMillis;
      WiFi.reconnect();
    }
    if (wifiWasConnected) {
      wifiWasConnected = false;
      updateDisplay(DISPLAY_OFFLINE);
    }
  } else {
    if (!wifiWasConnected) {
      wifiWasConnected = true;
      updateDisplay(DISPLAY_IP);
      
      if (!MDNS.begin("finishgate")) {
        Serial.println("Error setting up MDNS responder!");
      } else {
        MDNS.addService("http", "tcp", 80);
        MDNS.addService("ws", "tcp", 81);
      }
      ArduinoOTA.setHostname("finishgate");
      ArduinoOTA.begin();
    }
  }

  ArduinoOTA.handle();
  server.handleClient();
  webSocket.loop();
  
  // Continuous 1Hz Telemetry Heartbeat - keeps WebSocket connection 100% active and prevents stale timeouts
  static unsigned long lastHeartbeatMillis = 0;
  if (currentMillis - lastHeartbeatMillis >= 1000) {
    lastHeartbeatMillis = currentMillis;
    broadcastState();
  }

  static int lastLdrStatus = -1;
  int currentLdrStatus = digitalRead(LDR_PIN) == HIGH ? 1 : 0;
  if (currentLdrStatus != lastLdrStatus) {
    lastLdrStatus = currentLdrStatus;
    broadcastState();
  }
  
  if (finishTriggered) {
    finishTriggered = false;
    unsigned long finishTimestamp = lastFinishInterruptTime;
    
    if (activeRunners == 0) {
      if (buzzerMode == 1) {
        tone(BUZZER_PIN, 2000, 100);
        delay(150);
        tone(BUZZER_PIN, 2000, 100);
      }
      updateDisplay(DISPLAY_FAULT);
    } else {
      lastTime = (finishTimestamp - startTimestamps[0]) / 1000.0;
      for (int i = 0; i < activeRunners - 1; i++) {
        startTimestamps[i] = startTimestamps[i + 1];
      }
      activeRunners--;
      newResult = true;
      broadcastState();
      newResult = false; // reset immediately after broadcast
      
      if (buzzerMode == 1) {
        tone(BUZZER_PIN, 2500, 200);
      }
      updateDisplay(DISPLAY_RESULT);
    }
  }

  // Display Rendering (frame limited to 20 FPS to prevent locking)
  static unsigned long lastDisplayUpdate = 0;
  if (millis() - lastDisplayUpdate > 50) {
    lastDisplayUpdate = millis();
    
    display.clearDisplay();
    display.setTextSize(1);
    display.setCursor(0, 0);

    bool isWifiConnected = (WiFi.status() == WL_CONNECTED);
    if (isWifiConnected) {
      display.print("IP: ");
      display.println(WiFi.localIP());
    } else {
      display.print("AP: ");
      display.println(WiFi.softAPIP());
    }
    
    display.drawLine(0, 9, 128, 9, SSD1306_WHITE);
    
    display.setTextSize(2);
    display.setCursor(0, 15);
    
    unsigned long now = millis();
    if (currentDisplayState == DISPLAY_FAULT) {
      display.print("FAULT!");
      if (now - stateChangeTime > 1500) {
        updateDisplay(activeRunners > 0 ? DISPLAY_RUNNING : DISPLAY_READY);
      }
    } else if (currentDisplayState == DISPLAY_RESULT) {
      display.print(lastTime, 3);
      display.print("s");
      if (now - stateChangeTime > 2000) {
        updateDisplay(activeRunners > 0 ? DISPLAY_RUNNING : DISPLAY_READY);
      }
    } else if (currentDisplayState == DISPLAY_RUNNING) {
      display.print("RUN:");
      display.print(activeRunners);
    } else if (isWifiConnected) {
      display.print("ARMED");
    } else {
      display.print("USB-READY");
    }
    
    // Bottom status bar: Beam state & Transport info
    display.setTextSize(1);
    display.setCursor(0, 36);
    int currentBeam = (digitalRead(LDR_PIN) == HIGH) ? 1 : 0;
    if (currentBeam == 1) {
      display.print("BEAM: [BROKEN]");
    } else {
      display.print("BEAM: [CLEAR]");
    }
    
    display.setCursor(0, 48);
    display.print("MAC: d4:e9:f4:e1:ed:94");
    display.setCursor(0, 56);
    display.print(isWifiConnected ? "WS:81 | USB:115200" : "HOTSPOT RETRY | USB");
    
    display.display();
  }

  // Idle Logic for Alignment Buzzer
  static bool wasTonePlaying = false;
  if (buzzerMode == 2) {
    bool beamBroken = (digitalRead(LDR_PIN) == HIGH);
    if (beamBroken) {
      if (!wasTonePlaying) {
        tone(BUZZER_PIN, 1000);
        wasTonePlaying = true;
      }
    } else {
      if (wasTonePlaying) {
        noTone(BUZZER_PIN);
        wasTonePlaying = false;
      }
    }
  } else {
    if (wasTonePlaying) {
      noTone(BUZZER_PIN);
      wasTonePlaying = false;
    }
  }
}
