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
 * Horizontal Force-Velocity-Power (F-v-P) Profiling Engine
 * Based on the validated biomechanical model by Samozino, Morin et al. (2016)
 * "A simple method for measuring power, force, velocity properties, and mechanical effectiveness in sprint running"
 */

// Air density at sea level and 20°C (kg/m^3)
const DEFAULT_AIR_DENSITY = 1.205;
const DRAG_COEFFICIENT = 0.9;
const GRAVITY = 9.81;

/**
 * Estimate runner's frontal surface area (Af) in m^2 using the Du Bois & Du Bois formula adapted for sprinters
 * @param {number} massKg Athlete mass in kilograms
 * @param {number} heightM Athlete height in meters
 * @returns {number} Frontal area in m^2
 */
export function calculateFrontalArea(massKg, heightM) {
  const m = Math.max(30, Math.min(160, massKg || 75));
  const h = Math.max(1.2, Math.min(2.3, heightM || 1.78));
  // Af = 0.2025 * mass^0.425 * height^0.725 * 0.266
  return 0.2025 * Math.pow(m, 0.425) * Math.pow(h, 0.725) * 0.266;
}

/**
 * Golden-Section 1D Optimization to fit exponential sprint model:
 * x(t) = vmax * (t - tau * (1 - exp(-t / tau)))
 * 
 * @param {Array<{ distance: number, time: number }>} splits Distance-time data points
 * @returns {{ vmax: number, tau: number, rSquared: number }}
 */
export function fitSprintExponentialModel(splits) {
  if (!splits || splits.length === 0) {
    return null;
  }

  // Filter valid split points with positive distance and time
  const points = splits
    .map(s => ({
      d: parseFloat(s.distance || s.meters || 0),
      t: parseFloat(s.time || s.splitTime || 0)
    }))
    .filter(p => p.d > 0 && p.t > 0)
    .sort((a, b) => a.d - b.d);

  if (points.length === 0) {
    return null;
  }

  // If only 1 split is provided (e.g., 40m in 4.90s), synthesize an initial 10m anchor based on sprint biomechanics
  if (points.length === 1) {
    const totalD = points[0].d;
    const totalT = points[0].t;
    // Standard initial 10m split takes approximately 37% of 40m sprint duration
    const anchorD = Math.min(10, totalD * 0.25);
    const anchorT = totalT * Math.pow(anchorD / totalD, 0.68);
    points.unshift({ d: anchorD, t: anchorT });
  }

  // Helper: given tau, analytically solve for optimal vmax via linear regression through origin
  const solveVmaxForTau = (tau) => {
    let num = 0;
    let den = 0;
    for (const p of points) {
      const f = p.t - tau * (1 - Math.exp(-p.t / tau));
      num += p.d * f;
      den += f * f;
    }
    return den > 0 ? Math.max(4.0, Math.min(14.0, num / den)) : 9.5;
  };

  // Residual sum of squares for a given tau
  const computeRss = (tau) => {
    const vm = solveVmaxForTau(tau);
    let rss = 0;
    for (const p of points) {
      const predD = vm * (p.t - tau * (1 - Math.exp(-p.t / tau)));
      rss += Math.pow(p.d - predD, 2);
    }
    return rss;
  };

  // Golden section search for optimal tau in range [0.35, 2.50]
  const phi = (1 + Math.sqrt(5)) / 2;
  const resphi = 2 - phi;

  let a = 0.35;
  let b = 2.50;
  let tol = 1e-4;

  let c = a + resphi * (b - a);
  let d = b - resphi * (b - a);
  let fc = computeRss(c);
  let fd = computeRss(d);

  for (let iter = 0; iter < 45; iter++) {
    if (Math.abs(b - a) < tol) break;
    if (fc < fd) {
      b = d;
      d = c;
      fd = fc;
      c = a + resphi * (b - a);
      fc = computeRss(c);
    } else {
      a = c;
      c = d;
      fc = fd;
      d = b - resphi * (b - a);
      fd = computeRss(d);
    }
  }

  const bestTau = (a + b) / 2;
  const bestVmax = solveVmaxForTau(bestTau);

  // Calculate R^2 coefficient of determination
  const meanD = points.reduce((sum, p) => sum + p.d, 0) / points.length;
  let ssTot = 0;
  let ssRes = 0;
  for (const p of points) {
    const pred = bestVmax * (p.t - bestTau * (1 - Math.exp(-p.t / bestTau)));
    ssTot += Math.pow(p.d - meanD, 2);
    ssRes += Math.pow(p.d - pred, 2);
  }
  const rSquared = ssTot > 0 ? Math.max(0, 1 - (ssRes / ssTot)) : 0.99;

  return {
    vmax: bestVmax,
    tau: bestTau,
    rSquared: parseFloat(rSquared.toFixed(3))
  };
}

