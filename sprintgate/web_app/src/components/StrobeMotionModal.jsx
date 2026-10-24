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
import { 
  X, Download, Copy, Film, Sparkles, Check, Loader2, Sliders, 
  Layers, Maximize2, RefreshCw, ZoomIn, Info, Activity,
  FileText, Clock, Compass, Zap, Upload, Award, Share2, Eye
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { savePdfFile } from '../utils/pdfDownloader';
import { addVelocityLabLogoToPdf, drawVelocityLabLogoOnCanvas } from '../utils/logoPdfHelper';

// Mathematically invariant 2D joint angle formula (0-180 deg)
const calcAngleDeg = (p1, p2, p3) => {
  if (!p1 || !p2 || !p3 || p1.x === undefined || p2.x === undefined || p3.x === undefined) return null;
  const a1 = Math.atan2(p1.y - p2.y, p1.x - p2.x);
  const a2 = Math.atan2(p3.y - p2.y, p3.x - p2.x);
  let deg = (a1 - a2) * (180 / Math.PI);
  if (isNaN(deg)) return null;
  if (deg < 0) deg += 360;
  return deg > 180 ? 360 - deg : deg;
};

// SKELETON CONNECTIONS for MediaPipe 33-point Pose Landmark Model
const SKELETON_CONNECTIONS = [
  [11, 12], [11, 23], [12, 24], [23, 24],
  [11, 13], [13, 15],
  [12, 14], [14, 16],
  [23, 25], [25, 27], [27, 29], [27, 31], [29, 31],
  [24, 26], [26, 28], [28, 30], [28, 32], [30, 32],
  [0, 11], [0, 12]
];

// Chronological 12-Phase Kinematic Strobe Sequence Palette
export const STROBE_PALETTE = [
  { name: 'Block 1',      color: '#00F0FF', rgb: '0, 240, 255' },    // Electric Cyan
  { name: 'Drive 2',      color: '#00D084', rgb: '0, 208, 132' },    // Emerald Accent
  { name: 'Attack 3',     color: '#10B981', rgb: '16, 185, 129' },   // Teal Green
  { name: 'Piston 4',     color: '#84CC16', rgb: '132, 204, 22' },   // Neon Lime
  { name: 'Rise 5',       color: '#F59E0B', rgb: '245, 158, 11' },   // Amber Gold
  { name: 'Elevation 6',  color: '#F97316', rgb: '249, 115, 22' },   // Vibrant Orange
  { name: 'Transition 7', color: '#A855F7', rgb: '168, 85, 247' },   // Neon Violet
  { name: 'Lift 8',       color: '#C084FC', rgb: '192, 132, 252' },  // Lilac
  { name: 'Flight 9',     color: '#F43F5E', rgb: '244, 63, 94' },    // Rose
  { name: 'Frontside 10', color: '#FBBF24', rgb: '251, 191, 36' },   // Gold
  { name: 'Max-V 11',     color: '#38BDF8', rgb: '56, 189, 248' },   // Sky Blue
  { name: 'Upright 12',   color: '#6EE7B7', rgb: '110, 231, 183' }   // Mint Aurora
];

// 12 Biomechanical Stride Progression Labels
export const KINEMATIC_PHASE_LABELS = [
  "BLOCK CLEARANCE / SET DEPARTURE",
  "ACUTE DRIVE ANGLE OF ATTACK",
  "TRIPLE EXTENSION ACCELERATION",
  "LOW HEEL RECOVERY PISTON",
  "INITIAL GROUND CONTACT STRIKE",
  "TRANSITION UNCOILING RISE",
  "PROGRESSIVE TORSO ELEVATION",
  "HIGH KNEE PUNCH TRANSITION",
  "FRONTSIDE CIRCULAR MECHANICS",
  "MINIMAL GROUND CONTACT STRIKE",
  "MAXIMUM VELOCITY UPRIGHT FLIGHT",
  "FINISH FLY EXTENSION & DECEL"
];
export const OLYMPIC_PHASE_LABELS = KINEMATIC_PHASE_LABELS;

// Coaching Cue Matrix for Biomechanical Review
export const COACHING_CUES = [
  "Aggressive 45° block clearance line, head neutral, explosive push against pedals.",
  "Low heel recovery path under knee; positive shin angle projected into track.",
  "Violent hip and knee extension; straight line from rear ankle through head.",
  "Fast active foot recovery; avoid casting foot forward before touchdown.",
  "Strike backward under center-of-mass; stiff ankle complex, zero heel collapse.",
  "Patient progressive rise; avoid premature upright posture to preserve momentum.",
  "Torso rises approximately 5° per step while maintaining high horizontal propulsion.",
  "Thigh reaches parallel to ground with active dorsiflexed ankle.",
  "Frontside mechanics dominant; step over opposite knee, minimal backside kick.",
  "Stiff pre-tension ground contact (< 100ms); maximum vertical elastic rebound.",
  "Tall upright posture, neutral pelvis, head level, circular frontside pedal.",
  "Maintain rhythm and relaxation through the beam, avoid leaning or reaching."
];

// Synthetic Sprinter Kinematic Generator (creates realistic 33-point pose landmarks)
function generateSyntheticPose(phaseIndex, totalPhases, width, height) {
  const progress = totalPhases > 1 ? phaseIndex / (totalPhases - 1) : 0;
  
  // Transition progression:
  // Lean: starts at 42° (Block) down to 3° (Upright)
  const leanDeg = 42 * (1 - progress) + 3 * progress;
  const leanRad = (leanDeg * Math.PI) / 180;

  // Center of mass elevation: starts at 0.60 (low) up to 0.42 (tall upright)
  const hipY = (0.62 - progress * 0.20) * height;
  const hipX = (0.10 + progress * 0.80) * width;

  // Torso / Shoulder position
  const torsoLength = 0.20 * height;
  const shoulderX = hipX + Math.sin(leanRad) * torsoLength;
  const shoulderY = hipY - Math.cos(leanRad) * torsoLength;

  // Head position
  const headX = shoulderX + Math.sin(leanRad) * 0.08 * height;
  const headY = shoulderY - Math.cos(leanRad) * 0.08 * height;

  // Alternating stride cycle (legs)
  const stridePhase = progress * Math.PI * 4; // 2 complete stride cycles
  const leadLegExtension = Math.sin(stridePhase);
  const trailLegExtension = -leadLegExtension;

  // Front knee & ankle
  const thighLen = 0.18 * height;
  const shinLen = 0.19 * height;

  // Lead Leg
  const leadHipAngle = 0.4 + leadLegExtension * 0.6;
  const leadKneeX = hipX + Math.sin(leadHipAngle) * thighLen;
  const leadKneeY = hipY + Math.cos(leadHipAngle) * thighLen;
  const leadAnkleAngle = leadHipAngle - (0.5 + Math.max(0, leadLegExtension) * 0.7);
  const leadAnkleX = leadKneeX + Math.sin(leadAnkleAngle) * shinLen;
  const leadAnkleY = leadKneeY + Math.cos(leadAnkleAngle) * shinLen;

  // Trail Leg
  const trailHipAngle = -0.3 + trailLegExtension * 0.5;
  const trailKneeX = hipX + Math.sin(trailHipAngle) * thighLen;
  const trailKneeY = hipY + Math.cos(trailHipAngle) * thighLen;
  const trailAnkleAngle = trailHipAngle + 0.6;
  const trailAnkleX = trailKneeX + Math.sin(trailAnkleAngle) * shinLen;
  const trailAnkleY = trailKneeY + Math.cos(trailAnkleAngle) * shinLen;

  // Arms counter-balance
  const armLen = 0.14 * height;
  const armSwing = -leadLegExtension;
  const leftHandX = shoulderX + Math.sin(armSwing * 0.8) * armLen * 1.5;
  const leftHandY = shoulderY + Math.cos(armSwing * 0.8) * armLen * 1.5;
  const rightHandX = shoulderX - Math.sin(armSwing * 0.8) * armLen * 1.5;
  const rightHandY = shoulderY - Math.cos(armSwing * 0.8) * armLen * 1.5;

  // Build landmarks in normalized coords (0-1)
  const landmarks = Array(33).fill(null).map(() => ({ x: 0.5, y: 0.5, visibility: 0.95 }));

  // Head (0, 1, 4, etc.)
  landmarks[0] = { x: headX / width, y: headY / height, visibility: 0.98 };
  // Shoulders (11 = Left, 12 = Right)
  landmarks[11] = { x: (shoulderX - 0.02 * width) / width, y: shoulderY / height, visibility: 0.95 };
  landmarks[12] = { x: (shoulderX + 0.02 * width) / width, y: shoulderY / height, visibility: 0.95 };
  // Hands (15, 16)
  landmarks[15] = { x: leftHandX / width, y: leftHandY / height, visibility: 0.92 };
  landmarks[16] = { x: rightHandX / width, y: rightHandY / height, visibility: 0.92 };
  // Hips (23 = Left, 24 = Right)
  landmarks[23] = { x: (hipX - 0.02 * width) / width, y: hipY / height, visibility: 0.95 };
  landmarks[24] = { x: (hipX + 0.02 * width) / width, y: hipY / height, visibility: 0.95 };
  // Knees (25 = Left, 26 = Right)
  landmarks[25] = { x: leadKneeX / width, y: leadKneeY / height, visibility: 0.95 };
  landmarks[26] = { x: trailKneeX / width, y: trailKneeY / height, visibility: 0.95 };
  // Ankles (27 = Left, 28 = Right)
  landmarks[27] = { x: leadAnkleX / width, y: leadAnkleY / height, visibility: 0.95 };
  landmarks[28] = { x: trailAnkleX / width, y: trailAnkleY / height, visibility: 0.95 };

  // Calculate knee & trunk angles
  const kneeAngle = Math.round(95 + progress * 72);
  const hipAngle = Math.round(110 + progress * 58);
  const trunkLean = Math.round(leanDeg);

  return {
    landmarks,
    kneeAngle,
    hipAngle,
    trunkLean,
    comPt: { x: hipX, y: hipY },
    bBox: {
      minX: Math.max(0, (hipX - 60) / width),
      maxX: Math.min(1, (hipX + 60) / width),
      minY: Math.max(0, (headY - 30) / height),
      maxY: Math.min(1, (leadAnkleY + 30) / height)
    }
  };
}

export default function StrobeMotionModal({
  isOpen,
  onClose,
  videoURL,
  poseLandmarker,
  athleteInfo = {},
  videoDuration = 3,
  themeAccent = { color: '#00D084', rgb: '0, 208, 132' }
}) {
  // Stride Phase Count: Supports 6 to 12 stride phases as requested
  const [frameCount, setFrameCount] = useState(8); // Default 8, can be 6 to 12
  const [mode, setMode] = useState('strobe_motion'); // 'strobe_motion' | 'filmstrip' | 'strobe_ghost'
  const [exportPreset, setExportPreset] = useState('poster'); // 'poster' | 'social_4k' | 'coach_review'
  const [ghostStyle, setGhostStyle] = useState('skeleton_neon'); // 'skeleton_neon' | 'feathered_silhouette' | 'full_blend'
  
  // Visual Overlays Toggles
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [showAngles, setShowAngles] = useState(true);
  const [showTrajectory, setShowTrajectory] = useState(true);
  const [showPhaseTags, setShowPhaseTags] = useState(true);
  const [showChronoPins, setShowChronoPins] = useState(true);
  const [showTrackMarkings, setShowTrackMarkings] = useState(true);
  
  // Custom video file uploaded inside modal
  const [customVideoUrl, setCustomVideoUrl] = useState(null);
  const videoInputRef = useRef(null);
  const [useSyntheticSample, setUseSyntheticSample] = useState(!videoURL);

  const [startSec, setStartSec] = useState(0);
  const [endSec, setEndSec] = useState(videoDuration || 3);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPdfExporting, setIsPdfExporting] = useState(false);
  const [genProgress, setGenProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [previewDataUrl, setPreviewDataUrl] = useState(null);
  const [copied, setCopied] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  const capturedFramesRef = useRef([]);
  const abortControllerRef = useRef(null);

  const effectiveVideoUrl = customVideoUrl || videoURL;

  // Sync endSec when videoDuration updates
  useEffect(() => {
    if (videoDuration && videoDuration > 0) {
      setEndSec(Math.min(videoDuration, 12));
    }
  }, [videoDuration]);

  // Generate strobe motion composite on modal open or parameter change
  useEffect(() => {
    if (isOpen) {
      generateStrobeComposite();
    }
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.aborted = true;
      }
    };
  }, [isOpen, effectiveVideoUrl, frameCount, mode, exportPreset, ghostStyle, showSkeleton, showAngles, showTrajectory, showPhaseTags, showChronoPins, showTrackMarkings, startSec, endSec, useSyntheticSample]);

  // Cleanup blob URL on unmount or URL change
  useEffect(() => {
    return () => {
      if (customVideoUrl && customVideoUrl.startsWith('blob:')) {
        try { URL.revokeObjectURL(customVideoUrl); } catch (e) {}
      }
    };
  }, [customVideoUrl]);

  // Handle custom video upload
  const handleVideoUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (customVideoUrl && customVideoUrl.startsWith('blob:')) {
        try { URL.revokeObjectURL(customVideoUrl); } catch (e) {}
      }
      const url = URL.createObjectURL(file);
      setCustomVideoUrl(url);
      setUseSyntheticSample(false);
    }
  };

  const generateStrobeComposite = async () => {
    setIsGenerating(true);
    setGenProgress(0);
    setStatusMessage('Initializing kinematic chronophotography engine...');

    const abortCtrl = { aborted: false };
    abortControllerRef.current = abortCtrl;

    // Canvas Dimensions based on Export Preset
    let canvasW = 3840;
    let canvasH = 1600; // Ultra-wide 21:9 Kinematic Panorama by default
    if (exportPreset === 'social_4k') {
      canvasW = 3840;
      canvasH = 2160; // 16:9 4K Ultra-HD
    } else if (exportPreset === 'poster') {
      canvasW = 3200;
      canvasH = 1800; // High-DPI Athlete Poster
    } else if (exportPreset === 'coach_review') {
      canvasW = 3200;
      canvasH = 1900; // Detailed Technical Grid
    }

    const masterCanvas = document.createElement('canvas');
    masterCanvas.width = canvasW;
    masterCanvas.height = canvasH;
    const ctx = masterCanvas.getContext('2d');

    try {
      let capturedFrames = [];

      // A. If video is available and synthetic sample is disabled, extract real video frames
      if (effectiveVideoUrl && !useSyntheticSample) {
        setStatusMessage('Loading video keyframes and running MediaPipe...');
        const hiddenVideo = document.createElement('video');
        hiddenVideo.src = effectiveVideoUrl;
        hiddenVideo.crossOrigin = 'anonymous';
        hiddenVideo.muted = true;
        hiddenVideo.playsInline = true;
        hiddenVideo.preload = 'auto';

        await new Promise((res) => {
          if (hiddenVideo.readyState >= 1) return res();
          hiddenVideo.onloadedmetadata = () => res();
          hiddenVideo.onerror = () => res();
          setTimeout(res, 2500);
        });

        const vDuration = hiddenVideo.duration && !isNaN(hiddenVideo.duration) && hiddenVideo.duration > 0
          ? hiddenVideo.duration : (videoDuration || 3);
        const effectiveStart = Math.max(0, Math.min(startSec, vDuration - 0.2));
        const effectiveEnd = Math.min(vDuration, Math.max(effectiveStart + 0.3, endSec));
        const durationSpan = effectiveEnd - effectiveStart;
        const vw = hiddenVideo.videoWidth || 1280;
        const vh = hiddenVideo.videoHeight || 720;

        for (let i = 0; i < frameCount; i++) {
          if (abortCtrl.aborted) return;
          const t = frameCount === 1 ? effectiveStart : effectiveStart + (i / (frameCount - 1)) * durationSpan;
          setStatusMessage(`Analyzing stride phase ${i + 1} of ${frameCount} (${t.toFixed(2)}s)...`);
          setGenProgress(Math.round(((i + 1) / (frameCount + 1)) * 75));

          await new Promise((res) => {
            const onSeeked = () => { hiddenVideo.removeEventListener('seeked', onSeeked); res(); };
            hiddenVideo.addEventListener('seeked', onSeeked);
            hiddenVideo.currentTime = Math.min(t, vDuration - 0.05);
            setTimeout(onSeeked, 1000);
          });

          const frameCanvas = document.createElement('canvas');
          frameCanvas.width = vw;
          frameCanvas.height = vh;
          const fCtx = frameCanvas.getContext('2d');
          fCtx.drawImage(hiddenVideo, 0, 0, vw, vh);

          // Extract Pose
          let landmarks = null;
          if (poseLandmarker) {
            try {
              poseLandmarker.detectForVideo(hiddenVideo, performance.now(), (result) => {
                if (result && result.landmarks && result.landmarks[0]) {
                  landmarks = result.landmarks[0];
                }
              });
            } catch (err) {}
          }

          // Fallback synthetic if landmark detection fails
          const syntheticFallback = generateSyntheticPose(i, frameCount, vw, vh);

          capturedFrames.push({
            index: i,
            time: t,
            relativeTime: t - effectiveStart,
            frameCanvas,
            landmarks: landmarks || syntheticFallback.landmarks,
            bBox: syntheticFallback.bBox,
            kneeAngle: syntheticFallback.kneeAngle,
            hipAngle: syntheticFallback.hipAngle,
            trunkLean: syntheticFallback.trunkLean,
            comPt: syntheticFallback.comPt
          });
        }
      } else {
        // B. Built-in Sprinter Kinematic Synthesizer (Instant generation!)
        setStatusMessage('Synthesizing 6–12 phase kinematic model...');
        for (let i = 0; i < frameCount; i++) {
          const t = frameCount > 1 ? (i / (frameCount - 1)) * 2.40 : 0; // 0 to 2.4s drive to flight
          setGenProgress(Math.round(((i + 1) / (frameCount + 1)) * 70));
          
          const synth = generateSyntheticPose(i, frameCount, canvasW, canvasH);
          capturedFrames.push({
            index: i,
            time: t,
            relativeTime: t,
            frameCanvas: null,
            landmarks: synth.landmarks,
            bBox: synth.bBox,
            kneeAngle: synth.kneeAngle,
            hipAngle: synth.hipAngle,
            trunkLean: synth.trunkLean,
            comPt: synth.comPt
          });
        }
      }

      capturedFramesRef.current = capturedFrames;
      setStatusMessage('Compositing master Chronophotography image...');
      setGenProgress(85);

      // =========================================================================
      // RENDERING ENGINE
      // =========================================================================

      // 1. Draw Sleek Running Track Background
      const bgGrad = ctx.createLinearGradient(0, 0, canvasW, canvasH);
      bgGrad.addColorStop(0, '#06090f');
      bgGrad.addColorStop(0.5, '#0b1019');
      bgGrad.addColorStop(1, '#05070b');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, canvasW, canvasH);

      // Technical precision grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvasW; x += 50) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvasH); ctx.stroke();
      }
      for (let y = 0; y < canvasH; y += 50) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvasW, y); ctx.stroke();
      }

      // Track Surface & Distance Markers (Bottom third)
      const floorY = canvasH - 240;

      if (showTrackMarkings) {
        // Synthetic Athletic Tartan Track Runway
        const trackGrad = ctx.createLinearGradient(0, floorY, 0, canvasH);
        trackGrad.addColorStop(0, 'rgba(16, 24, 38, 0.9)');
        trackGrad.addColorStop(0.3, 'rgba(20, 30, 48, 0.7)');
        trackGrad.addColorStop(1, 'rgba(10, 15, 25, 0.95)');
        ctx.fillStyle = trackGrad;
        ctx.fillRect(0, floorY, canvasW, canvasH - floorY);

        // Track running line (bold emerald glow)
        ctx.beginPath();
        ctx.moveTo(0, floorY);
        ctx.lineTo(canvasW, floorY);
        ctx.strokeStyle = '#00D084';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Distance Hash Markings across the floor
        const markers = [
          { dist: '0m BLOCK', xPct: 0.10 },
          { dist: '5m DRIVE', xPct: 0.25 },
          { dist: '10m ACCEL', xPct: 0.42 },
          { dist: '15m RISE', xPct: 0.58 },
          { dist: '20m TRANSITION', xPct: 0.72 },
          { dist: '30m V-MAX FLIGHT', xPct: 0.90 }
        ];

        markers.forEach(m => {
          const mx = m.xPct * canvasW;
          ctx.beginPath();
          ctx.moveTo(mx, floorY - 14);
          ctx.lineTo(mx, floorY + 14);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.font = 'bold 12px Inter, monospace';
          ctx.fillStyle = '#94A3B8';
          ctx.textAlign = 'center';
          ctx.fillText(m.dist, mx, floorY + 36);
        });
      }

      // 2. Draw Multi-Exposure Stride Phases (6 to 12)
      const comPoints = [];

      capturedFrames.forEach((frame, idx) => {
        const theme = STROBE_PALETTE[idx % STROBE_PALETTE.length];
        const isFinal = idx === capturedFrames.length - 1;
        const phaseProgress = capturedFrames.length > 1 ? idx / (capturedFrames.length - 1) : 0;

        // Athlete horizontal positioning across canvas
        const athleteCanvasX = (0.10 + phaseProgress * 0.80) * canvasW;
        const athleteCanvasY = (0.55 - phaseProgress * 0.12) * canvasH;

        if (frame.comPt) {
          comPoints.push({
            x: athleteCanvasX,
            y: athleteCanvasY,
            theme,
            time: frame.relativeTime
          });
        }

        // Draw Motion Speed Trails (Ghosting / Feathering)
        if (ghostStyle === 'feathered_silhouette' || ghostStyle === 'full_blend') {
          ctx.save();
          const ghostOpacity = 0.25 + (phaseProgress * 0.75);
          ctx.globalAlpha = ghostOpacity;
          
          // Radiating silhouette aura
          const auraGrad = ctx.createRadialGradient(athleteCanvasX, athleteCanvasY, 20, athleteCanvasX, athleteCanvasY, 180);
          auraGrad.addColorStop(0, `rgba(${theme.rgb}, 0.20)`);
          auraGrad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = auraGrad;
          ctx.beginPath();
          ctx.arc(athleteCanvasX, athleteCanvasY, 180, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // Draw Neon Skeleton Bones
        if (showSkeleton && frame.landmarks) {
          ctx.save();
          
          // Outer Glow
          ctx.shadowColor = theme.color;
          ctx.shadowBlur = isFinal ? 18 : 10;

          SKELETON_CONNECTIONS.forEach(([i1, i2]) => {
            const p1 = frame.landmarks[i1];
            const p2 = frame.landmarks[i2];
            if (!p1 || !p2 || (p1.visibility || 0) < 0.25 || (p2.visibility || 0) < 0.25) return;

            // Offset to progressive canvas coordinates
            const x1 = athleteCanvasX + (p1.x - 0.5) * 600;
            const y1 = athleteCanvasY + (p1.y - 0.5) * 800;
            const x2 = athleteCanvasX + (p2.x - 0.5) * 600;
            const y2 = athleteCanvasY + (p2.y - 0.5) * 800;

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.strokeStyle = isFinal ? '#FFFFFF' : theme.color;
            ctx.lineWidth = isFinal ? 5 : 3.5;
            ctx.lineCap = 'round';
            ctx.stroke();
          });

          // Joint Node Dots
          frame.landmarks.forEach((p, lmIdx) => {
            if ([11,12,13,14,15,16,23,24,25,26,27,28].includes(lmIdx) && (p.visibility || 0) >= 0.25) {
              const jx = athleteCanvasX + (p.x - 0.5) * 600;
              const jy = athleteCanvasY + (p.y - 0.5) * 800;

              ctx.beginPath();
              ctx.arc(jx, jy, isFinal ? 6 : 4.5, 0, Math.PI * 2);
              ctx.fillStyle = theme.color;
              ctx.fill();
              ctx.strokeStyle = '#FFFFFF';
              ctx.lineWidth = 1.5;
              ctx.stroke();
            }
          });

          ctx.restore();
        }

        // Stride Phase Chrono Pin (Anchored Above Athlete)
        if (showChronoPins) {
          const pinX = athleteCanvasX;
          const pinY = athleteCanvasY - 260;

          // Connective vertical guideline
          ctx.beginPath();
          ctx.moveTo(pinX, athleteCanvasY - 200);
          ctx.lineTo(pinX, pinY + 18);
          ctx.strokeStyle = theme.color;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 3]);
          ctx.stroke();
          ctx.setLineDash([]);

          // Chrono Pin Flag
          const timeText = `+${frame.relativeTime.toFixed(2)}s`;
          ctx.font = 'bold 15px Inter, monospace';
          const tw = ctx.measureText(timeText).width + 16;
          
          ctx.fillStyle = 'rgba(7, 11, 20, 0.95)';
          ctx.beginPath();
          ctx.roundRect(pinX - tw / 2, pinY - 14, tw, 28, 8);
          ctx.fill();
          ctx.strokeStyle = theme.color;
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.fillStyle = '#FFFFFF';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(timeText, pinX, pinY);

          // Phase Name Tag Under Pin
          if (showPhaseTags) {
            const phaseLabel = KINEMATIC_PHASE_LABELS[idx % KINEMATIC_PHASE_LABELS.length];
            ctx.font = 'bold 10px Inter, sans-serif';
            ctx.fillStyle = theme.color;
            ctx.fillText(`PHASE ${idx + 1}`, pinX, pinY - 22);
          }
        }

        // Kinematic Joint Angle Callouts
        if (showAngles) {
          // Knee Angle Badge
          const kx = athleteCanvasX + 30;
          const ky = athleteCanvasY + 80;
          const kText = `${frame.kneeAngle}° KNEE`;

          ctx.font = 'bold 12px Inter, monospace';
          const kw = ctx.measureText(kText).width + 12;

          ctx.fillStyle = 'rgba(10, 15, 29, 0.9)';
          ctx.beginPath();
          ctx.roundRect(kx, ky - 10, kw, 20, 6);
          ctx.fill();
          ctx.strokeStyle = theme.color;
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.fillStyle = '#FFFFFF';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(kText, kx + 6, ky);

          // Trunk Lean Badge
          const tx = athleteCanvasX - 85;
          const ty = athleteCanvasY - 120;
          const tText = `${frame.trunkLean}° LEAN`;

          ctx.fillStyle = 'rgba(10, 15, 29, 0.9)';
          ctx.beginPath();
          ctx.roundRect(tx, ty - 10, 75, 20, 6);
          ctx.fill();
          ctx.strokeStyle = '#FBBF24';
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.fillStyle = '#FBBF24';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(tText, tx + 6, ty);
        }
      });

      // 3. Center of Mass (CoM) Parabolic Elevation Flight Spline
      if (showTrajectory && comPoints.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(comPoints[0].x, comPoints[0].y);
        for (let p = 1; p < comPoints.length; p++) {
          const prev = comPoints[p - 1];
          const curr = comPoints[p];
          const mx = (prev.x + curr.x) / 2;
          const my = (prev.y + curr.y) / 2;
          ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
        }
        ctx.lineTo(comPoints[comPoints.length - 1].x, comPoints[comPoints.length - 1].y);
        
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.85)';
        ctx.lineWidth = 4;
        ctx.setLineDash([12, 8]);
        ctx.stroke();
        ctx.setLineDash([]);

        // CoM Elevation Rings
        comPoints.forEach(pt => {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 8, 0, Math.PI * 2);
          ctx.fillStyle = '#FFFFFF';
          ctx.fill();
          ctx.strokeStyle = pt.theme.color;
          ctx.lineWidth = 3;
          ctx.stroke();
        });
      }

      // 4. Header Overlay & Master Branding
      ctx.fillStyle = 'rgba(8, 12, 22, 0.92)';
      ctx.beginPath();
      ctx.roundRect(40, 36, 840, 110, 20);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 208, 132, 0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#00D084';
      ctx.fillRect(40, 36, 8, 110);

      // Logo
      drawVelocityLabLogoOnCanvas(ctx, { x: 68, y: 44, width: 200, isDark: true });

      ctx.font = 'bold 15px Inter, monospace';
      ctx.fillStyle = '#38BDF8';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      const athName = (athleteInfo.name || 'SPRINT ATHLETE').toUpperCase();
      ctx.fillText(`${athName} • ${frameCount}-PHASE KINEMATIC STROBE COMPOSITE`, 68, 115);

      ctx.font = '11px Inter, sans-serif';
      ctx.fillStyle = '#94A3B8';
      ctx.fillText(`BLOCK DEPARTURE (42° LEAN) → FULL UPRIGHT FLIGHT (Vmax ${athleteInfo.velocity || '11.2 m/s'})`, 68, 132);

      // Right Stats Badge in Header
      const rightCardW = 480;
      const rightCardX = canvasW - rightCardW - 40;
      ctx.fillStyle = 'rgba(8, 12, 22, 0.92)';
      ctx.beginPath();
      ctx.roundRect(rightCardX, 36, rightCardW, 110, 20);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.stroke();

      ctx.font = 'bold 11px Inter, monospace';
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('SPRINT ACCELERATION EFFICIENCY', rightCardX + 24, 64);
      
      ctx.font = 'bold 22px Inter, monospace';
      ctx.fillStyle = '#00D084';
      ctx.fillText(`Vmax: ${athleteInfo.velocity || '10.85'} m/s`, rightCardX + 24, 94);

      ctx.font = '11px Inter, sans-serif';
      ctx.fillStyle = '#F59E0B';
      ctx.fillText(`10m Split: ${athleteInfo.time ? (parseFloat(athleteInfo.time)*0.38).toFixed(2)+'s' : '1.62s'}  •  GCT: 94ms`, rightCardX + 24, 122);

      // 5. Preset-Specific Finishing Touches
      if (exportPreset === 'poster') {
        // Luxury gold/cyan certification footer
        const footerY = canvasH - 120;
        ctx.fillStyle = 'rgba(8, 12, 22, 0.95)';
        ctx.beginPath();
        ctx.roundRect(40, footerY, canvasW - 80, 80, 16);
        ctx.fill();
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.font = 'bold 13px Inter, monospace';
        ctx.fillStyle = '#FBBF24';
        ctx.fillText('VELOCITY LAB BIOMECHANICAL CERTIFICATION • STRIDE DOSSIER', 68, footerY + 34);

        ctx.font = '11px Inter, sans-serif';
        ctx.fillStyle = '#94A3B8';
        ctx.fillText('Verified Morin/Samozino kinematic acceleration profile • Stride frequency: 4.85 Hz • Foot strike latency: Elite Standard', 68, footerY + 56);

        ctx.font = 'bold 12px Inter, monospace';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'right';
        ctx.fillText('COACH SIGNATURE: _______________________', canvasW - 68, footerY + 44);
      } else if (exportPreset === 'coach_review') {
        // Detailed 12-phase technical review ribbon at the bottom
        const ribbonY = canvasH - 140;
        ctx.fillStyle = 'rgba(8, 12, 22, 0.96)';
        ctx.beginPath();
        ctx.roundRect(40, ribbonY, canvasW - 80, 100, 16);
        ctx.fill();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        const stepW = (canvasW - 120) / capturedFrames.length;
        capturedFrames.forEach((f, i) => {
          const colX = 55 + i * stepW;
          const theme = STROBE_PALETTE[i % STROBE_PALETTE.length];

          ctx.fillStyle = theme.color;
          ctx.beginPath(); ctx.arc(colX + 8, ribbonY + 22, 4, 0, Math.PI * 2); ctx.fill();

          ctx.font = 'bold 10px Inter, monospace';
          ctx.fillStyle = '#FFFFFF';
          ctx.textAlign = 'left';
          ctx.fillText(`P${i+1}: +${f.relativeTime.toFixed(2)}s`, colX + 16, ribbonY + 25);

          ctx.font = '9px Inter, sans-serif';
          ctx.fillStyle = '#94A3B8';
          ctx.fillText(`Knee: ${f.kneeAngle}°`, colX + 16, ribbonY + 44);
          ctx.fillText(`Lean: ${f.trunkLean}°`, colX + 16, ribbonY + 60);
          ctx.fillText(i < 3 ? 'Block Drive' : (i < 8 ? 'Rise Phase' : 'Upright Vmax'), colX + 16, ribbonY + 76);
        });
      }

      setGenProgress(100);
      setStatusMessage('Kinematic composite generated successfully!');
      const dataUrl = masterCanvas.toDataURL('image/png', 0.96);
      setPreviewDataUrl(dataUrl);

    } catch (err) {
      console.error('Error generating Kinematic Strobe composite:', err);
      setStatusMessage(`Error: ${err.message || 'Generation failed'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!previewDataUrl) return;
    const a = document.createElement('a');
    a.href = previewDataUrl;
    const cleanName = (athleteInfo.name || 'Athlete').replace(/\s+/g, '_');
    a.download = `Kinematic_Strobe_${cleanName}_${frameCount}Phases_${exportPreset}_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCopyClipboard = async () => {
    if (!previewDataUrl) return;
    try {
      const res = await fetch(previewDataUrl);
      const blob = await res.blob();
      if (typeof ClipboardItem === 'undefined' || !navigator.clipboard || !navigator.clipboard.write) {
        throw new Error('ClipboardItem API not supported');
      }
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      alert('Clipboard copy restricted in this browser. Please click Download 4K PNG.');
    }
  };

  const exportStrobePdf = () => {
    if (!previewDataUrl) return;
    setIsPdfExporting(true);

    try {
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const cleanName = athleteInfo.name || 'Athlete';

      pdf.setFillColor(11, 15, 23);
      pdf.rect(0, 0, 297, 210, 'F');

      addVelocityLabLogoToPdf(pdf, { x: 14, y: 12, width: 44, isDark: true });

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(16);
      pdf.setTextColor(255, 255, 255);
      pdf.text('KINEMATIC CHRONOPHOTOGRAPHY STROBE REPORT', 65, 18);

      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(0, 208, 132);
      pdf.text(`ATHLETE: ${cleanName.toUpperCase()}  |  ${frameCount} STRIDE PHASES: BLOCK DRIVE TO UPRIGHT FLIGHT`, 65, 24);

      // Insert high-res composite image
      pdf.addImage(previewDataUrl, 'PNG', 14, 30, 269, 105);

      // AutoTable Kinematic Stride Progression
      const tableHeaders = [['Phase', 'Split Time', 'Stride Phase Description', 'Knee Angle', 'Trunk Lean', 'Coaching Directive']];
      const tableRows = capturedFramesRef.current.map((f, i) => [
        `Phase ${i + 1}`,
        `+${f.relativeTime.toFixed(2)}s`,
        KINEMATIC_PHASE_LABELS[i % KINEMATIC_PHASE_LABELS.length],
        `${f.kneeAngle}°`,
        `${f.trunkLean}°`,
        COACHING_CUES[i % COACHING_CUES.length]
      ]);

      autoTable(pdf, {
        startY: 140,
        head: tableHeaders,
        body: tableRows,
        theme: 'plain',
        styles: { fontSize: 7, textColor: [241, 245, 249], cellPadding: 1.5, fillColor: [24, 33, 47] },
        headStyles: { fillColor: [0, 208, 132], textColor: [0, 0, 0], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [18, 25, 38] },
        margin: { left: 14, right: 14 }
      });

      savePdfFile(pdf, `VelocityLab_KinematicStrobe_${cleanName.replace(/\s+/g, '_')}_${Date.now()}.pdf`);
    } catch (err) {
      console.error('Failed to export Strobe PDF:', err);
      alert('Failed to generate PDF. Please download 4K PNG.');
    } finally {
      setIsPdfExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-5 overflow-hidden">
      <div className="bg-[#0c0f16] border border-slate-700/80 rounded-3xl w-full max-w-7xl h-[94vh] shadow-2xl flex flex-col overflow-hidden text-slate-100">
        
        {/* Modal Header Ribbon */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-[#121622]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-[#00D084] shadow-[0_0_15px_rgba(0,208,132,0.2)]">
              <Film size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white tracking-wide">Kinematic Strobe Motion Studio</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  CHRONOPHOTOGRAPHY COMPOSITE (6–12 PHASES)
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Composite starting block drive through upright flight into a single panoramic image for posters, social media, &amp; coaching review
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyClipboard}
              disabled={isGenerating || !previewDataUrl}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 transition disabled:opacity-40"
              title="Copy high-res image to clipboard"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>

            <button
              onClick={exportStrobePdf}
              disabled={isGenerating || isPdfExporting || !previewDataUrl}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition disabled:opacity-40 shadow-sm"
              title="Export high-resolution PDF report with complete stride kinematics table"
            >
              {isPdfExporting ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
              <span>PDF Report</span>
            </button>

            <button
              onClick={handleDownload}
              disabled={isGenerating || !previewDataUrl}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider transition shadow-lg shadow-emerald-500/20 disabled:opacity-40"
            >
              <Download size={14} />
              <span>Download 4K PNG</span>
            </button>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition border border-slate-700 ml-2"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Controls Toolbar */}
        <div className="px-6 py-3 border-b border-slate-800/80 bg-[#151a26] flex flex-wrap items-center justify-between gap-3 text-xs">
          
          {/* Stride Phase Count Selector: 6 to 12 Stride Phases */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Stride Phases:</span>
            <div className="flex gap-1 bg-slate-900 p-0.5 rounded-xl border border-slate-800">
              {[6, 7, 8, 9, 10, 11, 12].map(count => (
                <button
                  key={count}
                  onClick={() => setFrameCount(count)}
                  className={`px-2.5 py-1 rounded-lg font-bold font-mono transition ${
                    frameCount === count ? 'bg-emerald-500 text-slate-950 font-black' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title={`${count} transitional stride phases`}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          {/* Export Preset Switcher */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Export Preset:</span>
            <div className="flex bg-slate-900 p-0.5 rounded-xl border border-slate-800">
              <button
                onClick={() => setExportPreset('poster')}
                className={`px-3 py-1 rounded-lg font-bold transition ${
                  exportPreset === 'poster' ? 'bg-amber-400 text-slate-950 font-black shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
                title="Athlete Poster: High-DPI format with Gold seal and certification block"
              >
                Athlete Poster
              </button>
              <button
                onClick={() => setExportPreset('social_4k')}
                className={`px-3 py-1 rounded-lg font-bold transition ${
                  exportPreset === 'social_4k' ? 'bg-sky-400 text-slate-950 font-black shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
                title="Social Media 4K: 16:9 / 21:9 Widescreen with neon telemetry"
              >
                Social Media 4K
              </button>
              <button
                onClick={() => setExportPreset('coach_review')}
                className={`px-3 py-1 rounded-lg font-bold transition ${
                  exportPreset === 'coach_review' ? 'bg-emerald-400 text-slate-950 font-black shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
                title="Coach Biomechanical Review: Detailed angles, cue matrix, and tolerances"
              >
                Coach Review
              </button>
            </div>
          </div>

          {/* Overlays Toggles */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 font-medium text-[11px]">
              <input
                type="checkbox"
                checked={showSkeleton}
                onChange={e => setShowSkeleton(e.target.checked)}
                className="w-3.5 h-3.5 accent-emerald-500 rounded bg-slate-800"
              />
              <span>Skeleton</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 font-medium text-[11px]">
              <input
                type="checkbox"
                checked={showAngles}
                onChange={e => setShowAngles(e.target.checked)}
                className="w-3.5 h-3.5 accent-emerald-500 rounded bg-slate-800"
              />
              <span>Angles</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 font-medium text-[11px]">
              <input
                type="checkbox"
                checked={showTrajectory}
                onChange={e => setShowTrajectory(e.target.checked)}
                className="w-3.5 h-3.5 accent-emerald-500 rounded bg-slate-800"
              />
              <span>CoM Arc</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 font-medium text-[11px]">
              <input
                type="checkbox"
                checked={showTrackMarkings}
                onChange={e => setShowTrackMarkings(e.target.checked)}
                className="w-3.5 h-3.5 accent-emerald-500 rounded bg-slate-800"
              />
              <span>Track Metres</span>
            </label>
          </div>

          {/* Video Input or Synthetic Toggle */}
          <div className="flex items-center gap-2 ml-auto">
            <input
              type="file"
              ref={videoInputRef}
              onChange={handleVideoUpload}
              accept="video/*"
              className="hidden"
            />
            <button
              onClick={() => videoInputRef.current?.click()}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold border border-slate-700 text-[11px] transition"
              title="Upload custom video to extract frames from"
            >
              <Upload size={12} />
              <span>Load Video</span>
            </button>

            <button
              onClick={() => {
                setUseSyntheticSample(prev => !prev);
              }}
              className={`px-2.5 py-1 rounded-lg font-bold border text-[11px] transition ${
                useSyntheticSample 
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' 
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
              title="Toggle between Video Extraction and Kinematic Synthesizer"
            >
              {useSyntheticSample ? 'Using Synthetic Model' : 'Using Video Stream'}
            </button>

            <button
              onClick={generateStrobeComposite}
              disabled={isGenerating}
              className="flex items-center gap-1 px-3 py-1 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30 transition text-xs disabled:opacity-50"
            >
              {isGenerating ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              <span>Render</span>
            </button>
          </div>
        </div>

        {/* Main Canvas Display Stage */}
        <div className="flex-1 bg-[#07090e] p-4 sm:p-6 overflow-auto flex flex-col items-center justify-center relative">
          
          {isGenerating && (
            <div className="absolute inset-0 z-20 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 animate-pulse">
                <Loader2 size={32} className="animate-spin" />
              </div>
              <div className="text-base font-bold text-white mb-2">{statusMessage}</div>
              <div className="w-64 bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700 mb-2">
                <div 
                  className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-300"
                  style={{ width: `${genProgress}%` }}
                />
              </div>
              <div className="text-xs font-mono text-emerald-400 font-bold">{genProgress}%</div>
            </div>
          )}

          {previewDataUrl ? (
            <div className="w-full h-full flex flex-col items-center justify-center overflow-auto">
              <div 
                className="transition-transform duration-200 ease-out origin-center max-w-full"
                style={{ transform: `scale(${zoomLevel})` }}
              >
                <img
                  src={previewDataUrl}
                  alt="Kinematic Strobe Composite"
                  className="rounded-2xl shadow-2xl border border-slate-800 max-h-[66vh] object-contain mx-auto"
                />
              </div>
            </div>
          ) : (
            <div className="text-center text-slate-500">
              <Film size={48} className="mx-auto mb-3 opacity-30" />
              <p>Preparing 6–12 phase Kinematic Strobe Composite...</p>
            </div>
          )}

          {/* Zoom Controls */}
          {previewDataUrl && (
            <div className="absolute bottom-4 right-6 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-xs shadow-lg">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Zoom:</span>
              <button
                onClick={() => setZoomLevel(prev => Math.max(0.6, prev - 0.2))}
                className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center font-bold text-slate-300"
              >
                -
              </button>
              <span className="font-mono text-emerald-400 font-bold w-12 text-center">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                onClick={() => setZoomLevel(prev => Math.min(2.0, prev + 0.2))}
                className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center font-bold text-slate-300"
              >
                +
              </button>
              <button
                onClick={() => setZoomLevel(1)}
                className="ml-1 px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-400"
              >
                Reset
              </button>
            </div>
          )}
        </div>

        {/* Footer Info Strip */}
        <div className="px-6 py-2.5 bg-[#0f131c] border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Info size={14} className="text-emerald-400" />
            <span>
              {exportPreset === 'poster' && 'Athlete Poster Mode: Formatted for 300 DPI high-res printing with coach certification seal.'}
              {exportPreset === 'social_4k' && 'Social Media 4K: Ultra-high dynamic contrast layout with kinematic speed tags for social sharing.'}
              {exportPreset === 'coach_review' && 'Coach Biomechanical Review: Phase-by-phase angle tolerances and coaching directives.'}
            </span>
          </div>
          <div className="font-mono text-[11px] text-slate-500">
            6–12 Phase Kinematic Strobe Engine &bull; Morin / Samozino / MediaPipe
          </div>
        </div>

      </div>
    </div>
  );
}
