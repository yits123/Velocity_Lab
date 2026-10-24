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

const int LDR_PIN = 4;
const int BUZZER_PIN = 5;

const char* ssid = "Velocity_Lab";
const char* password = "Vlab@123";

int buzzerMode = 1; // 0=Mute, 1=Race, 2=Alignment
int splitNodeId = 2; // Configurable (2 = Node C, 3 = Node D, etc.)

String targetFinishIp = "finishgate.local";
uint8_t broadcastAddress[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

WebServer server(80);

volatile bool runnerStarted = false;
volatile unsigned long lastInterruptTime = 0;

typedef struct {
    uint8_t nodeId;
    uint8_t eventType;
    uint32_t reactionTime;
} SprintEvent;

void IRAM_ATTR handleInterrupt() {
  unsigned long interruptTime = millis();
  if (interruptTime - lastInterruptTime > 1000) {
    runnerStarted = true;
    lastInterruptTime = interruptTime;
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
  
  attachInterrupt(digitalPinToInterrupt(LDR_PIN), handleInterrupt, RISING);

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  unsigned long startWifiAttempt = millis();
  while (WiFi.status() != WL_CONNECTED && (millis() - startWifiAttempt < 3500)) {
    delay(200);
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    if (!MDNS.begin("splitgate")) {
      Serial.println("Error setting up MDNS responder!");
    } else {
      Serial.println("mDNS responder started: splitgate.local");
      MDNS.addService("http", "tcp", 80);
    }
    ArduinoOTA.setHostname("splitgate");
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
    if (server.hasArg("nodeId")) {
      splitNodeId = server.arg("nodeId").toInt();
    }
    String json = "{\"mode\":" + String(buzzerMode) + ",\"nodeId\":" + String(splitNodeId) + ",\"beam_broken\":" + String(digitalRead(LDR_PIN) == HIGH ? "true" : "false") + "}";
    server.send(200, "application/json", json);
  });
  
  server.on("/config", HTTP_OPTIONS, []() {
    sendCORS();
    server.send(204);
  });

  server.begin();
}

void loop() {
  ArduinoOTA.handle();
  server.handleClient();
  
  bool beamBroken = (digitalRead(LDR_PIN) == HIGH);
  
  if (runnerStarted) {
    runnerStarted = false;
    
    SprintEvent event;
    event.nodeId = splitNodeId; // Default 2 = Node C
    event.eventType = 1; // Beam broken
    event.reactionTime = 0; // Split nodes don't record reaction time
    
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
