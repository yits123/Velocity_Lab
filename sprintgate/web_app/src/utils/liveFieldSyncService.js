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
 * liveFieldSyncService.js
 * Multi-Device Field Station Real-Time Synchronization Engine
 * 
 * Supports simultaneous multi-station field operations across multiple devices
 * (Laptop, Tablet, Smartphone) sharing the same mobile hotspot / Wi-Fi and Admin login:
 *  - Master Timing Console (Laptop connected to ESP32 via WebBLE/WebSocket)
 *  - Queue Marshall Station (Tablet/Phone scanning athlete QR codes & staging queue)
 *  - Trackside Camera Station (Smartphone recording video in Biomechanical Workspace)
 *  - Jumbotron / Mirror Station (Spectator / Bleacher displays)
 * 
 * Performance Guarantee:
 * The ESP32 timing gate communicates ONLY with the Master device.
 * All other stations synchronize via lightweight Google Cloud Firestore snapshots (<1 KB/run),
 * generating zero CPU load, zero Wi-Fi packet collision, and zero timing jitter on the ESP32.
 */

import { 
  doc, 
  onSnapshot, 
  setDoc, 
  serverTimestamp 
} from "firebase/firestore";

class LiveFieldSyncService {
  constructor() {
    this.db = null;
    this.userId = null;
    this.sessionId = null;
    this.deviceId = this._getOrCreateDeviceId();
    this.role = this._getSavedRole(); // 'master' | 'marshall' | 'camera' | 'mirror'
    this.deviceName = this._getDeviceName();
    
    this.unsubscribe = null;
    this.heartbeatTimer = null;
    this.isInitialized = false;

    // Callbacks registered by App.jsx
    this.onQueueSync = null;
    this.onGateStateSync = null;
    this.onCommandReceived = null;
    this.onStationsChange = null;
    this.onMirrorTabChange = null;

    // Loop prevention & local hashes
    this.lastPushedQueueHash = '';
    this.lastReceivedQueueHash = '';
    this.lastCommandIdHandled = '';
    this.isApplyingRemoteQueue = false;
  }

  _getOrCreateDeviceId() {
    try {
      let id = localStorage.getItem('sprintgate_device_id');
      if (!id) {
        id = 'dev_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
        localStorage.setItem('sprintgate_device_id', id);
      }
      return id;
    } catch {
      return 'dev_' + Math.random().toString(36).substring(2, 9);
    }
  }

  _getSavedRole() {
    try {
      return localStorage.getItem('sprintgate_station_role') || 'master';
    } catch {
      return 'master';
    }
  }

  _getDeviceName() {
    if (typeof navigator === 'undefined') return 'Field Station';
    const ua = navigator.userAgent || '';
    if (/iPad/i.test(ua)) return 'Field iPad';
    if (/iPhone/i.test(ua)) return 'Field iPhone';
    if (/Android.*Mobile/i.test(ua)) return 'Android Phone';
    if (/Android/i.test(ua)) return 'Android Tablet';
    if (/Macintosh/i.test(ua)) return 'Mac Laptop';
    if (/Windows/i.test(ua)) return 'Windows PC';
    return 'Field Station';
  }

  setRole(newRole) {
    this.role = newRole;
    try {
      localStorage.setItem('sprintgate_station_role', newRole);
    } catch (_) {}
    this._sendHeartbeat();
  }

  getRole() {
    return this.role;
  }

  getDeviceId() {
    return this.deviceId;
  }

  getDeviceName() {
    return this.deviceName;
  }

  _computeQueueHash(queue) {
    if (!Array.isArray(queue)) return '';
    return queue.map(a => `${a.id || a.bib || a.name}`).join('|');
  }

