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
 * SprintGate Advanced Audio & Starting Sequence Engine
 * - Custom Acoustic Cadence & Web Audio Synthesizer
 * - Multilingual Voice Announcements (English, Hindi, Spanish, French, German, Japanese)
 * - Coach Voice Profiles & Sound Customization
 */
import { playCustomAudioSound, hasCustomAudio } from './customAudioStorage';


export const TRANSLATIONS = {
  en: {
    marks: "On your marks",
    set: "Set",
    falseStart: "False start detected!",
    standUp: "Stand up, runners. False start.",
    downSet: "Down... Set!",
    readyGo: "Ready... Go!",
    splitCallout: (turn, time) => `Turn ${turn}: ${time.toFixed(1)} seconds!`,
    runResult: (name, time) => `${name}, ${time.toFixed(2)} seconds.`,
    prResult: (name, time) => `New Personal Record for ${name}! ${time.toFixed(2)} seconds!`,
    verticalJump: (name, inches) => `${name}, Vertical jump: ${inches} inches.`,
    checkIn: (name) => `${name} checked in.`
  },
  hi: {
    marks: "अपने स्थान पर",
    set: "तैयार",
    falseStart: "गलत शुरुआत! रुकिए!",
    standUp: "खड़े हो जाइए, धावक। गलत शुरुआत।",
    downSet: "तैयार... सेट!",
    readyGo: "तैयार... जाओ!",
    splitCallout: (turn, time) => `टर्न ${turn}: ${time.toFixed(1)} सेकंड!`,
    runResult: (name, time) => `${name}, ${time.toFixed(2)} सेकंड।`,
    prResult: (name, time) => `${name} के लिए नया व्यक्तिगत रिकॉर्ड! ${time.toFixed(2)} सेकंड!`,
    verticalJump: (name, inches) => `${name}, वर्टिकल जंप: ${inches} इंच।`,
    checkIn: (name) => `${name} चेक इन हो गए।`
  },
  es: {
    marks: "En sus marcas",
    set: "Listos",
    falseStart: "¡Salida en falso detectada!",
    standUp: "Levántense, corredores. Salida en falso.",
    downSet: "Abajo... ¡Listos!",
    readyGo: "Listos... ¡Fuera!",
    splitCallout: (turn, time) => `Vuelta ${turn}: ${time.toFixed(1)} segundos!`,
    runResult: (name, time) => `${name}, ${time.toFixed(2)} segundos.`,
    prResult: (name, time) => `¡Nuevo récord personal para ${name}! ${time.toFixed(2)} segundos!`,
    verticalJump: (name, inches) => `${name}, Salto vertical: ${inches} pulgadas.`,
    checkIn: (name) => `${name} registrado.`
  },
  fr: {
    marks: "À vos marques",
    set: "Prêts",
    falseStart: "Faux départ détecté !",
    standUp: "Redressez-vous, coureurs. Faux départ.",
    downSet: "En position... Prêts !",
    readyGo: "Prêts... Partez !",
    splitCallout: (turn, time) => `Virage ${turn}: ${time.toFixed(1)} secondes !`,
    runResult: (name, time) => `${name}, ${time.toFixed(2)} secondes.`,
    prResult: (name, time) => `Nouveau record personnel pour ${name} ! ${time.toFixed(2)} secondes !`,
    verticalJump: (name, inches) => `${name}, Saut vertical : ${inches} pouces.`,
    checkIn: (name) => `${name} enregistré.`
  },
  de: {
    marks: "Auf die Plätze",
    set: "Fertig",
    falseStart: "Fehlstart erkannt!",
    standUp: "Aufstehen, Läufer. Fehlstart.",
    downSet: "Runter... Fertig!",
    readyGo: "Achtung... Los!",
    splitCallout: (turn, time) => `Wende ${turn}: ${time.toFixed(1)} Sekunden!`,
    runResult: (name, time) => `${name}, ${time.toFixed(2)} Sekunden.`,
    prResult: (name, time) => `Neue persönliche Bestleistung für ${name}! ${time.toFixed(2)} Sekunden!`,
    verticalJump: (name, inches) => `${name}, Vertikaler Sprung: ${inches} Zoll.`,
    checkIn: (name) => `${name} eingecheckt.`
  },
  ja: {
    marks: "位置について",
    set: "用意",
    falseStart: "フライング検出！",
    standUp: "選手、立ってください。フライングです。",
    downSet: "構えて... 用意！",
    readyGo: "位置について... スタート！",
    splitCallout: (turn, time) => `ターン ${turn}、${time.toFixed(1)}秒！`,
    runResult: (name, time) => `${name}選手、${time.toFixed(2)}秒。`,
    prResult: (name, time) => `${name}選手、自己新記録達成！${time.toFixed(2)}秒！`,
    verticalJump: (name, inches) => `${name}選手、垂直跳び ${inches}インチ。`,
    checkIn: (name) => `${name}選手、チェックイン完了。`
  }
};

