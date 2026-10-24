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
  Zap, Users, Play, UserPlus, Flag, ChevronRight, CheckCircle2, 
  AlertTriangle, PlayCircle, Eye, ArrowRight, ShieldCheck, Gauge, Plus, RefreshCw, X
} from 'lucide-react';
import { CyberAthleteSVG } from './VirtualSprinter';

/**
 * Interactive Mass Sprint Heat Cockpit
 * Dedicated module for multi-athlete sequential sprint testing
 */
export default function MassSprintCockpit({
  runnersOnTrack = [],
  queue = [],
  setQueue,
  timeSinceLastStart = 0,
  trackDistance = 40,
  sequenceState = 'idle',
  isRunning = false,
  liveSplits = [],
  formatTime,
  onLaunchNextRunner,
  onManualFinishLeading,
  onArmAndStart,
  nodeAStatus = { online: true, beam_broken: false },
  nodeBStatus = { online: true, beam_broken: false }
}) {
  const [quickName, setQuickName] = useState('');
  const [quickBib, setQuickBib] = useState('');
  const [currentTimeMs, setCurrentTimeMs] = useState(performance.now());
  const distNum = parseFloat(trackDistance) || 40;
  const safeFormatTime = typeof formatTime === 'function' ? formatTime : ((t) => typeof t === 'number' ? t.toFixed(2) : String(t));

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

  // Real-time animation tick for runners moving on track
  useEffect(() => {
    let animId;
    if (runnersOnTrack.length > 0) {
      const loop = () => {
        setCurrentTimeMs(performance.now());
        animId = requestAnimationFrame(loop);
      };
      animId = requestAnimationFrame(loop);
    }
    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [runnersOnTrack.length]);

  const handleAddQuickRunner = (e) => {
    if (e) e.preventDefault();
    if (!quickName.trim()) return;
    const bib = quickBib.trim() || `H${queue.length + 1}`;
    const newAthlete = {
      name: quickName.trim(),
      bib: bib,
      age: 21,
      gender: 'M',
      sport: 'Track & Field'
    };
    if (setQueue) {
      setQueue(prev => [...prev, newAthlete]);
    }
    setQuickName('');
    setQuickBib('');
  };

  const gapValue = typeof timeSinceLastStart === 'number' ? timeSinceLastStart : parseFloat(timeSinceLastStart) || 0;
  const isTrackClear = gapValue >= 3.0;

  // Filter out heat finishes from liveSplits (node 1)
  const heatFinishes = (liveSplits || []).filter(s => s && s.node === 1 && s.runnerName);

  return (
    <div className="w-full max-w-5xl mx-auto px-2 sm:px-4 mt-6">
      <div className="bg-white dark:bg-gradient-to-b dark:from-[#0f141e] dark:to-[#0a0d14] border border-gray-200 dark:border-cyan-500/30 rounded-3xl p-4 sm:p-6 shadow-2xl backdrop-blur-xl relative overflow-hidden text-gray-900 dark:text-white transition-colors duration-300">
        {/* Glow ambient accent */}
        <div className="absolute top-0 right-1/4 w-96 h-32 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-1/4 w-96 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* 1. Header Bar with Direct Actions */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-gray-200 dark:border-slate-800/80 pb-5 mb-5 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 dark:border-cyan-500/40 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.15)]">
              <Users size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white tracking-wide">Mass Sprint Heat Cockpit</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30">
                  {distNum}M SPRINT HEAT
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                  sequenceState === 'running' 
                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/40 animate-pulse' 
                    : sequenceState === 'waiting_start'
                    ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/40'
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 border-gray-300 dark:border-slate-700'
                }`}>
                  {sequenceState === 'running' ? '● HEAT IN FLIGHT' : sequenceState === 'waiting_start' ? 'AWAITING START' : 'STANDBY'}
                </span>
              </div>
              <p className="text-xs text-gray-600 dark:text-slate-400 mt-1">
                Sequential 3–4s launches from Node A · Visual gap monitoring · Automated FIFO Node B electronic finishes
              </p>
            </div>
          </div>

          {/* Quick Cockpit Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {sequenceState === 'running' && queue.length > 0 && (
              <button
                onClick={onLaunchNextRunner}
                className="px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 bg-emerald-600 hover:bg-[#00e691] text-black shadow-[0_0_15px_rgba(0,208,132,0.3)] transition animate-pulse"
                title="Tester Manual Launch Override: release next athlete from Node A based on visual observation"
              >
                <ArrowRight size={14} />
                <span>Release Next ({queue[0]?.name?.split(' ')[0] || 'Athlete'})</span>
              </button>
            )}

            {sequenceState === 'running' && runnersOnTrack.length > 0 && (
              <button
                onClick={onManualFinishLeading}
                className="px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-800 dark:text-slate-200 border border-gray-300 dark:border-slate-700 transition"
                title="Manual finish trigger override for leading runner"
              >
                <Flag size={13} className="text-emerald-500 dark:text-emerald-400" />
                <span>Finish #{(runnersOnTrack[0]?.name || 'Runner').split(' ')[0]}</span>
              </button>
            )}
          </div>
        </div>

        {/* 2. Interactive 2D Virtual Track Arena */}
        <div className="mb-6 relative z-10">
          <div className="flex items-center justify-between text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-2.5">
            <div className="flex items-center gap-2">
              <Eye size={15} className="text-cyan-600 dark:text-cyan-400" />
              <span>Live Virtual Track Arena ({distNum}m)</span>
            </div>
            <div className="flex items-center gap-4 text-[11px] font-mono">
              <span className="flex items-center gap-1 text-gray-600 dark:text-slate-400">
                <span className={`w-2 h-2 rounded-full ${nodeAStatus?.beam_broken ? 'bg-rose-500 animate-ping' : 'bg-emerald-500'}`}></span>
                Node A (Start): {nodeAStatus?.beam_broken ? 'BEAM BROKEN' : 'CLEAR'}
              </span>
              <span className="flex items-center gap-1 text-gray-600 dark:text-slate-400">
                <span className={`w-2 h-2 rounded-full ${nodeBStatus?.beam_broken ? 'bg-rose-500 animate-ping' : 'bg-emerald-500'}`}></span>
                Node B (Finish): {nodeBStatus?.beam_broken ? 'BEAM BROKEN' : 'CLEAR'}
              </span>
            </div>
          </div>

          {/* Synthetic Running Track Canvas */}
          <div className="relative w-full h-36 bg-gradient-to-r from-red-50 via-rose-50 to-orange-50 dark:from-red-950/60 dark:via-red-900/40 dark:to-red-950/60 border-2 border-rose-200 dark:border-red-800/40 rounded-2xl overflow-hidden p-3 flex flex-col justify-between shadow-inner">
            {/* Lane dividing dashed lines */}
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-b border-dashed border-rose-300/50 dark:border-red-500/25 pointer-events-none"></div>

            {/* Distance Markers */}
            <div className="absolute inset-x-0 bottom-2 px-6 flex justify-between text-[10px] font-mono font-bold text-rose-900/70 dark:text-red-300/60 pointer-events-none select-none">
              <span>0m (START)</span>
              <span>{(distNum * 0.25).toFixed(0)}m</span>
              <span>{(distNum * 0.5).toFixed(0)}m</span>
              <span>{(distNum * 0.75).toFixed(0)}m</span>
              <span>{distNum}m (FINISH)</span>
            </div>

            {/* Start Line (Node A) Visual Laser Gate */}
            <div className="absolute left-6 inset-y-0 w-1.5 bg-gradient-to-b from-cyan-400 via-emerald-400 to-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.8)] z-10 flex flex-col justify-between items-center py-1">
              <span className="text-[8px] font-black uppercase text-cyan-600 dark:text-cyan-300 rotate-90 -translate-x-3">NODE A</span>
            </div>

            {/* Finish Line (Node B) Visual Gate */}
            <div className="absolute right-6 inset-y-0 w-2.5 bg-gradient-to-b from-yellow-300 via-amber-400 to-yellow-300 shadow-[0_0_15px_rgba(250,204,21,0.8)] z-10 flex flex-col justify-between items-center py-1">
              <span className="text-[8px] font-black uppercase text-amber-700 dark:text-yellow-300 -rotate-90 translate-x-3">NODE B</span>
            </div>

            {/* Dynamic Cyber Athlete Sprinters In Flight on Track */}
            {runnersOnTrack.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-gray-500 dark:text-slate-400/80 font-medium">
                {sequenceState === 'running' 
                  ? 'Track clear! Ready for next athlete to launch from Node A.' 
                  : 'Track is clear. Hit "Start Sequence" — sprinters launch sequentially upon breaking Node A beam.'}
              </div>
            ) : (
              <div className="absolute inset-0 z-20 pointer-events-none">
                <svg viewBox="0 0 1000 144" className="w-full h-full" preserveAspectRatio="none">
                  {runnersOnTrack.map((runner, idx) => {
                    const elapsed = Math.max(0, (currentTimeMs - runner.startTime) / 1000);
                    const estSpeed = 8.0;
                    const estimatedMeters = Math.min(distNum, elapsed * estSpeed);
                    const progressPct = Math.min(94, Math.max(4, (estimatedMeters / distNum) * 100));
                    // Map x from 70px (Node A) to 930px (Node B)
                    const runnerX = 70 + (progressPct / 100) * 850;
                    // Alternating lane vertical positions to avoid overlap
                    const runnerY = idx % 2 === 0 ? 56 : 84;
                    const isLeader = idx === 0;

                    return (
                      <CyberAthleteSVG 
                        key={runner.runId || idx}
                        x={runnerX}
                        y={runnerY}
                        dir={1}
                        scale={0.46}
                        variant={isLeader ? "live" : "amber"}
                        isMoving={true}
                        strideDuration={0.22}
                        lean={24}
                        label={`#${idx + 1} ${(runner.name || 'Runner').split(' ')[0]} (${safeFormatTime(elapsed)}s · ${estimatedMeters.toFixed(0)}m)`}
                      />
                    );
                  })}
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* 3. Launch Clearance Advisor & Tester Observation Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5 relative z-10">
          {/* Spacing Clearance Status */}
          <div className="bg-slate-50 dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 p-3.5 rounded-2xl flex flex-col justify-between shadow-sm">
            <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest block mb-1">
              LAUNCH CLEARANCE METER
            </span>
            <div className="flex items-center justify-between">
              <div className="font-mono text-2xl font-bold text-gray-900 dark:text-white">
                {gapValue.toFixed(1)}<span className="text-xs text-gray-500 dark:text-slate-400 ml-1">sec</span>
              </div>
              <div>
                {sequenceState === 'running' ? (
                  isTrackClear ? (
                    <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40 flex items-center gap-1.5 shadow-[0_0_12px_rgba(0,208,132,0.3)]">
                      <span className="w-2 h-2 rounded-full bg-[#00D084] animate-ping"></span>
                      TRACK CLEAR
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40 flex items-center gap-1.5 animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                      HOLD NEXT
                    </span>
                  )
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 border border-gray-200 dark:border-slate-700">
                    AWAITING RUN 1
                  </span>
                )}
              </div>
            </div>
            {/* Visual clearance progress bar */}
            <div className="w-full bg-gray-200 dark:bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <div 
                className={`h-full transition-all duration-200 ${isTrackClear ? 'bg-emerald-500 shadow-[0_0_8px_rgba(0,208,132,0.8)]' : 'bg-amber-400'}`}
                style={{ width: `${Math.min(100, (gapValue / 3.5) * 100)}%` }}
              ></div>
            </div>
          </div>

          {/* Tester Visual Observation Guidance */}
          <div className="md:col-span-2 bg-slate-50 dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 p-3.5 rounded-2xl flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shrink-0">
              <Eye size={20} />
            </div>
            <div className="text-xs text-gray-700 dark:text-slate-300">
              <strong className="text-gray-900 dark:text-white block mb-0.5">Tester Observation Protocol:</strong>
              Sprinters leave track immediately after crossing Node B. If you visually observe the preceding athlete is far enough down the track (&gt;15m) that they won't bump into each other, release the next athlete from Node A without waiting!
            </div>
          </div>
        </div>

        {/* 4. Active Runners in Flight & On-Deck Queue */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5 relative z-10">
          {/* Active in Flight */}
          <div className="bg-slate-50 dark:bg-slate-900/70 border border-gray-200 dark:border-slate-800 p-4 rounded-2xl flex flex-col justify-between shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold text-gray-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Zap size={14} className="text-emerald-500 dark:text-emerald-400" />
                Runners Currently on Track ({runnersOnTrack.length})
              </span>
              {runnersOnTrack.length > 0 && (
                <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">Leading approaches Node B</span>
              )}
            </div>

            {runnersOnTrack.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-gray-200 dark:border-slate-800 text-center text-xs text-gray-400 dark:text-slate-500">
                No runners currently in flight. Queue athletes below to launch a heat.
              </div>
            ) : (
              <div className="space-y-2">
                {runnersOnTrack.map((runner, idx) => {
                  const elapsed = Math.max(0, (currentTimeMs - runner.startTime) / 1000);
                  return (
                    <div 
                      key={runner.runId || idx}
                      className={`p-2.5 rounded-xl border flex items-center justify-between ${
                        idx === 0 
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-500/50 text-emerald-900 dark:text-emerald-100 shadow-[0_0_15px_rgba(0,208,132,0.1)]' 
                          : 'bg-white dark:bg-slate-800/60 border-gray-200 dark:border-slate-700 text-gray-800 dark:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold ${
                          idx === 0 ? 'bg-[#00D084] text-black' : 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300'
                        }`}>
                          #{idx + 1}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-gray-900 dark:text-white">{runner.name}</div>
                          <div className="text-[10px] text-gray-500 dark:text-slate-400 font-mono">Bib {runner.bib} · {idx === 0 ? 'Approaching Node B' : 'In Flight'}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatTime(elapsed)}s</div>
                        <div className="text-[9px] uppercase tracking-wider text-gray-500 dark:text-slate-400">
                          {idx === 0 ? 'Leading' : `+${(idx * 3.2).toFixed(1)}s`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* On Deck Queue & Quick Add */}
          <div className="bg-slate-50 dark:bg-slate-900/70 border border-gray-200 dark:border-slate-800 p-4 rounded-2xl flex flex-col justify-between shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold text-gray-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Users size={14} className="text-cyan-600 dark:text-cyan-400" />
                Standing at Node A ({queue.length} Queued)
              </span>
              {queue.length > 0 && (
                <span className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400 font-bold">Next: {queue[0].name.split(' ')[0]}</span>
              )}
            </div>

            {/* Next Runner at Start Line */}
            {queue.length > 0 ? (
              <div className="p-2.5 mb-3 rounded-xl bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-300 dark:border-cyan-500/30 flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-bold text-cyan-700 dark:text-cyan-400 uppercase tracking-widest block">READY AT NODE A LASER:</span>
                  <div className="text-xs font-bold text-gray-900 dark:text-white mt-0.5">{queue[0].name} <span className="text-gray-500 dark:text-slate-400 font-mono">(Bib {queue[0].bib})</span></div>
                </div>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30">
                  NEXT IN LINE
                </span>
              </div>
            ) : (
              <div className="p-3 mb-3 rounded-xl border border-dashed border-gray-200 dark:border-slate-800 text-center text-xs text-gray-400 dark:text-slate-500">
                Queue empty. Add athletes to the start queue below.
              </div>
            )}

            {/* Quick Add Form */}
            <form onSubmit={handleAddQuickRunner} className="flex gap-2">
              <input
                type="text"
                placeholder="Athlete Name"
                value={quickName}
                onChange={(e) => setQuickName(e.target.value)}
                className="flex-1 bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              <input
                type="text"
                placeholder="Bib #"
                value={quickBib}
                onChange={(e) => setQuickBib(e.target.value)}
                className="w-16 bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-800 rounded-xl px-2 py-1.5 text-xs font-mono text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              <button
                type="submit"
                disabled={!quickName.trim()}
                className="px-3 py-1.5 rounded-xl font-bold text-xs bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-40 transition flex items-center gap-1"
              >
                <Plus size={13} />
                <span>Add</span>
              </button>
            </form>
          </div>
        </div>

        {/* 5. Heat Results Log (FIFO Finishes) */}
        {heatFinishes.length > 0 && (
          <div className="bg-slate-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 relative z-10 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold text-gray-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-500 dark:text-emerald-400" />
                Completed Finishes in Current Heat ({heatFinishes.length})
              </span>
              <span className="text-[10px] font-mono text-gray-400 dark:text-slate-500">Recorded at Node B</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {heatFinishes.map((finish, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-white dark:bg-slate-950/80 border border-emerald-400/30 dark:border-emerald-500/30 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-[10px] font-bold font-mono">
                      #{idx + 1}
                    </span>
                    <span className="text-xs font-bold text-gray-900 dark:text-white truncate max-w-[120px]">{finish.runnerName}</span>
                  </div>
                  <span className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">{parseFloat(finish.time).toFixed(3)}s</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
