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

import React, { useState } from 'react';
import { Activity, ChevronDown, ChevronUp, User, Zap } from 'lucide-react';

/**
 * LiveMiniHUD.jsx
 * Velocity Lab - Floating Telemetry Mini-Capsule
 * 
 * Provides an always-visible, non-intrusive HUD overlay for coaches on track:
 * - Active Runner on track
 * - High-speed running elapsed time
 * - Next athlete on deck in the queue
 * - Collapsible with a quick tap to save screen space
 */
function LiveMiniHUD({
  displayTime = 0,
  sequenceState = 'idle',
  isRunning = false,
  activeRunner = null,
  nextRunner = null,
  className = ''
}) {
  const [collapsed, setCollapsed] = useState(false);

  const isActive = isRunning || sequenceState === 'running' || sequenceState === 'waiting_start' || sequenceState === 'waiting_gun';

  // Only appear when an active session is in progress or armed
  if (!isActive && sequenceState !== 'finished') {
    return null;
  }

  const timeNum = typeof displayTime === 'number' ? displayTime : parseFloat(displayTime) || 0;
  const isFinished = sequenceState === 'finished';

  return (
    <aside
      className={`fixed bottom-18 md:bottom-6 right-3 md:right-6 z-40 select-none transition-all duration-200 ${className}`}
      aria-label="Live Timing Mini HUD"
    >
      <div className="bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-xl border border-slate-700/80 dark:border-slate-800 shadow-2xl rounded-2xl p-2.5 sm:p-3 text-white min-w-[170px] max-w-[240px]">
        {/* Header / Collapse Toggle */}
        <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-1.5 mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isFinished ? 'bg-amber-400' : 'bg-emerald-400'} opacity-75`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isFinished ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            </span>
            <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-slate-300">
              {isFinished ? 'FINISHED' : 'ON TRACK'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition"
            aria-label={collapsed ? 'Expand HUD' : 'Collapse HUD'}
          >
            {collapsed ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>

        {/* Live Timer Clock */}
        <div className="flex items-baseline justify-between gap-1">
          <div className="font-mono font-black text-2xl sm:text-3xl tracking-tight text-[var(--accent-color,#00E599)] tabular-nums">
            {timeNum.toFixed(2)}
            <span className="text-xs font-semibold ml-1 text-slate-400">s</span>
          </div>
          {sequenceState === 'waiting_start' && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
              SET
            </span>
          )}
        </div>

        {/* Expanded Runner Details */}
        {!collapsed && (
          <div className="mt-1.5 pt-1.5 border-t border-white/10 space-y-1 text-[11px]">
            <div className="flex items-center justify-between text-slate-300 truncate">
              <span className="flex items-center gap-1 text-slate-400 text-[10px]">
                <User size={10} /> Runner:
              </span>
              <span className="font-bold text-white truncate max-w-[100px]">
                {activeRunner?.name || 'In Lane'}
              </span>
            </div>

            {nextRunner && (
              <div className="flex items-center justify-between text-slate-400 text-[10px] truncate">
                <span>On Deck:</span>
                <span className="text-slate-300 truncate max-w-[90px]">
                  {nextRunner.name}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

export default React.memo(LiveMiniHUD);