export const COACH_PROFILES = {
  championship: {
    id: 'championship',
    name: 'World Championship Starter',
    badge: 'World Athletics Official',
    desc: 'Authoritative, brisk, precise stadium cadence',
    rateMultiplier: 1.05,
    pitchMultiplier: 0.95
  },
  proCombine: {
    id: 'proCombine',
    name: 'Pro Combine Coordinator',
    badge: 'Pro Combine Protocol',
    desc: 'Punchy, commanding, rapid-fire scout cadence for 40-yard dash',
    rateMultiplier: 1.18,
    pitchMultiplier: 0.88
  },
  highSchool: {
    id: 'highSchool',
    name: 'Scholastic & Youth Starter',
    badge: 'Scholastic Championship',
    desc: 'Deliberate, loud, steady track command',
    rateMultiplier: 0.98,
    pitchMultiplier: 1.05
  },
  britishAnnouncer: {
    id: 'britishAnnouncer',
    name: 'British Athletics Starter',
    badge: 'Diamond League UK',
    desc: 'Refined, rhythmic, resonant international championship voice',
    rateMultiplier: 1.02,
    pitchMultiplier: 0.92
  },
  drill: {
    id: 'drill',
    name: 'High-Energy Track Coach',
    badge: 'Speed Laboratory',
    desc: 'Intense, rapid-fire track push with high urgency',
    rateMultiplier: 1.25,
    pitchMultiplier: 1.15
  },
  drillSergeant: {
    id: 'drillSergeant',
    name: 'Conditioning Drill Instructor',
    badge: 'Tactical Agility',
    desc: 'Barking, explosive cadence for extreme reaction discipline',
    rateMultiplier: 1.32,
    pitchMultiplier: 0.85
  },
  announcer: {
    id: 'announcer',
    name: 'Stadium Public Announcer',
    badge: 'Jumbotron Broadcast',
    desc: 'Deep resonant broadcast voice for stadium loudspeakers',
    rateMultiplier: 0.92,
    pitchMultiplier: 0.85
  },
  electronic: {
    id: 'electronic',
    name: 'Precision Synthetic Voice',
    badge: 'Zero-Latency DSP',
    desc: 'Crisp robotic electronic clarity for timing automation',
    rateMultiplier: 1.0,
    pitchMultiplier: 1.2
  }
};

// Backward-compatibility aliases for saved coach profile configs
COACH_PROFILES.olympic = COACH_PROFILES.championship;
COACH_PROFILES.nflCombine = COACH_PROFILES.proCombine;

