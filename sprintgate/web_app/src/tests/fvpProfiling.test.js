/*
 * Copyright (C) 2026 Velocity Lab
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateFrontalArea,
  fitSprintExponentialModel,
  calculateHorizontalFVP
} from '../utils/fvpProfiling.js';

describe('Biomechanical F-v-P Engine: Frontal Area & Aerodynamics', () => {
  test('computes frontal surface area within physiological aerodynamic bounds', () => {
    // 75 kg, 1.80 m athlete
    const af = calculateFrontalArea(75, 1.80);
    assert.ok(af > 0.40, `Frontal area ${af} should be > 0.40 m^2`);
    assert.ok(af < 0.65, `Frontal area ${af} should be < 0.65 m^2`);
  });

  test('safely clamps extreme or missing height/weight inputs', () => {
    const afZero = calculateFrontalArea(0, 0);
    assert.ok(afZero > 0.30, 'Should clamp minimum mass/height safely');

    const afNull = calculateFrontalArea(null, undefined);
    assert.ok(afNull > 0.30 && afNull < 0.70, 'Should use default sprinter fallback');
  });
});

describe('Biomechanical F-v-P Engine: Sprint Exponential Model Fit', () => {
  test('returns null for empty, invalid, or non-array splits', () => {
    assert.equal(fitSprintExponentialModel([]), null);
    assert.equal(fitSprintExponentialModel(null), null);
    assert.equal(fitSprintExponentialModel([{ distance: 0, time: 0 }]), null);
  });

  test('accurately fits realistic 3-point split data with high R^2 coefficient', () => {
    const splits = [
      { distance: 10, time: 1.74 },
      { distance: 20, time: 2.86 },
      { distance: 40, time: 4.88 }
    ];

    const fit = fitSprintExponentialModel(splits);
    assert.ok(fit, 'Model fit result should not be null');
    assert.ok(fit.vmax >= 7.5 && fit.vmax <= 13.0, `Vmax ${fit.vmax} m/s should be within realistic human sprint range`);
    assert.ok(fit.tau >= 0.35 && fit.tau <= 2.0, `Acceleration time constant tau ${fit.tau}s should be within realistic range`);
    assert.ok(fit.rSquared >= 0.90, `Fit R^2 ${fit.rSquared} should be >= 0.90`);
  });

  test('synthesizes bio-anchor when only single split is provided', () => {
    const singleSplit = [{ distance: 40, time: 4.95 }];
    const fit = fitSprintExponentialModel(singleSplit);

    assert.ok(fit, 'Should fit even with single split via synthesized anchor');
    assert.ok(fit.vmax > 6.0, 'Vmax should be realistic');
  });
});

describe('Biomechanical F-v-P Engine: Full Horizontal Profile & Diagnostics', () => {
  test('computes F0, V0, Pmax, and RF metrics for standard combine sprint', () => {
    const profile = calculateHorizontalFVP({
      splits: [
        { distance: 10, time: 1.72 },
        { distance: 20, time: 2.82 },
        { distance: 30, time: 3.86 },
        { distance: 40, time: 4.82 }
      ],
      mass: 80,
      height: 1.82,
      windSpeed: 0
    });

    assert.ok(profile, 'Profile should be generated successfully');
    assert.ok(profile.f0 > 400, `F0 ${profile.f0} N should be positive force`);
    assert.ok(profile.v0 > 7.0, `V0 ${profile.v0} m/s should be realistic sprint ceiling`);
    assert.ok(profile.pmax > 800, `Pmax ${profile.pmax} W should reflect elite mechanical power`);
    assert.ok(profile.f0Rel > 5.0, `Relative F0 ${profile.f0Rel} N/kg should be within human range`);
    assert.ok(profile.pmaxRel > 10.0, `Relative Pmax ${profile.pmaxRel} W/kg should be within human range`);
    assert.ok(typeof profile.profileType === 'string', 'Profile type classification should be string');
  });
});
