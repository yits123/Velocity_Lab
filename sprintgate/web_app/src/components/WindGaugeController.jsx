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
import { 
  Wind, Compass, MapPin, RefreshCw, Sliders, Globe, 
  CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, Navigation, Info
} from 'lucide-react';
import { isLegalWind, calculateWindCorrection } from '../utils/windService';

/**
 * Interactive Wind Gauge Controller
 * Allows auto-fetching wind from multi-source GPS/meteorological stations
 * or manually inputting wind speed with World Athletics compliance checks.
 */
function WindGaugeController({
  windSpeed = '',
  setWindSpeed,
  windMode = 'manual', // 'auto' | 'manual'
  setWindMode,
  windMeta = null,
  isFetching = false,
  fetchError = null,
  onRefreshWind,
  compact = false
}) {
  const [showSourcesDetails, setShowSourcesDetails] = useState(false);

  // Parse numerical wind speed
  const numSpeed = parseFloat(windSpeed);
  const hasValidSpeed = !isNaN(numSpeed);
  const isWaLegal = hasValidSpeed ? isLegalWind(numSpeed) : true;
  const isTailwind = hasValidSpeed && numSpeed > 0;
  const isHeadwind = hasValidSpeed && numSpeed < 0;

  // Manual sign toggle (+ / -)
  const handleToggleSign = () => {
    if (!hasValidSpeed) {
      setWindSpeed('+1.0');
      return;
    }
    const abs = Math.abs(numSpeed);
    if (numSpeed >= 0) {
      setWindSpeed(`-${abs.toFixed(1)}`);
    } else {
      setWindSpeed(`+${abs.toFixed(1)}`);
    }
  };

  const handlePreset = (val) => {
    setWindSpeed(val);
  };

  return (
    <div className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-3 sm:p-3.5 flex flex-col gap-3 shadow-sm transition-all duration-200">
      
      {/* Top Header: Label & Mode Toggle Switch */}
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 dark:border-slate-700 pb-2.5">
        <div className="flex items-center gap-1.5">
          <Wind size={15} className="text-sky-500 dark:text-sky-400" />
          <span className="text-[11px] font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">
            Wind Condition
          </span>
        </div>

        {/* Toggle Mode Button */}
        <div className="inline-flex items-center bg-gray-100 dark:bg-slate-900 p-0.5 rounded-lg border border-gray-200 dark:border-slate-700">
          <button
            type="button"
            id="wind-toggle-auto"
            onClick={() => {
              setWindMode('auto');
              if (onRefreshWind) onRefreshWind();
            }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
              windMode === 'auto'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
            title="Auto-fetch live wind speed from GPS and meteorological sources"
          >
            <Globe size={11} className={windMode === 'auto' && isFetching ? 'animate-spin' : ''} />
            <span>Auto (GPS)</span>
          </button>

          <button
            type="button"
            id="wind-toggle-manual"
            onClick={() => setWindMode('manual')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
              windMode === 'manual'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
            title="Manually enter or adjust wind speed"
          >
            <Sliders size={11} />
            <span>Manual</span>
          </button>
        </div>
      </div>

      {/* AUTO MODE BODY */}
      {windMode === 'auto' && (
        <div className="flex flex-col gap-2.5">
          {/* Location & Status Bar */}
          <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1 font-medium truncate max-w-[200px]" title={windMeta?.locationName || 'Detecting GPS location...'}>
              <MapPin size={11} className="text-rose-500 shrink-0" />
              <span className="truncate">{windMeta?.locationName || 'Detecting GPS location...'}</span>
            </span>

            <button
              type="button"
              disabled={isFetching}
              onClick={onRefreshWind}
              className="flex items-center gap-1 text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:underline disabled:opacity-50 transition-opacity ml-2 shrink-0"
            >
              <RefreshCw size={11} className={isFetching ? 'animate-spin text-sky-500' : ''} />
              <span>{isFetching ? 'Syncing...' : 'Refresh'}</span>
            </button>
          </div>

          {/* Fetching Skeleton / State */}
          {isFetching && !windSpeed && (
            <div className="bg-sky-500/10 border border-sky-500/25 rounded-lg p-3 flex items-center justify-center gap-2 text-xs font-semibold text-sky-700 dark:text-sky-300 animate-pulse">
              <RefreshCw size={14} className="animate-spin" />
              <span>Querying Open-Meteo, NOAA GFS, & wttr.in...</span>
            </div>
          )}

          {/* Error Alert Box */}
          {fetchError && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-2.5 text-xs text-rose-700 dark:text-rose-300 flex flex-col gap-1.5">
              <div className="flex items-start gap-1.5">
                <AlertTriangle size={14} className="text-rose-500 shrink-0 mt-0.5" />
                <span className="leading-tight">{fetchError}</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={onRefreshWind}
                  className="px-2 py-0.5 bg-rose-600 text-white rounded text-[10px] font-bold hover:bg-rose-700"
                >
                  Retry GPS
                </button>
                <button
                  type="button"
                  onClick={() => setWindMode('manual')}
                  className="px-2 py-0.5 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded text-[10px] font-bold hover:bg-gray-300 dark:hover:bg-slate-600"
                >
                  Enter Manually
                </button>
              </div>
            </div>
          )}

          {/* Active Auto Readings */}
          {windSpeed !== '' && (
            <div className="bg-white dark:bg-slate-900 rounded-lg p-2.5 border border-gray-200 dark:border-slate-700 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black tracking-tight text-gray-900 dark:text-white font-mono">
                    {windSpeed}
                  </span>
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400">m/s</span>
                  {windMeta?.directionCardinal && (
                    <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 text-[10px] font-black border border-sky-200 dark:border-sky-800">
                      <Compass size={10} style={{ transform: `rotate(${windMeta?.directionDeg || 0}deg)` }} />
                      {windMeta.directionCardinal} ({windMeta.directionDeg}°)
                    </span>
                  )}
                </div>

                {/* World Athletics Legal / Wind-Assisted Badge */}
                <div className="text-right">
                  {hasValidSpeed && (
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                      isWaLegal
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                        : 'bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300'
                    }`}>
                      {isWaLegal ? <CheckCircle2 size={10} /> : <AlertTriangle size={10} />}
                      {isWaLegal ? 'WA Legal' : 'Wind-Assisted'}
                    </span>
                  )}
                </div>
              </div>

              {/* Source Consensus Pill & Collapsible Details */}
              <div className="pt-1 border-t border-gray-100 dark:border-slate-800 flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowSourcesDetails(!showSourcesDetails)}
                  className="w-full flex items-center justify-between text-[10px] font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                >
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span>Consensus from {windMeta?.sourcesCount || 3} Meteorological Stations</span>
                  </span>
                  {showSourcesDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>

                {showSourcesDetails && windMeta?.sources && (
                  <div className="bg-white dark:bg-slate-950/80 rounded border border-gray-200 dark:border-slate-800 p-2 flex flex-col gap-1 text-[10px] text-gray-600 dark:text-gray-300 mt-1">
                    {windMeta.sources.map((s, idx) => (
                      <div key={idx} className="flex items-center justify-between font-mono">
                        <span className="truncate max-w-[140px] text-gray-500 dark:text-gray-400 font-sans">{s.name}:</span>
                        <span className="font-bold text-gray-800 dark:text-gray-200">
                          {s.speed > 0 ? `+${s.speed.toFixed(1)}` : s.speed.toFixed(1)} m/s
                          {s.direction !== null ? ` (${Math.round(s.direction)}°)` : ''}
                        </span>
                      </div>
                    ))}
                    {windMeta.timestamp && (
                      <div className="text-[9px] text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-slate-800/80 pt-1 mt-0.5">
                        Synced: {windMeta.timestamp}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MANUAL MODE BODY */}
      {windMode === 'manual' && (
        <div className="flex flex-col gap-2.5">
          {/* Input Box with Tailwind / Headwind Quick Switch */}
          <div className="flex items-center gap-1.5">
            <div className="flex-1 flex items-center bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-emerald-500/40 focus-within:border-emerald-500 dark:focus-within:border-emerald-400">
              <input
                type="number"
                step="0.1"
                id="wind-speed-input"
                value={windSpeed}
                onChange={(e) => setWindSpeed(e.target.value)}
                className="bg-transparent border-none text-sm font-black font-mono text-gray-900 dark:text-white w-full focus:outline-none"
                placeholder="e.g. +1.2"
              />
              <span className="text-gray-500 dark:text-gray-400 font-bold ml-1 text-xs">m/s</span>
            </div>

            {/* Invert Sign Button (+ / -) */}
            <button
              type="button"
              onClick={handleToggleSign}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-black transition-colors ${
                isHeadwind 
                  ? 'bg-rose-500/15 border-rose-500/30 text-rose-700 dark:text-rose-300' 
                  : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              }`}
              title="Toggle Tailwind (+) vs Headwind (-)"
            >
              {isHeadwind ? 'Head (-)' : 'Tail (+)'}
            </button>
          </div>

          {/* Quick Presets for Track & Field */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handlePreset('0.0')}
              className="flex-1 py-1 rounded bg-gray-100 hover:bg-gray-200 dark:bg-slate-900 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 text-[10px] font-bold transition-colors"
            >
              0.0 Calm
            </button>
            <button
              type="button"
              onClick={() => handlePreset('+1.0')}
              className="flex-1 py-1 rounded bg-gray-100 hover:bg-gray-200 dark:bg-slate-900 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 text-[10px] font-bold transition-colors"
            >
              +1.0 m/s
            </button>
            <button
              type="button"
              onClick={() => handlePreset('+2.0')}
              className="flex-1 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/40 text-[10px] font-bold transition-colors"
              title="World Athletics maximum legal record limit"
            >
              +2.0 WA
            </button>
            <button
              type="button"
              onClick={() => handlePreset('-1.0')}
              className="flex-1 py-1 rounded bg-gray-100 hover:bg-gray-200 dark:bg-slate-900 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 text-[10px] font-bold transition-colors"
            >
              -1.0 m/s
            </button>
          </div>

          {/* Legal / WA status label in manual mode */}
          {hasValidSpeed && (
            <div className="flex items-center justify-between text-[10px] pt-1 border-t border-gray-100 dark:border-slate-700">
              <span className="text-gray-500 dark:text-gray-400">
                {isTailwind ? 'Tailwind (Speed assisting)' : isHeadwind ? 'Headwind (Resistance)' : 'Still conditions'}
              </span>
              <span className={`font-bold ${isWaLegal ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {isWaLegal ? 'Legal (< 2.0 m/s)' : 'Wind-Assisted (> 2.0 m/s)'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Aerodynamic Drag & Zero-Wind Equivalent Analysis */}
      {hasValidSpeed && Math.abs(numSpeed) >= 0.1 && (() => {
        const sampleRun = calculateWindCorrection(4.85, numSpeed, 40);
        return (
          <div className="bg-sky-500/5 dark:bg-slate-900/70 border border-sky-500/30 dark:border-slate-700 rounded-xl p-2.5 flex flex-col gap-1.5 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sky-600 dark:text-sky-400 flex items-center gap-1 text-[11px]">
                <Info size={12} />
                <span>Mureika Aerodynamic Impact</span>
              </span>
              <span className="font-mono text-gray-400 text-[10px]">
                40m @ 4.85s ref
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center pt-1 border-t border-gray-200 dark:border-slate-800">
              <div className="bg-white dark:bg-slate-800 p-1.5 rounded-lg border border-gray-200 dark:border-slate-700">
                <div className="text-[9px] text-gray-500 dark:text-gray-400 font-bold uppercase">0.0 m/s Equivalent</div>
                <div className="text-xs font-mono font-bold text-gray-900 dark:text-gray-100">{sampleRun.adjustedTimeFormatted}s</div>
              </div>
              <div className="bg-white dark:bg-slate-800 p-1.5 rounded-lg border border-gray-200 dark:border-slate-700">
                <div className="text-[9px] text-gray-500 dark:text-gray-400 font-bold uppercase">{sampleRun.isTailwind ? 'Time Gained' : 'Time Lost'}</div>
                <div className={`text-xs font-mono font-bold ${sampleRun.isTailwind ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {sampleRun.windDeltaFormatted}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default React.memo(WindGaugeController);