  /**
   * Initialize field sync channel
   */
  init({
    db,
    user,
    customSessionId = null,
    onQueueSync,
    onGateStateSync,
    onCommandReceived,
    onStationsChange,
    onMirrorTabChange
  }) {
    if (!db) return;
    this.db = db;
    this.userId = user?.uid || 'field_user_' + this.deviceId.substring(0, 6);
    
    let savedCode = null;
    try {
      savedCode = localStorage.getItem('sprintgate_sync_session_code');
    } catch (_) {}

    this.sessionId = customSessionId || savedCode || 'primary_track_field_session';

    this.onQueueSync = onQueueSync;
    this.onGateStateSync = onGateStateSync;
    this.onCommandReceived = onCommandReceived;
    this.onStationsChange = onStationsChange;
    this.onMirrorTabChange = onMirrorTabChange;

    this._subscribe();
    this._startHeartbeat();
    this.isInitialized = true;
    console.info(`[FieldSync] Station initialized as [${this.role.toUpperCase()}] on session [${this.sessionId}]`);
  }

  setSessionCode(code) {
    if (!code) return;
    const cleanCode = code.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    this.sessionId = `field_session_${cleanCode}`;
    try {
      localStorage.setItem('sprintgate_sync_session_code', this.sessionId);
    } catch (_) {}
    if (this.db) {
      this._subscribe();
      this._sendHeartbeat();
    }
  }

  getSessionCode() {
    return (this.sessionId || 'primary_track_field_session').replace(/^field_session_/, '');
  }

