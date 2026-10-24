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
 * bleSprintGateService.js
 * Velocity Lab - Direct Web Bluetooth (WebBLE) Hardware Service for ESP32 SprintGates
 * 
 * Features:
 * 1. Zero-install wireless Web Bluetooth connectivity from Chrome/Edge on Android/PC/Mac.
 * 2. Real-time Optical Laser Gate Alignment telemetry (Start Gate 0m Line + Finish Gate).
 * 3. Direct 5V Type-C USB power hardware operation.
 * 4. Sub-millisecond split time streaming for Start, 10m, 20m, 30m, and 40m gates.
 */

import React, { useState, useEffect } from 'react';

// Custom SprintGate BLE GATT UUIDs (Matching sprintgate_ble_node_b.ino GATT server)
export const SPRINTGATE_BLE_UUIDS = {
  SERVICE_UUID: '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
  TIMING_CHAR_UUID: '6e400002-b5a3-f393-e0a9-e50e24dcca9e',     // NOTIFY: sub-ms timing splits & finish (0002)
  TELEMETRY_CHAR_UUID: '6e400003-b5a3-f393-e0a9-e50e24dcca9e',  // NOTIFY: dual-beam alignment, battery, RSSI (0003)
  CONTROL_CHAR_UUID: '6e400004-b5a3-f393-e0a9-e50e24dcca9e',    // WRITE: arm, reset, buzzer, mode (0004)
  STANDARD_BATTERY_SERVICE: 0x180F,
  STANDARD_BATTERY_LEVEL: 0x2A19
};

// Gate split positions mapping
export const GATE_POSITIONS = [
  { id: 0, key: 'start', label: 'Start Gate (0m)', distance: 0, defaultRole: 'start' },
  { id: 1, key: 'split10', label: 'Split Gate 1 (10m)', distance: 10, defaultRole: 'split' },
  { id: 2, key: 'split20', label: 'Split Gate 2 (20m)', distance: 20, defaultRole: 'split' },
  { id: 3, key: 'split30', label: 'Split Gate 3 (30m)', distance: 30, defaultRole: 'split' },
  { id: 4, key: 'finish40', label: 'Finish Gate (40m)', distance: 40, defaultRole: 'finish' }
];