export const CADENCE_PRESETS = {
  championship: {
    id: 'championship',
    category: 'track',
    name: 'World Athletics Standard',
    tag: 'Championship Protocol',
    desc: '3 lead-in sync beeps → "On your marks" (2.2s) → "Set" (1.8s) → 9mm Gun report',
    leadInBeeps: 3,
    leadInInterval: 600,
    marksHoldMs: 2200,
    setDelayMs: 1800,
    starterSound: 'gun',
    coachProfile: 'championship'
  },
  championshipFinal: {
    id: 'championshipFinal',
    category: 'track',
    name: 'World Championship Presentation',
    tag: 'Championship Final',
    desc: 'Stadium attention chime → Extended marks hold (3.5s for block settlement) → 1.9s set hold → Gun',
    leadInBeeps: 3,
    leadInInterval: 750,
    marksHoldMs: 3500,
    setDelayMs: 1900,
    starterSound: 'gun',
    coachProfile: 'championship'
  },
  proCombine: {
    id: 'proCombine',
    category: 'combine',
    name: 'Pro Scouting Combine (40-Yard Dash)',
    tag: 'Pro Scouting Standard',
    desc: '1 sync chime → Rapid "Down... Set" → Snappy 1.2s set hold → Gunshot for scouting trials',
    leadInBeeps: 1,
    leadInInterval: 450,
    marksHoldMs: 1600,
    setDelayMs: 1200,
    starterSound: 'gun',
    coachProfile: 'proCombine'
  },
  highSchool: {
    id: 'highSchool',
    category: 'school',
    name: 'Scholastic / National Championship',
    tag: 'Scholastic Track',
    desc: '3 loud lead-in tones → Clear "Runners to your marks" (2.5s) → "Set" (1.6s) → Electronic horn',
    leadInBeeps: 3,
    leadInInterval: 650,
    marksHoldMs: 2500,
    setDelayMs: 1600,
    starterSound: 'horn',
    coachProfile: 'highSchool'
  },
  reactionDrill: {
    id: 'reactionDrill',
    category: 'drill',
    name: 'Rule 161.2 Anti-Anticipation Drill',
    tag: 'Reaction Conditioning',
    desc: '2 warning beeps → Set → Randomized hold (1.5s - 2.8s) to eliminate flinching before gun',
    leadInBeeps: 2,
    leadInInterval: 500,
    marksHoldMs: 2000,
    setDelayMs: 'random',
    starterSound: 'gun',
    coachProfile: 'drillSergeant'
  },
  rapid: {
    id: 'rapid',
    category: 'racing',
    name: 'Rapid Cadence / 5-Beep Countdown',
    tag: 'Rapid Protocol',
    desc: '5 rhythmic rising beeps (500ms) → Instant electronic horn blast',
    leadInBeeps: 5,
    leadInInterval: 500,
    marksHoldMs: 1500,
    setDelayMs: 1000,
    starterSound: 'horn',
    noVoice: true
  },
  fast: {
    id: 'fast',
    category: 'combine',
    name: 'Collegiate Rapid Combine',
    tag: 'High Throughput',
    desc: '1 lead-in chime → Quick set (1.2s) → Gunshot for rapid multi-athlete roster testing',
    leadInBeeps: 1,
    leadInInterval: 500,
    marksHoldMs: 1500,
    setDelayMs: 1200,
    starterSound: 'gun'
  },
  whistleCadence: {
    id: 'whistleCadence',
    category: 'drill',
    name: 'Field Sports / Dual Whistle Start',
    tag: 'Agility & Shuttle',
    desc: 'Double referee whistle blast ("Tweet-Tweet!") → Ready → Go Whistle for agility/shuttle drills',
    leadInBeeps: 2,
    leadInInterval: 400,
    marksHoldMs: 1800,
    setDelayMs: 1100,
    starterSound: 'whistle',
    coachProfile: 'drill'
  },
  beepOnly: {
    id: 'beepOnly',
    category: 'acoustic',
    name: 'Pure Acoustic Tones (No Voice)',
    tag: 'Tone Only',
    desc: 'High-frequency synthesized tones & electronic horn only (for loud or multilingual tracks)',
    leadInBeeps: 3,
    leadInInterval: 600,
    marksHoldMs: 2000,
    setDelayMs: 1500,
    starterSound: 'horn',
    noVoice: true
  }
};

// Backward-compatibility aliases for saved cadence presets
CADENCE_PRESETS.olympic = CADENCE_PRESETS.championship;
CADENCE_PRESETS.olympicFinal = CADENCE_PRESETS.championshipFinal;
CADENCE_PRESETS.nflCombine = CADENCE_PRESETS.proCombine;
CADENCE_PRESETS.f1 = CADENCE_PRESETS.rapid;

export const DEFAULT_AUDIO_CONFIG = {
  enabled: true,
  language: 'en',
  coachProfile: 'championship',
  selectedVoiceURI: '',
  rate: 1.0,
  pitch: 1.0,
  cadencePreset: 'championship',
  leadInBeeps: 3,
  leadInInterval: 600, // number or 'custom'
  customLeadInInterval: 600,
  marksHoldMs: 2200,
  customMarksHoldMs: 2200,
  setDelayMs: 1800, // number, 'sync', 'random', or 'custom'
  customSetDelayMs: 1800,
  starterSound: 'gun', // 'gun' | 'horn' | 'whistle' | 'custom'
  customSounds: {
    trigger: null,     // { name: 'file.mp3', size: 1234 }
    falseStart: null,
    finish: null,
    leadIn: null,
    pr: null
  },
  announceMarks: true,
  announceSet: true,
  announceSplits: true,
  announceResults: true,
  announcePRs: true,
  announceFalseStart: true
};

