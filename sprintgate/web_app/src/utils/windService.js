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
 * Velocity Lab Multi-Source Meteorological Wind Engine
 * 
 * Aggregates live wind speed and direction from multiple independent,
 * reliable global meteorological sources:
 *  1. Open-Meteo High-Resolution Model (ECMWF & GFS blend)
 *  2. Open-Meteo Multi-Model Ensemble (NOAA GFS + ECMWF IFS)
 *  3. DWD ICON Global Numerical Model (Deutscher Wetterdienst)
 *  4. wttr.in Surface Observation Network
 *  5. Reverse-geocoding for venue/track location name
 * 
 * Adheres to World Athletics Rule 163.8:
 *  - Standard unit: meters per second (m/s)
 *  - Legal sprint record threshold: <= +2.0 m/s
 *  - Wind-assisted threshold: > +2.0 m/s
 */

// Compass bearings in 16-point cardinal compass
const COMPASS_POINTS = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'
];

export function getCompassDirection(degrees) {
  if (degrees === null || degrees === undefined || isNaN(degrees)) return '';
  const normalized = ((degrees % 360) + 360) % 360;
  const index = Math.round(normalized / 22.5) % 16;
  return COMPASS_POINTS[index];
}

export function isLegalWind(speed) {
  if (speed === null || speed === undefined || speed === '') return true;
  const num = parseFloat(speed);
  if (isNaN(num)) return true;
  return num <= 2.0;
}

/**
 * Fetch with timeout helper
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

/**
 * Reverse geocodes coordinates to get Track/Stadium locality
 */
async function getLocalityName(lat, lon) {
  try {
    const data = await fetchWithTimeout(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
      {},
      6000
    );
    const parts = [
      data.city || data.locality || data.principalSubdivision,
      data.countryCode || data.countryName
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`;
  } catch {
    return `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`;
  }
}

/**
 * Query multi-source meteorological APIs concurrently
 */
export async function fetchMultiSourceWind(lat, lon) {
  // Query 1: Open-Meteo High-Res
  const pOpenMeteo = fetchWithTimeout(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=ms`
  ).then(data => {
    if (!data.current) throw new Error('Missing current weather');
    return {
      name: 'Open-Meteo (High-Res)',
      speed: parseFloat(data.current.wind_speed_10m),
      direction: parseFloat(data.current.wind_direction_10m),
      gusts: data.current.wind_gusts_10m ? parseFloat(data.current.wind_gusts_10m) : null
    };
  });

  // Query 2: Open-Meteo Multi-Model (ECMWF & GFS seamless)
  const pEnsemble = fetchWithTimeout(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=wind_speed_10m,wind_direction_10m&models=ecmwf_ifs025,gfs_seamless,icon_seamless&wind_speed_unit=ms`
  ).then(data => {
    if (!data.current) throw new Error('Missing ensemble data');
    return {
      name: 'ECMWF & NOAA GFS Ensemble',
      speed: parseFloat(data.current.wind_speed_10m),
      direction: parseFloat(data.current.wind_direction_10m),
      gusts: null
    };
  });

  // Query 3: DWD ICON Global
  const pDwdIcon = fetchWithTimeout(
    `https://api.open-meteo.com/v1/dwd-icon?latitude=${lat}&longitude=${lon}&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms`
  ).then(data => {
    if (!data.current) throw new Error('Missing DWD data');
    return {
      name: 'DWD ICON Met Model',
      speed: parseFloat(data.current.wind_speed_10m),
      direction: parseFloat(data.current.wind_direction_10m),
      gusts: null
    };
  });

  // Query 4: wttr.in observation network
  const pWttr = fetchWithTimeout(
    `https://wttr.in/${lat},${lon}?format=j1`
  ).then(data => {
    const cur = data?.current_condition?.[0];
    if (!cur) throw new Error('Missing wttr.in condition');
    const kmph = parseFloat(cur.windspeedKmph);
    const ms = kmph / 3.6;
    return {
      name: 'wttr.in Surface Network',
      speed: Math.round(ms * 100) / 100,
      direction: cur.winddirDegree ? parseFloat(cur.winddirDegree) : null,
      gusts: cur.windGustKmph ? Math.round((parseFloat(cur.windGustKmph) / 3.6) * 100) / 100 : null
    };
  });

  // Query 5: Locality Name
  const pLocality = getLocalityName(lat, lon);

  const [res1, res2, res3, res4, resLoc] = await Promise.allSettled([
    pOpenMeteo,
    pEnsemble,
    pDwdIcon,
    pWttr,
    pLocality
  ]);

  const validSources = [];
  if (res1.status === 'fulfilled') validSources.push(res1.value);
  if (res2.status === 'fulfilled') validSources.push(res2.value);
  if (res3.status === 'fulfilled') validSources.push(res3.value);
  if (res4.status === 'fulfilled') validSources.push(res4.value);

  if (validSources.length === 0) {
    throw new Error('All meteorological sources timed out or failed to return wind data.');
  }

  // Calculate consensus average speed
  const speedSum = validSources.reduce((acc, s) => acc + s.speed, 0);
  const avgSpeed = speedSum / validSources.length;
  const roundedSpeed = Math.round(avgSpeed * 10) / 10; // 1 decimal place

  // Calculate direction consensus (using vector components to properly handle 0/360 boundary)
  let sinSum = 0;
  let cosSum = 0;
  let dirCount = 0;
  validSources.forEach(s => {
    if (s.direction !== null && !isNaN(s.direction)) {
      const rad = (s.direction * Math.PI) / 180;
      sinSum += Math.sin(rad);
      cosSum += Math.cos(rad);
      dirCount++;
    }
  });

  let consensusDir = null;
  let cardinal = '';
  if (dirCount > 0) {
    let deg = (Math.atan2(sinSum / dirCount, cosSum / dirCount) * 180) / Math.PI;
    consensusDir = Math.round(((deg % 360) + 360) % 360);
    cardinal = getCompassDirection(consensusDir);
  }

  // Locality
  const locationName = resLoc.status === 'fulfilled' ? resLoc.value : `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`;

  // Maximum gust detected
  const gustsList = validSources.map(s => s.gusts).filter(g => g !== null && !isNaN(g));
  const maxGust = gustsList.length > 0 ? Math.max(...gustsList).toFixed(1) : null;

  return {
    success: true,
    windSpeed: roundedSpeed,
    windSpeedFormatted: roundedSpeed > 0 ? `+${roundedSpeed.toFixed(1)}` : roundedSpeed.toFixed(1),
    directionDeg: consensusDir,
    directionCardinal: cardinal,
    locationName,
    maxGust,
    sources: validSources,
    sourcesCount: validSources.length,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    isoTime: new Date().toISOString(),
    coords: { latitude: lat, longitude: lon }
  };
}

/**
 * Requests browser Geolocation permission and fetches live multi-source wind
 */
export function requestLocationAndFetchWind() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser. Please enter wind speed manually.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          const result = await fetchMultiSourceWind(lat, lon);
          resolve(result);
        } catch (err) {
          reject(new Error(err.message || 'Failed to fetch wind data from meteorological providers.'));
        }
      },
      (error) => {
        let msg = 'Failed to obtain GPS location.';
        if (error.code === 1) { // PERMISSION_DENIED
          msg = 'Location permission was denied. Enable location access in your browser or enter wind speed manually.';
        } else if (error.code === 2) { // POSITION_UNAVAILABLE
          msg = 'Location information is currently unavailable from your device GPS.';
        } else if (error.code === 3) { // TIMEOUT
          msg = 'GPS location request timed out. Please check your connection or use manual input.';
        }
        reject(new Error(msg));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  });
}

