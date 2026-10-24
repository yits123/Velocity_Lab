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

/**
 * =========================================================================================
 * SprintGate BLE Node B - Multi-Split Timing Gate & Web Bluetooth Gateway
 * Velocity Lab Hardware Firmware
 * =========================================================================================
 * 
 * Target Board: ESP32 Dev Module / ESP32-WROOM-32 / NodeMCU-32S
 * 
 * KEY FEATURES:
 * 1. Direct Web Bluetooth (WebBLE) GATT Server:
 *    - Connects directly to Google Chrome / Microsoft Edge without any native app.
 *    - Zero-latency notification of sub-millisecond sprint finishes & intermediate splits.
 * 
 * 2. Direct USB Type-C 5V Power Rail Monitoring:
 *    - Power is supplied directly via the USB-C port from standard 5V power banks.
 *    - Samples the 5V VBUS rail through a 2:1 resistive divider (100k / 100k) on GPIO 35.
 *    - Telemetry streams real-time millivolts (e.g. 5.12V) and battery depletion percentage.
 *    - Low-voltage warning triggered if power bank boost rail drops below 4.55V.
 * 
 * 3. Dual-Beam Laser Alignment & Anti-Arm-Swing Coincidence Filter:
 *    - Top Beam LDR on GPIO 4 (Chest / Sternum level, ~1.2m height).
 *    - Bottom Beam LDR on GPIO 13 (Hip / Pelvis level, ~0.9m height).
 *    - Coincidence Filter: Validates torso passage only if BOTH beams break within a 15ms window.
 *      Rejects swinging hands, forearms, or trailing foot kicks.
 *    - Live alignment percentage & lux levels streamed over BLE for phone-based audio tuner.
 * 
 * 4. Dual Signal Link (Phone-to-Gate BLE + Gate-to-Gate ESP-NOW):
 *    - Receives Start (Node A) and Splits (Node C) over 2.4GHz ESP-NOW up to 250m+.
 *    - Transmits track radio RSSI back to the coach's dashboard alongside BLE RSSI.
 * =========================================================================================
 */

#include <WiFi.h>
#include <esp_now.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// -----------------------------------------------------------------------------
// PIN DEFINITIONS
// -----------------------------------------------------------------------------
#define TOP_BEAM_PIN      4     // Top photodiode / LDR (Chest level ~1.2m)
#define BOTTOM_BEAM_PIN   13    // Bottom photodiode / LDR (Hip level ~0.9m)
#define BUZZER_PIN        5     // Active-low buzzer or PWM piezo
#define VBUS_ADC_PIN      35    // ADC1 channel for 5V Type-C rail (via 100k/100k divider)

#define OLED_SDA          21
#define OLED_SCL          22
#define SCREEN_WIDTH      128
#define SCREEN_HEIGHT     64

// -----------------------------------------------------------------------------
// BLE GATT UUIDs (Velocity Lab SprintGate Profile)
// -----------------------------------------------------------------------------
#define SERVICE_UUID           "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
#define TIMING_CHAR_UUID       "6e400002-b5a3-f393-e0a9-e50e24dcca9e"
#define TELEMETRY_CHAR_UUID    "6e400003-b5a3-f393-e0a9-e50e24dcca9e"
#define CONTROL_CHAR_UUID      "6e400004-b5a3-f393-e0a9-e50e24dcca9e"

// Standard Bluetooth SIG Battery Service (fallback)
#define BATTERY_SERVICE_UUID   "0000180f-0000-1000-8000-00805f9b34fb"
#define BATTERY_LEVEL_CHAR_UUID "00002a19-0000-1000-8000-00805f9b34fb"

// -----------------------------------------------------------------------------
// COINCIDENCE FILTER TIMING CONSTANTS
// -----------------------------------------------------------------------------
const uint32_t COINCIDENCE_WINDOW_US = 15000; // 15ms torso coincidence window
const uint32_t FINISH_LOCKOUT_MS     = 1500;  // 1.5s finish debounce to prevent double-trips

// -----------------------------------------------------------------------------
// GLOBAL HARDWARE & TIMING STATE
// -----------------------------------------------------------------------------
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

BLEServer*         pServer        = nullptr;
BLECharacteristic* pTimingChar    = nullptr;
BLECharacteristic* pTelemetryChar = nullptr;
BLECharacteristic* pControlChar   = nullptr;
BLECharacteristic* pBatteryChar   = nullptr;