/**
 * Calculates effective lead-in beep interval in milliseconds
 */
export function getEffectiveLeadInInterval(config) {
  if (!config) return 600;
  if (config.leadInInterval === 'custom') {
    const val = parseInt(config.customLeadInInterval);
    return isNaN(val) ? 600 : Math.max(100, Math.min(10000, val));
  }
  const val = parseInt(config.leadInInterval);
  return isNaN(val) ? 600 : Math.max(100, Math.min(10000, val));
}

/**
 * Calculates effective post-"Set" delay before the starter trigger in milliseconds
 * MANDATORY: Strictly enforces a minimum of 1200ms (World Athletics Rule TR 16.7 standard 1.5s - 2.5s)
 * to ensure athletes are motionless in set position and trigger sound NEVER fires before or during "Set".
 */
export function getEffectiveSetDelayMs(config) {
  if (!config) return 1800;
  if (config.setDelayMs === 'sync') {
    return Math.max(1200, getEffectiveLeadInInterval(config));
  }
  if (config.setDelayMs === 'random') {
    return Math.round(1500 + Math.random() * 1000); // 1.5s - 2.5s World Athletics Rule TR 16.7
  }
  if (config.setDelayMs === 'custom') {
    const val = parseInt(config.customSetDelayMs);
    return isNaN(val) ? 1800 : Math.max(1200, Math.min(15000, val));
  }
  const val = parseInt(config.setDelayMs);
  return isNaN(val) ? 1800 : Math.max(1200, Math.min(15000, val));
}

/**
 * Calculates effective "On your marks" hold time
 */
export function getEffectiveMarksHoldMs(config) {
  if (!config) return 2200;
  if (config.marksHoldMs === 'custom') {
    const val = parseInt(config.customMarksHoldMs);
    return isNaN(val) ? 2200 : Math.max(500, Math.min(15000, val));
  }
  const val = parseInt(config.marksHoldMs);
  return isNaN(val) ? 2200 : Math.max(500, Math.min(15000, val));
}

export function loadAudioConfig() {
  try {
    const saved = localStorage.getItem('sprintgate_audio_config');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') {
        return {
          ...DEFAULT_AUDIO_CONFIG,
          ...parsed,
          language: parsed.language || DEFAULT_AUDIO_CONFIG.language,
          cadencePreset: parsed.cadencePreset || DEFAULT_AUDIO_CONFIG.cadencePreset,
          customSounds: {
            ...(DEFAULT_AUDIO_CONFIG.customSounds || {}),
            ...(typeof parsed.customSounds === 'object' && parsed.customSounds ? parsed.customSounds : {})
          }
        };
      }
    }
  } catch (e) {
    console.warn("Could not load audio config from localStorage:", e);
  }
  return { ...DEFAULT_AUDIO_CONFIG };
}

export function saveAudioConfig(config) {
  try {
    localStorage.setItem('sprintgate_audio_config', JSON.stringify(config));
  } catch (e) {
    console.warn("Could not save audio config to localStorage:", e);
  }
}

// ----------------- Web Audio Synthesizer Functions ----------------- //

let audioCtx = null;
export function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Lead-in rhythmic cadence beep (Championship style or custom MP3)
 */
export function playLeadInBeep(freq = 880, duration = 0.12, volume = 0.5) {
  try {
    if (hasCustomAudio('lead_in')) {
      playCustomAudioSound('lead_in', volume);
      return;
    }
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    console.warn("Lead-in beep error:", e);
  }
}

/**
 * High-decibel electronic starting horn (Standard synthetic starter tone)
 */
export function playElectronicStarterHorn(duration = 0.45, volume = 0.8) {
  try {
    const ctx = getAudioContext();
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    // Dual frequencies create the classic penetrating track starter horn
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(440, ctx.currentTime);
    
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(880, ctx.currentTime);

    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.setValueAtTime(volume * 0.9, ctx.currentTime + duration * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(ctx.currentTime);
    osc2.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + duration);
    osc2.stop(ctx.currentTime + duration);
  } catch (e) {
    console.warn("Electronic starter horn error:", e);
  }
}

/**
 * Athletic Referee Whistle Synthesizer
 */
export function playWhistleSound(duration = 0.35, volume = 0.7) {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(2400, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(2800, ctx.currentTime + 0.1);
    osc.frequency.linearRampToValueAtTime(2200, ctx.currentTime + duration);

    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    console.warn("Whistle sound error:", e);
  }
}

