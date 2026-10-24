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

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Zap, Trophy, TrendingUp, Gauge, ArrowRight, ArrowDownRight, ArrowUpRight, 
  Download, Sliders, ChevronDown, Check, Award, Activity, 
  HelpCircle, Sparkles, X, User, Flag, Clock, Layers, ShieldCheck, FileText
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { savePdfFile } from '../utils/pdfDownloader';
import { addVelocityLabLogoToPdf } from '../utils/logoPdfHelper';
import { 
  extractCheckpoints, 
  computeSectorDeltas, 
  generateSectorCoachingDiagnosis, 
  PRESET_BENCHMARKS 
} from '../utils/splitDeltaAnalysis';

/**
 * SprintSplitDeltaChart
 * Broadcast-grade Sector Gain/Loss Split Delta Bar Chart
 * Compares athlete sector velocity, intermediate gate splits, and cumulative race gaps
 * against Personal Records (PR), Session Best, Rival Athletes, or Elite Benchmarks.
 */
function SprintSplitDeltaChart({
  currentRun = null,
  athlete = null,
  history = [],
  results = [],
  roster = [],
  onOpenFullModal = null,
  isModal = false,
  onClose = null
}) {
  // Reactively track light vs dark theme
  const [isDark, setIsDark] = useState(() => {
    return typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : true;
  });

  useEffect(() => {
    const checkTheme = () => setIsDark(document.documentElement.classList.contains('dark'));
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Benchmark comparison mode: 'pr' | 'session_best' | 'rival' | 'preset'
  const [benchmarkMode, setBenchmarkMode] = useState('pr');
  const [selectedRivalName, setSelectedRivalName] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState('combine_elite');

  // Visualization View Mode: 'delta_bars' | 'velocity_bars' | 'cumulative_gap'
  const [viewMode, setViewMode] = useState('delta_bars');

  // Speed unit: 'mps' (m/s) | 'kmh' (km/h) | 'mph' (mph)
  const [speedUnit, setSpeedUnit] = useState('mps');

  // 1. Resolve Active Target Athlete Run
  const activeAthleteRun = useMemo(() => {
    if (currentRun && currentRun.time && parseFloat(currentRun.time) > 0) {
      return currentRun;
    }
    // Filter runs by athlete name if available
    const allRuns = [...(results || []), ...(history || [])]
      .filter(r => r.time && parseFloat(r.time) > 0);

    if (athlete?.name) {
      const match = allRuns.find(r => r.name === athlete.name);
      if (match) return match;
    }
    return allRuns.length > 0 ? allRuns[0] : null;
  }, [currentRun, athlete, results, history]);

  const athleteName = activeAthleteRun?.name || athlete?.name || 'Athlete';

  const currentTestType = useMemo(() => {
    if (activeAthleteRun?.testType) return activeAthleteRun.testType;
    const dStr = String(activeAthleteRun?.distance || '').toLowerCase();
    if (dStr.includes('agility') || dStr.includes('5-10-5')) return 'pro_agility';
    if (dStr.includes('l-drill') || dStr.includes('3-cone')) return 'l_drill';
    return 'sprint';
  }, [activeAthleteRun]);

  const defaultPreset = useMemo(() => {
    if (currentTestType === 'pro_agility') return PRESET_BENCHMARKS.pro_agility_combine_elite;
    if (currentTestType === 'l_drill') return PRESET_BENCHMARKS.l_drill_combine_elite;
    return PRESET_BENCHMARKS.combine_elite;
  }, [currentTestType]);

  // Sync preset selection when testType changes
  React.useEffect(() => {
    if (currentTestType === 'pro_agility' && !selectedPresetId.startsWith('pro_agility')) {
      setSelectedPresetId('pro_agility_combine_elite');
    } else if (currentTestType === 'l_drill' && !selectedPresetId.startsWith('l_drill')) {
      setSelectedPresetId('l_drill_combine_elite');
    } else if (currentTestType === 'sprint' && (selectedPresetId.startsWith('pro_agility') || selectedPresetId.startsWith('l_drill'))) {
      setSelectedPresetId('combine_elite');
    }
  }, [currentTestType, selectedPresetId]);

  const testTypeMatches = (r) => {
    if (!r) return false;
    const rType = r.testType || (String(r.distance || '').toLowerCase().includes('agility') ? 'pro_agility' : (String(r.distance || '').toLowerCase().includes('l-drill') ? 'l_drill' : 'sprint'));
    return rType === currentTestType;
  };

  // 2. Resolve Athlete Personal Record (PR) Run
  const athletePRRun = useMemo(() => {
    const runs = [...(results || []), ...(history || [])]
      .filter(r => r.name === athleteName && r.time && parseFloat(r.time) > 0 && testTypeMatches(r));
    if (runs.length === 0) return null;
    return [...runs].sort((a, b) => parseFloat(a.time) - parseFloat(b.time))[0];
  }, [results, history, athleteName, currentTestType]);

  // 3. Resolve Session Best Run
  const sessionBestRun = useMemo(() => {
    const runs = [...(results || []), ...(history || [])]
      .filter(r => r.time && parseFloat(r.time) > 0 && testTypeMatches(r));
    if (runs.length === 0) return null;
    return [...runs].sort((a, b) => parseFloat(a.time) - parseFloat(b.time))[0];
  }, [results, history, currentTestType]);

  // 4. Resolve Rival Athletes List
  const rivalOptions = useMemo(() => {
    const set = new Set();
    [...(results || []), ...(history || []), ...(roster || [])].forEach(r => {
      if (r?.name && r.name !== athleteName) set.add(r.name);
    });
    return Array.from(set).sort();
  }, [results, history, roster, athleteName]);

  // Default rival selection
  const resolvedRivalName = selectedRivalName || (rivalOptions.length > 0 ? rivalOptions[0] : '');

  const rivalRun = useMemo(() => {
    if (!resolvedRivalName) return null;
    const runs = [...(results || []), ...(history || [])]
      .filter(r => r.name === resolvedRivalName && r.time && parseFloat(r.time) > 0 && testTypeMatches(r));
    if (runs.length === 0) return null;
    return [...runs].sort((a, b) => parseFloat(a.time) - parseFloat(b.time))[0];
  }, [results, history, resolvedRivalName, currentTestType]);

  // 5. Resolve Benchmark Run Object Based on Mode
  const benchmarkRun = useMemo(() => {
    if (benchmarkMode === 'pr') {
      // If comparing against PR, use athlete's best historical run
      if (athletePRRun && (athletePRRun !== activeAthleteRun || athletePRRun.splits?.length > 0)) {
        return athletePRRun;
      }
      // If current run IS the PR, compare against session best or preset
      if (sessionBestRun && sessionBestRun.name !== athleteName) {
        return sessionBestRun;
      }
      return defaultPreset;
    }

    if (benchmarkMode === 'session_best') {
      return sessionBestRun || defaultPreset;
    }

    if (benchmarkMode === 'rival') {
      return rivalRun || defaultPreset;
    }

    if (benchmarkMode === 'preset') {
      return PRESET_BENCHMARKS[selectedPresetId] || defaultPreset;
    }

    return defaultPreset;
  }, [benchmarkMode, athletePRRun, activeAthleteRun, sessionBestRun, athleteName, rivalRun, selectedPresetId, defaultPreset]);

  // Benchmark display label
  const benchmarkLabel = useMemo(() => {
    if (benchmarkMode === 'pr') {
      return athletePRRun ? `Personal Record (${athletePRRun.time}s)` : `${defaultPreset.name}`;
    }
    if (benchmarkMode === 'session_best') {
      return sessionBestRun ? `${sessionBestRun.name} (Session Best ${sessionBestRun.time}s)` : 'Session Best';
    }
    if (benchmarkMode === 'rival') {
      return rivalRun ? `${resolvedRivalName} (Best ${rivalRun.time}s)` : 'Rival Athlete';
    }
    if (benchmarkMode === 'preset') {
      return PRESET_BENCHMARKS[selectedPresetId]?.name || defaultPreset.name;
    }
    return 'Benchmark';
  }, [benchmarkMode, athletePRRun, sessionBestRun, rivalRun, resolvedRivalName, selectedPresetId, defaultPreset]);

  // 6. Compute Sector Deltas
  const deltaAnalysis = useMemo(() => {
    if (!activeAthleteRun) {
      return { sectors: [], cumulativeDelta: 0, maxVelocityGain: 0, strongestSector: null, weakestSector: null };
    }
    return computeSectorDeltas(activeAthleteRun, benchmarkRun);
  }, [activeAthleteRun, benchmarkRun]);

  const { sectors, cumulativeDelta } = deltaAnalysis;

  // Automated Coaching Diagnosis
  const coachingNotes = useMemo(() => {
    return generateSectorCoachingDiagnosis(sectors, athleteName);
  }, [sectors, athleteName]);

  // Speed unit converter
  const formatSpeed = (mps) => {
    if (speedUnit === 'kmh') return `${(mps * 3.6).toFixed(1)} km/h`;
    if (speedUnit === 'mph') return `${(mps * 2.23694).toFixed(1)} mph`;
    return `${mps.toFixed(2)} m/s`;
  };

  // Maximum delta range for dynamic bar scaling (e.g. +/- 0.20s)
  const maxDeltaAbs = useMemo(() => {
    if (sectors.length === 0) return 0.2;
    const maxVal = Math.max(...sectors.map(s => Math.abs(s.sectorTimeDelta)));
    return Math.max(0.12, Math.min(0.5, Math.ceil(maxVal * 20) / 20));
  }, [sectors]);

  // PDF Export
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF();
      const eventTitle = activeAthleteRun?.distance 
        ? (String(activeAthleteRun.distance).toLowerCase().includes('agility') || String(activeAthleteRun.distance).toLowerCase().includes('drill') || String(activeAthleteRun.distance).toLowerCase().includes('shuttle')
            ? activeAthleteRun.distance 
            : (String(activeAthleteRun.distance).toLowerCase().includes('m') ? activeAthleteRun.distance : `${activeAthleteRun.distance}m Sprint`))
        : (activeAthleteRun?.distanceMeters ? `${activeAthleteRun.distanceMeters}m Sprint` : 'Sprint Assessment');
      const dateStr = activeAthleteRun?.date || new Date().toLocaleDateString();

      // Header Banner
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 40, 'F');

      // Official Velocity Lab Brand Header Logo
      addVelocityLabLogoToPdf(doc, { x: 14, y: 12, width: 48, isDark: true });

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont(undefined, 'normal');
      doc.text("Sprint Split Delta & Sector Telemetry Report", 196, 24, { align: 'right' });

      // Profile Overview Card
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, 46, 182, 30, 2, 2, 'FD');

      doc.setTextColor(15, 23, 42);
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.text(`Athlete: ${athleteName}`, 20, 56);
      doc.setFont(undefined, 'normal');
      doc.setFontSize(9);
      doc.text(`Event: ${eventTitle} | Official Time: ${activeAthleteRun?.time || 'N/A'}s | Date: ${dateStr}`, 20, 64);
      doc.text(`Comparison Baseline: ${benchmarkLabel} (${benchmarkRun?.time || 'N/A'}s) | Net Race Delta: ${cumulativeDelta <= 0 ? `${cumulativeDelta}s (Ahead)` : `+${cumulativeDelta}s (Behind)`}`, 20, 71);

      // Sector Delta Table
      const tableData = sectors.map(s => [
        s.label,
        s.phase,
        `${s.athleteSectorTime.toFixed(2)}s`,
        `${s.benchmarkSectorTime.toFixed(2)}s`,
        s.deltaFormatted,
        `${s.athleteVelocity.toFixed(2)} m/s`,
        `${s.benchmarkVelocity.toFixed(2)} m/s`,
        `${s.velocityDelta > 0 ? '+' : ''}${s.velocityDelta.toFixed(2)} m/s`,
        `${s.cumulativeTimeDelta > 0 ? '+' : ''}${s.cumulativeTimeDelta.toFixed(2)}s`
      ]);

      autoTable(doc, {
        startY: 82,
        head: [['SECTOR', 'PHASE', 'ATHLETE SPLIT', 'BENCHMARK', 'SPLIT DELTA', 'ATHLETE SPEED', 'BENCH. SPEED', 'SPEED DELTA', 'NET GAP']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 3 }
      });

      // Biomechanical Coaching Diagnosis Section
      const finalY = doc.lastAutoTable?.finalY || 180;
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text("SPORTS SCIENCE SECTOR EVALUATION & ACTION PLAN", 14, finalY + 12);

      let curY = finalY + 18;
      coachingNotes.forEach((n, idx) => {
        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(n.type === 'strength' ? 16 : 220, n.type === 'strength' ? 185 : 38, n.type === 'strength' ? 129 : 38);
        doc.text(`• [${n.sector}] ${n.title}`, 16, curY);

        doc.setFont(undefined, 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text(doc.splitTextToSize(n.message, 175), 20, curY + 5);
        curY += 14;
      });

      // Footer
      doc.setTextColor(148, 163, 184);
      doc.setFontSize(8);
      doc.text("Generated by Velocity Lab SprintGate Timing System • Precision Dual-Gate Optical Timing Engine", 105, 288, { align: 'center' });

      savePdfFile(doc, `Split_Delta_Report_${athleteName.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error("Split Delta PDF generation error:", err);
    }
  };

  // Inner Content Layout
  const content = (
    <div className="flex flex-col gap-4">
      
      {/* Top Header & Baseline Selector Toolbar */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 p-4 rounded-2xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <Layers size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/15 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/30">
                Sector Split Delta
              </span>
              <span className="text-xs text-gray-500 dark:text-slate-400 font-mono">
                {activeAthleteRun?.time ? `${activeAthleteRun.time}s Total` : 'Live Splits'}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white tracking-tight mt-0.5">
              Sector Split Gain / Loss Visualizer
            </h3>
          </div>
        </div>

        {/* Baseline Comparison Switcher */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-start lg:justify-end">
          <div className="flex items-center bg-white dark:bg-slate-950 p-1 rounded-xl border border-gray-200 dark:border-slate-800 text-xs font-bold shadow-xs">
            <button
              onClick={() => setBenchmarkMode('pr')}
              className={`px-3 py-1.5 rounded-lg transition ${
                benchmarkMode === 'pr' 
                  ? 'bg-purple-600 text-white shadow-sm' 
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Athlete PR
            </button>
            <button
              onClick={() => setBenchmarkMode('session_best')}
              className={`px-3 py-1.5 rounded-lg transition ${
                benchmarkMode === 'session_best' 
                  ? 'bg-purple-600 text-white shadow-sm' 
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Session Best
            </button>
            <button
              onClick={() => setBenchmarkMode('rival')}
              className={`px-3 py-1.5 rounded-lg transition ${
                benchmarkMode === 'rival' 
                  ? 'bg-purple-600 text-white shadow-sm' 
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Rival Heat
            </button>
            <button
              onClick={() => setBenchmarkMode('preset')}
              className={`px-3 py-1.5 rounded-lg transition ${
                benchmarkMode === 'preset' 
                  ? 'bg-purple-600 text-white shadow-sm' 
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Elite Model
            </button>
          </div>

          {/* Conditional Dropdown for Rival or Preset */}
          {benchmarkMode === 'rival' && rivalOptions.length > 0 && (
            <select
              value={resolvedRivalName}
              onChange={(e) => setSelectedRivalName(e.target.value)}
              className="px-3 py-1.5 bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-bold text-gray-800 dark:text-slate-200 focus:outline-none focus:border-purple-500 shadow-xs"
            >
              {rivalOptions.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          )}

          {benchmarkMode === 'preset' && (
            <select
              value={selectedPresetId}
              onChange={(e) => setSelectedPresetId(e.target.value)}
              className="px-3 py-1.5 bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-bold text-gray-800 dark:text-slate-200 focus:outline-none focus:border-purple-500 shadow-xs"
            >
              <optgroup label="Pro Agility (5-10-5) Combine Presets">
                <option value="pro_agility_combine_elite">Pro Combine Elite (3.85s / 5-10-5)</option>
                <option value="pro_agility_d1">Collegiate D1 Pro Agility (4.15s / 5-10-5)</option>
              </optgroup>
              <optgroup label="3-Cone L-Drill Combine Presets">
                <option value="l_drill_combine_elite">Pro Combine Elite 3-Cone (6.70s)</option>
                <option value="l_drill_d1">Collegiate D1 3-Cone L-Drill (7.10s)</option>
              </optgroup>
              <optgroup label="40m Linear Sprint Models">
                <option value="combine_elite">Pro Combine Elite (4.40s / 40yd)</option>
                <option value="world_championship_100m_model">World Championship 100m Pace (4.62s/40m)</option>
                <option value="collegiate_target">Collegiate D1 Target (4.72s / 40m)</option>
                <option value="high_school_varsity">High School Varsity (5.10s / 40m)</option>
              </optgroup>
            </select>
          )}

          {/* Export PDF Button */}
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-bold transition shadow-xs"
            title="Export Sector Split Report as PDF"
          >
            <Download size={13} />
            <span className="hidden sm:inline">PDF</span>
          </button>

          {/* Full Screen / Modal Trigger if in Card Mode */}
          {!isModal && onOpenFullModal && (
            <button
              onClick={onOpenFullModal}
              className="p-1.5 bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-300 rounded-xl border border-gray-200 dark:border-slate-700 transition shadow-xs"
              title="Expand to Full Diagnostic Suite"
            >
              <Sliders size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Comparison Overview Pill */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-950/60 border border-gray-200 dark:border-slate-800/80 text-xs shadow-xs">
        <div className="flex items-center gap-2">
          <span className="text-gray-500 dark:text-slate-400">Comparing</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">{athleteName} ({activeAthleteRun?.time || '0.00'}s)</span>
          <ArrowRight size={13} className="text-gray-400 dark:text-slate-500" />
          <span className="font-bold text-purple-600 dark:text-purple-400 font-mono">{benchmarkLabel}</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 dark:text-slate-400">Net Race Margin:</span>
            <span className={`font-mono font-black text-sm ${cumulativeDelta <= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {cumulativeDelta <= 0 ? `${cumulativeDelta}s` : `+${cumulativeDelta}s`}
            </span>
            <span className="text-[10px] text-gray-400 dark:text-slate-500 uppercase font-sans">
              {cumulativeDelta <= 0 ? '(Ahead)' : '(Behind)'}
            </span>
          </div>

          {/* Unit Toggle */}
          <div className="flex items-center bg-white dark:bg-slate-900 px-1 py-0.5 rounded-lg border border-gray-200 dark:border-slate-800 text-[10px] font-mono font-bold shadow-xs">
            {['mps', 'kmh', 'mph'].map(u => (
              <button
                key={u}
                onClick={() => setSpeedUnit(u)}
                className={`px-1.5 py-0.5 rounded transition ${
                  speedUnit === u ? 'bg-purple-600 text-white shadow-xs' : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {u === 'mps' ? 'm/s' : u}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* View Mode Switcher Pills */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-slate-800 pb-2 overflow-x-auto text-xs font-bold">
        <button
          onClick={() => setViewMode('delta_bars')}
          className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${
            viewMode === 'delta_bars'
              ? 'bg-purple-50 dark:bg-purple-600/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/40 shadow-xs'
              : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800/40'
          }`}
        >
          <TrendingUp size={14} />
          Diverging Sector Delta (Gain / Loss)
        </button>

        <button
          onClick={() => setViewMode('velocity_bars')}
          className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${
            viewMode === 'velocity_bars'
              ? 'bg-purple-50 dark:bg-purple-600/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/40 shadow-xs'
              : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800/40'
          }`}
        >
          <Gauge size={14} />
          Sector Velocity Profile ({speedUnit === 'mps' ? 'm/s' : speedUnit})
        </button>

        <button
          onClick={() => setViewMode('cumulative_gap')}
          className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${
            viewMode === 'cumulative_gap'
              ? 'bg-purple-50 dark:bg-purple-600/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/40 shadow-xs'
              : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800/40'
          }`}
        >
          <Clock size={14} />
          Cumulative Race Margin Timeline
        </button>
      </div>

      {/* MAIN VISUALIZATION: DIVERGING SECTOR DELTA BARS */}
      {viewMode === 'delta_bars' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400 px-2 font-mono">
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
              <ArrowDownRight size={13} />
              TIME GAINED (FASTER THAN BENCHMARK)
            </span>
            <span className="text-[10px] uppercase font-bold text-gray-400 dark:text-slate-500">Center Zero (0.00s)</span>
            <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-bold">
              TIME CONCEDED (SLOWER)
              <ArrowUpRight size={13} />
            </span>
          </div>

          {/* Diverging Sector Rows */}
          <div className="space-y-2.5">
            {sectors.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-500 font-mono">
                No sector checkpoint data available for this comparison.
              </div>
            ) : (
              sectors.map((sec, idx) => {
              const delta = sec.sectorTimeDelta;
              const isGain = delta < 0;
              const absVal = Math.abs(delta);
              const barPercent = Math.min(100, (absVal / maxDeltaAbs) * 100);

              const isPurple = sec.tier === 'purple';
              const isGreen = sec.tier === 'green';
              const isAmber = sec.tier === 'amber';

              return (
                <div 
                  key={idx}
                  className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 transition shadow-xs"
                >
                  <div className="flex items-center justify-between text-xs mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-gray-100 dark:bg-slate-800 flex items-center justify-center font-mono font-bold text-gray-700 dark:text-slate-300">
                        S{sec.sectorIndex}
                      </span>
                      <span className="font-bold text-gray-900 dark:text-white text-sm">{sec.label}</span>
                      <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 border border-gray-200 dark:border-slate-700">
                        {sec.phase}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-mono">
                      <span className="text-gray-500 dark:text-slate-400">
                        {sec.athleteSectorTime.toFixed(2)}s <span className="text-[10px] text-gray-400 dark:text-slate-500">vs</span> {sec.benchmarkSectorTime.toFixed(2)}s
                      </span>
                      <span className={`px-2 py-0.5 rounded-lg font-bold text-xs ${
                        isPurple ? 'bg-purple-50 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/40' :
                        isGreen ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/40' :
                        isAmber ? 'bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/40' :
                        'bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/40'
                      }`}>
                        {sec.deltaFormatted}
                      </span>
                    </div>
                  </div>

                  {/* Diverging Bar Track with Center Zero */}
                  <div className="grid grid-cols-2 gap-1 items-center h-7 bg-gray-100 dark:bg-slate-950 rounded-xl px-2 border border-gray-200 dark:border-slate-800/80 relative overflow-hidden">
                    {/* Center Zero Axis Line */}
                    <div className="absolute left-1/2 top-0 bottom-0 w-[2px] bg-gray-300 dark:bg-slate-700 z-10" />

                    {/* Left Column: Gain (Green / Purple extending left from center) */}
                    <div className="flex justify-end items-center h-full pr-1">
                      {isGain && (
                        <div 
                          className={`h-4 rounded-l-md transition-all duration-500 relative flex items-center justify-start pl-1.5 text-[9px] font-mono font-bold text-slate-950 ${
                            isPurple 
                              ? 'bg-gradient-to-l from-purple-500 to-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.4)]' 
                              : 'bg-gradient-to-l from-emerald-500 to-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                          }`}
                          style={{ width: `${barPercent}%` }}
                        >
                          {sec.deltaFormatted}
                        </div>
                      )}
                    </div>

                    {/* Right Column: Loss (Red / Amber extending right from center) */}
                    <div className="flex justify-start items-center h-full pl-1">
                      {!isGain && delta !== 0 && (
                        <div 
                          className={`h-4 rounded-r-md transition-all duration-500 relative flex items-center justify-end pr-1.5 text-[9px] font-mono font-bold text-slate-950 ${
                            isAmber 
                              ? 'bg-gradient-to-r from-amber-500 to-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.4)]' 
                              : 'bg-gradient-to-r from-rose-500 to-rose-400 shadow-[0_0_12px_rgba(239,68,68,0.4)]'
                          }`}
                          style={{ width: `${barPercent}%` }}
                        >
                          {sec.deltaFormatted}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footnote with Speed Telemetry */}
                  <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-slate-400 mt-2 font-mono px-1">
                    <span>Avg Speed: <strong className="text-gray-900 dark:text-white">{formatSpeed(sec.athleteVelocity)}</strong></span>
                    <span>Benchmark: {formatSpeed(sec.benchmarkVelocity)}</span>
                    <span className={sec.velocityDelta >= 0 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-rose-600 dark:text-rose-400 font-bold'}>
                      {sec.velocityDelta >= 0 ? `+${sec.velocityDelta} m/s` : `${sec.velocityDelta} m/s`}
                    </span>
                  </div>
                </div>
              );
            }))}
          </div>
        </div>
      )}

      {/* VIEW MODE 2: SIDE-BY-SIDE VELOCITY PROFILE */}
      {viewMode === 'velocity_bars' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {sectors.length === 0 ? (
              <div className="col-span-full py-8 text-center text-xs text-gray-500 font-mono">
                No sector checkpoint data available for this comparison.
              </div>
            ) : (
              sectors.map((sec, idx) => {
              const maxVelocityInSet = 11.5;
              const athleteVPercent = Math.min(100, (sec.athleteVelocity / maxVelocityInSet) * 100);
              const benchmarkVPercent = Math.min(100, (sec.benchmarkVelocity / maxVelocityInSet) * 100);

              return (
                <div key={idx} className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 flex flex-col justify-between shadow-xs">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-gray-900 dark:text-white">{sec.label}</span>
                      <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-slate-400 font-mono">{sec.phaseCode}</span>
                    </div>
                    <div className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                      {formatSpeed(sec.athleteVelocity)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-slate-400 font-mono mt-0.5">
                      Benchmark: {formatSpeed(sec.benchmarkVelocity)}
                    </div>
                  </div>

                  {/* Comparative Vertical / Horizontal Progress Bars */}
                  <div className="space-y-1.5 mt-4">
                    <div>
                      <div className="flex justify-between text-[10px] text-gray-500 dark:text-slate-400 font-mono mb-0.5">
                        <span>Athlete</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">{sec.athleteVelocity} m/s</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 dark:bg-slate-950 overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                          style={{ width: `${athleteVPercent}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[10px] text-gray-500 dark:text-slate-400 font-mono mb-0.5">
                        <span>Benchmark</span>
                        <span className="text-purple-600 dark:text-purple-400 font-bold">{sec.benchmarkVelocity} m/s</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 dark:bg-slate-950 overflow-hidden">
                        <div 
                          className="h-full bg-purple-500/80 rounded-full transition-all duration-500" 
                          style={{ width: `${benchmarkVPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Velocity Delta Chip */}
                  <div className="mt-3 pt-2 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-mono">
                    <span className="text-gray-500 dark:text-slate-400">Delta:</span>
                    <span className={`font-bold ${sec.velocityDelta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {sec.velocityDelta >= 0 ? `+${sec.velocityDelta} m/s` : `${sec.velocityDelta} m/s`}
                    </span>
                  </div>
                </div>
              );
            }))}
          </div>
        </div>
      )}

      {/* VIEW MODE 3: CUMULATIVE RACE MARGIN TIMELINE */}
      {viewMode === 'cumulative_gap' && (
        <div className="space-y-3 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs mb-2">
            <div>
              <h4 className="font-bold text-gray-900 dark:text-white">Cumulative Time Lead / Deficit Along Sprint Course</h4>
              <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">Traces where the runner gained or conceded advantage meter-by-meter.</p>
            </div>
            <span className="font-mono text-xs text-purple-600 dark:text-purple-400 font-bold">
              Finish Margin: {cumulativeDelta <= 0 ? `${cumulativeDelta}s` : `+${cumulativeDelta}s`}
            </span>
          </div>

          {/* Stepped Timeline */}
          <div className="relative pt-4 pb-2">
            <div className="h-1 bg-gray-200 dark:bg-slate-800 rounded-full w-full absolute top-9" />
            
            <div className="grid grid-cols-4 gap-2 relative z-10">
              {sectors.length === 0 ? (
                <div className="col-span-full py-6 text-center text-xs text-gray-500 font-mono">
                  No sector checkpoint data available for this comparison.
                </div>
              ) : (
                sectors.map((sec, idx) => {
                const cum = sec.cumulativeTimeDelta;
                const isAhead = cum <= 0;

                return (
                  <div key={idx} className="flex flex-col items-center text-center">
                    {/* Node Dot */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border-2 transition ${
                      isAhead 
                        ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-500 text-emerald-700 dark:text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.3)]' 
                        : 'bg-rose-50 dark:bg-rose-950 border-rose-500 text-rose-700 dark:text-rose-300'
                    }`}>
                      {sec.endDist}m
                    </div>

                    {/* Cum Delta Tag */}
                    <div className={`mt-2 font-mono font-bold text-xs ${isAhead ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {isAhead ? `${cum.toFixed(2)}s` : `+${cum.toFixed(2)}s`}
                    </div>

                    <div className="text-[10px] text-gray-500 dark:text-slate-400 font-mono mt-0.5">
                      {sec.athleteCumTime.toFixed(2)}s
                    </div>

                    <span className="text-[9px] uppercase font-bold text-gray-400 dark:text-slate-500 mt-1">
                      {isAhead ? 'AHEAD' : 'BEHIND'}
                    </span>
                  </div>
                );
              }))}
            </div>
          </div>
        </div>
      )}

      {/* Biomechanical Coaching Diagnosis Cards */}
      <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-xs">
        <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2 mb-3">
          <Sparkles size={14} className="text-purple-600 dark:text-purple-400" />
          Automated Sector Coaching Diagnostics & Sprint Mechanics
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {coachingNotes.length === 0 ? (
            <div className="col-span-full py-4 text-center text-xs text-gray-500 font-mono">
              Complete gate splits to generate sector-specific coaching diagnostics.
            </div>
          ) : (
            coachingNotes.map((note, idx) => (
            <div 
              key={idx}
              className={`p-3 rounded-xl border text-xs ${
                note.type === 'strength' 
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/25 text-emerald-800 dark:text-emerald-300' 
                  : note.type === 'improvement'
                  ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/25 text-rose-800 dark:text-rose-300'
                  : 'bg-white dark:bg-slate-950 border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between font-bold mb-1">
                <span>{note.title}</span>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-black/20 text-gray-700 dark:text-gray-300">{note.sector}</span>
              </div>
              <p className="text-[11px] leading-relaxed opacity-90">
                {note.message}
              </p>
            </div>
          )))}
        </div>
      </div>

    </div>
  );

  // If rendering inside a modal
  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto">
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700/80 rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-gray-900 dark:text-white">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between bg-gray-50 dark:bg-slate-950/60">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <Layers size={18} />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white tracking-tight">
                  Sprint Sector Gain/Loss Diagnostic Suite
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  {athleteName} • {activeAthleteRun?.distance ? (String(activeAthleteRun.distance).toLowerCase().includes('m') ? activeAthleteRun.distance : `${activeAthleteRun.distance}m Sprint`) : `${activeAthleteRun?.distanceMeters || 'Track'} Sprint`} Telemetry
                </p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-4 sm:p-5 overflow-y-auto flex-1 bg-white dark:bg-slate-950/70">
            {content}
          </div>

          <div className="p-4 border-t border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 dark:bg-slate-800 hover:bg-gray-300 dark:hover:bg-slate-700 text-gray-800 dark:text-slate-200 rounded-xl text-xs font-bold transition shadow-xs"
            >
              Close Suite
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Otherwise render inline card
  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm">
      {content}
    </div>
  );
}

export default React.memo(SprintSplitDeltaChart);
