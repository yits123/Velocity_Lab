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

/**
 * Calculates realistic human sprint duration for any distance using Hill's
 * mono-exponential biomechanical model: d(t) = vMax * (t - tau * (1 - e^(-t/tau)))
 */
export function getPhysiologicalExpectedTime(distanceMeters, testMode = 'STRAIGHT_SPRINT') {
  if (testMode === 'AGILITY_4X10') {
    return 9.5;
  }

  const reactionAndBlockLag = 0.22; // s
  const vMax = 9.35;                // m/s (~33.6 km/h)
  const tau = 1.15;                 // s (acceleration time constant)

  let t = distanceMeters / 7.0;
  for (let i = 0; i < 8; i++) {
    const f = vMax * (t - tau * (1 - Math.exp(-t / tau))) - distanceMeters;
    const fPrime = vMax * (1 - Math.exp(-t / tau));
    t = t - f / Math.max(0.1, fPrime);
  }

  return Number((t + reactionAndBlockLag).toFixed(2));
}

/**
 * REACT HOOK: ASYMPTOTIC HARDWARE BEAM-SYNC STATE MACHINE
 */
export function useVirtualRunnerSync({
  isRunning,
  isFinished,
  distanceMeters = 10,
  testMode = 'STRAIGHT_SPRINT',
  targetTimeSec,
  lastSplitMeters = 0,
  isBenchmark = false,
}) {
  const [telemetry, setTelemetry] = useState({
    progressPercent: 0,
    direction: 1,
    currentLeg: 1,
    phase: 'IDLE',
    instantVelocityMs: 0,
    accelerationMs2: 0,
    gForce: 0,
    estimatedDistanceM: 0,
  });

  const startTimeRef = useRef(null);
  const finishTriggerTimeRef = useRef(null);
  const finishStartPosRef = useRef(0);
  const currentPosRef = useRef(0);
  const splitFloorPercentRef = useRef(0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (lastSplitMeters > 0 && distanceMeters > 0) {
      const splitPct = Math.min(92, (lastSplitMeters / distanceMeters) * 100);
      splitFloorPercentRef.current = Math.max(splitFloorPercentRef.current, splitPct);
    }
  }, [lastSplitMeters, distanceMeters]);

  useEffect(() => {
    if (!isRunning && !isFinished) {
      startTimeRef.current = null;
      finishTriggerTimeRef.current = null;
      finishStartPosRef.current = 0;
      currentPosRef.current = 0;
      splitFloorPercentRef.current = 0;
      setTelemetry({
        progressPercent: 0,
        direction: 1,
        currentLeg: 1,
        phase: 'IDLE',
        instantVelocityMs: 0,
        accelerationMs2: 0,
        gForce: 0,
        estimatedDistanceM: 0,
      });
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    const expectedTime =
      targetTimeSec && targetTimeSec > 0
        ? targetTimeSec
        : getPhysiologicalExpectedTime(distanceMeters, testMode);

    const vMax = 9.4;
    const tau = 1.12;

    const tick = (now) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = now;
      }
      const elapsedSec = (now - startTimeRef.current) / 1000;

      // CASE 1: BENCHMARK RUNNER
      if (isBenchmark) {
        const norm = Math.min(1, elapsedSec / expectedTime);
        const curve = Math.pow(norm, 1.25);
        const pct = curve * 100;
        const v = vMax * (1 - Math.exp(-elapsedSec / tau));
        const a = (vMax / tau) * Math.exp(-elapsedSec / tau);

        setTelemetry({
          progressPercent: pct,
          direction: 1,
          currentLeg: 1,
          phase: pct >= 100 ? 'FINISHED' : pct < 25 ? 'DRIVE_PHASE' : 'MAX_VELOCITY',
          instantVelocityMs: Number(v.toFixed(2)),
          accelerationMs2: Number(a.toFixed(2)),
          gForce: Number((a / 9.81).toFixed(2)),
          estimatedDistanceM: Number(((pct / 100) * distanceMeters).toFixed(2)),
        });

        if (pct < 100) {
          rafRef.current = requestAnimationFrame(tick);
        }
        return;
      }

      // CASE 2: LIVE RUNNER WHEN HARDWARE BEAM B SENSES FINISH
      if (isFinished) {
        if (finishTriggerTimeRef.current === null) {
          finishTriggerTimeRef.current = now;
          finishStartPosRef.current = currentPosRef.current;
        }

        const finishElapsed = (now - finishTriggerTimeRef.current) / 1000;
        const burstDuration = 0.4;
        const burstProgress = Math.min(1, finishElapsed / burstDuration);

        const finalPos =
          finishStartPosRef.current + (100 - finishStartPosRef.current) * Math.sin((burstProgress * Math.PI) / 2);

        setTelemetry((prev) => ({
          ...prev,
          progressPercent: finalPos,
          phase: burstProgress >= 1 ? 'FINISHED' : 'BEAM_BREAK_BURST',
          instantVelocityMs: Math.max(0, prev.instantVelocityMs - finishElapsed * 2.5),
          accelerationMs2: 0,
          gForce: 0,
          estimatedDistanceM: distanceMeters,
        }));

        if (burstProgress < 1) {
          rafRef.current = requestAnimationFrame(tick);
        }
        return;
      }

      // CASE 3: 4x10m AGILITY
      if (testMode === 'AGILITY_4X10') {
        const legTime = expectedTime / 4;
        const rawProgress = elapsedSec / expectedTime;

        if (rawProgress < 0.75) {
          const legIdx = Math.floor(rawProgress * 4);
          const legFrac = (rawProgress * 4) % 1;
          const isTurning = legFrac > 0.88;

          const sCurve = 0.5 - Math.cos(legFrac * Math.PI) / 2;
          const dir = legIdx % 2 === 0 ? 1 : -1;
          const pos = dir === 1 ? sCurve * 100 : (1 - sCurve) * 100;

          const vShuttle = Math.sin(legFrac * Math.PI) * 7.4;
          const aShuttle = Math.cos(legFrac * Math.PI) * 5.2;

          currentPosRef.current = pos;
          setTelemetry({
            progressPercent: pos,
            direction: dir,
            currentLeg: legIdx + 1,
            phase: isTurning ? 'TURNING' : legFrac < 0.25 ? 'DRIVE_PHASE' : 'MAX_VELOCITY',
            instantVelocityMs: Number(vShuttle.toFixed(2)),
            accelerationMs2: Number(aShuttle.toFixed(2)),
            gForce: Number((Math.abs(aShuttle) / 9.81).toFixed(2)),
            estimatedDistanceM: Number((legIdx * 10 + sCurve * 10).toFixed(1)),
          });
        } else {
          const leg4Elapsed = elapsedSec - legTime * 3;
          const holdTime = legTime * 0.85;
          let pos = 0;

          if (leg4Elapsed <= holdTime) {
            pos = (leg4Elapsed / holdTime) * 85;
          } else {
            const overtime = leg4Elapsed - holdTime;
            pos = 85 + 10 * (1 - Math.exp(-overtime / 1.25));
          }

          currentPosRef.current = pos;
          setTelemetry({
            progressPercent: pos,
            direction: 1,
            currentLeg: 4,
            phase: pos >= 85 ? 'ASYMPTOTIC_HOLD' : 'MAX_VELOCITY',
            instantVelocityMs: 6.9,
            accelerationMs2: 0.4,
            gForce: 0.15,
            estimatedDistanceM: Number((30 + (pos / 100) * 10).toFixed(1)),
          });
        }

        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      // CASE 4: STRAIGHT SPRINT (10m - 50m)
      const holdThresholdSec = expectedTime * 0.85;
      let calculatedPos = 0;
      let currentPhase = 'DRIVE_PHASE';

      if (elapsedSec <= holdThresholdSec) {
        const normTime = elapsedSec / holdThresholdSec;
        const biomechanicalCurve = Math.pow(normTime, 1.32);
        calculatedPos = biomechanicalCurve * 85;
        currentPhase = calculatedPos < 30 ? 'DRIVE_PHASE' : 'MAX_VELOCITY';
      } else {
        const overtimeSec = elapsedSec - holdThresholdSec;
        calculatedPos = 85 + 10 * (1 - Math.exp(-overtimeSec / 1.35));
        currentPhase = 'ASYMPTOTIC_HOLD';
      }

      const syncedPos = Math.max(calculatedPos, splitFloorPercentRef.current);
      currentPosRef.current = syncedPos;

      const vInst = vMax * (1 - Math.exp(-elapsedSec / tau));
      const aInst = (vMax / tau) * Math.exp(-elapsedSec / tau);

      setTelemetry({
        progressPercent: syncedPos,
        direction: 1,
        currentLeg: 1,
        phase: currentPhase,
        instantVelocityMs: Number(vInst.toFixed(2)),
        accelerationMs2: Number(aInst.toFixed(2)),
        gForce: Number((aInst / 9.81).toFixed(2)),
        estimatedDistanceM: Number(((syncedPos / 100) * distanceMeters).toFixed(2)),
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isRunning, isFinished, distanceMeters, testMode, targetTimeSec, isBenchmark]);

  return telemetry;
}

/**
 * HIGH-TECH HOLOGRAPHIC CYBER-SPRINTER
 * Inspired by futuristic digital biomechanics, constellation particle grids,
 * and high-speed cybernetic scanlines (matching user reference images).
 */
export const VirtualSprinter = ({
  telemetry,
  label,
  variant = 'live',
  topOffsetPercent = 50,
  minTrackPercent = 6,
  maxTrackPercent = 94,
}) => {
  const { progressPercent, direction, phase, instantVelocityMs } = telemetry || {};
  const isMoving =
    phase === 'DRIVE_PHASE' ||
    phase === 'MAX_VELOCITY' ||
    phase === 'ASYMPTOTIC_HOLD' ||
    phase === 'BEAM_BREAK_BURST';

  // Map progress (0 to 100) into track coordinate space
  const rawProgress = Math.min(100, Math.max(0, progressPercent || 0));
  const trackPosition = minTrackPercent + (rawProgress / 100) * (maxTrackPercent - minTrackPercent);

  // Dynamic stride frequency scaled by speed (0.18s to 0.42s per cycle)
  const strideDuration = isMoving
    ? Math.max(0.18, 0.42 - (instantVelocityMs || 0) * 0.022)
    : 0;

  // Lean angle: Sets in blocks at 30°, explosive drive at 36°, upright sprint at 18°
  const getTorsoLean = () => {
    if (phase === 'IDLE') return 28;
    if (phase === 'DRIVE_PHASE') return 36;
    if (phase === 'TURNING') return -14;
    if (phase === 'BEAM_BREAK_BURST') return 28;
    if (phase === 'FINISHED') return 10;
    return 18;
  };

  // Color profiles
  const isLive = variant === 'live';
  const neonPrimary = isLive ? '#00f5ff' : '#c084fc'; // Electric Cyan vs Neon Purple
  const neonSecondary = isLive ? '#38bdf8' : '#a855f7';
  const neonGlow = isLive ? '#00d084' : '#818cf8';
  const badgeBg = isLive ? 'rgba(3, 20, 36, 0.94)' : 'rgba(26, 12, 46, 0.94)';
  const badgeBorder = isLive ? 'rgba(0, 245, 255, 0.75)' : 'rgba(192, 132, 252, 0.75)';

  // Left & right edge clamping so the badge NEVER clips outside the track box
  let badgeLeft = '50%';
  let badgeTransform = 'translateX(-50%)';
  if (trackPosition <= 12) {
    badgeLeft = '0%';
    badgeTransform = 'translateX(0)';
  } else if (trackPosition >= 88) {
    badgeLeft = '100%';
    badgeTransform = 'translateX(-100%)';
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: `${trackPosition}%`,
        top: `${topOffsetPercent}%`,
        transform: 'translate(-50%, -50%) translateZ(0)',
        willChange: 'transform, left',
        pointerEvents: 'none',
        zIndex: isLive ? 35 : 25,
        transition: phase === 'IDLE' ? 'left 0.2s ease' : 'none',
      }}
    >
      {/* Scoped CSS Keyframe Animations */}
      <style>{`
        @keyframes vl-stride-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3.5px); }
        }
        @keyframes vl-cyber-arm-front {
          0%, 100% { transform: rotate(-48deg); }
          50% { transform: rotate(42deg); }
        }
        @keyframes vl-cyber-arm-back {
          0%, 100% { transform: rotate(44deg); }
          50% { transform: rotate(-48deg); }
        }
        @keyframes vl-cyber-leg-front {
          0%, 100% { transform: rotate(50deg); }
          50% { transform: rotate(-36deg); }
        }
        @keyframes vl-cyber-leg-back {
          0%, 100% { transform: rotate(-36deg); }
          50% { transform: rotate(50deg); }
        }
        @keyframes vl-scanline-drift {
          0% { opacity: 0.95; transform: scaleX(1); }
          50% { opacity: 0.35; transform: scaleX(1.35) translateX(-5px); }
          100% { opacity: 0.95; transform: scaleX(1); }
        }
        @keyframes vl-core-pulse {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.4); opacity: 1; }
        }
        @keyframes vl-star-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes vl-particle-float {
          0% { transform: translate(0, 0); opacity: 0.85; }
          100% { transform: translate(-26px, -8px); opacity: 0; }
        }
        @keyframes vl-idle-ready {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(1.5px) scale(0.98); }
        }
        @keyframes vl-burst-shockwave {
          0% { transform: scale(0.2); opacity: 1; }
          100% { transform: scale(3); opacity: 0; }
        }
      `}</style>

      {/* Floating HUD Telemetry Badge (Clamped to avoid left/right container clipping) */}
      {label && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: badgeLeft,
            transform: badgeTransform,
            marginBottom: '6px',
            whiteSpace: 'nowrap',
            backgroundColor: badgeBg,
            border: `1.5px solid ${badgeBorder}`,
            color: '#FFFFFF',
            fontSize: '9.5px',
            fontFamily: 'ui-monospace, monospace',
            fontWeight: 800,
            letterSpacing: '0.04em',
            padding: '3px 8.5px',
            borderRadius: '6px',
            boxShadow: `0 0 16px ${neonPrimary}60, inset 0 0 6px ${neonPrimary}30`,
            backdropFilter: 'blur(6px)',
          }}
        >
          {label}
        </div>
      )}

      {/* Main Runner Body Wrapper */}
      <div
        style={{
          transform: `scaleX(${direction || 1})`,
          position: 'relative',
          width: '96px',
          height: '78px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: isMoving
            ? `vl-stride-bob ${strideDuration}s infinite ease-in-out`
            : 'vl-idle-ready 2.2s infinite ease-in-out',
        }}
      >
        {/* ======================================================== */}
        {/* SPEED TRAILS & HORIZONTAL SCANLINES (IMAGES 2, 3 & 4)    */}
        {/* ======================================================== */}
        {isMoving && (
          <svg
            width="130"
            height="78"
            viewBox="0 0 130 78"
            style={{
              position: 'absolute',
              right: '36px',
              top: 0,
              overflow: 'visible',
              pointerEvents: 'none',
              animation: 'vl-scanline-drift 0.16s infinite ease-in-out',
            }}
          >
            <defs>
              <linearGradient id="scanlineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={neonPrimary} stopOpacity="0" />
                <stop offset="50%" stopColor={neonPrimary} stopOpacity="0.45" />
                <stop offset="85%" stopColor={neonSecondary} stopOpacity="0.8" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0.95" />
              </linearGradient>
            </defs>

            {/* Horizontal Cybernetic Scanlines Streaming Behind Body (Image 3) */}
            <line x1="10" y1="18" x2="90" y2="18" stroke="url(#scanlineGrad)" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="2" y1="26" x2="82" y2="26" stroke="url(#scanlineGrad)" strokeWidth="2" strokeLinecap="round" />
            <line x1="16" y1="34" x2="96" y2="34" stroke="url(#scanlineGrad)" strokeWidth="3.2" strokeLinecap="round" />
            <line x1="5" y1="42" x2="88" y2="42" stroke="url(#scanlineGrad)" strokeWidth="2.2" strokeLinecap="round" />
            <line x1="22" y1="52" x2="94" y2="52" stroke="url(#scanlineGrad)" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="10" y1="62" x2="84" y2="62" stroke="url(#scanlineGrad)" strokeWidth="2" strokeLinecap="round" />

            {/* Trailing Particle Constellation Motes (Image 2) */}
            <circle cx="32" cy="22" r="2.2" fill="#ffffff" opacity="0.9" style={{ animation: 'vl-particle-float 0.3s infinite ease-out' }} />
            <circle cx="16" cy="36" r="2.8" fill={neonPrimary} opacity="0.85" style={{ animation: 'vl-particle-float 0.25s infinite ease-out 0.08s' }} />
            <circle cx="38" cy="48" r="1.8" fill={neonGlow} opacity="0.8" style={{ animation: 'vl-particle-float 0.35s infinite ease-out 0.14s' }} />
            <circle cx="10" cy="56" r="2.4" fill="#ffffff" opacity="0.95" style={{ animation: 'vl-particle-float 0.28s infinite ease-out 0.05s' }} />
            <circle cx="28" cy="66" r="1.6" fill={neonSecondary} opacity="0.75" style={{ animation: 'vl-particle-float 0.32s infinite ease-out 0.18s' }} />
          </svg>
        )}

        {/* ======================================================== */}
        {/* SHARP HOLOGRAPHIC ATHLETIC SPRINTER (CRISP 4K VECTOR)   */}
        {/* ======================================================== */}
        <svg
          width="88"
          height="76"
          viewBox="0 0 88 76"
          shapeRendering="geometricPrecision"
          style={{
            overflow: 'visible',
          }}
        >
          <defs>
            {/* Luminous High-Contrast Gradients */}
            <linearGradient id="cyberBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="30%" stopColor={neonPrimary} />
              <stop offset="75%" stopColor={neonSecondary} />
              <stop offset="100%" stopColor="#0369a1" />
            </linearGradient>

            <linearGradient id="cyberLimbGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="35%" stopColor={neonPrimary} />
              <stop offset="100%" stopColor="#0284c7" />
            </linearGradient>

            {/* Glowing Constellation Core Star (Image 2) */}
            <radialGradient id="starCoreAura" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="35%" stopColor={neonPrimary} stopOpacity="0.85" />
              <stop offset="100%" stopColor={neonPrimary} stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Group with Forward Sprint Lean Angle */}
          <g
            transform={`rotate(${getTorsoLean()}, 46, 40)`}
            style={{ transition: 'transform 0.14s cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            {/* 1. BACK ARM (Contralateral Extension Drive) */}
            <g
              style={{
                transformOrigin: '44px 28px',
                animation: isMoving
                  ? `vl-cyber-arm-back ${strideDuration}s infinite ease-in-out`
                  : 'none',
              }}
            >
              {/* Arm vector glow aura */}
              <line x1="44" y1="28" x2="31" y2="37" stroke={neonPrimary} strokeWidth="8" strokeLinecap="round" opacity="0.35" />
              <line x1="31" y1="37" x2="38" y2="48" stroke={neonPrimary} strokeWidth="7" strokeLinecap="round" opacity="0.35" />
              {/* Upper arm (Tricep/Bicep) */}
              <line x1="44" y1="28" x2="31" y2="37" stroke="url(#cyberLimbGrad)" strokeWidth="5.5" strokeLinecap="round" opacity="0.85" />
              {/* Forearm & clenched fist */}
              <line x1="31" y1="37" x2="38" y2="48" stroke="#ffffff" strokeWidth="4.5" strokeLinecap="round" opacity="0.95" />
              {/* Constellation joint nodes */}
              <circle cx="31" cy="37" r="2.5" fill="#ffffff" />
              <circle cx="38" cy="48" r="2" fill={neonPrimary} />
            </g>

            {/* 2. BACK LEG (Trailing Hip Drive & Explosive Push-Off) */}
            <g
              style={{
                transformOrigin: '40px 45px',
                animation: isMoving
                  ? `vl-cyber-leg-back ${strideDuration}s infinite ease-in-out`
                  : 'none',
              }}
            >
              {/* Leg glow aura */}
              <line x1="40" y1="45" x2="28" y2="56" stroke={neonPrimary} strokeWidth="9" strokeLinecap="round" opacity="0.35" />
              <line x1="28" y1="56" x2="18" y2="67" stroke={neonPrimary} strokeWidth="7.5" strokeLinecap="round" opacity="0.35" />
              {/* Thigh (Hamstring/Quadricep power) */}
              <line x1="40" y1="45" x2="28" y2="56" stroke="url(#cyberLimbGrad)" strokeWidth="6.5" strokeLinecap="round" opacity="0.85" />
              {/* Calf (Gastrocnemius definition) */}
              <line x1="28" y1="56" x2="18" y2="67" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" opacity="0.95" />
              {/* Sprinting spike shoe */}
              <line x1="18" y1="67" x2="12" y2="70" stroke={neonPrimary} strokeWidth="4.2" strokeLinecap="round" />
              {/* Constellation joint nodes */}
              <circle cx="28" cy="56" r="2.8" fill="#ffffff" />
              <circle cx="18" cy="67" r="2.2" fill={neonPrimary} />
              <circle cx="12" cy="70" r="1.6" fill="#ffffff" />
            </g>

            {/* 3. MUSCULAR ATHLETIC TORSO & ABDOMINAL CORE (IMAGE 4) */}
            {/* Outer torso glow contour */}
            <path
              d="M 46 24 C 52 25, 55 30, 53 38 C 50 46, 44 49, 39 47 C 34 44, 36 31, 39 26 Z"
              fill={neonPrimary}
              opacity="0.3"
            />
            {/* Athletic muscular torso silhouette */}
            <path
              d="M 46 24 C 52 25, 55 30, 53 38 C 50 46, 44 49, 39 47 C 34 44, 36 31, 39 26 Z"
              fill="url(#cyberBodyGrad)"
              stroke="#ffffff"
              strokeWidth="1.4"
            />

            {/* Cybernetic Biometric Scanlines Across Chest & Core (Image 3) */}
            <line x1="40" y1="30" x2="51" y2="30" stroke="#ffffff" strokeWidth="1.2" opacity="0.85" />
            <line x1="39" y1="35" x2="52" y2="35" stroke={neonPrimary} strokeWidth="1.5" opacity="0.95" />
            <line x1="38" y1="40" x2="49" y2="40" stroke="#ffffff" strokeWidth="1.2" opacity="0.85" />

            {/* Constellation Lines Connecting Core to Pelvis */}
            <line x1="46" y1="28" x2="40" y2="45" stroke="#ffffff" strokeWidth="1" strokeDasharray="2 2" opacity="0.75" />

            {/* 4. ATHLETIC HEAD & AERODYNAMIC VISOR */}
            {/* Cranium halo glow */}
            <circle cx="50" cy="16" r="8" fill={neonPrimary} opacity="0.35" />
            {/* Cranium */}
            <circle cx="50" cy="16" r="6.4" fill="url(#cyberBodyGrad)" stroke="#ffffff" strokeWidth="1.4" />
            {/* Forward Focus Visor Lens Flare */}
            <polygon points="52,14 61,17 52,19" fill={neonPrimary} />
            <line x1="53" y1="16.5" x2="65" y2="16.5" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
            <circle cx="50" cy="16" r="2.2" fill="#ffffff" />

            {/* 5. LUMINOUS STAR CORE / ENERGY NODE (IMAGE 2) */}
            <g style={{ transformOrigin: '46px 32px', animation: 'vl-core-pulse 0.4s infinite ease-in-out' }}>
              {/* Radial Starburst Aura */}
              <circle cx="46" cy="32" r="7" fill="url(#starCoreAura)" />
              {/* 4-Point Star Core Flare */}
              <polygon points="46,25 47.5,30.5 53,32 47.5,33.5 46,39 44.5,33.5 39,32 44.5,30.5" fill="#ffffff" />
              {/* Brilliant Center Node */}
              <circle cx="46" cy="32" r="2.2" fill="#ffffff" />
            </g>

            {/* 6. FRONT LEAD LEG (HIGH KNEE POWER DRIVE - IMAGE 4) */}
            <g
              style={{
                transformOrigin: '40px 45px',
                animation: isMoving
                  ? `vl-cyber-leg-front ${strideDuration}s infinite ease-in-out`
                  : 'none',
              }}
            >
              {/* High Knee Glow Aura */}
              <line x1="40" y1="45" x2="55" y2="50" stroke={neonPrimary} strokeWidth="10" strokeLinecap="round" opacity="0.35" />
              <line x1="55" y1="50" x2="50" y2="66" stroke={neonPrimary} strokeWidth="8.5" strokeLinecap="round" opacity="0.35" />
              {/* Driving Thigh (Quadricep power) */}
              <line x1="40" y1="45" x2="55" y2="50" stroke="url(#cyberLimbGrad)" strokeWidth="7.5" strokeLinecap="round" />
              {/* Lower leg striking down to track */}
              <line x1="55" y1="50" x2="50" y2="66" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" />
              {/* Sprinting spike toe */}
              <line x1="50" y1="66" x2="57" y2="68" stroke={neonPrimary} strokeWidth="4.5" strokeLinecap="round" />
              {/* Constellation joint nodes */}
              <circle cx="55" cy="50" r="3.2" fill="#ffffff" />
              <circle cx="50" cy="66" r="2.4" fill={neonPrimary} />
              <circle cx="57" cy="68" r="1.8" fill="#ffffff" />
            </g>

            {/* 7. FRONT LEAD ARM (PUMPING HIGH TO CHEEK) */}
            <g
              style={{
                transformOrigin: '44px 28px',
                animation: isMoving
                  ? `vl-cyber-arm-front ${strideDuration}s infinite ease-in-out`
                  : 'none',
              }}
            >
              {/* Arm glow aura */}
              <line x1="44" y1="28" x2="57" y2="35" stroke={neonPrimary} strokeWidth="9" strokeLinecap="round" opacity="0.35" />
              <line x1="57" y1="35" x2="66" y2="25" stroke={neonPrimary} strokeWidth="7.5" strokeLinecap="round" opacity="0.35" />
              {/* Upper arm driving forward */}
              <line x1="44" y1="28" x2="57" y2="35" stroke="url(#cyberLimbGrad)" strokeWidth="6.5" strokeLinecap="round" />
              {/* Forearm angled up to cheek */}
              <line x1="57" y1="35" x2="66" y2="25" stroke="#ffffff" strokeWidth="5.2" strokeLinecap="round" />
              {/* Clenched Fist */}
              <circle cx="66" cy="25" r="3" fill={neonPrimary} />
              <circle cx="66" cy="25" r="1.5" fill="#ffffff" />
              {/* Elbow joint node */}
              <circle cx="57" cy="35" r="2.8" fill="#ffffff" />
            </g>
          </g>
        </svg>

        {/* BEAM-BREAK SHOCKWAVE BURST (When crossing physical finish gate) */}
        {(phase === 'BEAM_BREAK_BURST' || phase === 'FINISHED') && (
          <div
            style={{
              position: 'absolute',
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              border: `3px solid ${neonPrimary}`,
              boxShadow: `0 0 35px ${neonPrimary}`,
              animation: 'vl-burst-shockwave 0.5s ease-out forwards',
            }}
          />
        )}
      </div>
    </div>
  );
};

