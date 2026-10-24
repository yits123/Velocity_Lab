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
 * webSerialSprintGateService.js
 * Velocity Lab - Direct USB-C / Web Serial Hardware Service for ESP32 SprintGates
 * 
 * Provides zero-latency, RF-interference-free wired connectivity to ESP32 timing gates
 * via standard USB-C data cables (using Web Serial API supported in Chrome & Edge).
 * 
 * Baud Rate: 115200
 * Telemetry: Parses continuous JSON lines emitted by ESP32 Serial output.
 */

class WebSerialSprintGateService {
  constructor() {
    this.port = null;
    this.reader = null;
    this.writer = null;
    this.readableStreamClosed = null;
    this.writableStreamClosed = null;
    
    this.isConnected = false;
    this.isConnecting = false;
    this.portInfo = null;
    this.portName = '';
    
    this.listeners = new Set();
    this.lineBuffer = '';
  }

  isSupported() {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  _notify(event) {
    this.listeners.forEach(cb => {
      try { cb(event); } catch (e) { console.warn("[WebSerial] Listener error:", e); }
    });
  }

  async connect(baudRate = 115200) {
    if (!this.isSupported()) {
      throw new Error("Web Serial API is not supported in this browser. Please use Google Chrome or Microsoft Edge.");
    }

    if (this.isConnected) return;

    this.isConnecting = true;
    this._notify({ type: 'status_change', isConnected: false, isConnecting: true });

    try {
      // Prompt user to select USB Serial Port (e.g. CP2102, CH340, ESP32 USB JTAG/Serial)
      this.port = await navigator.serial.requestPort({
        filters: [
          { usbVendorId: 0x10c4 }, // Silicon Labs CP210x
          { usbVendorId: 0x1a86 }, // WCH CH340
          { usbVendorId: 0x0403 }, // FTDI
          { usbVendorId: 0x303a }, // Espressif Systems (native ESP32-S2/S3/C3)
          { usbVendorId: 0x2341 }  // Arduino
        ]
      });

      await this.port.open({ baudRate });

      this.portInfo = this.port.getInfo ? this.port.getInfo() : null;
      this.portName = this.portInfo?.usbVendorId 
        ? `USB Gate (VID: 0x${this.portInfo.usbVendorId.toString(16)})` 
        : 'USB-C SprintGate';

      this.isConnected = true;
      this.isConnecting = false;
      this._notify({ 
        type: 'status_change', 
        isConnected: true, 
        isConnecting: false,
        portName: this.portName 
      });

      console.info(`[WebSerial] Connected to timing gate via USB-C (${baudRate} baud)`);

      // Start asynchronous read loop
      this._startReadLoop();

      // Listen for unexpected USB unplug
      if (this.port.addEventListener) {
        this.port.addEventListener('disconnect', () => {
          console.warn("[WebSerial] USB-C device was physically unplugged.");
          this.disconnect();
        });
      }
    } catch (err) {
      this.isConnecting = false;
      this.isConnected = false;
      this._notify({ type: 'status_change', isConnected: false, isConnecting: false, error: err.message });
      throw err;
    }
  }

  async _startReadLoop() {
    while (this.port && this.port.readable && this.isConnected) {
      const textDecoder = new TextDecoderStream();
      this.readableStreamClosed = this.port.readable.pipeTo(textDecoder.writable);
      this.reader = textDecoder.readable.getReader();

      try {
        while (true) {
          const { value, done } = await this.reader.read();
          if (done) break;
          if (value) {
            this._processChunk(value);
          }
        }
      } catch (error) {
        console.warn("[WebSerial] Read error:", error);
      } finally {
        this.reader.releaseLock();
      }
    }
  }

  _processChunk(chunk) {
    this.lineBuffer += chunk;
    const lines = this.lineBuffer.split(/\r?\n/);
    this.lineBuffer = lines.pop() || ''; // Keep incomplete trailing fragment

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      // Look for JSON payload in serial line
      const jsonStart = trimmed.indexOf('{');
      const jsonEnd = trimmed.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        try {
          const jsonStr = trimmed.substring(jsonStart, jsonEnd + 1);
          const parsed = JSON.parse(jsonStr);
          this._notify({ type: 'hardware_data', data: parsed });
        } catch (e) {
          // Non-JSON debug output from ESP32 serial
          console.debug("[WebSerial Raw]", trimmed);
        }
      } else {
        // Plain text log from ESP
        console.debug("[WebSerial ESP32 Log]", trimmed);
      }
    }
  }

  async sendCommand(commandObj) {
    if (!this.port || !this.port.writable || !this.isConnected) return false;
    try {
      const textEncoder = new TextEncoderStream();
      this.writableStreamClosed = textEncoder.readable.pipeTo(this.port.writable);
      const writer = textEncoder.writable.getWriter();
      const payload = typeof commandObj === 'string' ? commandObj : JSON.stringify(commandObj);
      await writer.write(payload + "\n");
      writer.releaseLock();
      return true;
    } catch (err) {
      console.error("[WebSerial] Send command failed:", err);
      return false;
    }
  }

  async disconnect() {
    this.isConnected = false;
    this.isConnecting = false;
    
    try {
      if (this.reader) {
        await this.reader.cancel();
      }
      if (this.readableStreamClosed) {
        await this.readableStreamClosed.catch(() => {});
      }
      if (this.port) {
        await this.port.close();
      }
    } catch (e) {
      console.warn("[WebSerial] Error closing port:", e);
    } finally {
      this.port = null;
      this.reader = null;
      this.writer = null;
      this._notify({ type: 'status_change', isConnected: false, isConnecting: false });
    }
  }
}

export const webSerialSprintGateService = new WebSerialSprintGateService();
export default webSerialSprintGateService;
