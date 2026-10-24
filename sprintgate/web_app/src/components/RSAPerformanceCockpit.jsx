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

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Zap, Activity, Clock, Timer, RotateCcw, TrendingDown, 
  Award, Flame, ShieldCheck, CheckCircle2, AlertCircle, 
  Play, Volume2, ArrowRight, BarChart3, Share2, Download, 
  ChevronRight, RefreshCw, Sparkles, User, Sliders, Heart
} from 'lucide-react';
import { playLeadInBeep } from '../utils/soundEngine';
import { useBleHeartRate, bleHeartRateService } from '../utils/bleHeartRateService';
import { CyberAthleteSVG } from './VirtualSprinter';

/**
 * RSAPerformanceCockpit
 * Professional Repeated Sprint Ability (RSA) Testing Protocol & Biotelemetry Engine.
 * 
 * Computes:
 * - Best Sprint Time (T_best)
 * - Mean Sprint Time (T_mean)
 * - Total Sprint Time (T_total)
 * - Sprint Decrement Percentage (S_dec% = [T_total / (n * T_best) - 1] * 100)
 * - Fatigue Index (FI% = [T_worst - T_best] / T_best * 100)
 * - Heart Rate Peak (HR_peak) & Inter-Sprint Heart Rate Recovery (HRR = HR_peak - HR_rec)
 * - Automated Inter-Sprint Rest Interval Countdown with Acoustic Cadence
 * - Visual Fatigue Curve & Repetition Bar Graph
 */
