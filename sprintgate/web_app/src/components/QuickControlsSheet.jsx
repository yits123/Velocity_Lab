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
import { motion, AnimatePresence } from 'motion/react';
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
  const activeTheme = COLOR_THEMES.find(t => t.id === colorTheme) || COLOR_THEMES[0];
  const isLight = theme === 'light' && !highContrast;
  const activeAccentText = isLight ? activeTheme.lightText : activeTheme.accent;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 select-none">
          {/* Backdrop with Fade */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs cursor-pointer" 
            onClick={onClose} 
          />

          {/* Sheet Container with Velocity Spring & Drag Gesture */}
          <motion.div 
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100 || info.velocity.y > 500) {
                onClose();
              }
            }}
            initial={{ y: "100%", opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 360, damping: 30 }}
            className="relative w-full sm:max-w-md max-h-[88vh] bg-white dark:bg-[#0c0e14] border-t sm:border border-gray-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden z-10"
          >
            
            {/* Mobile Pull / Drag Indicator Pill */}
            <div className="pt-3 pb-1 flex justify-center sm:hidden cursor-grab active:cursor-grabbing">
              <div className="w-12 h-1.5 bg-gray-300 dark:bg-slate-700 rounded-full" />
            </div>

            {/* Sheet Header */}
            <div className="px-5 py-3.5 border-b border-gray-100 dark:border-slate-800/80 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div 
                  className="w-8 h-8 rounded-xl flex items-center justify-center font-bold shadow-xs"
                  style={{ backgroundColor: `${activeTheme.accent}20`, color: activeAccentText }}
                >
                  <Sliders size={16} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Quick Controls & Settings</h2>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">Audio, display, hardware & theme controls</p>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition cursor-pointer"
                title="Close Controls"
              >
                <X size={18} />
              </motion.button>
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
                    <motion.button
                      key={id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.94 }}
                      onClick={action}
                      className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl text-xs font-bold transition border cursor-pointer ${
                        active
                          ? 'bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-xs'
                          : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
                      }`}
                      style={active ? { borderColor: activeTheme.accent, color: activeAccentText } : undefined}
                    >
                      <Icon size={14} />
                      <span className="text-[10px]">{label}</span>
                    </motion.button>
                  ))}
                </div>

                {/* Accent Palette Swatches */}
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Palette size={11} /> Theme Accent Color
                  </span>
                  <span className="font-mono text-emerald-500 font-bold">{activeTheme.name}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {COLOR_THEMES.map(t => {
                    const isSelected = t.id === colorTheme;
                    return (
                      <motion.button
                        key={t.id}
                        whileHover={{ scale: 1.15 }}
                        whileTap={{ scale: 0.9 }}
                        type="button"
                        onClick={() => setColorTheme(t.id)}
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition cursor-pointer relative ${
                          isSelected ? 'ring-2 ring-offset-2 ring-white dark:ring-offset-slate-950 ring-offset-1' : ''
                        }`}
                        style={{ backgroundColor: t.accent }}
                        title={t.name}
                      >
                        {isSelected && <Check size={12} className="text-black font-black stroke-[3]" />}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* SECTION 2: AUDIO & STARTING CADENCE */}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
                  <Volume2 size={13} />
                  <span>Audio & Starting Horn</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setVoiceEnabled(!voiceEnabled)}
                    className={`p-3 rounded-2xl border text-left flex items-center justify-between transition cursor-pointer ${
                      voiceEnabled 
                        ? 'bg-emerald-500/10 border-emerald-500/30' 
                        : 'bg-gray-50 dark:bg-slate-900/80 border-gray-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {voiceEnabled ? <Volume2 size={16} className="text-emerald-500" /> : <VolumeX size={16} className="text-gray-400" />}
                      <div>
                        <div className="text-xs font-bold text-gray-900 dark:text-white">Voice Cadence</div>
                        <div className="text-[10px] text-gray-500">{voiceEnabled ? 'Enabled' : 'Muted'}</div>
                      </div>
                    </div>
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => {
                      onClose();
                      onOpenAudioSettings();
                    }}
                    className="p-3 bg-gray-50 dark:bg-slate-900/80 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-800 flex items-center justify-between transition text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <Sliders size={16} className="text-emerald-500" />
                      <div>
                        <div className="text-xs font-bold text-gray-900 dark:text-white">Cadence Config</div>
                        <div className="text-[10px] text-gray-500">Gun, Delays, Horn</div>
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-gray-400" />
                  </motion.button>
                </div>
              </div>

              {/* SECTION 3: HARDWARE GATES & BLUETOOTH */}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
                  <Cpu size={13} />
                  <span>Hardware & Sensors</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {/* Gate Connection Hub */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => {
                      onClose();
                      onOpenConnectionModal();
                    }}
                    className={`p-3 rounded-2xl border text-left flex items-center justify-between transition cursor-pointer ${
                      isGateConnected 
                        ? 'bg-emerald-500/10 border-emerald-500/30' 
                        : 'bg-gray-50 dark:bg-slate-900/80 border-gray-200 dark:border-slate-800 hover:bg-gray-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Radio size={16} className={isGateConnected ? "text-emerald-500" : "text-gray-400"} />
                      <div>
                        <div className="text-xs font-bold text-gray-900 dark:text-white">Laser Gates</div>
                        <div className="text-[10px] text-gray-500">
                          {isSerialConnected ? 'USB-C Cable' : isWifiConnected ? 'Wi-Fi Hotspot' : isGateConnected ? 'Online' : 'Disconnected'}
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-gray-400" />
                  </motion.button>

                  {/* Heart Rate BLE Button */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => {
                      onClose();
                      onOpenBleModal();
                    }}
                    className={`p-3 rounded-2xl border text-left flex items-center justify-between transition cursor-pointer ${
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
                  </motion.button>
                </div>
              </div>

              {/* SECTION 4: STADIUM DISPLAY */}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
                  <Tv size={13} />
                  <span>Stadium Scoreboard</span>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => {
                    onClose();
                    setIsJumbotronMode(true);
                  }}
                  className="w-full p-3 bg-gray-50 dark:bg-slate-900/80 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-800 flex items-center justify-between transition text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Tv size={18} className="text-emerald-500" />
                    <div>
                      <div className="text-xs font-bold text-gray-900 dark:text-white">TV Jumbotron Scoreboard</div>
                      <div className="text-[10px] text-gray-500">Full-screen spectator & bleacher display</div>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-gray-400" />
                </motion.button>
              </div>

              {/* SECTION 5: ACCOUNT & SESSION */}
              <div className="pt-2 border-t border-gray-100 dark:border-slate-800">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => {
                    onClose();
                    handleLogout();
                  }}
                  className="w-full py-2.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 font-bold text-xs flex items-center justify-center gap-2 transition shadow-xs cursor-pointer"
                >
                  <LogOut size={14} />
                  <span>Log Out of Session</span>
                </motion.button>
              </div>

            </div>

            {/* Footer Done Button */}
            <div className="p-4 border-t border-gray-100 dark:border-slate-800/80 shrink-0 bg-gray-50 dark:bg-slate-950">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.95 }}
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs transition shadow-sm cursor-pointer"
              >
                Done
              </motion.button>
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