class BleSprintGateService {
  constructor() {
    this.device = null;
    this.server = null;
    this.timingCharacteristic = null;
    this.telemetryCharacteristic = null;
    this.controlCharacteristic = null;

    // Connection state
    this.isConnected = false;
    this.isConnecting = false;
    this.isReconnecting = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 6;
    this.autoReconnect = true;
    this.manualDisconnect = false;
    this.reconnectTimer = null;
    this.deviceName = '';

    // Power State
    this.powerSource = 'Disconnected';

    // Gate Optical Alignment State (Start Gate 0m + Finish Gate at Track Distance)
    this.gateAlignment = {
      startGateAligned: false,      // Node A at 0m Start Line
      finishGateAligned: false,     // Node B at Finish Line
      allLocked: false,             // Both gates optical beams locked
      alignmentPercentage: 0,       // 0%, 50%, or 100%
      startLux: 0,
      finishLux: 0,
      alignmentBuzzer: false,
      lastBeamBreakTime: 0
    };

    // Active timing splits buffer
    this.splits = [];
    this.lastResult = null;
    this.listeners = new Set();
    this.timingListeners = new Set();

    // Bind window focus auto-reconnect
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => {
        if (!this.isConnected && this.autoReconnect && !this.manualDisconnect) {
          this.tryAutoConnectSavedDevice();
        }
      });
    }
  }

  isSupported() {
    return typeof navigator !== 'undefined' && Boolean(navigator.bluetooth);
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  subscribeTiming(listener) {
    this.timingListeners.add(listener);
    return () => this.timingListeners.delete(listener);
  }

  notifyStateChange() {
    const state = this.getState();
    this.listeners.forEach(fn => {
      try { fn(state); } catch (e) { console.error('[BleSprintGate] listener error:', e); }
    });
  }

  notifyTimingEvent(event) {
    this.timingListeners.forEach(fn => {
      try { fn(event); } catch (e) { console.error('[BleSprintGate] timing listener error:', e); }
    });
  }

  getState() {
    return {
      isSupported: this.isSupported(),
      isConnected: this.isConnected,
      isConnecting: this.isConnecting,
      isReconnecting: this.isReconnecting,
      reconnectAttempts: this.reconnectAttempts,
      autoReconnect: this.autoReconnect,
      deviceName: this.deviceName,
      powerSource: this.isConnected ? 'Type-C 5V Bus' : 'Disconnected',
      gateAlignment: { ...this.gateAlignment },
      // Compatibility mapping
      dualBeam: {
        topAligned: this.gateAlignment.startGateAligned,
        bottomAligned: this.gateAlignment.finishGateAligned,
        dualLocked: this.gateAlignment.allLocked,
        alignmentPercentage: this.gateAlignment.alignmentPercentage,
        startGateAligned: this.gateAlignment.startGateAligned,
        finishGateAligned: this.gateAlignment.finishGateAligned,
        topLux: this.gateAlignment.startLux,
        bottomLux: this.gateAlignment.finishLux
      },
      splits: [...this.splits],
      lastResult: this.lastResult ? { ...this.lastResult } : null
    };
  }

  /**
   * Request Bluetooth Pairing & Connect to SprintGate Hardware
   */
  async requestDeviceAndConnect() {
    return await this.connect();
  }

  async connect() {
    if (!this.isSupported()) {
      throw new Error('Web Bluetooth is not supported in this browser. Please use Google Chrome or Microsoft Edge.');
    }

    this.manualDisconnect = false;
    this.isConnecting = true;
    this.notifyStateChange();

    try {
      console.info('[BleSprintGate] Requesting Bluetooth Device...');
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { namePrefix: 'SprintGate' },
          { namePrefix: 'VelocityLab' },
          { services: [SPRINTGATE_BLE_UUIDS.SERVICE_UUID] }
        ],
        optionalServices: [
          SPRINTGATE_BLE_UUIDS.SERVICE_UUID,
          SPRINTGATE_BLE_UUIDS.STANDARD_BATTERY_SERVICE
        ]
      });

      this.device = device;
      this.deviceName = device.name || 'SprintGate Node B (Master)';
      device.addEventListener('gattserverdisconnected', () => this.handleDisconnection());

      // Save device ID for fast auto-reconnect
      try {
        localStorage.setItem('velocity_lab_ble_gate_id', device.id);
        localStorage.setItem('velocity_lab_ble_gate_name', this.deviceName);
      } catch (e) {}

      await this.establishGattConnection();
      await this.startRssiMonitoring();

      this.isConnected = true;
      this.isConnecting = false;
      this.isReconnecting = false;
      this.reconnectAttempts = 0;
      this.notifyStateChange();

      return true;
    } catch (err) {
      this.isConnecting = false;
      this.isReconnecting = false;
      this.notifyStateChange();
      console.warn('[BleSprintGate] Connection failed or user cancelled pairing:', err);
      throw err;
    }
  }

  async establishGattConnection() {
    if (!this.device) return;
    console.info(`[BleSprintGate] Connecting to GATT server on ${this.deviceName}...`);
    this.server = await this.device.gatt.connect();

    // 1. SprintGate Custom Timing & Telemetry Service
    try {
      const service = await this.server.getPrimaryService(SPRINTGATE_BLE_UUIDS.SERVICE_UUID);
      
      // Timing Characteristic (Sub-millisecond Start, Splits, Finish)
      try {
        this.timingCharacteristic = await service.getCharacteristic(SPRINTGATE_BLE_UUIDS.TIMING_CHAR_UUID);
        await this.timingCharacteristic.startNotifications();
        this.timingCharacteristic.addEventListener('characteristicvaluechanged', (e) => this.handleTimingNotification(e));
        console.info('[BleSprintGate] Subscribed to Hardware Timing Notifications.');
      } catch (err) {
        console.warn('[BleSprintGate] Timing characteristic not available:', err);
      }

      // Telemetry Characteristic (Dual-beam alignment, Type-C rail voltage, radio link RSSI)
      try {
        this.telemetryCharacteristic = await service.getCharacteristic(SPRINTGATE_BLE_UUIDS.TELEMETRY_CHAR_UUID);
        await this.telemetryCharacteristic.startNotifications();
        this.telemetryCharacteristic.addEventListener('characteristicvaluechanged', (e) => this.handleTelemetryNotification(e));
        console.info('[BleSprintGate] Subscribed to Hardware Telemetry Notifications.');
      } catch (err) {
        console.warn('[BleSprintGate] Telemetry characteristic not available:', err);
      }

      // Control Characteristic (Arm, Reset, Laser Alignment Buzzer)
      try {
        this.controlCharacteristic = await service.getCharacteristic(SPRINTGATE_BLE_UUIDS.CONTROL_CHAR_UUID);
      } catch (err) {
        console.warn('[BleSprintGate] Control characteristic not available:', err);
      }
    } catch (err) {
      console.warn('[BleSprintGate] Custom SprintGate service not found, checking fallback battery service:', err);
    }

    // 2. Standard Battery Service Fallback
    try {
      const batService = await this.server.getPrimaryService(SPRINTGATE_BLE_UUIDS.STANDARD_BATTERY_SERVICE);
      const batChar = await batService.getCharacteristic(SPRINTGATE_BLE_UUIDS.STANDARD_BATTERY_LEVEL);
      const val = await batChar.readValue();
      this.batteryPercentage = val.getUint8(0);
      batChar.addEventListener('characteristicvaluechanged', (e) => {
        this.batteryPercentage = e.target.value.getUint8(0);
        this.notifyStateChange();
      });
      await batChar.startNotifications().catch(() => {});
    } catch (e) {}
  }

  /**
   * Parse Sub-Millisecond Timing Notification Packet
   */
  handleTimingNotification(event) {
    const val = event.target.value;
    if (!val || val.byteLength < 4) return;

    let eventType = val.getUint8(0);
    let gateId = 0;
    let distance = 0;
    let timeMicros = 0;
    let reactionTime = 0;

    // Detect 8-byte physical ESP32 firmware packet (Big Endian) vs simulation packet
    if (val.byteLength === 8) {
      gateId = val.getUint8(7);
      timeMicros = val.getUint32(1, false); // Big Endian delta microseconds
      reactionTime = val.getUint16(5, false); // Big Endian reaction ms
      if (gateId === 0) distance = 0;
      else if (gateId === 1) distance = 40;
      else if (gateId === 2) distance = 10;
      else if (gateId === 3) distance = 20;
      else if (gateId === 4) distance = 30;
      else distance = gateId * 10;
    } else {
      gateId = val.getUint8(1);
      distance = val.byteLength >= 4 ? val.getUint16(2, true) : (gateId * 10);
      timeMicros = val.byteLength >= 8 ? val.getUint32(4, true) : 0;
      reactionTime = val.byteLength >= 10 ? val.getUint16(8, true) : 0;
    }

    const timeSec = parseFloat((timeMicros / 1000000).toFixed(3));

    const timingEvent = {
      eventType: eventType === 1 ? 'start' : eventType === 2 ? 'split' : eventType === 3 ? 'finish' : 'false_start',
      gateId,
      distance,
      time: timeSec,
      micros: timeMicros,
      reactionTime,
      timestamp: Date.now()
    };

    console.info(`[BleSprintGate] Hardware Timing Event: ${timingEvent.eventType} at ${distance}m = ${timeSec}s (RT: ${reactionTime}ms)`);

    if (timingEvent.eventType === 'split') {
      this.splits.push({ node: gateId, distance, time: timeSec });
    } else if (timingEvent.eventType === 'finish') {
      this.lastResult = { ...timingEvent };
    } else if (timingEvent.eventType === 'start') {
      this.splits = [];
    }

    this.notifyStateChange();
    this.notifyTimingEvent(timingEvent);
  }

  /**
   * Parse Optical Gate Alignment Telemetry Packet (Start Gate 0m + Finish Gate at Distance)
   */
  handleTelemetryNotification(event) {
    const val = event.target.value;
    if (!val || val.byteLength < 1) return;

    // Bit 0: Start Gate (Node A at 0m) beam aligned (1 = aligned, 0 = broken/obstructed)
    // Bit 1: Finish Gate (Node B at Track Distance) beam aligned (1 = aligned, 0 = broken/obstructed)
    const alignBits = val.getUint8(0);
    const startGateAligned = (alignBits & 0x01) !== 0;
    const finishGateAligned = (alignBits & 0x02) !== 0;
    const allLocked = startGateAligned && finishGateAligned;
    const alignmentPercentage = allLocked ? 100 : (startGateAligned || finishGateAligned ? 50 : 0);

    const startLux = val.byteLength >= 3 ? val.getUint16(1, true) : (startGateAligned ? 850 : 120);
    const finishLux = val.byteLength >= 5 ? val.getUint16(3, true) : (finishGateAligned ? 850 : 120);

    this.gateAlignment = {
      startGateAligned,
      finishGateAligned,
      allLocked,
      alignmentPercentage,
      startLux,
      finishLux,
      alignmentBuzzer: this.gateAlignment.alignmentBuzzer,
      lastBeamBreakTime: (!startGateAligned || !finishGateAligned) ? Date.now() : this.gateAlignment.lastBeamBreakTime
    };

    this.notifyStateChange();
  }

  /**
   * Real-time BLE Advertisement RSSI monitoring
   */
  async startRssiMonitoring() {
    if (!this.device || !this.device.watchAdvertisements) return;
    try {
      await this.device.watchAdvertisements();
      this.device.addEventListener('advertisementreceived', (event) => {
        if (event.rssi !== undefined) {
          this.bleRssi = event.rssi;
          this.notifyStateChange();
        }
      });
      this.rssiWatchActive = true;
    } catch (err) {
      console.warn('[BleSprintGate] watchAdvertisements not supported, using fallback RSSI:', err);
    }
  }

  /**
   * Send Control Command to Hardware (Arm, Reset, Buzzer, Mode)
   */
  async sendControlCommand(commandName, param = 0) {
    if (!this.isConnected || !this.controlCharacteristic) {
      console.warn('[BleSprintGate] Control characteristic not connected.');
      return false;
    }

    try {
      // ESP32 firmware expects ASCII command: "RESET" or "ALIGN_TEST"
      const cmdStr = (commandName === 'reset') ? 'RESET' : (commandName === 'buzzer') ? 'ALIGN_TEST' : String(commandName).toUpperCase();
      const encoder = new TextEncoder();
      await this.controlCharacteristic.writeValue(encoder.encode(cmdStr));
      return true;
    } catch (err) {
      console.error('[BleSprintGate] Failed to send control command:', err);
      return false;
    }
  }

  handleDisconnection() {
    this.isConnected = false;
    this.server = null;
    this.timingCharacteristic = null;
    this.telemetryCharacteristic = null;
    this.controlCharacteristic = null;
    this.notifyStateChange();

    if (!this.manualDisconnect && this.autoReconnect) {
      this.attemptAutoReconnect();
    }
  }

  attemptAutoReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.isReconnecting = false;
      this.notifyStateChange();
      console.warn('[BleSprintGate] Max reconnect attempts reached.');
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;
    const delay = Math.min(10000, 1000 * Math.pow(1.5, this.reconnectAttempts - 1));
    this.notifyStateChange();

    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(async () => {
      try {
        if (this.device && this.device.gatt) {
          console.info(`[BleSprintGate] Reconnecting attempt ${this.reconnectAttempts}...`);
          await this.establishGattConnection();
          this.isConnected = true;
          this.isReconnecting = false;
          this.reconnectAttempts = 0;
          this.notifyStateChange();
        }
      } catch (err) {
        this.attemptAutoReconnect();
      }
    }, delay);
  }

  async tryAutoConnectSavedDevice() {
    if (!navigator.bluetooth || !navigator.bluetooth.getDevices) return;
    try {
      const savedId = localStorage.getItem('velocity_lab_ble_gate_id');
      if (!savedId) return;

      const devices = await navigator.bluetooth.getDevices();
      const matched = devices.find(d => d.id === savedId);
      if (matched) {
        this.device = matched;
        this.deviceName = matched.name || 'SprintGate Node B (Master)';
        await this.establishGattConnection();
        this.isConnected = true;
        this.notifyStateChange();
      }
    } catch (e) {}
  }

  disconnect() {
    this.manualDisconnect = true;
    this.autoReconnect = false;
    clearTimeout(this.reconnectTimer);

    if (this.device && this.device.gatt && this.device.gatt.connected) {
      this.device.gatt.disconnect();
    }
    this.isConnected = false;
    this.isConnecting = false;
    this.isReconnecting = false;
    this.notifyStateChange();
  }

  setAutoReconnect(enabled) {
    this.autoReconnect = enabled;
    this.notifyStateChange();
  }
}

// Singleton export
export const bleSprintGateService = new BleSprintGateService();

/**
 * Custom React Hook for Component-Level Integration
 */
export function useBleSprintGate() {
  const [state, setState] = useState(() => bleSprintGateService.getState());

  useEffect(() => {
    return bleSprintGateService.subscribe(setState);
  }, []);

  return {
    ...state,
    connect: () => bleSprintGateService.connect(),
    disconnect: () => bleSprintGateService.disconnect(),
    setAutoReconnect: (val) => bleSprintGateService.setAutoReconnect(val),
    sendControlCommand: (cmd, param) => bleSprintGateService.sendControlCommand(cmd, param)
  };
}

export default bleSprintGateService;
