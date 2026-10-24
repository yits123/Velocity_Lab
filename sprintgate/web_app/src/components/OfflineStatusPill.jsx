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

import React from 'react';
import { Wifi, WifiOff, Cloud, CloudOff, RefreshCw } from 'lucide-react';

/**
 * OfflineStatusPill.jsx
 * Velocity Lab - Non-intrusive Offline-First Connectivity & Sync Status Indicator
 * 
 * Accurately communicates real-time connectivity states:
 * - LIVE: Cloud and Gate hardware both connected (Emerald)
 * - CACHED: Gate connected locally, Cloud offline (Amber)
 * - CLOUD: Cloud active, Gate awaiting connection (Sky)
 * - OFFLINE: Fully offline, local IndexedDB queue active (Slate/Rose)
 * - Shows pending sync count badge when queued runs exist
 */
function OfflineStatusPill({
  isOnline = true,
  isGateOnline = false,
  queuedCount = 0,
  isSyncing = false,
  className = ''
}) {
  let statusState = 'offline';
  let badgeColor = 'bg-slate-500/15 border-slate-500/30 text-slate-400';
  let dotColor = 'bg-slate-500';
  let label = 'OFFLINE';
  let tooltip = 'Offline: Local standalone mode active. Results stored on device.';

  if (isOnline && isGateOnline) {
    statusState = 'live';
    badgeColor = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400';
    dotColor = 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]';
    label = 'LIVE';
    tooltip = 'Full Telemetry: Cloud sync & Laser Gate online';
  } else if (!isOnline && isGateOnline) {
    statusState = 'cached';
    badgeColor = 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400';
    dotColor = 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]';
    label = 'CACHED';
    tooltip = 'Field Mode: Laser Gate online, offline caching enabled';
  } else if (isOnline && !isGateOnline) {
    statusState = 'cloud';
    badgeColor = 'bg-sky-500/10 border-sky-500/30 text-sky-600 dark:text-sky-400';
    dotColor = 'bg-sky-500';
    label = 'CLOUD';
    tooltip = 'Cloud connected • Gate standby';
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-mono font-bold tracking-wider select-none transition-colors ${badgeColor} ${className}`}
      title={tooltip}
      role="status"
      aria-live="polite"
    >
      {/* Pulse dot or Sync spinner */}
      {isSyncing ? (
        <RefreshCw size={11} className="animate-spin text-amber-500 shrink-0" />
      ) : (
        <span className="relative flex h-2 w-2 shrink-0">
          {statusState === 'live' && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${dotColor}`} />
        </span>
      )}

      {/* Status Label */}
      <span className="uppercase text-[10px] leading-none font-bold">
        {isSyncing ? 'SYNCING' : label}
      </span>

      {/* Queued Records Badge (if offline items pending) */}
      {queuedCount > 0 && (
        <span
          className="ml-0.5 px-1 py-0.2 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-500 border border-amber-500/30"
          title={`${queuedCount} record(s) queued locally awaiting cloud sync`}
        >
          +{queuedCount}
        </span>
      )}
    </div>
  );
}

export default React.memo(OfflineStatusPill);
