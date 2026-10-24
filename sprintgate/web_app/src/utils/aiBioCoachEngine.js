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

/**
 * aiBioCoachEngine.js
 * Automated Sprint Biomechanical Coaching & Flaw Detection Engine
 * 
 * Implements scientific track & field kinematic models (Weyand, Morin, Mann, World Athletics)
 * to detect:
 * 1. Overstriding & Touchdown Braking Forces
 * 2. Excessive Backside Heel Recovery ("Butt-Kicking")
 * 3. Premature Torso Uprighting in Acceleration Drive Phase
 * 4. Bilateral Asymmetry & Hamstring Strain Injury Risk
 * 5. Actionable Coach & Athlete Verbal Cue Synthesis
 */

/**
 * Determine runner travel direction from hip trajectory
 * @param {Array} data - poseGraphData frames
 * @returns {'LTR' | 'RTL' | 'STATIONARY'} - Left-to-Right or Right-to-Left
 */
export function detectRunDirection(data) {
  if (!data || data.length < 5) return 'LTR';
  const startHipX = data.slice(0, 5).reduce((acc, d) => acc + (d.hipX || 0), 0) / 5;
  const endHipX = data.slice(-5).reduce((acc, d) => acc + (d.hipX || 0), 0) / 5;
  const deltaX = endHipX - startHipX;
  if (Math.abs(deltaX) < 20) return 'LTR'; // default to LTR if stationary/ambiguous
  return deltaX > 0 ? 'LTR' : 'RTL';
}

/**
 * Detect Overstriding & Touchdown Braking Flaws
 * Overstriding occurs when the foot touches down ahead of the Center of Mass (CoM)
 * with a positive/backward shin angle (> +10 deg), inducing horizontal braking impulses.
 */
export function detectOverstriding(poseData, strideKinetics, pxToMeters = 0.002) {
  if (!poseData || poseData.length < 15 || !strideKinetics?.allContacts) {
    return { flaws: [], count: 0, avgBrakingOffsetCm: 0, severity: 'none' };
  }

  const direction = detectRunDirection(poseData);
  const contacts = strideKinetics.allContacts || [];
  const flaws = [];

  contacts.forEach((contact, idx) => {
    // Find pose frame closest to initial ground touchdown
    const frame = poseData.find(d => Math.abs(d.time - contact.start) < 0.04) ||
                  poseData.find(d => Math.abs(d.time - contact.start) < 0.08);

    if (!frame || frame.hipX === undefined) return;

    const foot = contact.foot; // 'L' or 'R'
    const footX = foot === 'L' ? (frame.lFootX || frame.hipX) : (frame.rFootX || frame.hipX);
    const hipX = frame.hipX;

    // Horizontal offset of foot relative to Center of Mass (Hip X)
    // For LTR: foot landing ahead means footX > hipX
    // For RTL: foot landing ahead means footX < hipX
    const deltaXRaw = direction === 'LTR' ? (footX - hipX) : (hipX - footX);
    const deltaXCm = deltaXRaw * (pxToMeters || 0.002) * 100;

    // Touchdown Shin Angle (relative to vertical)
    const shinAngle = foot === 'L' ? (frame.lShin || frame.shin || 0) : (frame.rShin || frame.shin || 0);

    // Flaw Threshold: Foot lands > 5cm ahead of CoM AND Shin Angle > +8° (touchdown braking)
    if (deltaXCm > 5 && shinAngle > 8) {
      const isSevere = deltaXCm > 15 || shinAngle > 15;
      const brakingPenaltyMs = Math.round(Math.max(5, (deltaXCm - 5) * 2.8)); // Est. milliseconds lost per overstride

      flaws.push({
        id: `overstride_${idx}_${contact.start.toFixed(2)}`,
        type: 'overstride',
        title: 'Overstride Braking Contact',
        foot,
        time: parseFloat(contact.start.toFixed(2)),
        timeFormatted: `${contact.start.toFixed(2)}s`,
        stepNum: idx + 1,
        offsetCm: Math.round(deltaXCm),
        shinAngle: Math.round(shinAngle),
        severity: isSevere ? 'high' : 'medium',
        gctMs: Math.round(contact.duration * 1000),
        brakingPenaltyMs,
        description: `${foot === 'L' ? 'Left' : 'Right'} foot landed ${Math.round(deltaXCm)}cm ahead of Center of Mass with ${Math.round(shinAngle)}° shin angle. Creates active deceleration braking.`,
        cue: 'Strike backward under your hips! Think "claw-back" to contact the track directly below your center of mass.'
      });
    }
  });

  const avgOffset = flaws.length > 0 
    ? Math.round(flaws.reduce((acc, f) => acc + f.offsetCm, 0) / flaws.length) 
    : 0;

  return {
    flaws,
    count: flaws.length,
    avgBrakingOffsetCm: avgOffset,
    severity: flaws.length === 0 ? 'optimal' : flaws.some(f => f.severity === 'high') ? 'high' : 'medium'
  };
}

