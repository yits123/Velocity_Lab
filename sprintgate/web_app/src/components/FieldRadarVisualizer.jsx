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

import React, { useState, useEffect } from 'react';
import { 
  Zap, Activity, TrendingUp, Gauge, RotateCcw, Compass, 
  CheckCircle2, ArrowRight, ArrowLeft, Flag, Award, ChevronDown, ChevronUp
} from 'lucide-react';
import { CyberAthleteSVG } from './VirtualSprinter';

/**
 * Biomechanical Agility & Turn Metrics Calculator
 * Grounds sports science equations for Change-of-Direction (COD) deficit, 
 * turnaround braking overhead, and lateral plant symmetry.
 */
export function calculateAgilityMetrics(splits, testType = 'shuttle') {
  if (!splits || splits.length < 3) return null;

  const legTimes = splits.map((s, idx) => {
    if (s.splitTime !== undefined && s.splitTime !== null) {
      return parseFloat(s.splitTime) || 0;
    }
    const currTime = parseFloat(s.time) || 0;
    const prevTime = idx > 0 ? (parseFloat(splits[idx - 1].time) || 0) : 0;
    return Math.max(0, currTime - prevTime);
  });
  const totalTime = splits[splits.length - 1].time 
    ? parseFloat(splits[splits.length - 1].time) 
    : legTimes.reduce((a, b) => a + b, 0);

  if (testType === 'shuttle' && legTimes.length >= 4) {
    const [l1, l2, l3, l4] = legTimes;
    
    // Leg 4 is sprint-through (no deceleration / pivot).
    // Legs 2 & 3 include complete 180° deceleration, bend, pick/drop block, and pivot.
    const avgTurnLegTime = (l2 + l3) / 2;
    const turnOverhead = Math.max(0, avgTurnLegTime - l4); // Turn overhead penalty per turn
    const totalTurnPenalty = turnOverhead * 3; // 3 turns total

    // Estimated deceleration vs re-acceleration breakdown per turn
    // (Braking phase into the gate ~44%, explosive pivot and drive-out ~56%)
    const turn1Decel = l1 * 0.44;
    const turn1Reaccel = l2 * 0.56;
    
    const turn2Decel = l2 * 0.44;
    const turn2Reaccel = l3 * 0.56;
    
    const turn3Decel = l3 * 0.44;
    const turn3Reaccel = l4 * 0.56;

    // Lateral Symmetry Index (LSI):
    // Turns 1 & 3 happen at Far Gate (10m line - dominant plant side)
    // Turn 2 happens at Near Gate (Start line - opposite plant side)
    const farTurnsAvg = (l1 + l3) / 2;
    const nearTurn = l2;
    const symmetryRatio = Math.min(farTurnsAvg, nearTurn) / Math.max(farTurnsAvg, nearTurn) * 100;
    const asymmetryPct = Math.abs(farTurnsAvg - nearTurn) / ((farTurnsAvg + nearTurn) / 2) * 100;
    
    let lateralBalanceRating = "Optimal (<5% delta)";
    let lateralBalanceColor = "text-emerald-500";
    if (asymmetryPct > 10) {
      lateralBalanceRating = "Significant Asymmetry (>10%)";
      lateralBalanceColor = "text-amber-500";
    } else if (asymmetryPct > 5) {
      lateralBalanceRating = "Moderate Asymmetry (5-10%)";
      lateralBalanceColor = "text-blue-400";
    }

    // Fatigue Decay Rate: Compare Leg 1 (fresh) vs Leg 3 (after 20m of max sprinting & 2 turns)
    const fatigueDecayPct = ((l3 - l1) / (l1 || 1)) * 100;

    // Change of Direction Deficit (COD Deficit):
    // Difference between total shuttle time and linear 40m sprint (estimated as 4 * l4)
    const linearEstimate40m = l4 * 4;
    const codDeficit = Math.max(0, totalTime - linearEstimate40m);

    return {
      testType: 'shuttle',
      legs: [l1, l2, l3, l4],
      totalTime: totalTime.toFixed(3),
      turnOverhead: turnOverhead.toFixed(2),
      totalTurnPenalty: totalTurnPenalty.toFixed(2),
      turn1: { 
        name: "Turn 1 (10m - Block 1)", 
        decel: turn1Decel.toFixed(2), 
        reaccel: turn1Reaccel.toFixed(2), 
        total: (turn1Decel + turn1Reaccel).toFixed(2) 
      },
      turn2: { 
        name: "Turn 2 (Start - Drop 1)", 
        decel: turn2Decel.toFixed(2), 
        reaccel: turn2Reaccel.toFixed(2), 
        total: (turn2Decel + turn2Reaccel).toFixed(2) 
      },
      turn3: { 
        name: "Turn 3 (10m - Block 2)", 
        decel: turn3Decel.toFixed(2), 
        reaccel: turn3Reaccel.toFixed(2), 
        total: (turn3Decel + turn3Reaccel).toFixed(2) 
      },
      symmetryRatio: symmetryRatio.toFixed(1),
      asymmetryPct: asymmetryPct.toFixed(1),
      lateralBalanceRating,
      lateralBalanceColor,
      fatigueDecayPct: fatigueDecayPct.toFixed(1),
      codDeficit: codDeficit.toFixed(2),
      pureSprintLeg: l4.toFixed(2)
    };
  } else if (testType === 'pro_agility' && legTimes.length >= 3) {
    const [l1, l2, l3] = legTimes;
    // Leg 1: 5yd Lateral Burst & Right Plant
    // Leg 2: 10yd Crossover Sprint & Left Plant
    // Leg 3: 5yd Return Sprint Through Gate
    const rightPlantOverhead = Math.max(0.2, l1 - 0.75); // Turn 1 overhead compared to linear 5yd (~0.75s)
    const leftPlantOverhead = Math.max(0.3, l2 - 1.15); // Turn 2 overhead compared to linear 10yd (~1.15s)
    const avgTurnOverhead = (rightPlantOverhead + leftPlantOverhead) / 2;

    // Linear 20yd estimate (~2.60s baseline)
    const linearEstimate20yd = 2.60;
    const codDeficit = Math.max(0.8, totalTime - linearEstimate20yd);

    // Lateral Symmetry Index between Right Plant (Turn 1) and Left Plant (Turn 2 normalized for distance)
    const normalizedTurn2 = l2 / 2; // normalized to 5yd distance
    const symmetryRatio = Math.min(l1, normalizedTurn2) / Math.max(l1, normalizedTurn2) * 100;
    const asymmetryPct = 100 - symmetryRatio;

    let lateralBalanceRating = "Optimal (<8% delta)";
    let lateralBalanceColor = "text-emerald-500";
    if (asymmetryPct > 12) {
      lateralBalanceRating = "Significant Asymmetry (>12%)";
      lateralBalanceColor = "text-amber-500";
    } else if (asymmetryPct > 8) {
      lateralBalanceRating = "Moderate Asymmetry (8-12%)";
      lateralBalanceColor = "text-blue-400";
    }

    const returnSprintEfficiency = ((l1 - l3) / (l1 || 1)) * 100;

    return {
      testType: 'pro_agility',
      legs: [l1, l2, l3],
      totalTime: totalTime.toFixed(3),
      codDeficit: codDeficit.toFixed(2),
      turnOverhead: avgTurnOverhead.toFixed(2),
      totalTurnPenalty: (rightPlantOverhead + leftPlantOverhead).toFixed(2),
      symmetryRatio: symmetryRatio.toFixed(1),
      asymmetryPct: asymmetryPct.toFixed(1),
      lateralBalanceRating,
      lateralBalanceColor,
      fatigueDecayPct: returnSprintEfficiency.toFixed(1),
      turn1: { 
        name: "Turn 1 (5yd Right Plant)", 
        decel: (l1 * 0.46).toFixed(2), 
        reaccel: (l1 * 0.54).toFixed(2), 
        total: l1.toFixed(2) 
      },
      turn2: { 
        name: "Turn 2 (10yd Left Plant)", 
        decel: (l2 * 0.48).toFixed(2), 
        reaccel: (l2 * 0.52).toFixed(2), 
        total: l2.toFixed(2) 
      },
      turn3: { 
        name: "Sector 3 (5yd Gate Sprint)", 
        decel: "0.00", 
        reaccel: l3.toFixed(2), 
        total: l3.toFixed(2) 
      }
    };
  } else if (testType === 'l_drill' && legTimes.length >= 3) {
    const [l1, l2, l3] = legTimes;
    // Leg 1: 5yd to Cone 2, line touch & 5yd return to Cone 1 (0-10yd)
    // Leg 2: Sprint to Cone 2 & outer loop around Cone 3 (10-20yd)
    // Leg 3: Figure-8 weave around Cone 3, tight 90° cut around Cone 2 to finish gate (20-30yd)
    
    // Linear 30yd estimate (~3.80s baseline)
    const linearEstimate30yd = 3.80;
    const codDeficit = Math.max(1.5, totalTime - linearEstimate30yd);

    // Cornering Overhead: Compare cornering loop (Leg 2) against reversal sector (Leg 1)
    const corneringOverhead = Math.max(0.1, l2 - l1);

    // Cornering & Reversal Symmetry: Ratio between tight cut (Leg 3) and touch reversal (Leg 1)
    const symmetryRatio = Math.min(l1, l3) / Math.max(l1, l3) * 100;
    const asymmetryPct = 100 - symmetryRatio;

    let lateralBalanceRating = "Optimal Cornering (<10% delta)";
    let lateralBalanceColor = "text-emerald-500";
    if (asymmetryPct > 15) {
      lateralBalanceRating = "Cornering Drift (>15%)";
      lateralBalanceColor = "text-amber-500";
    } else if (asymmetryPct > 10) {
      lateralBalanceRating = "Moderate Cornering Delta";
      lateralBalanceColor = "text-blue-400";
    }

    const corneringDecay = ((l2 - l1) / (l1 || 1)) * 100;

    return {
      testType: 'l_drill',
      legs: [l1, l2, l3],
      totalTime: totalTime.toFixed(3),
      codDeficit: codDeficit.toFixed(2),
      turnOverhead: corneringOverhead.toFixed(2),
      totalTurnPenalty: (l2 - (l1 * 0.95)).toFixed(2),
      symmetryRatio: symmetryRatio.toFixed(1),
      asymmetryPct: asymmetryPct.toFixed(1),
      lateralBalanceRating,
      lateralBalanceColor,
      fatigueDecayPct: corneringDecay.toFixed(1),
      turn1: { 
        name: "Sector 1 (Cone 2 Touch & Return)", 
        decel: (l1 * 0.48).toFixed(2), 
        reaccel: (l1 * 0.52).toFixed(2), 
        total: l1.toFixed(2) 
      },
      turn2: { 
        name: "Sector 2 (Cone 3 Outer Loop)", 
        decel: (l2 * 0.42).toFixed(2), 
        reaccel: (l2 * 0.58).toFixed(2), 
        total: l2.toFixed(2) 
      },
      turn3: { 
        name: "Sector 3 (90° Cut & Gate Sprint)", 
        decel: (l3 * 0.38).toFixed(2), 
        reaccel: (l3 * 0.62).toFixed(2), 
        total: l3.toFixed(2) 
      }
    };
  }

  return null;
}

