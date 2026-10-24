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
  sanitizeText,
  sanitizeBib,
  buildSecureGateUrl,
  DEFAULT_GATE_AUTH_TOKEN
} from '../utils/securitySanitizer.js';

describe('Security Sanitizer Suite: Input Validation & XSS Prevention', () => {
  test('strips dangerous HTML and script tags from text inputs', () => {
    const maliciousInput = '<script>alert("hacked")</script>John Doe';
    const clean = sanitizeText(maliciousInput);
    assert.ok(!clean.includes('<script>'), 'Must strip <script> tag');
    assert.ok(!clean.includes('alert'), 'Must strip script payload');
    assert.equal(clean, 'John Doe');
  });

  test('strips event handler injections like onerror or onload', () => {
    const maliciousImg = '<img src=x onerror="fetch(\'http://attacker.com\')">Jane';
    const clean = sanitizeText(maliciousImg);
    assert.ok(!clean.includes('<img'), 'Must strip img tag');
    assert.ok(!clean.includes('onerror'), 'Must strip inline handlers');
    assert.equal(clean, 'Jane');
  });

  test('enforces max length truncation safely', () => {
    const longString = 'A'.repeat(500);
    const clean = sanitizeText(longString, 50);
    assert.equal(clean.length, 50);
  });

  test('handles null, undefined, and non-string inputs safely', () => {
    assert.equal(sanitizeText(null), '');
    assert.equal(sanitizeText(undefined), '');
    assert.equal(sanitizeText(12345), '12345');
  });
});

describe('Security Sanitizer Suite: Bib & Roster Identifier Sanitization', () => {
  test('preserves valid alphanumeric bib identifiers', () => {
    assert.equal(sanitizeBib('105'), '105');
    assert.equal(sanitizeBib('A-42'), 'A-42');
    assert.equal(sanitizeBib('PRO_99'), 'PRO_99');
  });

  test('strips SQL and command injection characters from bib numbers', () => {
    assert.equal(sanitizeBib("105' OR '1'='1"), '105OR11');
    assert.equal(sanitizeBib('; DROP TABLE;--'), 'DROPTABLE');
  });

  test('truncates bib identifiers to maximum 12 characters', () => {
    assert.equal(sanitizeBib('VERY_LONG_BIB_NUMBER_12345'), 'VERY_LONG_BI');
  });
});

describe('Security Sanitizer Suite: Gate Endpoint Authentication URL Builder', () => {
  test('embeds gate security token into endpoint query string', () => {
    const url = buildSecureGateUrl('startgate.local', '/gun', DEFAULT_GATE_AUTH_TOKEN);
    assert.ok(url.startsWith('http://startgate.local/gun?token='));
    assert.ok(url.includes(DEFAULT_GATE_AUTH_TOKEN));
  });

  test('preserves existing query parameters when appending auth token', () => {
    const url = buildSecureGateUrl('192.168.4.1', '/config?mode=1', DEFAULT_GATE_AUTH_TOKEN);
    assert.ok(url.includes('mode=1'));
    assert.ok(url.includes(`&token=${DEFAULT_GATE_AUTH_TOKEN}`));
  });

  test('rejects empty or whitespace hosts safely', () => {
    assert.equal(buildSecureGateUrl('', '/gun'), null);
    assert.equal(buildSecureGateUrl(null, '/gun'), null);
  });
});