/**
 * Official Electronic "Set" Position Acoustic Tone
 * Penetrating 1000Hz triangle wave that commands athletes into set position
 */
export function playSetSound(volume = 0.7) {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1000, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {
    console.warn("Set acoustic sound error:", e);
  }
}

/**
 * False Start acoustic warning buzzer or custom recall sound
 */
export function playFalseStartAlert() {
  try {
    if (hasCustomAudio('false_start')) {
      playCustomAudioSound('false_start', 1.0);
      return;
    }
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.5);

    gain.gain.setValueAtTime(0.8, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.55);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.55);
  } catch (e) {
    console.warn("False start buzzer error:", e);
  }
}

/**
 * Gate Finish Line Beam Break Chime or custom finish audio
 */
export function playFinishChime(volume = 0.7) {
  try {
    if (hasCustomAudio('finish')) {
      playCustomAudioSound('finish', volume);
      return;
    }
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523.25, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1046.5, ctx.currentTime + 0.2);

    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {
    console.warn("Finish chime error:", e);
  }
}

/**
 * Personal Record (PR) celebratory fanfare or custom audio
 */
export function playPRCelebration(volume = 0.8) {
  try {
    if (hasCustomAudio('pr')) {
      playCustomAudioSound('pr', volume);
      return;
    }
    const ctx = getAudioContext();
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 arpeggio
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = ctx.currentTime + idx * 0.1;
      const duration = 0.25;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(volume * 0.8, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    });
  } catch (e) {
    console.warn("PR fanfare error:", e);
  }
}

// ----------------- Speech Synthesis Multilingual Engine ----------------- //

// Global State for Speech Synthesis Synchronization & Mutex Locking
let cachedVoices = [];
let activeSpeechDispatchTimer = null;
let activeSpeechSafetyTimer = null;
let activeSpeechResolver = null;
let activeSpeechUtterance = null;

function initVoices() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    cachedVoices = window.speechSynthesis.getVoices() || [];
    if (!window.speechSynthesis.onvoiceschanged) {
      window.speechSynthesis.onvoiceschanged = () => {
        try {
          cachedVoices = window.speechSynthesis.getVoices() || [];
        } catch (e) {}
      };
    }
  } catch (e) {}
}

// Pre-warm voices on module load
initVoices();

/**
 * Abruptly cancels any ongoing or pending speech synthesis and audio timers
 */
export function cancelAllSpeech() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    if (activeSpeechDispatchTimer) {
      clearTimeout(activeSpeechDispatchTimer);
      activeSpeechDispatchTimer = null;
    }
    if (activeSpeechSafetyTimer) {
      clearTimeout(activeSpeechSafetyTimer);
      activeSpeechSafetyTimer = null;
    }
    if (activeSpeechResolver) {
      const resolve = activeSpeechResolver;
      activeSpeechResolver = null;
      resolve(false);
    }
    activeSpeechUtterance = null;
    window.speechSynthesis.cancel();
  } catch (e) {
    console.warn("cancelAllSpeech error:", e);
  }
}

/**
 * Speak localized phrase using SpeechSynthesis with strict single-utterance concurrency locking.
 * Returns a Promise that resolves when the utterance finishes speaking,
 * ensuring subsequent cadence steps (Hold and Trigger Gun) can NEVER play before speech completes.
 * Prevents overlapping voices, queue pileup, and voice-switching lag.
 */
