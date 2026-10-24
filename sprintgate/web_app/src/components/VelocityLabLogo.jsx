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

import React, { useState, useEffect, useId } from 'react';

/**
 * Velocity Lab Theme Palette Definitions
 * Maps each color theme (orange, emerald, cyan, red, purple, yellow) to precision
 * gradient stops matching the official Velocity Lab brand guide and 3D metallic assets.
 */
export const LOGO_THEME_PALETTES = {
  orange: {
    name: 'Ignite Blaze',
    accentColor: '#FF5500',
    // V Frame & 3D Bevels
    vOuter: ['#f25c19', '#ff851b', '#d63a0d'],
    vBevelDark: ['#e04812', '#b82509', '#8f1806'],
    vCoreBright: ['#ff9e1b', '#ff7b08', '#e85305'],
    vHighlight: '#ffad33',
    // Lightning Bolt
    boltOuter: ['#ffe033', '#ffbd1f', '#ff6f08'],
    boltInner: ['#fff799', '#ffaa1c', '#e64607', '#ff7b0a'],
    boltHighlight: '#fff6a1',
    // L Outer Accent Ring
    lOuterAccent: ['#cfd5db', '#9ea6ae', '#ff9424', '#f05a10'],
    // "LAB" Gradient
    labText: ['#ff6e14', '#f75b08', '#d94602'],
    glow: 'rgba(255, 85, 0, 0.45)',
  },
  emerald: {
    name: 'Velocity Green',
    accentColor: '#00E599',
    // V Frame & 3D Bevels (Laser Volt & Speed Green)
    vOuter: ['#38d954', '#64f642', '#25b847'],
    vBevelDark: ['#2ec94e', '#179b44', '#12823b'],
    vCoreBright: ['#9dff29', '#7dfa30', '#3cd83e'],
    vHighlight: '#75fa3b',
    // Lightning Bolt (Electric Volt Neon)
    boltOuter: ['#e5ff24', '#c8ff29', '#5ff535'],
    boltInner: ['#ffffff', '#abff4f', '#19b347', '#48e83a'],
    boltHighlight: '#f4ff8a',
    // L Outer Accent Ring
    lOuterAccent: ['#cfd5db', '#9ea6ae', '#7dfa30', '#25b847'],
    // "LAB" Gradient
    labText: ['#7dfa30', '#00e599', '#059669'],
    glow: 'rgba(0, 229, 153, 0.45)',
  },
  cyan: {
    name: 'Electric Cyan',
    accentColor: '#00E5FF',
    // V Frame & 3D Bevels
    vOuter: ['#00b4d8', '#00e5ff', '#0096c7'],
    vBevelDark: ['#0077b6', '#023e8a', '#03045e'],
    vCoreBright: ['#90e0ef', '#00e5ff', '#0077b6'],
    vHighlight: '#a5f3fc',
    // Lightning Bolt
    boltOuter: ['#caf0f8', '#00e5ff', '#0077b6'],
    boltInner: ['#ffffff', '#ade8f4', '#0096c7', '#00e5ff'],
    boltHighlight: '#cffafe',
    // L Outer Accent Ring
    lOuterAccent: ['#cfd5db', '#9ea6ae', '#00e5ff', '#0077b6'],
    // "LAB" Gradient
    labText: ['#00e5ff', '#00b4d8', '#0284c7'],
    glow: 'rgba(0, 229, 255, 0.45)',
  },
  red: {
    name: 'Apex Crimson',
    accentColor: '#FF204E',
    // V Frame & 3D Bevels
    vOuter: ['#ff3366', '#ff204e', '#cc0033'],
    vBevelDark: ['#b3002d', '#800020', '#4d0013'],
    vCoreBright: ['#ff6688', '#ff204e', '#cc0033'],
    vHighlight: '#fda4af',
    // Lightning Bolt
    boltOuter: ['#fed7aa', '#ff204e', '#ea580c'],
    boltInner: ['#ffffff', '#ff8099', '#e60039', '#ff204e'],
    boltHighlight: '#ffe4e6',
    // L Outer Accent Ring
    lOuterAccent: ['#cfd5db', '#9ea6ae', '#ff204e', '#b3002d'],
    // "LAB" Gradient
    labText: ['#ff204e', '#e6123e', '#b3002d'],
    glow: 'rgba(255, 32, 78, 0.45)',
  },
  purple: {
    name: 'Hyper Violet',
    accentColor: '#A855F7',
    // V Frame & 3D Bevels
    vOuter: ['#c084fc', '#a855f7', '#7e22ce'],
    vBevelDark: ['#7e22ce', '#581c87', '#3b0764'],
    vCoreBright: ['#e9d5ff', '#c084fc', '#9333ea'],
    vHighlight: '#f3e8ff',
    // Lightning Bolt
    boltOuter: ['#f0abfc', '#a855f7', '#7e22ce'],
    boltInner: ['#ffffff', '#e879f9', '#9333ea', '#c084fc'],
    boltHighlight: '#fae8ff',
    // L Outer Accent Ring
    lOuterAccent: ['#cfd5db', '#9ea6ae', '#a855f7', '#7e22ce'],
    // "LAB" Gradient
    labText: ['#c084fc', '#a855f7', '#7e22ce'],
    glow: 'rgba(168, 85, 247, 0.45)',
  },
  yellow: {
    name: 'Volt Neon',
    accentColor: '#FAFF00',
    // V Frame & 3D Bevels
    vOuter: ['#facc15', '#faff00', '#ca8a04'],
    vBevelDark: ['#a16207', '#713f12', '#422006'],
    vCoreBright: ['#fef08a', '#faff00', '#eab308'],
    vHighlight: '#fef9c3',
    // Lightning Bolt
    boltOuter: ['#ffffff', '#faff00', '#eab308'],
    boltInner: ['#ffffff', '#fef08a', '#eab308', '#faff00'],
    boltHighlight: '#ffffff',
    // L Outer Accent Ring
    lOuterAccent: ['#cfd5db', '#9ea6ae', '#faff00', '#ca8a04'],
    // "LAB" Gradient
    labText: ['#faff00', '#eab308', '#ca8a04'],
    glow: 'rgba(250, 255, 0, 0.45)',
  }
};

