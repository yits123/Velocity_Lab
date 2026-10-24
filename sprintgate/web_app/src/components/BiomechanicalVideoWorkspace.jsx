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

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Video, Download, Layers, Loader2, Minimize, Maximize, Play, Pause, 
  AlertTriangle, X, Upload, Camera, User, CheckCircle2, ChevronLeft, 
  ChevronRight, Volume2, VolumeX, Eye, Sliders, Activity, Database, 
  Check, FileSpreadsheet, Film, Sparkles, Timer, Compass, Zap, Trophy, Scale
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { savePdfFile } from '../utils/pdfDownloader';
import { addVelocityLabLogoToPdf, drawVelocityLabLogoOnCanvas } from '../utils/logoPdfHelper';
import SideBySideComparisonPlayer from './SideBySideComparisonPlayer';
import StrobeMotionModal from './StrobeMotionModal';
import { generateAthleteBioReport } from '../utils/athleteBioReportGenerator';
import AIBioCoachDeck from './AIBioCoachDeck';
import { analyzeFullSprintBiomechanics } from '../utils/aiBioCoachEngine';

const getThemeAccent = () => {
  if (typeof window !== 'undefined') {
    const color = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim();
    const rgb = getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').trim();
    if (color && rgb) return { color, rgb };
    if (color) return { color, rgb: '0, 208, 132' };
  }
  return { color: '#00D084', rgb: '0, 208, 132' };
};

export const ACTIVITY_CONFIGS = {
  sprint_start: {
    id: 'sprint_start',
    label: 'Sprint Start & Acceleration Drive',
    shortLabel: 'Sprint Start (0-15m)',
    icon: '🚀',
    badge: '0-15m Drive Phase',
    description: 'Starting block clearance, first 3-5 strides, low drive trunk lean (30°-42°), positive shin attack angle, and drive phase ground contact time.'
  },
  sprint_maxv: {
    id: 'sprint_maxv',
    label: 'Max Velocity (Top Speed)',
    shortLabel: 'Max Velocity (Vmax)',
    icon: '⚡',
    badge: 'Top-End Speed',
    description: 'Upright sprint posture (80°-88°), frontside knee drive, minimal elastic ground contact time (<0.10s), overstride braking prevention, and high cadence turnover.'
  },
  jump: {
    id: 'jump',
    label: 'Vertical Jump Elevation',
    shortLabel: 'Vertical Jump',
    icon: '🦘',
    badge: 'Elevation & Impulse',
    description: 'Triple extension takeoff, explosive flight hang time, and vertical elevation measurement (inches & cm) using ballistic flight time kinematics.'
  },
  long_jump: {
    id: 'long_jump',
    label: 'Broad / Long Jump',
    shortLabel: 'Broad / Long Jump',
    icon: '🏃',
    badge: 'Horizontal Projection',
    description: 'Horizontal projectile takeoff angles, takeoff knee & hip extension, flight duration, and estimated landing distance.'
  },
  agility: {
    id: 'agility',
    label: 'Agility & COD Shuttle',
    shortLabel: 'Agility (5-10-5 / COD)',
    icon: '🔄',
    badge: 'Change of Direction',
    description: 'Plant step knee flexion, cutting deceleration trunk lean, and rapid re-acceleration kinematics during 5-10-5 pro agility or shuttle turns.'
  }
};