/**
 * Detect Excessive Backside Heel Recovery ("Butt-Kicking")
 * Occurs when the knee flexion angle exceeds 140° posterior to the hip during swing phase
 * instead of cycling forward tightly over the opposite knee into frontside mechanics.
 */
export function detectExcessiveBacksideRecovery(poseData) {
  if (!poseData || poseData.length < 15) {
    return { flaws: [], count: 0, peakBacksideAngle: 0, severity: 'none' };
  }

  const direction = detectRunDirection(poseData);
  const flaws = [];
  let lastFlawTime = -1;

  poseData.forEach((frame) => {
    // Check both left and right legs
    const legs = [
      { side: 'L', kneeAngle: frame.lKnee || frame.knee, footX: frame.lFootX },
      { side: 'R', kneeAngle: frame.rKnee || frame.knee, footX: frame.rFootX }
    ];

    legs.forEach(leg => {
      if (!leg.kneeAngle || leg.footX === undefined || frame.hipX === undefined) return;

      // Leg is posterior to hip (behind the runner's torso)
      const isBehindHip = direction === 'LTR' ? (leg.footX < frame.hipX - 15) : (leg.footX > frame.hipX + 15);

      // Flaw Threshold: Knee flexion angle > 140° while behind the hip
      if (isBehindHip && leg.kneeAngle > 140) {
        // Debounce: allow only 1 flag every 0.25 seconds per side to avoid flooding
        if (frame.time - lastFlawTime > 0.22) {
          lastFlawTime = frame.time;
          const isSevere = leg.kneeAngle > 155;

          flaws.push({
            id: `backside_${leg.side}_${frame.time.toFixed(2)}`,
            type: 'excessive_backside',
            title: 'Excessive Backside Recovery ("Butt-Kicking")',
            foot: leg.side,
            time: parseFloat(frame.time.toFixed(2)),
            timeFormatted: `${frame.time.toFixed(2)}s`,
            kneeAngle: Math.round(leg.kneeAngle),
            severity: isSevere ? 'high' : 'medium',
            wastedSwingTimeMs: Math.round((leg.kneeAngle - 135) * 1.8),
            description: `${leg.side === 'L' ? 'Left' : 'Right'} knee flexed to ${Math.round(leg.kneeAngle)}° behind the hip. Heel casts upward toward glutes rather than cycling tightly forward.`,
            cue: 'Step over the opposite knee! Pull your toe up immediately at toe-off and punch the knee forward.'
          });
        }
      }
    });
  });

  const peakAngle = flaws.length > 0 
    ? Math.max(...flaws.map(f => f.kneeAngle)) 
    : 0;

  return {
    flaws,
    count: flaws.length,
    maxFlexionDeg: peakAngle,
    peakBacksideAngle: peakAngle,
    severity: flaws.length === 0 ? 'optimal' : flaws.some(f => f.severity === 'high') ? 'high' : 'medium'
  };
}

/**
 * Detect Premature Torso Uprighting in Acceleration Drive Phase
 * Sprinters should maintain forward lean (25°-35°) during early acceleration (first 15-20m or first 1.5s).
 * "Popping upright" (< 10° forward lean) prematurely sacrifices horizontal propulsion.
 */
