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

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Activity, Users, Repeat, Compass, Flag, Flame, 
  ChevronDown, Check, SlidersHorizontal, ArrowRight, Gauge, Zap, X
} from 'lucide-react';

export const TEST_PROTOCOLS = [
  {
    id: 'standard',
    name: 'Standard Sprint (Straight)',
    shortName: 'Standard Sprint',
    category: 'Straight Sprint',
    icon: Zap,
    badge: 'Optical Laser Gate',
    desc: 'Single-lane sprint with high-precision intermediate gate splits',
    hasDistance: true,
    defaultDist: 40,
    presets: [10, 20, 30, 40, 60, 100],
    color: 'emerald'
  },
  {
    id: 'mass_sprint',
    name: 'Mass Sprint Test (Multi-Athlete Heat)',
    shortName: 'Mass Sprint Heat',
    category: 'Multi-Runner Heat',
    icon: Users,
    badge: 'Continuous Waves',
    desc: 'Multi-athlete continuous staggered heat with dynamic queue management',
    hasDistance: true,
    defaultDist: 40,
    presets: [20, 40, 60],
    color: 'sky'
  },
  {
    id: 'shuttle',
    name: '4x10m Shuttle Run',
    shortName: '4x10m Shuttle',
    category: 'Agility & COD',
    icon: Repeat,
    badge: '40m Total (4 x 10m)',
    desc: 'World Athletics agility shuttle with 3 turnaround line touches',
    hasDistance: false,
    fixedDistDisplay: '40m (4x10m)',
    color: 'amber'
  },
  {
    id: 'pro_agility',
    name: 'Pro Agility (5-10-5)',
    shortName: 'Pro Agility (5-10-5)',
    category: 'Agility & COD',
    icon: Compass,
    badge: '20 yd (18.3m)',
    desc: 'Pro Combine lateral change-of-direction agility assessment',
    hasDistance: false,
    fixedDistDisplay: '20 yd (18.3m)',
    color: 'cyan'
  },
  {
    id: 'l_drill',
    name: 'L-Drill (3-Cone)',
    shortName: 'L-Drill (3-Cone)',
    category: 'Agility & COD',
    icon: Flag,
    badge: '30 yd (27.4m)',
    desc: 'Pro Combine 3-cone L-shaped figure-eight cutting and acceleration',
    hasDistance: false,
    fixedDistDisplay: '30 yd (27.4m)',
    color: 'purple'
  },
  {
    id: 'rsa',
    name: 'Repeated Sprint Ability (RSA)',
    shortName: 'RSA Sprint Series',
    category: 'Anaerobic Fatigue',
    icon: Flame,
    badge: 'Series Fatigue %',
    desc: 'High-intensity interval sprints measuring anaerobic fatigue decrement (S_dec)',
    hasDistance: true,
    defaultDist: 30,
    presets: [20, 30, 40],
    color: 'rose'
  }
];

