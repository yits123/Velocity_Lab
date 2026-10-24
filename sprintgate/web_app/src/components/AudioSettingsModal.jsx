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

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Volume2, VolumeX, X, Play, Square, RotateCcw, Check, 
  Globe, Radio, Zap, Flag, Sliders, ChevronDown, CheckCircle2,
  Sparkles, Award, Upload, Music, Trash2, Clock, Plus, Minus,
  AlertCircle, Bell, FileAudio, CheckCheck, RefreshCw, Download,
  Layers, Activity, Flame, ShieldAlert, Volume1, Mic, FastForward,
  Share2, ShieldCheck, Timer, Disc, Headphones, Info
} from 'lucide-react';
import VelocityLabLogo from './VelocityLabLogo';
import { 
  TRANSLATIONS, 
  COACH_PROFILES, 
  CADENCE_PRESETS, 
  DEFAULT_AUDIO_CONFIG,
  playLeadInBeep, 
  playElectronicStarterHorn, 
  playWhistleSound,
  playDoubleWhistle,
  playRecallBurstSound,
  playAttentionChime,
  playMetronomeTick,
  playSynthesizedGunshot,
  playFalseStartAlert,
  playFinishChime,
  playPRCelebration,
  speakLocalized,
  announceSetCadence,
  playSetSound,
  getEffectiveLeadInInterval,
  getEffectiveSetDelayMs,
  getEffectiveMarksHoldMs,
  exportAudioProfile,
  importAudioProfile
} from '../utils/soundEngine';
import {
  saveCustomAudioFile,
  removeCustomAudioFile,
  playCustomAudioSound,
  stopCustomAudioSound,
  hasCustomAudio,
  preloadCustomAudioUrls
} from '../utils/customAudioStorage';

