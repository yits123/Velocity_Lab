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

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Papa from 'papaparse';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp, query, orderBy, getDocs, updateDoc, doc, onSnapshot, setDoc, deleteDoc, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, CACHE_SIZE_UNLIMITED, getDoc, limit } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail } from "firebase/auth";
import { 
  Zap, Users, Upload, Server, CheckCircle2, User, Volume2, VolumeX, Download, LogOut, Lock, Activity, AlertTriangle, Camera, CameraOff, Video, FileText, ChevronLeft, ChevronRight, Play, Pause, Loader2, Wifi, WifiOff, Battery, BatteryFull, BatteryMedium, BatteryLow, BatteryWarning, Signal, SignalHigh, SignalMedium, SignalLow, Search, TrendingUp, Trash2, UserPlus, ListPlus, Monitor, Minimize, Maximize, Sun, Moon, Edit2, Megaphone, QrCode, RefreshCcw, RefreshCw, Check, Trophy, X, Tv, Database, Eye, Sliders, Cpu, Terminal, Layers, PlayCircle, Radio, Flag, Flame,
  MessageSquare, Mail, Share2, Award, Smartphone, ShieldCheck, ShieldAlert, Key, Wind, Heart, Film, Gauge
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { savePdfFile } from './utils/pdfDownloader';
import { getPdfEngine } from './utils/pdfExporter';
const BiomechanicalVideoWorkspace = React.lazy(() => import('./components/BiomechanicalVideoWorkspace'));

// Safe LocalStorage Helpers to prevent QuotaExceededError and private-mode crashes
export const safeLocalStorageSet = (key, value) => {
  try {
    if (typeof value === 'object' && value !== null) {
      localStorage.setItem(key, JSON.stringify(value));
    } else {
      localStorage.setItem(key, String(value));
    }
  } catch (err) {
    console.warn(`[Velocity Lab Storage] safeLocalStorageSet failed for ${key}:`, err);
  }
};

export const safeLocalStorageGet = (key, defaultValue = null) => {
  try {
    const item = localStorage.getItem(key);
    if (item === null || item === undefined) return defaultValue;
    try {
      return JSON.parse(item);
    } catch {
      return item;
    }
  } catch (err) {
    console.warn(`[Velocity Lab Storage] safeLocalStorageGet failed for ${key}:`, err);
    return defaultValue;
  }
};

export const safeLocalStorageRemove = (key) => {
  try {
    localStorage.removeItem(key);
  } catch (err) {
    console.warn(`[Velocity Lab Storage] safeLocalStorageRemove failed for ${key}:`, err);
  }
};

// Safe athlete search matcher that never crashes on null/undefined/number types
export const athleteMatchesSearch = (athlete, term) => {
  if (!athlete) return false;
  if (!term || !String(term).trim()) return true;
  const t = String(term).toLowerCase().trim();
  const name = (athlete.name || '').toLowerCase();
  const bib = athlete.bib != null ? String(athlete.bib).toLowerCase() : '';
  const sport = (athlete.sport || '').toLowerCase();
  return name.includes(t) || bib.includes(t) || sport.includes(t);
};

import { QRCodeSVG } from 'qrcode.react';
import FieldRadarVisualizer, { calculateAgilityMetrics } from './components/FieldRadarVisualizer';
import FVPProfileCard from './components/FVPProfileCard';
import SprintSplitDeltaChart from './components/SprintSplitDeltaChart';
import ErrorBoundary from './components/ErrorBoundary';
import MassSprintCockpit from './components/MassSprintCockpit';
import StandardSprintTrackBox from './components/StandardSprintTrackBox';
import RSAPerformanceCockpit from './components/RSAPerformanceCockpit';
import ThemeColorPicker from './components/ThemeColorPicker';
import QuickControlsSheet from './components/QuickControlsSheet';
import VelocityLabLogo, { VelocityLabIcon } from './components/VelocityLabLogo';
import LiveTestModeSelector from './components/LiveTestModeSelector';
import { addVelocityLabLogoToPdf } from './utils/logoPdfHelper';
import WindGaugeController from './components/WindGaugeController';
import PrecisionClockDisplay from './components/PrecisionClockDisplay';
import GateTrafficLights from './components/GateTrafficLights';
import CockpitHUD from './components/CockpitHUD';
import OfflineStatusPill from './components/OfflineStatusPill';
import LiveMiniHUD from './components/LiveMiniHUD';
import { useBleHeartRate, bleHeartRateService } from './utils/bleHeartRateService';
import { useBleSprintGate, bleSprintGateService } from './utils/bleSprintGateService';
import offlineTelemetryQueue, { useOfflineTelemetry } from './utils/offlineTelemetryQueue';
import { requestLocationAndFetchWind, calculateWindCorrection } from './utils/windService';
import { 
  loadAudioConfig, 
  saveAudioConfig, 
  playLeadInBeep, 
  playElectronicStarterHorn, 
  playWhistleSound, 
  playDoubleWhistle,
  playRecallBurstSound,
  playAttentionChime,
  playSynthesizedGunshot,
  playFalseStartAlert, 
  playFinishChime,
  playPRCelebration,
  speakLocalized, 
  announceSetCadence,
  cancelAllSpeech,
  DEFAULT_AUDIO_CONFIG,
  getEffectiveLeadInInterval,
  getEffectiveSetDelayMs,
  getEffectiveMarksHoldMs,
  getAudioContext
} from './utils/soundEngine';
import {
  playCustomAudioSound,
  hasCustomAudio,
  preloadCustomAudioUrls
} from './utils/customAudioStorage';

// Lazy-loaded on-demand modals & heavy scanner for optimal bundle splitting
const QRScannerModal = React.lazy(() => import('./components/QRScannerModal'));
const AthleteScoutCardModal = React.lazy(() => import('./components/AthleteScoutCardModal'));
const ReactionTimeAuditorModal = React.lazy(() => import('./components/ReactionTimeAuditorModal'));
const HorizontalFVPModal = React.lazy(() => import('./components/HorizontalFVPModal'));
const BleHeartRateModal = React.lazy(() => import('./components/BleHeartRateModal'));
const SprintGateBleModal = React.lazy(() => import('./components/SprintGateBleModal'));
const AudioSettingsModal = React.lazy(() => import('./components/AudioSettingsModal'));
const CombineScorecard = React.lazy(() => import('./components/CombineScorecard'));
const SpectatorLiveScoreboard = React.lazy(() => import('./components/SpectatorLiveScoreboard'));
const HeadToHeadMatchup = React.lazy(() => import('./components/HeadToHeadMatchup'));
const TeamPortal = React.lazy(() => import('./components/TeamPortal'));
const StrobeMotionModal = React.lazy(() => import('./components/StrobeMotionModal'));
const MultiDeviceSyncModal = React.lazy(() => import('./components/MultiDeviceSyncModal'));
const GateConnectionModal = React.lazy(() => import('./components/GateConnectionModal'));
import liveFieldSyncService from './utils/liveFieldSyncService';
import webSerialSprintGateService from './utils/webSerialSprintGateService';

// Protocol-aware helper to build Gate HTTP URLs for ESP32 endpoints
export const getGateHttpUrl = (host, path) => {
  if (!host) return null;
  const trimmed = host.trim();
  if (!trimmed) return null;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const base = trimmed.replace(/\/+$/, '');
    return `${base}${cleanPath}`;
  }
  const cleanHost = trimmed
    .replace(/^(wss?:\/\/)/i, '')
    .replace(/^(https?:\/\/)/i, '')
    .replace(/\/.*$/, '')
    .trim();
  if (!cleanHost) return null;
  return `http://${cleanHost}${cleanPath}`;
};

// Protocol-aware helper to build Gate WebSocket URLs for ESP32 timing gate (Port 81)
export const getGateWsUrl = (host) => {
  if (!host) return null;
  const trimmed = host.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('ws://') || trimmed.startsWith('wss://')) {
    return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
  }
  const cleanHost = trimmed
    .replace(/^(https?:\/\/)/i, '')
    .replace(/^(wss?:\/\/)/i, '')
    .replace(/\/.*$/, '')
    .trim();
  if (!cleanHost) return null;
  const hostWithPort = cleanHost.includes(':') ? cleanHost : `${cleanHost}:81`;
  return `ws://${hostWithPort}/`;
};

// Fire-and-forget gate command with silent error handling and mixed-content safety
export const sendGateCommand = (host, path) => {
  if (!host) return;
  const url = getGateHttpUrl(host, path);
  if (!url) return;
  try {
    fetch(url, { mode: 'no-cors' }).catch(() => {});
  } catch (e) {}
};

// Initialize Firebase
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "sprintgate-b84db.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "sprintgate-b84db",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "sprintgate-b84db.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "351723242180",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:351723242180:web:98803d944e494b8d47bf91"
};
const app = initializeApp(firebaseConfig);
// Enable Aggressive Offline Persistence (True Offline Mode) with multi-tab fallback
let db;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
      cacheSizeBytes: CACHE_SIZE_UNLIMITED
    })
  });
} catch (e) {
  console.warn("initializeFirestore already called or failed, falling back to getFirestore:", e);
  db = getFirestore(app);
}
const auth = getAuth(app);

const playGunshot = () => {
  try {
    const audio = new Audio('/9mm-pistol-shot.mp3');
    audio.volume = 1.0;
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(e => {
        console.warn("Gunshot audio playback prevented or error:", e);
      });
    }
  } catch (e) {
    console.error("Error playing gunshot mp3:", e);
  }
};

const evaluateRun = (time, age, gender, distanceMeters = 40) => {
  const t = parseFloat(time);
  const a = parseInt(age) || 20;
  const normG = (gender && String(gender).trim().toUpperCase().startsWith('F')) ? 'F' : 'M';
  const dist = parseFloat(distanceMeters) || 40;
  let group = '19-25';
  if (a >= 15 && a <= 16) group = '15-16';
  else if (a >= 17 && a <= 18) group = '17-18';
  const matrix = {
    'M': {
      '15-16': { sup: 6.50, good: 7.00, avg: 7.60, fair: 8.20 },
      '17-18': { sup: 6.30, good: 6.70, avg: 7.30, fair: 7.90 },
      '19-25': { sup: 6.10, good: 6.50, avg: 7.10, fair: 7.70 }
    },
    'F': {
      '15-16': { sup: 7.30, good: 7.80, avg: 8.40, fair: 9.10 },
      '17-18': { sup: 7.10, good: 7.60, avg: 8.20, fair: 8.90 },
      '19-25': { sup: 6.90, good: 7.40, avg: 8.00, fair: 8.70 }
    }
  };
  const genderMatrix = matrix[normG] || matrix['M'];
  const baseThresholds = genderMatrix[group] || genderMatrix['19-25'];
  const scale = dist / 40.0;
  const thresholds = {
    sup: baseThresholds.sup * scale,
    good: baseThresholds.good * scale,
    avg: baseThresholds.avg * scale,
    fair: baseThresholds.fair * scale
  };
  let standing = 'Needs Work';
  if (t <= thresholds.sup) standing = 'Superior';
  else if (t <= thresholds.good) standing = 'Good';
  else if (t <= thresholds.avg) standing = 'Average';
  else if (t <= thresholds.fair) standing = 'Fair';

  const fitt = standing === 'Superior' || standing === 'Good' 
    ? "Frequency: 4x/week | Intensity: 90-100% max | Time: 45m | Type: Explosive Plyometrics"
    : "Frequency: 3x/week | Intensity: 75-85% max | Time: 60m | Type: Form drills & Sprints";
  const sport = "S: Drive Phase | P: 5% load/wk | O: Resisted Sprints | R: Active Rec. | T: Vary surfaces";
  const focus = standing === 'Superior' ? "Maintain peak power & acceleration" : "Improve start mechanics and turnover rate";
  return { standing, fitt, sport, focus };
};

const evaluateShuttleRun = (time, age, gender) => {
  const t = parseFloat(time);
  const a = parseInt(age) || 20;
  const normG = (gender && String(gender).trim().toUpperCase().startsWith('F')) ? 'F' : 'M';
  
  let group = '19-25';
  if (a >= 15 && a <= 16) group = '15-16';
  else if (a >= 17 && a <= 18) group = '17-18';
  
  const matrix = {
    'M': {
      '15-16': { sup: 9.30, good: 9.70, avg: 10.30, fair: 11.00 },
      '17-18': { sup: 9.00, good: 9.40, avg: 10.00, fair: 10.70 },
      '19-25': { sup: 8.70, good: 9.10, avg: 9.70, fair: 10.40 }
    },
    'F': {
      '15-16': { sup: 10.40, good: 10.90, avg: 11.50, fair: 12.20 },
      '17-18': { sup: 10.10, good: 10.60, avg: 11.20, fair: 11.90 },
      '19-25': { sup: 9.80, good: 10.30, avg: 10.90, fair: 11.60 }
    }
  };
  const genderMatrix = matrix[normG] || matrix['M'];
  const thresholds = genderMatrix[group] || genderMatrix['19-25'];
  
  let standing = 'Needs Work';
  if (t <= thresholds.sup) standing = 'Superior';
  else if (t <= thresholds.good) standing = 'Good';
  else if (t <= thresholds.avg) standing = 'Average';
  else if (t <= thresholds.fair) standing = 'Fair';

  const fitt = standing === 'Superior' || standing === 'Good' 
    ? "Frequency: 3x/week | Intensity: 95-100% max | Time: 30m | Type: Change of Direction (COD) Drills"
    : "Frequency: 2x/week | Intensity: 80-90% max | Time: 45m | Type: Lateral bounds & Deceleration focus";
  const sport = "S: Deceleration Mechanics | P: 5% load/wk | O: Cone Drills | R: Active Rec. | T: Court/Turf";
  const focus = standing === 'Superior' ? "Maintain elite ankle stiffness & turning speed" : "Improve center of mass lowering during 180° turns";
  
  return { standing, fitt, sport, focus };
};


const SPLIT_DISTANCES = {
  1: 40, // Finish
  2: 10,
  3: 20,
  4: 30,
  101: 10,
  102: 20,
  103: 30,
  104: 40,
  201: 10, // Pro Agility
  202: 20,
  301: 10, // L-Drill
  302: 30
};

