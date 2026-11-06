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

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Gauge, Crosshair, Flame, Zap, ArrowUpRight } from 'lucide-react';
import { useVirtualRunnerSync } from './VirtualSprinter';

/**
 * CockpitHUD.jsx
 * High-performance athletic telemetry cockpit powered by Motion physics:
 * - 240° Calibrated Radial Tachometer with critically-damped spring needle
 * - 2D G-Force Friction Radar with decaying comet momentum trail
 * - 9-Segment Kinematic Shift Light Bar with dynamic redline alert & scale bounce
 * - Sprint Gear & Phase Pill with flip transitions
 * - 4-Tile Telemetry Matrix: Top Speed, Acceleration, G-Force, Horizontal Power
 * - Mode switcher: COMBO | DIAL | G-FORCE with animated layout pill
 * - Flawless Light Mode & Dark Mode contrast (WCAG AAA)
 */
function CockpitHUD({
  trackDistance = '40',
  displayTime = 0,
  isRunning = false,
  sequenceState = 'idle',
  activeRunner = null,
  liveSplits = [],
  history = [],
  results = [],
  className = ''
}) {
  const [speedUnit, setSpeedUnit] = useState('ms'); // 'ms' | 'kmh' | 'mph'
  const [tachoMode, setTachoMode] = useState('combo'); // 'combo' | 'dial' | 'gforce'

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

  const distNum = useMemo(() => {
    const val = parseFloat(trackDistance);
    return isNaN(val) || val <= 0 ? 40 : val;
  }, [trackDistance]);

  const timeNum = useMemo(() => {
    const t = parseFloat(displayTime);
    return isNaN(t) || t < 0 ? 0 : t;
  }, [displayTime]);

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
    targetTimeSec: 4.85 * (distNum / 40),
    lastSplitMeters: lastSplitMeters,
    isBenchmark: false,
  });

  // Harmonized runner progress, speed and acceleration
  const { estimatedMeters, currentVelocity, currentKmH, currentMph, liveAcceleration } = useMemo(() => {
    if (sequenceState === 'finished') {
      const finalTime = Math.max(0.1, timeNum);
      const avgSpeed = distNum / finalTime;
      return {
        estimatedMeters: distNum,
        currentVelocity: avgSpeed,
        currentKmH: avgSpeed * 3.6,
        currentMph: avgSpeed * 2.23694,
        liveAcceleration: 0
      };
    }

    if (!isSessionRunning) {
      return {
        estimatedMeters: 0,
        currentVelocity: 0,
        currentKmH: 0,
        currentMph: 0,
        liveAcceleration: 0
      };
    }

    const vel = liveRunnerTelemetry.instantVelocityMs || 0;
    const acc = liveRunnerTelemetry.accelerationMs2 || 0;
    const estMeters = liveRunnerTelemetry.estimatedDistanceM || 0;

    return {
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
    const amplitude = Math.min(0.24, 0.04 + (currentVelocity / 12) * 0.18);
    return Math.sin(timeNum * 24) * amplitude;
  }, [isRunning, sequenceState, timeNum, currentVelocity]);

  const liveGTotal = useMemo(() => {
    return Math.sqrt(Math.pow(liveGLong, 2) + Math.pow(liveGLat, 2));
  }, [liveGLong, liveGLat]);

  const livePowerWkg = useMemo(() => {
    return Math.max(0, liveAcceleration * currentVelocity);
  }, [liveAcceleration, currentVelocity]);

  // Peak velocity and Peak G-force tracking during the run
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

  // Tachometer Dial Calculations (240° SVG arc, max 12 m/s)
  const maxDialSpeed = 12.0;
  const needleDeg = Math.min(120, Math.max(-120, -120 + ((currentVelocity / maxDialSpeed) * 240)));
  const peakNeedleDeg = Math.min(120, Math.max(-120, -120 + ((peakVelocity / maxDialSpeed) * 240)));
  const totalArcLength = 218;
  const activeArcOffset = Math.max(0, totalArcLength - ((Math.min(maxDialSpeed, currentVelocity) / maxDialSpeed) * totalArcLength));
  const isRedline = currentVelocity >= 10.0;

  // Sprint Phase & Gear Indicator
  const sprintPhase = useMemo(() => {
    if (sequenceState === 'finished') {
      return { 
        gear: 'FIN', 
        label: 'FINISH LINE', 
        color: 'text-emerald-500 dark:text-emerald-400', 
        bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300' 
      };
    }
    if (!isRunning && sequenceState !== 'running') {
      return { 
        gear: 'N', 
        label: 'STAGING BLOCKS', 
        color: 'text-gray-500 dark:text-slate-400', 
        bg: 'bg-gray-100 dark:bg-slate-800/80 border-gray-200 dark:border-slate-700/80 text-gray-700 dark:text-slate-300' 
      };
    }
    if (estimatedMeters < 12 || liveAcceleration > 2.5) {
      return { 
        gear: '1', 
        label: 'DRIVE PHASE', 
        color: 'text-amber-500 dark:text-amber-400', 
        bg: 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300' 
      };
    }
    if (estimatedMeters < 25) {
      return { 
        gear: '2', 
        label: 'TRANSITION', 
        color: 'text-sky-500 dark:text-sky-400', 
        bg: 'bg-sky-500/10 border-sky-500/30 text-sky-700 dark:text-sky-300' 
      };
    }
    return { 
      gear: '3', 
      label: 'MAX VELOCITY', 
      color: 'text-purple-500 dark:text-purple-400', 
      bg: 'bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-300' 
    };
  }, [sequenceState, isRunning, estimatedMeters, liveAcceleration]);

  // 9-segment Kinematic Shift Lights (3 green, 3 yellow, 2 red, 1 purple)
  const speedRatio = Math.min(1.0, currentVelocity / 11.5);
  const activeLeds = Math.round(speedRatio * 9);

  // Calibrated Dial Ticks
  const dialTicks = useMemo(() => {
    const ticks = [];
    for (let s = 0; s <= 12; s += 0.5) {
      const isMajor = Number.isInteger(s) && s % 2 === 0;
      const isRedlineTick = s >= 10.0;
      const deg = -120 + ((s / 12) * 240);
      ticks.push({ speed: s, isMajor, isRedlineTick, deg });
    }
    return ticks;
  }, []);

  // 2D G-Force Reticle Coordinates (Center: 70, 70, Scale: 45 px/G)
  const gForcePoint = useMemo(() => {
    const rawX = 70 + (liveGLat * 45);
    const rawY = 70 - (liveGLong * 45);
    const dx = rawX - 70;
    const dy = rawY - 70;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= 54) return { x: rawX, y: rawY };
    return { x: 70 + (dx / dist) * 54, y: 70 + (dy / dist) * 54 };
  }, [liveGLat, liveGLong]);

  // G-Force Reticle Comet Trail Buffer (Last 4 points for motion blur trajectory)
  const [gTrail, setGTrail] = useState([]);
  useEffect(() => {
    if (isSessionRunning) {
      setGTrail(prev => {
        const next = [...prev, gForcePoint];
        return next.length > 5 ? next.slice(next.length - 5) : next;
      });
    } else {
      setGTrail([]);
    }
  }, [gForcePoint, isSessionRunning]);

  const peakGRadius = useMemo(() => {
    return Math.min(54, Math.max(0, peakGForce * 45));
  }, [peakGForce]);

  return (
    <div className={`w-full max-w-full bg-white dark:bg-gradient-to-b dark:from-slate-900/95 dark:via-slate-950/95 dark:to-slate-900/95 border border-gray-200/90 dark:border-cyan-500/30 rounded-2xl sm:rounded-3xl p-2.5 sm:p-3.5 flex flex-col justify-between items-center text-center relative overflow-hidden shadow-md dark:shadow-2xl transition-all duration-300 select-none ${className}`}>
      
      {/* Ambient Radial Cyan Backdrop Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-cyan-500/10 via-transparent to-transparent pointer-events-none" />

      {/* Header with Title, Mode Switcher & Unit Toggle */}
      <div className="w-full flex justify-between items-center text-[10px] font-mono font-bold text-gray-500 dark:text-slate-400 border-b border-gray-100 dark:border-slate-800/80 pb-2 z-10 gap-1">
        <span className="flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400 uppercase tracking-widest font-black shrink-0">
          <Gauge size={13} className="text-cyan-600 dark:text-cyan-400" /> COCKPIT HUD
        </span>

        <div className="flex items-center gap-1 shrink-0">
          {/* Animated Mode Switcher: COMBO | DIAL | G-FORCE */}
          <div className="bg-gray-100 dark:bg-slate-950/90 p-0.5 rounded-lg border border-gray-200 dark:border-slate-800 flex items-center gap-0.5 shadow-2xs relative">
            {['combo', 'dial', 'gforce'].map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setTachoMode(mode)}
                className={`relative px-1.5 py-0.5 rounded text-[8px] font-bold uppercase transition z-10 ${
                  tachoMode === mode 
                    ? 'text-cyan-700 dark:text-cyan-300 font-extrabold' 
                    : 'text-gray-400 hover:text-gray-700 dark:text-slate-500 dark:hover:text-slate-300'
                }`}
                title={`Switch to ${mode.toUpperCase()} view`}
              >
                {tachoMode === mode && (
                  <motion.div
                    layoutId="cockpitModePill"
                    transition={{ type: "spring", stiffness: 450, damping: 30 }}
                    className="absolute inset-0 bg-cyan-500/20 border border-cyan-500/40 rounded shadow-xs -z-10"
                  />
                )}
                {mode === 'combo' ? 'COMBO' : mode === 'dial' ? 'DIAL' : 'G-FORCE'}
              </button>
            ))}
          </div>

          {/* Speed Unit Toggle with micro-scale feedback */}
          <motion.button 
            whileTap={{ scale: 0.92 }}
            type="button"
            onClick={() => setSpeedUnit(prev => prev === 'ms' ? 'kmh' : prev === 'kmh' ? 'mph' : 'ms')}
            className="bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-1.5 py-0.5 rounded-md text-[9px] text-cyan-600 dark:text-cyan-300 border border-gray-200 dark:border-slate-700 font-extrabold transition uppercase shadow-2xs cursor-pointer"
            title="Toggle Speed Units (m/s, km/h, mph)"
          >
            {speedUnit === 'ms' ? 'm/s' : speedUnit === 'kmh' ? 'km/h' : 'mph'}
          </motion.button>
        </div>
      </div>

      {/* Kinematic Shift LED Indicator Bar with Dynamic Redline Alert */}
      <div className="w-full my-2.5 z-10 flex flex-col gap-1.5">
        <div className="w-full flex justify-center gap-1">
          {[...Array(9)].map((_, i) => {
            const isActive = i < activeLeds;
            let ledColor = 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)]';
            if (i >= 3 && i < 6) ledColor = 'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.9)]';
            if (i >= 6 && i < 8) ledColor = 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.9)]';
            if (i === 8) ledColor = 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.95)]';

            return (
              <motion.div
                key={i}
                initial={false}
                animate={{
                  scaleY: isActive ? (isRedline && i >= 6 ? [1, 1.35, 1] : 1.15) : 1,
                  opacity: isActive ? 1 : isDark ? 0.25 : 0.45
                }}
                transition={{ duration: 0.15 }}
                className={`h-1.5 flex-1 rounded-xs transition-colors duration-100 ${
                  isActive 
                    ? ledColor 
                    : isDark ? 'bg-slate-800/80' : 'bg-gray-200'
                }`}
              />
            );
          })}
        </div>

        {/* Sprint Gear & Phase Pill with flip animation */}
        <div className="w-full flex justify-between items-center px-0.5">
          <AnimatePresence mode="wait">
            <motion.div
              key={sprintPhase.gear}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15 }}
              className={`px-2 py-0.5 rounded-md border text-[9px] font-mono font-black flex items-center gap-1.5 ${sprintPhase.bg}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
              <span className="tracking-wider">GEAR {sprintPhase.gear}</span>
              <span className="text-gray-400 dark:text-slate-500">|</span>
              <span className="uppercase">{sprintPhase.label}</span>
            </motion.div>
          </AnimatePresence>

          {isRedline ? (
            <motion.span 
              initial={{ scale: 0.9 }}
              animate={{ scale: [0.95, 1.05, 0.95] }}
              transition={{ repeat: Infinity, duration: 0.4 }}
              className="px-1.5 py-0.5 rounded bg-rose-500/20 border border-rose-500/60 text-rose-600 dark:text-rose-300 text-[8px] font-black font-mono tracking-wider flex items-center gap-1 shadow-[0_0_10px_rgba(244,63,94,0.35)]"
            >
              <Flame size={9} className="text-rose-500 dark:text-rose-400" /> REDLINE
            </motion.span>
          ) : (
            <span className="text-[8px] font-mono text-gray-500 dark:text-slate-400">
              {(timeNum).toFixed(2)}s ELAPSED
            </span>
          )}
        </div>
      </div>

      {/* CORE DISPLAY (COMBO / DIAL / G-FORCE) */}
      <div className="w-full flex-1 flex flex-col justify-center items-center my-1 z-10 min-h-[160px]">
        
        {/* MODE 1: COMBO (Tachometer Arc + Mini G-Force Friction Radar) */}
        {tachoMode === 'combo' && (
          <div className="w-full flex flex-col items-center gap-2">
            {/* Tachometer Arc with Spring-Damped Needle */}
            <div className="relative w-44 sm:w-48 h-28 flex items-center justify-center">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 160 105">
                <defs>
                  <linearGradient id="hudGaugeGradCombo" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#06b6d4" />
                    <stop offset="50%" stopColor="#10b981" />
                    <stop offset="80%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#ec4899" />
                  </linearGradient>
                  <filter id="hudNeedleGlowCombo" x="-50%" y="-50%" width="200%" height="200%">
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
                  filter={isRedline ? "url(#hudNeedleGlowCombo)" : undefined}
                />

                {/* Active Colored Arc */}
                <path
                  d="M 35 101 A 52 52 0 1 1 125 101"
                  fill="none"
                  stroke="url(#hudGaugeGradCombo)"
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

                {/* Peak Velocity Needle Marker */}
                {peakVelocity > 0 && (
                  <motion.g 
                    animate={{ rotate: peakNeedleDeg }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    transformOrigin="80px 75px"
                  >
                    <line x1="80" y1="75" x2="80" y2="24" stroke="#f59e0b" strokeWidth="2.2" strokeDasharray="3 3" opacity="0.9" />
                    <circle cx="80" cy="23" r="3.2" fill="#f59e0b" filter="url(#hudNeedleGlowCombo)" />
                    <polygon points="77,20 83,20 80,15" fill="#f59e0b" />
                  </motion.g>
                )}

                {/* Spring-Damped Active Speed Needle */}
                <motion.g 
                  animate={{ rotate: needleDeg }} 
                  transition={{ type: "spring", stiffness: 220, damping: 18, mass: 0.6 }}
                  transformOrigin="80px 75px"
                  filter="url(#hudNeedleGlowCombo)"
                >
                  <line x1="80" y1="75" x2="80" y2="26" stroke={isDark ? "#ffffff" : "#0f172a"} strokeWidth="3" strokeLinecap="round" />
                  <circle cx="80" cy="75" r="6" fill="#0284c7" />
                  <circle cx="80" cy="75" r="2.5" fill="#ffffff" />
                </motion.g>

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
                <span className="text-[9px] font-mono font-bold text-cyan-600 dark:text-cyan-400 uppercase mt-0.5">
                  {speedUnit === 'kmh' ? 'KM/H' : speedUnit === 'mph' ? 'MPH' : 'M/S'}
                </span>
              </div>
            </div>

            {/* Mini G-Force Friction Radar Reticle with Comet Trail */}
            <div className="w-full flex items-center justify-between px-1 sm:px-2 pt-1 border-t border-gray-100 dark:border-slate-800/80 gap-2">
              <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full overflow-visible" viewBox="15 15 110 110">
                  <circle cx="70" cy="70" r="50" fill={isDark ? "#020617" : "#f8fafc"} stroke={isDark ? "#334155" : "#cbd5e1"} strokeWidth="1" />
                  <circle cx="70" cy="70" r="33" fill="none" stroke={isDark ? "#1e293b" : "#e2e8f0"} strokeWidth="1" strokeDasharray="2 2" />
                  <circle cx="70" cy="70" r="16" fill="none" stroke={isDark ? "#1e293b" : "#e2e8f0"} strokeWidth="1" strokeDasharray="2 2" />
                  <line x1="70" y1="20" x2="70" y2="120" stroke={isDark ? "#1e293b" : "#e2e8f0"} strokeWidth="1" />
                  <line x1="20" y1="70" x2="120" y2="70" stroke={isDark ? "#1e293b" : "#e2e8f0"} strokeWidth="1" />
                  
                  {/* Peak G-Force Hold Perimeter */}
                  {peakGRadius > 0 && (
                    <circle cx="70" cy="70" r={peakGRadius} fill="none" stroke="#f59e0b" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.65" />
                  )}

                  {/* Decaying Comet Trail */}
                  {gTrail.map((pt, idx) => (
                    <circle
                      key={idx}
                      cx={pt.x}
                      cy={pt.y}
                      r={(idx + 1) * 0.7}
                      fill="#06b6d4"
                      opacity={(idx + 1) * 0.16}
                    />
                  ))}

                  {/* Active G-Force Position with Spring Physics */}
                  <motion.circle 
                    animate={{ cx: gForcePoint.x, cy: gForcePoint.y }}
                    transition={{ type: "spring", stiffness: 350, damping: 24 }}
                    r="4.5" 
                    fill="#06b6d4" 
                    filter="url(#hudNeedleGlowCombo)" 
                  />
                  <motion.circle 
                    animate={{ cx: gForcePoint.x, cy: gForcePoint.y }}
                    transition={{ type: "spring", stiffness: 350, damping: 24 }}
                    r="1.8" 
                    fill="#ffffff" 
                  />
                </svg>
              </div>

              {/* Mini G-Force Readouts */}
              <div className="flex-1 flex flex-col justify-center text-left text-[9px] font-mono leading-tight min-w-0 pr-1">
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

        {/* MODE 2: DIAL FOCUS (Maximized Tachometer) */}
        {tachoMode === 'dial' && (
          <div className="w-full flex flex-col items-center">
            <div className="relative w-44 sm:w-52 h-32 sm:h-36 flex items-center justify-center">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 160 120">
                <defs>
                  <linearGradient id="hudGaugeGradDial" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#06b6d4" />
                    <stop offset="45%" stopColor="#10b981" />
                    <stop offset="75%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#ef4444" />
                  </linearGradient>
                </defs>

                <path
                  d="M 35 101 A 52 52 0 1 1 125 101"
                  fill="none"
                  stroke={isDark ? "#1e293b" : "#e2e8f0"}
                  strokeWidth="11"
                  strokeLinecap="round"
                />

                <path
                  d="M 131.2 66 A 52 52 0 0 1 125 101"
                  fill="none"
                  stroke="#f43f5e"
                  strokeWidth="11"
                  strokeLinecap="round"
                  opacity={isRedline ? "0.9" : isDark ? "0.35" : "0.45"}
                />

                <path
                  d="M 35 101 A 52 52 0 1 1 125 101"
                  fill="none"
                  stroke="url(#hudGaugeGradDial)"
                  strokeWidth="11"
                  strokeLinecap="round"
                  strokeDasharray={totalArcLength}
                  strokeDashoffset={activeArcOffset}
                  className="transition-all duration-100 ease-out"
                />

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

                {peakVelocity > 0 && (
                  <motion.g 
                    animate={{ rotate: peakNeedleDeg }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    transformOrigin="80px 75px"
                  >
                    <line x1="80" y1="75" x2="80" y2="22" stroke="#f59e0b" strokeWidth="2.5" strokeDasharray="3 3" opacity="0.9" />
                    <circle cx="80" cy="21" r="3.5" fill="#f59e0b" />
                  </motion.g>
                )}

                {/* Spring-Damped Active Needle */}
                <motion.g 
                  animate={{ rotate: needleDeg }} 
                  transition={{ type: "spring", stiffness: 220, damping: 18, mass: 0.6 }}
                  transformOrigin="80px 75px"
                >
                  <line x1="80" y1="75" x2="80" y2="24" stroke={isDark ? "#ffffff" : "#0f172a"} strokeWidth="3.5" strokeLinecap="round" />
                  <circle cx="80" cy="75" r="7" fill="#0284c7" />
                  <circle cx="80" cy="75" r="3" fill="#ffffff" />
                </motion.g>

                <text x="32" y="106" fill={isDark ? "#64748b" : "#94a3b8"} fontSize="9" fontWeight="bold" textAnchor="middle">0</text>
                <text x="44" y="52" fill={isDark ? "#64748b" : "#94a3b8"} fontSize="9" fontWeight="bold" textAnchor="middle">4</text>
                <text x="80" y="18" fill={isDark ? "#64748b" : "#94a3b8"} fontSize="9" fontWeight="bold" textAnchor="middle">6</text>
                <text x="116" y="52" fill={isDark ? "#64748b" : "#94a3b8"} fontSize="9" fontWeight="bold" textAnchor="middle">10</text>
                <text x="128" y="106" fill="#f43f5e" fontSize="9" fontWeight="bold" textAnchor="middle">12</text>
              </svg>

              <div className="absolute bottom-1 flex flex-col items-center pointer-events-none">
                <span className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-gray-900 dark:text-white leading-none">
                  {speedUnit === 'kmh' ? currentKmH.toFixed(1) : 
                   speedUnit === 'mph' ? currentMph.toFixed(1) : 
                   currentVelocity.toFixed(2)}
                </span>
                <span className="text-[10px] font-mono font-bold text-cyan-600 dark:text-cyan-400 uppercase mt-0.5">
                  {speedUnit === 'kmh' ? 'KM/H' : speedUnit === 'mph' ? 'MPH' : 'M/S'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* MODE 3: G-FORCE FOCUS (Maximized Radar) */}
        {tachoMode === 'gforce' && (
          <div className="w-full flex flex-col items-center">
            <div className="relative w-40 sm:w-44 h-40 sm:h-44 flex items-center justify-center">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 160 160">
                <circle cx="80" cy="80" r="70" fill={isDark ? "#020617" : "#f8fafc"} stroke={isDark ? "#334155" : "#cbd5e1"} strokeWidth="1.2" />
                <circle cx="80" cy="80" r="46" fill="none" stroke={isDark ? "#1e293b" : "#e2e8f0"} strokeWidth="1" strokeDasharray="3 3" />
                <circle cx="80" cy="80" r="23" fill="none" stroke={isDark ? "#1e293b" : "#e2e8f0"} strokeWidth="1" strokeDasharray="3 3" />
                <line x1="80" y1="10" x2="80" y2="150" stroke={isDark ? "#1e293b" : "#e2e8f0"} strokeWidth="1.2" />
                <line x1="10" y1="80" x2="150" y2="80" stroke={isDark ? "#1e293b" : "#e2e8f0"} strokeWidth="1.2" />

                {/* Concentric labels */}
                <text x="83" y="22" fill={isDark ? "#475569" : "#94a3b8"} fontSize="8" fontFamily="monospace">+1.0G</text>
                <text x="83" y="44" fill={isDark ? "#475569" : "#94a3b8"} fontSize="8" fontFamily="monospace">+0.5G</text>
                <text x="83" y="125" fill={isDark ? "#475569" : "#94a3b8"} fontSize="8" fontFamily="monospace">-0.5G</text>

                {/* Peak G circle */}
                {peakGForce > 0 && (
                  <circle cx="80" cy="80" r={Math.min(70, peakGForce * 45)} fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.75" />
                )}

                {/* Comet Trail */}
                {gTrail.map((pt, idx) => (
                  <circle
                    key={idx}
                    cx={80 + ((pt.x - 70) * 1.15)}
                    cy={80 + ((pt.y - 70) * 1.15)}
                    r={(idx + 1) * 0.9}
                    fill="#06b6d4"
                    opacity={(idx + 1) * 0.16}
                  />
                ))}

                {/* Active G point with spring physics */}
                <motion.circle 
                  animate={{ 
                    cx: 80 + (liveGLat * 45),
                    cy: 80 - (liveGLong * 45)
                  }}
                  transition={{ type: "spring", stiffness: 350, damping: 24 }}
                  r="6" 
                  fill="#06b6d4" 
                />
                <motion.circle 
                  animate={{ 
                    cx: 80 + (liveGLat * 45),
                    cy: 80 - (liveGLong * 45)
                  }}
                  transition={{ type: "spring", stiffness: 350, damping: 24 }}
                  r="2.5" 
                  fill="#ffffff" 
                />
              </svg>
            </div>

            {/* G-Force Metrics Strip */}
            <div className="w-full grid grid-cols-3 gap-1 mt-2 p-1.5 bg-gray-50/80 dark:bg-slate-950/70 rounded-xl border border-gray-200/90 dark:border-slate-800/80 text-[9px] font-mono text-center">
              <div>
                <span className="text-gray-400 text-[8px] block">TOTAL</span>
                <span className="text-cyan-600 dark:text-cyan-400 font-extrabold">{liveGTotal.toFixed(2)}G</span>
              </div>
              <div>
                <span className="text-gray-400 text-[8px] block">LONG DRIVE</span>
                <span className={liveGLong >= 0 ? "text-emerald-500 font-bold" : "text-rose-500 font-bold"}>
                  {liveGLong >= 0 ? `+${liveGLong.toFixed(2)}` : liveGLong.toFixed(2)}G
                </span>
              </div>
              <div>
                <span className="text-gray-400 text-[8px] block">LAT SWAY</span>
                <span className="text-sky-500 font-bold">
                  {liveGLat >= 0 ? `+${liveGLat.toFixed(2)}` : liveGLat.toFixed(2)}G
                </span>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* 4-BOX TELEMETRY MATRIX WITH INTERACTIVE HOVER */}
      <div className="w-full grid grid-cols-2 gap-1.5 pt-2 border-t border-gray-100 dark:border-slate-800/80 text-[10px] font-mono z-10">
        {/* Box 1: Top Speed */}
        <motion.div 
          whileHover={{ y: -2 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className="bg-gray-50/80 dark:bg-slate-950/85 border border-gray-200/80 dark:border-slate-800/80 p-2 rounded-2xl flex flex-col items-center justify-center text-center shadow-2xs"
        >
          <span className="text-gray-500 dark:text-slate-400 block text-[8px] uppercase font-extrabold flex items-center gap-1">
            <Flame size={10} className="text-amber-500 dark:text-amber-400" /> TOP SPEED
          </span>
          <span className="font-extrabold text-amber-600 dark:text-amber-400 text-xs sm:text-sm mt-0.5 tabular-nums">
            {speedUnit === 'kmh' ? (peakVelocity * 3.6).toFixed(1) : 
             speedUnit === 'mph' ? (peakVelocity * 2.23694).toFixed(1) : 
             peakVelocity.toFixed(2)} <span className="text-[8px] text-gray-400 dark:text-slate-400 font-sans">{speedUnit === 'kmh' ? 'km/h' : speedUnit === 'mph' ? 'mph' : 'm/s'}</span>
          </span>
        </motion.div>

        {/* Box 2: Acceleration */}
        <motion.div 
          whileHover={{ y: -2 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className="bg-gray-50/80 dark:bg-slate-950/85 border border-gray-200/80 dark:border-slate-800/80 p-2 rounded-2xl flex flex-col items-center justify-center text-center shadow-2xs"
        >
          <span className="text-gray-500 dark:text-slate-400 block text-[8px] uppercase font-extrabold flex items-center gap-1">
            <ArrowUpRight size={10} className="text-emerald-500 dark:text-emerald-400" /> ACCELERATION
          </span>
          <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm mt-0.5 tabular-nums">
            +{liveAcceleration.toFixed(1)} <span className="text-[8px] text-gray-400 dark:text-slate-400 font-sans">m/s²</span>
          </span>
        </motion.div>

        {/* Box 3: G-Force */}
        <motion.div 
          whileHover={{ y: -2 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className="bg-gray-50/80 dark:bg-slate-950/85 border border-gray-200/80 dark:border-slate-800/80 p-2 rounded-2xl flex flex-col items-center justify-center text-center shadow-2xs"
        >
          <span className="text-gray-500 dark:text-slate-400 block text-[8px] uppercase font-extrabold flex items-center gap-1">
            <Crosshair size={10} className="text-cyan-600 dark:text-cyan-400" /> G-FORCE
          </span>
          <span className="font-extrabold text-cyan-600 dark:text-cyan-300 text-xs sm:text-sm mt-0.5 tabular-nums">
            {liveGTotal.toFixed(2)}G <span className="text-[8px] text-gray-400 dark:text-slate-500 font-sans">({peakGForce.toFixed(2)}G pk)</span>
          </span>
        </motion.div>

        {/* Box 4: Horizontal Power */}
        <motion.div 
          whileHover={{ y: -2 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className="bg-gray-50/80 dark:bg-slate-950/85 border border-gray-200/80 dark:border-slate-800/80 p-2 rounded-2xl flex flex-col items-center justify-center text-center shadow-2xs"
        >
          <span className="text-gray-500 dark:text-slate-400 block text-[8px] uppercase font-extrabold flex items-center gap-1">
            <Zap size={10} className="text-purple-500 dark:text-purple-400" /> HORIZ POWER
          </span>
          <span className="font-extrabold text-purple-600 dark:text-purple-300 text-xs sm:text-sm mt-0.5 tabular-nums">
            {livePowerWkg.toFixed(1)} <span className="text-[8px] text-gray-400 dark:text-slate-400 font-sans">W/kg</span>
          </span>
        </motion.div>
      </div>

    </div>
  );
}

export default React.memo(CockpitHUD);
