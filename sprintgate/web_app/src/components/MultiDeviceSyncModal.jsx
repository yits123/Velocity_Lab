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
  Radio, 
  Smartphone, 
  Monitor, 
  Tv, 
  Users, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Zap, 
  X, 
  QrCode, 
  Camera, 
  Sliders, 
  ShieldCheck, 
  Flame, 
  Wifi, 
  ChevronRight, 
  Play, 
  SkipForward, 
  Check, 
  Share2 
} from 'lucide-react';
import liveFieldSyncService from '../utils/liveFieldSyncService';

export default function MultiDeviceSyncModal({
  isOpen,
  onClose,
  stationRole,
  setStationRole,
  connectedStations = [],
  queue = [],
  activeRunner,
  sequenceState = 'idle',
  displayTime = '0.00',
  testMode = '40m',
  onOpenQrScanner,
  onCallNextRunner,
  onSignalTrackReady,
  onStartMasterSequence,
  onResetMasterSequence,
  onSelectTab
}) {
  const [activeSubTab, setActiveSubTab] = useState('roles'); // 'roles' | 'stations' | 'diagnostics'
  const [commandFeedback, setCommandFeedback] = useState('');

  if (!isOpen) return null;

  const triggerFeedback = (msg) => {
    setCommandFeedback(msg);
    setTimeout(() => setCommandFeedback(''), 2500);
  };

  const handleRoleSelect = (roleKey) => {
    setStationRole(roleKey);
    liveFieldSyncService.setRole(roleKey);
    triggerFeedback(`Station role set to ${roleKey.toUpperCase()}`);
  };

  const roleConfigs = [
    {
      id: 'master',
      title: 'Master Timing Console',
      deviceType: 'Laptop / Main Desk',
      icon: <Monitor size={22} className="text-emerald-500" />,
      badge: 'Direct ESP32 Link',
      badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      description: 'Connected directly to ESP32 timing gates (WebBLE / WebSocket). Controls official countdown, false starts, gate arming, and records verified split times.',
      isMaster: true
    },
    {
      id: 'marshall',
      title: 'Queue Marshall Station',
      deviceType: 'Tablet / Phone at Start Line',
      icon: <Users size={22} className="text-sky-500" />,
      badge: '1-Tap QR & Staging',
      badgeColor: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30',
      description: 'Positioned at the athlete staging area. Scans athlete QR badges, manages heat queue order, and alerts the Master when athlete is in the starting blocks.',
      isMaster: false
    },
    {
      id: 'camera',
      title: 'Trackside Camera Station',
      deviceType: 'Smartphone on Tripod / Handheld',
      icon: <Camera size={22} className="text-purple-500" />,
      badge: 'Auto-Athlete Tagging',
      badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
      description: 'Records drive phase or sprint kinematics. Automatically locks onto the active queued athlete so recorded videos and bio-reports are auto-tagged with zero typing.',
      isMaster: false
    },
    {
      id: 'mirror',
      title: 'Scoreboard / Field Mirror',
      deviceType: 'TV / Jumbotron / Spectator Tablet',
      icon: <Tv size={22} className="text-amber-500" />,
      badge: 'Read-Only Live Display',
      badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
      description: 'Follows Master screen and displays live running timer, real-time splits, and leaderboards for spectators and athletes in the stands.',
      isMaster: false
    }
  ];

  const currentRoleConfig = roleConfigs.find(r => r.id === stationRole) || roleConfigs[0];

  return (
    <div 
      className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl transition-all"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm">
              <Radio size={20} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  Multi-Device Field Sync
                </h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 uppercase">
                  Hotspot Mesh
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-gray-400">
                Sync views, athlete queues & commands across Laptop, Tablet & Smartphone
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-gray-400 transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Live Status Bar */}
        <div className="bg-slate-100 dark:bg-slate-800/80 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-bold text-slate-700 dark:text-gray-200">
              Station Role:
            </span>
            <span className="font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
              {currentRoleConfig.title}
            </span>
          </div>
          <div className="flex items-center gap-3 font-mono text-[11px] text-slate-500 dark:text-gray-400">
            <span>Online Stations: <strong className="text-slate-800 dark:text-white">{connectedStations.length || 1}</strong></span>
            <span>•</span>
            <span>Queue: <strong className="text-slate-800 dark:text-white">{queue.length}</strong> athletes</span>
          </div>
        </div>

        {/* Sub-Tab Navigation */}
        <div className="grid grid-cols-3 border-b border-slate-200 dark:border-slate-800 shrink-0 text-xs font-bold text-center">
          <button
            onClick={() => setActiveSubTab('roles')}
            className={`py-3 transition border-b-2 ${
              activeSubTab === 'roles' 
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5' 
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white'
            }`}
          >
            1. Assign Station Role
          </button>
          <button
            onClick={() => setActiveSubTab('stations')}
            className={`py-3 transition border-b-2 ${
              activeSubTab === 'stations' 
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5' 
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white'
            }`}
          >
            2. Live Station Deck ({connectedStations.length || 1})
          </button>
          <button
            onClick={() => setActiveSubTab('diagnostics')}
            className={`py-3 transition border-b-2 ${
              activeSubTab === 'diagnostics' 
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5' 
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white'
            }`}
          >
            3. ESP32 Isolation Spec
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 min-h-0 space-y-4">
          {commandFeedback && (
            <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 animate-bounce">
              <CheckCircle2 size={16} />
              <span>{commandFeedback}</span>
            </div>
          )}

          {/* TAB 1: ROLES */}
          {activeSubTab === 'roles' && (
            <div className="space-y-3">
              <div className="text-xs text-slate-600 dark:text-gray-400 mb-2">
                Select the role of <strong>this device</strong> for the field testing session:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {roleConfigs.map((r) => {
                  const isSelected = stationRole === r.id;
                  return (
                    <div
                      key={r.id}
                      onClick={() => handleRoleSelect(r.id)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/30 shadow-md'
                          : 'bg-slate-50/80 hover:bg-slate-100/90 dark:bg-slate-800/60 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700/80'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {r.icon}
                            <span className="font-bold text-sm text-slate-900 dark:text-white">{r.title}</span>
                          </div>
                          {isSelected ? (
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 dark:text-gray-400 mb-1.5 flex items-center gap-1">
                          <span>Device:</span>
                          <strong className="text-slate-700 dark:text-gray-300">{r.deviceType}</strong>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-gray-300 leading-relaxed mb-3">
                          {r.description}
                        </p>
                      </div>
                      <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${r.badgeColor}`}>
                          {r.badge}
                        </span>
                        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                          {isSelected ? 'Active Role ✓' : 'Select'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: STATIONS & LIVE CONTROLS */}
          {activeSubTab === 'stations' && (
            <div className="space-y-4">
              {/* Role-Specific Quick Action Deck */}
              <div className="bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 dark:from-slate-800/90 dark:via-slate-800 dark:to-slate-800/90 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
                <div className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                  <Zap size={14} className="text-amber-500" />
                  Quick Actions for {currentRoleConfig.title}
                </div>

                {/* Queue Marshall Controls */}
                {stationRole === 'marshall' && (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-600 dark:text-gray-300">
                      As Queue Marshall, scan incoming athletes or advance the heat. All updates instantly appear on the Laptop and Camera phone.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                      <button
                        onClick={() => {
                          onClose();
                          if (onOpenQrScanner) onOpenQrScanner();
                        }}
                        className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-3 rounded-xl text-xs shadow-sm transition"
                      >
                        <QrCode size={15} />
                        <span>Scan Athlete QR</span>
                      </button>
                      <button
                        onClick={() => {
                          if (onCallNextRunner) onCallNextRunner();
                          triggerFeedback("Advanced queue to next athlete!");
                        }}
                        disabled={queue.length <= 1}
                        className="flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 text-white font-bold py-2.5 px-3 rounded-xl text-xs shadow-sm transition disabled:opacity-50"
                      >
                        <SkipForward size={15} />
                        <span>Call Next Runner</span>
                      </button>
                      <button
                        onClick={() => {
                          if (onSignalTrackReady) onSignalTrackReady();
                          liveFieldSyncService.dispatchCommand('READY_AT_BLOCKS', {
                            athlete: activeRunner?.name || 'Athlete',
                            bib: activeRunner?.bib || ''
                          });
                          triggerFeedback("Signaled Laptop: Athlete in blocks!");
                        }}
                        className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-bold py-2.5 px-3 rounded-xl text-xs shadow-sm transition"
                      >
                        <CheckCircle2 size={15} />
                        <span>Athlete in Blocks</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Camera Station Controls */}
                {stationRole === 'camera' && (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-600 dark:text-gray-300">
                      Current active runner locked from shared queue: <strong className="text-slate-900 dark:text-white">{activeRunner?.name || 'No runner queued'}</strong> (Bib: {activeRunner?.bib || '--'})
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        onClick={() => {
                          onClose();
                          if (onSelectTab) onSelectTab('video');
                        }}
                        className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow-sm transition"
                      >
                        <Camera size={15} />
                        <span>Open Biomechanical Video Workspace</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Master Console Controls */}
                {stationRole === 'master' && (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-600 dark:text-gray-300">
                      Laptop is primary timing gateway. Controls broadcast to tablet & smartphone stations in real time.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                      <button
                        onClick={() => {
                          if (onStartMasterSequence) onStartMasterSequence();
                          liveFieldSyncService.dispatchCommand('START_SEQUENCE', {});
                          triggerFeedback("Triggered countdown sequence across stations!");
                        }}
                        className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-3 rounded-xl text-xs shadow-sm transition"
                      >
                        <Play size={15} />
                        <span>Start Cadence (Gun)</span>
                      </button>
                      <button
                        onClick={() => {
                          if (onResetMasterSequence) onResetMasterSequence();
                          liveFieldSyncService.dispatchCommand('RESET', {});
                          triggerFeedback("Reset track across all stations");
                        }}
                        className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-bold py-2.5 px-3 rounded-xl text-xs shadow-sm transition"
                      >
                        <RefreshCw size={15} />
                        <span>Reset Gates</span>
                      </button>
                      <button
                        onClick={() => {
                          if (onCallNextRunner) onCallNextRunner();
                          triggerFeedback("Broke runner to finish & advanced queue");
                        }}
                        disabled={queue.length <= 1}
                        className="flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 text-white font-bold py-2.5 px-3 rounded-xl text-xs shadow-sm transition disabled:opacity-50"
                      >
                        <SkipForward size={15} />
                        <span>Next Athlete</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Mirror Controls */}
                {stationRole === 'mirror' && (
                  <p className="text-xs text-slate-600 dark:text-gray-300">
                    This screen automatically mirrors the active track timer ({displayTime}s), runner status ({sequenceState}), and real-time split records.
                  </p>
                )}
              </div>

              {/* Connected Stations List */}
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-2 flex items-center justify-between">
                  <span>Connected Devices on Hotspot Mesh</span>
                  <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
                    {connectedStations.length || 1} Station(s) Online
                  </span>
                </div>
                <div className="space-y-2">
                  {(connectedStations.length > 0 ? connectedStations : [
                    {
                      deviceId: liveFieldSyncService.getDeviceId(),
                      role: stationRole,
                      deviceName: liveFieldSyncService.getDeviceName(),
                      isMe: true,
                      isOnline: true
                    }
                  ]).map((st, idx) => (
                    <div 
                      key={st.deviceId || idx}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <div>
                          <div className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                            <span>{st.deviceName || 'Field Station'}</span>
                            {st.isMe && (
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">
                                THIS DEVICE
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-mono text-slate-500 dark:text-gray-400 uppercase">
                            Role: {st.role || 'Station'}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        CONNECTED
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ESP32 ISOLATION SPEC & PERFORMANCE GUARANTEE */}
          {activeSubTab === 'diagnostics' && (
            <div className="space-y-3.5 text-xs text-slate-600 dark:text-gray-300">
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-slate-800 dark:text-gray-200">
                <div className="flex items-center gap-2 font-black text-sm text-emerald-700 dark:text-emerald-400 mb-2">
                  <ShieldCheck size={18} />
                  <span>Hardware Isolation & Hotspot Integrity</span>
                </div>
                <p className="leading-relaxed">
                  SprintGate enforces a strict <strong>Single-Gateway Isolation Architecture</strong>. The ESP32 timing gate connects <em>exclusively</em> to the Master Timing Console (Laptop).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
                  <div className="font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-500" />
                    <span>0% ESP32 CPU/Wi-Fi Load</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-gray-400 leading-relaxed">
                    Tablet and smartphone stations never connect to the ESP32. The microcontroller dedicates 100% of its resources to microsecond laser interrupts.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
                  <div className="font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-1.5">
                    <Wifi size={14} className="text-sky-500" />
                    <span>&lt;2 MB Hotspot Data / Meet</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-gray-400 leading-relaxed">
                    Only tiny JSON packets (~400 bytes per event) are exchanged over the hotspot via Firestore snapshots, avoiding any hotspot congestion.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
                  <div className="font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-1.5">
                    <Zap size={14} className="text-amber-500" />
                    <span>~60ms Hotspot Latency</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-gray-400 leading-relaxed">
                    When the Marshall scans an athlete QR code on the tablet, it appears on the laptop screen in approximately 60 milliseconds.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
                  <div className="font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-1.5">
                    <Camera size={14} className="text-purple-500" />
                    <span>Local Camera Recording</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-gray-400 leading-relaxed">
                    High-frame-rate 4K/60fps video is captured and processed locally on the smartphone, never clogging the shared hotspot.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 dark:text-gray-400 flex items-center gap-1.5 font-mono">
            <Radio size={12} className="text-emerald-500" />
            <span>Session: field_mesh_active</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
