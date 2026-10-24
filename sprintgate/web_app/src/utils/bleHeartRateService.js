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
 * bleHeartRateService.js
 * Velocity Lab - Bluetooth Low Energy (BLE) Heart Rate & Biotelemetry Service
 * 
 * Supports standard Bluetooth GATT Heart Rate Profile (0x180D) and Battery Service (0x180F):
 * - Polar H10, Polar OH1, Polar Verity Sense
 * - Garmin HRM-Pro, HRM-Dual, HRM-Tri
 * - Wahoo TICKR / TICKR X
 * - Scosche Rhythm+ / Rhythm24
 * - Standard BLE Smart Straps & Smartwatches
 */

import React from 'react';
import offlineTelemetryQueue from './offlineTelemetryQueue';

// Bluetooth GATT Standard UUIDs
export const BLE_UUIDS = {
  HEART_RATE_SERVICE: 0x180D, // '0000180d-0000-1000-8000-00805f9b34fb'
  HEART_RATE_MEASUREMENT: 0x2A37, // '00002a37-0000-1000-8000-00805f9b34fb'
  BODY_SENSOR_LOCATION: 0x2A38,
  BATTERY_SERVICE: 0x180F,
  BATTERY_LEVEL: 0x2A19
};

// Sports Science HR Zones (Based on Edwards / ACSM % of HRmax)
export const HR_ZONES = [
  { zone: 1, name: 'Active Recovery', minPct: 0.50, maxPct: 0.60, color: 'text-cyan-700 dark:text-cyan-400', bg: 'bg-cyan-500/15 dark:bg-cyan-500/20 border-cyan-500/30 dark:border-cyan-500/40', desc: 'Metabolic clearance & active rest' },
  { zone: 2, name: 'Aerobic Base', minPct: 0.60, maxPct: 0.70, color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-500/15 dark:bg-emerald-500/20 border-emerald-500/30 dark:border-emerald-500/40', desc: 'Mitochondrial efficiency & fat oxidation' },
  { zone: 3, name: 'Aerobic Tempo', minPct: 0.70, maxPct: 0.80, color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-500/15 dark:bg-amber-500/20 border-amber-500/30 dark:border-amber-500/40', desc: 'Cardiovascular capacity & aerobic power' },
  { zone: 4, name: 'Anaerobic Threshold', minPct: 0.80, maxPct: 0.90, color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-500/15 dark:bg-orange-500/20 border-orange-500/30 dark:border-orange-500/40', desc: 'Lactate tolerance & sustained high output' },
  { zone: 5, name: 'Neuromuscular Maximum', minPct: 0.90, maxPct: 1.05, color: 'text-rose-700 dark:text-rose-400', bg: 'bg-rose-500/15 dark:bg-rose-500/20 border-rose-500/30 dark:border-rose-500/40', desc: 'Peak sprint power & alactic burst' }
];

export function calculateHrZone(bpm, maxHr = 195) {
  if (!bpm || bpm <= 0) return { 
    zone: 0, 
    name: 'Resting / Idle', 
    color: 'text-slate-600 dark:text-slate-400', 
    bg: 'bg-slate-200/80 dark:bg-slate-800 border-slate-300 dark:border-slate-700', 
    pct: 0, 
    desc: 'Below training zone' 
  };
  const pct = Math.round((bpm / maxHr) * 100);

  if (pct < 60) {
    return { ...HR_ZONES[0], pct, bpm };
  } else if (pct < 70) {
    return { ...HR_ZONES[1], pct, bpm };
  } else if (pct < 80) {
    return { ...HR_ZONES[2], pct, bpm };
  } else if (pct < 90) {
    return { ...HR_ZONES[3], pct, bpm };
  } else {
    return { ...HR_ZONES[4], pct, bpm };
  }
}

class BleHeartRateService {
  constructor() {
    this.device = null;
    this.server = null;
    this.hrCharacteristic = null;
    this.batteryCharacteristic = null;
    
    this.isConnected = false;
    this.isConnecting = false;
    this.isReconnecting = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 6;
    this.autoReconnect = true;
    this.manualDisconnect = false;
    this.reconnectTimer = null;
    this.deviceName = '';
    this.batteryLevel = null;
    this.sensorContact = true;
    this.currentBpm = 0;
    this.maxHr = 195;
    this.rrIntervals = [];
    
    // Rolling HR history for telemetry graphs (last 60 data points)
    this.history = [];
    this.listeners = new Set();

    // Auto-reconnect saved device check on initialization
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => {
        if (!this.isConnected && this.autoReconnect && !this.manualDisconnect) {
          this.tryAutoConnectSavedDevice();
        }
      });
    }
  }

  isSupported() {
    return typeof navigator !== 'undefined' && !!navigator.bluetooth;
  }

  subscribe(callback) {
    this.listeners.add(callback);
    // Send immediate initial state
    callback(this.getState());
    return () => this.listeners.delete(callback);
  }

  notify() {
    const state = this.getState();
    this.listeners.forEach(cb => {
      try {
        cb(state);
      } catch (err) {
        console.error('[BleHeartRateService] Subscriber error:', err);
      }
    });
  }

  getState() {
    const zone = calculateHrZone(this.currentBpm, this.maxHr);
    return {
      isSupported: this.isSupported(),
      isConnected: this.isConnected,
      isConnecting: this.isConnecting,
      isReconnecting: this.isReconnecting,
      reconnectAttempts: this.reconnectAttempts,
      autoReconnect: this.autoReconnect,
      deviceName: this.deviceName,
      batteryLevel: this.batteryLevel,
      sensorContact: this.sensorContact,
      bpm: this.currentBpm,
      zone,
      maxHr: this.maxHr,
      rrIntervals: this.rrIntervals,
      history: [...this.history]
    };
  }

  setAutoReconnect(enabled) {
    this.autoReconnect = !!enabled;
    this.notify();
  }

  setMaxHr(newMax) {
    if (newMax && newMax > 100 && newMax < 240) {
      this.maxHr = newMax;
      this.notify();
    }
  }

  /**
   * Safe no-op handler for sprint stimulation triggers
   */
  triggerSprintStimulation(isSprinting = false, isRecovery = false) {
    // No-op for physical hardware BLE GATT connection
  }

  /**
   * Attempt auto-connecting to previously permitted device without opening browser picker
   */
  async tryAutoConnectSavedDevice() {
    if (!this.isSupported() || !navigator.bluetooth.getDevices || this.isConnected || this.isConnecting) return false;

    try {
      const devices = await navigator.bluetooth.getDevices();
      const savedName = localStorage.getItem('vlab_last_ble_device_name');
      const targetDevice = devices.find(d => d.name === savedName) || devices[0];
      if (targetDevice) {
        console.info(`[BleHeartRateService] Auto-reconnecting to authorized device: ${targetDevice.name}`);
        this.device = targetDevice;
        this.deviceName = targetDevice.name || 'Bluetooth Heart Rate Strap';
        return await this.setupGattConnection();
      }
    } catch (err) {
      console.warn('[BleHeartRateService] Auto-connect to saved device failed:', err);
    }
    return false;
  }

  /**
   * Connect to standard BLE Heart Rate Sensor
   */
  async connect() {
    if (!this.isSupported()) {
      throw new Error('Web Bluetooth API is not supported in this browser. Please use Google Chrome or Microsoft Edge.');
    }

    try {
      this.manualDisconnect = false;
      this.isConnecting = true;
      this.notify();

      // Request Heart Rate device with optional Battery Service
      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [BLE_UUIDS.HEART_RATE_SERVICE] }],
        optionalServices: [BLE_UUIDS.BATTERY_SERVICE, 'battery_service', 0x180F]
      });

      this.deviceName = this.device.name || 'Bluetooth Heart Rate Strap';
      try {
        localStorage.setItem('vlab_last_ble_device_name', this.deviceName);
      } catch (e) {}

      return await this.setupGattConnection();
    } catch (err) {
      this.isConnecting = false;
      this.notify();
      if (err.name === 'NotFoundError') {
        // User cancelled the Bluetooth picker dialog
        return false;
      }
      console.error('[BleHeartRateService] Bluetooth pairing error:', err);
      throw err;
    }
  }

  async setupGattConnection() {
    if (!this.device) return false;

    try {
      this.device.removeEventListener('gattserverdisconnected', this.handleDisconnectedBound);
      this.handleDisconnectedBound = () => this.handleDisconnected();
      this.device.addEventListener('gattserverdisconnected', this.handleDisconnectedBound);

      // Connect to GATT server
      this.server = await this.device.gatt.connect();

      // Get Heart Rate Service & Characteristic
      const hrService = await this.server.getPrimaryService(BLE_UUIDS.HEART_RATE_SERVICE);
      this.hrCharacteristic = await hrService.getCharacteristic(BLE_UUIDS.HEART_RATE_MEASUREMENT);

      // Subscribe to notifications
      await this.hrCharacteristic.startNotifications();
      this.hrCharacteristic.addEventListener('characteristicvaluechanged', (e) => this.handleHeartRateMeasurement(e));

      // Attempt reading battery level if available
      try {
        const batteryService = await this.server.getPrimaryService(BLE_UUIDS.BATTERY_SERVICE);
        this.batteryCharacteristic = await batteryService.getCharacteristic(BLE_UUIDS.BATTERY_LEVEL);
        const batteryData = await this.batteryCharacteristic.readValue();
        this.batteryLevel = batteryData.getUint8(0);
        
        await this.batteryCharacteristic.startNotifications();
        this.batteryCharacteristic.addEventListener('characteristicvaluechanged', (e) => {
          this.batteryLevel = e.target.value.getUint8(0);
          this.notify();
        });
      } catch (batErr) {
        console.info('[BleHeartRateService] Battery service optional/unavailable on this strap.');
      }

      this.isConnected = true;
      this.isConnecting = false;
      this.isReconnecting = false;
      this.reconnectAttempts = 0;
      this.notify();

      return true;
    } catch (err) {
      this.isConnecting = false;
      this.notify();
      throw err;
    }
  }

  /**
   * Parse GATT Heart Rate Measurement Characteristic (0x2A37)
   */
  handleHeartRateMeasurement(event) {
    const value = event.target.value;
    if (!value || value.byteLength === 0) return;

    const flags = value.getUint8(0);
    const is16Bit = (flags & 0x01) !== 0;
    const contactSensorSupported = (flags & 0x04) !== 0;
    const contactDetected = (flags & 0x02) !== 0;
    const energyExpendedPresent = (flags & 0x08) !== 0;
    const rrIntervalsPresent = (flags & 0x10) !== 0;

    this.sensorContact = contactSensorSupported ? contactDetected : true;

    let index = 1;
    let bpm = 0;
    if (is16Bit) {
      bpm = value.getUint16(index, /*littleEndian=*/true);
      index += 2;
    } else {
      bpm = value.getUint8(index);
      index += 1;
    }

    if (energyExpendedPresent) {
      index += 2; // skip energy expended
    }

    // Extract RR-intervals if present
    const intervals = [];
    if (rrIntervalsPresent) {
      while (index + 1 < value.byteLength) {
        const rawRr = value.getUint16(index, true);
        const ms = Math.round((rawRr / 1024) * 1000);
        intervals.push(ms);
        index += 2;
      }
      this.rrIntervals = intervals;
    }

    if (bpm > 0) {
      this.currentBpm = bpm;
      this.pushHistory(bpm);

      // Background telemetry queueing when device is offline
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        offlineTelemetryQueue.enqueueHrSample({
          bpm,
          zone: calculateHrZone(bpm, this.maxHr)?.zone || 0,
          rrIntervals: intervals,
          deviceName: this.deviceName
        });
      }
    }

    this.notify();
  }

  pushHistory(bpm) {
    const now = Date.now();
    this.history.push({ time: now, bpm });
    if (this.history.length > 60) {
      this.history.shift();
    }
  }

  handleDisconnected() {
    this.isConnected = false;
    this.isConnecting = false;
    
    // Automatically trigger exponential backoff auto-reconnect if unexpected
    if (!this.manualDisconnect && this.autoReconnect && this.device) {
      this.scheduleReconnect();
    } else {
      this.isReconnecting = false;
      this.reconnectAttempts = 0;
      this.notify();
    }
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn(`[BleHeartRateService] Max reconnection attempts (${this.maxReconnectAttempts}) reached. Pausing auto-reconnect.`);
      this.isReconnecting = false;
      this.notify();
      return;
    }

    this.reconnectAttempts++;
    this.isReconnecting = true;
    this.notify();

    const delay = Math.min(8000, 1000 * Math.pow(1.5, this.reconnectAttempts - 1));
    console.info(`[BleHeartRateService] Disconnected. Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${Math.round(delay)}ms...`);

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(async () => {
      try {
        if (!this.manualDisconnect && this.device) {
          await this.setupGattConnection();
          console.info(`[BleHeartRateService] Successfully reconnected to ${this.deviceName}!`);
        }
      } catch (err) {
        console.warn(`[BleHeartRateService] Reconnect attempt ${this.reconnectAttempts} failed:`, err);
        this.scheduleReconnect();
      }
    }, delay);
  }

  disconnect() {
    this.manualDisconnect = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.device && this.device.gatt && this.device.gatt.connected) {
      try {
        this.device.gatt.disconnect();
      } catch (e) {
        console.warn('[BleHeartRateService] Disconnect error:', e);
      }
    }
    this.device = null;
    this.server = null;
    this.hrCharacteristic = null;
    this.batteryCharacteristic = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.isReconnecting = false;
    this.reconnectAttempts = 0;
    this.currentBpm = 0;
    this.notify();
  }
}

// Global singleton instance
export const bleHeartRateService = new BleHeartRateService();

/**
 * Custom React Hook to consume live BLE Heart Rate Telemetry
 */
export function useBleHeartRate() {
  const [state, setState] = React.useState(() => bleHeartRateService.getState());

  React.useEffect(() => {
    const unsubscribe = bleHeartRateService.subscribe((newState) => {
      setState(newState);
    });
    return unsubscribe;
  }, []);

  const connect = React.useCallback(() => bleHeartRateService.connect(), []);
  const disconnect = React.useCallback(() => bleHeartRateService.disconnect(), []);
  const setMaxHr = React.useCallback((maxHr) => bleHeartRateService.setMaxHr(maxHr), []);
  const setAutoReconnect = React.useCallback((enabled) => bleHeartRateService.setAutoReconnect(enabled), []);

  return {
    ...state,
    connect,
    disconnect,
    setMaxHr,
    setAutoReconnect
  };
}