export default function AudioSettingsModal({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  playGunshot
}) {
  const [localConfig, setLocalConfig] = useState(() => ({
    ...DEFAULT_AUDIO_CONFIG,
    ...(config || {}),
    language: (config && config.language) || DEFAULT_AUDIO_CONFIG.language || 'en',
    cadencePreset: (config && config.cadencePreset) || DEFAULT_AUDIO_CONFIG.cadencePreset || 'championship',
    customSounds: {
      ...(DEFAULT_AUDIO_CONFIG.customSounds || {}),
      ...((config && typeof config.customSounds === 'object' && config.customSounds) || {})
    }
  }));
  const [availableVoices, setAvailableVoices] = useState([]);
  const [isTestingCadence, setIsTestingCadence] = useState(false);
  const [cadenceTestStep, setCadenceTestStep] = useState(0); // 0 | 1..N | 'marks' | 'set' | 'gun'
  const [playingCustomId, setPlayingCustomId] = useState(null);
  const [activeTab, setActiveTab] = useState('cadence'); // 'cadence' | 'soundboard' | 'custom_audio' | 'voice'
  const [cadenceFilter, setCadenceFilter] = useState('all'); // 'all' | 'track' | 'combine' | 'drill' | 'acoustic'
  const [uploadNotice, setUploadNotice] = useState('');
  
  // Metronome Soundboard State
  const [metronomeBpm, setMetronomeBpm] = useState(140);
  const [isMetronomeActive, setIsMetronomeActive] = useState(false);
  const metronomeIntervalRef = useRef(null);

  // Reaction Time Drill State
  const [drillState, setDrillState] = useState('idle'); // 'idle' | 'marks' | 'set' | 'holding' | 'fired' | 'result' | 'false_start'
  const [drillStartTime, setDrillStartTime] = useState(0);
  const [drillReactionTime, setDrillReactionTime] = useState(null);
  const [drillRating, setDrillRating] = useState('');
  const [drillHistory, setDrillHistory] = useState([]);
  const drillTimeoutRef = useRef(null);

  const fileInputRefs = useRef({});
  const profileImportInputRef = useRef(null);

  useEffect(() => {
    if (config) {
      setLocalConfig({
        ...DEFAULT_AUDIO_CONFIG,
        ...config,
        language: config.language || DEFAULT_AUDIO_CONFIG.language || 'en',
        cadencePreset: config.cadencePreset || DEFAULT_AUDIO_CONFIG.cadencePreset || 'championship',
        customSounds: {
          ...(DEFAULT_AUDIO_CONFIG.customSounds || {}),
          ...(typeof config.customSounds === 'object' && config.customSounds ? config.customSounds : {})
        }
      });
    }
  }, [config, isOpen]);

  // Load custom audio URLs and browser voices on mount
  useEffect(() => {
    preloadCustomAudioUrls().catch(() => {});

    const updateVoices = () => {
      try {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.getVoices) {
          const v = window.speechSynthesis.getVoices();
          if (Array.isArray(v)) {
            setAvailableVoices(v);
          }
        }
      } catch (e) {
        console.warn('SpeechSynthesis getVoices error:', e);
      }
    };
    updateVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  // Metronome clock
  useEffect(() => {
    if (isMetronomeActive) {
      const intervalMs = (60 / metronomeBpm) * 1000;
      playMetronomeTick(true, 0.4);
      metronomeIntervalRef.current = setInterval(() => {
        playMetronomeTick(false, 0.4);
      }, intervalMs);
    } else {
      if (metronomeIntervalRef.current) {
        clearInterval(metronomeIntervalRef.current);
        metronomeIntervalRef.current = null;
      }
    }
    return () => {
      if (metronomeIntervalRef.current) {
        clearInterval(metronomeIntervalRef.current);
      }
    };
  }, [isMetronomeActive, metronomeBpm]);

  // Clean up drill timers on modal unmount or close
  useEffect(() => {
    return () => {
      if (drillTimeoutRef.current) clearTimeout(drillTimeoutRef.current);
      if (metronomeIntervalRef.current) clearInterval(metronomeIntervalRef.current);
    };
  }, [isOpen]);

  // Filter voices safely for current language
  const currentLang = localConfig?.language || 'en';
  const langPrefix = {
    en: 'en',
    hi: 'hi',
    es: 'es',
    fr: 'fr',
    de: 'de',
    ja: 'ja'
  }[currentLang] || 'en';

  const filteredVoices = (availableVoices || []).filter(v => {
    if (!v || typeof v !== 'object') return false;
    const lang = typeof v.lang === 'string' ? v.lang.toLowerCase() : '';
    return lang.startsWith(langPrefix);
  });

  const effectiveInterval = getEffectiveLeadInInterval(localConfig);
  const effectiveSetDelay = getEffectiveSetDelayMs(localConfig);
  const effectiveMarksHold = getEffectiveMarksHoldMs(localConfig);

  const activePreset = (CADENCE_PRESETS && localConfig?.cadencePreset && CADENCE_PRESETS[localConfig.cadencePreset]) ||
    CADENCE_PRESETS?.championship || CADENCE_PRESETS?.olympic || {
      id: 'championship',
      name: 'World Athletics Standard',
      tag: 'Championship Protocol',
      desc: '3 lead-in sync beeps → "On your marks" → "Set" → 9mm Gun report',
      leadInBeeps: 3,
      leadInInterval: 600,
      marksHoldMs: 2200,
      setDelayMs: 1800,
      starterSound: 'gun',
      coachProfile: 'championship'
    };

  const handlePresetSelect = (presetId) => {
    const preset = CADENCE_PRESETS[presetId];
    if (preset) {
      setLocalConfig(prev => ({
        ...prev,
        cadencePreset: presetId,
        leadInBeeps: preset.leadInBeeps,
        leadInInterval: preset.leadInInterval,
        marksHoldMs: preset.marksHoldMs ?? 2200,
        setDelayMs: preset.setDelayMs ?? 1800,
        starterSound: preset.starterSound || prev.starterSound,
        coachProfile: preset.coachProfile || prev.coachProfile
      }));
    }
  };

  const handleTestCadence = async () => {
    if (isTestingCadence) return;
    setIsTestingCadence(true);
    setCadenceTestStep(1);

    const preset = CADENCE_PRESETS[localConfig.cadencePreset] || CADENCE_PRESETS.championship || CADENCE_PRESETS.olympic;

    // Optional Attention Chime for Championship Final or Combine
    if (localConfig.cadencePreset === 'championshipFinal' || localConfig.cadencePreset === 'olympicFinal') {
      playAttentionChime(0.7);
      await new Promise(r => setTimeout(r, 600));
    }

    // 1. Lead-in beeps
    const count = localConfig.leadInBeeps || 0;
    const interval = getEffectiveLeadInInterval(localConfig);

    for (let i = 1; i <= count; i++) {
      setCadenceTestStep(i);
      playLeadInBeep(880 + (i * 20), 0.14, 0.6);
      await new Promise(r => setTimeout(r, interval));
    }

    // 2. Marks
    setCadenceTestStep('marks');
    if (localConfig.announceMarks && !preset.noVoice) {
      if (localConfig.cadencePreset === 'nflCombine') {
        await speakLocalized('downSet', {}, localConfig);
      } else {
        await speakLocalized('marks', {}, localConfig);
      }
    }
    const marksHold = getEffectiveMarksHoldMs(localConfig);
    await new Promise(r => setTimeout(r, marksHold));

    // 3. Set (MANDATORY: Must completely sound and finish before athlete hold and trigger gun!)
    setCadenceTestStep('set');
    await announceSetCadence(localConfig);

    // Interval Manager delay after "Set" before starting trigger sound
    // Strict rule: Hold period strictly begins AFTER "Set" announcement has completely finished!
    const testHold = Math.max(1200, getEffectiveSetDelayMs(localConfig));
    await new Promise(r => setTimeout(r, testHold));

    // 4. Starter sound
    setCadenceTestStep('gun');
    if (localConfig.starterSound === 'custom') {
      const customPlayed = playCustomAudioSound('trigger', 1.0);
      if (!customPlayed) {
        if (playGunshot) playGunshot();
        else playSynthesizedGunshot();
      }
    } else if (localConfig.starterSound === 'horn') {
      playElectronicStarterHorn();
    } else if (localConfig.starterSound === 'whistle') {
      playWhistleSound();
    } else {
      if (playGunshot) playGunshot();
      else playSynthesizedGunshot();
    }

    await new Promise(r => setTimeout(r, 1200));
    setCadenceTestStep(0);
    setIsTestingCadence(false);
  };

  const handleTestSpeech = (phrase = 'runResult') => {
    if (phrase === 'marks') speakLocalized('marks', {}, localConfig);
    else if (phrase === 'set') speakLocalized('set', {}, localConfig);
    else if (phrase === 'downSet') speakLocalized('downSet', {}, localConfig);
    else if (phrase === 'readyGo') speakLocalized('readyGo', {}, localConfig);
    else if (phrase === 'standUp') speakLocalized('standUp', {}, localConfig);
    else speakLocalized('runResult', { name: "Marcus", time: 4.42, isPR: true }, localConfig);
  };

  // Custom audio handlers
  const handleFileUpload = async (soundId, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/') && !/\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name)) {
      alert('Please upload a valid audio file (.mp3, .wav, .ogg, .m4a, .aac)');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      alert('Audio file size exceeds 15MB limit. Please select a smaller track.');
      return;
    }

    try {
      const saved = await saveCustomAudioFile(soundId, file);
      
      setLocalConfig(prev => {
        const nextCustom = { ...(prev.customSounds || {}) };
        nextCustom[soundId] = {
          name: saved.name,
          size: saved.size,
          type: saved.type
        };

        const update = {
          ...prev,
          customSounds: nextCustom
        };

        if (soundId === 'trigger') {
          update.starterSound = 'custom';
        }

        return update;
      });

      setUploadNotice(`✓ "${file.name}" loaded for ${soundId.replace('_', ' ')}!`);
      setTimeout(() => setUploadNotice(''), 4000);
    } catch (err) {
      console.error('File upload failed:', err);
      alert('Failed to save audio file to browser storage. ' + err.message);
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const handleRemoveCustomAudio = async (soundId) => {
    stopCustomAudioSound(soundId);
    if (playingCustomId === soundId) setPlayingCustomId(null);

    await removeCustomAudioFile(soundId);

    setLocalConfig(prev => {
      const nextCustom = { ...(prev.customSounds || {}) };
      delete nextCustom[soundId];

      const update = {
        ...prev,
        customSounds: nextCustom
      };

      if (soundId === 'trigger' && prev.starterSound === 'custom') {
        update.starterSound = 'gun';
      }

      return update;
    });
  };

  const handleTogglePlayCustom = (soundId) => {
    if (playingCustomId === soundId) {
      stopCustomAudioSound(soundId);
      setPlayingCustomId(null);
    } else {
      stopCustomAudioSound(playingCustomId);
      const audio = playCustomAudioSound(soundId, 1.0);
      if (audio) {
        setPlayingCustomId(soundId);
        audio.onended = () => setPlayingCustomId(null);
      } else {
        // Fallback test sound if no custom file exists
        if (soundId === 'trigger') {
          if (localConfig.starterSound === 'horn') playElectronicStarterHorn();
          else if (localConfig.starterSound === 'whistle') playWhistleSound();
          else if (playGunshot) playGunshot();
          else playSynthesizedGunshot();
        } else if (soundId === 'false_start') {
          playFalseStartAlert();
        } else if (soundId === 'finish') {
          playFinishChime();
        } else if (soundId === 'lead_in') {
          playLeadInBeep(880, 0.15, 0.7);
        } else if (soundId === 'pr') {
          playPRCelebration();
        }
      }
    }
  };

  // Soundboard Trigger Handler
  const handleSoundboardTrigger = (action) => {
    switch (action) {
      case 'gun_mp3':
        if (playGunshot) playGunshot();
        else playSynthesizedGunshot();
        break;
      case 'gun_synth':
        playSynthesizedGunshot(1.0);
        break;
      case 'horn':
        playElectronicStarterHorn(0.45, 0.85);
        break;
      case 'whistle':
        playWhistleSound(0.35, 0.8);
        break;
      case 'double_whistle':
        playDoubleWhistle(0.8);
        break;
      case 'recall':
        playRecallBurstSound(0.9);
        break;
      case 'finish':
        playFinishChime(0.8);
        break;
      case 'pr':
        playPRCelebration(0.85);
        break;
      case 'false_start':
        playFalseStartAlert();
        break;
      case 'lead_in':
        playLeadInBeep(880, 0.15, 0.7);
        break;
      case 'attention':
        playAttentionChime(0.75);
        break;
      case 'metronome_tick':
        playMetronomeTick(true, 0.6);
        break;
      default:
        break;
    }
  };

  // Reaction Drill Handlers
  const handleStartDrill = async () => {
    if (drillTimeoutRef.current) clearTimeout(drillTimeoutRef.current);
    setDrillReactionTime(null);
    setDrillRating('');

    setDrillState('marks');
    if (localConfig.enabled) {
      if (localConfig.cadencePreset === 'nflCombine') {
        await speakLocalized('downSet', {}, localConfig);
      } else {
        await speakLocalized('marks', {}, localConfig);
      }
    }

    await new Promise(r => { drillTimeoutRef.current = setTimeout(r, 2200); });

    setDrillState('set');
    // Announce Set and strictly await completion so gun NEVER fires before or during Set
    await announceSetCadence(localConfig);

    const holdDuration = Math.round(1500 + Math.random() * 1100); // 1.5s - 2.6s World Athletics hold
    setDrillState('holding');

    drillTimeoutRef.current = setTimeout(() => {
      const t0 = performance.now();
      setDrillStartTime(t0);
      setDrillState('fired');

      if (localConfig.starterSound === 'custom') {
        const played = playCustomAudioSound('trigger', 1.0);
        if (!played) {
          if (playGunshot) playGunshot();
          else playSynthesizedGunshot();
        }
      } else if (localConfig.starterSound === 'horn') {
        playElectronicStarterHorn();
      } else if (localConfig.starterSound === 'whistle') {
        playWhistleSound();
      } else {
        if (playGunshot) playGunshot();
        else playSynthesizedGunshot();
      }
    }, holdDuration);
  };

  const handleDrillTap = () => {
    if (drillState === 'idle' || drillState === 'result' || drillState === 'false_start') return;

    if (drillState === 'marks' || drillState === 'set' || drillState === 'holding') {
      // False start: athlete moved before the gun!
      if (drillTimeoutRef.current) clearTimeout(drillTimeoutRef.current);
      playRecallBurstSound(0.9);
      setDrillState('false_start');
      setDrillReactionTime(-1);
      setDrillRating('DISQUALIFIED — JUMPED BEFORE GUN (Anticipation Violation)');
      setDrillHistory(prev => [{ rt: -1, rating: 'False Start (Anticipated)', timeStr: new Date().toLocaleTimeString() }, ...prev.slice(0, 4)]);
      return;
    }

    if (drillState === 'fired') {
      const elapsed = Math.round(performance.now() - drillStartTime);
      setDrillReactionTime(elapsed);

      if (elapsed < 100) {
        // World Athletics Rule 161.2 (< 100ms physiological barrier)
        playRecallBurstSound(0.9);
        setDrillState('false_start');
        setDrillRating(`DISQUALIFIED — ${elapsed}ms (Rule TR 16.7: < 100ms Violation)`);
        setDrillHistory(prev => [{ rt: elapsed, rating: 'False Start (<100ms)', timeStr: new Date().toLocaleTimeString() }, ...prev.slice(0, 4)]);
      } else {
        let rating = '';
        if (elapsed < 130) rating = 'WORLD-CLASS REFLEX (<130ms)';
        else if (elapsed < 165) rating = 'PRO / COLLEGIATE CLEARANCE (130-165ms)';
        else if (elapsed < 200) rating = 'GOOD VARSITY REFLEX (165-200ms)';
        else rating = 'SUB-OPTIMAL BLOCK CLEARANCE (>200ms)';

        playFinishChime(0.65);
        setDrillState('result');
        setDrillRating(rating);
        setDrillHistory(prev => [{ rt: elapsed, rating, timeStr: new Date().toLocaleTimeString() }, ...prev.slice(0, 4)]);
      }
    }
  };

  const handleExportProfile = () => {
    const jsonStr = exportAudioProfile(localConfig);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `VelocityLab_AudioConfig_${localConfig.cadencePreset || 'custom'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setUploadNotice('✓ Audio configuration exported to JSON file!');
    setTimeout(() => setUploadNotice(''), 4000);
  };

  const handleImportProfile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = importAudioProfile(event.target.result);
        setLocalConfig(imported);
        setUploadNotice(`✓ Imported profile: "${file.name}" successfully!`);
        setTimeout(() => setUploadNotice(''), 4000);
      } catch (err) {
        alert('Failed to import audio profile JSON: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSave = () => {
    if (onSaveConfig) {
      onSaveConfig(localConfig);
    }
    onClose();
  };

  const languages = [
    { code: 'en', label: 'English', flag: '🇺🇸', sub: 'World Athletics standard' },
    { code: 'hi', label: 'हिन्दी (Hindi)', flag: '🇮🇳', sub: 'भारतीय राष्ट्रीय मानक' },
    { code: 'es', label: 'Español', flag: '🇪🇸', sub: 'Estándar latino/europeo' },
    { code: 'fr', label: 'Français', flag: '🇫🇷', sub: 'Standard d\'athlétisme' },
    { code: 'de', label: 'Deutsch', flag: '🇩🇪', sub: 'DLV Startordnung' },
    { code: 'ja', label: '日本語 (Japanese)', flag: '🇯🇵', sub: '日本陸連公認コール' }
  ];

  const soundboardSlots = [
    {
      id: 'trigger',
      title: 'Starting Trigger Sound',
      icon: '💥',
      desc: 'Acoustic gun or tone fired when athlete is released from the "Set" position.',
      defaultLabel: '9mm Pistol Shot (Built-in)',
      category: 'Primary Starter'
    },
    {
      id: 'false_start',
      title: 'False Start & Recall Horn',
      icon: '🚨',
      desc: 'World Athletics Rule 161.2 secondary recall alarm (< 0.100s or manual recall).',
      defaultLabel: 'Dual-Tone Electronic Horn (880Hz / 1320Hz)',
      category: 'Safety & Recall'
    },
    {
      id: 'finish',
      title: 'Timing Gate Finish Bell',
      icon: '🏁',
      desc: 'High-frequency acoustic chime when runner breaks the final infrared beam.',
      defaultLabel: 'Precision Beam Break Chime',
      category: 'Gate Event'
    },
    {
      id: 'lead_in',
      title: 'Lead-In Cadence Beep',
      icon: '⏱️',
      desc: 'Rhythmic pacing tone played during countdown before "On your marks".',
      defaultLabel: 'Synthesized 880Hz Sine Pulse',
      category: 'Rhythm Pacing'
    },
    {
      id: 'pr',
      title: 'Personal Record (PR) Fanfare',
      icon: '🏆',
      desc: 'Celebratory acoustic fanfare played when an athlete breaks their PR.',
      defaultLabel: 'C5-C6 Arpeggio Fanfare',
      category: 'Celebration'
    }
  ];

  const soundboardMatrixPads = [
    { id: 'gun_mp3', name: '9mm Pistol Shot', icon: '💥', category: 'Starter Report', color: 'from-amber-500/20 to-orange-500/20 border-amber-500/30 text-amber-400' },
    { id: 'gun_synth', name: 'Synthetic 9mm Gun', icon: '⚡', category: 'Zero-Latency DSP', color: 'from-orange-500/20 to-red-500/20 border-orange-500/30 text-orange-400' },
    { id: 'horn', name: 'Electronic Starter Horn', icon: '🚨', category: 'Standard 880Hz', color: 'from-rose-500/20 to-red-500/20 border-rose-500/30 text-rose-400' },
    { id: 'whistle', name: 'Referee Whistle', icon: '📣', category: 'Single Tweet', color: 'from-cyan-500/20 to-sky-500/20 border-cyan-500/30 text-cyan-400' },
    { id: 'double_whistle', name: 'Double Agility Whistle', icon: '🎺', category: 'Dual Burst', color: 'from-teal-500/20 to-emerald-500/20 border-teal-500/30 text-teal-400' },
    { id: 'recall', name: 'Rule 161.2 Recall Blast', icon: '📢', category: 'False Start Alarm', color: 'from-red-500/20 to-rose-600/20 border-red-500/30 text-red-400' },
    { id: 'finish', name: 'Beam Break Finish Chime', icon: '🏁', category: 'Infrared Gate Hit', color: 'from-emerald-500/20 to-green-500/20 border-emerald-500/30 text-emerald-400' },
    { id: 'pr', name: 'PR Celebration Fanfare', icon: '🏆', category: 'C-Major Arpeggio', color: 'from-yellow-500/20 to-amber-500/20 border-yellow-500/30 text-yellow-400' },
    { id: 'false_start', name: 'Low Freq Warning Buzz', icon: '🛑', category: 'Hazard Alert', color: 'from-rose-500/20 to-pink-500/20 border-rose-500/30 text-rose-400' },
    { id: 'lead_in', name: 'Sync Cadence Beep', icon: '⏱️', category: '880Hz Sine Pulse', color: 'from-blue-500/20 to-indigo-500/20 border-blue-500/30 text-blue-400' },
    { id: 'attention', name: 'Stadium Attention Chime', icon: '🔔', category: 'Two-Tone Bell', color: 'from-purple-500/20 to-violet-500/20 border-purple-500/30 text-purple-400' },
    { id: 'metronome_tick', name: 'Cadence Metronome', icon: '🎵', category: `${metronomeBpm} BPM Pacing`, color: 'from-fuchsia-500/20 to-purple-500/20 border-fuchsia-500/30 text-fuchsia-400' }
  ];

  const filteredPresets = useMemo(() => {
    if (!CADENCE_PRESETS || typeof CADENCE_PRESETS !== 'object') return [];
    const list = Object.values(CADENCE_PRESETS).filter(Boolean);
    if (cadenceFilter === 'all') return list;
    return list.filter(p => p && p.category === cadenceFilter);
  }, [cadenceFilter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-5" onClick={onClose}>
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl max-h-[94vh] overflow-hidden flex flex-col shadow-2xl relative"
        onClick={e => e.stopPropagation()}
      >
        {/* Hidden Import File Input */}
        <input 
          type="file" 
          accept=".json,application/json" 
          ref={profileImportInputRef} 
          onChange={handleImportProfile} 
          className="hidden" 
        />

        {/* Modal Header */}
        <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-emerald-500/10 via-transparent to-transparent">
          <div className="flex items-center gap-3">
            <VelocityLabLogo variant="compact" className="h-7 w-auto hidden sm:block" />
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 sm:hidden">
              <Volume2 size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  Audio Cadence & Starter Studio
                </h2>
                <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-500/30 uppercase">
                  Broadcast Suite
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sprint Start Protocols, Pro Combine Cadences, 12-Pad Soundboard, WA TR 16.7 Reaction Drills & MP3 Storage
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Export Profile Button */}
            <button
              onClick={handleExportProfile}
              className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-700 text-[11px] font-bold transition"
              title="Export Current Audio & Cadence Settings to JSON"
            >
              <Download size={13} />
              <span>Export</span>
            </button>

            {/* Import Profile Button */}
            <button
              onClick={() => profileImportInputRef.current?.click()}
              className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-700 text-[11px] font-bold transition"
              title="Import Audio Configuration JSON"
            >
              <Upload size={13} />
              <span>Import</span>
            </button>

            <button 
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition"
              title="Close Modal"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tab Navigation Bar - Touch-Friendly Pill Bar with Zero Ugly Scrollbars */}
        <div className="p-2 sm:p-2.5 border-b border-slate-200 dark:border-slate-800/80 bg-slate-100/90 dark:bg-slate-950/90">
          <div 
            className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar scroll-smooth"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <button
              onClick={() => setActiveTab('cadence')}
              className={`flex-1 sm:flex-none min-h-[46px] py-2.5 px-3.5 sm:px-5 rounded-xl sm:rounded-2xl flex items-center justify-center gap-2.5 text-xs sm:text-sm font-bold transition-all whitespace-nowrap select-none shadow-xs ${
                activeTab === 'cadence'
                  ? 'bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/25 scale-[1.01]'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-850'
              }`}
            >
              <Radio size={17} className={activeTab === 'cadence' ? 'text-slate-950' : 'text-emerald-500'} />
              <span>1. Starting Cadence & Timers</span>
            </button>

            <button
              onClick={() => setActiveTab('soundboard')}
              className={`flex-1 sm:flex-none min-h-[46px] py-2.5 px-3.5 sm:px-5 rounded-xl sm:rounded-2xl flex items-center justify-center gap-2.5 text-xs sm:text-sm font-bold transition-all whitespace-nowrap select-none shadow-xs ${
                activeTab === 'soundboard'
                  ? 'bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/25 scale-[1.01]'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-850'
              }`}
            >
              <Disc size={17} className={activeTab === 'soundboard' ? 'text-slate-950' : 'text-emerald-500'} />
              <span>2. Soundboard Matrix & Drill</span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-black border ${
                activeTab === 'soundboard'
                  ? 'bg-slate-950 text-emerald-400 border-slate-950'
                  : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
              }`}>
                NEW
              </span>
            </button>

            <button
              onClick={() => setActiveTab('custom_audio')}
              className={`flex-1 sm:flex-none min-h-[46px] py-2.5 px-3.5 sm:px-5 rounded-xl sm:rounded-2xl flex items-center justify-center gap-2.5 text-xs sm:text-sm font-bold transition-all whitespace-nowrap select-none shadow-xs ${
                activeTab === 'custom_audio'
                  ? 'bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/25 scale-[1.01]'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-850'
              }`}
            >
              <FileAudio size={17} className={activeTab === 'custom_audio' ? 'text-slate-950' : 'text-emerald-500'} />
              <span>3. Custom MP3 Storage</span>
              {localConfig.customSounds && Object.keys(localConfig.customSounds).length > 0 && (
                <span className={`w-2.5 h-2.5 rounded-full ${activeTab === 'custom_audio' ? 'bg-slate-950 animate-pulse' : 'bg-emerald-500 animate-pulse'}`}></span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('voice')}
              className={`flex-1 sm:flex-none min-h-[46px] py-2.5 px-3.5 sm:px-5 rounded-xl sm:rounded-2xl flex items-center justify-center gap-2.5 text-xs sm:text-sm font-bold transition-all whitespace-nowrap select-none shadow-xs ${
                activeTab === 'voice'
                  ? 'bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/25 scale-[1.01]'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-850'
              }`}
            >
              <Globe size={17} className={activeTab === 'voice' ? 'text-slate-950' : 'text-emerald-500'} />
              <span>4. Voice Profiles & Callouts</span>
            </button>
          </div>
        </div>

        {/* Upload Alert Notice */}
        {uploadNotice && (
          <div className="bg-emerald-500/15 border-b border-emerald-500/30 px-5 py-2 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2 font-mono">
            <CheckCheck size={14} />
            <span>{uploadNotice}</span>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex flex-col gap-6 text-slate-800 dark:text-slate-200">
          
          {/* Main Master Audio Toggle Banner */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${localConfig.enabled ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' : 'bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-slate-400'}`}>
                {localConfig.enabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Audio Synthesis & Hardware Starter Horns</span>
                  {localConfig.enabled && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 font-bold">
                      SYSTEM ARMED
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Plays real starter gun acoustic wave, rhythmic sync beeps, voice prompts, and hardware buzzer trigger on Node A
                </div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={localConfig.enabled} 
                onChange={e => setLocalConfig({ ...localConfig, enabled: e.target.checked })} 
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>

          {/* ======================================================== */}
          {/* TAB 1: CADENCE PRESETS & INTERVAL TIMERS                 */}
          {/* ======================================================== */}
          {activeTab === 'cadence' && (
            <div className="flex flex-col gap-5">
              
              {/* Stepper Timeline Visualizer */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-inner flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <Timer size={14} />
                    <span>Live Cadence Sequence Stepper</span>
                  </div>
                  <span className="text-[11px] font-mono text-gray-500 dark:text-slate-400 font-bold">
                    Active: <span className="text-gray-900 dark:text-white">{activePreset.name}</span>
                  </span>
                </div>

                {/* Visual Step Bars */}
                <div className="grid grid-cols-4 gap-2 text-center text-[11px] font-mono font-bold">
                  {/* Step 1: Lead-In */}
                  <div className={`p-2.5 rounded-xl border transition flex flex-col items-center justify-center ${
                    cadenceTestStep > 0 && typeof cadenceTestStep === 'number'
                      ? 'bg-emerald-500/30 border-emerald-400 text-white shadow-lg animate-pulse'
                      : 'bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 shadow-xs'
                  }`}>
                    <span className="text-[10px] text-gray-400 dark:text-slate-500 uppercase">1. Lead-In</span>
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">{localConfig.leadInBeeps} Beeps</span>
                    <span className="text-[9px] text-gray-400 dark:text-slate-500 font-normal">@{effectiveInterval}ms</span>
                  </div>

                  {/* Step 2: Marks */}
                  <div className={`p-2.5 rounded-xl border transition flex flex-col items-center justify-center ${
                    cadenceTestStep === 'marks'
                      ? 'bg-sky-500/30 border-sky-400 text-white shadow-lg animate-pulse'
                      : 'bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 shadow-xs'
                  }`}>
                    <span className="text-[10px] text-gray-400 dark:text-slate-500 uppercase">2. Position</span>
                    <span className="text-xs text-sky-600 dark:text-sky-400 mt-0.5">"Marks"</span>
                    <span className="text-[9px] text-gray-400 dark:text-slate-500 font-normal">{effectiveMarksHold}ms hold</span>
                  </div>

                  {/* Step 3: Set */}
                  <div className={`p-2.5 rounded-xl border transition flex flex-col items-center justify-center ${
                    cadenceTestStep === 'set'
                      ? 'bg-amber-500/30 border-amber-400 text-white shadow-lg animate-pulse'
                      : 'bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 shadow-xs'
                  }`}>
                    <span className="text-[10px] text-gray-400 dark:text-slate-500 uppercase">3. Tension</span>
                    <span className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">"Set"</span>
                    <span className="text-[9px] text-gray-400 dark:text-slate-500 font-normal">
                      {localConfig.setDelayMs === 'random' ? 'Random Hold' : `${effectiveSetDelay}ms`}
                    </span>
                  </div>

                  {/* Step 4: Gun */}
                  <div className={`p-2.5 rounded-xl border transition flex flex-col items-center justify-center ${
                    cadenceTestStep === 'gun'
                      ? 'bg-rose-500/40 border-rose-400 text-white shadow-lg animate-ping'
                      : 'bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 shadow-xs'
                  }`}>
                    <span className="text-[10px] text-gray-400 dark:text-slate-500 uppercase">4. Fire</span>
                    <span className="text-xs text-rose-600 dark:text-rose-400 mt-0.5">
                      {localConfig.starterSound === 'gun' ? '9mm Gun' :
                       localConfig.starterSound === 'horn' ? 'Start Horn' :
                       localConfig.starterSound === 'whistle' ? 'Whistle' : 'Custom MP3'}
                    </span>
                    <span className="text-[9px] text-gray-400 dark:text-slate-500 font-normal">0.00s Laser Armed</span>
                  </div>
                </div>

                {/* Cadence Test Controls */}
                <div className="flex flex-col sm:flex-row items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800 gap-3">
                  <div className="text-xs sm:text-sm font-mono text-gray-500 dark:text-slate-400">
                    {isTestingCadence ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold animate-pulse flex items-center gap-2">
                        <Activity size={16} />
                        <span>
                          {cadenceTestStep === 'marks' ? 'Step 2: "On your marks..." (Hold)' :
                           cadenceTestStep === 'set' ? `Step 3: "Set..." (Hold ${effectiveSetDelay}ms)` :
                           cadenceTestStep === 'gun' ? '💥 STEP 4: STARTER TRIGGER FIRED!' :
                           `Step 1: Lead-in beep ${cadenceTestStep} of ${localConfig.leadInBeeps}...`}
                        </span>
                      </span>
                    ) : (
                      <span>Click to rehearse the full audio cadence sequence before running on track</span>
                    )}
                  </div>

                  <button
                    onClick={handleTestCadence}
                    disabled={isTestingCadence}
                    className="w-full sm:w-auto px-6 py-3.5 rounded-xl sm:rounded-2xl bg-emerald-500 hover:bg-[#00e691] text-black font-black text-xs sm:text-sm uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 min-h-[48px]"
                  >
                    <Play size={16} fill="currentColor" />
                    <span>{isTestingCadence ? 'Running Cadence...' : 'Simulate Starting Cadence'}</span>
                  </button>
                </div>
              </div>

              {/* Cadence Category Filter Tabs */}
              <div className="flex items-center justify-between flex-wrap gap-2.5">
                <div className="text-xs sm:text-sm font-bold uppercase tracking-wider text-gray-700 dark:text-slate-300 flex items-center gap-2">
                  <Radio size={16} className="text-emerald-500" />
                  <span>Select Starter Cadence Preset</span>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 text-xs sm:text-sm font-bold flex-wrap">
                  {[
                    { id: 'all', label: 'All Presets' },
                    { id: 'track', label: 'World Athletics & Track' },
                    { id: 'combine', label: 'Pro Combine & Agility' },
                    { id: 'drill', label: 'Reaction & Drills' },
                    { id: 'acoustic', label: 'Tone Only' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setCadenceFilter(tab.id)}
                      className={`px-3 sm:px-4 py-2 rounded-xl transition min-h-[38px] ${
                        cadenceFilter === tab.id
                          ? 'bg-emerald-500 text-black shadow-sm font-black'
                          : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Presets Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {filteredPresets.map(preset => {
                  if (!preset) return null;
                  const isSelected = localConfig.cadencePreset === preset.id;
                  return (
                    <button
                      key={preset.id || preset.name}
                      onClick={() => handlePresetSelect(preset.id)}
                      className={`p-4 sm:p-5 rounded-2xl sm:rounded-3xl border text-left transition flex flex-col justify-between relative overflow-hidden group shadow-xs min-h-[155px] ${
                        isSelected 
                          ? 'bg-emerald-50 dark:bg-emerald-500/15 border-2 border-emerald-500 text-gray-900 dark:text-white shadow-md' 
                          : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-emerald-500/50 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-mono font-bold uppercase px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-slate-700">
                            {preset.tag || 'Standard'}
                          </span>
                          {isSelected && <Check size={18} className="text-emerald-500 dark:text-emerald-400 shrink-0" />}
                        </div>
                        <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition">
                          {preset.name || 'Starting Cadence'}
                        </h4>
                        <p className="text-xs sm:text-[13px] text-gray-600 dark:text-slate-400 leading-relaxed mt-1.5">
                          {preset.desc || ''}
                        </p>
                      </div>

                      <div className="mt-3.5 pt-2.5 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-xs font-mono text-gray-500 dark:text-slate-400">
                        <span>Beeps: <b className="text-gray-900 dark:text-white">{preset.leadInBeeps ?? 0}</b></span>
                        <span>Hold: <b className="text-gray-900 dark:text-white">{preset.setDelayMs === 'random' ? '1.5-2.8s' : `${preset.setDelayMs ?? 1800}ms`}</b></span>
                        <span className="uppercase text-emerald-600 dark:text-emerald-400 font-bold">{preset.starterSound || 'gun'}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Cadence Timing Customization Controls */}
              <div className="flex flex-col gap-4 p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <div className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Custom Interval & Hold Duration Manager</span>
                  <span className="text-xs font-mono text-emerald-400 font-bold">Millisecond Precision</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  {/* 1. Lead-In Beeps Count */}
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">Lead-In Beeps</label>
                    <select
                      value={localConfig.leadInBeeps}
                      onChange={e => setLocalConfig({ ...localConfig, leadInBeeps: parseInt(e.target.value) })}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-2xl px-3.5 py-3 text-xs sm:text-sm font-bold text-slate-900 dark:text-white min-h-[48px]"
                    >
                      <option value={0}>0 (Instant Start)</option>
                      <option value={1}>1 Beep (Rapid Combine)</option>
                      <option value={2}>2 Beeps (Dual Warning)</option>
                      <option value={3}>3 Beeps (Championship Standard)</option>
                      <option value={5}>5 Beeps (Rapid Countdown)</option>
                    </select>
                  </div>

                  {/* 2. Beep Rhythm / Interval */}
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">Beep Rhythm</label>
                    <select
                      value={localConfig.leadInInterval === 'custom' || (![450, 500, 600, 650, 750, 800].includes(Number(localConfig.leadInInterval)) && typeof localConfig.leadInInterval === 'number') ? 'custom' : localConfig.leadInInterval}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === 'custom') {
                          setLocalConfig({ 
                            ...localConfig, 
                            leadInInterval: 'custom', 
                            customLeadInInterval: localConfig.customLeadInInterval || 600 
                          });
                        } else {
                          setLocalConfig({ ...localConfig, leadInInterval: parseInt(val) });
                        }
                      }}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-2xl px-3.5 py-3 text-xs sm:text-sm font-bold text-slate-900 dark:text-white min-h-[48px]"
                    >
                      <option value={450}>450ms (Fast Tempo)</option>
                      <option value={500}>500ms (Rapid Cadence)</option>
                      <option value={600}>600ms (Championship Cadence)</option>
                      <option value={650}>650ms (High School)</option>
                      <option value={750}>750ms (Championship)</option>
                      <option value="custom">✏️ Custom ({localConfig.customLeadInInterval || 600}ms)...</option>
                    </select>
                  </div>

                  {/* 3. Post-"Set" Hold Delay */}
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">Post-"Set" Hold</label>
                    <select
                      value={
                        localConfig.setDelayMs === 'custom' || 
                        (!['sync', 'random', 500, 1000, 1200, 1500, 1600, 1800, 1900, 2000, 2500].includes(localConfig.setDelayMs) && typeof localConfig.setDelayMs === 'number')
                          ? 'custom' 
                          : (localConfig.setDelayMs ?? 1800)
                      }
                      onChange={e => {
                        const val = e.target.value;
                        if (val === 'custom') {
                          setLocalConfig({ 
                            ...localConfig, 
                            setDelayMs: 'custom',
                            customSetDelayMs: localConfig.customSetDelayMs || 1800
                          });
                        } else if (val === 'sync' || val === 'random') {
                          setLocalConfig({ ...localConfig, setDelayMs: val });
                        } else {
                          setLocalConfig({ ...localConfig, setDelayMs: parseInt(val) });
                        }
                      }}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-2xl px-3.5 py-3 text-xs sm:text-sm font-bold text-slate-900 dark:text-white min-h-[48px]"
                    >
                      <option value={1200}>1200ms (1.2s Combine / Rapid)</option>
                      <option value={1500}>1500ms (1.5s College)</option>
                      <option value={1600}>1600ms (1.6s Scholastic)</option>
                      <option value={1800}>1800ms (1.8s Championship Standard)</option>
                      <option value={1900}>1900ms (1.9s Championship Final)</option>
                      <option value={2000}>2000ms (2.0s Long Hold)</option>
                      <option value="random">🎲 Random (1.5s - 2.8s WA Rule TR 16.7)</option>
                      <option value="custom">✏️ Custom ({Math.max(1200, localConfig.customSetDelayMs || 1800)}ms)...</option>
                    </select>
                  </div>

                  {/* 4. Starter Trigger Sound */}
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5 flex items-center justify-between">
                      <span>Trigger Sound</span>
                      {hasCustomAudio('trigger') && (
                        <span className="text-[10px] text-emerald-400 font-mono font-bold">MP3 ACTIVE</span>
                      )}
                    </label>
                    <select
                      value={localConfig.starterSound}
                      onChange={e => setLocalConfig({ ...localConfig, starterSound: e.target.value })}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-2xl px-3.5 py-3 text-xs sm:text-sm font-bold text-slate-900 dark:text-white min-h-[48px]"
                    >
                      <option value="gun">💥 9mm Pistol Shot</option>
                      <option value="horn">🚨 Electronic Starter Horn</option>
                      <option value="whistle">📣 Referee Whistle</option>
                      <option value="custom">
                        🎵 Custom MP3 {localConfig.customSounds?.trigger?.name ? `(${localConfig.customSounds.trigger.name.slice(0, 15)})` : '(Upload in Tab 3)'}
                      </option>
                    </select>
                  </div>
                </div>

                {/* Custom numeric fine-tuner if 'custom' selected */}
                {(localConfig.leadInInterval === 'custom' || localConfig.setDelayMs === 'custom') && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                    {localConfig.leadInInterval === 'custom' && (
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">Custom Beep Interval (ms)</span>
                        <div className="flex items-center gap-2">
                          <input 
                            type="number" 
                            min="100" 
                            max="3000" 
                            step="25" 
                            value={localConfig.customLeadInInterval || 600} 
                            onChange={e => setLocalConfig({ ...localConfig, customLeadInInterval: parseInt(e.target.value) || 100 })} 
                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-900 dark:text-white w-28 text-center" 
                          />
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{localConfig.customLeadInInterval || 600} ms</span>
                        </div>
                      </div>
                    )}

                    {localConfig.setDelayMs === 'custom' && (
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400">Custom Post-"Set" Delay (ms)</span>
                        <div className="flex items-center gap-2">
                          <input 
                            type="number" 
                            min="1200" 
                            max="8000" 
                            step="50" 
                            value={Math.max(1200, localConfig.customSetDelayMs || 1800)} 
                            onChange={e => setLocalConfig({ ...localConfig, customSetDelayMs: Math.max(1200, parseInt(e.target.value) || 1200) })} 
                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-900 dark:text-white w-28 text-center" 
                          />
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                            {((Math.max(1200, localConfig.customSetDelayMs || 1800)) / 1000).toFixed(2)}s ({Math.max(1200, localConfig.customSetDelayMs || 1800)} ms)
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: SOUNDBOARD MATRIX & REACTION DRILL                */}
          {/* ======================================================== */}
          {activeTab === 'soundboard' && (
            <div className="flex flex-col gap-6">
              
              {/* Top Banner: Studio Soundboard Matrix */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <Disc size={15} />
                      <span>Studio Soundboard Matrix (12 Instant Trigger Pads)</span>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Zero-latency Web Audio synthesizers with acoustic harmonics & hardware test triggers
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                    Live Audio Engine
                  </span>
                </div>

                {/* 12-Pad Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {soundboardMatrixPads.map(pad => (
                    <button
                      key={pad.id}
                      onClick={() => handleSoundboardTrigger(pad.id)}
                      className={`p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl border bg-gradient-to-br ${pad.color} hover:brightness-125 active:scale-95 transition flex flex-col justify-between text-left shadow-sm group min-h-[86px] sm:min-h-[96px]`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl">{pad.icon}</span>
                        <Play size={14} className="opacity-70 group-hover:opacity-100 transition" />
                      </div>
                      <div>
                        <div className="text-xs sm:text-sm font-black truncate">{pad.name}</div>
                        <div className="text-[10px] opacity-80 font-mono truncate">{pad.category}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Metronome Tempo Controller */}
              <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-2xl border ${isMetronomeActive ? 'bg-fuchsia-500/30 border-fuchsia-400 text-fuchsia-600 dark:text-fuchsia-300 animate-pulse' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400'}`}>
                    <Music size={22} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>Cadence Pacing Metronome</span>
                      <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-fuchsia-500/10 dark:bg-fuchsia-500/20 text-fuchsia-700 dark:text-fuchsia-300 border border-fuchsia-500/30 font-bold">
                        {metronomeBpm} BPM
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Rhythmic auditory cue for stride turnover and block departure training
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <input 
                    type="range" 
                    min="100" 
                    max="220" 
                    step="5" 
                    value={metronomeBpm} 
                    onChange={e => setMetronomeBpm(parseInt(e.target.value))} 
                    className="accent-fuchsia-500 cursor-pointer w-36" 
                  />
                  <button
                    onClick={() => setIsMetronomeActive(!isMetronomeActive)}
                    className={`px-5 py-2.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-black uppercase tracking-wider transition flex items-center gap-2 shrink-0 min-h-[44px] ${
                      isMetronomeActive 
                        ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20' 
                        : 'bg-fuchsia-600 hover:bg-fuchsia-500 text-white shadow-md shadow-fuchsia-600/20'
                    }`}
                  >
                    {isMetronomeActive ? <Square size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                    <span>{isMetronomeActive ? 'Stop' : 'Start'}</span>
                  </button>
                </div>
              </div>

              {/* Coach Voice Phrase Quick-Test Grid */}
              <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-col gap-3.5">
                <div className="flex items-center justify-between">
                  <div className="text-xs sm:text-sm font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 flex items-center gap-2">
                    <Mic size={16} />
                    <span>Starter Voice Phrase Testboard</span>
                  </div>
                  <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                    Language: <b className="text-slate-900 dark:text-white">{languages.find(l => l.code === localConfig.language)?.label}</b>
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {[
                    { id: 'marks', label: '"On your marks"', icon: '📢', desc: 'Standard Block Call' },
                    { id: 'set', label: '"Set!"', icon: '⚡', desc: 'Tension Trigger' },
                    { id: 'downSet', label: '"Down... Set!"', icon: '🏈', desc: 'Pro Combine' },
                    { id: 'readyGo', label: '"Ready... Go!"', icon: '📣', desc: 'Agility Drill' },
                    { id: 'standUp', label: '"Stand Up (Recall)"', icon: '🛑', desc: 'WA False Start' },
                    { id: 'runResult', label: 'Finish Callout', icon: '🏆', desc: 'Athlete & Split' }
                  ].map(v => (
                    <button
                      key={v.id}
                      onClick={() => handleTestSpeech(v.id)}
                      className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-700/80 hover:border-sky-500/50 text-left transition flex items-center gap-2.5 group shadow-xs min-h-[62px]"
                    >
                      <span className="text-xl shrink-0">{v.icon}</span>
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition truncate">{v.label}</div>
                        <div className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-mono">{v.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* INTERACTIVE REACTION TIME TRAINING DRILL */}
              <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-emerald-500/30 flex flex-col gap-4 shadow-xl relative overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                      <Zap size={16} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">Interactive Reaction Time Drill</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Audits neuromuscular launch latency against World Athletics Rule TR 16.7</p>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    Threshold: 100ms
                  </span>
                </div>

                {/* Big Interactive Tap Station Area */}
                <div 
                  onClick={handleDrillTap}
                  className={`p-8 rounded-2xl border-2 transition flex flex-col items-center justify-center cursor-pointer select-none text-center relative ${
                    drillState === 'idle'
                      ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-600 dark:text-slate-400'
                      : drillState === 'marks'
                      ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-400 dark:border-sky-500/60 text-sky-800 dark:text-sky-300 animate-pulse'
                      : drillState === 'set' || drillState === 'holding'
                      ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-400 dark:border-amber-500/80 text-amber-800 dark:text-amber-300'
                      : drillState === 'fired'
                      ? 'bg-emerald-500 border-emerald-400 text-black shadow-[0_0_50px_rgba(0,230,145,0.7)] scale-105'
                      : drillState === 'false_start'
                      ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-400 dark:border-rose-500 text-rose-800 dark:text-rose-300'
                      : 'bg-white dark:bg-slate-900 border-emerald-500/60 text-slate-900 dark:text-white'
                  }`}
                >
                  <div className="text-4xl mb-2">
                    {drillState === 'idle' && '🎯'}
                    {drillState === 'marks' && '🏃‍♂️'}
                    {drillState === 'set' && '🧘'}
                    {drillState === 'holding' && '⏳'}
                    {drillState === 'fired' && '💥'}
                    {drillState === 'false_start' && '🚨'}
                    {drillState === 'result' && '⏱️'}
                  </div>

                  <div className="text-lg font-black tracking-wide">
                    {drillState === 'idle' && 'Click "Arm Drill" Below to Begin'}
                    {drillState === 'marks' && 'ON YOUR MARKS... (Do Not Tap!)'}
                    {drillState === 'set' && 'SET... (Hold Motionless!)'}
                    {drillState === 'holding' && 'HOLDING... (Wait for the Gun!)'}
                    {drillState === 'fired' && '💥 TAP NOW! TAP NOW!'}
                    {drillState === 'false_start' && 'FALSE START DISQUALIFICATION!'}
                    {drillState === 'result' && `${drillReactionTime}ms Reaction Time`}
                  </div>

                  <p className="text-xs opacity-75 mt-1 font-mono">
                    {drillState === 'idle' && 'Simulates true randomized gun release with false start penalties'}
                    {drillState === 'holding' && 'Tapping before the gun triggers instant Rule 161.2 DQ'}
                    {drillState === 'fired' && 'Touch anywhere or tap this pad immediately'}
                    {drillState === 'result' && drillRating}
                    {drillState === 'false_start' && drillRating}
                  </p>
                </div>

                {/* Drill Trigger Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleStartDrill}
                      disabled={drillState === 'marks' || drillState === 'set' || drillState === 'holding' || drillState === 'fired'}
                      className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-[#00e691] text-black font-black text-xs uppercase tracking-wider transition flex items-center gap-2 shadow-md disabled:opacity-50"
                    >
                      <Zap size={14} fill="currentColor" />
                      <span>{drillState === 'idle' || drillState === 'result' || drillState === 'false_start' ? 'Arm Reaction Drill' : 'Sequence Running...'}</span>
                    </button>

                    {(drillState === 'result' || drillState === 'false_start') && (
                      <button
                        onClick={() => {
                          setDrillState('idle');
                          setDrillReactionTime(null);
                        }}
                        className="px-3.5 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition flex items-center gap-1.5"
                      >
                        <RotateCcw size={13} />
                        <span>Reset</span>
                      </button>
                    )}
                  </div>

                  {/* Past Attempts Pills */}
                  {drillHistory.length > 0 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto text-[10px] font-mono">
                      <span className="text-slate-500 font-bold uppercase mr-1">Recent:</span>
                      {drillHistory.map((h, i) => (
                        <span 
                          key={i} 
                          className={`px-2 py-1 rounded-lg border font-bold ${
                            h.rt === -1 || h.rt < 100 
                              ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' 
                              : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          }`}
                        >
                          {h.rt > 0 ? `${h.rt}ms` : 'DQ'}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: CUSTOM MP3 SOUNDBOARD STORAGE                     */}
          {/* ======================================================== */}
          {activeTab === 'custom_audio' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <FileAudio size={14} />
                    <span>Custom Audio & MP3 Soundboard Studio</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Upload your own audio tracks (.mp3, .wav, .ogg, .m4a) stored permanently with zero latency
                  </p>
                </div>
                <span className="text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                  IndexedDB 0ms Latency
                </span>
              </div>

              {/* Soundboard Slots List */}
              <div className="flex flex-col gap-3.5">
                {soundboardSlots.map(slot => {
                  if (!slot) return null;
                  const customMeta = localConfig?.customSounds?.[slot.id];
                  const hasCustom = Boolean(customMeta && (typeof customMeta === 'string' || (typeof customMeta === 'object' && (customMeta.name || customMeta.size))));
                  const isPlaying = playingCustomId === slot.id;
                  const customName = typeof customMeta === 'string' ? customMeta : customMeta?.name || 'Custom Audio';
                  const sizeKb = typeof customMeta?.size === 'number' ? ` • ${(customMeta.size / 1024).toFixed(1)} KB` : '';

                  return (
                    <div 
                      key={slot.id}
                      className={`p-4 sm:p-5 rounded-2xl sm:rounded-3xl border transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 ${
                        hasCustom 
                          ? 'bg-emerald-500/10 dark:bg-emerald-950/20 border-emerald-500/40' 
                          : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      {/* Left info */}
                      <div className="flex items-start gap-3.5 min-w-0 flex-1">
                        <div className="text-2xl p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center shrink-0">
                          {slot.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-black text-slate-900 dark:text-white">
                              {slot.title}
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-bold">
                              {slot.category}
                            </span>
                            {hasCustom ? (
                              <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 dark:bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                                <Check size={12} />
                                <span>Custom File Active</span>
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-500 font-mono">
                                {slot.defaultLabel}
                              </span>
                            )}
                          </div>
                          
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                            {hasCustom 
                              ? `Loaded: "${customName}"${sizeKb}` 
                              : slot.desc}
                          </p>
                        </div>
                      </div>

                      {/* Right controls */}
                      <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
                        {/* Hidden file input */}
                        <input
                          type="file"
                          accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac"
                          ref={el => fileInputRefs.current[slot.id] = el}
                          onChange={e => handleFileUpload(slot.id, e)}
                          className="hidden"
                        />

                        {/* Test Play Button */}
                        <button
                          type="button"
                          onClick={() => handleTogglePlayCustom(slot.id)}
                          className={`px-4 py-2.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 transition min-h-[42px] ${
                            isPlaying
                              ? 'bg-rose-500 text-white animate-pulse'
                              : 'bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-xs'
                          }`}
                          title={isPlaying ? "Stop audio preview" : "Play preview"}
                        >
                          {isPlaying ? <Square size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
                          <span>{isPlaying ? 'Playing...' : 'Test'}</span>
                        </button>

                        {/* Upload Button */}
                        <button
                          type="button"
                          onClick={() => fileInputRefs.current[slot.id]?.click()}
                          className="px-4 py-2.5 rounded-xl sm:rounded-2xl bg-emerald-500 hover:bg-[#00e691] text-slate-950 font-black text-xs sm:text-sm transition flex items-center gap-2 shadow-sm min-h-[42px]"
                          title="Upload MP3 or audio file"
                        >
                          <Upload size={14} />
                          <span>{hasCustom ? 'Replace' : 'Upload MP3'}</span>
                        </button>

                        {/* Remove / Reset Button */}
                        {hasCustom && (
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomAudio(slot.id)}
                            className="p-2.5 rounded-xl sm:rounded-2xl bg-white dark:bg-slate-800 hover:bg-rose-500/10 dark:hover:bg-rose-500/20 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 hover:border-rose-500/40 transition min-h-[42px]"
                            title="Revert to built-in default sound"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Instructions and tips box */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-400">
                <Sparkles size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-bold text-slate-900 dark:text-slate-200">Coach Pro Tip:</span> Uploading a custom gunshot or airhorn MP3 overrides the starting trigger sound with zero audio latency. Files are saved locally inside your browser's persistent IndexedDB cache.
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 4: MULTILINGUAL VOICES & CALLOUTS                    */}
          {/* ======================================================== */}
          {activeTab === 'voice' && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-3.5">
                <div className="text-xs sm:text-sm font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 flex items-center gap-2">
                  <Globe size={16} />
                  <span>Multilingual Voice Announcements & Starter Packs</span>
                </div>

                {/* Language Selector Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {languages.map(l => {
                    const isSelected = localConfig.language === l.code;
                    return (
                      <button
                        key={l.code}
                        onClick={() => setLocalConfig({ ...localConfig, language: l.code, selectedVoiceURI: '' })}
                        className={`p-3 sm:p-3.5 rounded-2xl border text-left transition flex items-center gap-3 min-h-[64px] ${
                          isSelected
                            ? 'bg-sky-50 dark:bg-sky-500/15 border-2 border-sky-500 text-sky-900 dark:text-white shadow-sm font-bold'
                            : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-400 text-slate-800 dark:text-slate-300'
                        }`}
                      >
                        <span className="text-2xl shrink-0">{l.flag}</span>
                        <div className="min-w-0">
                          <div className="text-xs sm:text-sm font-bold truncate">{l.label}</div>
                          <div className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">{l.sub}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Coach Voice Profiles Grid */}
                <div className="mt-2">
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">Coach Voice Profile Pack</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {(COACH_PROFILES ? Object.values(COACH_PROFILES).filter(Boolean) : []).map(cp => {
                      const isSelected = localConfig.coachProfile === cp.id;
                      return (
                        <button
                          key={cp.id || cp.name}
                          onClick={() => setLocalConfig({ ...localConfig, coachProfile: cp.id })}
                          className={`p-3 sm:p-3.5 rounded-2xl border text-left transition flex flex-col justify-between min-h-[88px] sm:min-h-[96px] ${
                            isSelected 
                              ? 'bg-emerald-50 dark:bg-emerald-500/20 border-2 border-emerald-500 text-emerald-800 dark:text-emerald-400 font-bold shadow-xs' 
                              : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          <div>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 mb-1.5 inline-block truncate max-w-full border border-slate-200 dark:border-slate-700 font-bold">
                              {cp.badge || 'Official'}
                            </span>
                            <div className="text-xs sm:text-sm font-bold truncate">{cp.name}</div>
                          </div>
                          <span className="text-[10px] sm:text-xs text-slate-500 mt-1 line-clamp-2 leading-snug">{cp.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* System Installed Voices Dropdown */}
                {filteredVoices.length > 0 && (
                  <div className="mt-2">
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">
                      Device Synthesizer Voice ({filteredVoices.length} available)
                    </label>
                    <select
                      value={localConfig.selectedVoiceURI || ''}
                      onChange={e => setLocalConfig({ ...localConfig, selectedVoiceURI: e.target.value })}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-2xl px-3.5 py-3 text-xs sm:text-sm font-medium text-slate-900 dark:text-white min-h-[48px]"
                    >
                      <option value="">Default System Voice for {(localConfig?.language || 'EN').toUpperCase()}</option>
                      {filteredVoices.map((v, idx) => (
                        <option key={v.voiceURI || `${v.name}-${v.lang}-${idx}`} value={v.voiceURI || v.name}>
                          {v.name || 'System Voice'} ({v.lang || 'Default'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Pitch & Rate Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                  <div>
                    <div className="flex justify-between text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                      <span>Speed / Cadence Rate:</span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{localConfig.rate || 1.0}x</span>
                    </div>
                    <input 
                      type="range" 
                      min="0.7" 
                      max="1.5" 
                      step="0.05" 
                      value={localConfig.rate || 1.0} 
                      onChange={e => setLocalConfig({ ...localConfig, rate: parseFloat(e.target.value) })} 
                      className="w-full accent-[#00D084] cursor-pointer" 
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                      <span>Pitch / Timbre:</span>
                      <span className="font-mono text-sky-600 dark:text-sky-400 font-bold">{localConfig.pitch || 1.0}x</span>
                    </div>
                    <input 
                      type="range" 
                      min="0.6" 
                      max="1.4" 
                      step="0.05" 
                      value={localConfig.pitch || 1.0} 
                      onChange={e => setLocalConfig({ ...localConfig, pitch: parseFloat(e.target.value) })} 
                      className="w-full accent-sky-500 cursor-pointer" 
                    />
                  </div>
                </div>

                {/* Test Voice Speech */}
                <button
                  onClick={() => handleTestSpeech('runResult')}
                  className="w-full py-3.5 px-5 rounded-xl sm:rounded-2xl bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-sky-600 dark:text-sky-400 font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-xs min-h-[48px]"
                >
                  <Volume2 size={16} />
                  <span>Preview Voice Announcement in {languages.find(l => l.code === (localConfig?.language || 'en'))?.label || 'Selected Language'}</span>
                </button>
              </div>

              {/* Section: Announcement Triggers */}
              <div className="flex flex-col gap-3">
                <div className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Sliders size={16} />
                  <span>Active Announcement Callouts</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
                  <label className="flex items-center gap-3 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 cursor-pointer min-h-[56px] shadow-xs hover:border-emerald-500/40 transition">
                    <input 
                      type="checkbox" 
                      checked={localConfig.announceMarks} 
                      onChange={e => setLocalConfig({ ...localConfig, announceMarks: e.target.checked })} 
                      className="accent-[#00D084] w-5 h-5 rounded cursor-pointer shrink-0"
                    />
                    <span className="font-medium text-slate-700 dark:text-slate-300">"On your marks" voice callout</span>
                  </label>

                  <label className="flex items-center gap-3 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 cursor-not-allowed opacity-90 min-h-[56px]">
                    <input 
                      type="checkbox" 
                      checked={true}
                      disabled={true}
                      className="accent-[#00D084] w-5 h-5 rounded cursor-not-allowed shrink-0"
                    />
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <span>"Set" announcement</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-bold">
                          MANDATORY
                        </span>
                      </span>
                      <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        World Athletics Rule TR 16.7 — trigger gun/horn/whistle cannot fire without Set
                      </span>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 cursor-pointer min-h-[56px] shadow-xs hover:border-emerald-500/40 transition">
                    <input 
                      type="checkbox" 
                      checked={localConfig.announceSplits} 
                      onChange={e => setLocalConfig({ ...localConfig, announceSplits: e.target.checked })} 
                      className="accent-[#00D084] w-5 h-5 rounded cursor-pointer shrink-0"
                    />
                    <span className="font-medium text-slate-700 dark:text-slate-300">Agility split callouts (mid-drill)</span>
                  </label>

                  <label className="flex items-center gap-3 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 cursor-pointer min-h-[56px] shadow-xs hover:border-emerald-500/40 transition">
                    <input 
                      type="checkbox" 
                      checked={localConfig.announceResults} 
                      onChange={e => setLocalConfig({ ...localConfig, announceResults: e.target.checked })} 
                      className="accent-[#00D084] w-5 h-5 rounded cursor-pointer shrink-0"
                    />
                    <span className="font-medium text-slate-700 dark:text-slate-300">Finish time & Personal Records</span>
                  </label>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
            <button
              onClick={() => {
                try {
                  localStorage.removeItem('sprintgate_audio_config');
                } catch (e) {}
                setLocalConfig({ ...DEFAULT_AUDIO_CONFIG });
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition min-h-[42px]"
            >
              <RotateCcw size={15} />
              <span>Reset Defaults</span>
            </button>

            {/* Quick Profile Export on mobile */}
            <button
              onClick={handleExportProfile}
              className="sm:hidden flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold min-h-[40px]"
            >
              <Download size={13} />
              <span>Export</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-5 py-3 rounded-xl sm:rounded-2xl border border-slate-300 dark:border-slate-700 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition min-h-[48px]"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 sm:flex-none px-6 py-3 rounded-xl sm:rounded-2xl bg-emerald-500 hover:bg-[#00e691] text-slate-950 text-xs sm:text-sm font-black transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 min-h-[48px]"
            >
              <CheckCircle2 size={16} />
              <span>Save & Apply</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
