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

import React, { useMemo } from 'react';
import { Flag, CheckCircle2, Zap, ArrowRight } from 'lucide-react';

/**
 * SplitTrackVisualizer.jsx
 * Velocity Lab - Multi-Gate Split Sector Track Diagram
 * 
 * Renders an Olympic-style horizontal running track lane visualizer
 * that dynamically animates as athletes trigger intermediate laser gates.
 */
function SplitTrackVisualizer({
  trackDistance = 40,
  liveSplits = [],
  sequenceState = 'idle',
  isRunning = false,
  className = ''
}) {
  const distNum = parseFloat(trackDistance) || 40;

  // Compute default checkpoints based on track distance (e.g. 10m intervals)
  const checkpoints = useMemo(() => {
    const list = [{ distance: 0, label: 'START (0m)', isStart: true }];
    const step = distNum <= 30 ? 10 : distNum <= 60 ? 10 : 20;

    for (let d = step; d < distNum; d += step) {
      list.push({ distance: d, label: `${d}m`, isIntermediate: true });
    }

    list.push({ distance: distNum, label: `FINISH (${distNum}m)`, isFinish: true });
    return list;
  }, [distNum]);

  // Map fired splits to checkpoints
  const resolvedNodes = useMemo(() => {
    return checkpoints.map((cp, idx) => {
      if (cp.isStart) {
        const isFired = isRunning || liveSplits.length > 0 || sequenceState === 'finished';
        return {
          ...cp,
          time: 0.0,
          status: isFired ? 'fired' : sequenceState === 'waiting_start' ? 'armed' : 'idle'
        };
      }

      if (cp.isFinish) {
        const isFired = sequenceState === 'finished';
        const finishSplit = liveSplits.find(s => Math.abs(s.distanceMeters - distNum) < 1) || (isFired ? liveSplits[liveSplits.length - 1] : null);
        return {
          ...cp,
          time: finishSplit ? finishSplit.time : null,
          status: isFired ? 'fired' : isRunning ? 'armed' : 'idle'
        };
      }

      // Intermediate gates
      const matchedSplit = liveSplits.find(s => Math.abs(s.distanceMeters - cp.distance) < 2);
      const isPast = matchedSplit || (liveSplits.length > 0 && liveSplits[liveSplits.length - 1]?.distanceMeters >= cp.distance);

      return {
        ...cp,
        time: matchedSplit ? matchedSplit.time : null,
        status: isPast ? 'fired' : isRunning ? 'armed' : 'idle'
      };
    });
  }, [checkpoints, liveSplits, sequenceState, isRunning, distNum]);

  return (
    <div className={`w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-gray-200 dark:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-xs select-none ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-[var(--accent-color,#00E599)]" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
            Split Lane Visualizer ({distNum}m Track)
          </span>
        </div>
        <span className="text-[10px] font-mono font-semibold text-gray-400">
          {liveSplits.length} gate(s) triggered
        </span>
      </div>

      {/* Horizontal Track Lane */}
      <div className="relative pt-3 pb-2 px-2 overflow-x-auto scrollbar-none">
        {/* Track Line / Rails */}
        <div className="absolute top-1/2 left-6 right-6 h-1 -translate-y-1/2 bg-gray-200 dark:bg-slate-800 rounded-full" />
        
        {/* Fired Progress Ribbon */}
        <div 
          className="absolute top-1/2 left-6 h-1 -translate-y-1/2 bg-[var(--accent-color,#00E599)] rounded-full transition-all duration-300"
          style={{
            width: resolvedNodes.length > 1
              ? `${(Math.max(0, resolvedNodes.filter(n => n.status === 'fired').length - 1) / (resolvedNodes.length - 1)) * 100}%`
              : '0%'
          }}
        />

        {/* Gate Nodes */}
        <div className="relative flex items-center justify-between min-w-[280px]">
          {resolvedNodes.map((node, i) => {
            const isFired = node.status === 'fired';
            const isArmed = node.status === 'armed';

            return (
              <div key={i} className="flex flex-col items-center relative z-10">
                {/* Node Pod */}
                <div 
                  className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center border-2 transition-all ${
                    isFired
                      ? 'bg-[var(--accent-color,#00E599)] border-emerald-400 text-slate-900 shadow-[0_0_12px_rgba(0,229,153,0.6)]'
                      : isArmed
                      ? 'bg-amber-500/20 border-amber-500 text-amber-500 animate-pulse'
                      : 'bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-700 text-gray-400'
                  }`}
                  title={`${node.label} — ${isFired ? `Passed at ${node.time != null ? Number(node.time).toFixed(2) + 's' : '0.00s'}` : isArmed ? 'Laser Armed' : 'Standby'}`}
                >
                  {isFired ? (
                    <CheckCircle2 size={13} strokeWidth={3} />
                  ) : node.isFinish ? (
                    <Flag size={11} />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  )}
                </div>

                {/* Gate Distance Label */}
                <span className="text-[10px] font-bold font-mono mt-1 text-gray-700 dark:text-gray-300">
                  {node.label}
                </span>

                {/* Split Time Tag */}
                <span className="text-[10px] font-mono text-[var(--accent-color,#00E599)] font-extrabold h-3">
                  {node.time != null && node.time > 0 ? `${Number(node.time).toFixed(2)}s` : ''}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default React.memo(SplitTrackVisualizer);