  _subscribe() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }

    const sessionDocRef = doc(this.db, "live_field_sessions", this.sessionId);

    this.unsubscribe = onSnapshot(
      sessionDocRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          // Initialize default session if not created yet
          if (this.role === 'master') {
            this._createInitialSession();
          }
          return;
        }

        const data = snapshot.data();

        // 1. Sync Active Stations
        if (data.activeStations && typeof data.activeStations === 'object') {
          const now = Date.now();
          const activeList = Object.entries(data.activeStations)
            .map(([devId, info]) => ({
              deviceId: devId,
              ...info,
              isMe: devId === this.deviceId,
              // Treat devices active within 45 seconds as online
              isOnline: (now - (info.lastPing || 0)) < 45000
            }))
            .filter(station => station.isOnline);

          if (this.onStationsChange) {
            this.onStationsChange(activeList);
          }
        }

        // 2. Sync Athlete Queue
        if (data.queue && Array.isArray(data.queue)) {
          const incomingHash = this._computeQueueHash(data.queue);
          if (incomingHash !== this.lastPushedQueueHash && incomingHash !== this.lastReceivedQueueHash) {
            this.lastReceivedQueueHash = incomingHash;
            if (this.onQueueSync) {
              this.isApplyingRemoteQueue = true;
              this.onQueueSync(data.queue, data.activeRunner || data.queue[0] || null);
              setTimeout(() => {
                this.isApplyingRemoteQueue = false;
              }, 100);
            }
          }
        }

        // 3. Sync Timing Gate & Track State (Only non-masters apply gate state from Firestore)
        if (this.role !== 'master' && data.gateState) {
          if (this.onGateStateSync) {
            this.onGateStateSync(data.gateState);
          }
        }

        // 4. Remote Command Bus
        if (data.lastCommand && data.lastCommand.id) {
          if (data.lastCommand.id !== this.lastCommandIdHandled) {
            this.lastCommandIdHandled = data.lastCommand.id;
            // Execute command if it was sent by another device
            if (data.lastCommand.senderId !== this.deviceId) {
              if (this.onCommandReceived) {
                this.onCommandReceived(data.lastCommand);
              }
            }
          }
        }

        // 5. Mirror Tab (if non-master enabled view mirror)
        if (data.mirrorTab && this.role === 'mirror') {
          if (this.onMirrorTabChange) {
            this.onMirrorTabChange(data.mirrorTab);
          }
        }
      },
      (err) => {
        console.warn("[FieldSync] Session onSnapshot warning:", err.message);
      }
    );
  }

  async _createInitialSession() {
    if (!this.db || !this.sessionId) return;
    try {
      const sessionDocRef = doc(this.db, "live_field_sessions", this.sessionId);
      await setDoc(sessionDocRef, {
        masterDeviceId: this.deviceId,
        masterRole: this.role,
        createdAt: serverTimestamp(),
        lastUpdatedAt: serverTimestamp(),
        queue: [],
        activeRunner: null,
        gateState: {
          sequenceState: 'idle',
          displayTime: '0.00',
          testMode: '40m',
          lastResult: null,
          updatedAt: Date.now()
        },
        activeStations: {
          [this.deviceId]: {
            role: this.role,
            deviceName: this.deviceName,
            lastPing: Date.now()
          }
        }
      }, { merge: true });
    } catch (err) {
      console.warn("[FieldSync] _createInitialSession error:", err.message);
    }
  }

  _startHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this._sendHeartbeat();
    // Heartbeat every 20 seconds (ultra-lightweight <150 bytes payload)
    this.heartbeatTimer = setInterval(() => {
      this._sendHeartbeat();
    }, 20000);
  }

  async _sendHeartbeat() {
    if (!this.db || !this.sessionId) return;
    try {
      const sessionDocRef = doc(this.db, "live_field_sessions", this.sessionId);
      await setDoc(sessionDocRef, {
        [`activeStations.${this.deviceId}`]: {
          role: this.role,
          deviceName: this.deviceName,
          lastPing: Date.now()
        }
      }, { merge: true });
    } catch (e) {
      // Offline fallback silent
    }
  }

  /**
   * Push athlete queue update from this device (called by Queue Marshall or Master)
   */
  async pushQueue(newQueue, activeRunner = null) {
    if (!this.db || !this.sessionId || this.isApplyingRemoteQueue) return;
    const hash = this._computeQueueHash(newQueue);
    if (hash === this.lastPushedQueueHash) return;
    this.lastPushedQueueHash = hash;

    try {
      const sessionDocRef = doc(this.db, "live_field_sessions", this.sessionId);
      await setDoc(sessionDocRef, {
        queue: newQueue,
        activeRunner: activeRunner || (newQueue.length > 0 ? newQueue[0] : null),
        queueUpdatedAt: Date.now(),
        queueUpdatedBy: {
          deviceId: this.deviceId,
          role: this.role,
          deviceName: this.deviceName
        }
      }, { merge: true });
    } catch (err) {
      console.warn("[FieldSync] pushQueue error:", err.message);
    }
  }

  /**
   * Broadcast timing gate & track sequence state (Called ONLY by Master Console)
   */
  async pushGateState(gateState) {
    if (!this.db || !this.sessionId || this.role !== 'master') return;
    try {
      const sessionDocRef = doc(this.db, "live_field_sessions", this.sessionId);
      await setDoc(sessionDocRef, {
        gateState: {
          ...gateState,
          updatedAt: Date.now(),
          masterDeviceId: this.deviceId
        }
      }, { merge: true });
    } catch (err) {
      console.warn("[FieldSync] pushGateState error:", err.message);
    }
  }

  /**
   * Dispatch remote action to other devices
   * @param {string} action - 'CALL_NEXT' | 'SIGNAL_READY' | 'START_SEQUENCE' | 'RESET' | 'SET_MIRROR_TAB'
   * @param {object} payload
   */
  async dispatchCommand(action, payload = {}) {
    if (!this.db || !this.sessionId) return;
    const commandId = 'cmd_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
    this.lastCommandIdHandled = commandId;

    try {
      const sessionDocRef = doc(this.db, "live_field_sessions", this.sessionId);
      await setDoc(sessionDocRef, {
        lastCommand: {
          id: commandId,
          action,
          payload,
          senderRole: this.role,
          senderId: this.deviceId,
          senderName: this.deviceName,
          timestamp: Date.now()
        }
      }, { merge: true });
    } catch (err) {
      console.warn("[FieldSync] dispatchCommand error:", err.message);
    }
  }

  /**
   * Set broadcasted mirror tab (called by Master)
   */
  async broadcastMirrorTab(tabName) {
    if (!this.db || !this.sessionId) return;
    try {
      const sessionDocRef = doc(this.db, "live_field_sessions", this.sessionId);
      await setDoc(sessionDocRef, {
        mirrorTab: tabName,
        mirrorTabUpdatedAt: Date.now()
      }, { merge: true });
    } catch (err) {
      console.warn("[FieldSync] broadcastMirrorTab error:", err.message);
    }
  }

  cleanup() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.isInitialized = false;
  }
}

export const liveFieldSyncService = new LiveFieldSyncService();
export default liveFieldSyncService;