bool bleClientConnected = false;
bool oldBleConnected    = false;

// Race & Timing state
volatile uint32_t startMicros = 0;
volatile uint32_t startMillis = 0;
volatile bool     isTiming    = false;

// Dual-Beam State
volatile uint32_t topBeamBreakUs    = 0;
volatile uint32_t bottomBeamBreakUs = 0;
volatile bool     topBeamTriggered    = false;
volatile bool     bottomBeamTriggered = false;

volatile bool     finishRegistered    = false;
volatile uint32_t finishTimeUs        = 0;
volatile uint32_t finishTimeDeltaUs   = 0;

// Alignment telemetry
int   topBeamAligned    = 0;
int   bottomBeamAligned = 0;
bool  dualLocked        = false;
uint8_t alignmentPct    = 0;

// Power & Battery Telemetry
float    railVoltageVolts  = 5.0f;
uint16_t railVoltageMv     = 5000;
uint8_t  batteryPercentage = 100;
bool     lowVoltageAlert   = false;

// Radio RSSI (Node A / Node C over ESP-NOW)
int8_t   lastRadioRssi     = -65;

// Telemetry Broadcast Interval
unsigned long lastTelemetryMillis = 0;
const unsigned long TELEMETRY_INTERVAL_MS = 200; // 5Hz telemetry stream

// ESP-NOW Data Structures
typedef struct {
  uint8_t  nodeId;       // 0 = Node A (Start), 2 = 10m, 3 = 20m, 4 = 30m
  uint8_t  eventType;    // 1 = Start/Split, 2 = RFID, 3 = Gun
  uint32_t timestampUs;  // Hardware microsecond timestamp
  uint32_t reactionMs;   // Reaction time from starter gun
} SprintPacket;

// -----------------------------------------------------------------------------
// HARDWARE INTERRUPT SERVICE ROUTINES (IRAM)
// -----------------------------------------------------------------------------
void IRAM_ATTR isrTopBeamBreak() {
  uint32_t nowUs = micros();
  topBeamBreakUs = nowUs;
  topBeamTriggered = true;
}

void IRAM_ATTR isrBottomBeamBreak() {
  uint32_t nowUs = micros();
  bottomBeamBreakUs = nowUs;
  bottomBeamTriggered = true;
}

// -----------------------------------------------------------------------------
// BLE SERVER CALLBACKS
// -----------------------------------------------------------------------------
class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
    bleClientConnected = true;
    Serial.println(F("[SprintGate BLE] Web Bluetooth Client Connected!"));
  }

  void onDisconnect(BLEServer* pServer) {
    bleClientConnected = false;
    Serial.println(F("[SprintGate BLE] Client Disconnected. Re-advertising..."));
  }
};

class ControlCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* pChar) {
    std::string rxVal = pChar->getValue();
    if (rxVal.length() > 0) {
      Serial.printf("[SprintGate BLE] Control command received: %s\n", rxVal.c_str());
      if (rxVal == "RESET") {
        isTiming = false;
        finishRegistered = false;
        startMicros = 0;
        topBeamTriggered = false;
        bottomBeamTriggered = false;
        Serial.println(F("[SprintGate BLE] System reset to IDLE"));
      } else if (rxVal == "ALIGN_TEST") {
        // Pulse buzzer
        digitalWrite(BUZZER_PIN, LOW);
        delay(80);
        digitalWrite(BUZZER_PIN, HIGH);
      }
    }
  }
};