export function detectPrematureUprighting(poseData, strideKinetics) {
  if (!poseData || poseData.length < 15) {
    return { isPremature: false, flaws: [], minDriveLean: 0, severity: 'none' };
  }

  // Focus on the first 1.8 seconds (initial acceleration drive phase)
  const driveFrames = poseData.filter(d => d.time <= 1.8 && d.trunk && d.trunk > 0);
  if (driveFrames.length < 5) {
    return { isPremature: false, flaws: [], minDriveLean: 0, severity: 'none' };
  }

  const flaws = [];
  // Inspect trunk lean trend during the first 1.8s
  // Normal drive: trunk angle starts at 28-38° and slowly decreases to ~15-20° at 1.8s
  // Premature uprighting: trunk angle drops to < 10° before 1.5s
  const earlyUprightFrames = driveFrames.filter(d => d.time <= 1.5 && d.trunk < 11);

  if (earlyUprightFrames.length >= 3) {
    const firstUpright = earlyUprightFrames[0];
    const avgDriveLean = Math.round(driveFrames.reduce((a, b) => a + b.trunk, 0) / driveFrames.length);

    flaws.push({
      id: `premature_upright_${firstUpright.time.toFixed(2)}`,
      type: 'premature_uprighting',
      title: 'Premature Torso Uprighting (Loss of Drive)',
      time: parseFloat(firstUpright.time.toFixed(2)),
      timeFormatted: `${firstUpright.time.toFixed(2)}s`,
      trunkAngle: Math.round(firstUpright.trunk),
      avgDriveLean,
      severity: firstUpright.trunk < 6 ? 'high' : 'medium',
      description: `Torso uprighted prematurely to ${Math.round(firstUpright.trunk)}° at only ${firstUpright.time.toFixed(2)}s into sprint. Ideal drive phase retains 25°-35° forward lean through 15-20 meters.`,
      cue: 'Stay patient in the drive! Keep your eyes down and push the track away behind you; let your torso rise naturally 3° per stride.'
    });
  }

  const transitionTime = flaws.length > 0 ? flaws[0].time : null;

  return {
    isPremature: flaws.length > 0,
    flaws,
    count: flaws.length,
    transitionTime,
    minDriveLean: driveFrames.length > 0 ? Math.min(...driveFrames.map(d => d.trunk)) : 0,
    severity: flaws.length === 0 ? 'optimal' : flaws[0].severity
  };
}

/**
 * Calculate Bilateral Asymmetry & Hamstring Injury Risk Index
 * Compares Left vs Right Ground Contact Times (GCT), knee angles, and step lengths.
 * Asymmetry > 10% flags an elevated risk for eccentric hamstring strains.
 */
export function calculateAsymmetryIndex(strideKinetics, poseData) {
  if (!strideKinetics || strideKinetics.count < 2) {
    return {
      compositeAsymmetryPct: 0,
      gctAsymmetryPct: 0,
      kneeAsymmetryPct: 0,
      stepDistAsymmetryPct: 0,
      riskLevel: 'insufficient_data',
      riskTier: 'Insufficient Data',
      flaws: [],
      metrics: { leftGctMs: 0, rightGctMs: 0, leftKneeDeg: 0, rightKneeDeg: 0 }
    };
  }

  // 1. GCT Asymmetry
  const leftGct = parseFloat(strideKinetics.leftGct) || 0.12;
  const rightGct = parseFloat(strideKinetics.rightGct) || 0.12;
  const maxGct = Math.max(leftGct, rightGct);
  const gctAsymmetryPct = maxGct > 0 ? Math.round((Math.abs(leftGct - rightGct) / maxGct) * 100) : 0;

  // 2. Knee Angle Asymmetry during stance / swing
  let leftKneeAvg = 0;
  let rightKneeAvg = 0;
  if (poseData && poseData.length > 10) {
    const lKnees = poseData.filter(d => d.lKnee && d.lKnee > 40).map(d => d.lKnee);
    const rKnees = poseData.filter(d => d.rKnee && d.rKnee > 40).map(d => d.rKnee);
    leftKneeAvg = lKnees.length > 0 ? Math.round(lKnees.reduce((a, b) => a + b, 0) / lKnees.length) : 155;
    rightKneeAvg = rKnees.length > 0 ? Math.round(rKnees.reduce((a, b) => a + b, 0) / rKnees.length) : 155;
  }
  const maxKnee = Math.max(leftKneeAvg, rightKneeAvg);
  const kneeAsymmetryPct = maxKnee > 0 ? Math.round((Math.abs(leftKneeAvg - rightKneeAvg) / maxKnee) * 100) : 0;

  // 3. Step Length Asymmetry (from stepBreakdown)
  const breakdown = strideKinetics.stepBreakdown || [];
  const leftSteps = breakdown.filter(s => s.foot === 'L').map(s => parseFloat(s.stepDistM) || 1.6);
  const rightSteps = breakdown.filter(s => s.foot === 'R').map(s => parseFloat(s.stepDistM) || 1.6);
  const leftAvgDist = leftSteps.length > 0 ? leftSteps.reduce((a, b) => a + b, 0) / leftSteps.length : 1.6;
  const rightAvgDist = rightSteps.length > 0 ? rightSteps.reduce((a, b) => a + b, 0) / rightSteps.length : 1.6;
  const maxDist = Math.max(leftAvgDist, rightAvgDist);
  const stepDistAsymmetryPct = maxDist > 0 ? Math.round((Math.abs(leftAvgDist - rightAvgDist) / maxDist) * 100) : 0;

  // Weighted Composite Asymmetry Index (50% GCT, 25% Knee, 25% Step Length)
  const compositeAsymmetryPct = Math.round(
    gctAsymmetryPct * 0.50 + kneeAsymmetryPct * 0.25 + stepDistAsymmetryPct * 0.25
  );

  let riskTier = 'Elite Balance (< 5%)';
  let riskLevel = 'low'; // low, moderate, high

  if (compositeAsymmetryPct >= 11 || gctAsymmetryPct >= 12) {
    riskTier = 'High Injury Risk (≥ 10%)';
    riskLevel = 'high';
  } else if (compositeAsymmetryPct >= 6 || gctAsymmetryPct >= 7) {
    riskTier = 'Moderate Asymmetry (5–10%)';
    riskLevel = 'moderate';
  }

  const flaws = [];
  if (riskLevel === 'high' || riskLevel === 'moderate') {
    const longerSide = leftGct > rightGct ? 'Left' : 'Right';
    const shorterSide = leftGct > rightGct ? 'Right' : 'Left';
    const diffMs = Math.round(Math.abs(leftGct - rightGct) * 1000);

    flaws.push({
      id: `asymmetry_gct_${compositeAsymmetryPct}`,
      type: 'bilateral_asymmetry',
      title: `${riskLevel === 'high' ? 'High' : 'Moderate'} Bilateral Asymmetry Detected`,
      time: 0.5,
      timeFormatted: 'Run Average',
      asymmetryPct: compositeAsymmetryPct,
      gctAsymmetryPct,
      severity: riskLevel === 'high' ? 'high' : 'medium',
      description: `${longerSide} foot ground contact time is ${diffMs}ms longer than ${shorterSide} foot (${gctAsymmetryPct}% GCT difference). Unequal ground braking forces elevate eccentric hamstring strain risk.`,
      cue: `Target unilateral single-leg plyometrics (A-skips, bounds) to eliminate the ${diffMs}ms deficit on your ${longerSide} side.`
    });
  }

  return {
    compositeAsymmetryPct,
    gctAsymmetryPct,
    kneeAsymmetryPct,
    stepDistAsymmetryPct,
    riskLevel,
    riskTier,
    flaws,
    metrics: {
      leftGctMs: Math.round(leftGct * 1000),
      rightGctMs: Math.round(rightGct * 1000),
      leftKneeDeg: leftKneeAvg,
      rightKneeDeg: rightKneeAvg,
      leftDistM: leftAvgDist.toFixed(2),
      rightDistM: rightAvgDist.toFixed(2)
    }
  };
}

