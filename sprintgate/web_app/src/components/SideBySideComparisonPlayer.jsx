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

import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, Pause, ChevronLeft, ChevronRight, RotateCcw, 
  Upload, Sliders, Users, Trophy, Download, Video, Maximize, Minimize, X,
  CheckCircle2, AlertCircle, Eye, EyeOff, Layers, Gauge
} from 'lucide-react';

export default function SideBySideComparisonPlayer({
  videoURL,
  compareVideoURL,
  history = [],
  results = [],
  onClose,
  onExportBurnedIn
}) {
  // Video Sources
  const [sourceA, setSourceA] = useState(videoURL || '');
  const [sourceB, setSourceB] = useState(compareVideoURL || '');

  // Metadata for Run A and Run B
  const [metaA, setMetaA] = useState(() => results[0] || history[0] || null);
  const [metaB, setMetaB] = useState(null);

  // Video Element Refs
  const videoARef = useRef(null);
  const videoBRef = useRef(null);

  // Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeA, setCurrentTimeA] = useState(0);
  const [currentTimeB, setCurrentTimeB] = useState(0);
  const [durationA, setDurationA] = useState(0);
  const [durationB, setDurationB] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0); // 0.25, 0.5, 1.0

  // Sync Offset (in seconds) between Video A and Video B
  // Positive offset means Video B is shifted forward in time
  const [syncOffset, setSyncOffset] = useState(0); // in seconds (-2.0s to +2.0s)
  const [syncLocked, setSyncLocked] = useState(true);

  // Display Mode
  const [viewMode, setViewMode] = useState('side_by_side'); // 'side_by_side' | 'stacked'

  // Update source when props change
  useEffect(() => {
    if (videoURL && !sourceA) setSourceA(videoURL);
  }, [videoURL]);

  useEffect(() => {
    if (compareVideoURL && !sourceB) setSourceB(compareVideoURL);
  }, [compareVideoURL]);

  // When metadata A is picked, try to find athlete's PR for Video B by default
  useEffect(() => {
    if (metaA && !metaB && history.length > 0) {
      // Find all runs by this athlete
      const athleteRuns = history.filter(h => h.name === metaA.name && h.testType === metaA.testType);
      if (athleteRuns.length > 1) {
        // Sort by time ascending to get Personal Record (PR)
        const sorted = [...athleteRuns].sort((a, b) => parseFloat(a.time) - parseFloat(b.time));
        const prRun = sorted[0];
        setMetaB(prRun);
      } else {
        // Pick top historical runner
        const topRun = history.find(h => h.name !== metaA.name);
        if (topRun) setMetaB(topRun);
      }
    }
  }, [metaA, history]);

  // Master Play / Pause Controller
  const togglePlay = () => {
    if (!videoARef.current && !videoBRef.current) return;

    if (isPlaying) {
      if (videoARef.current) videoARef.current.pause();
      if (videoBRef.current) videoBRef.current.pause();
      setIsPlaying(false);
    } else {
      // Auto rewind if video reached end
      if (videoARef.current && (videoARef.current.ended || videoARef.current.currentTime >= (videoARef.current.duration - 0.05))) {
        videoARef.current.currentTime = 0;
        setCurrentTimeA(0);
      }
      if (videoBRef.current && (videoBRef.current.ended || videoBRef.current.currentTime >= (videoBRef.current.duration - 0.05))) {
        const startB = Math.max(0, syncOffset);
        videoBRef.current.currentTime = startB;
        setCurrentTimeB(startB);
      }
      if (videoARef.current) {
        videoARef.current.playbackRate = playbackSpeed;
        videoARef.current.play().catch(() => {});
      }
      if (videoBRef.current) {
        videoBRef.current.playbackRate = playbackSpeed;
        // align Video B position based on syncOffset
        if (videoARef.current && syncLocked) {
          const targetBTime = Math.max(0, videoARef.current.currentTime + syncOffset);
          videoBRef.current.currentTime = targetBTime;
        }
        videoBRef.current.play().catch(() => {});
      }
      setIsPlaying(true);
    }
  };

  // Speed changer
  const handleSpeedChange = (speed) => {
    setPlaybackSpeed(speed);
    if (videoARef.current) videoARef.current.playbackRate = speed;
    if (videoBRef.current) videoBRef.current.playbackRate = speed;
  };

  // Frame by Frame Stepping (0.033s = ~30fps frame)
  const stepFrame = (forward = true) => {
    const delta = forward ? 0.033 : -0.033;
    if (videoARef.current) {
      videoARef.current.pause();
      const newTimeA = Math.max(0, Math.min(durationA || 10, videoARef.current.currentTime + delta));
      videoARef.current.currentTime = newTimeA;
      setCurrentTimeA(newTimeA);

      if (videoBRef.current && syncLocked) {
        const newTimeB = Math.max(0, Math.min(durationB || 10, newTimeA + syncOffset));
        videoBRef.current.currentTime = newTimeB;
        setCurrentTimeB(newTimeB);
      }
    } else if (videoBRef.current) {
      videoBRef.current.pause();
      const newTimeB = Math.max(0, Math.min(durationB || 10, videoBRef.current.currentTime + delta));
      videoBRef.current.currentTime = newTimeB;
      setCurrentTimeB(newTimeB);
    }
    setIsPlaying(false);
  };

  // Master Timeline Scrubber
  const handleMasterSeek = (e) => {
    const targetA = parseFloat(e.target.value);
    setCurrentTimeA(targetA);
    if (videoARef.current) {
      videoARef.current.currentTime = targetA;
    }
    if (videoBRef.current && syncLocked) {
      const targetB = Math.max(0, Math.min(durationB || 10, targetA + syncOffset));
      videoBRef.current.currentTime = targetB;
      setCurrentTimeB(targetB);
    }
  };

  // Sync Offset adjuster
  const handleOffsetChange = (e) => {
    const offset = parseFloat(e.target.value);
    setSyncOffset(offset);
    if (videoBRef.current && videoARef.current) {
      const targetB = Math.max(0, Math.min(durationB || 10, videoARef.current.currentTime + offset));
      videoBRef.current.currentTime = targetB;
      setCurrentTimeB(targetB);
    }
  };

  // File Upload Handlers
  const handleUploadVideoA = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSourceA(URL.createObjectURL(e.target.files[0]));
    }
  };

  const handleUploadVideoB = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSourceB(URL.createObjectURL(e.target.files[0]));
    }
  };

  // Max duration for the master slider
  const maxTimeline = Math.max(durationA || 0, durationB || 0, 5);

  // Real-time delta comparison
  const deltaSeconds = currentTimeA - currentTimeB;

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 md:p-8 flex flex-col gap-6 shadow-2xl text-gray-100">
      
      {/* Top Header & Session Pickers */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-[#00D084]">
              <Layers size={20} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-3">
                Side-by-Side Video Comparison Player
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  SYNCHRONIZED
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Compare current run vs. Personal Record (PR) or teammate frame-by-frame with slow-mo scrubbing.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="flex bg-slate-800/80 rounded-xl p-1 border border-slate-700">
            <button
              onClick={() => setViewMode('side_by_side')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition ${viewMode === 'side_by_side' ? 'bg-emerald-600 text-black shadow-sm' : 'text-slate-400 hover:text-white'}`}
            >
              Side-by-Side
            </button>
            <button
              onClick={() => setViewMode('stacked')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition ${viewMode === 'stacked' ? 'bg-emerald-600 text-black shadow-sm' : 'text-slate-400 hover:text-white'}`}
            >
              Stacked
            </button>
          </div>

          {onExportBurnedIn && (
            <button
              onClick={() => onExportBurnedIn('landscape')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 text-black hover:bg-[#00e691] font-bold text-xs transition shadow-sm"
              title="Export Burned-In Video with skeletal overlay and timer"
            >
              <Download size={15} />
              <span>Burned-In Export</span>
            </button>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              title="Close Comparison Player"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Dual Video Players Viewport Grid */}
      <div className={`grid gap-4 sm:gap-6 ${viewMode === 'side_by_side' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
        
        {/* Video A Container */}
        <div className="flex flex-col gap-2.5 bg-slate-950/80 rounded-2xl border border-slate-800 p-3 sm:p-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Video A: Current Run</span>
              {metaA && (
                <span className="text-xs font-bold text-white ml-1">
                  ({metaA.name} · {metaA.time}s)
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <select
                value={metaA?.firebaseId || metaA?.id || ''}
                onChange={(e) => {
                  const found = history.find(h => (h.firebaseId === e.target.value || String(h.id) === e.target.value)) 
                    || results.find(r => String(r.id) === e.target.value);
                  if (found) setMetaA(found);
                }}
                className="bg-slate-900 text-[11px] text-slate-300 border border-slate-700 px-2 py-1 rounded-lg font-bold"
              >
                <option value="">Choose Athlete A...</option>
                {results.map((r, i) => (
                  <option key={`res-${r.id || i}`} value={r.id}>
                    Current: {r.name} - {r.time}s
                  </option>
                ))}
                {history.slice(0, 30).map(h => (
                  <option key={`hist-${h.firebaseId || h.id}`} value={h.firebaseId || h.id}>
                    {h.name} - {h.time}s
                  </option>
                ))}
              </select>

              <label className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer transition" title="Upload Video A">
                <Upload size={14} />
                <input type="file" accept="video/*" className="hidden" onChange={handleUploadVideoA} />
              </label>
            </div>
          </div>

          <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
            {sourceA ? (
              <video
                ref={videoARef}
                src={sourceA}
                className="w-full h-full object-contain cursor-pointer"
                playsInline
                webkit-playsinline="true"
                preload="auto"
                muted={true}
                onClick={togglePlay}
                onTimeUpdate={() => setCurrentTimeA(videoARef.current?.currentTime || 0)}
                onLoadedMetadata={() => setDurationA(videoARef.current?.duration || 0)}
                onEnded={() => {
                  if (!videoBRef.current || videoBRef.current.ended) setIsPlaying(false);
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-500 gap-2 p-4 text-center">
                <Video size={32} className="opacity-40" />
                <span className="text-xs">No Video A available.</span>
                <label className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 cursor-pointer hover:bg-emerald-500/20 transition">
                  Upload Video
                  <input type="file" accept="video/*" className="hidden" onChange={handleUploadVideoA} />
                </label>
              </div>
            )}

            {/* Video A HUD Overlay */}
            <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md rounded-xl px-3 py-1.5 border border-white/10 pointer-events-none">
              <div className="text-emerald-400 font-mono font-bold text-xl leading-none">
                {currentTimeA.toFixed(2)}s
              </div>
              <div className="text-[10px] text-slate-300 font-bold mt-0.5">
                {metaA?.name || 'Athlete A'}
              </div>
            </div>
          </div>
        </div>

        {/* Video B Container (PR or Teammate) */}
        <div className="flex flex-col gap-2.5 bg-slate-950/80 rounded-2xl border border-slate-800 p-3 sm:p-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400"></span>
              <span className="text-xs font-bold uppercase tracking-wider text-sky-400">Video B: Comparison / PR</span>
              {metaB && (
                <span className="text-xs font-bold text-white ml-1">
                  ({metaB.name} · {metaB.time}s)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <select
                value={metaB?.firebaseId || metaB?.id || ''}
                onChange={(e) => {
                  if (e.target.value === '__pr__' && metaA) {
                    const athleteRuns = history.filter(h => h.name === metaA.name && (h.testType === metaA.testType || !h.testType));
                    if (athleteRuns.length > 0) {
                      const sorted = [...athleteRuns].sort((a, b) => parseFloat(a.time) - parseFloat(b.time));
                      setMetaB(sorted[0]);
                    }
                    return;
                  }
                  const found = history.find(h => (h.firebaseId === e.target.value || String(h.id) === e.target.value))
                    || results.find(r => String(r.id) === e.target.value);
                  if (found) setMetaB(found);
                }}
                className="bg-slate-900 text-[11px] text-slate-300 border border-slate-700 px-2 py-1 rounded-lg font-bold"
              >
                <option value="">Choose Athlete B / PR...</option>
                {/* Personal Record quick pick */}
                {metaA && (
                  <option value="__pr__">
                    🏆 {metaA.name}'s Personal Record (PR)
                  </option>
                )}
                {history.slice(0, 30).map(h => (
                  <option key={`comp-${h.firebaseId || h.id}`} value={h.firebaseId || h.id}>
                    {h.name} - {h.time}s ({h.distance || '40'}m)
                  </option>
                ))}
              </select>

              <label className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer transition" title="Upload Video B">
                <Upload size={14} />
                <input type="file" accept="video/*" className="hidden" onChange={handleUploadVideoB} />
              </label>
            </div>
          </div>

          <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
            {sourceB ? (
              <video
                ref={videoBRef}
                src={sourceB}
                className="w-full h-full object-contain cursor-pointer"
                playsInline
                webkit-playsinline="true"
                preload="auto"
                muted={true}
                onClick={togglePlay}
                onTimeUpdate={() => setCurrentTimeB(videoBRef.current?.currentTime || 0)}
                onLoadedMetadata={() => setDurationB(videoBRef.current?.duration || 0)}
                onEnded={() => {
                  if (!videoARef.current || videoARef.current.ended) setIsPlaying(false);
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-500 gap-2 p-4 text-center">
                <Trophy size={32} className="opacity-40 text-yellow-500" />
                <span className="text-xs">No Comparison Video loaded.</span>
                <label className="text-[11px] font-bold text-sky-400 bg-sky-500/10 px-3 py-1.5 rounded-lg border border-sky-500/20 cursor-pointer hover:bg-sky-500/20 transition">
                  Upload Reference Video
                  <input type="file" accept="video/*" className="hidden" onChange={handleUploadVideoB} />
                </label>
              </div>
            )}

            {/* Video B HUD Overlay */}
            <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md rounded-xl px-3 py-1.5 border border-white/10 pointer-events-none">
              <div className="text-sky-400 font-mono font-bold text-xl leading-none">
                {currentTimeB.toFixed(2)}s
              </div>
              <div className="text-[10px] text-slate-300 font-bold mt-0.5">
                {metaB?.name || 'Athlete B'}
              </div>
            </div>

            {/* Live Delta Tag */}
            {sourceA && sourceB && (
              <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-md rounded-xl px-2.5 py-1 border border-white/10 pointer-events-none">
                <span className="text-[10px] text-slate-400 mr-1.5 font-bold">DELTA:</span>
                <span className={`font-mono font-bold text-xs ${deltaSeconds > 0 ? 'text-amber-400' : deltaSeconds < 0 ? 'text-emerald-400' : 'text-slate-300'}`}>
                  {deltaSeconds > 0 ? `+${deltaSeconds.toFixed(2)}s` : `${deltaSeconds.toFixed(2)}s`}
                </span>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Synchronized Control Deck */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col gap-4">
        
        {/* Master Scrub Bar */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono font-bold text-emerald-400 w-14 text-right">
            {currentTimeA.toFixed(2)}s
          </span>
          <div className="flex-1 relative flex items-center">
            <input 
              type="range"
              min="0"
              max={maxTimeline}
              step="0.01"
              value={currentTimeA}
              onChange={handleMasterSeek}
              className="w-full accent-[#00D084] cursor-pointer h-2 bg-slate-800 rounded-lg appearance-none"
            />
          </div>
          <span className="text-xs font-mono text-slate-400 w-14">
            {maxTimeline.toFixed(2)}s
          </span>
        </div>

        {/* Master Buttons and Speed Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          
          {/* Frame Stepping & Playback Control */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => stepFrame(false)}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition flex items-center gap-1 text-xs font-bold"
              title="Step Backward (1 Frame / 0.033s)"
            >
              <ChevronLeft size={18} />
              <span className="hidden sm:inline">-1 Frame</span>
            </button>

            <button
              onClick={togglePlay}
              className="px-5 py-3 bg-emerald-600 hover:bg-[#00e691] text-black font-bold rounded-2xl transition shadow-[0_0_20px_rgba(0,208,132,0.3)] flex items-center gap-2"
            >
              {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
              <span>{isPlaying ? 'PAUSE' : 'PLAY SYNC'}</span>
            </button>

            <button
              onClick={() => stepFrame(true)}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition flex items-center gap-1 text-xs font-bold"
              title="Step Forward (1 Frame / 0.033s)"
            >
              <span className="hidden sm:inline">+1 Frame</span>
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Synchronized Speed Selector: 0.25x, 0.5x, 1.0x */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1 rounded-xl">
            <span className="text-[11px] font-bold text-slate-400 px-2 uppercase">Speed:</span>
            {[0.25, 0.5, 1.0].map((rate) => (
              <button
                key={rate}
                onClick={() => handleSpeedChange(rate)}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition ${
                  playbackSpeed === rate 
                    ? 'bg-emerald-600 text-black shadow-sm' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>

          {/* Sync Offset Calibration Slider */}
          <div className="flex items-center gap-2.5 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
            <Sliders size={14} className="text-sky-400" />
            <div className="flex flex-col">
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                <span>SYNC OFFSET:</span>
                <span className="font-mono text-sky-400">{syncOffset > 0 ? `+${syncOffset.toFixed(2)}s` : `${syncOffset.toFixed(2)}s`}</span>
              </div>
              <input 
                type="range"
                min="-1.5"
                max="1.5"
                step="0.02"
                value={syncOffset}
                onChange={handleOffsetChange}
                className="w-24 sm:w-32 accent-sky-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
            </div>
            {syncOffset !== 0 && (
              <button 
                onClick={() => { setSyncOffset(0); if (videoBRef.current && videoARef.current) videoBRef.current.currentTime = videoARef.current.currentTime; }}
                className="text-[10px] text-slate-400 hover:text-white bg-slate-800 px-1.5 py-0.5 rounded font-mono"
                title="Reset Offset to 0s"
              >
                0.0s
              </button>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