// -----------------------------------------------------------------------------
// ESP-NOW RECEIVE CALLBACK (Node A Start & Node C Splits)
// -----------------------------------------------------------------------------
#if ESP_IDF_VERSION >= ESP_IDF_VERSION_VAL(5, 0, 0)
void onEspNowDataRecv(const esp_now_recv_info_t *recv_info, const uint8_t *data, int len) {
  if (recv_info) {
    lastRadioRssi = recv_info->rx_ctrl->rssi;
  }
#else
void onEspNowDataRecv(const uint8_t *mac, const uint8_t *data, int len) {
#endif
  if (len == sizeof(SprintPacket)) {
    SprintPacket packet;
    memcpy(&packet, data, sizeof(packet));

    if (packet.nodeId == 0) {
      // START GATE (Node A) Triggered!
      startMicros = packet.timestampUs > 0 ? packet.timestampUs : micros();
      startMillis = millis();
      isTiming = true;
      finishRegistered = false;
      Serial.printf("[ESP-NOW] Start received! Reaction: %ums | RSSI: %ddBm\n", packet.reactionMs, lastRadioRssi);

      // Notify WebBLE timing characteristic
      if (bleClientConnected && pTimingChar) {
        uint8_t payload[8];
        payload[0] = 0x01; // Start event
        payload[1] = (packet.timestampUs >> 24) & 0xFF;
        payload[2] = (packet.timestampUs >> 16) & 0xFF;
        payload[3] = (packet.timestampUs >> 8) & 0xFF;
        payload[4] = packet.timestampUs & 0xFF;
        payload[5] = (packet.reactionMs >> 8) & 0xFF;
        payload[6] = packet.reactionMs & 0xFF;
        payload[7] = 0; // Node 0
        pTimingChar->setValue(payload, 8);
        pTimingChar->notify();
      }
    } else if (packet.nodeId >= 2) {
      // INTERMEDIATE SPLIT GATE (Node C: 10m, 20m, 30m)
      if (isTiming) {
        uint32_t splitUs = packet.timestampUs > 0 ? packet.timestampUs : micros();
        uint32_t deltaUs = (splitUs > startMicros) ? (splitUs - startMicros) : ((millis() - startMillis) * 1000);
        Serial.printf("[ESP-NOW] Split %u received! Split Time: %.3fs\n", packet.nodeId, deltaUs / 1000000.0f);

        if (bleClientConnected && pTimingChar) {
          uint8_t payload[8];
          payload[0] = 0x02; // Split event
          payload[1] = (deltaUs >> 24) & 0xFF;
          payload[2] = (deltaUs >> 16) & 0xFF;
          payload[3] = (deltaUs >> 8) & 0xFF;
          payload[4] = deltaUs & 0xFF;
          payload[5] = 0;
          payload[6] = 0;
          payload[7] = packet.nodeId; // e.g. 2 for 10m, 3 for 20m
          pTimingChar->setValue(payload, 8);
          pTimingChar->notify();
        }
      }
    }
  }
}

// -----------------------------------------------------------------------------
// TYPE-C 5V VBUS RAIL SAMPLING & BATTERY ESTIMATION
// -----------------------------------------------------------------------------
void sampleTypeCRailVoltage() {
  // Read ADC on GPIO 35 (via two 100kΩ resistors dividing 5V rail by 2)
  // ADC range: 0 to 4095 corresponds to 0V to ~3.3V
  uint32_t rawSum = 0;
  const int NUM_SAMPLES = 16;
  for (int i = 0; i < NUM_SAMPLES; i++) {
    rawSum += analogRead(VBUS_ADC_PIN);
    delayMicroseconds(50);
  }
  float avgRaw = (float)rawSum / NUM_SAMPLES;

  // Voltage at ADC pin (ESP32 calibrated ~3.3V full scale with 11dB attenuation)
  float vAdc = (avgRaw / 4095.0f) * 3.3f * 1.04f; // 1.04 calibration constant
  
  // Total 5V VBUS rail voltage (2:1 divider = multiply by 2.0)
  railVoltageVolts = vAdc * 2.0f;
  railVoltageMv = (uint16_t)(railVoltageVolts * 1000.0f);

  // USB-C Power Bank Battery Estimation:
  // Standard 5V power banks step up internal 1S LiPo (3.0V - 4.2V) to 5.0V - 5.2V.
  // When the power bank battery is full: rail is 5.10V - 5.25V.
  // As the power bank drains near 0%, the internal boost rail starts to droop below 4.65V.
  if (railVoltageVolts >= 5.15f) {
    batteryPercentage = 100;
    lowVoltageAlert = false;
  } else if (railVoltageVolts >= 5.00f) {
    // 5.00V to 5.15V -> 75% to 100%
    batteryPercentage = 75 + (uint8_t)(((railVoltageVolts - 5.00f) / 0.15f) * 25.0f);
    lowVoltageAlert = false;
  } else if (railVoltageVolts >= 4.75f) {
    // 4.75V to 5.00V -> 35% to 75%
    batteryPercentage = 35 + (uint8_t)(((railVoltageVolts - 4.75f) / 0.25f) * 40.0f);
    lowVoltageAlert = false;
  } else if (railVoltageVolts >= 4.55f) {
    // 4.55V to 4.75V -> 10% to 35%
    batteryPercentage = 10 + (uint8_t)(((railVoltageVolts - 4.55f) / 0.20f) * 25.0f);
    lowVoltageAlert = false;
  } else {
    // Drooping below 4.55V indicates the power bank is dying rapidly!
    batteryPercentage = (uint8_t)max(1.0f, ((railVoltageVolts - 4.0f) / 0.55f) * 10.0f);
    lowVoltageAlert = true;
  }
}

// -----------------------------------------------------------------------------
// DUAL-BEAM COINCIDENCE & ALIGNMENT PROCESSING
// -----------------------------------------------------------------------------
void processDualBeamState() {
  // Read optical beam status
  // Photodiode circuit: When laser strikes sensor, pin is LOW (aligned).
  // When beam is interrupted by runner or misaligned, pin goes HIGH.
  topBeamAligned    = (digitalRead(TOP_BEAM_PIN) == LOW) ? 1 : 0;
  bottomBeamAligned = (digitalRead(BOTTOM_BEAM_PIN) == LOW) ? 1 : 0;
  dualLocked        = (topBeamAligned == 1 && bottomBeamAligned == 1);

  if (dualLocked) {
    alignmentPct = 100;
  } else if (topBeamAligned == 1 || bottomBeamAligned == 1) {
    alignmentPct = 50;
  } else {
    alignmentPct = 0;
  }

  // --- COINCIDENCE & FINISH FILTER ---
  bool coincidenceActive = (bottomBeamAligned == 1);

  if (!coincidenceActive) {
    // Single-Beam Finish Mode (When only top laser is active or bottom beam unused)
    if (topBeamTriggered) {
      if (isTiming && !finishRegistered) {
        finishRegistered = true;
        finishTimeUs = topBeamBreakUs;
        finishTimeDeltaUs = (finishTimeUs > startMicros) ? (finishTimeUs - startMicros) : ((millis() - startMillis) * 1000);
        isTiming = false;

        Serial.printf("[FINISH (Single Beam)] Beam broken! FAT: %.3fs\n", finishTimeDeltaUs / 1000000.0f);

        // Audio finish chime on buzzer
        digitalWrite(BUZZER_PIN, LOW);
        delay(120);
        digitalWrite(BUZZER_PIN, HIGH);

        // Dispatch BLE Finish Notification immediately
        if (bleClientConnected && pTimingChar) {
          uint8_t payload[8];
          payload[0] = 0x03; // Finish event
          payload[1] = (finishTimeDeltaUs >> 24) & 0xFF;
          payload[2] = (finishTimeDeltaUs >> 16) & 0xFF;
          payload[3] = (finishTimeDeltaUs >> 8) & 0xFF;
          payload[4] = finishTimeDeltaUs & 0xFF;
          payload[5] = 0;
          payload[6] = 0;
          payload[7] = 1; // Node B Finish Gate
          pTimingChar->setValue(payload, 8);
          pTimingChar->notify();
        }
      }
      topBeamTriggered = false;
      bottomBeamTriggered = false;
    }
  } else if (topBeamTriggered || bottomBeamTriggered) {
    // Dual-Beam Anti-Arm-Swing Coincidence Mode
    uint32_t nowUs = micros();

    // Check if BOTH beams were broken within the coincidence window (15ms)
    if (topBeamTriggered && bottomBeamTriggered) {
      uint32_t delta = (topBeamBreakUs > bottomBeamBreakUs) 
                        ? (topBeamBreakUs - bottomBeamBreakUs) 
                        : (bottomBeamBreakUs - topBeamBreakUs);

      if (delta <= COINCIDENCE_WINDOW_US) {
        // VALID TORSO PASSAGE CONFIRMED!
        if (isTiming && !finishRegistered) {
          finishRegistered = true;
          finishTimeUs = max(topBeamBreakUs, bottomBeamBreakUs);
          finishTimeDeltaUs = (finishTimeUs > startMicros) ? (finishTimeUs - startMicros) : ((millis() - startMillis) * 1000);
          isTiming = false;

          Serial.printf("[FINISH (Dual Beam)] Torso detected! Coincidence delta: %uus | FAT: %.3fs\n", delta, finishTimeDeltaUs / 1000000.0f);

          // Audio finish chime on buzzer
          digitalWrite(BUZZER_PIN, LOW);
          delay(120);
          digitalWrite(BUZZER_PIN, HIGH);

          // Dispatch BLE Finish Notification immediately
          if (bleClientConnected && pTimingChar) {
            uint8_t payload[8];
            payload[0] = 0x03; // Finish event
            payload[1] = (finishTimeDeltaUs >> 24) & 0xFF;
            payload[2] = (finishTimeDeltaUs >> 16) & 0xFF;
            payload[3] = (finishTimeDeltaUs >> 8) & 0xFF;
            payload[4] = finishTimeDeltaUs & 0xFF;
            payload[5] = 0;
            payload[6] = 0;
            payload[7] = 1; // Node B Finish Gate
            pTimingChar->setValue(payload, 8);
            pTimingChar->notify();
          }
        }
        // Reset beam triggers
        topBeamTriggered = false;
        bottomBeamTriggered = false;
      }
    }

    // Coincidence window timeout: if only one beam broke and 15ms elapsed without the second,
    // it was just a swinging hand or knee. Discard it!
    if (topBeamTriggered && (nowUs - topBeamBreakUs > COINCIDENCE_WINDOW_US)) {
      Serial.println(F("[Dual-Beam Filter] Single Top Beam break rejected (Arm swing discarded)"));
      topBeamTriggered = false;
    }
    if (bottomBeamTriggered && (nowUs - bottomBeamBreakUs > COINCIDENCE_WINDOW_US)) {
      Serial.println(F("[Dual-Beam Filter] Single Bottom Beam break rejected (Foot/knee discarded)"));
      bottomBeamTriggered = false;
    }
  }
}

// -----------------------------------------------------------------------------
// BROADCAST TELEMETRY OVER BLE
// -----------------------------------------------------------------------------
void broadcastBleTelemetry() {
  if (!bleClientConnected) return;

  // 8-Byte Telemetry Payload:
  // [0]: Battery Percentage (0 - 100)
  // [1-2]: USB-C 5V Rail Millivolts (uint16)
  // [3]: Top Beam Aligned (0 or 1)
  // [4]: Bottom Beam Aligned (0 or 1)
  // [5]: Dual Locked (0 or 1)
  // [6]: Alignment Percentage (0 - 100)
  // [7]: Radio RSSI (signed int8)
  uint8_t telem[8];
  telem[0] = batteryPercentage;
  telem[1] = (railVoltageMv >> 8) & 0xFF;
  telem[2] = railVoltageMv & 0xFF;
  telem[3] = (uint8_t)topBeamAligned;
  telem[4] = (uint8_t)bottomBeamAligned;
  telem[5] = dualLocked ? 1 : 0;
  telem[6] = alignmentPct;
  telem[7] = (uint8_t)lastRadioRssi;

  if (pTelemetryChar) {
    pTelemetryChar->setValue(telem, 8);
    pTelemetryChar->notify();
  }

  // Also update standard Bluetooth SIG Battery Service
  if (pBatteryChar) {
    pBatteryChar->setValue(&batteryPercentage, 1);
    pBatteryChar->notify();
  }
}

// -----------------------------------------------------------------------------
// OLED STATUS DISPLAY
// -----------------------------------------------------------------------------
void renderOled() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);

  // Header
  display.setCursor(0, 0);
  display.print(F("SPRINTGATE BLE B"));
  display.setCursor(100, 0);
  display.printf("%2d%%", batteryPercentage);

  display.drawLine(0, 10, 128, 10, SSD1306_WHITE);

  // Alignment Status
  display.setCursor(0, 15);
  display.print(F("TOP LASER : "));
  display.print(topBeamAligned ? F("[LOCKED]") : F("[MISS]"));

  display.setCursor(0, 27);
  display.print(F("BTM LASER : "));
  display.print(bottomBeamAligned ? F("[LOCKED]") : F("[MISS]"));

  // Power & Rail
  display.setCursor(0, 39);
  display.printf("USB-C: %.2fV  %s", railVoltageVolts, lowVoltageAlert ? "LOW!" : "OK");

  // State
  display.setCursor(0, 52);
  if (finishRegistered) {
    display.printf("FAT: %.3fs", finishTimeDeltaUs / 1000000.0f);
  } else if (isTiming) {
    display.print(F("STATUS: RUNNING..."));
  } else if (bleClientConnected) {
    display.print(F("BLE: CONNECTED"));
  } else {
    display.print(F("BLE: PAIRING..."));
  }

  display.display();
}