/**
 * Synthesize Prioritized Coaching Cues & Feedback Action Matrix
 */
export function generateActionableCoachingCues(flaws, strideKinetics) {
  const cues = [];

  // 1. Overstriding Cue
  const overstrideFlaw = flaws.find(f => f.type === 'overstride');
  if (overstrideFlaw) {
    cues.push({
      id: 'cue_overstride',
      priority: 'HIGH',
      category: 'Footstrike Mechanics',
      icon: 'AlertTriangle',
      title: 'Eliminate Overstride Braking',
      cue: 'Strike backward under your center-of-mass on touchdown! Pre-activate ankle dorsiflexion to land under hips, eliminating braking ground reaction forces.',
      drill: 'Ankle dribbles, wicket runs (spaced 1.4m - 1.8m), and wall-drive claw-backs.'
    });
  }

  // 2. Excessive Backside Recovery Cue
  const backsideFlaw = flaws.find(f => f.type === 'excessive_backside');
  if (backsideFlaw) {
    cues.push({
      id: 'cue_backside',
      priority: 'HIGH',
      category: 'Swing-Phase Cycling',
      icon: 'RefreshCw',
      title: 'Tighten Heel Recovery Path',
      cue: 'Step over the opposite knee! Drive the thigh forward immediately after toe-off rather than letting the heel swing upward behind the glutes.',
      drill: 'Straight-leg bounds, high-knee step-overs, and mini-hurdle frontside cycles.'
    });
  }

  // 3. Premature Uprighting Cue
  const uprightFlaw = flaws.find(f => f.type === 'premature_upright');
  if (uprightFlaw) {
    cues.push({
      id: 'cue_upright',
      priority: 'MEDIUM',
      category: 'Drive Phase Acceleration',
      icon: 'TrendingUp',
      title: 'Extend Forward Acceleration Drive',
      cue: 'Stay patient in the drive! Keep chin neutral, eyes 2m ahead on track, and push backward. Rise progressively 3° to 5° per step through 15–20m.',
      drill: 'Heavy sled pushes (20-30% bodyweight), wall accelerations, and head-down cone markers at 15m.'
    });
  }

  // 4. Bilateral Asymmetry Cue
  const asymmetryFlaw = flaws.find(f => f.type === 'bilateral_asymmetry');
  if (asymmetryFlaw) {
    cues.push({
      id: 'cue_asymmetry',
      priority: asymmetryFlaw.severity === 'high' ? 'CRITICAL' : 'MEDIUM',
      category: 'Bilateral Balance & Injury Prevention',
      icon: 'ShieldAlert',
      title: 'Correct Bilateral Ground Stiffness Imbalance',
      cue: asymmetryFlaw.cue,
      drill: 'Single-leg drop jumps, Nordic hamstring curls, and alternating unilateral bounding.'
    });
  }

  // 5. GCT Stiffness Optimization Cue (Universal Elite Goal)
  const avgGctSec = parseFloat(strideKinetics?.gct) || 0.12;
  const currentGctMs = Math.round(avgGctSec * 1000);
  if (currentGctMs > 105) {
    cues.push({
      id: 'cue_gct_stiffness',
      priority: 'OPTIMIZATION',
      category: 'Elastic Rebound Stiffness',
      icon: 'Zap',
      title: `Optimize GCT from ${currentGctMs}ms to <105ms`,
      cue: `Increase frontside ground stiffness to reduce ground contact time from ${currentGctMs}ms to elite target (<105ms). Minimal GCT maximizes elastic return.`,
      drill: 'Fast-contact pogo jumps, stiff-ankle hurdle hops, and depth jumps from 20cm box.'
    });
  }

  // If no major flaws detected, provide positive reinforcement
  if (cues.length === 0) {
    cues.push({
      id: 'cue_optimal',
      priority: 'MAINTENANCE',
      category: 'Elite Technique Maintenance',
      icon: 'CheckCircle2',
      title: 'Biomechanics Operating in Elite Corridor',
      cue: 'Stride kinematics, ground contact symmetry, and frontside cycle are within optimal elite benchmarks. Focus on relaxation and maximum turnover frequency.',
      drill: 'Flying 30m maximum velocity sprints and contrast sprint-assisted flys.'
    });
  }

  return cues;
}

