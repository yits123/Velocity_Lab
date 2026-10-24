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
 * PrecisionClockDisplay.jsx
 * Velocity Lab - High-Performance Tabular Precision Timing Display
 * 
 * Optimized with React.memo and strict tabular-nums font-feature settings
 * to eliminate horizontal layout jitter (FLIP/layout shift) and reduce 
 * rendering overhead during high-speed timing sessions.
 */
function PrecisionClockDisplay({
  time = 0,
  sequenceState = 'idle',
  variant = 'cockpit',
  className = ''
}) {
  const isFalseStart = sequenceState === 'false_start';
  const numericTime = typeof time === 'number' ? time : parseFloat(time) || 0;
  const formattedTime = numericTime.toFixed(2);

  if (variant === 'stadium') {
    return (
      <div 
        className={`text-6xl sm:text-8xl md:text-[10rem] lg:text-[14rem] xl:text-[18rem] leading-none font-bold font-mono tracking-tighter tabular-nums z-10 drop-shadow-2xl select-none ${
          isFalseStart ? 'text-red-500' : 'text-gray-900 dark:text-gray-100'
        } ${className}`}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {formattedTime}
        <span 
          className={`text-3xl sm:text-5xl md:text-7xl lg:text-9xl ml-2 sm:ml-4 md:ml-6 font-medium ${
            isFalseStart ? 'text-red-500' : 'text-emerald-500'
          }`}
        >
          s
        </span>
      </div>
    );
  }

  if (variant === 'jumbotron') {
    return (
      <div 
        className={`text-[20vw] sm:text-[18vw] md:text-[16vw] lg:text-[22rem] font-bold leading-none font-mono text-emerald-500 tracking-tighter tabular-nums select-none drop-shadow-[0_0_80px_rgba(0,208,132,0.35)] ${
          isFalseStart ? 'text-red-500 drop-shadow-[0_0_80px_rgba(239,68,68,0.4)]' : ''
        } ${className}`}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {formattedTime}
      </div>
    );
  }

  // Default: 'cockpit' (Main Live Dashboard view)
  return (
    <div 
      className={`text-5xl xs:text-6xl sm:text-7xl md:text-8xl lg:text-[100px] xl:text-[115px] 2xl:text-[130px] leading-none font-bold font-mono tracking-tighter flex items-baseline z-10 drop-shadow-md select-none ${
        isFalseStart ? 'text-red-500' : 'text-gray-900 dark:text-gray-100'
      } ${className}`}
      style={{ fontVariantNumeric: 'tabular-nums' }}
    >
      {formattedTime}
      <span 
        className={`text-2xl xs:text-3xl sm:text-4xl md:text-5xl lg:text-[44px] ml-1.5 md:ml-2.5 tracking-normal font-medium ${
          isFalseStart ? 'text-red-500' : 'text-emerald-500'
        }`}
      >
        s
      </span>
    </div>
  );
}

export default React.memo(PrecisionClockDisplay);
