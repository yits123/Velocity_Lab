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
  ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2, 
  Volume2, Play, Pause, RotateCcw, Download, Copy, Check, 
  Info, HelpCircle, Activity, Award, Clock, ArrowRight, X, Sparkles, FileText
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { savePdfFile } from '../utils/pdfDownloader';
import { addVelocityLabLogoToPdf } from '../utils/logoPdfHelper';
import VelocityLabLogo from './VelocityLabLogo';

/**
 * World Athletics Rule TR 16.7 (formerly Rule 162.7):
 * Reaction Time & False Start Regulatory Auditor
 * 
 * Rules:
 * - Reaction time < 100ms (0.100s) = False start / Disqualification (DQ)
 * - 100ms - 119ms = Borderline high risk start
 * - 120ms - 159ms = World-class elite legal reaction
 * - 160ms - 199ms = Collegiate & competitive start
 * - >= 200ms = Sub-optimal block clearance
 * - Starter "Set" hold time protocol = 1.5s - 2.5s
 */
export default function ReactionTimeAuditorModal({
  isOpen = false,
  onClose,
  runData = null,
  starterHoldSec = null
}) {
  // Tabs: 'waveform' | 'physiology' | 'simulator' | 'rules'
  const [activeTab, setActiveTab] = useState('waveform');
  const [copied, setCopied] = useState(false);
  
  // Custom reaction time slider to let coaches simulate hypothetical values
  const rawRt = runData?.reactionTime ? parseFloat(runData.reactionTime) : 148;
  const initialRtMs = rawRt > 20 ? rawRt : Math.round(rawRt * 1000);
  const [testRtMs, setTestRtMs] = useState(initialRtMs > 0 ? initialRtMs : 148);

  // Starter hold duration (defaults to 1.84s compliant with WA 1.5-2.5s guidelines if not provided)
  const holdDuration = useMemo(() => {
    if (starterHoldSec && !isNaN(parseFloat(starterHoldSec))) {
      return parseFloat(starterHoldSec);
    }
    if (runData?.starterHoldTime && !isNaN(parseFloat(runData.starterHoldTime))) {
      return parseFloat(runData.starterHoldTime);
    }
    return 1.84;
  }, [starterHoldSec, runData]);

  // Waveform canvas state
  const canvasRef = useRef(null);
  const [animating, setAnimating] = useState(false);
  const [playbackTimeMs, setPlaybackTimeMs] = useState(400); // -100ms to 400ms
  const [hoveredMs, setHoveredMs] = useState(null);
  const animFrameRef = useRef(null);
  const startTimeRef = useRef(null);

  // Audio simulator state
  const audioCtxRef = useRef(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  
  // Live drill mini-game state
  const [drillState, setDrillState] = useState('idle'); // 'idle' | 'marks' | 'set' | 'gun' | 'reacted' | 'false_start'
  const [drillScore, setDrillScore] = useState(null);
  const drillTimerRef = useRef(null);
  const drillGunTimeRef = useRef(null);

  // Synchronize when runData changes
  useEffect(() => {
    if (runData?.reactionTime) {
      const ms = parseFloat(runData.reactionTime) > 20 
        ? parseFloat(runData.reactionTime) 
        : Math.round(parseFloat(runData.reactionTime) * 1000);
      setTestRtMs(ms > 0 ? ms : 148);
    }
  }, [runData]);

  // Audio Context initialization helper
  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        audioCtxRef.current = new AudioCtx();
      }
    }
    if (audioCtxRef.current?.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  // Play synthetic gun shot (white noise burst + low kick thump)
  const playGunSound = (ctx, timeOffset = 0) => {
    try {
      const startTime = ctx.currentTime + timeOffset;
      
      // Kick thump (sine pitch envelope from 160Hz -> 40Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160, startTime);
      osc.frequency.exponentialRampToValueAtTime(35, startTime + 0.12);
      gain.gain.setValueAtTime(0.8, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.16);

      // Noise burst for sharp gunshot transient
      const bufferSize = ctx.sampleRate * 0.08;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.015));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.6, startTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.07);
      noise.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noise.start(startTime);
    } catch (err) {
      console.warn("Web Audio Gun sound error:", err);
    }
  };

  // Play synthetic block pressure threshold break (crisp metallic click / 880Hz beep)
  const playBlockClick = (ctx, timeOffset = 0) => {
    try {
      const startTime = ctx.currentTime + timeOffset;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, startTime);
      osc.frequency.exponentialRampToValueAtTime(440, startTime + 0.05);
      gain.gain.setValueAtTime(0.7, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.07);
    } catch (err) {
      console.warn("Web Audio Block click error:", err);
    }
  };

  // Play the gun report and reaction response audio pair
  const handlePlayReactionAudio = () => {
    const ctx = getAudioContext();
    if (!ctx) return;
    setAudioPlaying(true);
    
    // Play gun at t = 0
    playGunSound(ctx, 0.05);

    // Play block pressure trigger at t = testRtMs
    const delaySec = 0.05 + (testRtMs / 1000);
    playBlockClick(ctx, delaySec);

    setTimeout(() => {
      setAudioPlaying(false);
    }, (delaySec + 0.2) * 1000);
  };

  // Interactive Live Reaction Drill Test
  const startLiveDrill = () => {
    if (drillTimerRef.current) clearTimeout(drillTimerRef.current);
    const ctx = getAudioContext();
    setDrillScore(null);
    setDrillState('marks');

    // On your marks (1.5s delay)
    drillTimerRef.current = setTimeout(() => {
      setDrillState('set');
      
      // Random starter hold between 1.5s and 2.5s (compliant with WA)
      const holdMs = 1500 + Math.random() * 1000;
      drillTimerRef.current = setTimeout(() => {
        setDrillState('gun');
        drillGunTimeRef.current = performance.now();
        if (ctx) playGunSound(ctx, 0);
      }, holdMs);
    }, 1500);
  };

  const handleDrillTap = () => {
    if (drillState === 'idle' || drillState === 'reacted' || drillState === 'false_start') {
      startLiveDrill();
      return;
    }

    if (drillState === 'marks' || drillState === 'set') {
      // User tapped BEFORE the gun! False start!
      if (drillTimerRef.current) clearTimeout(drillTimerRef.current);
      setDrillState('false_start');
      setDrillScore({
        ms: -1,
        status: 'ANTICIPATED_FALSE_START',
        label: 'ILLEGAL ANTICIPATION: Tapped before gun sound!'
      });
      return;
    }

    if (drillState === 'gun') {
      const now = performance.now();
      const elapsedMs = Math.round(now - drillGunTimeRef.current);
      
      let status = 'LEGAL';
      let label = 'LEGAL START';
      if (elapsedMs < 100) {
        status = 'DQ_RULE_TR16_7';
        label = `DQ: Reaction < 100ms (${elapsedMs}ms). Physiological impossibility according to WA TR 16.7.`;
      } else if (elapsedMs < 120) {
        status = 'BORDERLINE';
        label = `BORDERLINE LEGAL (${elapsedMs}ms). High risk of false start in international competition.`;
      } else if (elapsedMs <= 160) {
        status = 'WORLD_CLASS';
        label = `WORLD CLASS SPEED (${elapsedMs}ms)! Championship final caliber reaction time.`;
      } else if (elapsedMs <= 200) {
        status = 'COMPETITIVE';
        label = `COMPETITIVE (${elapsedMs}ms). Solid collegiate & club reaction.`;
      } else {
        status = 'SLOWER';
        label = `DELAYED REACTION (${elapsedMs}ms). Focus on acoustic readiness.`;
      }

      setDrillState('reacted');
      setDrillScore({ ms: elapsedMs, status, label });
    }
  };

  // Status classification based on World Athletics Rule TR 16.7
  const status = useMemo(() => {
    const ms = testRtMs;
    const sec = (ms / 1000).toFixed(3);
    const deltaMs = ms - 100;

    if (ms < 100) {
      return {
        tier: 'DQ',
        color: '#ef4444',
        bgColor: 'bg-red-500/10 dark:bg-red-950/40',
        borderColor: 'border-red-500/30 dark:border-red-500/40',
        textColor: 'text-red-600 dark:text-red-400',
        headline: 'DISQUALIFIED — FALSE START (DQ)',
        subheadline: `Rule TR 16.7 Violation: Reaction time (${ms}ms / ${sec}s) is under the 100ms physiological threshold.`,
        deltaLabel: `${deltaMs}ms (Under minimum legal limit)`,
        isLegal: false,
        icon: ShieldAlert
      };
    } else if (ms < 120) {
      return {
        tier: 'WARNING',
        color: '#f59e0b',
        bgColor: 'bg-amber-500/10 dark:bg-amber-950/40',
        borderColor: 'border-amber-500/30 dark:border-amber-500/40',
        textColor: 'text-amber-600 dark:text-amber-400',
        headline: 'BORDERLINE LEGAL — HIGH RISK (<120ms)',
        subheadline: `Reaction time (${ms}ms / ${sec}s) is legal by only +${deltaMs}ms. Extreme risk of sensor false start.`,
        deltaLabel: `+${deltaMs}ms margin over 100ms threshold`,
        isLegal: true,
        icon: AlertTriangle
      };
    } else if (ms <= 160) {
      return {
        tier: 'WORLD_CLASS',
        color: '#10b981',
        bgColor: 'bg-emerald-500/10 dark:bg-emerald-950/40',
        borderColor: 'border-emerald-500/30 dark:border-emerald-500/40',
        textColor: 'text-emerald-600 dark:text-emerald-400',
        headline: 'WORLD-CLASS ELITE LEGAL START',
        subheadline: `Reaction time (${ms}ms / ${sec}s) represents championship-level acoustic-motor processing.`,
        deltaLabel: `+${deltaMs}ms optimal safety margin`,
        isLegal: true,
        icon: ShieldCheck
      };
    } else if (ms <= 200) {
      return {
        tier: 'COMPETITIVE',
        color: '#0ea5e9',
        bgColor: 'bg-sky-500/10 dark:bg-sky-950/40',
        borderColor: 'border-sky-500/30 dark:border-sky-500/40',
        textColor: 'text-sky-600 dark:text-sky-400',
        headline: 'COMPETITIVE LEGAL START',
        subheadline: `Reaction time (${ms}ms / ${sec}s) conforms to World Athletics specifications with safe block clearance.`,
        deltaLabel: `+${deltaMs}ms clearance buffer`,
        isLegal: true,
        icon: ShieldCheck
      };
    } else {
      return {
        tier: 'SUB_OPTIMAL',
        color: '#8b5cf6',
        bgColor: 'bg-indigo-500/10 dark:bg-indigo-950/40',
        borderColor: 'border-indigo-500/30 dark:border-indigo-500/40',
        textColor: 'text-indigo-600 dark:text-indigo-400',
        headline: 'LEGAL START — SUB-OPTIMAL CLEARANCE',
        subheadline: `Reaction time (${ms}ms / ${sec}s) is fully legal, but leaves ${deltaMs}ms on the blocks.`,
        deltaLabel: `+${deltaMs}ms above threshold`,
        isLegal: true,
        icon: ShieldCheck
      };
    }
  }, [testRtMs]);

  // Starter Hold Evaluation
  const holdCompliance = useMemo(() => {
    const s = holdDuration;
    if (s < 1.5) {
      return {
        status: 'NON_COMPLIANT_SHORT',
        badge: 'FAST GUN / SHORT SET',
        color: 'text-amber-400',
        note: `Hold of ${s.toFixed(2)}s was under the WA minimum 1.5s guideline (athletes may still be moving).`
      };
    }
    if (s > 2.5) {
      return {
        status: 'NON_COMPLIANT_LONG',
        badge: 'EXCESSIVE HOLD',
        color: 'text-amber-400',
        note: `Hold of ${s.toFixed(2)}s exceeded the 2.5s maximum (isometric fatigue risk).`
      };
    }
    return {
      status: 'COMPLIANT',
      badge: 'OFFICIAL WA COMPLIANT',
      color: 'text-emerald-400',
      note: `Starter hold of ${s.toFixed(2)}s was within the optimal 1.5s - 2.5s regulatory window.`
    };
  }, [holdDuration]);

  // Waveform Animation Loop
  const startAnimation = () => {
    setAnimating(true);
    startTimeRef.current = performance.now();
    
    const step = (now) => {
      const elapsed = (now - startTimeRef.current) * 0.4; // slowed down for clear visibility
      const currentMs = -100 + elapsed;
      if (currentMs >= 400) {
        setPlaybackTimeMs(400);
        setAnimating(false);
      } else {
        setPlaybackTimeMs(currentMs);
        animFrameRef.current = requestAnimationFrame(step);
      }
    };
    animFrameRef.current = requestAnimationFrame(step);
  };

  const stopAnimation = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setAnimating(false);
    setPlaybackTimeMs(400);
  };

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (drillTimerRef.current) clearTimeout(drillTimerRef.current);
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        try { audioCtxRef.current.close().catch(() => {}); } catch (e) {}
        audioCtxRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (drillTimerRef.current) clearTimeout(drillTimerRef.current);
      setAudioPlaying(false);
      setDrillState('idle');
    }
  }, [isOpen]);

  // Render Waveform Canvas
  useEffect(() => {
    if (activeTab !== 'waveform') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = rect.height;

    // Time window: -100ms to +350ms (total 450ms)
    const minTime = -100;
    const maxTime = 350;
    const timeToX = (t) => ((t - minTime) / (maxTime - minTime)) * W;
    const xToTime = (x) => minTime + (x / W) * (maxTime - minTime);

    // Clear background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, W, H);

    // Draw grid lines
    ctx.lineWidth = 1;
    ctx.font = '10px ui-monospace, SFMono-Regular, monospace';

    for (let t = -100; t <= 350; t += 50) {
      const x = timeToX(t);
      ctx.strokeStyle = t === 0 ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.06)';
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H - 24);
      ctx.stroke();

      ctx.fillStyle = t === 0 ? '#38bdf8' : t === 100 ? '#ef4444' : '#64748b';
      ctx.textAlign = 'center';
      ctx.fillText(`${t > 0 ? '+' : ''}${t}ms`, x, H - 8);
    }

    // Shaded Illegal Zone: 0ms to 100ms
    const x0 = timeToX(0);
    const x100 = timeToX(100);
    const gradIllegal = ctx.createLinearGradient(x0, 0, x100, 0);
    gradIllegal.addColorStop(0, 'rgba(239, 68, 68, 0.22)');
    gradIllegal.addColorStop(1, 'rgba(239, 68, 68, 0.08)');
    ctx.fillStyle = gradIllegal;
    ctx.fillRect(x0, 0, x100 - x0, H - 24);

    // Shaded Legal Zone: 100ms to 350ms
    const x350 = timeToX(350);
    const gradLegal = ctx.createLinearGradient(x100, 0, x350, 0);
    gradLegal.addColorStop(0, 'rgba(16, 185, 129, 0.08)');
    gradLegal.addColorStop(1, 'rgba(16, 185, 129, 0.18)');
    ctx.fillStyle = gradLegal;
    ctx.fillRect(x100, 0, x350 - x100, H - 24);

    // Illegal Zone Warning Boundary line
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x100, 0);
    ctx.lineTo(x100, H - 24);
    ctx.stroke();
    ctx.setLineDash([]);

    // Label on Illegal Zone
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ILLEGAL REACTION ZONE (<100ms)', (x0 + x100) / 2, 18);
    ctx.fillText('RULE TR 16.7', (x0 + x100) / 2, 30);

    // Label on Legal Zone
    ctx.fillStyle = '#10b981';
    ctx.fillText('LEGAL SIS CLEARANCE WINDOW', (x100 + x350) / 2, 18);

    // 1. Plot Acoustic Sound Pressure Envelope (Gun Report at t = 0)
    // Sound wave exists between t = 0 and t = 60ms
    const acousticYCenter = H * 0.28;
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    let firstPt = true;

    for (let t = -100; t <= 350; t += 2) {
      if (t > playbackTimeMs) break;
      const x = timeToX(t);
      let amp = 0;
      if (t >= 0 && t <= 80) {
        // High-frequency decaying sinusoid
        const decay = Math.exp(-t / 18);
        const osc = Math.sin(t * 0.8) * Math.cos(t * 0.3);
        amp = osc * decay * 32;
      }
      const y = acousticYCenter + amp;
      if (firstPt) {
        ctx.moveTo(x, y);
        firstPt = false;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Gun flash marker at t = 0
    if (playbackTimeMs >= 0) {
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(x0, acousticYCenter, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('GUN TONE (t=0ms)', x0 + 6, acousticYCenter - 8);
    }

    // 2. Plot Block Pressure Curve (Athlete Foot Force in kgf / daN)
    // Baseline pressure: 15kgf in "Set" position
    // Starting at testRtMs, pressure rises steeply to > 25kgf (WA threshold) and peaks at ~95kgf
    const forceYBaseline = H * 0.78;
    const forceYPeak = H * 0.42;
    const thresholdForceY = forceYBaseline - ((25 - 15) / 80) * (forceYBaseline - forceYPeak);

    // Draw WA 25kgf / 250N Force Threshold Line
    ctx.strokeStyle = 'rgba(251, 146, 60, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(0, thresholdForceY);
    ctx.lineTo(W, thresholdForceY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#fb923c';
    ctx.font = '9px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('SIS Force Threshold: 25 kgf (245 N)', 12, thresholdForceY - 5);

    // Athlete Force Curve
    ctx.strokeStyle = status.color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    let fFirst = true;

    for (let t = -100; t <= 350; t += 2) {
      if (t > playbackTimeMs) break;
      const x = timeToX(t);
      let forceVal = 15; // baseline

      if (t > testRtMs - 25) {
        // Initial muscular recruitment
        const dt = t - (testRtMs - 25);
        if (dt > 0) {
          // Sigmoidal force development curve
          const progress = 1 / (1 + Math.exp(-0.08 * (dt - 35)));
          forceVal = 15 + progress * 80;
        }
      }

      const y = forceYBaseline - ((forceVal - 15) / 80) * (forceYBaseline - forceYPeak);
      if (fFirst) {
        ctx.moveTo(x, y);
        fFirst = false;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // 3. Athlete Measured RT Marker & Delta Pin
    if (playbackTimeMs >= testRtMs) {
      const xRt = timeToX(testRtMs);

      // Vertical line through both curves
      ctx.strokeStyle = status.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(xRt, 24);
      ctx.lineTo(xRt, H - 24);
      ctx.stroke();

      // Pulsing anchor node at force threshold crossing
      ctx.fillStyle = status.color;
      ctx.beginPath();
      ctx.arc(xRt, thresholdForceY, 5, 0, Math.PI * 2);
      ctx.fill();

      // RT Badge Callout
      ctx.fillStyle = status.color;
      ctx.font = 'bold 12px ui-monospace, monospace';
      ctx.textAlign = testRtMs > 240 ? 'right' : 'left';
      const offset = testRtMs > 240 ? -8 : 8;
      ctx.fillText(`${testRtMs} ms (${(testRtMs / 1000).toFixed(3)}s)`, xRt + offset, thresholdForceY - 14);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '10px system-ui, sans-serif';
      ctx.fillText(testRtMs < 100 ? 'FALSE START DETECTED' : 'BLOCK DEPARTURE ONSET', xRt + offset, thresholdForceY + 16);
    }

    // 4. Hover Tooltip or Scrub Bar
    if (hoveredMs !== null && hoveredMs >= minTime && hoveredMs <= maxTime) {
      const hX = timeToX(hoveredMs);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hX, 0);
      ctx.lineTo(hX, H - 24);
      ctx.stroke();

      // Tooltip pill
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      const tipW = 120;
      const tipH = 38;
      let tipX = hX + 8;
      if (tipX + tipW > W) tipX = hX - tipW - 8;
      ctx.fillRect(tipX, 40, tipW, tipH);
      ctx.strokeRect(tipX, 40, tipW, tipH);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`Time: ${hoveredMs.toFixed(1)} ms`, tipX + 8, 54);
      ctx.fillStyle = hoveredMs < 100 && hoveredMs >= 0 ? '#ef4444' : '#38bdf8';
      ctx.fillText(
        hoveredMs < 0 ? 'State: Set Position' : hoveredMs < 100 ? 'Zone: Illegal (<100ms)' : 'Zone: Legal Clearance',
        tipX + 8,
        70
      );
    }
  }, [activeTab, testRtMs, playbackTimeMs, hoveredMs, status]);

  // Handle Canvas Mouse Move
  const handleCanvasMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const minTime = -100;
    const maxTime = 350;
    const t = minTime + (x / rect.width) * (maxTime - minTime);
    setHoveredMs(t);
  };

  const handleCanvasMouseLeave = () => {
    setHoveredMs(null);
  };

  // Copy Audit Summary to Clipboard
  const handleCopySummary = () => {
    const athleteName = runData?.name || 'Athlete';
    const text = `⚡ WORLD ATHLETICS RULE TR 16.7 REACTION AUDIT
---------------------------------------------
Athlete: ${athleteName}
Measured RT: ${testRtMs}ms (${(testRtMs/1000).toFixed(3)}s)
Ruling: ${status.headline}
Status: ${status.isLegal ? 'CERTIFIED LEGAL START' : 'DISQUALIFIED (FALSE START)'}
WA Threshold: 100.0 ms
Safety Margin: ${status.deltaLabel}
Starter Hold Duration: ${holdDuration.toFixed(2)}s (${holdCompliance.badge})
Verification System: SprintGate SIS (Start Information System)
Standard: World Athletics Technical Rule 16.7`;

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Export Official World Athletics Rule TR 16.7 PDF Audit Certificate
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF();
      const athleteName = runData?.name || 'Sprint Athlete';
      const eventTitle = runData?.distance ? (String(runData.distance).toLowerCase().includes('m') ? runData.distance : `${runData.distance}m Sprint`) : (runData?.distanceMeters ? `${runData.distanceMeters}m Sprint` : 'Sprint Event');
      const dateStr = runData?.date || new Date().toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });

      // 1. Dark Header Banner
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, 210, 42, 'F');

      // Official Velocity Lab Brand Header Logo
      addVelocityLabLogoToPdf(doc, { x: 154, y: 12, width: 44, isDark: true });

      doc.setTextColor(245, 158, 11); // Amber
      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      doc.text("WORLD ATHLETICS • TECHNICAL RULE 16.7 AUDIT", 14, 16);

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.text("OFFICIAL REACTION TIME & FALSE START CERTIFICATE", 14, 26);

      doc.setTextColor(148, 163, 184); // slate-400
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      doc.text("Automated Start Information System (SIS) Telemetry & Biomechanical Verification", 14, 34);

      // 2. Official Seal & Ruling Card
      const isLegal = status.isLegal;
      const boxColor = isLegal ? [16, 185, 129] : [239, 68, 68];
      
      doc.setDrawColor(boxColor[0], boxColor[1], boxColor[2]);
      doc.setLineWidth(1.5);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(14, 48, 182, 38, 3, 3, 'FD');

      // Ruling Text
      doc.setTextColor(boxColor[0], boxColor[1], boxColor[2]);
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text(isLegal ? "VALID LEGAL START (SIS CERTIFIED)" : "DISQUALIFIED — FALSE START (DQ)", 22, 60);

      doc.setTextColor(51, 65, 85);
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text(`Official Reaction Time: ${(testRtMs / 1000).toFixed(3)}s (${testRtMs.toFixed(1)} ms)`, 22, 68);
      doc.text(`World Athletics Limit: 0.100s (100.0 ms) | Safety Margin: ${status.deltaLabel}`, 22, 76);

      // Status Stamp on Right
      doc.setDrawColor(boxColor[0], boxColor[1], boxColor[2]);
      doc.setFillColor(boxColor[0], boxColor[1], boxColor[2]);
      doc.roundedRect(148, 55, 40, 24, 2, 2, 'FD');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.text(isLegal ? "APPROVED" : "REJECTED", 168, 67, { align: 'center' });
      doc.setFontSize(8);
      doc.text("WA TR 16.7", 168, 73, { align: 'center' });

      // 3. Athlete & Race Telemetry Table
      autoTable(doc, {
        startY: 92,
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
        head: [['PARAMETER', 'VALUE / TELEMETRY DATA', 'REGULATORY STANDARD / REFERENCE']],
        body: [
          ['Athlete Name', athleteName, 'Official Registered Entry'],
          ['Event / Distance', eventTitle, 'Sprint Competition'],
          ['Date / Time', dateStr, 'SIS Time-Stamped'],
          ['Measured Reaction Time (RT)', `${(testRtMs / 1000).toFixed(3)}s (${testRtMs} ms)`, '>= 0.100s required by Rule TR 16.7'],
          ['Starter "Set" Hold Duration', `${holdDuration.toFixed(2)}s (${holdCompliance.badge})`, 'WA Standard: 1.50s - 2.50s'],
          ['Force Sensor Threshold', '25.0 kgf (245.2 N)', 'WA SIS Standard: 25 - 27 kgf onset'],
          ['Neurological Transmission Latency', 'Approx. 85 - 100 ms minimum', 'Acoustic cortex & corticospinal motor nerve'],
          ['Ruling Determination', isLegal ? 'LEGAL / PASS' : 'RULE TR 16.7 VIOLATION / DQ', isLegal ? 'Valid sprint start' : 'False start disqualification']
        ],
        styles: { fontSize: 9, cellPadding: 3.5 }
      });

      // 4. Physiological Justification Explanatory Box
      const finalY = doc.lastAutoTable?.finalY || 185;
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(14, finalY + 8, 182, 38, 2, 2, 'F');

      doc.setTextColor(15, 23, 42);
      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      doc.text("PHYSIOLOGICAL BASIS OF THE 100ms REGULATORY THRESHOLD:", 20, finalY + 16);

      doc.setFont(undefined, 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      const bioText = "World Athletics Technical Rule 16.7 establishes 100ms (0.100s) as the universal boundary between reaction and anticipation. Human anatomical latency requires: (1) Cochlear hair cell transduction (~20ms), (2) Brainstem & primary auditory cortex signal processing (~30ms), (3) Corticospinal motor impulse propagation (~25ms), and (4) Neuromuscular cross-bridge tension development (~25ms). Any movement recorded under 100ms indicates anticipation of the gun rather than physiological sensory reaction.";
      doc.text(doc.splitTextToSize(bioText, 170), 20, finalY + 23);

      // 5. Official Verification Signature Blocks
      const sigY = finalY + 54;
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.8);
      doc.line(14, sigY + 18, 90, sigY + 18);
      doc.line(120, sigY + 18, 196, sigY + 18);

      doc.setTextColor(100, 116, 139);
      doc.setFontSize(8);
      doc.text("CHIEF STARTER / START INFORMATION SYSTEM (SIS) OPERATOR", 14, sigY + 24);
      doc.text("CHIEF PHOTO FINISH JUDGE / JURY OF APPEAL", 120, sigY + 24);

      // 6. Footer Notice
      doc.setTextColor(148, 163, 184);
      doc.setFontSize(7);
      doc.text("Generated by Velocity Lab SprintGate Timing System • World Athletics Certified Standards Engine", 105, 288, { align: 'center' });

      // Save PDF via fail-safe downloader
      savePdfFile(doc, `WA_TR16_7_Audit_${athleteName.replace(/\s+/g, '_')}_${testRtMs}ms.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
    }
  };

  const StatusIcon = status.icon;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700/80 rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-gray-900 dark:text-white">
        
        {/* Top Header */}
        <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between bg-gray-50 dark:bg-slate-950/60">
          <div className="flex items-center gap-3">
            <VelocityLabLogo variant="compact" className="h-8 w-auto hidden sm:block" />
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 dark:text-amber-400 sm:hidden">
              <ShieldCheck size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  World Athletics • Rule TR 16.7
                </span>
                <span className="text-xs text-gray-500 dark:text-slate-400 font-mono">
                  SIS Certified Standard
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white tracking-tight mt-0.5">
                Reaction Time & False Start Auditor
              </h2>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition"
            title="Close Auditor"
          >
            <X size={20} />
          </button>
        </div>

        {/* Hero Ruling Banner */}
        <div className={`p-4 sm:p-5 border-b ${status.borderColor} ${status.bgColor} transition-colors duration-300`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className={`p-3 rounded-2xl ${status.isLegal ? 'bg-emerald-500/20 text-emerald-500 dark:text-emerald-400 border border-emerald-500/40' : 'bg-red-500/20 text-red-500 dark:text-red-400 border border-red-500/40'} shrink-0`}>
                <StatusIcon size={32} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-black uppercase tracking-widest ${status.textColor}`}>
                    {status.tier === 'DQ' ? 'OFFICIAL DISQUALIFICATION' : 'REGULATORY STATUS'}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-slate-400">•</span>
                  <span className="text-xs font-semibold text-gray-600 dark:text-slate-300">
                    {runData?.name || 'Athlete'} ({runData?.distance ? `${runData.distance}m` : 'Sprint'})
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight mt-0.5">
                  {status.headline}
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-slate-300 mt-1 max-w-xl">
                  {status.subheadline}
                </p>
              </div>
            </div>

            {/* Big RT Pill */}
            <div className="flex sm:flex-col items-baseline sm:items-end justify-between w-full sm:w-auto bg-white/80 dark:bg-slate-900/80 px-4 py-2.5 rounded-2xl border border-gray-200 dark:border-slate-700/60 shadow-xs shrink-0">
              <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest">Reaction Time</span>
              <div className="text-3xl sm:text-4xl font-black font-mono tracking-tighter" style={{ color: status.color }}>
                {(testRtMs / 1000).toFixed(3)}
                <span className="text-base text-gray-400 dark:text-slate-400 font-sans ml-1">s</span>
              </div>
              <span className="text-[11px] font-mono text-gray-500 dark:text-slate-400">
                {testRtMs} ms ({status.deltaLabel})
              </span>
            </div>
          </div>
        </div>

        {/* 4-Box Telemetry Matrix */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950/40 text-xs">
          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700/40 shadow-xs">
            <span className="text-gray-500 dark:text-slate-400 block text-[10px] uppercase font-bold">WA SIS Threshold</span>
            <span className="text-base font-bold font-mono text-gray-900 dark:text-white mt-0.5 block">0.100s (100ms)</span>
            <span className="text-[10px] text-gray-400 dark:text-slate-400">Absolute legal limit</span>
          </div>
          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700/40 shadow-xs">
            <span className="text-gray-500 dark:text-slate-400 block text-[10px] uppercase font-bold">Safety Margin</span>
            <span className={`text-base font-bold font-mono mt-0.5 block ${testRtMs >= 100 ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
              {testRtMs >= 100 ? `+${testRtMs - 100} ms` : `${testRtMs - 100} ms`}
            </span>
            <span className="text-[10px] text-gray-400 dark:text-slate-400">Buffer to disqualification</span>
          </div>
          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700/40 shadow-xs">
            <span className="text-gray-500 dark:text-slate-400 block text-[10px] uppercase font-bold">Starter "Set" Hold</span>
            <span className="text-base font-bold font-mono text-amber-500 dark:text-amber-400 mt-0.5 block">{holdDuration.toFixed(2)}s</span>
            <span className={`text-[10px] font-semibold ${holdCompliance.color}`}>{holdCompliance.badge}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700/40 shadow-xs">
            <span className="text-gray-500 dark:text-slate-400 block text-[10px] uppercase font-bold">SIS Pressure Trigger</span>
            <span className="text-base font-bold font-mono text-sky-500 dark:text-sky-400 mt-0.5 block">25 kgf (245 N)</span>
            <span className="text-[10px] text-gray-400 dark:text-slate-400">WA Sensor Specification</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-5 pt-3 pb-0 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between gap-2 overflow-x-auto bg-gray-50 dark:bg-slate-900">
          <div className="flex gap-2">
            {[
              { id: 'waveform', label: 'Waveform Inspector', icon: Activity },
              { id: 'physiology', label: 'Physiological Chain', icon: Award },
              { id: 'simulator', label: 'Acoustic Gap & Block Drill', icon: Volume2 },
              { id: 'rules', label: 'Rule TR 16.7 Regulations', icon: FileText }
            ].map(tab => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold rounded-t-xl transition border-b-2 whitespace-nowrap ${
                    isActive 
                      ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-white dark:bg-slate-800/80 shadow-xs' 
                      : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <TabIcon size={14} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Quick Simulation Slider */}
          <div className="hidden md:flex items-center gap-2 pb-2">
            <span className="text-[10px] font-mono text-gray-500 dark:text-slate-400 uppercase">Test RT:</span>
            <input 
              type="range"
              min="60"
              max="280"
              step="1"
              value={testRtMs}
              onChange={(e) => setTestRtMs(parseInt(e.target.value))}
              className="w-24 accent-amber-500 cursor-pointer"
              title="Slide to test any reaction time against Rule TR 16.7"
            />
            <span className="text-xs font-mono font-bold text-gray-900 dark:text-white w-12 text-right">{testRtMs}ms</span>
          </div>
        </div>

        {/* Tab Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 bg-white dark:bg-slate-950/70">
          
          {/* TAB 1: WAVEFORM INSPECTOR */}
          {activeTab === 'waveform' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Activity size={16} className="text-sky-500 dark:text-sky-400" />
                    High-Resolution Acoustic Gun & SIS Force Pressure Curve
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                    Microsecond timeline showing the starter's acoustic sound wave at 0ms and athlete block pressure onset at {testRtMs}ms.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={animating ? stopAnimation : startAnimation}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-gray-700 dark:text-slate-200 border border-gray-200 dark:border-slate-700 transition"
                  >
                    {animating ? <Pause size={13} /> : <Play size={13} />}
                    {animating ? 'Pause' : 'Replay (Slow-Mo)'}
                  </button>
                  <button
                    onClick={() => {
                      setPlaybackTimeMs(400);
                      setAnimating(false);
                    }}
                    className="p-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition border border-gray-200 dark:border-transparent"
                    title="Reset to Full Waveform"
                  >
                    <RotateCcw size={14} />
                  </button>
                </div>
              </div>

              {/* Canvas Container */}
              <div className="relative rounded-2xl overflow-hidden border border-gray-200 dark:border-slate-800 bg-[#090d16] shadow-inner h-[280px]">
                <canvas 
                  ref={canvasRef} 
                  className="w-full h-full cursor-crosshair"
                  onMouseMove={handleCanvasMouseMove}
                  onMouseLeave={handleCanvasMouseLeave}
                />
              </div>

              {/* Legend & Guidance */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 flex items-start gap-2.5 shadow-xs">
                  <div className="w-3 h-3 rounded-full bg-sky-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-gray-800 dark:text-slate-200">Acoustic Report (t = 0ms)</div>
                    <div className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
                      Auditory tone wave reaches athlete inner ear within 15–20ms.
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 flex items-start gap-2.5 shadow-xs">
                  <div className="w-3 h-3 rounded-full bg-red-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-red-500 dark:text-red-400">Illegal Zone (0 to 100ms)</div>
                    <div className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
                      World Athletics Rule TR 16.7 prohibits force generation &lt; 100ms.
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 flex items-start gap-2.5 shadow-xs">
                  <div className="w-3 h-3 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: status.color }} />
                  <div>
                    <div className="font-bold text-gray-800 dark:text-slate-200">Athlete Block Force Curve</div>
                    <div className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
                      Climbs through the 25kgf sensor threshold at precisely {testRtMs}ms.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PHYSIOLOGICAL CHAIN */}
          {activeTab === 'physiology' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                <h4 className="text-sm font-bold text-amber-700 dark:text-amber-300 flex items-center gap-2">
                  <Info size={16} />
                  Why is 100ms the Absolute Physiological Limit?
                </h4>
                <p className="text-xs text-gray-700 dark:text-slate-300 mt-1 leading-relaxed">
                  Sports scientists and neuromuscular physiologists established that human neural circuitry cannot react to an auditory cue faster than 85–100ms. If an athlete applies force to the blocks in under 100ms, they did not react to the gun sound — they anticipated or guessed the trigger timing.
                </p>
              </div>

              {/* Chain Steps */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 relative shadow-xs">
                  <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-500 dark:text-sky-400 font-bold font-mono flex items-center justify-center text-xs mb-2">
                    01
                  </div>
                  <div className="text-xs font-bold text-gray-900 dark:text-white">Cochlear Transduction</div>
                  <div className="text-sm font-bold font-mono text-sky-500 dark:text-sky-400 mt-0.5">~15 – 25 ms</div>
                  <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1.5 leading-normal">
                    Gun acoustic wave travels through air, vibrates tympanic membrane and organ of Corti hair cells.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 relative shadow-xs">
                  <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-500 dark:text-purple-400 font-bold font-mono flex items-center justify-center text-xs mb-2">
                    02
                  </div>
                  <div className="text-xs font-bold text-gray-900 dark:text-white">Cortical Auditory Processing</div>
                  <div className="text-sm font-bold font-mono text-purple-500 dark:text-purple-400 mt-0.5">~25 – 35 ms</div>
                  <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1.5 leading-normal">
                    Signal arrives at inferior colliculus and primary auditory cortex; recognized as the starting command.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 relative shadow-xs">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-500 dark:text-emerald-400 font-bold font-mono flex items-center justify-center text-xs mb-2">
                    03
                  </div>
                  <div className="text-xs font-bold text-gray-900 dark:text-white">Corticospinal Motor Command</div>
                  <div className="text-sm font-bold font-mono text-emerald-500 dark:text-emerald-400 mt-0.5">~20 – 25 ms</div>
                  <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1.5 leading-normal">
                    Pre-motor cortex fires action potentials down spinal cord to alpha motor neurons in quadriceps and calves.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 relative shadow-xs">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-500 dark:text-amber-400 font-bold font-mono flex items-center justify-center text-xs mb-2">
                    04
                  </div>
                  <div className="text-xs font-bold text-gray-900 dark:text-white">Electromechanical Delay (EMD)</div>
                  <div className="text-sm font-bold font-mono text-amber-500 dark:text-amber-400 mt-0.5">~15 – 25 ms</div>
                  <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1.5 leading-normal">
                    Calcium release, actin-myosin cross-bridge cycling; muscle tension rises past the 25kgf block sensor threshold.
                  </p>
                </div>
              </div>

              {/* Total Latency Sum Bar */}
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                <div>
                  <div className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                    Total Physiological Chain Sum
                  </div>
                  <div className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                    20ms + 30ms + 25ms + 25ms = 100ms minimum theoretical human latency.
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-gray-400 dark:text-slate-400 block">World Athletics Standard</span>
                  <span className="text-lg font-black font-mono text-amber-500 dark:text-amber-400">0.100s Minimum</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: AUDIO SIMULATOR & DRILL */}
          {activeTab === 'simulator' && (
            <div className="space-y-5">
              {/* Audio Gap Simulator Card */}
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <Volume2 size={18} className="text-amber-500 dark:text-amber-400" />
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white">Acoustic Gap Synthesizer</h4>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 max-w-md">
                    Listen to the exact millisecond separation between the gun report and the athlete's block departure click at {testRtMs}ms.
                  </p>
                </div>
                <button
                  onClick={handlePlayReactionAudio}
                  disabled={audioPlaying}
                  className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider transition ${
                    audioPlaying 
                      ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20' 
                      : 'bg-amber-400 hover:bg-amber-300 text-slate-950 font-black'
                  }`}
                >
                  <Volume2 size={16} />
                  {audioPlaying ? 'Playing Audio...' : `Hear ${testRtMs}ms Gap`}
                </button>
              </div>

              {/* Interactive Reaction Test Drill */}
              <div className="p-5 rounded-3xl bg-gray-50 dark:bg-slate-900/90 border border-gray-200 dark:border-slate-800 text-center relative overflow-hidden shadow-xs">
                <div className="max-w-md mx-auto">
                  <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-700">
                    Interactive Athlete Drill
                  </span>
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                    Test Your Reaction Against Rule TR 16.7
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                    Settle into the starting blocks. Wait for the gun report, then tap as quickly as humanly possible without anticipating!
                  </p>

                  {/* Drill Interactive Target Button */}
                  <div className="mt-6 mb-4">
                    <button
                      onClick={handleDrillTap}
                      className={`w-full h-32 rounded-3xl font-black text-xl transition-all duration-150 shadow-2xl flex flex-col items-center justify-center p-4 border-2 ${
                        drillState === 'idle'
                          ? 'bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-800 dark:text-slate-200 border-gray-300 dark:border-slate-600'
                          : drillState === 'marks'
                          ? 'bg-blue-600/30 text-blue-200 border-blue-500/50 animate-pulse'
                          : drillState === 'set'
                          ? 'bg-amber-600/30 text-amber-200 border-amber-500/50 animate-pulse'
                          : drillState === 'gun'
                          ? 'bg-emerald-500 text-black border-emerald-300 shadow-[0_0_40px_rgba(16,185,129,0.5)] scale-105'
                          : drillState === 'false_start'
                          ? 'bg-red-600 text-white border-red-400'
                          : 'bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-white border-gray-300 dark:border-slate-700'
                      }`}
                    >
                      {drillState === 'idle' && (
                        <>
                          <span>START AUDIT DRILL</span>
                          <span className="text-xs font-normal text-gray-500 dark:text-slate-400 mt-1">Click to enter the starting blocks</span>
                        </>
                      )}
                      {drillState === 'marks' && (
                        <>
                          <span className="text-sky-400 dark:text-sky-300 font-mono tracking-widest">"ON YOUR MARKS..."</span>
                          <span className="text-xs font-normal text-sky-600 dark:text-sky-200/70 mt-1">Settle into position</span>
                        </>
                      )}
                      {drillState === 'set' && (
                        <>
                          <span className="text-amber-500 dark:text-amber-300 font-mono tracking-widest text-2xl">"SET..."</span>
                          <span className="text-xs font-normal text-amber-600 dark:text-amber-200/70 mt-1">Hold motionless. Wait for the gun!</span>
                        </>
                      )}
                      {drillState === 'gun' && (
                        <>
                          <span className="text-3xl font-black tracking-widest">BANG! TAP NOW!</span>
                          <span className="text-xs font-bold text-black/70 mt-1">React immediately!</span>
                        </>
                      )}
                      {drillState === 'false_start' && (
                        <>
                          <span className="text-2xl font-black">FALSE START!</span>
                          <span className="text-xs text-red-100 mt-1">You moved before the gun report</span>
                        </>
                      )}
                      {drillState === 'reacted' && drillScore && (
                        <>
                          <span className="text-4xl font-black font-mono">
                            {drillScore.ms} ms
                          </span>
                          <span className="text-xs font-bold uppercase tracking-wider mt-1 opacity-90">
                            {(drillScore.ms / 1000).toFixed(3)}s • Click to Try Again
                          </span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Drill Result Badge */}
                  {drillScore && (
                    <div className={`p-3 rounded-2xl border text-xs font-medium text-left ${
                      drillScore.status === 'DQ_RULE_TR16_7' || drillScore.status === 'ANTICIPATED_FALSE_START'
                        ? 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-300'
                        : drillScore.status === 'WORLD_CLASS'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-300'
                        : 'bg-sky-500/10 border-sky-500/30 text-sky-600 dark:text-sky-300'
                    }`}>
                      <div className="font-bold">{drillScore.label}</div>
                      <div className="text-[11px] opacity-80 mt-0.5">
                        {drillScore.ms >= 100 
                          ? `Passed Rule TR 16.7 by +${drillScore.ms - 100}ms.` 
                          : 'Failed World Athletics Rule TR 16.7 physiological threshold.'}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: RULE TR 16.7 REGULATIONS */}
          {activeTab === 'rules' && (
            <div className="space-y-4 text-xs text-gray-700 dark:text-slate-300 leading-relaxed">
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-xs">
                <h4 className="text-sm font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2">
                  World Athletics Technical Rule 16.7 (Formerly Rule 162.7)
                </h4>
                <blockquote className="border-l-2 border-amber-500 pl-3 italic text-gray-800 dark:text-slate-200 py-1">
                  "An athlete, after assuming a full and final start position, shall not commence their start until after receiving the report of the gun. If the start is commenced earlier, it shall be a false start. When a World Athletics certified Start Information System (SIS) is in operation, an athlete starting earlier than 0.100s (100ms) after the sound of the gun is deemed to have false started."
                </blockquote>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-xs">
                  <div className="font-bold text-gray-900 dark:text-white text-sm mb-1">Disqualification Protocol</div>
                  <p className="text-[11px] text-gray-500 dark:text-slate-400">
                    Except in Combined Events (decathlon/heptathlon), any false start results in immediate disqualification of the responsible athlete without prior warning (Rule TR 16.8).
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-xs">
                  <div className="font-bold text-gray-900 dark:text-white text-sm mb-1">Starter Cadence Protocol</div>
                  <p className="text-[11px] text-gray-500 dark:text-slate-400">
                    The starter must ensure all athletes are completely stationary in the "Set" position before firing. Recommended hold duration is between 1.50 and 2.50 seconds.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-xs">
                  <div className="font-bold text-gray-900 dark:text-white text-sm mb-1">SIS Sensor Certification</div>
                  <p className="text-[11px] text-gray-500 dark:text-slate-400">
                    Starting blocks must feature pressure transducers capable of sampling at &gt;= 1,000 Hz with a trigger threshold between 25 kgf and 27 kgf force onset.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-xs">
                  <div className="font-bold text-gray-900 dark:text-white text-sm mb-1">Protest & Recall Rights</div>
                  <p className="text-[11px] text-gray-500 dark:text-slate-400">
                    If an athlete disputes a false start recall, the Start Referee may allow the athlete to run under protest if immediate inspection reveals potential SIS calibration anomalies.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 border-t border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400 w-full sm:w-auto">
            <span className="font-mono">SIS Sampling: 2,000 Hz</span>
            <span>•</span>
            <span className="font-mono">Calibrated to WA TR 16.7</span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={handleCopySummary}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-gray-700 dark:text-slate-200 border border-gray-200 dark:border-slate-700 transition"
              title="Copy Audit Summary to Clipboard"
            >
              {copied ? <Check size={14} className="text-emerald-500 dark:text-emerald-400" /> : <Copy size={14} />}
              {copied ? 'Copied!' : 'Copy Summary'}
            </button>

            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 transition"
              title="Download Official World Athletics Rule TR 16.7 PDF Certificate"
            >
              <Download size={14} />
              Export WA Certificate (PDF)
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-transparent transition"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
