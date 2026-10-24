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
import { 
  X, Sun, Moon, Monitor, Eye, Volume2, VolumeX, Sliders, 
  Tv, Film, Radio, Heart, Cpu, LogOut, Sparkles, Check, 
  Palette, ShieldCheck, ChevronRight
} from 'lucide-react';
import { COLOR_THEMES } from './ThemeColorPicker';

export default function QuickControlsSheet({
  isOpen,
  onClose,
  theme,
  setTheme,
  colorTheme,
  setColorTheme,
  highContrast,
  setHighContrast,
  voiceEnabled,
  setVoiceEnabled,
  onOpenAudioSettings,
  isJumbotronMode,
  setIsJumbotronMode,
  onOpenGlobalStrobe,
  isBleConnected,
  liveBleBpm,
  liveBleZone,
  onOpenBleModal,
  isSprintGateBleConnected,
  onOpenGateBleModal,
  onOpenConnectionModal,
  isGateConnected,
  isSerialConnected,
  isWifiConnected,
  isAdmin,
  handleLogout,
  surfaceType,
  setSurfaceType
}) {
  if (!isOpen) return null;

  const activeTheme = COLOR_THEMES.find(t => t.id === colorTheme) || COLOR_THEMES[0];
  const isLight = theme === 'light' && !highContrast;
  const activeAccentText = isLight ? activeTheme.lightText : activeTheme.accent;

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200" 
        onClick={onClose} 
      />

      {/* Sheet Container */}
      <div className="relative w-full sm:max-w-md max-h-[88vh] bg-white dark:bg-[#0c0e14] border-t sm:border border-gray-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden z-10 animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-200">
        
        {/* Mobile Pull / Drag Indicator Pill */}
        <div className="pt-2.5 pb-1 flex justify-center sm:hidden">
          <div className="w-12 h-1 bg-gray-300 dark:bg-slate-700 rounded-full" />
        </div>

        {/* Sheet Header */}
        <div className="px-5 py-3.5 border-b border-gray-100 dark:border-slate-800/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div 
              className="w-8 h-8 rounded-xl flex items-center justify-center font-bold"
              style={{ backgroundColor: `${activeTheme.accent}20`, color: activeAccentText }}
            >
              <Sliders size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Quick Controls & Settings</h2>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Audio, display, hardware & theme controls</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition"
            title="Close Controls"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Control Sections */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          
          {/* SECTION 1: DISPLAY MODE & THEME */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
              <Sun size={13} />
              <span>Display & Appearance</span>
            </div>

            {/* Light / Dark / Contrast Grid */}
            <div className="grid grid-cols-4 gap-1.5 p-1 bg-gray-100 dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 mb-3">
              {[
                { 
                  id: 'dark', 
                  label: 'Dark', 
                  icon: Moon, 
                  active: !highContrast && theme === 'dark',
                  action: () => { setTheme('dark'); if (setHighContrast) setHighContrast(false); }
                },
                { 
                  id: 'light', 
                  label: 'Light', 
                  icon: Sun, 
                  active: !highContrast && theme === 'light',
                  action: () => { setTheme('light'); if (setHighContrast) setHighContrast(false); }
                },
                { 
                  id: 'contrast', 
                  label: 'Contrast', 
                  icon: Eye, 
                  active: !!highContrast,
                  action: () => { if (setHighContrast) setHighContrast(!highContrast); }
                },
                { 
                  id: 'system', 
                  label: 'System', 
                  icon: Monitor, 
                  active: !highContrast && theme === 'system',
                  action: () => { setTheme('system'); if (setHighContrast) setHighContrast(false); }
                }
              ].map(({ id, label, icon: Icon, active, action }) => (
                <button
                  key={id}
                  onClick={action}
                  className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl text-xs font-bold transition border ${
                    active
                      ? 'bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-xs'
                      : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
                  }`}
                  style={active ? { borderColor: activeTheme.accent, color: activeAccentText } : undefined}
                >
                  <Icon size={14} />
                  <span className="text-[10px]">{label}</span>
                </button>
              ))}
            </div>

            {/* Accent Palette Swatches */}
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2 flex items-center justify-between">
              <span>Accent Theme Palette</span>
              <span className="text-emerald-500 font-bold">{activeTheme.name}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {COLOR_THEMES.map((t) => {
                const isSelected = colorTheme === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setColorTheme(t.id)}
                    className={`flex items-center gap-2 p-2 rounded-xl border text-left transition-all ${
                      isSelected 
                        ? 'bg-gray-100 dark:bg-slate-800/90 shadow-xs' 
                        : 'bg-gray-50/50 dark:bg-slate-900/50 border-gray-200 dark:border-slate-800/80 hover:bg-gray-100 dark:hover:bg-slate-800/50'
                    }`}
                    style={{ borderColor: isSelected ? t.accent : undefined }}
                  >
                    <span 
                      className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                      style={{ backgroundColor: t.accent }}
                    />
                    <span className="text-[11px] font-bold text-gray-800 dark:text-gray-200 truncate">
                      {t.name.split(' ')[0]}
                    </span>
                    {isSelected && (
                      <Check size={12} className="ml-auto text-emerald-500 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Track Surface Condition */}
            {setSurfaceType && (
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-800">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5 flex items-center justify-between">
                  <span>Track Surface</span>
                  <span className="text-emerald-500 font-bold">{surfaceType || 'Track'}</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 p-1 bg-gray-100 dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800">
                  {['Track', 'Turf', 'Grass', 'Court'].map((s) => (
                    <button
                      key={s}
                      onClick={() => setSurfaceType(s)}
                      className={`py-1.5 px-1 rounded-lg text-xs font-bold transition text-center ${
                        (surfaceType || 'Track') === s
                          ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs border border-gray-200/80 dark:border-slate-700'
                          : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* SECTION 2: AUDIO & CADENCE */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
              <Volume2 size={13} />
              <span>Voice & Timing Audio</span>
            </div>
            <div className="bg-gray-50 dark:bg-slate-900/80 p-3.5 rounded-2xl border border-gray-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
                  voiceEnabled ? 'bg-emerald-500/15 text-emerald-500' : 'bg-gray-200 dark:bg-slate-800 text-gray-400'
                }`}>
                  {voiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-900 dark:text-white">Voice Callouts & Beeps</div>
                  <div className="text-[11px] text-gray-500">{voiceEnabled ? 'Audio cues & announcements active' : 'Audio muted'}</div>
                </div>
              </div>
              
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    const next = !voiceEnabled;
                    setVoiceEnabled(next);
                  }}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition border ${
                    voiceEnabled 
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400' 
                      : 'bg-gray-200 dark:bg-slate-800 border-gray-300 dark:border-slate-700 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  {voiceEnabled ? 'ON' : 'OFF'}
                </button>
                {onOpenAudioSettings && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenAudioSettings();
                    }}
                    className="p-1.5 rounded-xl bg-gray-200 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:text-emerald-500 transition"
                    title="Audio Configuration"
                  >
                    <Sliders size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 3: HARDWARE & SENSORS */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
              <Radio size={13} />
              <span>Timing Gates & Sensors</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Timing Gate Hub Button (Wi-Fi, USB-C, BLE) */}
              <button
                onClick={() => {
                  onClose();
                  if (onOpenConnectionModal) onOpenConnectionModal();
                  else if (onOpenGateBleModal) onOpenGateBleModal();
                }}
                className={`p-3 rounded-2xl border text-left flex items-center justify-between transition ${
                  isGateConnected 
                    ? 'bg-emerald-500/10 border-emerald-500/30' 
                    : 'bg-gray-50 dark:bg-slate-900/80 border-gray-200 dark:border-slate-800 hover:bg-gray-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Radio size={16} className={isGateConnected ? "text-emerald-500" : "text-gray-400"} />
                  <div>
                    <div className="text-xs font-bold text-gray-900 dark:text-white">Timing Gate Hub</div>
                    <div className="text-[10px] text-gray-500">
                      {isSerialConnected ? 'USB-C Cable (0ms Sync)' : isWifiConnected ? 'Wi-Fi Hotspot (Online)' : isSprintGateBleConnected ? 'BLE Connected (Online)' : 'Connect Hardware'}
                    </div>
                  </div>
                </div>
                <ChevronRight size={14} className="text-gray-400" />
              </button>

              {/* Heart Rate BLE Button */}
              <button
                onClick={() => {
                  onClose();
                  onOpenBleModal();
                }}
                className={`p-3 rounded-2xl border text-left flex items-center justify-between transition ${
                  isBleConnected 
                    ? 'bg-rose-500/10 border-rose-500/30' 
                    : 'bg-gray-50 dark:bg-slate-900/80 border-gray-200 dark:border-slate-800 hover:bg-gray-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Heart size={16} className={isBleConnected ? "text-rose-500 fill-rose-500" : "text-gray-400"} />
                  <div>
                    <div className="text-xs font-bold text-gray-900 dark:text-white">Heart Rate BLE</div>
                    <div className="text-[10px] text-gray-500">
                      {isBleConnected ? `${liveBleBpm} BPM` : 'Connect Real Strap'}
                    </div>
                  </div>
                </div>
                <ChevronRight size={14} className="text-gray-400" />
              </button>
            </div>
          </div>

          {/* SECTION 4: STADIUM DISPLAY */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
              <Tv size={13} />
              <span>Stadium Scoreboard</span>
            </div>

            <button
              onClick={() => {
                onClose();
                setIsJumbotronMode(true);
              }}
              className="w-full p-3 bg-gray-50 dark:bg-slate-900/80 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-800 flex items-center justify-between transition text-left"
            >
              <div className="flex items-center gap-2.5">
                <Tv size={18} className="text-emerald-500" />
                <div>
                  <div className="text-xs font-bold text-gray-900 dark:text-white">TV Jumbotron Scoreboard</div>
                  <div className="text-[10px] text-gray-500">Full-screen spectator & bleacher display</div>
                </div>
              </div>
              <ChevronRight size={14} className="text-gray-400" />
            </button>
          </div>

          {/* SECTION 5: ACCOUNT & SESSION */}
          <div className="pt-2 border-t border-gray-100 dark:border-slate-800">
            <button
              onClick={() => {
                onClose();
                handleLogout();
              }}
              className="w-full py-2.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 font-bold text-xs flex items-center justify-center gap-2 transition shadow-xs"
            >
              <LogOut size={14} />
              <span>Log Out of Session</span>
            </button>
          </div>

        </div>

        {/* Footer Done Button */}
        <div className="p-4 border-t border-gray-100 dark:border-slate-800/80 shrink-0 bg-gray-50 dark:bg-slate-950">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs transition shadow-sm"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
}
