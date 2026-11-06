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

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, Trophy, Clock, Users, ArrowRight, Activity, 
  Flame, Smartphone, RefreshCw, ChevronRight, Shield, 
  CheckCircle2, AlertTriangle, Monitor, Radio,
  Flag, Sparkles, Gauge, TrendingUp, Award, Target,
  ArrowUp, Play, Check
} from 'lucide-react';
import FieldRadarVisualizer from './FieldRadarVisualizer';
import VelocityLabLogo from './VelocityLabLogo';

export default function SpectatorLiveScoreboard({
  activeRunner,
  displayTime = "0.00",
  isRunning = false,
  sequenceState = "idle",
  testMode = "40m",
  trackDistance = 40,
  liveSplits = [],
  history = [],
  results = [],
  onExitSpectator
}) {
  const [activeTab, setActiveTab] = useState('leaderboard'); // 'leaderboard' | 'recent'
  const [showBroadcastLowerThird, setShowBroadcastLowerThird] = useState(true);

  // Country & Flag metadata for TV Broadcast Overlay
  const activeCountry = useMemo(() => {
    const c = activeRunner?.country || activeRunner?.team || 'USA';
    return String(c).toUpperCase();
  }, [activeRunner]);

  const countryFlag = useMemo(() => {
    switch(activeCountry) {
      case 'USA': return '🇺🇸';
      case 'JAM': return '🇯🇲';
      case 'GBR': return '🇬🇧';
      case 'CAN': return '🇨🇦';
      case 'GER': return '🇩🇪';
      case 'IND': return '🇮🇳';
      case 'AUS': return '🇦🇺';
      case 'FRA': return '🇫🇷';
      case 'JPN': return '🇯🇵';
      case 'RSA': return '🇿🇦';
      default: return '🌐';
    }
  }, [activeCountry]);

  // Session sector records for sector differential badge calculations
  const sessionSplitRecords = useMemo(() => {
    const records = {};
    (results.length > 0 ? results : history).forEach(run => {
      if (run.splits && Array.isArray(run.splits)) {
        run.splits.forEach((s, idx) => {
          const val = typeof s === 'object' ? parseFloat(s.time || s.splitTime) : parseFloat(s);
          if (!isNaN(val) && val > 0) {
            if (!records[idx] || val < records[idx]) {
              records[idx] = val;
            }
          }
        });
      }
    });
    return records;
  }, [results, history]);

  const formatTimeVal = (val) => {
    if (val === undefined || val === null || val === '') return '--';
    const num = parseFloat(val);
    return isNaN(num) ? String(val) : num.toFixed(2);
  };

  const formatSplitVal = (val) => {
    if (val === undefined || val === null || val === '') return '0.00';
    const n = typeof val === 'object' ? (val.time || val.splitTime || 0) : val;
    const num = parseFloat(n);
    return isNaN(num) ? '0.00' : num.toFixed(2);
  };

  const totalMeters = parseFloat(trackDistance) || (testMode === 'flying' ? 30 : parseInt(testMode) || 40);

  // Format drill name
  const getDrillLabel = (mode) => {
    switch(mode) {
      case 'shuttle': return '4x10m Shuttle Run';
      case 'pro_agility': return '5-10-5 Pro Agility';
      case 'l_drill': return '3-Cone L-Drill';
      case 'vertical_jump': return 'Vertical Jump';
      case 'flying': return 'Flying 30m Sprint';
      case 'mass_sprint': return `${totalMeters}m Mass Sprint Heat`;
      default: {
        const d = !isNaN(parseFloat(mode)) ? parseFloat(mode) : totalMeters;
        return `${d}m Linear Sprint`;
      }
    }
  };

  // State text banner
  const getStatusBanner = () => {
    if (sequenceState === 'false_start') {
      return { text: 'FALSE START DETECTED', bg: 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse' };
    }
    if (sequenceState === 'lead_in') {
      return { text: 'STARTING CADENCE IN PROGRESS', bg: 'bg-sky-500/20 text-sky-400 border-sky-500/40 animate-pulse' };
    }
    if (sequenceState === 'marks') {
      return { text: 'RUNNER ON MARKS...', bg: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40 animate-pulse' };
    }
    if (sequenceState === 'set') {
      return { text: 'SET — HOLD POSITION', bg: 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse' };
    }
    if (sequenceState === 'waiting_start') {
      return { text: 'GUN FIRED — AWAITING START BEAM BREAK', bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 animate-pulse' };
    }
    if (isRunning) {
      return { text: 'LIVE SPRINT IN PROGRESS', bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 animate-pulse' };
    }
    if (sequenceState === 'finished') {
      return { text: 'FINISH BEAM BROKEN!', bg: 'bg-emerald-500/30 text-emerald-300 border-emerald-500/50' };
    }
    return { text: 'AWAITING NEXT RUNNER', bg: 'bg-slate-800 text-slate-400 border-slate-700' };
  };

  const statusInfo = getStatusBanner();

  // Top 10 leaderboard sorted by fastest time (scoped to active track distance)
  const top10 = useMemo(() => {
    return [...(results.length > 0 ? results : history)]
      .filter(r => {
        if (!r.time || parseFloat(r.time) <= 0) return false;
        const dM = parseFloat(r.distanceMeters || r.distance);
        if (dM && Math.abs(dM - totalMeters) > 1.5) return false;
        return true;
      })
      .sort((a, b) => parseFloat(a.time) - parseFloat(b.time))
      .slice(0, 10);
  }, [results, history, totalMeters]);

  const topRecord = top10.length > 0 ? top10[0] : null;

  // Real-time Runner Position calculation along the lane (2% to 97%)
  const runnerProgress = useMemo(() => {
    if (sequenceState === 'idle' || sequenceState === 'lead_in' || sequenceState === 'marks') return 2;
    if (sequenceState === 'set') return 3;
    if (sequenceState === 'waiting_start') return 4;
    if (sequenceState === 'finished') return 97;
    if (!isRunning) return 2;

    const t = parseFloat(displayTime) || 0;
    const targetExpectedTime = topRecord ? parseFloat(topRecord.time) : (totalMeters * 0.12);
    const timeProgress = Math.min(94, Math.max(5, (t / Math.max(targetExpectedTime, 1.0)) * 92));

    // Anchor with actual recorded splits if any
    const gateCount = 4;
    if (liveSplits.length > 0) {
      const splitProgress = (liveSplits.length / gateCount) * 94;
      return Math.min(96, Math.max(timeProgress, splitProgress));
    }
    return timeProgress;
  }, [sequenceState, isRunning, displayTime, topRecord, totalMeters, liveSplits]);

  // Ghost Leader Position calculation (Session Record)
  const ghostProgress = useMemo(() => {
    if (!topRecord || !topRecord.time) return null;
    if (sequenceState === 'idle' || sequenceState === 'lead_in' || sequenceState === 'marks' || sequenceState === 'set' || sequenceState === 'waiting_start') {
      return 2;
    }
    if (sequenceState === 'finished') return 97;
    if (!isRunning) return 2;
    const t = parseFloat(displayTime) || 0;
    const recTime = parseFloat(topRecord.time);
    if (!recTime || recTime <= 0) return null;
    return Math.min(96, Math.max(2, (t / recTime) * 94));
  }, [topRecord, sequenceState, isRunning, displayTime]);

  // Split Stations (e.g. 0m, 10m, 20m, 30m, 40m for 40m sprint)
  const trackStations = useMemo(() => {
    return [
      { id: 0, dist: 0, label: '0m Start', pct: 2 },
      { id: 1, dist: Math.round(totalMeters * 0.25), label: `${Math.round(totalMeters * 0.25)}m`, pct: 25 },
      { id: 2, dist: Math.round(totalMeters * 0.50), label: `${Math.round(totalMeters * 0.50)}m`, pct: 50 },
      { id: 3, dist: Math.round(totalMeters * 0.75), label: `${Math.round(totalMeters * 0.75)}m`, pct: 75 },
      { id: 4, dist: totalMeters, label: `${totalMeters}m Finish`, pct: 97 }
    ];
  }, [totalMeters]);

  // Estimated instantaneous velocity (m/s)
  const currentSpeed = useMemo(() => {
    const t = parseFloat(displayTime) || 0;
    if (t <= 0) return 0;
    const estDistanceCovered = totalMeters * (runnerProgress / 100);
    return (estDistanceCovered / t).toFixed(1);
  }, [displayTime, totalMeters, runnerProgress]);

  // Check finish celebration rank
  const finishRank = useMemo(() => {
    if (sequenceState !== 'finished') return null;
    const t = parseFloat(displayTime);
    if (isNaN(t) || t <= 0) return null;
    if (!topRecord || t <= parseFloat(topRecord.time)) {
      return { rank: 1, title: 'NEW SESSION RECORD!', color: 'text-amber-400 bg-amber-500/20 border-amber-500/40' };
    }
    if (top10.length >= 1 && t <= parseFloat(top10[1]?.time || 999)) {
      return { rank: 2, title: '2ND FASTEST TODAY (PODIUM)', color: 'text-slate-200 bg-slate-300/20 border-slate-300/40' };
    }
    if (top10.length >= 2 && t <= parseFloat(top10[2]?.time || 999)) {
      return { rank: 3, title: '3RD FASTEST TODAY (PODIUM)', color: 'text-orange-300 bg-orange-500/20 border-orange-500/40' };
    }
    return { rank: 4, title: 'SPRINT COMPLETED', color: 'text-emerald-300 bg-emerald-500/20 border-emerald-500/40' };
  }, [sequenceState, displayTime, topRecord, top10]);

  // Vertical Jump metrics
  const jumpMetrics = useMemo(() => {
    if (testMode !== 'vertical_jump') return null;
    const tf = parseFloat(displayTime) || 0;
    const heightM = 1.226 * (tf * tf);
    const heightInches = (heightM * 39.37).toFixed(1);
    const heightCm = (heightM * 100).toFixed(1);
    
    let tier = 'Developmental';
    let tierColor = 'text-slate-400';
    if (parseFloat(heightInches) >= 36) {
      tier = 'Elite Pro Combine';
      tierColor = 'text-amber-400';
    } else if (parseFloat(heightInches) >= 30) {
      tier = 'Collegiate Division 1';
      tierColor = 'text-emerald-400';
    } else if (parseFloat(heightInches) >= 24) {
      tier = 'Varsity Athlete';
      tierColor = 'text-cyan-400';
    }
    return { heightInches, heightCm, tier, tierColor };
  }, [testMode, displayTime]);

  // Recent 10 runs
  const recentRuns = [...history].slice(0, 15);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none antialiased">
      {/* Top Mobile Bar */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-2.5 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <VelocityLabLogo variant="compact" className="h-7 sm:h-8 w-auto" />
          <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-mono font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
            LIVE
          </span>
          <span className="text-[10px] text-slate-400 font-medium hidden sm:inline border-l border-slate-700 pl-2">Bleacher Scoreboard</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBroadcastLowerThird(p => !p)}
            className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition flex items-center gap-1.5 ${
              showBroadcastLowerThird
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
            }`}
            title="Toggle TV broadcast lower third overlay"
          >
            <span>📺 HUD</span>
            <span className="text-[9px] font-mono opacity-80">{showBroadcastLowerThird ? 'ON' : 'OFF'}</span>
          </button>

        {onExitSpectator && (
          <button
            onClick={onExitSpectator}
            className="text-[11px] font-bold text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700 transition"
          >
            Coach View
          </button>
        )}
        </div>
      </header>

      {/* Main Live Scoreboard Body */}
      <main className="flex-1 flex flex-col p-4 max-w-xl mx-auto w-full gap-4 pb-20">
        
        {/* Status Chip */}
        <div className={`w-full py-1.5 px-3 rounded-xl border text-center text-[11px] font-bold tracking-widest uppercase transition-all shadow-sm ${statusInfo.bg}`}>
          {statusInfo.text}
        </div>

        {/* Big Live Track Display Card */}
        <div className="bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 rounded-3xl p-6 flex flex-col items-center justify-center relative overflow-hidden shadow-2xl">
          {/* Background Ambient Glow */}
          <div className="absolute w-72 h-72 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"></div>

          {/* Drill Badge */}
          <div className="z-10 flex items-center gap-2 mb-2">
            <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold tracking-wider uppercase">
              {getDrillLabel(testMode)}
            </span>
          </div>

          {/* Big Digital Clock */}
          <div className="z-10 flex items-baseline justify-center my-2">
            <span className={`text-7xl sm:text-8xl font-black font-mono tracking-tighter tabular-nums drop-shadow-[0_0_40px_rgba(16,185,129,0.3)] ${sequenceState === 'false_start' ? 'text-rose-500' : 'text-white'}`}>
              {displayTime}
            </span>
            <span className="text-3xl sm:text-4xl font-bold font-mono text-emerald-400 ml-1">
              s
            </span>
          </div>

          {/* Active Runner Card */}
          <div className="z-10 mt-3 w-full max-w-sm bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3 flex items-center justify-between shadow-md backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center text-emerald-400 font-bold">
                {activeRunner?.name ? activeRunner.name.charAt(0).toUpperCase() : <Users size={18} />}
              </div>
              <div className="text-left">
                <div className="text-sm font-bold text-white leading-tight">
                  {activeRunner?.name && activeRunner.name !== 'No runner in queue' ? activeRunner.name : 'No Runner on Gate'}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {activeRunner?.bib ? `Bib #${activeRunner.bib}` : 'Awaiting queue...'}
                  {activeRunner?.sport ? ` • ${activeRunner.sport}` : ''}
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">TRACK STATUS</div>
              <div className={`text-xs font-bold font-mono ${isRunning ? 'text-emerald-400 animate-pulse' : sequenceState === 'waiting_start' ? 'text-amber-400 animate-pulse' : 'text-slate-300'}`}>
                {isRunning ? 'RUNNING' : sequenceState === 'waiting_start' ? 'ARMED' : sequenceState === 'finished' ? 'DONE' : 'WAITING'}
              </div>
            </div>
          </div>

          {/* Real-time Field Radar (for Agility Drills) */}
          {['shuttle', 'pro_agility', 'l_drill'].includes(testMode) && (
            <div className="z-10 mt-4 w-full">
              <FieldRadarVisualizer 
                testMode={testMode} 
                liveSplits={liveSplits} 
                isRunning={isRunning} 
                sequenceState={sequenceState}
                compact={true}
              />
            </div>
          )}

          {/* Virtual Stadium Track Lane (Linear Sprint Modes) */}
          {!['shuttle', 'pro_agility', 'l_drill', 'vertical_jump'].includes(testMode) && (
            <div className="z-10 mt-4 w-full flex flex-col gap-2.5">
              {/* Lane Header Bar */}
              <div className="flex items-center justify-between px-1 text-[11px] font-bold text-slate-400">
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <Flag size={13} />
                  <span>VIRTUAL LANE • {totalMeters}M STRAIGHTAWAY</span>
                </div>
                {ghostProgress !== null && isRunning && (
                  <div className={`flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full ${
                    runnerProgress >= ghostProgress 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold' 
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  }`}>
                    {runnerProgress >= ghostProgress ? '⚡ AHEAD OF RECORD' : 'PACING RECORD'}
                  </div>
                )}
              </div>

              {/* Tartan Track Bed Container */}
              <div className="relative w-full h-28 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 rounded-2xl border-2 border-slate-800 shadow-inner overflow-hidden select-none">
                {/* Surface Lane Markings */}
                <div className="absolute inset-x-0 top-0 h-1 bg-white/20"></div>
                <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20"></div>
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px border-b border-dashed border-white/10"></div>

                {/* Start Blocks Line (0m) */}
                <div className="absolute left-[2%] top-0 bottom-0 w-1 bg-white/40 flex flex-col justify-between items-center py-1 z-10">
                  <span className="text-[8px] font-mono font-bold text-slate-500 rotate-90 origin-left">START</span>
                </div>

                {/* Finish Line (Checkered Ribbon at 97%) */}
                <div className="absolute left-[97%] top-0 bottom-0 w-2.5 bg-gradient-to-b from-white via-black to-white opacity-90 flex flex-col justify-between items-center shadow-[0_0_10px_rgba(255,255,255,0.4)] z-10">
                </div>

                {/* Timing Gate Laser Pylons (Intermediate & Finish) */}
                {trackStations.slice(1).map((stn, idx) => {
                  const splitRecorded = liveSplits.length > idx;
                  const splitTime = splitRecorded ? formatSplitVal(liveSplits[idx]) : null;
                  const isNextGate = liveSplits.length === idx && isRunning;

                  return (
                    <div 
                      key={stn.id} 
                      className="absolute top-0 bottom-0 -translate-x-1/2 flex flex-col items-center justify-between py-1 pointer-events-none z-10"
                      style={{ left: `${stn.pct}%` }}
                    >
                      {/* Top Emitter LED */}
                      <div className={`w-2.5 h-2.5 rounded-full border shadow-sm transition-all duration-300 ${
                        splitRecorded 
                          ? 'bg-emerald-400 border-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.9)] animate-pulse' 
                          : isNextGate 
                          ? 'bg-amber-400 border-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.8)] animate-ping'
                          : 'bg-slate-700 border-slate-600'
                      }`} />

                      {/* Laser Beam slicing across track */}
                      <div className={`w-0.5 flex-1 my-0.5 transition-all duration-300 ${
                        splitRecorded 
                          ? 'bg-emerald-400/80 shadow-[0_0_6px_rgba(16,185,129,0.7)]' 
                          : isNextGate 
                          ? 'bg-amber-400/60 border-l border-dashed border-amber-400' 
                          : 'border-l border-dashed border-slate-700/60'
                      }`} />

                      {/* Bottom Emitter Sensor */}
                      <div className={`w-2 h-2 rounded-sm border ${
                        splitRecorded ? 'bg-emerald-500 border-emerald-400' : 'bg-slate-800 border-slate-700'
                      }`} />

                      {/* Split Differential Floating Badge */}
                      {splitRecorded && (() => {
                        const currentSplitNum = parseFloat(splitTime);
                        const fastestSession = sessionSplitRecords[idx];
                        const isFastestInSession = fastestSession && Math.abs(currentSplitNum - fastestSession) < 0.015;
                        const benchmarkVal = fastestSession || (stn.dist * 0.115);
                        const delta = currentSplitNum - benchmarkVal;
                        const isFaster = delta < -0.01;

                        return (
                          <div className={`absolute -top-3.5 px-2 py-0.5 rounded-md text-[9px] font-mono font-bold shadow-lg whitespace-nowrap z-20 flex items-center gap-1 border ${
                            isFastestInSession
                              ? 'bg-purple-950/95 border-purple-500/70 text-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.5)]'
                              : isFaster
                              ? 'bg-emerald-950/95 border-emerald-500/70 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.5)]'
                              : 'bg-rose-950/95 border-amber-500/70 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                          }`}>
                            <span>{splitTime}s</span>
                            <span className={`text-[8px] font-black ${
                              isFastestInSession ? 'text-purple-200' : isFaster ? 'text-emerald-200' : 'text-amber-200'
                            }`}>
                              ({delta > 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2)}s)
                            </span>
                          </div>
                        );
                      })()}
                      {/* Split Time Floating Tag */}
                      {splitRecorded && (
                        <div className="absolute -top-1 px-1.5 py-0.5 bg-emerald-950/95 border border-emerald-500/60 rounded-md text-[9px] font-mono font-bold text-emerald-300 shadow-lg whitespace-nowrap z-20">
                          {splitTime}s
                        </div>
                      )}

                      {/* Distance Label under track */}
                      <span className="absolute -bottom-0.5 text-[8px] font-mono font-bold text-slate-500">
                        {stn.dist}m
                      </span>
                    </div>
                  );
                })}

                {/* Ghost Leader Pacer (Session Record) */}
                {ghostProgress !== null && (
                  <div 
                    className="absolute top-2 -translate-x-1/2 z-20 transition-all duration-150 pointer-events-none flex flex-col items-center"
                    style={{ left: `${ghostProgress}%` }}
                  >
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[8px] font-mono font-bold backdrop-blur-sm whitespace-nowrap shadow-[0_0_10px_rgba(251,191,36,0.3)]">
                      <Trophy size={9} />
                      <span>{topRecord?.name?.split(' ')[0] || 'REC'}</span>
                    </div>
                    <div className="w-1.5 h-1.5 rotate-45 bg-amber-400 mt-0.5 shadow-[0_0_6px_rgba(251,191,36,0.8)]"></div>
                  </div>
                )}

                {/* Active Runner Avatar */}
                <div 
                  className="absolute bottom-2.5 -translate-x-1/2 z-30 transition-all duration-150 pointer-events-none flex flex-col items-center"
                  style={{ left: `${runnerProgress}%` }}
                >
                  {/* Floating Pace / Name Badge */}
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-950/95 border border-emerald-400/60 text-emerald-300 text-[9px] font-mono font-bold shadow-xl whitespace-nowrap mb-1">
                    <span className="text-white">{activeRunner?.name?.split(' ')[0] || 'Runner'}</span>
                    {isRunning && currentSpeed > 0 && (
                      <span className="text-emerald-400 ml-0.5 font-black">• {currentSpeed} m/s</span>
                    )}
                  </div>

                  {/* Runner Silhouette Body with Wake Streaks */}
                  <div className="relative flex items-center justify-center">
                    {/* Trailing speed particles */}
                    {isRunning && (
                      <>
                        <div className="absolute right-7 w-2 h-2 rounded-full bg-emerald-400/60 blur-[1px] animate-ping" />
                        <div className="absolute right-4 w-2.5 h-2.5 rounded-full bg-emerald-400/40 blur-[1px]" />
                      </>
                    )}

                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-300 text-black flex items-center justify-center font-black shadow-[0_0_16px_rgba(16,185,129,0.9)] border-2 border-white">
                      {sequenceState === 'finished' ? (
                        <Flag size={14} className="text-black" />
                      ) : (
                        <Zap size={14} fill="currentColor" />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Finish Celebration & Speed Summary Card */}
              {sequenceState === 'finished' && finishRank && (
                <div className={`w-full p-3 rounded-2xl border flex items-center justify-between shadow-lg transition-all animate-bounce ${finishRank.color}`}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-black/30 flex items-center justify-center">
                      <Trophy size={20} className={finishRank.rank === 1 ? 'text-amber-300 animate-spin' : 'text-slate-100'} />
                    </div>
                    <div>
                      <div className="text-xs font-black tracking-wider uppercase">{finishRank.title}</div>
                      <div className="text-[10px] text-slate-300 mt-0.5">
                        {finishRank.rank === 1 
                          ? `New Session Benchmark set at ${displayTime}s!` 
                          : `Top Performance logged: ${displayTime}s`}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] text-slate-400 font-bold uppercase">AVG VELOCITY</div>
                    <div className="text-xs font-mono font-black text-white">
                      {parseFloat(displayTime) > 0 ? (totalMeters / parseFloat(displayTime)).toFixed(2) : '0.00'} m/s
                    </div>
                  </div>
                </div>
              )}

              {/* Live Splits Pill Bar */}
              {liveSplits && liveSplits.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center mt-1">
                  {liveSplits.map((sp, idx) => (
                    <div key={idx} className="px-3 py-1 bg-slate-800/90 border border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-200 shadow-sm">
                      <span className="text-slate-400 mr-1.5">Gate {idx + 1}:</span>
                      <span className="text-emerald-400">{formatSplitVal(sp)}s</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Vertical Elevation Launch Tower (for Vertical Jump) */}
          {testMode === 'vertical_jump' && jumpMetrics && (
            <div className="z-10 mt-4 w-full bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <ArrowUp size={14} />
                  <span>VERTICAL LAUNCH TOWER</span>
                </span>
                <span className={`text-[10px] uppercase font-bold tracking-wider ${jumpMetrics.tierColor}`}>
                  {jumpMetrics.tier}
                </span>
              </div>

              {/* Vertical Height Gauge */}
              <div className="flex items-center gap-4">
                <div className="flex-1 bg-slate-900 rounded-xl p-3 border border-slate-800 text-center">
                  <div className="text-4xl font-black font-mono text-emerald-400">
                    {jumpMetrics.heightInches}"
                  </div>
                  <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                    Jump Elevation ({jumpMetrics.heightCm} cm)
                  </div>
                </div>

                <div className="flex-1 bg-slate-900 rounded-xl p-3 border border-slate-800 text-center">
                  <div className="text-2xl font-black font-mono text-white">
                    {displayTime}s
                  </div>
                  <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                    Flight Hangtime (s)
                  </div>
                </div>
              </div>

              {/* Benchmark Progress Bar */}
              <div className="w-full">
                <div className="flex justify-between text-[9px] font-mono text-slate-500 mb-1">
                  <span>0"</span>
                  <span>24" (Varsity)</span>
                  <span>30" (College)</span>
                  <span>36"+ (Elite)</span>
                </div>
                <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, (parseFloat(jumpMetrics.heightInches) / 40) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tab Switcher: Leaderboard vs Recent Runs */}
        <div className="grid grid-cols-2 bg-slate-900 border border-slate-800 rounded-2xl p-1 shadow-sm">
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`py-2 px-3 rounded-xl text-xs font-bold tracking-wide transition flex items-center justify-center gap-1.5 ${
              activeTab === 'leaderboard' 
                ? 'bg-emerald-500 text-black shadow-md' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Trophy size={14} />
            <span>Top Leaderboard</span>
          </button>

          <button
            onClick={() => setActiveTab('recent')}
            className={`py-2 px-3 rounded-xl text-xs font-bold tracking-wide transition flex items-center justify-center gap-1.5 ${
              activeTab === 'recent' 
                ? 'bg-emerald-500 text-black shadow-md' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Activity size={14} />
            <span>Recent Runs ({recentRuns.length})</span>
          </button>
        </div>

        {/* Content Panel */}
        {activeTab === 'leaderboard' ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-2.5 shadow-md">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
              <span>Today's Top 10</span>
              <span className="text-[10px] text-emerald-400 font-mono">Live Session</span>
            </div>

            {top10.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs font-medium">
                No times recorded yet today. Sprints will show here as completed!
              </div>
            ) : (
              <AnimatePresence>
                {top10.map((run, idx) => {
                  const isGold = idx === 0;
                  const isSilver = idx === 1;
                  const isBronze = idx === 2;
                  return (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 350, damping: 25 }}
                      key={run.id || run.firebaseId || `${run.name}-${run.time}-${idx}`}
                      className={`flex items-center justify-between p-3 rounded-xl border transition ${
                        isGold 
                          ? 'bg-amber-500/10 border-amber-500/30 text-white shadow-[0_0_15px_rgba(251,191,36,0.15)]' 
                          : isSilver 
                          ? 'bg-slate-300/10 border-slate-300/30 text-white'
                          : isBronze
                          ? 'bg-orange-500/10 border-orange-500/30 text-white'
                          : 'bg-slate-950/60 border-slate-800/80 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shadow-xs ${
                          isGold ? 'bg-amber-400 text-black shadow-[0_0_10px_rgba(251,191,36,0.6)]' :
                          isSilver ? 'bg-slate-300 text-black' :
                          isBronze ? 'bg-orange-400 text-black' :
                          'bg-slate-800 text-slate-400'
                        }`}>
                          #{idx + 1}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white flex items-center gap-1.5">
                            <span>{run.name}</span>
                            {isGold && <span className="text-xs">👑</span>}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {run.distance ? (String(run.distance).toLowerCase().includes('m') ? run.distance : `${run.distance}m Sprint`) : `${run.distanceMeters || totalMeters}m Sprint`}
                            {run.velocity ? ` • ${parseFloat(run.velocity).toFixed(2)} m/s` : ''}
                            {run.reactionTime && parseFloat(run.reactionTime) > 0 ? ` • RT ${(parseFloat(run.reactionTime) > 20 ? parseFloat(run.reactionTime) / 1000 : parseFloat(run.reactionTime)).toFixed(3)}s` : ''}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className={`text-base font-black font-mono tracking-tight ${
                          isGold ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]' : isSilver ? 'text-slate-200' : isBronze ? 'text-orange-400' : 'text-emerald-400'
                        }`}>
                          {formatTimeVal(run.time)}s
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-2.5 shadow-md">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
              <span>Completed Sprints</span>
              <span className="text-[10px] text-slate-500 font-mono">Chronological Feed</span>
            </div>

            {recentRuns.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs font-medium">
                No recent runs recorded yet.
              </div>
            ) : (
              recentRuns.map((run, idx) => (
                <div
                  key={run.id || run.firebaseId || idx}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                    <div>
                      <div className="text-xs font-bold text-white">{run.name}</div>
                      <div className="text-[10px] text-slate-400">
                        {run.serverTime ? new Date(run.serverTime.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'}
                        {run.distance ? ` • ${run.distance}m` : ''}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-bold font-mono text-emerald-400">{formatTimeVal(run.time)}s</div>
                    {run.personalBest && (
                      <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wider">PR!</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

      </main>

      {/* TV-Style Lower-Thirds Broadcast Banner in Stadium Mode */}
      <AnimatePresence>
        {showBroadcastLowerThird && (isRunning || sequenceState === 'finished' || activeRunner) && (
          <motion.div 
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 28 }}
            className="fixed bottom-12 left-4 right-4 max-w-xl mx-auto bg-gradient-to-r from-slate-950/95 via-slate-900/90 to-slate-950/95 backdrop-blur-md border border-cyan-500/40 rounded-2xl p-3 sm:p-3.5 shadow-2xl z-40 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-400 via-teal-400 to-emerald-400 text-black flex items-center justify-center font-black text-sm shadow-md border border-cyan-300/40 shrink-0">
                {activeRunner?.name ? activeRunner.name.split(' ').map(n => n[0]).slice(0, 2).join('') : 'VL'}
                <span className="absolute -bottom-1 -right-1 text-xs">{countryFlag}</span>
              </div>
              <div>
                <div className="text-[10px] font-mono font-bold tracking-widest uppercase text-cyan-400 flex items-center gap-1.5">
                  <Activity size={12} />
                  <span>VELOCITY TELEMETRY HUD • {activeRunner?.bib ? `BIB #${activeRunner.bib}` : 'LANE 1'} • {activeCountry}</span>
                </div>
                <div className="text-sm font-black text-white uppercase tracking-tight">
                  {activeRunner?.name || "Sprint Athlete"}
                </div>
                <div className="text-[10px] font-mono text-slate-300 flex items-center gap-2">
                  <span className="text-emerald-400 font-bold">PB {activeRunner?.personalBest ? `${activeRunner.personalBest}s` : (topRecord ? `${formatTimeVal(topRecord.time)}s` : '--')}</span>
                  <span className="text-slate-600">•</span>
                  <span className="text-amber-300 font-bold">REC {topRecord ? `${formatTimeVal(topRecord.time)}s` : '--'}</span>
                  <span className="text-slate-600">•</span>
                  <span className="text-cyan-300 font-bold">{displayTime}s</span>
                </div>
              </div>
            </div>
            <div className="text-right border-l border-slate-800 pl-3 shrink-0">
              <div className="text-[9px] font-mono font-bold text-slate-400 uppercase">RUNNER SPEED</div>
              <div className="text-base sm:text-lg font-black font-mono text-cyan-300 tabular-nums leading-none">
                {currentSpeed} <span className="text-[10px] text-slate-400 font-bold">m/s</span>
              </div>
              <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                {(parseFloat(currentSpeed) * 3.6).toFixed(1)} km/h
              </div>
              <div className="w-16 sm:w-20 bg-slate-800 rounded-full h-1 mt-1 overflow-hidden ml-auto">
                <div 
                  className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400" 
                  style={{ width: `${Math.min(100, (parseFloat(currentSpeed) / 12) * 100)}%` }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Persistent Bottom Spectator Footer */}
      <footer className="fixed bottom-0 left-0 right-0 z-30 bg-slate-900/90 backdrop-blur-md border-t border-slate-800 px-4 py-2.5 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <Radio size={14} className="text-emerald-400 animate-pulse" />
          <span className="text-[11px] font-medium text-slate-300">Live Hardware Sync Active</span>
        </div>
        <div className="text-[10px] text-slate-500 font-mono">
          Velocity Lab Bleacher Stream
        </div>
      </footer>
    </div>
  );
}
