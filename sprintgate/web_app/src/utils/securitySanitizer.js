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
 */

/**
 * securitySanitizer.js
 * Velocity Lab - Security, Input Sanitization & Hardware Authorization Engine
 *
 * Provides defense-in-depth protection against:
 * - Cross-Site Scripting (XSS) and DOM injection in athlete rosters and combine logs
 * - Command injection / SQL characters in athlete bibs and RFID tags
 * - Unauthorized trackside HTTP gate triggering on Node A and Node B
 */

export const DEFAULT_GATE_AUTH_TOKEN = 'VLab-Gate-2026-Secured';

/**
 * Sanitizes arbitrary text inputs, stripping HTML tags, scripts, and dangerous handlers.
 * @param {*} input 
 * @param {number} maxLength 
 * @returns {string} Clean sanitized text
 */
export function sanitizeText(input, maxLength = 250) {
  if (input === null || input === undefined) return '';
  let str = String(input);

  // 1. Strip script and style blocks completely including contents
  str = str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  str = str.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // 2. Strip remaining HTML tags
  str = str.replace(/<[^>]*>/g, '');

  // 3. Remove inline javascript pseudo-protocol and dangerous event handlers
  str = str.replace(/javascript:/gi, '');
  str = str.replace(/on\w+\s*=/gi, '');

  // 4. Strip control characters
  str = str.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');

  // 5. Trim and enforce bounds
  str = str.trim();
  if (typeof maxLength === 'number' && maxLength > 0) {
    str = str.slice(0, maxLength);
  }

  return str;
}

/**
 * Sanitizes athlete bib numbers, restricting to strict alphanumeric, dash, and underscore characters.
 * @param {*} bib 
 * @param {number} maxLength 
 * @returns {string} Clean bib identifier
 */
export function sanitizeBib(bib, maxLength = 12) {
  if (bib === null || bib === undefined) return '';
  let str = String(bib).trim();
  // Strip SQL comments like --
  str = str.replace(/--+/g, '');
  // Keep only alphanumeric characters, single dashes, and underscores
  const clean = str.replace(/[^A-Za-z0-9_-]/g, '');
  return clean.slice(0, maxLength);
}

/**
 * Builds a secure, protocol-aware HTTP URL for hardware timing gates, appending the gate auth token.
 * @param {string} host Hostname or IP address of the gate
 * @param {string} path Endpoint path (e.g. '/gun', '/config')
 * @param {string} token Hardware authorization token
 * @returns {string|null} Full secure HTTP URL
 */
export function buildSecureGateUrl(host, path = '/', token = DEFAULT_GATE_AUTH_TOKEN) {
  if (!host) return null;
  const trimmed = host.trim();
  if (!trimmed) return null;

  const cleanHost = trimmed
    .replace(/^(wss?:\/\/)/i, '')
    .replace(/^(https?:\/\/)/i, '')
    .replace(/\/.*$/, '')
    .trim();

  if (!cleanHost) return null;

  const rawPath = path.startsWith('/') ? path : `/${path}`;
  const hasQuery = rawPath.includes('?');
  const separator = hasQuery ? '&' : '?';
  const authenticatedPath = rawPath.includes('token=')
    ? rawPath
    : `${rawPath}${separator}token=${encodeURIComponent(token)}`;

  return `http://${cleanHost}${authenticatedPath}`;
}
