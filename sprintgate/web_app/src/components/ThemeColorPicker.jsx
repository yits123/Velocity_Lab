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

import React, { useState, useEffect, useRef } from 'react';
import { Palette, Check, Sun, Moon, Monitor, Eye, X, Sparkles } from 'lucide-react';
import VelocityLabLogo, { VelocityLabIcon } from './VelocityLabLogo';

export const COLOR_THEMES = [
  {
    id: 'orange',
    name: 'Ignite Blaze',
    subtitle: 'Orange, Black & White',
    description: 'High-octane athletic track orange with deep obsidian black and crisp white accents',
    accent: '#FF5500',
    accentHover: '#E04B00',
    lightText: '#D94800',
    textColor: '#FFFFFF',
    rgb: '255, 85, 0',
    dotClass: 'bg-[#FF5500]',
    ringClass: 'ring-[#FF5500]',
    glowClass: 'shadow-[0_0_14px_rgba(255,85,0,0.45)]'
  },
  {
    id: 'red',
    name: 'Apex Crimson',
    subtitle: 'Red, Black & White',
    description: 'Aggressive motorsport crimson red with stealth obsidian black and bright white',
    accent: '#FF204E',
    accentHover: '#E6123E',
    lightText: '#E11D48',
    textColor: '#FFFFFF',
    rgb: '255, 32, 78',
    dotClass: 'bg-[#FF204E]',
    ringClass: 'ring-[#FF204E]',
    glowClass: 'shadow-[0_0_14px_rgba(255,32,78,0.45)]'
  },
  {
    id: 'emerald',
    name: 'Velocity Green',
    subtitle: 'Classic Speed Green & Slate',
    description: 'Signature Velocity Lab laser emerald with carbon black and silver typography',
    accent: '#00E599',
    accentHover: '#00C784',
    lightText: '#059669',
    textColor: '#000000',
    rgb: '0, 229, 153',
    dotClass: 'bg-[#00E599]',
    ringClass: 'ring-[#00E599]',
    glowClass: 'shadow-[0_0_14px_rgba(0,229,153,0.45)]'
  },
  {
    id: 'cyan',
    name: 'Electric Cyan',
    subtitle: 'Cyan, Black & White',
    description: 'Aerodynamic electric cyan with deep midnight black and clean white numerals',
    accent: '#00E5FF',
    accentHover: '#00C7DE',
    lightText: '#0284C7',
    textColor: '#000000',
    rgb: '0, 229, 255',
    dotClass: 'bg-[#00E5FF]',
    ringClass: 'ring-[#00E5FF]',
    glowClass: 'shadow-[0_0_14px_rgba(0,229,255,0.45)]'
  },
  {
    id: 'purple',
    name: 'Hyper Violet',
    subtitle: 'Purple, Black & White',
    description: 'Championship sprint violet purple with obsidian dark and striking white digits',
    accent: '#A855F7',
    accentHover: '#9333EA',
    lightText: '#7E22CE',
    textColor: '#FFFFFF',
    rgb: '168, 85, 247',
    dotClass: 'bg-[#A855F7]',
    ringClass: 'ring-[#A855F7]',
    glowClass: 'shadow-[0_0_14px_rgba(168,85,247,0.45)]'
  },
  {
    id: 'yellow',
    name: 'Volt Neon',
    subtitle: 'Volt Yellow, Black & White',
    description: 'Championship track spikes neon volt yellow with deep charcoal black and bright white',
    accent: '#FAFF00',
    accentHover: '#E0E500',
    lightText: '#A16207',
    textColor: '#000000',
    rgb: '250, 255, 0',
    dotClass: 'bg-[#FAFF00]',
    ringClass: 'ring-[#FAFF00]',
    glowClass: 'shadow-[0_0_14px_rgba(250,255,0,0.45)]'
  }
];

