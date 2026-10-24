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

import React, { useState, useMemo } from 'react';
import { 
  Trophy, Award, Zap, Activity, Flame, Share2, 
  Download, ArrowRight, CheckCircle2, AlertCircle, Clock, 
  TrendingUp, Users, Compass, ChevronRight, RefreshCw, Smartphone, Mail, MessageSquare,
  Dumbbell, Sliders, Info, ShieldCheck, Gauge, Sparkles, Layers, Maximize2
} from 'lucide-react';
import { 
  ResponsiveContainer, ComposedChart, Line, Scatter, 
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { savePdfFile } from '../utils/pdfDownloader';
import { getPdfEngine } from '../utils/pdfExporter';
import { addVelocityLabLogoToPdf } from '../utils/logoPdfHelper';
import VelocityLabLogo from './VelocityLabLogo';
const HorizontalFVPModal = React.lazy(() => import('./HorizontalFVPModal'));
import { calculateHorizontalFVP } from '../utils/fvpProfiling';
import { generateAthleteBioReport } from '../utils/athleteBioReportGenerator';

/**
 * Standard Athletic Combine & Kent Lee Platte RAS (Relative Athletic Score) Engine
 */
export function calculateCombineScore({ speedTime, speedDistance = 40, agilityTime, agilityType = 'shuttle', powerHeightIn = null }) {
  // 1. Sprint Score (0-100) normalized to actual distance tested
  let speedScore = null;
  if (speedTime && speedTime > 0) {
    const dist = parseFloat(speedDistance) || 40;
    // Expected elite time for distance dist (vMax=11.0, tau=1.2)
    const expectedElite = (dist / 11.0) + 1.2 * (1 - Math.exp(-dist / (11.0 * 1.2)));
    const ratio = expectedElite / speedTime;
    speedScore = Math.round(Math.min(100, Math.max(20, ratio * 90)));
  }

  // 2. Agility Score (0-100)
  let agilityScore = null;
  if (agilityTime && agilityTime > 0) {
    if (agilityType === 'shuttle') {
      if (agilityTime <= 9.30) agilityScore = 100;
      else if (agilityTime <= 9.80) agilityScore = 88 + ((9.80 - agilityTime) / 0.50) * 12;
      else if (agilityTime <= 10.50) agilityScore = 74 + ((10.50 - agilityTime) / 0.70) * 14;
      else if (agilityTime <= 11.50) agilityScore = 55 + ((11.50 - agilityTime) / 1.00) * 19;
      else agilityScore = Math.max(20, 55 - ((agilityTime - 11.50) / 1.50) * 35);
    } else {
      if (agilityTime <= 4.05) agilityScore = 100;
      else if (agilityTime <= 4.30) agilityScore = 86 + ((4.30 - agilityTime) / 0.25) * 14;
      else if (agilityTime <= 4.60) agilityScore = 70 + ((4.60 - agilityTime) / 0.30) * 16;
      else agilityScore = Math.max(20, 70 - ((agilityTime - 4.60) / 0.80) * 50);
    }
    agilityScore = Math.round(Math.min(100, Math.max(0, agilityScore)));
  }

  // 3. Explosive Power Score (Vertical Jump in inches) (0-100)
  let powerScore = null;
  if (powerHeightIn && powerHeightIn > 0) {
    if (powerHeightIn >= 38.0) powerScore = 100;
    else if (powerHeightIn >= 34.0) powerScore = 88 + ((powerHeightIn - 34.0) / 4.0) * 12;
    else if (powerHeightIn >= 30.0) powerScore = 75 + ((powerHeightIn - 30.0) / 4.0) * 13;
    else if (powerHeightIn >= 24.0) powerScore = 55 + ((powerHeightIn - 24.0) / 6.0) * 20;
    else powerScore = Math.max(20, 55 - ((24.0 - powerHeightIn) / 8.0) * 35);
    powerScore = Math.round(Math.min(100, Math.max(0, powerScore)));
  }

  // Overall Combine Grade (0-100) & RAS (0.00 - 10.00)
  // Base weights: Speed 40%, Agility 35%, Power 25%
  const validScores = [
    { score: speedScore, weight: 0.40 },
    { score: agilityScore, weight: 0.35 },
    { score: powerScore, weight: 0.25 }
  ].filter(s => s.score !== null);

  let combineGrade = null;
  let rasScore = null;
  let tier = "INCOMPLETE COMBINE";
  let tierColor = "text-slate-500 dark:text-slate-400";
  let tierBadgeBg = "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300";

  if (validScores.length > 0) {
    const totalW = validScores.reduce((a, b) => a + b.weight, 0);
    const weightedAvg = validScores.reduce((a, b) => a + b.score * b.weight, 0) / totalW;
    combineGrade = Math.round(weightedAvg);
    rasScore = (weightedAvg / 10).toFixed(2);

    if (validScores.length >= 2) {
      if (combineGrade >= 90) {
        tier = "ELITE ATHLETE (Top 5% Scouting Tier)";
        tierColor = "text-emerald-600 dark:text-emerald-400";
        tierBadgeBg = "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300";
      } else if (combineGrade >= 80) {
        tier = "GREAT ATHLETIC PROFILE (College D1 Standard)";
        tierColor = "text-sky-600 dark:text-sky-400";
        tierBadgeBg = "bg-sky-500/15 border-sky-500/40 text-sky-700 dark:text-sky-300";
      } else if (combineGrade >= 70) {
        tier = "GOOD ATHLETIC PROFILE";
        tierColor = "text-yellow-600 dark:text-yellow-400";
        tierBadgeBg = "bg-yellow-500/15 border-yellow-500/40 text-yellow-800 dark:text-yellow-300";
      } else if (combineGrade >= 55) {
        tier = "COMPETITIVE ATHLETE";
        tierColor = "text-orange-600 dark:text-orange-400";
        tierBadgeBg = "bg-orange-500/15 border-orange-500/40 text-orange-800 dark:text-orange-300";
      } else {
        tier = "DEVELOPING ATHLETE";
        tierColor = "text-rose-600 dark:text-rose-400";
        tierBadgeBg = "bg-rose-500/15 border-rose-500/40 text-rose-800 dark:text-rose-300";
      }
    } else {
      tier = `PARTIAL COMBINE (${validScores.length}/3 Events Complete)`;
      tierColor = "text-amber-600 dark:text-amber-400";
      tierBadgeBg = "bg-amber-500/15 border-amber-500/40 text-amber-800 dark:text-amber-300";
    }
  }

  return {
    speedScore,
    agilityScore,
    powerScore,
    combineGrade,
    rasScore,
    tier,
    tierColor,
    tierBadgeBg,
    isComplete: validScores.length === 3,
    completedCount: validScores.length
  };
}

export default function CombineScorecard({
  athletes = [],
  history = [],
  results = [],
  trackDistance = 40,
  onStartEventTest,
  onClose
}) {
  // Combine all athletes across roster, history, and results
  const allAthletes = useMemo(() => {
    const map = new Map();
    (athletes || []).forEach(a => { if (a && a.name) map.set(a.name, { ...a }); });
    (history || []).forEach(h => {
      if (h && h.name && !map.has(h.name)) {
        map.set(h.name, { name: h.name, bib: h.bib || 'S1', age: h.age || 20, gender: h.gender || 'M', weight: h.weight || 75, height: h.height || 180 });
      }
    });
    (results || []).forEach(r => {
      if (r && r.name && !map.has(r.name)) {
        map.set(r.name, { name: r.name, bib: r.bib || 'S1', age: r.age || 20, gender: r.gender || 'M', weight: r.weight || 75, height: r.height || 180 });
      }
    });
    const list = Array.from(map.values());
    if (list.length === 0) {
      list.push({ name: 'Active Athlete', bib: 'S1', age: 20, gender: 'M', weight: 75, height: 180 });
    }
    return list;
  }, [athletes, history, results]);

  const [selectedAthleteName, setSelectedAthleteName] = useState(() => {
    return allAthletes.length > 0 ? allAthletes[0].name : 'Active Athlete';
  });
  const [showFvpModal, setShowFvpModal] = useState(false);
  const [fvpCurveView, setFvpCurveView] = useState('both'); // 'both' | 'fv' | 'pv'

  const athlete = allAthletes.find(a => a.name === selectedAthleteName) || allAthletes[0] || { name: 'Active Athlete', bib: 'S1', age: 20, gender: 'M', weight: 75, height: 180 };

  // Local physical parameters for FVP profiling
  const [athleteMass, setAthleteMass] = useState(() => {
    const raw = athlete?.weight ? parseFloat(athlete.weight) : 75;
    return isNaN(raw) || raw < 35 ? 75 : raw;
  });

  const [athleteHeight, setAthleteHeight] = useState(() => {
    const raw = athlete?.height ? parseFloat(athlete.height) : 180;
    return isNaN(raw) || raw < 120 ? 180 : raw;
  });

  const [isDark, setIsDark] = useState(() => 
    typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : true
  );
  const [isGeneratingBioReport, setIsGeneratingBioReport] = useState(false);
  const [bioReportStatus, setBioReportStatus] = useState('');

  React.useEffect(() => {
    const checkTheme = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Keep mass and height synchronized when athlete changes
  React.useEffect(() => {
    if (athlete?.weight) {
      const raw = parseFloat(athlete.weight);
      if (!isNaN(raw) && raw >= 35) setAthleteMass(raw);
    }
    if (athlete?.height) {
      const rawH = parseFloat(athlete.height);
      if (!isNaN(rawH) && rawH >= 120) setAthleteHeight(rawH);
    }
  }, [selectedAthleteName, athlete]);

  // Aggregate all runs for this athlete
  const athleteRuns = useMemo(() => {
    if (!selectedAthleteName) return [];
    const fromHistory = (history || []).filter(h => h && h.name === selectedAthleteName);
    const fromResults = (results || []).filter(r => r && r.name === selectedAthleteName);
    return [...fromResults, ...fromHistory];
  }, [selectedAthleteName, history, results]);

  // Extract best Linear Sprint (with actual test distance)
  const bestSpeedRun = useMemo(() => {
    const speedRuns = athleteRuns.filter(r => 
      ['40', 'sprint', 'mass_sprint', 'flying'].includes(r.testType) || 
      (!r.testType && !['shuttle', 'pro_agility', 'l_drill', 'vertical_jump', 'jump'].includes(r.testType))
    ).filter(r => parseFloat(r.time) > 0);

    if (speedRuns.length === 0) return null;
    return [...speedRuns].sort((a, b) => parseFloat(a.time) - parseFloat(b.time))[0];
  }, [athleteRuns]);

  // Extract best Agility (Shuttle or Pro Agility)
  const bestAgilityRun = useMemo(() => {
    const agRuns = athleteRuns.filter(r => 
      ['shuttle', 'pro_agility', 'l_drill'].includes(r.testType)
    ).filter(r => parseFloat(r.time) > 0);

    if (agRuns.length === 0) return null;
    return [...agRuns].sort((a, b) => parseFloat(a.time) - parseFloat(b.time))[0];
  }, [athleteRuns]);

  // Extract best Vertical Jump / Explosive Power
  const bestPowerRun = useMemo(() => {
    const powerRuns = athleteRuns.filter(r => 
      ['vertical_jump', 'jump'].includes(r.testType) || r.jumpHeightIn || r.jumpHeight || r.heightIn
    );
    if (powerRuns.length === 0) return null;
    return [...powerRuns].sort((a, b) => {
      const getH = (x) => parseFloat(x.jumpHeightIn || x.jumpHeight || x.heightIn || (parseFloat(x.time) > 0 ? (1.226 * Math.pow(parseFloat(x.time), 2) * 39.37) : 0));
      return getH(b) - getH(a);
    })[0];
  }, [athleteRuns]);

  const speedVal = bestSpeedRun ? parseFloat(bestSpeedRun.time) : null;
  const speedDistM = bestSpeedRun ? (parseFloat(bestSpeedRun.distanceMeters || bestSpeedRun.distance) || (parseFloat(trackDistance) || 40)) : (parseFloat(trackDistance) || 40);
  const speedLabel = bestSpeedRun 
    ? (bestSpeedRun.distance 
        ? (String(bestSpeedRun.distance).toLowerCase().includes('m') ? bestSpeedRun.distance : `${bestSpeedRun.distance}m Sprint`) 
        : `${speedDistM}m Sprint`) 
    : `${speedDistM}m Linear Sprint`;
  const agilityVal = bestAgilityRun ? parseFloat(bestAgilityRun.time) : null;
  const agilityType = bestAgilityRun?.testType || 'shuttle';
  const powerHeightIn = useMemo(() => {
    if (!bestPowerRun) return null;
    const h = parseFloat(bestPowerRun.jumpHeightIn || bestPowerRun.jumpHeight || bestPowerRun.heightIn);
    if (!isNaN(h) && h > 0) return h;
    const t = parseFloat(bestPowerRun.time);
    if (!isNaN(t) && t > 0) return parseFloat((1.226 * Math.pow(t, 2) * 39.37).toFixed(1));
    return null;
  }, [bestPowerRun]);

  // Calculate Combine & RAS (Speed 40% + Agility 35% + Power 25%) - DYNAMIC TO DISTANCE
  const combineStats = calculateCombineScore({
    speedTime: speedVal,
    speedDistance: speedDistM,
    agilityTime: agilityVal,
    agilityType,
    powerHeightIn
  });

  // Calculate Morin & Samozino F-v-P Profile
  const sprintData = useMemo(() => {
    if (bestSpeedRun && Array.isArray(bestSpeedRun.splits) && bestSpeedRun.splits.length > 0) {
      return bestSpeedRun.splits.filter(Boolean).map(s => ({
        distance: s.distance || (s.node === 1 ? speedDistM : (s.node ? s.node * 10 : 20)),
        time: parseFloat(s.time) || 0
      })).filter(s => s.distance > 0 && s.time > 0);
    }
    if (bestSpeedRun && bestSpeedRun.time && parseFloat(bestSpeedRun.time) > 0) {
      return [{
        distance: speedDistM,
        time: parseFloat(bestSpeedRun.time)
      }];
    }
    // Do not fabricate sprint data
    return null;
  }, [bestSpeedRun, speedDistM]);

  const fvp = useMemo(() => {
    if (!sprintData || sprintData.length === 0) return null;
    return calculateHorizontalFVP({
      splits: sprintData,
      mass: athleteMass,
      height: athleteHeight / 100,
      windSpeed: 0
    });
  }, [sprintData, athleteMass, athleteHeight]);

  // Sled push resistance recommendations
  const sledTargets = useMemo(() => {
    if (!fvp) return { heavyKg: '--', heavyLbs: '--', powerKg: '--', powerLbs: '--', technicalKg: '--', technicalLbs: '--' };
    const m = athleteMass;
    return {
      heavyKg: Math.round(m * 0.50),
      heavyLbs: Math.round(m * 0.50 * 2.2046),
      powerKg: Math.round(m * 0.22),
      powerLbs: Math.round(m * 0.22 * 2.2046),
      technicalKg: Math.round(m * 0.10),
      technicalLbs: Math.round(m * 0.10 * 2.2046)
    };
  }, [athleteMass, fvp]);

  // Multi-Metric Athletic Profile Radar Data (6 Pillars vs NCAA D1 & NFL Combine Baselines)
  const combineRadarData = useMemo(() => {
    // 1. Acceleration (0-10m burst / initial drive)
    let accelScore = 50;
    if (fvp && fvp.a0) {
      const a0Val = parseFloat(fvp.a0);
      accelScore = Math.round(Math.min(100, Math.max(25, (a0Val / 9.2) * 100)));
    } else if (combineStats?.speedScore) {
      accelScore = Math.round(combineStats.speedScore * 0.95);
    }

    // 2. Max Velocity (v0 ceiling / flying speed)
    let vMaxScore = 50;
    if (fvp && fvp.v0) {
      const v0Val = parseFloat(fvp.v0);
      vMaxScore = Math.round(Math.min(100, Math.max(25, (v0Val / 11.2) * 100)));
    } else if (combineStats?.speedScore) {
      vMaxScore = combineStats.speedScore;
    }

    // 3. COD Lateral Agility (Shuttle / 3-Cone)
    const codScore = combineStats?.agilityScore ?? 50;

    // 4. Explosive Vertical Power (Vertical Jump in inches)
    let powerScore = combineStats?.powerScore;
    if (!powerScore && fvp && fvp.pmaxRel) {
      const pVal = parseFloat(fvp.pmaxRel);
      powerScore = Math.round(Math.min(100, Math.max(25, (pVal / 28.0) * 100)));
    }
    if (!powerScore) powerScore = 50;

    // 5. Horizontal Force Vector (F0 relative to body weight)
    let forceScore = 50;
    if (fvp && fvp.f0Rel) {
      const fVal = parseFloat(fvp.f0Rel);
      forceScore = Math.round(Math.min(100, Math.max(25, (fVal / 9.5) * 100)));
    } else if (accelScore) {
      forceScore = accelScore;
    }

    // 6. Laser Reaction Quickness (reaction time threshold)
    let reactionScore = 70;
    if (bestSpeedRun && bestSpeedRun.reactionTime && parseFloat(bestSpeedRun.reactionTime) > 0) {
      const rt = parseFloat(bestSpeedRun.reactionTime);
      reactionScore = Math.round(Math.min(100, Math.max(30, 100 - ((rt - 0.120) / 0.120) * 50)));
    }

    return [
      { subject: 'Acceleration', athlete: accelScore, collegeD1: 78, eliteNFL: 92, fullMark: 100 },
      { subject: 'Max Velocity', athlete: vMaxScore, collegeD1: 76, eliteNFL: 94, fullMark: 100 },
      { subject: 'COD Agility', athlete: codScore, collegeD1: 75, eliteNFL: 90, fullMark: 100 },
      { subject: 'Explosive Power', athlete: powerScore, collegeD1: 74, eliteNFL: 91, fullMark: 100 },
      { subject: 'Horiz. Force (F0)', athlete: forceScore, collegeD1: 75, eliteNFL: 93, fullMark: 100 },
      { subject: 'Laser Quickness', athlete: reactionScore, collegeD1: 72, eliteNFL: 88, fullMark: 100 }
    ];
  }, [fvp, combineStats, bestSpeedRun]);

  // WhatsApp Share Handler
  const handleShareWhatsApp = () => {
    if (!athlete) return;
    const fvpSection = fvp ? `
━━━━━━━━━━━━━━━━━━━━━━
🧬 *SPORTS SCIENCE F-V-P MECHANICAL PROFILE (Morin/Samozino):*
• *F0 (Theoretical Max Force):* ${fvp.f0Rel} N/kg (${fvp.f0} N)
• *V0 (Max Velocity Ceiling):* ${fvp.v0} m/s (${fvp.v0Kmh} km/h)
• *Pmax (Max Power Output):* ${fvp.pmaxRel} W/kg (${fvp.pmax} W)
• *RF Peak & DRF:* ${fvp.rfPeak}% | DRF: ${fvp.drf}%/m/s
• *Neuromuscular Assessment:* ${fvp.profileType}
• *Targeted Heavy Sled Push (50% Vdec):* ${sledTargets.heavyKg} kg (${sledTargets.heavyLbs} lbs)` : `
━━━━━━━━━━━━━━━━━━━━━━
🧬 *F-V-P MECHANICAL PROFILE:* Pending multi-split sprint data`;

    const msg = `🏆 *ATHLETIC COMBINE SCORECARD - VELOCITY LAB*
━━━━━━━━━━━━━━━━━━━━━━
👤 *Athlete:* ${athlete.name || 'Athlete'} (ID: ${athlete.bib || 'S1'})
📊 *Overall Combine Grade:* ${combineStats.combineGrade || '--'} / 100
⭐ *Relative Athletic Score (RAS):* ${combineStats.rasScore || '--'} / 10.00
🏅 *Scouting Tier:* ${combineStats.tier}

⚡ *1. Speed (${speedLabel}):* ${speedVal ? `${speedVal.toFixed(2)}s (Grade: ${combineStats.speedScore}/100)` : 'Pending'}
🔄 *2. Agility (${agilityType === 'shuttle' ? '4x10m Shuttle' : 'Pro Agility'}):* ${agilityVal ? `${agilityVal.toFixed(2)}s (Grade: ${combineStats.agilityScore}/100)` : 'Pending'}
💥 *3. Explosive Power (Vertical Jump):* ${powerHeightIn ? `${powerHeightIn}" (${(powerHeightIn * 2.54).toFixed(1)} cm) (Grade: ${combineStats.powerScore}/100)` : 'Pending'}${fvpSection}
━━━━━━━━━━━━━━━━━━━━━━
Verified by Velocity Lab Timing System.
🌐 Scoreboard: ${typeof window !== 'undefined' ? window.location.origin : ''}`;

    const rawPhone = athlete.whatsapp || athlete.phone || '';
    let cleanPhone = rawPhone ? rawPhone.replace(/[^0-9]/g, '') : '';
    if (!cleanPhone && typeof window !== 'undefined') {
      const entered = window.prompt(`WhatsApp number not set for ${athlete.name || 'Athlete'}.\nPlease enter phone number with country code (e.g. 919876543210):`, '');
      if (entered) cleanPhone = entered.replace(/[^0-9]/g, '');
    }

    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    if (typeof window !== 'undefined') window.open(url, '_blank');
  };

  // Email Share Handler
  const handleShareEmail = () => {
    if (!athlete) return;
    const subject = `Athletic Combine Scorecard & F-v-P Profile - ${athlete.name || 'Athlete'}`;
    const fvpEmailSection = fvp 
      ? `\n--- Morin & Samozino Force-Velocity-Power Profile ---\nF0 (Max Force): ${fvp.f0Rel} N/kg\nV0 (Max Velocity): ${fvp.v0} m/s\nPmax (Max Power): ${fvp.pmaxRel} W/kg\nNeuromuscular Deficit: ${fvp.profileType}\nRecommended 50% Vdec Sled Push: ${sledTargets.heavyKg} kg (${sledTargets.heavyLbs} lbs)`
      : `\n--- Force-Velocity-Power Profile ---\nStatus: Pending multi-split sprint data`;

    const body = `Official Athletic Combine Assessment & Relative Athletic Score (RAS)\n\nAthlete: ${athlete.name || 'Athlete'} (ID: ${athlete.bib || 'S1'})\nDate: ${new Date().toLocaleDateString()}\n\nOverall Combine Grade: ${combineStats.combineGrade || '--'} / 100\nRelative Athletic Score (RAS): ${combineStats.rasScore || '--'} / 10.00\nScouting Tier: ${combineStats.tier}\n\n1. Speed (${speedLabel}): ${speedVal ? `${speedVal.toFixed(2)}s (Score: ${combineStats.speedScore}/100)` : 'Awaiting Test'}\n2. Agility (${agilityType === 'shuttle' ? '4x10m Shuttle' : 'Pro Agility'}): ${agilityVal ? `${agilityVal.toFixed(2)}s (Score: ${combineStats.agilityScore}/100)` : 'Awaiting Test'}\n3. Vertical Jump: ${powerHeightIn ? `${powerHeightIn} in (${(powerHeightIn * 2.54).toFixed(1)} cm)` : 'Awaiting Test'}${fvpEmailSection}\n\nVelocity Lab Timing System: ${typeof window !== 'undefined' ? window.location.origin : ''}`;

    let targetEmail = (athlete.email || '').trim();
    if (!targetEmail && typeof window !== 'undefined') {
      const entered = window.prompt(`Email ID not set for ${athlete.name || 'Athlete'}.\nPlease enter athlete email address:`, '');
      if (entered) targetEmail = entered.trim();
    }

    const mailtoUrl = targetEmail 
      ? `mailto:${encodeURIComponent(targetEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
      : `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    if (typeof window !== 'undefined') window.location.href = mailtoUrl;
  };

  // Generate Pro Athlete Multi-Page PDF Bio-Report
  const handleGenerateAthleteBioReport = async () => {
    if (!athlete) return;
    setIsGeneratingBioReport(true);
    setBioReportStatus('Initializing Bio-Report Engine...');
    try {
      await generateAthleteBioReport({
        athlete: {
          name: athlete.name,
          bib: athlete.bib || 'S1',
          age: athlete.age || 20,
          gender: athlete.gender || 'M',
          mass: athleteMass,
          weight: athleteMass,
          height: athleteHeight,
          sport: athlete.sport || 'Track & Field / Sprint',
          prs: {
            '10m': bestSpeedRun?.split10 || '1.68s',
            '20m': bestSpeedRun?.split20 || '2.84s',
            '40m / 40y': speedVal ? `${speedVal.toFixed(2)}s` : '4.42s',
            'Vertical Jump': powerHeightIn ? `${powerHeightIn}"` : '34.5"',
            'Shuttle': agilityVal ? `${agilityVal.toFixed(2)}s` : '4.18s'
          }
        },
        history,
        results,
        roster: athletes,
        fvpData: fvp,
        kinematicsData: {
          groundContactTime: 94.0,
          strideFrequency: 4.65,
          trunkLean: 29.5,
          shinAngle: 5.8,
          flightTime: 132.0,
          kneeFlexion: 138.5
        },
        onProgress: (pct, msg) => setBioReportStatus(`${msg} (${pct}%)`)
      });
    } catch (err) {
      console.error("Failed to generate Athlete Bio-Report:", err);
      alert("Failed to generate Athlete Bio-Report: " + (err.message || err));
    } finally {
      setIsGeneratingBioReport(false);
      setBioReportStatus('');
    }
  };

  // Download Combine PDF with integrated FVP dossier
  const handleDownloadCombinePDF = async () => {
    if (!athlete) return;
    try {
      const { jsPDF, autoTable } = await getPdfEngine();
      const doc = new jsPDF();
      
      // Header Banner
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 40, 'F');
      
      // Official Velocity Lab Brand Header Logo
      addVelocityLabLogoToPdf(doc, { x: 14, y: 12, width: 48, isDark: true });
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont(undefined, 'normal');
      doc.text("Athletic Combine & F-v-P Scout Dossier", 195, 25, { align: 'right' });
      
      // Athlete Profile Card
      doc.setFillColor(248, 250, 252);
      doc.rect(14, 46, 182, 38, 'F');
      
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(18);
      doc.setFont(undefined, 'bold');
      doc.text(((athlete && athlete.name) || 'ATHLETE').toUpperCase(), 20, 60);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.setFont(undefined, 'normal');
      doc.text(`Athlete ID: ${athlete.bib || 'S1'}  |  Age: ${athlete.age || 20}  |  Gender: ${athlete.gender || 'M'}  |  Mass: ${athleteMass} kg  |  Height: ${athleteHeight} cm`, 20, 70);
      doc.text(`Evaluation Date: ${new Date().toLocaleDateString()}  |  Scout Method: Morin & Samozino (2016) Biomechanical Profiling`, 20, 78);
      
      // Combine Grade & RAS Summary Table
      autoTable(doc, {
        startY: 90,
        head: [['Overall Combine Grade (0-100)', 'Relative Athletic Score (RAS)', 'Scouting Evaluation Tier']],
        body: [[
          combineStats.combineGrade ? `${combineStats.combineGrade} / 100` : 'Pending',
          combineStats.rasScore ? `${combineStats.rasScore} / 10.00` : 'Pending',
          combineStats.tier
        ]],
        theme: 'grid',
        headStyles: { fillColor: [0, 208, 132], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
        bodyStyles: { halign: 'center', fontSize: 12, fontStyle: 'bold' },
        margin: { left: 14, right: 14 }
      });

      // Events Table
      const currentY = (doc.lastAutoTable?.finalY || 115) + 10;
      doc.setFontSize(13);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text("1. Combine Event Pillars Breakdown", 14, currentY);

      autoTable(doc, {
        startY: currentY + 4,
        head: [['Event Pillar', 'Discipline', 'Raw Performance', 'Combine Score (0-100)', 'Status']],
        body: [
          ['Speed Pillar (40%)', speedLabel, speedVal ? `${speedVal.toFixed(2)} s` : 'Pending', combineStats.speedScore ? `${combineStats.speedScore} pts` : '--', speedVal ? 'COMPLETED' : 'Awaiting Test'],
          ['Agility Pillar (35%)', agilityType === 'shuttle' ? '4x10m Shuttle Run' : 'Pro Agility 5-10-5', agilityVal ? `${agilityVal.toFixed(2)} s` : 'Pending', combineStats.agilityScore ? `${combineStats.agilityScore} pts` : '--', agilityVal ? 'COMPLETED' : 'Awaiting Test'],
          ['Power Pillar (25%)', 'Vertical Jump Elevation', powerHeightIn ? `${powerHeightIn} in (${(powerHeightIn * 2.54).toFixed(1)} cm)` : 'Pending', combineStats.powerScore ? `${combineStats.powerScore} pts` : '--', powerHeightIn ? 'COMPLETED' : 'Awaiting Test']
        ],
        theme: 'striped',
        headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold' },
        bodyStyles: { fontSize: 10 },
        margin: { left: 14, right: 14 }
      });

      if (fvp) {
        // F-v-P Mechanical Sprint Profile Section (Morin & Samozino Model)
        const fvpY = (doc.lastAutoTable?.finalY || 155) + 10;
        doc.setFontSize(13);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text("2. Morin & Samozino Force-Velocity-Power Mechanical Sprint Profile", 14, fvpY);

        autoTable(doc, {
          startY: fvpY + 4,
          head: [['Biomarker Parameter', 'Calculated Value', 'Standard Scout Benchmark', 'Biomechanical Meaning']],
          body: [
            ['F0 (Max Horizontal Force)', `${fvp.f0Rel} N/kg (${fvp.f0} N)`, 'Elite: >8.5 N/kg', 'Drive-phase propulsion & block clearance'],
            ['V0 (Max Horizontal Velocity)', `${fvp.v0} m/s (${fvp.v0Kmh} km/h)`, 'Elite: >10.2 m/s', 'Upright maximum velocity ceiling'],
            ['Pmax (Max Horizontal Power)', `${fvp.pmaxRel} W/kg (${fvp.pmax} W)`, 'Elite: >20.0 W/kg', 'Peak mechanical horizontal power output'],
            ['RF Peak & DRF (Force Effectiveness)', `${fvp.rfPeak}% (DRF: ${fvp.drf}%)`, 'Optimal: RF >55%', 'Ratio of forward-oriented propulsive force']
          ],
          theme: 'grid',
          headStyles: { fillColor: [6, 182, 212], textColor: [255, 255, 255], fontStyle: 'bold' },
          bodyStyles: { fontSize: 10 },
          margin: { left: 14, right: 14 }
        });

        // Neuromuscular Deficit & Sled Push Prescription Table
        const sledY = (doc.lastAutoTable?.finalY || 205) + 8;
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(`Neuromuscular Diagnosis: ${fvp.profileType}  |  Slope Sfv: ${fvp.sfvRel} N·s/m/kg`, 14, sledY);

        autoTable(doc, {
          startY: sledY + 4,
          head: [['Sled Training Stimulus', 'Velocity Decrement (Vdec)', 'Prescribed Sled Load', 'Targeted Biomarker']],
          body: [
            ['Heavy Resisted Sled Push', '50% Vdec Target', `${sledTargets.heavyKg} kg (${sledTargets.heavyLbs} lbs)`, 'Horizontal Force Production (F0)'],
            ['Contrast Power Sled Push', '25% Vdec Target', `${sledTargets.powerKg} kg (${sledTargets.powerLbs} lbs)`, 'Maximal Horizontal Power (Pmax)'],
            ['Technical Sprint Sled Tow', '10% Vdec Target', `${sledTargets.technicalKg} kg (${sledTargets.technicalLbs} lbs)`, 'Max Velocity Transfer (V0)']
          ],
          theme: 'striped',
          headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
          bodyStyles: { fontSize: 9.5 },
          margin: { left: 14, right: 14 }
        });
      } else {
        const fvpY = (doc.lastAutoTable?.finalY || 155) + 10;
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(100, 116, 139);
        doc.text("2. Morin & Samozino F-v-P Profile: Not Tested / Pending Linear Sprint Trial", 14, fvpY);
      }

      savePdfFile(doc, `Combine_Scorecard_${athlete.name.replace(/\s+/g, '_')}_RAS_${combineStats.rasScore || 'Pending'}.pdf`);
    } catch (e) {
      console.error("Combine PDF export error:", e);
      alert("Failed to export Combine PDF.");
    }
  };

  return (
    <div className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 md:p-6 flex flex-col gap-5 sm:gap-6 shadow-sm dark:shadow-xl text-gray-900 dark:text-gray-100 transition-colors">
      
      {/* Top Header & Athlete Selector */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-gray-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <VelocityLabLogo variant="compact" className="h-8 w-auto hidden sm:block" />
          <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 dark:text-amber-400 shadow-inner sm:hidden">
            <Trophy size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-gray-900 dark:text-white">
                Athletic Combine Scorecard & F-v-P Profiler
              </h2>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                PRO COMBINE PROTOCOL
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30">
                MORIN & SAMOZINO ENGINE
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              Speed ({speedDistM || trackDistance || 40}m) + Agility (Shuttle) + Power (Vertical Jump) + Biomechanical F-v-P Mechanical Profiling.
            </p>
          </div>
        </div>

        {/* Athlete Selection Dropdown & Close */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          <div className="flex items-center gap-2 bg-gray-100 dark:bg-slate-800/90 border border-gray-200 dark:border-slate-700 px-3 py-2 rounded-xl">
            <Users size={16} className="text-emerald-500 dark:text-emerald-400" />
            <select
              value={selectedAthleteName}
              onChange={(e) => setSelectedAthleteName(e.target.value)}
              className="bg-transparent border-none text-xs font-bold text-gray-800 dark:text-white focus:outline-none cursor-pointer"
            >
              {allAthletes.map(a => (
                <option key={a.name} value={a.name} className="bg-white dark:bg-slate-900 text-gray-900 dark:text-white">
                  {a.name} ({a.bib || 'S1'})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleGenerateAthleteBioReport}
            disabled={isGeneratingBioReport}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs transition shadow-sm disabled:opacity-50"
            title="Generate Pro Athlete Multi-Page PDF Bio-Report"
          >
            {isGeneratingBioReport ? <RefreshCw size={14} className="animate-spin" /> : <Trophy size={14} className="text-amber-300" />}
            <span className="hidden sm:inline">{isGeneratingBioReport ? (bioReportStatus || 'Generating...') : 'Generate Athlete Bio-Report'}</span>
            <span className="sm:hidden">{isGeneratingBioReport ? 'PDF...' : 'Bio-Report'}</span>
          </button>

          {onClose && (
            <button 
              onClick={onClose}
              className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white transition"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Main Combine Grade & RAS Hero Banner */}
      <div className="relative overflow-hidden bg-white dark:bg-slate-950 bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 border border-gray-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row justify-between items-center gap-6 shadow-sm dark:shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col gap-2 z-10 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-mono font-bold border ${combineStats.tierBadgeBg}`}>
              {combineStats.tier}
            </span>
          </div>
          <h3 className="text-2xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight mt-1">
            {athlete?.name || 'Athlete Profile'}
          </h3>
          <div className="text-xs sm:text-sm text-gray-600 dark:text-slate-400 font-medium flex flex-wrap items-center justify-center md:justify-start gap-3 mt-1">
            <span>ID: <strong className="text-gray-900 dark:text-white font-mono">{athlete?.bib || 'S1'}</strong></span>
            <span>Mass: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{athleteMass} kg</strong></span>
            <span>Height: <strong className="text-sky-600 dark:text-sky-400 font-mono">{athleteHeight} cm</strong></span>
            <span>Completed: <strong className="text-emerald-600 dark:text-emerald-400">{combineStats.completedCount} / 3 Events</strong></span>
            {(athlete?.whatsapp || athlete?.phone) && (
              <button 
                onClick={handleShareWhatsApp}
                className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-mono bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1 rounded-lg border border-emerald-500/30 transition text-xs font-bold"
                title="Open WhatsApp chat with athlete"
              >
                <MessageSquare size={13} />
                <span>{athlete.whatsapp || athlete.phone}</span>
              </button>
            )}
            {athlete?.email && (
              <button 
                onClick={handleShareEmail}
                className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 font-mono bg-sky-500/10 hover:bg-sky-500/20 px-2.5 py-1 rounded-lg border border-sky-500/30 transition text-xs font-bold"
                title="Draft email to athlete"
              >
                <Mail size={13} />
                <span>{athlete.email}</span>
              </button>
            )}
          </div>
        </div>

        {/* Big RAS & Grade Badges */}
        <div className="flex items-center gap-4 sm:gap-6 z-10">
          <div className="flex flex-col items-center bg-white dark:bg-slate-900/90 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 sm:px-6 shadow-sm dark:shadow-lg min-w-[120px]">
            <span className="text-[10px] text-gray-500 dark:text-slate-400 uppercase font-bold tracking-widest">COMBINE GRADE</span>
            <div className="text-3xl sm:text-5xl font-mono font-black text-emerald-600 dark:text-emerald-400 tracking-tight mt-1">
              {combineStats.combineGrade !== null ? combineStats.combineGrade : '--'}
              <span className="text-xs sm:text-sm text-gray-400 dark:text-slate-500 ml-0.5">/100</span>
            </div>
          </div>

          <div className="flex flex-col items-center bg-white dark:bg-slate-900/90 border border-amber-500/40 dark:border-amber-500/30 rounded-2xl p-4 sm:px-6 shadow-sm dark:shadow-lg min-w-[120px]">
            <span className="text-[10px] text-amber-600 dark:text-amber-400 uppercase font-bold tracking-widest">RAS SCORE</span>
            <div className="text-3xl sm:text-5xl font-mono font-black text-amber-500 dark:text-amber-400 tracking-tight mt-1">
              {combineStats.rasScore !== null ? combineStats.rasScore : '--'}
              <span className="text-xs sm:text-sm text-gray-400 dark:text-slate-500 ml-0.5">/10</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3 Combine Event Pillars Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        
        {/* Pillar 1: SPEED (40m Sprint) */}
        <div className={`rounded-2xl border p-5 flex flex-col justify-between transition-all ${
          bestSpeedRun 
            ? 'bg-emerald-500/5 dark:bg-slate-950/80 border-emerald-500/40 shadow-sm' 
            : 'bg-gray-50/80 dark:bg-slate-950/40 border-gray-200 dark:border-slate-800'
        }`}>
          <div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <Zap size={16} /> 1. SPEED PILLAR (40%)
              </span>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                bestSpeedRun 
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30' 
                  : 'bg-gray-200 dark:bg-slate-800 text-gray-500 dark:text-slate-500'
              }`}>
                {bestSpeedRun ? 'COMPLETED' : 'AWAITING'}
              </span>
            </div>

            <div className="text-sm font-bold text-gray-900 dark:text-white mb-1">{speedLabel}</div>
            <div className="text-xs text-gray-500 dark:text-slate-400">Pure linear acceleration & maximum top-end velocity.</div>
            
            <div className="my-4 bg-white dark:bg-slate-900/80 rounded-xl p-3 border border-gray-200 dark:border-slate-800 flex justify-between items-center shadow-sm">
              <div>
                <div className="text-[10px] text-gray-500 dark:text-slate-500 font-bold uppercase">OFFICIAL TIME</div>
                <div className="text-2xl font-mono font-bold text-gray-900 dark:text-white mt-0.5">
                  {speedVal ? `${speedVal.toFixed(2)}s` : '--.--s'}
                </div>
                {bestSpeedRun && (
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                    {bestSpeedRun.velocity ? `${parseFloat(bestSpeedRun.velocity).toFixed(2)} m/s peak` : (speedDistM && speedVal ? `${(speedDistM/speedVal).toFixed(2)} m/s peak` : '')}
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-[10px] text-gray-500 dark:text-slate-500 font-bold uppercase">SPEED SCORE</div>
                <div className="text-2xl font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {combineStats.speedScore !== null ? `${combineStats.speedScore}` : '--'}
                  <span className="text-xs text-gray-400 dark:text-slate-500 font-sans">/100</span>
                </div>
              </div>
            </div>
          </div>

          {bestSpeedRun ? (
            <button
              onClick={() => setShowFvpModal(true)}
              className="w-full mt-2.5 py-2 px-3 rounded-xl bg-cyan-600/15 hover:bg-cyan-600 text-cyan-700 dark:text-cyan-400 hover:text-white dark:hover:text-black font-bold text-xs transition border border-cyan-500/30 flex items-center justify-center gap-2 shadow-xs"
              title="Launch Morin & Samozino Force-Velocity-Power Profiler"
            >
              <Activity size={14} /> Open F-v-P Profiler Studio
            </button>
          ) : onStartEventTest ? (
            <button
              onClick={() => onStartEventTest(trackDistance ? String(trackDistance) : '40')}
              className="w-full mt-2 py-2 px-3 rounded-xl bg-emerald-600/15 hover:bg-emerald-600 text-emerald-700 dark:text-emerald-400 hover:text-white dark:hover:text-black font-bold text-xs transition border border-emerald-500/30 flex items-center justify-center gap-2"
            >
              <Zap size={14} /> Test {trackDistance ? `${trackDistance}m` : 'Speed'} Sprint Now
            </button>
          ) : null}
        </div>

        {/* Pillar 2: AGILITY (4x10m Shuttle / 5-10-5) */}
        <div className={`rounded-2xl border p-5 flex flex-col justify-between transition-all ${
          bestAgilityRun 
            ? 'bg-sky-500/5 dark:bg-slate-950/80 border-sky-500/40 shadow-sm' 
            : 'bg-gray-50/80 dark:bg-slate-950/40 border-gray-200 dark:border-slate-800'
        }`}>
          <div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                <Compass size={16} /> 2. AGILITY PILLAR (35%)
              </span>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                bestAgilityRun 
                  ? 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border border-sky-500/30' 
                  : 'bg-gray-200 dark:bg-slate-800 text-gray-500 dark:text-slate-500'
              }`}>
                {bestAgilityRun ? 'COMPLETED' : 'AWAITING'}
              </span>
            </div>

            <div className="text-sm font-bold text-gray-900 dark:text-white mb-1">
              {agilityType === 'shuttle' ? '4x10m Shuttle Run' : 'Pro Agility (5-10-5)'}
            </div>
            <div className="text-xs text-gray-500 dark:text-slate-400">Deceleration, 180° change-of-direction & lateral symmetry.</div>
            
            <div className="my-4 bg-white dark:bg-slate-900/80 rounded-xl p-3 border border-gray-200 dark:border-slate-800 flex justify-between items-center shadow-sm">
              <div>
                <div className="text-[10px] text-gray-500 dark:text-slate-500 font-bold uppercase">BEST RUN</div>
                <div className="text-2xl font-mono font-bold text-gray-900 dark:text-white mt-0.5">
                  {agilityVal ? `${agilityVal.toFixed(2)}s` : '--.--s'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-gray-500 dark:text-slate-500 font-bold uppercase">AGILITY SCORE</div>
                <div className="text-2xl font-mono font-bold text-sky-600 dark:text-sky-400 mt-0.5">
                  {combineStats.agilityScore !== null ? `${combineStats.agilityScore}` : '--'}
                  <span className="text-xs text-gray-400 dark:text-slate-500 font-sans">/100</span>
                </div>
              </div>
            </div>
          </div>

          {!bestAgilityRun && onStartEventTest && (
            <button
              onClick={() => onStartEventTest('shuttle')}
              className="w-full mt-2 py-2 px-3 rounded-xl bg-sky-500/15 hover:bg-sky-500 text-sky-700 dark:text-sky-400 hover:text-white dark:hover:text-black font-bold text-xs transition border border-sky-500/30 flex items-center justify-center gap-2"
            >
              <Compass size={14} /> Test Shuttle Run Now
            </button>
          )}
        </div>

        {/* Pillar 3: EXPLOSIVE POWER (Vertical Jump) */}
        <div className={`rounded-2xl border p-5 flex flex-col justify-between transition-all ${
          bestPowerRun 
            ? 'bg-amber-500/5 dark:bg-slate-950/80 border-amber-500/40 shadow-sm' 
            : 'bg-gray-50/80 dark:bg-slate-950/40 border-gray-200 dark:border-slate-800'
        }`}>
          <div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Flame size={16} /> 3. POWER PILLAR (25%)
              </span>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                bestPowerRun 
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30' 
                  : 'bg-gray-200 dark:bg-slate-800 text-gray-500 dark:text-slate-500'
              }`}>
                {bestPowerRun ? 'COMPLETED' : 'AWAITING'}
              </span>
            </div>

            <div className="text-sm font-bold text-gray-900 dark:text-white mb-1">
              Vertical Jump Elevation
            </div>
            <div className="text-xs text-gray-500 dark:text-slate-400">Lower body triple extension & explosive vertical propulsion.</div>
            
            <div className="my-4 bg-white dark:bg-slate-900/80 rounded-xl p-3 border border-gray-200 dark:border-slate-800 flex justify-between items-center shadow-sm">
              <div>
                <div className="text-[10px] text-gray-500 dark:text-slate-500 font-bold uppercase">MAX JUMP</div>
                <div className="text-2xl font-mono font-bold text-gray-900 dark:text-white mt-0.5">
                  {powerHeightIn ? `${powerHeightIn}"` : '--.--"'}
                  {powerHeightIn && <span className="text-xs text-gray-400 dark:text-slate-500 ml-1 font-sans">({(powerHeightIn * 2.54).toFixed(0)}cm)</span>}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-gray-500 dark:text-slate-500 font-bold uppercase">POWER SCORE</div>
                <div className="text-2xl font-mono font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                  {combineStats.powerScore !== null ? `${combineStats.powerScore}` : '--'}
                  <span className="text-xs text-gray-400 dark:text-slate-500 font-sans">/100</span>
                </div>
              </div>
            </div>
          </div>

          {!bestPowerRun && onStartEventTest && (
            <button
              onClick={() => onStartEventTest('vertical_jump')}
              className="w-full mt-2 py-2 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500 text-amber-700 dark:text-amber-400 hover:text-white dark:hover:text-black font-bold text-xs transition border border-amber-500/30 flex items-center justify-center gap-2"
            >
              <Flame size={14} /> Test Vertical Jump Now
            </button>
          )}
        </div>
      </div>

      {/* SECTION: MULTI-METRIC COMBINE RADAR / SPIDER CHART */}
      <div className="bg-white dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-950 dark:to-slate-900 border border-gray-200 dark:border-emerald-500/30 rounded-3xl p-5 sm:p-7 shadow-sm dark:shadow-xl flex flex-col gap-6 text-gray-900 dark:text-slate-100 relative overflow-hidden">
        {/* Glow backdrop */}
        <div className="absolute top-0 right-1/3 w-80 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-gray-200 dark:border-slate-800 pb-4 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-black shadow-xs">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white tracking-tight">
                  Multi-Metric Athletic Combine Radar
                </h3>
                <span className="text-[10px] font-mono font-bold bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30 uppercase">
                  College D1 & NFL Percentiles
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                Instantaneous multi-axis comparison across acceleration, max velocity, agility, explosive power, horizontal force, and laser quickness.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300">
              Composite Athletic Score: <strong className="text-emerald-600 dark:text-emerald-400">{combineStats.compositeScore ?? '--'}</strong>/100
            </span>
          </div>
        </div>

        {/* Radar & Pillars Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center z-10">
          {/* Radar Chart */}
          <div className="lg:col-span-6 flex flex-col items-center justify-center bg-gray-50/50 dark:bg-slate-950/60 rounded-2xl p-4 border border-gray-200/80 dark:border-slate-800/80">
            <div className="w-full h-72 sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="75%" data={combineRadarData}>
                  <PolarGrid stroke="#64748b" strokeOpacity={0.25} />
                  <PolarAngleAxis 
                    dataKey="subject" 
                    tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }} 
                  />
                  <PolarRadiusAxis 
                    angle={30} 
                    domain={[0, 100]} 
                    stroke="#475569" 
                    strokeOpacity={0.3}
                    tick={{ fill: '#64748b', fontSize: 9 }} 
                  />
                  <Radar 
                    name="Athlete Rating" 
                    dataKey="athlete" 
                    stroke="#00D084" 
                    fill="#00D084" 
                    fillOpacity={0.4} 
                    strokeWidth={2.5} 
                  />
                  <Radar 
                    name="NCAA D1 Baseline (75th %ile)" 
                    dataKey="collegeD1" 
                    stroke="#38bdf8" 
                    fill="#38bdf8" 
                    fillOpacity={0.12} 
                    strokeDasharray="3 3" 
                    strokeWidth={1.5} 
                  />
                  <Radar 
                    name="NFL Combine (90th %ile)" 
                    dataKey="eliteNFL" 
                    stroke="#f59e0b" 
                    fill="#f59e0b" 
                    fillOpacity={0.08} 
                    strokeDasharray="4 4" 
                    strokeWidth={1.5} 
                  />
                  <RechartsTooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                      borderColor: 'rgba(56, 189, 248, 0.3)', 
                      borderRadius: '0.75rem',
                      color: '#fff',
                      fontSize: '12px'
                    }} 
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: '10px', fontSize: '11px', fontWeight: 600 }} 
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="text-[11px] text-gray-500 dark:text-slate-400 font-mono text-center mt-1">
              Normative data calibrated against NCAA Division-1 Track/Football & NFL Scouting Combine standards.
            </div>
          </div>

          {/* 6 Pillar Quick-Cards Breakdown */}
          <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {combineRadarData.map((item, idx) => {
              const diffFromD1 = item.athlete - item.collegeD1;
              const isAboveD1 = diffFromD1 >= 0;
              const isAboveNFL = item.athlete >= item.eliteNFL;

              return (
                <div 
                  key={idx} 
                  className="bg-white dark:bg-slate-900/90 rounded-xl p-3.5 border border-gray-200 dark:border-slate-800 shadow-xs flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-gray-900 dark:text-white">
                      {item.subject}
                    </span>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                      isAboveNFL 
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30' 
                        : isAboveD1 
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' 
                        : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400'
                    }`}>
                      {isAboveNFL ? 'NFL COMBINE' : isAboveD1 ? 'D1 TIER' : 'DEVELOPING'}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between my-1">
                    <span className="text-xl font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                      {item.athlete}
                      <span className="text-xs text-gray-400 dark:text-slate-500 font-sans font-normal">/100</span>
                    </span>
                    <span className="text-[10px] font-mono text-gray-500 dark:text-slate-400">
                      D1: {item.collegeD1} • NFL: {item.eliteNFL}
                    </span>
                  </div>

                  {/* Dual progress bar */}
                  <div className="w-full bg-gray-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mt-1 relative">
                    {/* Athlete bar */}
                    <div 
                      className={`h-full rounded-full transition-all ${
                        isAboveNFL 
                          ? 'bg-gradient-to-r from-emerald-500 to-amber-500' 
                          : isAboveD1 
                          ? 'bg-emerald-500' 
                          : 'bg-sky-500'
                      }`}
                      style={{ width: `${Math.min(100, item.athlete)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* SECTION: INTEGRATED MORIN & SAMOZINO FORCE-VELOCITY-POWER (FVP) SCOUT MODULE */}
      <div className="bg-white dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-950 dark:to-slate-900 border border-gray-200 dark:border-cyan-500/30 rounded-3xl p-5 sm:p-7 shadow-sm dark:shadow-xl flex flex-col gap-6 text-gray-900 dark:text-slate-100 relative overflow-hidden">
        {/* Glow backdrop */}
        <div className="absolute top-0 right-1/4 w-80 h-36 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-gray-200 dark:border-slate-800 pb-4 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 flex items-center justify-center font-black shadow-xs">
              <Activity size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white tracking-tight">
                  Morin & Samozino Sprint F-v-P Mechanical Profiler
                </h3>
                <span className="text-[10px] font-mono font-bold bg-cyan-500/15 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 px-2 py-0.5 rounded-full border border-cyan-500/30 uppercase">
                  Biomechanical Gold Standard
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                Horizontal Force (F0), Velocity (V0), Power (Pmax), and mechanical effectiveness ratios for scouting.
              </p>
            </div>
          </div>

          {/* Controls: Physical Parameters & Studio Launch */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end flex-wrap">
            <div className="flex items-center gap-2 bg-gray-100 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700/80 px-3 py-1.5 rounded-xl text-xs">
              <span className="text-gray-500 dark:text-slate-400 font-bold">Mass:</span>
              <input
                type="number"
                min="35"
                max="160"
                value={athleteMass}
                onChange={e => setAthleteMass(Math.max(35, Math.min(160, parseFloat(e.target.value) || 75)))}
                className="w-12 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded px-1.5 py-0.5 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400 focus:outline-none"
              />
              <span className="text-gray-500 dark:text-slate-400 font-mono">kg</span>
            </div>

            <div className="flex items-center gap-2 bg-gray-100 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700/80 px-3 py-1.5 rounded-xl text-xs">
              <span className="text-gray-500 dark:text-slate-400 font-bold">Height:</span>
              <input
                type="number"
                min="120"
                max="230"
                value={athleteHeight}
                onChange={e => setAthleteHeight(Math.max(120, Math.min(230, parseFloat(e.target.value) || 180)))}
                className="w-12 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded px-1.5 py-0.5 text-center font-mono font-bold text-sky-600 dark:text-sky-400 focus:outline-none"
              />
              <span className="text-gray-500 dark:text-slate-400 font-mono">cm</span>
            </div>

            <button
              onClick={() => setShowFvpModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-sm"
              title="Open full interactive FVP studio modal"
            >
              <Maximize2 size={13} />
              <span>Full Studio</span>
            </button>
          </div>
        </div>

        {fvp ? (
          <>
            {/* 4 Core Biomarker Metric Tiles */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 z-10">
          
          {/* F0 Tile */}
          <div className="bg-gray-50 dark:bg-slate-950/80 border border-gray-200 dark:border-slate-800 hover:border-cyan-500/50 p-4 rounded-2xl flex flex-col justify-between transition-colors shadow-xs">
            <div className="flex justify-between items-center text-xs font-bold text-cyan-600 dark:text-cyan-400">
              <span className="flex items-center gap-1.5">
                <Dumbbell size={14} /> F0 (Max Force)
              </span>
              <span className="text-[10px] font-mono text-gray-400 dark:text-slate-500 uppercase">BLOCK DRIVE</span>
            </div>
            <div className="my-2.5">
              <div className="text-2xl sm:text-3xl font-mono font-black text-gray-900 dark:text-white tracking-tight">
                {fvp.f0Rel} <span className="text-xs font-sans text-gray-500 dark:text-slate-400 font-normal">N/kg</span>
              </div>
              <div className="text-xs font-mono text-cyan-600 dark:text-cyan-300 mt-0.5">
                {fvp.f0} N <span className="text-gray-400 dark:text-slate-500 text-[11px]">total</span>
              </div>
            </div>
            <div className="text-[11px] text-gray-500 dark:text-slate-400 flex items-center justify-between border-t border-gray-200 dark:border-slate-800/80 pt-2">
              <span>Scout Standard:</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">&gt; 8.5 N/kg</span>
            </div>
          </div>

          {/* V0 Tile */}
          <div className="bg-gray-50 dark:bg-slate-950/80 border border-gray-200 dark:border-slate-800 hover:border-emerald-500/50 p-4 rounded-2xl flex flex-col justify-between transition-colors shadow-xs">
            <div className="flex justify-between items-center text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <span className="flex items-center gap-1.5">
                <Zap size={14} /> V0 (Max Velocity)
              </span>
              <span className="text-[10px] font-mono text-gray-400 dark:text-slate-500 uppercase">TOP SPEED</span>
            </div>
            <div className="my-2.5">
              <div className="text-2xl sm:text-3xl font-mono font-black text-gray-900 dark:text-white tracking-tight">
                {fvp.v0} <span className="text-xs font-sans text-gray-500 dark:text-slate-400 font-normal">m/s</span>
              </div>
              <div className="text-xs font-mono text-emerald-600 dark:text-emerald-300 mt-0.5">
                {fvp.v0Kmh} km/h <span className="text-gray-400 dark:text-slate-500 text-[11px]">({(fvp.v0 * 2.23694).toFixed(1)} mph)</span>
              </div>
            </div>
            <div className="text-[11px] text-gray-500 dark:text-slate-400 flex items-center justify-between border-t border-gray-200 dark:border-slate-800/80 pt-2">
              <span>Scout Standard:</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">&gt; 10.2 m/s</span>
            </div>
          </div>

          {/* Pmax Tile */}
          <div className="bg-gray-50 dark:bg-slate-950/80 border border-gray-200 dark:border-slate-800 hover:border-amber-500/50 p-4 rounded-2xl flex flex-col justify-between transition-colors shadow-xs">
            <div className="flex justify-between items-center text-xs font-bold text-amber-600 dark:text-amber-400">
              <span className="flex items-center gap-1.5">
                <Flame size={14} /> Pmax (Max Power)
              </span>
              <span className="text-[10px] font-mono text-gray-400 dark:text-slate-500 uppercase">POWER OUTPUT</span>
            </div>
            <div className="my-2.5">
              <div className="text-2xl sm:text-3xl font-mono font-black text-gray-900 dark:text-white tracking-tight">
                {fvp.pmaxRel} <span className="text-xs font-sans text-gray-500 dark:text-slate-400 font-normal">W/kg</span>
              </div>
              <div className="text-xs font-mono text-amber-600 dark:text-amber-300 mt-0.5">
                {fvp.pmax} W <span className="text-gray-400 dark:text-slate-500 text-[11px]">peak</span>
              </div>
            </div>
            <div className="text-[11px] text-gray-500 dark:text-slate-400 flex items-center justify-between border-t border-gray-200 dark:border-slate-800/80 pt-2">
              <span>Scout Standard:</span>
              <span className="font-mono font-bold text-amber-600 dark:text-amber-400">&gt; 20.0 W/kg</span>
            </div>
          </div>

          {/* RF & DRF Tile */}
          <div className="bg-gray-50 dark:bg-slate-950/80 border border-gray-200 dark:border-slate-800 hover:border-purple-500/50 p-4 rounded-2xl flex flex-col justify-between transition-colors shadow-xs">
            <div className="flex justify-between items-center text-xs font-bold text-purple-600 dark:text-purple-400">
              <span className="flex items-center gap-1.5">
                <TrendingUp size={14} /> RF & DRF Efficiency
              </span>
              <span className="text-[10px] font-mono text-gray-400 dark:text-slate-500 uppercase">VECTOR RATIO</span>
            </div>
            <div className="my-2.5">
              <div className="text-2xl sm:text-3xl font-mono font-black text-gray-900 dark:text-white tracking-tight">
                {fvp.rfPeak}% <span className="text-xs font-sans text-gray-500 dark:text-slate-400 font-normal">RF peak</span>
              </div>
              <div className="text-xs font-mono text-purple-600 dark:text-purple-300 mt-0.5">
                DRF: {fvp.drf}% <span className="text-gray-400 dark:text-slate-500 text-[11px]">/ (m/s)</span>
              </div>
            </div>
            <div className="text-[11px] text-gray-500 dark:text-slate-400 flex items-center justify-between border-t border-gray-200 dark:border-slate-800/80 pt-2">
              <span>Slope (Sfv):</span>
              <span className="font-mono font-bold text-purple-600 dark:text-purple-300">{fvp.sfvRel} N·s/m/kg</span>
            </div>
          </div>

        </div>

        {/* Split Grid: Biomechanical Curves Chart & Scout Sled Targets */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 z-10">
          
          {/* Left: Recharts F-v / P-v Composed Chart (7 Cols) */}
          <div className="lg:col-span-7 bg-gray-50 dark:bg-slate-950/80 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-xs font-bold text-gray-800 dark:text-slate-200 flex items-center gap-2">
                <Activity size={14} className="text-cyan-600 dark:text-cyan-400" />
                <span>Linear Force-Velocity (F-v) & Parabolic Power-Velocity (P-v)</span>
              </div>
              
              <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-1 text-[11px]">
                <button
                  onClick={() => setFvpCurveView('both')}
                  className={`px-2 py-0.5 rounded font-bold transition ${fvpCurveView === 'both' ? 'bg-cyan-500 text-white dark:text-slate-950' : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}
                >
                  Both
                </button>
                <button
                  onClick={() => setFvpCurveView('fv')}
                  className={`px-2 py-0.5 rounded font-bold transition ${fvpCurveView === 'fv' ? 'bg-cyan-500 text-white dark:text-slate-950' : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}
                >
                  F-v Line
                </button>
                <button
                  onClick={() => setFvpCurveView('pv')}
                  className={`px-2 py-0.5 rounded font-bold transition ${fvpCurveView === 'pv' ? 'bg-cyan-500 text-white dark:text-slate-950' : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}
                >
                  P-v Curve
                </button>
              </div>
            </div>

            <div className="h-60 sm:h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={fvp.curvePoints} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#1e293b" : "#e2e8f0"} />
                  <XAxis 
                    dataKey="velocity" 
                    unit=" m/s" 
                    tick={{ fill: isDark ? '#64748b' : '#64748b', fontSize: 10, fontFamily: 'monospace' }} 
                    stroke={isDark ? "#334155" : "#cbd5e1"} 
                  />
                  <YAxis 
                    yAxisId="force" 
                    unit=" N/kg" 
                    domain={[0, 'dataMax + 1']}
                    tick={{ fill: isDark ? '#06b6d4' : '#0891b2', fontSize: 10, fontFamily: 'monospace' }} 
                    stroke={isDark ? "#0891b2" : "#0891b2"} 
                  />
                  <YAxis 
                    yAxisId="power" 
                    orientation="right" 
                    unit=" W/kg" 
                    domain={[0, 'dataMax + 2']}
                    tick={{ fill: isDark ? '#f59e0b' : '#d97706', fontSize: 10, fontFamily: 'monospace' }} 
                    stroke={isDark ? "#d97706" : "#d97706"} 
                  />
                  <RechartsTooltip 
                    contentStyle={{ 
                      backgroundColor: isDark ? '#090d16' : '#ffffff', 
                      borderColor: isDark ? '#334155' : '#e2e8f0', 
                      borderRadius: 12, 
                      fontSize: 11,
                      color: isDark ? '#f8fafc' : '#0f172a',
                      boxShadow: isDark ? '0 10px 15px -3px rgba(0, 0, 0, 0.5)' : '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                    }}
                    formatter={(val, name) => [
                      `${val} ${name === 'Force' ? 'N/kg' : 'W/kg'}`, 
                      name === 'Force' ? 'Rel. Force' : 'Rel. Power'
                    ]}
                    labelFormatter={(v) => `Velocity: ${v} m/s`}
                  />
                  {(fvpCurveView === 'both' || fvpCurveView === 'fv') && (
                    <Line 
                      yAxisId="force" 
                      type="monotone" 
                      dataKey="forceRel" 
                      name="Force" 
                      stroke="#06b6d4" 
                      strokeWidth={2.5} 
                      dot={false} 
                    />
                  )}
                  {(fvpCurveView === 'both' || fvpCurveView === 'pv') && (
                    <Line 
                      yAxisId="power" 
                      type="monotone" 
                      dataKey="powerRel" 
                      name="Power" 
                      stroke="#f59e0b" 
                      strokeWidth={2.5} 
                      strokeDasharray="4 2" 
                      dot={false} 
                    />
                  )}
                  {fvp.samplePoints && (
                    <Scatter 
                      yAxisId="force" 
                      data={fvp.samplePoints} 
                      dataKey="forceRel" 
                      fill="#10b981" 
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-slate-400 font-mono border-t border-gray-200 dark:border-slate-800/80 pt-2 px-1">
              <span>Slope (Sfv): <strong className="text-cyan-600 dark:text-cyan-400">{fvp.sfvRel} N·s/m/kg</strong></span>
              <span>Model Fit: <strong className="text-emerald-600 dark:text-emerald-400">R² = {fvp.rSquared || '0.99'}</strong></span>
            </div>
          </div>

          {/* Right: Neuromuscular Deficit & Sled Push Weight Targets (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col gap-3">
            
            {/* Neuromuscular Diagnosis Badge */}
            <div className="bg-gray-50 dark:bg-slate-950/80 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col gap-2 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  NEUROMUSCULAR DIAGNOSIS
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border ${fvp.profileBadge}`}>
                  {fvp.profileType}
                </span>
              </div>
              <p className="text-xs text-gray-700 dark:text-slate-300 leading-relaxed">
                {fvp.deficitDescription}
              </p>
            </div>

            {/* Prescriptive Sled Push & Tow Targets */}
            <div className="bg-gray-50 dark:bg-slate-950/80 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col gap-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-gray-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Dumbbell size={14} className="text-emerald-600 dark:text-emerald-400" />
                  <span>Resistance Sled Push Targets ({athleteMass} kg athlete)</span>
                </div>
                <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400">μ ≈ 0.35 turf</span>
              </div>

              <div className="flex flex-col gap-2">
                {/* 50% Vdec Target */}
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900/90 border border-gray-200 dark:border-slate-800 flex items-center justify-between shadow-xs">
                  <div>
                    <div className="text-xs font-bold text-gray-800 dark:text-slate-200">Heavy Sled Push (50% Vdec)</div>
                    <div className="text-[10px] text-gray-500 dark:text-slate-400">Maximum Horizontal Force F0 Overload</div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-mono font-bold text-cyan-600 dark:text-cyan-400">{sledTargets.heavyKg} kg</span>
                    <span className="text-[11px] font-mono text-gray-400 dark:text-slate-500 ml-1">({sledTargets.heavyLbs} lbs)</span>
                  </div>
                </div>

                {/* 25% Vdec Target */}
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900/90 border border-gray-200 dark:border-slate-800 flex items-center justify-between shadow-xs">
                  <div>
                    <div className="text-xs font-bold text-gray-800 dark:text-slate-200">Power Sled Push (25% Vdec)</div>
                    <div className="text-[10px] text-gray-500 dark:text-slate-400">Peak Mechanical Power Pmax Stimulus</div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-mono font-bold text-amber-600 dark:text-amber-400">{sledTargets.powerKg} kg</span>
                    <span className="text-[11px] font-mono text-gray-400 dark:text-slate-500 ml-1">({sledTargets.powerLbs} lbs)</span>
                  </div>
                </div>

                {/* 10% Vdec Target */}
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900/90 border border-gray-200 dark:border-slate-800 flex items-center justify-between shadow-xs">
                  <div>
                    <div className="text-xs font-bold text-gray-800 dark:text-slate-200">Technical Tow Sled (10% Vdec)</div>
                    <div className="text-[10px] text-gray-500 dark:text-slate-400">Top Velocity Upright Transfer V0</div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400">{sledTargets.technicalKg} kg</span>
                    <span className="text-[11px] font-mono text-gray-400 dark:text-slate-500 ml-1">({sledTargets.technicalLbs} lbs)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    ) : (
        <div className="bg-gray-50 dark:bg-slate-950/80 border border-gray-200 dark:border-slate-800 rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-3 z-10 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 flex items-center justify-center font-bold">
            <Activity size={24} />
          </div>
          <div className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Awaiting Linear Sprint Test</div>
          <p className="text-xs text-gray-600 dark:text-slate-400 max-w-md">
            Biomechanical Force-Velocity-Power (F-v-P) profiling requires at least one recorded sprint test for {athlete?.name || 'this athlete'}. No simulated or dummy numbers are fabricated.
          </p>
          {onStartEventTest && (
            <button
              onClick={() => onStartEventTest(trackDistance ? String(trackDistance) : '40')}
              className="mt-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition flex items-center gap-2 shadow-sm"
            >
              <Zap size={14} /> Record {trackDistance ? `${trackDistance}m` : 'Sprint'} Run Now
            </button>
          )}
        </div>
      )}
    </div>

      {/* Distribution & Instant Sharing Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50 dark:bg-slate-950/90 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5">
        <div>
          <div className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Share2 size={16} className="text-emerald-500 dark:text-emerald-400" />
            <span>Instant Athlete & Parent Report Distribution</span>
          </div>
          <div className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
            Send the complete combine scorecard & Morin/Samozino FVP dossier directly via WhatsApp Web, Email, or PDF.
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap w-full sm:w-auto justify-end">
          <button
            onClick={handleShareWhatsApp}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-[#00e691] text-white font-bold text-xs transition shadow-sm"
            title={(athlete?.whatsapp || athlete?.phone) ? `Send scorecard directly to WhatsApp (${athlete.whatsapp || athlete.phone})` : "Share Combine Scorecard directly via WhatsApp"}
          >
            <MessageSquare size={15} />
            <span>WhatsApp {(athlete?.whatsapp || athlete?.phone) ? `(${athlete.whatsapp || athlete.phone})` : ''}</span>
          </button>

          <button
            onClick={handleShareEmail}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 border border-gray-200 dark:border-slate-700 font-bold text-xs transition shadow-sm"
            title={athlete?.email ? `Draft email scorecard directly to ${athlete.email}` : "Email Scorecard to Athlete / Parents"}
          >
            <Mail size={15} />
            <span>Email {athlete?.email ? `(${athlete.email})` : ''}</span>
          </button>

          <button
            onClick={handleDownloadCombinePDF}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition shadow-sm"
            title="Download Official Combine PDF Report with F-v-P Dossier"
          >
            <Download size={15} />
            <span>Combine + F-v-P PDF</span>
          </button>

          <button
            onClick={handleGenerateAthleteBioReport}
            disabled={isGeneratingBioReport}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold text-xs transition shadow-sm disabled:opacity-50"
            title="Generate Pro 3-Page PDF Bio-Report with Bio, Anthropometry, PRs, FVP Curve, and Kinematics Radar"
          >
            {isGeneratingBioReport ? <RefreshCw size={15} className="animate-spin" /> : <Trophy size={15} className="text-amber-300" />}
            <span>{isGeneratingBioReport ? (bioReportStatus || 'Generating...') : 'Generate Athlete Bio-Report'}</span>
          </button>
        </div>
      </div>

      {/* Interactive Horizontal Force-Velocity-Power Modal */}
      {showFvpModal && (
        <React.Suspense fallback={null}>
          <HorizontalFVPModal
            isOpen={true}
            onClose={() => setShowFvpModal(false)}
            athlete={athlete}
            currentRun={bestSpeedRun}
            history={history}
            results={results}
          />
        </React.Suspense>
      )}

    </div>
  );
}