export default function RSAPerformanceCockpit({
  activeRunner,
  trackDistance = 30,
  displayTime = "0.00",
  isRunning = false,
  sequenceState = "idle",
  onArmAndStart,
  onReset,
  onOpenBleModal,
  onSaveRsaResult
}) {
  // Configurable RSA Parameters
  const [targetReps, setTargetReps] = useState(6);
  const [restDurationSec, setRestDurationSec] = useState(25);
  const [showConfig, setShowConfig] = useState(false);

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

  // Consume live Bluetooth Heart Rate telemetry
  const { isConnected, bpm, zone, maxHr } = useBleHeartRate();

  // RSA Session State
  const [currentRepIndex, setCurrentRepIndex] = useState(0); // 0 to targetReps - 1
  const [completedSprints, setCompletedSprints] = useState([]); // [{ rep: 1, time: 4.12, speed: 7.28, peakHr: 178, recoveryHr: 152, hrr: 26 }]
  const [restTimeRemaining, setRestTimeRemaining] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const restTimerRef = useRef(null);
  const prevSequenceStateRef = useRef(sequenceState);

  // Repetition Peak Heart Rate tracker
  const repPeakHrRef = useRef(0);

  // Track Peak HR during active sprint
  useEffect(() => {
    if (isRunning || sequenceState === 'running') {
      if (bpm > repPeakHrRef.current) {
        repPeakHrRef.current = bpm;
      }
    }
  }, [isRunning, sequenceState, bpm]);

  // Sound cue triggers during rest countdown
  const beepPlayedRef = useRef({});

  // Detect when a sprint finishes in RSA mode
  useEffect(() => {
    if (prevSequenceStateRef.current === 'running' && sequenceState === 'finished') {
      const finalTime = parseFloat(displayTime);
      if (!isNaN(finalTime) && finalTime > 0.5) {
        handleSprintCompleted(finalTime);
      }
    }
    prevSequenceStateRef.current = sequenceState;
  }, [sequenceState, displayTime]);

  // Handle a completed repetition
  const handleSprintCompleted = (timeSec) => {
    const dist = parseFloat(trackDistance) || 30;
    const speed = (dist / timeSec).toFixed(2);
    const recordedPeakHr = repPeakHrRef.current > 0 ? repPeakHrRef.current : (bpm > 0 ? bpm : null);
    repPeakHrRef.current = 0; // reset for next rep

    const newSprint = {
      rep: currentRepIndex + 1,
      time: timeSec,
      speed: parseFloat(speed),
      peakHr: recordedPeakHr,
      recoveryHr: null,
      hrr: null,
      timestamp: Date.now()
    };

    setCompletedSprints(prev => [...prev, newSprint]);

    const nextIndex = currentRepIndex + 1;
    if (nextIndex < targetReps) {
      // Start recovery interval
      setCurrentRepIndex(nextIndex);
      startRestCountdown(restDurationSec, newSprint.rep);
    } else {
      // All reps finished!
      setIsResting(false);
      setCurrentRepIndex(targetReps);
    }
  };

  // Automated Rest Interval Countdown
  const startRestCountdown = (seconds, finishedRepNumber) => {
    setIsResting(true);
    setRestTimeRemaining(seconds);
    beepPlayedRef.current = {};

    if (restTimerRef.current) clearInterval(restTimerRef.current);

    restTimerRef.current = setInterval(() => {
      setRestTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(restTimerRef.current);
          setIsResting(false);

          // Measure recovery HR at conclusion of rest interval
          const currentBpm = bleHeartRateService.getState().bpm;
          if (currentBpm > 0) {
            setCompletedSprints(prevSprints => {
              return prevSprints.map(s => {
                if (s.rep === finishedRepNumber) {
                  const recHr = currentBpm;
                  const hrrDrop = s.peakHr ? Math.max(0, s.peakHr - recHr) : null;
                  return { ...s, recoveryHr: recHr, hrr: hrrDrop };
                }
                return s;
              });
            });
          }

          // High alert chime: Rest completed! Ready for next rep
          try { playLeadInBeep(880, 0.25, 0.7); } catch (e) {}
          // Auto-trigger next sprint sequence if onArmAndStart provided
          if (onArmAndStart) {
            setTimeout(() => {
              onArmAndStart();
            }, 600);
          }
          return 0;
        }

        const nextVal = prev - 1;
        // Audio cues at 5s, 3s, 2s, 1s
        if ([5, 3, 2, 1].includes(nextVal) && !beepPlayedRef.current[nextVal]) {
          beepPlayedRef.current[nextVal] = true;
          try { playLeadInBeep(520, 0.1, 0.5); } catch (e) {}
        }
        return nextVal;
      });
    }, 1000);
  };

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (restTimerRef.current) clearInterval(restTimerRef.current);
    };
  }, []);

  // Reset entire RSA Protocol
  const handleResetRSA = () => {
    if (restTimerRef.current) clearInterval(restTimerRef.current);
    setIsResting(false);
    setRestTimeRemaining(0);
    setCurrentRepIndex(0);
    setCompletedSprints([]);
    repPeakHrRef.current = 0;
    beepPlayedRef.current = {};
    if (onReset) onReset();
  };

  // Sports Science Calculations
  const rsaMetrics = useMemo(() => {
    if (completedSprints.length === 0) return null;

    const times = completedSprints.map(s => s.time);
    const n = times.length;
    const bestTime = Math.min(...times);
    const worstTime = Math.max(...times);
    const totalTime = times.reduce((acc, t) => acc + t, 0);
    const meanTime = totalTime / n;

    // Sprint Decrement Percentage (S_dec %)
    // Standard formula: [(Total Time / (n * Best Time)) - 1] * 100
    const idealTotal = n * bestTime;
    const sDec = ((totalTime / idealTotal) - 1) * 100;

    // Fatigue Index (FI %) = [(Worst - Best) / Best] * 100
    const fatigueIndex = ((worstTime - bestTime) / bestTime) * 100;

    // Heart Rate Recovery (HRR) Analysis
    const validHrr = completedSprints.map(s => s.hrr).filter(h => h !== null && !isNaN(h));
    const meanHrr = validHrr.length > 0 
      ? Math.round(validHrr.reduce((a, b) => a + b, 0) / validHrr.length) 
      : null;

    const validPeaks = completedSprints.map(s => s.peakHr).filter(h => h !== null && !isNaN(h));
    const seriesPeakHr = validPeaks.length > 0 ? Math.max(...validPeaks) : null;
    const avgPeakHr = validPeaks.length > 0 
      ? Math.round(validPeaks.reduce((a, b) => a + b, 0) / validPeaks.length) 
      : null;

    // Classification based on Bishop & Rampinini sports science thresholds
    let tier = 'Elite Fatigue Resistance';
    let tierDesc = 'Professional Match-Fit • Exceptional recovery';
    let tierBadge = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';

    if (sDec > 8.0) {
      tier = 'High Fatigue Sensitivity';
      tierDesc = 'Anaerobic capacity deficit • Metabolic conditioning recommended';
      tierBadge = 'bg-rose-500/20 text-rose-400 border-rose-500/40';
    } else if (sDec > 5.5) {
      tier = 'Moderate Fatigue Sensitivity';
      tierDesc = 'Standard athletic tolerance • Target active recovery protocols';
      tierBadge = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    } else if (sDec > 3.5) {
      tier = 'Good Fatigue Resistance';
      tierDesc = 'High anaerobic stamina • Solid energy replenishment';
      tierBadge = 'bg-sky-500/20 text-sky-400 border-sky-500/40';
    }

    // Cardiovascular recovery tier
    let cardioTier = 'Pending HR Data';
    if (meanHrr !== null) {
      if (meanHrr >= 25) {
        cardioTier = 'Elite Parasympathetic Reactivation (≥25 bpm)';
      } else if (meanHrr >= 15) {
        cardioTier = 'Solid Aerobic Resynthesis (15-24 bpm)';
      } else {
        cardioTier = 'Delayed Recovery / Autonomic Stress (<15 bpm)';
      }
    }

    return {
      n,
      bestTime: bestTime.toFixed(2),
      worstTime: worstTime.toFixed(2),
      totalTime: totalTime.toFixed(2),
      meanTime: meanTime.toFixed(2),
      sDec: Math.max(0, sDec).toFixed(1),
      fatigueIndex: Math.max(0, fatigueIndex).toFixed(1),
      tier,
      tierDesc,
      tierBadge,
      meanHrr,
      seriesPeakHr,
      avgPeakHr,
      cardioTier
    };
  }, [completedSprints]);

  const isComplete = currentRepIndex >= targetReps && completedSprints.length >= targetReps;

  return (
    <div className="w-full bg-white dark:bg-gradient-to-b dark:from-slate-900 dark:via-slate-900/95 dark:to-slate-950 border border-gray-200 dark:border-slate-800 rounded-3xl p-4 sm:p-6 flex flex-col gap-5 shadow-2xl relative overflow-hidden select-none text-gray-900 dark:text-gray-100 transition-colors duration-300">
      
      {/* Background Ambient Glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 relative z-10 border-b border-gray-200 dark:border-slate-800 pb-3.5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm">
            <Timer size={20} />
          </div>
          <div>
            <div className="text-sm sm:text-base font-black tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
              <span>RSA PROTOCOL COCKPIT</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-bold uppercase">
                {targetReps}x{trackDistance}M • {restDurationSec}s REST
              </span>
            </div>
            <div className="text-xs text-gray-600 dark:text-slate-400 mt-0.5 font-medium">
              Repeated Sprint Ability & Anaerobic Power Decay Assessment
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Heart Rate Telemetry Pill Button */}
          <button
            onClick={onOpenBleModal}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border shadow-sm ${
              isConnected 
                ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/40 hover:bg-rose-500/30' 
                : 'bg-slate-100 dark:bg-slate-800/80 text-gray-700 dark:text-slate-400 hover:text-black dark:hover:text-white border-gray-300 dark:border-slate-700/80'
            }`}
            title="Open Bluetooth Heart Rate & Sensor Manager"
          >
            <Heart size={14} className={isConnected && bpm > 0 ? 'text-rose-500 animate-pulse fill-rose-500' : 'text-gray-400 dark:text-slate-400'} />
            <span className="font-mono">{isConnected && bpm > 0 ? `${bpm} BPM` : 'BLE HRM'}</span>
            {isConnected && zone?.zone > 0 && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/10 dark:bg-black/40 text-rose-700 dark:text-rose-300 font-bold">
                Z{zone.zone}
              </span>
            )}
          </button>

          <button
            onClick={() => setShowConfig(!showConfig)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
              showConfig 
                ? 'bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-white border-gray-300 dark:border-slate-600' 
                : 'bg-slate-100 dark:bg-slate-800/80 text-gray-700 dark:text-slate-400 hover:text-black dark:hover:text-white border-gray-300 dark:border-slate-700/80'
            }`}
          >
            <Sliders size={13} />
            <span>Config</span>
          </button>

          <button
            onClick={handleResetRSA}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-800 dark:text-slate-300 hover:text-black dark:hover:text-white border border-gray-300 dark:border-slate-700 transition flex items-center gap-1.5"
            title="Reset RSA Session"
          >
            <RotateCcw size={13} />
            <span>Reset Series</span>
          </button>
        </div>
      </div>

      {/* Config Drawer (Expandable) */}
      {showConfig && (
        <div className="bg-slate-50 dark:bg-slate-950/80 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10 shadow-sm">
          <div>
            <label className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
              REPETITION COUNT (SPRINTS)
            </label>
            <div className="flex gap-2">
              {[4, 5, 6, 8].map(cnt => (
                <button
                  key={cnt}
                  onClick={() => { setTargetReps(cnt); handleResetRSA(); }}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-mono font-bold transition border ${
                    targetReps === cnt 
                      ? 'bg-emerald-500 text-black border-emerald-400' 
                      : 'bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700'
                  }`}
                >
                  {cnt} Reps
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
              RECOVERY DURATION BETWEEN SPRINTS
            </label>
            <div className="flex gap-2">
              {[15, 20, 25, 30].map(sec => (
                <button
                  key={sec}
                  onClick={() => setRestDurationSec(sec)}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-mono font-bold transition border ${
                    restDurationSec === sec 
                      ? 'bg-emerald-500 text-black border-emerald-400' 
                      : 'bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700'
                  }`}
                >
                  {sec}s Rest
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main 4-Column Repetition, Rest & Biotelemetry Status Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
        
        {/* Repetition Status / Progress Card */}
        <div className="bg-slate-50 dark:bg-slate-950/70 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between items-center text-center relative overflow-hidden shadow-sm">
          <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500 dark:text-slate-400">
            CURRENT REPETITION
          </div>

          <div className="my-2 flex flex-col items-center">
            <span className="text-4xl sm:text-5xl font-black font-mono text-gray-900 dark:text-white">
              {Math.min(targetReps, currentRepIndex + 1)}
              <span className="text-2xl text-gray-400 dark:text-slate-500 ml-1">/ {targetReps}</span>
            </span>

            <div className="mt-2 text-xs font-bold flex items-center gap-1.5">
              {isComplete ? (
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 size={13} /> Series Complete!
                </span>
              ) : isResting ? (
                <span className="text-amber-600 dark:text-amber-400 animate-pulse flex items-center gap-1">
                  <Clock size={13} /> Active Recovery Rest
                </span>
              ) : isRunning ? (
                <span className="text-emerald-600 dark:text-emerald-400 animate-pulse flex items-center gap-1">
                  <Zap size={13} /> Sprint in Progress
                </span>
              ) : (
                <span className="text-gray-500 dark:text-slate-400">Ready for Launch</span>
              )}
            </div>
          </div>

          {/* Quick Rep Dots Bar */}
          <div className="flex gap-1.5 w-full justify-center">
            {Array.from({ length: targetReps }).map((_, idx) => {
              const isPast = completedSprints.length > idx;
              const isCurrent = currentRepIndex === idx && !isComplete;
              return (
                <div
                  key={idx}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    isPast 
                      ? 'w-5 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' 
                      : isCurrent 
                      ? 'w-7 bg-amber-400 animate-pulse' 
                      : 'w-3 bg-gray-200 dark:bg-slate-800'
                  }`}
                  title={`Rep ${idx + 1}`}
                />
              );
            })}
          </div>
        </div>

        {/* Live Recovery Countdown Clock */}
        <div className={`border rounded-2xl p-4 flex flex-col justify-between items-center text-center relative transition-all duration-300 ${
          isResting 
            ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.15)]' 
            : 'bg-slate-50 dark:bg-slate-950/70 border border-gray-200 dark:border-slate-800 shadow-sm'
        }`}>
          <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500 dark:text-slate-400 flex items-center gap-1.5">
            <Clock size={12} className={isResting ? 'text-amber-500 animate-spin' : 'text-gray-400 dark:text-slate-400'} />
            <span>RECOVERY COUNTDOWN</span>
          </div>

          <div className="my-1 flex flex-col items-center">
            <div className={`text-4xl sm:text-5xl font-black font-mono tracking-tight tabular-nums ${
              isResting ? 'text-amber-600 dark:text-amber-300 drop-shadow-[0_0_20px_rgba(251,191,36,0.4)]' : 'text-gray-400 dark:text-slate-600'
            }`}>
              {isResting ? restTimeRemaining : '--'}
              <span className="text-lg sm:text-xl text-gray-400 dark:text-slate-500 ml-1">s</span>
            </div>
            
            <div className="text-[10px] text-gray-500 dark:text-slate-400 font-medium mt-1 truncate max-w-full">
              {isResting 
                ? 'Heart rate recovery window active...' 
                : isComplete 
                ? 'All recovery stages finished' 
                : 'Triggers automatically upon finish beam'}
            </div>
          </div>

          {/* Skip Rest Button */}
          {isResting ? (
            <button
              onClick={() => {
                if (restTimerRef.current) clearInterval(restTimerRef.current);
                setIsResting(false);
                setRestTimeRemaining(0);
                if (onArmAndStart) onArmAndStart();
              }}
              className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-700 dark:text-amber-300 text-[11px] font-bold rounded-xl transition"
            >
              Skip Rest → Launch Rep {currentRepIndex + 1}
            </button>
          ) : (
            <div className="h-6"></div>
          )}
        </div>

        {/* Biotelemetry & Heart Rate Recovery (HRR) Card */}
        <div 
          onClick={onOpenBleModal}
          className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-950/70 dark:hover:bg-slate-950/90 border border-gray-200 dark:border-slate-800 hover:border-rose-400 dark:hover:border-rose-500/40 rounded-2xl p-4 flex flex-col justify-between cursor-pointer transition relative group shadow-sm"
        >
          <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5 text-rose-500 dark:text-rose-400">
              <Heart size={12} className={isConnected && bpm > 0 ? "fill-rose-500 animate-pulse" : ""} />
              <span>BIOTELEMETRY (HR)</span>
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 group-hover:border-rose-400 text-gray-700 dark:text-slate-300 font-bold">
              {isConnected ? 'Live' : 'Offline'}
            </span>
          </div>

          <div className="my-1.5 flex items-center justify-between">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl sm:text-4xl font-black font-mono text-gray-900 dark:text-white">
                {isConnected && bpm > 0 ? bpm : '--'}
              </span>
              <span className="text-xs font-bold text-rose-500 font-mono">BPM</span>
            </div>

            <div className="text-right">
              <div className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${zone?.bg || 'bg-gray-100 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400'}`}>
                {zone?.name ? `Zone ${zone.zone}` : 'Resting'}
              </div>
              <div className="text-[10px] font-mono text-gray-500 dark:text-slate-400 mt-0.5">
                {zone?.pct > 0 ? `${zone.pct}% Max` : `${maxHr} Max`}
              </div>
            </div>
          </div>

          {/* HR Recovery Drop Metrics */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200 dark:border-slate-800/80 text-left">
            <div>
              <div className="text-[9px] text-gray-400 dark:text-slate-500 font-bold uppercase">SERIES PEAK</div>
              <div className="text-xs font-mono font-bold text-rose-500 dark:text-rose-400">
                {rsaMetrics?.seriesPeakHr ? `${rsaMetrics.seriesPeakHr} bpm` : '--'}
              </div>
            </div>
            <div>
              <div className="text-[9px] text-gray-400 dark:text-slate-500 font-bold uppercase">MEAN HRR DROP</div>
              <div className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {rsaMetrics?.meanHrr ? `▼ ${rsaMetrics.meanHrr} bpm` : '--'}
              </div>
            </div>
          </div>
        </div>

        {/* Live Athlete & Series Stats */}
        <div className="bg-slate-50 dark:bg-slate-950/70 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
            <span>ATHLETE</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">{trackDistance}m SPRINT</span>
          </div>

          <div className="flex items-center gap-3 my-1.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-base shrink-0">
              {activeRunner?.name ? activeRunner.name.charAt(0).toUpperCase() : <User size={18} />}
            </div>
            <div className="text-left overflow-hidden">
              <div className="text-sm font-bold text-gray-900 dark:text-white truncate">
                {activeRunner?.name || 'Unassigned Sprinter'}
              </div>
              <div className="text-[11px] text-gray-500 dark:text-slate-400 truncate">
                {activeRunner?.bib ? `Bib #${activeRunner.bib}` : 'No Bib'} • {activeRunner?.sport || 'Track & Field'}
              </div>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200 dark:border-slate-800/80 text-left">
            <div>
              <div className="text-[9px] text-gray-400 dark:text-slate-500 font-bold uppercase">BEST SPRINT</div>
              <div className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {rsaMetrics ? `${rsaMetrics.bestTime}s` : '--'}
              </div>
            </div>
            <div>
              <div className="text-[9px] text-gray-400 dark:text-slate-500 font-bold uppercase">DECREMENT (SDEC)</div>
              <div className="text-xs font-mono font-bold text-amber-600 dark:text-amber-300">
                {rsaMetrics ? `${rsaMetrics.sDec}%` : '--'}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Live Virtual RSA Sprint Track & Recovery Arena */}
      <div className="bg-slate-50 dark:bg-slate-950/80 border border-gray-200 dark:border-slate-800 rounded-2xl p-3 sm:p-4 overflow-hidden relative shadow-sm">
        <div className="flex items-center justify-between text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-2">
          <div className="flex items-center gap-2">
            <Activity size={15} className="text-emerald-500 dark:text-emerald-400" />
            <span>Virtual Sprint Track & Recovery Arena ({trackDistance}m)</span>
          </div>
          <div className="text-[11px] font-mono text-gray-500 dark:text-slate-400">
            {isRunning ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold animate-pulse">● SPRINTING REP {currentRepIndex + 1}</span>
            ) : isResting ? (
              <span className="text-amber-600 dark:text-amber-400 font-bold animate-pulse">● REST RECOVERY ({restTimeRemaining}s)</span>
            ) : isComplete ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">● SERIES COMPLETED</span>
            ) : (
              <span>READY AT START BLOCKS</span>
            )}
          </div>
        </div>

        {/* Synthetic Track Canvas */}
        <div className="relative w-full h-32 bg-gradient-to-r from-red-50 via-rose-50 to-orange-50 dark:from-red-950/60 dark:via-red-900/40 dark:to-red-950/60 border-2 border-rose-200 dark:border-red-800/40 rounded-xl overflow-hidden shadow-inner">
          {/* Laser start gate (0m) */}
          <div className="absolute left-6 inset-y-0 w-1.5 bg-gradient-to-b from-cyan-400 via-emerald-400 to-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.8)] z-10 flex flex-col justify-between items-center py-1">
            <span className="text-[7.5px] font-black uppercase text-cyan-600 dark:text-cyan-300 rotate-90 -translate-x-3">0M</span>
          </div>

          {/* Laser finish gate (Node B) */}
          <div className="absolute right-6 inset-y-0 w-2.5 bg-gradient-to-b from-yellow-300 via-amber-400 to-yellow-300 shadow-[0_0_15px_rgba(250,204,21,0.8)] z-10 flex flex-col justify-between items-center py-1">
            <span className="text-[7.5px] font-black uppercase text-amber-700 dark:text-yellow-300 -rotate-90 translate-x-3">{trackDistance}M</span>
          </div>

          {/* Lane dividing dashed lines */}
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-b border-dashed border-rose-300/50 dark:border-red-500/25 pointer-events-none"></div>

          {/* Distance Markers */}
          <div className="absolute inset-x-0 bottom-1.5 px-6 flex justify-between text-[9px] font-mono font-bold text-rose-900/70 dark:text-red-300/60 pointer-events-none select-none">
            <span>START</span>
            <span>{(parseFloat(trackDistance) * 0.33).toFixed(0)}m</span>
            <span>{(parseFloat(trackDistance) * 0.66).toFixed(0)}m</span>
            <span>FINISH ({trackDistance}m)</span>
          </div>

          {/* SVG for Cyber Athlete */}
          <svg viewBox="0 0 1000 128" className="w-full h-full absolute inset-0 pointer-events-none" preserveAspectRatio="none">
            {isRunning ? (
              <g>
                <animateMotion path="M 70 64 L 930 64" dur="2.4s" repeatCount="indefinite" />
                <CyberAthleteSVG 
                  x={0} 
                  y={0} 
                  dir={1} 
                  scale={0.48} 
                  variant="live" 
                  isMoving={true} 
                  strideDuration={0.20} 
                  lean={26} 
                  label={`REP ${currentRepIndex + 1} (${displayTime}s)`} 
                />
              </g>
            ) : isResting ? (
              <g>
                <CyberAthleteSVG 
                  x={110} 
                  y={64} 
                  dir={1} 
                  scale={0.46} 
                  variant="amber" 
                  isMoving={false} 
                  lean={8} 
                  label={`RECOVERING: ${restTimeRemaining}s`} 
                />
                {/* Heart Rate Drop Visual Element */}
                <g transform="translate(180, 50)">
                  <circle cx="0" cy="0" r="14" fill={isDark ? "rgba(225, 29, 72, 0.2)" : "rgba(254, 205, 211, 0.6)"} stroke="#f43f5e" strokeWidth="1.2" />
                  <text x="0" y="3.5" fill="#f43f5e" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="ui-monospace, monospace">
                    {isConnected && bpm > 0 ? `${bpm}` : '--'}
                  </text>
                  <text x="0" y="18" fill={isDark ? "#fda4af" : "#be123c"} fontSize="7" fontWeight="bold" textAnchor="middle">
                    BPM
                  </text>
                </g>
              </g>
            ) : isComplete ? (
              <CyberAthleteSVG 
                x={920} 
                y={64} 
                dir={1} 
                scale={0.48} 
                variant="live" 
                isMoving={false} 
                label="SERIES COMPLETE" 
              />
            ) : (
              <CyberAthleteSVG 
                x={70} 
                y={64} 
                dir={1} 
                scale={0.48} 
                variant="live" 
                isMoving={false} 
                label={`REP ${currentRepIndex + 1} READY`} 
              />
            )}
          </svg>
        </div>
      </div>

      {/* Fatigue Curve Bar Chart (Live Series Progression) */}
      <div className="bg-slate-50 dark:bg-slate-950/90 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 relative z-10 flex flex-col gap-3 shadow-sm">
        <div className="flex items-center justify-between text-xs font-bold text-gray-700 dark:text-slate-300">
          <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <BarChart3 size={14} />
            <span>SERIES SPRINT DECAY & FATIGUE PROFILE</span>
          </span>
          <span className="text-[10px] font-mono text-gray-500 dark:text-slate-400">
            {completedSprints.length} of {targetReps} Sprints Recorded
          </span>
        </div>

        {completedSprints.length === 0 ? (
          <div className="h-32 flex flex-col items-center justify-center text-center text-gray-400 dark:text-slate-500 text-xs gap-1 border border-dashed border-gray-300 dark:border-slate-800 rounded-xl">
            <Zap size={20} className="text-gray-400 dark:text-slate-600 mb-1" />
            <div>No repetitions recorded yet in this RSA series.</div>
            <div className="text-[11px] text-gray-400 dark:text-slate-600">Start Rep 1 to begin recording the athlete's fatigue profile!</div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {/* Bars Container */}
            <div className="h-44 flex items-end justify-around gap-2 pt-6 pb-2 px-2 border-b border-gray-200 dark:border-slate-800 relative">
              
              {/* T_best Horizontal Reference Line */}
              {rsaMetrics && (
                <div 
                  className="absolute inset-x-0 border-b border-dashed border-emerald-400/50 flex justify-end pr-2 z-0 pointer-events-none"
                  style={{ bottom: '75%' }}
                >
                  <span className="text-[9px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-900/90 px-1 rounded border border-emerald-400/30 -translate-y-2">
                    T_best: {rsaMetrics.bestTime}s
                  </span>
                </div>
              )}

              {Array.from({ length: targetReps }).map((_, idx) => {
                const repData = completedSprints[idx];
                const isCurrent = currentRepIndex === idx && !isComplete;
                const isBest = repData && rsaMetrics && repData.time === parseFloat(rsaMetrics.bestTime);

                // Height calculation normalized relative to best time (scale: best = 75% height)
                const heightPct = repData && rsaMetrics
                  ? Math.min(100, Math.max(30, (parseFloat(rsaMetrics.bestTime) / repData.time) * 75))
                  : isCurrent 
                  ? 20 
                  : 10;

                const deltaFromBest = repData && rsaMetrics
                  ? (repData.time - parseFloat(rsaMetrics.bestTime)).toFixed(2)
                  : null;

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end relative z-10 max-w-[70px]">
                    
                    {/* Value Badge above bar */}
                    {repData && (
                      <div className="mb-1 text-[10px] font-mono font-bold text-gray-900 dark:text-white text-center whitespace-nowrap">
                        <div>{repData.time.toFixed(2)}s</div>
                        {deltaFromBest > 0 && (
                          <div className="text-[8px] text-rose-500 dark:text-rose-400 font-semibold">+{deltaFromBest}s</div>
                        )}
                        {repData.peakHr && (
                          <div className="text-[8px] text-pink-500 dark:text-pink-400 font-semibold flex items-center justify-center gap-0.5">
                            <Heart size={8} className="fill-pink-500" />
                            <span>{repData.peakHr}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Bar */}
                    <div 
                      className={`w-full rounded-t-xl transition-all duration-500 shadow-md ${
                        isBest 
                          ? 'bg-gradient-to-t from-emerald-600 to-teal-400 shadow-[0_0_12px_rgba(16,185,129,0.5)]' 
                          : repData 
                          ? 'bg-gradient-to-t from-amber-600 to-yellow-400' 
                          : isCurrent 
                          ? 'bg-gray-100 dark:bg-slate-800 border-2 border-dashed border-amber-400/60 animate-pulse' 
                          : 'bg-gray-200 dark:bg-slate-850 border border-gray-300 dark:border-slate-800'
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />

                    {/* Rep Label & HR Recovery */}
                    <div className="flex flex-col items-center mt-1">
                      <span className="text-[9px] font-mono font-bold text-gray-500 dark:text-slate-400">
                        Rep {idx + 1}
                      </span>
                      {repData?.hrr ? (
                        <span className="text-[8px] font-mono font-bold text-emerald-600 dark:text-emerald-400" title={`HR Recovery: Peak ${repData.peakHr} -> End Rest ${repData.recoveryHr}`}>
                          ▼{repData.hrr}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center justify-between text-[10px] text-gray-500 dark:text-slate-400 px-1 gap-2">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span>Fastest Rep (Peak Power)</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span>Fatigued Sprints</span>
                </span>
                <span className="flex items-center gap-1 text-pink-500 dark:text-pink-400">
                  <Heart size={10} className="fill-pink-500" />
                  <span>HR Peak & Recovery Drop (▼HRR)</span>
                </span>
              </div>
              <div className="font-mono text-gray-400 dark:text-slate-500">
                Formula: Bishop (2011) S_dec % & ACSM HRR
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sports Science Diagnostic Scorecard (When reps completed) */}
      {rsaMetrics && (
        <div className={`p-4 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10 transition-all ${rsaMetrics.tierBadge}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center shrink-0">
              <Award size={22} className="text-current" />
            </div>
            <div>
              <div className="text-xs font-black tracking-wider uppercase">
                {rsaMetrics.tier} • SDEC: {rsaMetrics.sDec}%
              </div>
              <div className="text-[11px] opacity-90 mt-0.5">
                {rsaMetrics.tierDesc}
              </div>
              {rsaMetrics.meanHrr !== null && (
                <div className="text-[10px] font-mono mt-1 opacity-95 text-emerald-300 font-bold">
                  Cardiovascular Recovery: {rsaMetrics.cardioTier}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 text-right flex-wrap">
            <div>
              <div className="text-[9px] uppercase font-bold opacity-75">FATIGUE INDEX</div>
              <div className="text-sm font-black font-mono">{rsaMetrics.fatigueIndex}%</div>
            </div>
            <div>
              <div className="text-[9px] uppercase font-bold opacity-75">TOTAL WORK TIME</div>
              <div className="text-sm font-black font-mono">{rsaMetrics.totalTime}s</div>
            </div>
            <div>
              <div className="text-[9px] uppercase font-bold opacity-75">MEAN TIME</div>
              <div className="text-sm font-black font-mono">{rsaMetrics.meanTime}s</div>
            </div>
            {rsaMetrics.meanHrr !== null && (
              <div>
                <div className="text-[9px] uppercase font-bold opacity-75">MEAN HRR DROP</div>
                <div className="text-sm font-black font-mono text-emerald-300">▼{rsaMetrics.meanHrr} bpm</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Primary Action Button Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 relative z-10 pt-2 border-t border-gray-200 dark:border-slate-800">
        <div className="text-xs font-medium text-gray-500 dark:text-slate-400">
          {isComplete 
            ? 'Session complete. Results ready for athlete profile export.' 
            : isResting 
            ? `Rest interval active. ${restTimeRemaining}s until next repetition.` 
            : `Ready for Repetition ${currentRepIndex + 1} of ${targetReps}.`}
        </div>

        <div className="flex items-center gap-2">
          {!isComplete && !isResting && onArmAndStart && (
            <button
              onClick={onArmAndStart}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold rounded-xl transition flex items-center gap-2 shadow-lg shadow-emerald-500/20"
            >
              <Zap size={14} fill="currentColor" />
              <span>Launch Rep {currentRepIndex + 1}</span>
            </button>
          )}

          {isComplete && onSaveRsaResult && (
            <button
              onClick={() => {
                onSaveRsaResult({
                  athleteName: activeRunner?.name || 'Athlete',
                  distance: trackDistance,
                  reps: targetReps,
                  bestTime: rsaMetrics?.bestTime,
                  sDec: rsaMetrics?.sDec,
                  fatigueIndex: rsaMetrics?.fatigueIndex,
                  totalTime: rsaMetrics?.totalTime,
                  meanHrr: rsaMetrics?.meanHrr,
                  seriesPeakHr: rsaMetrics?.seriesPeakHr,
                  completedSprints
                });
              }}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
            >
              <CheckCircle2 size={14} />
              <span>Save RSA Series to Profile</span>
            </button>
          )}
        </div>
      </div>

    </div>
  );
}