export default function LiveTestModeSelector({
  testMode = 'standard',
  onChangeTestMode,
  trackDistance = '40',
  onChangeTrackDistance,
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditingDistance, setIsEditingDistance] = useState(false);
  const [tempDistance, setTempDistance] = useState(trackDistance);
  const dropdownRef = useRef(null);

  useEffect(() => {
    setTempDistance(trackDistance);
  }, [trackDistance]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
        setIsEditingDistance(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const activeProtocol = TEST_PROTOCOLS.find(p => p.id === testMode) || TEST_PROTOCOLS[0];
  const ActiveIcon = activeProtocol.icon;

  const handleSelectMode = (modeId) => {
    if (onChangeTestMode) {
      onChangeTestMode(modeId);
    }
    setIsOpen(false);
  };

  const handleDistanceSubmit = () => {
    const parsed = parseFloat(tempDistance);
    if (!isNaN(parsed) && parsed > 0 && onChangeTrackDistance) {
      onChangeTrackDistance(parsed.toString());
    }
    setIsEditingDistance(false);
  };

  return (
    <div ref={dropdownRef} className={`relative ${isOpen ? 'z-[100]' : 'z-40'} flex items-center gap-1.5 sm:gap-2 ${className}`}>
      
      {/* 1. Main Test Protocol Dropdown Trigger */}
      <div className="relative">
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setIsOpen(!isOpen)}
          className={`group flex items-center gap-2 sm:gap-2.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-2xl border transition-all duration-200 shadow-sm ${
            isOpen 
              ? 'bg-white dark:bg-slate-900 border-emerald-500 ring-2 ring-emerald-500/20 text-gray-900 dark:text-white' 
              : 'bg-white/90 dark:bg-slate-900/90 hover:bg-white dark:hover:bg-slate-850 border-gray-200/90 dark:border-slate-700/80 text-gray-800 dark:text-gray-100 hover:border-gray-300 dark:hover:border-slate-600'
          }`}
          title="Select Active Athletic Timing Test Protocol"
          aria-expanded={isOpen}
        >
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <ActiveIcon size={14} className="sm:w-4 sm:h-4" />
          </div>

          <div className="text-left flex flex-col">
            <div className="text-[9px] uppercase font-bold tracking-wider text-gray-600 dark:text-gray-300 leading-none">
              TEST PROTOCOL
            </div>
            <div className="text-xs sm:text-sm font-extrabold tracking-tight flex items-center gap-1.5 mt-0.5 text-gray-900 dark:text-white">
              <span>{activeProtocol.shortName}</span>
              <ChevronDown 
                size={14} 
                className={`text-gray-600 dark:text-gray-300 transition-transform duration-200 ${isOpen ? 'rotate-180 text-emerald-500' : ''}`} 
              />
            </div>
          </div>
        </motion.button>

        {/* Centered Modal Overlay for Protocol Selection with AnimatePresence */}
        <AnimatePresence>
          {isOpen && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6">
              {/* Screen Backdrop for Instant Focus and Click-Away Dismissal */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                }}
              />

              <motion.div 
                initial={{ opacity: 0, scale: 0.94, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 12 }}
                transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                className="relative w-full max-w-[440px] bg-white dark:bg-slate-900 border-2 border-emerald-500/50 dark:border-emerald-500/40 rounded-3xl shadow-[0_25px_80px_rgba(0,0,0,0.8)] overflow-hidden backdrop-blur-2xl z-[121] text-gray-900 dark:text-white my-auto"
                onClick={(e) => e.stopPropagation()}
              >
                
                {/* Header info with Direct Close Button */}
                <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800 bg-gray-50/95 dark:bg-slate-950/90 flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 flex items-center gap-1.5">
                    <SlidersHorizontal size={12} className="text-emerald-500" />
                    Select Timing Test Discipline
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      6 PROTOCOLS
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsOpen(false);
                      }}
                      className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-slate-800 transition"
                      title="Close protocol menu"
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>

                {/* Protocol Items List */}
                <div className="p-2 flex flex-col gap-1 max-h-[60vh] sm:max-h-[420px] overflow-y-auto">
                  {TEST_PROTOCOLS.map((protocol) => {
                    const isSelected = protocol.id === testMode;
                    const Icon = protocol.icon;

                    return (
                      <motion.button
                        key={protocol.id}
                        type="button"
                        whileHover={{ scale: 1.015, x: 3 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleSelectMode(protocol.id)}
                        className={`group w-full flex items-start gap-3 p-2.5 rounded-2xl text-left transition-all ${
                          isSelected
                            ? 'bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/40 text-emerald-950 dark:text-white shadow-xs'
                            : 'hover:bg-gray-100/80 dark:hover:bg-slate-800/80 border border-transparent text-gray-700 dark:text-gray-200'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 transition ${
                          isSelected
                            ? 'bg-emerald-500 text-black shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                            : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 group-hover:text-emerald-500 group-hover:bg-emerald-500/10'
                        }`}>
                          <Icon size={16} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className={`text-xs sm:text-sm font-extrabold truncate ${
                              isSelected ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-900 dark:text-white'
                            }`}>
                              {protocol.name}
                            </span>
                            {isSelected && (
                              <span className="w-5 h-5 rounded-full bg-emerald-500 text-black flex items-center justify-center shrink-0 text-xs">
                                <Check size={12} strokeWidth={3} />
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5 line-clamp-1 leading-snug">
                            {protocol.desc}
                          </div>

                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-md bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700">
                              {protocol.badge}
                            </span>
                            <span className="text-[9px] font-mono text-gray-400 dark:text-slate-500">
                              {protocol.category}
                            </span>
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* 2. Track Distance Quick Selector (Adjacent to Test Mode) */}
      {activeProtocol.hasDistance ? (
        <div className="flex items-center bg-white/90 dark:bg-slate-900/90 border border-gray-200/90 dark:border-slate-700/80 rounded-2xl p-1 shadow-sm">
          {/* Quick Distance Preset Pills */}
          <div className="hidden sm:flex items-center gap-0.5">
            {activeProtocol.presets.map((dist) => {
              const isCurrent = parseFloat(trackDistance) === dist;
              return (
                <button
                  key={dist}
                  type="button"
                  onClick={() => onChangeTrackDistance && onChangeTrackDistance(dist.toString())}
                  className={`px-2 py-1 rounded-xl text-xs font-mono font-bold transition ${
                    isCurrent
                      ? 'bg-emerald-500 text-black shadow-xs'
                      : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800'
                  }`}
                  title={`Set Track Distance to ${dist} meters`}
                >
                  {dist}m
                </button>
              );
            })}
          </div>

          {/* Editable Distance Pill for Custom Distances or Mobile */}
          <div className="flex items-center pl-1 sm:pl-1.5 sm:border-l border-gray-200 dark:border-slate-700">
            {isEditingDistance ? (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  max="500"
                  autoFocus
                  value={tempDistance}
                  onChange={(e) => setTempDistance(e.target.value)}
                  onBlur={handleDistanceSubmit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleDistanceSubmit();
                    if (e.key === 'Escape') setIsEditingDistance(false);
                  }}
                  className="w-14 px-1.5 py-0.5 bg-gray-50 dark:bg-slate-950 border border-emerald-500 rounded-lg text-xs font-mono font-bold text-gray-900 dark:text-white text-center focus:outline-none"
                />
                <span className="text-[11px] font-mono font-bold text-gray-400">m</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditingDistance(true)}
                className="flex items-center gap-1 px-2 py-1 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 text-xs font-mono font-bold text-gray-800 dark:text-gray-200 transition"
                title="Click to enter custom track distance in meters"
              >
                <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">{trackDistance}</span>
                <span className="text-gray-400">m</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Fixed Distance Badge for Agility Drills */
        <div className="flex items-center gap-1.5 px-3 py-1.5 sm:py-2 bg-white/90 dark:bg-slate-900/90 border border-gray-200/90 dark:border-slate-700/80 rounded-2xl text-xs font-mono font-bold text-gray-600 dark:text-slate-300 shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
          <span>{activeProtocol.fixedDistDisplay}</span>
        </div>
      )}

    </div>
  );
}