/**
 * REUSABLE CYBER ATHLETE SVG GROUP
 * Renders directly inside any SVG canvas (Field Radar, Mass Sprint, RSA, etc.)
 */
export const CyberAthleteSVG = ({
  x = 0,
  y = 0,
  dir = 1,
  scale = 0.5,
  variant = 'live',
  isMoving = false,
  strideDuration = 0.28,
  lean = 22,
  label = '',
}) => {
  const isLive = variant === 'live';
  const neonPrimary = isLive ? '#00f5ff' : variant === 'amber' ? '#f59e0b' : '#c084fc';
  const neonSecondary = isLive ? '#38bdf8' : variant === 'amber' ? '#fbbf24' : '#a855f7';
  const neonGlow = isLive ? '#00d084' : variant === 'amber' ? '#fbbf24' : '#818cf8';

  const badgeWidth = label ? Math.max(54, label.length * 6.5 + 16) : 0;

  return (
    <g transform={`translate(${x}, ${y})`} className="pointer-events-none select-none">
      {/* Floating Telemetry Badge in SVG space */}
      {label && (
        <g transform="translate(0, -32)">
          <rect
            x={-badgeWidth / 2}
            y="-9"
            width={badgeWidth}
            height="18"
            rx="5"
            fill={isLive ? 'rgba(3, 20, 36, 0.94)' : 'rgba(26, 12, 46, 0.94)'}
            stroke={neonPrimary}
            strokeWidth="1.2"
          />
          <text
            x="0"
            y="3.5"
            fill="#ffffff"
            fontSize="8.5"
            fontWeight="bold"
            fontFamily="ui-monospace, monospace"
            textAnchor="middle"
            letterSpacing="0.04em"
          >
            {label}
          </text>
        </g>
      )}

      {/* Runner Scaled Graphic */}
      <g transform={`scale(${scale})`}>
        {/* Flip direction: dir = 1 (facing right) or -1 (facing left) */}
        <g transform={`scale(${dir}, 1)`}>
          {/* Horizontal Speed Scanlines (Matching Image 3) */}
          {isMoving && (
            <g opacity="0.85">
              <line x1="-55" y1="-8" x2="10" y2="-8" stroke={neonPrimary} strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
              <line x1="-70" y1="2" x2="8" y2="2" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" opacity="0.95" />
              <line x1="-48" y1="12" x2="12" y2="12" stroke={neonSecondary} strokeWidth="2.5" strokeLinecap="round" opacity="0.75" />
              <line x1="-60" y1="22" x2="6" y2="22" stroke={neonPrimary} strokeWidth="2" strokeLinecap="round" opacity="0.85" />
              {/* Speed wake particles (Matching Image 2) */}
              <circle cx="-38" cy="-5" r="2.2" fill="#ffffff" opacity="0.9" />
              <circle cx="-52" cy="8" r="2.4" fill={neonPrimary} opacity="0.85" />
              <circle cx="-30" cy="18" r="1.8" fill={neonGlow} opacity="0.8" />
            </g>
          )}

          {/* Group with Forward Sprint Lean */}
          <g transform={`rotate(${lean}, 0, 0)`}>
            {/* Back Arm */}
            <g style={{ transformOrigin: '0px -10px', animation: isMoving ? `vl-cyber-arm-back ${strideDuration}s infinite ease-in-out` : 'none' }}>
              <line x1="0" y1="-10" x2="-14" y2="0" stroke={neonPrimary} strokeWidth="5.5" strokeLinecap="round" opacity="0.8" />
              <line x1="-14" y1="0" x2="-6" y2="12" stroke="#ffffff" strokeWidth="4.5" strokeLinecap="round" opacity="0.9" />
              <circle cx="-14" cy="0" r="2.2" fill="#ffffff" />
            </g>

            {/* Back Leg */}
            <g style={{ transformOrigin: '-4px 6px', animation: isMoving ? `vl-cyber-leg-back ${strideDuration}s infinite ease-in-out` : 'none' }}>
              <line x1="-4" y1="6" x2="-16" y2="18" stroke={neonPrimary} strokeWidth="6.5" strokeLinecap="round" opacity="0.8" />
              <line x1="-16" y1="18" x2="-26" y2="28" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" opacity="0.9" />
              <line x1="-26" y1="28" x2="-32" y2="30" stroke={neonPrimary} strokeWidth="4" strokeLinecap="round" />
              <circle cx="-16" cy="18" r="2.5" fill="#ffffff" />
              <circle cx="-26" cy="28" r="2" fill={neonPrimary} />
            </g>

            {/* Torso & Core */}
            <path
              d="M 2 -14 C 8 -13, 11 -8, 9 0 C 6 8, 0 11, -5 9 C -10 6, -8 -7, -5 -12 Z"
              fill={neonSecondary}
              stroke="#ffffff"
              strokeWidth="1.3"
            />
            {/* Scanlines across chest */}
            <line x1="-4" y1="-8" x2="6" y2="-8" stroke="#ffffff" strokeWidth="1" opacity="0.8" />
            <line x1="-5" y1="-3" x2="7" y2="-3" stroke={neonPrimary} strokeWidth="1.2" />
            <line x1="-6" y1="2" x2="4" y2="2" stroke="#ffffff" strokeWidth="1" opacity="0.8" />

            {/* Head & Visor Flare */}
            <circle cx="6" cy="-22" r="6" fill={neonSecondary} stroke="#ffffff" strokeWidth="1.2" />
            <polygon points="8,-24 16,-22 8,-20" fill={neonPrimary} />
            <line x1="9" y1="-22" x2="19" y2="-22" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="6" cy="-22" r="2" fill="#ffffff" />

            {/* Luminous Core Star (Matching Image 2) */}
            <circle cx="2" cy="-6" r="6" fill={neonPrimary} opacity="0.4" />
            <polygon points="2,-11 3.5,-7 8,-6 3.5,-5 2,-1 0.5,-5 -4,-6 0.5,-7" fill="#ffffff" />
            <circle cx="2" cy="-6" r="2" fill="#ffffff" />

            {/* Front Lead Leg */}
            <g style={{ transformOrigin: '-4px 6px', animation: isMoving ? `vl-cyber-leg-front ${strideDuration}s infinite ease-in-out` : 'none' }}>
              <line x1="-4" y1="6" x2="10" y2="12" stroke={neonSecondary} strokeWidth="7" strokeLinecap="round" />
              <line x1="10" y1="12" x2="6" y2="28" stroke="#ffffff" strokeWidth="5.5" strokeLinecap="round" />
              <line x1="6" y1="28" x2="13" y2="30" stroke={neonPrimary} strokeWidth="4.2" strokeLinecap="round" />
              <circle cx="10" cy="12" r="3" fill="#ffffff" />
              <circle cx="6" cy="28" r="2.2" fill={neonPrimary} />
            </g>

            {/* Front Lead Arm */}
            <g style={{ transformOrigin: '0px -10px', animation: isMoving ? `vl-cyber-arm-front ${strideDuration}s infinite ease-in-out` : 'none' }}>
              <line x1="0" y1="-10" x2="13" y2="-3" stroke={neonSecondary} strokeWidth="6" strokeLinecap="round" />
              <line x1="13" y1="-3" x2="20" y2="-12" stroke="#ffffff" strokeWidth="4.8" strokeLinecap="round" />
              <circle cx="20" cy="-12" r="2.6" fill={neonPrimary} />
              <circle cx="13" cy="-3" r="2.4" fill="#ffffff" />
            </g>
          </g>
        </g>
      </g>
    </g>
  );
};

export default VirtualSprinter;