export default function FieldRadarVisualizer({ 
  testMode = 'shuttle', 
  liveSplits = [], 
  isRunning = false, 
  sequenceState = 'idle',
  compact = false
}) {
  const [showDeepAnalytics, setShowDeepAnalytics] = useState(true);
  const [isDark, setIsDark] = useState(() => 
    typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : true
  );

  useEffect(() => {
    const checkTheme = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  if (!['shuttle', 'pro_agility', 'l_drill'].includes(testMode)) {
    return null;
  }

  const splitsCount = liveSplits.length;
  const currentLeg = isRunning ? Math.min(splitsCount + 1, testMode === 'shuttle' ? 4 : 3) : splitsCount;
  const isFinished = sequenceState === 'finished' || (!isRunning && splitsCount >= (testMode === 'shuttle' ? 4 : 3));

  const metrics = calculateAgilityMetrics(liveSplits, testMode);

  // Dynamic drill status description
  const getStatusPrompt = () => {
    if (testMode === 'pro_agility') {
      if (isFinished) return "✅ 5-10-5 Pro Agility Complete! All 3 sectors captured.";
      if (!isRunning) return sequenceState === 'waiting_start' ? "🔫 Gun Fired! Break center gate laser to begin Sector 1" : "Ready in 3-point stance at Center Beam (Gate A) · Accelerate on signal";
      if (currentLeg === 1) return "🏃 Sector 1: 5yd Lateral Burst to Turn 1 & Right Plant";
      if (currentLeg === 2) return "⚡ Sector 2: 10yd Crossover Sprint to Turn 2 & Left Plant";
      if (currentLeg === 3) return "🏁 Sector 3: 5yd Explosive Finish through Center Gate!";
      return "Pro Agility in progress...";
    }
    if (testMode === 'l_drill') {
      if (isFinished) return "✅ 3-Cone L-Drill Complete! All 3 sectors captured.";
      if (!isRunning) return sequenceState === 'waiting_start' ? "🔫 Gun Fired! Break start gate laser to begin Sector 1" : "Ready in 3-point stance at Cone 1 · Accelerate on signal";
      if (currentLeg === 1) return "🏃 Sector 1: 5yd to Cone 2, line touch & 5yd return to Cone 1";
      if (currentLeg === 2) return "⚡ Sector 2: Sprint around Cone 2 & outer loop around Cone 3";
      if (currentLeg === 3) return "🏁 Sector 3: Figure-8 weave & 90° cut to Finish Gate!";
      return "L-Drill in progress...";
    }
    if (isFinished) return "✅ 4x10m Shuttle Complete! All 4 splits captured.";
    if (!isRunning) return sequenceState === 'waiting_start' ? "🔫 Gun Fired! Break start gate laser to begin Leg 1" : "Ready at Start Gate (0m Line) · Accelerate on signal";
    if (currentLeg === 1) return "🏃 Leg 1: Accelerating 10m to Turn 1 (Pick up Block 1)";
    if (currentLeg === 2) return "🔄 Leg 2: Returning 10m to Start Line (Drop Block 1)";
    if (currentLeg === 3) return "⚡ Leg 3: Sprinting 10m to Turn 3 (Pick up Block 2)";
    if (currentLeg === 4) return "🏁 Leg 4: Sprinting through Start Line to FINISH!";
    return "Drill in progress...";
  };

  const shuttleLanes = [
    { leg: 1, label: "Leg 1 (0m → 10m)", dir: "right", startX: 92, endX: 452, y: 46, prompt: "Pick up Block 1" },
    { leg: 2, label: "Leg 2 (10m → 0m)", dir: "left", startX: 452, endX: 92, y: 78, prompt: "Drop Block 1" },
    { leg: 3, label: "Leg 3 (0m → 10m)", dir: "right", startX: 92, endX: 452, y: 110, prompt: "Pick up Block 2" },
    { leg: 4, label: "Leg 4 (10m → 0m)", dir: "left", startX: 452, endX: 92, y: 142, prompt: "Sprint Through Finish" },
  ];

  return (
    <div className={`w-full bg-white dark:bg-slate-900/90 border border-gray-200 dark:border-slate-800 rounded-3xl p-4 sm:p-6 flex flex-col gap-5 text-gray-900 dark:text-gray-100 shadow-xl transition-all ${compact ? 'max-w-xl' : 'max-w-3xl'}`}>
      
      {/* Visualizer Top Bar */}
      <div className="flex justify-between items-center border-b border-gray-200 dark:border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-[#00D084]">
            <Compass size={18} />
          </div>
          <div>
            <div className="text-xs sm:text-sm font-bold tracking-wide text-gray-900 dark:text-white flex items-center gap-2">
              <span>{testMode === 'shuttle' ? '4x10m Shuttle Field Radar' : testMode === 'pro_agility' ? '5-10-5 Pro Agility Radar' : '3-Cone L-Drill Radar'}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                {isFinished ? 'COMPLETED' : isRunning ? `LEG ${currentLeg} ACTIVE` : 'READY'}
              </span>
            </div>
            <div className="text-[11px] text-gray-500 dark:text-slate-400 font-medium">{getStatusPrompt()}</div>
          </div>
        </div>

        {metrics && (
          <button 
            onClick={() => setShowDeepAnalytics(!showDeepAnalytics)}
            className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 transition"
          >
            <span>Turn Analytics</span>
            {showDeepAnalytics ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>

      {/* SVG Interactive Court / Field Radar Graphic */}
      {testMode === 'shuttle' && (
        <div className="relative w-full bg-slate-50 dark:bg-slate-950/80 rounded-2xl border border-gray-200 dark:border-slate-800 p-2 sm:p-4 overflow-hidden">
          <svg viewBox="0 0 560 185" className="w-full h-auto drop-shadow-md select-none">
            {/* Definitions for Gradients and Markers */}
            <defs>
              <linearGradient id="gateAGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#00D084" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#00D084" stopOpacity="0.1" />
              </linearGradient>
              <linearGradient id="gateBGlow" x1="100%" y1="0%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.1" />
              </linearGradient>
              <filter id="laserGlow">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Field Turf Boundary */}
            <rect x="16" y="10" width="528" height="165" rx="12" fill={isDark ? "#0b1120" : "#f8fafc"} stroke={isDark ? "#1e293b" : "#cbd5e1"} strokeWidth="1" />

            {/* Field Track Surface grid lines */}
            <line x1="92" y1="20" x2="452" y2="20" stroke={isDark ? "#334155" : "#cbd5e1"} strokeWidth="1" strokeDasharray="4 4" opacity="0.6" />
            <line x1="92" y1="168" x2="452" y2="168" stroke={isDark ? "#334155" : "#cbd5e1"} strokeWidth="1" strokeDasharray="4 4" opacity="0.6" />
            <text x="272" y="16" fill={isDark ? "#64748b" : "#475569"} fontSize="10" fontWeight="bold" textAnchor="middle" letterSpacing="2">
              ◄─────── 10 METERS SPRINT ZONE ───────►
            </text>

            {/* Gate A: Start / Finish Line (0m) */}
            <rect x="80" y="24" width="24" height="140" fill="url(#gateAGlow)" rx="4" opacity="0.15" />
            <line x1="92" y1="24" x2="92" y2="164" stroke="#00D084" strokeWidth="3" filter="url(#laserGlow)" />
            <circle cx="92" cy="24" r="5" fill="#00D084" />
            <circle cx="92" cy="164" r="5" fill="#00D084" />
            
            {/* Gate A Vertical Title (Well clear on outer left margin at x=24) */}
            <text x="24" y="94" fill="#00D084" fontSize="9.5" fontWeight="900" textAnchor="middle" transform="rotate(-90 24 94)" letterSpacing="1.5">
              0m START / FINISH
            </text>

            {/* Sponge / Block Drop Box at Start line */}
            <g>
              <rect x="38" y="52" width="44" height="13" rx="3" fill={isDark ? "#1e293b" : "#f1f5f9"} stroke="#f59e0b" strokeWidth="0.8" opacity="0.95" />
              <text x="60" y="61.5" fill="#f59e0b" fontSize="7" fontWeight="bold" textAnchor="middle" letterSpacing="0.5">DROP ZONE</text>
              <rect x="52" y="69" width="16" height="28" fill={isDark ? "#1e293b" : "#f1f5f9"} stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3 2" rx="3" />
              {splitsCount >= 2 && (
                <rect x="55" y="76" width="10" height="14" fill="#f59e0b" rx="2" opacity="0.9" />
              )}
            </g>

            {/* Gate B: Turnaround Line (10m) */}
            <rect x="440" y="24" width="24" height="140" fill="url(#gateBGlow)" rx="4" opacity="0.15" />
            <line x1="452" y1="24" x2="452" y2="164" stroke="#38bdf8" strokeWidth="3" filter="url(#laserGlow)" />
            <circle cx="452" cy="24" r="5" fill="#38bdf8" />
            <circle cx="452" cy="164" r="5" fill="#38bdf8" />

            {/* Sponge / Block Pickup Boxes at 10m line */}
            <g>
              {/* BLOCK 1 */}
              <rect x="459" y="22" width="38" height="13" rx="3" fill={isDark ? "#1e293b" : "#f1f5f9"} stroke="#f59e0b" strokeWidth="0.8" opacity="0.95" />
              <text x="478" y="31.5" fill="#f59e0b" fontSize="7" fontWeight="bold" textAnchor="middle">BLOCK 1</text>
              <rect 
                x="471" 
                y="38" 
                width="14" 
                height="20" 
                fill={splitsCount >= 1 ? (isDark ? '#1e293b' : '#e2e8f0') : '#f59e0b'} 
                stroke={splitsCount >= 1 ? '#f59e0b' : undefined} 
                strokeDasharray={splitsCount >= 1 ? '2 2' : undefined} 
                rx="2.5" 
                opacity="0.9" 
              />

              {/* BLOCK 2 */}
              <rect x="459" y="88" width="38" height="13" rx="3" fill={isDark ? "#1e293b" : "#f1f5f9"} stroke="#f59e0b" strokeWidth="0.8" opacity="0.95" />
              <text x="478" y="97.5" fill="#f59e0b" fontSize="7" fontWeight="bold" textAnchor="middle">BLOCK 2</text>
              <rect 
                x="471" 
                y="104" 
                width="14" 
                height="20" 
                fill={splitsCount >= 3 ? (isDark ? '#1e293b' : '#e2e8f0') : '#f59e0b'} 
                stroke={splitsCount >= 3 ? '#f59e0b' : undefined} 
                strokeDasharray={splitsCount >= 3 ? '2 2' : undefined} 
                rx="2.5" 
                opacity="0.9" 
              />
            </g>

            {/* Gate B Vertical Title */}
            <text x="532" y="94" fill={isDark ? "#38bdf8" : "#0284c7"} fontSize="9.5" fontWeight="900" textAnchor="middle" transform="rotate(90 532 94)" letterSpacing="1.5">
              10m TURN LINE
            </text>

            {/* 4 Shuttle Running Lanes */}
            {shuttleLanes.map((lane) => {
              const isPast = splitsCount >= lane.leg;
              const isCurrent = isRunning && currentLeg === lane.leg;
              const split = liveSplits[lane.leg - 1];

              let strokeColor = isDark ? "#334155" : "#cbd5e1";
              let strokeWidth = 2;
              let isDashed = true;

              if (isPast) {
                strokeColor = "#00D084";
                strokeWidth = 3;
                isDashed = false;
              } else if (isCurrent) {
                strokeColor = "#38bdf8";
                strokeWidth = 3.5;
                isDashed = false;
              }

              return (
                <g key={lane.leg}>
                  {/* Track line */}
                  <line 
                    x1={lane.startX} 
                    y1={lane.y} 
                    x2={lane.endX} 
                    y2={lane.y} 
                    stroke={strokeColor} 
                    strokeWidth={strokeWidth}
                    strokeDasharray={isDashed ? "5 5" : undefined}
                    opacity={isPast ? 1 : isCurrent ? 1 : 0.4}
                  />

                  {/* Direction Arrow Head */}
                  {lane.dir === "right" ? (
                    <polygon 
                      points={`${lane.endX - 10},${lane.y - 4} ${lane.endX},${lane.y} ${lane.endX - 10},${lane.y + 4}`} 
                      fill={strokeColor} 
                      opacity={isPast || isCurrent ? 1 : 0.4}
                    />
                  ) : (
                    <polygon 
                      points={`${lane.endX + 10},${lane.y - 4} ${lane.endX},${lane.y} ${lane.endX + 10},${lane.y + 4}`} 
                      fill={strokeColor} 
                      opacity={isPast || isCurrent ? 1 : 0.4}
                    />
                  )}

                  {/* Virtual Cyber Athlete on Current Active Leg (Reverses direction on turnaround legs!) */}
                  {isCurrent && (
                    <g>
                      <animateMotion 
                        path={lane.dir === "right" ? `M 112 ${lane.y} L 432 ${lane.y}` : `M 432 ${lane.y} L 112 ${lane.y}`} 
                        dur="1.7s" 
                        repeatCount="indefinite" 
                      />
                      <CyberAthleteSVG 
                        x={0} 
                        y={0} 
                        dir={lane.dir === "right" ? 1 : -1} 
                        scale={0.42} 
                        variant={lane.dir === "right" ? "live" : "amber"} 
                        isMoving={true} 
                        strideDuration={0.24} 
                        lean={lane.dir === "right" ? 22 : -22} 
                        label={`Leg ${lane.leg}`}
                      />
                    </g>
                  )}

                  {/* Leg Number Label */}
                  <circle cx={lane.dir === "right" ? 110 : 434} cy={lane.y} r="8" fill={isPast ? "#00D084" : isCurrent ? "#38bdf8" : isDark ? "#1e293b" : "#e2e8f0"} />
                  <text x={lane.dir === "right" ? 110 : 434} y={lane.y + 3} fill={isPast || isCurrent ? "#000" : isDark ? "#94a3b8" : "#64748b"} fontSize="9" fontWeight="bold" textAnchor="middle">
                    {lane.leg}
                  </text>

                  {/* Completed Split Badge at Turn Endpoint */}
                  {isPast && split && (
                    <g transform={`translate(${lane.dir === "right" ? 390 : 140}, ${lane.y - 12})`}>
                      <rect x="0" y="0" width="54" height="15" rx="4" fill={isDark ? "#0f172a" : "#ffffff"} stroke="#00D084" strokeWidth="1" />
                      <text x="27" y="11" fill="#00D084" fontSize="9" fontWeight="bold" fontMono="true" textAnchor="middle">
                        {parseFloat(split.time).toFixed(2)}s
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Idle or Finished Virtual Athlete Position */}
            {!isRunning && (
              isFinished ? (
                <CyberAthleteSVG 
                  x={112} 
                  y={142} 
                  dir={-1} 
                  scale={0.42} 
                  variant="live" 
                  isMoving={false} 
                  label="FINISH" 
                />
              ) : (
                <CyberAthleteSVG 
                  x={112} 
                  y={46} 
                  dir={1} 
                  scale={0.42} 
                  variant="live" 
                  isMoving={false} 
                  label="READY" 
                />
              )
            )}
          </svg>
        </div>
      )}

      {/* Pro Agility (5-10-5) Radar Graphic */}
      {testMode === 'pro_agility' && (
        <div className="relative w-full bg-slate-50 dark:bg-slate-950/80 rounded-2xl border border-gray-200 dark:border-slate-800 p-2 sm:p-4 overflow-hidden">
          <svg viewBox="0 0 560 185" className="w-full h-auto drop-shadow-md select-none">
            <defs>
              <linearGradient id="proCenterBeam" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#00D084" stopOpacity="0.9" />
                <stop offset="50%" stopColor="#00D084" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#00D084" stopOpacity="0.9" />
              </linearGradient>
            </defs>

            {/* Field boundary turf styling */}
            <rect x="20" y="15" width="520" height="155" rx="12" fill={isDark ? "#0b1120" : "#f8fafc"} stroke={isDark ? "#1e293b" : "#cbd5e1"} strokeWidth="1" />
            
            {/* Left Line (-5yd) */}
            <line x1="85" y1="20" x2="85" y2="165" stroke={isDark ? "#38bdf8" : "#0284c7"} strokeWidth="2.5" strokeDasharray="3 3" opacity="0.8" />
            <rect x="65" y="24" width="40" height="16" rx="4" fill={isDark ? "#0f172a" : "#ffffff"} stroke={isDark ? "#38bdf8" : "#0284c7"} strokeWidth="1" />
            <text x="85" y="35" fill={isDark ? "#38bdf8" : "#0284c7"} fontSize="8" fontWeight="bold" textAnchor="middle">-5 YD LEFT</text>

            {/* Center Beam (0yd / Gate A Laser) */}
            <line x1="280" y1="20" x2="280" y2="165" stroke="url(#proCenterBeam)" strokeWidth="3" filter="url(#laserGlow)" />
            <rect x="250" y="24" width="60" height="16" rx="4" fill={isDark ? "#022c22" : "#ecfdf5"} stroke="#00D084" strokeWidth="1" />
            <text x="280" y="35" fill="#00D084" fontSize="8" fontWeight="bold" textAnchor="middle">CENTER GATE A</text>

            {/* Right Line (+5yd) */}
            <line x1="475" y1="20" x2="475" y2="165" stroke="#f59e0b" strokeWidth="2.5" strokeDasharray="3 3" opacity="0.8" />
            <rect x="455" y="24" width="40" height="16" rx="4" fill={isDark ? "#0f172a" : "#ffffff"} stroke="#f59e0b" strokeWidth="1" />
            <text x="475" y="35" fill="#f59e0b" fontSize="8" fontWeight="bold" textAnchor="middle">+5 YD RIGHT</text>

            {/* Sector 1: Center -> Right (y=62) */}
            {(() => {
              const isPast = splitsCount >= 1;
              const isCur = isRunning && currentLeg === 1;
              const split = liveSplits[0];
              const col = isPast ? '#00D084' : isCur ? '#38bdf8' : (isDark ? '#334155' : '#cbd5e1');
              return (
                <g>
                  <line x1="280" y1="62" x2="475" y2="62" stroke={col} strokeWidth={isPast || isCur ? 3 : 2} strokeDasharray={isPast || isCur ? undefined : '5 5'} />
                  <polygon points="465,58 475,62 465,66" fill={col} />
                  <circle cx="280" cy="62" r="7" fill={col} />
                  <text x="280" y="65" fill="#000" fontSize="8" fontWeight="bold" textAnchor="middle">1</text>
                  <text x="375" y="55" fill={col} fontSize="9" fontWeight="bold" textAnchor="middle">Sector 1: 5yd Lateral Burst</text>
                  
                  {/* Cyber Athlete: Sector 1 Bursting to Right Line */}
                  {isCur && (
                    <g>
                      <animateMotion path="M 280 62 L 470 62" dur="1.2s" repeatCount="indefinite" />
                      <CyberAthleteSVG 
                        x={0} 
                        y={0} 
                        dir={1} 
                        scale={0.42} 
                        variant="live" 
                        isMoving={true} 
                        strideDuration={0.24} 
                        lean={24} 
                        label="Burst 5yd →"
                      />
                    </g>
                  )}
                  {isPast && split && (
                    <g transform="translate(445, 70)">
                      <rect x="0" y="0" width="50" height="15" rx="4" fill={isDark ? "#0f172a" : "#ffffff"} stroke="#00D084" strokeWidth="1" />
                      <text x="25" y="11" fill="#00D084" fontSize="9" fontWeight="bold" fontMono="true" textAnchor="middle">
                        {parseFloat(split.time).toFixed(2)}s
                      </text>
                    </g>
                  )}
                </g>
              );
            })()}

            {/* Sector 2: Right -> Left (y=105) - 180° turnaround & 10-yard crossover sprint */}
            {(() => {
              const isPast = splitsCount >= 2;
              const isCur = isRunning && currentLeg === 2;
              const split = liveSplits[1];
              const col = isPast ? '#00D084' : isCur ? '#38bdf8' : (isDark ? '#334155' : '#cbd5e1');
              return (
                <g>
                  <line x1="475" y1="105" x2="85" y2="105" stroke={col} strokeWidth={isPast || isCur ? 3 : 2} strokeDasharray={isPast || isCur ? undefined : '5 5'} />
                  <polygon points="95,101 85,105 95,109" fill={col} />
                  <circle cx="475" cy="105" r="7" fill={col} />
                  <text x="475" y="108" fill="#000" fontSize="8" fontWeight="bold" textAnchor="middle">2</text>
                  <text x="280" y="98" fill={col} fontSize="9" fontWeight="bold" textAnchor="middle">Sector 2: 10yd Crossover Sprint</text>
                  
                  {/* Cyber Athlete: Sector 2 Turned Around (dir: -1) Sprinting Left to Far Line */}
                  {isCur && (
                    <g>
                      <animateMotion path="M 470 105 L 90 105" dur="1.8s" repeatCount="indefinite" />
                      <CyberAthleteSVG 
                        x={0} 
                        y={0} 
                        dir={-1} 
                        scale={0.42} 
                        variant="amber" 
                        isMoving={true} 
                        strideDuration={0.22} 
                        lean={-24} 
                        label="← 10yd Sprint"
                      />
                    </g>
                  )}
                  {isPast && split && (
                    <g transform="translate(65, 113)">
                      <rect x="0" y="0" width="50" height="15" rx="4" fill={isDark ? "#0f172a" : "#ffffff"} stroke="#00D084" strokeWidth="1" />
                      <text x="25" y="11" fill="#00D084" fontSize="9" fontWeight="bold" fontMono="true" textAnchor="middle">
                        {parseFloat(split.time).toFixed(2)}s
                      </text>
                    </g>
                  )}
                </g>
              );
            })()}

            {/* Sector 3: Left -> Center (y=145) - 180° turnaround & 5-yard sprint through Gate A finish beam */}
            {(() => {
              const isPast = splitsCount >= 3;
              const isCur = isRunning && currentLeg === 3;
              const split = liveSplits[2];
              const col = isPast ? '#00D084' : isCur ? '#38bdf8' : (isDark ? '#334155' : '#cbd5e1');
              return (
                <g>
                  <line x1="85" y1="145" x2="280" y2="145" stroke={col} strokeWidth={isPast || isCur ? 3 : 2} strokeDasharray={isPast || isCur ? undefined : '5 5'} />
                  <polygon points="270,141 280,145 270,149" fill={col} />
                  <circle cx="85" cy="145" r="7" fill={col} />
                  <text x="85" y="148" fill="#000" fontSize="8" fontWeight="bold" textAnchor="middle">3</text>
                  <text x="180" y="138" fill={col} fontSize="9" fontWeight="bold" textAnchor="middle">Sector 3: 5yd Gate Finish</text>
                  
                  {/* Cyber Athlete: Sector 3 Turned Right (dir: 1) Sprinting across Center Gate Finish */}
                  {isCur && (
                    <g>
                      <animateMotion path="M 90 145 L 280 145" dur="1.0s" repeatCount="indefinite" />
                      <CyberAthleteSVG 
                        x={0} 
                        y={0} 
                        dir={1} 
                        scale={0.42} 
                        variant="live" 
                        isMoving={true} 
                        strideDuration={0.20} 
                        lean={26} 
                        label="Finish 5yd →"
                      />
                    </g>
                  )}
                  {isPast && split && (
                    <g transform="translate(255, 125)">
                      <rect x="0" y="0" width="50" height="15" rx="4" fill={isDark ? "#0f172a" : "#ffffff"} stroke="#00D084" strokeWidth="1" />
                      <text x="25" y="11" fill="#00D084" fontSize="9" fontWeight="bold" fontMono="true" textAnchor="middle">
                        {parseFloat(split.time).toFixed(2)}s
                      </text>
                    </g>
                  )}
                </g>
              );
            })()}

            {/* Idle or Finished Virtual Athlete in Pro Agility */}
            {!isRunning && (
              isFinished ? (
                <CyberAthleteSVG 
                  x={280} 
                  y={145} 
                  dir={1} 
                  scale={0.42} 
                  variant="live" 
                  isMoving={false} 
                  label="FINISHED" 
                />
              ) : (
                <CyberAthleteSVG 
                  x={280} 
                  y={62} 
                  dir={1} 
                  scale={0.42} 
                  variant="live" 
                  isMoving={false} 
                  label="READY (3-PT)" 
                />
              )
            )}
          </svg>
        </div>
      )}

      {/* 3-Cone L-Drill Radar Graphic */}
      {testMode === 'l_drill' && (
        <div className="relative w-full bg-slate-50 dark:bg-slate-950/80 rounded-2xl border border-gray-200 dark:border-slate-800 p-2 sm:p-4 overflow-hidden">
          <svg viewBox="0 0 560 185" className="w-full h-auto drop-shadow-md select-none">
            {/* Field boundary turf */}
            <rect x="20" y="15" width="520" height="155" rx="12" fill={isDark ? "#0b1120" : "#f8fafc"} stroke={isDark ? "#1e293b" : "#cbd5e1"} strokeWidth="1" />

            {/* Cone 1 (Start/Finish Gate) */}
            <circle cx="100" cy="135" r="10" fill="#f59e0b" stroke="#78350f" strokeWidth="2" />
            <text x="100" y="139" fill="#000" fontSize="9" fontWeight="bold" textAnchor="middle">C1</text>
            <text x="100" y="158" fill="#f59e0b" fontSize="8" fontWeight="bold" textAnchor="middle">CONE 1 (GATE)</text>

            {/* Cone 2 (Turn & Cut) */}
            <circle cx="300" cy="135" r="10" fill="#f59e0b" stroke="#78350f" strokeWidth="2" />
            <text x="300" y="139" fill="#000" fontSize="9" fontWeight="bold" textAnchor="middle">C2</text>
            <text x="300" y="158" fill="#f59e0b" fontSize="8" fontWeight="bold" textAnchor="middle">CONE 2 (5 YD)</text>

            {/* Cone 3 (Corner Arc) */}
            <circle cx="300" cy="45" r="10" fill="#f59e0b" stroke="#78350f" strokeWidth="2" />
            <text x="300" y="49" fill="#000" fontSize="9" fontWeight="bold" textAnchor="middle">C3</text>
            <text x="300" y="28" fill="#f59e0b" fontSize="8" fontWeight="bold" textAnchor="middle">CONE 3 (5 YD)</text>

            {/* Sector 1: Cone 1 -> Cone 2 Touch -> Return to Cone 1 */}
            {(() => {
              const isPast = splitsCount >= 1;
              const isCur = isRunning && currentLeg === 1;
              const col = isPast ? '#00D084' : isCur ? '#38bdf8' : (isDark ? '#334155' : '#cbd5e1');
              return (
                <g>
                  <path d="M 115 125 L 285 125 Q 295 125 295 135 Q 295 145 285 145 L 115 145" fill="none" stroke={col} strokeWidth={isPast || isCur ? 2.5 : 1.5} strokeDasharray={isPast || isCur ? undefined : '4 4'} />
                  <polygon points="125,141 115,145 125,149" fill={col} />
                  <text x="200" y="118" fill={col} fontSize="8" fontWeight="bold" textAnchor="middle">Sector 1: 5yd Out & Back Touch</text>
                  
                  {/* Cyber Athlete: Sector 1 Out & Back Touch */}
                  {isCur && (
                    <g>
                      <animateMotion 
                        path="M 120 125 L 285 125 Q 295 125 295 135 Q 295 145 285 145 L 120 145" 
                        dur="2.0s" 
                        repeatCount="indefinite" 
                      />
                      <CyberAthleteSVG 
                        x={0} 
                        y={0} 
                        dir={1} 
                        scale={0.38} 
                        variant="live" 
                        isMoving={true} 
                        strideDuration={0.24} 
                        lean={18} 
                        label="5yd Touch & Back"
                      />
                    </g>
                  )}
                </g>
              );
            })()}

            {/* Sector 2: Cone 1 -> Cone 2 -> Loop around Cone 3 */}
            {(() => {
              const isPast = splitsCount >= 2;
              const isCur = isRunning && currentLeg === 2;
              const col = isPast ? '#00D084' : isCur ? '#38bdf8' : (isDark ? '#334155' : '#cbd5e1');
              return (
                <g>
                  <path d="M 115 110 L 275 110 Q 285 110 285 95 L 285 55 Q 285 30 300 30 Q 320 30 320 55" fill="none" stroke={col} strokeWidth={isPast || isCur ? 2.5 : 1.5} strokeDasharray={isPast || isCur ? undefined : '4 4'} />
                  <text x="345" y="45" fill={col} fontSize="8" fontWeight="bold">Sector 2: Loop Cone 3</text>
                  
                  {/* Cyber Athlete: Sector 2 Looping around Cone 3 */}
                  {isCur && (
                    <g>
                      <animateMotion 
                        path="M 120 110 L 275 110 Q 285 110 285 95 L 285 55 Q 285 30 300 30 Q 320 30 320 55" 
                        dur="2.2s" 
                        repeatCount="indefinite" 
                      />
                      <CyberAthleteSVG 
                        x={0} 
                        y={0} 
                        dir={1} 
                        scale={0.38} 
                        variant="amber" 
                        isMoving={true} 
                        strideDuration={0.25} 
                        lean={18} 
                        label="Loop C3"
                      />
                    </g>
                  )}
                </g>
              );
            })()}

            {/* Sector 3: Figure-8 weave around Cone 3 -> 90° Cut Cone 2 -> Gate 1 Finish */}
            {(() => {
              const isPast = splitsCount >= 3;
              const isCur = isRunning && currentLeg === 3;
              const col = isPast ? '#00D084' : isCur ? '#38bdf8' : (isDark ? '#334155' : '#cbd5e1');
              return (
                <g>
                  <path d="M 320 55 Q 320 70 300 70 Q 280 70 280 90 L 280 120 Q 280 135 260 135 L 115 135" fill="none" stroke={col} strokeWidth={isPast || isCur ? 3 : 1.5} strokeDasharray={isPast || isCur ? undefined : '4 4'} />
                  <polygon points="125,131 115,135 125,139" fill={col} />
                  <text x="200" y="80" fill={col} fontSize="8" fontWeight="bold" textAnchor="middle">Sector 3: 90° Cut & Gate Finish</text>
                  
                  {/* Cyber Athlete: Sector 3 Cutting 90° around Cone 2 and finishing */}
                  {isCur && (
                    <g>
                      <animateMotion 
                        path="M 320 55 Q 320 70 300 70 Q 280 70 280 90 L 280 120 Q 280 135 260 135 L 115 135" 
                        dur="1.8s" 
                        repeatCount="indefinite" 
                      />
                      <CyberAthleteSVG 
                        x={0} 
                        y={0} 
                        dir={-1} 
                        scale={0.38} 
                        variant="live" 
                        isMoving={true} 
                        strideDuration={0.22} 
                        lean={-20} 
                        label="Cut & Finish"
                      />
                    </g>
                  )}
                </g>
              );
            })()}

            {/* Idle or Finished Virtual Athlete in 3-Cone L-Drill */}
            {!isRunning && (
              isFinished ? (
                <CyberAthleteSVG 
                  x={115} 
                  y={135} 
                  dir={-1} 
                  scale={0.38} 
                  variant="live" 
                  isMoving={false} 
                  label="FINISHED" 
                />
              ) : (
                <CyberAthleteSVG 
                  x={100} 
                  y={135} 
                  dir={1} 
                  scale={0.38} 
                  variant="live" 
                  isMoving={false} 
                  label="READY" 
                />
              )
            )}
          </svg>
        </div>
      )}

      {/* Agility Drill Sectors Status Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {(testMode === 'shuttle' ? [1, 2, 3, 4] : [1, 2, 3]).map((leg) => {
          const splitData = liveSplits[leg - 1];
          const isDone = splitData !== undefined;
          const isCur = isRunning && currentLeg === leg;

          let legTitle = `Leg ${leg}`;
          let subLabel = "10m";
          if (testMode === 'shuttle') {
            legTitle = leg === 1 ? 'Turn 1 (10m)' : leg === 2 ? 'Turn 2 (Start)' : leg === 3 ? 'Turn 3 (10m)' : 'Finish (0m)';
            subLabel = leg === 1 ? 'Pick 1' : leg === 2 ? 'Drop 1' : leg === 3 ? 'Pick 2' : 'Sprint Thru';
          } else if (testMode === 'pro_agility') {
            legTitle = leg === 1 ? 'Turn 1 (5yd)' : leg === 2 ? 'Turn 2 (10yd)' : 'Finish (5yd)';
            subLabel = leg === 1 ? 'Right Plant' : leg === 2 ? 'Left Plant' : 'Center Beam';
          } else if (testMode === 'l_drill') {
            legTitle = leg === 1 ? 'Turn 1 (10yd)' : leg === 2 ? 'Turn 2 (Cone 3)' : 'Finish (Cut)';
            subLabel = leg === 1 ? 'Touch Line' : leg === 2 ? 'Outer Loop' : '90° Cut Gate';
          }

          return (
            <div 
              key={leg} 
              className={`rounded-2xl p-3 border transition-all duration-300 flex flex-col justify-between ${
                isDone 
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-400 dark:border-[#00D084] shadow-sm' 
                  : isCur 
                  ? 'bg-sky-50 dark:bg-sky-500/10 border-sky-400 animate-pulse' 
                  : 'bg-slate-50 dark:bg-slate-950/40 border-gray-200 dark:border-slate-800'
              }`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isDone ? 'text-emerald-600 dark:text-emerald-400' : isCur ? 'text-sky-600 dark:text-sky-300' : 'text-gray-500 dark:text-slate-500'}`}>
                  {legTitle}
                </span>
                <span className="text-[9px] font-mono text-gray-400 dark:text-slate-500">{subLabel}</span>
              </div>

              <div className="flex items-baseline justify-between mt-1">
                <div className={`text-base sm:text-lg font-mono font-bold ${isDone ? 'text-gray-900 dark:text-white' : isCur ? 'text-sky-600 dark:text-sky-300' : 'text-gray-400 dark:text-slate-600'}`}>
                  {isDone ? parseFloat(splitData.time).toFixed(2) + 's' : isCur ? 'RUNNING' : '--.--s'}
                </div>
                {isDone && splitData.splitTime && (
                  <div className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    +{parseFloat(splitData.splitTime).toFixed(2)}s
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Biomechanical Turn Analytics & Symmetry Scorecard (Shown on completion or historical inspect) */}
      {metrics && showDeepAnalytics && (
        <div className="bg-slate-50 dark:bg-slate-950/70 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col gap-4 animate-in fade-in duration-300 shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-800 pb-2">
            <div className="text-xs font-bold text-gray-700 dark:text-slate-300 tracking-wider uppercase flex items-center gap-2">
              <Activity size={15} className="text-[#00D084]" />
              Biomechanical Turn & Agility Assessment
            </div>
            <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
              Total: {metrics.totalTime}s
            </div>
          </div>

          {/* Core Agility Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-3 rounded-xl flex flex-col justify-between shadow-sm">
              <div className="text-[10px] text-gray-500 dark:text-slate-400 font-bold uppercase">COD DEFICIT</div>
              <div className="text-lg font-mono font-bold text-amber-500 dark:text-yellow-400 mt-1">+{metrics.codDeficit}s</div>
              <div className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">Vs Pure Linear 40m</div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-3 rounded-xl flex flex-col justify-between shadow-sm">
              <div className="text-[10px] text-gray-500 dark:text-slate-400 font-bold uppercase">TURN OVERHEAD</div>
              <div className="text-lg font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-1">+{metrics.turnOverhead}s</div>
              <div className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">Avg Brake Loss / Turn</div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-3 rounded-xl flex flex-col justify-between shadow-sm">
              <div className="text-[10px] text-gray-500 dark:text-slate-400 font-bold uppercase">LATERAL SYMMETRY</div>
              <div className={`text-lg font-mono font-bold mt-1 ${metrics.lateralBalanceColor}`}>{metrics.symmetryRatio}%</div>
              <div className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">{metrics.lateralBalanceRating}</div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-3 rounded-xl flex flex-col justify-between shadow-sm">
              <div className="text-[10px] text-gray-500 dark:text-slate-400 font-bold uppercase">FATIGUE DECAY</div>
              <div className="text-lg font-mono font-bold text-sky-600 dark:text-sky-400 mt-1">{parseFloat(metrics.fatigueDecayPct) > 0 ? `+${metrics.fatigueDecayPct}%` : `${metrics.fatigueDecayPct}%`}</div>
              <div className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">Leg 1 vs Leg 3 Drop-off</div>
            </div>
          </div>

          {/* Turn-by-Turn Deceleration vs Re-Acceleration Table */}
          {metrics.turn1 && (
            <div className="bg-white dark:bg-slate-900/90 border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden mt-1 shadow-sm">
              <div className="px-3 py-2 bg-gray-100 dark:bg-slate-800/50 border-b border-gray-200 dark:border-slate-800 text-[11px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider flex justify-between">
                <span>Turn Breakdown</span>
                <span className="text-gray-500 dark:text-slate-400">Decel (Braking) vs Re-Accel (Drive-Out)</span>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-slate-800/60 text-xs font-mono">
                {[metrics.turn1, metrics.turn2, metrics.turn3].filter(Boolean).map((t, idx) => (
                  <div key={idx} className="p-2.5 flex items-center justify-between">
                    <span className="text-gray-800 dark:text-slate-300 font-sans font-medium">{t.name}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-amber-500 dark:text-amber-400 font-bold">Brake: {t.decel}s</span>
                      <span className="text-gray-400 dark:text-slate-600">|</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">Drive: {t.reaccel}s</span>
                      <span className="text-gray-400 dark:text-slate-600">|</span>
                      <span className="text-gray-900 dark:text-white font-bold">Total: {t.total}s</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