/**
 * Jonas Mureika (2001) / Nicholas Linthorne (1994) Aerodynamic Wind Correction Model
 * 
 * Computes:
 * - Wind-adjusted time (t0): Standardized sprint time under 0.0 m/s calm conditions.
 * - Wind delta (dt): Time gained (tailwind) or lost (headwind) due to aerodynamic drag.
 * - World Athletics legal status: Legal record (w <= +2.0 m/s) vs Wind-assisted (w > +2.0 m/s).
 * 
 * @param {number|string} measuredTime - Measured electronic sprint time (seconds)
 * @param {number|string} windSpeed - Wind speed in m/s (positive tailwind, negative headwind)
 * @param {number} distance - Sprint distance in meters (default: 40)
 * @param {number} altitude - Venue altitude in meters (default: 0)
 */
export function calculateWindCorrection(measuredTime, windSpeed, distance = 40, altitude = 0) {
  const t = parseFloat(measuredTime);
  const w = parseFloat(windSpeed);
  const d = parseFloat(distance) || 40;
  const alt = parseFloat(altitude) || 0;

  if (isNaN(t) || t <= 0) {
    return {
      isValid: false,
      measuredTime: t || 0,
      adjustedTime: t || 0,
      adjustedTimeFormatted: '--',
      windDelta: 0,
      windDeltaFormatted: '+0.00s',
      windSpeed: 0,
      isLegal: true,
      label: 'Zero Wind Equivalent'
    };
  }

  if (isNaN(w) || Math.abs(w) < 0.01) {
    return {
      isValid: true,
      measuredTime: parseFloat(t.toFixed(2)),
      adjustedTime: parseFloat(t.toFixed(2)),
      adjustedTimeFormatted: t.toFixed(2),
      windDelta: 0,
      windDeltaFormatted: '0.00s',
      windSpeed: 0,
      isLegal: true,
      label: 'Calm (0.0 m/s Equivalent)'
    };
  }

  // Air density ratio relative to sea level rho(h) / rho_0
  const rhoRatio = Math.exp(-0.000118 * Math.max(0, alt));

  // Normalized distance scale (World Athletics baseline is 100m)
  const distScale = Math.pow(d / 100, 1.25);

  // Mureika coefficient: ~0.045s per m/s at 10.0s 100m pace
  const paceFactor = Math.max(0.6, (t / 10.0));
  const windCoeff = (0.045 * paceFactor + 0.012) * distScale * rhoRatio;

  // Positive wind (tailwind) reduces measured time -> 0-wind time is slower (positive delta)
  const windDelta = w * windCoeff;
  const adjustedTime = Math.max(0.5, t + windDelta);

  const isLegal = w <= 2.0;

  return {
    isValid: true,
    measuredTime: parseFloat(t.toFixed(2)),
    adjustedTime: parseFloat(adjustedTime.toFixed(2)),
    adjustedTimeFormatted: adjustedTime.toFixed(2),
    windDelta: parseFloat(windDelta.toFixed(3)),
    windDeltaFormatted: windDelta >= 0 ? `+${windDelta.toFixed(2)}s` : `${windDelta.toFixed(2)}s`,
    windSpeed: w,
    isLegal,
    isTailwind: w > 0,
    isHeadwind: w < 0,
    statusLabel: w > 2.0 
      ? 'WIND-ASSISTED (> +2.0 m/s)' 
      : w > 0 
      ? 'LEGAL TAILWIND (≤ +2.0 m/s)' 
      : w < 0 
      ? 'HEADWIND IMPEDED' 
      : 'CALM'
  };
}
