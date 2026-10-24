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
  AlertTriangle, CheckCircle2, Zap, Activity, Volume2, VolumeX, 
  Copy, Check, Compass, ShieldAlert, RotateCcw, Play, Clock, 
  Info, ArrowUpRight, Sparkles, Filter, AlertCircle, ChevronDown, 
  ChevronUp, HelpCircle
} from 'lucide-react';

/**
 * AIBioCoachDeck.jsx
 * Automated Sprint Biomechanical Coaching & Flaw Detection Deck
 * 
 * Provides:
 * 1. Master Biomechanical Efficiency Score & Performance Letter Grade
 * 2. 4 Specific Fault Flags: Overstriding, Butt-Kicking, Premature Uprighting, Asymmetry Index
 * 3. Interactive Flaw Timeline with 1-click video frame jump
 * 4. Actionable Verbal Coaching Cues & Prescribed Track Drills
 * 5. Audio Voice Coach (Web Speech API) & Copyable Athlete Prescription
 */
export default function AIBioCoachDeck({
  analysis,
  onSeekToTime,
  currentTime = 0,
  isTrackingActive = false,
  onToggleCoach,
  isVisible = true
}) {
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'overstride' | 'backside' | 'upright' | 'asymmetry'
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expandedFlawId, setExpandedFlawId] = useState(null);
  const [showDrillModal, setShowDrillModal] = useState(null);

  const {
    score = 100,
    grade = 'A+',
    flawsCount = 0,
    allFlaws = [],
    overstrideResult = { flaws: [], count: 0, severity: 'optimal' },
    backsideResult = { flaws: [], count: 0, severity: 'optimal' },
    uprightResult = { flaws: [], count: 0, severity: 'optimal' },
    asymmetryResult = { compositeAsymmetryPct: 0, riskLevel: 'low', flaws: [], metrics: {} },
    coachingCues = []
  } = analysis || {};

  // Filter flaws based on active selection
  const filteredFlaws = useMemo(() => {
    if (!allFlaws || allFlaws.length === 0) return [];
    if (activeFilter === 'all') return allFlaws;
    if (activeFilter === 'overstride') return allFlaws.filter(f => f.type === 'overstride');
    if (activeFilter === 'backside') return allFlaws.filter(f => f.type === 'excessive_backside');
    if (activeFilter === 'upright') return allFlaws.filter(f => f.type === 'premature_uprighting');
    if (activeFilter === 'asymmetry') return allFlaws.filter(f => f.type === 'bilateral_asymmetry');
    return allFlaws;
  }, [allFlaws, activeFilter]);

  // Text-to-Speech audio coach narration
  const handleVoiceNarration = () => {
    if (!('speechSynthesis' in window)) {
      alert("Speech synthesis is not supported on this browser.");
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();

    let script = `Sprint Biomechanical Coaching Report. Overall efficiency score: ${score} out of 100, Grade ${grade}. `;
    if (flawsCount === 0) {
      script += "No major mechanical faults detected. Kinematics are operating within the elite performance corridor.";
    } else {
      script += `${flawsCount} mechanical areas flagged. `;
      coachingCues.forEach((cue, idx) => {
        script += `Focus ${idx + 1}: ${cue.title}. ${cue.cue}. Recommended drill: ${cue.drill}. `;
      });
    }

    const utterance = new SpeechSynthesisUtterance(script);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  // Copy full prescription to clipboard
  const handleCopyPrescription = () => {
    let text = `⚡ VELOCITY LAB — SPRINT BIO-COACH REPORT\n`;
    text += `Efficiency Score: ${score}/100 | Grade: ${grade}\n`;
    text += `Flagged Biomechanical Faults: ${flawsCount}\n\n`;

    text += `--- 4 CRITICAL FAULT METRICS ---\n`;
    text += `1. Overstride Braking: ${overstrideResult.count} flagged | Max Braking Offset: ${overstrideResult.avgBrakingOffsetCm || 0}cm\n`;
    text += `2. Excessive Backside Heel Recovery: ${backsideResult.count} flagged | Max Flexion: ${backsideResult.maxFlexionDeg || '--'}°\n`;
    text += `3. Premature Torso Uprighting: ${uprightResult.isPremature ? `Flagged at ${uprightResult.transitionTime}s` : 'Optimal Drive Maintained'}\n`;
    text += `4. Bilateral Asymmetry Index: ${asymmetryResult.compositeAsymmetryPct}% (${asymmetryResult.riskTier || 'Elite Balance'})\n\n`;

    text += `--- ACTIONABLE COACHING CUES ---\n`;
    coachingCues.forEach((c, idx) => {
      text += `${idx + 1}. [${c.category}] ${c.title}\n`;
      text += `   Cue: "${c.cue}"\n`;
      text += `   Drill: ${c.drill}\n\n`;
    });

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  // Score color badge
  const getScoreColor = () => {
    if (score >= 90) return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
    if (score >= 75) return 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10';
    if (score >= 60) return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
    return 'text-rose-400 border-rose-500/30 bg-rose-500/10';
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl p-5 sm:p-7 shadow-lg flex flex-col gap-6 relative overflow-hidden transition-all">
      {/* Background Accent Glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-cyan-500/5 dark:bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

      {/* Header & Controls Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 dark:border-slate-800/80 pb-5 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-sm shrink-0">
            <Sparkles size={24} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
                Automated AI Biomechanical Coach
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                Active Bio-Audit
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Weyand & Morin Kinematic Fault Engine • Real-time Stride Flagging & Verbal Feedback
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Audio Narration Button */}
          <button
            onClick={handleVoiceNarration}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition flex items-center gap-2 border shadow-xs ${
              isSpeaking
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse'
                : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30 hover:bg-emerald-100 dark:hover:bg-emerald-500/20'
            }`}
            title="Listen to automated coaching cues with audio speech synthesis"
          >
            {isSpeaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
            <span>{isSpeaking ? 'Stop Coach Voice' : 'Listen to Voice Coach'}</span>
          </button>

          {/* Copy Prescription */}
          <button
            onClick={handleCopyPrescription}
            className="px-3 py-1.5 rounded-xl text-xs font-bold font-mono bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-slate-700 transition flex items-center gap-1.5"
            title="Copy entire coaching analysis and drills to clipboard"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            <span>{copied ? 'Copied to Clipboard!' : 'Copy Coach Notes'}</span>
          </button>

          {/* Master Toggle Button (Allows disabling/enabling without hindering existing workflow) */}
          {onToggleCoach && (
            <button
              onClick={onToggleCoach}
              className="px-3 py-1.5 rounded-xl text-xs font-bold font-mono bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-slate-700 transition flex items-center gap-1"
              title="Toggle AI Bio-Coach visibility to analyze with or without automated coaching"
            >
              <span>Hide Coach Deck</span>
            </button>
          )}
        </div>
      </div>

      {/* Top Banner: Master Efficiency Score & Quick Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 relative z-10">
        {/* Score & Letter Grade */}
        <div className={`p-4 rounded-2xl border flex items-center justify-between col-span-1 sm:col-span-2 lg:col-span-2 ${getScoreColor()}`}>
          <div className="flex flex-col">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Sprint Biomechanics Score
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl sm:text-4xl font-black font-mono tracking-tight">{score}</span>
              <span className="text-xs text-gray-400">/ 100</span>
              <span className="text-sm font-black uppercase px-2.5 py-0.5 rounded-lg border ml-2">
                {grade}
              </span>
            </div>
            <span className="text-[11px] text-gray-400 mt-1">
              {score >= 90 ? '🌟 World-Class Frontside Mechanics' :
               score >= 75 ? '⚡ Strong Mechanics with Minor Adjustments' :
               score >= 60 ? '⚠️ High Braking & Kinetic Leakages Detected' :
               '🚨 Significant Asymmetry & Braking Impulses'}
            </span>
          </div>
          <div className="w-16 h-16 rounded-full border-4 border-current flex items-center justify-center shrink-0">
            <span className="text-lg font-black">{grade.split(' ')[0]}</span>
          </div>
        </div>

        {/* Stat Pill 1: Overstride Braking */}
        <div className="bg-slate-50 dark:bg-slate-900/90 p-3.5 rounded-2xl border border-gray-100 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Overstride Braking</span>
            <span className={`w-2 h-2 rounded-full ${overstrideResult.count > 0 ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
          </div>
          <div className="text-xl font-bold font-mono text-gray-800 dark:text-gray-100 my-1">
            {overstrideResult.count > 0 ? `${overstrideResult.count} Strides` : 'Zero (Clean)'}
          </div>
          <div className="text-[10px] text-gray-400">
            {overstrideResult.count > 0 ? `Avg Braking: +${overstrideResult.avgBrakingOffsetCm}cm` : 'Touchdown directly under CoM'}
          </div>
        </div>

        {/* Stat Pill 2: Butt-Kicking */}
        <div className="bg-slate-50 dark:bg-slate-900/90 p-3.5 rounded-2xl border border-gray-100 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Backside Recovery</span>
            <span className={`w-2 h-2 rounded-full ${backsideResult.count > 0 ? 'bg-rose-400 animate-pulse' : 'bg-emerald-400'}`} />
          </div>
          <div className="text-xl font-bold font-mono text-gray-800 dark:text-gray-100 my-1">
            {backsideResult.count > 0 ? `${backsideResult.count} Events` : 'Tight Frontside'}
          </div>
          <div className="text-[10px] text-gray-400">
            {backsideResult.count > 0 ? `Max Flexion: ${backsideResult.maxFlexionDeg}° (>140°)` : 'Step-over opposite knee active'}
          </div>
        </div>

        {/* Stat Pill 3: Asymmetry Risk */}
        <div className="bg-slate-50 dark:bg-slate-900/90 p-3.5 rounded-2xl border border-gray-100 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Asymmetry Index</span>
            <span className={`w-2 h-2 rounded-full ${asymmetryResult.riskLevel === 'high' ? 'bg-rose-500' : asymmetryResult.riskLevel === 'moderate' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
          </div>
          <div className="text-xl font-bold font-mono text-gray-800 dark:text-gray-100 my-1">
            {asymmetryResult.compositeAsymmetryPct}% Diff
          </div>
          <div className={`text-[10px] font-bold ${asymmetryResult.riskLevel === 'high' ? 'text-rose-400' : asymmetryResult.riskLevel === 'moderate' ? 'text-amber-400' : 'text-emerald-400'}`}>
            {asymmetryResult.riskLevel === 'high' ? 'High Hamstring Risk' : asymmetryResult.riskLevel === 'moderate' ? 'Moderate Asymmetry' : 'Elite Balance (<5%)'}
          </div>
        </div>
      </div>

      {/* 4 Deep-Dive Fault Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
        
        {/* FAULT 1: Overstriding / Braking Card */}
        <div className={`p-5 rounded-2xl border transition-all ${
          overstrideResult.count > 0 
            ? 'bg-amber-500/5 border-amber-500/30' 
            : 'bg-slate-50 dark:bg-slate-900/80 border-gray-100 dark:border-slate-800'
        }`}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-xl border ${
                overstrideResult.count > 0 
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' 
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}>
                <AlertTriangle size={18} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                  Overstriding & Braking Impulse
                </h4>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Touchdown foot landing ahead of CoM (Shin Angle &gt; +10°)
                </p>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
              overstrideResult.count > 0 
                ? 'bg-amber-500/20 text-amber-500 dark:text-amber-300 border border-amber-500/40' 
                : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
            }`}>
              {overstrideResult.count > 0 ? `${overstrideResult.count} Detected` : 'Optimal'}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center py-1.5 border-b border-gray-200/50 dark:border-slate-800/80">
              <span className="text-gray-500">Horizontal Braking Offset:</span>
              <span className={`font-mono font-bold ${overstrideResult.avgBrakingOffsetCm > 10 ? 'text-amber-400' : 'text-gray-700 dark:text-gray-300'}`}>
                +{overstrideResult.avgBrakingOffsetCm || 0} cm ahead of hip
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-gray-200/50 dark:border-slate-800/80">
              <span className="text-gray-500">Estimated Braking Velocity Loss:</span>
              <span className="font-mono font-bold text-gray-700 dark:text-gray-300">
                ~{overstrideResult.count > 0 ? (overstrideResult.avgBrakingOffsetCm * 0.04).toFixed(2) : '0.00'} m/s per stride
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5">
              <span className="text-gray-500">Biomechanical Consequence:</span>
              <span className="text-[11px] text-gray-400 text-right max-w-[220px]">
                {overstrideResult.count > 0
                  ? 'Backward ground reaction force slows horizontal velocity and strains patellar tendon.'
                  : 'Foot contacts beneath hips with active pawback, preserving linear momentum.'}
              </span>
            </div>
          </div>

          {/* Jump to Overstride Occurrences */}
          {overstrideResult.flaws.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200/50 dark:border-slate-800/80 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-gray-500 font-bold uppercase mr-1">Flagged Timestamps:</span>
              {overstrideResult.flaws.map((flaw) => (
                <button
                  key={flaw.id}
                  onClick={() => onSeekToTime && onSeekToTime(flaw.time)}
                  className="px-2 py-0.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-500 dark:text-amber-300 border border-amber-500/30 text-[10px] font-mono font-bold transition flex items-center gap-1"
                  title="Click to jump video to this exact touchdown frame"
                >
                  <Play size={9} />
                  <span>{flaw.timeFormatted}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* FAULT 2: Excessive Backside Heel Recovery Card */}
        <div className={`p-5 rounded-2xl border transition-all ${
          backsideResult.count > 0 
            ? 'bg-rose-500/5 border-rose-500/30' 
            : 'bg-slate-50 dark:bg-slate-900/80 border-gray-100 dark:border-slate-800'
        }`}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-xl border ${
                backsideResult.count > 0 
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/40' 
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}>
                <RotateCcw size={18} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                  Excessive Backside Heel Recovery
                </h4>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Knee flexion angle &gt; 140° behind hip ("Butt-Kicking")
                </p>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
              backsideResult.count > 0 
                ? 'bg-rose-500/20 text-rose-500 dark:text-rose-300 border border-rose-500/40' 
                : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
            }`}>
              {backsideResult.count > 0 ? `${backsideResult.count} Flagged` : 'Tight Frontside'}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center py-1.5 border-b border-gray-200/50 dark:border-slate-800/80">
              <span className="text-gray-500">Max Trail Knee Flexion:</span>
              <span className={`font-mono font-bold ${backsideResult.maxFlexionDeg > 140 ? 'text-rose-400' : 'text-gray-700 dark:text-gray-300'}`}>
                {backsideResult.maxFlexionDeg ? `${backsideResult.maxFlexionDeg}°` : 'Optimal (<135°)'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-gray-200/50 dark:border-slate-800/80">
              <span className="text-gray-500">Frontside Cycling Loss:</span>
              <span className="font-mono font-bold text-gray-700 dark:text-gray-300">
                {backsideResult.count > 0 ? 'High rotational moment of inertia' : 'Compact knee-drive lever'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5">
              <span className="text-gray-500">Kinematic Mechanism:</span>
              <span className="text-[11px] text-gray-400 text-right max-w-[220px]">
                {backsideResult.count > 0
                  ? 'Heel kicks up toward glute behind hip, delaying forward thigh swing and lowering stride rate.'
                  : 'Heel cuts directly under pelvis and steps over opposite knee into high frontside attack.'}
              </span>
            </div>
          </div>

          {/* Jump to Backside Occurrences */}
          {backsideResult.flaws.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200/50 dark:border-slate-800/80 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-gray-500 font-bold uppercase mr-1">Flagged Timestamps:</span>
              {backsideResult.flaws.map((flaw) => (
                <button
                  key={flaw.id}
                  onClick={() => onSeekToTime && onSeekToTime(flaw.time)}
                  className="px-2 py-0.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-500 dark:text-rose-300 border border-rose-500/30 text-[10px] font-mono font-bold transition flex items-center gap-1"
                  title="Click to jump video to this butt-kicking frame"
                >
                  <Play size={9} />
                  <span>{flaw.timeFormatted}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* FAULT 3: Premature Torso Uprighting Card */}
        <div className={`p-5 rounded-2xl border transition-all ${
          uprightResult.isPremature 
            ? 'bg-purple-500/5 border-purple-500/30' 
            : 'bg-slate-50 dark:bg-slate-900/80 border-gray-100 dark:border-slate-800'
        }`}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-xl border ${
                uprightResult.isPremature 
                  ? 'bg-purple-500/20 text-purple-400 border-purple-500/40' 
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}>
                <Compass size={18} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                  Drive Phase & Torso Progression
                </h4>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Transition from acceleration lean (25°-35°) to upright (&lt; 10°)
                </p>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
              uprightResult.isPremature 
                ? 'bg-purple-500/20 text-purple-500 dark:text-purple-300 border border-purple-500/40' 
                : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
            }`}>
              {uprightResult.isPremature ? 'Premature Rise' : 'Gradual Rise'}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center py-1.5 border-b border-gray-200/50 dark:border-slate-800/80">
              <span className="text-gray-500">Drive Lean Retention Duration:</span>
              <span className={`font-mono font-bold ${uprightResult.isPremature ? 'text-purple-400' : 'text-emerald-400'}`}>
                {uprightResult.transitionTime ? `${uprightResult.transitionTime}s` : 'Full Phase Held'} 
                <span className="text-[10px] text-gray-500 font-normal ml-1">(Target: ≥ 1.8s)</span>
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-gray-200/50 dark:border-slate-800/80">
              <span className="text-gray-500">Horizontal Force Vector Loss:</span>
              <span className="font-mono font-bold text-gray-700 dark:text-gray-300">
                {uprightResult.isPremature ? 'Premature vertical braking' : 'Maximized horizontal propulsive impulse'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5">
              <span className="text-gray-500">Coaching Diagnosis:</span>
              <span className="text-[11px] text-gray-400 text-right max-w-[220px]">
                {uprightResult.isPremature
                  ? 'Head and chest popped up before 15m. Maintain smooth line of drive from ankle through crown of head.'
                  : 'Athlete pushed aggressively through ground with ideal 30° lean, transitioning smoothly to upright.'}
              </span>
            </div>
          </div>

          {/* Jump to Uprighting Occurrence */}
          {uprightResult.flaws.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200/50 dark:border-slate-800/80 flex items-center justify-between">
              <span className="text-[10px] text-gray-500 font-bold uppercase">Upright Frame:</span>
              <button
                onClick={() => onSeekToTime && onSeekToTime(uprightResult.flaws[0].time)}
                className="px-2 py-0.5 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-500 dark:text-purple-300 border border-purple-500/30 text-[10px] font-mono font-bold transition flex items-center gap-1"
              >
                <Play size={9} />
                <span>Jump to {uprightResult.flaws[0].timeFormatted}</span>
              </button>
            </div>
          )}
        </div>

        {/* FAULT 4: Asymmetry Index & Hamstring Risk Card */}
        <div className={`p-5 rounded-2xl border transition-all ${
          asymmetryResult.riskLevel === 'high'
            ? 'bg-rose-500/5 border-rose-500/30'
            : asymmetryResult.riskLevel === 'moderate'
            ? 'bg-amber-500/5 border-amber-500/30'
            : 'bg-slate-50 dark:bg-slate-900/80 border-gray-100 dark:border-slate-800'
        }`}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-xl border ${
                asymmetryResult.riskLevel === 'high' 
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/40' 
                  : asymmetryResult.riskLevel === 'moderate'
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}>
                <ShieldAlert size={18} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                  Bilateral Asymmetry & Hamstring Risk
                </h4>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Left vs. Right GCT, Knee Extension, & Stride Frequency
                </p>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
              asymmetryResult.riskLevel === 'high' 
                ? 'bg-rose-500/20 text-rose-500 dark:text-rose-300 border border-rose-500/40' 
                : asymmetryResult.riskLevel === 'moderate'
                ? 'bg-amber-500/20 text-amber-500 dark:text-amber-300 border border-amber-500/40'
                : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
            }`}>
              {asymmetryResult.compositeAsymmetryPct}% Asymmetry
            </span>
          </div>

          {/* Left vs Right Comparison Bars */}
          <div className="space-y-2.5 text-xs">
            {/* Ground Contact Time (GCT) */}
            <div>
              <div className="flex justify-between items-center text-[11px] mb-1">
                <span className="text-gray-500">Ground Contact (GCT):</span>
                <span className="font-mono text-gray-400">
                  <span className="text-sky-400 font-bold">L: {asymmetryResult.metrics?.leftGctMs || '--'}ms</span> vs{' '}
                  <span className="text-emerald-400 font-bold">R: {asymmetryResult.metrics?.rightGctMs || '--'}ms</span>
                </span>
              </div>
              <div className="h-1.5 w-full bg-slate-800 rounded-full flex overflow-hidden">
                <div 
                  className="bg-sky-400 h-full"
                  style={{ width: `${Math.round(((asymmetryResult.metrics?.leftGctMs || 100) / ((asymmetryResult.metrics?.leftGctMs || 100) + (asymmetryResult.metrics?.rightGctMs || 100))) * 100)}%` }}
                />
                <div 
                  className="bg-emerald-400 h-full"
                  style={{ width: `${Math.round(((asymmetryResult.metrics?.rightGctMs || 100) / ((asymmetryResult.metrics?.leftGctMs || 100) + (asymmetryResult.metrics?.rightGctMs || 100))) * 100)}%` }}
                />
              </div>
            </div>

            {/* Knee Angle */}
            <div>
              <div className="flex justify-between items-center text-[11px] mb-1">
                <span className="text-gray-500">Max Knee Extension:</span>
                <span className="font-mono text-gray-400">
                  <span className="text-sky-400 font-bold">L: {asymmetryResult.metrics?.leftKneeDeg || '--'}°</span> vs{' '}
                  <span className="text-emerald-400 font-bold">R: {asymmetryResult.metrics?.rightKneeDeg || '--'}°</span>
                </span>
              </div>
              <div className="h-1.5 w-full bg-slate-800 rounded-full flex overflow-hidden">
                <div 
                  className="bg-sky-400 h-full"
                  style={{ width: `${Math.round(((asymmetryResult.metrics?.leftKneeDeg || 150) / ((asymmetryResult.metrics?.leftKneeDeg || 150) + (asymmetryResult.metrics?.rightKneeDeg || 150))) * 100)}%` }}
                />
                <div 
                  className="bg-emerald-400 h-full"
                  style={{ width: `${Math.round(((asymmetryResult.metrics?.rightKneeDeg || 150) / ((asymmetryResult.metrics?.leftKneeDeg || 150) + (asymmetryResult.metrics?.rightKneeDeg || 150))) * 100)}%` }}
                />
              </div>
            </div>

            {/* Injury Risk Analysis */}
            <div className="pt-2 border-t border-gray-200/50 dark:border-slate-800/80 flex items-center justify-between">
              <span className="text-gray-500">Clinical Injury Risk:</span>
              <span className={`font-bold font-mono text-[11px] ${
                asymmetryResult.riskLevel === 'high' ? 'text-rose-400' :
                asymmetryResult.riskLevel === 'moderate' ? 'text-amber-400' : 'text-emerald-400'
              }`}>
                {asymmetryResult.riskLevel === 'high' ? '⚠️ High Biceps Femoris Strain Risk' :
                 asymmetryResult.riskLevel === 'moderate' ? '⚡ Moderate Bilateral Imbalance' : '✅ Symmetrical Load Distribution'}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* Actionable Coaching Cue Suggestions & Prescribed Drills */}
      <div className="bg-slate-50 dark:bg-slate-900/90 rounded-2xl p-5 border border-gray-100 dark:border-slate-800 relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Zap size={18} className="text-amber-400" />
            <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
              Actionable Coaching Cues & Prescribed Drills
            </h4>
          </div>
          <span className="text-[11px] text-gray-500 font-mono">
            {coachingCues.length} Specific Mechanical Adjustments
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {coachingCues.map((cue, idx) => (
            <div 
              key={cue.id || idx}
              className="bg-white dark:bg-slate-800/80 p-4 rounded-xl border border-gray-200/80 dark:border-slate-700/80 flex flex-col justify-between shadow-xs transition hover:border-emerald-500/40"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                    cue.priority === 'HIGH' || cue.priority === 'CRITICAL'
                      ? 'bg-rose-500/15 text-rose-500 dark:text-rose-400 border border-rose-500/30'
                      : cue.priority === 'MEDIUM'
                      ? 'bg-amber-500/15 text-amber-500 dark:text-amber-400 border border-amber-500/30'
                      : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                  }`}>
                    {cue.category || 'Sprint Cue'}
                  </span>
                  <span className="text-[10px] font-mono text-gray-400">#{idx + 1}</span>
                </div>

                <h5 className="text-xs font-bold text-gray-800 dark:text-gray-200 mb-1.5">
                  {cue.title}
                </h5>

                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-800 mb-2.5">
                  <span className="text-[10px] text-gray-500 uppercase font-bold block mb-0.5">Athlete Cue:</span>
                  <p className="text-xs text-emerald-600 dark:text-emerald-300 font-medium italic">
                    "{cue.cue}"
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-100 dark:border-slate-700/70">
                <span className="text-[10px] text-gray-500 font-bold uppercase block mb-0.5">Prescribed Track Drill:</span>
                <p className="text-[11px] text-gray-600 dark:text-gray-400">
                  {cue.drill}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Flaw Stream & Video Seek Bar */}
      {allFlaws.length > 0 && (
        <div className="bg-slate-50 dark:bg-slate-900/90 rounded-2xl p-5 border border-gray-100 dark:border-slate-800 relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-cyan-400" />
              <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
                Chronological Flaw Timeline ({filteredFlaws.length} Events)
              </h4>
            </div>

            {/* Filter Chips */}
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
              <button
                onClick={() => setActiveFilter('all')}
                className={`px-2 py-0.5 rounded-lg border transition ${activeFilter === 'all' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-bold' : 'text-gray-400 border-transparent hover:text-gray-200'}`}
              >
                All ({allFlaws.length})
              </button>
              <button
                onClick={() => setActiveFilter('overstride')}
                className={`px-2 py-0.5 rounded-lg border transition ${activeFilter === 'overstride' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold' : 'text-gray-400 border-transparent hover:text-gray-200'}`}
              >
                Overstride ({overstrideResult.count})
              </button>
              <button
                onClick={() => setActiveFilter('backside')}
                className={`px-2 py-0.5 rounded-lg border transition ${activeFilter === 'backside' ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold' : 'text-gray-400 border-transparent hover:text-gray-200'}`}
              >
                Backside ({backsideResult.count})
              </button>
              <button
                onClick={() => setActiveFilter('upright')}
                className={`px-2 py-0.5 rounded-lg border transition ${activeFilter === 'upright' ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 font-bold' : 'text-gray-400 border-transparent hover:text-gray-200'}`}
              >
                Upright ({uprightResult.count})
              </button>
              <button
                onClick={() => setActiveFilter('asymmetry')}
                className={`px-2 py-0.5 rounded-lg border transition ${activeFilter === 'asymmetry' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold' : 'text-gray-400 border-transparent hover:text-gray-200'}`}
              >
                Asymmetry ({asymmetryResult.flaws.length})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[320px] overflow-y-auto pr-1 scrollbar-thin">
            {filteredFlaws.map((flaw) => {
              const isCurrent = Math.abs(currentTime - flaw.time) < 0.2;
              return (
                <div
                  key={flaw.id}
                  className={`p-3 rounded-xl border flex flex-col justify-between gap-2 transition-all ${
                    isCurrent 
                      ? 'bg-cyan-500/10 border-cyan-500/60 shadow-xs' 
                      : 'bg-white dark:bg-slate-800/80 border-gray-200/80 dark:border-slate-700/80 hover:border-gray-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-black ${
                        flaw.severity === 'high'
                          ? 'bg-rose-500/20 text-rose-400'
                          : flaw.severity === 'medium'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-cyan-500/20 text-cyan-400'
                      }`}>
                        {flaw.timeFormatted}
                      </span>
                      <span className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate max-w-[150px]">
                        {flaw.title}
                      </span>
                    </div>

                    <button
                      onClick={() => onSeekToTime && onSeekToTime(flaw.time)}
                      className="px-2 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold transition flex items-center gap-1 shrink-0"
                      title="Jump video to this frame"
                    >
                      <Play size={10} />
                      <span>Seek</span>
                    </button>
                  </div>

                  <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2">
                    {flaw.description}
                  </p>

                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium italic truncate">
                    Cue: "{flaw.cue}"
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