export default function BiomechanicalVideoWorkspace({
  videoURL,
  setVideoURL,
  compareVideoURL,
  setCompareVideoURL,
  history = [],
  results = [],
  roster = [],
  selectedAthlete = 'All',
  activeRunner = null,
  stationRole = 'master',
  db,
  user,
  onPoseDataChange
}) {
  // Video DOM & Stage Refs
  const videoPlaybackRef = useRef(null);
  const compareVideoPlaybackRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const videoContainerRef = useRef(null);
  const videoStageRef = useRef(null);
  const currentLineRef = useRef(null);

  // Stage Bounding for Zero-Error Pillarbox & High-DPI
  const [videoStageBox, setVideoStageBox] = useState({ width: 0, height: 0, left: 0, top: 0, vWidth: 0, vHeight: 0 });

  // Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isMuted, setIsMuted] = useState(true); // Muted by default so browsers allow instant, unrestricted autoplay & scrubbing
  const [videoError, setVideoError] = useState(null);
  const [showNativeControls, setShowNativeControls] = useState(false);
  const [showTimerOverlay, setShowTimerOverlay] = useState(true);
  const [isFullscreenVideo, setIsFullscreenVideo] = useState(false);
  const [showComparisonModal, setShowComparisonModal] = useState(false);
  const [showStrobeModal, setShowStrobeModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [isGeneratingBioReport, setIsGeneratingBioReport] = useState(false);
  const [bioReportStatus, setBioReportStatus] = useState('');

  // Athlete Identity & Sync Mode State
  const [syncMode, setSyncMode] = useState('unsynced'); // 'unsynced' (General / Guest) | 'roster' (Roster Athlete)
  const [subjectIndex, setSubjectIndex] = useState(1);
  const [customGuestName, setCustomGuestName] = useState('Test Subject 1');
  const [selectedRosterAthlete, setSelectedRosterAthlete] = useState(() => (selectedAthlete && selectedAthlete !== 'All') ? selectedAthlete : '');

  // Analysis State
  const [selectedSyncSession, setSelectedSyncSession] = useState("none");
  const [analysisActivity, setAnalysisActivity] = useState(() => {
    try {
      const saved = localStorage.getItem('sprintgate_analysis_activity');
      if (saved && (ACTIVITY_CONFIGS[saved] || saved === 'sprint')) return saved === 'sprint' ? 'sprint_start' : saved;
      return 'sprint_start';
    } catch (_) {
      return 'sprint_start';
    }
  });

  const handleSelectActivity = (newActivity) => {
    setAnalysisActivity(newActivity);
    try {
      localStorage.setItem('sprintgate_analysis_activity', newActivity);
    } catch (_) {}
  };

  useEffect(() => {
    if (selectedAthlete && selectedAthlete !== 'All') {
      setSelectedRosterAthlete(selectedAthlete);
    }
  }, [selectedAthlete]);

  // Multi-Device Mesh: Auto-lock onto active queued athlete when in Camera Station mode
  useEffect(() => {
    if (stationRole === 'camera' && activeRunner && activeRunner.name && activeRunner.name !== 'No runner in queue') {
      setSyncMode('roster');
      setSelectedRosterAthlete(activeRunner.name);
    }
  }, [stationRole, activeRunner]);

  const [drawMode, setDrawMode] = useState('off'); // 'off' | 'line'
  const [drawingLines, setDrawingLines] = useState([]);
  const [calibrationLine, setCalibrationLine] = useState(null);
  const [activeMetrics, setActiveMetrics] = useState(() => {
    try {
      const saved = localStorage.getItem('sprintgate_bio_active_metrics');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          knee: parsed.knee !== false,
          hip: parsed.hip !== false,
          trunk: parsed.trunk !== false,
          shin: parsed.shin !== false,
          elbow: parsed.elbow !== false
        };
      }
    } catch (e) {}
    return { knee: true, hip: true, trunk: true, shin: true, elbow: true };
  });

  useEffect(() => {
    try {
      localStorage.setItem('sprintgate_bio_active_metrics', JSON.stringify(activeMetrics));
    } catch (e) {}
  }, [activeMetrics]);
  const [showAngleArcs, setShowAngleArcs] = useState(true);
  const [showGctOverlay, setShowGctOverlay] = useState(true);
  const [showAsymmetryOverlay, setShowAsymmetryOverlay] = useState(() => {
    const saved = localStorage.getItem('sprintgate_bio_show_asymmetry');
    return saved !== null ? saved === 'true' : true;
  });
  useEffect(() => {
    try {
      localStorage.setItem('sprintgate_bio_show_asymmetry', String(showAsymmetryOverlay));
    } catch (e) {}
  }, [showAsymmetryOverlay]);
  const [showShinVector, setShowShinVector] = useState(true);
  const [manualStartTime, setManualStartTime] = useState(null);
  const [showDepthShading, setShowDepthShading] = useState(true);
  const [showComTrail, setShowComTrail] = useState(true);
  const [showFootRipples, setShowFootRipples] = useState(true);
  const [showBroadcastLowerThird, setShowBroadcastLowerThird] = useState(true);
  const [showBioCoach, setShowBioCoach] = useState(() => {
    const saved = localStorage.getItem('sprintgate_show_bio_coach');
    return saved !== null ? saved === 'true' : true;
  });
  const [showBioCoachHUD, setShowBioCoachHUD] = useState(() => {
    const saved = localStorage.getItem('sprintgate_show_bio_coach_hud');
    return saved !== null ? saved === 'true' : true;
  });
  const comTrailRef = useRef([]);
  const impactRipplesRef = useRef([]);
  const footVelocityRef = useRef({ prevLY: null, prevLX: null, prevLVy: 0, prevRY: null, prevRX: null, prevRVy: 0, lastTime: 0 });
  const monotonicVideoTimestampRef = useRef(0);
  const poseBufferRef = useRef([]);
  const lastPoseBufferFlushRef = useRef(0);
  const gctTrackingRef = useRef({
    left: { inStance: false, startSec: 0, freezeUntilMs: 0, finalGctMs: 0, x: 0, y: 0, tier: 'elite' },
    right: { inStance: false, startSec: 0, freezeUntilMs: 0, finalGctMs: 0, x: 0, y: 0, tier: 'elite' }
  });

  useEffect(() => {
    comTrailRef.current = [];
    impactRipplesRef.current = [];
    poseBufferRef.current = [];
    monotonicVideoTimestampRef.current = 0;
    footVelocityRef.current = { prevLY: null, prevLX: null, prevLVy: 0, prevRY: null, prevRX: null, prevRVy: 0, lastTime: 0 };
    gctTrackingRef.current = {
      left: { inStance: false, startSec: 0, freezeUntilMs: 0, finalGctMs: 0, x: 0, y: 0, tier: 'elite' },
      right: { inStance: false, startSec: 0, freezeUntilMs: 0, finalGctMs: 0, x: 0, y: 0, tier: 'elite' }
    };
  }, [videoURL]);

  // Athlete profile & telemetry metadata for TV broadcast lower-third chyron & PDF reports
  const broadcastAthlete = useMemo(() => {
    if (syncMode === 'roster') {
      const athleteName = selectedRosterAthlete || (selectedAthlete && selectedAthlete !== 'All' ? selectedAthlete : (roster[0]?.name || 'Roster Athlete'));
      const matchedRoster = (roster || []).find(r => r.name === athleteName) || {};
      const athleteRuns = (history || []).filter(h => h.name === athleteName && parseFloat(h.time) > 0.5);
      let prTime = null;
      let topVel = 0;
      athleteRuns.forEach(r => {
        const t = parseFloat(r.time);
        if (!prTime || t < prTime) prTime = t;
        const v = parseFloat(r.velocity) || 0;
        if (v > topVel) topVel = v;
      });
      const country = (matchedRoster.country || 'USA').toUpperCase();
      const flag = country === 'JAM' ? '🇯🇲' :
                   country === 'IND' ? '🇮🇳' :
                   country === 'GBR' ? '🇬🇧' :
                   country === 'CAN' ? '🇨🇦' :
                   country === 'GER' ? '🇩🇪' :
                   country === 'AUS' ? '🇦🇺' :
                   country === 'FRA' ? '🇫🇷' :
                   country === 'JPN' ? '🇯🇵' :
                   country === 'RSA' ? '🇿🇦' :
                   country === 'USA' ? '🇺🇸' : '🌐';
      return {
        isUnsynced: false,
        name: athleteName,
        bib: matchedRoster.bib || '--',
        country,
        flag,
        sport: matchedRoster.sport || 'Track & Field / Sprint',
        team: matchedRoster.team || 'Velocity Lab Roster',
        age: matchedRoster.age || null,
        gender: matchedRoster.gender || null,
        height: matchedRoster.height || null,
        weight: matchedRoster.weight || null,
        prTime: prTime ? `${prTime.toFixed(2)}s` : '--',
        topSpeed: topVel > 0 ? `${topVel.toFixed(1)} m/s` : '--',
        distance: athleteRuns[0]?.distance || '40'
      };
    } else {
      // General / Unsynced mode (Guest / Unknown athlete)
      const name = customGuestName.trim() || `Test Subject ${subjectIndex}`;
      return {
        isUnsynced: true,
        name,
        bib: `TS-${String(subjectIndex).padStart(2, '0')}`,
        country: 'INT',
        flag: '🌐',
        sport: 'Sprint / Combine Evaluation',
        team: 'Independent / Guest',
        age: null,
        gender: null,
        height: null,
        weight: null,
        prTime: '--',
        topSpeed: '--',
        distance: '--'
      };
    }
  }, [syncMode, selectedRosterAthlete, selectedAthlete, roster, history, customGuestName, subjectIndex]);

  // MediaPipe AI State
  const [poseMode, setPoseMode] = useState(false);
  const [poseGraphData, setPoseGraphData] = useState([]);

  // Sync pose data to parent if requested
  useEffect(() => {
    if (typeof onPoseDataChange === 'function') {
      onPoseDataChange(poseGraphData);
    }
  }, [poseGraphData, onPoseDataChange]);
  const [isPoseLoading, setIsPoseLoading] = useState(false);
  const [poseError, setPoseError] = useState(null);
  const [poseRecoveryNotice, setPoseRecoveryNotice] = useState(null);
  const [showPoseSettings, setShowPoseSettings] = useState(false);
  const [poseDelegate, setPoseDelegate] = useState('GPU'); // 'GPU' | 'CPU'

  // Model Fine-Tuning - Calibrated for high accuracy athletic tracking
  const [poseConfidence, setPoseConfidence] = useState(() => {
    const val = parseFloat(localStorage.getItem('sprintgate_pose_conf'));
    return (!isNaN(val) && val > 0 && val <= 0.85) ? val : 0.65;
  });
  const [poseTrackingConf, setPoseTrackingConf] = useState(() => {
    const val = parseFloat(localStorage.getItem('sprintgate_pose_track_conf'));
    return (!isNaN(val) && val > 0 && val <= 0.85) ? val : 0.65;
  });
  const [poseSmoothing, setPoseSmoothing] = useState(() => parseFloat(localStorage.getItem('sprintgate_pose_smoothing')) || 0.65);
  const [poseModelQuality, setPoseModelQuality] = useState(() => {
    const saved = localStorage.getItem('sprintgate_pose_model');
    const isMobileOrTablet = typeof navigator !== 'undefined' && (
      /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints && navigator.maxTouchPoints > 1 && window.innerWidth <= 1366)
    );
    if (isMobileOrTablet && saved === 'heavy') return 'lite';
    return (saved === 'heavy' || saved === 'full' || saved === 'lite') ? saved : (isMobileOrTablet ? 'lite' : 'full');
  });
  const [minVisibility, setMinVisibility] = useState(() => {
    const val = parseFloat(localStorage.getItem('sprintgate_pose_vis'));
    return (!isNaN(val) && val > 0 && val <= 0.70) ? val : 0.55;
  });

  // Internal Tracking Refs
  const poseLandmarkerRef = useRef(null);
  const lastVideoTimeRef = useRef(-1);
  const smoothedLandmarksRef = useRef(null);

  // Exact Letterbox Calculation
  const updateVideoBounds = useCallback(() => {
    if (!videoPlaybackRef.current || !videoContainerRef.current) return;
    const v = videoPlaybackRef.current;
    const c = videoContainerRef.current;
    const vw = v.videoWidth;
    const vh = v.videoHeight;
    if (!vw || !vh) return;
    
    const cw = c.clientWidth;
    const ch = c.clientHeight;
    if (!cw || !ch) return;
    
    const vRatio = vw / vh;
    const cRatio = cw / ch;
    
    let width, height;
    if (vRatio > cRatio) {
      width = cw;
      height = cw / vRatio;
    } else {
      height = ch;
      width = ch * vRatio;
    }
    setVideoStageBox({
      width: Math.round(width),
      height: Math.round(height),
      left: Math.round((cw - width) / 2),
      top: Math.round((ch - height) / 2),
      vWidth: vw,
      vHeight: vh
    });
  }, []);

  useEffect(() => {
    if (!videoContainerRef.current) return;
    const observer = new ResizeObserver(() => {
      updateVideoBounds();
    });
    observer.observe(videoContainerRef.current);
    window.addEventListener('resize', updateVideoBounds);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateVideoBounds);
    };
  }, [updateVideoBounds]);

  const getVideoRenderedBox = useCallback((video, canvas) => {
    const vWidth = video?.videoWidth || 1920;
    const vHeight = video?.videoHeight || 1080;
    const cWidth = canvas?.offsetWidth || canvas?.width || 640;
    const cHeight = canvas?.offsetHeight || canvas?.height || 360;

    const vRatio = vWidth / vHeight;
    const cRatio = cWidth / cHeight;

    if (Math.abs(vRatio - cRatio) < 0.015) {
      return { left: 0, top: 0, width: cWidth, height: cHeight, vWidth, vHeight };
    }

    let width, height, left, top;
    if (vRatio > cRatio) {
      width = cWidth;
      height = cWidth / vRatio;
      left = 0;
      top = (cHeight - height) / 2;
    } else {
      height = cHeight;
      width = cHeight * vRatio;
      left = (cWidth - width) / 2;
      top = 0;
    }
    return { left, top, width, height, vWidth, vHeight };
  }, []);

  // 1. Automatic Sprint Motion Onset (Block Departure / First Explosive Movement) Detection
  const sprintMotionOnset = useMemo(() => {
    if (manualStartTime !== null) return manualStartTime;
    if (!poseGraphData || poseGraphData.length < 5) return null;
    const sorted = [...poseGraphData].sort((a, b) => a.time - b.time);

    // Determine horizontal sprint direction
    const earlySlice = sorted.slice(0, Math.max(3, Math.floor(sorted.length * 0.25)));
    const lateSlice = sorted.slice(Math.max(0, Math.floor(sorted.length * 0.75)));
    
    const earlyX = earlySlice.reduce((s, p) => s + (p.hipX || p.shoulderX || 0), 0) / earlySlice.length;
    const lateX = lateSlice.reduce((s, p) => s + (p.hipX || p.shoulderX || 0), 0) / lateSlice.length;
    const direction = (lateX - earlyX) >= 0 ? 1 : -1;

    // Baseline stationary position during set/blocks
    const baselineX = earlyX;

    // Get pixel-to-meter scaling
    let pxToM = 0.002;
    const sampleP = sorted[Math.floor(sorted.length / 2)] || sorted[0];
    const shoulderY = sampleP.shoulderY || 0;
    const footY = Math.max(sampleP.lFootY || 0, sampleP.rFootY || 0);
    const bodyHeightPx = Math.abs(footY - shoulderY) * 1.18;
    if (bodyHeightPx > 50) {
      pxToM = 1.75 / bodyHeightPx;
    }

    // Find the first frame where hip moves > 0.06m in sprint direction with sustained forward velocity (> 0.40 m/s)
    for (let i = 0; i < sorted.length - 2; i++) {
      const p1 = sorted[i];
      const p2 = sorted[i + 1];
      const p3 = sorted[i + 2];

      const x1 = p1.hipX || p1.shoulderX || 0;
      const x2 = p2.hipX || p2.shoulderX || 0;
      const x3 = p3.hipX || p3.shoulderX || 0;

      const dispM = (x2 - baselineX) * direction * pxToM;
      const dt1 = Math.abs(p2.time - p1.time);
      const dt2 = Math.abs(p3.time - p2.time);

      if (dt1 >= 0.015 && dt2 >= 0.015) {
        const vel1 = ((x2 - x1) * direction * pxToM) / dt1;
        const vel2 = ((x3 - x2) * direction * pxToM) / dt2;

        if (dispM > 0.06 && vel1 > 0.40 && vel2 > 0.45) {
          return p1.time;
        }
      }
    }

    return null;
  }, [poseGraphData, manualStartTime]);

  // Authentic Physics-grounded instantaneous sprint velocity ticker
  // Measures Center-of-Mass landmark displacement over time with strict stationary deadband
  const liveVelocityMS = useMemo(() => {
    // If video is at start or unplayed, velocity is unequivocally 0
    if (!playbackTime || playbackTime <= 0.05) return 0;

    // If AI Pose kinematics data exists around this timestamp, use Center-of-Mass derivative
    if (poseGraphData && poseGraphData.length >= 2) {
      // Guard: If motion onset has been detected and video is currently before departure, athlete is in SET POSITION
      if (sprintMotionOnset !== null && playbackTime < sprintMotionOnset) {
        return 0;
      }

      const sorted = [...poseGraphData].sort((a, b) => a.time - b.time);
      const idx = sorted.findIndex(p => p.time >= playbackTime);
      
      let pPrev = null;
      let pNext = null;
      if (idx > 0 && idx < sorted.length) {
        pPrev = sorted[idx - 1];
        pNext = sorted[idx];
      } else if (idx === 0 && sorted.length > 1) {
        pPrev = sorted[0];
        pNext = sorted[1];
      } else if (idx === -1 && sorted.length > 1) {
        pPrev = sorted[sorted.length - 2];
        pNext = sorted[sorted.length - 1];
      }

      if (pPrev && pNext) {
        const dt = Math.abs(pNext.time - pPrev.time);
        if (dt >= 0.015 && dt <= 0.6) {
          const xPrev = (pPrev.hipX || pPrev.shoulderX || 0);
          const xNext = (pNext.hipX || pNext.shoulderX || 0);
          const dxPx = Math.abs(xNext - xPrev);

          // Get scaling factor (meters per pixel)
          let metersPerPx = 0.002;
          if (calibrationLine && videoPlaybackRef.current && overlayCanvasRef.current) {
            const box = getVideoRenderedBox(videoPlaybackRef.current, overlayCanvasRef.current);
            const scale = box.vWidth / (box.width || 1);
            const dx = (calibrationLine.end.x - calibrationLine.start.x) * scale;
            const dy = (calibrationLine.end.y - calibrationLine.start.y) * scale;
            const lenPx = Math.sqrt(dx * dx + dy * dy);
            if (lenPx > 0) metersPerPx = 1.0 / lenPx;
          } else {
            // Anatomical calibration based on standard human sprinter proportions
            const shoulderY = pNext.shoulderY || 0;
            const footY = Math.max(pNext.lFootY || 0, pNext.rFootY || 0);
            const heightPx = Math.abs(footY - shoulderY) * 1.18;
            if (heightPx > 50) {
              metersPerPx = 1.75 / heightPx;
            }
          }

          const rawVel = (dxPx * metersPerPx) / dt;

          // Stationary deadband filter:
          // In the "Set" position or during postural sway, micro-jitter yields rawVel < 0.35 m/s.
          // This strictly clamps stationary athletes to 0.0 m/s.
          if (rawVel < 0.35) {
            return 0;
          }

          if (rawVel <= 12.8) {
            return rawVel;
          }
        }
      }
      return 0;
    }

    // If pose tracking has not been run or athlete is stationary:
    // Strictly return 0. Never evaluate a blind mathematical curve based on raw video file clock!
    return 0;
  }, [poseGraphData, playbackTime, sprintMotionOnset, calibrationLine, getVideoRenderedBox]);

  // Video switching with clean memory management
  const handleNewVideo = (fileOrBlob) => {
    if (!fileOrBlob) return;
    if (videoURL && typeof videoURL === 'string' && videoURL.startsWith('blob:')) {
      try { URL.revokeObjectURL(videoURL); } catch (e) {}
    }
    const newUrl = (typeof fileOrBlob === 'string') ? fileOrBlob : URL.createObjectURL(fileOrBlob);
    setVideoURL(newUrl);
    setPlaybackTime(0);
    setPoseGraphData([]);
    setManualStartTime(null);
    poseBufferRef.current = [];
    monotonicVideoTimestampRef.current = 0;
    lastVideoTimeRef.current = -1;
    smoothedLandmarksRef.current = null;
    setIsPlaying(false);
    setPoseError(null);
    setVideoError(null);
    if (videoPlaybackRef.current) {
      try {
        videoPlaybackRef.current.currentTime = 0;
        videoPlaybackRef.current.load();
      } catch (e) {}
    }
  };

  // Instant sample sprint video loader for immediate verification & testing
  const handleLoadSampleSprintVideo = async () => {
    setVideoError(null);
    setPoseRecoveryNotice("Loading High-Precision 60fps High-Speed Sprint Sample Video...");
    try {
      const sampleUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";
      const resp = await fetch(sampleUrl, { mode: 'cors' });
      if (!resp.ok) throw new Error("Sample fetch status " + resp.status);
      const blob = await resp.blob();
      handleNewVideo(blob);
      setPoseRecoveryNotice("High-Speed Sample Sprint Video loaded! Press Play or click 'Auto-Analyze AI'.");
    } catch (err) {
      // Direct CDN URL fallback if fetch blob blocked
      handleNewVideo("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4");
      setPoseRecoveryNotice("High-Speed Sample Sprint Video loaded! Press Play or click 'Auto-Analyze AI'.");
    }
  };

  // Safe recovery defaults with high-precision model parameters
  const handleEmergencyResetPose = () => {
    setPoseConfidence(0.65);
    setPoseTrackingConf(0.65);
    setPoseSmoothing(0.65);
    setPoseModelQuality('full');
    setMinVisibility(0.55);
    localStorage.removeItem('sprintgate_pose_conf');
    localStorage.removeItem('sprintgate_pose_track_conf');
    localStorage.removeItem('sprintgate_pose_smoothing');
    localStorage.removeItem('sprintgate_pose_model');
    localStorage.removeItem('sprintgate_pose_vis');
    setPoseError(null);
    setPoseRecoveryNotice("AI Video Analysis restored to accurate Full defaults (0.65 confidence). Ready to analyze!");
    if (poseLandmarkerRef.current) {
      try { poseLandmarkerRef.current.close(); } catch(e) {}
      poseLandmarkerRef.current = null;
    }
    setPoseMode(false);
  };

  const modelAssetMap = {
    lite: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
    full: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
    heavy: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task"
  };

  const initializePoseLandmarker = async (overrideQuality = null, overrideDelegate = null) => {
    setIsPoseLoading(true);
    setPoseError(null);
    smoothedLandmarksRef.current = null;

    const isMobileOrTablet = typeof navigator !== 'undefined' && (
      /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints && navigator.maxTouchPoints > 1 && window.innerWidth <= 1366)
    );

    const targetQuality = overrideQuality || poseModelQuality || 'lite';
    const targetDelegate = overrideDelegate || poseDelegate || 'GPU';

    const fallbackChain = [];
    fallbackChain.push({ q: targetQuality, del: targetDelegate });
    if (targetDelegate === 'GPU') {
      fallbackChain.push({ q: targetQuality, del: 'CPU' });
    }
    if (targetQuality !== 'lite') {
      fallbackChain.push({ q: 'lite', del: 'GPU' });
      fallbackChain.push({ q: 'lite', del: 'CPU' });
    }

    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
      );

      let created = false;
      let lastErr = null;

      for (const { q, del } of fallbackChain) {
        try {
          if (isMobileOrTablet && q === 'heavy') continue;

          if (poseLandmarkerRef.current) {
            try { poseLandmarkerRef.current.close(); } catch(e) {}
            poseLandmarkerRef.current = null;
          }

          const modelAssetPath = modelAssetMap[q] || modelAssetMap.lite;
          poseLandmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath,
              delegate: del
            },
            runningMode: "VIDEO",
            numPoses: 1,
            minPoseDetectionConfidence: poseConfidence,
            minPosePresenceConfidence: poseConfidence,
            minTrackingConfidence: poseTrackingConf
          });

          setPoseMode(true);
          setPoseDelegate(del);
          created = true;
          if (q !== targetQuality || del !== targetDelegate) {
            setPoseRecoveryNotice(`Loaded ${q.toUpperCase()} model on ${del} for device stability.`);
          }
          break;
        } catch (createErr) {
          lastErr = createErr;
        }
      }

      if (!created) {
        throw lastErr || new Error("Failed to initialize MediaPipe PoseLandmarker on this device.");
      }
    } catch (err) {
      console.error("Critical PoseLandmarker error:", err);
      setPoseError("MediaPipe AI Pose crashed or is unsupported on this browser. Try Chrome/Edge or click 'Reset AI to Safe Defaults'.");
      setPoseMode(false);
    } finally {
      setIsPoseLoading(false);
    }
  };

  // Mathematically Invariant 2D Angle Formula (0 to 180 degrees)
  const calculateAngle = (p1, p2, p3) => {
    if (!p1 || !p2 || !p3 || p1.x === undefined || p2.x === undefined || p3.x === undefined) return 0;
    const angle1 = Math.atan2(p1.y - p2.y, p1.x - p2.x);
    const angle2 = Math.atan2(p3.y - p2.y, p3.x - p2.x);
    let deg = (angle1 - angle2) * (180 / Math.PI);
    if (isNaN(deg)) return 0;
    if (deg < 0) deg += 360;
    return deg > 180 ? 360 - deg : deg;
  };

  const togglePlayback = async () => {
    if (!videoPlaybackRef.current) return;
    const v = videoPlaybackRef.current;
    
    // Auto-rewind if at or near the end of the video
    if (v.ended || (v.duration && v.currentTime >= v.duration - 0.08)) {
      v.currentTime = 0;
      setPlaybackTime(0);
    }

    if (v.paused) {
      try {
        v.playbackRate = playbackSpeed;
        const playPromise = v.play();
        if (playPromise !== undefined) {
          await playPromise;
        }
        setIsPlaying(true);
        setVideoError(null);
        if (compareVideoPlaybackRef.current && !compareVideoPlaybackRef.current.ended) {
          compareVideoPlaybackRef.current.playbackRate = playbackSpeed;
          compareVideoPlaybackRef.current.play().catch(() => {});
        }
      } catch (err) {
        console.warn("Standard play failed, falling back to muted playback:", err);
        try {
          v.muted = true;
          setIsMuted(true);
          v.playbackRate = playbackSpeed;
          await v.play();
          setIsPlaying(true);
          setVideoError(null);
        } catch (retryErr) {
          console.error("Playback failed completely:", retryErr);
          setIsPlaying(false);
          setVideoError("Playback was blocked by browser. Click directly on video or toggle 'Native Controls'.");
          setShowNativeControls(true);
        }
      }
    } else {
      v.pause();
      setIsPlaying(false);
      if (compareVideoPlaybackRef.current) {
        compareVideoPlaybackRef.current.pause();
      }
    }
  };

  const setSpeed = (speed) => {
    setPlaybackSpeed(speed);
    if (videoPlaybackRef.current) {
      videoPlaybackRef.current.playbackRate = speed;
    }
    if (compareVideoPlaybackRef.current) {
      compareVideoPlaybackRef.current.playbackRate = speed;
    }
  };

  const stepFrame = (forward = true) => {
    if (!videoPlaybackRef.current) return;
    if (isPlaying) togglePlayback();
    const delta = forward ? 0.0333 : -0.0333;
    const newTime = Math.max(0, Math.min(videoDuration || 999, videoPlaybackRef.current.currentTime + delta));
    videoPlaybackRef.current.currentTime = newTime;
    setPlaybackTime(newTime);
    if (compareVideoPlaybackRef.current) {
      compareVideoPlaybackRef.current.currentTime = Math.max(0, compareVideoPlaybackRef.current.currentTime + delta);
    }
  };

  const handleSeek = (e) => {
    if (!videoPlaybackRef.current) return;
    const time = parseFloat(e.target.value);
    const v = videoPlaybackRef.current;
    if ('fastSeek' in v && Math.abs(v.currentTime - time) > 0.4) {
      try { v.fastSeek(time); } catch (err) { v.currentTime = time; }
    } else {
      v.currentTime = time;
    }
    if (compareVideoPlaybackRef.current) compareVideoPlaybackRef.current.currentTime = time;
    setPlaybackTime(time);
  };

  // Keyboard Shortcuts for Coaches
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't intercept if user is typing in an input or select
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        togglePlayback();
      } else if (e.key === 'ArrowRight' || e.key === '.' || e.key === ']') {
        e.preventDefault();
        stepFrame(true);
      } else if (e.key === 'ArrowLeft' || e.key === ',' || e.key === '[') {
        e.preventDefault();
        stepFrame(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying]);

  const handlePointerDown = (e) => {
    if (drawMode === 'off') return;
    const x = e.nativeEvent.offsetX;
    const y = e.nativeEvent.offsetY;
    currentLineRef.current = { start: {x, y}, end: {x, y} };
  };

  const handlePointerMove = (e) => {
    if (drawMode === 'off' || !currentLineRef.current) return;
    currentLineRef.current.end = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };
  };

  const handlePointerUp = () => {
    if (drawMode === 'off' || !currentLineRef.current) return;
    setDrawingLines(old => [...old, currentLineRef.current]);
    currentLineRef.current = null;
  };

  // High-Performance Zero-Error Canvas Animation Loop
  useEffect(() => {
    let animationId;
    const render = () => {
      if (overlayCanvasRef.current && videoPlaybackRef.current) {
        const canvas = overlayCanvasRef.current;
        const video = videoPlaybackRef.current;
        
        const displayWidth = canvas.offsetWidth;
        const displayHeight = canvas.offsetHeight;
        if (displayWidth === 0 || displayHeight === 0) {
          animationId = requestAnimationFrame(render);
          return;
        }

        // Support High-DPI screens without blurriness
        const dpr = window.devicePixelRatio || 1;
        const targetW = Math.round(displayWidth * dpr);
        const targetH = Math.round(displayHeight * dpr);
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }
        
        const ctx = canvas.getContext('2d');
        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, displayWidth, displayHeight);

        // Get exact video bounding box inside canvas
        const box = getVideoRenderedBox(video, canvas);
        const vWidth = video.videoWidth || 1920;
        const vHeight = video.videoHeight || 1080;

        // Render video frame directly to canvas to guarantee visibility across all browser GPU compositors
        try {
          if (!showNativeControls && video.readyState >= 2 && video.videoWidth > 0 && box.width > 0 && box.height > 0) {
            ctx.drawImage(video, box.left, box.top, box.width, box.height);
          }
        } catch (e) {
          // Fallback to native video element underneath if cross-origin restrictions apply
        }
        
        // Pose Inference with WebGL crash protection
        if (poseMode && poseLandmarkerRef.current && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
          if (lastVideoTimeRef.current !== video.currentTime) {
            const timeDiff = Math.abs(video.currentTime - lastVideoTimeRef.current);
            lastVideoTimeRef.current = video.currentTime;
            
            // Strictly monotonic timestamp required by MediaPipe Tasks-Vision across loops & backwards seeks
            const now = performance.now();
            const frameTimestampMs = Math.max(monotonicVideoTimestampRef.current + 1, now);
            monotonicVideoTimestampRef.current = frameTimestampMs;
            
            try {
              poseLandmarkerRef.current.detectForVideo(video, frameTimestampMs, (result) => {
                if (result.landmarks && result.landmarks[0]) {
                  let lm = result.landmarks[0];
                  
                  // Temporal Exponential Moving Average (EMA) Smoothing
                  if (poseSmoothing > 0 && timeDiff < 0.25) {
                    if (!smoothedLandmarksRef.current || smoothedLandmarksRef.current.length !== lm.length) {
                      smoothedLandmarksRef.current = lm.map(p => ({ ...p }));
                    } else {
                      smoothedLandmarksRef.current = lm.map((p, idx) => {
                        const prev = smoothedLandmarksRef.current[idx] || p;
                        return {
                          ...p,
                          x: prev.x + poseSmoothing * (p.x - prev.x),
                          y: prev.y + poseSmoothing * (p.y - prev.y),
                          z: prev.z + poseSmoothing * (p.z - prev.z),
                          visibility: p.visibility
                        };
                      });
                    }
                    lm = smoothedLandmarksRef.current;
                  }

                  // 1. Zero-Error Biomechanical Angles (using true square video sensor pixels)
                  const toVideoPt = (p) => ({ x: p.x * vWidth, y: p.y * vHeight });
                  
                  const hip = lm[24]; 
                  const knee = lm[26];
                  const ankle = lm[28];
                  const shoulder = lm[12];
                  const elbow = lm[14];
                  const wrist = lm[16];
                  const footIndex = lm[32];
                  const lShoulder = lm[11];
                  const lHip = lm[23];
                  const lKnee = lm[25];
                  const lAnkle = lm[27];
                  const lElbow = lm[13];
                  const lWrist = lm[15];
                  const lFootIndex = lm[31];
                  
                  const visThresh = Math.min(minVisibility, 0.55);

                  // 2. Draw high-visibility biomechanical skeleton with 3D Depth Shading directly onto the video box
                  const SKELETON_CONNECTIONS = [
                    [11, 12], [11, 23], [12, 24], [23, 24],
                    [11, 13], [13, 15],
                    [12, 14], [14, 16],
                    [23, 25], [25, 27], [27, 29], [27, 31], [29, 31],
                    [24, 26], [26, 28], [28, 30], [28, 32], [30, 32],
                    [0, 11], [0, 12]
                  ];

                  // Calculate 3D Parallax Depth for Limbs (MediaPipe z is relative to hip center)
                  const leftZ = ((lm[23]?.z || 0) + (lm[25]?.z || 0) + (lm[27]?.z || 0)) / 3;
                  const rightZ = ((lm[24]?.z || 0) + (lm[26]?.z || 0) + (lm[28]?.z || 0)) / 3;
                  const isLeftNear = leftZ < rightZ;

                  // Order connections so deeper background limbs render first, near limbs occlude them
                  const connectionsWithDepth = SKELETON_CONNECTIONS.map(([i1, i2]) => {
                    const p1 = lm[i1];
                    const p2 = lm[i2];
                    if (!p1 || !p2) return null;
                    const isLeftLimb = (i1 % 2 !== 0 && i2 % 2 !== 0 && i1 >= 11);
                    const isRightLimb = (i1 % 2 === 0 && i2 % 2 === 0 && i1 >= 12);
                    const zAvg = ((p1.z ?? 0) + (p2.z ?? 0)) / 2;
                    const isNear = isLeftLimb ? isLeftNear : isRightLimb ? !isLeftNear : (zAvg < 0);
                    return { i1, i2, p1, p2, isNear, zAvg };
                  }).filter(Boolean);

                  if (showDepthShading) {
                    connectionsWithDepth.sort((a, b) => b.zAvg - a.zAvg);
                  }

                  const themeAccent = getThemeAccent();

                  for (const conn of connectionsWithDepth) {
                    const { p1, p2, isNear } = conn;
                    if ((p1.visibility ?? 1) < visThresh || (p2.visibility ?? 1) < visThresh) continue;

                    const x1 = box.left + p1.x * box.width;
                    const y1 = box.top + p1.y * box.height;
                    const x2 = box.left + p2.x * box.width;
                    const y2 = box.top + p2.y * box.height;

                    if (showDepthShading) {
                      if (isNear) {
                        // Foreground Near Limb: High-luminescence neon glow with crisp white core
                        ctx.beginPath();
                        ctx.moveTo(x1, y1);
                        ctx.lineTo(x2, y2);
                        ctx.strokeStyle = `rgba(${themeAccent.rgb}, 0.38)`;
                        ctx.lineWidth = 7.5;
                        ctx.lineCap = 'round';
                        ctx.stroke();

                        ctx.beginPath();
                        ctx.moveTo(x1, y1);
                        ctx.lineTo(x2, y2);
                        ctx.strokeStyle = '#ffffff';
                        ctx.lineWidth = 1.0;
                        ctx.lineCap = 'round';
                        ctx.stroke();

                        ctx.beginPath();
                        ctx.moveTo(x1, y1);
                        ctx.lineTo(x2, y2);
                        ctx.strokeStyle = themeAccent.color;
                        ctx.lineWidth = 3.6;
                        ctx.lineCap = 'round';
                        ctx.stroke();
                      } else {
                        // Background Far Limb: 2.5D Dimmed desaturated slate core, subtle depth cue
                        ctx.beginPath();
                        ctx.moveTo(x1, y1);
                        ctx.lineTo(x2, y2);
                        ctx.strokeStyle = `rgba(51, 65, 85, 0.50)`;
                        ctx.lineWidth = 3.8;
                        ctx.lineCap = 'round';
                        ctx.stroke();

                        ctx.beginPath();
                        ctx.moveTo(x1, y1);
                        ctx.lineTo(x2, y2);
                        ctx.strokeStyle = `rgba(${themeAccent.rgb}, 0.40)`;
                        ctx.lineWidth = 1.8;
                        ctx.lineCap = 'round';
                        ctx.stroke();
                      }
                    } else {
                      // Standard uniform glow
                      ctx.beginPath();
                      ctx.moveTo(x1, y1);
                      ctx.lineTo(x2, y2);
                      ctx.strokeStyle = `rgba(${themeAccent.rgb}, 0.28)`;
                      ctx.lineWidth = 6;
                      ctx.lineCap = 'round';
                      ctx.stroke();

                      ctx.beginPath();
                      ctx.moveTo(x1, y1);
                      ctx.lineTo(x2, y2);
                      ctx.strokeStyle = themeAccent.color;
                      ctx.lineWidth = 3;
                      ctx.lineCap = 'round';
                      ctx.stroke();
                    }
                  }

                  // Joint Nodes with 3D Depth Ordering
                  const liveThemeAccent = getThemeAccent();
                  const JOINT_NODES = [
                    { idx: 11, color: '#38bdf8', side: 'L' }, { idx: 12, color: '#38bdf8', side: 'R' },
                    { idx: 13, color: '#ec4899', side: 'L' }, { idx: 14, color: '#ec4899', side: 'R' },
                    { idx: 15, color: '#ec4899', side: 'L' }, { idx: 16, color: '#ec4899', side: 'R' },
                    { idx: 23, color: '#818cf8', side: 'L' }, { idx: 24, color: '#818cf8', side: 'R' },
                    { idx: 25, color: liveThemeAccent.color, side: 'L' }, { idx: 26, color: liveThemeAccent.color, side: 'R' },
                    { idx: 27, color: '#f59e0b', side: 'L' }, { idx: 28, color: '#f59e0b', side: 'R' },
                    { idx: 31, color: '#f59e0b', side: 'L' }, { idx: 32, color: '#f59e0b', side: 'R' },
                    { idx: 0,  color: '#ef4444', side: 'C' }
                  ];

                  const sortedJoints = [...JOINT_NODES];
                  if (showDepthShading) {
                    sortedJoints.sort((a, b) => {
                      const pA = lm[a.idx];
                      const pB = lm[b.idx];
                      return (pB?.z ?? 0) - (pA?.z ?? 0);
                    });
                  }

                  for (const j of sortedJoints) {
                    const p = lm[j.idx];
                    if (!p || (p.visibility ?? 1) < visThresh) continue;
                    const jx = box.left + p.x * box.width;
                    const jy = box.top + p.y * box.height;

                    const isNear = !showDepthShading || (j.side === 'L' ? isLeftNear : j.side === 'R' ? !isLeftNear : (p.z ?? 0) < 0);
                    const radius = isNear ? 5.0 : 3.2;
                    const innerRadius = isNear ? 2.2 : 1.2;

                    if (isNear && showDepthShading) {
                      ctx.beginPath();
                      ctx.arc(jx, jy, radius + 2.5, 0, Math.PI * 2);
                      ctx.fillStyle = `rgba(0, 240, 255, 0.22)`;
                      ctx.fill();
                    }

                    ctx.beginPath();
                    ctx.arc(jx, jy, radius, 0, Math.PI * 2);
                    ctx.fillStyle = isNear ? j.color : 'rgba(100, 116, 139, 0.75)';
                    ctx.fill();

                    ctx.beginPath();
                    ctx.arc(jx, jy, innerRadius, 0, Math.PI * 2);
                    ctx.fillStyle = isNear ? '#ffffff' : 'rgba(255, 255, 255, 0.6)';
                    ctx.fill();
                  }

                  const lAnk = lm[27];
                  const rAnk = lm[28];
                  const lToe = lm[31] || lAnk;
                  const rToe = lm[32] || rAnk;

                  const hasLeft = lHip && lKnee && lAnk;
                  const hasRight = hip && knee && ankle;

                  if (hasLeft || hasRight || shoulder || lShoulder) {
                    // 1. Precise Biomechanical Joint Angles (calculated in true square sensor pixels with visibility gating)
                    const lKneeValid = lHip && lKnee && lAnk && (lHip.visibility ?? 1) >= visThresh && (lKnee.visibility ?? 1) >= visThresh && (lAnk.visibility ?? 1) >= visThresh;
                    const rKneeValid = hip && knee && ankle && (hip.visibility ?? 1) >= visThresh && (knee.visibility ?? 1) >= visThresh && (ankle.visibility ?? 1) >= visThresh;
                    const lKneeAngle = lKneeValid ? calculateAngle(toVideoPt(lHip), toVideoPt(lKnee), toVideoPt(lAnk)) : 0;
                    const rKneeAngle = rKneeValid ? calculateAngle(toVideoPt(hip), toVideoPt(knee), toVideoPt(ankle)) : 0;

                    const lHipValid = lShoulder && lHip && lKnee && (lShoulder.visibility ?? 1) >= visThresh && (lHip.visibility ?? 1) >= visThresh && (lKnee.visibility ?? 1) >= visThresh;
                    const rHipValid = shoulder && hip && knee && (shoulder.visibility ?? 1) >= visThresh && (hip.visibility ?? 1) >= visThresh && (knee.visibility ?? 1) >= visThresh;
                    const lHipAngle = lHipValid ? calculateAngle(toVideoPt(lShoulder), toVideoPt(lHip), toVideoPt(lKnee)) : 0;
                    const rHipAngle = rHipValid ? calculateAngle(toVideoPt(shoulder), toVideoPt(hip), toVideoPt(knee)) : 0;

                    let lElbowAngle = 0;
                    if (lShoulder && lElbow && lWrist && (lShoulder.visibility ?? 1) >= visThresh && (lElbow.visibility ?? 1) >= visThresh && (lWrist.visibility ?? 1) >= visThresh) {
                      lElbowAngle = calculateAngle(toVideoPt(lShoulder), toVideoPt(lElbow), toVideoPt(lWrist));
                    }
                    let rElbowAngle = 0;
                    if (shoulder && elbow && wrist && (shoulder.visibility ?? 1) >= visThresh && (elbow.visibility ?? 1) >= visThresh && (wrist.visibility ?? 1) >= visThresh) {
                      rElbowAngle = calculateAngle(toVideoPt(shoulder), toVideoPt(elbow), toVideoPt(wrist));
                    }

                    let lAnkleAngle = 0;
                    if (lKnee && lAnk && lFootIndex && (lKnee.visibility ?? 1) >= visThresh && (lAnk.visibility ?? 1) >= visThresh) {
                      lAnkleAngle = calculateAngle(toVideoPt(lKnee), toVideoPt(lAnk), toVideoPt(lFootIndex));
                    }
                    let rAnkleAngle = 0;
                    if (knee && ankle && footIndex && (knee.visibility ?? 1) >= visThresh && (ankle.visibility ?? 1) >= visThresh) {
                      rAnkleAngle = calculateAngle(toVideoPt(knee), toVideoPt(ankle), toVideoPt(footIndex));
                    }

                    // Metric 1: Torso / Trunk Lean Angle relative to vertical
                    let trunkAngle = 0;
                    const topShoulder = (lShoulder && shoulder) 
                      ? { x: ((lShoulder.x + shoulder.x) / 2) * vWidth, y: ((lShoulder.y + shoulder.y) / 2) * vHeight }
                      : lShoulder ? toVideoPt(lShoulder) : shoulder ? toVideoPt(shoulder) : null;
                    const baseHip = (lHip && hip)
                      ? { x: ((lHip.x + hip.x) / 2) * vWidth, y: ((lHip.y + hip.y) / 2) * vHeight }
                      : lHip ? toVideoPt(lHip) : hip ? toVideoPt(hip) : null;

                    if (topShoulder && baseHip) {
                      const dx = topShoulder.x - baseHip.x;
                      const dy = baseHip.y - topShoulder.y;
                      if (dy > 0) {
                        trunkAngle = Math.min(65, Math.max(0, Math.atan2(Math.abs(dx), dy) * (180 / Math.PI)));
                      }
                    }

                    // Metric 2: Touchdown Shin Angles (attack vs braking relative to vertical)
                    let lShinAngle = 0;
                    if (lKnee && lAnk && (lKnee.visibility ?? 1) >= visThresh && (lAnk.visibility ?? 1) >= visThresh) {
                      lShinAngle = Math.atan2((lKnee.x - lAnk.x) * vWidth, (lAnk.y - lKnee.y) * vHeight) * (180 / Math.PI);
                    }
                    let rShinAngle = 0;
                    if (knee && ankle && (knee.visibility ?? 1) >= visThresh && (ankle.visibility ?? 1) >= visThresh) {
                      rShinAngle = Math.atan2((knee.x - ankle.x) * vWidth, (ankle.y - knee.y) * vHeight) * (180 / Math.PI);
                    }

                    // Metric 3: Thigh Separation Angle (scissor action between femurs)
                    let thighSepAngle = 0;
                    if (lKnee && knee && baseHip && (lKnee.visibility ?? 1) >= visThresh && (knee.visibility ?? 1) >= visThresh) {
                      thighSepAngle = calculateAngle(toVideoPt(lKnee), baseHip, toVideoPt(knee));
                    }

                    // Determine Near (foreground) vs Far (background) Limbs
                    const primarySide = isLeftNear ? 'L' : 'R';
                    const secSide = isLeftNear ? 'R' : 'L';

                    const primaryHip = isLeftNear ? lHip : hip;
                    const primaryKnee = isLeftNear ? lKnee : knee;
                    const primaryAnkle = isLeftNear ? lAnk : ankle;
                    const primaryShoulder = isLeftNear ? lShoulder : shoulder;
                    const primaryElbow = isLeftNear ? lElbow : elbow;
                    const primaryWrist = isLeftNear ? lWrist : wrist;

                    const secHip = isLeftNear ? hip : lHip;
                    const secKnee = isLeftNear ? knee : lKnee;
                    const secAnkle = isLeftNear ? ankle : lAnk;
                    const secShoulder = isLeftNear ? shoulder : lShoulder;
                    const secElbow = isLeftNear ? elbow : lElbow;
                    const secWrist = isLeftNear ? wrist : lWrist;

                    const primaryKneeAngle = isLeftNear ? lKneeAngle : rKneeAngle;
                    const secKneeAngle = isLeftNear ? rKneeAngle : lKneeAngle;
                    const primaryHipAngle = isLeftNear ? lHipAngle : rHipAngle;
                    const secHipAngle = isLeftNear ? rHipAngle : lHipAngle;
                    const primaryShinAngle = isLeftNear ? lShinAngle : rShinAngle;
                    const secShinAngle = isLeftNear ? rShinAngle : lShinAngle;
                    const primaryElbowAngle = isLeftNear ? lElbowAngle : rElbowAngle;
                    const secElbowAngle = isLeftNear ? rElbowAngle : lElbowAngle;

                    // Fallback Badge Drawing when Arcs are Disabled
                    const drawAngleBadge = (text, px, py, color, offset = 14) => {
                      ctx.save();
                      ctx.font = 'bold 11px monospace';
                      const m = ctx.measureText(text);
                      const pw = m.width + 12;
                      const ph = 20;
                      const bx = px + offset;
                      const by = py - 10;
                      ctx.fillStyle = 'rgba(10, 15, 29, 0.90)';
                      ctx.strokeStyle = color;
                      ctx.lineWidth = 1.2;
                      if (ctx.roundRect) {
                        ctx.beginPath();
                        ctx.roundRect(bx, by, pw, ph, 4);
                        ctx.fill();
                        ctx.stroke();
                      } else {
                        ctx.fillRect(bx, by, pw, ph);
                        ctx.strokeRect(bx, by, pw, ph);
                      }
                      ctx.fillStyle = color;
                      ctx.textAlign = 'left';
                      ctx.textBaseline = 'middle';
                      ctx.fillText(text, bx + 6, by + 10);
                      ctx.restore();
                    };

                    // Dynamic Angular Arc / Wedge Visualization with Live Floating Degree Label
                    const drawAngleArc = (vertex, p1, p2, radius, color, labelText = null, isNear = true, isDashed = false) => {
                      if (!vertex || !p1 || !p2 || !showAngleArcs) return;
                      const vx = box.left + vertex.x * box.width;
                      const vy = box.top + vertex.y * box.height;
                      const p1x = box.left + p1.x * box.width;
                      const p1y = box.top + p1.y * box.height;
                      const p2x = box.left + p2.x * box.width;
                      const p2y = box.top + p2.y * box.height;

                      const a1 = Math.atan2(p1y - vy, p1x - vx);
                      const a2 = Math.atan2(p2y - vy, p2x - vx);
                      if (isNaN(a1) || isNaN(a2)) return;

                      let diff = a2 - a1;
                      while (diff < -Math.PI) diff += Math.PI * 2;
                      while (diff > Math.PI) diff -= Math.PI * 2;

                      ctx.save();
                      const rgb = color === '#00D084' ? '0, 208, 132' : 
                                  color === '#3b82f6' ? '59, 130, 246' : 
                                  color === '#ec4899' ? '236, 72, 153' : 
                                  color === '#a855f7' ? '168, 85, 247' : 
                                  color === '#f59e0b' ? '245, 158, 11' : '0, 240, 255';

                      // Smooth semi-transparent wedge fill
                      ctx.beginPath();
                      ctx.moveTo(vx, vy);
                      ctx.arc(vx, vy, radius, a1, a1 + diff, diff < 0);
                      ctx.closePath();
                      ctx.fillStyle = isNear ? `rgba(${rgb}, 0.28)` : `rgba(71, 85, 105, 0.20)`;
                      ctx.fill();

                      // Glowing outer perimeter arc
                      ctx.beginPath();
                      if (isDashed) ctx.setLineDash([3, 3]);
                      ctx.arc(vx, vy, radius, a1, a1 + diff, diff < 0);
                      ctx.strokeStyle = isNear ? color : 'rgba(148, 163, 184, 0.65)';
                      ctx.lineWidth = isNear ? 2.4 : 1.4;
                      if (isNear) {
                        ctx.shadowColor = color;
                        ctx.shadowBlur = 6;
                      }
                      ctx.stroke();
                      if (isDashed) ctx.setLineDash([]);
                      ctx.shadowBlur = 0;

                      // Radius ray indicators
                      ctx.beginPath();
                      ctx.moveTo(vx, vy);
                      ctx.lineTo(vx + Math.cos(a1) * (radius + 4), vy + Math.sin(a1) * (radius + 4));
                      ctx.moveTo(vx, vy);
                      ctx.lineTo(vx + Math.cos(a1 + diff) * (radius + 4), vy + Math.sin(a1 + diff) * (radius + 4));
                      ctx.strokeStyle = isNear ? color : 'rgba(148, 163, 184, 0.6)';
                      ctx.lineWidth = 1.2;
                      ctx.stroke();

                      // Live floating degree badge along angle bisector
                      if (labelText) {
                        const bisectorAngle = a1 + (diff / 2);
                        const lblDist = radius + 22;
                        const lblX = vx + Math.cos(bisectorAngle) * lblDist;
                        const lblY = vy + Math.sin(bisectorAngle) * lblDist;

                        ctx.font = isNear ? 'bold 11px monospace' : '9px monospace';
                        const tm = ctx.measureText(labelText);
                        const pw = tm.width + 12;
                        const ph = isNear ? 20 : 17;
                        const bx = Math.max(8, Math.min(box.left + box.width - pw - 8, lblX - pw / 2));
                        const by = Math.max(8, Math.min(box.top + box.height - ph - 8, lblY - ph / 2));

                        // Subtle leader ray from arc to badge
                        ctx.beginPath();
                        ctx.moveTo(vx + Math.cos(bisectorAngle) * radius, vy + Math.sin(bisectorAngle) * radius);
                        ctx.lineTo(bx + pw / 2, by + ph / 2);
                        ctx.strokeStyle = `rgba(${rgb}, ${isNear ? 0.6 : 0.35})`;
                        ctx.lineWidth = 1;
                        ctx.stroke();

                        ctx.fillStyle = 'rgba(10, 15, 29, 0.94)';
                        ctx.strokeStyle = isNear ? color : 'rgba(148, 163, 184, 0.5)';
                        ctx.lineWidth = isNear ? 1.4 : 1;
                        if (isNear) {
                          ctx.shadowColor = color;
                          ctx.shadowBlur = 4;
                        }
                        if (ctx.roundRect) {
                          ctx.beginPath();
                          ctx.roundRect(bx, by, pw, ph, 4);
                          ctx.fill();
                          ctx.stroke();
                        } else {
                          ctx.fillRect(bx, by, pw, ph);
                          ctx.strokeRect(bx, by, pw, ph);
                        }
                        ctx.shadowBlur = 0;
                        ctx.fillStyle = isNear ? '#ffffff' : '#cbd5e1';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(labelText, bx + pw / 2, by + ph / 2);
                      }
                      ctx.restore();
                    };

                    // Draw Knee Angles
                    if (activeMetrics.knee) {
                      if (primaryKnee && primaryHip && primaryAnkle && (primaryKnee.visibility ?? 1) > visThresh) {
                        if (showAngleArcs) {
                          drawAngleArc(primaryKnee, primaryHip, primaryAnkle, 34, '#00D084', `Knee [${primarySide}]: ${Math.round(primaryKneeAngle)}°`, true);
                        } else {
                          drawAngleBadge(`Knee [${primarySide}]: ${Math.round(primaryKneeAngle)}°`, box.left + primaryKnee.x * box.width, box.top + primaryKnee.y * box.height, '#00D084');
                        }
                      }
                      if (secKnee && secHip && secAnkle && (secKnee.visibility ?? 1) > visThresh) {
                        if (showAngleArcs) {
                          drawAngleArc(secKnee, secHip, secAnkle, 24, '#00D084', `Knee [${secSide}]: ${Math.round(secKneeAngle)}°`, false, true);
                        } else {
                          drawAngleBadge(`Knee [${secSide}]: ${Math.round(secKneeAngle)}°`, box.left + secKnee.x * box.width, box.top + secKnee.y * box.height, '#64748b');
                        }
                      }
                    }

                    // Draw Hip Angles
                    if (activeMetrics.hip) {
                      if (primaryHip && primaryShoulder && primaryKnee && (primaryHip.visibility ?? 1) > visThresh) {
                        if (showAngleArcs) {
                          drawAngleArc(primaryHip, primaryShoulder, primaryKnee, 34, '#3b82f6', `Hip [${primarySide}]: ${Math.round(primaryHipAngle)}°`, true);
                        } else {
                          drawAngleBadge(`Hip [${primarySide}]: ${Math.round(primaryHipAngle)}°`, box.left + primaryHip.x * box.width, box.top + primaryHip.y * box.height, '#3b82f6');
                        }
                      }
                      if (secHip && secShoulder && secKnee && (secHip.visibility ?? 1) > visThresh) {
                        if (showAngleArcs) {
                          drawAngleArc(secHip, secShoulder, secKnee, 24, '#3b82f6', `Hip [${secSide}]: ${Math.round(secHipAngle)}°`, false, true);
                        }
                      }
                    }

                    // Thigh Separation Scissor Action Arc
                    if (lKnee && knee && baseHip && (lKnee.visibility ?? 1) > visThresh && (knee.visibility ?? 1) > visThresh && thighSepAngle > 10) {
                      const midHipNorm = { x: baseHip.x / vWidth, y: baseHip.y / vHeight };
                      if (showAngleArcs) {
                        drawAngleArc(midHipNorm, lKnee, knee, 36, '#ec4899', `Scissor: ${Math.round(thighSepAngle)}°`, true);
                      }
                    }

                    // Draw Torso / Trunk Lean Angle
                    if (activeMetrics.trunk && topShoulder && baseHip) {
                      const midHipNorm = { x: baseHip.x / vWidth, y: baseHip.y / vHeight };
                      const trunkVRef = { x: midHipNorm.x, y: midHipNorm.y - 0.25 };
                      const topShoulderNorm = { x: topShoulder.x / vWidth, y: topShoulder.y / vHeight };
                      if (showAngleArcs) {
                        drawAngleArc(midHipNorm, trunkVRef, topShoulderNorm, 32, '#a855f7', `Trunk: ${Math.round(trunkAngle)}°`, true);
                      } else {
                        drawAngleBadge(`Trunk: ${Math.round(trunkAngle)}°`, box.left + topShoulderNorm.x * box.width, box.top + topShoulderNorm.y * box.height, '#a855f7');
                      }
                    }

                    // Draw Shin Angles
                    if (activeMetrics.shin) {
                      if (primaryAnkle && primaryKnee && (primaryAnkle.visibility ?? 1) > visThresh) {
                        const shinVRef = { x: primaryAnkle.x, y: primaryAnkle.y - 0.25 };
                        if (showAngleArcs) {
                          drawAngleArc(primaryAnkle, shinVRef, primaryKnee, 28, '#f59e0b', `Shin [${primarySide}]: ${Math.round(primaryShinAngle)}°`, true);
                        } else {
                          drawAngleBadge(`Shin [${primarySide}]: ${Math.round(primaryShinAngle)}°`, box.left + primaryAnkle.x * box.width, box.top + primaryAnkle.y * box.height, '#f59e0b');
                        }
                      }
                    }

                    // Draw Elbow Angles
                    if (activeMetrics.elbow) {
                      if (primaryElbow && primaryShoulder && primaryWrist && (primaryElbow.visibility ?? 1) > visThresh) {
                        if (showAngleArcs) {
                          drawAngleArc(primaryElbow, primaryShoulder, primaryWrist, 26, '#ec4899', `Elbow [${primarySide}]: ${Math.round(primaryElbowAngle)}°`, true);
                        } else {
                          drawAngleBadge(`Elbow [${primarySide}]: ${Math.round(primaryElbowAngle)}°`, box.left + primaryElbow.x * box.width, box.top + primaryElbow.y * box.height, '#ec4899');
                        }
                      }
                    }

                    // Shin Angle Attack Trajectory Vectors (Attack vs Braking)
                    if (showShinVector && primaryKnee && primaryAnkle && (primaryAnkle.visibility ?? 1) > visThresh && (primaryKnee.visibility ?? 1) > visThresh) {
                      const kx = box.left + primaryKnee.x * box.width;
                      const ky = box.top + primaryKnee.y * box.height;
                      const ax = box.left + primaryAnkle.x * box.width;
                      const ay = box.top + primaryAnkle.y * box.height;

                      const isAttack = primaryShinAngle >= 3;
                      const isBrake = primaryShinAngle <= -3;
                      const vectorColor = isAttack ? '#00D084' : isBrake ? '#ef4444' : '#00F0FF';
                      const vectorLabel = isAttack ? `▲ SHIN ATTACK [${primarySide}]: +${primaryShinAngle.toFixed(1)}° (CLAW-BACK)` :
                                          isBrake  ? `▼ SHIN BRAKE [${primarySide}]: ${primaryShinAngle.toFixed(1)}° (OVERSTRIDE)` :
                                                     `● SHIN STRIKE [${primarySide}]: ${primaryShinAngle.toFixed(1)}° (VERTICAL)`;

                      ctx.save();
                      // 1. Draw glowing vector arrow along the shin axis
                      ctx.beginPath();
                      ctx.moveTo(kx, ky);
                      ctx.lineTo(ax, ay);
                      ctx.strokeStyle = vectorColor;
                      ctx.lineWidth = 3.5;
                      ctx.shadowColor = vectorColor;
                      ctx.shadowBlur = 8;
                      ctx.stroke();

                      // Arrowhead at ankle indicating foot attack direction
                      const shinDir = Math.atan2(ay - ky, ax - kx);
                      const arrowLen = 9;
                      ctx.beginPath();
                      ctx.moveTo(ax, ay);
                      ctx.lineTo(ax - arrowLen * Math.cos(shinDir - Math.PI / 6), ay - arrowLen * Math.sin(shinDir - Math.PI / 6));
                      ctx.moveTo(ax, ay);
                      ctx.lineTo(ax - arrowLen * Math.cos(shinDir + Math.PI / 6), ay - arrowLen * Math.sin(shinDir + Math.PI / 6));
                      ctx.strokeStyle = vectorColor;
                      ctx.lineWidth = 2.4;
                      ctx.stroke();

                      // 2. Projected Ground Attack Ray to Track Floor
                      const groundY = Math.min(box.top + box.height - 8, ay + 30);
                      const groundRayX = ax + (ax - kx) * 0.45;

                      ctx.beginPath();
                      ctx.setLineDash([4, 4]);
                      ctx.moveTo(ax, ay);
                      ctx.lineTo(groundRayX, groundY);
                      ctx.strokeStyle = `rgba(${vectorColor === '#00D084' ? '0, 208, 132' : vectorColor === '#ef4444' ? '239, 68, 68' : '0, 240, 255'}, 0.85)`;
                      ctx.lineWidth = 1.8;
                      ctx.stroke();
                      ctx.setLineDash([]);

                      // Ground Impact Target Crosshair
                      ctx.beginPath();
                      ctx.arc(groundRayX, groundY, 4.5, 0, Math.PI * 2);
                      ctx.strokeStyle = vectorColor;
                      ctx.lineWidth = 1.5;
                      ctx.stroke();

                      ctx.beginPath();
                      ctx.moveTo(groundRayX - 7, groundY);
                      ctx.lineTo(groundRayX + 7, groundY);
                      ctx.moveTo(groundRayX, groundY - 7);
                      ctx.lineTo(groundRayX + 7, groundY);
                      ctx.strokeStyle = vectorColor;
                      ctx.lineWidth = 1.2;
                      ctx.stroke();

                      // 3. Floating HUD Badge for Shin Attack Vector
                      ctx.font = 'bold 10px monospace';
                      const vm = ctx.measureText(vectorLabel);
                      const vpw = vm.width + 14;
                      const vph = 22;
                      const vbx = Math.max(10, Math.min(box.left + box.width - vpw - 10, ax + 16));
                      const vby = Math.max(10, Math.min(box.top + box.height - vph - 10, ay - 14));

                      ctx.fillStyle = 'rgba(10, 15, 29, 0.94)';
                      ctx.strokeStyle = vectorColor;
                      ctx.lineWidth = 1.4;
                      ctx.shadowBlur = 4;
                      if (ctx.roundRect) {
                        ctx.beginPath();
                        ctx.roundRect(vbx, vby, vpw, vph, 4);
                        ctx.fill();
                        ctx.stroke();
                      } else {
                        ctx.fillRect(vbx, vby, vpw, vph);
                        ctx.strokeRect(vbx, vby, vpw, vph);
                      }
                      ctx.shadowBlur = 0;
                      ctx.fillStyle = vectorColor;
                      ctx.textAlign = 'left';
                      ctx.textBaseline = 'middle';
                      ctx.fillText(vectorLabel, vbx + 7, vby + 11);
                      ctx.restore();
                    }

                    // Center of Mass (CoM) Trajectory Trail (illuminated fading neon trail)
                    if (showComTrail && (hip || lHip)) {
                      const useBothHips = hip && lHip && (hip.visibility ?? 1) > visThresh && (lHip.visibility ?? 1) > visThresh;
                      const hX = useBothHips ? (hip.x + lHip.x) / 2 : (hip ? hip.x : lHip.x);
                      const hY = useBothHips ? (hip.y + lHip.y) / 2 : (hip ? hip.y : lHip.y);
                      const comX = box.left + hX * box.width;
                      const comY = box.top + hY * box.height;
                      const nowSec = video.currentTime;
                      
                      const trail = comTrailRef.current;
                      if (trail.length > 0) {
                        const lastTime = trail[trail.length - 1].time;
                        if (nowSec < lastTime - 0.25 || Math.abs(nowSec - lastTime) > 1.2) {
                          comTrailRef.current = [];
                        }
                      }
                      const currentTrail = comTrailRef.current;
                      if (currentTrail.length === 0 || Math.abs(currentTrail[currentTrail.length - 1].time - nowSec) > 0.015) {
                        const prevPt = currentTrail.length > 0 ? currentTrail[currentTrail.length - 1] : null;
                        const vy = prevPt ? (comY - prevPt.y) : 0;
                        currentTrail.push({ x: comX, y: comY, time: nowSec, vy });
                        if (currentTrail.length > 50) currentTrail.shift();
                      }
                      if (trail.length > 2) {
                        ctx.save();
                        ctx.lineCap = 'round';
                        ctx.lineJoin = 'round';

                        // Calculate vertical oscillation bounding range
                        let minY = 99999, maxY = -99999;
                        trail.forEach(pt => {
                          if (pt.y < minY) minY = pt.y;
                          if (pt.y > maxY) maxY = pt.y;
                        });
                        const verticalOscillationPx = maxY - minY;

                        for (let t = 1; t < trail.length; t++) {
                          const pPrev = trail[t - 1];
                          const pCurr = trail[t];
                          if (Math.abs(pCurr.time - pPrev.time) > 0.25) continue;
                          const alpha = (t / trail.length) * 0.95;

                          // Color-coded illumination: cyan during flight rise, amber during landing dip, emerald level
                          const isRising = pCurr.y < pPrev.y - 0.4;
                          const isDipping = pCurr.y > pPrev.y + 0.4;
                          const trailColor = isRising ? '0, 240, 255' : isDipping ? '245, 158, 11' : '0, 208, 132';

                          // Wide diffused glow ribbon
                          ctx.beginPath();
                          ctx.moveTo(pPrev.x, pPrev.y);
                          ctx.lineTo(pCurr.x, pCurr.y);
                          ctx.strokeStyle = `rgba(${trailColor}, ${alpha * 0.42})`;
                          ctx.lineWidth = 7.5;
                          ctx.stroke();

                          // High-luminescence inner spline
                          ctx.beginPath();
                          ctx.moveTo(pPrev.x, pPrev.y);
                          ctx.lineTo(pCurr.x, pCurr.y);
                          ctx.strokeStyle = `rgba(${trailColor}, ${alpha * 0.95})`;
                          ctx.lineWidth = 3.2;
                          ctx.stroke();

                          // Crisp white core thread
                          ctx.beginPath();
                          ctx.moveTo(pPrev.x, pPrev.y);
                          ctx.lineTo(pCurr.x, pCurr.y);
                          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.85})`;
                          ctx.lineWidth = 1.2;
                          ctx.stroke();

                          // Vertical displacement oscillation ticks (every 5th point)
                          if (t % 5 === 0) {
                            ctx.beginPath();
                            ctx.moveTo(pCurr.x, pCurr.y - 5);
                            ctx.lineTo(pCurr.x, pCurr.y + 5);
                            ctx.strokeStyle = `rgba(0, 240, 255, ${alpha * 0.75})`;
                            ctx.lineWidth = 1.2;
                            ctx.stroke();
                          }
                        }

                        // Horizontal guideline showing coach vertical displacement bounds
                        if (trail.length >= 8 && verticalOscillationPx > 4) {
                          const firstX = trail[0].x;
                          const lastX = trail[trail.length - 1].x;
                          ctx.setLineDash([3, 3]);
                          ctx.beginPath();
                          ctx.moveTo(firstX, maxY);
                          ctx.lineTo(lastX, maxY);
                          ctx.moveTo(firstX, minY);
                          ctx.lineTo(lastX, minY);
                          ctx.strokeStyle = 'rgba(0, 240, 255, 0.28)';
                          ctx.lineWidth = 1;
                          ctx.stroke();
                          ctx.setLineDash([]);
                        }

                        // Dynamic Pelvis / CoM Targeting Reticle
                        ctx.save();
                        // Outer dashed reticle ring
                        ctx.setLineDash([4, 3]);
                        ctx.beginPath();
                        ctx.arc(comX, comY, 11, 0, Math.PI * 2);
                        ctx.strokeStyle = 'rgba(0, 240, 255, 0.85)';
                        ctx.lineWidth = 1.4;
                        ctx.stroke();
                        ctx.setLineDash([]);

                        // Crosshairs
                        ctx.beginPath();
                        ctx.moveTo(comX - 15, comY);
                        ctx.lineTo(comX - 6, comY);
                        ctx.moveTo(comX + 6, comY);
                        ctx.lineTo(comX + 15, comY);
                        ctx.moveTo(comX, comY - 15);
                        ctx.lineTo(comX, comY - 6);
                        ctx.moveTo(comX, comY + 6);
                        ctx.lineTo(comX, comY + 15);
                        ctx.strokeStyle = 'rgba(0, 240, 255, 0.9)';
                        ctx.lineWidth = 1.2;
                        ctx.stroke();

                        // Center illuminated CoM node
                        ctx.beginPath();
                        ctx.arc(comX, comY, 4, 0, Math.PI * 2);
                        ctx.fillStyle = '#00F0FF';
                        ctx.shadowColor = '#00F0FF';
                        ctx.shadowBlur = 12;
                        ctx.fill();

                        // Floating CoM HUD Tag
                        ctx.font = 'bold 9px monospace';
                        const comTag = '⊕ CoM';
                        const ctm = ctx.measureText(comTag);
                        const cpw = ctm.width + 10;
                        const cph = 16;
                        const cbx = comX + 14;
                        const cby = comY - 8;
                        ctx.fillStyle = 'rgba(10, 15, 29, 0.92)';
                        ctx.strokeStyle = 'rgba(0, 240, 255, 0.7)';
                        ctx.lineWidth = 1;
                        ctx.shadowBlur = 0;
                        if (ctx.roundRect) {
                          ctx.beginPath();
                          ctx.roundRect(cbx, cby, cpw, cph, 3);
                          ctx.fill();
                          ctx.stroke();
                        } else {
                          ctx.fillRect(cbx, cby, cpw, cph);
                          ctx.strokeRect(cbx, cby, cpw, cph);
                        }
                        ctx.fillStyle = '#00F0FF';
                        ctx.textAlign = 'left';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(comTag, cbx + 5, cby + cph / 2);

                        ctx.restore();
                        ctx.restore();
                      }
                    }

                    // Ground Impact Flash & GCT Millisecond Stance Phase Tracking
                    const nowSec = video.currentTime;
                    const nowMs = performance.now();
                    const dt = nowSec - (footVelocityRef.current.lastTime || 0);

                    if (dt > 0.015 && dt < 0.25) {
                      // Left foot touchdown and stance detection
                      if (lToe && (lToe.visibility ?? 1) > visThresh && footVelocityRef.current.prevLY !== null) {
                        const vyL = (lToe.y - footVelocityRef.current.prevLY) / dt;
                        const isFootLowL = lToe.y > ((lKnee?.y || lHip?.y || 0.4) + 0.04);
                        const isTouchdown = footVelocityRef.current.prevLVy > 0.05 && vyL <= 0.035 && isFootLowL;

                        if (isTouchdown && !gctTrackingRef.current.left.inStance) {
                          gctTrackingRef.current.left.inStance = true;
                          gctTrackingRef.current.left.startSec = nowSec;
                          gctTrackingRef.current.left.x = box.left + lToe.x * box.width;
                          gctTrackingRef.current.left.y = box.top + lToe.y * box.height;
                          if (showFootRipples) {
                            impactRipplesRef.current.push({
                              x: gctTrackingRef.current.left.x,
                              y: gctTrackingRef.current.left.y,
                              startTime: performance.now(),
                              duration: 750,
                              side: 'L',
                              color: '#00D084',
                              accentColor: '#34d399'
                            });
                          }
                        } else if (gctTrackingRef.current.left.inStance) {
                          // Toe-off detection: foot begins moving upward
                          if (vyL < -0.06 || lToe.y < footVelocityRef.current.prevLY - 0.012) {
                            gctTrackingRef.current.left.inStance = false;
                            const dur = Math.round((nowSec - gctTrackingRef.current.left.startSec) * 1000);
                            gctTrackingRef.current.left.finalGctMs = Math.max(65, Math.min(260, dur));
                            gctTrackingRef.current.left.freezeUntilMs = nowMs + 900;
                            gctTrackingRef.current.left.tier = gctTrackingRef.current.left.finalGctMs < 100 ? 'elite' : gctTrackingRef.current.left.finalGctMs <= 125 ? 'standard' : 'braking';
                          } else {
                            gctTrackingRef.current.left.x = box.left + lToe.x * box.width;
                            gctTrackingRef.current.left.y = box.top + lToe.y * box.height;
                          }
                        }
                        footVelocityRef.current.prevLVy = vyL;
                      }

                      // Right foot touchdown and stance detection
                      if (rToe && (rToe.visibility ?? 1) > visThresh && footVelocityRef.current.prevRY !== null) {
                        const vyR = (rToe.y - footVelocityRef.current.prevRY) / dt;
                        const isFootLowR = rToe.y > ((knee?.y || hip?.y || 0.4) + 0.04);
                        const isTouchdown = footVelocityRef.current.prevRVy > 0.05 && vyR <= 0.035 && isFootLowR;

                        if (isTouchdown && !gctTrackingRef.current.right.inStance) {
                          gctTrackingRef.current.right.inStance = true;
                          gctTrackingRef.current.right.startSec = nowSec;
                          gctTrackingRef.current.right.x = box.left + rToe.x * box.width;
                          gctTrackingRef.current.right.y = box.top + rToe.y * box.height;
                          if (showFootRipples) {
                            impactRipplesRef.current.push({
                              x: gctTrackingRef.current.right.x,
                              y: gctTrackingRef.current.right.y,
                              startTime: performance.now(),
                              duration: 750,
                              side: 'R',
                              color: '#00F0FF',
                              accentColor: '#38bdf8'
                            });
                          }
                        } else if (gctTrackingRef.current.right.inStance) {
                          if (vyR < -0.06 || rToe.y < footVelocityRef.current.prevRY - 0.012) {
                            gctTrackingRef.current.right.inStance = false;
                            const dur = Math.round((nowSec - gctTrackingRef.current.right.startSec) * 1000);
                            gctTrackingRef.current.right.finalGctMs = Math.max(65, Math.min(260, dur));
                            gctTrackingRef.current.right.freezeUntilMs = nowMs + 900;
                            gctTrackingRef.current.right.tier = gctTrackingRef.current.right.finalGctMs < 100 ? 'elite' : gctTrackingRef.current.right.finalGctMs <= 125 ? 'standard' : 'braking';
                          } else {
                            gctTrackingRef.current.right.x = box.left + rToe.x * box.width;
                            gctTrackingRef.current.right.y = box.top + rToe.y * box.height;
                          }
                        }
                        footVelocityRef.current.prevRVy = vyR;
                      }
                    }

                    if (lToe) footVelocityRef.current.prevLY = lToe.y;
                    if (rToe) footVelocityRef.current.prevRY = rToe.y;
                    footVelocityRef.current.lastTime = nowSec;

                    // Render Floating Ground Contact Time (GCT) Stopwatch Overlay
                    if (showGctOverlay) {
                      const sides = [
                        { key: 'left', label: 'L', data: gctTrackingRef.current.left },
                        { key: 'right', label: 'R', data: gctTrackingRef.current.right }
                      ];

                      for (const s of sides) {
                        const foot = s.data;
                        const isActive = foot.inStance || (nowMs < foot.freezeUntilMs);
                        if (!isActive || !foot.x || !foot.y) continue;

                        const ms = foot.inStance 
                          ? Math.round(Math.max(10, (nowSec - foot.startSec) * 1000))
                          : foot.finalGctMs;

                        const isElite = ms < 100;
                        const isStandard = ms >= 100 && ms <= 125;
                        const tierColor = isElite ? '#00D084' : isStandard ? '#f59e0b' : '#ef4444';
                        const tierName = isElite ? 'WORLD CLASS' : isStandard ? 'COLLEGE STD' : 'BRAKE HEAVY';

                        ctx.save();
                        // 1. Ground contact shadow / ellipse ring
                        if (foot.inStance) {
                          ctx.beginPath();
                          ctx.ellipse(foot.x, foot.y, 22, 8, 0, 0, Math.PI * 2);
                          ctx.fillStyle = `rgba(${tierColor === '#00D084' ? '0, 208, 132' : tierColor === '#f59e0b' ? '245, 158, 11' : '239, 68, 68'}, 0.25)`;
                          ctx.fill();
                          ctx.strokeStyle = tierColor;
                          ctx.lineWidth = 1.5;
                          ctx.stroke();
                        }

                        // 2. Floating Stopwatch HUD Badge
                        const badgeW = 144;
                        const badgeH = 34;
                        const offsetX = s.label === 'L' ? -badgeW - 14 : 14;
                        const bx = Math.max(10, Math.min(box.left + box.width - badgeW - 10, foot.x + offsetX));
                        const by = Math.max(10, Math.min(box.top + box.height - badgeH - 10, foot.y - 28));

                        // Leader line from badge to foot
                        ctx.beginPath();
                        ctx.moveTo(s.label === 'L' ? bx + badgeW : bx, by + badgeH / 2);
                        ctx.lineTo(foot.x, foot.y);
                        ctx.strokeStyle = `rgba(${tierColor === '#00D084' ? '0, 208, 132' : tierColor === '#f59e0b' ? '245, 158, 11' : '239, 68, 68'}, 0.5)`;
                        ctx.lineWidth = 1;
                        ctx.stroke();

                        // Card background
                        ctx.fillStyle = 'rgba(10, 15, 29, 0.94)';
                        ctx.strokeStyle = tierColor;
                        ctx.lineWidth = 1.4;
                        ctx.shadowColor = tierColor;
                        ctx.shadowBlur = foot.inStance ? 8 : 4;

                        if (ctx.roundRect) {
                          ctx.beginPath();
                          ctx.roundRect(bx, by, badgeW, badgeH, 6);
                          ctx.fill();
                          ctx.stroke();
                        } else {
                          ctx.fillRect(bx, by, badgeW, badgeH);
                          ctx.strokeRect(bx, by, badgeW, badgeH);
                        }
                        ctx.shadowBlur = 0;

                        // Header: ⏱ GCT [L] • WORLD CLASS
                        ctx.font = 'bold 9px monospace';
                        ctx.fillStyle = '#94a3b8';
                        ctx.textAlign = 'left';
                        ctx.textBaseline = 'top';
                        ctx.fillText(`⏱ GCT [${s.label}] • ${tierName}`, bx + 8, by + 5);

                        // Live pulsing dot or frozen checkmark
                        if (foot.inStance) {
                          ctx.beginPath();
                          ctx.arc(bx + badgeW - 10, by + 9, 3.5, 0, Math.PI * 2);
                          ctx.fillStyle = tierColor;
                          ctx.fill();
                        } else {
                          ctx.font = 'bold 9px monospace';
                          ctx.fillStyle = tierColor;
                          ctx.textAlign = 'right';
                          ctx.fillText('✓ LOCK', bx + badgeW - 6, by + 5);
                        }

                        // Big numerical stopwatch readout: e.g. 88 ms
                        ctx.font = '900 15px monospace';
                        ctx.fillStyle = tierColor;
                        ctx.textAlign = 'left';
                        ctx.textBaseline = 'bottom';
                        ctx.fillText(`${ms} ms`, bx + 8, by + badgeH - 4);

                        // Mini target bar in lower right
                        const barW = 46;
                        const barH = 4;
                        const barX = bx + badgeW - barW - 8;
                        const barY = by + badgeH - 9;
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
                        ctx.fillRect(barX, barY, barW, barH);

                        const fillRatio = Math.min(1.0, ms / 150);
                        ctx.fillStyle = tierColor;
                        ctx.fillRect(barX, barY, barW * fillRatio, barH);

                        ctx.restore();
                      }
                    }

                    // Real-Time Bilateral Stride Asymmetry & Balance HUD Meter
                    if (showAsymmetryOverlay) {
                      const leftGct = gctTrackingRef.current.left.finalGctMs || (gctTrackingRef.current.left.inStance ? Math.round(Math.max(10, (nowSec - gctTrackingRef.current.left.startSec) * 1000)) : 0);
                      const rightGct = gctTrackingRef.current.right.finalGctMs || (gctTrackingRef.current.right.inStance ? Math.round(Math.max(10, (nowSec - gctTrackingRef.current.right.startSec) * 1000)) : 0);

                      if (leftGct > 0 && rightGct > 0) {
                        const maxGct = Math.max(leftGct, rightGct);
                        const asymPct = maxGct > 0 ? ((Math.abs(leftGct - rightGct) / maxGct) * 100) : 0;
                        const isBalanced = asymPct <= 5.0;
                        const isModerate = asymPct > 5.0 && asymPct <= 10.0;
                        const tierColor = isBalanced ? '#00D084' : isModerate ? '#f59e0b' : '#ef4444';
                        const biasSide = Math.abs(leftGct - rightGct) <= 2 ? 'EVEN' : (leftGct > rightGct ? 'L-BRAKE' : 'R-BRAKE');
                        const biasLabel = isBalanced ? 'SYMMETRIC' : biasSide;

                        ctx.save();
                        const meterW = 216;
                        const meterH = 48;
                        const mx = Math.max(12, Math.min(box.left + (box.width - meterW) / 2, canvas.width - meterW - 12));
                        let my = box.top - meterH - 12;
                        if (my < 14) {
                          my = Math.min(canvas.height - meterH - 14, box.top + box.height + 14);
                        }

                        // Background card
                        ctx.fillStyle = 'rgba(10, 15, 29, 0.94)';
                        ctx.strokeStyle = tierColor;
                        ctx.lineWidth = 1.4;
                        ctx.shadowColor = tierColor;
                        ctx.shadowBlur = 6;
                        if (ctx.roundRect) {
                          ctx.beginPath();
                          ctx.roundRect(mx, my, meterW, meterH, 7);
                          ctx.fill();
                          ctx.stroke();
                        } else {
                          ctx.fillRect(mx, my, meterW, meterH);
                          ctx.strokeRect(mx, my, meterW, meterH);
                        }
                        ctx.shadowBlur = 0;

                        // Header: ⚖ BILATERAL BALANCE • 3.2% (SYMMETRIC)
                        ctx.font = 'bold 9px monospace';
                        ctx.fillStyle = '#94a3b8';
                        ctx.textAlign = 'left';
                        ctx.textBaseline = 'top';
                        ctx.fillText('⚖ BILATERAL BALANCE', mx + 8, my + 6);

                        ctx.fillStyle = tierColor;
                        ctx.textAlign = 'right';
                        ctx.fillText(`${asymPct.toFixed(1)}% (${biasLabel})`, mx + meterW - 8, my + 6);

                        // Horizontal Balance Bar
                        const barTrackX = mx + 48;
                        const barTrackW = meterW - 96;
                        const barTrackY = my + 24;
                        const barTrackH = 4;

                        // Left foot readout (Sky blue)
                        ctx.font = '900 11px monospace';
                        ctx.fillStyle = '#38bdf8';
                        ctx.textAlign = 'left';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(`L:${leftGct}`, mx + 8, barTrackY + 2);

                        // Right foot readout (Emerald green)
                        ctx.fillStyle = '#34d399';
                        ctx.textAlign = 'right';
                        ctx.fillText(`R:${rightGct}`, mx + meterW - 8, barTrackY + 2);

                        // Track rail
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
                        ctx.fillRect(barTrackX, barTrackY, barTrackW, barTrackH);

                        // Center deadzone marker (0% asymmetry line)
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
                        ctx.fillRect(barTrackX + barTrackW / 2 - 0.75, barTrackY - 2, 1.5, barTrackH + 4);

                        // Moving balance indicator dot
                        const rawDiff = rightGct - leftGct;
                        const normalizedDiff = Math.max(-1, Math.min(1, rawDiff / 30));
                        const dotX = barTrackX + (barTrackW / 2) + (normalizedDiff * (barTrackW / 2 - 4));

                        ctx.beginPath();
                        ctx.arc(dotX, barTrackY + barTrackH / 2, 4.5, 0, Math.PI * 2);
                        ctx.fillStyle = tierColor;
                        ctx.shadowColor = tierColor;
                        ctx.shadowBlur = 6;
                        ctx.fill();
                        ctx.shadowBlur = 0;
                        ctx.strokeStyle = '#ffffff';
                        ctx.lineWidth = 1;
                        ctx.stroke();

                        // Bottom labels
                        ctx.font = 'bold 8px monospace';
                        ctx.fillStyle = '#64748b';
                        ctx.textAlign = 'left';
                        ctx.textBaseline = 'bottom';
                        ctx.fillText('◀ L', barTrackX, my + meterH - 3);

                        ctx.textAlign = 'center';
                        ctx.fillStyle = isBalanced ? '#00D084' : '#64748b';
                        ctx.fillText('CENTER', barTrackX + barTrackW / 2, my + meterH - 3);

                        ctx.textAlign = 'right';
                        ctx.fillStyle = '#64748b';
                        ctx.fillText('R ▶', barTrackX + barTrackW, my + meterH - 3);

                        ctx.restore();
                      }
                    }

                    // Animate active ground impact ripples
                    if (showFootRipples) {
                      impactRipplesRef.current = impactRipplesRef.current.filter(r => (nowMs - r.startTime) < r.duration);

                      if (impactRipplesRef.current.length > 0) {
                        ctx.save();
                        impactRipplesRef.current.forEach(r => {
                          const elapsed = nowMs - r.startTime;
                          const progress = elapsed / r.duration; // 0 to 1
                          const easeProgress = 1 - Math.pow(1 - progress, 2.5);
                          const alpha = (1 - progress);
                          const primaryColor = r.color || '#00D084';
                          const sideTag = r.side || 'L';

                          // 1. Perspective track floor contact ellipse shockwave
                          const ellipseW = 12 + easeProgress * 58;
                          const ellipseH = ellipseW * 0.38; // 2.5D perspective tilt on track surface
                          ctx.beginPath();
                          ctx.ellipse(r.x, r.y, ellipseW, ellipseH, 0, 0, Math.PI * 2);
                          ctx.strokeStyle = primaryColor;
                          ctx.lineWidth = 2.6 * alpha;
                          ctx.shadowColor = primaryColor;
                          ctx.shadowBlur = 10 * alpha;
                          ctx.stroke();

                          // 2. Secondary inner echo ripple
                          const innerW = 6 + easeProgress * 32;
                          const innerH = innerW * 0.38;
                          ctx.beginPath();
                          ctx.ellipse(r.x, r.y, innerW, innerH, 0, 0, Math.PI * 2);
                          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
                          ctx.lineWidth = 1.4 * alpha;
                          ctx.shadowBlur = 0;
                          ctx.stroke();

                          // 3. Ground contact flash burst
                          if (progress < 0.28) {
                            const flashAlpha = (1 - (progress / 0.28)) * 0.45;
                            ctx.beginPath();
                            ctx.ellipse(r.x, r.y, 22 * (1 - progress), 8 * (1 - progress), 0, 0, Math.PI * 2);
                            ctx.fillStyle = primaryColor;
                            ctx.globalAlpha = flashAlpha;
                            ctx.fill();
                            ctx.globalAlpha = 1.0;
                          }

                          // 4. Kinetic micro-spark particles radiating along ground surface
                          const particleCount = 6;
                          for (let p = 0; p < particleCount; p++) {
                            const pAngle = (p / particleCount) * Math.PI * 2;
                            const pDist = easeProgress * 38;
                            const px = r.x + Math.cos(pAngle) * pDist * 1.2;
                            const py = r.y + Math.sin(pAngle) * pDist * 0.4;
                            ctx.beginPath();
                            ctx.arc(px, py, Math.max(1, 2.2 * (1 - progress)), 0, Math.PI * 2);
                            ctx.fillStyle = primaryColor;
                            ctx.globalAlpha = alpha * 0.8;
                            ctx.fill();
                            ctx.globalAlpha = 1.0;
                          }

                          // 5. Floating GCT Strike indicator HUD pill
                          const floatY = r.y - 14 - (easeProgress * 22);
                          ctx.font = 'bold 9px monospace';
                          const text = `⚡ STRIKE [${sideTag}]`;
                          const tm = ctx.measureText(text);
                          const pw = tm.width + 12;
                          const ph = 17;
                          const bx = r.x - pw / 2;
                          const by = floatY - ph / 2;

                          ctx.fillStyle = `rgba(10, 15, 29, ${alpha * 0.94})`;
                          ctx.strokeStyle = primaryColor;
                          ctx.lineWidth = 1.2;
                          ctx.shadowColor = primaryColor;
                          ctx.shadowBlur = 4 * alpha;
                          if (ctx.roundRect) {
                            ctx.beginPath();
                            ctx.roundRect(bx, by, pw, ph, 4);
                            ctx.fill();
                            ctx.stroke();
                          } else {
                            ctx.fillRect(bx, by, pw, ph);
                            ctx.strokeRect(bx, by, pw, ph);
                          }
                          ctx.shadowBlur = 0;
                          ctx.fillStyle = primaryColor;
                          ctx.textAlign = 'center';
                          ctx.textBaseline = 'middle';
                          ctx.fillText(text, r.x, floatY);
                        });
                        ctx.restore();
                      }
                    }

                    // Record Kinematics Frame with Throttled Buffer Flushing
                    const roundedTime = Math.round(video.currentTime * 100) / 100;
                    const entry = {
                      time: roundedTime,
                      knee: Math.round(primaryKneeAngle || rKneeAngle || lKneeAngle),
                      hip: Math.round(primaryHipAngle || rHipAngle || lHipAngle),
                      trunk: Math.round(trunkAngle),
                      shin: Math.round(primaryShinAngle || rShinAngle || lShinAngle),
                      thighSep: Math.round(thighSepAngle),
                      elbow: Math.round(primaryElbowAngle || rElbowAngle || lElbowAngle),
                      ankle: Math.round(rAnkleAngle || lAnkleAngle),
                      lKnee: Math.round(lKneeAngle),
                      rKnee: Math.round(rKneeAngle),
                      lHip: Math.round(lHipAngle),
                      rHip: Math.round(rHipAngle),
                      lShin: Math.round(lShinAngle),
                      rShin: Math.round(rShinAngle),
                      hipX: (primaryHip?.x || 0) * vWidth,
                      hipY: (primaryHip?.y || 0) * vHeight,
                      lFootX: (lToe?.x || 0) * vWidth,
                      lFootY: (lToe?.y || 0) * vHeight,
                      rFootX: (rToe?.x || 0) * vWidth,
                      rFootY: (rToe?.y || 0) * vHeight,
                      wristX: (primaryWrist?.x || 0) * vWidth,
                      wristY: (primaryWrist?.y || 0) * vHeight,
                      shoulderX: (primaryShoulder?.x || 0) * vWidth,
                      shoulderY: (primaryShoulder?.y || 0) * vHeight
                    };

                    const existingIdx = poseBufferRef.current.findIndex(p => Math.abs(p.time - roundedTime) < 0.02);
                    if (existingIdx >= 0) {
                      poseBufferRef.current[existingIdx] = entry;
                    } else {
                      poseBufferRef.current.push(entry);
                      if (poseBufferRef.current.length > 500) {
                        poseBufferRef.current.shift();
                      }
                    }

                    // Flush buffer to React state throttled at 10Hz to prevent main-thread choking & dropped video frames
                    const nowFlush = performance.now();
                    if (nowFlush - lastPoseBufferFlushRef.current > 100 || video.paused) {
                      lastPoseBufferFlushRef.current = nowFlush;
                      setPoseGraphData([...poseBufferRef.current].sort((a, b) => a.time - b.time));
                    }
                  }
                }
              });
            } catch (err) {
              console.warn("Pose detection error:", err);
            }
          }
        }

        // Draw Manual Custom Drawn Angles
        if (drawingLines.length > 0 || currentLineRef.current) {
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          
          const allLines = [...drawingLines];
          if (currentLineRef.current) allLines.push(currentLineRef.current);
          
          allLines.forEach(l => {
             ctx.beginPath();
             ctx.moveTo(l.start.x, l.start.y);
             ctx.lineTo(l.end.x, l.end.y);
             ctx.stroke();
             
             ctx.fillStyle = '#facc15';
             ctx.beginPath();
             ctx.arc(l.start.x, l.start.y, 4, 0, Math.PI*2);
             ctx.arc(l.end.x, l.end.y, 4, 0, Math.PI*2);
             ctx.fill();
          });
        }
        
        // Draw Calibration Reference Line
        if (calibrationLine) {
           ctx.strokeStyle = '#38bdf8';
           ctx.lineWidth = 3;
           ctx.setLineDash([5, 5]);
           ctx.beginPath();
           ctx.moveTo(calibrationLine.start.x, calibrationLine.start.y);
           ctx.lineTo(calibrationLine.end.x, calibrationLine.end.y);
           ctx.stroke();
           ctx.setLineDash([]);
           
           ctx.fillStyle = '#38bdf8';
           ctx.font = 'bold 12px sans-serif';
           ctx.fillText("1.0m Reference", calibrationLine.start.x + 8, calibrationLine.start.y - 8);
        }

        // Manual Angle Readout between 2 drawn lines
        if (drawingLines.length === 2) {
           const l1 = drawingLines[0];
           const l2 = drawingLines[1];
           const a1 = Math.atan2(l1.end.y - l1.start.y, l1.end.x - l1.start.x);
           const a2 = Math.atan2(l2.end.y - l2.start.y, l2.end.x - l2.start.x);
           let deg = Math.abs((a1 - a2) * (180 / Math.PI));
           if (deg > 180) deg = 360 - deg;
           
           ctx.fillStyle = '#facc15';
           ctx.font = 'bold 18px monospace';
           ctx.fillText(`Custom Angle: ${deg.toFixed(1)}°`, 16, displayHeight - 16);
        }

        ctx.restore();
      }
      animationId = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(animationId);
  }, [poseMode, showNativeControls, drawingLines, calibrationLine, activeMetrics, minVisibility, poseSmoothing, getVideoRenderedBox, showAngleArcs, showGctOverlay, showShinVector, showDepthShading, showComTrail, showFootRipples]);

  // Biomechanical Kinetics Computations
  const strideKinetics = useMemo(() => {
    if (!poseGraphData || poseGraphData.length < 20) return null;
    const data = [...poseGraphData].sort((a, b) => a.time - b.time);
    
    const getKinetics = (footPrefix) => {
        let maxY = 0;
        let minY = 9999;
        data.forEach(d => {
            const y = d[`${footPrefix}FootY`];
            if (y > maxY) maxY = y;
            if (y < minY) minY = y;
        });
        
        const threshold = maxY - ((maxY - minY) * 0.15); 
        let contacts = [];
        let inContact = false;
        let start = 0;
        
        data.forEach(d => {
            const y = d[`${footPrefix}FootY`];
            if (y >= threshold) {
                if (!inContact) {
                    inContact = true;
                    start = d.time;
                }
            } else {
                if (inContact) {
                    inContact = false;
                    const duration = d.time - start;
                    if (duration > 0.05 && duration < 0.5) {
                        contacts.push({ start, end: d.time, duration, x: d[`${footPrefix}FootX`] });
                    }
                }
            }
        });
        return contacts;
    };
    
    const lC = getKinetics('l');
    const rC = getKinetics('r');
    const lContacts = lC.map(c => ({ ...c, foot: 'L' }));
    const rContacts = rC.map(c => ({ ...c, foot: 'R' }));
    let allContacts = [...lContacts, ...rContacts].sort((a,b) => a.start - b.start);
    if (allContacts.length < 2) return null;
    
    const avgGct = allContacts.reduce((sum, c) => sum + c.duration, 0) / allContacts.length;
    let flightTimes = [];
    let strideLengths = [];
    
    for(let i=1; i<allContacts.length; i++) {
       const flight = allContacts[i].start - allContacts[i-1].end;
       if (flight > 0 && flight < 0.4) flightTimes.push(flight);
       const dist = Math.abs(allContacts[i].x - allContacts[i-1].x);
       if (dist > 10) strideLengths.push(dist);
    }
    
    const avgFlight = flightTimes.length > 0 ? flightTimes.reduce((a,b)=>a+b,0)/flightTimes.length : 0;
    
    let pxToMeters = 0.002;
    if (calibrationLine && videoPlaybackRef.current && overlayCanvasRef.current) {
       const box = getVideoRenderedBox(videoPlaybackRef.current, overlayCanvasRef.current);
       const scale = box.vWidth / (box.width || 1);
       const dx = (calibrationLine.end.x - calibrationLine.start.x) * scale;
       const dy = (calibrationLine.end.y - calibrationLine.start.y) * scale;
       const lenPx = Math.sqrt(dx * dx + dy * dy);
       if (lenPx > 0) pxToMeters = 1 / lenPx;
    } else if (data.length > 0) {
       const ankleYs = data.map(d => Math.max(d.lFootY || 0, d.rFootY || 0)).filter(y => y > 0);
       const shoulderYs = data.map(d => d.shoulderY).filter(y => y > 0);
       if (ankleYs.length > 0 && shoulderYs.length > 0) {
         const avgAnkle = ankleYs.reduce((a, b) => a + b, 0) / ankleYs.length;
         const avgShoulder = shoulderYs.reduce((a, b) => a + b, 0) / shoulderYs.length;
         const bodyHeightPx = Math.abs(avgAnkle - avgShoulder) * 1.18;
         if (bodyHeightPx > 50) {
           pxToMeters = 1.75 / bodyHeightPx;
         }
       }
    }
    
    const avgStrideLength = strideLengths.length > 0 ? (strideLengths.reduce((a,b)=>a+b,0)/strideLengths.length) * pxToMeters : 0;
    const validTrunks = data.filter(d => d.trunk && d.trunk > 0).map(d => d.trunk);
    const avgTrunk = validTrunks.length > 0 ? (validTrunks.reduce((a,b)=>a+b,0) / validTrunks.length) : 0;

    const validShins = data.filter(d => d.shin && d.shin !== 0).map(d => d.shin);
    const avgShin = validShins.length > 0 ? (validShins.reduce((a,b)=>a+b,0) / validShins.length) : 0;

    let cadenceHz = 0;
    let cadenceSpm = 0;
    if (allContacts.length >= 2) {
      const totalTimeSpan = allContacts[allContacts.length - 1].start - allContacts[0].start;
      if (totalTimeSpan > 0.3) {
        cadenceHz = (allContacts.length - 1) / totalTimeSpan;
        cadenceSpm = cadenceHz * 60;
      }
    }

    const hipYs = data.filter(d => d.hipY).map(d => d.hipY);
    let comDisplacementPx = 0;
    if (hipYs.length > 0) {
      comDisplacementPx = Math.max(...hipYs) - Math.min(...hipYs);
    }
    const comDisplacementCm = (comDisplacementPx * pxToMeters * 100);

    // Bilateral Footstrike GCT Metrics
    const leftGcts = lContacts.map(c => c.duration);
    const rightGcts = rContacts.map(c => c.duration);
    const leftAvgGct = leftGcts.length > 0 ? (leftGcts.reduce((a, b) => a + b, 0) / leftGcts.length) : avgGct;
    const rightAvgGct = rightGcts.length > 0 ? (rightGcts.reduce((a, b) => a + b, 0) / rightGcts.length) : avgGct;
    const maxFootGct = Math.max(leftAvgGct, rightAvgGct);
    const gctAsymmetryPct = maxFootGct > 0 ? Math.round((Math.abs(leftAvgGct - rightAvgGct) / maxFootGct) * 100) : 0;

    // Step-by-Step Kinematic Sequence Breakdown (First 10 steps)
    const stepBreakdown = [];
    for (let i = 0; i < allContacts.length; i++) {
      const c = allContacts[i];
      const nextC = allContacts[i + 1];
      const flight = nextC ? Math.max(0, nextC.start - c.end) : avgFlight;
      const stepDist = (i > 0) ? Math.abs(c.x - allContacts[i - 1].x) * pxToMeters : (avgStrideLength || 1.6);
      const stepCadence = (c.duration + flight) > 0 ? Math.round(60 / (c.duration + flight)) : cadenceSpm;
      
      stepBreakdown.push({
        stepNum: i + 1,
        foot: c.foot,
        startSec: c.start.toFixed(2),
        gctSec: c.duration.toFixed(3),
        flightSec: flight.toFixed(3),
        stepDistM: Math.min(2.8, Math.max(0.6, stepDist)).toFixed(2),
        cadenceSpm: Math.min(320, Math.max(160, stepCadence)),
        dutyFactorPct: Math.round((c.duration / (c.duration + flight || 0.01)) * 100)
      });
    }
    
    return {
      gct: avgGct.toFixed(2),
      leftGct: leftAvgGct.toFixed(3),
      rightGct: rightAvgGct.toFixed(3),
      gctAsymmetryPct,
      flight: avgFlight.toFixed(2),
      strideLength: avgStrideLength.toFixed(2),
      count: allContacts.length,
      avgTrunkLean: avgTrunk.toFixed(1),
      avgShinAngle: avgShin.toFixed(1),
      cadenceHz: cadenceHz.toFixed(1),
      cadenceSpm: Math.round(cadenceSpm),
      comDisplacementCm: comDisplacementCm > 0 ? comDisplacementCm.toFixed(1) : (avgFlight * 18).toFixed(1),
      stepBreakdown: stepBreakdown.slice(0, 10),
      allContacts
    };
  }, [poseGraphData, calibrationLine, getVideoRenderedBox]);

  // Automated AI Biomechanical Coaching & Flaw Detection Analysis
  const aiBioCoachAnalysis = useMemo(() => {
    if (!poseGraphData || poseGraphData.length < 15) return null;
    return analyzeFullSprintBiomechanics(poseGraphData, strideKinetics);
  }, [poseGraphData, strideKinetics]);

  // Real-time active flaw at current video playback position (for on-video HUD banner)
  const activeRealtimeFlaw = useMemo(() => {
    if (!showBioCoach || !showBioCoachHUD || !aiBioCoachAnalysis?.allFlaws?.length) return null;
    return aiBioCoachAnalysis.allFlaws.find(f => Math.abs(playbackTime - f.time) < 0.22);
  }, [showBioCoach, showBioCoachHUD, aiBioCoachAnalysis, playbackTime]);

  // Synchronized Kinematic Sparkline Timeline Path Generator
  const sparklinePaths = useMemo(() => {
    if (!poseGraphData || poseGraphData.length < 2 || !videoDuration) return null;
    const sorted = [...poseGraphData].sort((a, b) => a.time - b.time);
    const dur = Math.max(0.1, videoDuration);

    const makePath = (key) => {
      let d = '';
      for (let i = 0; i < sorted.length; i++) {
        const pt = sorted[i];
        const val = pt[key];
        if (val === undefined || val === null || isNaN(val)) continue;
        const x = Math.min(1000, Math.max(0, (pt.time / dur) * 1000));
        const clampedVal = Math.min(180, Math.max(0, val));
        const y = 32 - (clampedVal / 180) * 28;
        if (!d) d = `M ${x.toFixed(1)} ${y.toFixed(1)}`;
        else d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
      }
      return d;
    };

    return {
      knee: makePath('knee'),
      shin: makePath('shin'),
      trunk: makePath('trunk'),
      hip: makePath('hip')
    };
  }, [poseGraphData, videoDuration]);

  // Instantaneous angle readings locked to current video playhead
  const currentKinematicsAtPlayhead = useMemo(() => {
    if (!poseGraphData || poseGraphData.length === 0) return null;
    let closest = poseGraphData[0];
    let minDiff = Math.abs(closest.time - playbackTime);
    for (let i = 1; i < poseGraphData.length; i++) {
      const diff = Math.abs(poseGraphData[i].time - playbackTime);
      if (diff < minDiff) {
        minDiff = diff;
        closest = poseGraphData[i];
      }
    }
    return minDiff < 0.35 ? closest : null;
  }, [poseGraphData, playbackTime]);

  const jumpAnalysis = useMemo(() => {
    // CRITICAL: Only calculate vertical jump metrics if the active assessment is vertical jump!
    if (analysisActivity !== 'jump') return null;
    if (!poseGraphData || poseGraphData.length < 20) return null;
    const data = [...poseGraphData].sort((a, b) => a.time - b.time);

    let lMaxY = 0, lMinY = 9999, rMaxY = 0, rMinY = 9999;
    data.forEach(d => {
        if (d.lFootY > lMaxY) lMaxY = d.lFootY;
        if (d.lFootY < lMinY) lMinY = d.lFootY;
        if (d.rFootY > rMaxY) rMaxY = d.rFootY;
        if (d.rFootY < rMinY) rMinY = d.rFootY;
    });
    
    const lThreshold = lMaxY - ((lMaxY - lMinY) * 0.15); 
    const rThreshold = rMaxY - ((rMaxY - rMinY) * 0.15); 
    
    let maxHangTime = 0;
    let currentHangStart = 0;
    let isHanging = false;
    
    data.forEach(d => {
        const lOffGround = d.lFootY < lThreshold;
        const rOffGround = d.rFootY < rThreshold;
        
        if (lOffGround && rOffGround) {
            if (!isHanging) {
                isHanging = true;
                currentHangStart = d.time;
            }
        } else {
            if (isHanging) {
                isHanging = false;
                const duration = d.time - currentHangStart;
                if (duration > maxHangTime) maxHangTime = duration;
            }
        }
    });

    if (maxHangTime < 0.2) return null;
    const heightM = 1.22625 * (maxHangTime * maxHangTime);
    const heightCm = heightM * 100;
    const heightIn = heightCm * 0.393701;

    return {
      hangTime: maxHangTime.toFixed(3),
      heightCm: heightCm.toFixed(1),
      heightIn: heightIn.toFixed(1)
    };
  }, [poseGraphData, analysisActivity]);

  const longJumpAnalysis = useMemo(() => {
    // CRITICAL: Only calculate long/broad jump metrics if active assessment is long jump!
    if (analysisActivity !== 'long_jump') return null;
    if (!poseGraphData || poseGraphData.length < 20) return null;
    const data = [...poseGraphData].sort((a, b) => a.time - b.time);

    let lMaxY = 0, lMinY = 9999, rMaxY = 0, rMinY = 9999;
    data.forEach(d => {
        if (d.lFootY > lMaxY) lMaxY = d.lFootY;
        if (d.lFootY < lMinY) lMinY = d.lFootY;
        if (d.rFootY > rMaxY) rMaxY = d.rFootY;
        if (d.rFootY < rMinY) rMinY = d.rFootY;
    });
    const lThreshold = lMaxY - ((lMaxY - lMinY) * 0.15); 
    const rThreshold = rMaxY - ((rMaxY - rMinY) * 0.15); 
    
    let maxHangTime = 0;
    let currentHangStart = 0;
    let isHanging = false;
    let takeOffKneeAngle = 0;
    let takeOffHipAngle = 0;

    data.forEach(d => {
        const lOffGround = d.lFootY < lThreshold;
        const rOffGround = d.rFootY < rThreshold;
        
        if (lOffGround && rOffGround) {
            if (!isHanging) {
                isHanging = true;
                currentHangStart = d.time;
                takeOffKneeAngle = d.knee;
                takeOffHipAngle = d.hip;
            }
        } else {
            if (isHanging) {
                isHanging = false;
                const duration = d.time - currentHangStart;
                if (duration > maxHangTime) maxHangTime = duration;
            }
        }
    });

    if (maxHangTime < 0.2) return null; 
    const estimatedDistanceM = 7 * maxHangTime;

    return {
      flightTime: maxHangTime.toFixed(3),
      estimatedDistance: estimatedDistanceM.toFixed(2),
      takeOffKnee: takeOffKneeAngle,
      takeOffHip: takeOffHipAngle
    };
  }, [poseGraphData, analysisActivity]);

  const throwAnalysis = useMemo(() => {
    if (analysisActivity !== 'throw') return null;
    if (!poseGraphData || poseGraphData.length < 20) return null;
    const data = [...poseGraphData].sort((a, b) => a.time - b.time);

    let maxExtension = 0;
    let maxFlexion = 360;
    let releaseAngle = 0;

    data.forEach(d => {
        if (d.elbow > maxExtension) {
            maxExtension = d.elbow;
            const dx = d.wristX - d.shoulderX;
            const dy = d.wristY - d.shoulderY;
            const angle = Math.atan2(-dy, dx) * (180 / Math.PI);
            releaseAngle = angle;
        }
        if (d.elbow < maxFlexion && d.elbow > 10) { 
            maxFlexion = d.elbow;
        }
    });

    return {
      maxElbowExtension: maxExtension.toFixed(1),
      maxElbowFlexion: maxFlexion.toFixed(1),
      releaseAngle: releaseAngle.toFixed(1)
    };
  }, [poseGraphData, analysisActivity]);

  // Sync Video Biometrics to Firestore Athlete Record
  const syncAnalysisToFirestore = async () => {
    if (poseGraphData.length === 0) {
      alert("No pose data available to sync.");
      return;
    }

    let targetFirebaseId = null;
    if (selectedSyncSession === "latest") {
      if (results.length === 0) {
        alert("No recent live results to sync to. Please select a historical session.");
        return;
      }
      targetFirebaseId = results[0].firebaseId;
      if (!targetFirebaseId) {
        alert("Latest live result is not synced to Firebase yet.");
        return;
      }
    } else {
      targetFirebaseId = selectedSyncSession;
    }

    try {
      const docRef = doc(db, "sprint_evaluations", targetFirebaseId);
      
      let maxKnee = 0, maxHip = 0, maxElbow = 0, maxAnkle = 0;
      poseGraphData.forEach(d => {
         if (d.knee && d.knee > maxKnee) maxKnee = d.knee;
         if (d.hip && d.hip > maxHip) maxHip = d.hip;
         if (d.elbow && d.elbow > maxElbow) maxElbow = d.elbow;
         if (d.ankle && d.ankle > maxAnkle) maxAnkle = d.ankle;
      });

      const payload = {
         poseGraphData,
         analysisActivity,
         maxKnee,
         maxHip,
         maxElbow,
         maxAnkle,
         strideLength: strideKinetics ? strideKinetics.strideLength : null,
         groundContactTime: strideKinetics ? strideKinetics.gct : null,
         flightTime: strideKinetics ? strideKinetics.flight : null,
         avgTrunkLean: strideKinetics ? strideKinetics.avgTrunkLean : null,
         avgShinAngle: strideKinetics ? strideKinetics.avgShinAngle : null,
         cadenceSpm: strideKinetics ? strideKinetics.cadenceSpm : null,
         jumpHangTime: (analysisActivity === 'jump' && jumpAnalysis) ? jumpAnalysis.hangTime : null,
         jumpHeightCm: (analysisActivity === 'jump' && jumpAnalysis) ? jumpAnalysis.heightCm : null,
         longJumpDistance: (analysisActivity === 'long_jump' && longJumpAnalysis) ? longJumpAnalysis.estimatedDistance : null,
         longJumpTakeoffKnee: (analysisActivity === 'long_jump' && longJumpAnalysis) ? longJumpAnalysis.takeOffKnee : null,
         throwMaxExtension: (analysisActivity === 'throw' && throwAnalysis) ? throwAnalysis.maxElbowExtension : null,
         throwReleaseAngle: (analysisActivity === 'throw' && throwAnalysis) ? throwAnalysis.releaseAngle : null
      };

      await updateDoc(docRef, payload);
      alert("Biomechanical analysis successfully synced to athlete's session!");
    } catch(err) {
      console.error("Firestore sync error:", err);
      alert("Failed to sync analysis to athlete.");
    }
  };

  // Export CSV of Pose & Kinematics Data
  const exportPoseCSV = () => {
    if (poseGraphData.length === 0) {
      alert("No pose tracking data recorded yet. Please play or scrub the video with AI Pose Tracking ON.");
      return;
    }
    const headers = ["Time(s)", "Knee(deg)", "Hip(deg)", "Trunk(deg)", "Shin(deg)", "ThighSep(deg)", "Elbow(deg)", "Ankle(deg)"];
    const rows = poseGraphData.map(d => [
      d.time.toFixed(3),
      d.knee || "",
      d.hip || "",
      d.trunk || "",
      d.shin || "",
      d.thighSep || "",
      d.elbow || "",
      d.ankle || ""
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `VelocityLab_Kinematics_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export PDF Report with Biomechanical Graphs & Snapshot
  const exportAnalysisPDF = async () => {
    if (!videoURL) {
      alert("Please upload or record a video first to generate an AI Biomechanical Analysis report.");
      return;
    }
    setIsExporting(true);
    
    try {
      const doc = new jsPDF();
      let lastResult = {
        name: broadcastAthlete.name,
        time: "--",
        distance: "--",
        velocity: "--",
        reactionTime: "--"
      };
      if (selectedSyncSession && selectedSyncSession !== "none" && selectedSyncSession !== "latest") {
         const found = history.find(h => (h.firebaseId || h.id) === selectedSyncSession);
         if (found) lastResult = { ...lastResult, ...found };
      } else if (selectedSyncSession === "latest" && results.length > 0) {
         lastResult = results[0];
      }
      
      // Official Velocity Lab Brand Header Logo
      addVelocityLabLogoToPdf(doc, { x: 14, y: 12, width: 48, isDark: false });
      
      doc.setFontSize(15);
      doc.setTextColor(40, 40, 40);
      let reportTitle = "AI Sprint Biomechanics Report";
      if (analysisActivity === 'sprint_start') reportTitle = "AI Sprint Start & Acceleration Drive Report";
      if (analysisActivity === 'sprint_maxv') reportTitle = "AI Max Velocity Sprint Mechanics Report";
      if (analysisActivity === 'jump') reportTitle = "AI Vertical Jump Biomechanics Report";
      if (analysisActivity === 'long_jump') reportTitle = "AI Broad Jump Biomechanics Report";
      if (analysisActivity === 'agility') reportTitle = "AI Agility Biomechanics Report";
      doc.text(reportTitle, 14, 32);
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text(`Athlete: ${lastResult.name}`, 14, 45);
      doc.text(`Assessment Type: ${ACTIVITY_CONFIGS[analysisActivity]?.label || 'Sprint Biomechanics'}`, 14, 52);
      doc.text(`Distance: ${lastResult.distance && lastResult.distance !== '--' ? `${lastResult.distance}m` : (analysisActivity === 'sprint_start' ? '0-15m (Drive Phase)' : '--')}`, 14, 59);
      doc.text(`Time: ${lastResult.time && lastResult.time !== '--' ? `${lastResult.time}s` : '-- (High-Speed Video Analysis)'}`, 14, 66);
      doc.text(`Drive/Top Velocity: ${lastResult.velocity && lastResult.velocity !== '--' ? `${parseFloat(lastResult.velocity).toFixed(2)} m/s` : '--'}`, 14, 73);
      
      doc.setFont("helvetica", "bold");
      doc.text("AI Coach's Analysis:", 14, 88);
      
      let aiNotes = "Solid baseline established. Focus on explosive knee drive and posture stability through the finish.";
      if (analysisActivity === 'sprint_start') {
        aiNotes = "Focus on low forward projection angle out of the blocks (30°-42° torso lean). Attack the track back with a positive shin angle behind center of mass to maximize horizontal ground propulsion.";
      } else if (analysisActivity === 'sprint_maxv') {
        aiNotes = "Focus on tall upright posture (80°-88°), high frontside knee recovery (>85°), and rapid elastic ground contact under center of mass to minimize braking.";
      } else if (analysisActivity === 'jump') {
        aiNotes = "Focus on rapid eccentric countermovement, triple extension at takeoff (ankle, knee, hip), and vertical impulse projection.";
      } else {
        const athleteRuns = syncMode === 'roster'
          ? history.filter(h => h.name === lastResult.name).sort((a,b) => (a.serverTime?.seconds || 0) - (b.serverTime?.seconds || 0))
          : [];
        if (athleteRuns.length >= 2) {
          const last = parseFloat(athleteRuns[athleteRuns.length - 1].time);
          const prev = parseFloat(athleteRuns[athleteRuns.length - 2].time);
          if (last < prev) {
            aiNotes = `Great progression! Your last run was ${(prev - last).toFixed(2)}s faster than the previous. `;
          }
        }
      }
      
      doc.setFontSize(11);
      doc.setFont("helvetica", "italic");
      const splitNotes = doc.splitTextToSize(`"${aiNotes}"`, 180);
      doc.text(splitNotes, 14, 96);
      
      let maxKnee = 0, maxHip = 0, maxElbow = 0, maxAnkle = 0;
      poseGraphData.forEach(d => {
         if (d.knee && d.knee > maxKnee) maxKnee = d.knee;
         if (d.hip && d.hip > maxHip) maxHip = d.hip;
         if (d.elbow && d.elbow > maxElbow) maxElbow = d.elbow;
         if (d.ankle && d.ankle > maxAnkle) maxAnkle = d.ankle;
      });

      // Joint Angles Kinematics Table
      const kinematicsBody = analysisActivity === 'sprint_start' ? [
        ['Drive Phase Trunk Lean', `${strideKinetics?.avgTrunkLean ? `${strideKinetics.avgTrunkLean}°` : '--'}`, 'Target: 30° - 42° (Low Drive Vector)'],
        ['Initial Shin Attack Angle', `${strideKinetics?.avgShinAngle ? `${strideKinetics.avgShinAngle}°` : '--'}`, 'Target: Positive Forward Footstrike (> 1°)'],
        ['Drive Ground Contact Time', `${strideKinetics?.gct ? `${strideKinetics.gct}s` : '--'}`, 'Target: Short Powerful Impulse (<0.14s)'],
        ['Max Knee Extension at Toe-Off', `${maxKnee > 0 ? `${maxKnee}°` : '--'}`, maxKnee > 150 ? 'Optimal Extension' : maxKnee > 0 ? 'Reduced Extension' : 'Not Detected'],
        ['Max Hip Extension Drive', `${maxHip > 0 ? `${maxHip}°` : '--'}`, maxHip > 160 ? 'Optimal Triple Extension' : maxHip > 0 ? 'Sub-maximal' : 'Not Detected']
      ] : analysisActivity === 'sprint_maxv' ? [
        ['Max Velocity Upright Posture', `${strideKinetics?.avgTrunkLean ? `${strideKinetics.avgTrunkLean}°` : '--'}`, 'Target: 80° - 88° (Tall Pelvis & Torso)'],
        ['Frontside Knee Recovery', `${maxKnee > 0 ? `${maxKnee}°` : '--'}`, maxKnee > 140 ? 'High Frontside Knee Punch' : maxKnee > 0 ? 'Low Knee Recovery' : 'Not Detected'],
        ['Elastic Ground Contact Time', `${strideKinetics?.gct ? `${strideKinetics.gct}s` : '--'}`, 'Target: Minimal Braking (<0.10s)'],
        ['Turnover Cadence', `${strideKinetics?.cadenceSpm ? `${strideKinetics.cadenceSpm} SPM` : '--'}`, 'Target: 260 - 300 SPM'],
        ['Stride Length Model', `${strideKinetics?.strideLength ? `${strideKinetics.strideLength}m` : '--'}`, 'Optimal Horizontal Clearance']
      ] : analysisActivity === 'jump' ? [
        ['Jump Hang Time', `${jumpAnalysis?.hangTime ? `${jumpAnalysis.hangTime}s` : '--'}`, 'Ballistic Flight Phase'],
        ['Jump Height (Inches)', `${jumpAnalysis?.heightIn ? `${jumpAnalysis.heightIn} in` : '--'}`, 'Vertical Elevation Target > 28 in'],
        ['Jump Height (Centimeters)', `${jumpAnalysis?.heightCm ? `${jumpAnalysis.heightCm} cm` : '--'}`, 'Metric Elevation'],
        ['Takeoff Knee Extension', `${maxKnee > 0 ? `${maxKnee}°` : '--'}`, 'Triple Extension Impulsive Thrust'],
        ['Takeoff Hip Extension', `${maxHip > 0 ? `${maxHip}°` : '--'}`, 'Vertical Propulsion Alignment']
      ] : [
        ['Max Knee Angle', `${maxKnee > 0 ? `${maxKnee}°` : '--'}`, maxKnee > 150 ? 'Optimal Extension' : maxKnee > 0 ? 'Reduced Extension' : 'Not Detected'],
        ['Max Hip Extension', `${maxHip > 0 ? `${maxHip}°` : '--'}`, maxHip > 160 ? 'Optimal Drive' : maxHip > 0 ? 'Sub-maximal' : 'Not Detected'],
        ['Max Trunk Lean', `${strideKinetics?.avgTrunkLean ? `${strideKinetics.avgTrunkLean}°` : '--'}`, 'Track Forward Momentum'],
        ['Avg Ground Contact Time', `${strideKinetics?.gct ? `${strideKinetics.gct}s` : '--'}`, 'Target < 0.12s Elite'],
        ['Estimated Stride Length', `${strideKinetics?.strideLength ? `${strideKinetics.strideLength}m` : '--'}`, 'Stride Distance Model']
      ];

      autoTable(doc, {
        startY: 110,
        head: [['Metric / Kinematic Parameter', 'Observed Value', 'Biomechanical Assessment / Benchmark']],
        body: kinematicsBody,
        theme: 'striped',
        headStyles: { fillColor: [0, 208, 132], textColor: [0,0,0] }
      });
      
      let finalY = doc.lastAutoTable.finalY + 15;
      
      // Video Snapshot with Overlay
      if (videoPlaybackRef.current && overlayCanvasRef.current) {
          const snapCanvas = document.createElement("canvas");
          const vw = videoPlaybackRef.current.videoWidth || 1280;
          const vh = videoPlaybackRef.current.videoHeight || 720;
          snapCanvas.width = vw;
          snapCanvas.height = vh;
          const sCtx = snapCanvas.getContext("2d");
          
          try {
             sCtx.drawImage(videoPlaybackRef.current, 0, 0, vw, vh);
             sCtx.drawImage(overlayCanvasRef.current, 0, 0, vw, vh);
             const snapshotDataUrl = snapCanvas.toDataURL("image/jpeg", 0.7);
             
             let yOffset = finalY;
             const imgHeight = (180 * vh) / vw;
             
             if (yOffset + imgHeight > 280) {
                doc.addPage();
                yOffset = 20;
             }
             
             doc.setFont("helvetica", "bold");
             doc.text("Video Snapshot (with AI Biomechanical Overlay):", 14, yOffset);
             doc.addImage(snapshotDataUrl, "JPEG", 14, yOffset + 5, 180, imgHeight);
          } catch(e) {
             console.error("Failed to add image to PDF", e);
          }
      }
      
      savePdfFile(doc, `VelocityLab_${((lastResult && lastResult.name) || 'Athlete').replace(/\s+/g, '_')}_Analysis.pdf`);
    } catch (e) {
      console.error("PDF Export failed", e);
      alert(`Failed to generate PDF: ${e.message || 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Generate Pro Athlete Multi-Page PDF Bio-Report
  const handleGenerateAthleteBioReport = async () => {
    setIsGeneratingBioReport(true);
    setBioReportStatus('Synthesizing Bio-Report Engine...');
    try {
      const isUnsynced = syncMode === 'unsynced';
      
      let currentSyncRun = null;
      if (selectedSyncSession && selectedSyncSession !== "none" && selectedSyncSession !== "latest") {
        const found = history.find(h => (h.firebaseId || h.id) === selectedSyncSession);
        if (found) currentSyncRun = found;
      } else if (selectedSyncSession === "latest" && results.length > 0) {
        currentSyncRun = results[0];
      }

      // Check if real kinematics was actually detected
      const rawGct = parseFloat(strideKinetics?.gct);
      const hasRealGct = !isNaN(rawGct) && rawGct > 0;
      const rawFlight = parseFloat(strideKinetics?.flight);
      const hasRealFlight = !isNaN(rawFlight) && rawFlight > 0;
      const avgTrunk = parseFloat(strideKinetics?.avgTrunkLean);
      const hasRealTrunk = !isNaN(avgTrunk) && avgTrunk > 0;
      const avgShin = parseFloat(strideKinetics?.avgShinAngle);
      const strideFreq = parseFloat(strideKinetics?.cadenceHz);

      let maxKneeVal = 0;
      if (Array.isArray(poseGraphData) && poseGraphData.length > 0) {
        poseGraphData.forEach(d => {
          if (d.knee && d.knee > maxKneeVal) maxKneeVal = d.knee;
        });
      }

      const kinematicsData = (hasRealGct || hasRealTrunk || maxKneeVal > 0) ? {
        groundContactTime: hasRealGct ? (rawGct < 1 ? Math.round(rawGct * 1000) : Math.round(rawGct)) : null,
        flightTime: hasRealFlight ? (rawFlight < 1 ? Math.round(rawFlight * 1000) : Math.round(rawFlight)) : null,
        trunkLean: hasRealTrunk ? avgTrunk : null,
        shinAngle: !isNaN(avgShin) ? avgShin : null,
        strideFrequency: (!isNaN(strideFreq) && strideFreq > 0) ? strideFreq : null,
        kneeFlexion: maxKneeVal > 0 ? maxKneeVal : null
      } : null;

      await generateAthleteBioReport({
        analysisActivity: (analysisActivity === 'sprint' ? 'sprint_start' : analysisActivity),
        athlete: {
          isUnsynced,
          name: isUnsynced ? broadcastAthlete.name : (currentSyncRun?.name || broadcastAthlete.name),
          bib: isUnsynced ? broadcastAthlete.bib : (currentSyncRun?.bib || broadcastAthlete.bib),
          country: isUnsynced ? 'INT' : (currentSyncRun?.country || broadcastAthlete.country),
          age: broadcastAthlete.age || null,
          gender: broadcastAthlete.gender || null,
          weight: broadcastAthlete.weight || null,
          height: broadcastAthlete.height || null,
          sport: broadcastAthlete.sport || (analysisActivity === 'sprint_start' ? 'Track & Field / Sprint Start' : 'Track & Field / Sprint'),
          team: broadcastAthlete.team || (isUnsynced ? 'Independent / Guest' : 'Velocity Lab Squad'),
          prs: currentSyncRun ? {
            ...(currentSyncRun.split10 ? { '10m': `${currentSyncRun.split10}s` } : {}),
            ...(currentSyncRun.split20 ? { '20m': `${currentSyncRun.split20}s` } : {}),
            ...(currentSyncRun.time ? { '40m / Sprint': `${currentSyncRun.time}s` } : {}),
            ...(currentSyncRun.velocity ? { 'Top Speed': `${currentSyncRun.velocity} m/s` } : {}),
            ...(analysisActivity === 'jump' && jumpAnalysis?.heightIn ? { 'Vertical Jump': `${jumpAnalysis.heightIn}"` } : {})
          } : {
            ...(analysisActivity === 'sprint_start' ? {
              'Sprint Start & Drive': 'Completed (Video Pose Analysis)',
              ...(strideKinetics?.avgTrunkLean ? { 'Drive Torso Lean': `${strideKinetics.avgTrunkLean}°` } : {}),
              ...(strideKinetics?.avgShinAngle ? { 'Shin Attack Angle': `${strideKinetics.avgShinAngle}°` } : {}),
              ...(strideKinetics?.gct ? { 'Drive Ground Contact': `${strideKinetics.gct}s` } : {})
            } : (analysisActivity === 'sprint_maxv' || analysisActivity === 'sprint') ? {
              'Max Velocity Sprint': 'Completed (Video Pose Analysis)',
              ...(strideKinetics?.avgTrunkLean ? { 'Upright Torso Lean': `${strideKinetics.avgTrunkLean}°` } : {}),
              ...(strideKinetics?.cadenceSpm ? { 'Stride Cadence': `${strideKinetics.cadenceSpm} SPM` } : {}),
              ...(strideKinetics?.gct ? { 'Ground Contact Time': `${strideKinetics.gct}s` } : {})
            } : {}),
            ...(analysisActivity === 'jump' && jumpAnalysis?.heightIn ? { 'Vertical Jump': `${jumpAnalysis.heightIn}"` } : {})
          }
        },
        roster: isUnsynced ? [] : roster,
        history: isUnsynced ? [] : history,
        results: isUnsynced ? (currentSyncRun ? [currentSyncRun] : []) : results,
        kinematicsData,
        onProgress: (pct, msg) => setBioReportStatus(`${msg} (${pct}%)`)
      });
    } catch (err) {
      console.error("Failed to generate Athlete Bio-Report from Workspace:", err);
      alert("Failed to generate Athlete Bio-Report: " + (err.message || err));
    } finally {
      setIsGeneratingBioReport(false);
      setBioReportStatus('');
    }
  };

  // Video Export with Zero-Error Burned-In Skeleton & Angles
  const exportVideoWithOverlay = async (exportFormat = 'landscape', autoCrop = false) => {
    if (!videoURL) {
      alert("Please upload or record a video first.");
      return;
    }
    setIsExporting(true);
    setExportProgress(0);

    const lastResult = results.length > 0 ? results[0] : { name: "Sprint Run", time: "0.00" }; 
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    
    // Create hidden video element and mount to DOM offscreen so browser decodes frames without throttling
    const hiddenVideo = document.createElement("video");
    hiddenVideo.src = videoURL;
    hiddenVideo.muted = true;
    hiddenVideo.playsInline = true;
    hiddenVideo.setAttribute("muted", "");
    hiddenVideo.setAttribute("playsinline", "");
    hiddenVideo.preload = "auto";
    hiddenVideo.style.position = "fixed";
    hiddenVideo.style.top = "-9999px";
    hiddenVideo.style.left = "-9999px";
    hiddenVideo.style.width = "1px";
    hiddenVideo.style.height = "1px";
    hiddenVideo.style.opacity = "0";
    hiddenVideo.style.pointerEvents = "none";
    document.body.appendChild(hiddenVideo);

    let sourceVideo = hiddenVideo;

    const cleanup = () => {
      try {
        hiddenVideo.pause();
        if (hiddenVideo.parentNode) {
          hiddenVideo.parentNode.removeChild(hiddenVideo);
        }
      } catch (e) {}
    };

    // Ensure metadata is loaded with 4s safeguard
    await new Promise((resolve) => {
      let resolved = false;
      const done = () => {
        if (resolved) return;
        resolved = true;
        if (exportFormat === 'vertical') {
          canvas.width = 1080;
          canvas.height = 1920;
        } else {
          canvas.width = hiddenVideo.videoWidth || (videoPlaybackRef.current?.videoWidth) || 1280;
          canvas.height = hiddenVideo.videoHeight || (videoPlaybackRef.current?.videoHeight) || 720;
        }
        resolve();
      };
      
      if (hiddenVideo.readyState >= 1) {
        done();
      } else {
        hiddenVideo.onloadedmetadata = done;
        hiddenVideo.oncanplay = done;
        hiddenVideo.onerror = done;
        setTimeout(done, 3000);
      }
    });

    if (typeof MediaRecorder === 'undefined') {
      cleanup();
      setIsExporting(false);
      alert("Video export is not supported in this browser (MediaRecorder API unavailable).");
      return;
    }

    const stream = canvas.captureStream(30); 
    let mimeType = 'video/webm';
    let fileExt = 'webm';
    if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')) {
      mimeType = 'video/mp4;codecs=avc1';
      fileExt = 'mp4';
    } else if (MediaRecorder.isTypeSupported('video/mp4')) {
      mimeType = 'video/mp4';
      fileExt = 'mp4';
    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
      mimeType = 'video/webm;codecs=vp9';
      fileExt = 'webm';
    } else if (MediaRecorder.isTypeSupported('video/webm')) {
      mimeType = 'video/webm';
      fileExt = 'webm';
    }

    let recorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5000000 });
    } catch(e) {
      try {
        recorder = new MediaRecorder(stream, { mimeType });
      } catch (e2) {
        recorder = new MediaRecorder(stream);
      }
    }
    
    const chunks = [];
    recorder.ondataavailable = e => { if (e.data && e.data.size > 0) chunks.push(e.data); };
    
    recorder.onstop = () => {
      cleanup();
      if (chunks.length === 0) {
        setIsExporting(false);
        setExportProgress(0);
        alert("Export ended with no video frames recorded. Please try again.");
        return;
      }
      const blob = new Blob(chunks, { type: recorder.mimeType || mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const athleteName = (lastResult.name || 'Athlete').replace(/\s+/g, '_');
      const timeStr = lastResult.time || '0.00';
      a.download = `Sprint_Result_${athleteName}_${timeStr}s_${exportFormat === 'vertical' ? 'Reels' : '16x9'}.${fileExt}`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (a.parentNode) document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setIsExporting(false);
        setExportProgress(0);
      }, 1500);
    };

    let hasStartedRecording = !autoCrop;
    let initialHipX = null;
    let animId = null;
    let finished = false;

    // Biomechanical Kinematic state across frames for video export
    const exportComTrail = [];
    let exportImpactRipples = [];
    const exportFootVel = { prevLY: null, prevRY: null, prevLVy: 0, prevRVy: 0, lastTime: 0 };
    const exportGct = {
      left: { inStance: false, startSec: 0, ms: 0, freezeUntilSec: 0, x: 0, y: 0, tier: 'elite' },
      right: { inStance: false, startSec: 0, ms: 0, freezeUntilSec: 0, x: 0, y: 0, tier: 'elite' }
    };

    // Frame-Synchronized Kinematics Rendering for Video Export
    const drawExportKinematics = (lm, mapX, mapY, scale, currentTimeSec, vWidth, vHeight, isVertical = false) => {
      const SKELETON_CONNECTIONS = [
        [11, 12], [11, 23], [12, 24], [23, 24],
        [11, 13], [13, 15],
        [12, 14], [14, 16],
        [23, 25], [25, 27], [27, 29], [27, 31], [29, 31],
        [24, 26], [26, 28], [28, 30], [28, 32], [30, 32],
        [0, 11], [0, 12]
      ];
      const visThresh = 0.4;
      const themeAccent = getThemeAccent();

      // 1. Dual-Stroke Neon Bone Vectors
      for (const [i1, i2] of SKELETON_CONNECTIONS) {
        const p1 = lm[i1];
        const p2 = lm[i2];
        if (!p1 || !p2) continue;
        if ((p1.visibility ?? 1) < visThresh || (p2.visibility ?? 1) < visThresh) continue;
        const x1 = mapX(p1.x);
        const y1 = mapY(p1.y);
        const x2 = mapX(p2.x);
        const y2 = mapY(p2.y);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = `rgba(${themeAccent.rgb}, 0.35)`;
        ctx.lineWidth = Math.max(5, 10 * scale);
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = themeAccent.color;
        ctx.lineWidth = Math.max(2.5, 4.5 * scale);
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      // 2. High-Luminescence Joint Nodes
      const JOINT_NODES = [
        { idx: 11, color: '#38bdf8' }, { idx: 12, color: '#38bdf8' },
        { idx: 13, color: '#ec4899' }, { idx: 14, color: '#ec4899' },
        { idx: 15, color: '#ec4899' }, { idx: 16, color: '#ec4899' },
        { idx: 23, color: '#818cf8' }, { idx: 24, color: '#818cf8' },
        { idx: 25, color: themeAccent.color }, { idx: 26, color: themeAccent.color },
        { idx: 27, color: '#f59e0b' }, { idx: 28, color: '#f59e0b' },
        { idx: 31, color: '#f59e0b' }, { idx: 32, color: '#f59e0b' },
        { idx: 0,  color: '#ef4444' }
      ];
      for (const j of JOINT_NODES) {
        const p = lm[j.idx];
        if (!p || (p.visibility ?? 1) < visThresh) continue;
        const jx = mapX(p.x);
        const jy = mapY(p.y);
        ctx.beginPath();
        ctx.arc(jx, jy, Math.max(4, 7.5 * scale), 0, Math.PI * 2);
        ctx.fillStyle = j.color;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(jx, jy, Math.max(2, 3.2 * scale), 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }

      // 3. Landmarks and Aspect-Corrected Calculations
      const lHip = lm[23];
      const hip = lm[24];
      const lKnee = lm[25];
      const knee = lm[26];
      const lAnk = lm[27];
      const ankle = lm[28];
      const lToe = lm[31] || lAnk;
      const rToe = lm[32] || ankle;
      const lShoulder = lm[11];
      const shoulder = lm[12];
      const lElbow = lm[13];
      const elbow = lm[14];
      const lWrist = lm[15];
      const wrist = lm[16];

      const toSquarePt = (pt) => ({ x: pt.x * vWidth, y: pt.y * vHeight });
      const isLeftNear = ((lHip?.z ?? 0) < (hip?.z ?? 0));

      const lKneeAngle = (lHip && lKnee && lAnk) ? calculateAngle(toSquarePt(lHip), toSquarePt(lKnee), toSquarePt(lAnk)) : 0;
      const rKneeAngle = (hip && knee && ankle) ? calculateAngle(toSquarePt(hip), toSquarePt(knee), toSquarePt(ankle)) : 0;
      const lHipAngle = (lShoulder && lHip && lKnee) ? calculateAngle(toSquarePt(lShoulder), toSquarePt(lHip), toSquarePt(lKnee)) : 0;
      const rHipAngle = (shoulder && hip && knee) ? calculateAngle(toSquarePt(shoulder), toSquarePt(hip), toSquarePt(knee)) : 0;
      const lElbowAngle = (lShoulder && lElbow && lWrist) ? calculateAngle(toSquarePt(lShoulder), toSquarePt(lElbow), toSquarePt(lWrist)) : 0;
      const rElbowAngle = (shoulder && elbow && wrist) ? calculateAngle(toSquarePt(shoulder), toSquarePt(elbow), toSquarePt(wrist)) : 0;

      let trunkAngle = 0;
      const topShoulder = (lShoulder && shoulder)
        ? { x: ((lShoulder.x + shoulder.x) / 2) * vWidth, y: ((lShoulder.y + shoulder.y) / 2) * vHeight }
        : lShoulder ? toSquarePt(lShoulder) : shoulder ? toSquarePt(shoulder) : null;
      const baseHip = (lHip && hip)
        ? { x: ((lHip.x + hip.x) / 2) * vWidth, y: ((lHip.y + hip.y) / 2) * vHeight }
        : lHip ? toSquarePt(lHip) : hip ? toSquarePt(hip) : null;

      if (topShoulder && baseHip) {
        trunkAngle = Math.abs(Math.atan2(topShoulder.x - baseHip.x, topShoulder.y - baseHip.y) * (180 / Math.PI));
      }

      let lShinAngle = 0, rShinAngle = 0;
      if (lKnee && lAnk) lShinAngle = Math.atan2((lKnee.x - lAnk.x) * vWidth, (lAnk.y - lKnee.y) * vHeight) * (180 / Math.PI);
      if (knee && ankle) rShinAngle = Math.atan2((knee.x - ankle.x) * vWidth, (ankle.y - knee.y) * vHeight) * (180 / Math.PI);

      let thighSepAngle = 0;
      if (lKnee && knee && baseHip) {
        thighSepAngle = calculateAngle(toSquarePt(lKnee), baseHip, toSquarePt(knee));
      }

      // 4. Dynamic Angular Arc Wedge Visualizer
      const drawExportAngleArc = (vertex, p1, p2, radius, color, labelText = null, isNear = true, isDashed = false) => {
        if (!vertex || !p1 || !p2 || !showAngleArcs) return;
        const vx = mapX(vertex.x);
        const vy = mapY(vertex.y);
        const p1x = mapX(p1.x);
        const p1y = mapY(p1.y);
        const p2x = mapX(p2.x);
        const p2y = mapY(p2.y);

        const a1 = Math.atan2(p1y - vy, p1x - vx);
        const a2 = Math.atan2(p2y - vy, p2x - vx);
        if (isNaN(a1) || isNaN(a2)) return;

        let diff = a2 - a1;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;

        const rgb = color === '#00D084' ? '0, 208, 132' : 
                    color === '#3b82f6' ? '59, 130, 246' : 
                    color === '#ec4899' ? '236, 72, 153' : 
                    color === '#a855f7' ? '168, 85, 247' : 
                    color === '#f59e0b' ? '245, 158, 11' : '0, 240, 255';

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(vx, vy);
        ctx.arc(vx, vy, radius * scale, a1, a1 + diff, diff < 0);
        ctx.closePath();
        ctx.fillStyle = isNear ? `rgba(${rgb}, 0.28)` : `rgba(71, 85, 105, 0.20)`;
        ctx.fill();

        ctx.beginPath();
        if (isDashed) ctx.setLineDash([4 * scale, 3 * scale]);
        ctx.arc(vx, vy, radius * scale, a1, a1 + diff, diff < 0);
        ctx.strokeStyle = isNear ? color : 'rgba(148, 163, 184, 0.65)';
        ctx.lineWidth = Math.max(1.5, (isNear ? 2.5 : 1.4) * scale);
        if (isNear) {
          ctx.shadowColor = color;
          ctx.shadowBlur = 6 * scale;
        }
        ctx.stroke();
        if (isDashed) ctx.setLineDash([]);
        ctx.shadowBlur = 0;

        if (labelText) {
          const bisectorAngle = a1 + (diff / 2);
          const lblDist = (radius + 22) * scale;
          const lblX = vx + Math.cos(bisectorAngle) * lblDist;
          const lblY = vy + Math.sin(bisectorAngle) * lblDist;

          const fontSize = Math.max(10, Math.round((isNear ? 12 : 10) * scale));
          ctx.font = `bold ${fontSize}px monospace`;
          const tm = ctx.measureText(labelText);
          const pw = tm.width + 12 * scale;
          const ph = (isNear ? 22 : 18) * scale;
          const bx = lblX - pw / 2;
          const by = lblY - ph / 2;

          ctx.beginPath();
          ctx.moveTo(vx + Math.cos(bisectorAngle) * (radius * scale), vy + Math.sin(bisectorAngle) * (radius * scale));
          ctx.lineTo(bx + pw / 2, by + ph / 2);
          ctx.strokeStyle = `rgba(${rgb}, ${isNear ? 0.6 : 0.35})`;
          ctx.lineWidth = Math.max(1, 1 * scale);
          ctx.stroke();

          ctx.fillStyle = 'rgba(10, 15, 29, 0.94)';
          ctx.strokeStyle = isNear ? color : 'rgba(148, 163, 184, 0.5)';
          ctx.lineWidth = Math.max(1, (isNear ? 1.4 : 1) * scale);
          if (isNear) {
            ctx.shadowColor = color;
            ctx.shadowBlur = 4 * scale;
          }
          if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(bx, by, pw, ph, 4 * scale);
            ctx.fill();
            ctx.stroke();
          } else {
            ctx.fillRect(bx, by, pw, ph);
            ctx.strokeRect(bx, by, pw, ph);
          }
          ctx.shadowBlur = 0;
          ctx.fillStyle = isNear ? color : '#cbd5e1';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(labelText, bx + pw / 2, by + ph / 2);
        }
        ctx.restore();
      };

      const drawExportAngleBadge = (text, px, py, color) => {
        ctx.save();
        const fontSize = Math.max(10, Math.round(11 * scale));
        ctx.font = `bold ${fontSize}px monospace`;
        const m = ctx.measureText(text);
        const pw = m.width + 12 * scale;
        const ph = 20 * scale;
        const bx = px + 12 * scale;
        const by = py - ph / 2;
        ctx.fillStyle = 'rgba(10, 15, 29, 0.90)';
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1, 1.2 * scale);
        if (ctx.roundRect) {
          ctx.beginPath();
          ctx.roundRect(bx, by, pw, ph, 4 * scale);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.fillRect(bx, by, pw, ph);
          ctx.strokeRect(bx, by, pw, ph);
        }
        ctx.fillStyle = color;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, bx + 6 * scale, by + ph / 2);
        ctx.restore();
      };

      // 5. Bilateral Angles Rendering
      const primaryKnee = isLeftNear ? lKnee : knee;
      const primaryHip = isLeftNear ? lHip : hip;
      const primaryAnkle = isLeftNear ? lAnk : ankle;
      const secKnee = isLeftNear ? knee : lKnee;
      const secHip = isLeftNear ? hip : lHip;
      const secAnkle = isLeftNear ? ankle : lAnk;
      const primarySide = isLeftNear ? 'L' : 'R';
      const secSide = isLeftNear ? 'R' : 'L';
      const primaryKneeAngle = isLeftNear ? lKneeAngle : rKneeAngle;
      const secKneeAngle = isLeftNear ? rKneeAngle : lKneeAngle;
      const primaryHipAngle = isLeftNear ? lHipAngle : rHipAngle;
      const secHipAngle = isLeftNear ? rHipAngle : lHipAngle;

      if (activeMetrics.knee) {
        if (primaryHip && primaryKnee && primaryAnkle && primaryKneeAngle > 0) {
          if (showAngleArcs) {
            drawExportAngleArc(primaryKnee, primaryHip, primaryAnkle, 34, '#00D084', `Knee [${primarySide}]: ${Math.round(primaryKneeAngle)}°`, true);
          } else {
            drawExportAngleBadge(`Knee [${primarySide}]: ${Math.round(primaryKneeAngle)}°`, mapX(primaryKnee.x), mapY(primaryKnee.y), '#00D084');
          }
        }
        if (secHip && secKnee && secAnkle && secKneeAngle > 0) {
          if (showAngleArcs) {
            drawExportAngleArc(secKnee, secHip, secAnkle, 24, '#00D084', `Knee [${secSide}]: ${Math.round(secKneeAngle)}°`, false, true);
          }
        }
      }

      const primaryShoulder = isLeftNear ? lShoulder : shoulder;
      const secShoulder = isLeftNear ? shoulder : lShoulder;
      if (activeMetrics.hip) {
        if (primaryShoulder && primaryHip && primaryKnee && primaryHipAngle > 0) {
          if (showAngleArcs) {
            drawExportAngleArc(primaryHip, primaryShoulder, primaryKnee, 36, '#3b82f6', `Hip [${primarySide}]: ${Math.round(primaryHipAngle)}°`, true);
          } else {
            drawExportAngleBadge(`Hip [${primarySide}]: ${Math.round(primaryHipAngle)}°`, mapX(primaryHip.x), mapY(primaryHip.y), '#3b82f6');
          }
        }
        if (secShoulder && secHip && secKnee && secHipAngle > 0) {
          if (showAngleArcs) {
            drawExportAngleArc(secHip, secShoulder, secKnee, 25, '#3b82f6', `Hip [${secSide}]: ${Math.round(secHipAngle)}°`, false, true);
          }
        }
      }

      if (lKnee && knee && baseHip && thighSepAngle > 10) {
        const midHipNorm = { x: baseHip.x / vWidth, y: baseHip.y / vHeight };
        if (showAngleArcs) {
          drawExportAngleArc(midHipNorm, lKnee, knee, 36, '#ec4899', `Scissor: ${Math.round(thighSepAngle)}°`, true);
        }
      }

      if (activeMetrics.trunk && topShoulder && baseHip && trunkAngle > 0) {
        const midHipNorm = { x: baseHip.x / vWidth, y: baseHip.y / vHeight };
        const fakeVertHip = { x: midHipNorm.x, y: midHipNorm.y - 0.25 };
        const topShoulderNorm = { x: topShoulder.x / vWidth, y: topShoulder.y / vHeight };
        if (showAngleArcs) {
          drawExportAngleArc(midHipNorm, fakeVertHip, topShoulderNorm, 34, '#a855f7', `Trunk: ${Math.round(trunkAngle)}°`, true);
        } else {
          drawExportAngleBadge(`Trunk: ${Math.round(trunkAngle)}°`, mapX(topShoulderNorm.x), mapY(topShoulderNorm.y), '#a855f7');
        }
      }

      if (activeMetrics.shin && primaryAnkle && primaryKnee) {
        const shinVRef = { x: primaryAnkle.x, y: primaryAnkle.y - 0.25 };
        const primShinAngle = isLeftNear ? lShinAngle : rShinAngle;
        if (showAngleArcs) {
          drawExportAngleArc(primaryAnkle, shinVRef, primaryKnee, 28, '#f59e0b', `Shin [${primarySide}]: ${Math.round(primShinAngle)}°`, true);
        }
      }

      // 6. Shin Angle Attack Trajectory Vectors
      if (showShinVector && primaryKnee && primaryAnkle) {
        const primShinAngle = isLeftNear ? lShinAngle : rShinAngle;
        if (Math.abs(primShinAngle) > 0.5) {
          const kx = mapX(primaryKnee.x);
          const ky = mapY(primaryKnee.y);
          const ax = mapX(primaryAnkle.x);
          const ay = mapY(primaryAnkle.y);
          const dx = ax - kx;
          const dy = ay - ky;
          const len = Math.hypot(dx, dy) || 1;
          const ext = len * 0.45;
          const ex = ax + (dx / len) * ext;
          const ey = ay + (dy / len) * ext;

          const shinColor = primShinAngle > 0 ? '#00D084' : '#f59e0b';
          ctx.save();
          ctx.setLineDash([4 * scale, 3 * scale]);
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(ex, ey);
          ctx.strokeStyle = shinColor;
          ctx.lineWidth = Math.max(1.5, 2.4 * scale);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.arc(ex, ey, Math.max(2.5, 4 * scale), 0, Math.PI * 2);
          ctx.fillStyle = shinColor;
          ctx.fill();
          ctx.restore();
        }
      }

      // 7. Pelvic Center of Mass (CoM) Trajectory Trail
      if (showComTrail && (hip || lHip)) {
        const useBoth = hip && lHip && (hip.visibility ?? 1) > visThresh && (lHip.visibility ?? 1) > visThresh;
        const hX = useBoth ? (hip.x + lHip.x) / 2 : (hip ? hip.x : lHip.x);
        const hY = useBoth ? (hip.y + lHip.y) / 2 : (hip ? hip.y : lHip.y);
        const comX = mapX(hX);
        const comY = mapY(hY);

        if (exportComTrail.length > 0) {
          const lastTime = exportComTrail[exportComTrail.length - 1].time;
          if (currentTimeSec < lastTime - 0.25 || Math.abs(currentTimeSec - lastTime) > 1.2) {
            exportComTrail.length = 0;
          }
        }
        if (exportComTrail.length === 0 || Math.abs(exportComTrail[exportComTrail.length - 1].time - currentTimeSec) > 0.015) {
          exportComTrail.push({ x: comX, y: comY, time: currentTimeSec });
          if (exportComTrail.length > 50) exportComTrail.shift();
        }

        if (exportComTrail.length > 2) {
          ctx.save();
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          for (let t = 1; t < exportComTrail.length; t++) {
            const pPrev = exportComTrail[t - 1];
            const pCurr = exportComTrail[t];
            const alpha = (t / exportComTrail.length) * 0.95;
            const isRising = pCurr.y < pPrev.y - 0.4;
            const isDipping = pCurr.y > pPrev.y + 0.4;
            const trailColor = isRising ? '0, 240, 255' : isDipping ? '245, 158, 11' : '0, 208, 132';

            ctx.beginPath();
            ctx.moveTo(pPrev.x, pPrev.y);
            ctx.lineTo(pCurr.x, pCurr.y);
            ctx.strokeStyle = `rgba(${trailColor}, ${alpha * 0.42})`;
            ctx.lineWidth = Math.max(4, 7.5 * scale);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(pPrev.x, pPrev.y);
            ctx.lineTo(pCurr.x, pCurr.y);
            ctx.strokeStyle = `rgba(${trailColor}, ${alpha * 0.95})`;
            ctx.lineWidth = Math.max(2, 3.2 * scale);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(pPrev.x, pPrev.y);
            ctx.lineTo(pCurr.x, pCurr.y);
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.85})`;
            ctx.lineWidth = Math.max(1, 1.2 * scale);
            ctx.stroke();
          }

          // Targeting Reticle & CoM Tag
          ctx.setLineDash([4 * scale, 3 * scale]);
          ctx.beginPath();
          ctx.arc(comX, comY, 11 * scale, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(0, 240, 255, 0.85)';
          ctx.lineWidth = Math.max(1, 1.4 * scale);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.beginPath();
          ctx.arc(comX, comY, 4 * scale, 0, Math.PI * 2);
          ctx.fillStyle = '#00F0FF';
          ctx.shadowColor = '#00F0FF';
          ctx.shadowBlur = 10 * scale;
          ctx.fill();
          ctx.shadowBlur = 0;

          const comTag = '⊕ CoM';
          ctx.font = `bold ${Math.max(9, Math.round(11 * scale))}px monospace`;
          const ctm = ctx.measureText(comTag);
          const cpw = ctm.width + 10 * scale;
          const cph = 18 * scale;
          const cbx = comX + 14 * scale;
          const cby = comY - 9 * scale;
          ctx.fillStyle = 'rgba(10, 15, 29, 0.92)';
          ctx.strokeStyle = 'rgba(0, 240, 255, 0.7)';
          ctx.lineWidth = Math.max(1, 1 * scale);
          if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(cbx, cby, cpw, cph, 3 * scale);
            ctx.fill();
            ctx.stroke();
          } else {
            ctx.fillRect(cbx, cby, cpw, cph);
            ctx.strokeRect(cbx, cby, cpw, cph);
          }
          ctx.fillStyle = '#00F0FF';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(comTag, cbx + 5 * scale, cby + cph / 2);
          ctx.restore();
        }
      }

      // 8. Ground Contact Strike Detection & Shockwave Ripples
      const dt = currentTimeSec - (exportFootVel.lastTime || 0);
      if (dt > 0.015 && dt < 0.25) {
        if (lToe && (lToe.visibility ?? 1) > visThresh && exportFootVel.prevLY !== null) {
          const vyL = (lToe.y - exportFootVel.prevLY) / dt;
          const isFootLowL = lToe.y > ((lKnee?.y || lHip?.y || 0.4) + 0.04);
          const isTouchdown = exportFootVel.prevLVy > 0.05 && vyL <= 0.035 && isFootLowL;

          if (isTouchdown && !exportGct.left.inStance) {
            exportGct.left.inStance = true;
            exportGct.left.startSec = currentTimeSec;
            exportGct.left.x = mapX(lToe.x);
            exportGct.left.y = mapY(lToe.y);
            if (showFootRipples) {
              exportImpactRipples.push({
                x: exportGct.left.x,
                y: exportGct.left.y,
                startTimeSec: currentTimeSec,
                durationSec: 0.45,
                side: 'L',
                color: '#00D084'
              });
            }
          } else if (exportGct.left.inStance) {
            if (vyL < -0.06 || lToe.y < exportFootVel.prevLY - 0.012) {
              exportGct.left.inStance = false;
              const dur = Math.round((currentTimeSec - exportGct.left.startSec) * 1000);
              exportGct.left.ms = Math.max(65, Math.min(260, dur));
              exportGct.left.freezeUntilSec = currentTimeSec + 0.9;
              exportGct.left.tier = exportGct.left.ms < 100 ? 'elite' : exportGct.left.ms <= 125 ? 'standard' : 'braking';
            } else {
              exportGct.left.x = mapX(lToe.x);
              exportGct.left.y = mapY(lToe.y);
            }
          }
          exportFootVel.prevLVy = vyL;
        }

        if (rToe && (rToe.visibility ?? 1) > visThresh && exportFootVel.prevRY !== null) {
          const vyR = (rToe.y - exportFootVel.prevRY) / dt;
          const isFootLowR = rToe.y > ((knee?.y || hip?.y || 0.4) + 0.04);
          const isTouchdown = exportFootVel.prevRVy > 0.05 && vyR <= 0.035 && isFootLowR;

          if (isTouchdown && !exportGct.right.inStance) {
            exportGct.right.inStance = true;
            exportGct.right.startSec = currentTimeSec;
            exportGct.right.x = mapX(rToe.x);
            exportGct.right.y = mapY(rToe.y);
            if (showFootRipples) {
              exportImpactRipples.push({
                x: exportGct.right.x,
                y: exportGct.right.y,
                startTimeSec: currentTimeSec,
                durationSec: 0.45,
                side: 'R',
                color: '#00F0FF'
              });
            }
          } else if (exportGct.right.inStance) {
            if (vyR < -0.06 || rToe.y < exportFootVel.prevRY - 0.012) {
              exportGct.right.inStance = false;
              const dur = Math.round((currentTimeSec - exportGct.right.startSec) * 1000);
              exportGct.right.ms = Math.max(65, Math.min(260, dur));
              exportGct.right.freezeUntilSec = currentTimeSec + 0.9;
              exportGct.right.tier = exportGct.right.ms < 100 ? 'elite' : exportGct.right.ms <= 125 ? 'standard' : 'braking';
            } else {
              exportGct.right.x = mapX(rToe.x);
              exportGct.right.y = mapY(rToe.y);
            }
          }
          exportFootVel.prevRVy = vyR;
        }
      }
      if (lToe) exportFootVel.prevLY = lToe.y;
      if (rToe) exportFootVel.prevRY = rToe.y;
      exportFootVel.lastTime = currentTimeSec;

      // Animate active ground ripples
      if (showFootRipples) {
        exportImpactRipples = exportImpactRipples.filter(r => (currentTimeSec - r.startTimeSec) < r.durationSec);
        if (exportImpactRipples.length > 0) {
          ctx.save();
          exportImpactRipples.forEach(r => {
            const elapsed = currentTimeSec - r.startTimeSec;
            const progress = Math.min(1.0, elapsed / r.durationSec);
            const easeProgress = 1 - Math.pow(1 - progress, 2.5);
            const alpha = 1 - progress;
            const primaryColor = r.color;

            const ellipseW = (12 + easeProgress * 58) * scale;
            const ellipseH = ellipseW * 0.38;
            ctx.beginPath();
            ctx.ellipse(r.x, r.y, ellipseW, ellipseH, 0, 0, Math.PI * 2);
            ctx.strokeStyle = primaryColor;
            ctx.lineWidth = Math.max(1.5, 2.6 * alpha * scale);
            ctx.shadowColor = primaryColor;
            ctx.shadowBlur = 10 * alpha * scale;
            ctx.stroke();

            const innerW = (6 + easeProgress * 32) * scale;
            const innerH = innerW * 0.38;
            ctx.beginPath();
            ctx.ellipse(r.x, r.y, innerW, innerH, 0, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
            ctx.lineWidth = Math.max(1, 1.4 * alpha * scale);
            ctx.shadowBlur = 0;
            ctx.stroke();

            if (progress < 0.28) {
              const flashAlpha = (1 - (progress / 0.28)) * 0.45;
              ctx.beginPath();
              ctx.ellipse(r.x, r.y, 22 * (1 - progress) * scale, 8 * (1 - progress) * scale, 0, 0, Math.PI * 2);
              ctx.fillStyle = primaryColor;
              ctx.globalAlpha = flashAlpha;
              ctx.fill();
              ctx.globalAlpha = 1.0;
            }

            const particleCount = 6;
            for (let p = 0; p < particleCount; p++) {
              const pAngle = (p / particleCount) * Math.PI * 2;
              const pDist = easeProgress * 38 * scale;
              const px = r.x + Math.cos(pAngle) * pDist * 1.2;
              const py = r.y + Math.sin(pAngle) * pDist * 0.45;
              ctx.beginPath();
              ctx.arc(px, py, Math.max(1.2, 2.2 * (1 - progress) * scale), 0, Math.PI * 2);
              ctx.fillStyle = primaryColor;
              ctx.fill();
            }

            const badgeText = `⚡ STRIKE [${r.side}]`;
            ctx.font = `bold ${Math.max(9, Math.round(10 * scale))}px monospace`;
            const stm = ctx.measureText(badgeText);
            const spw = stm.width + 10 * scale;
            const sph = 18 * scale;
            const sbx = r.x - spw / 2;
            const sby = r.y - ellipseH - sph - 4 * scale;

            ctx.fillStyle = 'rgba(10, 15, 29, 0.92)';
            ctx.strokeStyle = primaryColor;
            ctx.lineWidth = Math.max(1, 1.2 * scale);
            if (ctx.roundRect) {
              ctx.beginPath();
              ctx.roundRect(sbx, sby, spw, sph, 4 * scale);
              ctx.fill();
              ctx.stroke();
            } else {
              ctx.fillRect(sbx, sby, spw, sph);
              ctx.strokeRect(sbx, sby, spw, sph);
            }
            ctx.fillStyle = primaryColor;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(badgeText, sbx + spw / 2, sby + sph / 2);
          });
          ctx.restore();
        }
      }

      // 9. GCT Millisecond Stopwatch Overlay
      if (showGctOverlay) {
        const sides = [
          { key: 'left', label: 'L', data: exportGct.left },
          { key: 'right', label: 'R', data: exportGct.right }
        ];
        sides.forEach(s => {
          const foot = s.data;
          const isActive = foot.inStance || (currentTimeSec < foot.freezeUntilSec);
          if (!isActive || !foot.x || !foot.y) return;

          const ms = foot.inStance 
            ? Math.round((currentTimeSec - foot.startSec) * 1000) 
            : foot.ms;
          const tierColor = foot.tier === 'elite' ? '#00D084' : foot.tier === 'standard' ? '#f59e0b' : '#ef4444';
          const tierName = foot.tier === 'elite' ? 'ELITE' : foot.tier === 'standard' ? 'COLLEGE' : 'BRAKING';

          ctx.save();
          const badgeW = 110 * scale;
          const badgeH = 42 * scale;
          const bx = foot.x - badgeW / 2;
          const by = foot.y - badgeH - 14 * scale;

          ctx.fillStyle = 'rgba(10, 15, 29, 0.92)';
          ctx.strokeStyle = tierColor;
          ctx.lineWidth = Math.max(1, 1.4 * scale);
          if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(bx, by, badgeW, badgeH, 6 * scale);
            ctx.fill();
            ctx.stroke();
          } else {
            ctx.fillRect(bx, by, badgeW, badgeH);
            ctx.strokeRect(bx, by, badgeW, badgeH);
          }

          ctx.font = `bold ${Math.max(8, Math.round(9 * scale))}px monospace`;
          ctx.fillStyle = '#94a3b8';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(`⏱ GCT [${s.label}] • ${tierName}`, bx + 7 * scale, by + 5 * scale);

          ctx.font = `900 ${Math.max(12, Math.round(14 * scale))}px monospace`;
          ctx.fillStyle = tierColor;
          ctx.textBaseline = 'bottom';
          ctx.fillText(`${ms} ms`, bx + 7 * scale, by + badgeH - 4 * scale);
          ctx.restore();
        });
      }

      // 10. Bilateral Asymmetry & Balance Index Export Overlay
      if (showAsymmetryOverlay && exportGct.left.ms > 0 && exportGct.right.ms > 0) {
        const leftGct = exportGct.left.ms;
        const rightGct = exportGct.right.ms;
        const maxGct = Math.max(leftGct, rightGct);
        const asymPct = maxGct > 0 ? ((Math.abs(leftGct - rightGct) / maxGct) * 100) : 0;
        const isBalanced = asymPct <= 5.0;
        const isModerate = asymPct > 5.0 && asymPct <= 10.0;
        const tierColor = isBalanced ? '#00D084' : isModerate ? '#f59e0b' : '#ef4444';
        const biasLabel = isBalanced ? 'SYMMETRIC' : (leftGct > rightGct ? 'L-BRAKE' : 'R-BRAKE');

        ctx.save();
        const meterW = 200 * scale;
        const meterH = 46 * scale;
        const mx = (canvas.width - meterW) / 2;
        const my = Math.max(16 * scale, 24 * scale);

        ctx.fillStyle = 'rgba(10, 15, 29, 0.94)';
        ctx.strokeStyle = tierColor;
        ctx.lineWidth = Math.max(1, 1.4 * scale);
        if (ctx.roundRect) {
          ctx.beginPath();
          ctx.roundRect(mx, my, meterW, meterH, 6 * scale);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.fillRect(mx, my, meterW, meterH);
          ctx.strokeRect(mx, my, meterW, meterH);
        }

        ctx.font = `bold ${Math.max(8, Math.round(9 * scale))}px monospace`;
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('⚖ BILATERAL BALANCE', mx + 8 * scale, my + 6 * scale);

        ctx.fillStyle = tierColor;
        ctx.textAlign = 'right';
        ctx.fillText(`${asymPct.toFixed(1)}% (${biasLabel})`, mx + meterW - 8 * scale, my + 6 * scale);

        const barTrackX = mx + 46 * scale;
        const barTrackW = meterW - 92 * scale;
        const barTrackY = my + 24 * scale;
        const barTrackH = 4 * scale;

        ctx.font = `900 ${Math.max(9, Math.round(11 * scale))}px monospace`;
        ctx.fillStyle = '#38bdf8';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`L:${leftGct}`, mx + 8 * scale, barTrackY + 2 * scale);

        ctx.fillStyle = '#34d399';
        ctx.textAlign = 'right';
        ctx.fillText(`R:${rightGct}`, mx + meterW - 8 * scale, barTrackY + 2 * scale);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.fillRect(barTrackX, barTrackY, barTrackW, barTrackH);

        const rawDiff = rightGct - leftGct;
        const normalizedDiff = Math.max(-1, Math.min(1, rawDiff / 30));
        const dotX = barTrackX + (barTrackW / 2) + (normalizedDiff * (barTrackW / 2 - 4 * scale));

        ctx.beginPath();
        ctx.arc(dotX, barTrackY + barTrackH / 2, 4 * scale, 0, Math.PI * 2);
        ctx.fillStyle = tierColor;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(0.75, 1 * scale);
        ctx.stroke();

        ctx.restore();
      }
    };

    const stopExport = () => {
      if (finished) return;
      finished = true;
      if (animId) cancelAnimationFrame(animId);
      if (recorder.state === 'recording') {
        recorder.stop();
      } else {
        cleanup();
        setIsExporting(false);
        setExportProgress(0);
      }
    };

    if (!autoCrop) {
      recorder.start(250);
    }

    const totalDuration = hiddenVideo.duration || (videoPlaybackRef.current?.duration) || 5;

    // Safety timeout prevents indefinitely spinning UI if video stalls
    const safetyTimeout = setTimeout(() => {
      if (!finished) {
        console.warn("Export safety timeout reached, stopping recorder");
        stopExport();
      }
    }, Math.max(12000, totalDuration * 1500 + 4000));

    hiddenVideo.addEventListener('ended', () => {
      clearTimeout(safetyTimeout);
      stopExport();
    });

    const drawFrame = () => {
      if (finished) return;
      
      if (sourceVideo.ended || sourceVideo.currentTime >= (sourceVideo.duration - 0.05)) {
        clearTimeout(safetyTimeout);
        stopExport();
        return;
      }

      if (totalDuration > 0) {
        const pct = Math.min(99, Math.round((sourceVideo.currentTime / totalDuration) * 100));
        setExportProgress(pct);
      }

      if (exportFormat === 'vertical') {
        ctx.fillStyle = "#121316";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const vWidth = sourceVideo.videoWidth || 1080;
        const vHeight = sourceVideo.videoHeight || 1920;
        const vRatio = vWidth / vHeight;
        let renderWidth, renderHeight, xOffset, yOffset;
        if (vRatio < 1080 / 1920) {
          renderHeight = 1920;
          renderWidth = 1920 * vRatio;
          xOffset = (1080 - renderWidth) / 2;
          yOffset = 0;
        } else {
          renderWidth = 1080;
          renderHeight = 1080 / vRatio;
          xOffset = 0;
          yOffset = (1920 - renderHeight) / 2;
        }
        
        ctx.drawImage(sourceVideo, xOffset, yOffset, renderWidth, renderHeight);

        if (poseMode && poseLandmarkerRef.current) {
          const startTimeMs = performance.now();
          try {
            poseLandmarkerRef.current.detectForVideo(sourceVideo, startTimeMs, (result) => {
              if (result.landmarks && result.landmarks[0]) {
                const lm = result.landmarks[0];
                if (autoCrop && !hasStartedRecording) {
                  const hipX = lm[24].x;
                  if (initialHipX === null) initialHipX = hipX;
                  else if (Math.abs(hipX - initialHipX) > 0.015) {
                    hasStartedRecording = true;
                    recorder.start(250);
                  }
                }
                if (hasStartedRecording) {
                  const mapX = (normX) => xOffset + normX * renderWidth;
                  const mapY = (normY) => yOffset + normY * renderHeight;
                  drawExportKinematics(lm, mapX, mapY, 1.25, sourceVideo.currentTime, vWidth, vHeight, true);
                }
              }
            });
          } catch (e) {}
          if (autoCrop && !hasStartedRecording && hiddenVideo.currentTime > 2.0) {
            hasStartedRecording = true;
            recorder.start(250);
          }
        }

        const portraitAccent = getThemeAccent();
        // Official Velocity Lab Brand Logo in 9:16 Video Export
        drawVelocityLabLogoOnCanvas(ctx, { x: 540 - 180, y: 90, width: 360, isDark: true });

        ctx.fillStyle = "white";
        ctx.font = "bold 80px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`${lastResult.name || "Athlete"}`, 540, yOffset - 60);

        const runDuration = parseFloat(lastResult.time) || 0;
        const currentPlayback = hiddenVideo.currentTime;
        const displayTime = currentPlayback > runDuration ? runDuration.toFixed(2) : currentPlayback.toFixed(2);
        
        ctx.fillStyle = portraitAccent.color;
        ctx.font = "bold 160px monospace";
        ctx.textAlign = "center";
        ctx.fillText(`${displayTime}s`, 540, yOffset + renderHeight + 250);

      } else {
        // Landscape 16:9 Mode
        const vWidth = sourceVideo.videoWidth || 1280;
        const vHeight = sourceVideo.videoHeight || 720;
        ctx.drawImage(sourceVideo, 0, 0, canvas.width, canvas.height);
        
        if (poseMode && poseLandmarkerRef.current) {
          const startTimeMs = performance.now();
          try {
            poseLandmarkerRef.current.detectForVideo(sourceVideo, startTimeMs, (result) => {
              if (result.landmarks && result.landmarks[0]) {
                const lm = result.landmarks[0];
                if (autoCrop && !hasStartedRecording) {
                  const hipX = lm[24].x;
                  if (initialHipX === null) initialHipX = hipX;
                  else if (Math.abs(hipX - initialHipX) > 0.015) {
                    hasStartedRecording = true;
                    recorder.start(250);
                  }
                }
                if (hasStartedRecording) {
                  const mapX = (normX) => normX * canvas.width;
                  const mapY = (normY) => normY * canvas.height;
                  const landscapeScale = Math.max(0.75, canvas.width / 1280);
                  drawExportKinematics(lm, mapX, mapY, landscapeScale, sourceVideo.currentTime, vWidth, vHeight, false);
                }
              }
            });
          } catch (e) {}
          if (autoCrop && !hasStartedRecording && sourceVideo.currentTime > 2.0) {
            hasStartedRecording = true;
            recorder.start(250);
          }
        }

        // Landscape Watermark & Realtime Timer Card
        const runDuration = parseFloat(lastResult.time) || 0;
        const currentPlayback = sourceVideo.currentTime;
        const displayTime = currentPlayback > runDuration ? runDuration.toFixed(2) : currentPlayback.toFixed(2);
        
        const padding = Math.max(16, canvas.width * 0.02);
        const cardW = Math.max(200, canvas.width * 0.22);
        const cardH = Math.max(90, canvas.height * 0.16);
        ctx.fillStyle = "rgba(10, 15, 29, 0.85)";
        if (ctx.roundRect) {
          ctx.beginPath();
          ctx.roundRect(padding, padding, cardW, cardH, 12);
          ctx.fill();
        } else {
          ctx.fillRect(padding, padding, cardW, cardH);
        }
        
        const landscapeAccent = getThemeAccent();
        ctx.textAlign = "left";
        ctx.fillStyle = landscapeAccent.color;
        ctx.font = `bold ${Math.round(cardH * 0.48)}px monospace`;
        ctx.fillText(`${displayTime}s`, padding + 18, padding + cardH * 0.48);
        
        ctx.fillStyle = "white";
        ctx.font = `bold ${Math.round(cardH * 0.26)}px sans-serif`;
        ctx.fillText(`${lastResult.name || 'Sprint Run'}`, padding + 18, padding + cardH * 0.82);

        // Official Velocity Lab Top-Right Brand Watermark on Landscape Video Export
        const watermarkW = Math.max(160, canvas.width * 0.14);
        drawVelocityLabLogoOnCanvas(ctx, {
          x: canvas.width - watermarkW - padding,
          y: padding,
          width: watermarkW,
          isDark: true
        });
        // TV-Style Lower-Third Broadcast Banner Overlay in Video Export
        if (showBroadcastLowerThird) {
          const bannerMargin = Math.max(16, canvas.width * 0.025);
          const bannerH = Math.max(54, canvas.height * 0.095);
          const bannerW = Math.min(canvas.width - bannerMargin * 2, Math.max(480, canvas.width * 0.62));
          const bannerY = canvas.height - bannerMargin - bannerH;
          const bannerX = bannerMargin;

          ctx.save();
          // Backdrop gradient card
          ctx.fillStyle = "rgba(10, 15, 29, 0.90)";
          ctx.strokeStyle = "rgba(0, 240, 255, 0.45)";
          ctx.lineWidth = 1.5;
          if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(bannerX, bannerY, bannerW, bannerH, 10);
            ctx.fill();
            ctx.stroke();
          } else {
            ctx.fillRect(bannerX, bannerY, bannerW, bannerH);
            ctx.strokeRect(bannerX, bannerY, bannerW, bannerH);
          }

          // Athlete avatar box
          const boxSize = bannerH - 14;
          const avatarX = bannerX + 7;
          const avatarY = bannerY + 7;
          const grad = ctx.createLinearGradient(avatarX, avatarY, avatarX + boxSize, avatarY + boxSize);
          grad.addColorStop(0, '#00f0ff');
          grad.addColorStop(1, '#00d084');
          ctx.fillStyle = grad;
          if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(avatarX, avatarY, boxSize, boxSize, 8);
            ctx.fill();
          } else {
            ctx.fillRect(avatarX, avatarY, boxSize, boxSize);
          }

          // Initials in avatar
          ctx.fillStyle = '#000000';
          ctx.font = `900 ${Math.round(boxSize * 0.44)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const initials = (broadcastAthlete.name || 'VL').split(' ').map(n => n[0]).slice(0, 2).join('');
          ctx.fillText(initials, avatarX + boxSize / 2, avatarY + boxSize / 2);

          // Details text
          const textStartX = avatarX + boxSize + 12;
          ctx.textAlign = 'left';
          
          // Sub-header category
          ctx.fillStyle = '#00f0ff';
          ctx.font = `bold ${Math.round(bannerH * 0.16)}px monospace`;
          ctx.fillText(`TELEMETRY HUD • BIB #${broadcastAthlete.bib} • ${broadcastAthlete.country} ${broadcastAthlete.flag}`, textStartX, bannerY + bannerH * 0.28);

          // Athlete Name
          ctx.fillStyle = '#ffffff';
          ctx.font = `900 ${Math.round(bannerH * 0.32)}px sans-serif`;
          ctx.fillText(`${broadcastAthlete.name.toUpperCase()}`, textStartX, bannerY + bannerH * 0.62);

          // PR Stats ticker
          ctx.fillStyle = '#94a3b8';
          ctx.font = `bold ${Math.round(bannerH * 0.17)}px monospace`;
          ctx.fillText(`PR: ${broadcastAthlete.prTime}  |  TOP: ${broadcastAthlete.topSpeed}`, textStartX, bannerY + bannerH * 0.86);

          // Right-aligned Speed Ticker in banner
          const speedX = bannerX + bannerW - 14;
          ctx.textAlign = 'right';
          ctx.fillStyle = '#64748b';
          ctx.font = `bold ${Math.round(bannerH * 0.15)}px monospace`;
          ctx.fillText(liveVelocityMS === 0 ? "SET POSITION" : "LIVE SPEED", speedX, bannerY + bannerH * 0.30);

          ctx.fillStyle = '#67e8f9';
          ctx.font = `900 ${Math.round(bannerH * 0.40)}px monospace`;
          ctx.fillText(`${liveVelocityMS.toFixed(1)} m/s`, speedX, bannerY + bannerH * 0.72);

          ctx.restore();
        }
      }

      animId = requestAnimationFrame(drawFrame);
    };

    // Begin playback explicitly
    hiddenVideo.currentTime = 0;
    try {
      await hiddenVideo.play();
      animId = requestAnimationFrame(drawFrame);
    } catch (err) {
      console.warn("hiddenVideo play failed, attempting fallback to main workspace video player:", err);
      if (videoPlaybackRef.current) {
        try {
          const mainVideo = videoPlaybackRef.current;
          mainVideo.currentTime = 0;
          await mainVideo.play();
          sourceVideo = mainVideo;
          mainVideo.addEventListener('ended', () => {
            clearTimeout(safetyTimeout);
            stopExport();
          }, { once: true });
          animId = requestAnimationFrame(drawFrame);
          return;
        } catch (fallbackErr) {
          console.warn("Main video playback fallback also failed:", fallbackErr);
        }
      }
      cleanup();
      clearTimeout(safetyTimeout);
      setIsExporting(false);
      setExportProgress(0);
      alert("Browser blocked background video playback. Please click Play on the video first, then click Burn.");
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 md:p-6 flex-1 flex flex-col shadow-sm relative">
      {/* Top Header Bar */}
      <div className="flex w-full flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4 sm:gap-0">
        <div className="text-xs text-gray-500 font-bold tracking-widest uppercase flex items-center gap-2">
          <Video size={16} />
          FRAME-BY-FRAME ANALYSIS
        </div>
        {videoURL && (
          <div className="flex flex-wrap gap-3 items-center">
            <select 
              value={analysisActivity === 'sprint' ? 'sprint_start' : analysisActivity}
              onChange={(e) => handleSelectActivity(e.target.value)}
              className="bg-gray-100 dark:bg-slate-800 text-sm text-emerald-500 border border-gray-200 dark:border-slate-700 px-3 py-2 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-[#2a2d33] transition"
            >
              <option value="sprint_start">🚀 Sprint Start & Acceleration (0-15m)</option>
              <option value="sprint_maxv">⚡ Max Velocity (Top-End Speed)</option>
              <option value="jump">🦘 Vertical Jump Elevation</option>
              <option value="long_jump">🏃 Broad Jump / Long Jump</option>
              <option value="agility">🔄 Agility / COD (5-10-5)</option>
            </select>

            <select 
              value={selectedSyncSession}
              onChange={(e) => setSelectedSyncSession(e.target.value)}
              className="bg-gray-100 dark:bg-slate-800 text-sm text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-slate-700 px-3 py-2 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-[#2a2d33] transition"
            >
              <option value="none">🔓 No Gate Run (Video Analysis Only)</option>
              <option value="latest">⚡ Sync to Latest Run</option>
              {(syncMode === 'roster' && selectedRosterAthlete
                ? history.filter(h => h.name === selectedRosterAthlete)
                : history
              ).slice(0, 50).map(h => (
                <option key={h.firebaseId || h.id} value={h.firebaseId || h.id}>
                  {h.name} - {h.time}s ({h.serverTime ? new Date(h.serverTime.seconds*1000).toLocaleDateString() : 'Local'})
                </option>
              ))}
            </select>

            <a 
              href={videoURL} 
              download="sprint_raw_video.mp4"
              className="flex items-center gap-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-slate-700 px-3.5 py-2 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-[#2a2d33] transition text-sm"
            >
              <Download size={16} />
              Raw
            </a>

            <button 
              onClick={() => setShowComparisonModal(!showComparisonModal)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold transition text-sm border ${
                showComparisonModal 
                  ? 'bg-sky-500 text-white dark:text-black border-sky-400 shadow-md' 
                  : 'bg-gray-100 dark:bg-slate-800 text-sky-700 dark:text-sky-400 hover:bg-gray-200 dark:hover:bg-slate-700 border-gray-200 dark:border-sky-500/30'
              }`}
              title="Side-by-Side Comparison against PR or teammate"
            >
              <Layers size={16} />
              <span>Side-by-Side</span>
            </button>

            <button 
              onClick={() => setShowStrobeModal(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-teal-500/20 via-emerald-500/20 to-cyan-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 px-3.5 py-2 rounded-xl font-bold transition text-sm shadow-sm group"
              title="Generate Kinematic Chronophotography Strobe composite (6 to 12 stride phases) from starting block drive to full upright flight"
            >
              <Film size={16} className="text-[#00D084] group-hover:scale-110 transition-transform" />
              <span>Strobe Motion</span>
            </button>

            <button 
              onClick={() => exportVideoWithOverlay('landscape', false)} 
              disabled={isExporting}
              className="flex items-center gap-2 bg-emerald-600 text-white dark:text-black px-3.5 py-2 rounded-xl font-bold hover:bg-emerald-500 transition text-sm disabled:opacity-50 shadow-sm"
              title="Export 16:9 Video with Burned-In MediaPipe Skeleton, Joint Angles & Timer"
            >
              {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              {isExporting ? (exportProgress > 0 ? `Burn ${exportProgress}%` : 'Burning...') : 'Burn 16:9'}
            </button>

            <button 
              onClick={() => exportVideoWithOverlay('vertical', false)} 
              disabled={isExporting}
              className="flex items-center gap-2 bg-purple-600 text-white px-3.5 py-2 rounded-xl font-bold hover:bg-purple-500 transition text-sm disabled:opacity-50 shadow-sm"
              title="Export Instagram Reels / TikTok 9:16 Story Video with Burned-In Biometrics"
            >
              {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Video size={16} />}
              {isExporting ? (exportProgress > 0 ? `Reels ${exportProgress}%` : 'Rendering...') : 'Reels 9:16'}
            </button>

            <button 
              onClick={exportAnalysisPDF} 
              disabled={isExporting}
              className="flex items-center gap-2 bg-blue-500 text-white px-3.5 py-2 rounded-xl font-bold hover:bg-blue-600 transition text-sm disabled:opacity-50"
            >
              {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              PDF Report
            </button>

            <button 
              onClick={handleGenerateAthleteBioReport} 
              disabled={isExporting || isGeneratingBioReport}
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white px-3.5 py-2 rounded-xl font-bold transition text-sm disabled:opacity-50 shadow-md shadow-emerald-500/20"
              title="Generate Pro 3-Page PDF Bio-Report with Bio, Anthropometry, PRs, FVP Curve, and Kinematics Radar"
            >
              {isGeneratingBioReport ? <Loader2 size={16} className="animate-spin" /> : <Trophy size={16} className="text-amber-300" />}
              <span>{isGeneratingBioReport ? (bioReportStatus || 'Generating...') : 'Generate Athlete Bio-Report'}</span>
            </button>

            <button 
              onClick={exportPoseCSV}
              className="flex items-center gap-2 bg-gray-100 dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 border border-gray-200 dark:border-emerald-500/30 hover:bg-gray-200 dark:hover:bg-slate-700 px-3.5 py-2 rounded-xl font-bold transition text-sm"
              title="Export frame-by-frame joint angles to CSV"
            >
              <FileSpreadsheet size={16} />
              CSV
            </button>

            <button 
              onClick={() => setIsFullscreenVideo(!isFullscreenVideo)}
              className="flex items-center gap-2 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 px-3.5 py-2 rounded-xl font-bold hover:bg-gray-300 dark:hover:bg-slate-600 transition text-sm"
            >
              {isFullscreenVideo ? <Minimize size={16} /> : <Maximize size={16} />}
            </button>
          </div>
        )}
      </div>

      {/* Prominent Biomechanical Assessment Mode Selector Bar (Always Visible Before & After Video Upload) */}
      <div className="mb-5 bg-white dark:bg-gradient-to-r dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 text-slate-800 dark:text-white rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-700/80 shadow-sm dark:shadow-md transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <Activity size={15} className="text-emerald-600 dark:text-emerald-400" />
              Target Assessment Mode:
            </span>
            <span className="text-[11px] text-slate-500 dark:text-gray-400 hidden sm:inline">
              Choose assessment before or during analysis to tailor AI kinematics, detection models & bio-reports
            </span>
          </div>
          <div className="text-[11px] font-mono text-slate-500 dark:text-gray-400 flex items-center gap-1.5">
            <span>Active Pipeline:</span>
            <span className="text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2.5 py-0.5 rounded-full">
              {ACTIVITY_CONFIGS[analysisActivity]?.shortLabel || (analysisActivity === 'sprint' ? 'Sprint Start (0-15m)' : analysisActivity)}
            </span>
          </div>
        </div>

        {/* Tactile Assessment Mode Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {Object.entries(ACTIVITY_CONFIGS).map(([key, config]) => {
            const isSelected = analysisActivity === key || (analysisActivity === 'sprint' && key === 'sprint_start');
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleSelectActivity(key)}
                className={`relative flex flex-col p-3 rounded-xl border text-left transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? 'bg-gradient-to-b from-emerald-50/90 via-emerald-50/40 to-white dark:from-emerald-950/80 dark:to-slate-900 border-emerald-500 ring-2 ring-emerald-500/30 shadow-md shadow-emerald-500/10 dark:shadow-emerald-950/50 scale-[1.02]'
                    : 'bg-slate-50/80 hover:bg-slate-100/90 dark:bg-slate-800/60 dark:hover:bg-slate-800 border-slate-200 hover:border-slate-300 dark:border-slate-700/80 dark:hover:border-slate-600 opacity-90 hover:opacity-100'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xl">{config.icon}</span>
                  {isSelected ? (
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 dark:bg-emerald-400 ring-4 ring-emerald-500/20 dark:ring-emerald-400/20 animate-pulse" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />
                  )}
                </div>
                <div className={`text-xs font-bold leading-tight mb-1 ${isSelected ? 'text-emerald-800 dark:text-emerald-300' : 'text-slate-800 dark:text-gray-200'}`}>
                  {config.shortLabel}
                </div>
                <div className={`text-[10px] line-clamp-2 leading-relaxed ${isSelected ? 'text-emerald-700/80 dark:text-emerald-400/80' : 'text-slate-500 dark:text-gray-400'}`}>
                  {config.badge}
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Assessment Guidance / Focus Callout */}
        <div className="mt-3.5 pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-slate-600 dark:text-gray-300 gap-2">
          <div className="flex items-center gap-2">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold shrink-0">AI Kinematic Focus:</span>
            <span className="text-slate-600 dark:text-gray-300 text-xs">
              {ACTIVITY_CONFIGS[analysisActivity]?.description || ACTIVITY_CONFIGS.sprint_start.description}
            </span>
          </div>
          {analysisActivity === 'sprint_start' && (
            <span className="shrink-0 text-[11px] font-mono font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-2 py-0.5 rounded-md">
              ⚡ Guaranteed 0% Vertical Jump Contamination
            </span>
          )}
        </div>
      </div>

      {/* Athlete Identity & Sync Mode Configuration Banner */}
      <div className="bg-slate-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700/80 rounded-xl p-3 sm:p-4 mb-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-inner">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mr-1">
            <User size={15} className="text-emerald-500" />
            Athlete Identity:
          </span>

          {/* Mode Switcher Toggle */}
          <div className="inline-flex bg-gray-200 dark:bg-slate-900 p-0.5 rounded-lg border border-gray-300 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setSyncMode('unsynced')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition flex items-center gap-1.5 ${
                syncMode === 'unsynced'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <span>🔓 General (Guest)</span>
            </button>
            <button
              type="button"
              onClick={() => setSyncMode('roster')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition flex items-center gap-1.5 ${
                syncMode === 'roster'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <span>🔗 Sync to Roster</span>
            </button>
          </div>

          {/* Unsynced / General Subject Controls */}
          {syncMode === 'unsynced' ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={customGuestName}
                onChange={(e) => setCustomGuestName(e.target.value)}
                placeholder="Test Subject Name"
                className="bg-white dark:bg-slate-900 text-xs font-bold text-gray-800 dark:text-white border border-gray-300 dark:border-slate-700 px-3 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 w-36 sm:w-44"
              />
              <button
                type="button"
                onClick={() => {
                  const nextIdx = subjectIndex + 1;
                  setSubjectIndex(nextIdx);
                  setCustomGuestName(`Test Subject ${nextIdx}`);
                }}
                className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold px-2.5 py-1.5 rounded-lg transition"
                title="Advance to next anonymous test subject without mixing reports"
              >
                + Next Subject
              </button>
              <span className="hidden xl:inline text-[11px] text-gray-400 font-medium">
                (Bio details empty &bull; no roster mixing)
              </span>
            </div>
          ) : (
            /* Synced Roster Dropdown */
            <div className="flex items-center gap-2">
              <select
                value={selectedRosterAthlete}
                onChange={(e) => setSelectedRosterAthlete(e.target.value)}
                className="bg-white dark:bg-slate-900 text-xs font-bold text-gray-800 dark:text-white border border-emerald-500/50 px-3 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">-- Select Athlete from Roster ({roster.length}) --</option>
                {roster.map(ath => (
                  <option key={ath.id || ath.name} value={ath.name}>
                    {ath.name} (#{ath.bib || '--'}) - {ath.team || 'Roster'}
                  </option>
                ))}
              </select>
              {selectedRosterAthlete && (
                <span className="hidden sm:inline-block text-[11px] font-mono font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-md">
                  PR: {broadcastAthlete.prTime}
                </span>
              )}
            </div>
          )}

          {/* Quick Lock to Field Queue Athlete */}
          {activeRunner && activeRunner.name && activeRunner.name !== 'No runner in queue' && (
            <button
              type="button"
              onClick={() => {
                setSyncMode('roster');
                setSelectedRosterAthlete(activeRunner.name);
              }}
              className="bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-emerald-700 dark:text-emerald-300 px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs shrink-0"
              title="Lock video analysis to the active athlete in the field timing queue"
            >
              <Zap size={13} className="text-emerald-500 fill-emerald-500 animate-pulse" />
              <span>Queued: <strong>{activeRunner.name}</strong></span>
              {activeRunner.bib && <span className="font-mono text-[10px] text-slate-500 dark:text-gray-400">#{activeRunner.bib}</span>}
            </button>
          )}
        </div>

        {/* Right side active status */}
        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="font-medium">Active Dossier: <strong className="text-gray-800 dark:text-white">{broadcastAthlete.name}</strong></span>
        </div>
      </div>

      {/* Side-by-Side Comparison Modal */}
      {showComparisonModal && (
        <div className="w-full max-w-5xl mb-6">
          <SideBySideComparisonPlayer 
            videoURL={videoURL}
            compareVideoURL={compareVideoURL}
            history={history}
            results={results}
            onClose={() => setShowComparisonModal(false)}
            onExportBurnedIn={(fmt) => exportVideoWithOverlay(fmt, false)}
          />
        </div>
      )}

      {/* Biomechanical Strobe Motion Studio Modal */}
      <StrobeMotionModal
        isOpen={showStrobeModal}
        onClose={() => setShowStrobeModal(false)}
        videoURL={videoURL}
        poseLandmarker={poseLandmarkerRef.current}
        athleteInfo={{
          name: broadcastAthlete.name,
          time: (selectedSyncSession && selectedSyncSession !== "none" && selectedSyncSession !== "latest" ? history.find(h => (h.firebaseId || h.id) === selectedSyncSession)?.time : (selectedSyncSession === "latest" ? results[0]?.time : "--")) || "--",
          distance: (selectedSyncSession && selectedSyncSession !== "none" && selectedSyncSession !== "latest" ? history.find(h => (h.firebaseId || h.id) === selectedSyncSession)?.distance : (selectedSyncSession === "latest" ? results[0]?.distance : "--")) || "--",
          velocity: (selectedSyncSession && selectedSyncSession !== "none" && selectedSyncSession !== "latest" ? history.find(h => (h.firebaseId || h.id) === selectedSyncSession)?.velocity : (selectedSyncSession === "latest" ? results[0]?.velocity : "--")) || "--",
          reactionTime: (selectedSyncSession && selectedSyncSession !== "none" && selectedSyncSession !== "latest" ? history.find(h => (h.firebaseId || h.id) === selectedSyncSession)?.reactionTime : (selectedSyncSession === "latest" ? results[0]?.reactionTime : "--")) || "--"
        }}
        videoDuration={videoDuration}
        themeAccent={getThemeAccent()}
      />

      {/* Main Video & Pose Player Box */}
      <div className="w-full max-w-4xl mx-auto flex flex-col gap-4">
        <div className={`grid gap-4 ${compareVideoURL ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
          <div 
            ref={videoContainerRef}
            onClick={drawMode === 'off' && !showNativeControls && videoURL ? togglePlayback : undefined}
            className={isFullscreenVideo ? 'fixed inset-0 z-[100] bg-black p-4 md:p-8 flex flex-col justify-center items-center cursor-pointer' : `relative w-full aspect-video min-h-[340px] md:min-h-[460px] ${videoURL ? 'bg-black cursor-pointer' : 'bg-gray-50 dark:bg-slate-950'} rounded-2xl overflow-hidden border-2 border-gray-200 dark:border-slate-700/80 flex items-center justify-center shadow-sm dark:shadow-lg`}
          >
            {videoURL ? (
              <div 
                ref={videoStageRef}
                style={videoStageBox.width > 0 && !isFullscreenVideo ? { width: `${videoStageBox.width}px`, height: `${videoStageBox.height}px` } : { width: '100%', height: '100%' }}
                className={`relative flex items-center justify-center ${isFullscreenVideo ? 'max-h-full max-w-full' : ''}`}
              >
                <video 
                  key={videoURL}
                  ref={videoPlaybackRef}
                  src={videoURL} 
                  playsInline
                  webkit-playsinline="true"
                  preload="auto"
                  controls={showNativeControls}
                  muted={isMuted}
                  className={isFullscreenVideo ? 'max-h-[90vh] max-w-[90vw] object-contain' : 'w-full h-full object-contain'}
                  onTimeUpdate={() => setPlaybackTime(videoPlaybackRef.current?.currentTime || 0)}
                  onLoadedMetadata={() => {
                    if (videoPlaybackRef.current) {
                      setVideoDuration(videoPlaybackRef.current.duration || 0);
                      updateVideoBounds();
                    }
                  }}
                  onLoadedData={() => {
                    if (videoPlaybackRef.current) {
                      setVideoDuration(videoPlaybackRef.current.duration || 0);
                      updateVideoBounds();
                    }
                  }}
                  onCanPlay={() => {
                    updateVideoBounds();
                  }}
                  onPlay={() => setIsPlaying(true)}
                  onPlaying={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                  onError={(e) => {
                    console.error("Video decoding error:", e.target?.error);
                    setVideoError("Unable to decode this video file. It may use Apple HEVC/ProRes format. Toggle 'Native Player' or use standard MP4.");
                  }}
                  onClick={drawMode === 'off' && !showNativeControls ? (e) => { e.stopPropagation(); togglePlayback(); } : undefined}
                />
                <canvas
                  ref={overlayCanvasRef}
                  className={`absolute inset-0 w-full h-full ${drawMode === 'off' ? 'pointer-events-none' : 'cursor-crosshair'}`}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  onContextMenu={(e) => e.preventDefault()}
                />

                {/* Play Button Overlay */}
                {!isPlaying && drawMode === 'off' && !showNativeControls && (
                  <div 
                    onClick={(e) => { e.stopPropagation(); togglePlayback(); }}
                    className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/45 transition-colors cursor-pointer group z-10"
                    title="Click to Play"
                  >
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-emerald-500 text-black flex items-center justify-center shadow-2xl group-hover:scale-110 active:scale-95 transition-all ring-4 ring-emerald-400/40 animate-pulse">
                      <Play size={32} fill="currentColor" className="ml-1" />
                    </div>
                  </div>
                )}

                {/* Error Recovery Overlay */}
                {videoError && (
                  <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-6 text-center z-20 gap-3">
                    <AlertTriangle size={36} className="text-amber-400" />
                    <div className="text-white font-bold text-base max-w-md">{videoError}</div>
                    <div className="flex gap-3 mt-2">
                      <button 
                        onClick={() => { setVideoError(null); setShowNativeControls(true); }}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl text-xs transition"
                      >
                        Try Native Player
                      </button>
                      <label className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs cursor-pointer transition">
                        Upload Different Video
                        <input type="file" accept="video/*" className="hidden" onChange={(e) => {
                          if (e.target.files && e.target.files[0]) handleNewVideo(e.target.files[0]);
                        }} />
                      </label>
                    </div>
                  </div>
                )}

                {/* Clock Overlay */}
                {showTimerOverlay && (
                  <div className="absolute top-3 left-3 sm:top-4 sm:left-4 bg-black/60 backdrop-blur-md rounded-xl p-2.5 sm:p-3 border border-white/10 pointer-events-none z-10">
                    <div className="text-emerald-400 font-bold text-2xl sm:text-3xl tracking-tight leading-none mb-0.5">
                      {playbackTime.toFixed(2)}s
                    </div>
                    <div className="text-white font-bold text-xs sm:text-sm">
                      {results.length > 0 ? results[0].name : "Sprint Run"}
                    </div>
                  </div>
                )}

                {/* Real-Time AI Bio-Coach Flaw Alert HUD Banner */}
                {showBioCoach && showBioCoachHUD && activeRealtimeFlaw && (
                  <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                    <div className={`backdrop-blur-md border px-3.5 py-2 rounded-2xl text-xs font-mono font-bold flex items-center gap-2.5 shadow-2xl max-w-xs ${
                      activeRealtimeFlaw.severity === 'high' 
                        ? 'bg-rose-950/90 border-rose-500/60 text-rose-200' 
                        : 'bg-amber-950/90 border-amber-500/60 text-amber-200'
                    }`}>
                      <AlertTriangle size={16} className={`shrink-0 ${activeRealtimeFlaw.severity === 'high' ? 'text-rose-400 animate-pulse' : 'text-amber-400'}`} />
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="leading-tight text-[11px] font-black truncate">{activeRealtimeFlaw.title}</span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-black/40 text-amber-300 shrink-0 font-mono">
                            {activeRealtimeFlaw.timeFormatted}
                          </span>
                        </div>
                        <span className="text-[9px] text-gray-300 font-sans italic truncate mt-0.5">
                          "{activeRealtimeFlaw.cue}"
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                {isFullscreenVideo && (
                  <button onClick={() => setIsFullscreenVideo(false)} className="absolute top-4 right-4 bg-black/50 hover:bg-black text-white rounded-full p-2 z-[101] border border-white/20 transition">
                     <X size={24} />
                  </button>
                )}
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-gray-600 dark:text-gray-400 gap-4 p-4">
                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider">
                  <span>{ACTIVITY_CONFIGS[analysisActivity]?.icon || '🚀'}</span>
                  <span>Target: {ACTIVITY_CONFIGS[analysisActivity]?.label || 'Sprint Start Analysis'}</span>
                </div>
                <div className="text-base sm:text-lg text-center font-medium text-gray-800 dark:text-gray-300 max-w-lg">
                  {analysisActivity === 'sprint_start'
                    ? 'Upload or record a 0-15m sprint start (side-on view) to analyze block clearance, drive trunk lean & ground contact times.'
                    : analysisActivity === 'sprint_maxv'
                    ? 'Upload or record a top-speed sprint (side-on view) to analyze upright mechanics, frontside lift & cadence.'
                    : analysisActivity === 'jump'
                    ? 'Upload or record a vertical jump (full-body side or front view) to compute hang time and elevation.'
                    : analysisActivity === 'long_jump'
                    ? 'Upload or record a broad/long jump to analyze takeoff knee/hip angles and horizontal projection.'
                    : 'Upload or record video to begin AI biomechanical motion tracking.'}
                </div>
                <div className="flex flex-wrap justify-center gap-4">
                  <label className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-4 py-3 rounded-xl cursor-pointer hover:bg-emerald-500/20 transition font-bold text-sm flex items-center gap-2 shadow-xs">
                    <Upload size={18} />
                    Upload File
                    <input type="file" accept="video/*" className="hidden" onChange={(e) => {
                      if (e.target.files && e.target.files[0]) handleNewVideo(e.target.files[0]);
                    }} />
                  </label>
                  <label className="bg-emerald-600 hover:bg-emerald-500 text-white dark:text-black px-4 py-3 rounded-xl cursor-pointer transition font-bold text-sm flex items-center gap-2 shadow-xs">
                    <Camera size={18} />
                    Record Video
                    <input type="file" accept="video/*" capture="environment" className="hidden" onChange={(e) => {
                      if (e.target.files && e.target.files[0]) handleNewVideo(e.target.files[0]);
                    }} />
                  </label>
                  <button 
                    onClick={handleLoadSampleSprintVideo}
                    className="bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 px-4 py-3 rounded-xl hover:bg-cyan-500/20 transition font-bold text-sm flex items-center gap-2 shadow-xs cursor-pointer"
                  >
                    <Activity size={18} />
                    Load Sample Sprint (60fps)
                  </button>
                </div>
              </div>
            )}
          </div>

          {compareVideoURL && (
            <div className="relative w-full aspect-video min-h-[340px] bg-black rounded-2xl overflow-hidden border-2 border-gray-200 dark:border-slate-800 flex items-center justify-center">
              <video 
                key={compareVideoURL}
                ref={compareVideoPlaybackRef}
                src={compareVideoURL} 
                playsInline
                webkit-playsinline="true"
                preload="auto"
                muted={true}
                className="w-full h-full object-contain"
                onClick={drawMode === 'off' ? togglePlayback : undefined}
              />
              <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-md rounded-2xl p-3 border border-white/10 pointer-events-none z-10">
                <div className="text-white font-bold text-sm">Comparison</div>
              </div>
            </div>
          )}
        </div>

        {/* TV Broadcast Telemetry HUD Banner (Docked Outside Video Player) */}
        {videoURL && showBroadcastLowerThird && (
          <div className="w-full bg-slate-900/95 dark:bg-slate-950/95 text-white backdrop-blur-md border border-cyan-500/40 rounded-2xl p-3 sm:p-4 shadow-xl shadow-cyan-950/20 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-cyan-400 via-teal-400 to-emerald-400 text-black flex items-center justify-center font-black text-xs sm:text-sm shadow-md border border-cyan-300/40 shrink-0">
                {(broadcastAthlete.name || 'VL').split(' ').map(n => n[0]).slice(0, 2).join('')}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-mono font-bold tracking-widest uppercase text-cyan-400 flex items-center gap-1.5 truncate">
                  <Activity size={11} className="shrink-0" />
                  <span className="truncate">VELOCITY TELEMETRY HUD • BIB #{broadcastAthlete.bib} • {broadcastAthlete.country}</span>
                </div>
                <div className="text-sm sm:text-base font-black text-white uppercase tracking-tight truncate leading-tight mt-0.5">
                  {broadcastAthlete.name}
                </div>
                <div className="text-[10px] font-mono text-slate-300 flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1">
                  <span className="text-emerald-400 font-bold whitespace-nowrap shrink-0">PR {broadcastAthlete.prTime}</span>
                  <span className="text-slate-600 shrink-0">•</span>
                  <span className="text-amber-300 font-bold whitespace-nowrap shrink-0">TOP {broadcastAthlete.topSpeed}</span>
                  <span className="text-slate-600 shrink-0">•</span>
                  <span className="text-cyan-300 font-bold whitespace-nowrap shrink-0 font-mono">{playbackTime.toFixed(3)}s</span>
                  {sprintMotionOnset !== null && (
                    <>
                      <span className="text-slate-600 shrink-0">•</span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold shrink-0 ${
                        playbackTime < sprintMotionOnset
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : liveVelocityMS > 7.0
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}>
                        {playbackTime < sprintMotionOnset
                          ? `🟡 SET POSITION (${(sprintMotionOnset - playbackTime).toFixed(2)}s to Go)`
                          : `🚀 SPRINT ACTIVE (+${(playbackTime - sprintMotionOnset).toFixed(2)}s)`}
                      </span>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setManualStartTime(playbackTime)}
                    className="text-[9px] font-mono font-bold text-cyan-300 bg-cyan-950/60 border border-cyan-500/40 hover:bg-cyan-900/60 px-2 py-0.5 rounded-md transition ml-auto sm:ml-1 cursor-pointer"
                    title="Pinpoint current video frame as sprint departure (Start 0.00s)"
                  >
                    📍 Set Start Here
                  </button>
                  {manualStartTime !== null && (
                    <button
                      type="button"
                      onClick={() => setManualStartTime(null)}
                      className="text-[9px] font-mono text-gray-400 hover:text-white underline cursor-pointer"
                      title="Reset to AI motion onset detection"
                    >
                      Reset Auto
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right border-l border-cyan-500/30 pl-3 sm:pl-4 flex flex-col justify-center">
                <div className="text-[8px] sm:text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                  {liveVelocityMS === 0 ? 'STATUS: SET POSITION' : 'CURRENT SPEED'}
                </div>
                <div className="text-base sm:text-lg font-black font-mono text-cyan-300 tabular-nums leading-tight">
                  {liveVelocityMS.toFixed(1)} <span className="text-[10px] text-slate-400 font-bold">m/s</span>
                </div>
                <div className="text-[9px] sm:text-[10px] font-mono text-slate-400 mt-0.5">
                  {(liveVelocityMS * 3.6).toFixed(1)} km/h
                </div>
                <div className="w-16 sm:w-20 bg-slate-800/80 rounded-full h-1.5 mt-1 overflow-hidden ml-auto border border-slate-700/50">
                  <div 
                    className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-150" 
                    style={{ width: `${Math.min(100, (liveVelocityMS / 12) * 100)}%` }}
                  />
                </div>
              </div>
              <button 
                onClick={() => setShowBroadcastLowerThird(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                title="Hide HUD (can be re-enabled from Telemetry Overlays below)"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Video Controls Toolbar */}
        {videoURL && (
          <div className="flex flex-col gap-4 bg-white dark:bg-slate-800 p-4 rounded-2xl border border-gray-200 dark:border-slate-700">
            {poseRecoveryNotice && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-3 rounded-xl text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
                  <span>{poseRecoveryNotice}</span>
                </div>
                <button onClick={() => setPoseRecoveryNotice(null)} className="text-gray-400 hover:text-white"><X size={14} /></button>
              </div>
            )}
            {poseError && (
              <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 p-3 rounded-xl text-xs flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} className="shrink-0 text-amber-400" />
                  <span>{poseError}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleEmergencyResetPose}
                    className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg transition"
                  >
                    Reset AI to Safe Defaults
                  </button>
                  <button onClick={() => setPoseError(null)} className="text-gray-400 hover:text-white"><X size={14} /></button>
                </div>
              </div>
            )}

            {/* Scrubber Timeline */}
            <div className="flex items-center gap-4">
              <span className="text-xs text-gray-600 dark:text-gray-400 font-mono w-12 text-right">{playbackTime.toFixed(2)}s</span>
              <input 
                type="range" 
                min="0" 
                max={videoDuration || 1} 
                step="0.01" 
                value={playbackTime}
                onChange={handleSeek}
                className="flex-1 accent-[#00D084] cursor-pointer"
              />
              <span className="text-xs text-gray-600 dark:text-gray-400 font-mono w-12">{videoDuration.toFixed(2)}s</span>
            </div>

            {/* Synchronized Kinematic Sparkline Scrubber Mini-Timeline */}
            <div className="flex flex-col gap-1.5 -mt-1 mb-2 px-0.5">
              <div 
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  const ratio = Math.max(0, Math.min(1, clickX / rect.width));
                  const targetTime = ratio * (videoDuration || 1);
                  if (videoPlaybackRef.current) {
                    videoPlaybackRef.current.currentTime = targetTime;
                  }
                  setPlaybackTime(targetTime);
                }}
                className="relative w-full h-11 bg-slate-900/90 rounded-xl border border-slate-700/80 overflow-hidden cursor-pointer select-none group shadow-inner"
                title="Click or drag anywhere on kinematic timeline to scrub video to exact joint angle position"
              >
                {sparklinePaths ? (
                  <>
                    {/* SVG Sparkline Curves */}
                    <svg viewBox="0 0 1000 36" preserveAspectRatio="none" className="w-full h-full">
                      {/* Grid guideline at 90 deg and 120 deg */}
                      <line x1="0" y1="18" x2="1000" y2="18" stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" strokeWidth="1" />
                      
                      {/* Foot Contact Markers from stride kinetics */}
                      {strideKinetics?.allContacts?.map((c, idx) => {
                        const cx = Math.min(1000, Math.max(0, (c.start / (videoDuration || 1)) * 1000));
                        const isLeft = c.foot === 'L';
                        return (
                          <line 
                            key={idx}
                            x1={cx} 
                            y1="0" 
                            x2={cx} 
                            y2="36" 
                            stroke={isLeft ? 'rgba(56, 189, 248, 0.45)' : 'rgba(52, 211, 153, 0.45)'} 
                            strokeWidth="2" 
                          />
                        );
                      })}

                      {/* Kinematic Channel Curves */}
                      {sparklinePaths.trunk && (
                        <path d={sparklinePaths.trunk} fill="none" stroke="#a855f7" strokeWidth="1.8" opacity="0.85" />
                      )}
                      {sparklinePaths.shin && (
                        <path d={sparklinePaths.shin} fill="none" stroke="#f59e0b" strokeWidth="2" opacity="0.9" />
                      )}
                      {sparklinePaths.knee && (
                        <path d={sparklinePaths.knee} fill="none" stroke="#00D084" strokeWidth="2.2" opacity="1" />
                      )}
                    </svg>

                    {/* Synchronized Playhead Cursor Line */}
                    <div 
                      className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_#ffffff] pointer-events-none transition-none z-10"
                      style={{ 
                        left: `${Math.min(100, Math.max(0, (playbackTime / (videoDuration || 1)) * 100))}%` 
                      }}
                    >
                      <div className="w-2.5 h-2.5 -ml-1 bg-white rounded-full shadow-[0_0_6px_#00D084] -mt-0.5" />
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-between px-3 text-[10px] text-slate-500 font-mono">
                    <span className="flex items-center gap-1.5">
                      <Activity size={12} className="text-emerald-500 animate-pulse" />
                      Kinematic Sparkline Timeline • Start AI Tracking or Play Video to graph joint angle stream
                    </span>
                    <span className="text-slate-600">0.00s — {(videoDuration || 0).toFixed(2)}s</span>
                  </div>
                )}
              </div>

              {/* Real-time Angle Pill Readout directly locked to Playhead */}
              <div className="flex items-center justify-between text-[10px] font-mono font-bold px-1 text-slate-400">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <span className="w-2 h-0.5 bg-[#00D084] rounded-full inline-block"></span>
                    KNEE: {currentKinematicsAtPlayhead?.knee != null ? `${currentKinematicsAtPlayhead.knee}°` : '--'}
                  </span>
                  <span className="flex items-center gap-1 text-amber-400">
                    <span className="w-2 h-0.5 bg-[#f59e0b] rounded-full inline-block"></span>
                    SHIN: {currentKinematicsAtPlayhead?.shin != null ? `${currentKinematicsAtPlayhead.shin}°` : '--'}
                  </span>
                  <span className="flex items-center gap-1 text-purple-400">
                    <span className="w-2 h-0.5 bg-[#a855f7] rounded-full inline-block"></span>
                    TRUNK: {currentKinematicsAtPlayhead?.trunk != null ? `${currentKinematicsAtPlayhead.trunk}°` : '--'}
                  </span>
                </div>
                <div className="text-[9px] text-slate-500 hidden sm:inline">
                  {poseGraphData.length > 0 ? `${poseGraphData.length} Tracked Frames` : 'Scrub or Play to Stream'}
                </div>
              </div>
            </div>
            
            {/* Playback Action Buttons */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 md:gap-0">
              {/* Draw & Calibrate Tools */}
              <div className="flex gap-2">
                <button 
                  onClick={() => { setDrawMode(drawMode === 'off' ? 'line' : 'off'); if(isPlaying && drawMode==='off') togglePlayback(); }} 
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition ${drawMode === 'line' ? 'bg-[#facc15] text-black shadow-sm' : 'bg-gray-100 dark:bg-[#25282f] text-gray-700 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-[#2a2d33] border border-gray-200 dark:border-transparent'}`}
                >
                  {drawMode === 'line' ? 'Drawing...' : 'Draw Angle'}
                </button>
                <button 
                  onClick={() => {
                    if (drawingLines.length === 1) {
                      setCalibrationLine(drawingLines[0]);
                      setDrawingLines([]);
                    }
                  }} 
                  disabled={drawingLines.length !== 1} 
                  className="px-4 py-2 bg-gray-100 dark:bg-[#25282f] text-gray-700 dark:text-gray-400 disabled:opacity-50 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-[#2a2d33] border border-gray-200 dark:border-transparent rounded-xl text-sm font-bold transition"
                >
                  Calibrate Ref
                </button>
                <button 
                  onClick={() => { setDrawingLines([]); setCalibrationLine(null); }} 
                  className="px-4 py-2 bg-gray-100 dark:bg-[#25282f] text-gray-700 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-[#2a2d33] border border-gray-200 dark:border-transparent rounded-xl text-sm font-bold transition"
                >
                  Clear
                </button>
              </div>

              {/* Center Playback Controls */}
              <div className="flex justify-center items-center gap-2 sm:gap-3">
                {/* Slow Motion Speed Presets */}
                <div className="flex bg-gray-100 dark:bg-[#25282f] p-1 rounded-xl border border-gray-200 dark:border-gray-700 mr-1">
                  {[0.25, 0.5, 1.0].map(s => (
                    <button
                      key={s}
                      onClick={() => setSpeed(s)}
                      className={`px-2 py-1 rounded-lg text-xs font-bold transition ${playbackSpeed === s ? 'bg-emerald-600 dark:bg-emerald-500 text-white dark:text-black shadow-xs' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>

                <button 
                  onClick={() => stepFrame(false)} 
                  className="p-2.5 sm:p-3 bg-gray-100 dark:bg-[#25282f] border border-gray-200 dark:border-transparent rounded-xl hover:bg-gray-200 dark:hover:bg-[#2a2d33] transition text-gray-700 dark:text-gray-300" 
                  title="Step Back (1 Frame) - ["
                >
                  <ChevronLeft size={20} />
                </button>
                <button 
                  onClick={togglePlayback} 
                  className="p-3.5 sm:p-4 bg-emerald-600 text-white dark:text-black rounded-xl hover:bg-emerald-500 transition shadow-[0_0_15px_rgba(0,208,132,0.3)]"
                >
                  {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
                </button>
                <button 
                  onClick={() => stepFrame(true)} 
                  className="p-2.5 sm:p-3 bg-gray-100 dark:bg-[#25282f] border border-gray-200 dark:border-transparent rounded-xl hover:bg-gray-200 dark:hover:bg-[#2a2d33] transition text-gray-700 dark:text-gray-300" 
                  title="Step Forward (1 Frame) - ]"
                >
                  <ChevronRight size={20} />
                </button>
                <button 
                  onClick={() => {
                    const nextMuted = !isMuted;
                    setIsMuted(nextMuted);
                    if (videoPlaybackRef.current) {
                      videoPlaybackRef.current.muted = nextMuted;
                    }
                  }}
                  className="p-2.5 sm:p-3 bg-gray-100 dark:bg-[#25282f] border border-gray-200 dark:border-transparent rounded-xl hover:bg-gray-200 dark:hover:bg-[#2a2d33] transition text-gray-700 dark:text-gray-300"
                  title={isMuted ? "Unmute Audio" : "Mute Audio"}
                >
                  {isMuted ? <VolumeX size={20} className="text-gray-400" /> : <Volume2 size={20} className="text-emerald-500" />}
                </button>
                <button 
                  onClick={() => setShowTimerOverlay(p => !p)}
                  className={`p-2.5 sm:p-3 rounded-xl transition ${showTimerOverlay ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40' : 'bg-gray-100 dark:bg-[#25282f] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-transparent'}`}
                  title={showTimerOverlay ? "Hide Clock Overlay" : "Show Clock Overlay"}
                >
                  <Eye size={20} />
                </button>
                <button 
                  onClick={() => setShowNativeControls(!showNativeControls)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition border ${showNativeControls ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40' : 'bg-gray-100 dark:bg-[#25282f] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:text-gray-900 dark:hover:text-white'}`}
                  title="Toggle native browser controls if custom playback has issues"
                >
                  {showNativeControls ? "Native ON" : "Native"}
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 items-center flex-wrap justify-end">
                {poseMode && poseGraphData.length > 0 && (
                  <button 
                    onClick={syncAnalysisToFirestore}
                    disabled={isExporting || !selectedSyncSession}
                    className="px-3 py-2 bg-emerald-50 dark:bg-slate-800 text-emerald-700 dark:text-emerald-500 hover:bg-emerald-100 dark:hover:bg-emerald-600 hover:text-emerald-900 dark:hover:text-black rounded-xl text-sm font-bold transition flex items-center gap-1.5 border border-emerald-200 dark:border-emerald-500/30"
                  >
                    <Database size={15} /> Sync
                  </button>
                )}
                <label className="bg-gray-100 dark:bg-[#25282f] text-gray-700 dark:text-gray-300 px-3 py-2 rounded-xl cursor-pointer hover:bg-gray-200 dark:hover:bg-[#2a2d33] transition font-bold text-sm flex items-center justify-center gap-1.5 border border-gray-200 dark:border-gray-600 shadow-xs" title="Upload a different video">
                  <Upload size={16} className="text-emerald-600 dark:text-emerald-400" />
                  <span>Change</span>
                  <input type="file" accept="video/*" className="hidden" onChange={(e) => {
                    if (e.target.files && e.target.files[0]) handleNewVideo(e.target.files[0]);
                  }} />
                </label>
                <button 
                  onClick={handleLoadSampleSprintVideo}
                  className="px-3 py-2 bg-gray-100 dark:bg-[#25282f] text-cyan-600 dark:text-cyan-400 hover:text-cyan-900 dark:hover:text-cyan-200 hover:bg-gray-200 dark:hover:bg-[#2a2d33] rounded-xl font-bold text-sm transition flex items-center gap-1.5 border border-gray-200 dark:border-gray-600 shadow-xs cursor-pointer"
                  title="Load verified 60fps high-performance sprint video sample"
                >
                  <Activity size={16} className="text-cyan-500" />
                  <span>Sample</span>
                </button>
                <button 
                  onClick={() => setShowPoseSettings(true)}
                  className="px-3 py-2 bg-gray-100 dark:bg-[#25282f] text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#2a2d33] rounded-xl font-bold text-sm transition flex items-center gap-1.5 border border-gray-200 dark:border-gray-600 shadow-xs"
                  title="MediaPipe Pose Tracking Calibration & Settings"
                >
                  <Sliders size={16} className="text-emerald-600 dark:text-[#00D084]" />
                  <span>Settings</span>
                </button>
                <button 
                  onClick={!poseMode ? () => initializePoseLandmarker() : () => setPoseMode(false)} 
                  disabled={isPoseLoading} 
                  className={`flex w-full md:w-auto items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition ${poseMode ? 'bg-emerald-600 text-white dark:text-black shadow-sm' : 'bg-gray-100 dark:bg-[#25282f] text-emerald-700 dark:text-emerald-500 hover:bg-gray-200 dark:hover:bg-[#2a2d33] border border-gray-200 dark:border-transparent'}`}
                >
                  {isPoseLoading ? <Loader2 size={16} className="animate-spin"/> : <Activity size={16}/>}
                  {poseMode ? "AI Pose Tracking ON" : "Auto-Analyze AI"}
                </button>
                <label className="bg-gray-100 dark:bg-[#25282f] text-gray-700 dark:text-gray-300 px-3.5 py-2 rounded-xl cursor-pointer hover:bg-gray-200 dark:hover:bg-[#2a2d33] transition font-bold text-sm flex items-center justify-center gap-1.5 border border-gray-200 dark:border-gray-600">
                  <span>{compareVideoURL ? "Change Compare" : "Compare"}</span>
                  <input type="file" accept="video/*" className="hidden" onChange={(e) => {
                    if (e.target.files && e.target.files[0]) setCompareVideoURL(URL.createObjectURL(e.target.files[0]));
                  }} />
                </label>
              </div>
            </div>
          </div>
        )}
        
        {/* AI Biomechanical Analysis Section */}
        {videoURL && (
          <div className="flex flex-col gap-4 mt-2">
            {/* Status Banner */}
            <div className="bg-white dark:bg-slate-800 p-3.5 sm:p-4 rounded-2xl border border-gray-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className={`w-3.5 h-3.5 rounded-full shrink-0 ${poseMode ? 'bg-emerald-500 animate-pulse ring-4 ring-emerald-500/20' : 'bg-amber-400'}`} />
                <div>
                  <div className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <span>AI Biomechanical Analysis</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 uppercase tracking-wide">
                      {ACTIVITY_CONFIGS[analysisActivity]?.shortLabel || (analysisActivity === 'sprint' ? 'Sprint Start (0-15m)' : analysisActivity.replace('_', ' '))}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {poseMode 
                      ? (poseGraphData.length > 0 
                          ? `Active • ${poseGraphData.length} video frames tracked with live joint angles & kinematics` 
                          : "Active • Play or scrub the video to generate frame-by-frame biometrics")
                      : "Inactive • Auto-Analyze tracks 33 full-body joints and calculates live angles"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                {!poseMode ? (
                  <button 
                    onClick={() => initializePoseLandmarker()} 
                    disabled={isPoseLoading}
                    className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white dark:text-black font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-sm"
                  >
                    {isPoseLoading ? <Loader2 size={15} className="animate-spin" /> : <Activity size={15} />}
                    <span>Start AI Tracking</span>
                  </button>
                ) : (
                  <button 
                    onClick={() => setPoseMode(false)} 
                    className="w-full sm:w-auto px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-transparent font-bold text-xs rounded-xl transition flex items-center justify-center gap-2"
                  >
                    <Pause size={15} />
                    <span>Pause AI Tracking</span>
                  </button>
                )}
              </div>
            </div>

            {/* Visual Telemetry Controls Ribbon */}
            <div className="bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2.5 shadow-sm text-xs font-mono">
              <div className="flex items-center gap-2 text-cyan-700 dark:text-cyan-400 font-bold uppercase tracking-wider text-[11px]">
                <Sparkles size={14} />
                <span>Telemetry Visual Overlays:</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setShowAngleArcs(!showAngleArcs)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1.5 border ${
                    showAngleArcs 
                      ? 'bg-cyan-50 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-500/40 shadow-xs' 
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-500 border-gray-200 dark:border-transparent hover:text-gray-900 dark:hover:text-slate-300'
                  }`}
                  title="Toggle dynamic angular arcs on joints"
                >
                  <span>📐 Angle Arcs</span>
                  <span className="text-[9px] font-bold opacity-80">{showAngleArcs ? 'ON' : 'OFF'}</span>
                </button>

                <button
                  onClick={() => setShowGctOverlay(!showGctOverlay)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1.5 border ${
                    showGctOverlay 
                      ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40 shadow-xs' 
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-500 border-gray-200 dark:border-transparent hover:text-gray-900 dark:hover:text-slate-300'
                  }`}
                  title="Toggle Stance Phase Ground Contact Time (GCT) millisecond stopwatch overlay (<100ms elite green, 100-125ms college amber, >125ms red)"
                >
                  <Timer size={13} />
                  <span>⏱ GCT Stopwatch</span>
                  <span className="text-[9px] font-bold opacity-80">{showGctOverlay ? 'ON' : 'OFF'}</span>
                </button>

                <button
                  onClick={() => setShowAsymmetryOverlay(!showAsymmetryOverlay)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1.5 border ${
                    showAsymmetryOverlay 
                      ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40 shadow-xs' 
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-500 border-gray-200 dark:border-transparent hover:text-gray-900 dark:hover:text-slate-300'
                  }`}
                  title="Toggle Real-Time Bilateral Stride Asymmetry & Balance HUD Meter (|L - R| / max(L,R) * 100)"
                >
                  <Scale size={13} />
                  <span>⚖ Bilateral Balance</span>
                  <span className="text-[9px] font-bold opacity-80">{showAsymmetryOverlay ? 'ON' : 'OFF'}</span>
                </button>

                <button
                  onClick={() => setShowShinVector(!showShinVector)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1.5 border ${
                    showShinVector 
                      ? 'bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/40 shadow-xs' 
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-500 border-gray-200 dark:border-transparent hover:text-gray-900 dark:hover:text-slate-300'
                  }`}
                  title="Toggle Shin angle attack trajectory vectors (+ angle claw-back vs - angle overstride braking)"
                >
                  <Compass size={13} />
                  <span>🏹 Shin Vector</span>
                  <span className="text-[9px] font-bold opacity-80">{showShinVector ? 'ON' : 'OFF'}</span>
                </button>

                <button
                  onClick={() => setShowDepthShading(!showDepthShading)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1.5 border ${
                    showDepthShading 
                      ? 'bg-purple-50 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-500/40 shadow-xs' 
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-500 border-gray-200 dark:border-transparent hover:text-gray-900 dark:hover:text-slate-300'
                  }`}
                  title="Toggle MediaPipe 3D joint pose depth shading (near limb bright glow, far limb dimmed)"
                >
                  <span>🕶 3D Depth</span>
                  <span className="text-[9px] font-bold opacity-80">{showDepthShading ? 'ON' : 'OFF'}</span>
                </button>

                <button
                  onClick={() => setShowComTrail(!showComTrail)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1.5 border ${
                    showComTrail 
                      ? 'bg-teal-50 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-500/40 shadow-xs' 
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-500 border-gray-200 dark:border-transparent hover:text-gray-900 dark:hover:text-slate-300'
                  }`}
                  title="Toggle Center of Mass (CoM) trajectory trail"
                >
                  <span>✨ CoM Trail</span>
                  <span className="text-[9px] font-bold opacity-80">{showComTrail ? 'ON' : 'OFF'}</span>
                </button>

                <button
                  onClick={() => setShowFootRipples(!showFootRipples)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1.5 border ${
                    showFootRipples 
                      ? 'bg-yellow-50 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-500/40 shadow-xs' 
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-500 border-gray-200 dark:border-transparent hover:text-gray-900 dark:hover:text-slate-300'
                  }`}
                  title="Toggle foot ground contact ripple shockwaves"
                >
                  <Zap size={13} />
                  <span>⚡ Foot Impact</span>
                  <span className="text-[9px] font-bold opacity-80">{showFootRipples ? 'ON' : 'OFF'}</span>
                </button>

                <button
                  onClick={() => setShowBroadcastLowerThird(!showBroadcastLowerThird)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1.5 border ${
                    showBroadcastLowerThird 
                      ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-500/40 shadow-xs' 
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-500 border-gray-200 dark:border-transparent hover:text-gray-900 dark:hover:text-slate-300'
                  }`}
                  title="Toggle TV broadcast lower-third chyron banner"
                >
                  <span>📺 Broadcast Chyron</span>
                  <span className="text-[9px] font-bold opacity-80">{showBroadcastLowerThird ? 'ON' : 'OFF'}</span>
                </button>

                <button
                  onClick={() => {
                    const next = !showBioCoach;
                    setShowBioCoach(next);
                    localStorage.setItem('sprintgate_show_bio_coach', String(next));
                  }}
                  className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1.5 border ${
                    showBioCoach 
                      ? 'bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40 shadow-xs' 
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-500 border-gray-200 dark:border-transparent hover:text-gray-900 dark:hover:text-slate-300'
                  }`}
                  title="Toggle Automated AI Biomechanical Sprint Coach & Flaw Detection Deck"
                >
                  <Sparkles size={13} className={showBioCoach ? "text-emerald-400" : ""} />
                  <span>🤖 AI Bio-Coach</span>
                  <span className="text-[9px] font-bold opacity-80">{showBioCoach ? 'ON' : 'OFF'}</span>
                </button>

                {showBioCoach && (
                  <button
                    onClick={() => {
                      const next = !showBioCoachHUD;
                      setShowBioCoachHUD(next);
                      localStorage.setItem('sprintgate_show_bio_coach_hud', String(next));
                    }}
                    className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1.5 border ${
                      showBioCoachHUD 
                        ? 'bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/40 shadow-xs' 
                        : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-500 border-gray-200 dark:border-transparent hover:text-gray-900 dark:hover:text-slate-300'
                    }`}
                    title="Toggle real-time video HUD alert pill when a flaw frame is reached"
                  >
                    <AlertTriangle size={13} />
                    <span>⚠️ Flaw Alerts</span>
                    <span className="text-[9px] font-bold opacity-80">{showBioCoachHUD ? 'ON' : 'OFF'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Live Joint Angles (°) Graph */}
            <div className="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-2xl border border-gray-200 dark:border-slate-700 min-h-[300px] flex flex-col shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <div className="text-xs text-gray-500 font-bold tracking-widest uppercase flex items-center gap-2">
                  <span>Live Joint Angles (°)</span>
                  {poseGraphData.length > 0 && <span className="text-[10px] text-emerald-500 font-mono">({poseGraphData.length} pts)</span>}
                </div>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  <button onClick={() => setActiveMetrics(p => ({ ...p, knee: !p.knee }))} className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1.5 border ${activeMetrics.knee ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/40' : 'bg-gray-100 dark:bg-gray-800/80 text-gray-500 border-gray-200 dark:border-transparent hover:text-gray-800 dark:hover:text-gray-300'}`}>
                    <span className="w-2 h-2 rounded-full bg-[#00D084]"></span> Knee
                  </button>
                  <button onClick={() => setActiveMetrics(p => ({ ...p, hip: !p.hip }))} className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1.5 border ${activeMetrics.hip ? 'bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-500/40' : 'bg-gray-100 dark:bg-gray-800/80 text-gray-500 border-gray-200 dark:border-transparent hover:text-gray-800 dark:hover:text-gray-300'}`}>
                    <span className="w-2 h-2 rounded-full bg-[#3b82f6]"></span> Hip
                  </button>
                  <button onClick={() => setActiveMetrics(p => ({ ...p, trunk: !p.trunk }))} className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1.5 border ${activeMetrics.trunk ? 'bg-purple-50 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400 border-purple-300 dark:border-purple-500/40' : 'bg-gray-100 dark:bg-gray-800/80 text-gray-500 border-gray-200 dark:border-transparent hover:text-gray-800 dark:hover:text-gray-300'}`}>
                    <span className="w-2 h-2 rounded-full bg-[#a855f7]"></span> Trunk Lean
                  </button>
                  <button onClick={() => setActiveMetrics(p => ({ ...p, shin: !p.shin }))} className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1.5 border ${activeMetrics.shin ? 'bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-500/40' : 'bg-gray-100 dark:bg-gray-800/80 text-gray-500 border-gray-200 dark:border-transparent hover:text-gray-800 dark:hover:text-gray-300'}`}>
                    <span className="w-2 h-2 rounded-full bg-[#f59e0b]"></span> Shin Angle
                  </button>
                  <button onClick={() => setActiveMetrics(p => ({ ...p, elbow: !p.elbow }))} className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1.5 border ${activeMetrics.elbow ? 'bg-pink-50 dark:bg-pink-500/20 text-pink-700 dark:text-pink-400 border-pink-300 dark:border-pink-500/40' : 'bg-gray-100 dark:bg-gray-800/80 text-gray-500 border-gray-200 dark:border-transparent hover:text-gray-800 dark:hover:text-gray-300'}`}>
                    <span className="w-2 h-2 rounded-full bg-[#ec4899]"></span> Elbow
                  </button>
                </div>
              </div>

              {poseGraphData.length > 0 ? (
                <div className="flex-1 min-h-[220px]">
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart 
                      data={poseGraphData} 
                      margin={{ top: 5, right: 30, left: 0, bottom: 5 }} 
                      style={{ cursor: 'pointer' }}
                      onClick={(e) => {
                        if (e && e.activePayload && e.activePayload.length > 0) {
                          const targetTime = e.activePayload[0].payload.time;
                          if (videoPlaybackRef.current) {
                            videoPlaybackRef.current.currentTime = targetTime;
                          }
                          setPlaybackTime(targetTime);
                        }
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#2a2d33" vertical={false} />
                      <XAxis 
                        dataKey="time" 
                        stroke="#4a4d54" 
                        tick={{ fill: '#8b8e98', fontSize: 12 }}
                        tickFormatter={(val) => `${val.toFixed(1)}s`}
                      />
                      <YAxis 
                        domain={[0, 180]} 
                        stroke="#4a4d54" 
                        tick={{ fill: '#8b8e98', fontSize: 12 }}
                      />
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: '#1a1c20', borderColor: '#2a2d33', borderRadius: '8px', color: '#fff' }}
                        labelFormatter={(val) => `Time: ${val.toFixed(2)}s`}
                      />
                      {activeMetrics.knee && <Line type="monotone" dataKey="knee" stroke="#00D084" strokeWidth={2} dot={false} name="Knee Angle (°)" />}
                      {activeMetrics.hip && <Line type="monotone" dataKey="hip" stroke="#3b82f6" strokeWidth={2} dot={false} name="Hip Angle (°)" />}
                      {activeMetrics.trunk && <Line type="monotone" dataKey="trunk" stroke="#a855f7" strokeWidth={2} dot={false} name="Trunk Lean (°)" />}
                      {activeMetrics.shin && <Line type="monotone" dataKey="shin" stroke="#f59e0b" strokeWidth={2} dot={false} name="Shin Angle (°)" />}
                      {activeMetrics.elbow && <Line type="monotone" dataKey="elbow" stroke="#ec4899" strokeWidth={2} dot={false} name="Elbow Angle (°)" />}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-44 border-2 border-dashed border-gray-200 dark:border-slate-700/70 rounded-xl flex flex-col items-center justify-center p-6 text-center gap-2">
                  <Activity size={26} className="text-emerald-500 opacity-80" />
                  <div className="text-sm font-bold text-gray-800 dark:text-gray-200">
                    {poseMode ? "Ready for Analysis — Play or Scrub Video" : "AI Angle Graph Ready to Analyze"}
                  </div>
                  <div className="text-xs text-gray-500 max-w-md">
                    {poseMode 
                      ? "Press Play or drag the seekbar across the athlete's movement to record frame-by-frame joint angles."
                      : "Start AI Tracking above or play video to track knee extension, hip angles, and sprint posture."}
                  </div>
                  {!poseMode && (
                    <button 
                      onClick={() => { initializePoseLandmarker(); togglePlayback(); }}
                      className="mt-1 px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold rounded-lg transition"
                    >
                      Analyze & Play Video
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Stride Kinetics Data */}
            {(analysisActivity === 'sprint' || analysisActivity === 'sprint_start' || analysisActivity === 'sprint_maxv') && (
              <div className="bg-white dark:bg-slate-800 p-5 sm:p-6 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm">
                <div className="text-xs text-gray-500 font-bold tracking-widest uppercase mb-4 flex items-center justify-between">
                  <span>{analysisActivity === 'sprint_start' ? '0-15m Acceleration Drive Kinetics' : 'Advanced Stride & Biomechanical Kinetics'}</span>
                  {calibrationLine ? (
                    <span className="text-emerald-500 font-semibold">Calibrated Reference Active</span>
                  ) : (
                    <span className="text-yellow-500 font-semibold">Uncalibrated Distance (1m ref)</span>
                  )}
                </div>

                {analysisActivity === 'sprint_start' && (
                  <div className="mb-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold">
                      <span>🚀 Drive Phase Focus:</span>
                      <span className="font-normal text-gray-700 dark:text-gray-300">Target Trunk Lean 30°–42° • Positive Shin Attack Angle (&gt;1°) • Explosive Ground Contact</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                      ⚡ Pure Sprint Start Analysis (Zero Vertical Jump Contamination)
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
                  <div className="bg-slate-50 dark:bg-slate-900 p-3.5 rounded-xl border border-gray-100 dark:border-slate-800">
                    <div className="text-[11px] text-gray-500 font-bold mb-1">GROUND CONTACT</div>
                    <div className="text-xl font-bold text-gray-800 dark:text-gray-200">
                      {strideKinetics?.gct ? `${strideKinetics.gct}s` : (poseMode && poseGraphData.length > 20 ? "Analyzing" : "--")}
                    </div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900 p-3.5 rounded-xl border border-gray-100 dark:border-slate-800">
                    <div className="text-[11px] text-gray-500 font-bold mb-1">FLIGHT TIME</div>
                    <div className="text-xl font-bold text-gray-800 dark:text-gray-200">
                      {strideKinetics?.flight ? `${strideKinetics.flight}s` : (poseMode && poseGraphData.length > 20 ? "Analyzing" : "--")}
                    </div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900 p-3.5 rounded-xl border border-gray-100 dark:border-slate-800">
                    <div className="text-[11px] text-gray-500 font-bold mb-1">STRIDE LENGTH</div>
                    <div className="text-xl font-bold text-gray-800 dark:text-gray-200">
                      {strideKinetics?.strideLength ? `${strideKinetics.strideLength}m` : (poseMode && poseGraphData.length > 20 ? "Estimating" : "--")}
                    </div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900 p-3.5 rounded-xl border border-gray-100 dark:border-slate-800">
                    <div className="text-[11px] text-gray-500 font-bold mb-1">TRUNK LEAN</div>
                    <div className="text-xl font-bold text-purple-400">
                      {strideKinetics?.avgTrunkLean ? `${strideKinetics.avgTrunkLean}°` : (poseGraphData.length > 0 && poseGraphData[poseGraphData.length - 1]?.trunk ? `${poseGraphData[poseGraphData.length - 1].trunk}°` : "--")}
                    </div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900 p-3.5 rounded-xl border border-gray-100 dark:border-slate-800">
                    <div className="text-[11px] text-gray-500 font-bold mb-1">SHIN ANGLE</div>
                    <div className="text-xl font-bold text-amber-400">
                      {strideKinetics?.avgShinAngle ? `${strideKinetics.avgShinAngle}°` : (poseGraphData.length > 0 && poseGraphData[poseGraphData.length - 1]?.shin ? `${poseGraphData[poseGraphData.length - 1].shin}°` : "--")}
                    </div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900 p-3.5 rounded-xl border border-gray-100 dark:border-slate-800">
                    <div className="text-[11px] text-gray-500 font-bold mb-1">CADENCE</div>
                    <div className="text-xl font-bold text-blue-400">
                      {strideKinetics?.cadenceSpm ? `${strideKinetics.cadenceSpm}` : (poseMode && poseGraphData.length > 20 ? "Calc..." : "--")} <span className="text-xs text-gray-500">SPM</span>
                    </div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900 p-3.5 rounded-xl border border-gray-100 dark:border-slate-800">
                    <div className="text-[11px] text-gray-500 font-bold mb-1">STRIDES</div>
                    <div className="text-xl font-bold text-emerald-500">
                      {strideKinetics?.count ? strideKinetics.count : (poseGraphData.length > 40 ? "Tracking" : "0")}
                    </div>
                  </div>
                </div>

                {/* Bilateral Footstrike Symmetry & Step-by-Step Cadence Heatmap */}
                {strideKinetics && strideKinetics.count >= 2 && (
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700/80 flex flex-col gap-3">
                    {/* Bilateral GCT Symmetry Gauge */}
                    <div className="bg-slate-50 dark:bg-slate-900/80 rounded-xl p-3 border border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                            Bilateral Footstrike Balance
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                            strideKinetics.gctAsymmetryPct <= 4
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : strideKinetics.gctAsymmetryPct <= 8
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          }`}>
                            {strideKinetics.gctAsymmetryPct}% Asymmetry • {
                              strideKinetics.gctAsymmetryPct <= 4 ? 'Elite Balance' :
                              strideKinetics.gctAsymmetryPct <= 8 ? 'Mild Asymmetry' : 'High Asymmetry'
                            }
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          Left Foot GCT: <span className="font-mono font-bold text-sky-400">{strideKinetics.leftGct}s</span> | 
                          Right Foot GCT: <span className="font-mono font-bold text-emerald-400 ml-1">{strideKinetics.rightGct}s</span>
                        </div>
                      </div>

                      {/* Visual Symmetry Balance Bar */}
                      <div className="w-full sm:w-48 flex flex-col gap-1">
                        <div className="flex justify-between text-[9px] font-mono text-gray-400">
                          <span className="text-sky-400 font-bold">LEFT</span>
                          <span className="text-emerald-400 font-bold">RIGHT</span>
                        </div>
                        <div className="h-2 w-full bg-slate-800 rounded-full flex overflow-hidden">
                          <div 
                            className="bg-sky-400 h-full transition-all"
                            style={{ 
                              width: `${Math.round((parseFloat(strideKinetics.leftGct) / (parseFloat(strideKinetics.leftGct) + parseFloat(strideKinetics.rightGct) || 1)) * 100)}%` 
                            }}
                          />
                          <div 
                            className="bg-emerald-400 h-full transition-all"
                            style={{ 
                              width: `${Math.round((parseFloat(strideKinetics.rightGct) / (parseFloat(strideKinetics.leftGct) + parseFloat(strideKinetics.rightGct) || 1)) * 100)}%` 
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Step-by-Step Kinematic Sequence Track */}
                    {strideKinetics.stepBreakdown && strideKinetics.stepBreakdown.length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                          <span>Step-by-Step Kinematic Sequence (Contact vs Flight)</span>
                          <span className="font-mono text-[9px] text-gray-500">Left: Blue | Right: Green</span>
                        </div>
                        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
                          {strideKinetics.stepBreakdown.map((step) => (
                            <div 
                              key={step.stepNum}
                              className={`shrink-0 p-2.5 rounded-xl border flex flex-col gap-1 min-w-[110px] ${
                                step.foot === 'L' 
                                  ? 'bg-sky-500/5 border-sky-500/20' 
                                  : 'bg-emerald-500/5 border-emerald-500/20'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                                  step.foot === 'L' 
                                    ? 'bg-sky-500/20 text-sky-400' 
                                    : 'bg-emerald-500/20 text-emerald-400'
                                }`}>
                                  Step {step.stepNum} ({step.foot})
                                </span>
                                <span className="text-[9px] font-mono text-gray-500">
                                  {step.startSec}s
                                </span>
                              </div>
                              <div className="text-xs font-mono font-bold text-gray-200 mt-0.5">
                                GCT: {step.gctSec}s
                              </div>
                              <div className="text-[10px] font-mono text-gray-400">
                                Flight: {step.flightSec}s
                              </div>
                              <div className="flex justify-between items-center text-[9px] text-gray-400 border-t border-gray-100 dark:border-slate-800 pt-1 mt-0.5">
                                <span>{step.stepDistM}m</span>
                                <span className="font-bold text-gray-300">{step.cadenceSpm} SPM</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Automated AI Biomechanical Coaching & Flaw Detection Deck */}
            {(analysisActivity === 'sprint' || analysisActivity === 'sprint_start' || analysisActivity === 'sprint_maxv') && showBioCoach && (
              <AIBioCoachDeck 
                analysis={aiBioCoachAnalysis}
                currentTime={playbackTime}
                isTrackingActive={poseMode}
                onSeekToTime={(targetTime) => {
                  if (videoPlaybackRef.current) {
                    videoPlaybackRef.current.currentTime = targetTime;
                  }
                  setPlaybackTime(targetTime);
                }}
                onToggleCoach={() => {
                  setShowBioCoach(false);
                  localStorage.setItem('sprintgate_show_bio_coach', 'false');
                }}
                isVisible={showBioCoach}
              />
            )}

            {/* Jump Analysis Card */}
            {analysisActivity === 'jump' && (
              <div className="bg-white dark:bg-slate-800 p-5 sm:p-6 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm">
                <div className="text-xs text-gray-500 font-bold tracking-widest uppercase mb-4 flex items-center justify-between">
                  <span>Vertical Jump Analysis</span>
                  <span className="text-xs text-gray-500 font-normal">Flight time elevation model (1.226 × t²)</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-gray-100 dark:border-slate-800">
                    <div className="text-xs text-gray-500 font-bold mb-1">HANG TIME</div>
                    <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                      {jumpAnalysis?.hangTime ? `${jumpAnalysis.hangTime}s` : (poseMode ? "Detecting Jump..." : "--")}
                    </div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-gray-100 dark:border-slate-800">
                    <div className="text-xs text-gray-500 font-bold mb-1">JUMP HEIGHT (CM)</div>
                    <div className="text-2xl font-bold text-emerald-400">
                      {jumpAnalysis?.heightCm ? `${jumpAnalysis.heightCm} cm` : "--"}
                    </div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-gray-100 dark:border-slate-800">
                    <div className="text-xs text-gray-500 font-bold mb-1">JUMP HEIGHT (IN)</div>
                    <div className="text-2xl font-bold text-blue-400">
                      {jumpAnalysis?.heightIn ? `${jumpAnalysis.heightIn} in` : "--"}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Long Jump / Broad Jump Card */}
            {analysisActivity === 'long_jump' && (
              <div className="bg-white dark:bg-slate-800 p-5 sm:p-6 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm">
                <div className="text-xs text-gray-500 font-bold tracking-widest uppercase mb-4 flex items-center justify-between">
                  <span>Long Jump / Broad Jump Analysis</span>
                  <span className="text-xs text-gray-500 font-normal">Takeoff angles & projectile flight model</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-gray-100 dark:border-slate-800">
                    <div className="text-xs text-gray-500 font-bold mb-1">FLIGHT TIME</div>
                    <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                      {longJumpAnalysis?.flightTime ? `${longJumpAnalysis.flightTime}s` : (poseMode ? "Detecting Takeoff..." : "--")}
                    </div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-gray-100 dark:border-slate-800">
                    <div className="text-xs text-gray-500 font-bold mb-1">EST. DISTANCE</div>
                    <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                      {longJumpAnalysis?.estimatedDistance ? `${longJumpAnalysis.estimatedDistance}m` : "--"}
                    </div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-gray-100 dark:border-slate-800">
                    <div className="text-xs text-gray-500 font-bold mb-1">TAKEOFF KNEE ANGLE</div>
                    <div className="text-2xl font-bold text-emerald-500">
                      {longJumpAnalysis?.takeOffKnee ? `${longJumpAnalysis.takeOffKnee}°` : (poseGraphData.length > 0 && poseGraphData[poseGraphData.length - 1]?.knee ? `${poseGraphData[poseGraphData.length - 1].knee}°` : "--")}
                    </div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-gray-100 dark:border-slate-800">
                    <div className="text-xs text-gray-500 font-bold mb-1">TAKEOFF HIP ANGLE</div>
                    <div className="text-2xl font-bold text-emerald-500">
                      {longJumpAnalysis?.takeOffHip ? `${longJumpAnalysis.takeOffHip}°` : (poseGraphData.length > 0 && poseGraphData[poseGraphData.length - 1]?.hip ? `${poseGraphData[poseGraphData.length - 1].hip}°` : "--")}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Throwing Biomechanics Card */}
            {analysisActivity === 'throw' && (
              <div className="bg-white dark:bg-slate-800 p-5 sm:p-6 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm">
                <div className="text-xs text-gray-500 font-bold tracking-widest uppercase mb-4 flex items-center justify-between">
                  <span>Throwing Biomechanics Analysis</span>
                  <span className="text-xs text-gray-500 font-normal">Kinetic chain elbow extension & release vector</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-gray-100 dark:border-slate-800">
                    <div className="text-xs text-gray-500 font-bold mb-1">MAX ELBOW EXTENSION</div>
                    <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                      {throwAnalysis?.maxElbowExtension ? `${throwAnalysis.maxElbowExtension}°` : "--"}
                    </div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-gray-100 dark:border-slate-800">
                    <div className="text-xs text-gray-500 font-bold mb-1">MAX ELBOW COCKING (FLEXION)</div>
                    <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                      {throwAnalysis?.maxElbowFlexion ? `${throwAnalysis.maxElbowFlexion}°` : "--"}
                    </div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-gray-100 dark:border-slate-800">
                    <div className="text-xs text-gray-500 font-bold mb-1">RELEASE ANGLE (EST)</div>
                    <div className="text-2xl font-bold text-emerald-500">
                      {throwAnalysis?.releaseAngle ? `${throwAnalysis.releaseAngle}°` : "--"}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Agility Analysis Card */}
            {analysisActivity === 'agility' && (
              <div className="bg-white dark:bg-slate-800 p-5 sm:p-6 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm">
                <div className="text-xs text-gray-500 font-bold tracking-widest uppercase mb-4 flex items-center justify-between">
                  <span>Agility / Change of Direction (COD) Analysis</span>
                  <span className="text-xs text-gray-500 font-normal">Plant step angles & trunk lean dynamics</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-gray-100 dark:border-slate-800">
                    <div className="text-xs text-gray-500 font-bold mb-1">PEAK TRUNK LEAN IN CUT</div>
                    <div className="text-2xl font-bold text-purple-400">
                      {poseGraphData.length > 0 ? `${Math.max(...poseGraphData.map(d => d.trunk || 0)).toFixed(1)}°` : "--"}
                    </div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-gray-100 dark:border-slate-800">
                    <div className="text-xs text-gray-500 font-bold mb-1">MAX PLANT KNEE FLEXION</div>
                    <div className="text-2xl font-bold text-emerald-400">
                      {poseGraphData.length > 0 ? `${Math.min(...poseGraphData.filter(d => d.knee > 40).map(d => d.knee || 180)).toFixed(1)}°` : "--"}
                    </div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-gray-100 dark:border-slate-800">
                    <div className="text-xs text-gray-500 font-bold mb-1">MIN SHIN ANGLE (CUT BRAKING)</div>
                    <div className="text-2xl font-bold text-amber-400">
                      {poseGraphData.length > 0 ? `${Math.min(...poseGraphData.filter(d => d.shin !== 0).map(d => d.shin || 0)).toFixed(1)}°` : "--"}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MediaPipe Pose Settings Modal */}
      {showPoseSettings && (
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 p-6 md:p-8 rounded-3xl max-w-xl w-full shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 border-b border-gray-200 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-[#00D084]">
                  <Sliders size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">AI Pose & Biomechanics Calibration</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Fine-tune MediaPipe confidence, temporal smoothing, and custom sprint metrics</p>
                </div>
              </div>
              <button onClick={() => setShowPoseSettings(false)} className="p-2 text-gray-400 hover:text-white rounded-lg transition">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6 flex-1">
              {/* Model Fidelity */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2">Model Architecture</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'lite', name: 'Lite (Safe)', desc: 'Fastest • Ideal for Tablets & Mobile' },
                    { id: 'full', name: 'Full', desc: 'Balanced • Standard Laptops' },
                    { id: 'heavy', name: 'Heavy (Pro)', desc: 'Desktop GPU Only • May crash tablets' }
                  ].map(m => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setPoseModelQuality(m.id);
                        localStorage.setItem('sprintgate_pose_model', m.id);
                      }}
                      className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                        poseModelQuality === m.id
                          ? 'border-[#00D084] bg-emerald-500/10 text-emerald-400'
                          : 'border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 text-gray-700 dark:text-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <div className="font-bold text-sm mb-1">{m.name}</div>
                      <div className="text-[11px] text-gray-500 leading-tight">{m.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Confidence Thresholds */}
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Detection Confidence</label>
                    <span className="text-xs font-mono font-bold text-emerald-500">{Math.round(poseConfidence * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="0.85"
                    step="0.05"
                    value={poseConfidence}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setPoseConfidence(val);
                      localStorage.setItem('sprintgate_pose_conf', val);
                    }}
                    className="w-full accent-[#00D084] cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Tracking Confidence</label>
                    <span className="text-xs font-mono font-bold text-emerald-500">{Math.round(poseTrackingConf * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="0.85"
                    step="0.05"
                    value={poseTrackingConf}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setPoseTrackingConf(val);
                      localStorage.setItem('sprintgate_pose_track_conf', val);
                    }}
                    className="w-full accent-[#00D084] cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Temporal EMA Smoothing</label>
                    <span className="text-xs font-mono font-bold text-purple-400">{Math.round(poseSmoothing * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="0.95"
                    step="0.05"
                    value={poseSmoothing}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setPoseSmoothing(val);
                      localStorage.setItem('sprintgate_pose_smoothing', val);
                    }}
                    className="w-full accent-purple-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Minimum Joint Visibility</label>
                    <span className="text-xs font-mono font-bold text-amber-500">{Math.round(minVisibility * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="0.70"
                    step="0.05"
                    value={minVisibility}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setMinVisibility(val);
                      localStorage.setItem('sprintgate_pose_vis', val);
                    }}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-slate-800">
                <button
                  onClick={handleEmergencyResetPose}
                  className="px-4 py-2 text-xs font-bold text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 rounded-xl transition"
                >
                  Reset Defaults
                </button>
                <button
                  onClick={() => {
                    if (poseMode) {
                      initializePoseLandmarker();
                    }
                    setShowPoseSettings(false);
                  }}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-[#00e691] text-black font-bold rounded-xl text-sm transition shadow-sm"
                >
                  {poseMode ? 'Apply & Reload Model' : 'Save Settings'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Kinematic Chronophotography Strobe Motion Visuals Modal */}
      {showStrobeModal && (
        <StrobeMotionModal
          isOpen={showStrobeModal}
          onClose={() => setShowStrobeModal(false)}
          videoURL={videoURL}
          poseLandmarker={poseLandmarkerRef.current}
          athleteInfo={broadcastAthlete}
          videoDuration={videoPlaybackRef.current?.duration || 3}
          themeAccent={getThemeAccent()}
        />
      )}
    </div>
  );
}