export default function ThemeColorPicker({ 
  colorTheme, 
  setColorTheme, 
  theme, 
  setTheme,
  highContrast = false,
  setHighContrast
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const activeTheme = COLOR_THEMES.find(t => t.id === colorTheme) || COLOR_THEMES[0];
  const isLight = theme === 'light' && !highContrast;
  const activeAccentText = isLight ? activeTheme.lightText : activeTheme.accent;

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-bold transition border text-xs bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#2a2d33] border-gray-200 dark:border-slate-700 shadow-sm shrink-0"
        title="Customize Athletic Color Palette & Mode (Orange, Red, Cyan, Dark, Light, Contrast)"
      >
        <Palette size={13} style={{ color: activeAccentText }} />
        <span 
          className="w-2.5 h-2.5 rounded-full inline-block shadow-sm transition-transform duration-300 scale-110"
          style={{ backgroundColor: activeTheme.accent }}
        />
        <span className="hidden xl:inline font-semibold">{activeTheme.name.split(' ')[0]}</span>
      </button>

      {/* Responsive Theme Popover (Desktop) & Bottom Sheet (Mobile) */}
      {isOpen && (
        <>
          {/* Backdrop for Mobile */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[180] sm:hidden animate-in fade-in duration-200"
            onClick={() => setIsOpen(false)}
          />

          <div className="fixed inset-x-0 bottom-0 sm:bottom-auto sm:inset-x-auto sm:right-0 sm:absolute sm:mt-2 z-[190] w-full sm:w-[380px] max-h-[85vh] sm:max-h-none overflow-y-auto bg-white dark:bg-[#0e1118] backdrop-blur-xl border-t sm:border border-gray-200 dark:border-slate-700/80 rounded-t-3xl sm:rounded-2xl shadow-2xl p-4 pb-8 sm:pb-4 animate-in slide-in-from-bottom-5 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
            {/* Mobile Drag Handle */}
            <div className="w-12 h-1 bg-gray-300 dark:bg-slate-700 rounded-full mx-auto mb-3 sm:hidden" />

            {/* Header */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div 
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition"
                  style={{ backgroundColor: `${activeTheme.accent}20`, color: activeAccentText }}
                >
                  <Sparkles size={15} />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white">Color Palette & Display Mode</h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">Athletic contrast themes adapting across all 3 modes</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1 rounded-lg transition"
                title="Close Theme Settings"
              >
                <X size={18} />
              </button>
            </div>

          {/* Live Adaptive Brand Logo Preview */}
          <div className="mb-3 p-3 rounded-xl bg-gray-50 dark:bg-slate-950/80 border border-gray-200 dark:border-slate-800 flex flex-col items-center justify-center shadow-inner">
            <div className="w-full flex items-center justify-between text-[9px] font-mono font-bold uppercase tracking-widest text-gray-400 mb-2">
              <span>LIVE ADAPTIVE LOGO</span>
              <span className="text-emerald-500 font-bold">{activeTheme.name}</span>
            </div>
            <VelocityLabLogo 
              variant="full" 
              className="h-8 sm:h-9 w-auto max-w-full drop-shadow-sm transition-all duration-300" 
              colorTheme={colorTheme} 
              isDark={!isLight} 
            />
          </div>

          {/* Mode Switcher: Dark / Light / High Contrast / System */}
          <div className="mb-3.5 p-2.5 bg-gray-100 dark:bg-slate-950/80 rounded-xl border border-gray-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-2 px-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Display Mode</span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
                {highContrast ? 'High Contrast Mode' : theme === 'dark' ? 'Obsidian Dark' : theme === 'light' ? 'Studio White' : 'System Auto'}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
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
                  className={`flex items-center justify-center gap-1 py-1.5 px-1 rounded-lg text-xs font-bold transition border ${
                    active
                      ? 'bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm'
                      : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                  style={active ? { borderColor: activeTheme.accent, color: activeAccentText } : undefined}
                >
                  <Icon size={12} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Preset Theme Grid */}
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2 px-1">Accent Combinations</div>
          <div className="grid grid-cols-1 gap-2 max-h-[280px] overflow-y-auto pr-1">
            {COLOR_THEMES.map((t) => {
              const isSelected = colorTheme === t.id;
              const badgeTextColor = isLight ? t.lightText : t.accent;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setColorTheme(t.id);
                  }}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all duration-200 ${
                    isSelected
                      ? 'bg-gray-100 dark:bg-slate-800/90 shadow-sm'
                      : 'bg-transparent hover:bg-gray-50 dark:hover:bg-slate-800/40 border-transparent hover:border-gray-200 dark:hover:border-slate-700/60'
                  }`}
                  style={{ borderColor: isSelected ? t.accent : undefined }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Swatch Monogram Icon */}
                    <div className={`relative shrink-0 flex items-center justify-center w-7 h-7 rounded-lg bg-black/5 dark:bg-white/5 border p-0.5 transition-all duration-200 ${
                      isSelected ? 'border-current scale-105 shadow-sm' : 'border-gray-200 dark:border-slate-700'
                    }`}>
                      <VelocityLabIcon className="w-full h-full" colorTheme={t.id} isDark={!isLight} />
                    </div>
                    {/* Theme Info */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-900 dark:text-white truncate">
                          {t.name}
                        </span>
                      </div>
                      <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 block truncate">
                        {t.subtitle}
                      </span>
                    </div>
                  </div>

                  {/* Right side: Live Preview Tag & Checkmark */}
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span 
                      className="px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold"
                      style={{ 
                        backgroundColor: `${t.accent}20`, 
                        color: badgeTextColor,
                        border: `1px solid ${t.accent}40`
                      }}
                    >
                      4.73s
                    </span>
                    {isSelected && (
                      <span 
                        className="w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: t.accent, color: t.textColor }}
                      >
                        <Check size={12} strokeWidth={3} />
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Mobile Done Action Button */}
          <button
            onClick={() => setIsOpen(false)}
            className="mt-3.5 w-full py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-800 dark:text-gray-200 font-bold text-xs sm:hidden transition shadow-xs"
          >
            Done
          </button>
        </div>
      </>
    )}
    </div>
  );
}
