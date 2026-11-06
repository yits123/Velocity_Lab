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

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Flag, CheckCircle2, Zap, ArrowRight, Activity, ShieldCheck } from 'lucide-react';

/**
 * SplitTrackVisualizer.jsx
 * Velocity Lab - Multi-Gate Split Sector Track Diagram
 * 
 * Powered by Motion graphics:
 * - Animated laser beam occlusion & radial shockwaves when intermediate gates fire
 * - Kinetic leading beam particle tracking athlete's progress
 * - Dynamic sector split differential labels (delta time between consecutive gates)
 * - Tactile hover tooltips for sector speed diagnostics
 */
function SplitTrackVisualizer({
  trackDistance = 40,
  liveSplits = [],
  sequenceState = 'idle',
  isRunning = false,
  className = ''
}) {
  const distNum = parseFloat(trackDistance) || 40;
  const [hoveredNode, setHoveredNode] = useState(null);

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
          status: isFired ? 'fired' : sequenceState === 'waiting_start' ? 'armed' : 'idle',
          sectorDelta: null
        };
      }

      if (cp.isFinish) {
        const isFired = sequenceState === 'finished';
        const finishSplit = liveSplits.find(s => Math.abs(s.distanceMeters - distNum) < 1) || (isFired ? liveSplits[liveSplits.length - 1] : null);
        const prevSplit = liveSplits[liveSplits.length - 2] || { time: 0 };
        const sectorDelta = finishSplit && prevSplit ? Math.max(0, parseFloat(finishSplit.time) - parseFloat(prevSplit.time)) : null;

        return {
          ...cp,
          time: finishSplit ? finishSplit.time : null,
          status: isFired ? 'fired' : isRunning ? 'armed' : 'idle',
          sectorDelta
        };
      }

      // Intermediate gates
      const matchedSplit = liveSplits.find(s => Math.abs(s.distanceMeters - cp.distance) < 2);
      const isPast = matchedSplit || (liveSplits.length > 0 && liveSplits[liveSplits.length - 1]?.distanceMeters >= cp.distance);
      
      const splitIndex = liveSplits.findIndex(s => Math.abs(s.distanceMeters - cp.distance) < 2);
      let sectorDelta = null;
      if (splitIndex >= 0) {
        const currTime = parseFloat(liveSplits[splitIndex].time);
        const prevTime = splitIndex > 0 ? parseFloat(liveSplits[splitIndex - 1].time) : 0;
        sectorDelta = Math.max(0, currTime - prevTime);
      }

      return {
        ...cp,
        time: matchedSplit ? matchedSplit.time : null,
        status: isPast ? 'fired' : isRunning ? 'armed' : 'idle',
        sectorDelta
      };
    });
  }, [checkpoints, liveSplits, sequenceState, isRunning, distNum]);

  const firedCount = resolvedNodes.filter(n => n.status === 'fired').length;
  const progressRatio = resolvedNodes.length > 1
    ? Math.max(0, firedCount - 1) / (resolvedNodes.length - 1)
    : 0;

  return (
    <div className={`w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-gray-200 dark:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-xs select-none relative overflow-hidden ${className}`}>
      
      {/* Laser Optical Scanline Drift (When armed or running) */}
      {(isRunning || sequenceState === 'waiting_start') && (
        <motion.div 
          initial={{ x: "-100%" }}
          animate={{ x: "200%" }}
          transition={{ repeat: Infinity, duration: 2.2, ease: "linear" }}
          className="absolute top-0 bottom-0 w-24 bg-gradient-to-r from-transparent via-cyan-400/10 to-transparent pointer-events-none -skew-x-12"
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 dark:border-slate-800 relative z-10">
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-[var(--accent-color,#00D084)]" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
            Split Lane Visualizer ({distNum}m Track)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
            {liveSplits.length} gate(s) triggered
          </span>
        </div>
      </div>

      {/* Horizontal Track Lane with Spring Physics */}
      <div className="relative pt-4 pb-2 px-3 overflow-x-auto scrollbar-none z-10">
        {/* Background Track Rail */}
        <div className="absolute top-[34px] left-6 right-6 h-1.5 -translate-y-1/2 bg-gray-200 dark:bg-slate-800 rounded-full" />
        
        {/* Active Laser Fired Progress Ribbon */}
        <motion.div 
          className="absolute top-[34px] left-6 h-1.5 -translate-y-1/2 bg-gradient-to-r from-cyan-500 via-[var(--accent-color,#00D084)] to-emerald-400 rounded-full shadow-[0_0_12px_rgba(0,208,132,0.6)]"
          initial={false}
          animate={{
            width: `calc(${progressRatio * 100}% - ${progressRatio > 0 ? '12px' : '0px'})`
          }}
          transition={{ type: "spring", stiffness: 220, damping: 24 }}
        />

        {/* Gate Nodes with Concentric Laser Emitters */}
        <div className="relative flex items-center justify-between min-w-[280px]">
          {resolvedNodes.map((node, i) => {
            const isFired = node.status === 'fired';
            const isArmed = node.status === 'armed';

            return (
              <div 
                key={i} 
                className="flex flex-col items-center relative z-10 cursor-pointer"
                onMouseEnter={() => setHoveredNode(node)}
                onMouseLeave={() => setHoveredNode(null)}
              >
                {/* Single-Shot Optical Shockwave Ring on Trigger */}
                <AnimatePresence>
                  {isFired && (
                    <motion.div
                      key={`shock-${i}`}
                      initial={{ scale: 0.6, opacity: 0.9 }}
                      animate={{ scale: 2.1, opacity: 0 }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className="absolute top-0 w-7 h-7 rounded-full bg-emerald-400/40 pointer-events-none -z-10"
                    />
                  )}
                </AnimatePresence>

                {/* Node Pod Button */}
                <motion.div 
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.92 }}
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border-2 transition-colors relative ${
                    isFired
                      ? 'bg-[var(--accent-color,#00D084)] border-emerald-300 text-slate-900 shadow-[0_0_14px_rgba(0,208,132,0.7)]'
                      : isArmed
                      ? 'bg-amber-500/20 border-amber-400 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.4)]'
                      : 'bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-700 text-gray-400'
                  }`}
                  title={`${node.label} — ${isFired ? `Passed at ${node.time != null ? Number(node.time).toFixed(2) + 's' : '0.00s'}` : isArmed ? 'Laser Armed' : 'Standby'}`}
                >
                  {isArmed && (
                    <motion.span 
                      animate={{ scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] }}
                      transition={{ repeat: Infinity, duration: 1.2 }}
                      className="absolute inset-0 rounded-full border border-amber-400/60 pointer-events-none"
                    />
                  )}

                  {isFired ? (
                    <CheckCircle2 size={14} strokeWidth={3} />
                  ) : node.isFinish ? (
                    <Flag size={12} />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  )}
                </motion.div>

                {/* Gate Distance Label */}
                <span className="text-[10px] font-bold font-mono mt-1.5 text-gray-700 dark:text-gray-300">
                  {node.label}
                </span>

                {/* Split Time Tag */}
                <span className="text-[10px] font-mono text-[var(--accent-color,#00D084)] font-extrabold h-4 flex items-center">
                  {node.time != null && node.time > 0 ? (
                    <motion.span
                      initial={{ opacity: 0, y: -2 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="tabular-nums"
                    >
                      {Number(node.time).toFixed(2)}s
                    </motion.span>
                  ) : ''}
                </span>

                {/* Micro Sector Delta Tag (e.g. +1.12s sector time) */}
                {node.sectorDelta != null && node.sectorDelta > 0 && (
                  <span className="text-[8px] font-mono font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 px-1 py-0.2 rounded mt-0.5">
                    +{node.sectorDelta.toFixed(2)}s
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default React.memo(SplitTrackVisualizer);
