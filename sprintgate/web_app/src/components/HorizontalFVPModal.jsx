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
  Zap, Trophy, Activity, ArrowRight, Download, Sliders, 
  HelpCircle, CheckCircle2, AlertTriangle, X, RefreshCw, 
  Dumbbell, TrendingUp, Info, ChevronRight, Wind
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { savePdfFile } from '../utils/pdfDownloader';
import { addVelocityLabLogoToPdf } from '../utils/logoPdfHelper';
import VelocityLabLogo from './VelocityLabLogo';
import { calculateHorizontalFVP } from '../utils/fvpProfiling';

export default function HorizontalFVPModal({
  isOpen = false,
  onClose,
  athlete = null,
  currentRun = null,
  history = [],
  results = []
}) {
  const [isDark, setIsDark] = useState(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return true;
  });

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const checkTheme = () => setIsDark(document.documentElement.classList.contains('dark'));
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Athlete physical parameters with safe defaults
  const [massKg, setMassKg] = useState(() => {
    const raw = athlete?.weight ? parseFloat(athlete.weight) : 75;
    return isNaN(raw) || raw < 30 ? 75 : raw;
  });

  const [heightCm, setHeightCm] = useState(() => {
    const raw = athlete?.height ? parseFloat(athlete.height) : 180;
    return isNaN(raw) || raw < 120 ? 180 : raw;
  });

  const [activeTab, setActiveTab] = useState('fv_curve'); // 'fv_curve' | 'power_curve' | 'training'
  const [windAssist, setWindAssist] = useState(0); // m/s

  // Determine split times for profiling
  const sprintData = useMemo(() => {
    // 1. Check if currentRun has splits
    if (currentRun && currentRun.splits && currentRun.splits.length > 0) {
      return currentRun.splits.map(s => ({
        distance: s.distance || (s.node === 1 ? (currentRun.distance || 40) : (s.node ? s.node * 10 : 20)),
        time: parseFloat(s.time) || 0
      })).filter(s => s.distance > 0 && s.time > 0);
    }

    // 2. Fall back to currentRun distance and time
    if (currentRun && currentRun.time && parseFloat(currentRun.time) > 0) {
      return [{
        distance: parseFloat(currentRun.distance || 40),
        time: parseFloat(currentRun.time)
      }];
    }

    // 3. Fall back to best run in results or history strictly for this athlete
    const targetName = athlete?.name || currentRun?.name;
    const allRuns = [...(results || []), ...(history || [])]
      .filter(r => r.time && parseFloat(r.time) > 0);
    
    const athleteRuns = allRuns.filter(r => !targetName || r.name === targetName);
    const validRuns = athleteRuns.length > 0 ? athleteRuns : [];

    if (validRuns.length > 0) {
      const best = [...validRuns].sort((a,b) => parseFloat(a.time) - parseFloat(b.time))[0];
      return [{
        distance: parseFloat(best.distanceMeters || best.distance || 40),
        time: parseFloat(best.time)
      }];
    }

    // Do not fabricate sprint data
    return null;
  }, [currentRun, results, history, athlete]);

  // Compute Samozino F-v-P profile
  const fvp = useMemo(() => {
    if (!sprintData || sprintData.length === 0) return null;
    return calculateHorizontalFVP({
      splits: sprintData,
      mass: massKg,
      height: heightCm / 100,
      windSpeed: windAssist
    });
  }, [sprintData, massKg, heightCm, windAssist]);

  // Download official Sports Science FVP PDF Report
  const handleExportPDF = () => {
    if (!fvp) {
      alert("No sprint test conducted for this athlete. Complete a sprint trial on the track to export an authentic F-v-P report.");
      return;
    }
    try {
      const doc = new jsPDF();
      const athleteName = athlete?.name || currentRun?.name || 'Sprint Athlete';

      // Header Banner
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 40, 'F');

      // Official Velocity Lab Brand Header Logo
      addVelocityLabLogoToPdf(doc, { x: 14, y: 12, width: 48, isDark: true });

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont(undefined, 'normal');
      doc.text("Horizontal Force-Velocity-Power Report", 195, 24, { align: 'right' });

      // Profile Overview Card
      doc.setFillColor(248, 250, 252);
      doc.rect(14, 46, 182, 36, 'F');

      doc.setTextColor(15, 23, 42);
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.text(athleteName.toUpperCase(), 20, 58);

      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.setFont(undefined, 'normal');
      doc.text(`Body Mass: ${massKg} kg   |   Height: ${heightCm} cm   |   Evaluation Model: Samozino & Morin (2016)`, 20, 68);
      doc.text(`Evaluation Date: ${new Date().toLocaleDateString()}   |   Model Fit Quality (R²): ${fvp.rSquared}`, 20, 75);

      // Theoretical Limits Table
      autoTable(doc, {
        startY: 88,
        head: [['Theoretical Variable', 'Raw Metric', 'Relative Metric', 'Biomechanical Meaning']],
        body: [
          ['F0 (Max Horizontal Force)', `${fvp.f0} N`, `${fvp.f0Rel} N/kg`, 'Explosive drive capacity out of the blocks (v=0)'],
          ['V0 (Max Horizontal Velocity)', `${fvp.v0} m/s`, `${fvp.v0Kmh} km/h`, 'Extrapolated maximum horizontal sprinting velocity ceiling'],
          ['Pmax (Max Horizontal Power)', `${fvp.pmax} W`, `${fvp.pmaxRel} W/kg`, 'Peak horizontal external mechanical power output'],
          ['Sfv (Force-Velocity Slope)', `${fvp.sfv} N·s/m`, `${fvp.sfvRel} N·s/kg·m`, 'Rate of horizontal force decline with increasing speed'],
          ['RFpeak (Peak Ratio of Force)', `${fvp.rfPeak}%`, '--', 'Percentage of total ground reaction force oriented forward'],
          ['DRF (Rate of RF Decline)', `${fvp.drf}%/m·s`, '--', 'Technical efficiency in maintaining forward force orientation']
        ],
        theme: 'striped',
        headStyles: { fillColor: [6, 182, 212], textColor: [0, 0, 0], fontStyle: 'bold' },
        bodyStyles: { fontSize: 9 },
        margin: { left: 14, right: 14 }
      });

      // Diagnosis & Training Table
      const nextY = (doc.lastAutoTable?.finalY || 150) + 12;
      doc.setFontSize(13);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text("F-v Imbalance Diagnosis & Training Prescriptions", 14, nextY);

      autoTable(doc, {
        startY: nextY + 5,
        head: [['Profile Category', 'F-v Balance Index', 'Prescribed Training Priority']],
        body: [
          [fvp.profileType, `${fvp.fvImbalance}% of Optimal`, fvp.deficitDescription],
          ...fvp.trainingPrescription.map(t => [t.title, '--', t.detail])
        ],
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
        bodyStyles: { fontSize: 9 },
        margin: { left: 14, right: 14 }
      });

      savePdfFile(doc, `FVP_Profile_${athleteName.replace(/\s+/g, '_')}_${fvp.profileType.replace(/\s+/g, '_')}.pdf`);
    } catch (e) {
      console.error("FVP PDF export error:", e);
      alert("Failed to export FVP PDF report.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-gray-900 dark:text-gray-100">
        
        {/* 1. Modal Header */}
        <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-gray-50 via-white to-gray-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
          <div className="flex items-center gap-3">
            <VelocityLabLogo variant="compact" className="h-8 w-auto hidden sm:block" />
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)] sm:hidden">
              <Activity size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white tracking-wide">
                  Horizontal Force-Velocity-Power (F-v-P) Profiler
                </h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30">
                  SAMOZINO & MORIN MODEL
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Individualized mechanical assessment: F0, V0, Pmax, and Force-Velocity Imbalance
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPDF}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-black font-bold text-xs transition shadow-sm"
              title="Download PDF Sports Science Report"
            >
              <Download size={14} />
              <span>Export PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white transition border border-gray-200 dark:border-slate-700/80 shadow-xs"
              title="Close modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 2. Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-5 bg-white dark:bg-slate-900">
          {!fvp ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-4 my-auto">
              <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 flex items-center justify-center font-bold">
                <Activity size={32} />
              </div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">No Sprint Test Data Recorded</div>
              <p className="text-xs text-gray-500 dark:text-slate-400 max-w-md">
                Morin & Samozino Force-Velocity-Power profiling requires at least one recorded sprint test on the track for {athlete?.name || currentRun?.name || 'this athlete'}. No fabricated or dummy benchmark data is generated.
              </p>
              <span className="text-[11px] font-mono font-bold px-3 py-1 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 border border-gray-200 dark:border-slate-700">
                Status: Untested / Pending
              </span>
            </div>
          ) : (
            <>
              {/* Athlete Mass & Parameter Sliders */}
              <div className="bg-gray-50 dark:bg-slate-950/70 border border-gray-200 dark:border-slate-800/80 rounded-2xl p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-4 shadow-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shadow-xs">
                    <Sliders size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-900 dark:text-white">
                      Athlete: <span className="text-cyan-600 dark:text-cyan-400">{athlete?.name || currentRun?.name || 'Active Sprinter'}</span>
                    </div>
                <div className="text-[10px] text-gray-500 dark:text-slate-400 font-mono">
                  Sprint Data: {sprintData.map(s => `${s.distance}m (${s.time}s)`).join(', ')} • R² = {fvp.rSquared}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              {/* Body Mass Input */}
              <div className="flex items-center gap-2">
                <label className="text-[11px] font-mono text-gray-600 dark:text-slate-400">Mass (kg):</label>
                <input
                  type="number"
                  min="40"
                  max="140"
                  value={massKg}
                  onChange={(e) => setMassKg(parseFloat(e.target.value) || 75)}
                  className="w-16 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-mono font-bold text-gray-900 dark:text-white text-center focus:border-cyan-500 dark:focus:border-cyan-400 outline-hidden shadow-xs"
                />
              </div>

              {/* Height Input */}
              <div className="flex items-center gap-2">
                <label className="text-[11px] font-mono text-gray-600 dark:text-slate-400">Height (cm):</label>
                <input
                  type="number"
                  min="130"
                  max="220"
                  value={heightCm}
                  onChange={(e) => setHeightCm(parseFloat(e.target.value) || 180)}
                  className="w-16 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-mono font-bold text-gray-900 dark:text-white text-center focus:border-cyan-500 dark:focus:border-cyan-400 outline-hidden shadow-xs"
                />
              </div>

              {/* Wind Assist Toggle */}
              <div className="flex items-center gap-2">
                <label className="text-[11px] font-mono text-gray-600 dark:text-slate-400 flex items-center gap-1">
                  <Wind size={12} /> Wind (m/s):
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="-4"
                  max="4"
                  value={windAssist}
                  onChange={(e) => setWindAssist(parseFloat(e.target.value) || 0)}
                  className="w-14 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-mono font-bold text-gray-900 dark:text-white text-center focus:border-cyan-500 dark:focus:border-cyan-400 outline-hidden shadow-xs"
                />
              </div>
            </div>
          </div>

          {/* 3. Primary Mechanical Profile Tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* F0 Tile */}
            <div className="bg-gray-50 dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-950 border border-cyan-500/30 rounded-2xl p-3.5 flex flex-col justify-between shadow-xs">
              <div className="flex items-center justify-between text-xs font-mono font-bold text-gray-500 dark:text-slate-400">
                <span>F0 (MAX FORCE)</span>
                <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-bold">v = 0</span>
              </div>
              <div className="my-1.5">
                <div className="text-2xl sm:text-3xl font-black font-mono text-cyan-600 dark:text-cyan-400">
                  {fvp.f0Rel} <span className="text-xs font-bold text-gray-500 dark:text-slate-400">N/kg</span>
                </div>
                <div className="text-[11px] font-mono text-gray-500 dark:text-slate-400">
                  {fvp.f0} N total force
                </div>
              </div>
              <div className="text-[10px] text-gray-500 dark:text-slate-500 leading-tight">
                Initial horizontal drive capacity out of the blocks.
              </div>
            </div>

            {/* V0 Tile */}
            <div className="bg-gray-50 dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-950 border border-emerald-500/30 rounded-2xl p-3.5 flex flex-col justify-between shadow-xs">
              <div className="flex items-center justify-between text-xs font-mono font-bold text-gray-500 dark:text-slate-400">
                <span>V0 (MAX VELOCITY)</span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">F = 0</span>
              </div>
              <div className="my-1.5">
                <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                  {fvp.v0} <span className="text-xs font-bold text-gray-500 dark:text-slate-400">m/s</span>
                </div>
                <div className="text-[11px] font-mono text-gray-500 dark:text-slate-400">
                  {fvp.v0Kmh} km/h top speed
                </div>
              </div>
              <div className="text-[10px] text-gray-500 dark:text-slate-500 leading-tight">
                Theoretical maximal horizontal sprinting velocity.
              </div>
            </div>

            {/* Pmax Tile */}
            <div className="bg-gray-50 dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-950 border border-amber-500/30 rounded-2xl p-3.5 flex flex-col justify-between shadow-xs">
              <div className="flex items-center justify-between text-xs font-mono font-bold text-gray-500 dark:text-slate-400">
                <span>PMAX (PEAK POWER)</span>
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">apex</span>
              </div>
              <div className="my-1.5">
                <div className="text-2xl sm:text-3xl font-black font-mono text-amber-600 dark:text-amber-400">
                  {fvp.pmaxRel} <span className="text-xs font-bold text-gray-500 dark:text-slate-400">W/kg</span>
                </div>
                <div className="text-[11px] font-mono text-gray-500 dark:text-slate-400">
                  {fvp.pmax} W total power
                </div>
              </div>
              <div className="text-[10px] text-gray-500 dark:text-slate-500 leading-tight">
                Peak horizontal power generated during acceleration.
              </div>
            </div>

            {/* Sfv / RF Tile */}
            <div className="bg-gray-50 dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-950 border border-purple-500/30 rounded-2xl p-3.5 flex flex-col justify-between shadow-xs">
              <div className="flex items-center justify-between text-xs font-mono font-bold text-gray-500 dark:text-slate-400">
                <span>RF PEAK / SLOPE</span>
                <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold">technique</span>
              </div>
              <div className="my-1.5">
                <div className="text-2xl sm:text-3xl font-black font-mono text-purple-600 dark:text-purple-400">
                  {fvp.rfPeak}%
                </div>
                <div className="text-[11px] font-mono text-gray-500 dark:text-slate-400">
                  Slope Sfv: {fvp.sfvRel} N·s/kg·m
                </div>
              </div>
              <div className="text-[10px] text-gray-500 dark:text-slate-500 leading-tight">
                Decline rate DRF: {fvp.drf}%/m·s.
              </div>
            </div>
          </div>

          {/* 4. Force-Velocity Imbalance Gauge Bar */}
          <div className="bg-gray-50 dark:bg-slate-950/80 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col gap-3 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-slate-300">
                  Force-Velocity Imbalance (FVimb):
                </span>
                <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border ${fvp.profileBadge}`}>
                  {fvp.profileType} ({fvp.fvImbalance}% of Optimal)
                </span>
              </div>
              <div className="text-[11px] text-gray-500 dark:text-slate-400">
                Ideal Balance = 92% – 108%
              </div>
            </div>

            {/* Visual Gauge Bar */}
            <div className="relative w-full h-4 bg-gray-200 dark:bg-slate-800 rounded-full overflow-hidden">
              {/* Force Deficit Zone (0 to 40%) */}
              <div className="absolute left-0 top-0 bottom-0 w-[42%] bg-gradient-to-r from-rose-500/40 to-amber-500/30 border-r border-gray-300 dark:border-slate-700"></div>
              {/* Balanced Zone (42% to 58%) */}
              <div className="absolute left-[42%] top-0 bottom-0 w-[16%] bg-emerald-500/40 border-r border-gray-300 dark:border-slate-700"></div>
              {/* Velocity Deficit Zone (58% to 100%) */}
              <div className="absolute left-[58%] top-0 bottom-0 w-[42%] bg-gradient-to-r from-sky-500/30 to-indigo-500/40"></div>

              {/* Indicator Arrow Needle */}
              {(() => {
                // Map fvImbalance (e.g. 60% to 140%) to range 0% - 100%
                const pct = Math.max(3, Math.min(97, ((fvp.fvImbalance - 60) / 80) * 100));
                return (
                  <div
                    className="absolute top-0 bottom-0 w-2.5 -translate-x-1/2 bg-white rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)] dark:shadow-[0_0_10px_rgba(255,255,255,0.9)] transition-all duration-300"
                    style={{ left: `${pct}%` }}
                  ></div>
                );
              })()}
            </div>

            <div className="flex justify-between text-[10px] font-mono text-gray-500 dark:text-slate-400 px-1">
              <span>← High Force Deficit</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">Optimal Balance (100%)</span>
              <span>High Velocity Deficit →</span>
            </div>

            <div className="text-xs text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-900/60 p-2.5 rounded-xl border border-gray-200 dark:border-slate-800/80 shadow-xs">
              💡 <strong>Diagnosis:</strong> {fvp.deficitDescription}
            </div>
          </div>

          {/* 5. Interactive Visual Graph: Force-Velocity & Power-Velocity Curves */}
          <div className="bg-gray-50 dark:bg-slate-950/80 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col gap-3 shadow-xs">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-cyan-600 dark:text-cyan-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white">
                  Mechanical Curves (Samozino Model)
                </span>
              </div>

              <div className="flex gap-1.5 text-xs">
                <button
                  onClick={() => setActiveTab('fv_curve')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition ${activeTab === 'fv_curve' ? 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/40' : 'bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-400'}`}
                >
                  F-v Line & P-v Parabola
                </button>
                <button
                  onClick={() => setActiveTab('training')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition ${activeTab === 'training' ? 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/40' : 'bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-400'}`}
                >
                  Coach Prescriptions
                </button>
              </div>
            </div>

            {activeTab === 'fv_curve' ? (
              <div className="relative w-full h-64 sm:h-72 flex flex-col justify-between pt-2">
                {/* SVG Visual Graph */}
                <svg viewBox="0 0 600 240" className="w-full h-full overflow-visible">
                  {/* Grid lines */}
                  <line x1="50" y1="20" x2="50" y2="210" stroke={isDark ? "#334155" : "#cbd5e1"} strokeWidth="1.5" />
                  <line x1="50" y1="210" x2="570" y2="210" stroke={isDark ? "#334155" : "#cbd5e1"} strokeWidth="1.5" />
                  
                  <line x1="50" y1="115" x2="570" y2="115" stroke={isDark ? "#1e293b" : "#e2e8f0"} strokeDasharray="4 4" strokeWidth="1" />
                  <line x1="310" y1="20" x2="310" y2="210" stroke={isDark ? "#1e293b" : "#e2e8f0"} strokeDasharray="4 4" strokeWidth="1" />

                  {/* Axis Labels */}
                  <text x="310" y="235" fill={isDark ? "#94a3b8" : "#64748b"} fontSize="11" fontWeight="bold" textAnchor="middle">Horizontal Velocity (m/s) →</text>
                  <text x="18" y="115" fill="#0891b2" fontSize="11" fontWeight="bold" textAnchor="middle" transform="rotate(-90 18 115)">Force (N/kg)</text>
                  <text x="590" y="115" fill="#d97706" fontSize="11" fontWeight="bold" textAnchor="middle" transform="rotate(90 590 115)">Power (W/kg)</text>

                  {/* 1. Linear Force-Velocity Line (Cyan) */}
                  {/* (50, 30) down to (550, 210) */}
                  <line 
                    x1="50" 
                    y1="30" 
                    x2="550" 
                    y2="210" 
                    stroke="#06b6d4" 
                    strokeWidth="3.5" 
                    strokeLinecap="round" 
                  />
                  {/* F0 Point */}
                  <circle cx="50" cy="30" r="5" fill="#06b6d4" />
                  <text x="60" y="26" fill="#0891b2" fontSize="10" fontWeight="bold">F0: {fvp.f0Rel} N/kg</text>

                  {/* V0 Point */}
                  <circle cx="550" cy="210" r="5" fill="#10b981" />
                  <text x="540" y="200" fill="#059669" fontSize="10" fontWeight="bold" textAnchor="end">V0: {fvp.v0} m/s</text>

                  {/* 2. Parabolic Power-Velocity Curve (Amber) */}
                  <path
                    d={`M 50 210 Q 300 35 550 210`}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="3"
                    strokeDasharray="6 3"
                  />
                  {/* Pmax Apex */}
                  <circle cx="300" cy="35" r="5" fill="#f59e0b" />
                  <text x="300" y="22" fill="#d97706" fontSize="10" fontWeight="bold" textAnchor="middle">
                    Pmax: {fvp.pmaxRel} W/kg (at {(fvp.v0 / 2).toFixed(2)} m/s)
                  </text>
                </svg>

                <div className="flex justify-center gap-6 text-[11px] font-mono mt-1 border-t border-gray-200 dark:border-slate-800/80 pt-2">
                  <span className="flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400">
                    <span className="w-3 h-0.5 bg-cyan-500"></span> Force-Velocity Linear Line (F0 = {fvp.f0Rel} N/kg)
                  </span>
                  <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                    <span className="w-3 h-0.5 border-t border-dashed border-amber-500"></span> Power-Velocity Parabola (Pmax = {fvp.pmaxRel} W/kg)
                  </span>
                </div>
              </div>
            ) : (
              /* Training Prescriptions Tab */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-1">
                {fvp.trainingPrescription.map((item, idx) => (
                  <div key={idx} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-3 flex gap-3 items-start shadow-xs">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5">
                      <Dumbbell size={16} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-gray-900 dark:text-white leading-tight">{item.title}</div>
                      <div className="text-[11px] text-gray-600 dark:text-slate-300 mt-1 leading-relaxed">{item.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>

        {/* 6. Modal Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 flex items-center justify-between">
          <div className="text-[10px] text-gray-500 dark:text-slate-500 font-mono">
            Velocity Lab Sports Science Engine • Morin & Samozino Research Framework
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPDF}
              className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-black font-bold text-xs transition flex items-center gap-1.5 shadow-xs"
            >
              <Download size={14} />
              <span>Download PDF Assessment</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-gray-200 hover:bg-gray-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-800 dark:text-white font-bold text-xs transition"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