export function speakLocalized(phraseKey, params = {}, config = DEFAULT_AUDIO_CONFIG) {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve(false);
      return;
    }
    if (config && config.enabled === false) {
      resolve(false);
      return;
    }

    try {
      const lang = config?.language || 'en';
      const langDict = TRANSLATIONS[lang] || TRANSLATIONS.en;
      let text = "";

      if (phraseKey === 'marks') text = langDict.marks;
      else if (phraseKey === 'set') text = langDict.set;
      else if (phraseKey === 'falseStart') text = langDict.falseStart;
      else if (phraseKey === 'standUp') text = langDict.standUp || langDict.falseStart;
      else if (phraseKey === 'downSet') text = langDict.downSet || langDict.set;
      else if (phraseKey === 'readyGo') text = langDict.readyGo || `${langDict.set}! Go!`;
      else if (phraseKey === 'splitCallout') text = langDict.splitCallout(params.turn || 1, params.time || 0);
      else if (phraseKey === 'runResult') {
        text = params.isPR ? langDict.prResult(params.name, params.time) : langDict.runResult(params.name, params.time);
      }
      else if (phraseKey === 'verticalJump') text = langDict.verticalJump(params.name, params.inches);
      else if (phraseKey === 'checkIn') text = langDict.checkIn(params.name);
      else if (typeof phraseKey === 'string' && phraseKey.includes(' ')) text = phraseKey;

      if (!text) {
        resolve(false);
        return;
      }

      // STRICT CONCURRENCY LOCK: Cancel any active or pending speech immediately to prevent double voices
      cancelAllSpeech();

      const utterance = new SpeechSynthesisUtterance(text);
      activeSpeechUtterance = utterance;

      // Set language tag
      const langCodes = { en: 'en-US', hi: 'hi-IN', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', ja: 'ja-JP' };
      utterance.lang = langCodes[lang] || 'en-US';

      // Apply Coach Profile multipliers
      const profile = COACH_PROFILES[config?.coachProfile] || COACH_PROFILES.championship || COACH_PROFILES.olympic;
      utterance.rate = Math.max(0.7, Math.min(1.8, (config?.rate || 1.0) * (profile?.rateMultiplier || 1.0)));
      utterance.pitch = Math.max(0.6, Math.min(1.6, (config?.pitch || 1.0) * (profile?.pitchMultiplier || 1.0)));

      // Refresh voice list
      const voices = (cachedVoices && cachedVoices.length > 0) ? cachedVoices : (window.speechSynthesis.getVoices() || []);
      if (config?.selectedVoiceURI) {
        const match = voices.find(v => v.voiceURI === config.selectedVoiceURI);
        if (match) utterance.voice = match;
      } else {
        const targetPrefix = (langCodes[lang] || 'en-US').slice(0, 2);
        // Prioritize natural/online voices over robotic defaults
        const matchingVoice = voices.find(v => v.lang && v.lang.startsWith(targetPrefix) && !v.name.toLowerCase().includes('desktop')) 
          || voices.find(v => v.lang && v.lang.startsWith(targetPrefix));
        if (matchingVoice) utterance.voice = matchingVoice;
      }

      let hasCompleted = false;
      const done = (status = true) => {
        if (!hasCompleted) {
          hasCompleted = true;
          if (activeSpeechSafetyTimer) {
            clearTimeout(activeSpeechSafetyTimer);
            activeSpeechSafetyTimer = null;
          }
          if (activeSpeechResolver === resolve) {
            activeSpeechResolver = null;
          }
          if (activeSpeechUtterance === utterance) {
            activeSpeechUtterance = null;
          }
          resolve(status);
        }
      };

      activeSpeechResolver = done;

      utterance.onend = () => done(true);
      utterance.onerror = (e) => {
        if (e.error !== 'interrupted') {
          console.warn("Speech synthesis error event:", e);
        }
        done(false);
      };

      // Generous safety timeout (3.5s minimum) so speech is never prematurely killed, preventing race condition fallback tones
      const maxSpeechMs = Math.max(3500, text.length * 300);
      activeSpeechSafetyTimer = setTimeout(() => {
        try {
          window.speechSynthesis.cancel();
        } catch (e) {}
        done(false);
      }, maxSpeechMs);

      // Brief tick allows window.speechSynthesis.cancel() to cleanly flush internal buffers in Chromium
      activeSpeechDispatchTimer = setTimeout(() => {
        activeSpeechDispatchTimer = null;
        try {
          if (window.speechSynthesis.paused) window.speechSynthesis.resume();
          window.speechSynthesis.speak(utterance);
        } catch (e) {
          console.warn("Speech speak dispatch error:", e);
          done(false);
        }
      }, 40);

    } catch (err) {
      console.warn("Speech synthesis error:", err);
      resolve(false);
    }
  });
}

/**
 * Guaranteed "Set" Announcement Orchestrator:
 * - If voice cadence is enabled: Speaks localized "Set" (or "Down... Set!" for combine)
 *   and strictly awaits completion of the voice announcement.
 * - CRITICAL RULE: NEVER plays any electronic beep or sound after "Set" voice!
 *   The entire post-"Set" hold interval must be 100% DEAD SILENCE until the starter gun/horn/whistle!
 * - If voice is explicitly disabled (e.g. Tone-Only preset): Plays electronic Set tone as the command.
 * GUARANTEE: After "Set", ONLY the starter sound (gun, electronic horn, or whistle) can EVER play!
 */