export default function App() {
  const [testMode, setTestMode] = useState(() => {
    const saved = localStorage.getItem('sprintgate_test_mode');
    return (saved && saved !== 'vertical_jump') ? saved : 'standard';
  });
  const testModeRef = useRef(testMode);
  const wsRef = useRef(null);
  
  useEffect(() => { testModeRef.current = testMode; localStorage.setItem('sprintgate_test_mode', testMode); }, [testMode]);

  const handleTestModeChange = (newMode) => {
    setTestMode(newMode);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        command: "setConfig",
        testMode: newMode
      }));
    }
  };

  const [theme, setTheme] = useState(localStorage.getItem('sprintgate_theme') || 'system');
  const [highContrast, setHighContrast] = useState(localStorage.getItem('sprintgate_hc') === 'true');
  const [colorTheme, setColorTheme] = useState(localStorage.getItem('sprintgate_color_theme') || 'orange');
  
  const [isDark, setIsDark] = useState(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return false;
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark', 'high-contrast');

    if (highContrast) {
      // High Contrast Mode is built upon an ultra-high-visibility OLED dark architecture
      root.classList.add('dark');
      root.classList.add('high-contrast');
      setIsDark(true);
    } else {
      const resolvedIsDark = theme === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
        : theme === 'dark';

      if (theme === 'system') {
        root.classList.add(resolvedIsDark ? 'dark' : 'light');
      } else {
        root.classList.add(theme);
      }
      setIsDark(resolvedIsDark);
    }

    root.setAttribute('data-theme-accent', colorTheme);
    
    localStorage.setItem('sprintgate_theme', theme);
    localStorage.setItem('sprintgate_hc', highContrast);
    localStorage.setItem('sprintgate_color_theme', colorTheme);
  }, [theme, highContrast, colorTheme]);

  useEffect(() => {
    const checkDark = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    checkDark();
    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [theme]);

  const [nodeA, setNodeA] = useState(localStorage.getItem('sprintgate_node_a_ip') || 'startgate.local');
  const nodeARef = useRef(nodeA);
  useEffect(() => { nodeARef.current = nodeA; localStorage.setItem('sprintgate_node_a_ip', nodeA); }, [nodeA]);
  
  const [nodeB, setNodeB] = useState(localStorage.getItem('sprintgate_node_b_ip') || 'finishgate.local');
  const nodeBRef = useRef(nodeB);
  useEffect(() => { nodeBRef.current = nodeB; localStorage.setItem('sprintgate_node_b_ip', nodeB); }, [nodeB]);

  const [trackDistance, setTrackDistance] = useState(localStorage.getItem('sprintgate_track_dist') || '40');
  const trackDistanceRef = useRef(trackDistance);
  useEffect(() => { trackDistanceRef.current = trackDistance; localStorage.setItem('sprintgate_track_dist', trackDistance); }, [trackDistance]);

  const handleTrackDistanceChange = (newDist) => {
    setTrackDistance(newDist);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ command: "setConfig", trackDistance: newDist }));
    }
  };

  const [leaderboardDistFilter, setLeaderboardDistFilter] = useState('current');

  const [windSpeed, setWindSpeed] = useState(() => localStorage.getItem('sprintgate_wind') || '');
  const [windMode, setWindMode] = useState(() => localStorage.getItem('sprintgate_wind_mode') || 'manual');
  const [windMeta, setWindMeta] = useState(() => {
    try {
      const cached = localStorage.getItem('sprintgate_wind_meta');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [isFetchingWind, setIsFetchingWind] = useState(false);
  const [windFetchError, setWindFetchError] = useState(null);

  const [surfaceType, setSurfaceType] = useState(localStorage.getItem('sprintgate_surface') || 'Track');
  const windSpeedRef = useRef(windSpeed);
  const surfaceTypeRef = useRef(surfaceType);
  useEffect(() => { windSpeedRef.current = windSpeed; localStorage.setItem('sprintgate_wind', windSpeed); }, [windSpeed]);
  useEffect(() => { localStorage.setItem('sprintgate_wind_mode', windMode); }, [windMode]);
  useEffect(() => {
    if (windMeta) {
      try {
        localStorage.setItem('sprintgate_wind_meta', JSON.stringify(windMeta));
      } catch (err) {
        console.warn('Failed to cache windMeta:', err);
      }
    }
  }, [windMeta]);
  useEffect(() => { surfaceTypeRef.current = surfaceType; localStorage.setItem('sprintgate_surface', surfaceType); }, [surfaceType]);

  // Multi-source meteorological wind fetch handler
  const handleFetchAutoWind = useCallback(async () => {
    setIsFetchingWind(true);
    setWindFetchError(null);
    try {
      const result = await requestLocationAndFetchWind();
      setWindSpeed(result.windSpeedFormatted);
      setWindMeta(result);
    } catch (err) {
      console.warn("Auto wind fetch error:", err);
      setWindFetchError(err.message || 'Failed to fetch wind speed from GPS & meteorological providers.');
    } finally {
      setIsFetchingWind(false);
    }
  }, []);

  // If windMode is set to auto on initial launch and no data exists yet, fetch automatically
  useEffect(() => {
    if (windMode === 'auto' && !windMeta) {
      handleFetchAutoWind();
    }
  }, [windMode, windMeta, handleFetchAutoWind]);

  const [statusA, setStatusA] = useState({ online: false, beam_broken: false }); 
  const [statusB, setStatusB] = useState({ online: false, active_runners: 0, beam_broken: false });
  const offlineTelemetry = useOfflineTelemetry();
  const isGateHardwareConnected = Boolean(statusB?.online || statusA?.online);
  const prevActiveRunnersRef = useRef(0);
  // Multi-Device Field Station Synchronization State
  const [stationRole, setStationRole] = useState(() => liveFieldSyncService.getRole());
  const [showMultiDeviceSyncModal, setShowMultiDeviceSyncModal] = useState(false);
  const [connectedStations, setConnectedStations] = useState([]);

  const [queue, _setQueue] = useState(() => {
    return safeLocalStorageGet('sprintgate_persistent_queue', []);
  });
  const queueRef = useRef(queue);
  const setQueue = (val) => {
    const newVal = typeof val === 'function' ? val(queueRef.current) : val;
    queueRef.current = newVal;
    safeLocalStorageSet('sprintgate_persistent_queue', newVal);
    _setQueue(newVal);
    // Real-time synchronization to other field stations (Laptop, Tablet, Phone)
    liveFieldSyncService.pushQueue(newVal);
  };

  // Mass Sprint Testing: Multiple runners in flight on track (FIFO pipeline)
  const [runnersOnTrack, _setRunnersOnTrack] = useState([]);
  const runnersOnTrackRef = useRef(runnersOnTrack);
  const setRunnersOnTrack = (val) => {
    const newVal = typeof val === 'function' ? val(runnersOnTrackRef.current) : val;
    runnersOnTrackRef.current = newVal;
    _setRunnersOnTrack(newVal);
  };
  const lastRunnerStartTimeRef = useRef(0);
  const [timeSinceLastStart, setTimeSinceLastStart] = useState(0);

  const [roster, setRoster] = useState(() => safeLocalStorageGet('sprintgate_roster', []));
  const rosterRef = useRef(roster);
  useEffect(() => { 
    localStorage.setItem('sprintgate_roster', JSON.stringify(roster)); 
    rosterRef.current = roster;
  }, [roster]);
  const [isJumbotronMode, setIsJumbotronMode] = useState(false);
  const [newAthlete, setNewAthlete] = useState({ name: '', bib: '', age: '', gender: 'M', sport: '', weight: '', height: '', rfidUid: '', whatsapp: '', email: '' });
  const [editingAthleteId, setEditingAthleteId] = useState(null);
  const [rosterSearchTerm, setRosterSearchTerm] = useState('');
  const [selectedRosterIds, setSelectedRosterIds] = useState([]);
  const visibleRoster = useMemo(() => (roster || []).filter(a => athleteMatchesSearch(a, rosterSearchTerm)), [roster, rosterSearchTerm]);
  const [queueSearchTerm, setQueueSearchTerm] = useState('');
  const searchedRosterAthletes = useMemo(() => {
    if (!queueSearchTerm.trim()) return [];
    const term = queueSearchTerm.toLowerCase();
    return (roster || []).filter(a => {
      return (a.name && a.name.toLowerCase().includes(term)) ||
        (a.bib && a.bib.toLowerCase().includes(term)) ||
        (a.squad && a.squad.toLowerCase().includes(term)) ||
        (a.sport && a.sport.toLowerCase().includes(term)) ||
        (a.rfidUid && a.rfidUid.toLowerCase().includes(term));
    }).slice(0, 10);
  }, [roster, queueSearchTerm]);
  const rosterFileInputRef = useRef(null);
  const [isStadiumMode, setIsStadiumMode] = useState(false);
  const [mobileArenaTab, setMobileArenaTab] = useState('timer'); // 'timer' (center) | 'cockpit' (left) | 'queue' (right) | 'all'

  const testModeDetails = useMemo(() => {
    switch (testMode) {
      case 'standard':
        return {
          titleFirst: `${trackDistance || 40}m Sprint`,
          titleSecond: 'Assessment',
          subtitle: `Dual-Gate Precision Linear Velocity Timing • ${trackDistance || 40}m Straight`,
          badge: 'Straight Sprint'
        };
      case 'mass_sprint':
        return {
          titleFirst: 'Mass Sprint',
          titleSecond: 'Heat Assessment',
          subtitle: `Multi-Athlete Continuous Flow & FIFO Timing • ${trackDistance || 40}m`,
          badge: 'Mass Heat'
        };
      case 'shuttle':
        return {
          titleFirst: '4x10m Shuttle',
          titleSecond: 'Assessment',
          subtitle: 'Agility, Deceleration & Directional Laser Timing',
          badge: 'Shuttle Run'
        };
      case 'pro_agility':
        return {
          titleFirst: '5-10-5 Pro',
          titleSecond: 'Agility Assessment',
          subtitle: 'Lateral Shuttle & 180° Directional Change Evaluation',
          badge: 'Pro Agility'
        };
      case 'l_drill':
        return {
          titleFirst: '3-Cone',
          titleSecond: 'L-Drill Assessment',
          subtitle: 'Curved Cornering, Arc Acceleration & Deceleration',
          badge: 'Combine Drill'
        };
      case 'rsa':
        return {
          titleFirst: 'RSA Sprint',
          titleSecond: 'Fatigue Assessment',
          subtitle: 'Repeated Sprint Ability & Power Decay Index',
          badge: 'RSA Protocol'
        };
      default:
        return {
          titleFirst: 'Sprint',
          titleSecond: 'Assessment',
          subtitle: 'Dual-Gate Precision Athletic Evaluation',
          badge: 'Timing Mode'
        };
    }
  }, [testMode, trackDistance]);


  const subjectCounterRef = useRef(1);
  const currentRunDataRef = useRef({ reactionTime: 0, splits: [] });
  const [liveSplits, setLiveSplits] = useState([]);
  const [beamFlash, setBeamFlash] = useState(false);
  const prevLiveSplitsLenRef = useRef(0);
  useEffect(() => {
    if (liveSplits.length > prevLiveSplitsLenRef.current) {
      setBeamFlash(true);
      const timer = setTimeout(() => setBeamFlash(false), 250);
      prevLiveSplitsLenRef.current = liveSplits.length;
      return () => clearTimeout(timer);
    } else if (liveSplits.length === 0) {
      prevLiveSplitsLenRef.current = 0;
    }
  }, [liveSplits]);
  const [results, setResults] = useState([]);
  
  // Voice announcement state
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const voiceEnabledRef = useRef(voiceEnabled);
  useEffect(() => { voiceEnabledRef.current = voiceEnabled; }, [voiceEnabled]);

  // Audio & Starting Cadence Configuration
  const [audioConfig, setAudioConfig] = useState(() => loadAudioConfig());
  const audioConfigRef = useRef(audioConfig);
  useEffect(() => { 
    audioConfigRef.current = audioConfig;
    setVoiceEnabled(audioConfig.enabled);
  }, [audioConfig]);

  // Preload custom audio files into memory URLs on startup
  useEffect(() => {
    preloadCustomAudioUrls().catch(err => console.warn("[Audio] Custom audio preload error:", err));
  }, []);

  // Screen Wake Lock API: Keep timing display awake during track meet
  useEffect(() => {
    let wakeLockSentinel = null;
    const requestWakeLock = async () => {
      try {
        if (typeof navigator !== 'undefined' && 'wakeLock' in navigator && document.visibilityState === 'visible') {
          wakeLockSentinel = await navigator.wakeLock.request('screen');
          console.info('[Velocity Lab] Screen Wake Lock active for timing session.');
        }
      } catch (err) {}
    };

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockSentinel) {
        wakeLockSentinel.release().catch(() => {});
      }
    };
  }, []);
  const [showAudioSettingsModal, setShowAudioSettingsModal] = useState(false);
  const [showQuickControlsSheet, setShowQuickControlsSheet] = useState(false);
  const [showFvpModal, setShowFvpModal] = useState(false);
  const [selectedFvpRun, setSelectedFvpRun] = useState(null);
  const [auditRunData, setAuditRunData] = useState(null);
  const [selectedSectorDeltaRun, setSelectedSectorDeltaRun] = useState(null);
  const [falseStartReason, setFalseStartReason] = useState('');
  const [cadenceBeepCount, setCadenceBeepCount] = useState(0);

  // Timer & Sequence State
  const [isRunning, setIsRunning] = useState(false);
  const isRunningRef = useRef(isRunning);
  const [displayTime, setDisplayTime] = useState(0);
  const timerRef = useRef(null);
  const startTimeRef = useRef(0);
  const lastUiUpdateRef = useRef(0);
  const lastTimeSinceStartUpdateRef = useRef(0);
  const finishLockoutUntilRef = useRef(0);
  const prevLdrStatusRef = useRef(0);
  const gunTimeRef = useRef(0);
  
  const [showBleModal, setShowBleModal] = useState(false);
  const { isConnected: isBleConnected, bpm: liveBleBpm, zone: liveBleZone, deviceName: bleDeviceName } = useBleHeartRate();
  
  // Direct Web Bluetooth (WebBLE) SprintGate Hardware Integration
  const [showSprintGateBleModal, setShowSprintGateBleModal] = useState(false);
  const { 
    isConnected: isSprintGateBleConnected, 
    gateAlignment: sprintGateAlignment, 
    deviceName: sprintGateDeviceName 
  } = useBleSprintGate();

  // Route incoming Web Bluetooth timing gate events directly to the precision hardware engine
  useEffect(() => {
    const unsub = bleSprintGateService.subscribeTiming((event) => {
      if (!hardwareEventCallbackRef.current) return;
      if (event.type === 'start') {
        hardwareEventCallbackRef.current({
          active_runners: 1,
          ldr_status: 1,
          new_result: false,
          new_split: false,
          reaction_time: event.reactionTime || 0,
          start_us: event.startUs || 0
        });
        setTimeout(() => {
          if (hardwareEventCallbackRef.current) {
            hardwareEventCallbackRef.current({
              active_runners: 1,
              ldr_status: 0,
              new_result: false,
              new_split: false
            });
          }
        }, 120);
      } else if (event.type === 'split') {
        hardwareEventCallbackRef.current({
          active_runners: 1,
          new_split: true,
          split_node: event.node || (event.gateIndex !== undefined ? 100 + event.gateIndex : 101),
          split_time: event.time || (event.splitMicros ? event.splitMicros / 1000000 : 0),
          split_micros_delta: event.splitMicros || 0
        });
      } else if (event.type === 'finish') {
        hardwareEventCallbackRef.current({
          active_runners: 0,
          ldr_status: 1,
          new_result: true,
          time: event.time || (event.micros ? event.micros / 1000000 : 0),
          micros_delta: event.micros || 0,
          time_us: event.micros || 0
        });
      }
    });
    return () => unsub();
  }, []);

  // Multi-Modal Gate Connection Hub State (Wi-Fi, Direct USB-C, BLE)
  const [showGateConnectionModal, setShowGateConnectionModal] = useState(false);
  const [isSerialConnected, setIsSerialConnected] = useState(false);
  const [serialPortName, setSerialPortName] = useState('');
  const [isScanningHotspot, setIsScanningHotspot] = useState(false);
  const [scanProgress, setScanProgress] = useState('');

  // Direct USB-C Cable (Web Serial) Timing Gate Integration
  useEffect(() => {
    const unsub = webSerialSprintGateService.subscribe((event) => {
      if (event.type === 'status_change') {
        setIsSerialConnected(event.isConnected);
        setSerialPortName(event.portName || '');
        if (event.isConnected) {
          setStatusB(p => ({ ...p, online: true, reconnecting: false, reconnectAttempts: 0 }));
          setStatusA(p => ({ ...p, online: true }));
          console.info("[Hardware Hub] USB-C timing gate connected and armed.");
        }
      } else if (event.type === 'hardware_data' && hardwareEventCallbackRef.current) {
        hardwareEventCallbackRef.current(event.data);
      }
    });
    return () => unsub();
  }, []);

  // When BLE or Web Serial connects, automatically mark timing nodes as online and armed
  useEffect(() => {
    if (isSprintGateBleConnected) {
      setStatusB(p => ({ ...p, online: true, reconnecting: false, reconnectAttempts: 0 }));
      setStatusA(p => ({ ...p, online: true }));
    }
  }, [isSprintGateBleConnected]);

  // Fast Subnet Scanner to auto-discover ESP32 on mobile hotspot (MAC: d4:e9:f4:e1:ed:94)
  const handleScanHotspot = useCallback(async () => {
    setIsScanningHotspot(true);
    setScanProgress('Initializing scanner...');

    const targets = ['192.168.4.1']; // SoftAP IP
    // Common phone hotspot IPs (Android 192.168.43.2 to 35, iOS 172.20.10.2 to 15)
    for (let i = 2; i <= 35; i++) {
      targets.push(`192.168.43.${i}`);
    }
    for (let i = 2; i <= 15; i++) {
      targets.push(`172.20.10.${i}`);
    }

    let foundIp = null;
    const batchSize = 6;
    for (let c = 0; c < targets.length; c += batchSize) {
      if (foundIp) break;
      const batch = targets.slice(c, c + batchSize);
      setScanProgress(`Probing ${batch[0]}...`);
      const results = await Promise.all(batch.map(async (ip) => {
        try {
          const controller = new AbortController();
          const tid = setTimeout(() => controller.abort(), 600);
          const probeUrl = getGateHttpUrl(ip, '/data');
          await fetch(probeUrl, { mode: 'no-cors', signal: controller.signal });
          clearTimeout(tid);
          return ip;
        } catch {
          return null;
        }
      }));
      foundIp = results.find(r => r !== null);
    }

    setIsScanningHotspot(false);
    setScanProgress('');

    if (foundIp) {
      setNodeB(foundIp);
      localStorage.setItem('sprintgate_node_b_ip', foundIp);
      alert(`ESP32 Timing Gate located at ${foundIp}! Connected.`);
    } else {
      alert("Auto-scan completed. Check your phone's 'Personal Hotspot' connected devices list to see the assigned IP for MAC d4:e9:f4:e1:ed:94 and enter it in Tab 1.");
    }
  }, []);

  // 60-Second Post-Sprint Heart Rate Recovery (HRR) Session
  const [activeHrrSession, setActiveHrrSession] = useState(null);
  const activeHrrSessionRef = useRef(null);
  activeHrrSessionRef.current = activeHrrSession;

  const [isSyncingOfflineQueue, setIsSyncingOfflineQueue] = useState(false);
  const offlineTelemetryStatus = useOfflineTelemetry();
  const unsyncedRunsCount = useMemo(() => results.filter(r => !r.firebaseId).length, [results]);
  const totalUnsyncedRunsCount = useMemo(() => {
    return unsyncedRunsCount + (offlineTelemetryStatus.timingCount || 0);
  }, [unsyncedRunsCount, offlineTelemetryStatus.timingCount]);

  const handleSyncOfflineQueue = async (silent = false) => {
    if (isSyncingOfflineQueue || offlineTelemetryStatus.isSyncing) return;
    if (!offlineTelemetryStatus.isOnline && !silent) {
      alert("Device is currently offline. All sprint evaluations and telemetry are safely cached in local storage and will automatically synchronize when network recovers.");
      return;
    }
    const unsynced = results.filter(r => !r.firebaseId);

    setIsSyncingOfflineQueue(true);
    let successCount = 0;
    try {
      const syncedLocalIds = new Set();
      // 1. Sync React state unsynced runs to Firestore
      for (const run of unsynced) {
        try {
          const docRef = await addDoc(collection(db, "sprint_evaluations"), {
            ...run,
            syncedAt: serverTimestamp()
          });
          if (run.id) syncedLocalIds.add(run.id);
          setResults(prev => prev.map(r => r.id === run.id ? { ...r, firebaseId: docRef.id } : r));
          setHistory(prev => prev.map(r => r.id === run.id ? { ...r, firebaseId: docRef.id } : r));
          successCount++;
        } catch (err) {
          console.warn("[Offline Sync] Failed to sync item:", run.id, err);
        }
      }

      // 2. Also flush any persistent queued runs in offlineTelemetryQueue
      try {
        await offlineTelemetryQueue.flushQueue(async (queuedItem) => {
          const { id: localId, queuedAt, synced, ...payload } = queuedItem;
          // Avoid duplicate Firestore creation if already synced in Step 1
          if (localId && syncedLocalIds.has(localId)) {
            return;
          }
          if (payload.id && syncedLocalIds.has(payload.id)) {
            return;
          }
          const docRef = await addDoc(collection(db, "sprint_evaluations"), {
            ...payload,
            syncedFromTelemetryQueue: true,
            syncedAt: serverTimestamp()
          });
          const targetId = localId || payload.id;
          if (targetId) syncedLocalIds.add(targetId);
          setResults(prev => {
            const exists = prev.some(r => r.id === targetId);
            if (exists) {
              return prev.map(r => r.id === targetId ? { ...r, firebaseId: docRef.id } : r);
            }
            return [{ ...payload, id: targetId, firebaseId: docRef.id }, ...prev];
          });
          setHistory(prev => {
            const exists = prev.some(r => r.id === targetId);
            if (exists) {
              return prev.map(r => r.id === targetId ? { ...r, firebaseId: docRef.id } : r);
            }
            return [{ ...payload, id: targetId, firebaseId: docRef.id }, ...prev];
          });
          successCount++;
        });
      } catch (queueErr) {
        console.warn("[Offline Sync] Error flushing telemetry queue:", queueErr);
      }

      if (!silent) {
        if (successCount > 0) {
          alert(`Successfully synced ${successCount} offline record(s) to Firebase Cloud!`);
        } else if (unsynced.length === 0 && (offlineTelemetryStatus.timingCount || 0) === 0) {
          alert("All sprint evaluations and biometrics are already synchronized with Firebase Cloud!");
        } else {
          alert("Could not reach Firebase Cloud. Please verify your internet connection.");
        }
      }
    } finally {
      setIsSyncingOfflineQueue(false);
    }
  };

  // PWA Auto-sync on network reconnection
  useEffect(() => {
    const onOnline = () => {
      console.info("[Velocity Lab PWA] Network back online. Auto-syncing pending telemetry and evaluations...");
      handleSyncOfflineQueue(true);
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [results]);

  const [sequenceState, setSequenceState] = useState('idle'); // idle, lead_in, marks, set, waiting_start, running, false_start, finished
  const sequenceStateRef = useRef('idle');
  useEffect(() => { 
    sequenceStateRef.current = sequenceState; 
    // Broadcast gate state from Master Console to all satellite stations (Tablet, Phone)
    if (stationRole === 'master') {
      liveFieldSyncService.pushGateState({
        sequenceState,
        displayTime,
        testMode: testModeRef.current || testMode,
        trackDistance,
        isRunning,
        activeRunner: queueRef.current && queueRef.current.length > 0 ? queueRef.current[0] : null,
        statusAOnline: statusA.online,
        statusBOnline: statusB.online
      });
    }
  }, [sequenceState, stationRole, isRunning, trackDistance, statusA.online, statusB.online]);

  const trackAvailability = useMemo(() => {
    // If gates offline
    if (!statusA.online || !statusB.online) {
      return {
        status: 'offline',
        lightClass: 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]',
        borderClass: 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400',
        title: 'GATES OFFLINE • HOLD ATHLETES',
        desc: 'Connect Start Gate & Finish Gate to arm track'
      };
    }
    // If beam is broken when waiting / ready
    if (statusA.beam_broken || statusB.beam_broken) {
      const brokenNode = statusA.beam_broken && statusB.beam_broken 
        ? 'Start & Finish Gates' 
        : statusA.beam_broken 
        ? 'Start Gate (0m)' 
        : 'Finish Gate';
      return {
        status: 'blocked',
        lightClass: 'bg-rose-500 animate-ping shadow-[0_0_12px_rgba(244,63,94,0.9)]',
        borderClass: 'border-rose-500/40 bg-rose-500/15 text-rose-600 dark:text-rose-400',
        title: 'BEAM OBSTRUCTED • HOLD ATHLETE',
        desc: `${brokenNode} laser beam broken or misaligned`
      };
    }
    // If false start
    if (sequenceState === 'false_start') {
      return {
        status: 'false_start',
        lightClass: 'bg-rose-600 animate-bounce shadow-[0_0_14px_rgba(225,29,72,0.9)]',
        borderClass: 'border-rose-600/40 bg-rose-600/20 text-rose-600 dark:text-rose-400',
        title: 'FALSE START DETECTED • HOLD ATHLETE',
        desc: 'Reset or re-arm starting cadence'
      };
    }
    // If sequence or sprint in progress
    if (isRunning || sequenceState === 'waiting_start' || sequenceState === 'marks' || sequenceState === 'set' || sequenceState === 'lead_in') {
      return {
        status: 'running',
        lightClass: 'bg-amber-400 animate-pulse shadow-[0_0_12px_rgba(251,191,36,0.9)]',
        borderClass: 'border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300',
        title: 'SPRINT IN PROGRESS • HOLD ATHLETE',
        desc: sequenceState === 'waiting_start' ? 'Gun fired — awaiting start beam launch' : 'Active runner timing on track'
      };
    }
    // Everything is green and clear!
    return {
      status: 'ready',
      lightClass: 'bg-emerald-500 animate-pulse shadow-[0_0_14px_rgba(16,185,129,0.9)]',
      borderClass: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
      title: 'TRACK CLEAR • READY TO SEND ATHLETE',
      desc: 'All gates synced, lasers aligned & ready for start'
    };
  }, [statusA, statusB, isRunning, sequenceState]);

  // Video State
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const [videoURL, setVideoURL] = useState(null);
  const [compareVideoURL, setCompareVideoURL] = useState(null);
  const [sharedPoseGraphData, setSharedPoseGraphData] = useState([]);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState("environment");
  const chunksRef = useRef([]);

  // Camera track cleanup on unmount to release hardware device
  useEffect(() => {
    return () => {
      const stream = videoRef.current?.srcObject;
      if (stream && typeof stream.getTracks === 'function') {
        try { stream.getTracks().forEach(t => t.stop()); } catch (e) {}
      }
    };
  }, []);

  const toggleCamera = async (forceFacing = null) => {
    const targetFacing = forceFacing || cameraFacing;
    if (isCameraActive && !forceFacing) {
      const stream = videoRef.current?.srcObject;
      if (stream) stream.getTracks().forEach(t => t.stop());
      setIsCameraActive(false);
      if (videoRef.current) videoRef.current.srcObject = null;
    } else {
      try {
        if (isCameraActive) {
            const currentStream = videoRef.current?.srcObject;
            if (currentStream) currentStream.getTracks().forEach(t => t.stop());
        }
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: targetFacing }, 
            audio: false 
        });
        setIsCameraActive(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch(e) { 
        console.error("Camera error:", e);
        alert("Camera could not be accessed. Please check permissions or switch devices.");
      }
    }
  };

  const switchCamera = () => {
    const newFacing = cameraFacing === "environment" ? "user" : "environment";
    setCameraFacing(newFacing);
    if (isCameraActive) {
        toggleCamera(newFacing);
    }
  };

  const activeSequenceIdRef = useRef(0);

  const startRecording = () => {
    if (typeof MediaRecorder === 'undefined') return;
    if (!videoRef.current || !videoRef.current.srcObject) return;
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      chunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm')
          ? 'video/webm'
          : MediaRecorder.isTypeSupported('video/mp4')
            ? 'video/mp4'
            : '';
      const options = mimeType ? { mimeType } : undefined;
      const recorder = new MediaRecorder(videoRef.current.srcObject, options);
      recorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        try {
          const type = mimeType || 'video/webm';
          const blob = new Blob(chunksRef.current, { type });
          setVideoURL(URL.createObjectURL(blob));
        } catch (e) {
          console.warn("Failed to create recorded video URL:", e);
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
    } catch (err) {
      console.warn("MediaRecorder start failed:", err);
    }
  };

  const stopRecording = () => {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    } catch (err) {
      console.warn("MediaRecorder stop failed:", err);
    }
  };


  // Auth & UI State
  const [activeTab, setActiveTab] = useState('live'); // 'live' | 'combine' | 'analytics' | 'video'
  const [showQRModal, setShowQRModal] = useState(null);
  const [showGlobalStrobeModal, setShowGlobalStrobeModal] = useState(false);
  const [showBleacherQRModal, setShowBleacherQRModal] = useState(false);
  const [showQueueScanner, setShowQueueScanner] = useState(false);
  const [showWindModal, setShowWindModal] = useState(false);
  const [analyticsMode, setAnalyticsMode] = useState('history');
  const [selectedProfileAthlete, setSelectedProfileAthlete] = useState(null);
  const [profileChartMetric, setProfileChartMetric] = useState('time');
  const [history, setHistory] = useState([]);
  const historyRef = useRef(history);
  useEffect(() => { historyRef.current = history; }, [history]);
  const [selectedAthlete, setSelectedAthlete] = useState("All");
  const [selectedDistanceFilter, setSelectedDistanceFilter] = useState("All");
  
  const [user, setUser] = useState(null);
  const [spectatorMode, setSpectatorMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('mode') === 'spectator' || params.get('spectator') === 'true';
    }
    return false;
  });
  const [isBleacherScoreboard, setIsBleacherScoreboard] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('mode') === 'spectator' || params.get('spectator') === 'true';
    }
    return false;
  });

  useEffect(() => {
    const handleUrlMode = () => {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        if (params.get('mode') === 'spectator' || params.get('spectator') === 'true') {
          setSpectatorMode(true);
          setIsBleacherScoreboard(true);
        }
      }
    };
    handleUrlMode();
    window.addEventListener('popstate', handleUrlMode);
    return () => window.removeEventListener('popstate', handleUrlMode);
  }, []);

  const hardwareEventCallbackRef = useRef(null);
  

  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState("");
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const maskEmail = (emailStr) => {
    if (!emailStr || typeof emailStr !== 'string' || !emailStr.includes('@')) return 'Master Admin';
    const [local, domain] = emailStr.split('@');
    const maskedLocal = local.length <= 2 
      ? `${local[0]}*` 
      : `${local[0]}${'*'.repeat(Math.max(1, Math.min(local.length - 2, 4)))}${local[local.length - 1]}`;
    const domainParts = domain.split('.');
    if (domainParts.length >= 2) {
      const dName = domainParts[0];
      const maskedD = dName.length <= 2 ? `${dName[0]}*` : `${dName[0]}***`;
      return `${maskedLocal}@${maskedD}.${domainParts.slice(1).join('.')}`;
    }
    return `${maskedLocal}@${domain}`;
  };

  // Single Master Admin + Dedicated Athlete Separation State
  const [authRole, setAuthRole] = useState(() => safeLocalStorageGet('sprintgate_auth_role', null));
  const [currentAthlete, setCurrentAthlete] = useState(() => safeLocalStorageGet('sprintgate_athlete_session', null));
  const [masterAdminMeta, setMasterAdminMeta] = useState(() => safeLocalStorageGet('sprintgate_admin_meta', null));
  const [portalTab, setPortalTab] = useState('admin'); // 'admin' | 'athlete'
  const [athleteBibInput, setAthleteBibInput] = useState('');
  const [athletePinInput, setAthletePinInput] = useState('');
  const [athleteScanOpen, setAthleteScanOpen] = useState(false);
  const [athleteRosterSearch, setAthleteRosterSearch] = useState('');

  // Role permissions helpers
  const isAdmin = authRole === 'admin' && !!user;
  const isAthlete = authRole === 'athlete' && !!currentAthlete;
  const isLoggedIn = isAdmin || isAthlete;

  useEffect(() => {
    let unsubscribeAthletes = () => {};
    let unsubscribeHistory = () => {};
    let unsubscribeAdminMeta = () => {};
    
    // 1. Single Master Admin Config Listener
    try {
      unsubscribeAdminMeta = onSnapshot(doc(db, "system_config", "admin_meta"), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setMasterAdminMeta(data);
          safeLocalStorageSet('sprintgate_admin_meta', data);
        } else {
          setMasterAdminMeta(null);
          safeLocalStorageRemove('sprintgate_admin_meta');
        }
      }, (err) => {
        console.warn("admin_meta onSnapshot:", err);
      });
    } catch (e) {
      console.warn("admin_meta subscription error:", e);
    }

    // 2. Sprint Evaluations listener with limit(200) for performance & scalability
    try {
      const q = query(collection(db, "sprint_evaluations"), orderBy("serverTime", "desc"), limit(200));
      unsubscribeHistory = onSnapshot(q, (snapshot) => {
        setHistory(snapshot.docs.map(doc => ({ ...doc.data(), firebaseId: doc.id })));
      }, (err) => {
        console.warn("sprint_evaluations onSnapshot error:", err);
      });
    } catch (e) {
      console.error("Error fetching evaluations:", e);
    }

    // 3. Squad Roster listener
    try {
      unsubscribeAthletes = onSnapshot(collection(db, "athletes"), (snap) => {
        const athletes = snap.docs.map(d => ({ ...d.data(), firebaseId: d.id, id: d.data().id || d.id }));
        setRoster(athletes);
      }, (err) => {
        console.warn("athletes onSnapshot error:", err);
      });
    } catch (e) {
      console.error("Error fetching athletes:", e);
    }

    // 4. Firebase Auth listener with strict Master Admin validation
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setAuthLoading(false);
      if (currentUser) {
        // Read cached or current master admin meta
        const cachedMeta = safeLocalStorageGet('sprintgate_admin_meta', null);
        const meta = masterAdminMeta || cachedMeta;
        if (meta && meta.isInitialized) {
          const isMaster = (currentUser.email && meta.masterAdminEmail && currentUser.email.toLowerCase() === meta.masterAdminEmail.toLowerCase()) ||
                           (currentUser.uid && meta.masterAdminUid && currentUser.uid === meta.masterAdminUid);
          if (!isMaster) {
            console.warn("Unauthorized user attempted admin login:", currentUser.email);
            await signOut(auth);
            setUser(null);
            setAuthRole(null);
            safeLocalStorageRemove('sprintgate_auth_role');
            setAuthError(`Access Denied: Only the registered Master Admin (${meta.masterAdminEmail}) is authorized to access Coach/Admin controls.`);
            return;
          }
        }
        setUser(currentUser);
        setAuthRole('admin');
        safeLocalStorageSet('sprintgate_auth_role', 'admin');
      } else {
        setUser(null);
        // Only clear role if role was admin; preserve athlete session if active
        if (safeLocalStorageGet('sprintgate_auth_role') === 'admin') {
          setAuthRole(null);
          safeLocalStorageRemove('sprintgate_auth_role');
        }
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeHistory();
      unsubscribeAthletes();
      unsubscribeAdminMeta();
    };
  }, []);

  // Athletes have read-only access to Team Portal & Roster to view squad leaderboards and progression
  useEffect(() => {
    // Retain athlete access to Team Portal
  }, [activeTab, isAthlete]);

  // Auto-sync athlete profile selection when in Athlete Portal
  useEffect(() => {
    if (isAthlete && currentAthlete?.name) {
      if (selectedAthlete === "All" || !selectedAthlete) {
        setSelectedAthlete(currentAthlete.name);
      }
      if (!selectedProfileAthlete) {
        setSelectedProfileAthlete(currentAthlete.name);
      }
    }
  }, [isAthlete, currentAthlete]);

  useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError("");
    const cleanEmail = email.trim().toLowerCase();
    
    // Check if master admin is initialized
    const meta = masterAdminMeta || safeLocalStorageGet('sprintgate_admin_meta', null);
    
    try {
      if (isRegistering) {
        // If master admin already exists, block additional admin registrations completely!
        if (meta && meta.isInitialized) {
          setAuthError(`Registration is permanently locked: Master Admin (${meta.masterAdminEmail}) is already configured. Only 1 master admin is permitted.`);
          return;
        }

        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        const metaDoc = {
          masterAdminEmail: cleanEmail,
          masterAdminUid: cred.user.uid,
          isInitialized: true,
          createdAt: serverTimestamp()
        };
        await setDoc(doc(db, "system_config", "admin_meta"), metaDoc, { merge: true });
        setMasterAdminMeta(metaDoc);
        safeLocalStorageSet('sprintgate_admin_meta', metaDoc);
        setUser(cred.user);
        setAuthRole('admin');
        safeLocalStorageSet('sprintgate_auth_role', 'admin');
      } else {
        // Single admin verification on login
        if (meta && meta.isInitialized && meta.masterAdminEmail) {
          if (cleanEmail !== meta.masterAdminEmail.toLowerCase()) {
            setAuthError(`Access Denied: "${cleanEmail}" is not the authorized Master Admin account. Only ${meta.masterAdminEmail} can log in as Admin.`);
            return;
          }
        }
        const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
        
        // If first login and meta wasn't created yet, establish master admin
        if (!meta || !meta.isInitialized) {
          const metaDoc = {
            masterAdminEmail: cleanEmail,
            masterAdminUid: cred.user.uid,
            isInitialized: true,
            createdAt: serverTimestamp()
          };
          await setDoc(doc(db, "system_config", "admin_meta"), metaDoc, { merge: true }).catch(() => {});
          setMasterAdminMeta(metaDoc);
          safeLocalStorageSet('sprintgate_admin_meta', metaDoc);
        }

        setUser(cred.user);
        setAuthRole('admin');
        safeLocalStorageSet('sprintgate_auth_role', 'admin');
      }
    } catch (error) {
      console.error("Auth error:", error);
      let msg = error.message;
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
        msg = "Invalid password or email address.";
      } else if (error.code === 'auth/user-not-found') {
        msg = "No admin account found with this email.";
      } else if (error.code === 'auth/email-already-in-use') {
        msg = "Email is already registered. Please login instead.";
      }
      setAuthError(msg);
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setAuthError("");
    setResetSent(false);
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setAuthError("Please enter your Master Admin email address to receive the password reset link.");
      return;
    }
    const meta = masterAdminMeta || safeLocalStorageGet('sprintgate_admin_meta', null);
    if (meta && meta.masterAdminEmail && cleanEmail !== meta.masterAdminEmail.toLowerCase()) {
      setAuthError(`Access Denied: Password reset emails can only be dispatched to the authorized Master Admin account (${maskEmail(meta.masterAdminEmail)}).`);
      return;
    }
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      setResetSent(true);
    } catch (err) {
      console.error("Password reset error:", err);
      let msg = err.message;
      if (err.code === 'auth/user-not-found') {
        msg = "No account found matching this email address.";
      } else if (err.code === 'auth/invalid-email') {
        msg = "Please enter a valid email address.";
      } else if (err.code === 'auth/too-many-requests') {
        msg = "Too many requests. Please wait a few moments before trying again.";
      }
      setAuthError(msg);
    } finally {
      setResetLoading(false);
    }
  };

  const handleAthleteLogin = (targetAthlete, pin = '') => {
    if (!targetAthlete) {
      setAuthError("Please select or enter a valid athlete from the squad roster.");
      return;
    }
    // If athlete has a PIN, verify it
    if (targetAthlete.pin && targetAthlete.pin !== pin) {
      setAuthError(`Incorrect passcode for ${targetAthlete.name}. Please enter your 4-digit PIN.`);
      return;
    }
    setAuthRole('athlete');
    setCurrentAthlete(targetAthlete);
    safeLocalStorageSet('sprintgate_auth_role', 'athlete');
    safeLocalStorageSet('sprintgate_athlete_session', targetAthlete);
    setSelectedProfileAthlete(targetAthlete.name);
    setSelectedAthlete(targetAthlete.name);
    setActiveTab('analytics');
    setAuthError("");
  };

  const handleAthleteBibSubmit = (e) => {
    e.preventDefault();
    setAuthError("");
    const term = athleteBibInput.trim().toLowerCase();
    if (!term) {
      setAuthError("Please enter your Athlete Bib Number or Name.");
      return;
    }
    const matched = roster.find(a => 
      (a.bib != null && String(a.bib).trim().toLowerCase() === term) ||
      (a.name && a.name.trim().toLowerCase() === term) ||
      (a.rfidUid && a.rfidUid.trim().toLowerCase() === term)
    );
    if (!matched) {
      setAuthError(`Athlete with Bib/Name "${athleteBibInput}" was not found in the squad roster. Please verify your Bib ID or select your name from the squad list below.`);
      return;
    }
    handleAthleteLogin(matched, athletePinInput.trim());
  };

  const handleAthleteQrScan = (decodedText) => {
    setAthleteScanOpen(false);
    if (!decodedText) return;
    const cleanScan = decodedText.trim().toLowerCase();
    const matched = roster.find(a => 
      (a.rfidUid && a.rfidUid.toLowerCase() === cleanScan) ||
      (a.bib != null && String(a.bib).toLowerCase() === cleanScan) ||
      (a.name && a.name.toLowerCase() === cleanScan) ||
      (a.id && String(a.id) === cleanScan)
    );
    if (matched) {
      handleAthleteLogin(matched);
    } else {
      setAuthError(`No registered squad athlete found matching QR code "${decodedText}".`);
    }
  };

  const handleLogout = () => {
    if (isAdmin) {
      signOut(auth).catch(() => {});
    }
    setUser(null);
    setAuthRole(null);
    setCurrentAthlete(null);
    safeLocalStorageRemove('sprintgate_auth_role');
    safeLocalStorageRemove('sprintgate_athlete_session');
    setSpectatorMode(false);
  };

  const updateTimer = () => {
    if (isRunningRef.current) {
      const now = performance.now();
      const isMassSprint = testModeRef.current === 'mass_sprint';

      // Throttle root virtual-DOM re-renders to ~30 FPS (~33ms intervals)
      // Eliminates the 120Hz re-render storm across 7,000+ lines while preserving 100% FAT timing precision
      if (now - lastUiUpdateRef.current >= 33) {
        lastUiUpdateRef.current = now;
        if (isMassSprint && runnersOnTrackRef.current.length > 0) {
          const leadRunner = runnersOnTrackRef.current[0];
          setDisplayTime((now - leadRunner.startTime) / 1000);
          if (lastRunnerStartTimeRef.current > 0 && (now - lastTimeSinceStartUpdateRef.current >= 100)) {
            lastTimeSinceStartUpdateRef.current = now;
            setTimeSinceLastStart(parseFloat(((now - lastRunnerStartTimeRef.current) / 1000).toFixed(1)));
          }
        } else {
          setDisplayTime((now - startTimeRef.current) / 1000);
        }
      }
      timerRef.current = requestAnimationFrame(updateTimer);
    }
  };

  const startTimer = () => {
    if (isRunningRef.current) return;
    if (Date.now() < finishLockoutUntilRef.current) return;
    isRunningRef.current = true;
    setIsRunning(true);
    sequenceStateRef.current = 'running';
    setSequenceState('running');
    lastUiUpdateRef.current = 0;
    lastTimeSinceStartUpdateRef.current = 0;
    startTimeRef.current = performance.now();
    timerRef.current = requestAnimationFrame(updateTimer);
  };

  const stopTimer = (finalTime) => {
    isRunningRef.current = false;
    setIsRunning(false);
    if (timerRef.current) {
      cancelAnimationFrame(timerRef.current);
      timerRef.current = null;
    }
    lastUiUpdateRef.current = 0;
    lastTimeSinceStartUpdateRef.current = 0;
    if (finalTime !== undefined) {
      const num = typeof finalTime === 'number' ? finalTime : parseFloat(finalTime);
      if (!isNaN(num)) setDisplayTime(num);
    }
  };

  const playFinishSound = () => {
    try {
      if (hasCustomAudio('finish')) {
        playCustomAudioSound('finish');
        return;
      }
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1046.5, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch(e) {}
  };

  const playMarksSound = () => {
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch(e) {}
  };

  const playSetSound = () => {
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1000, ctx.currentTime);
      gain.gain.setValueAtTime(0.6, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch(e) {}
  };

  const playFalseStartSound = () => {
    try {
      if (hasCustomAudio('false_start')) {
        playCustomAudioSound('false_start');
        return;
      }
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') ctx.resume();

      // World Athletics Rule 161.2: Official Electronic Secondary Recall Horn
      // Dual-tone high-decibel acoustic horn blast to instantly abort athletes
      const playRecallBurst = (startTime, duration, freq1 = 880, freq2 = 1320) => {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sawtooth';
        osc2.type = 'square';
        osc1.frequency.setValueAtTime(freq1, startTime);
        osc2.frequency.setValueAtTime(freq2, startTime);

        gain.gain.setValueAtTime(0.85, startTime);
        gain.gain.setValueAtTime(0.85, startTime + duration - 0.04);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(startTime);
        osc2.start(startTime);
        osc1.stop(startTime + duration);
        osc2.stop(startTime + duration);
      };

      const t0 = ctx.currentTime;
      // Burst 1: immediate 880/1320Hz harsh horn
      playRecallBurst(t0, 0.22, 880, 1320);
      // Burst 2: secondary automated recall horn blast
      playRecallBurst(t0 + 0.28, 0.35, 880, 1320);
    } catch(e) {
      console.warn("Recall horn playback error:", e);
    }
  };

  const playGunSound = () => {
    try {
      playGunshot();
    } catch(e) {
      console.warn("Error triggering gunshot mp3, using synthetic zero-latency fallback:", e);
      playSynthesizedGunshot();
    }
  };

  const triggerConfiguredStarterSound = () => {
    try {
      const snd = audioConfig?.starterSound || 'gun';
      if (snd === 'custom') {
        const played = playCustomAudioSound('trigger');
        if (!played) playGunSound();
      } else if (snd === 'horn') {
        playElectronicStarterHorn();
      } else if (snd === 'whistle') {
        if (audioConfig?.cadencePreset === 'whistleCadence') {
          playDoubleWhistle();
        } else {
          playWhistleSound();
        }
      } else {
        playGunSound();
      }
    } catch(e) {
      console.warn("Error triggering starter sound:", e);
    }
  };

  const handleArmAndStart = async () => {
    if (!isAdmin) {
      alert("Unauthorized: Only the Master Coach / Admin can arm and initiate timing gates.");
      return;
    }
    if (sequenceStateRef.current !== 'idle') return;
    const currentSeqId = ++activeSequenceIdRef.current;
    finishLockoutUntilRef.current = 0;
    setLiveSplits([]);
    currentRunDataRef.current = { reactionTime: 0, splits: [] };
    prevActiveRunnersRef.current = 0;
    prevLdrStatusRef.current = 0;
    setFalseStartReason('');
    sendGateCommand(nodeBRef.current, '/reset');

    const cfg = audioConfigRef.current || DEFAULT_AUDIO_CONFIG;

    if (!cfg.instantGun) {
      // Optional Championship Final stadium attention chime
      if ((cfg.cadencePreset === 'championshipFinal' || cfg.cadencePreset === 'olympicFinal') && voiceEnabledRef.current) {
        playAttentionChime(0.75);
        await new Promise(r => setTimeout(r, 650));
        if (activeSequenceIdRef.current !== currentSeqId || sequenceStateRef.current !== 'idle') return;
      }

      // 1. Lead-in acoustic countdown cadence (with custom interval support)
      const leadInIntervalMs = getEffectiveLeadInInterval(cfg);
      if (cfg.leadInBeeps > 0 && voiceEnabledRef.current) {
        setSequenceState('lead_in');
        sequenceStateRef.current = 'lead_in';
        for (let i = 1; i <= cfg.leadInBeeps; i++) {
          if (activeSequenceIdRef.current !== currentSeqId || sequenceStateRef.current !== 'lead_in') return;
          setCadenceBeepCount(i);
          playLeadInBeep(880 + (i * 20), 0.14, 0.6);
          await new Promise(r => setTimeout(r, leadInIntervalMs));
          if (activeSequenceIdRef.current !== currentSeqId || sequenceStateRef.current !== 'lead_in') return;
        }
        setCadenceBeepCount(0);
      }
      
      if (activeSequenceIdRef.current !== currentSeqId) return;

      // 2. "On Your Marks"
      setSequenceState('marks');
      sequenceStateRef.current = 'marks';
      if (voiceEnabledRef.current) {
        if (cfg.announceMarks) {
          if (cfg.cadencePreset === 'nflCombine') {
            await speakLocalized('downSet', {}, cfg);
          } else {
            await speakLocalized('marks', {}, cfg);
          }
        } else {
          playMarksSound();
          await new Promise(r => setTimeout(r, 350));
        }
      }
      const marksHold = getEffectiveMarksHoldMs(cfg);
      await new Promise(r => setTimeout(r, marksHold));
      if (activeSequenceIdRef.current !== currentSeqId || sequenceStateRef.current === 'false_start' || sequenceStateRef.current === 'idle') return;
      
      // 3. "Set" (MANDATORY: Must completely sound and finish before athlete hold and trigger gun!)
      setSequenceState('set');
      sequenceStateRef.current = 'set';
      if (voiceEnabledRef.current) {
        await announceSetCadence(cfg);
      } else {
        playSetSound();
        await new Promise(r => setTimeout(r, 380));
      }
      if (activeSequenceIdRef.current !== currentSeqId || sequenceStateRef.current === 'false_start' || sequenceStateRef.current === 'idle') return;
      
      // Post-"Set" Interval Manager Delay before Starting Trigger Sound (with custom delay support)
      // Strict rule: Hold period begins AFTER "Set" announcement has completely finished!
      const holdTime = Math.max(1200, getEffectiveSetDelayMs(cfg));
      await new Promise(r => setTimeout(r, holdTime));
      if (activeSequenceIdRef.current !== currentSeqId || sequenceStateRef.current === 'false_start' || sequenceStateRef.current === 'idle') return;
    }

    // 4. Starter gun / horn / custom sound
    // Record gun timestamp for true reaction time measurement (gun to laser beam break)
    gunTimeRef.current = performance.now();

    // Transition to waiting_start (Gun fired, laser armed, awaiting athlete beam break)
    // NOTE: The running timer MUST NOT start until the athlete physically breaks the laser beam!
    setSequenceState('waiting_start');
    sequenceStateRef.current = 'waiting_start';
    startRecording();
    
    if (voiceEnabledRef.current) {
      if (cfg.starterSound === 'custom') {
        const played = playCustomAudioSound('trigger');
        if (!played) playGunSound();
      } else if (cfg.starterSound === 'horn') {
        playElectronicStarterHorn();
      } else if (cfg.starterSound === 'whistle') {
        if (cfg.cadencePreset === 'whistleCadence') {
          playDoubleWhistle();
        } else {
          playWhistleSound();
        }
      } else {
        playGunSound();
      }
    }

    // Trigger gun on Node A for true reaction time measurement & hardware buzzer
    sendGateCommand(nodeARef.current, '/gun');
  };

  const handleReset = async () => {
    activeSequenceIdRef.current++;
    cancelAllSpeech();
    stopRecording();
    finishLockoutUntilRef.current = 0;
    stopTimer(0);
    gunTimeRef.current = 0;
    setFalseStartReason('');
    setSequenceState('idle');
    sequenceStateRef.current = 'idle';
    setLiveSplits([]);
    setRunnersOnTrack([]);
    runnersOnTrackRef.current = [];
    lastRunnerStartTimeRef.current = 0;
    setTimeSinceLastStart(0);
    currentRunDataRef.current = { reactionTime: 0, splits: [] };
    sendGateCommand(nodeBRef.current, '/reset');
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && !isRunningRef.current && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        handleArmAndStart();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Multi-Device Field Station Real-Time Synchronization Listener
  useEffect(() => {
    if (!db) return;
    liveFieldSyncService.init({
      db,
      user,
      onQueueSync: (remoteQueue) => {
        queueRef.current = remoteQueue;
        safeLocalStorageSet('sprintgate_persistent_queue', remoteQueue);
        _setQueue(remoteQueue);
      },
      onGateStateSync: (gateState) => {
        if (stationRole !== 'master') {
          if (gateState.sequenceState) {
            setSequenceState(gateState.sequenceState);
            sequenceStateRef.current = gateState.sequenceState;
          }
          if (gateState.displayTime !== undefined) {
            setDisplayTime(gateState.displayTime);
          }
          if (gateState.testMode && gateState.testMode !== testModeRef.current) {
            setTestMode(gateState.testMode);
            testModeRef.current = gateState.testMode;
          }
        }
      },
      onCommandReceived: (cmd) => {
        if (cmd.action === 'CALL_NEXT') {
          setQueue(prev => prev.slice(1));
        } else if (cmd.action === 'START_SEQUENCE') {
          if (stationRole === 'master') {
            handleArmAndStart();
          }
        } else if (cmd.action === 'RESET') {
          if (stationRole === 'master') {
            handleReset();
          }
        } else if (cmd.action === 'READY_AT_BLOCKS') {
          console.info('[FieldSync] Athlete ready at blocks:', cmd.payload);
        }
      },
      onStationsChange: (stations) => {
        setConnectedStations(stations);
      },
      onMirrorTabChange: (tab) => {
        if (stationRole === 'mirror' && tab) {
          setActiveTab(tab);
        }
      }
    });

    return () => liveFieldSyncService.cleanup();
  }, [db, user, stationRole]);

  const triggerPRCelebration = (record) => {
    try {
      const ctx = getAudioContext();
      const playNote = (freq, startTime, duration) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime + startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + startTime);
        osc.stop(ctx.currentTime + startTime + duration);
      };
      playNote(523.25, 0, 0.2);
      playNote(659.25, 0.2, 0.2);
      playNote(783.99, 0.4, 0.2);
      playNote(1046.50, 0.6, 0.4);
    } catch (e) { }

    const msg = `${record.name} just set a new PR of ${record.time}s!`;
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        new Notification("🏆 New Personal Record!", { body: msg, icon: "/vite.svg" });
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
          if (permission === "granted") {
            new Notification("🏆 New Personal Record!", { body: msg, icon: "/vite.svg" });
          }
        });
      }
    }
  };

  const announceRun = (record, isPR) => {
    if (!voiceEnabledRef.current) return;
    if (isPR && hasCustomAudio('pr')) {
      playCustomAudioSound('pr');
    }
    if (audioConfigRef.current?.announceResults) {
      speakLocalized('runResult', { name: record.name, time: parseFloat(record.time), isPR }, audioConfigRef.current);

      // 4.10: Smart Voice Coaching Cue (Additive, delayed by 2.2s after time announcement)
      if (audioConfigRef.current?.coachingCues !== false && record?.standing) {
        const coachingCues = {
          Superior: "Outstanding sprint! Maintain this drive phase angle.",
          Good: "Great time! Focus on arm drive in the first 10 meters.",
          Average: "Good effort. Work on explosive block clearance.",
          Fair: "Keep grinding. Improve your lean angle at the gun.",
          'Needs Work': "Focus on upright posture and relaxed upper body form."
        };
        const cue = coachingCues[record.standing];
        if (cue) {
          setTimeout(() => {
            if (voiceEnabledRef.current) {
              speakLocalized(cue, {}, audioConfigRef.current);
            }
          }, 2400);
        }
      }
    }
  };

  const speakSplitCallout = (turnNum, splitTime) => {
    if (!voiceEnabledRef.current) return;
    if (audioConfigRef.current?.announceSplits) {
      speakLocalized('splitCallout', { turn: turnNum, time: splitTime }, audioConfigRef.current);
    }
  };

  const saveToFirebase = async (record) => {
    try {
      let isPR = false;
      if (record.time && record.name && historyRef.current) {
        const previousRuns = historyRef.current.filter(h => 
          h.name === record.name && 
          h.testType === record.testType && 
          (record.testType === 'sprint' || record.testType === 'standard' ? h.distance == record.distance : true)
        );
        const previousPR = previousRuns.length > 0 ? Math.min(...previousRuns.map(h => parseFloat(h.time)).filter(t => !isNaN(t) && t > 0)) : Infinity;
        
        if (parseFloat(record.time) < previousPR && previousPR !== Infinity && parseFloat(record.time) > 0) {
           isPR = true;
           triggerPRCelebration(record);
        }
      }
      
      if (record.time && record.name && parseFloat(record.time) > 0) {
        announceRun(record, isPR);
      }

      // If network is offline, safely persist directly to offline telemetry queue
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        console.warn("[Velocity Lab PWA] Network offline; persisting run to offline telemetry queue.");
        await offlineTelemetryQueue.enqueueTimingRun(record);
        return;
      }

      const docRef = await addDoc(collection(db, "sprint_evaluations"), { ...record, serverTime: serverTimestamp() });
      setResults(prev => prev.map(r => r.id === record.id ? { ...r, firebaseId: docRef.id } : r));
    } catch(e) { 
      console.warn("[Velocity Lab PWA] Firebase save failed; enqueueing to offline telemetry queue:", e); 
      try {
        await offlineTelemetryQueue.enqueueTimingRun(record);
      } catch (qErr) {
        console.error("Failed to enqueue to telemetry queue:", qErr);
      }
    }
  };



  const processFinish = (timeStr, customRunner = null) => {
    let runner;
    const currentMode = testModeRef.current;
    if (customRunner) {
      runner = customRunner;
    } else {
      let newQ = [...queueRef.current];
      if (newQ.length === 0) {
        const c = subjectCounterRef.current++;
        runner = { name: `Subject ${c}`, bib: `S${c}`, age: 20, gender: 'M' };
      } else {
        // Station-aware match: find queued athlete who is pending for this specific test
        let runnerIndex = newQ.findIndex(q => {
          if (!q.battery || !Array.isArray(q.battery)) return true;
          const entry = q.battery.find(b => b.testMode === currentMode);
          return entry ? entry.status === 'pending' : false;
        });
        if (runnerIndex === -1) runnerIndex = 0;

        runner = newQ.splice(runnerIndex, 1)[0];

        // Multi-Test Combine Battery Management:
        // If athlete is taking multiple tests (Sprint + 4x10 Shuttle + Agility),
        // update their current test as completed and keep them in the queue if tests remain!
        if (runner.battery && Array.isArray(runner.battery)) {
          const updatedBattery = runner.battery.map(b => 
            b.testMode === currentMode 
              ? { ...b, status: 'completed', time: parseFloat(timeStr) || timeStr, completedAt: new Date().toISOString() } 
              : b
          );
          const hasRemainingTests = updatedBattery.some(b => b.status === 'pending');
          
          if (hasRemainingTests) {
            const updatedRunner = {
              ...runner,
              battery: updatedBattery
            };
            // Put runner back into queue so they stay persisted for subsequent tests!
            newQ.push(updatedRunner);
          }
        }
      }
      setQueue(newQ);
    }
    let distanceNum = parseFloat(trackDistanceRef.current) || 40;
    let distanceName = `${distanceNum}m Straight Sprint`;
    let isShuttle = false;
    
    if (testModeRef.current === 'shuttle') {
      distanceName = '4x10m Shuttle Run';
      distanceNum = 40;
      isShuttle = true;
    } else if (testModeRef.current === 'pro_agility') {
      distanceName = 'Pro Agility (5-10-5)';
      distanceNum = 20;
    } else if (testModeRef.current === 'l_drill') {
      distanceName = '3-Cone L-Drill';
      distanceNum = 30;
    } else if (testModeRef.current === 'rsa') {
      distanceName = `${distanceNum}m RSA Sprint`;
    } else if (testModeRef.current === 'mass_sprint') {
      distanceName = `${distanceNum}m Mass Sprint Heat`;
    } else if (testModeRef.current === 'flying') {
      distanceName = `${distanceNum}m Flying Start Sprint`;
    } else {
      distanceName = `${distanceNum}m Straight Sprint`;
    }

    const { standing, fitt, sport, focus } = isShuttle
      ? evaluateShuttleRun(timeStr, runner.age, runner.gender)
      : evaluateRun(timeStr, runner.age, runner.gender, distanceNum);
    
    const timeNum = parseFloat(timeStr) || 1;
    const velocity = (distanceNum / timeNum).toFixed(2);

    const splitsSnapshot = customRunner?.splits ? [...customRunner.splits] : [...currentRunDataRef.current.splits];
    let agilityAnalytics = null;
    if (['shuttle', 'pro_agility', 'l_drill'].includes(testModeRef.current) && splitsSnapshot.length >= 3) {
      agilityAnalytics = calculateAgilityMetrics(splitsSnapshot, testModeRef.current);
    }

    const hrState = bleHeartRateService.getState();
    const heartRateData = hrState.bpm > 0 ? {
      bpm: hrState.bpm,
      zone: hrState.zone?.zone || 0,
      zoneName: hrState.zone?.name || '',
      deviceName: hrState.deviceName || 'BLE Sensor'
    } : null;

    const res = { 
      ...runner, time: timeStr, standing, fitt, sport, focus, id: Date.now(),
      distance: distanceName,
      distanceMeters: distanceNum,
      testType: testModeRef.current,
      testMode: testModeRef.current,
      velocity: velocity,
      reactionTime: customRunner?.reactionTime !== undefined ? customRunner.reactionTime : (currentRunDataRef.current.reactionTime || 0),
      splits: splitsSnapshot,
      agilityAnalytics: agilityAnalytics,
      windSpeed: windSpeedRef.current || null,
      surfaceType: surfaceTypeRef.current || 'Track',
      heartRate: heartRateData
    };
    if (!customRunner) {
      currentRunDataRef.current = { reactionTime: 0, splits: [] };
    }
    setResults(old => [res, ...old]);
    saveToFirebase(res);

    // If athlete is connected to BLE Heart Rate (or in simulator mode), initiate 60s HRR session
    if (heartRateData && heartRateData.bpm > 0) {
      setActiveHrrSession({
        runId: res.id,
        athleteName: runner.name,
        bib: runner.bib,
        peakBpm: heartRateData.bpm,
        currentBpm: heartRateData.bpm,
        elapsedSeconds: 0,
        hrr30: null,
        hrr60: null,
        status: 'monitoring',
        curve: [{ sec: 0, bpm: heartRateData.bpm }]
      });
    }

    if (voiceEnabledRef.current) {
      const firstName = runner.name ? runner.name.split(' ')[0] : '';
      const text = isShuttle
        ? `${runner.bib}, ${firstName}, 4 by 10 Shuttle complete, ${timeStr} seconds.`
        : `${runner.bib}, ${firstName}, ${timeStr} seconds.`;
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utterance);
    }
  };

  const updateRunHeartRate = async (runId, updatedHeartRateData) => {
    setResults(prev => prev.map(r => r.id === runId ? { ...r, heartRate: { ...(r.heartRate || {}), ...updatedHeartRateData } } : r));
    setHistory(prev => prev.map(r => r.id === runId ? { ...r, heartRate: { ...(r.heartRate || {}), ...updatedHeartRateData } } : r));

    try {
      const stored = safeLocalStorageGet('sprintgate_results', []);
      const updatedStored = stored.map(r => r.id === runId ? { ...r, heartRate: { ...(r.heartRate || {}), ...updatedHeartRateData } } : r);
      safeLocalStorageSet('sprintgate_results', updatedStored);
    } catch(e) {}

    const targetRun = results.find(r => r.id === runId);
    if (targetRun?.firebaseId && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        await updateDoc(doc(db, "sprint_evaluations", targetRun.firebaseId), {
          heartRate: { ...(targetRun.heartRate || {}), ...updatedHeartRateData }
        });
      } catch (err) {
        console.warn("[SprintGate] Failed to update HRR in Firestore:", err);
      }
    }
  };

  const handleLogHrrEarly = () => {
    if (!activeHrrSessionRef.current) return;
    const current = activeHrrSessionRef.current;
    const drop = Math.max(0, current.peakBpm - current.currentBpm);
    let rating = "Good Recovery";
    if (drop >= 30) rating = "Elite Recovery";
    else if (drop >= 20) rating = "Good Recovery";
    else if (drop >= 12) rating = "Moderate";
    else rating = "Elevated Fatigue";

    const hrrResult = {
      peakBpm: current.peakBpm,
      finishBpm: current.peakBpm,
      hrrElapsedSec: current.elapsedSeconds,
      hrrDrop: drop,
      recoveryRating: `${rating} (-${drop} bpm drop in ${current.elapsedSeconds}s)`,
      curve: current.curve
    };
    updateRunHeartRate(current.runId, hrrResult);
    setActiveHrrSession(null);
  };

  const handleDismissHrr = () => {
    setActiveHrrSession(null);
  };

  // Active 60-Second Post-Sprint Heart Rate Recovery Interval
  useEffect(() => {
    if (!activeHrrSession || activeHrrSession.status !== 'monitoring') return;

    const interval = setInterval(() => {
      const current = activeHrrSessionRef.current;
      if (!current || current.status !== 'monitoring') return;

      const currentBpm = bleHeartRateService.getState().bpm || current.currentBpm;
      const nextElapsed = current.elapsedSeconds + 1;
      const newCurve = [...(current.curve || []), { sec: nextElapsed, bpm: currentBpm }];

      let nextHrr30 = current.hrr30;
      if (nextElapsed === 30 && nextHrr30 === null) {
        nextHrr30 = Math.max(0, current.peakBpm - currentBpm);
      }

      if (nextElapsed >= 60) {
        const finalHrr60 = Math.max(0, current.peakBpm - currentBpm);
        const finalHrr30 = nextHrr30 !== null ? nextHrr30 : Math.max(0, current.peakBpm - (current.curve?.[30]?.bpm || currentBpm));

        let rating = "Elite Recovery (30+ bpm)";
        if (finalHrr60 < 12) rating = "Elevated Fatigue (<12 bpm)";
        else if (finalHrr60 < 20) rating = "Moderate (12-19 bpm)";
        else if (finalHrr60 < 30) rating = "Good Recovery (20-29 bpm)";

        const hrrResult = {
          peakBpm: current.peakBpm,
          finishBpm: current.peakBpm,
          hrr30: finalHrr30,
          hrr60: finalHrr60,
          hrrDrop: finalHrr60,
          recoveryRating: rating,
          curve: newCurve
        };

        updateRunHeartRate(current.runId, hrrResult);
        setActiveHrrSession(prev => prev ? {
          ...prev,
          elapsedSeconds: 60,
          currentBpm,
          hrr30: finalHrr30,
          hrr60: finalHrr60,
          status: 'completed',
          rating
        } : null);

        setTimeout(() => {
          setActiveHrrSession(prev => prev?.status === 'completed' ? null : prev);
        }, 5000);
      } else {
        setActiveHrrSession(prev => prev ? {
          ...prev,
          elapsedSeconds: nextElapsed,
          currentBpm,
          hrr30: nextHrr30,
          curve: newCurve
        } : null);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeHrrSession?.runId, activeHrrSession?.status]);

  const handleScanCheckIn = (athlete) => {
    // Check if they are already in the queue, remove them from old spot
    const newQueue = queueRef.current.filter(a => a.id !== athlete.id);
    // Put scanned athlete at the FRONT of the queue since they are physically at the gate
    newQueue.unshift(athlete);
    setQueue(newQueue);
    setActiveTab('live'); // Switch to live view so coach can see them

    if (voiceEnabledRef.current) {
      try {
        const utterance = new SpeechSynthesisUtterance(`${athlete.name} checked in`);
        window.speechSynthesis.speak(utterance);
      } catch(e) {}
    }
  };

  // === Global Barcode/QR Scanner Listener ===
  useEffect(() => {
    let barcodeString = '';
    let timeoutId = null;

    const handleKeyDown = (e) => {
      // Don't intercept if user is typing in an input field
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      // Most scanners send 'Enter' at the end of the scan
      if (e.key === 'Enter') {
        if (barcodeString.length > 2) {
          const scanData = barcodeString.trim();
          const matchedAthlete = rosterRef.current.find(a => 
            a.rfidUid === scanData || a.bib === scanData
          );
          
          if (matchedAthlete) {
            handleScanCheckIn(matchedAthlete);
          } else {
            // Not found, populate field and switch to roster tab
            setNewAthlete(prev => ({ ...prev, rfidUid: scanData }));
            setActiveTab('roster');
          }
        }
        barcodeString = '';
        return;
      }

      // Filter out non-printable characters or modifiers (Shift, Ctrl, etc.)
      if (e.key.length === 1) {
        barcodeString += e.key;
        
        // Reset string if typing is too slow (human typing vs scanner)
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          barcodeString = '';
        }, 100); // 100ms timeout between keystrokes for a scanner
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timeoutId);
    };
  }, []);


  const [gateReconnectTrigger, setGateReconnectTrigger] = useState(0);

  const handleManualReconnectGates = useCallback(() => {
    console.info('[TimingGates] User requested manual hardware reconnection.');
    setStatusB(p => ({ ...p, online: false, reconnecting: true, timedOut: false, reconnectAttempts: 0 }));
    setStatusA(p => ({ ...p, online: false, timedOut: false }));
    setGateReconnectTrigger(prev => prev + 1);
  }, []);

  useEffect(() => {
    let ws = null;
    let reconnectTimeout = null;
    let isNodeAPollingActive = true;
    let nodeAPollingTimer = null;
    let connectionTimeoutTimer = null;
    let nodeAOfflineStartTime = Date.now();
    let nodeBOfflineStartTime = Date.now();
    const TIMEOUT_LIMIT_MS = 60000; // 1-minute timeout limit

    // Node A Polling (protocol-aware, mixed-content safe, adaptive backoff)
    let nodeAFailCount = 0;

    const pollNodeA = async () => {
      if (!isNodeAPollingActive) return;
      try {
        let signal;
        if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
          signal = AbortSignal.timeout(2000);
        } else {
          const controller = new AbortController();
          setTimeout(() => controller.abort(), 2000);
          signal = controller.signal;
        }
        const url = getGateHttpUrl(nodeARef.current, '/config');
        if (url) {
          const res = await fetch(url, { signal });
          if (res.ok) {
            nodeAFailCount = 0;
            nodeAOfflineStartTime = null; // Mark online: keeps polling active
            setStatusA({ online: true, timedOut: false });
          } else {
            nodeAFailCount++;
            if (nodeAOfflineStartTime === null) nodeAOfflineStartTime = Date.now();
            setStatusA(p => ({ ...p, online: false }));
          }
        }
      } catch (e) {
        nodeAFailCount++;
        if (nodeAOfflineStartTime === null) nodeAOfflineStartTime = Date.now();
        setStatusA(p => ({ ...p, online: false }));
      } finally {
        if (isNodeAPollingActive) {
          // Poll every 4s when healthy, back off to 10s when offline to conserve traffic without giving up
          const delay = nodeAFailCount > 3 ? 10000 : 4000;
          nodeAPollingTimer = setTimeout(pollNodeA, delay);
        }
      }
    };

    pollNodeA(); // Initial check

    const handleHardwareMessage = (data) => {
      const wasRunning = isRunningRef.current;
      const activeRunnersIncreased = (data.active_runners || 0) > prevActiveRunnersRef.current;
      prevActiveRunnersRef.current = data.active_runners || 0;
      const nodeBBeamJustBroken = (data.ldr_status === 1 && prevLdrStatusRef.current === 0);
      prevLdrStatusRef.current = data.ldr_status || 0;

      setStatusB({ 
        online: true, 
        active_runners: data.active_runners, 
        beam_broken: data.ldr_status === 1
      });
      
      // STRICT HARDWARE RULE: Node A is the ONLY start gate for ANY activity or testing!
      // The timer can NEVER start from Node B in any test under any circumstances!
      const startBeamBroken = (data.active_runners > 0 && activeRunnersIncreased);
      const isMassSprint = testModeRef.current === 'mass_sprint';

      // --- START BEAM BREAK HANDLING ---
      if (startBeamBroken) {
        if (!wasRunning) {
          if (sequenceStateRef.current === 'marks' || sequenceStateRef.current === 'set') {
            // FALSE START! Athlete broke beam before the gun!
            setSequenceState('false_start');
            sequenceStateRef.current = 'false_start';
            setFalseStartReason('Premature Start: Start beam broken before starter horn was fired');
            sendGateCommand(nodeBRef.current, '/reset');
            playFalseStartSound();
            if (voiceEnabledRef.current) {
              speakLocalized('falseStart', {}, audioConfigRef.current);
            }
          } else if (sequenceStateRef.current !== 'false_start' && 
                     sequenceStateRef.current !== 'finished' && 
                     Date.now() > finishLockoutUntilRef.current) {
            // FIRST RUNNER LEGITIMATE START BEAM BREAK!
            let reactionMs = 0;
            if (data.reaction_time && data.reaction_time > 0) {
              reactionMs = data.reaction_time;
            } else if (gunTimeRef.current > 0) {
              reactionMs = Math.round(performance.now() - gunTimeRef.current);
            }

            // World Athletics Technical Rule 16.16 (Anticipated Gun / Illegal Reaction Time < 100ms)
            if (gunTimeRef.current > 0 && reactionMs > 0 && reactionMs < 100) {
              setSequenceState('false_start');
              sequenceStateRef.current = 'false_start';
              setFalseStartReason(`WA Rule 16.16 Violation: Reaction time (${(reactionMs / 1000).toFixed(3)}s) < 0.100s threshold`);
              sendGateCommand(nodeBRef.current, '/reset');
              playFalseStartSound();
              if (voiceEnabledRef.current) {
                speakLocalized('falseStart', {}, audioConfigRef.current);
              }
              return;
            }

            currentRunDataRef.current.reactionTime = reactionMs;

            const now = performance.now();
            lastRunnerStartTimeRef.current = now;

            if (isMassSprint) {
              // Pop first athlete from queue for mass sprint heat
              let newQ = [...queueRef.current];
              let athlete;
              if (newQ.length > 0) {
                athlete = newQ.shift();
                setQueue(newQ);
              } else {
                const c = subjectCounterRef.current++;
                athlete = { name: `Subject ${c}`, bib: `S${c}`, age: 20, gender: 'M' };
              }
              const runner1 = {
                ...athlete,
                runId: Date.now() + Math.random(),
                startTime: now,
                reactionTime: reactionMs,
                splits: []
              };
              setRunnersOnTrack([runner1]);
            }

            // Transition to running state & START TIMER AT THIS EXACT INSTANT!
            setSequenceState('running');
            sequenceStateRef.current = 'running';
            startRecording();
            startTimer();
            console.log(`[SprintGate] Start beam broken! Timer started. Reaction time: ${reactionMs}ms`);
          }
        } else if (isMassSprint && wasRunning && sequenceStateRef.current === 'running') {
          // --- MASS SPRINT TESTING: SUBSEQUENT ATHLETE STARTING IN HEAT ---
          // Minimum debounce between starts: 1.5s to prevent trailing limbs/shadows from double-triggering
          const now = performance.now();
          const elapsedSinceLastStart = (now - lastRunnerStartTimeRef.current) / 1000;
          if (elapsedSinceLastStart >= 1.5) {
            let newQ = [...queueRef.current];
            let nextAthlete;
            if (newQ.length > 0) {
              nextAthlete = newQ.shift();
              setQueue(newQ);
            } else {
              const c = subjectCounterRef.current++;
              nextAthlete = { name: `Subject ${c}`, bib: `S${c}`, age: 20, gender: 'M' };
            }

            lastRunnerStartTimeRef.current = now;
            const nextRunner = {
              ...nextAthlete,
              runId: Date.now() + Math.random(),
              startTime: now,
              reactionTime: 0,
              splits: []
            };

            setRunnersOnTrack(prev => [...prev, nextRunner]);
            playSetSound();
            setBeamFlash(true);
            setTimeout(() => setBeamFlash(false), 200);

            if (voiceEnabledRef.current) {
              try {
                const firstName = nextAthlete.name ? nextAthlete.name.split(' ')[0] : '';
                const utterance = new SpeechSynthesisUtterance(`${firstName} started`);
                window.speechSynthesis.speak(utterance);
              } catch(e) {}
            }
            console.log(`[SprintGate Mass Testing] Next runner on track: ${nextAthlete.name} (Bib ${nextAthlete.bib}) | Launch gap: ${elapsedSinceLastStart.toFixed(1)}s`);
          }
        }
      }
      
      // High-Precision Hardware Microsecond Delta Extraction
      // Eliminates Wi-Fi network transmission latency jitter with sub-millisecond FAT accuracy
      let hardwareDeltaSec = null;
      if (typeof data.micros_delta === 'number' && data.micros_delta > 0) {
        hardwareDeltaSec = data.micros_delta / 1000000;
      } else if (typeof data.finish_us === 'number' && typeof data.start_us === 'number' && data.finish_us > data.start_us) {
        hardwareDeltaSec = (data.finish_us - data.start_us) / 1000000;
      } else if (typeof data.time_us === 'number' && data.time_us > 0) {
        hardwareDeltaSec = data.time_us / 1000000;
      } else if (typeof data.time === 'number' && data.time > 0) {
        hardwareDeltaSec = data.time;
      }

      let splitHardwareDeltaSec = null;
      if (typeof data.split_micros_delta === 'number' && data.split_micros_delta > 0) {
        splitHardwareDeltaSec = data.split_micros_delta / 1000000;
      } else if (typeof data.split_us === 'number' && typeof data.start_us === 'number' && data.split_us > data.start_us) {
        splitHardwareDeltaSec = (data.split_us - data.start_us) / 1000000;
      } else if (typeof data.split_time === 'number' && data.split_time > 0) {
        splitHardwareDeltaSec = data.split_time;
      }

      let isMultiSplitEvent = false;
      let multiSplitTime = 0;

      // For multi-split events, calculate time accurately using local clock to avoid hardware reset issues
      const localCurrentTime = isRunningRef.current ? (performance.now() - startTimeRef.current) / 1000 : 0;

      if (data.new_split === true || data.new_split === "true") {
        const accurateSplit = splitHardwareDeltaSec !== null ? splitHardwareDeltaSec : (localCurrentTime > 0 ? localCurrentTime : (data.split_time || 0));
        if (['shuttle', 'pro_agility', 'l_drill'].includes(testModeRef.current)) {
          if (wasRunning && sequenceStateRef.current !== 'finished') {
            isMultiSplitEvent = true;
            multiSplitTime = accurateSplit;
          }
        } else {
          const lastSplitTime = currentRunDataRef.current.splits.length > 0 
            ? currentRunDataRef.current.splits[currentRunDataRef.current.splits.length - 1].time 
            : 0;
          if (accurateSplit - lastSplitTime > 0.8) {
            const splitObj = { node: data.split_node || 101, time: accurateSplit };
            currentRunDataRef.current.splits.push(splitObj);
            setLiveSplits(prev => [...prev, splitObj]);
          }
        }
      }

      if (data.new_result === true || data.new_result === "true") {
        const accurateResult = hardwareDeltaSec !== null ? hardwareDeltaSec : (localCurrentTime > 0 ? localCurrentTime : (data.time || 0));
        if (['shuttle', 'pro_agility', 'l_drill'].includes(testModeRef.current)) {
          if (wasRunning && sequenceStateRef.current !== 'finished') {
            isMultiSplitEvent = true;
            multiSplitTime = accurateResult;
          }
        } else if (testModeRef.current === 'mass_sprint') {
          // --- MASS SPRINT TESTING FINISH (FIFO) ---
          if (wasRunning || isRunningRef.current) {
            const currentRunners = [...runnersOnTrackRef.current];
            const finishedRunner = currentRunners.length > 0 ? currentRunners.shift() : null;
            setRunnersOnTrack(currentRunners);

            const calculatedTime = finishedRunner ? (performance.now() - finishedRunner.startTime) / 1000 : localCurrentTime;
            const finalTime = hardwareDeltaSec !== null ? hardwareDeltaSec : calculatedTime;

            playFinishSound();
            setLiveSplits(prev => [...prev, { node: 1, time: finalTime, runnerName: finishedRunner?.name || 'Runner' }]);
            processFinish(finalTime.toFixed(3), finishedRunner);

            if (currentRunners.length > 0) {
              // More runners are still on track in this heat!
              // Short finish lockout (500ms) to prevent double trips from same body
              finishLockoutUntilRef.current = Date.now() + 500;
              sequenceStateRef.current = 'running';
              setSequenceState('running');
              console.log(`[SprintGate Mass Testing] ${finishedRunner?.name || 'Runner'} finished in ${finalTime.toFixed(3)}s. Remaining on track: ${currentRunners.length}`);
            } else {
              // Last runner in heat has finished!
              finishLockoutUntilRef.current = Date.now() + 3000;
              stopTimer(finalTime);
              sequenceStateRef.current = 'finished';
              setSequenceState('finished');
              sendGateCommand(nodeBRef.current, '/reset');
              stopRecording();
              setTimeout(() => {
                if (sequenceStateRef.current === 'finished') {
                  sequenceStateRef.current = 'idle';
                  setSequenceState('idle');
                }
              }, 3000);
              console.log(`[SprintGate Mass Testing] Heat complete! All runners finished.`);
            }
          }
        } else {
          if (wasRunning || isRunningRef.current) {
            const finalTime = hardwareDeltaSec !== null ? hardwareDeltaSec : localCurrentTime;
            finishLockoutUntilRef.current = Date.now() + 4000;
            stopTimer(finalTime);
            sequenceStateRef.current = 'finished';
            setSequenceState('finished');
            sendGateCommand(nodeBRef.current, '/reset');
            playFinishSound();
            stopRecording();
            setLiveSplits(prev => [...prev, { node: 1, time: finalTime }]);
            processFinish(finalTime.toFixed(3));
            setTimeout(() => {
              if (sequenceStateRef.current === 'finished') {
                sequenceStateRef.current = 'idle';
                setSequenceState('idle');
              }
            }, 4000);
          }
        }
      }

      // Beam break from Node A (activeRunnersIncreased) or Node B direct beam break while running in agility mode
      if (wasRunning && sequenceStateRef.current !== 'finished' && ['shuttle', 'pro_agility', 'l_drill'].includes(testModeRef.current)) {
        if (activeRunnersIncreased || nodeBBeamJustBroken) {
          isMultiSplitEvent = true;
          multiSplitTime = localCurrentTime;
        }
      }

      if (isMultiSplitEvent && wasRunning && sequenceStateRef.current !== 'finished') {
        const splitsSoFar = currentRunDataRef.current.splits;
        const lastSplitTime = splitsSoFar.length > 0 
          ? splitsSoFar[splitsSoFar.length - 1].time 
          : 0;
        const legDuration = multiSplitTime - lastSplitTime;

        let targetCount = 4;
        let nodeBase = 100;
        let minLegTime = 1.0;
        let legNames = ['10m (Turn 1)', '20m (Turn 2)', '30m (Turn 3)', '40m (Finish)'];

        if (testModeRef.current === 'shuttle') {
          targetCount = 4;
          nodeBase = 100;
          // STRICT PHYSICS RULE: 10m cannot be covered with stop/turn in < 2.0s by any human
          minLegTime = 2.0; 
          legNames = [
            '10m (Turn 1 - Block 1)',
            '20m (Turn 2 - Drop 1)',
            '30m (Turn 3 - Block 2)',
            '40m (Finish Gate)'
          ];
        } else if (testModeRef.current === 'pro_agility') {
          targetCount = 3;
          nodeBase = 200;
          minLegTime = 1.1; // 5 yards minimum ~1.1s
          legNames = ['5yd (Turn 1)', '15yd (Turn 2)', '20yd (Finish)'];
        } else if (testModeRef.current === 'l_drill') {
          targetCount = 3;
          nodeBase = 300;
          minLegTime = 1.5;
          legNames = ['10yd (Turn 1)', '20yd (Turn 2)', '30yd (Finish)'];
        }

        // PHYSICS VALIDATION:
        // Leg 1 must be >= minLegTime from start (multiSplitTime >= minLegTime)
        // Subsequent legs must have legDuration >= minLegTime
        const isValidTrigger = (splitsSoFar.length === 0)
          ? (multiSplitTime >= minLegTime)
          : (legDuration >= minLegTime);

        if (isValidTrigger) {
          const count = splitsSoFar.length + 1;
          const legLabel = legNames[count - 1] || `Leg ${count}`;
          const splitObj = { 
            node: nodeBase + count, 
            leg: count, 
            name: legLabel, 
            time: multiSplitTime,
            splitTime: legDuration 
          };
          currentRunDataRef.current.splits.push(splitObj);
          setLiveSplits(prev => [...prev, splitObj]);

          console.log(`[Agility Drill] Split ${count}/${targetCount} recorded: ${multiSplitTime.toFixed(3)}s (Leg: ${legDuration.toFixed(3)}s)`);

          if (count < targetCount) {
            // Voice callout during the drill: "Turn 1: 2.4s!", "Turn 2: 5.1s!" to push the athlete mid-run
            if (voiceEnabledRef.current) {
              speakSplitCallout(count, multiSplitTime);
            }
          }

          // 4th beam break / FINISH! Clock stops cleanly and stays stopped
          if (count === targetCount) {
            const finalTimeStr = multiSplitTime.toFixed(3);
            
            // 1. Lockout immediately to discard trailing packets or athlete walk-backs
            finishLockoutUntilRef.current = Date.now() + 4000;

            // 2. Stop timer immediately
            stopTimer(multiSplitTime);

            // 3. Mark sequence finished
            sequenceStateRef.current = 'finished';
            setSequenceState('finished');

            // 4. Send reset command to Node B to clear activeRunners
            sendGateCommand(nodeBRef.current, '/reset');

            // 5. Audio feedback
            playFinishSound();

            // 6. Stop video/pose recording
            stopRecording();

            // 7. Save and process the final run result
            processFinish(finalTimeStr);

            // 8. Revert sequence state to idle after cooldown
            setTimeout(() => {
              if (sequenceStateRef.current === 'finished') {
                sequenceStateRef.current = 'idle';
                setSequenceState('idle');
              }
            }, 4000);
          }
        } else {
          console.warn(`[Agility Drill] Ignored false trigger at ${multiSplitTime.toFixed(3)}s (leg duration ${legDuration.toFixed(3)}s < min ${minLegTime}s physics threshold)`);
        }
      }

      if (data.rfid_scan && data.rfid_scan !== "null") {
        const scanUid = data.rfid_scan;
        const matchedAthlete = rosterRef.current.find(a => a.rfidUid === scanUid);
        if (matchedAthlete) {
          handleScanCheckIn(matchedAthlete);
        } else {
          setNewAthlete(prev => ({ ...prev, rfidUid: scanUid }));
          setActiveTab('roster');
        }
      }

      if (data.gun_fired === true || data.gun_fired === "true") {
        if (sequenceStateRef.current !== 'running' && sequenceStateRef.current !== 'finished') {
          gunTimeRef.current = performance.now();
          setSequenceState('waiting_start');
          sequenceStateRef.current = 'waiting_start';
          startRecording();
          // CRITICAL: NEVER call startTimer() here!
          // The running clock stays strictly at 0.00s until the athlete physically breaks the laser beam!
        }
      }
    };
    hardwareEventCallbackRef.current = handleHardwareMessage;

    let wsAttempts = 0;
    let heartbeatTimer = null;
    let lastMessageTimestamp = 0;

    const stopHeartbeat = () => {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
    };

    const startHeartbeat = () => {
      stopHeartbeat();
      lastMessageTimestamp = Date.now();
      heartbeatTimer = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          // Actively send bidirectional keepalive ping to maintain NAT/hotspot connection alive
          try {
            ws.send(JSON.stringify({ type: 'ping', t: Date.now() }));
          } catch (e) {
            console.debug('[GateWebSocket] Keepalive ping error:', e);
          }

          // Only reconnect if truly dead (no incoming message, telemetry, or pong for >25s)
          if (Date.now() - lastMessageTimestamp > 25000) {
            console.warn('[GateWebSocket] Inactive socket detected (no telemetry or pong for >25s). Triggering auto-reconnect...');
            try { ws.close(); } catch (e) {}
          }
        }
      }, 2500);
    };

    const connectWebSocket = () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      stopHeartbeat();

      try {
        const wsUrl = getGateWsUrl(nodeB);
        if (!wsUrl) return;
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        
        ws.onopen = () => {
          wsAttempts = 0;
          nodeBOfflineStartTime = null; // Mark online: keeps connection active
          lastMessageTimestamp = Date.now();
          setStatusB(p => ({ ...p, online: true, reconnecting: false, timedOut: false, reconnectAttempts: 0 }));
          console.info(`[GateWebSocket] Connected to timing gate Node B (${wsUrl})`);
          startHeartbeat();
          // Send initial ping to prompt immediate state telemetry
          try {
            ws.send(JSON.stringify({ type: 'ping', t: Date.now() }));
          } catch (e) {}
        };
        
        ws.onmessage = (event) => {
          lastMessageTimestamp = Date.now();
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'pong' || data.pong) {
              setStatusB(p => (p.online ? p : { ...p, online: true, reconnecting: false, timedOut: false, reconnectAttempts: 0 }));
              return;
            }
            handleHardwareMessage(data);
          } catch (e) {
            if (typeof event.data === 'string' && event.data.includes('pong')) {
              setStatusB(p => (p.online ? p : { ...p, online: true, reconnecting: false, timedOut: false, reconnectAttempts: 0 }));
              return;
            }
            console.error("Error parsing WS data:", e);
          }
        };

        const scheduleReconnect = () => {
          stopHeartbeat();
          wsAttempts++;
          if (nodeBOfflineStartTime === null) {
            nodeBOfflineStartTime = Date.now();
          }
          // Fast bounded retry (1.5s to 4s) so reconnection is responsive when gate is nearby
          const delay = Math.min(4000, 1500 + Math.min(wsAttempts, 5) * 500);
          setStatusB(p => ({ 
            ...p, 
            online: false, 
            reconnecting: true, 
            timedOut: false, 
            reconnectAttempts: wsAttempts 
          }));
          reconnectTimeout = setTimeout(connectWebSocket, delay);
        };
        
        ws.onclose = () => {
          console.warn(`[GateWebSocket] Connection closed. Auto-reconnecting in background (attempt ${wsAttempts + 1})...`);
          scheduleReconnect();
        };
        
        ws.onerror = (err) => {
          console.warn('[GateWebSocket] Socket error observed:', err);
          stopHeartbeat();
          try { ws.close(); } catch (e) {}
        };
      } catch (err) {
        stopHeartbeat();
        wsAttempts++;
        if (nodeBOfflineStartTime === null) {
          nodeBOfflineStartTime = Date.now();
        }
        const delay = Math.min(4000, 1500 + Math.min(wsAttempts, 5) * 500);
        setStatusB(p => ({ ...p, online: false, reconnecting: true, timedOut: false, reconnectAttempts: wsAttempts }));
        reconnectTimeout = setTimeout(connectWebSocket, delay);
      }
    };

    connectWebSocket();

    return () => {
      isNodeAPollingActive = false;
      stopHeartbeat();
      if (connectionTimeoutTimer) clearTimeout(connectionTimeoutTimer);
      if (nodeAPollingTimer) clearTimeout(nodeAPollingTimer);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) {
        ws.onclose = null; // prevent reconnect on unmount
        ws.close();
      }
    };
  }, [nodeB, nodeA, gateReconnectTrigger]);



  const handleCockpitLaunchNextRunner = () => {
    if (!isAdmin) {
      alert("Unauthorized: Only the Master Coach / Admin can launch athletes.");
      return;
    }
    if (sequenceStateRef.current !== 'running') {
      alert("Hit 'Start Sequence' first before releasing athletes!");
      return;
    }
    const now = performance.now();
    let newQ = [...queueRef.current];
    let nextAthlete;
    if (newQ.length > 0) {
      nextAthlete = newQ.shift();
      setQueue(newQ);
    } else {
      const c = subjectCounterRef.current++;
      nextAthlete = { name: `Subject ${c}`, bib: `S${c}`, age: 20, gender: 'M' };
    }

    lastRunnerStartTimeRef.current = now;
    const nextRunner = {
      ...nextAthlete,
      runId: Date.now() + Math.random(),
      startTime: now,
      reactionTime: 0,
      splits: []
    };

    setRunnersOnTrack(prev => [...prev, nextRunner]);
    playSetSound();
    setBeamFlash(true);
    setTimeout(() => setBeamFlash(false), 200);

    if (voiceEnabledRef.current) {
      try {
        const firstName = nextAthlete.name ? nextAthlete.name.split(' ')[0] : '';
        const utterance = new SpeechSynthesisUtterance(`${firstName} started`);
        window.speechSynthesis.speak(utterance);
      } catch(e) {}
    }
  };

  const handleCockpitManualFinishLeadingRunner = () => {
    if (!isAdmin) {
      alert("Unauthorized: Only the Master Coach / Admin can finish runners.");
      return;
    }
    if (!isRunningRef.current || runnersOnTrackRef.current.length === 0) return;
    const currentRunners = [...runnersOnTrackRef.current];
    const finishedRunner = currentRunners.shift();
    setRunnersOnTrack(currentRunners);

    const calculatedTime = Math.max(0.1, (performance.now() - finishedRunner.startTime) / 1000);
    playFinishSound();
    setLiveSplits(prev => [...prev, { node: 1, time: calculatedTime, runnerName: finishedRunner?.name || 'Runner' }]);
    processFinish(calculatedTime.toFixed(3), finishedRunner);

    if (currentRunners.length > 0) {
      finishLockoutUntilRef.current = Date.now() + 500;
      sequenceStateRef.current = 'running';
      setSequenceState('running');
    } else {
      finishLockoutUntilRef.current = Date.now() + 3000;
      stopTimer(calculatedTime);
      sequenceStateRef.current = 'finished';
      setSequenceState('finished');
      sendGateCommand(nodeBRef.current, '/reset');
      stopRecording();
      setTimeout(() => {
        if (sequenceStateRef.current === 'finished') {
          sequenceStateRef.current = 'idle';
          setSequenceState('idle');
        }
      }, 2500);
    }
  };

  const handleFileUpload = (event) => {
    if (!isAdmin) {
      alert("Unauthorized: Only the Master Coach / Admin can import athletes via CSV.");
      return;
    }
    const file = event.target.files[0];
    if (file) {
      Papa.parse(file, {
        header: true,
        complete: (results) => {
          const formatted = results.data.filter(r => r.name).map(r => ({
            name: r.name, bib: r.bib, age: parseInt(r.age) || 20, gender: r.gender || 'M'
          }));
          setQueue(formatted);
        }
      });
    }
  };

  const exportPDF = async () => {
    if (results.length === 0) {
      alert("No results in current session to export to PDF.");
      return;
    }
    try {
      const { jsPDF, autoTable } = await getPdfEngine();
      const doc = new jsPDF();
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, 210, 36, 'F');
      
      // Official Velocity Lab Brand Header Logo
      addVelocityLabLogoToPdf(doc, { x: 14, y: 8, width: 44, isDark: true, colorTheme });
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text("• OFFICIAL LEADERBOARD", 62, 18);
      
      doc.setTextColor(148, 163, 184); // slate-400
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text(`Official Session Rankings • Active Track Distance: ${trackDistance}m • Generated: ${new Date().toLocaleString()}`, 14, 28);
      
      const tableData = [...results].sort((a,b) => parseFloat(a.time) - parseFloat(b.time)).map((r, i) => {
        const dM = parseFloat(r.distanceMeters || r.distance) || parseFloat(trackDistance) || 40;
        const t = parseFloat(r.time);
        const v = r.velocity ? `${parseFloat(r.velocity).toFixed(2)} m/s` : (t > 0 && dM > 0 ? `${(dM / t).toFixed(2)} m/s` : '--');
        const eventLabel = r.distance ? (String(r.distance).toLowerCase().includes('m') ? r.distance : `${r.distance}m Sprint`) : `${dM}m Sprint`;
        const rt = r.reactionTime && parseFloat(r.reactionTime) > 0 ? (parseFloat(r.reactionTime) > 20 ? `${(parseFloat(r.reactionTime)/1000).toFixed(3)}s` : `${parseFloat(r.reactionTime).toFixed(3)}s`) : 'N/A';
        return [
          i + 1,
          r.name,
          r.bib,
          eventLabel,
          `${r.time}s`,
          v,
          rt,
          new Date(r.id || Date.now()).toLocaleTimeString()
        ];
      });

      autoTable(doc, {
        startY: 42,
        head: [['Rank', 'Athlete', 'Bib', 'Event / Discipline', 'Gate Time', 'Velocity', 'Reaction', 'Time of Run']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129], textColor: [0, 0, 0], fontStyle: 'bold' }
      });

      savePdfFile(doc, `VelocityLab_Leaderboard_${trackDistance}m_${new Date().toISOString().slice(0,10)}.pdf`);
    } catch (e) {
      console.error("Leaderboard PDF export error:", e);
      alert(`Failed to export Leaderboard PDF: ${e.message || 'Unknown error'}`);
    }
  };

  const exportCSV = () => {
    if (results.length === 0) return;
    const formattedResults = results.map(r => ({
      ID: r.id || '',
      Athlete: r.name || '',
      Bib: r.bib || '',
      Time_s: r.time || '',
      Distance_m: r.distance || trackDistance || 40,
      Velocity_ms: r.velocity || (r.distance && r.time ? (parseFloat(r.distance)/parseFloat(r.time)).toFixed(2) : ''),
      Reaction_Time_ms: r.reactionTime || '',
      Splits: Array.isArray(r.splits) ? r.splits.map(s => `${s.distance || ''}m:${s.splitTime || s.time || ''}s`).join('; ') : '',
      Wind_Speed_ms: r.windSpeed || '',
      Surface: r.surfaceType || '',
      Date: r.timestamp ? (r.timestamp.seconds ? new Date(r.timestamp.seconds * 1000).toLocaleString() : new Date(r.timestamp).toLocaleString()) : new Date().toLocaleString()
    }));
    const csv = Papa.unparse(formattedResults);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `sprint_results_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };


  const exportSessionPDF = async () => {
    try {
      const { jsPDF, autoTable } = await getPdfEngine();
      const doc = new jsPDF();
      
      // Header
      doc.setFillColor(18, 19, 22); 
      doc.rect(0, 0, 210, 40, 'F');
      
      // Official Velocity Lab Brand Header Logo
      addVelocityLabLogoToPdf(doc, { x: 14, y: 12, width: 48, isDark: true, colorTheme });
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.setFont(undefined, 'normal');
      doc.text("Team Session Summary", 195, 25, { align: 'right' });
      
      // Table
      const athleteRows = (summaryStats && summaryStats.athleteRows) || [];
      const bodyRows = athleteRows.map(row => [
        row.name,
        row.runs,
        row.bestTime ? `${row.bestTime.toFixed(2)}s` : '--',
        row.bestVelocity ? `${row.bestVelocity.toFixed(2)} m/s` : '--'
      ]);

      autoTable(doc, {
        startY: 45,
        head: [['Athlete', 'Total Runs', 'Fastest Time', 'Top Velocity']],
        body: bodyRows,
        theme: 'grid',
        headStyles: { fillColor: [0, 208, 132], textColor: [0, 0, 0], fontStyle: 'bold' },
        bodyStyles: { fontSize: 11 }
      });

      savePdfFile(doc, `Team_Session_Summary_${new Date().toISOString().slice(0,10)}.pdf`);
    } catch (e) {
      console.error("Session PDF export error:", e);
      alert(`Failed to export Team Session PDF: ${e.message || 'Unknown error'}`);
    }
  };

  const exportAthletePDF = async (res) => {
    if (!res) {
      alert("No athlete record selected for PDF generation.");
      return;
    }
    try {
      const { jsPDF, autoTable } = await getPdfEngine();
      const doc = new jsPDF();
      
      // Header
      doc.setFillColor(18, 19, 22); 
      doc.rect(0, 0, 210, 40, 'F');
      
      // Official Velocity Lab Brand Header Logo
      addVelocityLabLogoToPdf(doc, { x: 14, y: 12, width: 48, isDark: true, colorTheme });
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.setFont(undefined, 'normal');
      doc.text("Official Biomechanical Sprint Evaluation", 195, 25, { align: 'right' });
      
      // Athlete Info Card
      doc.setFillColor(245, 245, 245);
      doc.rect(14, 45, 182, 35, 'F');
      
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(20);
      doc.setFont(undefined, 'bold');
      doc.text(((res.name || 'Athlete')).toUpperCase(), 20, 58);
      
      doc.setFontSize(11);
      doc.setTextColor(80, 80, 80);
      doc.setFont(undefined, 'normal');
      doc.text(`Athlete ID: ${res.bib || 'N/A'}   |   Age: ${res.age || 'N/A'}   |   Gender: ${res.gender || 'N/A'}`, 20, 68);
      doc.text(`Date of Evaluation: ${new Date(res.id || Date.now()).toLocaleString()}`, 20, 74);
      
      // Core Metrics Table - DYNAMIC based on actual test distance
      const distNum = parseFloat(res.distanceMeters || res.distance) || parseFloat(trackDistance) || 40;
      const timeNum = parseFloat(res.time) || 1;
      const calcVel = res.velocity ? parseFloat(res.velocity).toFixed(2) : (timeNum > 0 ? (distNum / timeNum).toFixed(2) : '--');
      const distLabel = res.distance ? (String(res.distance).toLowerCase().includes('m') ? res.distance : `${res.distance}m Sprint`) : `${distNum}m Sprint`;

      autoTable(doc, {
        startY: 85,
        head: [['Assessment Event', 'Track Distance', 'Time (s)', 'Velocity (m/s)', 'Reaction Time (s)']],
        body: [[
          distLabel,
          `${distNum}m`, 
          res.time ? `${res.time}s` : '--', 
          `${calcVel} m/s`,
          res.reactionTime && parseFloat(res.reactionTime) > 0 ? (parseFloat(res.reactionTime) > 20 ? `${(parseFloat(res.reactionTime)/1000).toFixed(3)}s` : `${parseFloat(res.reactionTime).toFixed(3)}s`) : 'Not Tested'
        ]],
        theme: 'grid',
        headStyles: { fillColor: [0, 208, 132], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
        bodyStyles: { halign: 'center', fontSize: 13, fontStyle: 'bold' },
        margin: { left: 14, right: 14 }
      });
      
      let currentY = (doc.lastAutoTable?.finalY || 105) + 15;
      
      // Splits
      if (res.splits && res.splits.length > 0) {
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text("Split Times", 14, currentY);
        
        const splitBody = res.splits.map(s => {
          const unit = ['pro_agility', 'l_drill'].includes(res.testType) ? 'yd' : 'm';
          return [
            SPLIT_DISTANCES[s.node] ? `${SPLIT_DISTANCES[s.node]}${unit}` : `Node ${s.node}`,
            `${s.time}s`
          ];
        });
        
        autoTable(doc, {
          startY: currentY + 5,
          head: [['Split Segment', 'Elapsed Time']],
          body: splitBody,
          theme: 'striped',
          headStyles: { fillColor: [50, 50, 50], textColor: [255, 255, 255] },
          margin: { left: 14, right: 14 }
        });
        currentY = (doc.lastAutoTable?.finalY || currentY + 30) + 15;
      }

      // Agility & Turn Biomechanics Evaluation (Shuttle 4x10m, Pro Agility)
      const agility = res.agilityAnalytics || (res.splits && res.splits.length >= 3 ? calculateAgilityMetrics(res.splits, res.testType) : null);
      if (agility && agility.testType === 'shuttle') {
        if (currentY > 200) { doc.addPage(); currentY = 20; }
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text("Agility & Turn Biomechanics Evaluation (4x10m Shuttle)", 14, currentY);
        
        autoTable(doc, {
          startY: currentY + 5,
          head: [['Pivot / Turn', 'Deceleration (s)', 'Re-acceleration (s)', 'Total Turn Time', 'Focus Zone']],
          body: [
            ['Turn 1 (10m Line)', `${agility.turn1.decel} s`, `${agility.turn1.reaccel} s`, `${agility.turn1.total} s`, 'Block Pick 1'],
            ['Turn 2 (Start Line)', `${agility.turn2.decel} s`, `${agility.turn2.reaccel} s`, `${agility.turn2.total} s`, 'Block Drop 1'],
            ['Turn 3 (10m Line)', `${agility.turn3.decel} s`, `${agility.turn3.reaccel} s`, `${agility.turn3.total} s`, 'Block Pick 2'],
          ],
          theme: 'grid',
          headStyles: { fillColor: [0, 208, 132], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
          bodyStyles: { halign: 'center' },
          margin: { left: 14, right: 14 }
        });
        currentY = (doc.lastAutoTable?.finalY || currentY + 30) + 10;

        autoTable(doc, {
          startY: currentY,
          head: [['Lateral Symmetry Index (LSI)', 'Turn Overhead Penalty', 'COD Deficit', 'Fatigue Decay Rate']],
          body: [[
            `${agility.symmetryRatio}% (${agility.lateralBalanceRating})`,
            `+${agility.turnOverhead} s / turn`,
            `+${agility.codDeficit} s`,
            `${agility.fatigueDecayPct}%`
          ]],
          theme: 'grid',
          headStyles: { fillColor: [50, 50, 50], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
          bodyStyles: { halign: 'center', fontStyle: 'bold' },
          margin: { left: 14, right: 14 }
        });
        currentY = (doc.lastAutoTable?.finalY || currentY + 30) + 15;
      }

      if (res.testType === 'rsa') {
        const athleteRsaRuns = results.filter(r => r.name === res.name && r.testType === 'rsa');
        if (athleteRsaRuns.length > 1) {
          const times = athleteRsaRuns.map(r => parseFloat(r.time));
          const bestTime = Math.min(...times);
          const worstTime = Math.max(...times);
          const fatigueIndex = (((worstTime - bestTime) * (1 / bestTime)) * 100).toFixed(1);
          
          if (currentY > 230) { doc.addPage(); currentY = 20; }
          doc.setFontSize(14);
          doc.setFont(undefined, 'bold');
          doc.text("Repeated Sprint Ability (RSA) Analysis", 14, currentY);
          
          autoTable(doc, {
            startY: currentY + 5,
            head: [['Total Sprints', 'Best Time', 'Worst Time', 'Fatigue Index']],
            body: [[
              athleteRsaRuns.length,
              `${bestTime.toFixed(3)} s`,
              `${worstTime.toFixed(3)} s`,
              `${fatigueIndex} %`
            ]],
            theme: 'grid',
            headStyles: { fillColor: [50, 50, 50], textColor: [255, 255, 255] },
            bodyStyles: { halign: 'center', fontSize: 12, fontStyle: 'bold' },
            margin: { left: 14, right: 14 }
          });
          currentY = (doc.lastAutoTable?.finalY || currentY + 30) + 15;
        }
      }

      // Kinematics (if available)
      if (res.strideLength || res.groundContactTime || res.flightTime || res.avgTrunkLean || res.avgShinAngle || res.cadenceSpm) {
        if (currentY > 230) { doc.addPage(); currentY = 20; }
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text("AI Kinematic Analysis", 14, currentY);
        
        autoTable(doc, {
          startY: currentY + 5,
          head: [['Stride Length', 'GCT', 'Flight Time', 'Trunk Lean', 'Shin Angle', 'Cadence']],
          body: [[
            res.strideLength ? `${res.strideLength} m` : 'N/A',
            res.groundContactTime ? `${res.groundContactTime} s` : 'N/A',
            res.flightTime ? `${res.flightTime} s` : 'N/A',
            res.avgTrunkLean ? `${res.avgTrunkLean}°` : 'N/A',
            res.avgShinAngle ? `${res.avgShinAngle}°` : 'N/A',
            res.cadenceSpm ? `${res.cadenceSpm} SPM` : 'N/A'
          ]],
          theme: 'grid',
          headStyles: { fillColor: [50, 50, 50], textColor: [255, 255, 255] },
          bodyStyles: { halign: 'center' },
          margin: { left: 14, right: 14 }
        });
        currentY = (doc.lastAutoTable?.finalY || currentY + 30) + 15;
      }

      // --- Performance Spider/Radar Chart ---
      if (currentY > 170) { doc.addPage(); currentY = 20; }
      
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text("Performance Spider Chart", 14, currentY);
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.setFont(undefined, 'normal');
      doc.text(`Comparing against Collegiate / Elite Benchmark for ${distNum}m track distance`, 14, currentY + 6);
      
      // Calculate normalized scores (0-100) strictly from real test data
      const v = parseFloat(calcVel);
      const topSpeedScore = v > 0 ? Math.min(100, Math.max(20, Math.round((v / 10.5) * 100))) : null; // Elite ~10.5 m/s
      
      // Expected elite time for distance distNum:
      const expectedElite = (distNum / 11.0) + 1.2 * (1 - Math.exp(-distNum / (11.0 * 1.2)));
      const accelScore = timeNum > 0 ? Math.min(100, Math.max(20, Math.round((expectedElite / timeNum) * 90))) : null;
      
      const rtScore = res.reactionTime && parseFloat(res.reactionTime) > 0 
        ? Math.max(20, Math.min(100, Math.round(100 - (((parseFloat(res.reactionTime) > 20 ? parseFloat(res.reactionTime) : parseFloat(res.reactionTime)*1000) - 150) / 250) * 100))) 
        : null;
        
      const kinScore = res.jumpHeight 
        ? Math.min(100, Math.round((parseFloat(res.jumpHeight) / 40) * 100)) 
        : (res.strideLength ? Math.min(100, Math.round((parseFloat(res.strideLength) / 2.2) * 100)) : null);

      const athleteScores = [
        topSpeedScore !== null ? topSpeedScore : 0, 
        accelScore !== null ? accelScore : 0, 
        rtScore !== null ? rtScore : 0, 
        kinScore !== null ? kinScore : 0
      ];
      const eliteScores = [95, 90, 95, 90];
      const labels = [
        `Top Speed (${topSpeedScore !== null ? `${topSpeedScore}` : 'N/T'})`, 
        `Accel (${accelScore !== null ? `${accelScore}` : 'N/T'})`, 
        `Reaction (${rtScore !== null ? `${rtScore}` : 'N/T'})`, 
        `Kinematics (${kinScore !== null ? `${kinScore}` : 'N/T'})`
      ];
      
      const drawRadarChart = (doc, cx, cy, radius, athleteScores, eliteScores, labels) => {
        const numAxes = labels.length;
        const angleStep = (Math.PI * 2) / numAxes;
        
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.5);
        [0.2, 0.4, 0.6, 0.8, 1.0].forEach(scale => {
          const r = radius * scale;
          const pts = [];
          for(let i=0; i<numAxes; i++) {
            const a = i * angleStep - Math.PI/2;
            pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
          }
          for(let i=0; i<numAxes; i++) {
            const next = (i+1)%numAxes;
            doc.line(pts[i][0], pts[i][1], pts[next][0], pts[next][1]);
          }
        });

        for(let i=0; i<numAxes; i++) {
          const a = i * angleStep - Math.PI/2;
          doc.line(cx, cy, cx + radius * Math.cos(a), cy + radius * Math.sin(a));
          doc.setFontSize(9);
          doc.setTextColor(100, 100, 100);
          const lx = cx + (radius + 15) * Math.cos(a);
          const ly = cy + (radius + 15) * Math.sin(a);
          doc.text(labels[i], lx, ly, { align: 'center', baseline: 'middle' });
        }

        const elitePts = [];
        for(let i=0; i<numAxes; i++) {
          const a = i * angleStep - Math.PI/2;
          const r = radius * (eliteScores[i] / 100);
          elitePts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
        }
        doc.setDrawColor(200, 50, 50);
        doc.setLineWidth(1);
        for(let i=0; i<numAxes; i++) {
          const next = (i+1)%numAxes;
          doc.line(elitePts[i][0], elitePts[i][1], elitePts[next][0], elitePts[next][1]);
        }

        const athPts = [];
        for(let i=0; i<numAxes; i++) {
          const a = i * angleStep - Math.PI/2;
          const r = radius * (athleteScores[i] / 100);
          athPts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
        }
        doc.setDrawColor(0, 208, 132);
        doc.setLineWidth(1.5);
        for(let i=0; i<numAxes; i++) {
          const next = (i+1)%numAxes;
          doc.line(athPts[i][0], athPts[i][1], athPts[next][0], athPts[next][1]);
        }
        
        doc.setFillColor(0, 208, 132);
        for(let i=0; i<numAxes; i++) {
          doc.circle(athPts[i][0], athPts[i][1], 1.5, 'F');
        }
      };
      
      const chartCenterY = currentY + 45;
      drawRadarChart(doc, 105, chartCenterY, 30, athleteScores, eliteScores, labels);
      
      // Legend
      doc.setDrawColor(0, 208, 132);
      doc.setFillColor(0, 208, 132);
      doc.rect(14, chartCenterY + 45, 4, 4, 'F');
      doc.setTextColor(0, 0, 0);
      doc.text("Athlete Profile", 20, chartCenterY + 48);
      
      doc.setDrawColor(200, 50, 50);
      doc.setFillColor(200, 50, 50);
      doc.rect(70, chartCenterY + 45, 4, 4, 'F');
      doc.text("Elite Benchmark", 76, chartCenterY + 48);
      
      currentY = chartCenterY + 55;

      // Expert Analysis
      if (currentY > 200) { doc.addPage(); currentY = 20; }
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text("Expert Performance Analysis", 14, currentY);
      
      doc.setFontSize(11);
      doc.setFont(undefined, 'normal');
      currentY += 8;
      
      // Conditions
      doc.text(`Track Conditions: ${res.windSpeed ? res.windSpeed + 'm/s ' : ''}${res.surfaceType || 'Standard Track'}`, 14, currentY);
      currentY += 8;

      const printPaginatedText = (title, textContent, startY) => {
        let y = startY;
        if (y > 270) { doc.addPage(); y = 20; }
        doc.setFont(undefined, 'bold');
        doc.text(title, 14, y);
        doc.setFont(undefined, 'normal');
        
        const lines = doc.splitTextToSize(textContent || 'N/A', 140);
        let lineIndex = 0;
        
        // Print first line on same Y as title
        doc.text(lines[0] || 'N/A', 45, y);
        lineIndex++;
        
        // Print rest of lines
        while (lineIndex < lines.length) {
          y += 5.5;
          if (y > 280) {
            doc.addPage();
            y = 20;
          }
          doc.text(lines[lineIndex] || '', 45, y);
          lineIndex++;
        }
        return y + 4;
      };

      currentY = printPaginatedText("Classification:", res.standing, currentY);
      currentY = printPaginatedText("F.I.T.T. Profile:", res.fitt, currentY);
      currentY = printPaginatedText("Sport Match:", res.sport, currentY);
      currentY = printPaginatedText("Training Focus:", res.focus, currentY);
      
      // Verification Hash / Footer
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Report ID: VEL-${Date.now().toString(16).toUpperCase()}-${res.bib || 'UNK'}`, 14, 290);
        doc.text(`Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
        doc.text("Generated by Velocity Lab - Automated Timing & Assessment System", 195, 290, { align: 'right' });
      }
      
      savePdfFile(doc, `${(res.name || 'Athlete').replace(/\s+/g, '_')}_Evaluation.pdf`);
    } catch (e) {
      console.error("Athlete PDF generation failed:", e);
      alert(`Failed to generate Athlete Evaluation PDF: ${e.message || 'Unknown error'}`);
    }
  };

  const shareResultWhatsApp = (res) => {
    if (!res) return;
    const athlete = (roster || []).find(a => (a.name || '').toLowerCase() === (res.name || '').toLowerCase());
    let rawPhone = athlete?.whatsapp || athlete?.phone || '';
    let phone = rawPhone ? rawPhone.replace(/[^0-9]/g, '') : '';
    if (!phone) {
      const entered = window.prompt(`WhatsApp number not found for ${res.name || 'Athlete'}.\nEnter phone number with country code (e.g. 919876543210):`, '');
      if (entered) phone = entered.replace(/[^0-9]/g, '');
    }
    const dateStr = res.serverTime ? new Date(res.serverTime.seconds * 1000).toLocaleDateString() : new Date().toLocaleDateString();
    const testTitle = res.testType === 'shuttle' ? '4x10m Shuttle Agility' : res.testType === 'pro_agility' ? '5-10-5 Pro Agility' : res.testType === 'vertical_jump' ? 'Vertical Jump Power' : `${res.distance || 40}m Sprint`;

    let text = `⚡ *VELOCITY LAB - ATHLETE EVALUATION REPORT*\n`;
    text += `👤 *Athlete:* ${res.name || 'Athlete'}\n`;
    text += `🎯 *Event:* ${testTitle}\n`;
    text += `⏱️ *Official Result:* *${res.time}s* ${res.personalBest ? '🔥 NEW PR!' : ''}\n`;
    if (res.reactionTime) {
      const rtSec = parseFloat(res.reactionTime) > 20 ? (parseFloat(res.reactionTime) / 1000).toFixed(3) : parseFloat(res.reactionTime).toFixed(3);
      text += `⚡ *Reaction Time:* ${rtSec}s\n`;
    }
    if (res.topVelocity) text += `💨 *Top Velocity:* ${res.topVelocity} m/s\n`;
    if (res.splits && res.splits.length > 0) {
      text += `📊 *Gate Splits:* ${res.splits.map((s, idx) => `G${idx+1}: ${s.time || s}s`).join(' | ')}\n`;
    }
    if (res.agilityAnalytics) {
      text += `🔄 *Lateral Symmetry Index:* ${res.agilityAnalytics.symmetryRatio}%\n`;
      text += `⏱️ *Turn Overhead:* +${res.agilityAnalytics.turnOverhead}s\n`;
      text += `⚡ *COD Deficit:* +${res.agilityAnalytics.codDeficit}s\n`;
    }
    text += `📅 *Date:* ${dateStr}\n`;
    text += `\n🏟️ Verified by SprintGate Precision Timing System`;

    const waUrl = phone 
      ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  };

  const shareResultEmail = (res) => {
    if (!res) return;
    const athlete = (roster || []).find(a => (a.name || '').toLowerCase() === (res.name || '').toLowerCase());
    let email = (athlete?.email || '').trim();
    if (!email) {
      const entered = window.prompt(`Email ID not found for ${res.name || 'Athlete'}.\nEnter recipient email address:`, '');
      if (entered) email = entered.trim();
    }
    const testTitle = res.testType === 'shuttle' ? '4x10m Shuttle Agility' : res.testType === 'pro_agility' ? '5-10-5 Pro Agility' : res.testType === 'vertical_jump' ? 'Vertical Jump Power' : `${res.distance || 40}m Sprint`;

    const subject = `Velocity Lab Athletic Report - ${res.name || 'Athlete'} (${testTitle})`;
    let body = `Hi ${res.name || 'Athlete'},\n\n`;
    body += `Here is your official evaluation from today's Velocity Lab timing session:\n\n`;
    body += `Event: ${testTitle}\n`;
    body += `Official Result: ${res.time}s ${res.personalBest ? '(NEW PERSONAL RECORD!)' : ''}\n`;
    if (res.reactionTime) {
      const rtSec = parseFloat(res.reactionTime) > 20 ? (parseFloat(res.reactionTime) / 1000).toFixed(3) : parseFloat(res.reactionTime).toFixed(3);
      body += `Reaction Time: ${rtSec}s\n`;
    }
    if (res.topVelocity) body += `Top Velocity: ${res.topVelocity} m/s\n`;
    if (res.splits && res.splits.length > 0) {
      body += `Gate Splits: ${res.splits.map((s, idx) => `G${idx+1}: ${s.time || s}s`).join(' | ')}\n`;
    }
    if (res.agilityAnalytics) {
      body += `Lateral Symmetry Index (LSI): ${res.agilityAnalytics.symmetryRatio}%\n`;
      body += `Turn Overhead: +${res.agilityAnalytics.turnOverhead}s\n`;
      body += `Change of Direction Deficit: +${res.agilityAnalytics.codDeficit}s\n`;
    }
    body += `\nKeep pushing for greater speed and acceleration!\n\nBest regards,\nVelocity Lab Coaching Staff`;

    const mailtoUrl = email 
      ? `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
      : `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
  };

  const handleAddAthlete = async (e) => {
    e.preventDefault();
    if (!isAdmin) {
      alert("Unauthorized: Only the Master Coach / Admin can add or edit athletes.");
      return;
    }
    if (!newAthlete.name || !newAthlete.bib) return;
    
    if (editingAthleteId) {
      const updatedAthlete = { 
        ...newAthlete, 
        id: editingAthleteId,
        phone: newAthlete.whatsapp || ''
      };
      setRoster(roster.map(a => a.id === editingAthleteId ? updatedAthlete : a));
      setEditingAthleteId(null);
      setNewAthlete({ name: '', bib: '', age: '', gender: 'M', sport: '', weight: '', height: '', rfidUid: '', whatsapp: '', email: '' });
      
      if (user) {
        try {
          await setDoc(doc(db, "athletes", editingAthleteId.toString()), updatedAthlete);
        } catch (err) {
          console.error("Failed to update athlete in Firebase:", err);
        }
      }
    } else {
      const athleteToSave = { 
        ...newAthlete, 
        id: Date.now(),
        phone: newAthlete.whatsapp || ''
      };
      setRoster([...roster, athleteToSave]);
      setNewAthlete({ name: '', bib: '', age: '', gender: 'M', sport: '', weight: '', height: '', rfidUid: '', whatsapp: '', email: '' });
      
      if (user) {
        try {
          await setDoc(doc(db, "athletes", athleteToSave.id.toString()), athleteToSave);
        } catch (err) {
          console.error("Failed to sync athlete to Firebase:", err);
        }
      }
    }
  };

  const handleEditAthlete = (athlete) => {
    if (!isAdmin) {
      alert("Unauthorized: Only the Master Coach / Admin can edit athlete profiles.");
      return;
    }
    setNewAthlete({
      name: athlete.name || '',
      bib: athlete.bib || '',
      age: athlete.age || '',
      gender: athlete.gender || 'M',
      sport: athlete.sport || '',
      weight: athlete.weight || '',
      height: athlete.height || '',
      rfidUid: athlete.rfidUid || '',
      whatsapp: athlete.whatsapp || athlete.phone || '',
      email: athlete.email || ''
    });
    setEditingAthleteId(athlete.id);
  };

  const removeAthlete = async (idOrAthlete) => {
    if (!isAdmin) {
      alert("Unauthorized: Only the Master Coach / Admin can remove athletes.");
      return;
    }
    const athlete = typeof idOrAthlete === 'object' && idOrAthlete !== null
      ? idOrAthlete 
      : (roster || []).find(a => a.id === idOrAthlete || a.firebaseId === idOrAthlete);
    const targetId = athlete?.id || (typeof idOrAthlete !== 'object' ? idOrAthlete : null);
    const firebaseId = athlete?.firebaseId || targetId?.toString();

    setRoster(prev => prev.filter(a => a.id !== targetId && a.firebaseId !== firebaseId));
    setSelectedRosterIds(prev => prev.filter(id => id !== targetId && id !== firebaseId));
    
    if (user && (firebaseId || targetId)) {
      try {
        if (firebaseId) {
          await deleteDoc(doc(db, "athletes", firebaseId.toString()));
        }
        if (targetId && targetId.toString() !== firebaseId?.toString()) {
          await deleteDoc(doc(db, "athletes", targetId.toString()));
        }
      } catch (err) {
        console.error("Failed to delete athlete from Firebase:", err);
      }
    }
  };

  const deleteSelectedAthletes = async (passedIds) => {
    if (!isAdmin) {
      alert("Unauthorized: Only the Master Coach / Admin can delete athletes.");
      return;
    }
    const idsToDelete = (passedIds && Array.isArray(passedIds) && passedIds.length > 0)
      ? passedIds
      : selectedRosterIds;

    if (!idsToDelete || idsToDelete.length === 0) {
      alert("No athletes selected. Please select at least one athlete to delete.");
      return;
    }
    const athletesToDelete = (roster || []).filter(a => idsToDelete.includes(a.id) || idsToDelete.includes(a.firebaseId));
    setRoster(prev => prev.filter(a => !idsToDelete.includes(a.id) && !idsToDelete.includes(a.firebaseId)));
    setSelectedRosterIds(prev => prev.filter(id => !idsToDelete.includes(id)));

    if (user && athletesToDelete.length > 0) {
      try {
        await Promise.all(athletesToDelete.map(async (ath) => {
          if (ath.firebaseId) {
            await deleteDoc(doc(db, "athletes", ath.firebaseId.toString()));
          }
          if (ath.id && ath.id.toString() !== ath.firebaseId?.toString()) {
            await deleteDoc(doc(db, "athletes", ath.id.toString()));
          }
        }));
      } catch (err) {
        console.error("Failed to delete athletes from Firebase:", err);
      }
    }
  };

  const clearAllRosterAthletes = async () => {
    if (!isAdmin) {
      alert("Unauthorized: Only the Master Coach / Admin can clear the roster.");
      return;
    }
    setRoster([]);
    setSelectedRosterIds([]);
    try {
      localStorage.setItem('sprintgate_roster', JSON.stringify([]));
    } catch (e) {}

    if (user) {
      try {
        const snap = await getDocs(collection(db, "athletes"));
        await Promise.all(snap.docs.map(d => deleteDoc(doc(db, "athletes", d.id))));
      } catch (err) {
        console.error("Failed to clear athletes in Firebase:", err);
      }
    }
  };

  const saveAthleteFromPortal = async (athleteData, isEdit, editId) => {
    if (!isAdmin) {
      alert("Unauthorized: Only the Master Coach / Admin can modify athlete profiles.");
      return;
    }
    if (isEdit && editId) {
      const existing = (roster || []).find(a => a.id === editId || a.firebaseId === editId);
      const updated = {
        ...(existing || {}),
        ...athleteData,
        id: editId,
        firebaseId: existing?.firebaseId || editId.toString()
      };
      setRoster(prev => prev.map(a => (a.id === editId || a.firebaseId === editId) ? updated : a));
      if (user) {
        try {
          const docId = existing?.firebaseId || editId.toString();
          await setDoc(doc(db, "athletes", docId), updated);
        } catch (err) {
          console.error("Failed to update athlete in Firebase:", err);
        }
      }
    } else {
      const newId = Date.now();
      const newEntry = {
        ...athleteData,
        id: newId,
        firebaseId: newId.toString()
      };
      setRoster(prev => [...prev, newEntry]);
      if (user) {
        try {
          await setDoc(doc(db, "athletes", newId.toString()), newEntry);
        } catch (err) {
          console.error("Failed to sync new athlete to Firebase:", err);
        }
      }
    }
  };

  const handleRosterCsvUpload = (event) => {
    if (!isAdmin) {
      alert("Unauthorized: Only the Master Coach / Admin can import roster athletes via CSV.");
      return;
    }
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (header) => (header || '').trim(),
      complete: async (results) => {
        if (!results.data || results.data.length === 0) {
          alert("The uploaded CSV file is empty or formatted incorrectly.");
          return;
        }

        const baseTimestamp = Date.now();
        const imported = [];

        // Helper to normalize any header string by stripping UTF-8 BOM, symbols, punctuation, spaces
        const cleanHeader = (h) => {
          if (!h) return '';
          return String(h)
            .replace(/^\uFEFF/, '') // Strip UTF-8 Byte Order Mark
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]/g, ''); // Strip spaces, hyphens, parens, slashes, punctuation
        };

        results.data.forEach((row, idx) => {
          if (!row || typeof row !== 'object') return;

          // Check if row has any non-empty data
          const hasData = Object.values(row).some(v => v !== null && v !== undefined && String(v).trim() !== '');
          if (!hasData) return;

          // Build clean list of entries for this row
          const entries = Object.entries(row)
            .filter(([k]) => k !== undefined && k !== null)
            .map(([origKey, rawVal]) => ({
              origKey,
              cleanKey: cleanHeader(origKey),
              val: (rawVal !== undefined && rawVal !== null) ? String(rawVal).replace(/^['"]|['"]$/g, '').trim() : ''
            }));

          // Helper to find first matching value by predicate
          const findValue = (predicate) => {
            for (const entry of entries) {
              if (predicate(entry.cleanKey, entry.origKey) && entry.val) {
                return entry.val;
              }
            }
            return '';
          };

          // 1. Full Name
          let name = findValue((ck) => {
            if (ck === 'fullname' || ck === 'name' || ck === 'athletename' || ck === 'nameofathlete' || ck === 'candidatename' || ck === 'studentname' || ck === 'playername' || ck === 'player') return true;
            return ck.includes('name') && !ck.includes('school') && !ck.includes('club') && !ck.includes('team') && !ck.includes('parent') && !ck.includes('file') && !ck.includes('user');
          });

          // Check if first name and last name are in separate columns
          if (!name) {
            const firstName = findValue((ck) => ck === 'firstname' || ck === 'fname' || ck.includes('firstname'));
            const lastName = findValue((ck) => ck === 'lastname' || ck === 'lname' || ck === 'surname' || ck.includes('lastname'));
            if (firstName || lastName) {
              name = `${firstName} ${lastName}`.trim();
            }
          }

          // If no athlete name can be identified, skip this invalid row
          if (!name) return;

          // 2. Athlete ID / Bib
          let bib = findValue((ck) => {
            return (
              ck === 'bib' ||
              ck === 'id' ||
              ck === 'athleteid' ||
              ck === 'athleteidbib' ||
              ck === 'bibno' ||
              ck === 'bibnumber' ||
              ck === 'chestno' ||
              ck === 'chestnumber' ||
              ck === 'rollno' ||
              ck === 'rollnumber' ||
              ck === 'regno' ||
              ck === 'registrationno' ||
              ck === 'bibid' ||
              ck.includes('bib') ||
              (ck.includes('athlete') && ck.includes('id')) ||
              ck.includes('chest')
            );
          });
          if (!bib) {
            bib = `A${roster.length + imported.length + 1}`;
          }

          // 3. Age
          const ageStr = findValue((ck) => {
            return ck === 'age' || ck === 'athleteage' || ck === 'ageoptional' || ck === 'years' || (ck.startsWith('age') && !ck.includes('category'));
          });
          const age = parseInt(ageStr) || 20;

          // 4. Gender
          let genderStr = findValue((ck) => ck.includes('gender') || ck.includes('sex')).toUpperCase();
          let gender = 'M';
          if (genderStr.startsWith('F') || genderStr.startsWith('W') || genderStr === 'GIRL' || genderStr === 'FEMALE') {
            gender = 'F';
          } else {
            gender = 'M';
          }

          // 5. Sport
          const sport = findValue((ck) => {
            return ck.includes('sport') || ck.includes('discipline') || ck.includes('game') || (ck.includes('event') && !ck.includes('date'));
          });

          // 6. Body Weight (kg)
          const weight = findValue((ck) => {
            return ck.includes('weight') || ck.includes('bodyweight') || ck === 'wt' || ck === 'wtkg';
          });

          // 7. Height (cm)
          const height = findValue((ck) => {
            return ck.includes('height') || ck.includes('bodyheight') || ck === 'ht' || ck === 'htcm' || ck.includes('stature');
          });

          // 8. RFID Tag / Barcode
          const rfidUid = findValue((ck) => {
            return ck.includes('rfid') || ck.includes('barcode') || ck.includes('nfc') || ck.includes('chiptag') || ck === 'tag' || ck === 'uid';
          });

          // 9. Mobile / WhatsApp Number (supports 'WhatsApp Number', 'Mobile No.', 'Phone', 'Contact Number', 'Cell', etc.)
          let whatsapp = findValue((ck) => {
            return (
              ck.includes('whatsapp') ||
              ck.includes('mobile') ||
              ck.includes('phone') ||
              ck.includes('contact') ||
              ck.includes('cell') ||
              ck.includes('tel') ||
              ck === 'wa' ||
              ck === 'mob' ||
              ck === 'ph'
            );
          });

          // 10. Email ID (supports 'Email ID', 'Email Address', 'E-mail', 'Mail', etc.)
          let email = findValue((ck) => {
            return (
              ck.includes('email') ||
              ck.includes('mail') ||
              ck.includes('gmail')
            );
          });

          // --- CONTENT-BASED FALLBACK DETECTION ---
          // A. Email Content Fallback: scan every column if header wasn't matched
          if (!email) {
            for (const entry of entries) {
              if (entry.val && /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(entry.val)) {
                const match = entry.val.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
                if (match) {
                  email = match[0].trim();
                  break;
                }
              }
            }
          }

          // B. Phone / Mobile Content Fallback: scan remaining columns if header wasn't matched
          if (!whatsapp) {
            for (const entry of entries) {
              const val = entry.val;
              if (!val || val.includes('@')) continue;
              // Strip formatting to inspect digit count
              const digitsOnly = val.replace(/[^0-9]/g, '');
              // Standard phone numbers contain 8 to 15 digits (e.g. +91 9876543210, 9876543210)
              if (digitsOnly.length >= 8 && digitsOnly.length <= 15) {
                // Ensure it does not collide with Bib, Age, Weight, Height or dates
                if (
                  val !== bib && 
                  val !== String(age) && 
                  val !== String(weight) && 
                  val !== String(height) && 
                  !val.includes('-20') && 
                  !val.includes('/20')
                ) {
                  whatsapp = val;
                  break;
                }
              }
            }
          }

          // 11. Squad / Team / Group
          let squad = findValue((ck) => {
            return (
              ck.includes('squad') ||
              ck.includes('team') ||
              ck.includes('group') ||
              ck.includes('segment')
            );
          }) || 'Varsity Track';

          const cleanPhone = (whatsapp || '').trim();
          const cleanEmail = (email || '').trim();

          imported.push({
            id: baseTimestamp + idx + Math.floor(Math.random() * 1000),
            name,
            bib,
            squad,
            age,
            gender,
            sport,
            weight,
            height,
            rfidUid,
            whatsapp: cleanPhone,
            phone: cleanPhone,
            email: cleanEmail
          });
        });

        if (imported.length === 0) {
          alert("No valid athletes found in the CSV. Please ensure your file includes at least a 'Name' column.");
          return;
        }

        let addedCount = 0;
        let updatedCount = 0;

        setRoster(prev => {
          const updated = [...prev];

          imported.forEach(newAth => {
            // Find existing athlete by matching bib or name
            const existingIdx = updated.findIndex(a => 
              (newAth.bib && a.bib && String(a.bib).trim().toLowerCase() === String(newAth.bib).trim().toLowerCase()) ||
              (newAth.name && a.name && a.name.trim().toLowerCase() === newAth.name.trim().toLowerCase())
            );

            if (existingIdx !== -1) {
              const existing = updated[existingIdx];
              updated[existingIdx] = {
                ...existing,
                ...newAth,
                id: existing.id, // Preserve original unique ID
                squad: newAth.squad || existing.squad || 'Varsity Track',
                whatsapp: newAth.whatsapp || existing.whatsapp || existing.phone || '',
                phone: newAth.phone || existing.phone || existing.whatsapp || '',
                email: newAth.email || existing.email || '',
                sport: newAth.sport || existing.sport || '',
                weight: newAth.weight || existing.weight || '',
                height: newAth.height || existing.height || '',
                rfidUid: newAth.rfidUid || existing.rfidUid || ''
              };
              updatedCount++;
            } else {
              updated.push(newAth);
              addedCount++;
            }
          });

          return updated;
        });

        if (user) {
          try {
            await Promise.all(imported.map(a => {
              const existing = roster.find(r => 
                (a.bib && r.bib && String(r.bib).trim().toLowerCase() === String(a.bib).trim().toLowerCase()) ||
                (a.name && r.name && r.name.trim().toLowerCase() === a.name.trim().toLowerCase())
              );
              const athleteToSave = existing ? { ...existing, ...a, id: existing.id } : a;
              return setDoc(doc(db, "athletes", athleteToSave.id.toString()), athleteToSave);
            }));
          } catch (syncErr) {
            console.error("Failed to sync imported athletes to Firebase:", syncErr);
          }
        }

        const summaryMsg = updatedCount > 0 && addedCount > 0
          ? `Successfully processed ${imported.length} athlete(s): ${addedCount} added, ${updatedCount} updated with Mobile & Email!`
          : updatedCount > 0
          ? `Successfully updated ${updatedCount} existing athlete(s) with Mobile & Email contact details!`
          : `Successfully imported ${addedCount} athlete(s) into the squad roster!`;

        alert(summaryMsg);
        if (event.target) event.target.value = '';
      },
      error: (parseErr) => {
        console.error("CSV parsing error:", parseErr);
        alert(`Failed to parse CSV file: ${parseErr.message || 'Unknown syntax error'}`);
        if (event.target) event.target.value = '';
      }
    });
  };

  const downloadRosterCsvTemplate = () => {
    const templateHeaders = [
      {
        "Full Name": "Marcus Bolt",
        "Athlete ID / Bib": "S101",
        "Squad / Group": "Varsity Track",
        "Age": 21,
        "Gender": "M",
        "Sport": "100m Sprint",
        "Body Weight (kg)": "78",
        "Height (cm)": "185",
        "RFID Tag": "E2000019",
        "WhatsApp Number": "+91 9876543210",
        "Email ID": "marcus@velocitylab.com"
      },
      {
        "Full Name": "Derrick Washington",
        "Athlete ID / Bib": "PRO01",
        "Squad / Group": "Pro Scouting Combine",
        "Age": 22,
        "Gender": "M",
        "Sport": "Wide Receiver",
        "Body Weight (kg)": "88",
        "Height (cm)": "185",
        "RFID Tag": "E2000021",
        "WhatsApp Number": "+1 555-0199",
        "Email ID": "derrick@combineprep.com"
      },
      {
        "Full Name": "Elena Rostova",
        "Athlete ID / Bib": "S102",
        "Squad / Group": "Youth Academy",
        "Age": 16,
        "Gender": "F",
        "Sport": "200m Sprint",
        "Body Weight (kg)": "58",
        "Height (cm)": "168",
        "RFID Tag": "E2000020",
        "WhatsApp Number": "+91 9876543211",
        "Email ID": "elena@velocitylab.com"
      }
    ];
    const csv = Papa.unparse(templateHeaders);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "sprintgate_roster_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const exportRosterCsv = () => {
    if (!roster || roster.length === 0) {
      alert("No athletes in the squad roster to export.");
      return;
    }
    const exportData = roster.map(a => ({
      "Full Name": a.name || '',
      "Athlete ID / Bib": a.bib || '',
      "Squad / Group": a.squad || 'Varsity Track',
      "Age": a.age || '',
      "Gender": a.gender || '',
      "Sport": a.sport || '',
      "Body Weight (kg)": a.weight || '',
      "Height (cm)": a.height || '',
      "RFID Tag": a.rfidUid || '',
      "WhatsApp Number": a.whatsapp || a.phone || '',
      "Email ID": a.email || ''
    }));
    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `squad_roster_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };


  const addToQueue = (athlete) => {
    setQueue([...queue, athlete]);
  };

  const addMultipleToQueue = (athletesToAdd, switchToLive = false) => {
    if (!athletesToAdd || athletesToAdd.length === 0) return;
    setQueue(prev => [...prev, ...athletesToAdd]);
    setSelectedRosterIds([]);
    if (switchToLive) {
      setActiveTab('live');
    }
  };

  const enqueueAthleteForAllTests = (athlete, switchToLive = true) => {
    if (!athlete) return;
    const distNum = parseFloat(trackDistanceRef.current) || 40;
    const batteryItem = {
      ...athlete,
      id: athlete.id || `ath_${Date.now()}_${Math.random().toString(36).substring(2,6)}`,
      isCombineBattery: true,
      battery: [
        { testMode: 'standard', name: `${distNum}m Sprint`, status: 'pending', time: null },
        { testMode: 'shuttle', name: '4x10m Shuttle Run', status: 'pending', time: null },
        { testMode: 'pro_agility', name: '5-10-5 Pro Agility', status: 'pending', time: null },
        { testMode: 'l_drill', name: '3-Cone L-Drill', status: 'pending', time: null },
        { testMode: 'rsa', name: 'Repeated Sprint Ability', status: 'pending', time: null }
      ]
    };
    setQueue(prev => {
      const filtered = prev.filter(a => a.id !== batteryItem.id && a.bib !== batteryItem.bib && a.name !== batteryItem.name);
      return [...filtered, batteryItem];
    });
    if (switchToLive) {
      setActiveTab('live');
    }
  };

  const enqueueMultipleForAllTests = (athletesToAdd, switchToLive = false) => {
    if (!athletesToAdd || athletesToAdd.length === 0) return;
    const distNum = parseFloat(trackDistanceRef.current) || 40;
    const batteryItems = athletesToAdd.map(athlete => ({
      ...athlete,
      id: athlete.id || `ath_${Date.now()}_${Math.random().toString(36).substring(2,6)}`,
      isCombineBattery: true,
      battery: [
        { testMode: 'standard', name: `${distNum}m Sprint`, status: 'pending', time: null },
        { testMode: 'shuttle', name: '4x10m Shuttle Run', status: 'pending', time: null },
        { testMode: 'pro_agility', name: '5-10-5 Pro Agility', status: 'pending', time: null },
        { testMode: 'l_drill', name: '3-Cone L-Drill', status: 'pending', time: null },
        { testMode: 'rsa', name: 'Repeated Sprint Ability', status: 'pending', time: null }
      ]
    }));
    setQueue(prev => {
      const existingIds = new Set(batteryItems.map(b => b.id));
      const existingNames = new Set(batteryItems.map(b => b.name));
      const filtered = prev.filter(a => !existingIds.has(a.id) && !existingNames.has(a.name));
      return [...filtered, ...batteryItems];
    });
    setSelectedRosterIds([]);
    if (switchToLive) {
      setActiveTab('live');
    }
  };

  const handleEnqueueCombineBattery = (athlete, switchToLive = true) => {
    enqueueAthleteForAllTests(athlete, switchToLive);
  };

  const toggleRosterSelection = (athleteId) => {
    setSelectedRosterIds(prev => 
      prev.includes(athleteId) 
        ? prev.filter(id => id !== athleteId)
        : [...prev, athleteId]
    );
  };

  const removeResult = async (resToRemove, index) => {
    if (!isAdmin) {
      alert("Unauthorized: Only the Master Coach / Admin can delete sprint results.");
      return;
    }
    if (!window.confirm(`Are you sure you want to delete the result for ${resToRemove?.name || 'Athlete'}?`)) {
      return;
    }
    setResults(prev => prev.filter((_, idx) => idx !== index));
    if (user && resToRemove.firebaseId) {
      try {
        await deleteDoc(doc(db, "sprint_evaluations", resToRemove.firebaseId));
      } catch (err) {
        console.error("Failed to delete result from Firebase:", err);
      }
    }
  };

  const clearAllResults = async () => {
    if (!isAdmin) {
      alert("Unauthorized: Only the Master Coach / Admin can clear all session results.");
      return;
    }
    if (!window.confirm("Are you sure you want to clear all sprint results in the active session?")) {
      return;
    }
    if (user) {
      for (const r of results) {
        if (r.firebaseId) {
          try {
            await deleteDoc(doc(db, "sprint_evaluations", r.firebaseId));
          } catch (err) {}
        }
      }
    }
    setResults([]);
  };

  // Format time (00.00)
  const formatTime = (timeInSeconds) => {
    return timeInSeconds.toFixed(2);
  };


  const summaryStats = useMemo(() => {
    const todayStr = new Date().toLocaleDateString();
    const todayRunsList = history.filter(h => {
      if (h.serverTime && h.serverTime.seconds) {
        return new Date(h.serverTime.seconds * 1000).toLocaleDateString() === todayStr;
      }
      if (h.timestamp) {
        const ms = h.timestamp.seconds ? h.timestamp.seconds * 1000 : new Date(h.timestamp).getTime();
        if (!isNaN(ms)) return new Date(ms).toLocaleDateString() === todayStr;
      }
      return false;
    });
    // Fall back to complete history if no runs specifically logged today so summary is immediately populated
    const targetRuns = todayRunsList.length > 0 ? todayRunsList : history;

    const uniqueAthleteNames = [...new Set(targetRuns.map(h => h.name).filter(Boolean))];
    const uniqueAthletes = uniqueAthleteNames.length;
    const todayRuns = targetRuns.length;

    const typeBreakdown = { sprint: 0, agility: 0, rsa: 0 };
    targetRuns.forEach(h => {
      const t = (h.testType || 'sprint').toLowerCase();
      if (t.includes('agility') || t.includes('shuttle') || t.includes('5-10-5')) {
        typeBreakdown.agility = (typeBreakdown.agility || 0) + 1;
      } else if (t.includes('rsa') || t.includes('repeat')) {
        typeBreakdown.rsa = (typeBreakdown.rsa || 0) + 1;
      } else {
        typeBreakdown.sprint = (typeBreakdown.sprint || 0) + 1;
      }
    });

    const athleteSummaryMap = {};
    targetRuns.forEach(h => {
      if (!h.name) return;
      if (!athleteSummaryMap[h.name]) {
        athleteSummaryMap[h.name] = { 
          name: h.name, 
          runs: 0, 
          attempts: 0, 
          bestTime: null, 
          bestVelocity: null, 
          times: [] 
        };
      }
      athleteSummaryMap[h.name].runs++;
      athleteSummaryMap[h.name].attempts++;
      const timeVal = parseFloat(h.time);
      if (!isNaN(timeVal) && timeVal > 0) {
        athleteSummaryMap[h.name].times.push(timeVal);
        if (athleteSummaryMap[h.name].bestTime === null || timeVal < athleteSummaryMap[h.name].bestTime) {
          athleteSummaryMap[h.name].bestTime = timeVal;
        }
      }
      const velVal = parseFloat(h.velocity) || (h.distance && timeVal > 0 ? parseFloat(h.distance) / timeVal : null);
      if (velVal !== null && !isNaN(velVal) && velVal > 0) {
        if (athleteSummaryMap[h.name].bestVelocity === null || velVal > athleteSummaryMap[h.name].bestVelocity) {
          athleteSummaryMap[h.name].bestVelocity = velVal;
        }
      }
    });

    const athleteRows = Object.values(athleteSummaryMap).sort((a, b) => {
      if (a.bestTime === null) return 1;
      if (b.bestTime === null) return -1;
      return a.bestTime - b.bestTime;
    });

    const byDist = {};
    targetRuns.forEach(h => {
      const d = h.distance || '40';
      if (!byDist[d] || parseFloat(h.time) < parseFloat(byDist[d].time)) byDist[d] = h;
    });

    return { 
      todayRuns, 
      uniqueAthletes, 
      byDist, 
      typeBreakdown, 
      athleteRows,
      runsList: targetRuns
    };
  }, [history]);

  const sessionSummary = summaryStats;

  const tableData = useMemo(() => {
    let displayData = [];
    if (analyticsMode === 'history') {
      displayData = history.filter(h => (selectedAthlete === 'All' || h.name === selectedAthlete) && (selectedDistanceFilter === 'All' || h.distance == selectedDistanceFilter)).sort((a,b) => (b.serverTime?.seconds || 0) - (a.serverTime?.seconds || 0));
    } else if (analyticsMode === 'leaderboard') {
      const grouped = {};
      history.forEach(h => {
        if (!grouped[h.name] || parseFloat(h.time) < parseFloat(grouped[h.name].time)) {
          grouped[h.name] = h;
        }
      });
      displayData = Object.values(grouped).sort((a,b) => parseFloat(a.time) - parseFloat(b.time)).slice(0, 10);
    } else if (analyticsMode === 'summary') {
      displayData = summaryStats.athleteRows;
    }
    return displayData;
  }, [history, analyticsMode, selectedAthlete, selectedDistanceFilter, summaryStats]);

  const activeRunner = (testMode === 'mass_sprint' && runnersOnTrack.length > 0)
    ? runnersOnTrack[0]
    : (() => {
        if (queue.length === 0) return { name: "No runner in queue", bib: "-" };
        // Station-aware matching: prioritize athlete with pending test for current testMode
        const matchingRunner = queue.find(q => {
          if (!q.battery || !Array.isArray(q.battery)) return true;
          const entry = q.battery.find(b => b.testMode === testMode);
          return entry ? entry.status === 'pending' : false;
        });
        return matchingRunner || queue[0];
      })();


  const exportToCSV = () => {
    if (history.length === 0) return;
    const csvData = history.map(h => ({
      Name: h.name,
      Bib: h.bib,
      Time: h.time,
      Distance: h.distance || 40,
      Velocity: h.velocity || (parseFloat(h.distance || 40) / parseFloat(h.time)).toFixed(2),
      'Wind Speed (m/s)': h.windSpeed || 'N/A',
      'Surface': h.surfaceType || 'N/A',
      'Stride Length (m)': h.strideLength || 'N/A',
      'Ground Contact (s)': h.groundContactTime || 'N/A',
      'Flight Time (s)': h.flightTime || 'N/A',
      'Trunk Lean (deg)': h.avgTrunkLean || 'N/A',
      'Shin Angle (deg)': h.avgShinAngle || 'N/A',
      'Cadence (spm)': h.cadenceSpm || 'N/A',
      Date: h.serverTime && h.serverTime.seconds ? new Date(h.serverTime.seconds * 1000).toLocaleString() : (h.timestamp && h.timestamp.seconds ? new Date(h.timestamp.seconds * 1000).toLocaleString() : 'N/A')
    }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `SprintGate_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };


  const downloadChart = async (elementId, filename) => {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    // Add temporary background since recharts has a transparent background
    const originalBg = element.style.backgroundColor;
    element.style.backgroundColor = document.documentElement.classList.contains('dark') ? '#1a1c20' : '#ffffff';
    
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(element, { 
        backgroundColor: document.documentElement.classList.contains('dark') ? '#1a1c20' : '#ffffff',
        scale: 2
      });
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}_${new Date().toISOString().split('T')[0]}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error("Failed to download chart", e);
    } finally {
      element.style.backgroundColor = originalBg;
    }
  };

  if (authLoading) {
    return <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-emerald-500 font-bold">LOADING...</div>;
  }

  if (!isLoggedIn && !spectatorMode) {
    const hasMasterAdmin = !!masterAdminMeta?.isInitialized;
    const filteredSquadAthletes = (roster || []).filter(a => athleteMatchesSearch(a, athleteRosterSearch));

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#07080a] flex items-center justify-center text-gray-800 dark:text-gray-200 font-sans p-4">
        {athleteScanOpen && (
          <React.Suspense fallback={null}>
            <QRScannerModal 
              onScan={handleAthleteQrScan} 
              onClose={() => setAthleteScanOpen(false)} 
            />
          </React.Suspense>
        )}
        
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 sm:p-8 rounded-3xl w-full max-w-md shadow-2xl flex flex-col items-center">
          
          {/* Dual Portal Selector Tabs */}
          <div className="grid grid-cols-2 p-1 bg-gray-100 dark:bg-slate-800 rounded-2xl w-full mb-6 border border-gray-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => { setPortalTab('admin'); setAuthError(''); }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition ${
                portalTab === 'admin'
                  ? 'bg-emerald-600 text-black shadow-md'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Lock size={15} />
              <span>Coach / Admin</span>
            </button>
            <button
              type="button"
              onClick={() => { setPortalTab('athlete'); setAuthError(''); }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition ${
                portalTab === 'athlete'
                  ? 'bg-sky-500 text-black shadow-md'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <User size={15} />
              <span>Athlete Portal</span>
            </button>
          </div>

          {portalTab === 'admin' ? (
            /* COACH / MASTER ADMIN PORTAL */
            <div className="w-full flex flex-col items-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-600/10 flex items-center justify-center mb-4">
                <Lock size={28} className="text-emerald-500" />
              </div>
              
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight text-center mb-1">
                {hasMasterAdmin ? "Master Coach & Admin Login" : "Master Admin Setup"}
              </h1>
              <p className="text-xs text-gray-500 mb-4 font-medium text-center">
                {hasMasterAdmin 
                  ? "Single authorized master administrator account for timing gates & rosters." 
                  : "First-time setup: establish the single primary master admin for Velocity Lab."}
              </p>

              {hasMasterAdmin ? (
                <div className="w-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-bold px-3 py-2 rounded-xl mb-4 flex items-center gap-2">
                  <ShieldCheck size={16} className="shrink-0" />
                  <span className="truncate">Master Admin: {maskEmail(masterAdminMeta?.masterAdminEmail)}</span>
                  <span className="text-[10px] uppercase tracking-wider bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-mono shrink-0 ml-auto">Configured</span>
                </div>
              ) : (
                <div className="w-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-bold px-3 py-2 rounded-xl mb-4 flex items-center gap-2">
                  <Zap size={16} className="shrink-0" />
                  <span>First-time setup: Register the one master admin account.</span>
                </div>
              )}

              {authError && (
                <div className="w-full bg-red-500/10 text-red-500 text-xs font-bold p-3 rounded-xl border border-red-500/20 mb-4">
                  {authError}
                </div>
              )}

              {isForgotPassword ? (
                <form onSubmit={handlePasswordReset} className="w-full space-y-3.5">
                  <div className="w-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-medium p-3 rounded-xl mb-2">
                    Enter your registered Master Admin email. A secure password reset link will be sent to your inbox.
                  </div>

                  {resetSent && (
                    <div className="w-full bg-emerald-500/10 text-emerald-400 text-xs font-bold p-3 rounded-xl border border-emerald-500/20 flex items-center gap-2">
                      <CheckCircle2 size={16} className="shrink-0" />
                      <span>Password reset email dispatched! Please check your inbox or spam.</span>
                    </div>
                  )}

                  <div>
                    <label className="text-[11px] text-gray-600 dark:text-gray-400 font-bold tracking-widest uppercase mb-1.5 block">Registered Admin Email</label>
                    <input 
                      type="email" 
                      required 
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)} 
                      placeholder="coach@velocitylab.com"
                      className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-sm text-black dark:text-white focus:border-[#00D084] focus:outline-none transition" 
                    />
                  </div>

                  <button 
                    type="submit" 
                    disabled={resetLoading}
                    className="w-full bg-sky-500 text-black font-bold text-sm sm:text-base py-3 rounded-xl hover:bg-sky-400 transition mt-2 shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {resetLoading ? <Loader2 size={18} className="animate-spin" /> : <Mail size={18} />}
                    <span>{resetLoading ? "Sending Reset Email..." : "Send Password Reset Link"}</span>
                  </button>

                  <button 
                    type="button" 
                    onClick={() => { setIsForgotPassword(false); setResetSent(false); setAuthError(""); }}
                    className="w-full text-center text-xs font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition py-2"
                  >
                    ← Back to Sign In
                  </button>
                </form>
              ) : (
                <form onSubmit={handleAuth} className="w-full space-y-3.5">
                <div>
                  <label className="text-[11px] text-gray-600 dark:text-gray-400 font-bold tracking-widest uppercase mb-1.5 block">Admin Email</label>
                  <input 
                    type="email" 
                    required 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    placeholder="coach@velocitylab.com"
                    className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-sm text-black dark:text-white focus:border-[#00D084] focus:outline-none transition" 
                  />
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] text-gray-600 dark:text-gray-400 font-bold tracking-widest uppercase block">Password</label>
                    {hasMasterAdmin && !isRegistering && (
                      <button 
                        type="button" 
                        onClick={() => { setIsForgotPassword(true); setAuthError(""); }}
                        className="text-[11px] text-sky-400 hover:text-sky-300 font-semibold transition"
                      >
                        Forgot Password?
                      </button>
                    )}
                  </div>
                  <input 
                    type="password" 
                    required 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    placeholder="••••••••"
                    className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-sm text-black dark:text-white focus:border-[#00D084] focus:outline-none transition" 
                  />
                </div>
                
                <button type="submit" className="w-full bg-emerald-600 text-black font-bold text-sm sm:text-base py-3 rounded-xl hover:bg-[#00e691] transition mt-2 shadow-md">
                  {isRegistering ? "Create Master Admin Account" : "Sign in as Master Admin"}
                </button>
              </form>
              )}

              {!isForgotPassword && (!hasMasterAdmin ? (
                <button 
                  type="button"
                  onClick={() => setIsRegistering(!isRegistering)} 
                  className="text-gray-500 text-xs font-bold mt-4 hover:text-gray-700 dark:hover:text-gray-300 transition"
                >
                  {isRegistering ? "Already created master admin? Sign In" : "First time system setup? Register Master Admin"}
                </button>
              ) : (
                <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-4 text-center font-medium">
                  🔒 Single Admin Lock: Only 1 Master Admin account is permitted. Additional registrations are permanently locked down.
                </div>
              ))}
            </div>
          ) : (
            /* ATHLETE PORTAL */
            <div className="w-full flex flex-col items-center">
              <div className="w-14 h-14 rounded-2xl bg-sky-500/10 flex items-center justify-center mb-4">
                <User size={28} className="text-sky-400" />
              </div>

              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight text-center mb-1">
                Athlete Access Portal
              </h1>
              <p className="text-xs text-gray-500 mb-4 font-medium text-center">
                Access your personalized combine scorecard, sprint PRs, and AI video reviews.
              </p>

              {authError && (
                <div className="w-full bg-red-500/10 text-red-500 text-xs font-bold p-3 rounded-xl border border-red-500/20 mb-4">
                  {authError}
                </div>
              )}

              {/* Instant QR Badge Scan Option */}
              <button 
                type="button" 
                onClick={() => setAthleteScanOpen(true)}
                className="w-full flex items-center justify-center gap-2.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 font-bold py-3 px-4 rounded-xl transition text-sm mb-4 shadow-sm"
              >
                <QrCode size={18} />
                <span>Instant QR Badge Scanner</span>
              </button>

              <div className="w-full flex items-center gap-2 my-1">
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800"></div>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">or sign in with Bib / Name</span>
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800"></div>
              </div>

              {/* Form Sign In by Bib or Name */}
              <form onSubmit={handleAthleteBibSubmit} className="w-full space-y-3 mt-3">
                <div>
                  <label className="text-[11px] text-gray-600 dark:text-gray-400 font-bold tracking-widest uppercase mb-1.5 block">Athlete Bib # or Full Name</label>
                  <input 
                    type="text" 
                    required 
                    value={athleteBibInput} 
                    onChange={(e) => setAthleteBibInput(e.target.value)} 
                    placeholder="e.g. S1, 04, or Usain Bolt"
                    className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-sm text-black dark:text-white focus:border-sky-400 focus:outline-none transition font-medium" 
                  />
                </div>

                <div>
                  <label className="text-[11px] text-gray-600 dark:text-gray-400 font-bold tracking-widest uppercase mb-1.5 block">Passcode / PIN <span className="text-gray-400 font-normal">(if configured)</span></label>
                  <input 
                    type="password" 
                    value={athletePinInput} 
                    onChange={(e) => setAthletePinInput(e.target.value)} 
                    placeholder="4-digit PIN (leave empty if none)"
                    className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-sm text-black dark:text-white focus:border-sky-400 focus:outline-none transition font-medium" 
                  />
                </div>

                <button type="submit" className="w-full bg-sky-500 hover:bg-sky-400 text-black font-bold text-sm sm:text-base py-3 rounded-xl transition mt-2 shadow-md">
                  Enter Athlete Portal
                </button>
              </form>

              {/* Quick Squad Roster Selection */}
              {roster.length > 0 && (
                <div className="w-full mt-4 pt-4 border-t border-gray-200 dark:border-slate-800">
                  <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Quick Squad Select</span>
                    <span>{roster.length} registered</span>
                  </div>
                  <input 
                    type="text" 
                    placeholder="Filter squad roster..."
                    value={athleteRosterSearch}
                    onChange={(e) => setAthleteRosterSearch(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-black dark:text-white mb-2 focus:outline-none"
                  />
                  <div className="max-h-28 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                    {filteredSquadAthletes.slice(0, 10).map((ath) => (
                      <button
                        key={ath.id}
                        type="button"
                        onClick={() => handleAthleteLogin(ath)}
                        className="w-full flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-slate-800 hover:bg-sky-500/10 hover:border-sky-500/30 border border-gray-200/50 dark:border-slate-700/50 text-left transition group"
                      >
                        <span className="text-xs font-bold text-gray-800 dark:text-gray-200 group-hover:text-sky-400 truncate">{ath.name}</span>
                        <span className="text-[10px] font-mono font-bold text-gray-400 bg-gray-200 dark:bg-slate-700 px-1.5 py-0.5 rounded">ID: {ath.bib}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          <div className="w-full h-px bg-gray-200 dark:bg-gray-800 my-5"></div>
          
          <button 
            type="button"
            onClick={() => {
              setSpectatorMode(true);
              setIsBleacherScoreboard(true);
            }} 
            className="text-emerald-500 text-xs sm:text-sm font-bold hover:text-[#00e691] transition flex items-center justify-center gap-2"
          >
            <Smartphone size={15} />
            <span>Open Bleacher Live Scoreboard</span>
          </button>
        </div>
      </div>
    );
  }

  if (isBleacherScoreboard) {
    return (
      <React.Suspense fallback={
        <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white gap-3">
          <Loader2 className="animate-spin text-[#00D084]" size={36} />
          <span className="text-xs font-mono tracking-widest uppercase text-gray-400">Loading Bleacher Scoreboard...</span>
        </div>
      }>
        <SpectatorLiveScoreboard
          activeRunner={activeRunner}
          displayTime={displayTime}
          isRunning={isRunning}
          sequenceState={sequenceState}
          testMode={testMode}
          trackDistance={trackDistance}
          liveSplits={liveSplits}
          history={history}
          results={results}
          onExitSpectator={() => setIsBleacherScoreboard(false)}
        />
      </React.Suspense>
    );
  }

  if (isStadiumMode) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#07080a] text-black dark:text-white font-sans flex flex-col p-4 sm:p-6 lg:p-12 relative overflow-x-hidden">
        {/* Top Header Bar */}
        <div className="w-full flex items-center justify-between mb-4 sm:mb-8 z-50">
          <div className="flex items-center">
            <VelocityLabLogo variant="full" className="h-9 sm:h-11 md:h-12 w-auto" colorTheme={colorTheme} isDark={isDark} />
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Bleacher Live Stream QR Code */}
            <div className="flex items-center gap-2.5 sm:gap-3 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-1.5 sm:px-3 sm:py-2 backdrop-blur-md shadow-lg dark:shadow-xl transition-colors">
              <div className="bg-slate-50 dark:bg-white p-1 rounded-xl shrink-0 border border-slate-200/80 dark:border-transparent">
                <QRCodeSVG 
                  value={typeof window !== 'undefined' ? `${window.location.origin}/?mode=spectator` : 'https://sprintgate-b84db.web.app/?mode=spectator'}
                  size={46}
                  level="M"
                  includeMargin={false}
                />
              </div>
              <div className="text-left hidden md:block">
                <div className="text-[10px] font-bold tracking-widest uppercase text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <Smartphone size={12} /> BLEACHER STREAM
                </div>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">Scan for Phone Scoreboard</div>
              </div>
            </div>

            <button 
              onClick={() => setIsStadiumMode(false)} 
              className="bg-white dark:bg-slate-800 hover:bg-red-500/10 text-gray-500 hover:text-red-500 p-3 sm:p-4 rounded-2xl transition border border-gray-200 dark:border-slate-700 hover:border-red-500/30 group shadow-xl"
              title="Exit Stadium Display"
            >
               <Minimize size={22} className="group-hover:scale-90 transition-transform" />
            </button>
          </div>
        </div>
        
        <div className="flex-1 flex flex-col xl:flex-row gap-8 lg:gap-12">
           {/* Left side: Massive Timer */}
           <div className="flex-[1.5] flex flex-col items-center justify-center border-gray-200 dark:border-slate-800 xl:border-r xl:pr-12 relative py-4 sm:py-8">
              <div className="absolute w-[150%] h-[200px] bg-gradient-to-r from-transparent via-[#00D084]/5 to-transparent -rotate-12 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0 blur-3xl pointer-events-none"></div>

              <div className="relative flex items-center justify-center">
                <PrecisionClockDisplay 
                  time={displayTime}
                  sequenceState={sequenceState}
                  variant="stadium"
                />
              </div>
              
              <div className="z-10 mt-12 flex flex-col items-center">
                {activeRunner && activeRunner.name !== 'No runner in queue' ? (
                  <div className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-8 py-3 flex items-center gap-4 text-xl font-medium text-slate-800 dark:text-slate-200 shadow-md">
                    <User size={24} className="text-emerald-500" />
                    <span className="tracking-tight">{activeRunner.name}</span>
                    <div className="w-1.5 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full mx-2"></div>
                    <span className="font-mono font-bold text-slate-500 dark:text-slate-400">ID: {activeRunner.bib}</span>
                  </div>
                ) : (
                  <div className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-8 py-3 text-xl font-medium text-slate-400 dark:text-slate-500 tracking-wide shadow-md">
                    NO RUNNER ON LINE
                  </div>
                )}
              </div>

              {['shuttle', 'pro_agility', 'l_drill'].includes(testMode) ? (
                <div className="z-10 mt-6 w-full max-w-2xl px-4">
                  <FieldRadarVisualizer 
                    testMode={testMode} 
                    liveSplits={liveSplits} 
                    isRunning={isRunning} 
                    sequenceState={sequenceState}
                    compact={true}
                  />
                </div>
              ) : (
                <div className="z-10 mt-6 w-full max-w-4xl px-4">
                  <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xl dark:shadow-2xl relative overflow-hidden transition-colors">
                    <div className="flex items-center justify-between mb-3 text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                        <Zap size={14} /> LIVE STADIUM TRACK ARENA
                      </span>
                      <span>{trackDistance || 40}m STRAIGHTAWAY</span>
                    </div>

                    {/* Synthetic track bed */}
                    <div className="relative bg-slate-100 dark:bg-[#0d0f12] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 overflow-hidden transition-colors">
                      <div className="flex justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400 font-bold mb-3 px-1">
                        <span>0m (GATE A)</span>
                        <span>10m</span>
                        <span>20m</span>
                        <span>30m</span>
                        <span>{trackDistance || 40}m (GATE B)</span>
                      </div>

                      <div className="relative h-14 flex items-center">
                        <div className="w-full h-3 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-100"
                            style={{
                              width: `${
                                isRunning && parseFloat(displayTime) > 0
                                  ? Math.min(99, Math.pow(parseFloat(displayTime) / (5.0 * ((parseFloat(trackDistance) || 40) / 40)), 1.25) * 100)
                                  : sequenceState === 'finished' ? 100 : 0
                              }%`
                            }}
                          ></div>
                        </div>

                        {/* Active Runner Avatar */}
                        <div 
                          className="absolute -top-1 -translate-x-1/2 flex flex-col items-center pointer-events-none transition-all duration-100 z-20"
                          style={{
                            left: `${
                              isRunning && parseFloat(displayTime) > 0
                                ? Math.min(99, Math.pow(parseFloat(displayTime) / (5.0 * ((parseFloat(trackDistance) || 40) / 40)), 1.25) * 100)
                                : sequenceState === 'finished' ? 100 : 0
                            }%`
                          }}
                        >
                          <div className="w-9 h-9 rounded-full bg-emerald-500 text-white dark:text-black flex items-center justify-center font-black text-sm shadow-[0_0_20px_rgba(16,185,129,0.8)] border-2 border-white dark:border-slate-900">
                            <Zap size={18} fill="currentColor" />
                          </div>
                          <span className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-400 mt-1 bg-white/95 dark:bg-black/80 px-1.5 py-0.5 rounded border border-emerald-500/30 shadow-md">
                            {isRunning && parseFloat(displayTime) > 0
                              ? `${(Math.min(1.0, Math.pow(parseFloat(displayTime) / (5.0 * ((parseFloat(trackDistance) || 40) / 40)), 1.25)) * (parseFloat(trackDistance) || 40)).toFixed(1)}m`
                              : sequenceState === 'finished' ? `${trackDistance || 40}m` : '0.0m'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="mt-16 text-3xl font-bold tracking-[0.2em] z-10">
                {sequenceState === 'false_start' ? (
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-red-500 animate-pulse">FALSE START!</span>
                    {falseStartReason && (
                      <span className="text-xs sm:text-sm font-mono text-red-300 font-bold tracking-normal bg-red-950/80 px-4 py-1.5 rounded-full border border-red-500/40 shadow-lg">
                        {falseStartReason}
                      </span>
                    )}
                  </div>
                ) : 
                 sequenceState === 'lead_in' ? <span className="text-sky-400 animate-pulse">CADENCE: BEEP {cadenceBeepCount}...</span> :
                 sequenceState === 'marks' ? <span className="text-yellow-400 animate-pulse">ON YOUR MARKS...</span> : 
                 sequenceState === 'set' ? <span className="text-yellow-400 animate-pulse">SET...</span> : 
                 sequenceState === 'waiting_start' ? <span className="text-amber-400 animate-pulse flex items-center justify-center gap-3"><span className="w-4 h-4 rounded-full bg-amber-400 animate-ping inline-block"></span>GUN FIRED — WAITING FOR START BEAM BREAK</span> :
                 sequenceState === 'finished' ? <span className="text-emerald-400 font-bold">FINISHED!</span> :
                 isRunning ? <span className="text-emerald-500 animate-pulse">SPRINTING...</span> : 
                 <span className="text-emerald-500">READY</span>}
              </div>
           </div>
           
           {/* Right side: Top 10 Leaderboard */}
           <div className="flex-1 flex flex-col z-10 xl:pl-6 max-w-2xl mx-auto w-full">
              <div className="text-2xl font-bold text-gray-600 dark:text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-8 flex items-center gap-4">
                 <Activity size={28} className="text-emerald-500" />
                 Today's Top 10
              </div>
              
              <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                 {[...results].sort((a,b) => parseFloat(a.time) - parseFloat(b.time)).slice(0, 10).map((res, i) => (
                    <div 
                      key={res.id} 
                      onClick={() => setSelectedProfileAthlete(res.name)}
                      className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 hover:border-emerald-500/50 rounded-3xl p-6 flex justify-between items-center shadow-lg transform transition-all hover:scale-[1.02] cursor-pointer"
                      title="Click to view Athlete Scout Dossier & Spider Radar"
                    >
                       <div className="flex items-center gap-6">
                          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-2xl ${i === 0 ? 'bg-emerald-600 text-black shadow-[0_0_20px_rgba(0,208,132,0.3)]' : i === 1 ? 'bg-gray-300 text-black shadow-[0_0_20px_rgba(209,213,219,0.2)]' : i === 2 ? 'bg-orange-400 text-black shadow-[0_0_20px_rgba(251,146,60,0.2)]' : 'bg-white dark:bg-slate-800 text-gray-500 border border-gray-200 dark:border-slate-700'}`}>
                            {i + 1}
                          </div>
                          <div>
                            <div className="text-3xl font-bold text-black dark:text-white tracking-tight">{res.name}</div>
                            <div className="text-gray-500 font-medium text-lg mt-1">{res.sport || res.standing}</div>
                          </div>
                       </div>
                       <div className="text-right flex flex-col items-end">
                         <div className="text-4xl font-bold font-mono text-emerald-500 tracking-tighter">{res.time}s</div>
                         {res.reactionTime > 0 && (
                           <button
                             onClick={(e) => {
                               e.stopPropagation();
                               setAuditRunData(res);
                             }}
                             className="group flex items-center gap-1.5 px-2.5 py-0.5 mt-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-xs font-bold font-mono text-amber-500 hover:text-amber-400 transition"
                             title="Open World Athletics Rule TR 16.7 Timing Audit"
                           >
                             <ShieldCheck size={13} className="text-amber-500 group-hover:scale-110 transition-transform" />
                             <span>RT: {(res.reactionTime/1000).toFixed(3)}s</span>
                             <span className="text-[10px] uppercase tracking-wider opacity-75 font-sans border-l border-amber-500/30 pl-1.5">WA Audit</span>
                           </button>
                         )}
                         {res.splits?.map((split, idx) => (
                           <div key={idx} className="text-sm text-gray-500 font-bold font-mono mt-1">Split {SPLIT_DISTANCES[split.node] ? `${SPLIT_DISTANCES[split.node]}m` : `Node ${split.node}`}: {split.time}s</div>
                         ))}
                       </div>
                    </div>
                 ))}
                 
                 {results.length === 0 && (
                   <div className="flex-1 flex flex-col items-center justify-center text-gray-600 border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-3xl h-[400px]">
                     <Users size={64} className="mb-6 opacity-20" />
                     <div className="text-2xl font-bold uppercase tracking-widest">No Results Yet</div>
                     <div className="text-base font-medium mt-2">Awaiting first sprint...</div>
                   </div>
                 )}
              </div>
           </div>
        </div>
      </div>
    );
  }

  if (isJumbotronMode) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-black flex flex-col justify-between text-gray-900 dark:text-white overflow-hidden p-4 sm:p-8 md:p-12 transition-colors">
        {/* Top Header Bar */}
        <div className="w-full flex items-center justify-between z-10 shrink-0">
          <div className="flex items-center">
            <VelocityLabLogo variant="full" className="h-10 sm:h-12 md:h-14 w-auto" colorTheme={colorTheme} isDark={isDark} />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5 bg-white dark:bg-white/10 border border-gray-200 dark:border-white/20 rounded-2xl p-1.5 sm:px-3 sm:py-2 backdrop-blur-md shadow-sm">
              <div className="bg-white p-1 rounded-xl shrink-0 border border-gray-100 dark:border-transparent">
                <QRCodeSVG 
                  value={typeof window !== 'undefined' ? `${window.location.origin}/?mode=spectator` : 'https://sprintgate-b84db.web.app/?mode=spectator'}
                  size={40}
                  level="M"
                  includeMargin={false}
                />
              </div>
              <div className="text-left hidden lg:block">
                <div className="text-[10px] font-bold tracking-widest uppercase text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Smartphone size={12} /> BLEACHER STREAM
                </div>
                <div className="text-xs text-gray-600 dark:text-white/90 font-medium">Scan for Mobile Scoreboard</div>
              </div>
            </div>
            <button 
              onClick={() => setIsJumbotronMode(false)} 
              className="p-2.5 sm:p-3 rounded-2xl bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/20 text-gray-600 hover:text-gray-900 dark:text-white/70 dark:hover:text-white transition border border-gray-200 dark:border-transparent"
              title="Exit TV Mode"
            >
              <X size={26} className="sm:w-8 sm:h-8 md:w-10 md:h-10" />
            </button>
          </div>
        </div>
        
        {/* Center Clock with fluid typography */}
        <div className="flex-1 flex flex-col items-center justify-center my-auto py-2">
          <PrecisionClockDisplay 
            time={displayTime}
            sequenceState={sequenceState}
            variant="jumbotron"
          />
          {activeRunner && activeRunner.name !== 'No runner in queue' && (
            <div className="mt-3 sm:mt-6 px-4 sm:px-6 py-1.5 sm:py-2 rounded-full bg-white dark:bg-white/10 border border-gray-200 dark:border-white/20 text-xs sm:text-lg md:text-xl font-bold tracking-wide text-gray-800 dark:text-white/90 shadow-md">
              {activeRunner.name} {activeRunner.bib ? `(ID: ${activeRunner.bib})` : ''}
            </div>
          )}

          {['shuttle', 'pro_agility', 'l_drill'].includes(testMode) && (
            <div className="z-10 mt-4 w-full max-w-3xl px-4">
              <FieldRadarVisualizer 
                testMode={testMode} 
                liveSplits={liveSplits} 
                isRunning={isRunning} 
                sequenceState={sequenceState}
                compact={true}
              />
            </div>
          )}
        </div>
        
        {/* Bottom Recent Sprints - responsive cards */}
        <div className="w-full max-w-7xl mx-auto pb-2 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-4 md:gap-6">
            {history.slice(0, 5).map((run, idx) => (
               <div key={idx} className="bg-white dark:bg-white/10 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 md:p-6 flex flex-col items-center justify-center border border-gray-200 dark:border-white/15 backdrop-blur-md shadow-md min-w-0">
                  <div className="text-gray-400 dark:text-white/60 text-xs sm:text-sm md:text-base font-bold mb-0.5 sm:mb-1">#{idx + 1}</div>
                  <div className="text-sm sm:text-lg md:text-xl font-bold text-gray-900 dark:text-white mb-0.5 sm:mb-1 truncate w-full text-center px-1">{run.name}</div>
                  <div className="text-base sm:text-2xl md:text-3xl lg:text-4xl font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">{run.time}s</div>
               </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen lg:h-screen lg:max-h-screen bg-slate-50 dark:bg-[#07080a] text-gray-800 dark:text-gray-100 font-sans flex flex-col lg:overflow-hidden relative">
      
      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full lg:h-full min-w-0 overflow-hidden relative z-10 pb-16 md:pb-0">
        
        {/* Header */}
        <header className="px-3 sm:px-6 md:px-8 pt-2.5 sm:pt-4 md:pt-5 pb-2 md:pb-3 shrink-0">
          
          {/* Top Bar: Brand Logo, Navigation Tabs & Far Upper-Right Corner Safe Logout */}
          <div className="flex items-center justify-between gap-2.5 pb-2 border-b border-gray-200/70 dark:border-slate-800/80 mb-2">
            {/* Left: Permanent Compact Logo & Navigation Tabs */}
            <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-2.5 overflow-x-auto max-w-full pb-0.5 scrollbar-none whitespace-nowrap flex-1 min-w-0">
              <div className="flex items-center shrink-0 mr-1 sm:mr-2">
                <VelocityLabLogo variant="full" className="h-9 sm:h-10 md:h-11 w-auto" colorTheme={colorTheme} isDark={isDark} />
              </div>

              {/* Desktop/Tablet top tabs — hidden on phones, visible md+ */}
              <button onClick={() => setActiveTab('live')} className={`hidden md:flex text-[11px] sm:text-xs font-bold tracking-wider uppercase items-center gap-1.5 sm:gap-2 pb-1.5 px-1 shrink-0 transition ${activeTab === 'live' ? 'text-emerald-500 border-b-2 border-[#00D084]' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
                <div className={`w-2 h-2 rounded-full ${activeTab === 'live' ? 'bg-emerald-600 animate-pulse' : 'bg-transparent'}`}></div>
                LIVE SESSION
              </button>
              <button onClick={() => setActiveTab('roster')} className={`hidden md:flex text-[11px] sm:text-xs font-bold tracking-wider uppercase items-center gap-1.5 sm:gap-2 pb-1.5 px-1 shrink-0 transition ${activeTab === 'roster' ? 'text-emerald-500 border-b-2 border-[#00D084]' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
                <Users size={14} />
                TEAM PORTAL &amp; ROSTER
              </button>
              <button onClick={() => setActiveTab('combine')} className={`hidden md:flex text-[11px] sm:text-xs font-bold tracking-wider uppercase items-center gap-1.5 sm:gap-2 pb-1.5 px-1 shrink-0 transition ${activeTab === 'combine' ? 'text-emerald-500 border-b-2 border-[#00D084]' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
                <Award size={14} />
                COMBINE
              </button>
              <button onClick={() => setActiveTab('analytics')} className={`hidden md:flex text-[11px] sm:text-xs font-bold tracking-wider uppercase items-center gap-1.5 sm:gap-2 pb-1.5 px-1 shrink-0 transition ${activeTab === 'analytics' ? 'text-emerald-500 border-b-2 border-[#00D084]' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
                <Activity size={14} />
                ANALYTICS
              </button>
              <button onClick={() => setActiveTab('video')} className={`hidden md:flex text-[11px] sm:text-xs font-bold tracking-wider uppercase items-center gap-1.5 sm:gap-2 pb-1.5 px-1 shrink-0 transition ${activeTab === 'video' ? 'text-emerald-500 border-b-2 border-[#00D084]' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
                <Video size={14} />
                VIDEO REVIEW
              </button>
              <button onClick={() => setActiveTab('leaderboard')} className={`hidden md:flex text-[11px] sm:text-xs font-bold tracking-wider uppercase items-center gap-1.5 sm:gap-2 pb-1.5 px-1 shrink-0 transition ${activeTab === 'leaderboard' ? 'text-emerald-500 border-b-2 border-[#00D084]' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
                <Trophy size={14} />
                LEADERBOARD
              </button>
            </div>

            {/* Upper Right Corner: Connectivity Pill, User Profile & Safe Isolated Logout Button */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
              <OfflineStatusPill
                isOnline={offlineTelemetry.isOnline}
                isGateOnline={isGateHardwareConnected}
                queuedCount={offlineTelemetry.totalQueued}
                isSyncing={offlineTelemetry.isSyncing}
              />
              {isAdmin && (
                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 shadow-xs">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)] animate-pulse shrink-0" />
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 max-w-[110px] sm:max-w-[180px] truncate" title={user?.email || 'Master Coach'}>
                    {user?.email || 'Master Coach'}
                  </span>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 hover:border-rose-500/60 font-bold text-xs transition shadow-xs group shrink-0"
                    title={`Logged in as Admin (${user?.email || 'Master Coach'}) — Click to Logout`}
                  >
                    <LogOut size={13} className="text-rose-500 group-hover:-translate-x-0.5 transition-transform" />
                    <span className="hidden sm:inline">Logout</span>
                  </button>
                </div>
              )}

              {isAthlete && (
                <div className="flex items-center gap-2 bg-sky-500/10 border border-sky-500/30 text-sky-400 px-2.5 py-1.5 rounded-xl text-xs font-bold shadow-xs">
                  <User size={13} />
                  <span className="truncate max-w-[100px] sm:max-w-[140px]">{currentAthlete.name}</span>
                  <span className="font-mono text-gray-400 text-xs">#{currentAthlete.bib}</span>
                  <button 
                    onClick={handleLogout}
                    className="flex items-center gap-1 px-2 py-1 bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-bold transition ml-0.5"
                    title="Exit Athlete Portal"
                  >
                    <LogOut size={12} />
                    <span>Exit</span>
                  </button>
                </div>
              )}

              {spectatorMode && !isAdmin && !isAthlete && (
                <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 px-2.5 py-1.5 rounded-xl text-xs font-bold shadow-xs">
                  <Tv size={13} />
                  <span>Spectator</span>
                  <button 
                    onClick={handleLogout}
                    className="flex items-center gap-1 px-2 py-1 bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-bold transition ml-0.5"
                    title="Exit Spectator Mode"
                  >
                    <LogOut size={12} />
                    <span>Exit</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Row 2: Operational Controls Toolbar (Theme, Audio, Sensors, TV, BLE, Cloud Sync) */}
          <div className="flex justify-end mb-3">
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 justify-end ml-auto flex-wrap">
              
              {/* ========================================================= */}
              {/* MOBILE & TABLET CONTROLS (< xl)                           */}
              {/* Consolidated single-bar controls preventing any clipping  */}
              {/* ========================================================= */}
              <div className="flex xl:hidden items-center gap-1.5 sm:gap-2">
                {/* Multi-Device Live Field Sync Pill (Mobile) */}
                <button
                  onClick={() => setShowMultiDeviceSyncModal(true)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition border shadow-xs shrink-0 ${
                    connectedStations.length > 1
                      ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30'
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-slate-700'
                  }`}
                  title={`Field Mesh Sync (${connectedStations.length || 1} Stations Connected)`}
                >
                  <Radio size={13} className={connectedStations.length > 1 ? "text-sky-500 animate-pulse" : "text-emerald-500"} />
                  <span className="font-mono text-xs uppercase">
                    {stationRole === 'master' ? 'CONSOLE' : stationRole === 'marshall' ? 'MARSHALL' : stationRole === 'camera' ? 'CAM' : 'MIRROR'}
                  </span>
                  <span className="text-[9px] font-mono font-bold px-1 py-0.2 rounded bg-black/10 dark:bg-white/10 text-emerald-600 dark:text-emerald-400">
                    {connectedStations.length || 1}D
                  </span>
                </button>

                {/* Real Hardware Timing Gate Status Indicator */}
                <button
                  onClick={() => setShowGateConnectionModal(true)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition border shadow-xs shrink-0 ${
                    statusB?.online || isSerialConnected || isSprintGateBleConnected
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                      : statusB?.timedOut
                      ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/25'
                      : statusB?.reconnecting
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 animate-pulse'
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-500 border-gray-200 dark:border-slate-700'
                  }`}
                  title={
                    isSerialConnected 
                      ? 'Hardware Connected via Direct USB-C' 
                      : statusB?.online 
                      ? `Hardware Connected via Wi-Fi (${nodeB})` 
                      : isSprintGateBleConnected
                      ? 'Hardware Connected via BLE'
                      : statusB?.timedOut
                      ? 'Hardware connection timed out after 60s • Click to retry'
                      : 'Timing Gate Offline • Click to configure connection'
                  }
                >
                  <Wifi size={13} className={statusB?.online || isSerialConnected || isSprintGateBleConnected ? "text-emerald-500" : statusB?.timedOut ? "text-rose-500" : "text-gray-400"} />
                  <span className="font-mono text-xs">
                    {isSerialConnected ? 'USB-C ON' : statusB?.online ? 'GATE ON' : statusB?.timedOut ? 'TIMED OUT' : statusB?.reconnecting ? 'RETRY' : 'GATE OFF'}
                  </span>
                </button>

                {/* Heart Rate BLE (if connected on mobile) */}
                {isBleConnected && (
                  <button
                    onClick={() => setShowBleModal(true)}
                    className="flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs font-bold bg-rose-500/15 text-rose-500 border border-rose-500/30 shrink-0"
                    title={`Heart Rate: ${liveBleBpm} BPM`}
                  >
                    <Heart size={12} className="fill-rose-500 text-rose-500 animate-pulse" />
                    <span className="font-mono text-xs">{liveBleBpm}</span>
                  </button>
                )}

                {/* Mobile Network & Cloud Sync Badge */}
                <button
                  onClick={() => handleSyncOfflineQueue(false)}
                  disabled={isSyncingOfflineQueue || offlineTelemetryStatus.isSyncing}
                  className={`flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs font-bold transition border shrink-0 ${
                    !offlineTelemetryStatus.isOnline
                      ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                      : totalUnsyncedRunsCount > 0
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 animate-pulse'
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  }`}
                  title={
                    !offlineTelemetryStatus.isOnline
                      ? `Offline (${totalUnsyncedRunsCount} queued)`
                      : totalUnsyncedRunsCount > 0
                      ? `${totalUnsyncedRunsCount} queued runs — tap to sync`
                      : 'Cloud Synchronized'
                  }
                >
                  {!offlineTelemetryStatus.isOnline ? (
                    <>
                      <WifiOff size={12} className="text-amber-400" />
                      <span className="font-mono text-[10px]">OFFLINE</span>
                      {totalUnsyncedRunsCount > 0 && <span className="font-mono text-[9px] px-1 rounded bg-amber-500/20">{totalUnsyncedRunsCount}</span>}
                    </>
                  ) : totalUnsyncedRunsCount > 0 ? (
                    <>
                      <RefreshCw size={11} className={(isSyncingOfflineQueue || offlineTelemetryStatus.isSyncing) ? "animate-spin text-amber-300" : "text-amber-400"} />
                      <span className="font-mono text-[10px]">{totalUnsyncedRunsCount}Q</span>
                    </>
                  ) : (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_4px_#34d399]" />
                      <Wifi size={11} className="text-emerald-500" />
                      <span className="font-mono text-[10px]">SYNC</span>
                    </>
                  )}
                </button>

                {/* Mobile & Tablet Quick Controls Drawer Button */}
                <button
                  onClick={() => setShowQuickControlsSheet(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-slate-700 font-bold text-xs shrink-0 transition shadow-2xs group"
                  title="Open Quick Controls (Theme, Display, Audio, Sensors)"
                >
                  <Sliders size={13} className="text-emerald-500 group-hover:rotate-45 transition-transform" />
                  <span>Controls</span>
                </button>
              </div>

              {/* ========================================================= */}
              {/* DESKTOP FULL CONTROLS TOOLBAR (>= xl)                      */}
              {/* Full expanded power-user control strip                    */}
              {/* ========================================================= */}
              <div className="hidden xl:flex items-center gap-1.5 sm:gap-2">
                {/* Color Theme & Palette Picker */}
                <ThemeColorPicker 
                  colorTheme={colorTheme} 
                  setColorTheme={setColorTheme} 
                  theme={theme} 
                  setTheme={setTheme}
                  highContrast={highContrast}
                  setHighContrast={setHighContrast}
                />

                {/* Theme Toggle - Fixed width/height segment buttons with flex centering to prevent icon shifting on tablets & touch devices */}
                <div className="inline-flex items-center bg-gray-100 dark:bg-slate-800/90 rounded-xl p-0.5 sm:p-1 border border-gray-200 dark:border-slate-700 shrink-0 gap-0.5">
                  <button 
                    type="button"
                    onClick={() => { setTheme('light'); setHighContrast(false); }} 
                    className={`w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg shrink-0 transition-all cursor-pointer focus:outline-none ${
                      !highContrast && theme === 'light' 
                        ? 'bg-emerald-500 text-black font-bold shadow-xs' 
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                    title="Studio Light Mode"
                    aria-label="Studio Light Mode"
                  >
                    <Sun size={14} className="shrink-0" />
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setTheme('system'); setHighContrast(false); }} 
                    className={`w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg shrink-0 transition-all cursor-pointer focus:outline-none ${
                      !highContrast && theme === 'system' 
                        ? 'bg-emerald-500 text-black font-bold shadow-xs' 
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                    title="System Automatic Theme"
                    aria-label="System Automatic Theme"
                  >
                    <Monitor size={14} className="shrink-0" />
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setTheme('dark'); setHighContrast(false); }} 
                    className={`w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg shrink-0 transition-all cursor-pointer focus:outline-none ${
                      !highContrast && theme === 'dark' 
                        ? 'bg-emerald-500 text-black font-bold shadow-xs' 
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                    title="Obsidian Dark Mode"
                    aria-label="Obsidian Dark Mode"
                  >
                    <Moon size={14} className="shrink-0" />
                  </button>
                </div>

                {/* High Contrast Toggle */}
                <button 
                  onClick={() => setHighContrast(!highContrast)}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl font-bold transition border text-xs shrink-0 ${highContrast ? 'bg-emerald-600 text-black border-transparent shadow-sm' : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#2a2d33] border-gray-200 dark:border-slate-700'}`}
                  title="Toggle High Contrast Display Mode"
                >
                  <Eye size={13} />
                  <span className="hidden xl:inline">Contrast</span>
                </button>

                {/* Jumbotron Mode Toggle */}
                <button 
                  onClick={() => setIsJumbotronMode(true)}
                  className="flex items-center gap-1 sm:gap-1.5 bg-emerald-600/10 text-emerald-500 hover:bg-emerald-600/20 px-2 sm:px-2.5 py-1.5 rounded-xl font-bold transition border border-emerald-500/30 text-xs shrink-0"
                  title="TV / Spectator Mode"
                >
                  <Tv size={13} />
                  <span className="hidden xl:inline">TV Mode</span>
                </button>

                {/* Voice Announcements & Starting Cadence */}
                <div className="flex items-center bg-gray-100 dark:bg-slate-800 rounded-xl p-1 border border-gray-200 dark:border-slate-700 shrink-0">
                  <button 
                    onClick={() => {
                      const next = !voiceEnabled;
                      setVoiceEnabled(next);
                      setAudioConfig(prev => {
                        const updated = { ...prev, enabled: next };
                        saveAudioConfig(updated);
                        return updated;
                      });
                      if (!next && ('speechSynthesis' in window)) {
                        window.speechSynthesis.cancel();
                      }
                    }}
                    className={`flex items-center gap-1 sm:gap-1.5 px-2 py-1 rounded-lg text-xs font-bold transition ${
                      voiceEnabled ? 'bg-emerald-600/20 text-emerald-500' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                    }`}
                    title={voiceEnabled ? "Mute Audio & Announcements" : "Enable Audio & Announcements"}
                  >
                    {voiceEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                    <span className="hidden 2xl:inline">Audio</span>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-black/10 dark:bg-white/10">{voiceEnabled ? 'ON' : 'OFF'}</span>
                  </button>

                  <button
                    onClick={() => setShowAudioSettingsModal(true)}
                    className="p-1 sm:p-1.5 rounded-lg text-gray-500 hover:text-emerald-500 hover:bg-gray-200 dark:hover:bg-slate-700 transition"
                    title="Configure Lead-in Beeps, Starter Sounds & Multilingual Coach Profiles"
                  >
                    <Sliders size={13} />
                  </button>
                </div>

                {/* Bluetooth Low Energy (BLE) Heart Rate Telemetry Pill */}
                <button
                  onClick={() => setShowBleModal(true)}
                  className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-bold transition border shadow-sm shrink-0 ${
                    isBleConnected && liveBleBpm > 0 
                      ? 'bg-rose-500/15 text-rose-500 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/25' 
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700 border-gray-200 dark:border-slate-700'
                  }`}
                  title={isBleConnected ? `Connected: ${bleDeviceName || 'Bluetooth HRM'} (${liveBleBpm} BPM)` : "Connect Bluetooth Heart Rate Sensor (Polar H10, Garmin HRM)"}
                >
                  <Heart size={13} className={isBleConnected && liveBleBpm > 0 ? "text-rose-500 fill-rose-500 animate-pulse" : "text-gray-400"} />
                  <span className="font-mono text-xs">{isBleConnected && liveBleBpm > 0 ? `${liveBleBpm} BPM` : 'BLE'}</span>
                  {isBleConnected && liveBleZone?.zone > 0 && (
                    <span className="text-[9px] font-mono font-bold px-1 py-0.2 rounded bg-black/10 dark:bg-white/10 text-rose-500 dark:text-rose-300">
                      Z{liveBleZone.zone}
                    </span>
                  )}
                </button>

                {/* Multi-Device Live Field Sync Pill (Desktop) */}
                <button
                  onClick={() => setShowMultiDeviceSyncModal(true)}
                  className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-bold transition border shadow-sm shrink-0 ${
                    connectedStations.length > 1
                      ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30 hover:bg-sky-500/25'
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white border-gray-200 dark:border-slate-700'
                  }`}
                  title={`Multi-Device Field Sync (${connectedStations.length || 1} Stations Connected)`}
                >
                  <Radio size={13} className={connectedStations.length > 1 ? "text-sky-500 animate-pulse" : "text-emerald-500"} />
                  <span className="font-mono text-xs hidden sm:inline uppercase">
                    {stationRole === 'master' ? 'CONSOLE' : stationRole === 'marshall' ? 'MARSHALL' : stationRole === 'camera' ? 'CAMERA' : 'MIRROR'}
                  </span>
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-black/10 dark:bg-white/10 text-emerald-600 dark:text-emerald-400">
                    {connectedStations.length || 1} STATIONS
                  </span>
                </button>

                {/* Real Hardware Timing Gate Status Pill */}
                <button
                  onClick={() => setShowGateConnectionModal(true)}
                  className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-bold transition border shadow-sm shrink-0 ${
                    statusB?.online || isSerialConnected || isSprintGateBleConnected
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
                      : statusB?.timedOut
                      ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/25'
                      : statusB?.reconnecting
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 animate-pulse'
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700 border-gray-200 dark:border-slate-700'
                  }`}
                  title={
                    isSerialConnected 
                      ? 'Hardware Connected via Direct USB-C Cable (0ms)' 
                      : statusB?.online 
                      ? `Hardware Connected via Wi-Fi Hotspot (${nodeB})` 
                      : isSprintGateBleConnected
                      ? 'Hardware Connected via BLE'
                      : statusB?.timedOut
                      ? 'Hardware connection timed out after 60s • Click to retry'
                      : "Timing Gate Offline • Click to configure Wi-Fi / USB-C connection"
                  }
                >
                  <Wifi size={13} className={statusB?.online || isSerialConnected || isSprintGateBleConnected ? "text-emerald-500" : statusB?.timedOut ? "text-rose-500" : "text-gray-400"} />
                  <span className="font-mono text-xs hidden sm:inline">
                    {isSerialConnected ? 'USB-C GATE' : statusB?.online ? 'WI-FI GATE' : 'TIMING GATE'}
                  </span>
                  <span className={`text-[9px] font-mono font-bold px-1 py-0.2 rounded ${
                    statusB?.online || isSerialConnected || isSprintGateBleConnected
                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300'
                      : statusB?.timedOut
                      ? 'bg-rose-500/20 text-rose-600 dark:text-rose-300'
                      : 'bg-black/10 dark:bg-white/10 text-gray-400'
                  }`}>
                    {isSerialConnected ? '0ms' : statusB?.online ? 'ONLINE' : statusB?.timedOut ? 'TIMED OUT' : statusB?.reconnecting ? 'RETRY' : 'OFF'}
                  </span>
                </button>
              </div>

              {/* Persistent Network & Cloud Sync Status Badge */}
              {!offlineTelemetryStatus.isOnline ? (
                <button
                  onClick={() => handleSyncOfflineQueue(false)}
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/40 transition shadow-[0_0_10px_rgba(245,158,11,0.2)] shrink-0"
                  title="Operating Offline — telemetry & sprint runs are securely cached locally and auto-sync on reconnect"
                >
                  <WifiOff size={13} className="text-amber-400 shrink-0" />
                  <span className="font-mono text-xs">OFFLINE</span>
                  {totalUnsyncedRunsCount > 0 && (
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300">
                      {totalUnsyncedRunsCount} QUEUED
                    </span>
                  )}
                </button>
              ) : totalUnsyncedRunsCount > 0 ? (
                <button
                  onClick={() => handleSyncOfflineQueue(false)}
                  disabled={isSyncingOfflineQueue || offlineTelemetryStatus.isSyncing}
                  className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-amber-300 border border-amber-500/50 transition shadow-[0_0_15px_rgba(245,158,11,0.25)] animate-pulse shrink-0 cursor-pointer"
                  title="Click for instant 1-click cloud sync of all offline sprint evaluations and telemetry"
                >
                  <RefreshCw size={12} className={(isSyncingOfflineQueue || offlineTelemetryStatus.isSyncing) ? "animate-spin text-amber-300" : "text-amber-400"} />
                  <span className="font-mono font-black">
                    {totalUnsyncedRunsCount} QUEUED
                  </span>
                  <span className="text-[10px] font-bold text-amber-400/90 uppercase hidden sm:inline">• SYNC NOW</span>
                </button>
              ) : (
                <button
                  onClick={() => handleSyncOfflineQueue(false)}
                  disabled={isSyncingOfflineQueue || offlineTelemetryStatus.isSyncing}
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 transition shadow-xs shrink-0 cursor-pointer"
                  title="Cloud Synchronized — Firebase Firestore live. Click to verify sync status."
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399] animate-pulse" />
                  <Wifi size={12} className="text-emerald-500 shrink-0" />
                  <span className="font-mono text-xs hidden sm:inline">CLOUD SYNCED</span>
                  <span className="font-mono text-xs sm:hidden">SYNCED</span>
                </button>
              )}
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row justify-between items-start gap-4 md:gap-0">
            <div>
              <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight flex items-center gap-2 sm:gap-3 flex-wrap">
                  <span style={{ color: 'var(--accent-color)' }}>{testModeDetails.titleFirst}</span>
                  <span className="text-gray-900 dark:text-white">{testModeDetails.titleSecond}</span>
                </h1>
                <span className="text-[10px] sm:text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 uppercase tracking-wider">
                  {testModeDetails.badge}
                </span>
                <div 
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shadow-sm ${
                    statusA.online && statusB.online 
                      ? 'bg-emerald-600/10 text-emerald-500' 
                      : (statusA.online || statusB.online) 
                      ? 'bg-amber-500/10 text-amber-500' 
                      : 'bg-red-500/10 text-red-500'
                  }`} 
                  title={
                    statusA.online && statusB.online 
                      ? 'Dual Gates Synchronized & Ready' 
                      : statusA.online 
                      ? 'Start Gate Online • Finish Gate Offline' 
                      : statusB.online 
                      ? 'Finish Gate Online • Start Gate Offline' 
                      : 'Timing Gates Offline'
                  }
                >
                  <CheckCircle2 size={17} />
                </div>
              </div>
              <div className="text-xs sm:text-sm md:text-base text-gray-600 dark:text-slate-400 mt-1 font-medium flex items-center gap-2 sm:gap-3 flex-wrap">
                <span>{testModeDetails.subtitle}</span>
                <button
                  type="button"
                  onClick={() => setShowWindModal(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/25 shadow-sm transition-all cursor-pointer"
                  title={windSpeed ? `Track Wind: ${windSpeed} m/s (Click to adjust or auto-fetch GPS)` : "Click to auto-fetch GPS wind or enter manually"}
                >
                  <Wind size={12} className="text-sky-500" />
                  <span>{windSpeed ? `${windSpeed} m/s` : 'Set Wind'}</span>
                  {windMeta?.directionCardinal && (
                    <span className="text-[10px] text-sky-600 dark:text-sky-400 font-sans font-black">
                      {windMeta.directionCardinal}
                    </span>
                  )}
                  {windMode === 'auto' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" title="Auto GPS Synced"></span>
                  )}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 shrink-0">
              <button 
                onClick={() => {
                  const targetRun = results[0] || (history.length > 0 && history[0]) || null;
                  if (!targetRun) {
                    alert("No sprint runs recorded yet to audit. Complete a timed trial to audit reaction time.");
                    return;
                  }
                  setAuditRunData({
                    reactionTime: targetRun.reactionTime || null,
                    name: targetRun.name || activeRunner?.name || 'Sprint Athlete',
                    distance: targetRun.distance || trackDistance || 40,
                    starterHoldTime: targetRun.starterHoldTime || null
                  });
                }}
                className="hidden lg:flex items-center gap-1.5 sm:gap-2 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border border-amber-500/30 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl transition text-[11px] sm:text-xs font-bold tracking-wider uppercase whitespace-nowrap shadow-sm"
                title="World Athletics Rule TR 16.7 Reaction Time & False Start Auditor"
              >
                <ShieldCheck size={14} className="text-amber-500" />
                WA TR 16.7 Audit
              </button>

              <button 
                onClick={() => setShowBleacherQRModal(true)}
                className="hidden md:flex items-center gap-1.5 sm:gap-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-emerald-500 border border-slate-200 dark:border-slate-700 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl transition text-[11px] sm:text-xs font-bold tracking-wider uppercase whitespace-nowrap shadow-sm"
                title="Show QR Code for Bleacher Spectators"
              >
                <Smartphone size={14} className="text-emerald-500" />
                Bleacher Stream
              </button>

              <button 
                onClick={() => setIsStadiumMode(true)}
                className="hidden md:flex items-center gap-1.5 sm:gap-2 bg-emerald-600/10 text-emerald-500 hover:bg-emerald-600/20 border border-[#00D084]/30 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl transition text-[11px] sm:text-xs font-bold tracking-wider uppercase whitespace-nowrap shadow-[0_0_20px_rgba(0,208,132,0.1)]"
              >
                <Monitor size={14} />
                Stadium Display
              </button>
              
              <div className="flex items-center gap-6 text-sm shrink-0">
                <div>
                  <div className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100">{queue.length}</div>
                  <div className="text-[10px] text-slate-500 font-bold tracking-widest uppercase mt-0.5">QUEUED</div>
                </div>
                <div>
                  <div className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100">{results.length < 10 && results.length > 0 ? '0' : ''}{results.length}</div>
                  <div className="text-[10px] text-slate-500 font-bold tracking-widest uppercase mt-0.5">COMPLETED</div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Content Grid */}
        <div className="flex-1 overflow-y-auto min-h-0 px-3 sm:px-6 md:px-8 pb-6 flex flex-col gap-5">

          {activeTab === 'live' ? (
            <div className="flex flex-col gap-3 flex-1 min-h-[380px]">
              
              {/* Mobile 3-Zone Perspective Switcher: Left Cockpit | Center Live Timer | Right Athlete Queue */}
              <div className="flex md:hidden items-center justify-between bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-1 gap-1 shadow-sm">
                <button
                  type="button"
                  onClick={() => setMobileArenaTab('cockpit')}
                  className={`flex-1 py-2 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    mobileArenaTab === 'cockpit'
                      ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/40 shadow-xs'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                  title="View Cockpit HUD (Tachometer, G-Force & Telemetry)"
                >
                  <Gauge size={14} className={mobileArenaTab === 'cockpit' ? 'text-cyan-500' : 'text-gray-400'} />
                  <span>Cockpit</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMobileArenaTab('timer')}
                  className={`flex-1 py-2 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    mobileArenaTab === 'timer'
                      ? 'bg-emerald-600 text-black shadow-sm font-extrabold'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                  title="View Live Precision Timing Clock & Controls"
                >
                  <Zap size={14} className={mobileArenaTab === 'timer' ? 'fill-black' : 'text-gray-400'} />
                  <span>Live Timer</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMobileArenaTab('queue')}
                  className={`flex-1 py-2 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    mobileArenaTab === 'queue'
                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40 shadow-xs'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                  title="View Athlete Staging Queue & Roster"
                >
                  <Users size={14} className={mobileArenaTab === 'queue' ? 'text-emerald-500' : 'text-gray-400'} />
                  <span>Queue {queue.length > 0 && `(${queue.length})`}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4 lg:gap-5 flex-1 min-h-[380px]">
              
              {/* 60-Second Post-Sprint Heart Rate Recovery Protocol Card */}
              {activeHrrSession && (
                <div className="col-span-1 md:col-span-3 bg-gradient-to-r from-rose-950/40 via-slate-900 to-slate-900 border border-rose-500/30 rounded-2xl p-4 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                          <Heart size={20} className="animate-pulse" />
                        </div>
                        <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-slate-900 border border-rose-500/50 flex items-center justify-center text-[9px] font-bold text-rose-300">
                          HR
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white tracking-wide">{activeHrrSession.athleteName}</span>
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            60s HRR PROTOCOL
                          </span>
                          {activeHrrSession.status === 'completed' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                              <Check size={10} /> {activeHrrSession.rating}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-3">
                          <span>Peak: <strong className="text-rose-400 font-mono">{activeHrrSession.peakBpm} bpm</strong></span>
                          <span>Current: <strong className="text-white font-mono">{activeHrrSession.currentBpm} bpm</strong></span>
                          <span>Drop: <strong className="text-emerald-400 font-mono">-{Math.max(0, activeHrrSession.peakBpm - activeHrrSession.currentBpm)} bpm</strong></span>
                          {activeHrrSession.hrr30 !== null && (
                            <span className="hidden md:inline text-slate-500">| HRR30: <strong className="text-cyan-400 font-mono">-{activeHrrSession.hrr30}</strong></span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
                      {/* Progress Bar & Countdown */}
                      <div className="flex flex-col items-end mr-1">
                        <div className="text-[10px] font-mono font-bold text-rose-300">
                          {Math.max(0, 60 - activeHrrSession.elapsedSeconds)}s remaining
                        </div>
                        <div className="w-24 sm:w-28 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1 border border-slate-700">
                          <div 
                            className="h-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-400 transition-all duration-1000 ease-linear rounded-full"
                            style={{ width: `${Math.min(100, (activeHrrSession.elapsedSeconds / 60) * 100)}%` }}
                          />
                        </div>
                      </div>

                      {activeHrrSession.status === 'monitoring' ? (
                        <button
                          onClick={handleLogHrrEarly}
                          className="px-2.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 rounded-xl text-[11px] font-bold transition flex items-center gap-1"
                          title="Log current heart rate recovery and finish protocol"
                        >
                          <Check size={12} /> Log Now
                        </button>
                      ) : null}

                      <button
                        onClick={handleDismissHrr}
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                        title="Dismiss recovery monitor"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Live Timing & Cockpit Panel (Left & Center on Tablet / Desktop) */}
              <div className={`col-span-1 md:col-span-2 border rounded-2xl p-3 sm:p-5 md:p-6 flex-col relative overflow-visible shadow-sm self-start md:sticky md:top-4 z-40 transition-colors duration-200 ${mobileArenaTab === 'queue' ? 'hidden md:flex' : 'flex'} ${beamFlash ? 'bg-emerald-600/20 border-[#00D084]' : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800'}`}>
                <div className={`absolute top-20 right-5 z-50 group ${isCameraActive ? 'block' : 'hidden'}`}>
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="w-28 md:w-40 rounded-xl border border-gray-200 dark:border-slate-700 opacity-90 shadow-2xl object-cover bg-black" 
                  />
                  <button 
                    onClick={() => toggleCamera()}
                    className="absolute -top-2.5 -right-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 rounded-full p-1 shadow-lg hover:text-red-500 transition-colors z-[60]"
                  >
                    <X size={13} strokeWidth={3} />
                  </button>
                </div>

                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-4 sm:mb-5 relative z-[60] gap-2.5 sm:gap-3">
                  <div className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 font-bold tracking-widest uppercase flex items-center gap-2 shrink-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    LIVE TIMING
                  </div>

                  {/* Top Center Athletic Test Protocol & Track Distance Selector */}
                  <div className="w-full lg:w-auto flex justify-center order-last lg:order-none">
                    <LiveTestModeSelector
                      testMode={testMode}
                      onChangeTestMode={handleTestModeChange}
                      trackDistance={trackDistance}
                      onChangeTrackDistance={handleTrackDistanceChange}
                    />
                  </div>
                  
                  <div className="flex items-center gap-2 sm:gap-3 shrink-0 flex-wrap">
                    <button onClick={toggleCamera} className="bg-white dark:bg-slate-800 p-1.5 sm:p-2 rounded-xl border border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300 transition" title="Toggle Live Timing Camera Feed">
                      {isCameraActive ? <Camera size={16} className="text-emerald-500" /> : <CameraOff size={16} />}
                    </button>
                    {isCameraActive && (
                      <button onClick={switchCamera} title="Switch Camera" className="bg-white dark:bg-slate-800 p-1.5 sm:p-2 rounded-xl border border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300 transition">
                        <RefreshCcw size={16} />
                      </button>
                    )}

                    <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-2.5 sm:px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-700">
                    <div className={`w-2 h-2 rounded-full ${
                      sequenceState === 'false_start' ? 'bg-red-500' : 
                      sequenceState === 'lead_in' ? 'bg-sky-400 animate-pulse' :
                      sequenceState === 'marks' || sequenceState === 'set' ? 'bg-yellow-400 animate-pulse' :
                      sequenceState === 'waiting_start' ? 'bg-amber-400 animate-ping' :
                      sequenceState === 'finished' ? 'bg-emerald-500' :
                      isRunning ? 'bg-red-500 animate-pulse' : 'bg-emerald-600'
                    }`}></div>
                    <span className="text-xs sm:text-sm text-gray-800 dark:text-gray-200 font-bold tracking-wide">
                      {sequenceState === 'false_start' ? (falseStartReason ? `FALSE START: ${falseStartReason}` : 'FALSE START!') : 
                       sequenceState === 'lead_in' ? `Cadence: Beep ${cadenceBeepCount}...` :
                       sequenceState === 'marks' ? 'On Your Marks...' : 
                       sequenceState === 'set' ? 'Set...' : 
                       sequenceState === 'waiting_start' ? 'Gun Fired — Awaiting Start Beam...' :
                       sequenceState === 'finished' ? 'FINISHED!' :
                       isRunning ? 'Sprint in progress...' : 'Ready'}
                    </span>
                  </div>
                </div>
              </div>
                
                {/* Big Clock & Cockpit HUD Arena */}
                <div className="flex-1 flex flex-col items-center justify-center relative w-full">
                  
                  {/* DUAL COCKPIT ARENA: COCKPIT HUD (LEFT) + PRECISION LIVE TIMER (CENTER) */}
                  <div className="w-full flex flex-col md:flex-row items-center md:items-start justify-center gap-3 sm:gap-4 lg:gap-5 relative z-10 my-1 sm:my-2">
                    
                    {/* LEFT COLUMN: COCKPIT HUD (Speedometer, G-Force Radar & 4-Box Telemetry Matrix) */}
                    <div className={`w-full md:w-60 lg:w-72 xl:w-80 shrink-0 flex-col justify-start order-2 md:order-1 ${mobileArenaTab === 'cockpit' ? 'flex' : 'hidden md:flex'}`}>
                      <CockpitHUD
                        trackDistance={trackDistance}
                        displayTime={displayTime}
                        isRunning={isRunning}
                        sequenceState={sequenceState}
                        activeRunner={activeRunner}
                        liveSplits={liveSplits}
                        history={history}
                        results={results}
                        className="h-full"
                      />
                    </div>

                    {/* CENTER COLUMN: PRECISION LIVE TIMER ENGINE & ACTION CONTROLS */}
                    <div className={`flex-1 flex-col items-center justify-center relative min-w-0 w-full order-1 md:order-2 ${mobileArenaTab === 'timer' ? 'flex' : 'hidden md:flex'}`}>
                      <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-2xl z-0">
                        <div className="absolute w-[120%] h-[120px] bg-gradient-to-r from-transparent via-[#00D084]/5 to-transparent -rotate-6 top-1/2 -translate-y-1/2 -left-[10%]"></div>
                      </div>
                  
                  {/* Minimalist & Stylish 3-Light Traffic Indicator (Node A, Node B, Gate Online/Offline) */}
                  <GateTrafficLights
                    statusA={statusA}
                    statusB={statusB}
                    setStatusA={setStatusA}
                    setStatusB={setStatusB}
                    trackDistance={trackDistance}
                    nodeA={nodeA}
                    nodeB={nodeB}
                    isSerialConnected={isSerialConnected}
                    isBleConnected={isSprintGateBleConnected}
                    onOpenConnectionModal={() => setShowGateConnectionModal(true)}
                  />
                  
                  <div className="text-gray-500 text-[11px] md:text-xs font-bold tracking-[0.3em] uppercase mb-2 md:mb-3 z-10">Elapsed Time</div>
                  
                  {/* Dedicated Red HUD Alert Banner (World Athletics Rule 161.2) */}
                  {sequenceState === 'false_start' && (
                    <div className="w-full max-w-2xl my-3 px-4 py-3.5 bg-gradient-to-r from-red-950/95 via-rose-950/90 to-red-950/95 border-2 border-red-500 rounded-2xl shadow-[0_0_35px_rgba(239,68,68,0.45)] flex flex-col items-center text-center animate-pulse z-30">
                      <div className="flex items-center gap-2 text-red-400 font-mono font-black text-xs uppercase tracking-widest mb-1">
                        <AlertTriangle size={16} className="text-red-400 animate-bounce" />
                        <span>WORLD ATHLETICS RULE 161.2: FALSE START DETECTED</span>
                      </div>
                      <div className="text-xl sm:text-2xl font-black text-white tracking-tight">
                        REACTION TIME &lt; 0.100s THRESHOLD • SPRINT RECALLED
                      </div>
                      <div className="text-xs font-mono text-red-200 font-bold mt-1 bg-red-950/80 px-3.5 py-1 rounded-full border border-red-500/40">
                        {falseStartReason || "Illegal movement or premature beam break before physiological 0.100s threshold"}
                      </div>
                      <div className="text-[10px] font-mono text-red-400/90 mt-1.5 flex items-center gap-1.5">
                        <Volume2 size={12} />
                        <span>Automated Secondary Recall Horn Broadcasted • Gates Reset Required</span>
                      </div>
                    </div>
                  )}

                  <div className="relative flex items-baseline justify-center">
                    <PrecisionClockDisplay 
                      time={displayTime}
                      sequenceState={sequenceState}
                      variant="cockpit"
                    />
                  </div>
                  
                  <div className="mt-4 md:mt-5 flex justify-center z-10 w-full">
                    <div className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-4 py-1.5 flex items-center gap-2.5 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 shadow-sm">
                      <User size={14} className="text-emerald-500" />
                      <span>{activeRunner.name !== 'No runner in queue' ? activeRunner.name : 'No Runner Queued'}</span>
                      {activeRunner.name !== 'No runner in queue' && (
                        <>
                          <div className="w-1 h-1 bg-slate-300 dark:bg-slate-600 rounded-full mx-1"></div>
                          <span className="font-mono font-bold text-slate-500 dark:text-slate-400">ID: {activeRunner.bib}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Primary Action Controls: Start Sequence, Gun / Horn, Audio Settings & Reset */}
                  {isAdmin && (
                    <div className="flex flex-col gap-2.5 mt-4 sm:mt-5 md:mt-6 relative z-10 w-full max-w-xl mx-auto">
                      {/* Quick Starter Trigger & Sound Selector Strip */}
                      <div className="flex flex-wrap items-center justify-between gap-1.5 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-gray-200 dark:border-slate-700/80 shadow-xs">
                        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
                          <button
                            type="button"
                            onClick={() => {
                              const updated = { ...audioConfig, starterSound: 'gun' };
                              setAudioConfig(updated);
                              saveAudioConfig(updated);
                            }}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                              (audioConfig?.starterSound || 'gun') === 'gun'
                                ? 'bg-rose-500/20 text-rose-500 dark:text-rose-400 border border-rose-500/40 shadow-xs'
                                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                            }`}
                            title="Select 9mm Electronic Starter Gun"
                          >
                            <Zap size={12} className={(audioConfig?.starterSound || 'gun') === 'gun' ? 'text-rose-500' : 'text-gray-400'} />
                            <span>9mm Gun</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const updated = { ...audioConfig, starterSound: 'horn' };
                              setAudioConfig(updated);
                              saveAudioConfig(updated);
                            }}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                              audioConfig?.starterSound === 'horn'
                                ? 'bg-amber-500/20 text-amber-500 dark:text-amber-400 border border-amber-500/40 shadow-xs'
                                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                            }`}
                            title="Select Electronic Starting Horn"
                          >
                            <Volume2 size={12} className={audioConfig?.starterSound === 'horn' ? 'text-amber-500' : 'text-gray-400'} />
                            <span>Horn</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const updated = { ...audioConfig, starterSound: 'whistle' };
                              setAudioConfig(updated);
                              saveAudioConfig(updated);
                            }}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                              audioConfig?.starterSound === 'whistle'
                                ? 'bg-sky-500/20 text-sky-500 dark:text-sky-400 border border-sky-500/40 shadow-xs'
                                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                            }`}
                            title="Select Referee Whistle"
                          >
                            <Megaphone size={12} className={audioConfig?.starterSound === 'whistle' ? 'text-sky-500' : 'text-gray-400'} />
                            <span>Whistle</span>
                          </button>

                          {audioConfig?.customSounds?.trigger?.data && (
                            <button
                              type="button"
                              onClick={() => {
                                const updated = { ...audioConfig, starterSound: 'custom' };
                                setAudioConfig(updated);
                                saveAudioConfig(updated);
                              }}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                                audioConfig?.starterSound === 'custom'
                                  ? 'bg-emerald-500/20 text-emerald-500 dark:text-emerald-400 border border-emerald-500/40 shadow-xs'
                                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                              }`}
                              title="Select Custom Audio Trigger"
                            >
                              <Flame size={12} className={audioConfig?.starterSound === 'custom' ? 'text-emerald-500' : 'text-gray-400'} />
                              <span>Custom</span>
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0 ml-auto">
                          {/* 1-Click Audio Preview / Test Button */}
                          <button
                            type="button"
                            onClick={triggerConfiguredStarterSound}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold text-gray-700 dark:text-gray-300 hover:text-emerald-500 hover:bg-emerald-500/10 transition border border-transparent hover:border-emerald-500/30 cursor-pointer"
                            title="Instant Audio Preview — Test sound output at track speaker volume without starting race sequence"
                          >
                            <Play size={11} className="fill-current text-emerald-500" />
                            <span className="text-[11px]">Test</span>
                          </button>

                          {/* Instant Gun vs Cadence Toggle */}
                          <button
                            type="button"
                            onClick={() => {
                              const nextInstant = !audioConfig?.instantGun;
                              const updated = { ...audioConfig, instantGun: nextInstant };
                              setAudioConfig(updated);
                              saveAudioConfig(updated);
                            }}
                            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition border cursor-pointer ${
                              audioConfig?.instantGun
                                ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/40 shadow-xs'
                                : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 border-transparent hover:text-gray-900 dark:hover:text-gray-200'
                            }`}
                            title={audioConfig?.instantGun ? "Instant Gun Mode: 0s delay, immediate trigger on start button" : "Cadence Mode: Full voice countdown (Marks -> Set -> Gun)"}
                          >
                            <Zap size={11} className={audioConfig?.instantGun ? "text-emerald-500" : "text-gray-400"} />
                            <span className="text-[10px] font-mono">{audioConfig?.instantGun ? 'INSTANT' : 'CADENCE'}</span>
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-nowrap items-center justify-between gap-1.5 sm:gap-2.5 w-full">
                        {/* 1. START HORN / STARTER SOUND (IN START / LEFT) */}
                        <button 
                          onClick={triggerConfiguredStarterSound}
                          className={`flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2.5 sm:py-3.5 rounded-xl border-2 font-bold text-xs sm:text-sm transition shadow-sm shrink-0 cursor-pointer ${
                            (audioConfig?.starterSound === 'custom')
                              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 hover:bg-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                              : (audioConfig?.starterSound === 'gun')
                              ? 'border-rose-500/40 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 shadow-[0_0_12px_rgba(244,63,94,0.15)]'
                              : (audioConfig?.starterSound === 'whistle')
                              ? 'border-sky-500/40 bg-sky-500/10 text-sky-500 dark:text-sky-400 hover:bg-sky-500/20 shadow-[0_0_12px_rgba(14,165,233,0.15)]'
                              : 'border-amber-500/40 bg-amber-500/10 text-amber-500 dark:text-amber-400 hover:bg-amber-500/20 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                          }`}
                          title={`Trigger ${(audioConfig?.starterSound === 'custom') ? 'Custom MP3 Audio Trigger' : (audioConfig?.starterSound === 'gun') ? '9mm Starter Gun' : (audioConfig?.starterSound === 'whistle') ? 'Referee Whistle' : 'Electronic Starter Horn'} (Set in Audio & Starting Cadence menu)`}
                        >
                          {(audioConfig?.starterSound === 'custom') ? (
                            <Zap size={15} className="text-emerald-400 animate-pulse shrink-0" />
                          ) : (audioConfig?.starterSound === 'gun') ? (
                            <Megaphone size={15} className="shrink-0" />
                          ) : (audioConfig?.starterSound === 'whistle') ? (
                            <Megaphone size={15} className="text-sky-400 shrink-0" />
                          ) : (
                            <Volume2 size={15} className="text-amber-400 animate-pulse shrink-0" />
                          )}
                          <span className="whitespace-nowrap">
                            {(audioConfig?.starterSound === 'custom') ? 'Custom' :
                             (audioConfig?.starterSound === 'gun') ? 'Starter Gun' : 
                             (audioConfig?.starterSound === 'whistle') ? 'Whistle' : 
                             'Start Horn'}
                          </span>
                        </button>

                        {/* 2. START SEQUENCE BUTTON (BELOW TIMER IN CENTER) */}
                        <button 
                          onClick={handleArmAndStart}
                          className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2.5 px-3 sm:px-6 py-2.5 sm:py-3.5 rounded-xl font-bold transition shadow-[0_0_20px_rgba(0,208,132,0.15)] cursor-pointer min-w-0 ${
                            sequenceState !== 'idle'
                              ? 'bg-white dark:bg-slate-800 text-gray-500 border border-gray-200 dark:border-slate-700 cursor-not-allowed'
                              : 'bg-emerald-600 text-black hover:bg-[#00e691]'
                          }`}
                        >
                          <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 ${sequenceState !== 'idle' ? 'bg-gray-800' : 'bg-black/20'}`}>
                            {sequenceState === 'false_start' ? <AlertTriangle size={15} fill="currentColor" /> : <Zap size={15} fill="currentColor" />}
                          </div>
                          <div className="text-left min-w-0">
                            <div className="text-xs sm:text-base font-bold leading-tight truncate">Start Sequence</div>
                            <div className={`hidden sm:block text-[9px] sm:text-[10px] opacity-80 uppercase tracking-widest font-bold mt-0.5 truncate ${sequenceState !== 'idle' ? '' : 'text-black/70'}`}>
                              {sequenceState === 'waiting_start' ? 'Awaiting Start...' : 
                               sequenceState === 'running' ? 'Sprint In Progress...' :
                               sequenceState !== 'idle' ? 'Sequence Active' : 'Spacebar to trigger'}
                            </div>
                          </div>
                        </button>

                        {/* 3. RESET BUTTON */}
                        <button 
                          onClick={handleReset} 
                          className="px-2.5 sm:px-4 py-2.5 sm:py-3.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-bold text-xs sm:text-sm transition bg-white dark:bg-slate-800 shadow-sm shrink-0 cursor-pointer"
                        >
                          Reset
                        </button>

                        {/* 4. AUDIO SETTINGS BUTTON (IN LAST) */}
                        <button 
                          onClick={() => setShowAudioSettingsModal(true)}
                          className="px-2.5 sm:px-3 py-2.5 sm:py-3.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-emerald-500/50 text-slate-500 hover:text-emerald-500 transition bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center cursor-pointer shrink-0"
                          title="Audio & Starting Cadence Settings (Change Sound, Voice & Intervals)"
                        >
                          <Sliders size={16} />
                        </button>
                      </div>
                  </div>
                )}

                    </div>
                  </div>

                  {/* Virtual Simulation Arena for Selected Test Mode (Cleanly situated below primary controls) */}
                  <div className="w-full mt-6 z-10">
                    {['shuttle', 'pro_agility', 'l_drill'].includes(testMode) ? (
                      <div className="flex flex-col items-center z-10 w-full max-w-4xl mx-auto px-1 sm:px-2">
                        <FieldRadarVisualizer 
                          testMode={testMode} 
                          liveSplits={liveSplits} 
                          isRunning={isRunning} 
                          sequenceState={sequenceState} 
                        />
                      </div>
                    ) : testMode === 'mass_sprint' ? (
                      <MassSprintCockpit
                        runnersOnTrack={runnersOnTrack}
                        queue={queue}
                        setQueue={setQueue}
                        timeSinceLastStart={timeSinceLastStart}
                        trackDistance={trackDistance}
                        sequenceState={sequenceState}
                        isRunning={isRunning}
                        liveSplits={liveSplits}
                        formatTime={formatTime}
                        onLaunchNextRunner={handleCockpitLaunchNextRunner}
                        onManualFinishLeading={handleCockpitManualFinishLeadingRunner}
                        onArmAndStart={handleArmAndStart}
                        nodeAStatus={statusA}
                        nodeBStatus={statusB}
                      />
                    ) : testMode === 'rsa' ? (
                      <RSAPerformanceCockpit
                        activeRunner={activeRunner}
                        trackDistance={trackDistance}
                        displayTime={displayTime}
                        isRunning={isRunning}
                        sequenceState={sequenceState}
                        onArmAndStart={handleArmAndStart}
                        onReset={handleReset}
                        onOpenBleModal={() => setShowBleModal(true)}
                        onSaveRsaResult={(rsaData) => {
                          const rsaRun = {
                            id: Date.now(),
                            name: rsaData.athleteName,
                            time: rsaData.bestTime,
                            distance: rsaData.distance,
                            sDec: rsaData.sDec,
                            fatigueIndex: rsaData.fatigueIndex,
                            meanHrr: rsaData.meanHrr,
                            seriesPeakHr: rsaData.seriesPeakHr,
                            reps: rsaData.reps,
                            testMode: 'rsa',
                            createdAt: new Date().toISOString()
                          };
                          setResults(prev => [rsaRun, ...prev]);
                          setHistory(prev => [rsaRun, ...prev]);
                          saveToFirebase(rsaRun);
                          alert(`RSA Series successfully logged for ${rsaData.athleteName}!\nBest Sprint: ${rsaData.bestTime}s • Fatigue Decrement (S_dec): ${rsaData.sDec}%${rsaData.meanHrr ? ` • Mean HR Recovery: ▼${rsaData.meanHrr} bpm` : ''}\nSaved to session results.`);
                        }}
                      />
                    ) : (
                      <div className="w-full flex flex-col items-center z-10">
                        {/* Futuristic 2D Virtual Track Simulation for Standard Sprint */}
                        <StandardSprintTrackBox
                          trackDistance={trackDistance}
                          displayTime={displayTime}
                          isRunning={isRunning}
                          sequenceState={sequenceState}
                          activeRunner={activeRunner}
                          statusA={statusA}
                          statusB={statusB}
                          liveSplits={liveSplits}
                          windSpeed={windSpeed}
                          windMode={windMode}
                          windMeta={windMeta}
                          surfaceType={surfaceType}
                          history={history}
                          results={results}
                        />

                        {liveSplits.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-3 z-10 justify-center">
                            {liveSplits.map((s, idx) => (
                              <div key={idx} className="bg-white dark:bg-slate-800 border border-[#00D084]/30 rounded-xl px-3 py-1.5 flex items-center gap-2 text-xs font-bold shadow-sm">
                                <span className="text-gray-500">{SPLIT_DISTANCES[s.node] ? `${SPLIT_DISTANCES[s.node]}m` : `Node ${s.node}`}</span>
                                <span className="text-emerald-500 font-mono">{parseFloat(s.time).toFixed(3)}s</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Side Panels: Athlete Queue & Results (Right on Tablet / Desktop) */}
              <div className={`col-span-1 flex-col gap-5 ${mobileArenaTab === 'queue' ? 'flex' : 'hidden md:flex'}`}>
              
              {/* Athlete Queue with Upload & Live Search */}
              <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col min-h-[380px] max-h-[460px] relative">
                <div className="flex justify-between items-center mb-3">
                  <div className="text-xs text-gray-500 font-bold tracking-widest uppercase flex items-center gap-1.5">
                    <Users size={14} className="text-emerald-500" />
                    <span>ATHLETE QUEUE</span>
                    {queue.length > 0 && (
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono px-1.5 py-0.2 rounded-full font-bold">
                        {queue.length}
                      </span>
                    )}
                    <button
                      onClick={() => setShowMultiDeviceSyncModal(true)}
                      className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 flex items-center gap-1 hover:bg-sky-500/20 transition cursor-pointer"
                      title="Multi-Device Hotspot Mesh Sync Active"
                    >
                      <Radio size={10} className="animate-pulse text-sky-500" />
                      <span>MESH SYNC</span>
                    </button>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1.5 items-center">
                      {queue.length > 0 && (
                        <button
                          onClick={() => {
                            if (window.confirm("Clear all athletes from the timing queue?")) {
                              setQueue([]);
                            }
                          }}
                          className="flex items-center gap-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 px-2 py-1 rounded-lg transition text-xs font-bold"
                          title="Clear Queue"
                        >
                          <Trash2 size={12} /> Clear
                        </button>
                      )}
                      <button
                        onClick={() => setShowQueueScanner(true)}
                        className="flex items-center gap-1 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-500 px-2.5 py-1 rounded-lg transition text-xs font-bold"
                        title="Scan Athlete QR Code"
                      >
                        <QrCode size={13} /> QR
                      </button>
                      <div>
                        <input 
                          type="file" 
                          accept=".csv" 
                          id="csv-upload" 
                          className="hidden" 
                          onChange={handleFileUpload} 
                        />
                        <label htmlFor="csv-upload" className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 px-2.5 py-1 rounded-lg cursor-pointer transition text-xs font-bold text-gray-700 dark:text-gray-300">
                          <Upload size={13} /> Import
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {/* Direct Search / Queue Input */}
                <div className="relative mb-3">
                  <div className="flex items-center gap-2 bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700/80 rounded-xl px-3 py-1.5 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 transition shadow-2xs">
                    <Search size={13} className="text-gray-400 shrink-0" />
                    <input
                      type="text"
                      value={queueSearchTerm}
                      onChange={(e) => setQueueSearchTerm(e.target.value)}
                      placeholder="Search to queue (name, bib, squad)..."
                      className="w-full bg-transparent text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none"
                    />
                    {queueSearchTerm && (
                      <button
                        onClick={() => setQueueSearchTerm('')}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5 rounded"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  {/* Search Results Dropdown Overlay */}
                  {queueSearchTerm.trim() && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-2xl p-2 z-50 max-h-56 overflow-y-auto space-y-1 divide-y divide-gray-100 dark:divide-slate-800/60">
                      {searchedRosterAthletes.length === 0 ? (
                        <div className="py-3 text-center text-xs text-gray-400 font-medium">
                          No roster athletes match "{queueSearchTerm}"
                        </div>
                      ) : (
                        searchedRosterAthletes.map(ath => {
                          const isAlreadyQueued = queue.some(q => q.id === ath.id || (ath.name && q.name === ath.name));
                          return (
                            <div key={ath.id || ath.name} className="pt-1.5 first:pt-0 flex items-center justify-between gap-2 p-1.5 hover:bg-gray-50 dark:hover:bg-slate-800/60 rounded-xl transition">
                              <div className="min-w-0 flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0">
                                  {(ath.name || 'A').split(' ').map(n=>n[0]).join('').substring(0,2)}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate flex items-center gap-1.5">
                                    <span>{ath.name}</span>
                                    {isAlreadyQueued && (
                                      <span className="text-[9px] bg-emerald-500/15 text-emerald-500 font-mono px-1 rounded">In Queue</span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-gray-500 truncate flex items-center gap-1.5">
                                    <span className="font-mono">#{ath.bib || 'S1'}</span>
                                    {ath.squad && <span>• {ath.squad}</span>}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => {
                                    addToQueue(ath);
                                    setQueueSearchTerm('');
                                  }}
                                  className="px-2 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 rounded-lg text-[10px] font-bold transition flex items-center gap-1"
                                  title={`Queue ${ath.name} for current test (${testMode})`}
                                >
                                  + Queue
                                </button>
                                <button
                                  onClick={() => {
                                    enqueueAthleteForAllTests(ath, false);
                                    setQueueSearchTerm('');
                                  }}
                                  className="px-2 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded-lg text-[10px] font-bold transition flex items-center gap-1"
                                  title={`Queue ${ath.name} for all 5 tests at once`}
                                >
                                  <Zap size={10} className="fill-current" /> All Tests
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
                
                <div className="flex-1 overflow-y-auto no-scrollbar space-y-3">
                  {queue.length === 0 ? (
                    <div className="flex flex-col gap-2.5 py-1">
                      <div className="h-[68px] rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex flex-col items-center justify-center p-2 text-center">
                        <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5"><Users size={14} /> No athletes in queue</span>
                        <span className="text-[10px] text-slate-400">Search athlete above or scan QR to queue</span>
                      </div>
                      <div className="h-[52px] rounded-2xl border-2 border-dashed border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/20"></div>
                      <div className="h-[40px] rounded-2xl border-2 border-dashed border-slate-50 dark:border-slate-800/30 bg-slate-50/20 dark:bg-slate-900/10"></div>
                    </div>
                  ) : (
                    <>
                      <div className="text-xs text-emerald-500 font-bold tracking-widest uppercase mb-2 flex items-center justify-between">
                        <span>UP NEXT</span>
                        <div className="flex items-center gap-1.5">
                          {queue[0].isCombineBattery || queue[0].battery ? (
                            <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                              <Zap size={10} className="fill-current" /> 5-Test Battery
                            </span>
                          ) : (
                            <button
                              onClick={() => {
                                const current = queue[0];
                                enqueueAthleteForAllTests(current, false);
                              }}
                              className="text-[10px] font-mono bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold transition flex items-center gap-1"
                              title="Upgrade this athlete to all 5 tests at once"
                            >
                              <Zap size={10} /> + All Tests
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="bg-white dark:bg-slate-800 border border-[#00D084]/30 rounded-2xl p-3.5 flex flex-col gap-2 shadow-xs">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-emerald-600/20 text-emerald-500 flex items-center justify-center font-bold text-base shrink-0">
                            {queue[0].name.split(' ').map(n=>n[0]).join('').substring(0,2)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-base font-bold text-gray-900 dark:text-gray-100 truncate">{queue[0].name}</div>
                            <div className="text-xs font-medium text-gray-500 mt-0.5">Bib: {queue[0].bib || 'S1'} | Age: {queue[0].age || 20}</div>
                          </div>
                          <button
                            onClick={() => setQueue(prev => prev.slice(1))}
                            className="text-gray-400 hover:text-red-400 p-1 rounded-lg transition"
                            title="Remove from queue"
                          >
                            <X size={15} />
                          </button>
                        </div>

                        {queue[0].battery && Array.isArray(queue[0].battery) && (
                          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-gray-100 dark:border-slate-700/60">
                            {queue[0].battery.map((b, idx) => {
                              const isCurrent = b.testMode === testMode;
                              return (
                                <span
                                  key={idx}
                                  className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${
                                    b.status === 'completed'
                                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 font-bold'
                                      : isCurrent
                                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-400 font-bold animate-pulse'
                                        : 'bg-slate-800/80 border-slate-700 text-slate-400'
                                  }`}
                                >
                                  {b.testMode === 'standard' ? 'Sprint' : b.testMode === 'shuttle' ? '4x10 Shuttle' : b.testMode === 'pro_agility' ? '5-10-5' : b.testMode === 'l_drill' ? 'L-Drill' : b.testMode === 'rsa' ? 'RSA' : b.testMode}: {
                                    b.status === 'completed' ? `✅ ${b.time}s` : isCurrent ? '⚡ Ready' : '⏳ Queued'
                                  }
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      
                      {queue.slice(1).map((runner, i) => (
                        <div key={i} className="flex items-center gap-2.5 py-2 px-1.5 border-b border-gray-200 dark:border-slate-800 last:border-0 hover:bg-gray-50 dark:hover:bg-slate-800/40 rounded-xl transition">
                          <div className="text-[11px] text-gray-500 font-bold w-4">{(i+2).toString().padStart(2, '0')}</div>
                          <div className="w-7 h-7 rounded-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 flex items-center justify-center font-bold text-[11px] shrink-0">
                            {runner.name.split(' ').map(n=>n[0]).join('').substring(0,2)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-gray-700 dark:text-gray-300 truncate">{runner.name}</div>
                            <div className="text-[10px] font-medium text-gray-500 flex items-center gap-2">
                              <span>Bib #{runner.bib}</span>
                              {runner.battery ? (
                                <span className="text-[9px] text-emerald-400 font-mono font-bold">
                                  {runner.battery.filter(b=>b.status==='completed').length}/{runner.battery.length} Tests
                                </span>
                              ) : (
                                <button
                                  onClick={() => enqueueAthleteForAllTests(runner, false)}
                                  className="text-[9px] text-emerald-600 dark:text-emerald-400 hover:underline font-mono flex items-center gap-0.5"
                                  title="Upgrade to all 5 tests"
                                >
                                  <Zap size={9} /> All Tests
                                </button>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => setQueue(prev => prev.filter((_, idx) => idx !== i + 1))}
                            className="text-gray-400 hover:text-red-400 p-1 rounded transition"
                            title="Remove"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>

              {/* Recent Results */}
              <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl p-8 shadow-sm flex-1 flex flex-col overflow-hidden">
                <div className="flex justify-between items-center mb-6">
                  <div className="text-xs text-gray-500 font-bold tracking-widest uppercase">RECENT RESULTS</div>
                  {results.length > 0 && (
                    <div className="flex gap-2">
                      {isAdmin && (
                        <button 
                          onClick={() => { if(window.confirm('Are you sure you want to clear all results?')) clearAllResults(); }}
                          className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-500 px-3 py-2 rounded-xl transition text-xs font-bold"
                        >
                          <Trash2 size={14} /> Clear All
                        </button>
                      )}
                      <button 
                        onClick={exportPDF}
                        className="flex items-center gap-2 bg-emerald-600/10 border border-[#00D084]/20 hover:bg-emerald-600/20 text-emerald-500 px-3 py-2 rounded-xl transition text-xs font-bold"
                      >
                        <FileText size={14} /> PDF
                      </button>
                      <button 
                        onClick={exportCSV}
                        className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-[#25282f] px-3 py-2 rounded-xl transition text-xs font-bold text-gray-700 dark:text-gray-600 dark:text-gray-300"
                      >
                        <Download size={14} /> CSV
                      </button>
                    </div>
                  )}
                </div>
                
                <div className="flex-1 overflow-y-auto no-scrollbar space-y-4">
                  {results.length === 0 ? (
                    <div className="flex flex-col gap-4">
                      <div className="h-[120px] rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-center">
                        <span className="text-sm text-slate-400 font-medium">Waiting for first sprint result</span>
                      </div>
                      <div className="h-[120px] rounded-2xl border-2 border-dashed border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/20"></div>
                    </div>
                  ) : (
                    results.map((res, idx) => (
                      <div key={idx} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-4 flex flex-col gap-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="text-base font-bold text-gray-900 dark:text-gray-100">{res.name}</div>
                            <div className="text-sm text-emerald-500 font-bold font-mono mt-1">
                              {res.distance || '40'}m - {res.time}s 
                              <span className="text-gray-500 ml-2">({res.velocity || (parseFloat(res.distance || 40) / parseFloat(res.time)).toFixed(2)} m/s)</span>
                            </div>
                            {res.reactionTime > 0 && (
                              <div className="mt-1 flex items-center gap-2">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAuditRunData(res);
                                  }}
                                  className="group inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-xs font-bold font-mono text-amber-500 hover:text-amber-400 transition cursor-pointer"
                                  title="Open World Athletics Rule TR 16.7 Timing & False Start Audit"
                                >
                                  <ShieldCheck size={13} className="text-amber-500 group-hover:scale-110 transition-transform" />
                                  <span>RT: {(res.reactionTime/1000).toFixed(3)}s</span>
                                  <span className="text-[10px] uppercase tracking-wider opacity-80 font-sans border-l border-amber-500/30 pl-1.5">Rule TR 16.7</span>
                                </button>
                              </div>
                            )}
                            {res.splits?.map((split, idx) => (
                              <div key={idx} className="text-xs text-gray-500 font-bold font-mono mt-1">
                                {split.name ? split.name : `Split ${SPLIT_DISTANCES[split.node] ? `${SPLIT_DISTANCES[split.node]}m` : `Node ${split.node}`}`}: {typeof split.time === 'number' ? split.time.toFixed(2) : split.time}s {split.splitTime ? `(+${parseFloat(split.splitTime).toFixed(2)}s)` : ''}
                              </div>
                            ))}
                            <button
                              onClick={() => setSelectedSectorDeltaRun(res)}
                              className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/25 text-[10px] font-mono font-bold text-purple-400 hover:text-purple-300 transition cursor-pointer"
                              title="Inspect Sector Split Deltas & Kinematic Gain/Loss Charts"
                            >
                              <Layers size={11} />
                              <span>Sector Split Deltas</span>
                            </button>
                            {res.agilityAnalytics && (
                              <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-mono">
                                <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                                  LSI: {res.agilityAnalytics.symmetryRatio}%
                                </span>
                                <span className="px-2 py-0.5 rounded-lg bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 font-bold">
                                  Turn Penalty: +{res.agilityAnalytics.turnOverhead}s
                                </span>
                                <span className="px-2 py-0.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 font-bold">
                                  COD Deficit: +{res.agilityAnalytics.codDeficit}s
                                </span>
                              </div>
                            )}

                            {res.windSpeed && (() => {
                              const windCorr = calculateWindCorrection(res.time, res.windSpeed, res.distance || 40);
                              return (
                                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                                  <span className={`px-2 py-0.5 rounded-lg border font-bold ${
                                    windCorr.isLegal
                                      ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                  }`}>
                                    Wind: {res.windSpeed > 0 ? `+${res.windSpeed}` : res.windSpeed} m/s ({windCorr.isLegal ? 'Legal' : 'Assisted'})
                                  </span>
                                  <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-700/60 text-gray-700 dark:text-gray-300 font-bold border border-gray-200 dark:border-slate-600/40" title="Mureika 0.0 m/s calm normalized equivalent">
                                    0-Wind Eq: {windCorr.adjustedTimeFormatted}s ({windCorr.windDeltaFormatted})
                                  </span>
                                </div>
                              );
                            })()}
                            {res.heartRate && (
                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                                <span className="px-2 py-0.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold flex items-center gap-1">
                                  <Heart size={10} className="fill-rose-500 text-rose-500" />
                                  <span>{res.heartRate.bpm} BPM</span>
                                  {res.heartRate.zone > 0 && <span className="opacity-80">({res.heartRate.zoneName || `Zone ${res.heartRate.zone}`})</span>}
                                </span>
                                {res.heartRate.hrr60 !== undefined && res.heartRate.hrr60 !== null ? (
                                  <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold flex items-center gap-1" title={res.heartRate.recoveryRating}>
                                    <span>HRR60: -{res.heartRate.hrr60} BPM</span>
                                    {res.heartRate.recoveryRating && <span className="opacity-80">({res.heartRate.recoveryRating})</span>}
                                  </span>
                                ) : res.heartRate.hrrDrop ? (
                                  <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                                    HRR: -{res.heartRate.hrrDrop} BPM Drop
                                  </span>
                                ) : null}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {!res.firebaseId && (
                              <div className="text-[10px] px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg font-bold text-amber-500 flex items-center gap-1" title="Stored locally. Click 'Unsynced' in header to sync.">
                                <WifiOff size={10} />
                                <span>Queued</span>
                              </div>
                            )}
                            <div className="text-xs px-3 py-1.5 bg-[#25282f] rounded-lg font-bold uppercase text-gray-700 dark:text-gray-600 dark:text-gray-300">
                              {res.standing}
                            </div>
                            <button 
                              onClick={() => shareResultWhatsApp(res)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-black transition"
                              title="Share Evaluation via WhatsApp"
                            >
                              <MessageSquare size={14} />
                            </button>
                            <button 
                              onClick={() => shareResultEmail(res)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg bg-sky-500/10 text-sky-400 hover:bg-sky-500 hover:text-black transition"
                              title="Email Report to Athlete/Parents"
                            >
                              <Mail size={14} />
                            </button>
                            <button 
                              onClick={() => {
                                setSelectedFvpRun(res);
                                setShowFvpModal(true);
                              }}
                              className="w-8 h-8 flex items-center justify-center rounded-lg bg-teal-500/10 text-teal-400 hover:bg-teal-500 hover:text-black transition"
                              title="Compute Force-Velocity-Power (F-v-P) Profile"
                            >
                              <Activity size={14} />
                            </button>
                            {res.reactionTime > 0 && (
                              <button 
                                onClick={() => setAuditRunData(res)}
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-black transition"
                                title="Audit Reaction Time against World Athletics Rule TR 16.7"
                              >
                                <ShieldCheck size={14} />
                              </button>
                            )}
                            <button 
                              onClick={() => setSelectedSectorDeltaRun(res)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500 hover:text-white transition"
                              title="Inspect Sector Split Deltas & Kinematic Gain/Loss Charts"
                            >
                              <Layers size={14} />
                            </button>
                            <button 
                              onClick={() => exportAthletePDF(res)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-600/10 text-emerald-500 hover:bg-emerald-600/20 transition"
                              title="Download Athlete Report"
                            >
                              <Download size={14} />
                            </button>
                            {isAdmin && (
                              <button 
                                onClick={() => { if(window.confirm('Delete this result?')) removeResult(res, idx); }}
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition"
                                title="Delete Result"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 font-medium leading-relaxed">
                          {res.focus}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      ) : activeTab === 'roster' ? (
            <React.Suspense fallback={
              <div className="flex flex-col items-center justify-center py-24 text-emerald-400 gap-3">
                <Loader2 className="animate-spin text-[#00D084]" size={36} />
                <span className="text-xs font-semibold tracking-wider uppercase text-slate-400">Loading Team Portal & Roster...</span>
              </div>
            }>
              <TeamPortal
                roster={roster}
                setRoster={setRoster}
                history={history}
                results={results}
                isAdmin={isAdmin}
                isAthlete={isAthlete}
                currentAthlete={currentAthlete}
                onOpenProfile={(name) => setSelectedProfileAthlete(name)}
                onDeleteAthlete={removeAthlete}
                onBatchDeleteAthletes={deleteSelectedAthletes}
                onClearAllAthletes={clearAllRosterAthletes}
                onSaveAthlete={saveAthleteFromPortal}
                onQueueAthlete={(ath) => {
                  addToQueue(ath);
                  setActiveTab('live');
                }}
                onBatchQueue={(athletes) => {
                  addMultipleToQueue(athletes, true);
                }}
                onQueueAllTests={(ath) => {
                  enqueueAthleteForAllTests(ath, true);
                }}
                onBatchQueueAllTests={(athletes) => {
                  enqueueMultipleForAllTests(athletes, true);
                }}
                themeAccent={{ color: '#00D084', rgb: '0, 208, 132' }}
              />
            </React.Suspense>
          ) : activeTab === 'leaderboard' ? (
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 md:p-6 flex-1 flex flex-col shadow-sm gap-4 sm:gap-5 overflow-y-auto">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="text-xs text-gray-500 font-bold tracking-widest uppercase flex items-center gap-2">
                  <Trophy size={16} />
                  LIVE LEADERBOARD (TOP 10)
                </div>
                <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
                  <button
                    onClick={() => setLeaderboardDistFilter('current')}
                    className={`px-3 py-1 rounded-lg transition ${leaderboardDistFilter === 'current' ? 'bg-emerald-500 text-black shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}
                  >
                    Active Track ({trackDistance}m)
                  </button>
                  <button
                    onClick={() => setLeaderboardDistFilter('all')}
                    className={`px-3 py-1 rounded-lg transition ${leaderboardDistFilter === 'all' ? 'bg-emerald-500 text-black shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}
                  >
                    All Distances
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                    <div className="bg-slate-50 dark:bg-[#25282f] p-3 font-bold text-xs sm:text-sm tracking-wide border-b border-gray-200 dark:border-slate-700 flex justify-between items-center">
                      <span>Fastest Sprint {leaderboardDistFilter === 'current' ? `(${trackDistance}m Track)` : '(All Track Lengths)'}</span>
                      <span className="text-[10px] font-mono text-emerald-500 font-bold uppercase">{leaderboardDistFilter === 'current' ? `${trackDistance}m Standard` : 'Dynamic Distances'}</span>
                    </div>
                    <div className="flex flex-col divide-y divide-gray-100 dark:divide-[#2a2d33]">
                      {(() => {
                        const bests = {};
                        const currentDistNum = parseFloat(trackDistance) || 40;
                        history.filter(h => {
                          const isSprint = ['sprint', 'mass_sprint', 'flying'].includes(h.testType) || !h.testType || String(h.distance).toLowerCase().includes('sprint');
                          if (!isSprint) return false;
                          if (leaderboardDistFilter === 'current') {
                            const dM = parseFloat(h.distanceMeters || h.distance);
                            if (dM && Math.abs(dM - currentDistNum) > 0.5) return false;
                          }
                          return true;
                        }).forEach(r => {
                          const time = parseFloat(r.time);
                          if (!time) return;
                          if (!bests[r.name] || time < bests[r.name].time) {
                            bests[r.name] = { ...r, time };
                          }
                        });
                        const top = Object.values(bests).sort((a,b) => a.time - b.time).slice(0, 10);
                        return top.length > 0 ? top.map((r, i) => {
                          const distLabel = r.distance ? (String(r.distance).toLowerCase().includes('m') ? r.distance : `${r.distance}m Sprint`) : `${r.distanceMeters || trackDistance}m Sprint`;
                          const vel = r.velocity ? `${parseFloat(r.velocity).toFixed(2)} m/s` : ((parseFloat(r.distanceMeters || r.distance || trackDistance) / r.time).toFixed(2) + ' m/s');
                          return (
                            <div 
                              key={i} 
                              onClick={() => setSelectedProfileAthlete(r.name)}
                              className="flex items-center justify-between p-3 sm:p-4 hover:bg-slate-50 dark:hover:bg-slate-900 transition min-w-0 cursor-pointer group"
                              title="Click to view Athlete Scout Dossier & Spider Radar"
                            >
                              <div className="flex items-center gap-3 sm:gap-4 min-w-0 pr-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${i === 0 ? 'bg-yellow-100 text-yellow-600' : i === 1 ? 'bg-gray-200 text-gray-600' : i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 dark:bg-[#2a2d33] text-gray-500'}`}>
                                  {i+1}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold dark:text-white truncate group-hover:text-emerald-400 transition">{r.name}</div>
                                  <div className="text-xs text-gray-500 truncate max-w-[200px] sm:max-w-xs">{r.sport || 'Athlete'} &bull; {distLabel} &bull; {vel}</div>
                                </div>
                              </div>
                              <div className="text-lg sm:text-xl font-black text-emerald-500 shrink-0 font-mono">{r.time.toFixed(2)}s</div>
                            </div>
                          );
                        }) : <div className="p-8 text-center text-gray-500 font-medium">No sprint records for {leaderboardDistFilter === 'current' ? `${trackDistance}m` : 'selected filter'}.</div>;
                      })()}
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                    <div className="bg-slate-50 dark:bg-[#25282f] p-4 font-bold text-sm tracking-wide border-b border-gray-200 dark:border-slate-700 flex justify-between items-center">
                      <span>Top Max Velocity</span>
                      <span className="text-[10px] font-mono text-blue-400 font-bold uppercase">Physics Peak</span>
                    </div>
                    <div className="flex flex-col divide-y divide-gray-100 dark:divide-[#2a2d33]">
                      {(() => {
                        const bests = {};
                        const currentDistNum = parseFloat(trackDistance) || 40;
                        history.filter(h => {
                          if (leaderboardDistFilter === 'current') {
                            const dM = parseFloat(h.distanceMeters || h.distance);
                            if (dM && Math.abs(dM - currentDistNum) > 0.5) return false;
                          }
                          return true;
                        }).forEach(r => {
                          const dist = parseFloat(r.distanceMeters || r.distance) || currentDistNum;
                          const t = parseFloat(r.time);
                          const vel = r.velocity ? parseFloat(r.velocity) : (t > 0 && dist > 0 ? dist / t : 0);
                          if (!vel || isNaN(vel) || vel <= 0) return;
                          if (!bests[r.name] || vel > bests[r.name].vel) {
                            bests[r.name] = { ...r, vel, calculatedDist: dist };
                          }
                        });
                        const top = Object.values(bests).sort((a,b) => b.vel - a.vel).slice(0, 10);
                        return top.length > 0 ? top.map((r, i) => {
                          const distLabel = r.distance ? (String(r.distance).toLowerCase().includes('m') ? r.distance : `${r.distance}m Sprint`) : `${r.calculatedDist}m Sprint`;
                          return (
                            <div 
                              key={i} 
                              onClick={() => setSelectedProfileAthlete(r.name)}
                              className="flex items-center justify-between p-3 sm:p-4 hover:bg-slate-50 dark:hover:bg-slate-900 transition min-w-0 cursor-pointer group"
                              title="Click to view Athlete Scout Dossier & Spider Radar"
                            >
                              <div className="flex items-center gap-3 sm:gap-4 min-w-0 pr-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${i === 0 ? 'bg-yellow-100 text-yellow-600' : i === 1 ? 'bg-gray-200 text-gray-600' : i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 dark:bg-[#2a2d33] text-gray-500'}`}>
                                  {i+1}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold dark:text-white truncate group-hover:text-blue-400 transition">{r.name}</div>
                                  <div className="text-xs text-gray-500 truncate max-w-[200px] sm:max-w-xs">{r.sport || 'Athlete'} &bull; {distLabel} ({r.time}s)</div>
                                </div>
                              </div>
                              <div className="text-lg sm:text-xl font-black text-blue-500 shrink-0 font-mono">{r.vel.toFixed(2)} m/s</div>
                            </div>
                          );
                        }) : <div className="p-8 text-center text-gray-500 font-medium">No velocity records yet.</div>;
                      })()}
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                    <div className="bg-slate-50 dark:bg-[#25282f] p-4 font-bold text-sm tracking-wide border-b border-gray-200 dark:border-slate-700">Fastest Reaction Time</div>
                    <div className="flex flex-col divide-y divide-gray-100 dark:divide-[#2a2d33]">
                      {(() => {
                        const bests = {};
                        history.forEach(r => {
                          const rawReaction = r.reactionTime ? parseFloat(r.reactionTime) : null;
                          if (!rawReaction || isNaN(rawReaction) || rawReaction <= 0) return; // ignore 0 or missing
                          // Normalize milliseconds (e.g. 150-1500) to seconds (0.150-1.500)
                          const reaction = rawReaction > 20 ? rawReaction / 1000 : rawReaction;
                          if (!bests[r.name] || reaction < bests[r.name].reactionTime) {
                            bests[r.name] = { ...r, reactionTime: reaction };
                          }
                        });
                        const top = Object.values(bests).sort((a,b) => a.reactionTime - b.reactionTime).slice(0, 10);
                        return top.length > 0 ? top.map((r, i) => (
                          <div 
                            key={i} 
                            onClick={() => setSelectedProfileAthlete(r.name)}
                            className="flex items-center justify-between p-3 sm:p-4 hover:bg-slate-50 dark:hover:bg-slate-900 transition min-w-0 cursor-pointer group"
                            title="Click to view Athlete Scout Dossier & Spider Radar"
                          >
                            <div className="flex items-center gap-3 sm:gap-4 min-w-0 pr-2">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${i === 0 ? 'bg-yellow-100 text-yellow-600' : i === 1 ? 'bg-gray-200 text-gray-600' : i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 dark:bg-[#2a2d33] text-gray-500'}`}>
                                {i+1}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold dark:text-white truncate group-hover:text-orange-400 transition">{r.name}</div>
                                <div className="text-xs text-gray-500 truncate max-w-[180px] sm:max-w-xs">{r.sport || 'Athlete'}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <div className="text-lg sm:text-xl font-black text-orange-500 font-mono">{r.reactionTime.toFixed(3)}s</div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAuditRunData(r);
                                }}
                                className="px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-bold flex items-center gap-1 transition"
                                title="Open World Athletics Rule TR 16.7 Timing Audit"
                              >
                                <ShieldCheck size={13} />
                                <span className="hidden sm:inline">Audit</span>
                              </button>
                            </div>
                          </div>
                        )) : <div className="p-8 text-center text-gray-500 font-medium">No reaction time records yet.</div>;
                      })()}
                    </div>
                  </div>
              </div>
            </div>
          ) : activeTab === 'analytics' ? (
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 md:p-6 flex-1 flex flex-col shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 md:mb-5 gap-3 sm:gap-0">
                <div className="text-xs text-gray-500 font-bold tracking-widest uppercase flex items-center gap-2">
                  <TrendingUp size={16} />
                  HISTORICAL PERFORMANCE TRENDS
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2.5 w-full sm:w-auto mt-2 sm:mt-0">
                  <button 
                    onClick={exportToCSV}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-[#2a2d33] border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold transition"
                  >
                    <Download size={14} /> Export CSV
                  </button>
                  <select 
                    value={selectedDistanceFilter}
                    onChange={(e) => setSelectedDistanceFilter(e.target.value)}
                    className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-700 dark:text-gray-600 dark:text-gray-300 focus:outline-none focus:border-[#00D084]"
                  >
                    <option value="All">All Tests</option>
                    {Array.from(new Set(history.map(h => h.distance || 'Unknown'))).map(dist => (
                      <option key={dist} value={dist}>{dist}m</option>
                    ))}
                  </select>
                  <div className="flex items-center bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-2.5 py-1 focus-within:border-[#00D084]">
                    <Search size={14} className="text-gray-400 mr-1.5" />
                    <select 
                      value={selectedAthlete}
                      onChange={(e) => setSelectedAthlete(e.target.value)}
                      className="bg-transparent py-0.5 text-xs font-bold text-gray-700 dark:text-gray-600 dark:text-gray-300 focus:outline-none w-32"
                    >
                      {!isAthlete && <option value="All">All Athletes</option>}
                      {isAthlete && currentAthlete?.name && (
                        <option value={currentAthlete.name}>{currentAthlete.name} (My Runs)</option>
                      )}
                      {Array.from(new Set(history.map(h => h.name || 'Unknown')))
                        .filter(name => !isAthlete || name === currentAthlete?.name)
                        .map(name => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex-1 flex flex-col gap-5">
                <div className="flex flex-col lg:flex-row gap-5 min-h-[350px]">
                  {/* Time Chart */}
                  <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl p-4 sm:p-5 border border-gray-200 dark:border-slate-700 flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                      <div className="text-xs text-gray-500 font-bold tracking-widest uppercase">SPRINT TIME TREND</div>
                      <button onClick={() => downloadChart('time-chart', 'Sprint_Time_Trend')} className="text-gray-500 hover:text-emerald-500 transition" title="Download Chart">
                        <Download size={14} />
                      </button>
                    </div>
                    <div className="flex-1" id="time-chart" style={{ padding: '10px 0' }}>
                      {history.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-gray-500 font-medium">No historical data available in Firestore yet.</div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={[...history].filter(h => (selectedAthlete === 'All' || h.name === selectedAthlete) && (selectedDistanceFilter === 'All' || h.distance == selectedDistanceFilter)).reverse()} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#1f2125" : "#e2e8f0"} vertical={false} />
                            <XAxis 
                              dataKey={selectedAthlete === 'All' ? "name" : "serverTime"} 
                              stroke={isDark ? "#4a4d54" : "#94a3b8"} 
                              tick={{ fill: isDark ? '#8b8e98' : '#64748b', fontSize: 12, fontWeight: 500 }}
                              tickFormatter={(val) => {
                                if (selectedAthlete === 'All') {
                                  if (!val || typeof val !== 'string') return 'Unknown';
                                  return val.startsWith('Subject') ? `Sub ${val.replace('Subject ', '')}` : val.substring(0, 8);
                                }
                                if (!val || !val.seconds) return '';
                                return new Date(val.seconds * 1000).toLocaleDateString(undefined, {month: 'short', day: 'numeric'});
                              }} 
                            />
                            <YAxis 
                              domain={['auto', 'auto']} 
                              stroke={isDark ? "#4a4d54" : "#94a3b8"} 
                              tick={{ fill: isDark ? '#8b8e98' : '#64748b', fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
                              tickFormatter={(val) => `${val}s`}
                            />
                            <RechartsTooltip 
                              contentStyle={{ backgroundColor: isDark ? '#1a1c20' : '#ffffff', borderColor: isDark ? '#2a2d33' : '#e2e8f0', borderRadius: '12px', color: isDark ? '#fff' : '#0f172a', fontWeight: 'bold', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                              itemStyle={{ color: '#00D084' }}
                              formatter={(value) => [`${value}s`, 'Sprint Time']}
                              labelStyle={{ color: isDark ? '#8b8e98' : '#64748b', marginBottom: '4px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="time" 
                              stroke="#00D084" 
                              strokeWidth={4} 
                              dot={{ r: 6, fill: isDark ? '#1a1c20' : '#ffffff', stroke: '#00D084', strokeWidth: 3 }}
                              activeDot={{ r: 8, fill: '#00D084', stroke: isDark ? '#1a1c20' : '#ffffff', strokeWidth: 4 }}
                              animationDuration={1500}
                              animationEasing="ease-in-out"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  {/* Velocity Chart */}
                  <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-200 dark:border-slate-700 flex flex-col shadow-xs">
                    <div className="flex justify-between items-center mb-4">
                      <div className="text-xs text-gray-500 font-bold tracking-widest uppercase">AVERAGE VELOCITY (m/s)</div>
                      <button onClick={() => downloadChart('velocity-chart', 'Average_Velocity')} className="text-gray-500 hover:text-emerald-500 transition" title="Download Chart">
                        <Download size={14} />
                      </button>
                    </div>
                    <div className="flex-1" id="velocity-chart" style={{ padding: '10px 0' }}>
                      {history.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-gray-500 font-medium">No historical data available.</div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart 
                            data={[...history].filter(h => (selectedAthlete === 'All' || h.name === selectedAthlete) && (selectedDistanceFilter === 'All' || h.distance == selectedDistanceFilter)).reverse().map(h => ({
                              ...h,
                              computedVelocity: h.velocity ? parseFloat(h.velocity) : parseFloat((parseFloat(h.distance || 40) * (1 / parseFloat(h.time))).toFixed(2))
                            }))} 
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#1f2125" : "#e2e8f0"} vertical={false} />
                            <XAxis 
                              dataKey={selectedAthlete === 'All' ? "name" : "serverTime"} 
                              stroke={isDark ? "#4a4d54" : "#94a3b8"} 
                              tick={{ fill: isDark ? '#8b8e98' : '#64748b', fontSize: 12, fontWeight: 500 }}
                              tickFormatter={(val) => {
                                if (selectedAthlete === 'All') {
                                  if (!val || typeof val !== 'string') return 'Unknown';
                                  return val.startsWith('Subject') ? `Sub ${val.replace('Subject ', '')}` : val.substring(0, 8);
                                }
                                if (!val || !val.seconds) return '';
                                return new Date(val.seconds * 1000).toLocaleDateString(undefined, {month: 'short', day: 'numeric'});
                              }} 
                            />
                            <YAxis 
                              domain={['auto', 'auto']} 
                              stroke={isDark ? "#4a4d54" : "#94a3b8"} 
                              tick={{ fill: isDark ? '#8b8e98' : '#64748b', fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
                              tickFormatter={(val) => `${val}`}
                            />
                            <RechartsTooltip 
                              contentStyle={{ backgroundColor: isDark ? '#1a1c20' : '#ffffff', borderColor: isDark ? '#2a2d33' : '#e2e8f0', borderRadius: '12px', color: isDark ? '#fff' : '#0f172a', fontWeight: 'bold', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                              itemStyle={{ color: '#3b82f6' }}
                              formatter={(value) => [`${value} m/s`, 'Velocity']}
                              labelStyle={{ color: isDark ? '#8b8e98' : '#64748b', marginBottom: '4px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="computedVelocity" 
                              stroke="#3b82f6" 
                              strokeWidth={4} 
                              dot={{ r: 6, fill: isDark ? '#1a1c20' : '#ffffff', stroke: '#3b82f6', strokeWidth: 3 }}
                              activeDot={{ r: 8, fill: '#3b82f6', stroke: isDark ? '#1a1c20' : '#ffffff', strokeWidth: 4 }}
                              animationDuration={1500}
                              animationEasing="ease-in-out"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>
                </div>

                {selectedAthlete !== 'All' && (() => {
                  const athleteRuns = history.filter(h => h.name === selectedAthlete && (selectedDistanceFilter === 'All' || h.distance == selectedDistanceFilter)).sort((a,b) => (b.serverTime?.seconds || 0) - (a.serverTime?.seconds || 0));
                  const latestRunWithSplits = athleteRuns.find(r => r.splits && Array.isArray(r.splits) && r.splits.length > 0);
                  
                  if (!latestRunWithSplits || !Array.isArray(latestRunWithSplits.splits)) return null;

                  let splitChartData = [
                    { distance: 0, time: 0 },
                    ...latestRunWithSplits.splits
                      .filter(s => s && !isNaN(parseFloat(s.time)))
                      .map(s => ({ distance: SPLIT_DISTANCES[s.node] || parseInt(s.node)*10, time: parseFloat(s.time) }))
                      .sort((a,b) => a.time - b.time),
                    { distance: parseFloat(latestRunWithSplits.distance || 40), time: parseFloat(latestRunWithSplits.time) }
                  ];
                  splitChartData = splitChartData.filter((v,i,a)=>a.findIndex(t=>(t.time === v.time))===i);

                  return (
                    <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-200 dark:border-slate-700 min-h-[400px] flex flex-col shadow-xs">
                      <div className="text-xs text-gray-500 dark:text-gray-400 font-bold tracking-widest uppercase mb-4 text-center">ACCELERATION CURVE (Latest Run)</div>
                      <div className="flex-1">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={splitChartData} margin={{ top: 10, right: 20, left: -20, bottom: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#2a2d33" : "#e2e8f0"} vertical={false} />
                            <XAxis 
                              dataKey="time" 
                              type="number"
                              stroke={isDark ? "#4a4d54" : "#94a3b8"} 
                              tick={{ fill: isDark ? '#8b8e98' : '#64748b', fontSize: 12, fontWeight: 500 }}
                              tickFormatter={(val) => `${val.toFixed(2)}s`}
                            />
                            <YAxis 
                              dataKey="distance"
                              stroke={isDark ? "#4a4d54" : "#94a3b8"} 
                              tick={{ fill: isDark ? '#8b8e98' : '#64748b', fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
                              tickFormatter={(val) => `${val}m`}
                            />
                            <RechartsTooltip 
                              contentStyle={{ backgroundColor: isDark ? '#121316' : '#ffffff', borderColor: isDark ? '#2a2d33' : '#e2e8f0', borderRadius: '12px', color: isDark ? '#fff' : '#0f172a', fontWeight: 'bold' }}
                              itemStyle={{ color: '#3b82f6' }}
                              formatter={(value, name) => [name === 'distance' ? `${value}m` : value, name === 'distance' ? 'Distance' : name]}
                              labelFormatter={(label) => `${parseFloat(label).toFixed(3)}s`}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="distance" 
                              stroke="#3b82f6" 
                              strokeWidth={4} 
                              dot={{ r: 6, fill: isDark ? '#1a1c20' : '#ffffff', stroke: '#3b82f6', strokeWidth: 3 }}
                              activeDot={{ r: 8, fill: '#3b82f6', stroke: isDark ? '#1a1c20' : '#ffffff', strokeWidth: 4 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  );
                })()}

                {selectedAthlete !== 'All' && (() => {
                  const rsaRuns = history.filter(h => h.name === selectedAthlete && h.testType === 'rsa').sort((a,b) => (b.serverTime?.seconds || 0) - (a.serverTime?.seconds || 0));
                  if (rsaRuns.length < 2) return null;
                  
                  // Group by distance, use the most recent RSA distance
                  const latestDist = rsaRuns[0].distance;
                  const recentRsaSession = rsaRuns.filter(r => r.distance === latestDist).slice(0, 6); // Up to 6 sprints
                  if (recentRsaSession.length < 2) return null;

                  let totalTime = 0;
                  let fastestTime = 999;
                  recentRsaSession.forEach(r => {
                    const t = parseFloat(r.time);
                    totalTime += t;
                    if (t < fastestTime) fastestTime = t;
                  });

                  const idealTime = fastestTime * recentRsaSession.length;
                  const fatigueIndex = (((totalTime / idealTime) * 100) - 100).toFixed(1);

                  return (
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-200 dark:border-slate-700 mb-8 shadow-xs">
                      <div className="text-xs text-gray-500 dark:text-gray-400 font-bold tracking-widest uppercase mb-4 text-center">RSA FATIGUE INDEX ({latestDist})</div>
                      <div className="flex flex-col items-center justify-center">
                        <div className="text-4xl font-black text-gray-900 dark:text-white">{fatigueIndex}%</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 font-bold mt-2">Based on last {recentRsaSession.length} sprints</div>
                        <div className="flex gap-4 mt-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">
                          <div>Fastest: <span className="text-gray-900 dark:text-white font-black">{fastestTime.toFixed(2)}s</span></div>
                          <div>Total: <span className="text-gray-900 dark:text-white font-black">{totalTime.toFixed(2)}s</span></div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
                
                {/* Force-Velocity-Power (FVP) Sprint Profiling Card (Samozino / Morin Model) */}
                <FVPProfileCard
                  athlete={selectedAthlete !== 'All' ? roster.find(a => a.name === selectedAthlete) || { name: selectedAthlete } : currentAthlete || (results[0] || null)}
                  history={history}
                  results={results}
                  onOpenFullModal={() => setShowFvpModal(true)}
                />

                {/* Sprint Split Delta & Sector Gain/Loss Visualizer */}
                <SprintSplitDeltaChart
                  athlete={selectedAthlete !== 'All' ? roster.find(a => a.name === selectedAthlete) || { name: selectedAthlete } : currentAthlete || (results[0] || null)}
                  currentRun={results[0] || null}
                  history={history}
                  results={results}
                  roster={roster}
                  onOpenFullModal={() => setSelectedSectorDeltaRun(results[0] || history[0] || null)}
                />

                {/* Session History & Leaderboard */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-6 border border-gray-200 dark:border-slate-700 flex flex-col mt-2">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
                    <div className="text-xs text-gray-500 font-bold tracking-widest uppercase flex items-center gap-2">
                      <FileText size={16} />
                      {analyticsMode === 'history' ? 'SESSION HISTORY' : analyticsMode === 'summary' ? 'SESSION SUMMARY' : analyticsMode === 'matchup' ? 'HEAD-TO-HEAD MATCHUP' : 'ALL-TIME LEADERBOARD'}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
                      <div className="grid grid-cols-4 sm:flex bg-gray-100 dark:bg-slate-900 p-1 rounded-xl w-full sm:w-auto">
                        <button onClick={() => setAnalyticsMode('history')} className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-bold text-center transition ${analyticsMode === 'history' ? 'bg-white dark:bg-[#25282f] shadow text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>History</button>
                        <button onClick={() => setAnalyticsMode('summary')} className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-bold text-center transition ${analyticsMode === 'summary' ? 'bg-white dark:bg-[#25282f] shadow text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>Summary</button>
                        <button onClick={() => setAnalyticsMode('leaderboard')} className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-bold text-center transition ${analyticsMode === 'leaderboard' ? 'bg-white dark:bg-[#25282f] shadow text-emerald-500' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>Leaderboard</button>
                        <button onClick={() => setAnalyticsMode('matchup')} className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-bold text-center transition ${analyticsMode === 'matchup' ? 'bg-white dark:bg-[#25282f] shadow text-emerald-500' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>Head-to-Head</button>
                      </div>
                      {analyticsMode === 'history' && history.length > 0 && isAdmin && (
                        <button 
                          onClick={async () => {
                            if (window.confirm("Are you sure you want to delete ALL history? This cannot be undone.")) {
                              for (const h of history) {
                                if (h.firebaseId) {
                                  await deleteDoc(doc(db, "sprint_evaluations", h.firebaseId)).catch(e=>{});
                                }
                              }
                            }
                          }}
                          className="px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg text-sm font-bold transition hidden sm:block"
                        >
                          Clear All
                        </button>
                      )}
                      {analyticsMode === 'summary' && summaryStats.athleteRows.length > 0 && (
                        <button 
                          onClick={exportSessionPDF}
                          className="px-4 py-2 bg-emerald-600/10 text-emerald-500 hover:bg-emerald-600/20 rounded-lg text-sm font-bold transition hidden sm:flex items-center gap-2"
                        >
                          <Download size={14} /> Download PDF
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {analyticsMode === 'matchup' ? (
                    <React.Suspense fallback={
                      <div className="flex flex-col items-center justify-center py-16 text-emerald-400 gap-2">
                        <Loader2 className="animate-spin text-[#00D084]" size={32} />
                        <span className="text-xs font-semibold tracking-wider uppercase text-gray-400">Loading Head to Head Matchup...</span>
                      </div>
                    }>
                      <HeadToHeadMatchup
                        history={history}
                        roster={roster}
                        results={results}
                        onOpenProfile={(name) => setSelectedProfileAthlete(name)}
                      />
                    </React.Suspense>
                  ) : analyticsMode === 'summary' ? (
                    <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-2 duration-500">
                      {tableData.length === 0 ? (
                        <div className="p-12 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-3xl text-center flex flex-col items-center justify-center bg-slate-50/50 dark:bg-slate-900/50">
                          <Activity size={32} className="text-gray-300 dark:text-gray-600 mb-4" />
                          <div className="text-lg font-bold text-gray-800 dark:text-white mb-2">No session data available</div>
                          <div className="text-sm text-gray-500 max-w-md">Try adjusting your filters or complete some runs to generate a daily summary.</div>
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-gray-200 dark:border-slate-700 shadow-sm flex flex-col items-center justify-center text-center">
                              <div className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-1 flex items-center gap-1">
                                <Users size={12} /> Athletes
                              </div>
                              <div className="text-2xl font-black text-gray-900 dark:text-white">{summaryStats.uniqueAthletes}</div>
                            </div>
                            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-gray-200 dark:border-slate-700 shadow-sm flex flex-col items-center justify-center text-center">
                              <div className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-1 flex items-center gap-1">
                                <Activity size={12} /> Total Runs
                              </div>
                              <div className="text-2xl font-black text-emerald-500">{summaryStats.todayRuns}</div>
                            </div>
                            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-gray-200 dark:border-slate-700 shadow-sm flex flex-col items-center justify-center text-center col-span-2 md:col-span-2">
                              <div className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-2 flex items-center gap-1 justify-center">
                                <TrendingUp size={12} /> Tests Completed
                              </div>
                              <div className="flex gap-4">
                                <div className="text-center">
                                  <div className="text-xl font-black text-blue-500">{summaryStats.typeBreakdown.sprint || 0}</div>
                                  <div className="text-[10px] text-gray-500 font-bold uppercase">Sprint</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-xl font-black text-purple-500">{summaryStats.typeBreakdown.agility || 0}</div>
                                  <div className="text-[10px] text-gray-500 font-bold uppercase">Pro Agility</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-xl font-black text-orange-500">{summaryStats.typeBreakdown.rsa || 0}</div>
                                  <div className="text-[10px] text-gray-500 font-bold uppercase">RSA</div>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="overflow-x-auto bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="border-b border-gray-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                                  <th className="p-3 pl-5 text-xs font-bold text-gray-500 uppercase tracking-wider">Athlete</th>
                                  <th className="p-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Total Runs</th>
                                  <th className="p-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Fastest Time</th>
                                  <th className="p-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Top Velocity</th>
                                  <th className="p-3 pr-5 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Details</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 dark:divide-[#2a2d33]">
                                {summaryStats.athleteRows.map((row, idx) => (
                                  <tr key={row.name || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition cursor-pointer" onClick={() => setSelectedProfileAthlete(row.name)}>
                                    <td className="p-3 pl-5 font-bold text-gray-800 dark:text-gray-200 flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-full bg-emerald-600/20 flex items-center justify-center text-emerald-500 font-black text-xs">
                                        {(row.name || 'U').substring(0, 2).toUpperCase()}
                                      </div>
                                      {row.name}
                                    </td>
                                    <td className="p-3 text-center font-bold text-gray-600 dark:text-gray-400">
                                      {row.runs} <span className="text-[10px] text-gray-400 uppercase font-normal ml-1">runs</span>
                                    </td>
                                    <td className="p-3 text-center font-mono font-bold text-emerald-500">
                                      {row.bestTime ? `${row.bestTime.toFixed(2)}s` : '--'}
                                    </td>
                                    <td className="p-3 text-center font-bold text-blue-500">
                                      {row.bestVelocity ? `${row.bestVelocity.toFixed(2)} m/s` : '--'}
                                    </td>
                                    <td className="p-3 pr-5 text-right">
                                      <button className="p-2 bg-gray-100 dark:bg-[#25282f] text-gray-600 dark:text-gray-400 hover:text-emerald-500 hover:bg-white dark:hover:bg-[#2a2d33] rounded-lg transition" title="View Profile">
                                        <ChevronRight size={14} />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )}
                    </div>

                  ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-slate-700">
                          {analyticsMode === 'history' && isAdmin && <th className="p-3 w-10"></th>}
                          {analyticsMode === 'leaderboard' && <th className="p-3 text-xs font-bold text-gray-500 uppercase">Rank</th>}
                          <th className="p-3 text-xs font-bold text-gray-500 uppercase">Athlete</th>
                          <th className="p-3 text-xs font-bold text-gray-500 uppercase">Time (s)</th>
                          <th className="p-3 text-xs font-bold text-gray-500 uppercase hidden md:table-cell">Velocity</th>
                          {analyticsMode === 'history' && <th className="p-3 text-xs font-bold text-gray-500 uppercase hidden lg:table-cell">Conditions</th>}
                          {analyticsMode === 'history' && <th className="p-3 text-xs font-bold text-gray-500 uppercase hidden md:table-cell">Date</th>}
                          <th className="p-3 text-xs font-bold text-gray-500 uppercase text-right">Report</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tableData.length === 0 ? (
                          <tr><td colSpan={analyticsMode === 'history' && isAdmin ? 7 : 6} className="p-6 text-center text-gray-500">No records found.</td></tr>
                        ) : (
                          tableData.map((h, i) => {
                            const vel = h.velocity ? `${h.velocity} m/s` : (parseFloat(h.distance||40) * (1 / parseFloat(h.time))).toFixed(2) + ' m/s';
                            const dateStr = h.serverTime && h.serverTime.seconds ? new Date(h.serverTime.seconds * 1000).toLocaleDateString() : 'N/A';
                            const conditions = `${h.windSpeed ? `${h.windSpeed}m/s ` : ''}${h.surfaceType || ''}`;
                            return (
                              <tr key={h.firebaseId || i} className="border-b border-gray-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition cursor-pointer" onClick={() => setSelectedProfileAthlete(h.name)}>
                                {analyticsMode === 'history' && isAdmin && (
                                  <td className="p-3 w-10 text-center">
                                    <button 
                                      onClick={(e) => { 
                                        e.stopPropagation(); 
                                        if (window.confirm('Delete this history record?')) { 
                                          if (h.firebaseId) deleteDoc(doc(db, "sprint_evaluations", h.firebaseId)); 
                                        } 
                                      }} 
                                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition" 
                                      title="Delete Record"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </td>
                                )}
                                {analyticsMode === 'leaderboard' && <td className="p-2 sm:p-3 text-sm font-bold text-gray-400 whitespace-nowrap">#{i + 1}</td>}
                                <td className="p-2 sm:p-3 font-bold text-gray-800 dark:text-gray-200 whitespace-nowrap">{h.name}</td>
                                <td className="p-2 sm:p-3 font-mono font-bold text-emerald-500 whitespace-nowrap">{h.time}</td>
                                <td className="p-2 sm:p-3 text-sm text-gray-600 dark:text-gray-400 hidden md:table-cell whitespace-nowrap">{vel}</td>
                                {analyticsMode === 'history' && <td className="p-2 sm:p-3 text-xs text-gray-500 hidden lg:table-cell whitespace-nowrap">{conditions}</td>}
                                {analyticsMode === 'history' && <td className="p-2 sm:p-3 text-xs text-gray-500 hidden md:table-cell whitespace-nowrap">{dateStr}</td>}
                                <td className="p-2 sm:p-3 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); shareResultWhatsApp(h); }} 
                                      className="p-1.5 sm:p-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-black rounded-lg transition" 
                                      title="Share via WhatsApp"
                                    >
                                      <MessageSquare size={14} />
                                    </button>
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); shareResultEmail(h); }} 
                                      className="p-1.5 sm:p-2 bg-sky-500/10 text-sky-400 hover:bg-sky-500 hover:text-black rounded-lg transition" 
                                      title="Email Report"
                                    >
                                      <Mail size={14} />
                                    </button>
                                    {h.reactionTime > 0 && (
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); setAuditRunData(h); }} 
                                        className="p-1.5 sm:p-2 bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-black rounded-lg transition" 
                                        title="World Athletics Rule TR 16.7 Timing Audit"
                                      >
                                        <ShieldCheck size={14} />
                                      </button>
                                    )}
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); exportAthletePDF(h); }} 
                                      className="p-1.5 sm:p-2 bg-gray-100 dark:bg-slate-900 text-gray-600 dark:text-gray-400 hover:text-emerald-500 hover:bg-white dark:hover:bg-[#25282f] rounded-lg transition" 
                                      title="Download Report"
                                    >
                                      <Download size={14} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                  )}
                  </div>
                </div>
              </div>
          ) : activeTab === 'video' ? (
            <ErrorBoundary fallbackTitle="Biomechanical Video Workspace">
              <React.Suspense fallback={
                <div className="flex flex-col items-center justify-center min-h-[420px] text-emerald-400 gap-3 py-16">
                  <Loader2 className="animate-spin text-[#00D084]" size={36} />
                  <span className="text-sm font-semibold tracking-wider uppercase text-gray-400">Loading Biomechanical Video Workspace...</span>
                </div>
              }>
                <BiomechanicalVideoWorkspace
                  videoURL={videoURL}
                  setVideoURL={setVideoURL}
                  compareVideoURL={compareVideoURL}
                  setCompareVideoURL={setCompareVideoURL}
                  history={history}
                  results={results}
                  roster={roster}
                  selectedAthlete={selectedAthlete}
                  activeRunner={activeRunner}
                  stationRole={stationRole}
                  db={db}
                  user={user}
                  onPoseDataChange={setSharedPoseGraphData}
                />
              </React.Suspense>
            </ErrorBoundary>
          ) : activeTab === 'combine' ? (
            <ErrorBoundary fallbackTitle="Combine Scorecard Studio">
              <React.Suspense fallback={
                <div className="flex flex-col items-center justify-center min-h-[420px] text-emerald-400 gap-3 py-16">
                  <Loader2 className="animate-spin text-[#00D084]" size={36} />
                  <span className="text-sm font-semibold tracking-wider uppercase text-gray-400">Loading Combine Scorecard Studio...</span>
                </div>
              }>
                <CombineScorecard
                  history={history}
                  athletes={roster}
                  results={results}
                  trackDistance={trackDistance}
                  selectedAthlete={selectedAthlete}
                  onSelectAthlete={setSelectedAthlete}
                  onStartEventTest={(mode) => {
                    setTestMode(mode);
                    if (selectedAthlete && selectedAthlete !== 'All') {
                      const athleteObj = roster.find(r => r.name === selectedAthlete || r.id === selectedAthlete || r.bib === selectedAthlete);
                      if (athleteObj) {
                        setQueue(prev => {
                          const distNum = parseFloat(trackDistanceRef.current) || 40;
                          const existingIndex = prev.findIndex(a => a.name === athleteObj.name || a.bib === athleteObj.bib);
                          if (existingIndex !== -1) {
                            const existing = prev[existingIndex];
                            return [existing, ...prev.filter((_, idx) => idx !== existingIndex)];
                          }
                          const newBatteryItem = {
                            ...athleteObj,
                            isCombineBattery: true,
                            battery: athleteObj.battery || [
                              { testMode: 'standard', name: `${distNum}m Sprint`, status: 'pending', time: null },
                              { testMode: 'shuttle', name: '4x10m Shuttle Run', status: 'pending', time: null },
                              { testMode: 'pro_agility', name: '5-10-5 Pro Agility', status: 'pending', time: null }
                            ]
                          };
                          return [newBatteryItem, ...prev];
                        });
                      }
                    }
                    setActiveTab('live');
                  }}
                />
              </React.Suspense>
            </ErrorBoundary>
          ) : null}
        </div>
      </main>
 
      {/* Mobile Bottom Navigation Bar (md:hidden) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0c0e14]/95 backdrop-blur-md border-t border-gray-200 dark:border-slate-800/80 flex justify-around items-center py-1 px-2 md:hidden shadow-lg safe-bottom">
        <button
          onClick={() => setActiveTab('live')}
          className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition ${
            activeTab === 'live' 
              ? 'text-emerald-500 font-bold' 
              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
          }`}
        >
          <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'live' ? 'bg-emerald-500 animate-pulse' : 'bg-transparent'}`} />
          <span className="text-[10px] tracking-tight">Live</span>
        </button>

        <button
          onClick={() => setActiveTab('roster')}
          className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition ${
            activeTab === 'roster' 
              ? 'text-emerald-500 font-bold' 
              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
          }`}
        >
          <Users size={16} />
          <span className="text-[10px] tracking-tight">Roster</span>
        </button>

        <button
          onClick={() => setActiveTab('combine')}
          className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition ${
            activeTab === 'combine' 
              ? 'text-emerald-500 font-bold' 
              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
          }`}
        >
          <Award size={16} />
          <span className="text-[10px] tracking-tight">Combine</span>
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition ${
            activeTab === 'analytics' 
              ? 'text-emerald-500 font-bold' 
              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
          }`}
        >
          <Activity size={16} />
          <span className="text-[10px] tracking-tight">Analytics</span>
        </button>

        <button
          onClick={() => setShowQuickControlsSheet(true)}
          className="flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl text-gray-400 hover:text-emerald-500 transition"
        >
          <Sliders size={16} />
          <span className="text-[10px] tracking-tight">Controls</span>
        </button>
      </nav>

      {/* Athlete Scout Card & Intelligence Dossier Modal */}
      {selectedProfileAthlete && (
        <React.Suspense fallback={null}>
          <AthleteScoutCardModal
            athleteName={selectedProfileAthlete}
            history={history}
            results={results}
            roster={roster}
            onClose={() => setSelectedProfileAthlete(null)}
            onOpenFvp={(run) => {
              setSelectedFvpRun(run);
              setShowFvpModal(true);
            }}
          />
        </React.Suspense>
      )}

      {/* QR Code Modals */}
      {showQRModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl max-w-sm w-full flex flex-col items-center border border-gray-200 dark:border-slate-700 shadow-2xl">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">{showQRModal.name}</h2>
            <p className="text-sm text-gray-500 mb-6 font-mono">ID: {showQRModal.bib}</p>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-8">
               <QRCodeSVG value={showQRModal.rfidUid || showQRModal.bib} size={220} level="H" includeMargin={true} />
            </div>
            <button onClick={() => setShowQRModal(null)} className="w-full py-3 bg-gray-100 hover:bg-gray-200 dark:bg-[#1f2125] dark:hover:bg-[#2a2d33] text-gray-800 dark:text-gray-200 font-bold rounded-xl transition">
              Close
            </button>
          </div>
        </div>
      )}

      {/* Bleacher Live Stream QR Code Modal */}
      {showBleacherQRModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowBleacherQRModal(false)}>
          <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl max-w-sm w-full flex flex-col items-center border border-gray-200 dark:border-slate-700 shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-3">
              <Smartphone size={24} />
            </div>
            <h2 className="text-xl font-black text-gray-900 dark:text-gray-100 text-center tracking-tight">
              Bleacher Live Stream
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-1 mb-6">
              Spectators and teammates can scan this QR code to view the live timing scoreboard on their phones in real-time.
            </p>
            
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-lg mb-5">
              <QRCodeSVG 
                value={typeof window !== 'undefined' ? `${window.location.origin}/?mode=spectator` : 'https://sprintgate-b84db.web.app/?mode=spectator'} 
                size={220} 
                level="H" 
                includeMargin={true} 
              />
            </div>

            <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-xl p-3 text-center mb-6 border border-gray-200 dark:border-slate-700">
              <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Direct Scoreboard Link</div>
              <div className="text-xs font-mono font-bold text-emerald-500 truncate">
                {typeof window !== 'undefined' ? `${window.location.origin}/?mode=spectator` : 'https://sprintgate-b84db.web.app/?mode=spectator'}
              </div>
            </div>

            <div className="flex gap-3 w-full">
              <button 
                onClick={() => {
                  if (typeof navigator !== 'undefined' && navigator.clipboard) {
                    navigator.clipboard.writeText(`${window.location.origin}/?mode=spectator`);
                    alert("Spectator scoreboard link copied to clipboard!");
                  }
                }}
                className="flex-1 py-3 bg-emerald-600 hover:bg-[#00e691] text-black font-bold text-xs rounded-xl transition"
              >
                Copy Link
              </button>
              <button 
                onClick={() => setShowBleacherQRModal(false)} 
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-800 dark:text-gray-200 font-bold text-xs rounded-xl transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Wind Gauge Modal */}
      {showWindModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setShowWindModal(false)}
        >
          <div 
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-850 rounded-2xl p-4 sm:p-5 shadow-2xl relative flex flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-500 flex items-center justify-center">
                  <Wind size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white">Track Wind Gauge</h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">Multi-source meteorological GPS & manual controller</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowWindModal(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
              >
                <X size={18} />
              </button>
            </div>

            <WindGaugeController
              windSpeed={windSpeed}
              setWindSpeed={setWindSpeed}
              windMode={windMode}
              setWindMode={setWindMode}
              windMeta={windMeta}
              isFetching={isFetchingWind}
              fetchError={windFetchError}
              onRefreshWind={handleFetchAutoWind}
            />

            <div className="flex justify-end pt-2 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowWindModal(false)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-sm transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audio & Starting Cadence Settings Modal */}
      {showAudioSettingsModal && (
        <ErrorBoundary
          fallbackTitle="Audio Cadence & Starter Studio"
          onClose={() => setShowAudioSettingsModal(false)}
          onReset={() => {
            try {
              localStorage.removeItem('sprintgate_audio_config');
            } catch (e) {}
            setAudioConfig({ ...DEFAULT_AUDIO_CONFIG });
            saveAudioConfig({ ...DEFAULT_AUDIO_CONFIG });
          }}
        >
          <React.Suspense fallback={null}>
            <AudioSettingsModal
              isOpen={true}
              onClose={() => setShowAudioSettingsModal(false)}
              config={audioConfig}
              onSaveConfig={(newConfig) => {
                setAudioConfig(newConfig);
                saveAudioConfig(newConfig);
                setVoiceEnabled(newConfig.enabled);
              }}
              playGunshot={playGunshot}
            />
          </React.Suspense>
        </ErrorBoundary>
      )}

      {/* Horizontal Force-Velocity-Power (F-v-P) Profiler Modal */}
      {showFvpModal && (
        <React.Suspense fallback={null}>
          <HorizontalFVPModal
            isOpen={true}
            onClose={() => {
              setShowFvpModal(false);
              setSelectedFvpRun(null);
            }}
            currentRun={selectedFvpRun}
            athlete={
              selectedFvpRun 
                ? roster.find(r => r.name === selectedFvpRun.name) || { name: selectedFvpRun.name, weight: selectedFvpRun.weight }
                : (selectedProfileAthlete ? roster.find(r => r.name === selectedProfileAthlete) : null)
            }
            history={history}
            results={results}
          />
        </React.Suspense>
      )}

      {/* World Athletics Rule TR 16.7 Reaction Time & False Start Auditor Modal */}
      {auditRunData && (
        <React.Suspense fallback={null}>
          <ReactionTimeAuditorModal
            isOpen={true}
            onClose={() => setAuditRunData(null)}
            runData={auditRunData}
            starterHoldSec={auditRunData?.starterHoldTime || null}
          />
        </React.Suspense>
      )}

      {/* Sprint Split Delta & Sector Gain/Loss Modal Suite */}
      {selectedSectorDeltaRun && (
        <SprintSplitDeltaChart
          isModal={true}
          currentRun={selectedSectorDeltaRun}
          athlete={roster.find(r => r.name === selectedSectorDeltaRun.name) || { name: selectedSectorDeltaRun.name }}
          history={history}
          results={results}
          roster={roster}
          onClose={() => setSelectedSectorDeltaRun(null)}
        />
      )}

      {/* Bluetooth Low Energy (BLE) Heart Rate & Biotelemetry Modal */}
      {showBleModal && (
        <React.Suspense fallback={null}>
          <BleHeartRateModal
            isOpen={true}
            onClose={() => setShowBleModal(false)}
            activeRunner={activeRunner}
          />
        </React.Suspense>
      )}

      {/* Direct Web Bluetooth (WebBLE) SprintGate Hardware Cockpit Modal */}
      {showSprintGateBleModal && (
        <React.Suspense fallback={null}>
          <SprintGateBleModal
            isOpen={true}
            onClose={() => setShowSprintGateBleModal(false)}
          />
        </React.Suspense>
      )}

      {/* Multi-Modal Hardware Connection Hub Modal (Wi-Fi Hotspot, USB-C Cable, WebBLE) */}
      {showGateConnectionModal && (
        <React.Suspense fallback={null}>
          <GateConnectionModal
            isOpen={true}
            onClose={() => setShowGateConnectionModal(false)}
            nodeA={nodeA}
            setNodeA={setNodeA}
            nodeB={nodeB}
            setNodeB={setNodeB}
            statusA={statusA}
            statusB={statusB}
            isBleConnected={isSprintGateBleConnected}
            isSerialConnected={isSerialConnected}
            serialPortName={serialPortName}
            onScanHotspot={handleScanHotspot}
            isScanningHotspot={isScanningHotspot}
            scanProgress={scanProgress}
            onManualReconnect={handleManualReconnectGates}
          />
        </React.Suspense>
      )}

      {/* Multi-Device Field Station Mesh Sync Modal */}
      {showMultiDeviceSyncModal && (
        <React.Suspense fallback={null}>
          <MultiDeviceSyncModal
            isOpen={true}
            onClose={() => setShowMultiDeviceSyncModal(false)}
            stationRole={stationRole}
            setStationRole={setStationRole}
            connectedStations={connectedStations}
            queue={queue}
            activeRunner={activeRunner}
            sequenceState={sequenceState}
            displayTime={displayTime}
            testMode={testMode}
            onOpenQrScanner={() => setShowQueueScanner(true)}
            onCallNextRunner={() => setQueue(prev => prev.slice(1))}
            onSignalTrackReady={() => {}}
            onStartMasterSequence={handleArmAndStart}
            onResetMasterSequence={handleReset}
            onSelectTab={setActiveTab}
          />
        </React.Suspense>
      )}

      {showQueueScanner && (
        <React.Suspense fallback={null}>
          <QRScannerModal 
            onClose={() => setShowQueueScanner(false)} 
            onScan={(decodedText) => {
              const matched = rosterRef.current.find(a => a.rfidUid === decodedText || a.bib === decodedText);
              if (matched) {
                setShowQueueScanner(false);
                setQueue(prev => {
                  if (!prev.find(a => a.id === matched.id)) return [...prev, matched];
                  return prev;
                });
              } else {
                alert("Athlete not found in roster!");
              }
            }} 
          />
        </React.Suspense>
      )}

      {/* Kinematic Chronophotography Strobe Motion Visuals Modal */}
      {showGlobalStrobeModal && (
        <React.Suspense fallback={null}>
          <StrobeMotionModal
            isOpen={showGlobalStrobeModal}
            onClose={() => setShowGlobalStrobeModal(false)}
            videoURL={videoURL}
            athleteInfo={currentAthlete || (queue[0] || (roster[0] || {}))}
            videoDuration={3}
            themeAccent={{ color: '#00D084', rgb: '0, 208, 132' }}
          />
        </React.Suspense>
      )}

      {/* Quick Controls & Settings Drawer (Mobile & Tablet) */}
      <QuickControlsSheet
        isOpen={showQuickControlsSheet}
        onClose={() => setShowQuickControlsSheet(false)}
        theme={theme}
        setTheme={setTheme}
        colorTheme={colorTheme}
        setColorTheme={setColorTheme}
        highContrast={highContrast}
        setHighContrast={setHighContrast}
        voiceEnabled={voiceEnabled}
        setVoiceEnabled={setVoiceEnabled}
        onOpenAudioSettings={() => setShowAudioSettingsModal(true)}
        isJumbotronMode={isJumbotronMode}
        setIsJumbotronMode={setIsJumbotronMode}
        isBleConnected={isBleConnected}
        liveBleBpm={liveBleBpm}
        liveBleZone={liveBleZone}
        onOpenBleModal={() => setShowBleModal(true)}
        isSprintGateBleConnected={isSprintGateBleConnected}
        onOpenGateBleModal={() => setShowSprintGateBleModal(true)}
        onOpenConnectionModal={() => setShowGateConnectionModal(true)}
        isGateConnected={statusB.online || isSerialConnected || isSprintGateBleConnected}
        isSerialConnected={isSerialConnected}
        isWifiConnected={statusB.online}
        isAdmin={isAdmin}
        handleLogout={handleLogout}
        surfaceType={surfaceType}
        setSurfaceType={setSurfaceType}
      />

      {/* ═══ LIVE TELEMETRY MINI HUD (FLOATING ONSCREEN CAPSULE) ═══ */}
      <LiveMiniHUD
        displayTime={displayTime}
        sequenceState={sequenceState}
        isRunning={isRunning}
        activeRunner={currentAthlete || (queue.length > 0 ? queue[0] : null)}
        nextRunner={queue.length > 1 ? queue[1] : (queue.length > 0 && currentAthlete ? queue[0] : null)}
      />

      {/* ═══ MOBILE BOTTOM NAV BAR ═══ */}
      {/* Fixed bottom tab bar — visible only on phones (<md), hidden on tablet/desktop */}
      <nav className="fixed bottom-0 left-0 right-0 z-[200] flex md:hidden bg-white/90 dark:bg-[#0a0c10]/95 backdrop-blur-xl border-t border-gray-200/60 dark:border-slate-800/60 footer-safe-bottom" aria-label="Mobile navigation">
        {[
          { id: 'live',        icon: Zap,      label: 'Live'     },
          { id: 'roster',      icon: Users,     label: 'Team'     },
          { id: 'combine',     icon: Award,     label: 'Combine'  },
          { id: 'analytics',   icon: Activity,  label: 'Stats'    },
          { id: 'video',       icon: Video,     label: 'Video'    },
          { id: 'leaderboard', icon: Trophy,     label: 'Board'    },
        ].map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors duration-150
              ${activeTab === id
                ? 'text-[var(--accent-color,#00E599)]'
                : 'text-gray-400 dark:text-gray-500 active:text-gray-600 dark:active:text-gray-300'
              }`}
            aria-current={activeTab === id ? 'page' : undefined}
          >
            <Icon size={20} strokeWidth={activeTab === id ? 2.5 : 1.8} />
            <span className={`text-[10px] leading-none tracking-wide font-semibold ${activeTab === id ? 'font-bold' : ''}`}>
              {label}
            </span>
            {/* Active indicator dot */}
            {activeTab === id && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-[var(--accent-color,#00E599)]" />
            )}
          </button>
        ))}
      </nav>

    </div>
  );
}

function StatusBadge({ label, value, active }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-gray-500 font-bold tracking-widest uppercase mb-1.5">{label}</span>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${active ? 'bg-emerald-600' : 'bg-red-500'}`}></div>
        <span className="text-base font-bold text-gray-800 dark:text-gray-200">{value}</span>
      </div>
    </div>
  );
}


