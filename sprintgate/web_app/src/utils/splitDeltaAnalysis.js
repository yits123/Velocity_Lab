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
 * Sprint Split Delta & Sector Telemetry Utilities
 * Compares athlete sector velocity, intermediate split times, and cumulative race gaps.
 */

export const SPLIT_DIST_MAP = {
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

// Preset Elite & Standard Benchmarks
export const PRESET_BENCHMARKS = {
  combine_elite: {
    id: 'combine_elite',
    name: 'Pro Combine Elite (4.40s / 40yd)',
    distance: 40,
    time: 4.40,
    checkpoints: [
      { distance: 10, time: 1.52, sectorTime: 1.52, velocity: 6.58, phase: 'Drive Phase' },
      { distance: 20, time: 2.54, sectorTime: 1.02, velocity: 9.80, phase: 'Transition' },
      { distance: 30, time: 3.48, sectorTime: 0.94, velocity: 10.64, phase: 'Max Velocity' },
      { distance: 40, time: 4.40, sectorTime: 0.92, velocity: 10.87, phase: 'Maintenance' }
    ]
  },
  world_championship_100m_model: {
    id: 'world_championship_100m_model',
    name: 'World Championship 100m Model (Sub-10s Pace)',
    distance: 40,
    time: 4.62,
    checkpoints: [
      { distance: 10, time: 1.70, sectorTime: 1.70, velocity: 5.88, phase: 'Drive Phase' },
      { distance: 20, time: 2.72, sectorTime: 1.02, velocity: 9.80, phase: 'Transition' },
      { distance: 30, time: 3.68, sectorTime: 0.96, velocity: 10.42, phase: 'Max Velocity' },
      { distance: 40, time: 4.62, sectorTime: 0.94, velocity: 10.64, phase: 'Maintenance' }
    ]
  },
  collegiate_target: {
    id: 'collegiate_target',
    name: 'Collegiate Division I Target (4.72s / 40m)',
    distance: 40,
    time: 4.72,
    checkpoints: [
      { distance: 10, time: 1.75, sectorTime: 1.75, velocity: 5.71, phase: 'Drive Phase' },
      { distance: 20, time: 2.83, sectorTime: 1.08, velocity: 9.26, phase: 'Transition' },
      { distance: 30, time: 3.80, sectorTime: 0.97, velocity: 10.31, phase: 'Max Velocity' },
      { distance: 40, time: 4.72, sectorTime: 0.92, velocity: 10.87, phase: 'Maintenance' }
    ]
  },
  high_school_varsity: {
    id: 'high_school_varsity',
    name: 'High School Varsity Target (5.10s / 40m)',
    distance: 40,
    time: 5.10,
    testType: 'sprint',
    checkpoints: [
      { distance: 10, time: 1.90, sectorTime: 1.90, velocity: 5.26, phase: 'Drive Phase' },
      { distance: 20, time: 3.05, sectorTime: 1.15, velocity: 8.70, phase: 'Transition' },
      { distance: 30, time: 4.10, sectorTime: 1.05, velocity: 9.52, phase: 'Max Velocity' },
      { distance: 40, time: 5.10, sectorTime: 1.00, velocity: 10.00, phase: 'Maintenance' }
    ]
  },
  pro_agility_combine_elite: {
    id: 'pro_agility_combine_elite',
    name: 'Pro Combine Elite Agility (3.85s / 5-10-5)',
    distance: 20,
    time: 3.85,
    testType: 'pro_agility',
    checkpoints: [
      { distance: 5, time: 1.38, sectorTime: 1.38, velocity: 3.62, phase: 'Initial Burst & Turn 1', phaseCode: 'LAT_BURST', phaseDesc: '5yd lateral acceleration & right plant' },
      { distance: 15, time: 3.10, sectorTime: 1.72, velocity: 5.81, phase: '10yd Crossover & Turn 2', phaseCode: 'CROSSOVER', phaseDesc: '10yd full crossover sprint & left plant' },
      { distance: 20, time: 3.85, sectorTime: 0.75, velocity: 6.67, phase: 'Return Sprint to Gate', phaseCode: 'RETURN_SPRINT', phaseDesc: '5yd explosive finish through center beam' }
    ]
  },
  pro_agility_d1: {
    id: 'pro_agility_d1',
    name: 'Collegiate Division I Agility (4.15s / 5-10-5)',
    distance: 20,
    time: 4.15,
    testType: 'pro_agility',
    checkpoints: [
      { distance: 5, time: 1.48, sectorTime: 1.48, velocity: 3.38, phase: 'Initial Burst & Turn 1', phaseCode: 'LAT_BURST', phaseDesc: '5yd lateral acceleration & right plant' },
      { distance: 15, time: 3.33, sectorTime: 1.85, velocity: 5.41, phase: '10yd Crossover & Turn 2', phaseCode: 'CROSSOVER', phaseDesc: '10yd full crossover sprint & left plant' },
      { distance: 20, time: 4.15, sectorTime: 0.82, velocity: 6.10, phase: 'Return Sprint to Gate', phaseCode: 'RETURN_SPRINT', phaseDesc: '5yd explosive finish through center beam' }
    ]
  },
  l_drill_combine_elite: {
    id: 'l_drill_combine_elite',
    name: 'Pro Combine Elite 3-Cone L-Drill (6.70s)',
    distance: 30,
    time: 6.70,
    testType: 'l_drill',
    checkpoints: [
      { distance: 10, time: 2.15, sectorTime: 2.15, velocity: 4.65, phase: 'Sprint-Out & Reversal', phaseCode: 'TOUCH_REV', phaseDesc: '5yd sprint to Cone 2, line touch & 5yd return to Cone 1' },
      { distance: 20, time: 4.60, sectorTime: 2.45, velocity: 4.08, phase: 'Cone 3 Cornering Loop', phaseCode: 'CORNER_LOOP', phaseDesc: 'Sprint to Cone 2 and sweeping loop around Cone 3' },
      { distance: 30, time: 6.70, sectorTime: 2.10, velocity: 4.76, phase: '90° Cut & Gate Sprint', phaseCode: 'INSIDE_CUT', phaseDesc: 'Tight inside 90° corner cut around Cone 2 and finish sprint' }
    ]
  },
  l_drill_d1: {
    id: 'l_drill_d1',
    name: 'Collegiate Division I 3-Cone L-Drill (7.10s)',
    distance: 30,
    time: 7.10,
    testType: 'l_drill',
    checkpoints: [
      { distance: 10, time: 2.30, sectorTime: 2.30, velocity: 4.35, phase: 'Sprint-Out & Reversal', phaseCode: 'TOUCH_REV', phaseDesc: '5yd sprint to Cone 2, line touch & 5yd return to Cone 1' },
      { distance: 20, time: 4.90, sectorTime: 2.60, velocity: 3.85, phase: 'Cone 3 Cornering Loop', phaseCode: 'CORNER_LOOP', phaseDesc: 'Sprint to Cone 2 and sweeping loop around Cone 3' },
      { distance: 30, time: 7.10, sectorTime: 2.20, velocity: 4.55, phase: '90° Cut & Gate Sprint', phaseCode: 'INSIDE_CUT', phaseDesc: 'Tight inside 90° corner cut around Cone 2 and finish sprint' }
    ]
  }
};

// Backward-compatibility aliases
PRESET_BENCHMARKS.olympic_100m_model = PRESET_BENCHMARKS.world_championship_100m_model;
export const STANDARD_BENCHMARKS = PRESET_BENCHMARKS;

/**
 * Standard sprint and agility biomechanical phase descriptors
 */
export const getBiomechanicalPhase = (startDist, endDist, testType = 'sprint') => {
  if (testType === 'pro_agility') {
    if (endDist <= 5) return { name: 'Initial Burst & Turn 1', code: 'LAT_BURST', desc: '5yd lateral acceleration & right plant' };
    if (endDist <= 15) return { name: '10yd Crossover & Turn 2', code: 'CROSSOVER', desc: '10yd crossover sprint & left plant' };
    return { name: 'Return Sprint to Gate', code: 'RETURN_SPRINT', desc: '5yd explosive finish through center beam' };
  }
  if (testType === 'l_drill') {
    if (endDist <= 10) return { name: 'Sprint-Out & Reversal', code: 'TOUCH_REV', desc: '5yd sprint to Cone 2, line touch & 5yd return to Cone 1' };
    if (endDist <= 20) return { name: 'Cone 3 Cornering Loop', code: 'CORNER_LOOP', desc: 'Sprint to Cone 2 and sweeping loop around Cone 3' };
    return { name: '90° Cut & Gate Sprint', code: 'INSIDE_CUT', desc: 'Tight inside 90° corner cut around Cone 2 and finish sprint' };
  }
  if (endDist <= 10) return { name: 'Drive Phase', code: 'DRIVE', desc: 'Horizontal impulse & low torso angle' };
  if (endDist <= 20) return { name: 'Transition Phase', code: 'TRANS', desc: 'Torso rise & ground contact rise' };
  if (endDist <= 30) return { name: 'Max Velocity Phase', code: 'MAX_V', desc: 'Peak upright speed & elasticity' };
  return { name: 'Speed Maintenance', code: 'MAINT', desc: 'Deceleration attenuation & stride stiffness' };
};

/**
 * Extract or reconstruct checkpoints [ { distance, time, sectorTime, velocity, phase } ]
 * for any given run object (supporting linear sprints, 5-10-5 Pro Agility, and 3-Cone L-Drill).
 */
export const extractCheckpoints = (run, totalDistance = 40) => {
  if (!run || !run.time || isNaN(parseFloat(run.time))) {
    return [];
  }

  if (run.checkpoints && Array.isArray(run.checkpoints) && run.checkpoints.length > 0) {
    return run.checkpoints;
  }

  const testType = run.testType || (run.distance && String(run.distance).toLowerCase().includes('agility') ? 'pro_agility' : (run.distance && String(run.distance).toLowerCase().includes('l-drill') ? 'l_drill' : 'sprint'));
  const runDist = parseFloat(run.distance) || (testType === 'pro_agility' ? 20 : testType === 'l_drill' ? 30 : totalDistance || 40);
  const runTotalTime = parseFloat(run.time);

  // A. Pro Agility (5-10-5) drill checkpoint extraction
  if (testType === 'pro_agility') {
    if (run.splits && Array.isArray(run.splits) && run.splits.length >= 3) {
      const legDistances = [5, 15, 20];
      const checkpoints = [];
      const times = [
        parseFloat(run.splits[0].time) || 0,
        parseFloat(run.splits[1].time) || 0,
        parseFloat(run.splits[2].time) || runTotalTime
      ];
      let prevD = 0;
      let prevT = 0;

      for (let i = 0; i < 3; i++) {
        const d = legDistances[i];
        const t = times[i];
        const sectorDist = d - prevD;
        const sectorTime = Math.max(0.01, t - prevT);
        const velocity = sectorDist / sectorTime;
        const phaseInfo = getBiomechanicalPhase(prevD, d, 'pro_agility');

        checkpoints.push({
          checkpointIndex: i + 1,
          distance: d,
          prevDistance: prevD,
          unit: 'yd',
          time: parseFloat(t.toFixed(3)),
          sectorDistance: sectorDist,
          sectorTime: parseFloat(sectorTime.toFixed(3)),
          velocity: parseFloat(velocity.toFixed(2)),
          velocityKmh: parseFloat((velocity * 3.6).toFixed(1)),
          velocityMph: parseFloat((velocity * 2.23694).toFixed(1)),
          phase: phaseInfo.name,
          phaseCode: phaseInfo.code,
          phaseDesc: phaseInfo.desc
        });
        prevD = d;
        prevT = t;
      }
      return checkpoints;
    }
    const avgVel = 20 / runTotalTime;
    return [{
      checkpointIndex: 1,
      distance: 20,
      prevDistance: 0,
      unit: 'yd',
      time: runTotalTime,
      sectorDistance: 20,
      sectorTime: runTotalTime,
      velocity: parseFloat(avgVel.toFixed(2)),
      velocityKmh: parseFloat((avgVel * 3.6).toFixed(1)),
      velocityMph: parseFloat((avgVel * 2.23694).toFixed(1)),
      phase: 'Full Pro Agility',
      phaseCode: 'FINISH',
      phaseDesc: '5-10-5 Shuttle Complete'
    }];
  }

  // B. 3-Cone L-Drill checkpoint extraction
  if (testType === 'l_drill') {
    if (run.splits && Array.isArray(run.splits) && run.splits.length >= 3) {
      const legDistances = [10, 20, 30];
      const checkpoints = [];
      const times = [
        parseFloat(run.splits[0].time) || 0,
        parseFloat(run.splits[1].time) || 0,
        parseFloat(run.splits[2].time) || runTotalTime
      ];
      let prevD = 0;
      let prevT = 0;

      for (let i = 0; i < 3; i++) {
        const d = legDistances[i];
        const t = times[i];
        const sectorDist = d - prevD;
        const sectorTime = Math.max(0.01, t - prevT);
        const velocity = sectorDist / sectorTime;
        const phaseInfo = getBiomechanicalPhase(prevD, d, 'l_drill');

        checkpoints.push({
          checkpointIndex: i + 1,
          distance: d,
          prevDistance: prevD,
          unit: 'yd',
          time: parseFloat(t.toFixed(3)),
          sectorDistance: sectorDist,
          sectorTime: parseFloat(sectorTime.toFixed(3)),
          velocity: parseFloat(velocity.toFixed(2)),
          velocityKmh: parseFloat((velocity * 3.6).toFixed(1)),
          velocityMph: parseFloat((velocity * 2.23694).toFixed(1)),
          phase: phaseInfo.name,
          phaseCode: phaseInfo.code,
          phaseDesc: phaseInfo.desc
        });
        prevD = d;
        prevT = t;
      }
      return checkpoints;
    }
    const avgVel = 30 / runTotalTime;
    return [{
      checkpointIndex: 1,
      distance: 30,
      prevDistance: 0,
      unit: 'yd',
      time: runTotalTime,
      sectorDistance: 30,
      sectorTime: runTotalTime,
      velocity: parseFloat(avgVel.toFixed(2)),
      velocityKmh: parseFloat((avgVel * 3.6).toFixed(1)),
      velocityMph: parseFloat((avgVel * 2.23694).toFixed(1)),
      phase: 'Full 3-Cone L-Drill',
      phaseCode: 'FINISH',
      phaseDesc: '30yd L-Drill Complete'
    }];
  }

  // C. Linear Sprints (10m - 40m)
  // 1. If run has recorded hardware gate splits
  if (run.splits && Array.isArray(run.splits) && run.splits.length > 0) {
    const rawSplits = run.splits
      .map(s => {
        let dist = s.distance;
        if (!dist && s.node !== undefined) {
          dist = SPLIT_DIST_MAP[s.node] || (parseInt(s.node) > 10 ? 10 : parseInt(s.node) * 10);
        }
        return {
          distance: parseFloat(dist) || 0,
          time: parseFloat(s.time) || 0
        };
      })
      .filter(s => s.distance > 0 && s.time > 0)
      .sort((a, b) => a.distance - b.distance);

    // Ensure final finish gate is included
    if (!rawSplits.some(s => Math.abs(s.distance - runDist) < 1.0)) {
      rawSplits.push({ distance: runDist, time: runTotalTime });
      rawSplits.sort((a, b) => a.distance - b.distance);
    }

    // Build checkpoints with sector times
    const checkpoints = [];
    let prevDist = 0;
    let prevTime = 0;

    for (let i = 0; i < rawSplits.length; i++) {
      const sp = rawSplits[i];
      if (sp.distance <= prevDist) continue;

      const sectorDist = sp.distance - prevDist;
      const sectorTime = Math.max(0.01, sp.time - prevTime);
      const velocity = sectorDist / sectorTime;
      const phaseInfo = getBiomechanicalPhase(prevDist, sp.distance, 'sprint');

      checkpoints.push({
        checkpointIndex: i + 1,
        distance: sp.distance,
        prevDistance: prevDist,
        unit: 'm',
        time: sp.time,
        sectorDistance: sectorDist,
        sectorTime: parseFloat(sectorTime.toFixed(3)),
        velocity: parseFloat(velocity.toFixed(2)),
        velocityKmh: parseFloat((velocity * 3.6).toFixed(1)),
        velocityMph: parseFloat((velocity * 2.23694).toFixed(1)),
        phase: phaseInfo.name,
        phaseCode: phaseInfo.code,
        phaseDesc: phaseInfo.desc
      });

      prevDist = sp.distance;
      prevTime = sp.time;
    }

    if (checkpoints.length > 0) return checkpoints;
  }

  // 2. If no intermediate splits were recorded, return single total-distance checkpoint (no fake split fabrication)
  const avgVel = runDist / runTotalTime;
  const phaseInfo = getBiomechanicalPhase(0, runDist, 'sprint');
  return [{
    checkpointIndex: 1,
    distance: Math.round(runDist),
    prevDistance: 0,
    unit: 'm',
    time: parseFloat(runTotalTime.toFixed(3)),
    sectorDistance: Math.round(runDist),
    sectorTime: parseFloat(runTotalTime.toFixed(3)),
    velocity: parseFloat(avgVel.toFixed(2)),
    velocityKmh: parseFloat((avgVel * 3.6).toFixed(1)),
    velocityMph: parseFloat((avgVel * 2.23694).toFixed(1)),
    phase: phaseInfo.name || 'Full Sprint',
    phaseCode: phaseInfo.code || 'FINISH',
    phaseDesc: phaseInfo.desc || `Full ${runDist}m recorded run`
  }];
};

/**
 * Computes sector gain/loss deltas between an athlete run and a benchmark run.
 */
export const computeSectorDeltas = (athleteRun, benchmarkRun) => {
  const athleteCP = extractCheckpoints(athleteRun);
  const benchmarkCP = extractCheckpoints(benchmarkRun);

  if (athleteCP.length === 0 || benchmarkCP.length === 0) {
    return {
      sectors: [],
      cumulativeDelta: 0,
      maxVelocityGain: 0,
      strongestSector: null,
      weakestSector: null
    };
  }

  // Align sectors by checkpoints
  const sectors = [];
  let cumDelta = 0;

  for (let i = 0; i < athleteCP.length; i++) {
    const aSec = athleteCP[i];
    // Find matching checkpoint by distance or index
    const bSec = benchmarkCP.find(b => Math.abs(b.distance - aSec.distance) <= 3) || benchmarkCP[i] || benchmarkCP[benchmarkCP.length - 1];

    if (!bSec) continue;

    const sectorTimeDelta = parseFloat((aSec.sectorTime - bSec.sectorTime).toFixed(3));
    const cumulativeTimeDelta = parseFloat((aSec.time - bSec.time).toFixed(3));
    const velocityDelta = parseFloat((aSec.velocity - bSec.velocity).toFixed(2));

    let tier = 'amber';
    if (sectorTimeDelta <= -0.05) {
      tier = 'purple';
    } else if (sectorTimeDelta < 0) {
      tier = 'green';
    } else if (sectorTimeDelta <= 0.04) {
      tier = 'amber';
    } else {
      tier = 'red';
    }

    const unit = aSec.unit || 'm';
    let sectorLabel = `${aSec.prevDistance}-${aSec.distance}${unit}`;
    if (aSec.phaseCode === 'LAT_BURST') sectorLabel = `0-5yd (Turn 1 Right)`;
    else if (aSec.phaseCode === 'CROSSOVER') sectorLabel = `5-15yd (Turn 2 Left)`;
    else if (aSec.phaseCode === 'RETURN_SPRINT') sectorLabel = `15-20yd (Finish Gate)`;
    else if (aSec.phaseCode === 'TOUCH_REV') sectorLabel = `0-10yd (Cone 2 Touch & Return)`;
    else if (aSec.phaseCode === 'CORNER_LOOP') sectorLabel = `10-20yd (Cone 3 Loop)`;
    else if (aSec.phaseCode === 'INSIDE_CUT') sectorLabel = `20-30yd (90° Cut & Gate)`;

    sectors.push({
      sectorIndex: i + 1,
      label: sectorLabel,
      startDist: aSec.prevDistance,
      endDist: aSec.distance,
      unit,
      phase: aSec.phase,
      phaseCode: aSec.phaseCode,
      athleteSectorTime: aSec.sectorTime,
      benchmarkSectorTime: bSec.sectorTime,
      athleteCumTime: aSec.time,
      benchmarkCumTime: bSec.time,
      sectorTimeDelta,
      cumulativeTimeDelta,
      athleteVelocity: aSec.velocity,
      benchmarkVelocity: bSec.velocity,
      velocityDelta,
      tier,
      isGain: sectorTimeDelta < 0,
      deltaFormatted: sectorTimeDelta <= 0 
        ? `${sectorTimeDelta.toFixed(3)}s` 
        : `+${sectorTimeDelta.toFixed(3)}s`
    });

    cumDelta = cumulativeTimeDelta;
  }

  const sortedByTimeDelta = [...sectors].sort((a, b) => a.sectorTimeDelta - b.sectorTimeDelta);
  const strongestSector = sortedByTimeDelta[0] || null;
  const weakestSector = sortedByTimeDelta[sortedByTimeDelta.length - 1] || null;
  const maxVelocityGain = sectors.length > 0 ? Math.max(...sectors.map(s => s.velocityDelta)) : 0;

  return {
    sectors,
    cumulativeDelta: cumDelta,
    maxVelocityGain,
    strongestSector,
    weakestSector
  };
};

/**
 * Generate sports science automated coaching diagnosis based on sector delta breakdown.
 */
export const generateSectorCoachingDiagnosis = (sectors, athleteName = 'Athlete', testType = 'sprint') => {
  if (!sectors || sectors.length === 0) return [];

  const notes = [];
  const s0 = sectors[0];
  const s1 = sectors[1];
  const s2 = sectors[2];
  const s3 = sectors[3];

  // A. Pro Agility (5-10-5) Diagnosis
  if (s0?.phaseCode === 'LAT_BURST' || s1?.phaseCode === 'CROSSOVER') {
    if (s0) {
      if (s0.sectorTimeDelta <= -0.03) {
        notes.push({
          sector: s0.label,
          type: 'strength',
          title: 'Explosive Lateral Start & Plant',
          message: `${athleteName} gained ${Math.abs(s0.sectorTimeDelta).toFixed(3)}s on the first 5-yard burst. Shows rapid hip drop and low ground contact plant at the right turn line.`
        });
      } else if (s0.sectorTimeDelta >= 0.04) {
        notes.push({
          sector: s0.label,
          type: 'improvement',
          title: 'First Turn Braking Overhead',
          message: `${athleteName} lost ${s0.sectorTimeDelta.toFixed(3)}s in Sector 1. Keep the center of mass lower off the line to reduce deceleration steps before the 5yd touch.`
        });
      } else {
        notes.push({
          sector: s0.label,
          type: 'neutral',
          title: 'Clean Initial Lateral Burst',
          message: `Sector 1 split was solid and matched elite baseline (${s0.deltaFormatted}).`
        });
      }
    }

    if (s1) {
      if (s1.sectorTimeDelta <= -0.04) {
        notes.push({
          sector: s1.label,
          type: 'strength',
          title: 'Dynamic 10-Yard Crossover Momentum',
          message: `Gained ${Math.abs(s1.sectorTimeDelta).toFixed(3)}s across the 10-yard change-of-direction. Tremendous rotational power and violent reverse plant into Turn 2.`
        });
      } else if (s1.sectorTimeDelta >= 0.05) {
        notes.push({
          sector: s1.label,
          type: 'improvement',
          title: 'Crossover Deceleration Deficit',
          message: `Conceded ${s1.sectorTimeDelta.toFixed(3)}s in Sector 2. Work on lateral crossovers and plyometric lateral bounds to sharpen braking and re-acceleration.`
        });
      }
    }

    if (s2) {
      if (s2.sectorTimeDelta <= -0.02) {
        notes.push({
          sector: s2.label,
          type: 'strength',
          title: 'Aggressive Return Sprint Through Gate',
          message: `Finished strong with a rapid ${s2.athleteSectorTime}s 5yd return, maintaining full drive through the timing gate.`
        });
      } else if (s2.sectorTimeDelta >= 0.04) {
        notes.push({
          sector: s2.label,
          type: 'improvement',
          title: 'Premature Finish Deceleration',
          message: `Lost ${s2.sectorTimeDelta.toFixed(3)}s on the final return sprint. Emphasize sprinting 2 yards past the center finish gate.`
        });
      }
    }

    return notes;
  }

  // B. 3-Cone L-Drill Diagnosis
  if (s0?.phaseCode === 'TOUCH_REV' || s1?.phaseCode === 'CORNER_LOOP') {
    if (s0) {
      if (s0.sectorTimeDelta <= -0.04) {
        notes.push({
          sector: s0.label,
          type: 'strength',
          title: 'Rapid Cone 2 Touch & Reversal',
          message: `${athleteName} shaved ${Math.abs(s0.sectorTimeDelta).toFixed(3)}s on the initial 5yd-and-back sector. Crisp low touch and zero slip reversal.`
        });
      } else if (s0.sectorTimeDelta >= 0.05) {
        notes.push({
          sector: s0.label,
          type: 'improvement',
          title: 'Reversal Plant Stutter',
          message: `Lost ${s0.sectorTimeDelta.toFixed(3)}s in Sector 1. Practice 2-step plant mechanics and shin drop at the Cone 2 touch line.`
        });
      }
    }

    if (s1) {
      if (s1.sectorTimeDelta <= -0.05) {
        notes.push({
          sector: s1.label,
          type: 'strength',
          title: 'Tight Centripetal Cornering Around Cone 3',
          message: `Outperformed benchmark by ${Math.abs(s1.sectorTimeDelta).toFixed(3)}s on the outer loop. Exceptional lateral tilt and inward cornering lean.`
        });
      } else if (s1.sectorTimeDelta >= 0.05) {
        notes.push({
          sector: s1.label,
          type: 'improvement',
          title: 'Wide Cornering Arc Deficit',
          message: `Conceded ${s1.sectorTimeDelta.toFixed(3)}s on the Cone 3 loop. Bowing outward adds unnecessary yardage; focus on ankle stiffness and tight cone hugging.`
        });
      }
    }

    if (s2) {
      if (s2.sectorTimeDelta <= -0.03) {
        notes.push({
          sector: s2.label,
          type: 'strength',
          title: 'Sharp 90° Inside Cut & Gate Launch',
          message: `Blistering final sector (${s2.athleteSectorTime}s). Seamless figure-8 redirection around Cone 2 into the finish gate.`
        });
      } else if (s2.sectorTimeDelta >= 0.04) {
        notes.push({
          sector: s2.label,
          type: 'improvement',
          title: 'Cut Re-acceleration Latency',
          message: `Lost ${s2.sectorTimeDelta.toFixed(3)}s exiting the 90° cut. Integrate 90-degree reactive cut-and-sprint drills to improve post-cut propulsion.`
        });
      }
    }

    return notes;
  }

  // C. Linear Sprint Standard Diagnosis
  if (s0) {
    if (s0.sectorTimeDelta <= -0.04) {
      notes.push({
        sector: s0.label,
        type: 'strength',
        title: 'Explosive Drive Phase & Projection',
        message: `${athleteName} gained ${Math.abs(s0.sectorTimeDelta).toFixed(3)}s in the first ${s0.label}. Demonstrates high horizontal force output and low projection angle off the line.`
      });
    } else if (s0.sectorTimeDelta >= 0.05) {
      notes.push({
        sector: s0.label,
        type: 'improvement',
        title: 'Drive Phase Latency / Premature Rise',
        message: `${athleteName} conceded ${s0.sectorTimeDelta.toFixed(3)}s in the ${s0.label} sector. Focus on shin angles, forward lean, and heavy sled pushes to build starting power.`
      });
    } else {
      notes.push({
        sector: s0.label,
        type: 'neutral',
        title: 'Solid Initial Drive',
        message: `Initial ${s0.label} block exit was on pace with baseline (${s0.deltaFormatted}).`
      });
    }
  }

  if (s1) {
    if (s1.sectorTimeDelta <= -0.03) {
      notes.push({
        sector: s1.label,
        type: 'strength',
        title: 'Smooth Acceleration Ramp',
        message: `Maintained positive acceleration through ${s1.label} with a velocity of ${s1.athleteVelocity} m/s (+${s1.velocityDelta} m/s vs benchmark).`
      });
    } else if (s1.sectorTimeDelta >= 0.04) {
      notes.push({
        sector: s1.label,
        type: 'improvement',
        title: 'Transition Phase Disruption',
        message: `Loss of ${s1.sectorTimeDelta.toFixed(3)}s between 10m and 20m indicates premature upright posture or overstriding.`
      });
    }
  }

  if (s2) {
    if (s2.athleteVelocity >= 9.8) {
      notes.push({
        sector: s2.label,
        type: 'strength',
        title: 'Elite Max Velocity Ceiling',
        message: `Reached peak fly speed of ${s2.athleteVelocity} m/s (${(s2.athleteVelocity * 3.6).toFixed(1)} km/h). High vertical stiffness and short ground contact times.`
      });
    } else if (s2.sectorTimeDelta >= 0.04) {
      notes.push({
        sector: s2.label,
        type: 'improvement',
        title: 'Top-End Velocity Deficit',
        message: `Conceded ${s2.sectorTimeDelta.toFixed(3)}s in the maximum speed sector. Integrate flying 20s and wicket sprints to elevate stride frequency.`
      });
    }
  }

  if (s3) {
    const vDrop = s2 ? (s2.athleteVelocity - s3.athleteVelocity) : 0;
    if (vDrop <= 0.2) {
      notes.push({
        sector: s3.label,
        type: 'strength',
        title: 'Superb Speed Endurance',
        message: `Maintained top velocity through the line with minimal speed decay (< ${vDrop.toFixed(2)} m/s drop-off).`
      });
    } else if (vDrop > 0.5 || s3.sectorTimeDelta >= 0.04) {
      notes.push({
        sector: s3.label,
        type: 'improvement',
        title: 'Late Sprint Deceleration',
        message: `Velocity declined by ${vDrop.toFixed(2)} m/s in the final 10m. Work on posture under fatigue and speed endurance reps (50-60m).`
      });
    }
  }

  return notes;
};
