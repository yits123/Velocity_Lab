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

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Zap, Activity, Gauge, Flag, AlertTriangle, User, CheckCircle2, 
  Wind, TrendingUp, Sparkles, ChevronRight, Eye, ShieldCheck, Flame,
  Layers, ArrowUpRight, Award, Compass, Timer, Navigation, Check,
  Crosshair, Disc, Radio
} from 'lucide-react';
import VirtualSprinter, { useVirtualRunnerSync } from './VirtualSprinter';

const SPLIT_DISTANCES = {
  1: 40,
  2: 10,
  3: 20,
  4: 30,
  101: 10,
  102: 20,
  103: 30,
  104: 40,
  201: 10,
  202: 20,
  301: 10,
  302: 30
};

/**
 * StandardSprintTrackBox
 * Elite Broadcast Telemetry HUD Overhaul
 * Left Pod: Radial Velocity Tachometer Gauge with Peak Hold & Live Acc
 * Right Pod: 2.5D Isometric Parallax Track with 3D Blocks, Laser Towers, Sector Split Chips & Ghost Comparison
 */
export default function StandardSprintTrackBox({
  trackDistance = '40',
  displayTime = 0,
  isRunning = false,
  sequenceState = 'idle',
  activeRunner = null,
  statusA = { online: false, beam_broken: false },
  statusB = { online: false, beam_broken: false },
  liveSplits = [],
  windSpeed = '',
  windMode = 'manual',
  windMeta = null,
  surfaceType = 'Track',
  history = [],
  results = [],
  showTachometer: propShowTachometer = false
}) {
  const [speedUnit, setSpeedUnit] = useState('ms'); // 'ms' | 'kmh' | 'mph'
  const [ghostMode, setGhostMode] = useState('off'); // 'pr' | 'session' | 'target' | 'off'
  const [showTachometer, setShowTachometer] = useState(propShowTachometer);
  const [tachoMode, setTachoMode] = useState('combo'); // 'combo' | 'dial' | 'gforce'
  const [selectedSurface, setSelectedSurface] = useState(surfaceType || 'Track');

  const [isDark, setIsDark] = useState(() => 
    typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : true
  );

  useEffect(() => {
    const checkTheme = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (surfaceType) setSelectedSurface(surfaceType);
  }, [surfaceType]);

  const distNum = useMemo(() => {
    const val = parseFloat(trackDistance);
    return isNaN(val) || val <= 0 ? 40 : val;
  }, [trackDistance]);

  // Safe numeric display time (prevents NaN / string concatenation)
  const timeNum = useMemo(() => {
    const t = parseFloat(displayTime);
    return isNaN(t) || t < 0 ? 0 : t;
  }, [displayTime]);

  // Personal Best (PR) for active athlete at this exact distance
  const athletePR = useMemo(() => {
    if (!activeRunner?.name || activeRunner.name === 'No runner in queue' || !history || history.length === 0) return null;
    const matching = history.filter(h => 
      (h.name === activeRunner.name || (activeRunner.bib && h.bib === activeRunner.bib)) && 
      parseFloat(h.distance || 40) === distNum &&
      parseFloat(h.time) > 0.5
    );
    if (matching.length === 0) return null;
    const best = [...matching].sort((a,b) => parseFloat(a.time) - parseFloat(b.time))[0];
    return parseFloat(best.time);
  }, [activeRunner, history, distNum]);

  // Session Best (fastest run in results or history for this distance today)
  const sessionBest = useMemo(() => {
    const allValid = [...(results || []), ...(history || [])].filter(r => 
      parseFloat(r.distance || 40) === distNum && parseFloat(r.time) > 0.5
    );
    if (allValid.length === 0) return null;
    const best = [...allValid].sort((a,b) => parseFloat(a.time) - parseFloat(b.time))[0];
    return { time: parseFloat(best.time), name: best.name };
  }, [results, history, distNum]);

  // Benchmark target duration for ghost runner (e.g., 40m in ~4.85s or scaled to distance)
  const ghostTargetTime = useMemo(() => {
    if (ghostMode === 'pr' && athletePR) return athletePR;
    if (ghostMode === 'session' && sessionBest) return sessionBest.time;
    if (ghostMode === 'target') return 4.75 * (distNum / 40);
    return athletePR || (sessionBest ? sessionBest.time : 4.90 * (distNum / 40));
  }, [ghostMode, athletePR, sessionBest, distNum]);

  const ghostTheme = useMemo(() => {
    if (ghostMode === 'off') {
      return {
        label: 'GHOST OFF',
        short: 'GHOST OFF',
        color: 'text-gray-400 dark:text-slate-400',
        bg: 'bg-gray-100 dark:bg-slate-800',
        border: 'border-gray-300 dark:border-slate-700',
        glow: '',
        avatarBg: 'bg-gray-500/50',
        avatarBorder: 'border-gray-400',
        laser: 'transparent',
        icon: '👻'
      };
    }
    if (ghostMode === 'session') {
      return {
        label: `HEAT RECORD (${(sessionBest?.time || 4.70).toFixed(2)}s)`,
        short: 'HEAT BEST',
        color: 'text-purple-300',
        bg: 'bg-purple-950/90',
        border: 'border-purple-500/70',
        glow: 'shadow-[0_0_16px_rgba(168,85,247,0.85)]',
        avatarBg: 'bg-purple-600/60',
        avatarBorder: 'border-purple-300',
        laser: 'rgba(168,85,247,0.7)',
        icon: '⚡'
      };
    }
    if (ghostMode === 'target') {
      return {
        label: `TARGET GOAL (${(4.75 * (distNum / 40)).toFixed(2)}s)`,
        short: 'TARGET',
        color: 'text-amber-300',
        bg: 'bg-amber-950/90',
        border: 'border-amber-500/70',
        glow: 'shadow-[0_0_16px_rgba(245,158,11,0.85)]',
        avatarBg: 'bg-amber-600/60',
        avatarBorder: 'border-amber-300',
        laser: 'rgba(245,158,11,0.7)',
        icon: '🥇'
      };
    }
    return {
      label: athletePR ? `PR GHOST (${athletePR.toFixed(2)}s)` : `BENCHMARK (${(4.90 * (distNum / 40)).toFixed(2)}s)`,
      short: athletePR ? 'PERSONAL BEST' : 'BENCHMARK',
      color: 'text-indigo-300',
      bg: 'bg-indigo-950/90',
      border: 'border-indigo-500/70',
      glow: 'shadow-[0_0_16px_rgba(99,102,241,0.85)]',
      avatarBg: 'bg-indigo-600/60',
      avatarBorder: 'border-indigo-300',
      laser: 'rgba(99,102,241,0.7)',
      icon: '👻'
    };
  }, [ghostMode, athletePR, sessionBest, distNum]);

  // Virtual Sprinter Synchronizer Hooks for Lane 1 (Live Runner) and Lane 2 (Benchmark Ghost)
  const isSessionRunning = isRunning || sequenceState === 'running';
  const isSessionFinished = sequenceState === 'finished';

  const lastSplitMeters = useMemo(() => {
    if (!liveSplits || liveSplits.length === 0) return 0;
    const last = liveSplits[liveSplits.length - 1];
    return last?.distanceMeters || (liveSplits.length / 4) * distNum;
  }, [liveSplits, distNum]);

  const liveRunnerTelemetry = useVirtualRunnerSync({
    isRunning: isSessionRunning,
    isFinished: isSessionFinished,
    distanceMeters: distNum,
    testMode: 'STRAIGHT_SPRINT',
    targetTimeSec: ghostTargetTime,
    lastSplitMeters: lastSplitMeters,
    isBenchmark: false,
  });

  const benchmarkRunnerTelemetry = useVirtualRunnerSync({
    isRunning: isSessionRunning,
    isFinished: isSessionFinished,
    distanceMeters: distNum,
    testMode: 'STRAIGHT_SPRINT',
    targetTimeSec: ghostTargetTime,
    isBenchmark: true,
  });

  // Harmonized runner progress, speed and acceleration
  const { progressPct, estimatedMeters, currentVelocity, currentKmH, currentMph, liveAcceleration } = useMemo(() => {
    if (sequenceState === 'finished') {
      const finalTime = Math.max(0.1, timeNum);
      const avgSpeed = distNum / finalTime;
      return {
        progressPct: 95,
        estimatedMeters: distNum,
        currentVelocity: avgSpeed,
        currentKmH: avgSpeed * 3.6,
        currentMph: avgSpeed * 2.23694,
        liveAcceleration: 0
      };
    }

    if (!isSessionRunning) {
      return {
        progressPct: 4,
        estimatedMeters: 0,
        currentVelocity: 0,
        currentKmH: 0,
        currentMph: 0,
        liveAcceleration: 0
      };
    }

    // High-fidelity physiological kinematics from useVirtualRunnerSync
    const vel = liveRunnerTelemetry.instantVelocityMs || 0;
    const acc = liveRunnerTelemetry.accelerationMs2 || 0;
    const estMeters = liveRunnerTelemetry.estimatedDistanceM || 0;
    const pct = 4 + ((liveRunnerTelemetry.progressPercent || 0) / 100) * 91;

    return {
      progressPct: Math.min(95, Math.max(4, pct)),
      estimatedMeters: estMeters,
      currentVelocity: vel,
      currentKmH: vel * 3.6,
      currentMph: vel * 2.23694,
      liveAcceleration: acc
    };
  }, [distNum, timeNum, isSessionRunning, sequenceState, liveRunnerTelemetry]);

  // G-Force, Sprint Dynamics & Biomechanical Mechanical Power
  const liveGLong = useMemo(() => {
    return liveAcceleration / 9.80665;
  }, [liveAcceleration]);

  const liveGLat = useMemo(() => {
    if (!isRunning && sequenceState !== 'running') return 0;
    // Lateral stride oscillation (step frequency ~3.8 Hz, 24 rad/s)
    const amplitude = Math.min(0.24, 0.04 + (currentVelocity / 12) * 0.18);
    return Math.sin(timeNum * 24) * amplitude;
  }, [isRunning, sequenceState, timeNum, currentVelocity]);

  const liveGTotal = useMemo(() => {
    return Math.sqrt(Math.pow(liveGLong, 2) + Math.pow(liveGLat, 2));
  }, [liveGLong, liveGLat]);

  const livePowerWkg = useMemo(() => {
    return Math.max(0, liveAcceleration * currentVelocity);
  }, [liveAcceleration, currentVelocity]);

  // Peak velocity and Peak G-force tracking during the run with zero re-trigger bugs
  const [peakVelocity, setPeakVelocity] = useState(0);
  const [peakGForce, setPeakGForce] = useState(0);

  useEffect(() => {
    if (sequenceState === 'idle' || sequenceState === 'waiting_start') {
      setPeakVelocity(0);
      setPeakGForce(0);
    } else if (isRunning || sequenceState === 'running') {
      setPeakVelocity(prev => Math.max(prev, currentVelocity));
      setPeakGForce(prev => Math.max(prev, liveGTotal));
    }
  }, [currentVelocity, liveGTotal, isRunning, sequenceState]);

  // Ghost Runner Progress
  const ghostProgress = useMemo(() => {
    if (ghostMode === 'off') return null;
    if (!isSessionRunning && !isSessionFinished) {
      return { pct: 4, meters: 0, velocity: 0 };
    }
    const pct = 4 + ((benchmarkRunnerTelemetry.progressPercent || 0) / 100) * 91;
    return {
      pct: Math.min(95, Math.max(4, pct)),
      meters: benchmarkRunnerTelemetry.estimatedDistanceM || 0,
      velocity: benchmarkRunnerTelemetry.instantVelocityMs || 0
    };
  }, [ghostMode, isSessionRunning, isSessionFinished, benchmarkRunnerTelemetry]);

  // Live Delta against Ghost
  const liveDelta = useMemo(() => {
    if (!ghostProgress || (!isSessionRunning && !isSessionFinished)) {
      return null;
    }
    const meterDelta = estimatedMeters - ghostProgress.meters;
    const refSpeed = Math.max(2.5, currentVelocity || ghostProgress.velocity || 7.0);
    const timeDelta = -(meterDelta / refSpeed); // negative = faster / ahead
    const isAhead = meterDelta >= 0;

    return {
      meterDelta: Math.abs(meterDelta),
      timeDelta: timeDelta,
      formattedTime: `${timeDelta <= 0 ? '-' : '+'}${Math.abs(timeDelta).toFixed(2)}s`,
      formattedMeters: `${isAhead ? '+' : '-'}${Math.abs(meterDelta).toFixed(1)}m`,
      isAhead
    };
  }, [estimatedMeters, ghostProgress, currentVelocity, isSessionRunning, isSessionFinished]);

  // Intermediate Track Stations (0m, 10m, 20m, 30m, 40m)
  const trackStations = useMemo(() => {
    const fractions = [0, 0.25, 0.50, 0.75, 1.0];
    return fractions.map((frac, idx) => ({
      id: idx,
      meters: Math.round(frac * distNum),
      fraction: frac,
      pct: 4 + (frac * 91),
      isStart: idx === 0,
      isFinish: idx === fractions.length - 1
    }));
  }, [distNum]);

  // Sector Split Differential Badges (Live Delta)
  // Purple (-0.22s): Fastest split of the current training session
  // Green (-0.14s): Faster than personal best (PR)
  // Amber/Red (+0.09s): Slower than target benchmark
  const splitDeltas = useMemo(() => {
    if (!liveSplits || liveSplits.length === 0) return [];
    
    return liveSplits.map((split, idx) => {
      const splitTime = parseFloat(split.time) || 0;
      const frac = (idx + 1) / (liveSplits.length + 1);
      
      const prTimeForSplit = athletePR ? athletePR * frac : ghostTargetTime * frac;
      const sessionBestTimeForSplit = sessionBest ? sessionBest.time * frac : null;
      const benchmarkTimeForSplit = ghostTargetTime * frac;

      const isPurple = sessionBestTimeForSplit ? splitTime <= sessionBestTimeForSplit + 0.005 : false;
      const isGreen = !isPurple && athletePR && splitTime < prTimeForSplit;

      let refTime = isPurple && sessionBestTimeForSplit 
        ? sessionBestTimeForSplit 
        : isGreen && prTimeForSplit 
        ? prTimeForSplit 
        : benchmarkTimeForSplit;
      
      let deltaVal = splitTime - refTime;
      const formattedDelta = deltaVal <= 0 
        ? `-${Math.abs(deltaVal).toFixed(2)}s` 
        : `+${Math.abs(deltaVal).toFixed(2)}s`;

      return {
        node: split.node || idx + 1,
        time: splitTime,
        delta: formattedDelta,
        tier: isPurple ? 'purple' : isGreen ? 'green' : 'amber',
        tierLabel: isPurple ? 'SESSION FASTEST' : isGreen ? 'PR DELTA' : 'TARGET DELTA',
        fraction: frac,
        distanceMeters: Math.round(frac * distNum)
      };
    });
  }, [liveSplits, ghostTargetTime, sessionBest, athletePR, distNum]);

  // Broadcast Telemetry Sector Strip Data (S1, S2, S3, S4)
  const sectorStripData = useMemo(() => {
    const fractions = [0.25, 0.50, 0.75, 1.0];
    return fractions.map((frac, idx) => {
      const sectorNum = idx + 1;
      const sectorDist = Math.round(frac * distNum);
      const prevDist = Math.round((fractions[idx - 1] || 0) * distNum);
      
      // Match split if recorded
      const matched = splitDeltas.find(s => Math.abs(s.fraction - frac) < 0.15);
      
      // Check active state
      const isPast = estimatedMeters >= sectorDist;
      const isInSector = (isRunning || sequenceState === 'running') && estimatedMeters >= prevDist && estimatedMeters < sectorDist;

      return {
        sectorNum,
        label: `SEC ${sectorNum}`,
        range: `${prevDist}–${sectorDist}m`,
        matched,
        isPast,
        isInSector
      };
    });
  }, [distNum, splitDeltas, estimatedMeters, isRunning, sequenceState]);

  const runnerName = activeRunner?.name && activeRunner.name !== 'No runner in queue' 
    ? activeRunner.name 
    : 'Active Sprinter';

  // Surface background themes with authentic 2.5D isometric styling
  const surfaceThemes = {
    Track: {
      label: 'Mondo Tartan',
      bg: 'bg-gradient-to-r from-red-950/90 via-red-900/60 to-red-950/90 border-red-800/60',
      grain: 'bg-[repeating-linear-gradient(45deg,#000_0,#000_2px,transparent_0,transparent_8px)] opacity-25',
      curb: 'from-red-950 to-stone-900 border-red-900/80',
      lines: 'border-white/30',
      dash: 'border-red-400/40',
      accent: '#FF4D4D'
    },
    Blue: {
      label: 'Championship Polyurethane',
      bg: 'bg-gradient-to-r from-blue-950/90 via-indigo-950/70 to-blue-950/90 border-blue-800/60',
      grain: 'bg-[repeating-linear-gradient(45deg,#000_0,#000_2px,transparent_0,transparent_7px)] opacity-20',
      curb: 'from-blue-950 to-slate-900 border-blue-900/80',
      lines: 'border-cyan-300/35',
      dash: 'border-cyan-400/40',
      accent: '#00E5FF'
    },
    Turf: {
      label: 'Field Turf',
      bg: 'bg-gradient-to-r from-emerald-950/90 via-green-900/60 to-emerald-950/90 border-emerald-800/60',
      grain: 'bg-[radial-gradient(#052e16_1px,transparent_1px)] [background-size:12px_12px] opacity-40',
      curb: 'from-emerald-950 to-stone-900 border-emerald-900/80',
      lines: 'border-white/35',
      dash: 'border-emerald-400/40',
      accent: '#00D084'
    },
    Court: {
      label: 'Indoor Hardwood',
      bg: 'bg-gradient-to-r from-[#29170e] via-[#3d2315] to-[#29170e] border-amber-900/60',
      grain: 'bg-[repeating-linear-gradient(0deg,#000_0,#000_1px,transparent_0,transparent_10px)] opacity-30',
      curb: 'from-[#1c0f09] to-stone-900 border-amber-950',
      lines: 'border-amber-200/40',
      dash: 'border-amber-400/40',
      accent: '#F59E0B'
    }
  };

  const activeSurface = surfaceThemes[selectedSurface] || surfaceThemes.Track;

  // Mathematically accurate 240° SVG Tachometer Dial
  const maxDialSpeed = 12.0;
  const needleDeg = Math.min(120, Math.max(-120, -120 + ((currentVelocity / maxDialSpeed) * 240)));
  const peakNeedleDeg = Math.min(120, Math.max(-120, -120 + ((peakVelocity / maxDialSpeed) * 240)));
  const ghostNeedleDeg = useMemo(() => {
    if (!ghostProgress || ghostMode === 'off') return null;
    return Math.min(120, Math.max(-120, -120 + ((ghostProgress.velocity / maxDialSpeed) * 240)));
  }, [ghostProgress, ghostMode, maxDialSpeed]);

  const totalArcLength = 218;
  const activeArcOffset = Math.max(0, totalArcLength - ((Math.min(maxDialSpeed, currentVelocity) / maxDialSpeed) * totalArcLength));

  // Redline zone threshold (10.0 m/s ~ 36.0 km/h - elite sprint speed)
  const isRedline = currentVelocity >= 10.0;

  // Sprint Phase & Gear Indicator
  const sprintPhase = useMemo(() => {
    if (sequenceState === 'finished') {
      return { 
        gear: 'FIN', 
        label: 'FINISH LINE', 
        sub: 'Target Distance Crossed', 
        color: 'text-emerald-500 dark:text-emerald-400', 
        bg: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300' 
      };
    }
    if (!isRunning && sequenceState !== 'running') {
      return { 
        gear: 'N', 
        label: 'STAGING BLOCKS', 
        sub: 'Ready For Reaction', 
        color: 'text-gray-500 dark:text-slate-400', 
        bg: 'bg-gray-100 dark:bg-slate-800/60 border-gray-200 dark:border-slate-700/60 text-gray-700 dark:text-slate-300' 
      };
    }
    if (estimatedMeters < 12 || liveAcceleration > 2.5) {
      return { 
        gear: '1', 
        label: 'DRIVE PHASE', 
        sub: 'Low Block Drive & Max Impulse', 
        color: 'text-amber-500 dark:text-amber-400', 
        bg: 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300' 
      };
    }
    if (estimatedMeters < 25) {
      return { 
        gear: '2', 
        label: 'TRANSITION', 
        sub: 'Torso Rise & Stride Turnover', 
        color: 'text-sky-500 dark:text-sky-400', 
        bg: 'bg-sky-500/15 border-sky-500/40 text-sky-700 dark:text-sky-300' 
      };
    }
    return { 
      gear: '3', 
      label: 'MAX VELOCITY', 
      sub: 'Top-End Elastic Turnover', 
      color: 'text-purple-500 dark:text-purple-400', 
      bg: 'bg-purple-500/15 border-purple-500/40 text-purple-700 dark:text-purple-300' 
    };
  }, [sequenceState, isRunning, estimatedMeters, liveAcceleration]);

  // Kinematic Shift Lights (9 LED indicators: 3 green, 3 yellow, 2 red, 1 purple)
  const speedRatio = Math.min(1.0, currentVelocity / 11.5);
  const activeLeds = Math.round(speedRatio * 9);

  // Calibrated Dial Ticks (major every 2 m/s, minor every 0.5 m/s)
  const dialTicks = useMemo(() => {
    const ticks = [];
    for (let s = 0; s <= 12; s += 0.5) {
      const isMajor = Number.isInteger(s) && s % 2 === 0;
      const isRedlineTick = s >= 10.0;
      const deg = -120 + ((s / 12) * 240);
      ticks.push({
        speed: s,
        isMajor,
        isRedlineTick,
        deg
      });
    }
    return ticks;
  }, []);

  // 2D G-Force Reticle Coordinates (Center: 70, 70, Max Radius: 54, Scale: 45 px/G)
  const gForcePoint = useMemo(() => {
    const rawX = 70 + (liveGLat * 45);
    const rawY = 70 - (liveGLong * 45); // forward acceleration is upwards
    const dx = rawX - 70;
    const dy = rawY - 70;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxR = 54;
    if (dist > maxR && dist > 0) {
      return {
        x: 70 + (dx / dist) * maxR,
        y: 70 + (dy / dist) * maxR,
        dist,
        clamped: true
      };
    }
    return { x: rawX, y: rawY, dist, clamped: false };
  }, [liveGLat, liveGLong]);

  const peakGRadius = useMemo(() => {
    return Math.min(54, Math.max(0, peakGForce * 45));
  }, [peakGForce]);

  return (
    <div className="w-full mt-4 sm:mt-5 bg-white dark:bg-gradient-to-b dark:from-gray-900 dark:via-slate-950 dark:to-black text-gray-900 dark:text-gray-100 rounded-3xl border border-gray-200 dark:border-slate-800/90 p-3.5 sm:p-5 shadow-sm dark:shadow-2xl relative overflow-hidden flex flex-col gap-3.5">
      
      {/* Background futuristic glow grid */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-950/20 via-transparent to-transparent pointer-events-none"></div>

      {/* Top HUD Telemetry Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2.5 relative z-10 border-b border-gray-200 dark:border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_10px_rgba(6,182,212,0.9)]"></div>
          <span className="text-xs font-mono font-extrabold tracking-widest uppercase text-cyan-600 dark:text-cyan-400 flex items-center gap-1.5">
            <Activity size={14} />
            LIVE TELEMETRY HUD • {distNum}M SPRINT
          </span>

          {/* Live Sector Delta Banner */}
          {liveDelta && (
            <div className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold flex items-center gap-1.5 shadow-sm border ${
              liveDelta.isAhead 
                ? 'bg-emerald-500/10 dark:bg-emerald-950/90 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 dark:border-emerald-500/60 shadow-[0_0_12px_rgba(0,208,132,0.3)]' 
                : 'bg-rose-500/10 dark:bg-rose-950/90 text-rose-700 dark:text-rose-300 border-rose-500/40 dark:border-rose-500/60 shadow-[0_0_12px_rgba(244,63,94,0.3)]'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${liveDelta.isAhead ? 'bg-emerald-500 dark:bg-emerald-400 animate-pulse' : 'bg-rose-500 dark:bg-rose-400'}`}></span>
              <span>{liveDelta.isAhead ? 'AHEAD OF GHOST' : 'BEHIND GHOST'}</span>
              <span className="font-black text-gray-900 dark:text-white">{liveDelta.formattedTime}</span>
              <span className="opacity-75">({liveDelta.formattedMeters})</span>
            </div>
          )}
        </div>

        {/* Ghost Selector, Hardware Gate Status & Wind Pill */}
        <div className="flex items-center gap-2 text-[10px] sm:text-xs font-mono flex-wrap">
          {/* Ghost Selector Pill */}
          <div className="flex items-center bg-gray-100 dark:bg-slate-900/90 border border-gray-200 dark:border-slate-800 rounded-xl p-1 gap-1">
            <button
              onClick={() => setGhostMode(prev => prev === 'off' ? 'pr' : prev === 'pr' ? 'session' : prev === 'session' ? 'target' : 'off')}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition flex items-center gap-1.5 ${
                ghostMode !== 'off' 
                  ? `${ghostTheme.bg} ${ghostTheme.color} border ${ghostTheme.border} ${ghostTheme.glow}` 
                  : 'text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white'
              }`}
              title="Click to cycle Ghost Runner: PR, Session Fastest, Target Goal, or Off"
            >
              <span>{ghostTheme.icon}</span>
              <span className="uppercase">{ghostMode === 'off' ? 'Ghost Off' : ghostTheme.short}</span>
            </button>
            
            {/* Tachometer Toggle */}
            <button
              onClick={() => setShowTachometer(!showTachometer)}
              className={`p-1 rounded-lg text-[10px] transition ${
                showTachometer 
                  ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-300' 
                  : 'text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300'
              }`}
              title="Toggle Velocity Tachometer HUD"
            >
              <Gauge size={13} />
            </button>
          </div>

          {/* Gate status indicator */}
          <div className="flex items-center gap-2 bg-gray-100 dark:bg-slate-900/90 border border-gray-200 dark:border-slate-800 rounded-xl px-2.5 py-1">
            <span className="flex items-center gap-1 text-gray-600 dark:text-slate-400">
              <span className={`w-2 h-2 rounded-full ${statusA.beam_broken ? 'bg-rose-500 animate-ping' : statusA.online ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-gray-400 dark:bg-slate-500'}`}></span>
              Node A: <strong className={statusA.beam_broken ? 'text-rose-600 dark:text-rose-400' : 'text-gray-800 dark:text-slate-200'}>{statusA.beam_broken ? 'BROKEN' : statusA.online ? 'READY' : 'OFF'}</strong>
            </span>
            <span className="text-gray-300 dark:text-slate-600">|</span>
            <span className="flex items-center gap-1 text-gray-600 dark:text-slate-400">
              <span className={`w-2 h-2 rounded-full ${statusB.beam_broken ? 'bg-rose-500 animate-ping' : statusB.online ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-gray-400 dark:bg-slate-500'}`}></span>
              Node B: <strong className={statusB.beam_broken ? 'text-rose-600 dark:text-rose-400' : 'text-gray-800 dark:text-slate-200'}>{statusB.beam_broken ? 'BROKEN' : statusB.online ? 'READY' : 'OFF'}</strong>
            </span>
          </div>

          {windSpeed && (
            <span 
              className="hidden sm:flex items-center gap-1 text-gray-700 dark:text-slate-300 font-mono text-[11px] bg-gray-100 dark:bg-slate-900/90 px-2 py-1 rounded-xl border border-gray-200 dark:border-slate-800 shadow-xs"
              title={windMeta?.locationName ? `Location: ${windMeta.locationName} GPS consensus` : 'Wind condition'}
            >
              <Wind size={12} className="text-sky-500 dark:text-sky-400" /> 
              <span className="font-bold">{windSpeed} m/s</span>
              {windMeta?.directionCardinal && (
                <span className="text-sky-600 dark:text-sky-300 text-[9px] font-sans font-bold">
                  ({windMeta.directionCardinal})
                </span>
              )}
            </span>
          )}
        </div>
      </div>

      {/* BROADCAST TELEMETRY SECTOR STATUS STRIP */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 relative z-10">
        {sectorStripData.map(sec => {
          const split = sec.matched;
          const isPurple = split?.tier === 'purple';
          const isGreen = split?.tier === 'green';
          const isAmber = split?.tier === 'amber';

          return (
            <div
              key={sec.sectorNum}
              className={`p-2 rounded-xl border transition-all flex items-center justify-between text-xs font-mono min-w-0 ${
                split
                  ? isPurple
                    ? 'bg-purple-950/80 border-purple-500/80 text-purple-200 shadow-[0_0_12px_rgba(168,85,247,0.35)]'
                    : isGreen
                    ? 'bg-emerald-950/80 border-emerald-500/80 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.35)]'
                    : 'bg-amber-950/80 border-amber-500/80 text-amber-200 shadow-[0_0_10px_rgba(245,158,11,0.25)]'
                  : sec.isInSector
                  ? 'bg-cyan-950/60 border-cyan-400/80 text-cyan-300 animate-pulse shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                  : 'bg-gray-50 dark:bg-slate-950/50 border-gray-200 dark:border-slate-800/80 text-gray-500 dark:text-slate-500'
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className={`w-2 h-2 rounded-full shrink-0 ${
                  isPurple ? 'bg-purple-400' :
                  isGreen ? 'bg-emerald-400' :
                  isAmber ? 'bg-amber-400' :
                  sec.isInSector ? 'bg-cyan-400 animate-ping' : 'bg-gray-300 dark:bg-slate-700'
                }`} />
                <div className="flex flex-col min-w-0">
                  <span className="font-extrabold text-[10px] tracking-wider leading-none truncate">
                    {sec.label}
                  </span>
                  <span className="text-[9px] opacity-70 mt-0.5 leading-none truncate">
                    {sec.range}
                  </span>
                </div>
              </div>

              <div className="text-right">
                {split ? (
                  <div className="flex flex-col items-end">
                    <span className="font-mono font-black text-white text-[11px] leading-none">
                      {split.time.toFixed(2)}s
                    </span>
                    <span className={`mt-0.5 px-1 py-0.2 rounded text-[8px] font-black leading-none ${
                      isPurple ? 'bg-purple-400 text-black' :
                      isGreen ? 'bg-emerald-400 text-black' : 'bg-amber-400 text-black'
                    }`}>
                      {split.delta}
                    </span>
                  </div>
                ) : sec.isInSector ? (
                  <span className="text-[9px] font-bold text-cyan-400 tracking-wider animate-pulse">
                    TRACKING...
                  </span>
                ) : (
                  <span className="text-[9px] opacity-40 font-mono">--.--</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Telemetry Viewport:
          [ LEFT POD: GAUGE / TACHOMETER ] alongside [ RIGHT POD: 2.5D ISOMETRIC PARALLAX TRACK ] */}
      <div className="flex flex-col lg:flex-row gap-4 items-stretch">
        
        {/* LEFT POD: COCKPIT HUD - RADIAL TACHOMETER & 2D G-FORCE ACCELEROMETER */}
        {showTachometer && (
          <div className="w-full lg:w-72 xl:w-80 bg-gray-50 dark:bg-gradient-to-b dark:from-slate-900/95 dark:via-slate-950/95 dark:to-slate-900/95 border border-gray-200 dark:border-cyan-500/30 rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between items-center text-center relative overflow-hidden shadow-sm dark:shadow-2xl flex-shrink-0 transition-all duration-300">
            {/* Ambient radial glow */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-cyan-500/10 via-transparent to-transparent pointer-events-none" />

            {/* Header with Title and Mode Switcher */}
            <div className="w-full flex justify-between items-center text-[10px] font-mono font-bold text-gray-500 dark:text-slate-400 border-b border-gray-200 dark:border-slate-800/80 pb-2 z-10">
              <span className="flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400 uppercase tracking-widest font-black">
                <Gauge size={13} className="text-cyan-600 dark:text-cyan-400" /> COCKPIT HUD
              </span>
              <div className="flex items-center gap-1">
                {/* View Mode Toggle: Combo / Dial / G-Force */}
                <div className="bg-white dark:bg-slate-950/80 p-0.5 rounded-lg border border-gray-200 dark:border-slate-800 flex items-center gap-0.5 shadow-2xs">
                  <button
                    onClick={() => setTachoMode('combo')}
                    className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase transition ${
                      tachoMode === 'combo' ? 'bg-cyan-500/25 text-cyan-700 dark:text-cyan-300 border border-cyan-500/40' : 'text-gray-400 hover:text-gray-700 dark:text-slate-500 dark:hover:text-slate-300'
                    }`}
                    title="Cockpit Combo: Speedometer + G-Force Reticle"
                  >
                    COMBO
                  </button>
                  <button
                    onClick={() => setTachoMode('dial')}
                    className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase transition ${
                      tachoMode === 'dial' ? 'bg-cyan-500/25 text-cyan-700 dark:text-cyan-300 border border-cyan-500/40' : 'text-gray-400 hover:text-gray-700 dark:text-slate-500 dark:hover:text-slate-300'
                    }`}
                    title="Dial Focus: Expanded Analog-Digital Tachometer"
                  >
                    DIAL
                  </button>
                  <button
                    onClick={() => setTachoMode('gforce')}
                    className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase transition ${
                      tachoMode === 'gforce' ? 'bg-cyan-500/25 text-cyan-700 dark:text-cyan-300 border border-cyan-500/40' : 'text-gray-400 hover:text-gray-700 dark:text-slate-500 dark:hover:text-slate-300'
                    }`}
                    title="G-Force Focus: 2D Accelerometer Friction Circle"
                  >
                    G-FORCE
                  </button>
                </div>

                {/* Speed Unit Switcher */}
                <button 
                  onClick={() => setSpeedUnit(prev => prev === 'ms' ? 'kmh' : prev === 'kmh' ? 'mph' : 'ms')}
                  className="bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 px-1.5 py-0.5 rounded-md text-[9px] text-cyan-600 dark:text-cyan-300 border border-gray-200 dark:border-slate-700 font-bold transition uppercase shadow-2xs"
                  title="Toggle Speed Units (m/s, km/h, mph)"
                >
                  {speedUnit === 'ms' ? 'm/s' : speedUnit === 'kmh' ? 'km/h' : 'mph'}
                </button>
              </div>
            </div>

            {/* Kinematic Shift LED Indicator Bar with Dynamic Redline Alert */}
            <div className="w-full my-2 z-10 flex flex-col gap-1">
              <div className="w-full flex justify-center gap-1">
                {[...Array(9)].map((_, i) => {
                  const isActive = i < activeLeds;
                  let ledColor = 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)]';
                  if (i >= 3 && i < 6) ledColor = 'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.9)]';
                  if (i >= 6 && i < 8) ledColor = 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.9)]';
                  if (i === 8) ledColor = 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.95)]';

                  return (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 rounded-xs transition-all duration-75 ${
                        isActive 
                          ? isRedline && i >= 6 ? `${ledColor} animate-pulse` : ledColor 
                          : isDark ? 'bg-slate-800/80 opacity-30' : 'bg-gray-200 opacity-60'
                      }`}
                    />
                  );
                })}
              </div>

              {/* Sprint Gear & Phase Pill */}
              <div className="w-full flex justify-between items-center px-0.5">
                <div className={`px-2 py-0.5 rounded-md border text-[9px] font-mono font-black flex items-center gap-1.5 ${sprintPhase.bg}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
                  <span className="tracking-wider">GEAR {sprintPhase.gear}</span>
                  <span className="text-gray-400 dark:text-slate-500">|</span>
                  <span className="uppercase">{sprintPhase.label}</span>
                </div>

                {isRedline ? (
                  <span className="px-1.5 py-0.5 rounded bg-rose-500/20 border border-rose-500/60 text-rose-600 dark:text-rose-300 text-[8px] font-black font-mono tracking-wider animate-pulse flex items-center gap-1">
                    <Flame size={9} className="text-rose-500 dark:text-rose-400" /> REDLINE
                  </span>
                ) : (
                  <span className="text-[8px] font-mono text-gray-500 dark:text-slate-500">
                    {(timeNum).toFixed(2)}s ELAPSED
                  </span>
                )}
              </div>
            </div>

            {/* VISUALIZATION CORE: SWITCHABLE BETWEEN COMBO / DIAL / G-FORCE */}
            <div className="w-full flex-1 flex flex-col justify-center items-center my-1 z-10 min-h-[170px]">
              
              {/* MODE 1: COMBO (Tachometer Arc + Mini G-Force Friction Circle) */}
              {tachoMode === 'combo' && (
                <div className="w-full flex flex-col items-center gap-1.5">
                  {/* Compact Tachometer Arc */}
                  <div className="relative w-44 sm:w-48 h-28 flex items-center justify-center">
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 160 105">
                      <defs>
                        <linearGradient id="gaugeGradientCombo" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#06b6d4" />
                          <stop offset="50%" stopColor="#10b981" />
                          <stop offset="80%" stopColor="#f59e0b" />
                          <stop offset="100%" stopColor="#ec4899" />
                        </linearGradient>
                        <filter id="needleGlowCombo" x="-50%" y="-50%" width="200%" height="200%">
                          <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                          <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                      </defs>

                      {/* Gauge Background Track Arc */}
                      <path
                        d="M 35 101 A 52 52 0 1 1 125 101"
                        fill="none"
                        stroke={isDark ? "#1e293b" : "#e2e8f0"}
                        strokeWidth="9"
                        strokeLinecap="round"
                      />

                      {/* Redline sector highlight arc (10 to 12 m/s) */}
                      <path
                        d="M 131.2 66 A 52 52 0 0 1 125 101"
                        fill="none"
                        stroke="#f43f5e"
                        strokeWidth="9"
                        strokeLinecap="round"
                        opacity={isRedline ? "0.9" : isDark ? "0.35" : "0.45"}
                        filter={isRedline ? "url(#needleGlowCombo)" : undefined}
                      />

                      {/* Active Colored Arc */}
                      <path
                        d="M 35 101 A 52 52 0 1 1 125 101"
                        fill="none"
                        stroke="url(#gaugeGradientCombo)"
                        strokeWidth="9"
                        strokeLinecap="round"
                        strokeDasharray={totalArcLength}
                        strokeDashoffset={activeArcOffset}
                        className="transition-all duration-100 ease-out"
                      />

                      {/* Dial tick marks */}
                      {dialTicks.map(t => (
                        <g key={t.speed} transform={`rotate(${t.deg} 80 75)`}>
                          <line
                            x1="80"
                            y1="23"
                            x2="80"
                            y2={t.isMajor ? "29" : "26"}
                            stroke={t.isRedlineTick ? "#f43f5e" : isDark ? "#475569" : "#cbd5e1"}
                            strokeWidth={t.isMajor ? "1.8" : "1.0"}
                          />
                        </g>
                      ))}

                      {/* Peak Velocity Needle Hold */}
                      {peakVelocity > 0 && (
                        <g transform={`rotate(${peakNeedleDeg} 80 75)`}>
                          <line x1="80" y1="75" x2="80" y2="24" stroke="#f59e0b" strokeWidth="2.2" strokeDasharray="3 3" opacity="0.9" />
                          <circle cx="80" cy="23" r="3.2" fill="#f59e0b" filter="url(#needleGlowCombo)" />
                          <polygon points="77,20 83,20 80,15" fill="#f59e0b" />
                        </g>
                      )}

                      {/* Ghost Target Needle (if ghost mode active) */}
                      {ghostNeedleDeg !== null && (
                        <g transform={`rotate(${ghostNeedleDeg} 80 75)`}>
                          <line x1="80" y1="75" x2="80" y2="26" stroke="#c084fc" strokeWidth="1.8" strokeDasharray="2 2" opacity="0.85" />
                          <circle cx="80" cy="25" r="2.8" fill="#a855f7" />
                        </g>
                      )}

                      {/* Active Speed Needle rotating around center (80, 75) */}
                      <g transform={`rotate(${needleDeg} 80 75)`} className="transition-transform duration-75 ease-out" filter="url(#needleGlowCombo)">
                        <line x1="80" y1="75" x2="80" y2="26" stroke={isDark ? "#ffffff" : "#0f172a"} strokeWidth="3" strokeLinecap="round" />
                        <circle cx="80" cy="75" r="6" fill="#0284c7" />
                        <circle cx="80" cy="75" r="2.5" fill="#ffffff" />
                      </g>

                      {/* Perimeter Dial Labels */}
                      <text x="32" y="104" fill={isDark ? "#64748b" : "#94a3b8"} fontSize="8" fontWeight="bold" textAnchor="middle">0</text>
                      <text x="44" y="52" fill={isDark ? "#64748b" : "#94a3b8"} fontSize="8" fontWeight="bold" textAnchor="middle">4</text>
                      <text x="80" y="20" fill={isDark ? "#64748b" : "#94a3b8"} fontSize="8" fontWeight="bold" textAnchor="middle">6</text>
                      <text x="116" y="52" fill={isDark ? "#64748b" : "#94a3b8"} fontSize="8" fontWeight="bold" textAnchor="middle">10</text>
                      <text x="128" y="104" fill="#f43f5e" fontSize="8" fontWeight="bold" textAnchor="middle">12</text>
                    </svg>

                    {/* Center Speed Value Overlay */}
                    <div className="absolute bottom-0 flex flex-col items-center pointer-events-none">
                      <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-gray-900 dark:text-white leading-none drop-shadow-xs dark:drop-shadow-[0_0_12px_rgba(255,255,255,0.4)]">
                        {speedUnit === 'kmh' ? currentKmH.toFixed(1) : 
                         speedUnit === 'mph' ? currentMph.toFixed(1) : 
                         currentVelocity.toFixed(2)}
                      </span>
                      <span className="text-[10px] font-mono font-extrabold text-cyan-600 dark:text-cyan-400 uppercase mt-0.5 tracking-wider">
                        {speedUnit === 'kmh' ? 'km/h' : speedUnit === 'mph' ? 'mph' : 'm/s'}
                      </span>
                    </div>
                  </div>

                  {/* Integrated Mini G-Force Reticle Bar */}
                  <div className="w-full bg-white dark:bg-slate-950/70 border border-gray-200 dark:border-slate-800/80 rounded-xl p-2 flex items-center justify-between gap-2 shadow-2xs">
                    {/* Mini Reticle Circle */}
                    <div className="relative w-16 h-16 flex-shrink-0 flex items-center justify-center">
                      <svg className="w-full h-full overflow-visible" viewBox="0 0 140 140">
                        {/* Concentric rings */}
                        <circle cx="70" cy="70" r="54" fill="none" stroke={isDark ? "#1e293b" : "#e2e8f0"} strokeWidth="1.5" />
                        <circle cx="70" cy="70" r="36" fill="none" stroke={isDark ? "#334155" : "#cbd5e1"} strokeWidth="1" strokeDasharray="3 3" />
                        <circle cx="70" cy="70" r="18" fill="none" stroke={isDark ? "#1e293b" : "#e2e8f0"} strokeWidth="1" />
                        
                        {/* Crosshairs */}
                        <line x1="16" y1="70" x2="124" y2="70" stroke={isDark ? "#334155" : "#cbd5e1"} strokeWidth="1" strokeDasharray="2 2" />
                        <line x1="70" y1="16" x2="70" y2="124" stroke={isDark ? "#334155" : "#cbd5e1"} strokeWidth="1" strokeDasharray="2 2" />
                        
                        {/* Peak G circle */}
                        {peakGForce > 0.1 && (
                          <circle cx="70" cy="70" r={peakGRadius} fill="none" stroke="#f59e0b" strokeWidth="1.2" strokeDasharray="2 2" opacity="0.8" />
                        )}

                        {/* Force vector ray from center to current point */}
                        <line x1="70" y1="70" x2={gForcePoint.x} y2={gForcePoint.y} stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" opacity="0.85" />

                        {/* Current G dot */}
                        <circle cx={gForcePoint.x} cy={gForcePoint.y} r="4.5" fill="#06b6d4" filter="url(#needleGlowCombo)" />
                        <circle cx={gForcePoint.x} cy={gForcePoint.y} r="2" fill="#ffffff" />
                      </svg>
                    </div>

                    {/* Mini G-Force Readouts */}
                    <div className="flex-1 flex flex-col justify-center text-left text-[9px] font-mono leading-tight">
                      <div className="flex justify-between items-center text-cyan-600 dark:text-cyan-400 font-bold">
                        <span className="flex items-center gap-1">
                          <Crosshair size={9} /> G-TOTAL:
                        </span>
                        <span className="text-gray-900 dark:text-white font-extrabold">{liveGTotal.toFixed(2)}G</span>
                      </div>
                      <div className="flex justify-between items-center text-gray-500 dark:text-slate-400 mt-1">
                        <span>LONG DRIVE:</span>
                        <span className={liveGLong >= 0 ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-rose-600 dark:text-rose-400 font-semibold'}>
                          {liveGLong >= 0 ? `+${liveGLong.toFixed(2)}` : liveGLong.toFixed(2)}G
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-gray-500 dark:text-slate-400 mt-0.5">
                        <span>LAT SWAY:</span>
                        <span className="text-sky-600 dark:text-sky-300 font-semibold">
                          {liveGLat >= 0 ? `+${liveGLat.toFixed(2)}` : liveGLat.toFixed(2)}G
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* MODE 2: DIAL FOCUS (Expanded Speedometer with Full Perimeter Markings) */}
              {tachoMode === 'dial' && (
                <div className="w-full flex flex-col items-center">
                  <div className="relative w-52 sm:w-56 h-36 flex items-center justify-center">
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 160 120">
                      <defs>
                        <linearGradient id="gaugeGradientDial" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#06b6d4" />
                          <stop offset="45%" stopColor="#10b981" />
                          <stop offset="75%" stopColor="#f59e0b" />
                          <stop offset="100%" stopColor="#ef4444" />
                        </linearGradient>
                        <filter id="dialGlow" x="-50%" y="-50%" width="200%" height="200%">
                          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                          <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                      </defs>

                      {/* Background Dial Track */}
                      <path
                        d="M 35 101 A 52 52 0 1 1 125 101"
                        fill="none"
                        stroke={isDark ? "#1e293b" : "#e2e8f0"}
                        strokeWidth="11"
                        strokeLinecap="round"
                      />

                      {/* Redline zone highlight (10 to 12 m/s) */}
                      <path
                        d="M 131.2 66 A 52 52 0 0 1 125 101"
                        fill="none"
                        stroke="#f43f5e"
                        strokeWidth="11"
                        strokeLinecap="round"
                        opacity={isRedline ? "0.9" : isDark ? "0.35" : "0.45"}
                        filter={isRedline ? "url(#dialGlow)" : undefined}
                      />

                      {/* Colored Active Arc */}
                      <path
                        d="M 35 101 A 52 52 0 1 1 125 101"
                        fill="none"
                        stroke="url(#gaugeGradientDial)"
                        strokeWidth="11"
                        strokeLinecap="round"
                        strokeDasharray={totalArcLength}
                        strokeDashoffset={activeArcOffset}
                        className="transition-all duration-100 ease-out"
                      />

                      {/* Calibrated Ticks */}
                      {dialTicks.map(t => (
                        <g key={t.speed} transform={`rotate(${t.deg} 80 75)`}>
                          <line
                            x1="80"
                            y1="21"
                            x2="80"
                            y2={t.isMajor ? "28" : "25"}
                            stroke={t.isRedlineTick ? "#f43f5e" : isDark ? "#64748b" : "#cbd5e1"}
                            strokeWidth={t.isMajor ? "2.2" : "1.2"}
                          />
                        </g>
                      ))}

                      {/* Peak Velocity Marker */}
                      {peakVelocity > 0 && (
                        <g transform={`rotate(${peakNeedleDeg} 80 75)`}>
                          <line x1="80" y1="75" x2="80" y2="23" stroke="#f59e0b" strokeWidth="2.5" strokeDasharray="3 3" opacity="0.9" />
                          <circle cx="80" cy="22" r="3.5" fill="#f59e0b" filter="url(#dialGlow)" />
                          <polygon points="76,19 84,19 80,14" fill="#f59e0b" />
                        </g>
                      )}

                      {/* Ghost Target Marker */}
                      {ghostNeedleDeg !== null && (
                        <g transform={`rotate(${ghostNeedleDeg} 80 75)`}>
                          <line x1="80" y1="75" x2="80" y2="25" stroke="#c084fc" strokeWidth="2" strokeDasharray="2 2" opacity="0.85" />
                          <circle cx="80" cy="23" r="3" fill="#a855f7" />
                        </g>
                      )}

                      {/* Active Speed Needle */}
                      <g transform={`rotate(${needleDeg} 80 75)`} className="transition-transform duration-75 ease-out" filter="url(#dialGlow)">
                        <line x1="80" y1="75" x2="80" y2="25" stroke={isDark ? "#ffffff" : "#0f172a"} strokeWidth="3.4" strokeLinecap="round" />
                        <circle cx="80" cy="75" r="7" fill="#0284c7" />
                        <circle cx="80" cy="75" r="3" fill="#ffffff" />
                      </g>

                      {/* Numbers around perimeter */}
                      <text x="28" y="108" fill={isDark ? "#64748b" : "#64748b"} fontSize="8.5" fontWeight="bold" textAnchor="middle">0</text>
                      <text x="32" y="78" fill={isDark ? "#64748b" : "#64748b"} fontSize="8.5" fontWeight="bold" textAnchor="middle">2</text>
                      <text x="45" y="48" fill={isDark ? "#64748b" : "#64748b"} fontSize="8.5" fontWeight="bold" textAnchor="middle">4</text>
                      <text x="62" y="27" fill={isDark ? "#64748b" : "#64748b"} fontSize="8.5" fontWeight="bold" textAnchor="middle">6</text>
                      <text x="98" y="27" fill={isDark ? "#64748b" : "#64748b"} fontSize="8.5" fontWeight="bold" textAnchor="middle">8</text>
                      <text x="116" y="48" fill={isDark ? "#64748b" : "#64748b"} fontSize="8.5" fontWeight="bold" textAnchor="middle">10</text>
                      <text x="132" y="108" fill="#f43f5e" fontSize="8.5" fontWeight="bold" textAnchor="middle">12+</text>
                    </svg>

                    {/* Center Speed Value Overlay */}
                    <div className="absolute bottom-1 flex flex-col items-center pointer-events-none">
                      <span className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-gray-900 dark:text-white leading-none drop-shadow-xs dark:drop-shadow-[0_0_15px_rgba(255,255,255,0.45)]">
                        {speedUnit === 'kmh' ? currentKmH.toFixed(1) : 
                         speedUnit === 'mph' ? currentMph.toFixed(1) : 
                         currentVelocity.toFixed(2)}
                      </span>
                      <span className="text-[11px] font-mono font-extrabold text-cyan-600 dark:text-cyan-400 uppercase mt-0.5 tracking-wider">
                        {speedUnit === 'kmh' ? 'km/h' : speedUnit === 'mph' ? 'mph' : 'm/s'}
                      </span>
                    </div>
                  </div>

                  {/* Sub-telemetry readout chip */}
                  <div className="w-full flex justify-between items-center bg-white dark:bg-slate-950/60 border border-gray-200 dark:border-slate-800/80 px-2.5 py-1 rounded-xl text-[9px] font-mono mt-1 shadow-2xs">
                    <span className="text-gray-500 dark:text-slate-400">PROPULSION RATE:</span>
                    <span className="text-cyan-600 dark:text-cyan-300 font-bold">
                      {liveAcceleration > 0.2 ? `+${(liveAcceleration).toFixed(1)} m/s² Drive` : 'Steady Velocity'}
                    </span>
                  </div>
                </div>
              )}

              {/* MODE 3: G-FORCE FOCUS (Expanded 2D Accelerometer Friction Circle Display) */}
              {tachoMode === 'gforce' && (
                <div className="w-full flex flex-col items-center">
                  <div className="relative w-44 sm:w-48 h-44 sm:h-48 flex items-center justify-center">
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 160 160">
                      <defs>
                        <radialGradient id="gRadarBg" cx="50%" cy="50%" r="50%">
                          <stop offset="0%" stopColor={isDark ? "#082f49" : "#e0f2fe"} stopOpacity={isDark ? 0.4 : 0.7} />
                          <stop offset="70%" stopColor={isDark ? "#020617" : "#f0f9ff"} stopOpacity={isDark ? 0.8 : 0.85} />
                          <stop offset="100%" stopColor={isDark ? "#020617" : "#e2e8f0"} stopOpacity={isDark ? 0.95 : 0.95} />
                        </radialGradient>
                        <filter id="gforceGlow" x="-50%" y="-50%" width="200%" height="200%">
                          <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
                          <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                      </defs>

                      {/* Concentric Friction Radar Circles */}
                      <circle cx="80" cy="80" r="68" fill="url(#gRadarBg)" stroke={isDark ? "#1e293b" : "#cbd5e1"} strokeWidth="2" />
                      <circle cx="80" cy="80" r="54" fill="none" stroke={isDark ? "#334155" : "#94a3b8"} strokeWidth="1.2" strokeDasharray="3 3" />
                      <circle cx="80" cy="80" r="36" fill="none" stroke={isDark ? "#334155" : "#94a3b8"} strokeWidth="1" />
                      <circle cx="80" cy="80" r="18" fill="none" stroke={isDark ? "#1e293b" : "#cbd5e1"} strokeWidth="1" />

                      {/* Crosshairs */}
                      <line x1="12" y1="80" x2="148" y2="80" stroke={isDark ? "#475569" : "#94a3b8"} strokeWidth="1" strokeDasharray="2 2" />
                      <line x1="80" y1="12" x2="80" y2="148" stroke={isDark ? "#475569" : "#94a3b8"} strokeWidth="1" strokeDasharray="2 2" />

                      {/* Radial Ring Labels */}
                      <text x="80" y="24" fill={isDark ? "#64748b" : "#64748b"} fontSize="7.5" fontWeight="bold" textAnchor="middle">+1.2G</text>
                      <text x="80" y="42" fill={isDark ? "#64748b" : "#64748b"} fontSize="7.5" fontWeight="bold" textAnchor="middle">+0.8G</text>
                      <text x="80" y="60" fill={isDark ? "#64748b" : "#64748b"} fontSize="7.5" fontWeight="bold" textAnchor="middle">+0.4G</text>
                      <text x="14" y="83" fill={isDark ? "#64748b" : "#64748b"} fontSize="7.5" fontWeight="bold">L</text>
                      <text x="146" y="83" fill={isDark ? "#64748b" : "#64748b"} fontSize="7.5" fontWeight="bold">R</text>

                      {/* Peak G Retention Circle */}
                      {peakGForce > 0.1 && (
                        <circle cx="80" cy="80" r={peakGRadius} fill="none" stroke="#f59e0b" strokeWidth="1.6" strokeDasharray="3 3" opacity="0.85" />
                      )}

                      {/* Force vector ray from center to current point */}
                      <line 
                        x1="80" 
                        y1="80" 
                        x2={80 + (liveGLat * 45)} 
                        y2={80 - (liveGLong * 45)} 
                        stroke="#06b6d4" 
                        strokeWidth="2.5" 
                        strokeLinecap="round" 
                        opacity="0.9" 
                      />

                      {/* Current G Indicator Dot */}
                      <circle 
                        cx={80 + (liveGLat * 45)} 
                        cy={80 - (liveGLong * 45)} 
                        r="6" 
                        fill="#06b6d4" 
                        filter="url(#gforceGlow)" 
                      />
                      <circle 
                        cx={80 + (liveGLat * 45)} 
                        cy={80 - (liveGLong * 45)} 
                        r="2.5" 
                        fill="#ffffff" 
                      />
                      <circle 
                        cx={80 + (liveGLat * 45)} 
                        cy={80 - (liveGLong * 45)} 
                        r="11" 
                        fill="none" 
                        stroke="#22d3ee" 
                        strokeWidth="1.2" 
                        className="animate-ping opacity-60" 
                      />
                    </svg>
                  </div>

                  {/* Dual Biomechanics Force Progress Bars */}
                  <div className="w-full grid grid-cols-2 gap-2 mt-1">
                    {/* Longitudinal Acceleration Bar */}
                    <div className="bg-white dark:bg-slate-950/80 border border-gray-200 dark:border-slate-800 p-1.5 rounded-xl flex flex-col text-left text-[9px] font-mono shadow-2xs">
                      <div className="flex justify-between items-center text-gray-500 dark:text-slate-400">
                        <span>LONG DRIVE:</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">+{liveGLong.toFixed(2)}G</span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-slate-900 rounded-full h-1.5 mt-1 overflow-hidden">
                        <div 
                          className="bg-emerald-500 dark:bg-emerald-400 h-full rounded-full transition-all duration-75"
                          style={{ width: `${Math.min(100, (liveGLong / 1.2) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Lateral Stride Sway Bar */}
                    <div className="bg-white dark:bg-slate-950/80 border border-gray-200 dark:border-slate-800 p-1.5 rounded-xl flex flex-col text-left text-[9px] font-mono shadow-2xs">
                      <div className="flex justify-between items-center text-gray-500 dark:text-slate-400">
                        <span>LAT BALANCE:</span>
                        <span className="text-sky-600 dark:text-sky-300 font-bold">{liveGLat.toFixed(2)}G</span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-slate-900 rounded-full h-1.5 mt-1 overflow-hidden relative">
                        {/* Centered zero indicator with left/right bar */}
                        <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-gray-400 dark:bg-slate-600 -translate-x-1/2 z-10" />
                        <div 
                          className="bg-sky-500 dark:bg-sky-400 h-full transition-all duration-75"
                          style={{ 
                            marginLeft: liveGLat < 0 ? `${50 + (liveGLat / 0.5) * 50}%` : '50%',
                            width: `${(Math.abs(liveGLat) / 0.5) * 50}%` 
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* 4-BOX TELEMETRY MATRIX (ALWAYS VISIBLE ACROSS ALL MODES) */}
            <div className="w-full grid grid-cols-2 gap-1.5 pt-2 border-t border-gray-200 dark:border-slate-800/80 text-[10px] font-mono z-10">
              {/* Box 1: Top Speed */}
              <div className="bg-white dark:bg-slate-950/85 border border-gray-200 dark:border-slate-800/80 p-1.5 rounded-xl flex flex-col items-center justify-center text-center shadow-2xs">
                <span className="text-gray-500 dark:text-slate-400 block text-[8px] uppercase font-extrabold flex items-center gap-1">
                  <Flame size={10} className="text-amber-500 dark:text-amber-400" /> TOP SPEED
                </span>
                <span className="font-extrabold text-amber-600 dark:text-amber-400 text-xs sm:text-sm mt-0.5 tabular-nums">
                  {speedUnit === 'kmh' ? (peakVelocity * 3.6).toFixed(1) : 
                   speedUnit === 'mph' ? (peakVelocity * 2.23694).toFixed(1) : 
                   peakVelocity.toFixed(2)} <span className="text-[8px] text-gray-400 dark:text-slate-400 font-sans">{speedUnit === 'kmh' ? 'km/h' : speedUnit === 'mph' ? 'mph' : 'm/s'}</span>
                </span>
              </div>

              {/* Box 2: Acceleration */}
              <div className="bg-white dark:bg-slate-950/85 border border-gray-200 dark:border-slate-800/80 p-1.5 rounded-xl flex flex-col items-center justify-center text-center shadow-2xs">
                <span className="text-gray-500 dark:text-slate-400 block text-[8px] uppercase font-extrabold flex items-center gap-1">
                  <ArrowUpRight size={10} className="text-emerald-500 dark:text-emerald-400" /> ACCELERATION
                </span>
                <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm mt-0.5 tabular-nums">
                  +{liveAcceleration.toFixed(1)} <span className="text-[8px] text-gray-400 dark:text-slate-400 font-sans">m/s²</span>
                </span>
              </div>

              {/* Box 3: G-Force */}
              <div className="bg-white dark:bg-slate-950/85 border border-gray-200 dark:border-slate-800/80 p-1.5 rounded-xl flex flex-col items-center justify-center text-center shadow-2xs">
                <span className="text-gray-500 dark:text-slate-400 block text-[8px] uppercase font-extrabold flex items-center gap-1">
                  <Crosshair size={10} className="text-cyan-600 dark:text-cyan-400" /> G-FORCE
                </span>
                <span className="font-extrabold text-cyan-600 dark:text-cyan-300 text-xs sm:text-sm mt-0.5 tabular-nums">
                  {liveGTotal.toFixed(2)}G <span className="text-[8px] text-gray-400 dark:text-slate-500 font-sans">({peakGForce.toFixed(2)}G pk)</span>
                </span>
              </div>

              {/* Box 4: Horizontal Mechanical Power */}
              <div className="bg-white dark:bg-slate-950/85 border border-gray-200 dark:border-slate-800/80 p-1.5 rounded-xl flex flex-col items-center justify-center text-center shadow-2xs">
                <span className="text-gray-500 dark:text-slate-400 block text-[8px] uppercase font-extrabold flex items-center gap-1">
                  <Zap size={10} className="text-purple-500 dark:text-purple-400" /> HORIZ POWER
                </span>
                <span className="font-extrabold text-purple-600 dark:text-purple-300 text-xs sm:text-sm mt-0.5 tabular-nums">
                  {livePowerWkg.toFixed(1)} <span className="text-[8px] text-gray-400 dark:text-slate-400 font-sans">W/kg</span>
                </span>
              </div>
            </div>

          </div>
        )}

        {/* RIGHT POD: 2.5D ISOMETRIC PARALLAX TRACK ARENA */}
        <div className="flex-1 min-w-0 relative flex flex-col justify-between">
          
          {/* 2.5D Isometric 3D Stage Wrapper */}
          <div 
            className="w-full relative rounded-2xl overflow-hidden shadow-2xl transition-all duration-300"
            style={{ perspective: '1200px' }}
          >
            {/* 3D Inclined Track Bed Container */}
            <div 
              className={`relative h-56 sm:h-64 ${activeSurface.bg} border-2 rounded-2xl overflow-hidden p-3 flex flex-col justify-between shadow-2xl transition-transform duration-500`}
              style={{
                transform: 'rotateX(14deg) translateZ(0)',
                transformOrigin: 'bottom center',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), inset 0 2px 4px rgba(255, 255, 255, 0.1)'
              }}
            >
              {/* Surface texture & grain overlay */}
              <div className={`absolute inset-0 ${activeSurface.grain} pointer-events-none`}></div>

              {/* Parallax Ground Grid Lines */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_100%] pointer-events-none"></div>

              {/* 3D Depth Curb along the bottom */}
              <div className={`absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t ${activeSurface.curb} border-t border-black/40 pointer-events-none shadow-lg`}></div>

              {/* Lane Markings (White Boundary Lines with 3D Curb Highlights) */}
              <div className={`absolute inset-x-0 top-3 border-t-2 ${activeSurface.lines} pointer-events-none shadow-xs`}></div>
              {ghostProgress && (
                <div className="absolute inset-x-0 top-[49%] -translate-y-1/2 border-b-2 border-dashed border-white/20 pointer-events-none"></div>
              )}
              <div className={`absolute inset-x-0 bottom-8 border-b-2 ${activeSurface.lines} pointer-events-none shadow-xs`}></div>

              {/* Lane Labels */}
              <div className="absolute left-2.5 top-5 text-[9px] font-black font-mono text-white/50 uppercase select-none pointer-events-none tracking-widest">
                {ghostProgress ? 'LANE 1 • LIVE RUNNER' : 'CHAMPIONSHIP SPRINT TRACK • LIVE ATHLETE'}
              </div>
              {ghostProgress && (
                <div className="absolute left-2.5 bottom-10 text-[9px] font-black font-mono text-indigo-300/60 uppercase select-none pointer-events-none tracking-widest">
                  LANE 2 • {ghostTheme.label}
                </div>
              )}

              {/* 3D STARTING BLOCKS (0m) & Node A Laser Emitter Tower */}
              <div 
                className="absolute top-0 bottom-8 -translate-x-1/2 flex flex-col items-center justify-between z-20 pointer-events-none"
                style={{ left: '4%' }}
              >
                {/* Gate 0m Top Badge */}
                <div className="absolute -top-1 px-1.5 py-0.5 rounded-md bg-cyan-950/95 border border-cyan-500/70 text-[8px] font-mono font-black text-cyan-300 shadow-lg whitespace-nowrap">
                  [Gate 0m]
                </div>

                {/* Start Laser Pylon Tower */}
                <div className={`w-3 flex-1 my-3 bg-gradient-to-b from-cyan-400 via-emerald-400 to-cyan-400 rounded-sm shadow-[0_0_16px_rgba(6,182,212,0.9)] flex flex-col justify-between items-center py-1 ${statusA.beam_broken ? 'animate-pulse ring-4 ring-rose-500' : ''}`}>
                  <span className="text-[7px] font-black uppercase text-cyan-950 rotate-90 origin-center tracking-wider select-none font-mono">
                    START
                  </span>
                </div>

                {/* 3D Starting Block Pedals */}
                <div className="w-5 h-3 bg-gradient-to-tr from-slate-800 to-slate-600 rounded-xs border border-cyan-400/50 shadow-md transform -skew-x-12"></div>
              </div>

              {/* INTERMEDIATE SPLIT GATES & TIMING CHIPS */}
              {trackStations.slice(1, -1).map((stn) => {
                const recordedSplit = splitDeltas.find(s => Math.abs(s.fraction - stn.fraction) < 0.15);

                return (
                  <div
                    key={stn.id}
                    className="absolute top-0 bottom-8 -translate-x-1/2 flex flex-col items-center justify-between z-15 pointer-events-none"
                    style={{ left: `${stn.pct}%` }}
                  >
                    {/* Colored Timing Chip (Directly above the gate) */}
                    {recordedSplit ? (
                      <div className={`absolute -top-1 px-2 py-0.5 rounded-lg text-[9px] font-mono font-extrabold whitespace-nowrap border flex items-center gap-1.5 shadow-xl transition-all duration-300 z-30 animate-in fade-in zoom-in-95 ${
                        recordedSplit.tier === 'purple'
                          ? 'bg-purple-950/95 text-purple-200 border-purple-500 shadow-[0_0_16px_rgba(168,85,247,0.85)] scale-105'
                          : recordedSplit.tier === 'green'
                          ? 'bg-emerald-950/95 text-emerald-200 border-emerald-500 shadow-[0_0_14px_rgba(16,185,129,0.75)]'
                          : 'bg-amber-950/95 text-amber-200 border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.65)]'
                      }`}>
                        <span className="opacity-90">{stn.meters}m:</span>
                        <span className="font-mono">{recordedSplit.time.toFixed(2)}s</span>
                        <span className={`px-1 py-0.2 rounded text-[8px] font-black text-black ${
                          recordedSplit.tier === 'purple' ? 'bg-purple-300' : 
                          recordedSplit.tier === 'green' ? 'bg-emerald-300' : 'bg-amber-300'
                        }`}>
                          {recordedSplit.delta}
                        </span>
                      </div>
                    ) : (
                      <div className="absolute -top-1 px-1.5 py-0.5 rounded bg-slate-900/80 border border-slate-700 text-[8px] font-mono font-bold text-slate-400 whitespace-nowrap">
                        [{stn.meters}m Gate]
                      </div>
                    )}

                    {/* Laser Gate Emitter Beacon & Slicing Beam */}
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.9)] mt-4"></div>
                    <div className={`w-0.5 flex-1 my-0.5 border-l border-dashed transition-all ${
                      recordedSplit ? 'border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'border-cyan-400/40'
                    }`}></div>
                    <div className="w-2 h-2 rounded-xs bg-slate-800 border border-slate-600 mb-0.5"></div>
                  </div>
                );
              })}

              {/* 3D FINISH LINE (40m) & Checkered Ribbon Tower */}
              <div 
                className="absolute top-0 bottom-8 -translate-x-1/2 flex flex-col items-center justify-between z-20 pointer-events-none"
                style={{ left: '95%' }}
              >
                {/* Gate Finish Top Badge */}
                <div className="absolute -top-1 px-1.5 py-0.5 rounded-md bg-amber-950/95 border border-amber-500/70 text-[8px] font-mono font-black text-amber-300 shadow-lg whitespace-nowrap">
                  [{distNum}m Finish]
                </div>

                {/* Finish Laser & Checkered Pylon Tower */}
                <div className={`w-3 flex-1 my-3 bg-gradient-to-b from-amber-300 via-white to-amber-300 rounded-sm shadow-[0_0_20px_rgba(251,191,36,0.9)] flex flex-col justify-between items-center py-1 ${statusB.beam_broken ? 'animate-pulse ring-4 ring-rose-500' : ''}`}>
                  <span className="text-[7px] font-black uppercase text-amber-950 -rotate-90 origin-center tracking-wider select-none font-mono">
                    FINISH
                  </span>
                </div>

                {/* 3D Checkered Pylon Base */}
                <div className="w-5 h-3 bg-gradient-to-tr from-amber-600 to-amber-300 rounded-xs border border-white shadow-md transform skew-x-12"></div>
              </div>

              {/* CHECKERED FINISH LINE TAPE / RIBBON ACROSS TRACK */}
              <div 
                className={`absolute top-3 bottom-8 w-2 pointer-events-none z-18 transition-all duration-300 ${
                  sequenceState === 'finished' ? 'opacity-30 blur-[1px]' : 'opacity-90'
                }`}
                style={{
                  left: '95%',
                  backgroundImage: 'repeating-linear-gradient(45deg, #000 0, #000 4px, #fff 4px, #fff 8px)',
                  boxShadow: '0 0 10px rgba(255,255,255,0.6)'
                }}
              />

              {/* DYNAMIC LASER CONNECTOR RIBBON BETWEEN LIVE RUNNER AND GHOST RUNNER */}
              {ghostProgress && liveDelta && (isRunning || sequenceState === 'running' || sequenceState === 'finished') && (
                <div
                  className="absolute pointer-events-none z-20 transition-all duration-75 flex items-center justify-center"
                  style={{
                    left: `${Math.min(progressPct, ghostProgress.pct)}%`,
                    width: `${Math.max(1.5, Math.abs(progressPct - ghostProgress.pct))}%`,
                    top: '46%',
                    height: '2px'
                  }}
                >
                  {/* Glowing Laser Span Line */}
                  <div className={`w-full h-0.5 border-t border-dashed ${liveDelta.isAhead ? 'border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'border-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.8)]'}`} />
                  
                  {/* Floating In-Between Realtime Gap Delta Pill */}
                  <div className={`absolute -top-3 px-1.5 py-0.5 rounded-full text-[8px] font-mono font-black whitespace-nowrap shadow-md border ${
                    liveDelta.isAhead 
                      ? 'bg-emerald-950/95 text-emerald-300 border-emerald-500/70 shadow-[0_0_10px_rgba(0,208,132,0.5)]' 
                      : 'bg-rose-950/95 text-rose-300 border-rose-500/70 shadow-[0_0_10px_rgba(244,63,94,0.5)]'
                  }`}>
                    {liveDelta.isAhead ? `▲ ${liveDelta.formattedTime}` : `▼ ${liveDelta.formattedTime}`}
                  </div>
                </div>
              )}

              {/* LANE 2: TRANSLUCENT HOLOGRAPHIC GHOST RUNNER AVATAR (ACTIVE ONLY WHEN GHOST MODE IS ON) */}
              {ghostProgress && (
                <VirtualSprinter
                  telemetry={benchmarkRunnerTelemetry}
                  variant="benchmark"
                  topOffsetPercent={68}
                  minTrackPercent={6}
                  maxTrackPercent={94}
                  label={`${ghostTheme.icon} ${ghostTheme.short} • ${benchmarkRunnerTelemetry.estimatedDistanceM.toFixed(1)}m`}
                />
              )}

              {/* LANE 1: LIVE VIRTUAL SPRINTER WITH ARTICULATED BIOMECHANICS & SPEED WAKE */}
              <VirtualSprinter
                telemetry={liveRunnerTelemetry}
                variant="live"
                topOffsetPercent={ghostProgress ? 28 : 48}
                minTrackPercent={6}
                maxTrackPercent={94}
                label={
                  sequenceState === 'finished'
                    ? `🏁 ${runnerName.split(' ')[0]} • FINISHED • ${timeNum.toFixed(2)}s`
                    : sequenceState === 'false_start'
                    ? '⚠️ FAULT • FALSE START'
                    : isSessionRunning
                    ? `${runnerName.split(' ')[0]} • ${estimatedMeters.toFixed(1)}m • ${(speedUnit === 'kmh' ? currentKmH : speedUnit === 'mph' ? currentMph : currentVelocity).toFixed(1)} ${speedUnit === 'ms' ? 'm/s' : speedUnit}`
                    : `${runnerName.split(' ')[0]} • READY`
                }
              />

              {/* Distance Tick Marks along bottom */}
              <div className="absolute inset-x-0 bottom-1 px-4 sm:px-6 flex justify-between text-[9px] sm:text-[10px] font-mono font-bold text-white/50 pointer-events-none select-none z-10">
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-cyan-400 rounded-full inline-block"></span> 0m</span>
                <span>{(distNum * 0.25).toFixed(0)}m</span>
                <span>{(distNum * 0.50).toFixed(0)}m</span>
                <span>{(distNum * 0.75).toFixed(0)}m</span>
                <span className="flex items-center gap-1">{(distNum).toFixed(0)}m <span className="w-1.5 h-1.5 bg-amber-400 rounded-full inline-block"></span></span>
              </div>

            </div>
          </div>

          {/* Surface Texture Switcher & Live Metrics Cockpit Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 relative z-10 pt-2.5">
            <div className="bg-gray-50 dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 rounded-xl p-2 flex flex-col items-center justify-center text-center min-w-0 shadow-2xs">
              <span className="text-[9px] text-gray-500 dark:text-slate-400 font-bold uppercase tracking-wider truncate w-full">LIVE VELOCITY</span>
              <span className="text-sm sm:text-base font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 truncate w-full">
                {currentVelocity.toFixed(2)} <span className="text-[10px] text-gray-400 dark:text-slate-400 font-sans">m/s</span>
              </span>
            </div>

            <div className="bg-gray-50 dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 rounded-xl p-2 flex flex-col items-center justify-center text-center min-w-0 shadow-2xs">
              <span className="text-[9px] text-gray-500 dark:text-slate-400 font-bold uppercase tracking-wider truncate w-full">SPEED (KM/H • MPH)</span>
              <span className="text-xs sm:text-sm font-mono font-bold text-cyan-600 dark:text-cyan-400 mt-0.5 truncate w-full">
                {currentKmH.toFixed(1)} <span className="text-[9px] text-gray-400 dark:text-slate-400 font-sans">km/h</span> • {currentMph.toFixed(1)} <span className="text-[9px] text-gray-400 dark:text-slate-400 font-sans">mph</span>
              </span>
            </div>

            <div className="bg-gray-50 dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 rounded-xl p-2 flex flex-col items-center justify-center text-center min-w-0 shadow-2xs">
              <span className="text-[9px] text-gray-500 dark:text-slate-400 font-bold uppercase tracking-wider truncate w-full">EST. DISTANCE</span>
              <span className="text-sm sm:text-base font-mono font-bold text-amber-500 dark:text-amber-400 mt-0.5 truncate w-full">
                {estimatedMeters.toFixed(1)} / {distNum}m
              </span>
            </div>

            {/* Surface Quick-Picker */}
            <div className="bg-gray-50 dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 rounded-xl p-1.5 sm:p-2 flex flex-col items-center justify-center text-center min-w-0 overflow-hidden shadow-2xs">
              <span className="text-[9px] text-gray-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-1 flex items-center justify-center gap-1 truncate w-full">
                <Layers size={10} className="text-cyan-600 dark:text-cyan-400 shrink-0" /> SURFACE TEXTURE
              </span>
              <div className="grid grid-cols-4 gap-0.5 sm:gap-1 w-full max-w-full">
                {Object.keys(surfaceThemes).map((surfKey) => (
                  <button
                    key={surfKey}
                    onClick={() => setSelectedSurface(surfKey)}
                    className={`px-0.5 py-0.5 rounded text-[8px] sm:text-[9px] font-mono font-bold uppercase transition truncate text-center ${
                      selectedSurface === surfKey 
                        ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-xs' 
                        : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 hover:bg-gray-200/60 dark:hover:bg-slate-800/60'
                    }`}
                    title={`Switch Track View to ${surfaceThemes[surfKey].label}`}
                  >
                    {surfKey}
                  </button>
                ))}
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
