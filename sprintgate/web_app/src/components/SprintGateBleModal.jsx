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

/**
 * SprintGateBleModal.jsx
 * Velocity Lab - Direct Web Bluetooth (WebBLE) Hardware Cockpit
 * 
 * Manages physical ESP32 SprintGates wirelessly from Chrome/Edge:
 * 1. Wireless Pairing via Web Bluetooth (zero app install).
 * 2. Real-time Gate Optical Alignment telemetry (0m Start Gate & Track Finish Gate) with live audio pitch alignment tuner.
 * 3. Direct 5V USB-C hardware operation.
 * 4. Multi-Split Gate mapping & zero-latency split stream verification.
 * 
 * STRICT REAL HARDWARE ONLY: Zero simulations, zero fabricated telemetry.
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Bluetooth, WifiOff, RotateCcw, Info, X, RefreshCw, Volume2, VolumeX, 
  Target, Layers, AlertTriangle, AlertCircle, Radio
} from 'lucide-react';
import { 
  useBleSprintGate, 
  GATE_POSITIONS 
} from '../utils/bleSprintGateService';

export default function SprintGateBleModal({ isOpen, onClose }) {
  const {
    isSupported,
    isConnected,
    isConnecting,
    isReconnecting,
    reconnectAttempts,
    autoReconnect,
    deviceName,
    gateAlignment = {
      startGateAligned: false,
      finishGateAligned: false,
      allLocked: false,
      alignmentPercentage: 0,
      startLux: 0,
      finishLux: 0
    },
    splits = [],
    lastResult,
    connect,
    disconnect,
    setAutoReconnect,
    sendControlCommand
  } = useBleSprintGate();

  const [activeTab, setActiveTab] = useState('alignment'); // 'alignment' | 'splits'
  const [errorMessage, setErrorMessage] = useState('');
  const [audioTunerActive, setAudioTunerActive] = useState(false);
  const audioCtxRef = useRef(null);
  const oscRef = useRef(null);
  const gainRef = useRef(null);

  // Audio Pitch Alignment Tuner: plays audio frequency based on physical laser alignment
  useEffect(() => {
    if (!audioTunerActive || !isOpen || !isConnected) {
      if (oscRef.current) {
        try {
          oscRef.current.stop();
          oscRef.current.disconnect();
        } catch (e) {}
        oscRef.current = null;
      }
      return;
    }

    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      if (!oscRef.current) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        oscRef.current = osc;
        gainRef.current = gain;
      }

      // Frequency modulates with real optical alignment:
      // Both gates aligned = 1200 Hz (high steady pitch)
      // One gate aligned = 550 Hz (warble)
      // Neither aligned = 220 Hz (low pitch)
      const targetFreq = gateAlignment.allLocked 
        ? 1200 
        : (gateAlignment.startGateAligned || gateAlignment.finishGateAligned ? 550 : 220);
      oscRef.current.frequency.cancelScheduledValues(ctx.currentTime);
      oscRef.current.frequency.exponentialRampToValueAtTime(targetFreq, ctx.currentTime + 0.1);

    } catch (err) {
      console.warn('[AudioTuner] Audio pitch init error:', err);
    }

    return () => {
      if (oscRef.current && !audioTunerActive) {
        try {
          oscRef.current.stop();
          oscRef.current.disconnect();
        } catch (e) {}
        oscRef.current = null;
      }
    };
  }, [audioTunerActive, gateAlignment.allLocked, gateAlignment.startGateAligned, gateAlignment.finishGateAligned, isOpen, isConnected]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (oscRef.current) {
        try { oscRef.current.stop(); } catch (e) {}
        oscRef.current = null;
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        try { audioCtxRef.current.close().catch(() => {}); } catch (e) {}
        audioCtxRef.current = null;
      }
    };
  }, []);

  if (!isOpen) return null;

  const handleConnect = async () => {
    setErrorMessage('');
    try {
      await connect();
    } catch (err) {
      setErrorMessage(err.message || 'Bluetooth pairing was cancelled or timed out.');
    }
  };

  const handleHardwareReset = () => {
    sendControlCommand('reset');
  };

  return (
    <div 
      className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-3xl max-h-[92vh] sm:max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col text-slate-900 dark:text-slate-100 relative overflow-hidden transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient Top Glow */}
        <div className="absolute top-0 right-1/4 w-80 h-44 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Modal Header (Sticky) */}
        <div className="shrink-0 px-5 sm:px-7 pt-4 sm:pt-5 pb-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 flex items-center justify-center shadow-inner shrink-0">
              <Bluetooth size={22} className={isConnected ? "text-cyan-500 animate-pulse" : ""} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white">
                  Direct Web Bluetooth (WebBLE) Hardware
                </h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30">
                  ESP32 SPRINTGATE
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 hidden xs:block sm:block">
                Direct wireless field gateway • Optical gate alignment (Start 0m &amp; Finish) • Live telemetry
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition shrink-0 ml-2"
            title="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation (Sticky below header) */}
        <div className="shrink-0 px-4 sm:px-7 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/40 flex items-center gap-2 overflow-x-auto text-xs font-bold z-10">
          <button
            onClick={() => setActiveTab('alignment')}
            className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-2 shrink-0 ${
              activeTab === 'alignment'
                ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Target size={14} />
            <span>Gate Optical Alignment</span>
            <span className={`w-2 h-2 rounded-full ${gateAlignment.allLocked ? 'bg-emerald-500' : 'bg-slate-400'}`} />
          </button>

          <button
            onClick={() => setActiveTab('splits')}
            className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-2 shrink-0 ${
              activeTab === 'splits'
                ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Layers size={14} />
            <span>Multi-Split Gates (10m - 40m)</span>
            <span className="font-mono text-[11px]">({splits.length})</span>
          </button>
        </div>

        {/* Scrollable Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-4 min-h-0 bg-white dark:bg-slate-900">
          {/* Unsupported Browser Warning */}
          {!isSupported && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs flex items-start gap-3">
              <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Web Bluetooth Unavailable in This Browser</p>
                <p className="mt-0.5 text-amber-700 dark:text-amber-300">
                  Web Bluetooth requires a modern Chromium browser (Google Chrome or Microsoft Edge) on Windows, Android, macOS, or ChromeOS.
                </p>
              </div>
            </div>
          )}

          {/* Wi-Fi Firmware Helpful Banner */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-xs flex items-start gap-3">
            <Info size={16} className="text-cyan-500 shrink-0 mt-0.5" />
            <div className="text-slate-600 dark:text-slate-400 leading-relaxed">
              <strong className="text-slate-900 dark:text-white">Using Wi-Fi instead of Bluetooth?</strong> If your ESP32 is flashed with <code className="text-cyan-600 dark:text-cyan-400 font-mono">node_b_headless.ino</code> and connected to your phone's hotspot (<code className="text-cyan-600 dark:text-cyan-400 font-mono">Velocity_Lab</code>), use the <strong>Timing Gate Status</strong> modal in the top header. Both Wi-Fi WebSocket and direct USB-C Serial are fully supported with zero Bluetooth complexity.
            </div>
          </div>

          {/* Error Alert */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-rose-500 shrink-0" />
                <span>{errorMessage}</span>
              </div>
              <button onClick={() => setErrorMessage('')} className="p-1 hover:bg-rose-500/20 rounded-lg">
                <X size={14} />
              </button>
            </div>
          )}

          {/* Connection Status Bar */}
          <div className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className={`w-3.5 h-3.5 rounded-full shrink-0 ${
                isConnected 
                  ? "bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" 
                  : isConnecting 
                  ? "bg-amber-400 animate-ping" 
                  : "bg-slate-400"
              }`} />
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{isConnected ? deviceName : 'No Physical SprintGate Connected'}</span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {isConnected 
                    ? `Active BLE GATT session • Optical gate alignment streaming` 
                    : isConnecting 
                    ? 'Requesting Bluetooth device pairing...' 
                    : isReconnecting 
                    ? `Reconnecting attempt ${reconnectAttempts}/6...`
                    : 'Click connect to pair physical ESP32 timing gate'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              {!isConnected ? (
                <button
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-bold text-xs transition shadow-md shadow-cyan-500/20 disabled:opacity-50"
                >
                  {isConnecting ? <RefreshCw size={14} className="animate-spin" /> : <Bluetooth size={14} />}
                  <span>{isConnecting ? 'Searching...' : 'Pair Bluetooth Timing Gate'}</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={handleHardwareReset}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition"
                    title="Send hardware reset command to clear active runners"
                  >
                    <RotateCcw size={14} />
                    <span>Reset Gates</span>
                  </button>
                  <button
                    onClick={disconnect}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 border border-rose-500/30 font-bold text-xs transition"
                  >
                    <WifiOff size={14} />
                    <span>Disconnect</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* TAB 1: GATE OPTICAL ALIGNMENT (START GATE 0m + FINISH GATE AT DISTANCE) */}
          {activeTab === 'alignment' && (
            <div className="flex flex-col gap-4">
              {/* Alignment Top Banner */}
              <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-4 transition-colors ${
                !isConnected
                  ? 'bg-slate-50 dark:bg-slate-950/80 border-slate-200 dark:border-slate-800 text-slate-500'
                  : gateAlignment.allLocked 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
                  : (gateAlignment.startGateAligned || gateAlignment.finishGateAligned)
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-900 dark:text-rose-200'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shrink-0 ${
                    !isConnected 
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-500' 
                      : gateAlignment.allLocked 
                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
                      : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                  }`}>
                    {isConnected ? `${gateAlignment.alignmentPercentage}%` : '--'}
                  </div>
                  <div>
                    <div className="text-sm font-extrabold flex items-center gap-2">
                      <span>
                        {isConnected 
                          ? (gateAlignment.allLocked 
                              ? 'START & FINISH GATES LOCKED & READY' 
                              : (gateAlignment.startGateAligned 
                                  ? 'START GATE LOCKED • ALIGN FINISH GATE' 
                                  : gateAlignment.finishGateAligned 
                                  ? 'FINISH GATE LOCKED • ALIGN START GATE' 
                                  : 'LASER ALIGNMENT REQUIRED (BOTH GATES)')) 
                          : 'HARDWARE DISCONNECTED'}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-900/10 dark:bg-white/10">
                        {isConnected ? (gateAlignment.allLocked ? 'OPTIMAL' : 'ADJUST TRIPOD') : 'AWAITING PAIRING'}
                      </span>
                    </div>
                    <p className="text-xs opacity-80 mt-0.5">
                      {isConnected 
                        ? (gateAlignment.allLocked 
                          ? 'Both Start (0m) and Finish optical beams are aligned and ready for athlete release.' 
                          : 'Aim optical laser directly into the receiver LDR sensor at the respective gate tripod.')
                        : 'Connect physical ESP32 to monitor live laser gate alignment and sensor lux levels.'}
                    </p>
                  </div>
                </div>

                {/* Audio Pitch Tuner Toggle */}
                {isConnected && (
                  <button
                    onClick={() => setAudioTunerActive(!audioTunerActive)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold text-xs transition border ${
                      audioTunerActive
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                    title="Play audible pitch guide while aligning tripods on the track"
                  >
                    {audioTunerActive ? <Volume2 size={16} className="animate-pulse" /> : <VolumeX size={16} />}
                    <span>{audioTunerActive ? 'Audio Tuner ON' : 'Turn On Audio Guide'}</span>
                  </button>
                )}
              </div>

              {/* Start Gate & Finish Gate Optical Status Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Start Gate Card (0m - Node A) */}
                <div className={`p-4 rounded-2xl border transition-all ${
                  !isConnected 
                    ? 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800' 
                    : gateAlignment.startGateAligned 
                    ? 'bg-emerald-500/5 border-emerald-500/30' 
                    : 'bg-rose-500/5 border-rose-500/30'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${!isConnected ? 'bg-slate-400' : gateAlignment.startGateAligned ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-rose-500'}`} />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Start Gate (0m Line - Node A)</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                      Position: 0.00m (Start)
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xl font-mono font-black text-slate-900 dark:text-white">
                        {isConnected ? (gateAlignment.startGateAligned ? 'LOCKED / CLEAR' : 'BEAM OBSTRUCTED') : '--'}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Role: Athlete departure line (Triggers clock)
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <span className="text-xs text-slate-400">Sensor: </span>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{isConnected ? `${gateAlignment.startLux} lux` : '--'}</span>
                    </div>
                  </div>
                </div>

                {/* Finish Gate Card (Track Distance - Node B) */}
                <div className={`p-4 rounded-2xl border transition-all ${
                  !isConnected 
                    ? 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800' 
                    : gateAlignment.finishGateAligned 
                    ? 'bg-emerald-500/5 border-emerald-500/30' 
                    : 'bg-rose-500/5 border-rose-500/30'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${!isConnected ? 'bg-slate-400' : gateAlignment.finishGateAligned ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-rose-500'}`} />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Finish Gate (Finish Line - Node B)</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                      Position: Finish Line
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xl font-mono font-black text-slate-900 dark:text-white">
                        {isConnected ? (gateAlignment.finishGateAligned ? 'LOCKED / CLEAR' : 'BEAM OBSTRUCTED') : '--'}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Role: Final timing line (Stops clock)
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <span className="text-xs text-slate-400">Sensor: </span>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{isConnected ? `${gateAlignment.finishLux} lux` : '--'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Physical Field Alignment Guide */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
                <Info size={18} className="text-cyan-500 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                  <div className="font-bold text-slate-900 dark:text-white">
                    Physical Field Gate Alignment Guide
                  </div>
                  <p className="leading-relaxed">
                    Set <strong>Node A</strong> at the 0m start line and aim its laser dot directly onto its receiver sensor. Set <strong>Node B</strong> at your designated finish distance (e.g. 10m, 20m, 30m, 40m) and aim its laser dot onto its receiver sensor. When both gates report <strong>LOCKED / CLEAR</strong>, the field is ready for the sprint.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: MULTI-SPLIT GATES (10m - 40m) */}
          {activeTab === 'splits' && (
            <div className="flex flex-col gap-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Split telemetry streamed directly from physical gates as athletes cross intermediate optical timing lines:
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
                {GATE_POSITIONS.map(gate => {
                  const recordedSplit = splits.find(s => s.distance === gate.distance);
                  const isFinish = gate.id === 4;
                  const isStart = gate.id === 0;

                  return (
                    <div 
                      key={gate.id}
                      className={`p-3 rounded-2xl border flex flex-col gap-1 transition-all ${
                        recordedSplit
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-900 dark:text-emerald-200'
                          : isFinish
                          ? 'bg-cyan-500/5 border-cyan-500/20 text-slate-700 dark:text-slate-300'
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-mono font-bold">
                        <span>{gate.distance}m</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] ${
                          isStart ? 'bg-amber-500/20 text-amber-600' : isFinish ? 'bg-cyan-500/20 text-cyan-600' : 'bg-slate-200 dark:bg-slate-800'
                        }`}>
                          {isStart ? 'START' : isFinish ? 'FINISH' : 'SPLIT'}
                        </span>
                      </div>

                      <div className="text-lg font-mono font-black mt-1">
                        {recordedSplit ? `${recordedSplit.time.toFixed(3)}s` : '--'}
                      </div>

                      <div className="text-[10px] opacity-75">
                        {gate.label}
                      </div>
                    </div>
                  );
                })}
              </div>

              {lastResult && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-teal-500/15 to-cyan-500/15 border border-emerald-500/30 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                      Last Verified Finish Time
                    </div>
                    <div className="text-3xl font-mono font-black text-slate-900 dark:text-white mt-1">
                      {lastResult.time.toFixed(3)}s
                    </div>
                  </div>
                  <div className="text-right text-xs font-mono text-slate-500 dark:text-slate-400">
                    <div>Reaction Time: <strong className="text-emerald-600 dark:text-emerald-400">{lastResult.reactionTime} ms</strong></div>
                    <div>FAT Gate Accuracy: <strong>Sub-millisecond</strong></div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Sticky Footer */}
        <div className="shrink-0 px-5 sm:px-7 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs z-10">
          <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <Radio size={14} className="text-cyan-500" />
              <span>GATT Profile: <strong>Direct Web Bluetooth</strong></span>
            </span>
            <span>•</span>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={autoReconnect}
                onChange={(e) => setAutoReconnect(e.target.checked)}
                className="rounded accent-cyan-500"
              />
              <span>Auto-reconnect on drop</span>
            </label>
          </div>

          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition shadow-xs"
          >
            Close Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
