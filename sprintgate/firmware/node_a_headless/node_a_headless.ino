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
#include <esp_now.h>
#include <HTTPClient.h>
#include <ESPmDNS.h>
#include <ArduinoOTA.h>
#include <Adafruit_PN532.h>

const int LDR_PIN = 4;
const int BUZZER_PIN = 5;

// SPI pins for PN532 (VSPI default on ESP32)
#define PN532_SCK  18
#define PN532_MISO 19
#define PN532_MOSI 23
#define PN532_SS   21
Adafruit_PN532 rfid(PN532_SCK, PN532_MISO, PN532_MOSI, PN532_SS);

const char* ssid = "Velocity_Lab";
const char* password = "Vlab@123";

int buzzerMode = 1; // 0=Mute, 1=Race, 2=Alignment
String targetFinishIp = "finishgate.local";
uint8_t broadcastAddress[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

WebServer server(80);

volatile bool runnerStarted = false;
volatile unsigned long lastInterruptTime = 0;
volatile unsigned long gunTime = 0;
volatile bool waitingForReaction = false;

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

void IRAM_ATTR handleInterrupt() {
  unsigned long interruptTime = millis();
  if (interruptTime - lastInterruptTime > 1000) {
    runnerStarted = true;
    lastInterruptTime = interruptTime;
  }
}

const char* GATE_AUTH_TOKEN = "VLab-Gate-2026-Secured";

bool isRequestAuthorized() {
  if (server.hasHeader("X-Gate-Auth") && server.header("X-Gate-Auth") == GATE_AUTH_TOKEN) return true;
  if (server.hasArg("token") && server.arg("token") == GATE_AUTH_TOKEN) return true;
  return false;
}

void sendCORS() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type, X-Gate-Auth");
}

void setup() {
  Serial.begin(115200);
  pinMode(LDR_PIN, INPUT_PULLUP);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, HIGH); // Ensure active-low buzzer is OFF on boot
  rfid.begin();
  uint32_t versiondata = rfid.getFirmwareVersion();
  if (versiondata) {
    rfid.SAMConfig(); // configure board to read RFID tags
  }
  
  attachInterrupt(digitalPinToInterrupt(LDR_PIN), handleInterrupt, RISING);

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  unsigned long startWifiAttempt = millis();
  while (WiFi.status() != WL_CONNECTED && (millis() - startWifiAttempt < 3500)) {
    delay(200);
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    if (!MDNS.begin("startgate")) {
      Serial.println("Error setting up MDNS responder!");
    } else {
      Serial.println("mDNS responder started: startgate.local");
      MDNS.addService("http", "tcp", 80);
    }
    ArduinoOTA.setHostname("startgate");
    ArduinoOTA.begin();
  } else {
    Serial.println(F("[WiFi] Hotspot not detected. Proceeding in standalone ESP-NOW track radio mode!"));
  }

  if (esp_now_init() != ESP_OK) {
    Serial.println("ESP-NOW init failed");
    return;
  }
  
  esp_now_peer_info_t peerInfo = {};
  memcpy(peerInfo.peer_addr, broadcastAddress, 6);
  peerInfo.channel = 0;  
  peerInfo.encrypt = false;
  esp_now_add_peer(&peerInfo);

  server.on("/config", HTTP_GET, []() {
    sendCORS();
    if (server.hasArg("mode")) {
      buzzerMode = server.arg("mode").toInt();
    }
    if (server.hasArg("target")) {
      targetFinishIp = server.arg("target");
    }
    String json = "{\"mode\":" + String(buzzerMode) + ",\"beam_broken\":" + String(digitalRead(LDR_PIN) == HIGH ? "true" : "false") + "}";
    server.send(200, "application/json", json);
  });
  
  server.on("/config", HTTP_OPTIONS, []() {
    sendCORS();
    server.send(204);
  });

  server.on("/gun", HTTP_GET, []() {
    sendCORS();
    if (!isRequestAuthorized()) {
      server.send(401, "application/json", "{\"error\":\"Unauthorized: Gate security token required\",\"code\":401}");
      return;
    }
    extern volatile unsigned long gunTime;
    extern volatile bool waitingForReaction;
    gunTime = millis();
    waitingForReaction = true;
    if (buzzerMode == 1) {
      tone(BUZZER_PIN, 2000, 150);
    }
    SprintEvent ev;
    ev.nodeId = 1;
    ev.eventType = 3;
    ev.reactionTime = 0;
    esp_now_send(broadcastAddress, (uint8_t *) &ev, sizeof(ev));
    server.send(200, "text/plain", "GUN");
  });
  server.on("/gun", HTTP_OPTIONS, []() { sendCORS(); server.send(204); });

  const char* headerkeys[] = {"X-Gate-Auth"};
  server.collectHeaders(headerkeys, 1);
  server.begin();
}

void loop() {
  ArduinoOTA.handle();
  server.handleClient();
  
  // RFID Polling
  uint8_t uid[] = { 0, 0, 0, 0, 0, 0, 0 };
  uint8_t uidLength;
  
  // 20ms timeout to avoid blocking the loop and missing LDR interrupts
  if (rfid.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLength, 20)) {
    String uidString = "";
    for (byte i = 0; i < uidLength; i++) {
      uidString += String(uid[i] < 0x10 ? "0" : "");
      uidString += String(uid[i], HEX);
    }
    uidString.toUpperCase();
    
    RfidEvent rev;
    rev.nodeId = 0;
    rev.eventType = 2; // 2 = RFID Scan
    strncpy(rev.uid, uidString.c_str(), sizeof(rev.uid) - 1);
    rev.uid[sizeof(rev.uid) - 1] = '\0';
    
    esp_now_send(broadcastAddress, (uint8_t *)&rev, sizeof(rev));
    
    // Beep to acknowledge scan
    if (buzzerMode > 0) {
      tone(BUZZER_PIN, 3000, 100);
    }
    
    delay(500); // Small debounce so it doesn't spam scans
  }

  bool beamBroken = (digitalRead(LDR_PIN) == HIGH);
  
  if (runnerStarted) {
    runnerStarted = false;
    
    uint32_t reaction = 0;
    if (waitingForReaction) {
      reaction = lastInterruptTime - gunTime;
      waitingForReaction = false;
    }
    
    SprintEvent event;
    event.nodeId = 0; // Node A
    event.eventType = 1; // Beam broken
    event.reactionTime = reaction;
    
    esp_now_send(broadcastAddress, (uint8_t *)&event, sizeof(event));
    
    if (buzzerMode == 1) {
      tone(BUZZER_PIN, 2000, 150);
    }
  }
  
  // Idle Logic for Alignment Buzzer
  static bool wasTonePlaying = false;
  if (buzzerMode == 2) {
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
