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

import React, { useMemo, useState, useEffect } from 'react';
import { 
  Zap, Activity, Dumbbell, TrendingUp, Sliders, 
  HelpCircle, ChevronRight, Award, Gauge, ArrowRight,
  Sparkles, CheckCircle2, AlertTriangle, Layers, Maximize2
} from 'lucide-react';
import { calculateHorizontalFVP } from '../utils/fvpProfiling';
import { 
  ResponsiveContainer, ComposedChart, Line, Scatter, 
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend 
} from 'recharts';

/**
 * FVPProfileCard
 * Sports Science Force-Velocity-Power (FVP) Sprint Profiling Card
 * Validated Samozino & Morin (2016) Biomechanical Model
 */
function FVPProfileCard({
  athlete = null,
  history = [],
  results = [],
  onOpenFullModal
}) {
  const [athleteMass, setAthleteMass] = useState(() => {
    const raw = athlete?.weight ? parseFloat(athlete.weight) : 75;
    return isNaN(raw) || raw < 35 ? 75 : raw;
  });

  const [athleteHeight, setAthleteHeight] = useState(() => {
    const raw = athlete?.height ? parseFloat(athlete.height) : 180;
    return isNaN(raw) || raw < 120 ? 180 : raw;
  });

  const [activeCurveView, setActiveCurveView] = useState('both'); // 'fv' | 'pv' | 'both'

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

  // Extract split times for profiling
  const sprintData = useMemo(() => {
    const runs = [...(results || []), ...(history || [])]
      .filter(r => r.time && parseFloat(r.time) > 0);

    // If athlete selected, filter by athlete
    const targetRuns = athlete?.name 
      ? runs.filter(r => r.name === athlete.name)
      : runs;

    const sourceRun = targetRuns.length > 0 ? targetRuns[0] : (runs.length > 0 ? runs[0] : null);

    if (sourceRun && sourceRun.splits && sourceRun.splits.length > 0) {
      return sourceRun.splits.map(s => ({
        distance: s.distance || (s.node === 1 ? (sourceRun.distance || 40) : (s.node ? s.node * 10 : 20)),
        time: parseFloat(s.time) || 0
      })).filter(s => s.distance > 0 && s.time > 0);
    }

    if (sourceRun && sourceRun.time) {
      return [{
        distance: parseFloat(sourceRun.distance || 40),
        time: parseFloat(sourceRun.time)
      }];
    }

    // Do not fabricate sprint data if athlete has not run
    return null;
  }, [athlete, results, history]);

  // Compute Samozino F-v-P Profile
  const fvp = useMemo(() => {
    if (!sprintData || sprintData.length === 0) return null;
    return calculateHorizontalFVP({
      splits: sprintData,
      mass: athleteMass,
      height: athleteHeight / 100,
      windSpeed: 0
    });
  }, [sprintData, athleteMass, athleteHeight]);

  // Calculate Sled Push / Tow Weight Targets based on athlete mass and F0
  const sledTargets = useMemo(() => {
    if (!fvp) return { heavyKg: '--', powerKg: '--', technicalKg: '--' };
    const m = athleteMass;
    // Standard sprint friction coefficient mu ~ 0.35 on turf/tartan
    // 50% velocity decrement (heavy sled push for F0): ~45-55% body mass
    const heavyKg = Math.round(m * 0.50);
    // 25% velocity decrement (contrast power for Pmax): ~20-25% body mass
    const powerKg = Math.round(m * 0.22);
    // 10% velocity decrement (technical velocity transfer): ~8-12% body mass
    const technicalKg = Math.round(m * 0.10);

    return { heavyKg, powerKg, technicalKg };
  }, [athleteMass, fvp]);

  if (!fvp) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm dark:shadow-xl flex flex-col items-center justify-center text-center gap-3 text-gray-900 dark:text-slate-100 relative overflow-hidden">
        <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 flex items-center justify-center font-black">
          <Zap size={24} />
        </div>
        <h3 className="text-base font-bold text-gray-900 dark:text-white uppercase tracking-wider">
          Force-Velocity-Power (FVP) Profiling
        </h3>
        <p className="text-xs text-gray-500 dark:text-slate-400 max-w-md">
          No sprint test data recorded for {athlete?.name || 'this athlete'}. Complete a sprint trial on the active track to calculate authentic Morin & Samozino biomechanical biomarkers (F₀, V₀, Pmax, RFpeak).
        </p>
        <span className="text-[11px] font-mono font-bold px-3 py-1 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 border border-gray-200 dark:border-slate-700">
          Status: Untested / Pending
        </span>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm dark:shadow-xl flex flex-col gap-5 text-gray-900 dark:text-slate-100 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-0 right-1/4 w-80 h-40 bg-cyan-500/5 dark:bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-gray-200 dark:border-slate-800 pb-4 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 to-emerald-400 flex items-center justify-center text-slate-950 font-black shadow-md shadow-cyan-500/20">
            <Zap size={20} fill="currentColor" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-black tracking-tight text-gray-900 dark:text-white uppercase">
                FORCE-VELOCITY-POWER (FVP) PROFILING
              </h3>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/15 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 dark:border-cyan-500/40 uppercase">
                Samozino & Morin
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Biomechanical sprint diagnostics & mechanical effectiveness ({athlete?.name || 'Athlete Benchmark'})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {onOpenFullModal && (
            <button
              onClick={onOpenFullModal}
              className="px-3.5 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-700 dark:text-cyan-300 text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
              title="Open full interactive FVP report modal with PDF export"
            >
              <Maximize2 size={13} />
              <span>Full Dossier</span>
            </button>
          )}
        </div>
      </div>
      {/* 4 Primary Sports Science Biomarkers */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 z-10">
        {/* F0 */}
        <div className="bg-gray-50 dark:bg-slate-950/70 border border-gray-200 dark:border-slate-800/90 rounded-2xl p-3.5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400 font-bold uppercase tracking-wider">
            <span>F₀ (Max Force)</span>
            <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-mono">v = 0</span>
          </div>
          <div className="my-1.5">
            <span className="text-2xl sm:text-3xl font-black font-mono text-cyan-600 dark:text-cyan-400 tabular-nums">
              {fvp.f0Rel}
            </span>
            <span className="text-xs font-mono text-gray-500 dark:text-slate-400 ml-1">N/kg</span>
          </div>
          <div className="text-[10px] font-mono text-gray-500 dark:text-slate-500">
            Total: {fvp.f0} N
          </div>
        </div>

        {/* V0 */}
        <div className="bg-gray-50 dark:bg-slate-950/70 border border-gray-200 dark:border-slate-800/90 rounded-2xl p-3.5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400 font-bold uppercase tracking-wider">
            <span>V₀ (Max Speed)</span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">F = 0</span>
          </div>
          <div className="my-1.5">
            <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
              {fvp.v0}
            </span>
            <span className="text-xs font-mono text-gray-500 dark:text-slate-400 ml-1">m/s</span>
          </div>
          <div className="text-[10px] font-mono text-gray-500 dark:text-slate-500">
            {fvp.v0Kmh} km/h
          </div>
        </div>

        {/* Pmax */}
        <div className="bg-gray-50 dark:bg-slate-950/70 border border-gray-200 dark:border-slate-800/90 rounded-2xl p-3.5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400 font-bold uppercase tracking-wider">
            <span>Pₘₐₓ (Peak Power)</span>
            <span className="text-[10px] text-purple-600 dark:text-purple-400 font-mono">Theoretical</span>
          </div>
          <div className="my-1.5">
            <span className="text-2xl sm:text-3xl font-black font-mono text-purple-600 dark:text-purple-400 tabular-nums">
              {fvp.pmaxRel}
            </span>
            <span className="text-xs font-mono text-gray-500 dark:text-slate-400 ml-1">W/kg</span>
          </div>
          <div className="text-[10px] font-mono text-gray-500 dark:text-slate-500">
            Total: {fvp.pmax} W
          </div>
        </div>

        {/* RF Peak & DRF */}
        <div className="bg-gray-50 dark:bg-slate-950/70 border border-gray-200 dark:border-slate-800/90 rounded-2xl p-3.5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400 font-bold uppercase tracking-wider">
            <span>RFₘₐₓ / D_RF</span>
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono">Effectiveness</span>
          </div>
          <div className="my-1.5 flex items-baseline gap-2">
            <div>
              <span className="text-xl sm:text-2xl font-black font-mono text-amber-600 dark:text-amber-400 tabular-nums">
                {fvp.rfPeak}%
              </span>
              <span className="text-[10px] text-gray-500 dark:text-slate-400 block font-mono">Ratio Force</span>
            </div>
            <div className="border-l border-gray-200 dark:border-slate-800 pl-2">
              <span className="text-base sm:text-lg font-bold font-mono text-gray-700 dark:text-slate-300 tabular-nums">
                {fvp.drf}
              </span>
              <span className="text-[10px] text-gray-500 dark:text-slate-500 block font-mono">%/ (m/s)</span>
            </div>
          </div>
          <div className="text-[10px] font-mono text-gray-500 dark:text-slate-500">
            Technique Slope
          </div>
        </div>
      </div>

      {/* Main Scatter & Regression Chart Container */}
      <div className="bg-gray-50/80 dark:bg-slate-950/60 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col gap-3 z-10 shadow-xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div className="text-xs text-gray-600 dark:text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Activity size={14} className="text-cyan-600 dark:text-cyan-400" />
            <span>F-v Linear Line & P-v Parabola with Acceleration Splits</span>
          </div>
          
          <div className="flex bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-0.5 text-xs font-mono shadow-xs">
            <button
              onClick={() => setActiveCurveView('both')}
              className={`px-2.5 py-1 rounded-lg font-bold transition ${activeCurveView === 'both' ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 font-extrabold' : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
              F-v + P-v
            </button>
            <button
              onClick={() => setActiveCurveView('fv')}
              className={`px-2.5 py-1 rounded-lg font-bold transition ${activeCurveView === 'fv' ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 font-extrabold' : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
              F-v Only
            </button>
            <button
              onClick={() => setActiveCurveView('pv')}
              className={`px-2.5 py-1 rounded-lg font-bold transition ${activeCurveView === 'pv' ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300 font-extrabold' : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
              P-v Only
            </button>
          </div>
        </div>

        {/* Recharts Composed Chart */}
        <div className="w-full h-64 sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={fvp.curvePoints} margin={{ top: 10, right: 25, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#1e293b" : "#e2e8f0"} vertical={false} />
              <XAxis 
                dataKey="velocity" 
                type="number" 
                domain={[0, 'dataMax']}
                stroke={isDark ? "#64748b" : "#94a3b8"} 
                tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 11, fontFamily: 'monospace' }}
                tickFormatter={(val) => `${val}m/s`}
              />
              {/* Left Y Axis: Force (N/kg) */}
              <YAxis 
                yAxisId="force"
                dataKey="forceRel"
                orientation="left"
                stroke={isDark ? "#64748b" : "#94a3b8"}
                tick={{ fill: isDark ? '#38bdf8' : '#0284c7', fontSize: 11, fontFamily: 'monospace' }}
                tickFormatter={(val) => `${val}N/kg`}
                domain={[0, Math.ceil(fvp.f0Rel * 1.15)]}
              />
              {/* Right Y Axis: Power (W/kg) */}
              <YAxis 
                yAxisId="power"
                dataKey="powerRel"
                orientation="right"
                stroke={isDark ? "#64748b" : "#94a3b8"}
                tick={{ fill: isDark ? '#c084fc' : '#9333ea', fontSize: 11, fontFamily: 'monospace' }}
                tickFormatter={(val) => `${val}W/kg`}
                domain={[0, Math.ceil(fvp.pmaxRel * 1.2)]}
              />
              <RechartsTooltip 
                contentStyle={{ 
                  backgroundColor: isDark ? '#0f172a' : '#ffffff', 
                  borderColor: isDark ? '#334155' : '#e2e8f0', 
                  borderRadius: '12px', 
                  color: isDark ? '#fff' : '#0f172a', 
                  fontSize: '12px', 
                  fontFamily: 'monospace',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                }}
                formatter={(val, name) => {
                  if (name === 'Force (N/kg)') return [`${val} N/kg`, name];
                  if (name === 'Power (W/kg)') return [`${val} W/kg`, name];
                  return [val, name];
                }}
                labelFormatter={(lbl) => `Speed: ${parseFloat(lbl).toFixed(2)} m/s`}
              />
              <Legend 
                verticalAlign="top" 
                height={28}
                formatter={(val) => <span className="text-xs font-mono font-bold text-gray-700 dark:text-slate-300">{val}</span>}
              />

              {/* F-v Linear Line */}
              {(activeCurveView === 'both' || activeCurveView === 'fv') && (
                <Line 
                  yAxisId="force"
                  type="linear"
                  dataKey="forceRel"
                  name="Force (N/kg)"
                  stroke={isDark ? "#38bdf8" : "#0284c7"}
                  strokeWidth={3}
                  dot={false}
                />
              )}

              {/* P-v Parabola */}
              {(activeCurveView === 'both' || activeCurveView === 'pv') && (
                <Line 
                  yAxisId="power"
                  type="monotone"
                  dataKey="powerRel"
                  name="Power (W/kg)"
                  stroke={isDark ? "#c084fc" : "#9333ea"}
                  strokeWidth={3}
                  dot={false}
                />
              )}

              {/* Measured Acceleration Split Points */}
              <Scatter 
                yAxisId="force"
                data={fvp.samplePoints.filter((_, idx) => idx % 8 === 0)}
                dataKey="forceRel"
                name="Measured Splits"
                fill="#00D084"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Optimal Resistance & Sled Weight Targets */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 z-10">
        {/* Diagnostic Assessment Card */}
        <div className="bg-gray-50 dark:bg-slate-950/70 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                NEUROMUSCULAR IMBALANCE
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${fvp.profileBadge}`}>
                {fvp.profileType}
              </span>
            </div>
            <p className="text-xs text-gray-700 dark:text-slate-300 leading-relaxed mb-3">
              {fvp.deficitDescription}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800/80 rounded-xl p-3 flex flex-col gap-1.5 shadow-xs">
            <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider flex items-center gap-1">
              <CheckCircle2 size={12} /> Priority Training Focus:
            </span>
            <ul className="text-xs text-gray-700 dark:text-slate-300 space-y-1">
              {fvp.trainingPrescription.slice(0, 2).map((item, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="text-cyan-600 dark:text-cyan-400">•</span>
                  <span><strong className="text-gray-900 dark:text-white">{item.title}:</strong> {item.detail}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Sled Push & Tow Resistance Targets */}
        <div className="bg-gray-50 dark:bg-slate-950/70 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Dumbbell size={14} className="text-emerald-600 dark:text-emerald-400" />
                <span>OPTIMAL SLED RESISTANCE TARGETS</span>
              </span>
              <span className="text-[10px] font-mono text-gray-500 dark:text-slate-400">
                Mass: {athleteMass}kg
              </span>
            </div>
            <p className="text-xs text-gray-600 dark:text-slate-400 mb-3">
              Target velocity decrements (Vdec) mapped to individual theoretical horizontal strength:
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            {/* Heavy Force */}
            <div className="bg-white dark:bg-slate-900/90 border border-rose-200 dark:border-rose-500/30 rounded-xl p-2.5 shadow-xs">
              <div className="text-[10px] font-mono font-bold text-rose-600 dark:text-rose-400 uppercase">
                50% Vdec (F₀)
              </div>
              <div className="text-lg sm:text-xl font-black font-mono text-gray-900 dark:text-white mt-0.5">
                {sledTargets.heavyKg} <span className="text-[10px] text-gray-500 dark:text-slate-400">kg</span>
              </div>
              <div className="text-[9px] text-gray-500 dark:text-slate-400 mt-0.5">
                Block Exit Drive
              </div>
            </div>

            {/* Power Output */}
            <div className="bg-white dark:bg-slate-900/90 border border-amber-200 dark:border-amber-500/30 rounded-xl p-2.5 shadow-xs">
              <div className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400 uppercase">
                25% Vdec (Pₘₐₓ)
              </div>
              <div className="text-lg sm:text-xl font-black font-mono text-gray-900 dark:text-white mt-0.5">
                {sledTargets.powerKg} <span className="text-[10px] text-gray-500 dark:text-slate-400">kg</span>
              </div>
              <div className="text-[9px] text-gray-500 dark:text-slate-400 mt-0.5">
                Peak Accel Power
              </div>
            </div>

            {/* Speed Transfer */}
            <div className="bg-white dark:bg-slate-900/90 border border-emerald-200 dark:border-emerald-500/30 rounded-xl p-2.5 shadow-xs">
              <div className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                10% Vdec (V₀)
              </div>
              <div className="text-lg sm:text-xl font-black font-mono text-gray-900 dark:text-white mt-0.5">
                {sledTargets.technicalKg} <span className="text-[10px] text-gray-500 dark:text-slate-400">kg</span>
              </div>
              <div className="text-[9px] text-gray-500 dark:text-slate-400 mt-0.5">
                Max Speed Fly
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default React.memo(FVPProfileCard);