// -----------------------------------------------------------------------------
// SETUP & INITIALIZATION
// -----------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  Serial.println(F("\n=============================================="));
  Serial.println(F("  Velocity Lab SprintGate BLE Node B Booting  "));
  Serial.println(F("=============================================="));

  // Configure Pins
  pinMode(TOP_BEAM_PIN, INPUT_PULLUP);
  pinMode(BOTTOM_BEAM_PIN, INPUT_PULLUP);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, HIGH); // Buzzer off (active low)

  analogReadResolution(12); // 12-bit ADC (0 - 4095)
  analogSetAttenuation(ADC_11db); // Full scale ~3.3V

  // Initialize OLED
  if (display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(10, 25);
    display.print(F("SprintGate BLE..."));
    display.display();
  }

  // Attach Hardware Interrupts for microsecond beam crossing detection
  attachInterrupt(digitalPinToInterrupt(TOP_BEAM_PIN), isrTopBeamBreak, RISING);
  attachInterrupt(digitalPinToInterrupt(BOTTOM_BEAM_PIN), isrBottomBeamBreak, RISING);

  // Initialize Wi-Fi Station & ESP-NOW for Long-Range Gate-to-Gate Communication
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  if (esp_now_init() == ESP_OK) {
    Serial.println(F("[ESP-NOW] Initialized successfully"));
    esp_now_register_recv_cb(onEspNowDataRecv);
  } else {
    Serial.println(F("[ESP-NOW] Initialization failed!"));
  }

  // ---------------------------------------------------------------------------
  // INITIALIZE BLUETOOTH LOW ENERGY (BLE GATT SERVER)
  // ---------------------------------------------------------------------------
  BLEDevice::init("SprintGate-Finish");
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());

  // SprintGate Custom Timing Service
  BLEService* pTimingService = pServer->createService(SERVICE_UUID);

  // 1. Timing Characteristic (Notify splits & finish)
  pTimingChar = pTimingService->createCharacteristic(
    TIMING_CHAR_UUID,
    BLECharacteristic::PROPERTY_NOTIFY | BLECharacteristic::PROPERTY_READ
  );
  pTimingChar->addDescriptor(new BLE2902());

  // 2. Telemetry Characteristic (Notify alignment, rail voltage, RSSI)
  pTelemetryChar = pTimingService->createCharacteristic(
    TELEMETRY_CHAR_UUID,
    BLECharacteristic::PROPERTY_NOTIFY | BLECharacteristic::PROPERTY_READ
  );
  pTelemetryChar->addDescriptor(new BLE2902());

  // 3. Control Characteristic (Write reset/calibrate commands)
  pControlChar = pTimingService->createCharacteristic(
    CONTROL_CHAR_UUID,
    BLECharacteristic::PROPERTY_WRITE
  );
  pControlChar->setCallbacks(new ControlCallbacks());

  pTimingService->start();

  // Standard Battery Service (SIG 0x180F)
  BLEService* pBatteryService = pServer->createService(BATTERY_SERVICE_UUID);
  pBatteryChar = pBatteryService->createCharacteristic(
    BATTERY_LEVEL_CHAR_UUID,
    BLECharacteristic::PROPERTY_NOTIFY | BLECharacteristic::PROPERTY_READ
  );
  pBatteryChar->addDescriptor(new BLE2902());
  pBatteryService->start();

  // Start BLE Advertising
  BLEAdvertising* pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->addServiceUUID(BATTERY_SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06); // Functions that help with iPhone connections issue
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();

  Serial.println(F("[SprintGate BLE] BLE Advertising active. Ready for Web Bluetooth connection!"));
}

// -----------------------------------------------------------------------------
// MAIN LOOP
// -----------------------------------------------------------------------------
void loop() {
  // Re-start advertising if client disconnected
  if (!bleClientConnected && oldBleConnected) {
    delay(500);
    pServer->startAdvertising();
    Serial.println(F("[SprintGate BLE] Resumed advertising"));
    oldBleConnected = bleClientConnected;
  }
  if (bleClientConnected && !oldBleConnected) {
    oldBleConnected = bleClientConnected;
  }

  // 1. Continuous Dual-Beam & Coincidence Processing
  processDualBeamState();

  // 2. Periodic Telemetry (5Hz)
  unsigned long now = millis();
  if (now - lastTelemetryMillis >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryMillis = now;

    // Sample Type-C VBUS Rail
    sampleTypeCRailVoltage();

    // Stream telemetry to Web Bluetooth client
    broadcastBleTelemetry();

    // Update onboard OLED
    renderOled();
  }
}
