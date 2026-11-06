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
import { motion } from 'motion/react';
import { 
  Zap, Activity, Trophy, TrendingUp, TrendingDown, Award, 
  Shield, Download, Share2, FileText, X, ChevronRight, 
  User, Clock, Target, Compass, Flame, Sparkles, 
  MessageSquare, Mail, Gauge, ArrowUpRight, Heart, Loader2
} from 'lucide-react';
import { 
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, 
  CartesianGrid, Tooltip as RechartsTooltip 
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { savePdfFile } from '../utils/pdfDownloader';
import { addVelocityLabLogoToPdf } from '../utils/logoPdfHelper';
import VelocityLabLogo from './VelocityLabLogo';
import { generateAthleteBioReport } from '../utils/athleteBioReportGenerator';

/**
 * AthleteScoutCardModal
 * Comprehensive Longitudinal Athletic Profile, 5-Pillar Capability Radar,
 * Personal Records Showcase, Kinematic Summary, and Pro Combine Scout Dossier.
 */
export default function AthleteScoutCardModal({
  athleteName,
  history = [],
  results = [],
  roster = [],
  onClose,
  onOpenFvp
}) {
  const [chartMetric, setChartMetric] = useState('time'); // 'time' | 'velocity'
  const [isGeneratingBioReport, setIsGeneratingBioReport] = useState(false);
  const [bioReportStatus, setBioReportStatus] = useState('');

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

  // Match athlete from roster or synthesize from history
  const athleteMeta = useMemo(() => {
    const matched = roster.find(r => r.name === athleteName);
    const histItem = history.find(h => h.name === athleteName) || {};
    const rawWeight = matched?.weight || histItem.weight;
    const rawHeight = matched?.height || histItem.height;
    const rawAge = matched?.age || histItem.age;
    return {
      name: athleteName,
      bib: matched?.bib || histItem.bib || 'N/A',
      age: rawAge && parseInt(rawAge) > 0 ? parseInt(rawAge) : null,
      gender: matched?.gender || histItem.gender || 'M',
      sport: matched?.sport || histItem.sport || 'Track & Field',
      weight: rawWeight && parseFloat(rawWeight) > 0 ? parseFloat(rawWeight) : null,
      height: rawHeight && parseFloat(rawHeight) > 0 ? parseFloat(rawHeight) : null,
      weightEntered: Boolean(rawWeight && parseFloat(rawWeight) > 0),
      heightEntered: Boolean(rawHeight && parseFloat(rawHeight) > 0),
      ageEntered: Boolean(rawAge && parseInt(rawAge) > 0),
      phone: matched?.phone || matched?.whatsapp || histItem.phone || '',
      email: matched?.email || histItem.email || ''
    };
  }, [athleteName, roster, history]);

  // All runs for this athlete combining current results & history, deduplicated
  const athleteRuns = useMemo(() => {
    const combined = [...(results || []), ...(history || [])];
    const seen = new Set();
    const unique = [];
    combined.forEach(r => {
      if (!r || r.name !== athleteName) return;
      const key = r.firebaseId || r.id;
      if (key && seen.has(key)) return;
      if (key) seen.add(key);
      unique.push(r);
    });
    return unique.sort((a, b) => (a.serverTime?.seconds || a.id || 0) - (b.serverTime?.seconds || b.id || 0));
  }, [history, results, athleteName]);

  // Group runs by actual event & distance for true Personal Records
  const eventRecords = useMemo(() => {
    const map = new Map();

    athleteRuns.forEach(r => {
      const t = parseFloat(r.time);
      if (isNaN(t) || t <= 0) return;

      let eventKey = '';
      let eventLabel = '';
      let category = 'sprint';
      let distM = parseFloat(r.distanceMeters || r.distance);

      if (r.testType === 'pro_agility' || r.testMode === 'pro_agility' || String(r.distance).toLowerCase().includes('agility') || String(r.distance).includes('5-10-5')) {
        eventKey = 'pro_agility';
        eventLabel = 'Pro Agility (5-10-5)';
        category = 'agility';
        distM = 20;
      } else if (r.testType === 'shuttle' || r.testMode === 'shuttle' || String(r.distance).toLowerCase().includes('shuttle')) {
        eventKey = 'shuttle';
        eventLabel = '4x10m Shuttle Run';
        category = 'agility';
        distM = 40;
      } else if (r.testType === 'l_drill' || r.testMode === 'l_drill' || String(r.distance).toLowerCase().includes('l-drill') || String(r.distance).includes('3-cone')) {
        eventKey = 'l_drill';
        eventLabel = '3-Cone L-Drill';
        category = 'agility';
        distM = 30;
      } else if (r.testType === 'vertical_jump' || r.testMode === 'vertical_jump' || r.jumpHeightIn) {
        eventKey = 'vertical_jump';
        eventLabel = 'Vertical Jump Elevation';
        category = 'power';
      } else if (r.testType === 'rsa' || r.testMode === 'rsa' || String(r.distance).toLowerCase().includes('rsa')) {
        eventKey = `rsa_${distM || 'std'}`;
        eventLabel = distM ? `RSA (${distM}m Series)` : 'Repeated Sprint Ability (RSA)';
        category = 'stamina';
      } else {
        const isMass = r.testType === 'mass_sprint' || String(r.distance).toLowerCase().includes('mass');
        const cleanDist = !isNaN(distM) && distM > 0 ? `${distM}m` : (r.distance ? String(r.distance) : 'Sprint');
        eventKey = `sprint_${cleanDist}_${isMass ? 'mass' : 'solo'}`;
        eventLabel = isMass ? `${cleanDist} Mass Sprint Heat` : `${cleanDist} Straight Sprint`;
        category = 'sprint';
      }

      const existing = map.get(eventKey);
      if (!existing || t < existing.bestTime) {
        const vel = r.velocity ? parseFloat(r.velocity) : (distM && t > 0 ? (distM / t) : 0);
        map.set(eventKey, {
          key: eventKey,
          label: eventLabel,
          category,
          distanceMeters: distM,
          bestTime: t,
          bestTimeFormatted: `${t.toFixed(2)}s`,
          velocity: vel,
          reactionTime: r.reactionTime && parseFloat(r.reactionTime) > 0 ? (parseFloat(r.reactionTime) > 20 ? (parseFloat(r.reactionTime)/1000).toFixed(3) : parseFloat(r.reactionTime).toFixed(3)) : null,
          splits: r.splits || [],
          runObj: r
        });
      }
    });

    return Array.from(map.values());
  }, [athleteRuns]);

  // Overall Best Sprint Run
  const bestSprintRun = useMemo(() => {
    if (athleteRuns.length === 0) return null;
    const sorted = [...athleteRuns]
      .filter(r => r && parseFloat(r.time) > 0)
      .sort((a, b) => parseFloat(a.time) - parseFloat(b.time));
    return sorted.length > 0 ? sorted[0] : null;
  }, [athleteRuns]);

  const personalBest = bestSprintRun ? parseFloat(bestSprintRun.time).toFixed(2) : '--';
  const bestRunDistance = bestSprintRun 
    ? (bestSprintRun.distance 
        ? (String(bestSprintRun.distance).toLowerCase().includes('m') ? bestSprintRun.distance : `${bestSprintRun.distance}m Sprint`) 
        : 'Sprint')
    : '';

  // Top Velocity (m/s) strictly from actual recorded runs
  const topVel = useMemo(() => {
    if (athleteRuns.length === 0) return 0;
    const vels = athleteRuns.map(r => {
      if (r.velocity) return parseFloat(r.velocity);
      const d = parseFloat(r.distanceMeters || r.distance);
      const t = parseFloat(r.time);
      return (!isNaN(d) && d > 0 && t > 0) ? d / t : 0;
    }).filter(v => !isNaN(v) && v > 0);
    return vels.length > 0 ? Math.max(...vels) : 0;
  }, [athleteRuns]);

  // Discipline Bests Extraction
  const disciplineBests = useMemo(() => {
    const bests = {
      sprint40m: null,
      sprint10m: null,
      proAgility: null,
      shuttle: null,
      lDrill: null,
      verticalJump: null,
      rsa: null,
      peakHr: null,
      meanHrr: null
    };

    athleteRuns.forEach(r => {
      const t = parseFloat(r.time);
      const dist = parseFloat(r.distanceMeters || r.distance);

      if (r.heartRate?.bpm && (!bests.peakHr || r.heartRate.bpm > bests.peakHr)) {
        bests.peakHr = r.heartRate.bpm;
      }
      if (r.seriesPeakHr && (!bests.peakHr || r.seriesPeakHr > bests.peakHr)) {
        bests.peakHr = r.seriesPeakHr;
      }
      if (r.meanHrr && (!bests.meanHrr || r.meanHrr > bests.meanHrr)) {
        bests.meanHrr = r.meanHrr;
      }

      if (isNaN(t) || t <= 0) return;

      const isLinearSprint = !['pro_agility', 'shuttle', 'l_drill', 'vertical_jump', 'jump', 'rsa'].includes(r.testType) &&
                             !['pro_agility', 'shuttle', 'l_drill', 'vertical_jump', 'jump', 'rsa'].includes(r.testMode);

      if (dist === 40 && isLinearSprint && (!bests.sprint40m || t < bests.sprint40m)) {
        bests.sprint40m = t;
      }
      if (dist === 10 && isLinearSprint && (!bests.sprint10m || t < bests.sprint10m)) {
        bests.sprint10m = t;
      }
      if (r.testType === 'pro_agility' || r.testMode === 'pro_agility' || String(r.distance).includes('5-10-5')) {
        if (!bests.proAgility || t < bests.proAgility) bests.proAgility = t;
      }
      if (r.testType === 'shuttle' || r.testMode === 'shuttle' || String(r.distance).toLowerCase().includes('shuttle')) {
        if (!bests.shuttle || t < bests.shuttle) bests.shuttle = t;
      }
      if (r.testType === 'l_drill' || r.testMode === 'l_drill' || String(r.distance).toLowerCase().includes('3-cone')) {
        if (!bests.lDrill || t < bests.lDrill) bests.lDrill = t;
      }
      if (r.testType === 'vertical_jump' || r.testMode === 'vertical_jump') {
        const heightIn = (1.226 * t * t * 39.37);
        if (!bests.verticalJump || heightIn > bests.verticalJump) bests.verticalJump = heightIn;
      }
      if (r.testMode === 'rsa' || r.testType === 'rsa') {
        if (!bests.rsa || t < bests.rsa) bests.rsa = t;
      }
    });

    return bests;
  }, [athleteRuns]);

  // Recent 10 runs
  const recentRuns = useMemo(() => athleteRuns.slice(-10), [athleteRuns]);

  // Dynamic Momentum and Kinetic Power - ONLY if genuine weight was provided
  const peakMomentum = athleteMeta.weightEntered && athleteMeta.weight > 0 && topVel > 0 
    ? (athleteMeta.weight * topVel).toFixed(0) 
    : '--';
  const avgPower = athleteMeta.weightEntered && athleteMeta.weight > 0 && topVel > 0 && personalBest !== '--' 
    ? ((0.5 * athleteMeta.weight * Math.pow(topVel, 2)) * (1 / parseFloat(personalBest))).toFixed(0) 
    : '--';

  // 5-Pillar Athletic Capability Radar Scores (0 to 100) - STRICTLY GROUNDED IN REAL TESTS
  const radarScores = useMemo(() => {
    // 1. Acceleration Score (from linear sprint or 10m split)
    let accelScore = null;
    if (disciplineBests.sprint10m) {
      const t = disciplineBests.sprint10m;
      accelScore = t <= 1.55 ? 98 : t <= 1.68 ? 90 : t <= 1.80 ? 78 : t <= 1.95 ? 65 : 50;
    } else if (bestSprintRun) {
      const pb = parseFloat(bestSprintRun.time);
      const d = parseFloat(bestSprintRun.distanceMeters || bestSprintRun.distance) || 40;
      if (pb > 0 && d > 0) {
        // Physics-grounded expected elite sprint time for distance d:
        // t_elite(d) = d / vMax + tau * (1 - e^(-d/(vMax*tau))) with vMax=11.0, tau=1.2
        const expectedElite = (d / 11.0) + 1.2 * (1 - Math.exp(-d / (11.0 * 1.2)));
        const ratio = expectedElite / pb;
        accelScore = Math.round(Math.min(100, Math.max(30, ratio * 90)));
      }
    }

    // 2. Max Velocity Score (from actual measured velocity)
    let velScore = null;
    if (topVel > 0) {
      velScore = topVel >= 10.4 ? 98 : topVel >= 9.6 ? 90 : topVel >= 8.8 ? 80 : topVel >= 8.0 ? 68 : topVel >= 7.0 ? 58 : 45;
    }

    // 3. Explosive Power Score (from Vertical Jump or verified mass + sprint)
    let powerScore = null;
    if (disciplineBests.verticalJump) {
      const vj = disciplineBests.verticalJump;
      powerScore = vj >= 36 ? 98 : vj >= 31 ? 88 : vj >= 26 ? 76 : vj >= 20 ? 62 : 50;
    } else if (athleteMeta.weightEntered && avgPower !== '--') {
      const p = parseFloat(avgPower);
      const wKg = p / athleteMeta.weight;
      powerScore = wKg >= 26 ? 95 : wKg >= 21 ? 85 : wKg >= 16 ? 72 : 58;
    }

    // 4. COD Agility Score (from Pro Agility, Shuttle, or L-Drill)
    let agilityScore = null;
    if (disciplineBests.proAgility) {
      const t = disciplineBests.proAgility;
      agilityScore = t <= 4.20 ? 98 : t <= 4.45 ? 88 : t <= 4.75 ? 75 : 60;
    } else if (disciplineBests.shuttle) {
      const t = disciplineBests.shuttle;
      agilityScore = t <= 9.30 ? 96 : t <= 9.90 ? 86 : t <= 10.5 ? 74 : 60;
    } else if (disciplineBests.lDrill) {
      const t = disciplineBests.lDrill;
      agilityScore = t <= 7.00 ? 96 : t <= 7.40 ? 86 : t <= 7.90 ? 74 : 60;
    }

    // 5. Fatigue Resistance / Repeatability Score (from RSA or 3+ repeated runs)
    let fatigueScore = null;
    if (disciplineBests.rsa) {
      fatigueScore = 88;
    } else if (athleteRuns.length >= 3) {
      const times = athleteRuns.map(r => parseFloat(r.time)).filter(t => !isNaN(t) && t > 0);
      if (times.length >= 3) {
        const mean = times.reduce((a, b) => a + b, 0) / times.length;
        const variance = times.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / times.length;
        const stdDev = Math.sqrt(variance);
        const cv = stdDev / mean;
        fatigueScore = cv <= 0.02 ? 98 : cv <= 0.04 ? 90 : cv <= 0.07 ? 80 : cv <= 0.12 ? 68 : 55;
      }
    }

    return [
      { name: 'Acceleration', label: 'Start & Drive', score: accelScore, benchmark: 88 },
      { name: 'Max Velocity', label: 'Top-End Speed', score: velScore, benchmark: 86 },
      { name: 'Explosive Power', label: 'Vertical / Impulse', score: powerScore, benchmark: 84 },
      { name: 'COD Agility', label: 'Decel & Direction', score: agilityScore, benchmark: 82 },
      { name: 'Fatigue Stamina', label: 'Repeatability (CV)', score: fatigueScore, benchmark: 80 }
    ];
  }, [disciplineBests, bestSprintRun, topVel, avgPower, athleteRuns, athleteMeta]);

  const testedCount = useMemo(() => radarScores.filter(p => p.score !== null).length, [radarScores]);

  // Overall Athletic Index (Composite 0-100) - Only over validly tested pillars!
  const compositeIndex = useMemo(() => {
    const validScores = radarScores.filter(p => p.score !== null);
    if (validScores.length === 0) return null;
    const total = validScores.reduce((acc, p) => acc + p.score, 0);
    return Math.round(total / validScores.length);
  }, [radarScores]);

  // AI Mechanical Coaching Notes
  const aiNotes = useMemo(() => {
    let notes = "Solid training progression. Focus on turnover consistency.";
    if (recentRuns.length >= 2) {
      const last = parseFloat(recentRuns[recentRuns.length - 1].time);
      const prev = parseFloat(recentRuns[recentRuns.length - 2].time);
      const reactionLast = parseFloat(recentRuns[recentRuns.length - 1].reactionTime || 0);
      
      if (last < prev) {
        notes = `Exceptional progression! Your latest run dropped ${(prev - last).toFixed(2)}s below the previous baseline. Acceleration mechanics are peaking. `;
      } else if (last > prev) {
        notes = `Slight deceleration trend (+${(last - prev).toFixed(2)}s on last attempt). Ensure full ground contact extension and reduce lateral sway through transition. `;
      }
      if (reactionLast > 0.35) {
        notes += "Block reaction time has headroom to improve (~150-180ms target). Work on sensory cue responsiveness.";
      } else if (reactionLast > 0 && reactionLast < 0.18) {
        notes += "Elite starter reaction off the beam! Explosive block departure.";
      }
    } else if (athleteRuns.length === 1) {
      notes = `Baseline recorded at ${athleteRuns[0].time}s (${athleteRuns[0].distance || 'Sprint'}). Conduct further trials to map speed endurance and kinematic consistency.`;
    }
    return notes;
  }, [recentRuns, athleteRuns]);

  // Peak Kinematics from Video Analysis
  const peakKinematics = useMemo(() => {
    const runWithPose = athleteRuns.slice().reverse().find(r => r.maxKnee !== undefined || r.poseGraphData);
    if (!runWithPose) return null;

    let mk = 0, mh = 0, me = 0, ma = 0;
    if (runWithPose.maxKnee === undefined && runWithPose.poseGraphData) {
      runWithPose.poseGraphData.forEach(d => {
        if (d.knee > mk) mk = d.knee;
        if (d.hip > mh) mh = d.hip;
        if (d.elbow > me) me = d.elbow;
        if (d.ankle > ma) ma = d.ankle;
      });
      return {
        knee: mk.toFixed(1),
        hip: mh.toFixed(1),
        elbow: me.toFixed(1),
        ankle: ma.toFixed(1)
      };
    }
    return {
      knee: parseFloat(runWithPose.maxKnee || 0).toFixed(1),
      hip: parseFloat(runWithPose.maxHip || 0).toFixed(1),
      elbow: parseFloat(runWithPose.maxElbow || 0).toFixed(1),
      ankle: parseFloat(runWithPose.maxAnkle || 0).toFixed(1)
    };
  }, [athleteRuns]);

  // SVG Radar Polygon Geometry Calculation (Center: 125, 125 | Radius: 85)
  const radarGeometry = useMemo(() => {
    const cx = 125;
    const cy = 125;
    const maxR = 85;
    const n = radarScores.length;

    const athletePoints = radarScores.map((p, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const scoreVal = p.score !== null ? p.score : 0;
      const r = (scoreVal / 100) * maxR;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    const benchmarkPoints = radarScores.map((p, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const r = (p.benchmark / 100) * maxR;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    return { cx, cy, maxR, athletePoints, benchmarkPoints };
  }, [radarScores]);

  // Export Athlete Scouting Dossier to PDF
  const handleExportScoutPDF = () => {
    try {
      const doc = new jsPDF();
      
      // Header Banner
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, 210, 40, 'F');
      
      // Official Velocity Lab Brand Header Logo
      addVelocityLabLogoToPdf(doc, { x: 14, y: 10, width: 44, isDark: true });
      
      doc.setFontSize(14);
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, 'bold');
      doc.text("• ATHLETE SCOUT REPORT", 62, 20);
      
      doc.setFontSize(10);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(`Official Combine Evaluation Dossier • Generated ${new Date().toLocaleDateString()}`, 14, 30);

      // Athlete Bio Table
      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      autoTable(doc, {
        startY: 48,
        head: [['Full Name', 'Bib #', 'Sport', 'Age', 'Weight', 'Height', 'Athletic Score']],
        body: [[
          athleteMeta.name,
          athleteMeta.bib,
          athleteMeta.sport,
          athleteMeta.age ? `${athleteMeta.age} yrs` : 'N/A',
          athleteMeta.weight ? `${athleteMeta.weight} kg` : 'N/A',
          athleteMeta.height ? `${athleteMeta.height} cm` : 'N/A',
          compositeIndex !== null ? `${compositeIndex}/100 (${testedCount === 5 ? 'Complete Profile' : `Partial ${testedCount}/5`})` : 'Pending Tests'
        ]],
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129], textColor: [0, 0, 0], fontStyle: 'bold' }
      });

      // 5-Pillar Capability Radar Table
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 10,
        head: [['Pillar Capability', 'Evaluation Sub-Metric', 'Athlete Score (0-100)', 'Collegiate D1 Target', 'Standing']],
        body: radarScores.map(p => [
          p.name,
          p.label,
          p.score !== null ? `${p.score}/100` : 'Not Tested',
          `${p.benchmark}/100`,
          p.score !== null ? (p.score >= p.benchmark ? 'Above Collegiate Target' : 'Developmental') : 'Pending Test Data'
        ]),
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] }
      });

      // Personal Records Table - DYNAMIC based on athlete's actual tests!
      const prTableBody = eventRecords.length > 0 
        ? eventRecords.map(ev => {
            const dist = ev.distanceMeters;
            let std = 'Official Gate Timed';
            if (dist && dist <= 15) std = 'Acceleration Phase';
            else if (dist && dist <= 30) std = 'Speed Transition Zone';
            else if (dist && dist <= 45) std = 'Max Velocity Protocol';
            else if (ev.category === 'agility') std = 'Agility & Deceleration';

            return [
              ev.label,
              ev.bestTimeFormatted,
              ev.velocity > 0 ? `${ev.velocity.toFixed(2)} m/s peak velocity` : (ev.distanceMeters ? `${ev.distanceMeters}m distance` : 'Verified Gate Time'),
              ev.reactionTime ? `Reaction: ${ev.reactionTime}s` : std
            ];
          })
        : [
            ['Linear Sprint', 'No Runs Recorded', 'N/A', 'Pending Gate Test'],
            ['Agility (5-10-5 / Shuttle)', 'Not Tested', 'N/A', 'Combine Standard'],
            ['Vertical Jump', 'Not Tested', 'N/A', 'Power Standard']
          ];

      if (disciplineBests.peakHr) {
        prTableBody.push([
          'Cardiovascular Telemetry',
          `${disciplineBests.peakHr} BPM Peak`,
          disciplineBests.meanHrr ? `▼${disciplineBests.meanHrr} BPM recovery drop` : 'BLE Telemetry Stream',
          'Biotelemetry Engine'
        ]);
      }

      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 10,
        head: [['Assessment Event', 'Personal Record', 'Calculated Metric', 'Performance Standard']],
        body: prTableBody,
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129], textColor: [0, 0, 0] }
      });

      // AI Coach Assessment Note
      const finalY = doc.lastAutoTable.finalY + 12;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text("Coaching Biomechanical Assessment:", 14, finalY);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      const splitNotes = doc.splitTextToSize(aiNotes, 180);
      doc.text(splitNotes, 14, finalY + 6);

      savePdfFile(doc, `${athleteMeta.name.replace(/\s+/g, '_')}_Scout_Dossier.pdf`);
    } catch (e) {
      console.error("Scout PDF export error:", e);
      alert(`Could not generate Scout PDF: ${e.message}`);
    }
  };

  // Generate Pro Athlete Multi-Page PDF Bio-Report
  const handleGenerateAthleteBioReport = async () => {
    try {
      setIsGeneratingBioReport(true);
      setBioReportStatus('Preparing...');
      await generateAthleteBioReport({
        athlete: athleteMeta,
        history,
        results,
        roster,
        onProgress: (pct, msg) => {
          setBioReportStatus(`${msg} (${pct}%)`);
        }
      });
    } catch (e) {
      console.error("Athlete Bio-Report error:", e);
      alert(`Could not generate Athlete Bio-Report: ${e.message}`);
    } finally {
      setIsGeneratingBioReport(false);
      setBioReportStatus('');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-3 sm:p-5 select-none"
      onClick={onClose}
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 16 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
        className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] text-gray-900 dark:text-slate-100 relative"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Top Header Banner */}
        <div className="p-5 sm:p-7 border-b border-gray-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-gray-50 via-white to-gray-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
          <div className="flex items-center gap-4">
            <motion.div 
              whileHover={{ rotate: [0, -5, 5, 0], scale: 1.05 }}
              transition={{ duration: 0.4 }}
              className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-black flex items-center justify-center font-black text-xl shadow-[0_0_20px_rgba(16,185,129,0.3)] border-2 border-white/40 dark:border-white/20 shrink-0"
            >
              {athleteMeta.name.substring(0, 2).toUpperCase()}
            </motion.div>
            <div>
              <div className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 tracking-widest uppercase flex items-center gap-2">
                <VelocityLabLogo variant="icon" className="h-4 w-4" />
                <span>COMBINE PRO ATHLETE SCOUT PROFILE</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3 mt-0.5">
                <span>{athleteMeta.name}</span>
                <span className="text-xs font-mono font-bold bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-700 px-2.5 py-1 rounded-xl shadow-xs">
                  Bib #{athleteMeta.bib}
                </span>
              </h2>
              <div className="text-xs text-gray-500 dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-gray-700 dark:text-slate-300">{athleteMeta.sport}</span>
                <span>•</span>
                <span>{athleteMeta.age ? `${athleteMeta.age} yrs` : 'Age: N/A'}</span>
                <span>•</span>
                <span>{athleteMeta.gender || 'Athlete'}</span>
                <span>•</span>
                <span>{athleteMeta.weight ? `${athleteMeta.weight} kg` : 'Weight: N/A'}</span>
                <span>•</span>
                <span>{athleteMeta.height ? `${athleteMeta.height} cm` : 'Height: N/A'}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
            {onOpenFvp && (
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => onOpenFvp(athleteRuns[athleteRuns.length - 1] || null)}
                className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black font-black text-xs uppercase tracking-wider rounded-xl transition shadow-md shadow-emerald-500/20"
                title="Open Samozino/Morin Horizontal Force-Velocity-Power Profile"
              >
                <Activity size={14} />
                <span>F-v-P Profile</span>
              </motion.button>
            )}

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              onClick={handleGenerateAthleteBioReport}
              disabled={isGeneratingBioReport}
              className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:via-teal-400 hover:to-cyan-400 text-black font-black text-xs uppercase tracking-wider rounded-xl transition shadow-md shadow-emerald-500/25 active:scale-95 disabled:opacity-50"
              title="Generate Pro Athlete Multi-Page PDF Bio-Report"
            >
              {isGeneratingBioReport ? (
                <>
                  <Loader2 size={14} className="animate-spin text-black" />
                  <span>{bioReportStatus || 'Generating...'}</span>
                </>
              ) : (
                <>
                  <Award size={14} />
                  <span>Generate Athlete Bio-Report</span>
                </>
              )}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              onClick={handleExportScoutPDF}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-800 dark:text-slate-200 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-bold transition shadow-sm"
              title="Download Scout Dossier PDF"
            >
              <Download size={14} />
              <span>Scout PDF</span>
            </motion.button>

            <motion.button 
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={onClose} 
              className="p-2 text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white bg-gray-100 hover:bg-gray-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 rounded-xl transition border border-gray-200 dark:border-slate-700/80 shadow-sm"
              title="Close Profile"
            >
              <X size={18} />
            </motion.button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-7 overflow-y-auto flex-1 flex flex-col gap-6 bg-white dark:bg-slate-900">
          
          {/* Top Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            <motion.div 
              whileHover={{ y: -3, scale: 1.02 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="bg-gray-50 dark:bg-slate-950/80 border border-gray-200 dark:border-slate-800 p-3.5 rounded-2xl text-center shadow-xs"
            >
              <div className="text-[10px] text-gray-500 dark:text-slate-400 font-bold tracking-wider uppercase mb-0.5">TOTAL RUNS</div>
              <div className="text-2xl font-black text-gray-900 dark:text-white">{athleteRuns.length}</div>
            </motion.div>

            <motion.div 
              whileHover={{ y: -3, scale: 1.02 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="bg-emerald-500/10 border border-emerald-500/30 p-3.5 rounded-2xl text-center shadow-[0_0_15px_rgba(16,185,129,0.1)]"
            >
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold tracking-wider uppercase mb-0.5">PERSONAL BEST</div>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                {personalBest !== '--' ? `${personalBest}s` : '--'}
              </div>
              <span className="text-[9px] text-emerald-700/80 dark:text-emerald-400/80 font-mono block truncate" title={bestRunDistance}>
                {bestRunDistance || 'No Runs'}
              </span>
            </motion.div>

            <motion.div 
              whileHover={{ y: -3, scale: 1.02 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="bg-gray-50 dark:bg-slate-950/80 border border-gray-200 dark:border-slate-800 p-3.5 rounded-2xl text-center shadow-xs"
            >
              <div className="text-[10px] text-gray-500 dark:text-slate-400 font-bold tracking-wider uppercase mb-0.5">TOP VELOCITY</div>
              <div className="text-2xl font-black text-gray-900 dark:text-white font-mono">{topVel > 0 ? `${topVel.toFixed(2)}` : '--'}</div>
              <span className="text-[9px] text-gray-400 dark:text-slate-500 font-mono">m/s</span>
            </motion.div>

            <motion.div 
              whileHover={{ y: -3, scale: 1.02 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="bg-gray-50 dark:bg-slate-950/80 border border-gray-200 dark:border-slate-800 p-3.5 rounded-2xl text-center shadow-xs"
            >
              <div className="text-[10px] text-gray-500 dark:text-slate-400 font-bold tracking-wider uppercase mb-0.5">MOMENTUM</div>
              <div className="text-2xl font-black text-gray-900 dark:text-white font-mono">{peakMomentum}</div>
              <span className="text-[9px] text-gray-400 dark:text-slate-500 font-mono">{peakMomentum !== '--' ? 'kg·m/s' : 'Req Weight'}</span>
            </motion.div>

            <motion.div 
              whileHover={{ y: -3, scale: 1.02 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="bg-gray-50 dark:bg-slate-950/80 border border-gray-200 dark:border-slate-800 p-3.5 rounded-2xl text-center shadow-xs"
            >
              <div className="text-[10px] text-gray-500 dark:text-slate-400 font-bold tracking-wider uppercase mb-0.5">EST. POWER</div>
              <div className="text-2xl font-black text-gray-900 dark:text-white font-mono">{avgPower}</div>
              <span className="text-[9px] text-gray-400 dark:text-slate-500 font-mono">{avgPower !== '--' ? 'Watts' : 'Req Weight'}</span>
            </motion.div>

            <motion.div 
              whileHover={{ y: -3, scale: 1.02 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-2xl text-center shadow-[0_0_15px_rgba(251,191,36,0.1)]"
            >
              <div className="text-[10px] text-amber-600 dark:text-amber-400 font-bold tracking-wider uppercase mb-0.5">SCOUT INDEX</div>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
                {compositeIndex !== null ? compositeIndex : '--'}
              </div>
              <span className="text-[9px] text-amber-600/80 dark:text-amber-400/80 font-bold uppercase">
                {testedCount === 5 ? 'Tier 1 Target' : testedCount > 0 ? `${testedCount}/5 Tested` : 'Untested'}
              </span>
            </motion.div>
          </div>

          {/* Section: 5-Pillar Spider Radar Chart + Personal Records Showcase */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
            
            {/* 5-Pillar Capability Spider Radar */}
            <div className="md:col-span-6 bg-gray-50 dark:bg-slate-950/80 border border-gray-200 dark:border-slate-800 rounded-3xl p-5 flex flex-col justify-between relative overflow-hidden shadow-sm dark:shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-bold text-gray-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Compass size={15} className="text-emerald-500 dark:text-emerald-400" />
                  <span>5-PILLAR ATHLETIC RADAR</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono text-gray-500 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400"></span> Athlete
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400/80"></span> D1 Target
                  </span>
                </div>
              </div>

              {/* Spider Radar SVG Polygon */}
              <div className="flex items-center justify-center my-1 relative">
                <svg width="250" height="250" viewBox="0 0 250 250" className="overflow-visible">
                  {/* Concentric Pentagon Web Lines */}
                  {[0.25, 0.50, 0.75, 1.0].map((scale, sIdx) => {
                    const r = radarGeometry.maxR * scale;
                    const pts = Array.from({ length: 5 }).map((_, i) => {
                      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
                      const x = radarGeometry.cx + r * Math.cos(angle);
                      const y = radarGeometry.cy + r * Math.sin(angle);
                      return `${x.toFixed(1)},${y.toFixed(1)}`;
                    }).join(' ');
                    return (
                      <polygon 
                        key={sIdx} 
                        points={pts} 
                        fill="none" 
                        stroke={isDark ? "#334155" : "#cbd5e1"} 
                        strokeWidth="1" 
                        strokeDasharray={scale === 1.0 ? 'none' : '3 3'} 
                      />
                    );
                  })}

                  {/* Axis Spokes from center to vertices */}
                  {Array.from({ length: 5 }).map((_, i) => {
                    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
                    const x = radarGeometry.cx + radarGeometry.maxR * Math.cos(angle);
                    const y = radarGeometry.cy + radarGeometry.maxR * Math.sin(angle);
                    return (
                      <line 
                        key={i} 
                        x1={radarGeometry.cx} 
                        y1={radarGeometry.cy} 
                        x2={x} 
                        y2={y} 
                        stroke={isDark ? "#334155" : "#cbd5e1"} 
                        strokeWidth="1" 
                      />
                    );
                  })}

                  {/* Benchmark Polygon (D1 Standard) */}
                  <polygon 
                    points={radarGeometry.benchmarkPoints} 
                    fill={isDark ? "rgba(251, 191, 36, 0.08)" : "rgba(251, 191, 36, 0.12)"} 
                    stroke="#fbbf24" 
                    strokeWidth="1.5" 
                    strokeDasharray="4 3" 
                  />

                  {/* Athlete Polygon */}
                  <motion.polygon 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 280, damping: 22 }}
                    points={radarGeometry.athletePoints} 
                    fill={isDark ? "rgba(16, 185, 129, 0.25)" : "rgba(16, 185, 129, 0.2)"} 
                    stroke="#10b981" 
                    strokeWidth="2.5" 
                    className="drop-shadow-[0_0_12px_rgba(16,185,129,0.5)]" 
                  />

                  {/* Polygon Vertex Dots */}
                  {radarScores.map((p, i) => {
                    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
                    const scoreVal = p.score !== null ? p.score : 0;
                    const r = (scoreVal / 100) * radarGeometry.maxR;
                    const x = radarGeometry.cx + r * Math.cos(angle);
                    const y = radarGeometry.cy + r * Math.sin(angle);
                    return (
                      <motion.circle 
                        key={i} 
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.15 + i * 0.05, type: 'spring', stiffness: 350, damping: 20 }}
                        cx={x} 
                        cy={y} 
                        r="4" 
                        fill={p.score !== null ? "#10b981" : (isDark ? "#475569" : "#94a3b8")} 
                        stroke={isDark ? "#0f172a" : "#ffffff"} 
                        strokeWidth="2" 
                      />
                    );
                  })}
                </svg>
              </div>

              {/* Pillar Score Breakdown Bar */}
              <div className="grid grid-cols-5 gap-1.5 pt-3 border-t border-gray-200 dark:border-slate-800 text-center">
                {radarScores.map((p, idx) => (
                  <motion.div 
                    key={idx} 
                    whileHover={{ y: -2, scale: 1.03 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    className="bg-white dark:bg-slate-900 rounded-xl p-1.5 border border-gray-200 dark:border-slate-800 shadow-xs cursor-default"
                  >
                    <div className="text-[9px] font-bold text-gray-500 dark:text-slate-400 truncate" title={p.label}>{p.name}</div>
                    <div className={`text-xs font-mono font-black ${p.score !== null ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-slate-500'}`}>
                      {p.score !== null ? p.score : 'N/T'}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Personal Best Disciplines Showcase - DYNAMIC ACCORDING TO ATHLETE'S REAL TESTS */}
            <div className="md:col-span-6 bg-gray-50 dark:bg-slate-950/80 border border-gray-200 dark:border-slate-800 rounded-3xl p-5 flex flex-col justify-between shadow-sm dark:shadow-lg">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-bold text-gray-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Trophy size={15} className="text-amber-500 dark:text-amber-400" />
                    <span>VERIFIED TEST RECORDS</span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold uppercase">
                    Official Gate Timings
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {eventRecords.length > 0 ? (
                    eventRecords.map((ev, eIdx) => (
                      <div key={eIdx} className="bg-white dark:bg-slate-900/90 border border-gray-200 dark:border-slate-800 rounded-2xl p-3 flex items-center justify-between shadow-xs">
                        <div className="min-w-0 pr-2">
                          <div className="text-[10px] font-bold uppercase text-gray-500 dark:text-slate-400 truncate" title={ev.label}>
                            {ev.label}
                          </div>
                          <div className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                            {ev.bestTimeFormatted}
                          </div>
                          <div className="text-[10px] text-gray-500 dark:text-slate-400 font-mono mt-0.5">
                            {ev.velocity > 0 ? `${ev.velocity.toFixed(2)} m/s peak` : (ev.reactionTime ? `Reaction: ${ev.reactionTime}s` : 'Gate Timed')}
                          </div>
                        </div>
                        <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-slate-800/80 border border-amber-200 dark:border-slate-700/80 flex items-center justify-center shrink-0">
                          <Award size={18} className="text-amber-500 dark:text-amber-400" />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="sm:col-span-2 bg-white/50 dark:bg-slate-900/50 border border-dashed border-gray-300 dark:border-slate-800 rounded-2xl p-4 text-center text-gray-500 dark:text-slate-400 text-xs">
                      No gate assessment records yet for this athlete.
                    </div>
                  )}

                  {/* Cardiovascular Output (if BLE HR was recorded) */}
                  {disciplineBests.peakHr && (
                    <div className="bg-white dark:bg-slate-900/90 border border-gray-200 dark:border-slate-800 rounded-2xl p-3 flex items-center justify-between sm:col-span-2 shadow-xs">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
                          <Heart size={16} className="fill-rose-500" />
                        </div>
                        <div>
                          <div className="text-[10px] font-bold uppercase text-gray-500 dark:text-slate-400">Cardiovascular Output & Recovery</div>
                          <div className="text-sm font-black font-mono text-gray-900 dark:text-white mt-0.5 flex items-center gap-2 flex-wrap">
                            <span>{disciplineBests.peakHr} BPM Peak</span>
                            {disciplineBests.meanHrr && (
                              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                                (Mean HRR: ▼{disciplineBests.meanHrr} BPM)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <span className="text-[9px] font-mono text-gray-500 dark:text-slate-500 font-bold px-2 py-0.5 rounded bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700">BLE SMART</span>
                    </div>
                  )}
                </div>
              </div>

              {/* AI Coach's Mechanical Notes */}
              <div className="mt-4 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl p-4 relative overflow-hidden">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-1.5">
                  <Zap size={14} />
                  <span>AI Mechanical Coaching Insights</span>
                </div>
                <div className="text-xs text-gray-700 dark:text-slate-200 leading-relaxed font-medium">
                  "{aiNotes}"
                </div>
              </div>
            </div>

          </div>

          {/* Peak Kinematics (Latest Run) */}
          {peakKinematics && (
            <div className="bg-gray-50 dark:bg-slate-950/80 border border-gray-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm dark:shadow-lg">
              <div className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Activity size={14} className="text-emerald-500 dark:text-emerald-400" />
                <span>Peak Joint Kinematics (Latest Pose Capture)</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-xs">
                  <div className="text-[10px] text-gray-500 dark:text-slate-400 font-bold uppercase mb-1">Max Knee Flexion</div>
                  <div className="text-xl font-bold font-mono text-gray-900 dark:text-white">{peakKinematics.knee}°</div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-xs">
                  <div className="text-[10px] text-gray-500 dark:text-slate-400 font-bold uppercase mb-1">Max Hip Extension</div>
                  <div className="text-xl font-bold font-mono text-gray-900 dark:text-white">{peakKinematics.hip}°</div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-xs">
                  <div className="text-[10px] text-gray-500 dark:text-slate-400 font-bold uppercase mb-1">Max Elbow Drive</div>
                  <div className="text-xl font-bold font-mono text-gray-900 dark:text-white">{peakKinematics.elbow}°</div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-xs">
                  <div className="text-[10px] text-gray-500 dark:text-slate-400 font-bold uppercase mb-1">Max Ankle Dorsiflexion</div>
                  <div className="text-xl font-bold font-mono text-gray-900 dark:text-white">{peakKinematics.ankle}°</div>
                </div>
              </div>
            </div>
          )}

          {/* Historical Progression Chart */}
          <div className="bg-gray-50 dark:bg-slate-950/80 border border-gray-200 dark:border-slate-800 rounded-3xl p-5 flex flex-col min-h-[300px] shadow-sm dark:shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <div className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp size={14} className="text-emerald-500 dark:text-emerald-400" />
                <span>Historical Progression (Last 10 Runs)</span>
              </div>
              <div className="flex bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-1 rounded-xl shadow-xs">
                <button
                  onClick={() => setChartMetric('time')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                    chartMetric === 'time' 
                      ? 'bg-emerald-500 text-black shadow-sm' 
                      : 'text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  Sprint Time (s)
                </button>
                <button
                  onClick={() => setChartMetric('velocity')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                    chartMetric === 'velocity' 
                      ? 'bg-emerald-500 text-black shadow-sm' 
                      : 'text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  Velocity (m/s)
                </button>
              </div>
            </div>

            <div className="flex-1 h-52">
              {recentRuns.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={recentRuns} margin={{ top: 5, right: 15, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#1e293b" : "#e2e8f0"} vertical={false} />
                    <XAxis 
                      dataKey={(val) => {
                        if (val.serverTime && val.serverTime.seconds) {
                          return new Date(val.serverTime.seconds * 1000).toLocaleDateString([], { month: 'short', day: 'numeric' });
                        }
                        return `${val.time}s`;
                      }} 
                      stroke={isDark ? "#475569" : "#94a3b8"} 
                      tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 10, fontWeight: 600 }}
                    />
                    <YAxis 
                      domain={['auto', 'auto']} 
                      stroke={isDark ? "#475569" : "#94a3b8"} 
                      tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 11, fontWeight: 600 }} 
                      tickFormatter={(val) => chartMetric === 'time' ? `${val}s` : `${val}m/s`} 
                    />
                    <RechartsTooltip 
                      contentStyle={{ 
                        backgroundColor: isDark ? '#0f172a' : '#ffffff', 
                        borderColor: isDark ? '#334155' : '#e2e8f0', 
                        borderRadius: '12px', 
                        color: isDark ? '#fff' : '#0f172a', 
                        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                        fontWeight: 'bold' 
                      }} 
                      itemStyle={{ color: '#10b981' }} 
                      labelFormatter={(label) => `Date: ${label}`} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey={(r) => {
                        if (chartMetric === 'time') return parseFloat(r.time);
                        return r.velocity ? parseFloat(r.velocity) : parseFloat(r.distance || 40) * (1 / parseFloat(r.time));
                      }} 
                      stroke={chartMetric === 'time' ? "#10b981" : "#0284c7"} 
                      strokeWidth={3} 
                      dot={{ r: 5, fill: isDark ? '#0f172a' : '#ffffff', stroke: chartMetric === 'time' ? '#10b981' : '#0284c7', strokeWidth: 2 }} 
                      activeDot={{ r: 7 }} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400 dark:text-slate-500 font-medium text-xs">
                  Not enough historical data recorded yet.
                </div>
              )}
            </div>
          </div>

          {/* Official Pro Athlete Bio-Report Showcase Card */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border border-emerald-500/30 rounded-3xl p-6 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="flex items-center gap-4 z-10">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-black flex items-center justify-center font-black text-2xl shadow-lg shadow-emerald-500/30 shrink-0">
                <FileText size={28} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 uppercase">
                    PRO SCOUTING EXPORT
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">3-PAGE EXECUTIVE DOSSIER</span>
                </div>
                <h3 className="text-xl font-black text-white mt-1">
                  Pro Athlete Comprehensive Bio-Report Card
                </h3>
                <p className="text-xs text-slate-400 max-w-xl mt-1 leading-relaxed">
                  Exports an executive publication-grade 3-page PDF containing complete Athlete Bio & Anthropometry, Personal Records (PRs), Horizontal Force-Velocity-Power (FVP) Curve (F0, V0, Pmax, Rf), Kinematics Radar Chart (GCT, Stride Frequency, Trunk Lean, Shin Angle), and Combine Certification.
                </p>
              </div>
            </div>

            <div className="z-10 w-full md:w-auto shrink-0 flex flex-col items-center gap-2">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                onClick={handleGenerateAthleteBioReport}
                disabled={isGeneratingBioReport}
                className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 hover:from-emerald-400 hover:via-teal-300 hover:to-cyan-300 text-black font-black text-sm uppercase tracking-wider rounded-2xl transition shadow-xl shadow-emerald-500/30 flex items-center justify-center gap-2.5 active:scale-95 disabled:opacity-50"
              >
                {isGeneratingBioReport ? (
                  <>
                    <Loader2 size={18} className="animate-spin text-black" />
                    <span>{bioReportStatus || 'Generating Report...'}</span>
                  </>
                ) : (
                  <>
                    <Award size={18} />
                    <span>Generate Athlete Bio-Report</span>
                  </>
                )}
              </motion.button>
              <span className="text-[10px] font-mono text-slate-500 text-center">
                Format: Official Multi-Page A4 PDF • 300 DPI High-Res
              </span>
            </div>
          </div>

        </div>
      </motion.div>
    </motion.div>
  );
}
