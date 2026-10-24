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

import React from 'react';

/**
 * AthleteSparkline.jsx
 * Velocity Lab - Micro Performance Trend Sparkline
 * 
 * Lightweight, zero-dependency SVG micro-chart displaying an athlete's recent
 * sprint times trend. In sprint timing, lower time = faster (improving trend).
 */
function AthleteSparkline({
  times = [],
  width = 64,
  height = 22,
  strokeColor = 'var(--accent-color, #00E599)',
  className = ''
}) {
  // Parse numeric values (filter out invalid/zero runs)
  const validTimes = (times || [])
    .map(t => (typeof t === 'number' ? t : parseFloat(t)))
    .filter(t => !isNaN(t) && t > 0);

  if (validTimes.length === 0) {
    return <span className="text-[10px] text-gray-400 font-mono">—</span>;
  }

  if (validTimes.length === 1) {
    return (
      <span className="text-[11px] font-mono font-bold text-gray-600 dark:text-gray-300">
        {validTimes[0].toFixed(2)}s
      </span>
    );
  }

  const min = Math.min(...validTimes);
  const max = Math.max(...validTimes);
  const range = max - min || 0.01;
  const padding = 3;
  const drawHeight = height - padding * 2;
  const drawWidth = width - padding * 2;

  // In sprinting: lower time = higher on chart (faster)
  const points = validTimes.map((val, idx) => {
    const x = padding + (idx / (validTimes.length - 1)) * drawWidth;
    const y = padding + ((val - min) / range) * drawHeight; // lower val gives smaller y (higher on screen)
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const polylineStr = points.join(' ');

  // Last point coordinates
  const lastPoint = points[points.length - 1].split(',');
  const lastX = parseFloat(lastPoint[0]);
  const lastY = parseFloat(lastPoint[1]);

  // Improvement check: is latest time faster (<=) than first time in the series?
  const isImproving = validTimes[validTimes.length - 1] <= validTimes[0];
  const trendColor = isImproving ? strokeColor : '#F59E0B';

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`} title={`Recent runs: ${validTimes.map(t => t.toFixed(2) + 's').join(' → ')}`}>
      <svg
        width={width}
        height={height}
        className="overflow-visible select-none shrink-0"
        aria-hidden="true"
      >
        {/* Sparkline curve */}
        <polyline
          fill="none"
          stroke={trendColor}
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={polylineStr}
        />

        {/* Latest run marker dot */}
        <circle
          cx={lastX}
          cy={lastY}
          r="2.5"
          fill={trendColor}
          className={isImproving ? 'animate-pulse' : ''}
        />
      </svg>
    </div>
  );
}

export default React.memo(AthleteSparkline);
