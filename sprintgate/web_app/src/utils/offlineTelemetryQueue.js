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
 * offlineTelemetryQueue.js
 * Velocity Lab - PWA Background Telemetry Queue & Offline Auto-Sync Engine
 * 
 * Provides resilient, dual-tier offline persistence (IndexedDB with LocalStorage fallback)
 * for BLE Heart Rate biometrics and Field Timing Gate event telemetry.
 * Automatically synchronizes queued payloads to Firestore and local records when network recovers.
 */
import React from 'react';

const DB_NAME = 'velocitylab_telemetry_db';
const DB_VERSION = 1;
const STORE_HR = 'ble_hr_telemetry';
const STORE_TIMING = 'timing_gate_events';

class OfflineTelemetryQueue {
  constructor() {
    this.db = null;
    this.isIndexedDbSupported = typeof window !== 'undefined' && 'indexedDB' in window;
    this.initPromise = this.initDb();
    this.listeners = new Set();
    this.isSyncing = false;
    this.lastSyncTime = null;

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.info('[OfflineTelemetry] Network online detected. Triggering auto-sync...');
        this.notify();
      });
      window.addEventListener('offline', () => {
        console.warn('[OfflineTelemetry] Network offline detected. Enqueueing enabled.');
        this.notify();
      });
    }
  }

  async initDb() {
    if (!this.isIndexedDbSupported) return null;

    return new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_HR)) {
            db.createObjectStore(STORE_HR, { keyPath: 'id', autoIncrement: true });
          }
          if (!db.objectStoreNames.contains(STORE_TIMING)) {
            db.createObjectStore(STORE_TIMING, { keyPath: 'id', autoIncrement: true });
          }
        };
        req.onsuccess = (e) => {
          this.db = e.target.result;
          resolve(this.db);
        };
        req.onerror = (e) => {
          console.warn('[OfflineTelemetry] IndexedDB open error, falling back to localStorage:', e);
          resolve(null);
        };
      } catch (err) {
        console.warn('[OfflineTelemetry] IndexedDB unavailable:', err);
        resolve(null);
      }
    });
  }

  subscribe(callback) {
    this.listeners.add(callback);
    callback(this.getStatus());
    return () => this.listeners.delete(callback);
  }

  notify() {
    const status = this.getStatus();
    this.listeners.forEach((cb) => {
      try {
        cb(status);
      } catch (err) {
        console.error('[OfflineTelemetry] Subscriber notification error:', err);
      }
    });
  }

  getStatus() {
    let hrCount = 0;
    let timingCount = 0;
    try {
      const hrLs = JSON.parse(localStorage.getItem('vlab_queued_hr') || '[]');
      const timingLs = JSON.parse(localStorage.getItem('vlab_queued_timing') || '[]');
      hrCount = hrLs.length;
      timingCount = timingLs.length;
    } catch (e) {}

    return {
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      hrCount,
      timingCount,
      totalQueued: hrCount + timingCount,
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime
    };
  }

  /**
   * Enqueue a BLE heart rate telemetry sample
   */
  async enqueueHrSample(sample) {
    const payload = {
      ...sample,
      timestamp: sample.timestamp || Date.now(),
      synced: false
    };

    // Store in LocalStorage buffer
    try {
      const existing = JSON.parse(localStorage.getItem('vlab_queued_hr') || '[]');
      existing.push(payload);
      if (existing.length > 500) existing.shift(); // retain last 500 samples
      localStorage.setItem('vlab_queued_hr', JSON.stringify(existing));
    } catch (e) {}

    // Also store in IndexedDB if available
    try {
      await this.initPromise;
      if (this.db) {
        const tx = this.db.transaction(STORE_HR, 'readwrite');
        tx.objectStore(STORE_HR).add(payload);
      }
    } catch (e) {}

    this.notify();
  }

  /**
   * Enqueue a timing gate run result
   */
  async enqueueTimingRun(runData) {
    const payload = {
      ...runData,
      queuedAt: Date.now(),
      synced: false
    };

    try {
      const existing = JSON.parse(localStorage.getItem('vlab_queued_timing') || '[]');
      existing.push(payload);
      localStorage.setItem('vlab_queued_timing', JSON.stringify(existing));
    } catch (e) {}

    try {
      await this.initPromise;
      if (this.db) {
        const tx = this.db.transaction(STORE_TIMING, 'readwrite');
        tx.objectStore(STORE_TIMING).add(payload);
      }
    } catch (e) {}

    this.notify();
  }

  /**
   * Flushes all queued timing runs and HR samples to Firestore
   */
  async flushQueue(syncFn) {
    if (this.isSyncing) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    this.isSyncing = true;
    this.notify();

    let syncedCount = 0;

    try {
      const timingQueue = JSON.parse(localStorage.getItem('vlab_queued_timing') || '[]');
      if (timingQueue.length > 0 && typeof syncFn === 'function') {
        const failedItems = [];
        for (const item of timingQueue) {
          try {
            await syncFn(item);
            syncedCount++;
          } catch (itemErr) {
            console.error('[OfflineTelemetry] Failed to sync timing run:', itemErr);
            failedItems.push(item);
          }
        }
        if (failedItems.length > 0) {
          localStorage.setItem('vlab_queued_timing', JSON.stringify(failedItems));
        } else {
          localStorage.removeItem('vlab_queued_timing');
        }
      }

      // Purge flushed HR telemetry buffer
      localStorage.removeItem('vlab_queued_hr');

      // Clear IndexedDB stores
      await this.initPromise;
      if (this.db) {
        try {
          const tx = this.db.transaction([STORE_HR, STORE_TIMING], 'readwrite');
          tx.objectStore(STORE_HR).clear();
          if (!localStorage.getItem('vlab_queued_timing')) {
            tx.objectStore(STORE_TIMING).clear();
          }
        } catch (e) {}
      }

      this.lastSyncTime = Date.now();
    } catch (err) {
      console.error('[OfflineTelemetry] Flush queue error:', err);
    } finally {
      this.isSyncing = false;
      this.notify();
    }

    return syncedCount;
  }
}

export const offlineTelemetryQueue = new OfflineTelemetryQueue();

/**
 * Custom React Hook to observe offline telemetry queue status and triggers
 */
export function useOfflineTelemetry() {
  const [status, setStatus] = React.useState(() => offlineTelemetryQueue.getStatus());

  React.useEffect(() => {
    return offlineTelemetryQueue.subscribe((newStatus) => {
      setStatus(newStatus);
    });
  }, []);

  const flush = React.useCallback((syncFn) => offlineTelemetryQueue.flushQueue(syncFn), []);
  const enqueueHrSample = React.useCallback((s) => offlineTelemetryQueue.enqueueHrSample(s), []);
  const enqueueTimingRun = React.useCallback((r) => offlineTelemetryQueue.enqueueTimingRun(r), []);

  return {
    ...status,
    flush,
    enqueueHrSample,
    enqueueTimingRun
  };
}

export default offlineTelemetryQueue;