/**
 * Compute the full Horizontal Force-Velocity-Power Profile
 * 
 * @param {Object} params
 * @param {Array<{ distance: number, time: number }>} params.splits Split times and distances
 * @param {number} params.mass Athlete body mass in kg (default: 75)
 * @param {number} params.height Athlete height in meters (default: 1.80)
 * @param {number} params.windSpeed Wind speed in m/s (positive for tailwind, negative for headwind)
 * @returns {Object} Complete F-v-P profile and diagnostic analysis
 */
export function calculateHorizontalFVP({
  splits = [],
  mass = 75,
  height = 1.80,
  windSpeed = 0
}) {
  const m = Math.max(35, Math.min(150, parseFloat(mass) || 75));
  const h = Math.max(1.3, Math.min(2.3, parseFloat(height) || 1.80));
  const w = parseFloat(windSpeed) || 0;

  // 1. Model fitting
  const modelFit = fitSprintExponentialModel(splits);
  if (!modelFit) return null;
  const { vmax, tau, rSquared } = modelFit;

  // 2. Aerodynamic properties
  const af = calculateFrontalArea(m, h);
  const aeroConst = 0.5 * DEFAULT_AIR_DENSITY * af * DRAG_COEFFICIENT;

  // 3. Compute continuous kinematics and kinetics over sprint acceleration (0s to 6s, 60 samples)
  const timeSteps = 60;
  const duration = Math.max(4.0, tau * 4.0);
  const dt = duration / timeSteps;

  const samplePoints = [];
  let sumV = 0, sumF = 0, sumVV = 0, sumVF = 0;

  for (let i = 0; i <= timeSteps; i++) {
    const t = i * dt;
    // Horizontal speed: v(t) = vmax * (1 - exp(-t / tau))
    const v = vmax * (1 - Math.exp(-t / tau));
    // Acceleration: a(t) = (vmax / tau) * exp(-t / tau)
    const a = (vmax / tau) * Math.exp(-t / tau);
    // Aerodynamic drag force: Faero = 0.5 * rho * Af * Cd * (v - w)^2
    const netAirSpeed = v - w;
    const faero = aeroConst * netAirSpeed * Math.abs(netAirSpeed);
    // Net horizontal ground reaction force: Fh = m * a + Faero
    const fh = m * a + faero;
    // Power: P = Fh * v
    const p = fh * v;

    samplePoints.push({ t, v, a, fh, p, dist: vmax * (t - tau * (1 - Math.exp(-t / tau))) });

    // Accumulate linear regression terms (F vs v)
    sumV += v;
    sumF += fh;
    sumVV += v * v;
    sumVF += v * fh;
  }

  // 4. Linear Regression: F(v) = F0 - Sfv * v
  const n = samplePoints.length;
  const den = (n * sumVV - sumV * sumV);
  const sfv = Math.abs(den) > 1e-6 ? (n * sumVF - sumV * sumF) / den : -0.85; // Slope (typically negative)
  const calcF0 = (sumF - sfv * sumV) / n; // Theoretical maximum force at v=0
  const absSfv = Math.max(0.01, Math.abs(sfv));

  // Theoretical maximum velocity (extrapolated intercept at F=0)
  const v0 = (isFinite(calcF0) && calcF0 > 0) ? Math.max(1.0, calcF0 / absSfv) : (vmax || 9.5);
  const f0 = isFinite(calcF0) && calcF0 > 0 ? calcF0 : Math.max(10.0, absSfv * v0);

  // Relative values normalized to body weight
  const f0Rel = f0 / m; // N/kg
  const sfvRel = absSfv / m; // N*s/(m*kg)

  // Theoretical maximum horizontal power: Pmax = (F0 * V0) / 4
  const pmax = (f0 * v0) / 4; // Watts
  const pmaxRel = pmax / m; // W/kg

  // Velocity at maximum power: V_Pmax = V0 / 2
  const vPmax = v0 / 2;
  // Force at maximum power: F_Pmax = F0 / 2
  const fPmax = f0 / 2;

  // 5. Ratio of Force (RF) & Technical Effectiveness
  // RF = Fh / Ftot where Ftot ~ sqrt(Fh^2 + Fv^2), with Fv ~ m * g
  // Peak RF at start
  const rfDenominator = Math.sqrt(Math.pow(f0, 2) + Math.pow(m * GRAVITY, 2));
  const rfPeak = rfDenominator > 0 ? (f0 / rfDenominator) * 100 : 50;
  // Decrease in RF per m/s of speed (Drf): indicator of technique maintenance during acceleration
  const drf = -(rfPeak / (v0 || 1)) * 0.92; // % per m/s

  // 6. Optimal Force-Velocity Profile & Imbalance (Samozino et al. 2016)
  // Sfv_opt = -0.85 * (F0 / V0) adapted to athlete acceleration duration
  const sfvOpt = -(f0Rel / (v0 || 1)) * 1.02; // Optimal theoretical slope
  const rawImbalance = ((-absSfv / m) / (sfvOpt || -1)) * 100;
  const fvImbalance = isFinite(rawImbalance) && !isNaN(rawImbalance) ? Math.max(0, Math.min(300, rawImbalance)) : 100; // 100% = perfectly balanced

  // Profile classification
  let profileType = "Well Balanced";
  let profileBadge = "bg-emerald-500/15 border-emerald-500/40 text-emerald-400";
  let deficitDescription = "Optimal balance between horizontal force production and top-end velocity capabilities.";
  let trainingPrescription = [
    { title: "Power Maintenance", detail: "Mixed-contrast training combining 15-20% body mass resisted sprints with unresisted sprints." },
    { title: "Elastic Stiffness", detail: "Multi-hop plyometrics and hurdle rebounds to maintain tendon reactive strength." }
  ];

  if (fvImbalance < 82) {
    profileType = "High Force Deficit";
    profileBadge = "bg-rose-500/20 border-rose-500/40 text-rose-300";
    deficitDescription = "Athlete struggles to express high horizontal force at low speed (first 10–15m drive phase).";
    trainingPrescription = [
      { title: "Heavy Resisted Sprints", detail: "Heavy sled pushes or pulls at 50%–70% velocity decrement (Vdec) to target horizontal force F0." },
      { title: "Horizontal Strength", detail: "Hip thrusts, Romanian deadlifts (RDLs), and broad jumps to develop posterior chain drive." },
      { title: "Drive Phase Mechanics", detail: "Low start angle block exits and aggressive knee-punch forward drive drills." }
    ];
  } else if (fvImbalance < 93) {
    profileType = "Moderate Force Deficit";
    profileBadge = "bg-amber-500/20 border-amber-500/40 text-amber-300";
    deficitDescription = "Slight horizontal force limitation out of the blocks compared to high-velocity sprinting capacity.";
    trainingPrescription = [
      { title: "Resisted Sled Pushes", detail: "Resisted sprints with 25%–35% velocity decrement over 15–20m." },
      { title: "Unilateral Drive", detail: "Step-ups, split squats, and explosive band-resisted sprint accelerations." }
    ];
  } else if (fvImbalance > 118) {
    profileType = "High Velocity Deficit";
    profileBadge = "bg-sky-500/20 border-sky-500/40 text-sky-300";
    deficitDescription = "Athlete has exceptional starting strength but plateaus early in top-end horizontal velocity V0.";
    trainingPrescription = [
      { title: "Flying 20m & 30m Sprints", detail: "Full speed flying sprints with 20m build-ups to maximize neuromuscular velocity ceiling." },
      { title: "Overspeed / Assisted Runs", detail: "Gentle 2% downhill or slight tow-cable overspeed sprinting." },
      { title: "Wicket Drills & Fast Cadence", detail: "Mini-hurdle wicket runs to shorten ground contact time (<0.10s) and optimize upright posture." }
    ];
  } else if (fvImbalance > 107) {
    profileType = "Moderate Velocity Deficit";
    profileBadge = "bg-cyan-500/20 border-cyan-500/40 text-cyan-300";
    deficitDescription = "Slight limitation in top-end velocity transfer after initial acceleration phase.";
    trainingPrescription = [
      { title: "Unresisted Max Velocity", detail: "Sprint-float-sprint intervals over 40–60m focusing on relaxed tall posture." },
      { title: "Ankle Reactive Stiffness", detail: "Straight-leg ankle bounds and depth drops from 30cm boxes." }
    ];
  }

  // Generate charting points for F-v and P-v curves
  const curvePoints = [];
  const numCurvePts = 25;
  for (let i = 0; i <= numCurvePts; i++) {
    const vCurr = (i / numCurvePts) * v0;
    const fCurr = Math.max(0, f0 - absSfv * vCurr);
    const pCurr = fCurr * vCurr;
    curvePoints.push({
      velocity: parseFloat(vCurr.toFixed(2)),
      force: parseFloat(fCurr.toFixed(1)),
      forceRel: parseFloat((fCurr / m).toFixed(2)),
      power: parseFloat(pCurr.toFixed(0)),
      powerRel: parseFloat((pCurr / m).toFixed(2))
    });
  }

  return {
    // Model parameters
    vmax: parseFloat(vmax.toFixed(2)),
    tau: parseFloat(tau.toFixed(3)),
    rSquared,
    
    // Theoretical limits
    f0: Math.round(f0), // N
    f0Rel: parseFloat(f0Rel.toFixed(2)), // N/kg
    v0: parseFloat(v0.toFixed(2)), // m/s
    v0Kmh: parseFloat((v0 * 3.6).toFixed(1)), // km/h
    pmax: Math.round(pmax), // W
    pmaxRel: parseFloat(pmaxRel.toFixed(1)), // W/kg
    sfv: parseFloat((-absSfv).toFixed(2)), // N*s/m
    sfvRel: parseFloat((-sfvRel).toFixed(2)), // N*s/(m*kg)
    
    // Mechanical efficiency
    rfPeak: parseFloat(rfPeak.toFixed(1)), // %
    drf: parseFloat(drf.toFixed(2)), // % per m/s
    
    // Profile imbalance & diagnostic
    fvImbalance: Math.round(fvImbalance),
    profileType,
    profileBadge,
    deficitDescription,
    trainingPrescription,
    
    // Interpolated curve points for rendering
    curvePoints,
    samplePoints: samplePoints.map(p => ({
      time: parseFloat(p.t.toFixed(2)),
      velocity: parseFloat(p.v.toFixed(2)),
      accel: parseFloat(p.a.toFixed(2)),
      forceRel: parseFloat((p.fh / m).toFixed(2)),
      powerRel: parseFloat((p.p / m).toFixed(1)),
      distance: parseFloat(p.dist.toFixed(1))
    }))
  };
}
