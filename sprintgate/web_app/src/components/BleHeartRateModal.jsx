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

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Heart, Bluetooth, Wifi, WifiOff, Battery, BatteryCharging, 
  Activity, Zap, ShieldCheck, AlertCircle, Play, Pause, 
  RotateCcw, Sliders, Info, Check, X, Flame, Sparkles,
  RefreshCw, Database, CloudOff
} from 'lucide-react';
import { 
  bleHeartRateService, 
  useBleHeartRate, 
  HR_ZONES, 
  calculateHrZone 
} from '../utils/bleHeartRateService';
import { useOfflineTelemetry } from '../utils/offlineTelemetryQueue';

export default function BleHeartRateModal({ isOpen, onClose, activeRunner = null }) {
  const {
    isSupported,
    isConnected,
    isConnecting,
    isReconnecting,
    reconnectAttempts,
    autoReconnect,
    deviceName,
    batteryLevel,
    sensorContact,
    bpm,
    zone,
    maxHr,
    rrIntervals,
    history,
    connect,
    disconnect,
    setMaxHr,
    setAutoReconnect
  } = useBleHeartRate();

  const { isOnline, hrCount, isSyncing, flush } = useOfflineTelemetry();

  const [customMaxHr, setCustomMaxHr] = useState(maxHr || 195);
  const [activeTab, setActiveTab] = useState('telemetry'); // 'telemetry' | 'settings' | 'zones'
  const [errorMessage, setErrorMessage] = useState('');

  // Sync athlete age if activeRunner has age
  useEffect(() => {
    if (activeRunner && activeRunner.age) {
      const estimatedMax = 220 - parseInt(activeRunner.age);
      if (estimatedMax >= 150 && estimatedMax <= 220) {
        setCustomMaxHr(estimatedMax);
        setMaxHr(estimatedMax);
      }
    }
  }, [activeRunner, setMaxHr]);

  if (!isOpen) return null;

  const handleConnect = async () => {
    setErrorMessage('');
    try {
      await connect();
    } catch (err) {
      setErrorMessage(err.message || 'Bluetooth connection failed or was cancelled.');
    }
  };

  const handleMaxHrChange = (val) => {
    const num = parseInt(val);
    if (!isNaN(num) && num >= 120 && num <= 230) {
      setCustomMaxHr(num);
      setMaxHr(num);
    }
  };

  // Pulse animation frequency in seconds per beat
  const pulseDuration = bpm > 0 ? (60 / bpm).toFixed(2) : '1.0';

  // Statistics from rolling history
  const historyStats = (() => {
    if (history.length === 0) return { min: 0, max: 0, avg: 0 };
    const values = history.map(h => h.bpm);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    return { min, max, avg };
  })();

  return (
    <div className="fixed inset-0 z-[120] bg-black/70 dark:bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden">
      <div 
        className="w-full max-w-2xl max-h-[92vh] sm:max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col text-slate-900 dark:text-slate-100 relative overflow-hidden transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient Top Glow */}
        <div className="absolute top-0 right-1/4 w-72 h-44 bg-rose-500/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Modal Sticky Header */}
        <div className="shrink-0 px-5 sm:px-7 pt-4 sm:pt-5 pb-3 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between bg-white dark:bg-slate-900 z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-rose-600 to-pink-500 flex items-center justify-center shadow-lg shadow-rose-500/25 shrink-0">
              <Heart className="w-6 h-6 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">BLE Biotelemetry HUD</h2>
                {isConnected && (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                    Live Bluetooth
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isConnected ? deviceName : 'Pair standard Polar H10, Garmin, or Wahoo BLE chest strap'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {batteryLevel !== null && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-xs font-mono text-slate-700 dark:text-slate-300">
                <Battery className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                <span>{batteryLevel}%</span>
              </div>
            )}
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center justify-center transition border border-slate-200/60 dark:border-transparent shrink-0"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs (Sticky) */}
        <div className="shrink-0 px-5 sm:px-7 py-2 border-b border-slate-200 dark:border-slate-800/60 bg-slate-50/80 dark:bg-slate-950/40 flex items-center gap-2 text-xs font-bold z-10 overflow-x-auto">
          <button
            onClick={() => setActiveTab('telemetry')}
            className={`px-3.5 py-1.5 rounded-xl transition shrink-0 ${activeTab === 'telemetry' ? 'bg-rose-500/15 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'}`}
          >
            Live Monitor
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3.5 py-1.5 rounded-xl transition shrink-0 ${activeTab === 'settings' ? 'bg-rose-500/15 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'}`}
          >
            HR Parameters & Settings
          </button>
          <button
            onClick={() => setActiveTab('zones')}
            className={`px-3.5 py-1.5 rounded-xl transition shrink-0 ${activeTab === 'zones' ? 'bg-rose-500/15 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'}`}
          >
            Sports Science Zones
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-5 min-h-0 bg-white dark:bg-slate-900">

        {/* Reconnection Alert Banner */}
        {isReconnecting && (
          <div className="bg-amber-500/15 border border-amber-500/40 rounded-2xl p-3 px-4 flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-5 h-5 text-amber-500 dark:text-amber-400 animate-spin shrink-0" />
              <div>
                <span className="text-xs font-bold text-amber-800 dark:text-amber-300">Strap Disconnected — Auto-Reconnecting to BLE Sensor...</span>
                <span className="block text-[11px] text-amber-700 dark:text-amber-400/80 font-mono">
                  Exponential backoff retry {reconnectAttempts}/6
                </span>
              </div>
            </div>
            <button 
              onClick={disconnect}
              className="px-3 py-1 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-200 text-xs font-bold border border-amber-500/30 transition"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Offline Telemetry Queue Status Banner */}
        {(hrCount > 0 || !isOnline) && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 px-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 text-xs">
            <div className="flex items-center gap-2.5">
              <Database className={`w-4 h-4 shrink-0 ${!isOnline ? 'text-amber-500 dark:text-amber-400' : 'text-cyan-600 dark:text-cyan-400'}`} />
              <span className="text-slate-600 dark:text-slate-300">
                PWA Offline Queue: <strong className="text-slate-900 dark:text-white font-mono">{hrCount}</strong> HR telemetry samples buffered locally
                {!isOnline && <span className="text-amber-600 dark:text-amber-400 ml-1.5 font-bold">(Device Offline)</span>}
              </span>
            </div>
            {isOnline && hrCount > 0 && (
              <button
                onClick={() => flush()}
                disabled={isSyncing}
                className="self-end sm:self-auto px-3 py-1 rounded-xl bg-cyan-600/15 hover:bg-cyan-600/30 dark:bg-cyan-600/30 dark:hover:bg-cyan-600/50 text-cyan-800 dark:text-cyan-200 text-[11px] font-bold border border-cyan-500/40 flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Sync Telemetry Now'}
              </button>
            )}
          </div>
        )}

        {/* TAB 1: Live Telemetry */}
        {activeTab === 'telemetry' && (
          <div className="flex flex-col gap-5">
            {/* Main Pulse Readout Card */}
            <div className="w-full bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/90 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-6 relative overflow-hidden transition-colors">
              
              {/* Cardiac Pulse Ring Display */}
              <div className="flex items-center gap-6">
                <div className="relative flex items-center justify-center">
                  <div 
                    className="w-24 h-24 rounded-full bg-rose-500/10 border border-rose-500/20 dark:border-rose-500/30 flex items-center justify-center transition-transform"
                    style={{
                      animation: isConnected && bpm > 0 ? `ping ${pulseDuration}s cubic-bezier(0, 0, 0.2, 1) infinite` : 'none',
                      opacity: 0.35
                    }}
                  />
                  <div 
                    className="absolute w-20 h-20 rounded-full bg-gradient-to-tr from-rose-500/20 to-pink-500/10 dark:from-rose-600/30 dark:to-pink-500/20 border border-rose-500/30 dark:border-rose-500/40 flex items-center justify-center transition-transform"
                    style={{
                      animation: isConnected && bpm > 0 ? `pulse ${pulseDuration}s ease-in-out infinite` : 'none'
                    }}
                  >
                    <Heart className={`w-9 h-9 ${isConnected && bpm > 0 ? 'text-rose-500 fill-rose-500' : 'text-slate-400 dark:text-slate-600'}`} />
                  </div>
                </div>

                <div className="flex flex-col">
                  <span className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Cardiovascular Rate</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl sm:text-6xl font-black font-mono tracking-tight text-slate-900 dark:text-white">
                      {isConnected && bpm > 0 ? bpm : '--'}
                    </span>
                    <span className="text-sm font-bold text-rose-600 dark:text-rose-400">BPM</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${zone.bg} ${zone.color}`}>
                      Zone {zone.zone || 0}: {zone.name}
                    </span>
                    {zone.pct > 0 && (
                      <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                        {zone.pct}% HRmax
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Min / Avg / Peak Metrics */}
              <div className="grid grid-cols-3 sm:flex sm:flex-col gap-3 w-full sm:w-auto border-t sm:border-t-0 sm:border-l border-slate-200 dark:border-slate-800/80 pt-4 sm:pt-0 sm:pl-6 text-center sm:text-left">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Peak HR</div>
                  <div className="text-lg font-black font-mono text-rose-600 dark:text-rose-400">{historyStats.max || '--'} <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">bpm</span></div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Average HR</div>
                  <div className="text-lg font-black font-mono text-amber-600 dark:text-amber-300">{historyStats.avg || '--'} <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">bpm</span></div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Target Max</div>
                  <div className="text-lg font-black font-mono text-slate-800 dark:text-slate-300">{maxHr} <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">bpm</span></div>
                </div>
              </div>
            </div>

            {/* Live Waveform Sparkline Chart */}
            <div className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 flex flex-col gap-3 transition-colors">
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                <span className="font-bold flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                  Rolling Telemetry Waveform (Last 60 Seconds)
                </span>
                <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500">
                  {history.length} samples
                </span>
              </div>

              {/* SVG ECG-style line chart */}
              <div className="w-full h-28 bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-transparent rounded-xl p-2 relative overflow-hidden flex items-end shadow-inner">
                {/* Horizontal reference lines */}
                <div className="absolute inset-x-0 top-1/4 border-b border-slate-100 dark:border-slate-800/60 pointer-events-none"></div>
                <div className="absolute inset-x-0 top-2/4 border-b border-slate-100 dark:border-slate-800/60 pointer-events-none"></div>
                <div className="absolute inset-x-0 top-3/4 border-b border-slate-100 dark:border-slate-800/60 pointer-events-none"></div>

                {history.length > 1 ? (
                  <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
                    <defs>
                      <linearGradient id="hrGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {(() => {
                      const minBpm = Math.min(50, historyStats.min || 60);
                      const maxBpm = Math.max(190, historyStats.max || 180);
                      const range = maxBpm - minBpm || 1;

                      const points = history.map((pt, i) => {
                        const x = (i / (history.length - 1)) * 100;
                        const y = 100 - ((pt.bpm - minBpm) / range) * 90;
                        return `${x.toFixed(1)},${y.toFixed(1)}`;
                      }).join(' ');

                      const firstX = 0;
                      const lastX = 100;
                      const areaPoints = `${firstX},100 ${points} ${lastX},100`;

                      return (
                        <>
                          <polygon points={areaPoints} fill="url(#hrGradient)" />
                          <polyline 
                            points={points} 
                            fill="none" 
                            stroke="#f43f5e" 
                            strokeWidth="2.5" 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                          />
                        </>
                      );
                    })()}
                  </svg>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-slate-400 dark:text-slate-500 font-medium">
                    Awaiting heart rate telemetry stream...
                  </div>
                )}
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Hardware Connection Actions */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              {!isConnected ? (
                <button
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="w-full py-3 px-4 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-rose-600/25 transition disabled:opacity-50"
                >
                  <Bluetooth className="w-4 h-4" />
                  {isConnecting ? 'Searching for Bluetooth Sensor...' : 'Pair Bluetooth HRM Strap'}
                </button>
              ) : (
                <button
                  onClick={disconnect}
                  className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 font-bold rounded-xl flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 transition shadow-sm"
                >
                  <WifiOff className="w-4 h-4" />
                  Disconnect ({deviceName})
                </button>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: HR Parameters & Settings */}
        {activeTab === 'settings' && (
          <div className="flex flex-col gap-5">
            {/* Max HR Setting Card */}
            <div className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-rose-500 dark:text-rose-400" />
                    Athlete Cardiovascular Parameters
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Used to calculate anaerobic & aerobic training zones</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="120"
                    max="220"
                    value={customMaxHr}
                    onChange={(e) => handleMaxHrChange(e.target.value)}
                    className="w-20 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-center font-mono font-bold text-slate-900 dark:text-white text-sm focus:outline-none focus:border-rose-500 shadow-sm"
                  />
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">BPM Max</span>
                </div>
              </div>

              {activeRunner && (
                <div className="text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span>Current Athlete: <strong className="text-slate-900 dark:text-white">{activeRunner.name}</strong></span>
                  <span>Estimated: 220 - {activeRunner.age || 20} = {220 - (activeRunner.age || 20)} BPM</span>
                </div>
              )}
            </div>

            {/* PWA Auto-Reconnect Settings Card */}
            <div className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Auto-Reconnect on Signal Drop
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Automatically reconnect to known chest strap if Bluetooth connection drops mid-drill
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={autoReconnect} 
                  onChange={(e) => setAutoReconnect(e.target.checked)} 
                  className="sr-only peer" 
                />
                <div className="w-11 h-6 bg-slate-300 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {/* Browser Support Notice */}
            {!isSupported && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-2xl text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold">Web Bluetooth API Note</strong>
                  Hardware BLE connectivity requires Google Chrome, Microsoft Edge, or Chrome for Android over HTTPS or localhost.
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Sports Science Zones */}
        {activeTab === 'zones' && (
          <div className="flex flex-col gap-3">
            <div className="text-xs text-slate-500 dark:text-slate-400 pb-1">
              Heart Rate Training Zones calculated based on maximum heart rate ({maxHr} BPM):
            </div>

            <div className="flex flex-col gap-2">
              {HR_ZONES.map((z) => {
                const minBpm = Math.round(z.minPct * maxHr);
                const maxBpm = Math.round(z.maxPct * maxHr);
                const isCurrent = zone.zone === z.zone;

                return (
                  <div 
                    key={z.zone}
                    className={`p-3.5 rounded-2xl border transition flex items-center justify-between ${isCurrent ? `${z.bg} ring-1 ring-slate-900/10 dark:ring-white/20 shadow-sm` : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800/80'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${isCurrent ? 'bg-slate-900/10 dark:bg-white/20 text-slate-900 dark:text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                        Z{z.zone}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${z.color}`}>{z.name}</span>
                          {isCurrent && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900/10 dark:bg-white/20 text-slate-900 dark:text-white font-bold">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{z.desc}</p>
                      </div>
                    </div>

                    <div className="text-right font-mono">
                      <div className="text-sm font-bold text-slate-900 dark:text-white">{minBpm} - {maxBpm} <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">bpm</span></div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">{Math.round(z.minPct * 100)}% - {Math.round(z.maxPct * 100)}%</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        </div>

        {/* Modal Sticky Footer */}
        <div className="shrink-0 px-5 sm:px-7 py-3 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/70 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 z-10">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Standard GATT Heart Rate Profile (0x180D)</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 hover:text-slate-900 dark:text-slate-200 font-bold rounded-xl border border-slate-200 dark:border-transparent transition shadow-xs"
          >
            Close HUD
          </button>
        </div>

      </div>
    </div>
  );
}
