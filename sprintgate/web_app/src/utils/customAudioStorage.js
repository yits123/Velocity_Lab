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
 * SprintGate Custom Audio Storage & Playback Engine
 * Uses browser IndexedDB for persistent storage of custom MP3/WAV/OGG sound files
 * with zero-latency in-memory URL preloading for precision track starting triggers.
 */

const DB_NAME = 'SprintGateAudioDB';
const DB_VERSION = 1;
const STORE_NAME = 'custom_sounds';

// In-memory cache for ultra-fast <1ms playback response time
const audioUrlCache = {};
const activeAudioObjects = {};

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      console.warn('SprintGate IndexedDB open error:', request.error);
      resolve(null);
    };
  });
}

/**
 * Preload all stored custom audio files into memory URLs on startup
 */
export async function preloadCustomAudioUrls() {
  if (typeof window === 'undefined') return {};
  try {
    const db = await openDB();
    if (!db) return {};

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const records = req.result || [];
        records.forEach((rec) => {
          if (rec.blob) {
            if (audioUrlCache[rec.id]) {
              try { URL.revokeObjectURL(audioUrlCache[rec.id]); } catch (e) {}
            }
            audioUrlCache[rec.id] = URL.createObjectURL(rec.blob);
          }
        });
        resolve(audioUrlCache);
      };

      req.onerror = () => {
        resolve(audioUrlCache);
      };
    });
  } catch (err) {
    console.warn('Error preloading custom audio:', err);
    return audioUrlCache;
  }
}

/**
 * Save custom audio file (MP3, WAV, etc.) to IndexedDB
 */
export async function saveCustomAudioFile(id, file) {
  try {
    const db = await openDB();
    if (!db) throw new Error('IndexedDB not supported');

    // Create memory URL immediately
    if (audioUrlCache[id]) {
      try { URL.revokeObjectURL(audioUrlCache[id]); } catch (e) {}
    }
    audioUrlCache[id] = URL.createObjectURL(file);

    const record = {
      id,
      name: file.name,
      size: file.size,
      type: file.type || 'audio/mpeg',
      lastModified: file.lastModified || Date.now(),
      blob: file
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record);

      req.onsuccess = () => {
        resolve({
          id,
          name: file.name,
          size: file.size,
          type: file.type,
          url: audioUrlCache[id]
        });
      };

      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to save custom audio:', err);
    throw err;
  }
}

/**
 * Get custom audio metadata by sound ID
 */
export async function getCustomAudioMetadata(id) {
  try {
    const db = await openDB();
    if (!db) return null;

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);

      req.onsuccess = () => {
        const rec = req.result;
        if (rec) {
          resolve({
            id: rec.id,
            name: rec.name,
            size: rec.size,
            type: rec.type,
            lastModified: rec.lastModified
          });
        } else {
          resolve(null);
        }
      };

      req.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}

/**
 * Delete a custom audio file
 */
export async function removeCustomAudioFile(id) {
  try {
    if (audioUrlCache[id]) {
      try { URL.revokeObjectURL(audioUrlCache[id]); } catch (e) {}
      delete audioUrlCache[id];
    }

    const db = await openDB();
    if (!db) return true;

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  } catch (err) {
    console.warn('Error removing custom audio:', err);
    return false;
  }
}

/**
 * Play custom sound by ID with zero latency
 * Returns the HTMLAudioElement or null
 */
export function playCustomAudioSound(id, volume = 1.0) {
  try {
    const url = audioUrlCache[id];
    if (!url) return null;

    // Reuse or create audio instance for instant playback
    const audio = new Audio(url);
    audio.volume = Math.max(0, Math.min(1, volume));
    audio.currentTime = 0;

    activeAudioObjects[id] = audio;

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn(`[Custom Audio] Playback blocked or failed for ${id}:`, err);
      });
    }

    return audio;
  } catch (err) {
    console.error(`[Custom Audio] Error playing ${id}:`, err);
    return null;
  }
}

/**
 * Check if a custom sound is currently cached in memory
 */
export function hasCustomAudio(id) {
  return Boolean(audioUrlCache[id]);
}

/**
 * Stop any playing audio for a sound ID
 */
export function stopCustomAudioSound(id) {
  try {
    if (activeAudioObjects[id]) {
      activeAudioObjects[id].pause();
      activeAudioObjects[id].currentTime = 0;
    }
  } catch (e) {}
}
