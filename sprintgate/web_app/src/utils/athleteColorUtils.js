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
 * athleteColorUtils.js
 * Velocity Lab - Athlete Color Accent & Visual Identity Engine
 * 
 * Provides deterministic, vibrant colors and avatar tags for athletes across
 * the Live Arena, Queue, Leaderboard, and Scout profiles.
 */

export const ATHLETE_ACCENT_COLORS = [
  '#FF5500', // Ignite Blaze Orange
  '#00E599', // Velocity Green
  '#00E5FF', // Electric Cyan
  '#FF204E', // Apex Crimson
  '#A855F7', // Hyper Violet
  '#FAFF00', // Volt Neon
  '#F59E0B', // Amber Gold
  '#38BDF8', // Sky Blue
  '#EC4899', // Hot Pink
  '#10B981', // Emerald
  '#8B5CF6', // Purple
  '#3B82F6'  // Royal Blue
];

/**
 * Deterministically compute a numeric hash from a string identifier
 */
function hashString(str = '') {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Get athlete's assigned brand accent color
 */
export function getAthleteColor(athlete) {
  if (!athlete) return ATHLETE_ACCENT_COLORS[0];
  if (athlete.color && ATHLETE_ACCENT_COLORS.includes(athlete.color)) {
    return athlete.color;
  }
  const idStr = String(athlete.id || athlete.bib || athlete.name || '0');
  const index = hashString(idStr) % ATHLETE_ACCENT_COLORS.length;
  return ATHLETE_ACCENT_COLORS[index];
}

/**
 * Get 2-letter monogram initials for athlete avatar
 */
export function getAthleteInitials(name = '') {
  if (!name || typeof name !== 'string') return 'VL';
  const trimmed = name.trim();
  if (!trimmed) return 'VL';
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