/**
 * VelocityLabLogo
 * Adaptive Vector Brand Component for Velocity Lab.
 * 
 * Automatically responds to:
 * - Active Color Theme: orange (Ignite Blaze), emerald (Velocity Green), cyan (Electric Cyan), red, purple, yellow
 * - Light Mode / Dark Mode with tuned metallic reflections & contrast
 * - High Contrast accessibility mode
 * 
 * Variants:
 * - 'full': Complete lockup [VL Monogram Emblem] + [VELOCITY LAB] + [ATHLETE EVALUATION SYSTEM]
 * - 'compact': [VL Monogram Emblem] + [VELOCITY LAB]
 * - 'icon': [VL Monogram Emblem Badge] (Square / 4:3 standalone monogram)
 */
function VelocityLabLogo({
  variant = 'full', // 'full' | 'compact' | 'icon'
  colorTheme: propColorTheme,
  isDark: propIsDark,
  animated = false,
  glow = true,
  className = '',
  title = 'Velocity Lab - Athlete Evaluation System',
  style = {}
}) {
  const rawId = useId();
  const id = rawId.replace(/[^a-zA-Z0-9_-]/g, '') || 'vllogo';

  // Dynamic Theme Detection
  const [activeTheme, setActiveTheme] = useState(() => {
    if (propColorTheme) return propColorTheme;
    if (typeof document !== 'undefined') {
      const attr = document.documentElement.getAttribute('data-theme-accent');
      if (attr && LOGO_THEME_PALETTES[attr]) return attr;
      const stored = localStorage.getItem('sprintgate_color_theme');
      if (stored && LOGO_THEME_PALETTES[stored]) return stored;
    }
    return 'orange';
  });

  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof propIsDark === 'boolean') return propIsDark;
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return true;
  });

  useEffect(() => {
    const updateTheme = () => {
      if (propColorTheme) {
        setActiveTheme(propColorTheme);
      } else {
        const attr = document.documentElement.getAttribute('data-theme-accent');
        if (attr && LOGO_THEME_PALETTES[attr]) {
          setActiveTheme(attr);
        } else {
          const stored = localStorage.getItem('sprintgate_color_theme');
          if (stored && LOGO_THEME_PALETTES[stored]) setActiveTheme(stored);
        }
      }

      if (typeof propIsDark === 'boolean') {
        setIsDarkMode(propIsDark);
      } else if (typeof document !== 'undefined') {
        setIsDarkMode(document.documentElement.classList.contains('dark'));
      }
    };

    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme-accent'] });
    return () => observer.disconnect();
  }, [propColorTheme, propIsDark]);

  const palette = LOGO_THEME_PALETTES[activeTheme] || LOGO_THEME_PALETTES.orange;

  // ViewBox & Aspect Ratio setup
  // Full lockup bounding box: X: 80..1281, Y: 199..550 (Width 1201, Height 351)
  // Ample breathing room ensuring lightning bolt & V/L base are 100% visible:
  let viewBox = "65 185 1230 380";
  if (variant === 'icon') {
    viewBox = "65 185 490 380";
  }

  // Metallic L gradients tailored for light/dark contrast
  const lOuterStops = isDarkMode
    ? [
        { offset: '0%', color: palette.lOuterAccent[0] },
        { offset: '45%', color: palette.lOuterAccent[1] },
        { offset: '70%', color: palette.lOuterAccent[2] },
        { offset: '100%', color: palette.lOuterAccent[3] }
      ]
    : [
        { offset: '0%', color: '#94a3b8' },
        { offset: '45%', color: '#64748b' },
        { offset: '70%', color: palette.lOuterAccent[2] },
        { offset: '100%', color: palette.lOuterAccent[3] }
      ];

  const lBevelStops = isDarkMode
    ? [
        { offset: '0%', color: '#c4cacf' },
        { offset: '50%', color: '#8c939a' },
        { offset: '100%', color: '#6d737a' }
      ]
    : [
        { offset: '0%', color: '#94a3b8' },
        { offset: '50%', color: '#64748b' },
        { offset: '100%', color: '#475569' }
      ];

  const lCoreStops = isDarkMode
    ? [
        { offset: '0%', color: '#ffffff' },
        { offset: '35%', color: '#ebeff2' },
        { offset: '70%', color: '#b4bbc2' },
        { offset: '100%', color: '#d9dde2' }
      ]
    : [
        { offset: '0%', color: '#ffffff' },
        { offset: '35%', color: '#f1f5f9' },
        { offset: '70%', color: '#cbd5e1' },
        { offset: '100%', color: '#e2e8f0' }
      ];

  // Typography Colors
  const velocityColor = isDarkMode ? '#ffffff' : '#0f172a';
  const subtextColor = isDarkMode ? '#94a3b8' : '#64748b';

  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox={viewBox} 
      className={`select-none overflow-visible ${className}`}
      style={style}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>

      <defs>
        {/* Outer V Frame Gradient */}
        <linearGradient id={`${id}_vOuter`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={palette.vOuter[0]} />
          <stop offset="50%" stopColor={palette.vOuter[1]} />
          <stop offset="100%" stopColor={palette.vOuter[2]} />
        </linearGradient>

        {/* Inner V Dark Bevel Gradient */}
        <linearGradient id={`${id}_vBevelDark`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={palette.vBevelDark[0]} />
          <stop offset="55%" stopColor={palette.vBevelDark[1]} />
          <stop offset="100%" stopColor={palette.vBevelDark[2]} />
        </linearGradient>

        {/* Inner V Bright Core Gradient */}
        <linearGradient id={`${id}_vCoreBright`} x1="0%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor={palette.vCoreBright[0]} />
          <stop offset="50%" stopColor={palette.vCoreBright[1]} />
          <stop offset="100%" stopColor={palette.vCoreBright[2]} />
        </linearGradient>

        {/* Outer L Frame Metallic + Theme Accent Gradient */}
        <linearGradient id={`${id}_lOuter`} x1="0%" y1="20%" x2="100%" y2="80%">
          {lOuterStops.map((s, idx) => (
            <stop key={idx} offset={s.offset} stopColor={s.color} />
          ))}
        </linearGradient>

        {/* Inner L Base Metallic Shadow Gradient */}
        <linearGradient id={`${id}_lBevelDark`} x1="0%" y1="0%" x2="100%" y2="100%">
          {lBevelStops.map((s, idx) => (
            <stop key={idx} offset={s.offset} stopColor={s.color} />
          ))}
        </linearGradient>

        {/* Inner L Bright Silver Facet Gradient */}
        <linearGradient id={`${id}_lCoreBright`} x1="15%" y1="0%" x2="85%" y2="100%">
          {lCoreStops.map((s, idx) => (
            <stop key={idx} offset={s.offset} stopColor={s.color} />
          ))}
        </linearGradient>

        {/* Lightning Bolt Outer Gradient */}
        <linearGradient id={`${id}_boltOuter`} x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor={palette.boltOuter[0]} />
          <stop offset="45%" stopColor={palette.boltOuter[1]} />
          <stop offset="100%" stopColor={palette.boltOuter[2]} />
        </linearGradient>

        {/* Lightning Bolt Inner Core Gradient */}
        <linearGradient id={`${id}_boltInner`} x1="0%" y1="15%" x2="100%" y2="85%">
          <stop offset="0%" stopColor={palette.boltInner[0]} />
          <stop offset="25%" stopColor={palette.boltInner[1]} />
          <stop offset="60%" stopColor={palette.boltInner[2]} />
          <stop offset="100%" stopColor={palette.boltInner[3]} />
        </linearGradient>

        {/* "LAB" Typography Dynamic Theme Gradient */}
        <linearGradient id={`${id}_labText`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={palette.labText[0]} />
          <stop offset="50%" stopColor={palette.labText[1]} />
          <stop offset="100%" stopColor={palette.labText[2]} />
        </linearGradient>

        {/* Ambient Dark Aura Glow Filter */}
        {glow && isDarkMode && (
          <filter id={`${id}_auraGlow`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="16" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        )}
      </defs>

      {/* Ambient Theme Aura in Dark Mode */}
      {glow && isDarkMode && (
        <circle 
          cx="330" 
          cy="370" 
          r="160" 
          fill={palette.glow} 
          filter={`url(#${id}_auraGlow)`} 
          opacity="0.25"
          pointerEvents="none"
        />
      )}

      {/* ====================================================================
          1. LEFT ICON EMBLEM: V - LIGHTNING BOLT - L
          ==================================================================== */}
      <g id={`${id}_emblem`}>
        {/* 1.1 Outer Frame of "V" */}
        <polygon 
          fill={`url(#${id}_vOuter)`} 
          points="
            409,224 376,256 283,256 243,338 216,256 80,257 136,313 193,511 269,511 
            323,406 284,485 330,392 313,406 263,503 199,503 143,307 101,266 209,264 
            241,362 289,264 379,264
          " 
        />

        {/* 1.2 Inner 3D Beveled "V" */}
        {/* Base Dark Bevel */}
        <polygon 
          fill={`url(#${id}_vBevelDark)`} 
          points="
            128,275 153,306 205,491 258,493 302,408 271,401 369,275 293,275 238,391 204,276
          " 
        />
        {/* Bright Vibrant Inner Core Facet */}
        <polygon 
          fill={`url(#${id}_vCoreBright)`} 
          points="
            146,284 197,284 236,416 299,284 352,284 260,402 287,406 250,478 216,478 166,302
          " 
        />
        {/* Top Bevel Highlight Strips */}
        <polygon 
          fill={palette.vHighlight} 
          opacity="0.75" 
          points="128,275 204,276 197,284 146,284" 
        />
        <polygon 
          fill={palette.vHighlight} 
          opacity="0.75" 
          points="293,275 369,275 352,284 299,284" 
        />

        {/* 1.3 Outer Metallic & Theme Frame of "L" */}
        <polygon 
          fill={`url(#${id}_lOuter)`} 
          points="
            523,256 431,257 396,339 426,238 386,343 404,338 436,263 512,265 
            445,435 532,441 509,500 345,504 373,433 307,516 348,474 335,510 
            514,510 544,432 457,428
          " 
        />

        {/* 1.4 Inner 3D Beveled Metallic "L" */}
        {/* Base Metallic Shadow Bevel */}
        <polygon 
          fill={`url(#${id}_lBevelDark)`} 
          points="
            442,276 417,340 446,341 399,401 363,492 500,492 517,451 428,450 496,275
          " 
        />
        {/* Bright Silver Inner Facet */}
        <polygon 
          fill={`url(#${id}_lCoreBright)`} 
          points="
            450,286 483,286 416,460 503,460 493,482 378,482 408,405 457,341 428,340
          " 
        />
        {/* Specular Diagonal Sheen on "L" */}
        <polygon 
          fill="#ffffff" 
          opacity={isDarkMode ? "0.55" : "0.4"} 
          points="
            450,286 483,286 463,340 408,405 457,341 428,340
          " 
        />

        {/* 1.5 Central High-Voltage Lightning Bolt */}
        {/* Outer Volt Bevel */}
        <polygon 
          fill={`url(#${id}_boltOuter)`} 
          points="
            444,199 292,390 341,395 264,550 422,354 376,346
          " 
        />
        {/* Inner Core Lightning Facet */}
        <polygon 
          fill={`url(#${id}_boltInner)`} 
          points="
            422,232 306,383 353,387 283,522 405,361 359,354
          " 
        />
        {/* Center Specular Ridge Highlight */}
        <polygon 
          fill={palette.boltHighlight} 
          opacity="0.9" 
          points="
            422,232 359,354 376,346 444,199
          " 
        />
        <polygon 
          fill="#ffffff" 
          opacity="0.85" 
          points="
            376,296 337,360 353,360 386,306
          " 
        />

        {/* Subtle Pulse Animation when active or requested */}
        {animated && (
          <animate 
            attributeName="opacity" 
            values="0.95;1;0.95" 
            dur="2s" 
            repeatCount="indefinite" 
          />
        )}
      </g>

      {/* ====================================================================
          2. RIGHT TYPOGRAPHY LOCKUP ("VELOCITY LAB" + SUBTEXT)
          ==================================================================== */}
      {variant !== 'icon' && (
        <g id={`${id}_typography`}>
          {/* "VELOCITY" (Adaptive High-Contrast Color: White in Dark, Slate-900 in Light) */}
          <path 
            id={`${id}_text-velocity`} 
            fill={velocityColor} 
            className="fill-slate-900 dark:fill-white transition-colors duration-200"
            fillRule="evenodd" 
            d="M 651.8,325.9 L 633.0,327.4 L 604.4,379.5 L 604.0,326.5 L 586.0,326.1 L 588.2,404.0 L 608.0,403.4 Z M 709.6,326.0 L 659.0,326.6 L 638.1,404.0 L 689.2,403.5 L 692.8,387.8 L 660.4,386.6 L 664.6,372.1 L 690.2,371.6 L 694.9,356.8 L 669.8,356.2 L 671.0,347.9 L 662.2,342.1 L 704.4,342.0 Z M 721.8,325.9 L 699.8,403.4 L 747.9,404.1 L 752.6,388.0 L 722.8,387.2 L 738.9,326.6 Z M 827.6,328.8 L 820.4,325.8 L 790.2,325.8 L 782.8,327.8 L 776.8,332.4 L 771.8,342.8 L 759.8,386.8 L 759.6,396.6 L 762.8,401.4 L 769.6,404.1 L 801.2,404.1 L 813.1,398.1 L 819.1,386.8 L 831.1,340.9 L 831.1,334.1 Z M 810.9,342.4 L 811.6,347.0 L 800.5,386.4 L 797.0,387.9 L 779.5,387.5 L 778.2,384.8 L 790.0,343.8 L 794.6,341.6 Z M 895.4,328.8 L 887.6,325.8 L 859.6,325.8 L 846.6,331.8 L 828.8,386.6 L 831.5,401.2 L 838.6,404.2 L 868.8,404.1 L 880.4,397.8 L 887.8,375.6 L 871.1,375.9 L 866.4,387.6 L 849.4,387.6 L 848.2,382.1 L 859.2,343.5 L 878.2,342.2 L 877.6,354.5 L 894.2,354.8 L 898.9,338.8 Z M 930.4,325.9 L 912.8,326.9 L 891.8,401.1 L 892.2,404.1 L 908.4,404.2 L 910.1,402.8 Z M 995.4,326.0 L 939.8,326.4 L 935.9,341.1 L 953.9,342.9 L 937.6,404.0 L 955.1,403.5 L 969.8,346.9 L 960.9,341.9 L 989.5,341.5 Z M 1061.6,326.1 L 1044.0,326.4 L 1021.2,358.4 L 1016.0,326.5 L 998.0,326.4 L 1006.2,377.2 L 999.8,404.0 L 1017.2,403.6 L 1024.5,378.4 Z" 
          />

          {/* "LAB" (Dynamic Theme Gradient) */}
          <path 
            id={`${id}_text-lab`} 
            fill={`url(#${id}_labText)`} 
            fillRule="evenodd" 
            d="M 1111.1,326.2 L 1093.6,327.2 L 1073.0,404.0 L 1116.5,404.2 L 1121.4,402.4 L 1124.5,388.4 L 1089.0,387.2 L 1098.0,379.5 Z M 1197.0,326.2 L 1173.5,326.9 L 1128.0,403.9 L 1146.5,404.0 L 1156.5,388.5 L 1180.1,388.6 L 1181.2,403.9 L 1200.1,403.5 Z M 1180.8,345.0 L 1181.2,349.0 L 1180.5,369.6 L 1177.1,371.4 L 1170.2,373.4 L 1160.2,375.4 L 1165.9,370.2 L 1178.5,347.8 Z M 1277.8,328.5 L 1271.0,325.8 L 1228.6,326.5 L 1207.4,403.8 L 1250.4,404.0 L 1258.1,402.1 L 1265.2,396.8 L 1272.2,377.9 L 1272.4,369.2 L 1269.6,363.9 L 1277.1,354.4 L 1281.0,341.0 L 1281.0,333.8 Z M 1234.0,372.0 L 1235.1,371.2 L 1251.4,371.2 L 1253.2,371.9 L 1254.2,374.2 L 1251.2,386.0 L 1249.0,387.8 L 1246.6,388.2 L 1230.6,387.9 L 1230.1,387.4 L 1230.5,383.9 Z M 1236.2,341.9 L 1239.5,341.2 L 1260.4,341.5 L 1261.6,342.5 L 1261.9,344.0 L 1259.5,352.9 L 1258.0,355.0 L 1256.0,355.8 L 1239.6,355.5 L 1239.2,353.9 L 1240.5,346.5 Z" 
          />

          {/* "ATHLETE EVALUATION SYSTEM" (Subtitle - crisp, bold, high-contrast) */}
          {variant !== 'icon' && (
            <text 
              id={`${id}_text-subtext`} 
              x="586" 
              y="448" 
              fill={isDarkMode ? (palette.accentColor || '#00E599') : '#0f172a'}
              style={{
                fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontSize: '28px',
                fontWeight: '900',
                letterSpacing: '0.24em',
                textTransform: 'uppercase'
              }}
              className="select-none font-black uppercase transition-colors duration-200"
            >
              ATHLETE EVALUATION SYSTEM
            </text>
          )}
        </g>
      )}
    </svg>
  );
}

export default React.memo(VelocityLabLogo);

/**
 * VelocityLabIcon
 * Convenient standalone monogram badge shortcut for buttons, favicon & collapsed states.
 */
export const VelocityLabIcon = React.memo(function VelocityLabIcon({ className = "w-8 h-8", colorTheme, isDark, glow = false }) {
  return (
    <VelocityLabLogo 
      variant="icon" 
      className={className} 
      colorTheme={colorTheme} 
      isDark={isDark} 
      glow={glow} 
    />
  );
});