export async function announceSetCadence(config = DEFAULT_AUDIO_CONFIG) {
  const isCombine = config?.cadencePreset === 'nflCombine';
  const phrase = isCombine ? 'downSet' : 'set';
  const wantsVoice = config?.enabled !== false && config?.announceSet !== false && !config?.noVoice;

  if (wantsVoice && typeof window !== 'undefined' && 'speechSynthesis' in window) {
    // Speak "Set" and strictly await its completion
    await speakLocalized(phrase, {}, config);
    // After voice "Set", return immediately into hold. NO POST-SET BEEPS OR TONES ALLOWED!
    return;
  }

  // Pure acoustic mode / no-voice preset: electronic Set tone is the command
  playSetSound(0.75);
  await new Promise(r => setTimeout(r, 380));
  // After tone finishes, hold interval begins in absolute silence
}

/**
 * Stadium & Combine Attention Chime (Two-tone crystalline alert)
 */
export function playAttentionChime(volume = 0.7) {
  try {
    const ctx = getAudioContext();
    const t0 = ctx.currentTime;
    [587.33, 880].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = t0 + idx * 0.16;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(volume * 0.75, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.48);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.5);
    });
  } catch (e) {
    console.warn("Attention chime error:", e);
  }
}

/**
 * Dual Referee Whistle Blast ("Tweet-Tweet!") for field & agility drills
 */
export function playDoubleWhistle(volume = 0.7) {
  try {
    playWhistleSound(0.18, volume);
    setTimeout(() => {
      playWhistleSound(0.28, volume);
    }, 240);
  } catch (e) {
    console.warn("Double whistle error:", e);
  }
}

/**
 * World Athletics Rule TR 16.7 False Start Recall Dual Blast
 */
export function playRecallBurstSound(volume = 0.85) {
  try {
    const ctx = getAudioContext();
    const t0 = ctx.currentTime;
    const playBurst = (startTime, dur) => {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      osc1.type = 'sawtooth';
      osc2.type = 'square';
      osc1.frequency.setValueAtTime(880, startTime);
      osc2.frequency.setValueAtTime(1320, startTime);
      gain.gain.setValueAtTime(volume * 0.85, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      osc1.start(startTime);
      osc2.start(startTime);
      osc1.stop(startTime + dur);
      osc2.stop(startTime + dur);
    };
    playBurst(t0, 0.22);
    playBurst(t0 + 0.28, 0.35);
  } catch (e) {
    console.warn("Recall burst sound error:", e);
  }
}

/**
 * Cadence Pace Metronome Tick
 */
export function playMetronomeTick(highPitch = false, volume = 0.5) {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t0 = ctx.currentTime;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(highPitch ? 1760 : 880, t0);
    gain.gain.setValueAtTime(volume * 0.6, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.04);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.05);
  } catch (e) {
    console.warn("Metronome tick error:", e);
  }
}

/**
 * Synthetic Zero-Latency 9mm Gunshot Synthesizer (Zero asset download needed)
 */
export function playSynthesizedGunshot(volume = 1.0) {
  try {
    const ctx = getAudioContext();
    const t0 = ctx.currentTime;

    // 1. Explosive Noise Burst
    const bufferSize = Math.floor(ctx.sampleRate * 0.35);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.07));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3400, t0);
    filter.frequency.exponentialRampToValueAtTime(160, t0 + 0.32);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(volume * 0.9, t0);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    // 2. Sub-bass Thump
    const thump = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(170, t0);
    thump.frequency.exponentialRampToValueAtTime(36, t0 + 0.22);

    thumpGain.gain.setValueAtTime(volume * 0.95, t0);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.25);

    thump.connect(thumpGain);
    thumpGain.connect(ctx.destination);

    noise.start(t0);
    thump.start(t0);
    noise.stop(t0 + 0.36);
    thump.stop(t0 + 0.26);
  } catch (e) {
    console.warn("Synthesized gunshot error:", e);
  }
}

/**
 * Export and Import Audio Configuration JSON
 */
export function exportAudioProfile(config) {
  const exportable = { ...config };
  return JSON.stringify(exportable, null, 2);
}

export function importAudioProfile(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== 'object') throw new Error('Not a valid object');
    return { ...DEFAULT_AUDIO_CONFIG, ...parsed };
  } catch (e) {
    throw new Error('Invalid Audio Profile JSON structure: ' + e.message);
  }
}
