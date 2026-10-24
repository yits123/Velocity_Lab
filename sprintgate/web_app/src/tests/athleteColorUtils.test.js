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
  getAthleteColor,
  getAthleteInitials,
  ATHLETE_ACCENT_COLORS
} from '../utils/athleteColorUtils.js';

describe('Athlete Visual Identity Engine: Initials Generation', () => {
  test('generates two-letter monogram from first and last name', () => {
    assert.equal(getAthleteInitials('Alex Rivera'), 'AR');
    assert.equal(getAthleteInitials('Usain Bolt'), 'UB');
  });

  test('takes first two characters for single word mononyms', () => {
    assert.equal(getAthleteInitials('Speedy'), 'SP');
    assert.equal(getAthleteInitials('A'), 'A');
  });

  test('extracts first and last initial for multi-part names', () => {
    assert.equal(getAthleteInitials('John Fitz Kennedy'), 'JK');
  });

  test('falls back to VL monogram for null, undefined, or empty names', () => {
    assert.equal(getAthleteInitials(''), 'VL');
    assert.equal(getAthleteInitials(null), 'VL');
    assert.equal(getAthleteInitials(undefined), 'VL');
    assert.equal(getAthleteInitials('   '), 'VL');
  });
});

describe('Athlete Visual Identity Engine: Deterministic Accent Color', () => {
  test('preserves explicitly assigned valid palette color', () => {
    const athlete = { id: 101, color: '#00E599' };
    assert.equal(getAthleteColor(athlete), '#00E599');
  });

  test('deterministically assigns reproducible color based on athlete ID or Bib', () => {
    const athleteA = { id: 'athlete_777' };
    const athleteB = { id: 'athlete_777' };
    const colorA = getAthleteColor(athleteA);
    const colorB = getAthleteColor(athleteB);

    assert.equal(colorA, colorB, 'Identical athlete identifiers must yield identical colors');
    assert.ok(ATHLETE_ACCENT_COLORS.includes(colorA), 'Color must belong to approved brand palette');
  });

  test('handles null or missing athlete object gracefully', () => {
    const color = getAthleteColor(null);
    assert.equal(color, ATHLETE_ACCENT_COLORS[0]);
  });
});
