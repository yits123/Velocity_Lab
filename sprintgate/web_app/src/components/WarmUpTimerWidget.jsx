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

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Timer, Play, Pause, RotateCcw, ChevronDown, ChevronUp, Bell, CheckCircle2 } from 'lucide-react';
import { playAttentionChime } from '../utils/soundEngine';

/**
 * WarmUpTimerWidget.jsx
 * Velocity Lab - Pre-Session Warm-Up Countdown Controller
 * 
 * Independent athletic warm-up timer helping coaches orchestrate
 * dynamic warm-up drills, block walk-throughs, and mobility intervals.
 * Alerts when warm-up completes so athletes are primed for laser testing.
 */
function WarmUpTimerWidget({
  onWarmUpComplete = null,
  className = ''
}) {
  const PRESETS = [5, 8, 10, 15]; // in minutes
  const [selectedMinutes, setSelectedMinutes] = useState(8);
  const [secondsRemaining, setSecondsRemaining] = useState(8 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const timerRef = useRef(null);

  const totalSeconds = selectedMinutes * 60;
  const progressPercent = Math.max(0, Math.min(100, ((totalSeconds - secondsRemaining) / totalSeconds) * 100));

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleStart = () => {
    if (secondsRemaining <= 0) {
      setSecondsRemaining(selectedMinutes * 60);
    }
    setIsCompleted(false);
    setIsRunning(true);
  };

  const handlePause = () => {
    setIsRunning(false);
    clearTimer();
  };

  const handleReset = (mins = selectedMinutes) => {
    setIsRunning(false);
    clearTimer();
    setIsCompleted(false);
    setSelectedMinutes(mins);
    setSecondsRemaining(mins * 60);
  };

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setSecondsRemaining(prev => {
          if (prev <= 1) {
            clearTimer();
            setIsRunning(false);
            setIsCompleted(true);
            playAttentionChime();
            if (typeof onWarmUpComplete === 'function') {
              onWarmUpComplete();
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearTimer();
    }
    return () => clearTimer();
  }, [isRunning, onWarmUpComplete]);

  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const timeDisplay = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  return (
    <div className={`bg-white dark:bg-slate-900 border border-gray-200/80 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden transition-all select-none ${className}`}>
      {/* Capsule Header (Always clickable to expand/collapse) */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between px-3.5 py-2.5 cursor-pointer hover:bg-gray-50/70 dark:hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
            isCompleted 
              ? 'bg-emerald-500/15 text-emerald-500' 
              : isRunning 
              ? 'bg-amber-500/15 text-amber-500 animate-pulse' 
              : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400'
          }`}>
            <Timer size={15} />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400">
              Session Warm-Up
            </div>
            <div className="text-xs font-mono font-black text-gray-900 dark:text-white flex items-center gap-1.5">
              <span>{timeDisplay}</span>
              {isRunning && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping inline-block" />
              )}
              {isCompleted && (
                <span className="text-[9px] font-bold text-emerald-500">READY</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Quick Play/Pause on Header */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              isRunning ? handlePause() : handleStart();
            }}
            className={`p-1.5 rounded-lg border transition ${
              isRunning 
                ? 'bg-amber-500/10 text-amber-500 border-amber-500/30 hover:bg-amber-500/20' 
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
            }`}
            title={isRunning ? 'Pause Warm-Up' : 'Start Warm-Up'}
            aria-label={isRunning ? 'Pause' : 'Start'}
          >
            {isRunning ? <Pause size={13} /> : <Play size={13} className="ml-0.5" />}
          </button>

          <button
            type="button"
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      </div>

      {/* Expanded Controls & Presets */}
      {isExpanded && (
        <div className="px-3.5 pb-3.5 pt-1 border-t border-gray-100 dark:border-slate-800/80 space-y-3">
          {/* Progress Bar */}
          <div className="w-full bg-gray-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-300 ${isCompleted ? 'bg-emerald-500' : 'bg-[var(--accent-color,#00E599)]'}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Preset Buttons */}
          <div className="flex items-center justify-between gap-1">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handleReset(p)}
                className={`flex-1 py-1 text-[11px] font-mono font-bold rounded-lg border transition ${
                  selectedMinutes === p && !isRunning
                    ? 'bg-[var(--accent-color,#00E599)] text-slate-900 border-transparent shadow-xs'
                    : 'bg-gray-50 dark:bg-slate-800/60 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-slate-600'
                }`}
              >
                {p}m
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleReset()}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition"
              title="Reset timer"
              aria-label="Reset timer"
            >
              <RotateCcw size={13} />
            </button>
          </div>

          {/* Status Message */}
          <div className="text-[10px] text-gray-500 dark:text-slate-400 flex items-center justify-between">
            <span>{isRunning ? 'Athlete mobility & prep in progress' : isCompleted ? 'Warm-up complete! Gates armed.' : 'Select prep duration'}</span>
            <span className="font-mono">{Math.round(progressPercent)}%</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(WarmUpTimerWidget);