/**
 * Main Master Analysis Coordinator
 * Executes all 4 biomechanical fault detectors and synthesizes score
 */
export function analyzeFullSprintBiomechanics(poseData, strideKinetics, pxToMeters = 0.002) {
  if (!poseData || poseData.length < 15) {
    return {
      score: 100,
      grade: 'A+',
      flawsCount: 0,
      allFlaws: [],
      overstrideResult: { flaws: [], count: 0, severity: 'optimal' },
      backsideResult: { flaws: [], count: 0, severity: 'optimal' },
      uprightResult: { flaws: [], count: 0, severity: 'optimal' },
      asymmetryResult: { compositeAsymmetryPct: 0, riskLevel: 'low', flaws: [] },
      coachingCues: []
    };
  }

  const overstrideResult = detectOverstriding(poseData, strideKinetics, pxToMeters);
  const backsideResult = detectExcessiveBacksideRecovery(poseData);
  const uprightResult = detectPrematureUprighting(poseData, strideKinetics);
  const asymmetryResult = calculateAsymmetryIndex(strideKinetics, poseData);

  // Consolidate all timestamped flaws and sort chronologically
  const allFlaws = [
    ...overstrideResult.flaws,
    ...backsideResult.flaws,
    ...uprightResult.flaws,
    ...asymmetryResult.flaws
  ].sort((a, b) => a.time - b.time);

  // Compute Overall Biomechanical Quality Score (Starts at 100, points deducted per flaw)
  let deductions = 0;
  deductions += overstrideResult.count * 8;
  deductions += backsideResult.count * 6;
  deductions += uprightResult.count * 10;
  if (asymmetryResult.riskLevel === 'high') deductions += 15;
  else if (asymmetryResult.riskLevel === 'moderate') deductions += 8;

  const score = Math.max(45, Math.min(100, 100 - deductions));

  let grade = 'A+';
  if (score < 60) grade = 'Needs Work';
  else if (score < 75) grade = 'Fair (C)';
  else if (score < 85) grade = 'Good (B)';
  else if (score < 94) grade = 'Superior (A)';
  else grade = 'Elite (A+)';

  const coachingCues = generateActionableCoachingCues(allFlaws, strideKinetics);

  return {
    score,
    grade,
    flawsCount: allFlaws.length,
    allFlaws,
    overstrideResult,
    backsideResult,
    uprightResult,
    asymmetryResult,
    coachingCues
  };
}
