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
import { Activity, Radio, Zap, CheckCircle2, AlertTriangle, ShieldAlert, Usb, Bluetooth, Wifi, Sliders } from 'lucide-react';

/**
 * GateTrafficLights.jsx (Revamped to Olympic Laser Gate Telemetry Hub)
 * Sleek, high-tech athletic photocell gate telemetry indicator:
 * - Start Photocell Pod (Start Gate • 0m)
 * - Animated Laser Interconnect Waveguide
 * - Finish Photocell Pod (Finish Gate • Distance)
 * - Sub-millisecond Hardware Sync Gateway Status (Gate Link)
 * - Multi-Modal Hardware Settings & Connection Hub (USB-C, BLE, Wi-Fi)
 * 
 * Re-architected to a ultra-compact vertical structure (Icons above, names below)
 * to prevent multi-line wrapping and layout overflow on tablets, mobile and desktop.
 */
function GateTrafficLights({
  statusA = { online: false, beam_broken: false },
  statusB = { online: false, beam_broken: false, reconnecting: false, reconnectAttempts: 0 },
  setStatusA,
  setStatusB,
  trackDistance = 40,
  nodeA = '',
  nodeB = '',
  isSerialConnected = false,
  isBleConnected = false,
  onOpenConnectionModal,
  className = ''
}) {
  const isNodeAOnline = Boolean(statusA?.online) || isSerialConnected || isBleConnected;
  const isNodeBOnline = Boolean(statusB?.online) || isSerialConnected || isBleConnected;
  const isGatesOnline = isNodeAOnline && isNodeBOnline;
  const isNodeABlocked = isNodeAOnline && Boolean(statusA?.beam_broken);
  const isNodeBBlocked = isNodeBOnline && Boolean(statusB?.beam_broken);
  const isAnyBeamBlocked = isGatesOnline && (isNodeABlocked || isNodeBBlocked);

  const activeLinkMode = isSerialConnected 
    ? 'usbc' 
    : isBleConnected 
    ? 'ble' 
    : Boolean(statusB?.online) 
    ? 'wifi' 
    : 'none';

  const handleOpenHub = () => {
    if (typeof onOpenConnectionModal === 'function') {
      onOpenConnectionModal();
    }
  };

  return (
    <div className={`w-full flex justify-center mb-2 sm:mb-3 z-20 px-2 ${className}`}>
      {/* Precision Laser Gate Telemetry Capsule - Compact, Non-wrapping Single-Row Hub */}
      <div className="inline-flex items-center justify-center flex-nowrap bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800/90 rounded-2xl px-2 sm:px-3 py-1.5 shadow-sm dark:shadow-xl gap-1 sm:gap-2 select-none transition-all max-w-full overflow-x-auto scrollbar-none">
        
        {/* POD 1: START GATE (START LASER • 0M) */}
        <button
          type="button"
          onClick={handleOpenHub}
          title={`Start Gate (0m) ${nodeA ? `[${nodeA}]` : ''} — ${isNodeAOnline ? (isNodeABlocked ? 'BEAM BLOCKED' : 'ONLINE') : 'OFFLINE'} • Click to open Hardware Hub`}
          className="group flex flex-col items-center justify-center px-1.5 sm:px-2 py-0.5 rounded-xl hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-all cursor-pointer focus:outline-none min-w-[56px] sm:min-w-[64px]"
        >
          {/* Laser Emitter Pod Icon Above */}
          <div className="relative flex items-center justify-center shrink-0">
            <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center transition-all ${
              isNodeAOnline
                ? isNodeABlocked
                  ? 'bg-amber-500/15 border border-amber-500/40 text-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.35)]'
                  : 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.35)]'
                : 'bg-rose-500/10 border border-rose-500/30 text-rose-500'
            }`}>
              <Zap size={13} className={isNodeABlocked ? 'animate-bounce' : ''} />
            </div>

            {/* Micro Pulsing Status LED */}
            <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-white dark:border-slate-900 ${
              isNodeAOnline
                ? isNodeABlocked
                  ? 'bg-amber-500 animate-ping'
                  : 'bg-emerald-500'
                : 'bg-rose-500'
            }`} />
          </div>

          {/* Names & Status Below */}
          <div className="flex flex-col items-center text-center mt-1 leading-tight">
            <span className="text-[9px] sm:text-[10px] font-mono font-black text-slate-700 dark:text-slate-200 tracking-wider whitespace-nowrap">
              START GATE
            </span>
            <div className="flex items-center gap-1 mt-0.5 whitespace-nowrap">
              <span className="text-[8px] font-mono font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 py-0.2 rounded">
                0m
              </span>
              <span className={`text-[8px] sm:text-[9px] font-mono font-extrabold uppercase tracking-wider ${
                isNodeAOnline
                  ? isNodeABlocked
                    ? 'text-amber-500 animate-pulse'
                    : 'text-emerald-500'
                  : 'text-rose-500'
              }`}>
                {isNodeAOnline ? (isNodeABlocked ? 'BLOCKED' : 'ONLINE') : 'OFFLINE'}
              </span>
            </div>
          </div>
        </button>

        {/* INTERCONNECTING LASER BEAM WAVEGUIDE */}
        <div className="flex items-center px-0.5 sm:px-1 shrink-0">
          <div className={`h-0.5 w-3 sm:w-6 rounded-full transition-all duration-300 relative ${
            isGatesOnline
              ? isAnyBeamBlocked
                ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)] animate-pulse'
                : 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
              : 'bg-slate-200 dark:bg-slate-800'
          }`} />
        </div>

        {/* POD 2: FINISH GATE (FINISH LASER • DISTANCE) */}
        <button
          type="button"
          onClick={handleOpenHub}
          title={`Finish Gate (${trackDistance || 40}m) ${nodeB ? `[${nodeB}]` : ''} — ${isNodeBOnline ? (isNodeBBlocked ? 'BEAM BLOCKED' : 'ONLINE') : statusB?.reconnecting ? `RETRYING (${statusB?.reconnectAttempts || 1})` : 'OFFLINE'} • Click to open Hardware Hub`}
          className="group flex flex-col items-center justify-center px-1.5 sm:px-2 py-0.5 rounded-xl hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-all cursor-pointer focus:outline-none min-w-[56px] sm:min-w-[64px]"
        >
          {/* Laser Emitter Pod Icon Above */}
          <div className="relative flex items-center justify-center shrink-0">
            <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center transition-all ${
              isNodeBOnline
                ? isNodeBBlocked
                  ? 'bg-amber-500/15 border border-amber-500/40 text-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.35)]'
                  : 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.35)]'
                : statusB?.reconnecting
                ? 'bg-amber-500/15 border border-amber-500/40 text-amber-500 animate-pulse'
                : 'bg-rose-500/10 border border-rose-500/30 text-rose-500'
            }`}>
              <Radio size={13} className={isNodeBBlocked ? 'animate-bounce' : ''} />
            </div>

            {/* Micro Pulsing Status LED */}
            <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-white dark:border-slate-900 ${
              isNodeBOnline
                ? isNodeBBlocked
                  ? 'bg-amber-500 animate-ping'
                  : 'bg-emerald-500'
                : statusB?.reconnecting
                ? 'bg-amber-500 animate-pulse'
                : 'bg-rose-500'
            }`} />
          </div>

          {/* Names & Status Below */}
          <div className="flex flex-col items-center text-center mt-1 leading-tight">
            <span className="text-[9px] sm:text-[10px] font-mono font-black text-slate-700 dark:text-slate-200 tracking-wider whitespace-nowrap">
              FINISH GATE
            </span>
            <div className="flex items-center gap-1 mt-0.5 whitespace-nowrap">
              <span className="text-[8px] font-mono font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 py-0.2 rounded">
                {trackDistance || 40}m
              </span>
              <span className={`text-[8px] sm:text-[9px] font-mono font-extrabold uppercase tracking-wider ${
                isNodeBOnline
                  ? isNodeBBlocked
                    ? 'text-amber-500 animate-pulse'
                    : 'text-emerald-500'
                  : statusB?.reconnecting
                  ? 'text-amber-500 animate-pulse'
                  : 'text-rose-500'
              }`}>
                {isNodeBOnline
                  ? isNodeBBlocked
                    ? 'BLOCKED'
                    : 'ONLINE'
                  : statusB?.reconnecting
                  ? `RETRY (${statusB?.reconnectAttempts || 1})`
                  : 'OFFLINE'}
              </span>
            </div>
          </div>
        </button>

        {/* Divider */}
        <div className="h-6 sm:h-7 w-px bg-slate-200 dark:bg-slate-800 shrink-0 mx-0.5" />

        {/* POD 3: GATE LINK TELEMETRY (MASTER SYNC) */}
        <button
          type="button"
          onClick={handleOpenHub}
          title={`Photocell Laser Link — ${isGatesOnline ? (isAnyBeamBlocked ? 'BEAM BLOCKED' : 'ALL GATES ARMED & READY') : 'GATES DISCONNECTED'} • Click to open Hardware Hub`}
          className="group flex flex-col items-center justify-center px-1.5 sm:px-2 py-0.5 rounded-xl hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-all cursor-pointer focus:outline-none min-w-[56px] sm:min-w-[64px]"
        >
          {/* Gate Link Icon Above */}
          <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center transition-all shrink-0 ${
            isGatesOnline
              ? isAnyBeamBlocked
                ? 'bg-amber-500/15 border border-amber-500/40 text-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.35)]'
                : 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.35)]'
              : 'bg-rose-500/10 border border-rose-500/30 text-rose-500'
          }`}>
            {isGatesOnline ? (
              isAnyBeamBlocked ? <AlertTriangle size={13} className="animate-pulse" /> : <CheckCircle2 size={13} />
            ) : (
              <ShieldAlert size={13} />
            )}
          </div>

          {/* Names & Status Below */}
          <div className="flex flex-col items-center text-center mt-1 leading-tight">
            <span className="text-[9px] sm:text-[10px] font-mono font-black text-slate-700 dark:text-slate-200 tracking-wider whitespace-nowrap">
              GATE LINK
            </span>
            <div className="flex items-center gap-1 mt-0.5 whitespace-nowrap">
              <span className="text-[8px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded font-bold">
                ±1ms
              </span>
              <span className={`text-[8px] sm:text-[9px] font-mono font-extrabold uppercase tracking-wider ${
                isGatesOnline
                  ? isAnyBeamBlocked
                    ? 'text-amber-500 animate-pulse'
                    : 'text-emerald-500'
                  : 'text-rose-500'
              }`}>
                {isGatesOnline ? (isAnyBeamBlocked ? 'BLOCKED' : 'ARMED') : 'OFFLINE'}
              </span>
            </div>
          </div>
        </button>

        {/* Divider */}
        {onOpenConnectionModal && (
          <div className="h-6 sm:h-7 w-px bg-slate-200 dark:bg-slate-800 shrink-0 mx-0.5" />
        )}

        {/* POD 4: HARDWARE CONNECTION & SETTINGS TRIGGER */}
        {onOpenConnectionModal && (
          <button
            type="button"
            onClick={onOpenConnectionModal}
            title="Open SprintGate Connection & Hardware Settings Hub (Wi-Fi, USB-C, BLE)"
            className="group flex flex-col items-center justify-center px-1.5 sm:px-2 py-0.5 rounded-xl hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-all cursor-pointer focus:outline-none min-w-[56px] sm:min-w-[64px]"
          >
            {/* Settings Icon Above */}
            <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center transition-all shrink-0 ${
              activeLinkMode === 'usbc'
                ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.35)]'
                : activeLinkMode === 'ble'
                ? 'bg-sky-500/15 border border-sky-500/40 text-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.35)]'
                : activeLinkMode === 'wifi'
                ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.35)]'
                : 'bg-amber-500/15 border border-amber-500/40 text-amber-500 animate-pulse'
            }`}>
              {activeLinkMode === 'usbc' ? (
                <Usb size={13} className="text-emerald-500" />
              ) : activeLinkMode === 'ble' ? (
                <Bluetooth size={13} className="text-sky-500" />
              ) : activeLinkMode === 'wifi' ? (
                <Wifi size={13} className="text-emerald-500" />
              ) : (
                <Sliders size={13} className="text-amber-500" />
              )}
            </div>

            {/* Names & Status Below */}
            <div className="flex flex-col items-center text-center mt-1 leading-tight">
              <span className="text-[9px] sm:text-[10px] font-mono font-black text-slate-700 dark:text-slate-200 tracking-wider whitespace-nowrap">
                SETTINGS
              </span>
              <span className={`text-[8px] sm:text-[9px] font-mono font-extrabold uppercase mt-0.5 tracking-wider whitespace-nowrap ${
                activeLinkMode === 'usbc'
                  ? 'text-emerald-500'
                  : activeLinkMode === 'ble'
                  ? 'text-sky-500'
                  : activeLinkMode === 'wifi'
                  ? 'text-emerald-500'
                  : 'text-amber-500 animate-pulse'
              }`}>
                {activeLinkMode === 'usbc'
                  ? 'USB (0ms)'
                  : activeLinkMode === 'ble'
                  ? 'BLE'
                  : activeLinkMode === 'wifi'
                  ? 'WI-FI'
                  : 'CONNECT'}
              </span>
            </div>
          </button>
        )}

      </div>
    </div>
  );
}

export default React.memo(GateTrafficLights);
