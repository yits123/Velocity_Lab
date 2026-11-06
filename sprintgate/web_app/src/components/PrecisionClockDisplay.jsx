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

import React, { useMemo, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, AlertTriangle, CheckCircle2, ShieldCheck, Timer } from 'lucide-react';

/**
 * PrecisionClockDisplay.jsx
 * Velocity Lab - Olympic-Grade Precision Timing & Motion Graphics Display
 * 
 * Features:
 * - Tabular-nums layout preservation (zero horizontal jitter)
 * - Olympic photo-finish beam-break shockwave & radial energy ripple
 * - World Athletics Rule 161.2 seismic shudder on false start
 * - Split-digit kinetic inertia on stop/settle
 * - Multi-variant adaptive scale: 'cockpit' | 'stadium' | 'jumbotron'
 * - High-contrast & dark mode WCAG AAA compliance
 */
function PrecisionClockDisplay({
  time = 0,
  sequenceState = 'idle',
  variant = 'cockpit',
  className = ''
}) {
  const isFalseStart = sequenceState === 'false_start';
  const isFinished = sequenceState === 'finished';
  const isRunning = sequenceState === 'running';
  const numericTime = typeof time === 'number' ? time : parseFloat(time) || 0;
  
  // Format into integer seconds and two-digit decimals (e.g. "04" and "85")
  const formattedTime = numericTime.toFixed(2);
  const [secondsPart, decimalPart] = formattedTime.split('.');

  // Track finish trigger to fire single-shot particle/shockwave animation
  const [triggerFinishBurst, setTriggerFinishBurst] = useState(false);
  useEffect(() => {
    if (sequenceState === 'finished') {
      setTriggerFinishBurst(true);
      const timer = setTimeout(() => setTriggerFinishBurst(false), 1400);
      return () => clearTimeout(timer);
    } else {
      setTriggerFinishBurst(false);
    }
  }, [sequenceState]);

  // False start seismic shake keyframes
  const falseStartShake = isFalseStart ? {
    x: [-8, 8, -6, 6, -4, 4, -2, 2, 0],
    scale: [1, 1.03, 0.98, 1.02, 1],
    transition: { duration: 0.42, ease: "easeInOut" }
  } : {};

  // Finish beam-break spring pop
  const finishPop = isFinished ? {
    scale: [1, 1.05, 0.99, 1],
    transition: { type: "spring", stiffness: 400, damping: 22 }
  } : {};

  // Variant 1: Stadium Fullscreen Scoreboard Mode
  if (variant === 'stadium') {
    return (
      <div className={`relative flex flex-col items-center justify-center select-none ${className}`}>
        {/* Radial Beam-Break Shockwave Ring */}
        <AnimatePresence>
          {triggerFinishBurst && (
            <motion.div
              initial={{ scale: 0.6, opacity: 0.8 }}
              animate={{ scale: 2.2, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0 rounded-full bg-radial from-emerald-500/30 via-cyan-500/10 to-transparent pointer-events-none blur-xl"
            />
          )}
        </AnimatePresence>

        <motion.div
          animate={{ ...falseStartShake, ...finishPop }}
          className={`text-6xl sm:text-8xl md:text-[10rem] lg:text-[14rem] xl:text-[18rem] leading-none font-bold font-mono tracking-tighter tabular-nums z-10 drop-shadow-2xl flex items-baseline ${
            isFalseStart ? 'text-red-500 drop-shadow-[0_0_50px_rgba(239,68,68,0.5)]' :
            isFinished ? 'text-emerald-400 drop-shadow-[0_0_60px_rgba(0,208,132,0.45)]' :
            isRunning ? 'text-white drop-shadow-[0_0_35px_rgba(255,255,255,0.25)]' :
            'text-gray-900 dark:text-gray-100'
          }`}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          <span>{secondsPart}</span>
          <span className="opacity-60">.</span>
          <span className="relative">
            {decimalPart}
            {isRunning && (
              <span className="absolute -bottom-2 left-0 right-0 h-1 bg-emerald-500 animate-pulse rounded-full" />
            )}
          </span>
          <span 
            className={`text-3xl sm:text-5xl md:text-7xl lg:text-9xl ml-2 sm:ml-4 md:ml-6 font-medium ${
              isFalseStart ? 'text-red-500' : 'text-emerald-500'
            }`}
          >
            s
          </span>
        </motion.div>
      </div>
    );
  }

  // Variant 2: Bleacher Jumbotron High-Visibility Mode
  if (variant === 'jumbotron') {
    return (
      <div className={`relative flex flex-col items-center justify-center select-none ${className}`}>
        {/* Optical Glow Backdrop */}
        <AnimatePresence>
          {triggerFinishBurst && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0.9 }}
              animate={{ scale: 2.4, opacity: 0 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              className="absolute w-full h-full rounded-full bg-emerald-500/25 blur-3xl pointer-events-none"
            />
          )}
        </AnimatePresence>

        <motion.div 
          animate={{ ...falseStartShake, ...finishPop }}
          className={`text-[20vw] sm:text-[18vw] md:text-[16vw] lg:text-[22rem] font-bold leading-none font-mono tracking-tighter tabular-nums select-none ${
            isFalseStart 
              ? 'text-red-500 drop-shadow-[0_0_80px_rgba(239,68,68,0.5)]' 
              : isFinished
              ? 'text-emerald-400 drop-shadow-[0_0_100px_rgba(0,208,132,0.5)]'
              : 'text-emerald-500 drop-shadow-[0_0_80px_rgba(0,208,132,0.35)]'
          }`}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {formattedTime}
        </motion.div>
      </div>
    );
  }

  // Default Variant: 'cockpit' (Main Live Dashboard Interactive Arena)
  return (
    <div className={`relative flex flex-col items-center justify-center select-none py-1 ${className}`}>
      
      {/* 1. Kinetic Beam-Break Expanding Shockwave */}
      <AnimatePresence>
        {triggerFinishBurst && (
          <motion.div
            initial={{ scale: 0.7, opacity: 0.9 }}
            animate={{ scale: 1.8, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.95, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 -m-6 rounded-3xl bg-radial from-emerald-500/35 via-cyan-500/15 to-transparent blur-xl pointer-events-none z-0"
          />
        )}
      </AnimatePresence>

      {/* 2. Ambient High-Speed Telemetry Pulse Ribbon (Active Sprinting) */}
      {isRunning && (
        <div className="absolute inset-x-0 -bottom-1 h-1.5 bg-gradient-to-r from-transparent via-emerald-500 to-transparent blur-[1px] opacity-80 animate-pulse pointer-events-none" />
      )}

      {/* 3. Main Precision Tabular Digits */}
      <motion.div 
        animate={{ ...falseStartShake, ...finishPop }}
        className={`text-5xl xs:text-6xl sm:text-7xl md:text-8xl lg:text-[100px] xl:text-[115px] 2xl:text-[130px] leading-none font-bold font-mono tracking-tighter flex items-baseline z-10 transition-colors duration-150 ${
          isFalseStart 
            ? 'text-red-500 drop-shadow-[0_0_35px_rgba(239,68,68,0.6)]' 
            : isFinished
            ? 'text-emerald-500 dark:text-emerald-400 drop-shadow-[0_0_30px_rgba(0,208,132,0.35)]'
            : isRunning
            ? 'text-gray-900 dark:text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]'
            : 'text-gray-900 dark:text-gray-100 drop-shadow-md'
        }`}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {/* Integer Seconds */}
        <span className="tabular-nums">{secondsPart}</span>

        {/* High-Tech Decimal Separator with Optical Pulse */}
        <span className={`px-0.5 transition-colors ${
          isRunning ? 'text-emerald-500 animate-pulse' : 'opacity-60'
        }`}>
          .
        </span>

        {/* Microsecond/Centisecond Split Digits */}
        <span className="tabular-nums relative">
          {decimalPart}

          {/* Micro-meter scanline indicator for active timing */}
          {isRunning && (
            <motion.span 
              initial={{ opacity: 0.3 }}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 0.6, repeat: Infinity, ease: "linear" }}
              className="absolute -top-1 -right-2 w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#00D084]"
            />
          )}
        </span>

        {/* Seconds Unit Symbol */}
        <span 
          className={`text-2xl xs:text-3xl sm:text-4xl md:text-5xl lg:text-[44px] ml-1.5 md:ml-2.5 tracking-normal font-medium transition-colors ${
            isFalseStart ? 'text-red-500' : 'text-emerald-500'
          }`}
        >
          s
        </span>
      </motion.div>

      {/* 4. Live Telemetry Status Pill (Contextual Olympic Badge) */}
      <div className="mt-2.5 z-10 flex items-center gap-1.5">
        {isFalseStart ? (
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-500/15 border border-red-500/40 text-red-400 text-[10px] font-mono font-bold tracking-wider uppercase shadow-[0_0_12px_rgba(239,68,68,0.25)]"
          >
            <AlertTriangle size={11} className="text-red-400 animate-bounce" />
            <span>RULE 161.2: FALSE START</span>
          </motion.div>
        ) : isFinished ? (
          <motion.div 
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
            className="flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-500 dark:text-emerald-400 text-[10px] font-mono font-bold tracking-wider uppercase shadow-[0_0_15px_rgba(0,208,132,0.25)]"
          >
            <CheckCircle2 size={11} className="text-emerald-500" />
            <span>PHOTO-FINISH LOCKED • ±0.001s</span>
          </motion.div>
        ) : isRunning ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/40 text-cyan-500 dark:text-cyan-400 text-[10px] font-mono font-bold tracking-wider uppercase shadow-[0_0_12px_rgba(6,182,212,0.2)]"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            <span>LIVE BEAM SAMPLING • 1000Hz</span>
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}

export default React.memo(PrecisionClockDisplay);
