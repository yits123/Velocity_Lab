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

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Users, Zap, Play, Pause, RotateCcw, Trophy, TrendingUp, Gauge, 
  Flag, ShieldCheck, Download, ArrowRight, Clock, Award, Sliders, ChevronDown
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { savePdfFile } from '../utils/pdfDownloader';
import { addVelocityLabLogoToPdf } from '../utils/logoPdfHelper';
import VelocityLabLogo from './VelocityLabLogo';
import SprintSplitDeltaChart from './SprintSplitDeltaChart';

const getThemeAccent = () => {
  if (typeof window !== 'undefined') {
    const color = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim();
    const rgb = getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').trim();
    if (color && rgb) return { color, rgb };
    if (color) return { color, rgb: '0, 208, 132' };
  }
  return { color: '#00D084', rgb: '0, 208, 132' };
};

const SPLIT_DIST_MAP = {
  1: 40,
  2: 10,
  3: 20,
  4: 30,
  101: 10,
  102: 20,
  103: 30,
  104: 40,
  201: 10,
  202: 20,
  301: 10,
  302: 30
};

export default function HeadToHeadMatchup({
  history = [],
  roster = [],
  results = [],
  initialAthleteA = null,
  initialAthleteB = null,
  onOpenProfile
}) {
  const themeAccent = getThemeAccent();

  // Distinct athletes list from history and roster
  const athleteNames = useMemo(() => {
    const set = new Set();
    roster.forEach(a => { if (a && a.name) set.add(a.name); });
    history.forEach(h => { if (h && h.name) set.add(h.name); });
    results.forEach(r => { if (r && r.name) set.add(r.name); });
    return Array.from(set).sort();
  }, [roster, history, results]);

  const [athleteAName, setAthleteAName] = useState(() => {
    if (initialAthleteA) return initialAthleteA;
    if (athleteNames.length > 0) return athleteNames[0];
    return 'Athlete A';
  });

  const [athleteBName, setAthleteBName] = useState(() => {
    if (initialAthleteB) return initialAthleteB;
    if (athleteNames.length > 1) return athleteNames[1];
    if (athleteNames.length > 0) return athleteNames[0];
    return 'Athlete B';
  });

  // Selected run modes: 'best' or run ID / index
  const [runSelectionA, setRunSelectionA] = useState('best');
  const [runSelectionB, setRunSelectionB] = useState('best');

  // Filter runs for each athlete
  const runsA = useMemo(() => {
    return history.filter(h => h.name === athleteAName && !isNaN(parseFloat(h.time)));
  }, [history, athleteAName]);

  const runsB = useMemo(() => {
    return history.filter(h => h.name === athleteBName && !isNaN(parseFloat(h.time)));
  }, [history, athleteBName]);

  // Resolve active run object for A
  const activeRunA = useMemo(() => {
    if (runsA.length === 0) return null;
    if (runSelectionA === 'best') {
      return [...runsA].sort((a, b) => parseFloat(a.time) - parseFloat(b.time))[0];
    }
    return runsA.find(r => (r.firebaseId || r.id) === runSelectionA) || runsA[0];
  }, [runsA, runSelectionA]);

  // Resolve active run object for B
  const activeRunB = useMemo(() => {
    if (runsB.length === 0) return null;
    if (runSelectionB === 'best') {
      // If same athlete selected for both, default B to second best if available
      if (athleteAName === athleteBName && runsB.length > 1 && runSelectionA === 'best') {
        const sorted = [...runsB].sort((a, b) => parseFloat(a.time) - parseFloat(b.time));
        return sorted[1];
      }
      return [...runsB].sort((a, b) => parseFloat(a.time) - parseFloat(b.time))[0];
    }
    return runsB.find(r => (r.firebaseId || r.id) === runSelectionB) || runsB[0];
  }, [runsB, runSelectionB, athleteAName, athleteBName, runSelectionA]);

  // Athlete details from roster
  const profileA = useMemo(() => roster.find(r => r.name === athleteAName) || {}, [roster, athleteAName]);
  const profileB = useMemo(() => roster.find(r => r.name === athleteBName) || {}, [roster, athleteBName]);

  // Track Distance (default 40m)
  const trackDist = useMemo(() => {
    const da = parseFloat(activeRunA?.distance) || 40;
    const db = parseFloat(activeRunB?.distance) || 40;
    return Math.max(da, db);
  }, [activeRunA, activeRunB]);

  // Metrics Extraction
  const timeA = parseFloat(activeRunA?.time) || 0;
  const timeB = parseFloat(activeRunB?.time) || 0;
  const diffTime = (timeB - timeA); // positive => A is faster by diffTime
  const aWins = timeA > 0 && (timeB === 0 || timeA <= timeB);

  const velA = activeRunA?.velocity 
    ? parseFloat(activeRunA.velocity) 
    : (timeA > 0 ? (trackDist / timeA) : 0);
  const velB = activeRunB?.velocity 
    ? parseFloat(activeRunB.velocity) 
    : (timeB > 0 ? (trackDist / timeB) : 0);

  const rtA = activeRunA?.reactionTime ? (parseFloat(activeRunA.reactionTime) > 20 ? parseFloat(activeRunA.reactionTime) / 1000 : parseFloat(activeRunA.reactionTime)) : 0;
  const rtB = activeRunB?.reactionTime ? (parseFloat(activeRunB.reactionTime) > 20 ? parseFloat(activeRunB.reactionTime) / 1000 : parseFloat(activeRunB.reactionTime)) : 0;

  const weightA = parseFloat(profileA.weight || activeRunA?.weight) || 0;
  const weightB = parseFloat(profileB.weight || activeRunB?.weight) || 0;

  const momA = weightA > 0 && velA > 0 ? (weightA * velA).toFixed(1) : '--';
  const momB = weightB > 0 && velB > 0 ? (weightB * velB).toFixed(1) : '--';

  const keA = weightA > 0 && velA > 0 ? (0.5 * weightA * velA * velA).toFixed(0) : '--';
  const keB = weightB > 0 && velB > 0 ? (0.5 * weightB * velB * velB).toFixed(0) : '--';

  // Compute normalized splits table across standard checkpoints
  const segments = useMemo(() => {
    const validCheckpoints = [10, 20, 30].filter(cp => cp < trackDist - 1.5);
    const uniqueCp = Array.from(new Set([...validCheckpoints, Math.round(trackDist * 10) / 10])).sort((a,b) => a-b);

    const getSplitAtDist = (run, dist) => {
      if (!run) return null;
      if (Math.abs(dist - trackDist) < 0.2) return parseFloat(run.time);
      if (run.splits && Array.isArray(run.splits)) {
        const found = run.splits.find(s => {
          const d = SPLIT_DIST_MAP[s.node] || parseInt(s.node) * 10;
          return d === dist;
        });
        if (found && !isNaN(parseFloat(found.time))) return parseFloat(found.time);
      }
      return null;
    };

    let prevA = 0;
    let prevB = 0;
    let prevD = 0;

    return uniqueCp.map((cp) => {
      const cumA = getSplitAtDist(activeRunA, cp);
      const cumB = getSplitAtDist(activeRunB, cp);
      
      const intervalDist = cp - prevD;
      const intA = (cumA !== null && prevA !== null) ? (cumA - prevA) : null;
      const intB = (cumB !== null && prevB !== null) ? (cumB - prevB) : null;

      const segVelA = (intA && intA > 0) ? (intervalDist / intA) : 0;
      const segVelB = (intB && intB > 0) ? (intervalDist / intB) : 0;

      const cumDiff = (cumA !== null && cumB !== null) ? (cumB - cumA) : null;
      const intDiff = (intA !== null && intB !== null) ? (intB - intA) : null;

      const item = {
        distance: cp,
        phase: cp === 10 ? '0-10m Drive Phase' : cp === 20 ? '10-20m Transition' : cp === 30 ? '20-30m Max Velocity' : `${prevD}-${cp}m Interval`,
        cumA,
        cumB,
        cumDiff,
        intA,
        intB,
        intDiff,
        segVelA,
        segVelB,
        fasterRunner: (cumDiff !== null && Math.abs(cumDiff) > 0.005) ? (cumDiff > 0 ? athleteAName : athleteBName) : 'Tied'
      };

      prevA = cumA;
      prevB = cumB;
      prevD = cp;

      return item;
    });
  }, [activeRunA, activeRunB, trackDist, athleteAName, athleteBName]);

  // Simulation State for Canvas Virtual Race
  const [simPlaying, setSimPlaying] = useState(false);
  const [simProgress, setSimProgress] = useState(0); // 0 to 1
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0); // 1.0 or 0.5 (slow-mo)
  const animFrameRef = useRef(null);
  const simStartTimestampRef = useRef(null);

  const maxTotalTime = Math.max(timeA, timeB) || 5.0;

  // Animation Loop
  useEffect(() => {
    if (!simPlaying) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const step = (timestamp) => {
      if (!simStartTimestampRef.current) simStartTimestampRef.current = timestamp;
      const elapsedRealSec = (timestamp - simStartTimestampRef.current) / 1000;
      const simElapsed = elapsedRealSec * playbackSpeed;
      const progress = Math.min(1.0, simElapsed / (maxTotalTime + 0.5)); // +0.5s linger at finish
      
      setSimProgress(progress);

      if (progress < 1.0) {
        animFrameRef.current = requestAnimationFrame(step);
      } else {
        setSimPlaying(false);
      }
    };

    animFrameRef.current = requestAnimationFrame(step);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [simPlaying, playbackSpeed, maxTotalTime]);

  const handleToggleSim = () => {
    if (simPlaying) {
      setSimPlaying(false);
    } else {
      if (simProgress >= 1.0) {
        setSimProgress(0);
      }
      simStartTimestampRef.current = null;
      setSimPlaying(true);
    }
  };

  const handleResetSim = () => {
    setSimPlaying(false);
    setSimProgress(0);
    simStartTimestampRef.current = null;
  };

  // Compute position of runner (0% to 100% of track) at current sim time
  const currentSimTime = simProgress * (maxTotalTime + 0.5);

  const getRunnerTrackPct = (runTime) => {
    if (!runTime || runTime <= 0) return 0;
    if (currentSimTime <= 0) return 0;
    if (currentSimTime >= runTime) return 100;
    // Normalized quadratic launch progression
    const t = currentSimTime / runTime;
    return Math.min(100, Math.pow(t, 1.25) * 100);
  };

  const trackPctA = getRunnerTrackPct(timeA);
  const trackPctB = getRunnerTrackPct(timeB);

  // Export Matchup Dossier to PDF
  const exportMatchupPdf = () => {
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      // Dark Cover Header
      doc.setFillColor(18, 19, 22);
      doc.rect(0, 0, 210, 42, 'F');

      // Official Velocity Lab Brand Header Logo
      addVelocityLabLogoToPdf(doc, { x: 152, y: 12, width: 44, isDark: true });

      doc.setTextColor(0, 208, 132);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text("SPORTS SCIENCE INTELLIGENCE", 14, 15);

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.text("HEAD-TO-HEAD MATCHUP & DELTA DOSSIER", 14, 24);

      doc.setTextColor(150, 155, 165);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Official Dual Assessment • ${trackDist}m Straight • Generated ${new Date().toLocaleDateString()}`, 14, 32);

      // Matchup Summary Banner
      let yPos = 50;
      doc.setFillColor(245, 247, 250);
      doc.roundedRect(14, yPos, 182, 32, 3, 3, 'F');
      doc.setDrawColor(220, 225, 235);
      doc.roundedRect(14, yPos, 182, 32, 3, 3, 'S');

      // Athlete A column
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(athleteAName, 20, yPos + 10);
      doc.setFontSize(16);
      doc.setTextColor(0, 160, 100);
      doc.text(`${timeA > 0 ? timeA.toFixed(2) : '--'}s`, 20, yPos + 22);

      // VS in middle
      doc.setFontSize(14);
      doc.setTextColor(120, 130, 145);
      doc.setFont('helvetica', 'bold');
      doc.text("VS", 100, yPos + 16, { align: 'center' });

      // Athlete B column
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(athleteBName, 186, yPos + 10, { align: 'right' });
      doc.setFontSize(16);
      doc.setTextColor(59, 130, 246);
      doc.text(`${timeB > 0 ? timeB.toFixed(2) : '--'}s`, 186, yPos + 22, { align: 'right' });

      yPos += 42;

      // Table of Overview Metrics
      autoTable(doc, {
        startY: yPos,
        head: [['Metric', athleteAName, athleteBName, 'Delta / Advantage']],
        body: [
          ['Official Event Time', timeA > 0 ? `${timeA.toFixed(2)}s` : '--', timeB > 0 ? `${timeB.toFixed(2)}s` : '--', timeA > 0 && timeB > 0 ? (diffTime !== 0 ? `${Math.abs(diffTime).toFixed(2)}s (${diffTime > 0 ? athleteAName : athleteBName} leads)` : 'Tied') : '--'],
          ['Average Velocity', velA > 0 ? `${velA.toFixed(2)} m/s` : '--', velB > 0 ? `${velB.toFixed(2)} m/s` : '--', velA > 0 && velB > 0 ? `${Math.abs(velA - velB).toFixed(2)} m/s` : '--'],
          ['Reaction Time', `${rtA > 0 ? rtA.toFixed(3) + 's' : '--'}`, `${rtB > 0 ? rtB.toFixed(3) + 's' : '--'}`, rtA > 0 && rtB > 0 ? `${Math.abs(rtA - rtB).toFixed(3)}s` : '--'],
          ['Body Weight', weightA > 0 ? `${weightA} kg` : '--', weightB > 0 ? `${weightB} kg` : '--', weightA > 0 && weightB > 0 ? `${Math.abs(weightA - weightB).toFixed(1)} kg` : '--'],
          ['Peak Momentum', momA !== '--' ? `${momA} kg·m/s` : '--', momB !== '--' ? `${momB} kg·m/s` : '--', momA !== '--' && momB !== '--' ? `${Math.abs(parseFloat(momA) - parseFloat(momB)).toFixed(0)} kg·m/s` : '--'],
          ['Kinetic Energy', keA !== '--' ? `${keA} J` : '--', keB !== '--' ? `${keB} J` : '--', keA !== '--' && keB !== '--' ? `${Math.abs(parseFloat(keA) - parseFloat(keB)).toFixed(0)} J` : '--'],
        ],
        theme: 'striped',
        headStyles: { fillColor: [18, 19, 22], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 3.5 }
      });

      yPos = doc.lastAutoTable.finalY + 12;

      // Split Interval Matrix
      doc.setFontSize(12);
      doc.setTextColor(18, 19, 22);
      doc.setFont('helvetica', 'bold');
      doc.text("Split-by-Split Segment Matrix", 14, yPos);

      const segmentRows = segments.map(s => [
        `${s.distance}m (${s.phase})`,
        s.cumA !== null ? `${s.cumA.toFixed(2)}s` : '--',
        s.cumB !== null ? `${s.cumB.toFixed(2)}s` : '--',
        s.cumDiff !== null ? `${Math.abs(s.cumDiff).toFixed(2)}s (${s.cumDiff > 0 ? athleteAName : athleteBName})` : '--',
        s.intA !== null ? `${s.intA.toFixed(2)}s (${s.segVelA.toFixed(1)} m/s)` : '--',
        s.intB !== null ? `${s.intB.toFixed(2)}s (${s.segVelB.toFixed(1)} m/s)` : '--'
      ]);

      autoTable(doc, {
        startY: yPos + 4,
        head: [['Checkpoint / Phase', `${athleteAName} (Cum.)`, `${athleteBName} (Cum.)`, 'Lead Delta', `${athleteAName} (Split)`, `${athleteBName} (Split)`]],
        body: segmentRows,
        theme: 'grid',
        headStyles: { fillColor: [0, 208, 132], textColor: [0, 0, 0], fontStyle: 'bold' },
        styles: { fontSize: 8.5, cellPadding: 3 }
      });

      // Verification Footer
      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Page ${i} of ${totalPages}`, 105, 290, { align: 'center' });
        doc.text("Velocity Lab Precision Timing System • Verified Matchup Dossier", 195, 290, { align: 'right' });
      }

      savePdfFile(doc, `VelocityLab_Matchup_${athleteAName.replace(/\s+/g, '_')}_vs_${athleteBName.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error("Matchup PDF Export error:", err);
      alert("Failed to export matchup PDF: " + err.message);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Top Selector Bar: Matchup Header & Dropdowns */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl p-5 md:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-5 border-b border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <VelocityLabLogo variant="compact" className="h-8 w-auto hidden sm:block" />
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-emerald-500 flex items-center gap-2 mb-1">
                <Users size={15} />
                <span>HEAD-TO-HEAD MATCHUP & DELTA ANALYZER</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
                <span>Dual-Athlete Split Gap & Ghost Race</span>
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                  {trackDist}m
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <button
              onClick={exportMatchupPdf}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-2xl font-bold text-xs uppercase tracking-wider transition shadow-sm"
              title="Download Side-by-Side Matchup Dossier PDF"
            >
              <Download size={14} />
              <span>Export Dossier PDF</span>
            </button>
          </div>
        </div>

        {/* Dual Athlete Selectors Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Athlete A Selection Box */}
          <div className="bg-emerald-500/[0.04] dark:bg-slate-900/90 p-4 md:p-5 rounded-2xl border border-emerald-500/30 relative overflow-hidden transition-colors shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">LANE 1 (ATHLETE A)</span>
              </div>
              {onOpenProfile && (
                <button 
                  onClick={() => onOpenProfile(athleteAName)}
                  className="text-[11px] font-bold text-gray-500 hover:text-emerald-500 dark:hover:text-emerald-400 transition"
                >
                  View Profile &rarr;
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase text-gray-500 dark:text-gray-400 block mb-1">Athlete</label>
                <select
                  value={athleteAName}
                  onChange={(e) => setAthleteAName(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus:border-emerald-500 shadow-xs"
                >
                  {athleteNames.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-gray-500 dark:text-gray-400 block mb-1">Run Baseline</label>
                <select
                  value={runSelectionA}
                  onChange={(e) => setRunSelectionA(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus:border-emerald-500 shadow-xs"
                >
                  <option value="best">Personal Best Run</option>
                  {runsA.map((r, idx) => (
                    <option key={r.firebaseId || r.id || idx} value={r.firebaseId || r.id}>
                      {r.time}s ({r.serverTime?.seconds ? new Date(r.serverTime.seconds * 1000).toLocaleDateString() : `#${idx+1}`})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick Stats Pill A */}
            <div className="mt-4 pt-3 border-t border-gray-200/60 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="font-bold text-gray-500 dark:text-gray-400">Official Time:</span>
              <span className="font-mono font-black text-xl text-emerald-600 dark:text-emerald-400">{timeA > 0 ? `${timeA.toFixed(2)}s` : '--'}</span>
            </div>
          </div>

          {/* Athlete B Selection Box */}
          <div className="bg-sky-500/[0.04] dark:bg-slate-900/90 p-4 md:p-5 rounded-2xl border border-sky-500/30 relative overflow-hidden transition-colors shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-sky-500"></span>
                <span className="text-xs font-bold uppercase tracking-wider text-sky-500 dark:text-sky-400">LANE 2 (ATHLETE B)</span>
              </div>
              {onOpenProfile && (
                <button 
                  onClick={() => onOpenProfile(athleteBName)}
                  className="text-[11px] font-bold text-gray-500 hover:text-sky-500 dark:hover:text-sky-400 transition"
                >
                  View Profile &rarr;
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase text-gray-500 dark:text-gray-400 block mb-1">Athlete</label>
                <select
                  value={athleteBName}
                  onChange={(e) => setAthleteBName(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus:border-sky-500 shadow-xs"
                >
                  {athleteNames.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-gray-500 dark:text-gray-400 block mb-1">Run Baseline</label>
                <select
                  value={runSelectionB}
                  onChange={(e) => setRunSelectionB(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus:border-sky-500 shadow-xs"
                >
                  <option value="best">Personal Best Run</option>
                  {runsB.map((r, idx) => (
                    <option key={r.firebaseId || r.id || idx} value={r.firebaseId || r.id}>
                      {r.time}s ({r.serverTime?.seconds ? new Date(r.serverTime.seconds * 1000).toLocaleDateString() : `#${idx+1}`})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick Stats Pill B */}
            <div className="mt-4 pt-3 border-t border-gray-200/60 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="font-bold text-gray-500 dark:text-gray-400">Official Time:</span>
              <span className="font-mono font-black text-xl text-sky-500 dark:text-sky-400">{timeB > 0 ? `${timeB.toFixed(2)}s` : '--'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Delta Verdict Banner */}
      {timeA > 0 && timeB > 0 && (
        <div className="bg-gradient-to-r from-emerald-50 via-white to-sky-50 dark:from-emerald-950/40 dark:via-slate-900 dark:to-sky-950/40 border border-emerald-200/60 dark:border-slate-800 rounded-3xl p-5 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm dark:shadow-xl">
          <div className="flex items-center gap-4 text-center md:text-left">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-500 dark:text-amber-400 shrink-0">
              <Trophy size={28} />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">Matchup Verdict</div>
              <div className="text-xl md:text-2xl font-black text-gray-900 dark:text-white mt-0.5">
                {timeA === 0 || timeB === 0 ? (
                  <span className="text-gray-400 text-lg">Timed Runs Required for Both Athletes</span>
                ) : diffTime === 0 ? (
                  <span>Dead Heat! Exact Tie at {timeA.toFixed(2)}s</span>
                ) : (
                  <span>
                    {aWins ? athleteAName : athleteBName} leads by{' '}
                    <span className="text-emerald-500 dark:text-emerald-400 font-mono">+{Math.abs(diffTime).toFixed(2)}s</span>
                  </span>
                )}
              </div>
              {timeA > 0 && timeB > 0 && diffTime !== 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Advantage: {((Math.abs(diffTime) / Math.max(timeA, timeB)) * 100).toFixed(1)}% faster turnover • Distance separation at tape: ~{((Math.abs(diffTime) * Math.max(velA, velB))).toFixed(2)}m
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-6 font-mono text-center">
            <div className="bg-white/80 dark:bg-black/40 px-4 py-2.5 rounded-2xl border border-gray-200 dark:border-white/5 shadow-xs">
              <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-bold">{athleteAName}</div>
              <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">{timeA > 0 ? `${timeA.toFixed(2)}s` : '--'}</div>
            </div>
            <div className="text-gray-500 font-bold">&Delta; {timeA > 0 && timeB > 0 ? `${Math.abs(diffTime).toFixed(2)}s` : '--'}</div>
            <div className="bg-white/80 dark:bg-black/40 px-4 py-2.5 rounded-2xl border border-gray-200 dark:border-white/5 shadow-xs">
              <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-bold">{athleteBName}</div>
              <div className="text-lg font-black text-sky-600 dark:text-sky-400">{timeB > 0 ? `${timeB.toFixed(2)}s` : '--'}</div>
            </div>
          </div>
        </div>
      )}

      {/* 2D Virtual Ghost Race Canvas Simulation */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl p-5 md:p-6 flex flex-col gap-5 shadow-sm dark:shadow-2xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 z-10">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-500 flex items-center gap-2">
              <Zap size={14} />
              <span>VIRTUAL GHOST TRACK REPLAY</span>
            </div>
            <h3 className="text-lg font-black text-gray-900 dark:text-white">Head-to-Head Visual Replay</h3>
          </div>

          {/* Playback Controls */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={() => setPlaybackSpeed(prev => prev === 1.0 ? 0.5 : 1.0)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition border ${
                playbackSpeed === 0.5 
                  ? 'bg-amber-500/20 text-amber-500 dark:text-amber-400 border-amber-500/40' 
                  : 'bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-slate-700'
              }`}
              title="Toggle 0.5x Slow Motion"
            >
              {playbackSpeed === 0.5 ? '0.5x SLOW-MO' : '1.0x NORMAL'}
            </button>

            <button
              onClick={handleResetSim}
              className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 transition border border-gray-200 dark:border-transparent"
              title="Reset Virtual Race"
            >
              <RotateCcw size={16} />
            </button>

            <button
              onClick={handleToggleSim}
              disabled={timeA === 0 || timeB === 0}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition shadow-lg ${
                timeA === 0 || timeB === 0
                  ? 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-gray-600 cursor-not-allowed shadow-none border border-gray-200 dark:border-slate-700'
                  : simPlaying
                    ? 'bg-amber-500 text-black shadow-amber-500/20'
                    : 'bg-emerald-500 text-black shadow-emerald-500/20'
              }`}
            >
              {simPlaying ? <Pause size={15} /> : <Play size={15} />}
              <span>{simPlaying ? 'Pause' : simProgress >= 1.0 ? 'Replay Race' : 'Play Matchup Replay'}</span>
            </button>
          </div>
        </div>

        {/* The Virtual Track Bed */}
        <div className="relative bg-slate-950 dark:bg-[#0c0d10] border border-gray-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 overflow-hidden">
          {/* Track Texture Grid & Lines */}
          <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#00D084_1px,transparent_1px)] [background-size:16px_16px]"></div>

          {timeA === 0 || timeB === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-slate-800/80 text-gray-400 flex items-center justify-center mb-3 border border-slate-700/50">
                <Zap size={22} className="opacity-50" />
              </div>
              <div className="text-sm font-bold text-gray-300">Timed Sprint Runs Required</div>
              <p className="text-xs text-gray-500 max-w-sm mt-1">
                {timeA === 0 && timeB === 0
                  ? 'No sprint run times recorded for either athlete. Complete timed runs on the track to view the head-to-head ghost track visual replay.'
                  : timeA === 0
                    ? `No sprint run recorded for ${athleteAName}. Complete a timed run to compare head-to-head.`
                    : `No sprint run recorded for ${athleteBName}. Complete a timed run to compare head-to-head.`}
              </p>
            </div>
          ) : (
            <>
              {/* Distance Markers at Top */}
              <div className="relative flex justify-between text-[11px] font-mono text-gray-500 font-bold mb-4 px-2">
                <span>0m (Start)</span>
                <span>10m</span>
                <span>20m</span>
                <span>30m</span>
                <span>{trackDist}m (Finish)</span>
              </div>

              {/* Split Gate Vertical Lines */}
              <div className="absolute inset-x-4 sm:inset-x-6 top-10 bottom-6 flex justify-between pointer-events-none">
                {[0, 10, 20, 30, trackDist].map((dist) => (
                  <div key={dist} className="relative flex flex-col items-center">
                    <div className={`w-0.5 h-full ${dist === trackDist ? 'bg-red-500/50' : 'bg-slate-700/50'} border-r border-dashed border-slate-600`}></div>
                  </div>
                ))}
              </div>

              {/* Track Lanes */}
              <div className="flex flex-col gap-4 relative z-10 py-2">
                {/* Lane 1: Athlete A */}
                <div className="bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-3 relative flex items-center">
                  <div className="w-24 sm:w-32 shrink-0">
                    <div className="text-[10px] text-emerald-400 font-mono font-bold uppercase">Lane 1</div>
                    <div className="text-xs sm:text-sm font-extrabold text-white truncate">{athleteAName}</div>
                    <div className="text-[10px] text-gray-400 font-mono">{timeA > 0 ? `${timeA.toFixed(2)}s` : '--'}</div>
                  </div>

                  {/* Progress Runner Track Bar */}
                  <div className="flex-1 relative h-10 flex items-center ml-2">
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-75"
                        style={{ width: `${trackPctA}%` }}
                      ></div>
                    </div>

                    {/* Runner Icon Avatar */}
                    <div 
                      className="absolute -top-1 -translate-x-1/2 flex flex-col items-center pointer-events-none transition-all duration-75"
                      style={{ left: `${trackPctA}%` }}
                    >
                      <div className="w-8 h-8 rounded-full bg-emerald-500 text-black flex items-center justify-center font-bold text-xs shadow-[0_0_15px_rgba(16,185,129,0.7)] border-2 border-white">
                        A
                      </div>
                      <span className="text-[9px] font-mono font-bold text-emerald-400 mt-0.5 bg-black/60 px-1 rounded">
                        {((trackPctA / 100) * trackDist).toFixed(1)}m
                      </span>
                    </div>
                  </div>
                </div>

                {/* Lane 2: Athlete B */}
                <div className="bg-slate-900/90 border border-sky-500/30 rounded-2xl p-3 relative flex items-center">
                  <div className="w-24 sm:w-32 shrink-0">
                    <div className="text-[10px] text-sky-400 font-mono font-bold uppercase">Lane 2</div>
                    <div className="text-xs sm:text-sm font-extrabold text-white truncate">{athleteBName}</div>
                    <div className="text-[10px] text-gray-400 font-mono">{timeB > 0 ? `${timeB.toFixed(2)}s` : '--'}</div>
                  </div>

                  {/* Progress Runner Track Bar */}
                  <div className="flex-1 relative h-10 flex items-center ml-2">
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-sky-600 to-sky-400 rounded-full transition-all duration-75"
                        style={{ width: `${trackPctB}%` }}
                      ></div>
                    </div>

                    {/* Runner Icon Avatar */}
                    <div 
                      className="absolute -top-1 -translate-x-1/2 flex flex-col items-center pointer-events-none transition-all duration-75"
                      style={{ left: `${trackPctB}%` }}
                    >
                      <div className="w-8 h-8 rounded-full bg-sky-400 text-black flex items-center justify-center font-bold text-xs shadow-[0_0_15px_rgba(56,189,248,0.7)] border-2 border-white">
                        B
                      </div>
                      <span className="text-[9px] font-mono font-bold text-sky-400 mt-0.5 bg-black/60 px-1 rounded">
                        {((trackPctB / 100) * trackDist).toFixed(1)}m
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Simulation Status readout */}
              <div className="mt-4 flex flex-col sm:flex-row justify-between items-center text-xs font-mono text-gray-400 pt-3 border-t border-slate-800 gap-2">
                <div>
                  ELAPSED TIME: <span className="text-white font-bold">{currentSimTime.toFixed(2)}s</span> / {maxTotalTime.toFixed(2)}s
                </div>
                <div>
                  {trackPctA >= 100 && trackPctB >= 100 ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                      <Award size={14} /> FINISH LINE CROSSED: {aWins ? athleteAName : athleteBName} WINS!
                    </span>
                  ) : trackPctA > trackPctB ? (
                    <span className="text-emerald-400 font-bold">
                      {athleteAName} leads by {(((trackPctA - trackPctB) / 100) * trackDist).toFixed(2)}m
                    </span>
                  ) : trackPctB > trackPctA ? (
                    <span className="text-sky-400 font-bold">
                      {athleteBName} leads by {(((trackPctB - trackPctA) / 100) * trackDist).toFixed(2)}m
                    </span>
                  ) : (
                    <span>Runners neck-and-neck</span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Visual Sector Split Gain/Loss Delta Chart */}
      <SprintSplitDeltaChart
        currentRun={activeRunA}
        athlete={{ name: athleteAName }}
        history={history}
        results={results}
        roster={roster}
      />

      {/* Split Interval Breakdown Matrix */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl p-5 md:p-6 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-emerald-500">SEGMENT KINEMATICS</div>
            <h3 className="text-lg font-black text-gray-900 dark:text-white">Phase-by-Phase Acceleration Matrix</h3>
          </div>
          <span className="text-xs text-gray-400 font-bold">10m Intervals</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 dark:border-slate-800 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                <th className="py-3 px-3">Sprint Phase</th>
                <th className="py-3 px-3 text-emerald-500">{athleteAName} (Cum.)</th>
                <th className="py-3 px-3 text-sky-400">{athleteBName} (Cum.)</th>
                <th className="py-3 px-3">Lead Delta</th>
                <th className="py-3 px-3 text-emerald-500">{athleteAName} (10m Split)</th>
                <th className="py-3 px-3 text-sky-400">{athleteBName} (10m Split)</th>
                <th className="py-3 px-3 text-right">Advantage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800 font-mono text-xs">
              {segments.map((seg) => (
                <tr key={seg.distance} className="hover:bg-gray-50 dark:hover:bg-slate-800/60 transition">
                  <td className="py-3.5 px-3 font-sans font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>{seg.distance}m</span>
                    <span className="text-[10px] text-gray-400 font-normal hidden sm:inline">({seg.phase})</span>
                  </td>
                  <td className="py-3.5 px-3 font-bold text-emerald-500">
                    {seg.cumA !== null ? `${seg.cumA.toFixed(2)}s` : '--'}
                  </td>
                  <td className="py-3.5 px-3 font-bold text-sky-400">
                    {seg.cumB !== null ? `${seg.cumB.toFixed(2)}s` : '--'}
                  </td>
                  <td className="py-3.5 px-3 font-bold">
                    {seg.cumDiff !== null ? (
                      <span className={seg.cumDiff > 0 ? "text-emerald-500" : seg.cumDiff < 0 ? "text-sky-400" : "text-gray-400"}>
                        {seg.cumDiff > 0 ? `+${seg.cumDiff.toFixed(2)}s` : `${seg.cumDiff.toFixed(2)}s`}
                      </span>
                    ) : '--'}
                  </td>
                  <td className="py-3.5 px-3 text-gray-700 dark:text-gray-300">
                    {seg.intA !== null ? `${seg.intA.toFixed(2)}s (${seg.segVelA.toFixed(1)}m/s)` : '--'}
                  </td>
                  <td className="py-3.5 px-3 text-gray-700 dark:text-gray-300">
                    {seg.intB !== null ? `${seg.intB.toFixed(2)}s (${seg.segVelB.toFixed(1)}m/s)` : '--'}
                  </td>
                  <td className="py-3.5 px-3 text-right font-sans">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      seg.fasterRunner === athleteAName
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : seg.fasterRunner === athleteBName
                        ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                        : 'bg-gray-500/10 text-gray-400'
                    }`}>
                      {seg.fasterRunner}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Physics & Biomechanical Energetics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Top Velocity Card */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">Max Sprint Velocity</div>
          <div className="flex justify-between items-baseline font-mono">
            <div>
              <div className="text-[10px] text-emerald-500 font-bold">{athleteAName}</div>
              <div className="text-xl font-black text-gray-900 dark:text-white">{velA > 0 ? velA.toFixed(2) : '--'} <span className="text-xs text-gray-400 font-normal">m/s</span></div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-sky-400 font-bold">{athleteBName}</div>
              <div className="text-xl font-black text-gray-900 dark:text-white">{velB > 0 ? velB.toFixed(2) : '--'} <span className="text-xs text-gray-400 font-normal">m/s</span></div>
            </div>
          </div>
          <div className="mt-3 text-[11px] font-bold text-gray-500 flex items-center justify-between border-t border-gray-100 dark:border-slate-800 pt-2">
            <span>&Delta; Speed:</span>
            <span className="font-mono text-emerald-400 font-black">{velA > 0 && velB > 0 ? `+${Math.abs(velA - velB).toFixed(2)} m/s` : '--'}</span>
          </div>
        </div>

        {/* Reaction Time Card */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">Block Reaction Time</div>
          <div className="flex justify-between items-baseline font-mono">
            <div>
              <div className="text-[10px] text-emerald-500 font-bold">{athleteAName}</div>
              <div className="text-xl font-black text-gray-900 dark:text-white">{rtA > 0 ? `${(rtA * 1000).toFixed(0)}ms` : '--'}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-sky-400 font-bold">{athleteBName}</div>
              <div className="text-xl font-black text-gray-900 dark:text-white">{rtB > 0 ? `${(rtB * 1000).toFixed(0)}ms` : '--'}</div>
            </div>
          </div>
          <div className="mt-3 text-[11px] font-bold text-gray-500 flex items-center justify-between border-t border-gray-100 dark:border-slate-800 pt-2">
            <span>Explosive Clearance:</span>
            <span className="font-mono text-emerald-400 font-black">{rtA > 0 && rtB > 0 ? `+${Math.abs((rtA - rtB) * 1000).toFixed(0)}ms` : '--'}</span>
          </div>
        </div>

        {/* Peak Momentum Card */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">Momentum (p = m·v)</div>
          <div className="flex justify-between items-baseline font-mono">
            <div>
              <div className="text-[10px] text-emerald-500 font-bold">{athleteAName}</div>
              <div className="text-xl font-black text-gray-900 dark:text-white">{momA} <span className="text-xs text-gray-400 font-normal">kg·m/s</span></div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-sky-400 font-bold">{athleteBName}</div>
              <div className="text-xl font-black text-gray-900 dark:text-white">{momB} <span className="text-xs text-gray-400 font-normal">kg·m/s</span></div>
            </div>
          </div>
          <div className="mt-3 text-[11px] font-bold text-gray-500 flex items-center justify-between border-t border-gray-100 dark:border-slate-800 pt-2">
            <span>Collision Force:</span>
            <span className="font-mono text-purple-400 font-black">{momA !== '--' && momB !== '--' ? `+${Math.abs(parseFloat(momA) - parseFloat(momB)).toFixed(0)} kg·m/s` : '--'}</span>
          </div>
        </div>

        {/* Kinetic Energy Card */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">Kinetic Energy (0.5·m·v²)</div>
          <div className="flex justify-between items-baseline font-mono">
            <div>
              <div className="text-[10px] text-emerald-500 font-bold">{athleteAName}</div>
              <div className="text-xl font-black text-gray-900 dark:text-white">{keA} <span className="text-xs text-gray-400 font-normal">J</span></div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-sky-400 font-bold">{athleteBName}</div>
              <div className="text-xl font-black text-gray-900 dark:text-white">{keB} <span className="text-xs text-gray-400 font-normal">J</span></div>
            </div>
          </div>
          <div className="mt-3 text-[11px] font-bold text-gray-500 flex items-center justify-between border-t border-gray-100 dark:border-slate-800 pt-2">
            <span>Work Capacity:</span>
            <span className="font-mono text-orange-400 font-black">{keA !== '--' && keB !== '--' ? `+${Math.abs(parseFloat(keA) - parseFloat(keB)).toFixed(0)} J` : '--'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
