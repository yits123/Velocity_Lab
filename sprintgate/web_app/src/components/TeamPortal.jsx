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

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, Trophy, TrendingUp, Zap, Shield, Award, Sparkles, Filter, 
  Search, Plus, UserPlus, Edit2, Trash2, Download, Upload, Check, 
  ChevronRight, ArrowUpRight, ArrowDownRight, Clock, Gauge, Activity, 
  FileText, Share2, Layers, RefreshCw, BarChart2, CheckCircle2, 
  Calendar, Flame, Swords, ExternalLink, HelpCircle, Settings, Sliders,
  CheckSquare, Square, X, AlertTriangle, ListPlus, QrCode, Mail, Phone
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, LineChart, Line, 
  XAxis, YAxis, Tooltip, Legend, CartesianGrid, ReferenceLine 
} from 'recharts';
import Papa from 'papaparse';
import HeadToHeadMatchup from './HeadToHeadMatchup';
import AthleteQrBadgeModal from './AthleteQrBadgeModal';

// Standard Color Themes for Squads
export const SQUAD_COLOR_THEMES = [
  { id: 'emerald', name: 'Emerald Speed', color: '#00D084', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-600 dark:text-emerald-400', hex: '#00D084', ring: 'ring-emerald-500' },
  { id: 'sky', name: 'Sky Pro', color: '#38BDF8', bg: 'bg-sky-500/10', border: 'border-sky-500/30', text: 'text-sky-600 dark:text-sky-400', hex: '#38BDF8', ring: 'ring-sky-500' },
  { id: 'amber', name: 'Amber Academy', color: '#F59E0B', bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-600 dark:text-amber-400', hex: '#F59E0B', ring: 'ring-amber-500' },
  { id: 'purple', name: 'Purple Elite', color: '#C084FC', bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-600 dark:text-purple-400', hex: '#C084FC', ring: 'ring-purple-500' },
  { id: 'rose', name: 'Rose Explosive', color: '#F43F5E', bg: 'bg-rose-500/10', border: 'border-rose-500/30', text: 'text-rose-600 dark:text-rose-400', hex: '#F43F5E', ring: 'ring-rose-500' },
  { id: 'cyan', name: 'Cyan Kinetic', color: '#06B6D4', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', text: 'text-cyan-600 dark:text-cyan-400', hex: '#06B6D4', ring: 'ring-cyan-500' },
  { id: 'teal', name: 'Teal Agility', color: '#14B8A6', bg: 'bg-teal-500/10', border: 'border-teal-500/30', text: 'text-teal-600 dark:text-teal-400', hex: '#14B8A6', ring: 'ring-teal-500' },
  { id: 'indigo', name: 'Indigo Velocity', color: '#6366F1', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30', text: 'text-indigo-600 dark:text-indigo-400', hex: '#6366F1', ring: 'ring-indigo-500' }
];

// Standard Default Squad Presets
export const DEFAULT_SQUADS = [
  { id: 'varsity_track', name: 'Varsity Track', color: '#00D084', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-600 dark:text-emerald-400', themeId: 'emerald', sport: 'Track & Field' },
  { id: 'pro_combine', name: 'Pro Scouting Combine', color: '#38BDF8', bg: 'bg-sky-500/10', border: 'border-sky-500/30', text: 'text-sky-600 dark:text-sky-400', themeId: 'sky', sport: 'Football / Combine' },
  { id: 'youth_academy', name: 'Youth Academy', color: '#F59E0B', bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-600 dark:text-amber-400', themeId: 'amber', sport: 'Youth Track & Sports' },
  { id: 'pro_elite', name: 'Pro / Elite Performance', color: '#C084FC', bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-600 dark:text-purple-400', themeId: 'purple', sport: 'Elite Athletics' }
];

export const getSquadBadge = (squadName, squadList = []) => {
  if (!squadName) return { name: 'General Squad', color: '#94A3B8', bg: 'bg-slate-500/10', border: 'border-slate-500/30', text: 'text-slate-500 dark:text-slate-400' };
  
  // 1. Check in custom squadList
  if (squadList && Array.isArray(squadList)) {
    const match = squadList.find(s => s.name && s.name.toLowerCase() === squadName.toLowerCase());
    if (match) {
      const theme = SQUAD_COLOR_THEMES.find(t => t.id === match.themeId || t.color === match.color);
      if (theme) {
        return { name: match.name, color: theme.color, bg: theme.bg, border: theme.border, text: theme.text };
      }
      return { 
        name: match.name, 
        color: match.color || '#00D084', 
        bg: match.bg || 'bg-emerald-500/10', 
        border: match.border || 'border-emerald-500/30', 
        text: match.text || 'text-emerald-600 dark:text-emerald-400' 
      };
    }
  }

  // 2. Fallback keyword matching
  const lower = squadName.toLowerCase();
  if (lower.includes('varsity') || lower.includes('track')) {
    return { name: squadName, color: '#00D084', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-600 dark:text-emerald-400' };
  }
  if (lower.includes('combine') || lower.includes('draft') || lower.includes('scout')) {
    return { name: squadName, color: '#38BDF8', bg: 'bg-sky-500/10', border: 'border-sky-500/30', text: 'text-sky-600 dark:text-sky-400' };
  }
  if (lower.includes('youth') || lower.includes('academy') || lower.includes('junior')) {
    return { name: squadName, color: '#F59E0B', bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-600 dark:text-amber-400' };
  }
  if (lower.includes('pro') || lower.includes('elite') || lower.includes('championship')) {
    return { name: squadName, color: '#C084FC', bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-600 dark:text-purple-400' };
  }
  return { name: squadName, color: '#2DD4BF', bg: 'bg-teal-500/10', border: 'border-teal-500/30', text: 'text-teal-600 dark:text-teal-400' };
};

// Real Historical Sprint Trials Progression (only plots actual recorded sprint runs; returns [] if no data)
export const generateLongitudinalProgression = (athlete, historyRecords = []) => {
  if (!athlete || !athlete.name || !historyRecords || historyRecords.length === 0) {
    return [];
  }

  const athRuns = historyRecords.filter(h => 
    h.name && athlete.name && h.name.toLowerCase() === athlete.name.toLowerCase() && !isNaN(parseFloat(h.time)) && parseFloat(h.time) > 0
  );

  if (athRuns.length === 0) {
    return [];
  }

  // Sort chronologically (oldest to newest)
  const sorted = [...athRuns].sort((a, b) => {
    const tA = (a.serverTime?.seconds ? a.serverTime.seconds * 1000 : 0) || (a.timestamp ? new Date(a.timestamp).getTime() : 0) || 0;
    const tB = (b.serverTime?.seconds ? b.serverTime.seconds * 1000 : 0) || (b.timestamp ? new Date(b.timestamp).getTime() : 0) || 0;
    return tA - tB;
  });

  let bestVSoFar = 0;

  return sorted.map((run, idx) => {
    const dist = parseFloat(run.distance) || 40;
    const timeVal = parseFloat(run.time);
    const vMax = parseFloat(run.velocity) || (dist > 0 && timeVal > 0 ? dist / timeVal : 0);
    const isPR = vMax > bestVSoFar;
    if (vMax > bestVSoFar) bestVSoFar = vMax;

    let split10m = null;
    if (run.splits && Array.isArray(run.splits)) {
      const s10 = run.splits.find(s => s.node === 2 || s.node === 101 || s.distance === 10);
      if (s10 && !isNaN(parseFloat(s10.time))) {
        split10m = parseFloat(s10.time);
      }
    }

    const gct = run.groundContactTime && parseFloat(run.groundContactTime) > 0 ? parseFloat(run.groundContactTime) : null;
    const dateLabel = run.serverTime?.seconds 
      ? new Date(run.serverTime.seconds * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      : (run.timestamp ? new Date(run.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : `Trial #${idx + 1}`);

    const accelEfficiency = run.accelEfficiency 
      ? parseFloat(run.accelEfficiency) 
      : (split10m && split10m > 0 && vMax > 0 ? Number((vMax / split10m).toFixed(2)) : null);

    return {
      month: dateLabel,
      monthShort: `T${idx + 1}`,
      vMax: vMax > 0 ? Number(vMax.toFixed(2)) : null,
      vMaxKmh: vMax > 0 ? Number((vMax * 3.6).toFixed(1)) : null,
      accelEfficiency: accelEfficiency ? Number(accelEfficiency.toFixed(2)) : null,
      groundContactTime: gct ? Number(gct.toFixed(1)) : null,
      split10m: split10m ? Number(split10m.toFixed(2)) : null,
      time: timeVal,
      distance: dist,
      sessionsCount: 1,
      isPR
    };
  });
};

export default function TeamPortal({
  roster = [],
  setRoster,
  history = [],
  results = [],
  isAdmin = true,
  isAthlete = false,
  currentAthlete = null,
  onOpenProfile,
  onDeleteAthlete,
  onBatchDeleteAthletes,
  onClearAllAthletes,
  onSaveAthlete,
  onQueueAthlete,
  onBatchQueue,
  onQueueAllTests,
  onBatchQueueAllTests,
  themeAccent = { color: '#00D084', rgb: '0, 208, 132' }
}) {
  const [activeSubTab, setActiveSubTab] = useState('squads'); // 'squads' | 'velocity_tracking' | 'leaderboards' | 'matchup'
  const [selectedSquad, setSelectedSquad] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRosterIds, setSelectedRosterIds] = useState([]);

  // ==========================================
  // SQUAD MANAGEMENT STATE
  // ==========================================
  const [squadsList, setSquadsList] = useState(() => {
    try {
      const saved = localStorage.getItem('sprintgate_squads_v2');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return DEFAULT_SQUADS;
  });

  const saveSquadsList = (updated) => {
    setSquadsList(updated);
    try {
      localStorage.setItem('sprintgate_squads_v2', JSON.stringify(updated));
    } catch (e) {}
  };

  const [isSquadManagerModalOpen, setIsSquadManagerModalOpen] = useState(false);
  const [isQrBadgeModalOpen, setIsQrBadgeModalOpen] = useState(false);
  const [editingSquad, setEditingSquad] = useState(null); // null => adding/list, or squad object
  const [isAddingSquad, setIsAddingSquad] = useState(false);
  const [squadFormName, setSquadFormName] = useState('');
  const [squadFormThemeId, setSquadFormThemeId] = useState('emerald');
  const [squadFormSport, setSquadFormSport] = useState('');

  // Discover all unique squads: from squadsList + any squads present on roster
  const availableSquads = useMemo(() => {
    const list = [...squadsList];
    (roster || []).forEach(a => {
      if (a.squad && a.squad.trim()) {
        const exists = list.some(s => s.name.toLowerCase() === a.squad.trim().toLowerCase());
        if (!exists) {
          const badge = getSquadBadge(a.squad.trim());
          list.push({
            id: 'squad_' + a.squad.trim().toLowerCase().replace(/\s+/g, '_'),
            name: a.squad.trim(),
            color: badge.color,
            bg: badge.bg,
            border: badge.border,
            text: badge.text,
            sport: a.sport || 'Athletics'
          });
        }
      }
    });
    return list;
  }, [squadsList, roster]);

  // Squad CRUD Operations
  const handleOpenAddSquad = () => {
    setEditingSquad(null);
    setIsAddingSquad(true);
    setSquadFormName('');
    setSquadFormThemeId('emerald');
    setSquadFormSport('');
    setIsSquadManagerModalOpen(true);
  };

  const handleOpenEditSquad = (squad) => {
    setEditingSquad(squad);
    setIsAddingSquad(false);
    setSquadFormName(squad.name || '');
    setSquadFormThemeId(squad.themeId || 'emerald');
    setSquadFormSport(squad.sport || '');
    setIsSquadManagerModalOpen(true);
  };

  const handleSaveSquad = (e) => {
    e.preventDefault();
    const cleanName = squadFormName.trim();
    if (!cleanName) {
      alert('Please enter a squad name.');
      return;
    }

    const theme = SQUAD_COLOR_THEMES.find(t => t.id === squadFormThemeId) || SQUAD_COLOR_THEMES[0];

    if (editingSquad) {
      const oldName = editingSquad.name;

      // Check if renamed name collides with another squad
      if (oldName.toLowerCase() !== cleanName.toLowerCase()) {
        const conflict = availableSquads.some(
          s => s.name.toLowerCase() === cleanName.toLowerCase() && s.id !== editingSquad.id
        );
        if (conflict) {
          alert(`Another squad named "${cleanName}" already exists. Please choose a different name.`);
          return;
        }
      }

      const existsInList = squadsList.some(
        s => s.id === editingSquad.id || s.name.toLowerCase() === oldName.toLowerCase()
      );

      let updated;
      if (existsInList) {
        updated = squadsList.map(s => {
          if (s.id === editingSquad.id || s.name.toLowerCase() === oldName.toLowerCase()) {
            return {
              ...s,
              name: cleanName,
              color: theme.color,
              bg: theme.bg,
              border: theme.border,
              text: theme.text,
              themeId: theme.id,
              sport: squadFormSport.trim() || s.sport || 'Athletics'
            };
          }
          return s;
        });
      } else {
        // Was auto-discovered from athlete roster: add it explicitly into squadsList
        updated = [
          ...squadsList,
          {
            id: editingSquad.id || ('squad_' + Date.now()),
            name: cleanName,
            color: theme.color,
            bg: theme.bg,
            border: theme.border,
            text: theme.text,
            themeId: theme.id,
            sport: squadFormSport.trim() || editingSquad.sport || 'Athletics'
          }
        ];
      }
      saveSquadsList(updated);

      // If squad name changed, cascade update all athletes in roster!
      if (oldName.toLowerCase() !== cleanName.toLowerCase()) {
        const updatedRoster = (roster || []).map(a => 
          (a.squad && a.squad.toLowerCase() === oldName.toLowerCase()) ? { ...a, squad: cleanName } : a
        );
        setRoster(updatedRoster);
        try {
          localStorage.setItem('sprintgate_roster', JSON.stringify(updatedRoster));
        } catch (e) {}

        if ((selectedSquad || '').toLowerCase() === oldName.toLowerCase()) {
          setSelectedSquad(cleanName);
        }
        if ((leaderboardSquadFilter || '').toLowerCase() === oldName.toLowerCase()) {
          setLeaderboardSquadFilter(cleanName);
        }
      }
    } else {
      // Check for duplicate squad name
      const alreadyExists = availableSquads.some(s => s.name.toLowerCase() === cleanName.toLowerCase());
      if (alreadyExists) {
        alert(`A squad named "${cleanName}" already exists. Please choose a different name.`);
        return;
      }

      // Create new squad
      const newSquad = {
        id: 'squad_' + Date.now(),
        name: cleanName,
        color: theme.color,
        bg: theme.bg,
        border: theme.border,
        text: theme.text,
        themeId: theme.id,
        sport: squadFormSport.trim() || 'Athletics'
      };
      saveSquadsList([...squadsList, newSquad]);
      setSelectedSquad(cleanName);
    }

    setEditingSquad(null);
    setIsAddingSquad(false);
  };

  const handleDeleteSquad = (squadToDelete) => {
    if (!isAdmin) {
      alert('Unauthorized: Only administrators can delete squads.');
      return;
    }

    const affectedAthletes = (roster || []).filter(
      a => a.squad && a.squad.toLowerCase() === squadToDelete.name.toLowerCase()
    );

    let msg = `Are you sure you want to delete the squad "${squadToDelete.name}"?`;
    if (affectedAthletes.length > 0) {
      msg += `\n\n${affectedAthletes.length} athlete(s) belong to this squad and will be moved to "Varsity Track".`;
    }

    if (!window.confirm(msg)) return;

    // Filter out squad
    const updatedSquads = squadsList.filter(s => s.name.toLowerCase() !== squadToDelete.name.toLowerCase());
    saveSquadsList(updatedSquads);
    setEditingSquad(null);
    setIsAddingSquad(false);

    // Reassign athletes to 'Varsity Track'
    if (affectedAthletes.length > 0) {
      const updatedRoster = (roster || []).map(a => 
        (a.squad && a.squad.toLowerCase() === squadToDelete.name.toLowerCase()) 
          ? { ...a, squad: 'Varsity Track' } 
          : a
      );
      setRoster(updatedRoster);
      try {
        localStorage.setItem('sprintgate_roster', JSON.stringify(updatedRoster));
      } catch (e) {}
    }

    if (selectedSquad.toLowerCase() === squadToDelete.name.toLowerCase()) {
      setSelectedSquad('All');
    }
    if (leaderboardSquadFilter.toLowerCase() === squadToDelete.name.toLowerCase()) {
      setLeaderboardSquadFilter('All');
    }
  };

  // ==========================================
  // HISTORICAL TRACKING & LEADERBOARDS STATE
  // ==========================================
  const [selectedAthleteForTracking, setSelectedAthleteForTracking] = useState(() => {
    if (isAthlete && currentAthlete?.name) return currentAthlete.name;
    if (roster && roster.length > 0) return roster[0].name;
    return 'All';
  });
  const [trackingMetric, setTrackingMetric] = useState('all');
  const [trackingTimeframe, setTrackingTimeframe] = useState('6_months');

  const [leaderboardCategory, setLeaderboardCategory] = useState('top_speed');
  const [leaderboardSquadFilter, setLeaderboardSquadFilter] = useState('All');

  const [h2hAthleteA, setH2hAthleteA] = useState('');
  const [h2hAthleteB, setH2hAthleteB] = useState('');

  // Add / Edit Athlete Modal
  const [isAthleteModalOpen, setIsAthleteModalOpen] = useState(false);
  const [editingAthleteId, setEditingAthleteId] = useState(null);
  const [customSquadInput, setCustomSquadInput] = useState('');
  const [athleteForm, setAthleteForm] = useState({
    name: '',
    bib: '',
    squad: 'Varsity Track',
    age: '',
    gender: 'M',
    sport: 'Track & Field',
    weight: '',
    height: '',
    rfidUid: '',
    whatsapp: '',
    email: ''
  });

  // Batch Squad Assignment Modal
  const [isBatchSquadModalOpen, setIsBatchSquadModalOpen] = useState(false);
  const [batchTargetSquad, setBatchTargetSquad] = useState('Varsity Track');

  // Filtered Roster by Search & Squad
  const filteredRoster = useMemo(() => {
    return (roster || []).filter(athlete => {
      const matchesSearch = !searchTerm || 
        athlete.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        athlete.bib?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        athlete.sport?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        athlete.squad?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesSquad = selectedSquad === 'All' || 
        (selectedSquad === 'Unassigned' ? !athlete.squad : (athlete.squad || '').toLowerCase() === selectedSquad.toLowerCase());

      return matchesSearch && matchesSquad;
    });
  }, [roster, searchTerm, selectedSquad]);

  // Selection state
  const isAllFilteredSelected = filteredRoster.length > 0 && filteredRoster.every(a => selectedRosterIds.includes(a.id));
  const isSomeFilteredSelected = filteredRoster.some(a => selectedRosterIds.includes(a.id));

  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      setSelectedRosterIds(prev => prev.filter(id => !filteredRoster.some(a => a.id === id)));
    } else {
      const allFilteredIds = filteredRoster.map(a => a.id);
      setSelectedRosterIds(prev => Array.from(new Set([...prev, ...allFilteredIds])));
    }
  };

  // Delete Single Athlete
  const handleDeleteSingleAthlete = async (athlete) => {
    if (!isAdmin) {
      alert("Unauthorized: Only the Master Coach / Admin can delete athletes.");
      return;
    }
    if (!window.confirm(`Are you sure you want to permanently delete "${athlete.name}" (Bib: ${athlete.bib || 'N/A'}) from the squad roster?`)) {
      return;
    }
    const updated = (roster || []).filter(a => a.id !== athlete.id && a.firebaseId !== athlete.firebaseId);
    setRoster(updated);
    try {
      localStorage.setItem('sprintgate_roster', JSON.stringify(updated));
    } catch (e) {}
    setSelectedRosterIds(prev => prev.filter(id => id !== athlete.id && id !== athlete.firebaseId));
    if (onDeleteAthlete) {
      await onDeleteAthlete(athlete);
    }
  };

  // Batch Delete Selected Athletes
  const handleBatchDeleteSelected = async () => {
    if (!isAdmin) {
      alert("Unauthorized: Only the Master Coach / Admin can delete athletes.");
      return;
    }
    if (selectedRosterIds.length === 0) return;
    const count = selectedRosterIds.length;
    if (!window.confirm(`Are you sure you want to permanently delete all ${count} selected athlete(s) from the squad roster? This cannot be undone.`)) {
      return;
    }
    const idsToDelete = [...selectedRosterIds];
    const updated = (roster || []).filter(a => !idsToDelete.includes(a.id) && !idsToDelete.includes(a.firebaseId));
    setRoster(updated);
    try {
      localStorage.setItem('sprintgate_roster', JSON.stringify(updated));
    } catch (e) {}
    setSelectedRosterIds([]);
    if (onBatchDeleteAthletes) {
      await onBatchDeleteAthletes(idsToDelete);
    }
  };

  // Clear All Roster Athletes
  const handleClearAllAthletes = async () => {
    if (!isAdmin) {
      alert("Unauthorized: Only the Master Coach / Admin can clear the roster.");
      return;
    }
    if (roster.length === 0) return;
    if (!window.confirm(`⚠️ DANGER: Are you sure you want to DELETE ALL ${roster.length} athletes from the roster at once?\n\nThis will clear the entire athlete roster permanently.`)) {
      return;
    }
    setRoster([]);
    try {
      localStorage.setItem('sprintgate_roster', JSON.stringify([]));
    } catch (e) {}
    setSelectedRosterIds([]);
    if (onClearAllAthletes) {
      await onClearAllAthletes();
    }
  };

  // Multi-Test Combine Battery Helper (Queues an athlete for all test modes)
  const buildAllTestsBatteryItem = (athlete) => {
    return {
      ...athlete,
      id: athlete.id || `ath_${Date.now()}_${Math.random().toString(36).substring(2,6)}`,
      isCombineBattery: true,
      battery: [
        { testMode: 'standard', name: '40m Sprint', status: 'pending', time: null },
        { testMode: 'shuttle', name: '4x10m Shuttle Run', status: 'pending', time: null },
        { testMode: 'pro_agility', name: '5-10-5 Pro Agility', status: 'pending', time: null },
        { testMode: 'l_drill', name: '3-Cone L-Drill', status: 'pending', time: null },
        { testMode: 'rsa', name: 'Repeated Sprint Ability', status: 'pending', time: null }
      ]
    };
  };

  const handleQueueSingleAllTests = (athlete) => {
    if (onQueueAllTests) {
      onQueueAllTests(athlete);
    } else {
      const item = buildAllTestsBatteryItem(athlete);
      if (onQueueAthlete) onQueueAthlete(item);
    }
  };

  const handleBatchQueueAllTests = () => {
    const chosen = (roster || []).filter(a => selectedRosterIds.includes(a.id));
    if (onBatchQueueAllTests) {
      onBatchQueueAllTests(chosen);
    } else {
      const batteryAthletes = chosen.map(buildAllTestsBatteryItem);
      if (onBatchQueue) onBatchQueue(batteryAthletes);
    }
    setSelectedRosterIds([]);
  };

  // Squad Summary Telemetry (Zero fake fallback data - shows '--' when no runs exist)
  const squadStats = useMemo(() => {
    const list = selectedSquad === 'All' 
      ? roster 
      : roster.filter(a => (a.squad || '').toLowerCase() === selectedSquad.toLowerCase());
    const count = list.length;
    
    let bestVmax = 0;
    let bestVmaxHolder = '--';
    let best10m = 999;
    let best10mHolder = '--';
    let totalGct = 0;
    let gctCount = 0;

    list.forEach(athlete => {
      const runs = (history || []).filter(h => h.name && athlete.name && h.name.toLowerCase() === athlete.name.toLowerCase() && !isNaN(parseFloat(h.time)) && parseFloat(h.time) > 0);
      runs.forEach(r => {
        const v = parseFloat(r.velocity) || (parseFloat(r.distance) && parseFloat(r.time) ? parseFloat(r.distance) / parseFloat(r.time) : 0);
        if (v && v > bestVmax) {
          bestVmax = v;
          bestVmaxHolder = athlete.name;
        }
        if (r.splits && Array.isArray(r.splits)) {
          const s10 = r.splits.find(s => s.node === 2 || s.node === 101 || s.distance === 10);
          if (s10 && parseFloat(s10.time) > 0 && parseFloat(s10.time) < best10m) {
            best10m = parseFloat(s10.time);
            best10mHolder = athlete.name;
          }
        }
        if (r.groundContactTime && parseFloat(r.groundContactTime) > 0) {
          totalGct += parseFloat(r.groundContactTime);
          gctCount++;
        }
      });
    });

    return {
      count,
      bestVmax: bestVmax > 0 ? bestVmax.toFixed(2) : '--',
      bestVmaxHolder: bestVmax > 0 ? bestVmaxHolder : '--',
      best10m: best10m < 999 ? best10m.toFixed(2) : '--',
      best10mHolder: best10m < 999 ? best10mHolder : '--',
      avgGct: gctCount > 0 ? (totalGct / gctCount).toFixed(1) : '--'
    };
  }, [roster, selectedSquad, history]);

  // Selected Athlete for Historical Tracking
  const trackingAthlete = useMemo(() => {
    return (roster || []).find(a => a.name === selectedAthleteForTracking) || roster[0] || null;
  }, [roster, selectedAthleteForTracking]);

  const progressionData = useMemo(() => {
    return generateLongitudinalProgression(trackingAthlete, history);
  }, [trackingAthlete, history]);

  // Multi-Category Leaderboard Computations (Strictly real data only; no fake simulated numbers)
  const leaderboardData = useMemo(() => {
    const topSpeedMap = {};
    const split10mMap = {};
    const gctMap = {};

    (roster || []).forEach(ath => {
      const athRuns = (history || []).filter(h => h.name && ath.name && h.name.toLowerCase() === ath.name.toLowerCase() && !isNaN(parseFloat(h.time)) && parseFloat(h.time) > 0);
      
      let maxV = 0;
      let min10m = 999;
      let minGct = 999;

      if (athRuns.length > 0) {
        athRuns.forEach(r => {
          const v = parseFloat(r.velocity) || (parseFloat(r.distance) && parseFloat(r.time) ? parseFloat(r.distance) / parseFloat(r.time) : 0);
          if (v && v > maxV) maxV = v;

          if (r.splits && Array.isArray(r.splits)) {
            const s10 = r.splits.find(s => s.node === 2 || s.node === 101 || s.distance === 10);
            if (s10 && parseFloat(s10.time) > 0 && parseFloat(s10.time) < min10m) {
              min10m = parseFloat(s10.time);
            }
          }

          if (r.groundContactTime && parseFloat(r.groundContactTime) > 0) {
            const g = parseFloat(r.groundContactTime);
            if (g < minGct) minGct = g;
          }
        });

        if (maxV > 0) {
          topSpeedMap[ath.name] = { athlete: ath, val: Number(maxV.toFixed(2)), unit: 'm/s' };
        }
        if (min10m < 999) {
          split10mMap[ath.name] = { athlete: ath, val: Number(min10m.toFixed(2)), unit: 's' };
        }
        if (minGct < 999) {
          gctMap[ath.name] = { athlete: ath, val: Number(minGct.toFixed(1)), unit: 'ms' };
        }
      }
    });

    const filterBySquad = (list) => {
      if (leaderboardSquadFilter === 'All') return list;
      return list.filter(item => (item.athlete.squad || '').toLowerCase() === leaderboardSquadFilter.toLowerCase());
    };

    return {
      topSpeed: filterBySquad(Object.values(topSpeedMap)).sort((a, b) => b.val - a.val),
      split10m: filterBySquad(Object.values(split10mMap)).sort((a, b) => a.val - b.val),
      groundContact: filterBySquad(Object.values(gctMap)).sort((a, b) => a.val - b.val)
    };
  }, [roster, history, leaderboardSquadFilter]);

  // Add / Edit Athlete Submission
  const handleSaveAthlete = async (e) => {
    e.preventDefault();
    if (!athleteForm.name || !athleteForm.bib) {
      alert('Please fill out full name and Bib ID.');
      return;
    }

    const squadToAssign = athleteForm.squad === '__custom__' ? customSquadInput.trim() : athleteForm.squad;
    const athletePayload = {
      ...athleteForm,
      squad: squadToAssign || 'Varsity Track'
    };

    if (editingAthleteId) {
      const updated = roster.map(a => (a.id === editingAthleteId || a.firebaseId === editingAthleteId) ? { ...athletePayload, id: editingAthleteId } : a);
      setRoster(updated);
      try {
        localStorage.setItem('sprintgate_roster', JSON.stringify(updated));
      } catch (err) {}
      if (onSaveAthlete) {
        await onSaveAthlete(athletePayload, true, editingAthleteId);
      }
      setEditingAthleteId(null);
    } else {
      const newEntry = {
        ...athletePayload,
        id: Date.now()
      };
      const updated = [...roster, newEntry];
      setRoster(updated);
      try {
        localStorage.setItem('sprintgate_roster', JSON.stringify(updated));
      } catch (err) {}
      if (onSaveAthlete) {
        await onSaveAthlete(athletePayload, false, null);
      }
    }

    setIsAthleteModalOpen(false);
    setAthleteForm({
      name: '',
      bib: '',
      squad: 'Varsity Track',
      age: '',
      gender: 'M',
      sport: 'Track & Field',
      weight: '',
      height: '',
      rfidUid: '',
      whatsapp: '',
      email: ''
    });
    setCustomSquadInput('');
  };

  // Batch Assign Squad Execution
  const handleBatchAssignSquad = () => {
    if (selectedRosterIds.length === 0) return;
    const updated = roster.map(a => {
      if (selectedRosterIds.includes(a.id)) {
        return { ...a, squad: batchTargetSquad };
      }
      return a;
    });
    setRoster(updated);
    try {
      localStorage.setItem('sprintgate_roster', JSON.stringify(updated));
    } catch (err) {}
    setIsBatchSquadModalOpen(false);
    setSelectedRosterIds([]);
    alert(`Assigned ${selectedRosterIds.length} athletes to ${batchTargetSquad}!`);
  };

  // CSV Export with Squad
  const handleExportCsv = () => {
    const listToExport = filteredRoster.map(a => ({
      'Full Name': a.name || '',
      'Athlete ID / Bib': a.bib || '',
      'Squad / Team': a.squad || 'Varsity Track',
      'Age': a.age || '',
      'Gender': a.gender || '',
      'Sport': a.sport || '',
      'Body Weight (kg)': a.weight || '',
      'Height (cm)': a.height || '',
      'RFID Tag': a.rfidUid || '',
      'WhatsApp Number': a.whatsapp || a.phone || '',
      'Email ID': a.email || ''
    }));

    const csv = Papa.unparse(listToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `velocity_lab_squad_${selectedSquad.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl p-4 sm:p-6 shadow-sm dark:shadow-2xl overflow-y-auto text-gray-900 dark:text-slate-100 gap-5 transition-colors">
      
      {/* Top Banner Ribbon */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-gray-50/90 dark:bg-slate-950/70 border border-gray-200 dark:border-slate-800/80 p-4 sm:p-5 rounded-2xl backdrop-blur-md shadow-xs transition-colors">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center text-[#00D084] shadow-[0_0_20px_rgba(0,208,132,0.15)] shrink-0">
            <Users size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight">Team Portal &amp; Roster Management</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                PRO SQUAD ARCHITECTURE
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
              Squad segmentation &bull; Longitudinal velocity progression &bull; Multi-pillar leaderboards &amp; head-to-head scouting
            </p>
          </div>
        </div>

        {/* Global Sub-Tab Navigation */}
        <div className="flex flex-wrap items-center bg-gray-100 dark:bg-slate-900/90 p-1.5 rounded-2xl border border-gray-200 dark:border-slate-800 gap-1 w-full lg:w-auto transition-colors">
          <button
            onClick={() => setActiveSubTab('squads')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
              activeSubTab === 'squads' ? 'bg-[#00D084] text-slate-950 shadow-md font-black' : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60'
            }`}
          >
            <Layers size={14} />
            <span>Squads &amp; Roster</span>
          </button>
          <button
            onClick={() => setActiveSubTab('velocity_tracking')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
              activeSubTab === 'velocity_tracking' ? 'bg-[#00D084] text-slate-950 shadow-md font-black' : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60'
            }`}
          >
            <TrendingUp size={14} />
            <span>Velocity Tracking (Vmax)</span>
          </button>
          <button
            onClick={() => setActiveSubTab('leaderboards')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
              activeSubTab === 'leaderboards' ? 'bg-[#00D084] text-slate-950 shadow-md font-black' : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60'
            }`}
          >
            <Trophy size={14} />
            <span>Leaderboards</span>
          </button>
          <button
            onClick={() => setActiveSubTab('matchup')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
              activeSubTab === 'matchup' ? 'bg-[#00D084] text-slate-950 shadow-md font-black' : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60'
            }`}
          >
            <Swords size={14} />
            <span>Head-to-Head</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB 1: SQUADS & ROSTER SEGMENTATION                                  */}
      {/* ========================================================================= */}
      {activeSubTab === 'squads' && (
        <div className="flex flex-col gap-5">
          {/* Squad Filter Pills & Actions Bar */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gray-50/90 dark:bg-slate-950/50 p-4 rounded-2xl border border-gray-200 dark:border-slate-800/80 transition-colors shadow-xs">
            {/* Squad Selector Pills */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setSelectedSquad('All')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition border ${
                  selectedSquad === 'All' 
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm' 
                    : 'bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-400 border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700'
                }`}
              >
                All Squads ({roster.length})
              </button>

              {availableSquads.map(sq => {
                const badge = getSquadBadge(sq.name, availableSquads);
                const count = roster.filter(a => (a.squad || '').toLowerCase() === sq.name.toLowerCase()).length;
                const isSelected = selectedSquad.toLowerCase() === sq.name.toLowerCase();
                return (
                  <div key={sq.id || sq.name} className="flex items-center">
                    <button
                      onClick={() => setSelectedSquad(sq.name)}
                      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition border ${
                        isSelected 
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm font-black' 
                          : `${badge.bg} ${badge.text} ${badge.border} hover:opacity-80`
                      }`}
                    >
                      <span>{sq.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-black/10 dark:bg-black/30 font-bold">{count}</span>
                    </button>
                  </div>
                );
              })}

              {/* Manage Squads Button */}
              {isAdmin && (
                <button
                  onClick={() => {
                    setEditingSquad(null);
                    setIsAddingSquad(false);
                    setIsSquadManagerModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-800 rounded-xl font-bold text-xs transition shadow-xs"
                  title="Edit, rename, add new squads or delete squads"
                >
                  <Sliders size={13} className="text-[#00D084]" />
                  <span>Manage Squads</span>
                </button>
              )}
            </div>

            {/* Quick Actions Bar */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
              {/* Search Bar */}
              <div className="flex items-center bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-3 py-1.5 w-full sm:w-48 focus-within:border-emerald-500 shadow-xs transition-colors">
                <Search size={14} className="text-gray-400 dark:text-slate-500 mr-2 shrink-0" />
                <input
                  type="text"
                  placeholder="Search athletes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-transparent text-xs text-gray-900 dark:text-white outline-none placeholder:text-gray-400 dark:placeholder:text-slate-500"
                />
              </div>



              {isAdmin && (
                <>
                  <button
                    onClick={() => {
                      setEditingAthleteId(null);
                      setAthleteForm({
                        name: '',
                        bib: '',
                        squad: selectedSquad !== 'All' ? selectedSquad : 'Varsity Track',
                        age: '',
                        gender: 'M',
                        sport: 'Track & Field',
                        weight: '',
                        height: '',
                        rfidUid: '',
                        whatsapp: '',
                        email: ''
                      });
                      setIsAthleteModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs transition shadow-sm"
                  >
                    <UserPlus size={14} />
                    <span>Add Athlete</span>
                  </button>

                  {roster.length > 0 && (
                    <button
                      onClick={handleClearAllAthletes}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 rounded-xl font-bold text-xs transition shadow-xs"
                      title="Clear or delete all athletes from roster"
                    >
                      <Trash2 size={13} />
                      <span className="hidden sm:inline">Clear Roster</span>
                    </button>
                  )}
                </>
              )}

              {roster.length > 0 && (
                <button
                  onClick={() => setIsQrBadgeModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded-xl font-bold text-xs transition shadow-xs"
                  title="Print or export athlete QR credentials & bib badges for trackside scanning"
                >
                  <QrCode size={13} className="text-emerald-500" />
                  <span>Print Badges (PDF)</span>
                </button>
              )}

              <button
                onClick={handleExportCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-700 rounded-xl font-bold text-xs transition shadow-xs"
              >
                <Download size={13} />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Squad Telemetry Banner */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-white dark:bg-slate-950/60 border border-gray-200 dark:border-slate-800/80 p-4 rounded-2xl flex flex-col justify-between shadow-xs transition-colors">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 flex items-center gap-1.5">
                <Users size={13} className="text-emerald-500 dark:text-emerald-400" />
                Active Roster
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-gray-900 dark:text-white">{squadStats.count}</span>
                <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">Athletes enrolled</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-950/60 border border-gray-200 dark:border-slate-800/80 p-4 rounded-2xl flex flex-col justify-between shadow-xs transition-colors">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 flex items-center gap-1.5">
                <Gauge size={13} className="text-sky-500 dark:text-sky-400" />
                Squad Top Velocity (Vmax)
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-sky-500 dark:text-sky-400 font-mono">{squadStats.bestVmax}</span>
                <span className="text-xs text-gray-500 dark:text-slate-400 font-mono">m/s &bull; {squadStats.bestVmaxHolder.split(' ')[0]}</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-950/60 border border-gray-200 dark:border-slate-800/80 p-4 rounded-2xl flex flex-col justify-between shadow-xs transition-colors">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 flex items-center gap-1.5">
                <Zap size={13} className="text-amber-500 dark:text-amber-400" />
                Quickest 10m Burst
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-amber-500 dark:text-amber-400 font-mono">{squadStats.best10m}s</span>
                <span className="text-xs text-gray-500 dark:text-slate-400 font-mono">{squadStats.best10mHolder.split(' ')[0]}</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-950/60 border border-gray-200 dark:border-slate-800/80 p-4 rounded-2xl flex flex-col justify-between shadow-xs transition-colors">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 flex items-center gap-1.5">
                <Activity size={13} className="text-purple-500 dark:text-purple-400" />
                Mean Ground Contact (GCT)
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-purple-500 dark:text-purple-400 font-mono">{squadStats.avgGct}</span>
                <span className="text-xs text-gray-500 dark:text-slate-400 font-mono">ms elastic stiffness</span>
              </div>
            </div>
          </div>

          {/* Select All & Selection Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 hover:bg-gray-100 dark:hover:bg-slate-800 text-xs font-bold text-gray-700 dark:text-slate-300 transition shadow-xs"
              >
                {isAllFilteredSelected ? (
                  <CheckSquare size={15} className="text-emerald-500" />
                ) : isSomeFilteredSelected ? (
                  <div className="w-3.5 h-3.5 rounded border-2 border-emerald-500 bg-emerald-500/30 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-xs"></div>
                  </div>
                ) : (
                  <Square size={15} className="text-gray-400" />
                )}
                <span>{isAllFilteredSelected ? `Deselect All (${filteredRoster.length})` : `Select All (${filteredRoster.length})`}</span>
              </button>

              {selectedRosterIds.length > 0 && (
                <button
                  onClick={() => setSelectedRosterIds([])}
                  className="text-xs text-gray-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-rose-400 font-medium px-2 py-1 rounded-lg"
                >
                  Clear Selection ({selectedRosterIds.length})
                </button>
              )}
            </div>

            <div className="text-xs text-gray-500 dark:text-slate-400 font-mono">
              Showing {filteredRoster.length} of {roster.length} athletes
            </div>
          </div>

          {/* Batch Management Toolbar (when athletes are checked) */}
          {selectedRosterIds.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 bg-emerald-500/10 border border-emerald-500/30 p-3.5 rounded-2xl animate-in fade-in duration-200 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-mono font-bold text-xs">
                  {selectedRosterIds.length} Selected
                </span>
                <button
                  onClick={() => setSelectedRosterIds([])}
                  className="text-xs text-gray-600 dark:text-slate-400 hover:text-red-500 dark:hover:text-rose-400 underline font-medium"
                >
                  Clear Selection
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {isAdmin && (
                  <button
                    onClick={() => setIsBatchSquadModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-900 dark:text-white font-bold text-xs rounded-xl border border-gray-200 dark:border-slate-700 transition shadow-xs"
                  >
                    <Layers size={13} />
                    <span>Assign Squad ({selectedRosterIds.length})</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    const chosen = roster.filter(a => selectedRosterIds.includes(a.id));
                    if (onBatchQueue) onBatchQueue(chosen);
                    setSelectedRosterIds([]);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-emerald-600 dark:text-emerald-400 font-bold text-xs rounded-xl border border-gray-200 dark:border-slate-700 transition shadow-xs"
                  title="Queue selected athletes for the active test"
                >
                  <Zap size={13} />
                  <span>Queue Current ({selectedRosterIds.length})</span>
                </button>

                <button
                  onClick={handleBatchQueueAllTests}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl transition shadow-sm"
                  title="Queue selected athletes for all assessments (Sprint, 4x10 Shuttle, 5-10-5, L-Drill, RSA)"
                >
                  <ListPlus size={14} />
                  <span>Queue All Tests ({selectedRosterIds.length})</span>
                </button>

                {isAdmin && (
                  <button
                    onClick={handleBatchDeleteSelected}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 font-bold text-xs rounded-xl transition shadow-xs"
                    title="Permanently delete selected athletes"
                  >
                    <Trash2 size={13} />
                    <span>Delete Selected ({selectedRosterIds.length})</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Athletes Roster Grid */}
          {filteredRoster.length === 0 ? (
            <div className="p-12 border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-3xl text-center flex flex-col items-center justify-center bg-gray-50/50 dark:bg-slate-950/40">
              <Users size={36} className="text-gray-400 dark:text-slate-600 mb-3" />
              <div className="text-base font-bold text-gray-800 dark:text-slate-300">No athletes found in squad roster</div>
              <p className="text-xs text-gray-500 dark:text-slate-500 mt-1 max-w-md">
                {searchTerm || selectedSquad !== 'All' 
                  ? 'No athletes match your current search or squad filter.' 
                  : 'Your squad roster is currently empty. Click "+ Add Athlete" to register team members.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredRoster.map(athlete => {
                const isSelected = selectedRosterIds.includes(athlete.id);
                const badge = getSquadBadge(athlete.squad, availableSquads);

                return (
                  <div
                    key={athlete.id}
                    className={`bg-white dark:bg-slate-950/60 border rounded-2xl p-4 flex flex-col justify-between transition-all group shadow-xs ${
                      isSelected 
                        ? 'border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-500/[0.04]' 
                        : 'border-gray-200 dark:border-slate-800/80 hover:border-gray-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div>
                      {/* Athlete Card Header */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          {/* Selection Checkbox */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedRosterIds(prev => 
                                prev.includes(athlete.id) ? prev.filter(id => id !== athlete.id) : [...prev, athlete.id]
                              );
                            }}
                            className={`w-5 h-5 rounded-lg border flex items-center justify-center transition ${
                              isSelected 
                                ? 'bg-emerald-500 border-emerald-500 text-slate-950' 
                                : 'border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-emerald-500'
                            }`}
                          >
                            {isSelected && <Check size={12} strokeWidth={3} />}
                          </button>

                          {/* Avatar */}
                          <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-emerald-600 dark:text-emerald-400 font-black text-sm flex items-center justify-center shrink-0">
                            {(athlete.name || 'A').split(' ').map(n=>n[0]).join('').substring(0,2)}
                          </div>

                          <div>
                            <div className="font-bold text-sm text-gray-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition flex items-center gap-2">
                              <span>{athlete.name}</span>
                              <span className="font-mono text-[10px] text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-900 px-1.5 py-0.5 rounded border border-gray-200 dark:border-slate-800">
                                #{athlete.bib || 'S1'}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 dark:text-slate-400">{athlete.sport || 'Athlete'}</div>
                          </div>
                        </div>

                        {/* Squad Badge */}
                        <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}>
                          {athlete.squad || 'Varsity Track'}
                        </span>
                      </div>

                      {/* Bio Pill Strip */}
                      <div className="flex flex-wrap gap-1.5 mb-3 text-[11px] font-mono text-gray-600 dark:text-slate-400">
                        {athlete.age && <span className="bg-gray-50 dark:bg-slate-900 px-2 py-0.5 rounded-md border border-gray-200 dark:border-slate-800">{athlete.age} yrs</span>}
                        {athlete.gender && <span className="bg-gray-50 dark:bg-slate-900 px-2 py-0.5 rounded-md border border-gray-200 dark:border-slate-800">{athlete.gender}</span>}
                        {athlete.weight && <span className="bg-gray-50 dark:bg-slate-900 px-2 py-0.5 rounded-md border border-gray-200 dark:border-slate-800">{athlete.weight} kg</span>}
                        {athlete.height && <span className="bg-gray-50 dark:bg-slate-900 px-2 py-0.5 rounded-md border border-gray-200 dark:border-slate-800">{athlete.height} cm</span>}
                        {(athlete.whatsapp || athlete.phone) && (
                          <span className="bg-gray-50 dark:bg-slate-900 px-2 py-0.5 rounded-md border border-gray-200 dark:border-slate-800 flex items-center gap-1 text-[10px]" title="Phone / WhatsApp">
                            <Phone size={10} className="text-emerald-500" />
                            {athlete.whatsapp || athlete.phone}
                          </span>
                        )}
                        {athlete.email && (
                          <span className="bg-gray-50 dark:bg-slate-900 px-2 py-0.5 rounded-md border border-gray-200 dark:border-slate-800 flex items-center gap-1 text-[10px]" title={athlete.email}>
                            <Mail size={10} className="text-sky-500" />
                            <span className="truncate max-w-[140px]">{athlete.email}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Footer Action Buttons */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-slate-800/80 gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedAthleteForTracking(athlete.name);
                            setActiveSubTab('velocity_tracking');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-sky-600 dark:text-sky-400 text-xs font-bold border border-gray-200 dark:border-slate-800 flex items-center gap-1 transition"
                          title="View Historical Vmax & Acceleration Progression"
                        >
                          <TrendingUp size={12} />
                          <span>Progression</span>
                        </button>

                        <button
                          onClick={() => {
                            setH2hAthleteA(athlete.name);
                            setActiveSubTab('matchup');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-amber-600 dark:text-amber-400 text-xs font-bold border border-gray-200 dark:border-slate-800 flex items-center gap-1 transition"
                          title="Compare in Head-to-Head Matchup Arena"
                        >
                          <Swords size={12} />
                          <span>Compare</span>
                        </button>

                        <button
                          onClick={() => {
                            setSelectedSquad(athlete.squad || 'All');
                            setIsQrBadgeModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-emerald-600 dark:text-emerald-400 border border-gray-200 dark:border-slate-800 transition"
                          title="Print QR Credential Badge"
                        >
                          <QrCode size={13} />
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        {isAdmin && (
                          <>
                            <button
                              onClick={() => {
                                setEditingAthleteId(athlete.id);
                                setAthleteForm({
                                  name: athlete.name || '',
                                  bib: athlete.bib || '',
                                  squad: athlete.squad || 'Varsity Track',
                                  age: athlete.age || '',
                                  gender: athlete.gender || 'M',
                                  sport: athlete.sport || '',
                                  weight: athlete.weight || '',
                                  height: athlete.height || '',
                                  rfidUid: athlete.rfidUid || '',
                                  whatsapp: athlete.whatsapp || athlete.phone || '',
                                  email: athlete.email || ''
                                });
                                setIsAthleteModalOpen(true);
                              }}
                              className="p-1.5 text-gray-400 hover:text-emerald-500 dark:hover:text-emerald-400 transition"
                              title="Edit Athlete Profile & Squad"
                            >
                              <Edit2 size={13} />
                            </button>

                            <button
                              onClick={() => handleDeleteSingleAthlete(athlete)}
                              className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition"
                              title="Delete Athlete from Roster"
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}

                        {/* Dual Queue Options: Single Test vs All Tests */}
                        <div className="flex items-center bg-emerald-500/10 rounded-lg p-0.5 border border-emerald-500/20">
                          <button
                            onClick={() => {
                              if (onQueueAthlete) onQueueAthlete(athlete);
                            }}
                            className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 rounded-md transition"
                            title="Queue for Current Live Test"
                          >
                            <Zap size={14} />
                          </button>
                          <button
                            onClick={() => handleQueueSingleAllTests(athlete)}
                            className="px-1.5 py-1 text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/30 rounded-md transition border-l border-emerald-500/20"
                            title="Queue for ALL 5 Tests at once (Sprint, 4x10 Shuttle, Pro Agility, L-Drill, RSA)"
                          >
                            ALL
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: HISTORICAL VELOCITY & KINEMATICS TRACKING                       */}
      {/* ========================================================================= */}
      {activeSubTab === 'velocity_tracking' && (
        <div className="flex flex-col gap-5">
          {/* Controls Bar for Tracking */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-gray-50/90 dark:bg-slate-950/50 p-4 rounded-2xl border border-gray-200 dark:border-slate-800/80 transition-colors shadow-xs">
            {/* Athlete Selector */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">Athlete:</span>
              <select
                value={selectedAthleteForTracking}
                onChange={(e) => setSelectedAthleteForTracking(e.target.value)}
                className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-900 dark:text-white outline-none focus:border-emerald-500 shadow-xs"
              >
                {roster.map(a => (
                  <option key={a.id || a.name} value={a.name}>
                    {a.name} ({a.squad || 'Varsity'})
                  </option>
                ))}
              </select>

              <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 ml-2">Pillar:</span>
              <div className="flex bg-gray-100 dark:bg-slate-900 p-0.5 rounded-xl border border-gray-200 dark:border-slate-800">
                <button
                  onClick={() => setTrackingMetric('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    trackingMetric === 'all' ? 'bg-emerald-500 text-slate-950 font-black shadow-xs' : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  All Metrics
                </button>
                <button
                  onClick={() => setTrackingMetric('vmax')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    trackingMetric === 'vmax' ? 'bg-emerald-500 text-slate-950 font-black shadow-xs' : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Vmax (m/s)
                </button>
                <button
                  onClick={() => setTrackingMetric('acceleration')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    trackingMetric === 'acceleration' ? 'bg-emerald-500 text-slate-950 font-black shadow-xs' : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Acceleration Efficiency
                </button>
                <button
                  onClick={() => setTrackingMetric('contact_time')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    trackingMetric === 'contact_time' ? 'bg-emerald-500 text-slate-950 font-black shadow-xs' : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Contact Times (GCT)
                </button>
              </div>
            </div>

            {/* Timeframe Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">Macrocycle:</span>
              <select
                value={trackingTimeframe}
                onChange={(e) => setTrackingTimeframe(e.target.value)}
                className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-900 dark:text-white outline-none focus:border-emerald-500 shadow-xs"
              >
                <option value="3_months">Last 3 Months (Pre-Season)</option>
                <option value="6_months">6 Months (Full Meso/Macrocycle)</option>
                <option value="all">All-Time Career Tracking</option>
              </select>
            </div>
          </div>

          {/* Historical Progression KPI Cards */}
          {(() => {
            const hasData = progressionData.length > 0;
            const firstPt = hasData ? progressionData[0] : null;
            const lastPt = hasData ? progressionData[progressionData.length - 1] : null;
            const hasDelta = progressionData.length >= 2;

            const deltaV = (hasDelta && lastPt.vMax && firstPt.vMax) ? (lastPt.vMax - firstPt.vMax).toFixed(2) : null;
            const deltaA = (hasDelta && lastPt.accelEfficiency && firstPt.accelEfficiency) ? (lastPt.accelEfficiency - firstPt.accelEfficiency).toFixed(2) : null;
            const deltaGct = (hasDelta && lastPt.groundContactTime && firstPt.groundContactTime) ? (lastPt.groundContactTime - firstPt.groundContactTime).toFixed(1) : null;
            const delta10m = (hasDelta && lastPt.split10m && firstPt.split10m) ? (lastPt.split10m - firstPt.split10m).toFixed(2) : null;

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-950/70 border border-gray-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs transition-colors">
                  <div className="text-xs text-gray-500 dark:text-slate-400 font-bold uppercase tracking-wider flex items-center justify-between">
                    <span>Top Velocity (V<sub>max</sub>)</span>
                    {deltaV !== null ? (
                      <span className={`text-[10px] font-mono flex items-center ${parseFloat(deltaV) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {parseFloat(deltaV) >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />} {parseFloat(deltaV) >= 0 ? `+${deltaV}` : deltaV} m/s
                      </span>
                    ) : (
                      <span className="text-gray-400 dark:text-slate-600 text-[10px] font-mono">--</span>
                    )}
                  </div>
                  <div className="text-2xl font-black text-gray-900 dark:text-white font-mono mt-2">
                    {lastPt?.vMax ? `${lastPt.vMax} ` : '-- '}<span className="text-xs text-gray-500 dark:text-slate-400 font-sans">m/s</span>
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-slate-500 mt-1">
                    {lastPt?.vMaxKmh ? `${lastPt.vMaxKmh} km/h` : '-- km/h'} &bull; Elite Target: 11.5+
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-950/70 border border-gray-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs transition-colors">
                  <div className="text-xs text-gray-500 dark:text-slate-400 font-bold uppercase tracking-wider flex items-center justify-between">
                    <span>Acceleration Efficiency</span>
                    {deltaA !== null ? (
                      <span className={`text-[10px] font-mono flex items-center ${parseFloat(deltaA) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {parseFloat(deltaA) >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />} {parseFloat(deltaA) >= 0 ? `+${deltaA}` : deltaA} m/s²
                      </span>
                    ) : (
                      <span className="text-gray-400 dark:text-slate-600 text-[10px] font-mono">--</span>
                    )}
                  </div>
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-2">
                    {lastPt?.accelEfficiency ? `${lastPt.accelEfficiency} ` : '-- '}<span className="text-xs text-gray-500 dark:text-slate-400 font-sans">m/s²</span>
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-slate-500 mt-1">
                    Morin S<sub>fv</sub> mechanical efficiency
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-950/70 border border-gray-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs transition-colors">
                  <div className="text-xs text-gray-500 dark:text-slate-400 font-bold uppercase tracking-wider flex items-center justify-between">
                    <span>Ground Contact Time (GCT)</span>
                    {deltaGct !== null ? (
                      <span className={`text-[10px] font-mono flex items-center ${parseFloat(deltaGct) <= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {parseFloat(deltaGct) <= 0 ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />} {deltaGct} ms
                      </span>
                    ) : (
                      <span className="text-gray-400 dark:text-slate-600 text-[10px] font-mono">--</span>
                    )}
                  </div>
                  <div className="text-2xl font-black text-purple-600 dark:text-purple-400 font-mono mt-2">
                    {lastPt?.groundContactTime ? `${lastPt.groundContactTime} ` : '-- '}<span className="text-xs text-gray-500 dark:text-slate-400 font-sans">ms</span>
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-slate-500 mt-1">
                    Elastic stiffness &bull; Lower is elite
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-950/70 border border-gray-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs transition-colors">
                  <div className="text-xs text-gray-500 dark:text-slate-400 font-bold uppercase tracking-wider flex items-center justify-between">
                    <span>10m Split Clearance</span>
                    {delta10m !== null ? (
                      <span className={`text-[10px] font-mono flex items-center ${parseFloat(delta10m) <= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {parseFloat(delta10m) <= 0 ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />} {delta10m} s
                      </span>
                    ) : (
                      <span className="text-gray-400 dark:text-slate-600 text-[10px] font-mono">--</span>
                    )}
                  </div>
                  <div className="text-2xl font-black text-amber-500 dark:text-amber-400 font-mono mt-2">
                    {lastPt?.split10m ? `${lastPt.split10m} ` : '-- '}<span className="text-xs text-gray-500 dark:text-slate-400 font-sans">s</span>
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-slate-500 mt-1">
                    0-10m block clearance acceleration
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Master Recharts Progression Chart */}
          <div className="bg-white dark:bg-slate-950/80 border border-gray-200 dark:border-slate-800 p-5 rounded-3xl flex flex-col gap-4 shadow-xs transition-colors">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp size={16} className="text-emerald-500 dark:text-emerald-400" />
                  {trackingAthlete?.name || 'Selected Athlete'} &bull; Longitudinal Performance Curve
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  Progression across verified sprint training trials showing top velocity, acceleration, and contact elasticity
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Vmax (m/s)
                </span>
                <span className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400 font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-500"></span> Accel (m/s²)
                </span>
                <span className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span> GCT (ms)
                </span>
              </div>
            </div>

            {progressionData.length === 0 ? (
              <div className="py-16 text-center flex flex-col items-center justify-center text-gray-400 dark:text-slate-500 border border-dashed border-gray-200 dark:border-slate-800 rounded-2xl bg-gray-50/50 dark:bg-slate-950/30">
                <TrendingUp size={36} className="mb-2 opacity-40 text-emerald-500" />
                <div className="font-bold text-sm text-gray-800 dark:text-slate-200">
                  No recorded sprint trials found for {trackingAthlete?.name || 'this athlete'}
                </div>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 max-w-sm">
                  Sprint trials recorded on the track will automatically plot chronological speed and acceleration curves here.
                </p>
              </div>
            ) : (
              <div className="w-full h-80 sm:h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={progressionData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                    <defs>
                      <linearGradient id="vmaxGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00D084" stopOpacity={0.35}/>
                        <stop offset="95%" stopColor="#00D084" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="accelGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#38BDF8" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="gctGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#C084FC" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#C084FC" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(150,150,150,0.15)" />
                    <XAxis dataKey="monthShort" stroke="#94A3B8" tick={{ fill: '#64748B', fontSize: 11 }} />
                    <YAxis yAxisId="left" stroke="#94A3B8" tick={{ fill: '#64748B', fontSize: 11 }} domain={['auto', 'auto']} />
                    <YAxis yAxisId="right" orientation="right" stroke="#94A3B8" tick={{ fill: '#64748B', fontSize: 11 }} domain={['auto', 'auto']} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#090D16', borderColor: '#1E293B', borderRadius: 12, color: '#FFFFFF', fontSize: 12 }} 
                      formatter={(value, name) => [value, name]}
                    />
                    
                    {/* Top Velocity Curve */}
                    {(trackingMetric === 'all' || trackingMetric === 'vmax') && (
                      <Area 
                        yAxisId="left" 
                        type="monotone" 
                        dataKey="vMax" 
                        name="Top Velocity Vmax (m/s)" 
                        stroke="#00D084" 
                        strokeWidth={3} 
                        fillOpacity={1} 
                        fill="url(#vmaxGrad)" 
                      />
                    )}

                    {/* Acceleration Efficiency Curve */}
                    {(trackingMetric === 'all' || trackingMetric === 'acceleration') && (
                      <Area 
                        yAxisId="left" 
                        type="monotone" 
                        dataKey="accelEfficiency" 
                        name="Acceleration Efficiency (m/s²)" 
                        stroke="#38BDF8" 
                        strokeWidth={2.5} 
                        fillOpacity={1} 
                        fill="url(#accelGrad)" 
                      />
                    )}

                    {/* Ground Contact Time (GCT) Curve */}
                    {(trackingMetric === 'all' || trackingMetric === 'contact_time') && (
                      <Line 
                        yAxisId="right" 
                        type="monotone" 
                        dataKey="groundContactTime" 
                        name="Ground Contact Time (ms)" 
                        stroke="#C084FC" 
                        strokeWidth={2.5} 
                        dot={{ r: 4, fill: '#C084FC' }} 
                      />
                    )}

                    <ReferenceLine yAxisId="left" y={11.0} stroke="#F59E0B" strokeDasharray="4 4" label={{ value: 'Pro / D1 Benchmark (11.0 m/s)', fill: '#F59E0B', fontSize: 10 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Monthly Progression Table */}
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-slate-800 text-gray-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                    <th className="py-2.5 px-3">Session Trial</th>
                    <th className="py-2.5 px-3">Top Velocity (Vmax)</th>
                    <th className="py-2.5 px-3">Speed (km/h)</th>
                    <th className="py-2.5 px-3">Accel Efficiency</th>
                    <th className="py-2.5 px-3">Ground Contact (GCT)</th>
                    <th className="py-2.5 px-3">10m Burst Split</th>
                    <th className="py-2.5 px-3">Milestone</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60 font-mono">
                  {progressionData.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-400 dark:text-slate-500 font-sans text-xs">
                        No recorded sprint trials available for this athlete.
                      </td>
                    </tr>
                  ) : (
                    progressionData.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-slate-900/40 transition">
                        <td className="py-2.5 px-3 font-sans font-bold text-gray-900 dark:text-white">{row.month}</td>
                        <td className="py-2.5 px-3 font-black text-emerald-600 dark:text-emerald-400">{row.vMax ? `${row.vMax} m/s` : '--'}</td>
                        <td className="py-2.5 px-3 text-gray-700 dark:text-slate-300">{row.vMaxKmh ? `${row.vMaxKmh} km/h` : '--'}</td>
                        <td className="py-2.5 px-3 text-sky-600 dark:text-sky-400">{row.accelEfficiency ? `+${row.accelEfficiency} m/s²` : '--'}</td>
                        <td className="py-2.5 px-3 text-purple-600 dark:text-purple-400">{row.groundContactTime ? `${row.groundContactTime} ms` : '--'}</td>
                        <td className="py-2.5 px-3 text-amber-600 dark:text-amber-400">{row.split10m ? `${row.split10m}s` : '--'}</td>
                        <td className="py-2.5 px-3">
                          {row.isPR ? (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                              PERSONAL RECORD (PR)
                            </span>
                          ) : (
                            <span className="text-gray-400 dark:text-slate-500 text-[11px]">Trial #{i+1}</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 3: LEADERBOARDS & MULTI-PILLAR RANKINGS                             */}
      {/* ========================================================================= */}
      {activeSubTab === 'leaderboards' && (
        <div className="flex flex-col gap-5">
          {/* Controls Bar for Leaderboards */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50/90 dark:bg-slate-950/50 p-4 rounded-2xl border border-gray-200 dark:border-slate-800/80 transition-colors shadow-xs">
            {/* Category Switcher */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">Pillar:</span>
              <div className="flex bg-gray-100 dark:bg-slate-900 p-0.5 rounded-xl border border-gray-200 dark:border-slate-800">
                <button
                  onClick={() => setLeaderboardCategory('top_speed')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                    leaderboardCategory === 'top_speed' ? 'bg-[#00D084] text-slate-950 font-black shadow-xs' : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Fastest Top Speed (Vmax)
                </button>
                <button
                  onClick={() => setLeaderboardCategory('split_10m')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                    leaderboardCategory === 'split_10m' ? 'bg-[#00D084] text-slate-950 font-black shadow-xs' : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Quickest 10m Split
                </button>
                <button
                  onClick={() => setLeaderboardCategory('ground_contact')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                    leaderboardCategory === 'ground_contact' ? 'bg-[#00D084] text-slate-950 font-black shadow-xs' : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Lowest Ground Contact Time (GCT)
                </button>
              </div>
            </div>

            {/* Squad Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">Filter Squad:</span>
              <select
                value={leaderboardSquadFilter}
                onChange={(e) => setLeaderboardSquadFilter(e.target.value)}
                className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-900 dark:text-white outline-none focus:border-emerald-500 shadow-xs"
              >
                <option value="All">All Squads</option>
                {availableSquads.map(sq => (
                  <option key={sq.id || sq.name} value={sq.name}>{sq.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Current Category Ranking Table */}
          <div className="bg-white dark:bg-slate-950/70 border border-gray-200 dark:border-slate-800 rounded-3xl p-5 flex flex-col gap-4 shadow-xs transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Trophy size={16} className="text-amber-500" />
                  {leaderboardCategory === 'top_speed' && 'Rankings: Fastest Top Speed (Vmax)'}
                  {leaderboardCategory === 'split_10m' && 'Rankings: Quickest 10m Acceleration Split'}
                  {leaderboardCategory === 'ground_contact' && 'Rankings: Lowest Ground Contact Time (Elastic Stiffness)'}
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  Instant leaderboards segmented across active training squads
                </p>
              </div>

              <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold uppercase">
                {leaderboardSquadFilter === 'All' ? 'ALL SQUADS' : leaderboardSquadFilter.toUpperCase()}
              </span>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-slate-800">
              {(() => {
                const list = leaderboardCategory === 'top_speed'
                  ? leaderboardData.topSpeed
                  : leaderboardCategory === 'split_10m'
                  ? leaderboardData.split10m
                  : leaderboardData.groundContact;

                if (!list || list.length === 0) {
                  return (
                    <div className="p-8 text-center text-gray-400 dark:text-slate-500 text-xs">
                      No athlete records found for this squad filter.
                    </div>
                  );
                }

                return list.map((item, idx) => {
                  const badge = getSquadBadge(item.athlete.squad, availableSquads);
                  const isTop3 = idx < 3;
                  const medalColors = ['bg-amber-400 text-slate-950', 'bg-slate-300 text-slate-950', 'bg-amber-600 text-white'];

                  return (
                    <div 
                      key={item.athlete.id || item.athlete.name}
                      className="py-3 px-2 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-900/40 rounded-xl transition group"
                    >
                      <div className="flex items-center gap-3.5">
                        {/* Rank Badge */}
                        <div className={`w-7 h-7 rounded-lg font-black font-mono text-xs flex items-center justify-center shrink-0 ${
                          isTop3 ? medalColors[idx] : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400'
                        }`}>
                          {idx + 1}
                        </div>

                        {/* Avatar */}
                        <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-emerald-600 dark:text-emerald-400 font-black text-xs flex items-center justify-center shrink-0">
                          {item.athlete.name.split(' ').map(n=>n[0]).join('').substring(0,2)}
                        </div>

                        <div>
                          <div className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                            <span>{item.athlete.name}</span>
                            <span className="font-mono text-[10px] text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-900 px-1.5 py-0.5 rounded border border-gray-200 dark:border-slate-800">
                              #{item.athlete.bib || 'S1'}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                            <span className={`px-2 py-0.2 rounded text-[10px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}>
                              {item.athlete.squad || 'Varsity'}
                            </span>
                            <span>&bull;</span>
                            <span>{item.athlete.sport || 'Athlete'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="font-mono font-black text-lg text-emerald-600 dark:text-emerald-400">
                            {item.val} <span className="text-xs font-sans text-gray-500 dark:text-slate-400">{item.unit}</span>
                          </div>
                          <div className="text-[10px] text-gray-400 font-mono">
                            {leaderboardCategory === 'top_speed' && `${(item.val * 3.6).toFixed(1)} km/h`}
                            {leaderboardCategory === 'split_10m' && `Pace: ${(10 / item.val).toFixed(2)} m/s`}
                            {leaderboardCategory === 'ground_contact' && `Stiffness: Elite`}
                          </div>
                        </div>

                        {onOpenProfile && (
                          <button
                            onClick={() => onOpenProfile(item.athlete.name)}
                            className="p-2 text-gray-400 hover:text-emerald-500 dark:hover:text-emerald-400 transition"
                            title="View Athlete Dossier & Diagnostics"
                          >
                            <ExternalLink size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 4: HEAD-TO-HEAD COMPARISONS                                      */}
      {/* ========================================================================= */}
      {activeSubTab === 'matchup' && (
        <div className="flex flex-col gap-4">
          <HeadToHeadMatchup
            history={history}
            roster={roster}
            results={results}
            initialAthleteA={h2hAthleteA || (roster[0]?.name)}
            initialAthleteB={h2hAthleteB || (roster[1]?.name || roster[0]?.name)}
            onOpenProfile={onOpenProfile}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SQUAD MANAGER (EDIT, MODIFY, ADD NEW, OR DELETE SQUAD)            */}
      {/* ========================================================================= */}
      {isSquadManagerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl w-full max-w-xl p-6 shadow-2xl flex flex-col gap-4 text-gray-900 dark:text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Sliders size={18} className="text-[#00D084]" />
                {editingSquad ? 'Modify Training Squad' : isAddingSquad ? 'Create Training Squad' : 'Manage Training Squads'}
              </h3>
              <button 
                onClick={() => {
                  setIsSquadManagerModalOpen(false);
                  setEditingSquad(null);
                  setIsAddingSquad(false);
                }} 
                className="text-gray-400 hover:text-gray-700 dark:hover:text-white p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            {/* If not in inline edit/add form: show Squad List with Add / Edit / Delete buttons */}
            {(!editingSquad && !isAddingSquad) ? (
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Active Squads ({availableSquads.length})</span>
                  <button
                    onClick={handleOpenAddSquad}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs transition shadow-sm cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>Create New Squad</span>
                  </button>
                </div>

                <div className="divide-y divide-gray-100 dark:divide-slate-800 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                  {availableSquads.map((sq) => {
                    const badge = getSquadBadge(sq.name, availableSquads);
                    const memberCount = (roster || []).filter(a => (a.squad || '').toLowerCase() === sq.name.toLowerCase()).length;

                    return (
                      <div key={sq.id || sq.name} className="p-3.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-800/40 transition">
                        <div className="flex items-center gap-3">
                          <span 
                            className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs" 
                            style={{ backgroundColor: badge.color }}
                          ></span>
                          <div>
                            <div className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                              <span>{sq.name}</span>
                              <span className={`px-2 py-0.2 rounded text-[10px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}>
                                {memberCount} athlete{memberCount !== 1 ? 's' : ''}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                              {sq.sport || 'Athletics & Performance'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEditSquad(sq)}
                            className="p-2 text-gray-500 hover:text-emerald-500 dark:hover:text-emerald-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition"
                            title="Edit / Rename Squad"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteSquad(sq)}
                            className="p-2 text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition"
                            title="Delete Squad"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Inline Add / Edit Squad Form */
              <form onSubmit={handleSaveSquad} className="flex flex-col gap-4 text-xs">
                <div>
                  <label className="text-gray-700 dark:text-slate-300 font-bold block mb-1">Squad Name *</label>
                  <input
                    type="text"
                    required
                    value={squadFormName}
                    onChange={(e) => setSquadFormName(e.target.value)}
                    placeholder="e.g. Senior Sprint Academy"
                    className="w-full bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl p-2.5 text-gray-900 dark:text-white outline-none focus:border-emerald-500 font-bold text-sm"
                  />
                  {editingSquad && (
                    <span className="text-[11px] text-gray-500 dark:text-slate-400 mt-1 block">
                      Note: Renaming this squad will automatically update all athletes currently assigned to &quot;{editingSquad.name}&quot;.
                    </span>
                  )}
                </div>

                <div>
                  <label className="text-gray-700 dark:text-slate-300 font-bold block mb-1.5">Color Badge Theme</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {SQUAD_COLOR_THEMES.map((th) => (
                      <button
                        key={th.id}
                        type="button"
                        onClick={() => setSquadFormThemeId(th.id)}
                        className={`flex items-center gap-2 p-2 rounded-xl border text-left transition ${
                          squadFormThemeId === th.id
                            ? 'border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-500/[0.04]'
                            : 'border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 bg-white dark:bg-slate-950'
                        }`}
                      >
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: th.hex }}></span>
                        <span className="text-[11px] font-bold text-gray-800 dark:text-slate-200 truncate">{th.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-gray-700 dark:text-slate-300 font-bold block mb-1">Sport / Program Category</label>
                  <input
                    type="text"
                    value={squadFormSport}
                    onChange={(e) => setSquadFormSport(e.target.value)}
                    placeholder="e.g. Track & Field, Pro Combine, Academy"
                    className="w-full bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl p-2.5 text-gray-900 dark:text-white outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-200 dark:border-slate-800">
                  {editingSquad ? (
                    <button
                      type="button"
                      onClick={() => handleDeleteSquad(editingSquad)}
                      className="px-3 py-2 text-red-500 hover:bg-red-500/10 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <Trash2 size={14} />
                      <span>Delete Squad</span>
                    </button>
                  ) : <div></div>}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSquad(null);
                        setIsAddingSquad(false);
                      }}
                      className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-800 dark:text-white font-bold transition text-xs"
                    >
                      Back to Squads
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black transition shadow-md text-xs cursor-pointer"
                    >
                      {editingSquad ? 'Save Changes' : 'Create Squad'}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT ATHLETE                                                 */}
      {/* ========================================================================= */}
      {isAthleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl flex flex-col gap-4 text-gray-900 dark:text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <UserPlus size={18} className="text-[#00D084]" />
                {editingAthleteId ? 'Edit Athlete & Squad' : 'Enroll New Athlete'}
              </h3>
              <button 
                onClick={() => setIsAthleteModalOpen(false)} 
                className="text-gray-400 hover:text-gray-700 dark:hover:text-white p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveAthlete} className="flex flex-col gap-3.5 text-xs">
              <div>
                <label className="text-gray-700 dark:text-slate-300 font-bold block mb-1">Full Athlete Name *</label>
                <input
                  type="text"
                  required
                  value={athleteForm.name}
                  onChange={(e) => setAthleteForm({ ...athleteForm, name: e.target.value })}
                  placeholder="e.g. Usain Bolt"
                  className="w-full bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl p-2.5 text-gray-900 dark:text-white outline-none focus:border-emerald-500 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-700 dark:text-slate-300 font-bold block mb-1">Athlete ID / Bib *</label>
                  <input
                    type="text"
                    required
                    value={athleteForm.bib}
                    onChange={(e) => setAthleteForm({ ...athleteForm, bib: e.target.value })}
                    placeholder="e.g. S10"
                    className="w-full bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl p-2.5 text-gray-900 dark:text-white outline-none focus:border-emerald-500 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-gray-700 dark:text-slate-300 font-bold block mb-1">Squad / Group Segment *</label>
                  <select
                    value={athleteForm.squad}
                    onChange={(e) => setAthleteForm({ ...athleteForm, squad: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl p-2.5 text-gray-900 dark:text-white outline-none focus:border-emerald-500 font-bold"
                  >
                    {availableSquads.map(sq => (
                      <option key={sq.id || sq.name} value={sq.name}>{sq.name}</option>
                    ))}
                    <option value="__custom__">+ Add Custom Squad...</option>
                  </select>
                </div>
              </div>

              {athleteForm.squad === '__custom__' && (
                <div>
                  <label className="text-gray-700 dark:text-slate-300 font-bold block mb-1">Enter Custom Squad Name</label>
                  <input
                    type="text"
                    required
                    value={customSquadInput}
                    onChange={(e) => setCustomSquadInput(e.target.value)}
                    placeholder="e.g. Elite Hurdle Development"
                    className="w-full bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl p-2.5 text-gray-900 dark:text-white outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-gray-700 dark:text-slate-300 font-bold block mb-1">Age</label>
                  <input
                    type="number"
                    value={athleteForm.age}
                    onChange={(e) => setAthleteForm({ ...athleteForm, age: e.target.value })}
                    placeholder="21"
                    className="w-full bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl p-2.5 text-gray-900 dark:text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-gray-700 dark:text-slate-300 font-bold block mb-1">Gender</label>
                  <select
                    value={athleteForm.gender}
                    onChange={(e) => setAthleteForm({ ...athleteForm, gender: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl p-2.5 text-gray-900 dark:text-white outline-none"
                  >
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                  </select>
                </div>
                <div>
                  <label className="text-gray-700 dark:text-slate-300 font-bold block mb-1">Sport</label>
                  <input
                    type="text"
                    value={athleteForm.sport}
                    onChange={(e) => setAthleteForm({ ...athleteForm, sport: e.target.value })}
                    placeholder="100m Sprint"
                    className="w-full bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl p-2.5 text-gray-900 dark:text-white outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-700 dark:text-slate-300 font-bold block mb-1">Body Weight (kg)</label>
                  <input
                    type="number"
                    value={athleteForm.weight}
                    onChange={(e) => setAthleteForm({ ...athleteForm, weight: e.target.value })}
                    placeholder="78"
                    className="w-full bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl p-2.5 text-gray-900 dark:text-white outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="text-gray-700 dark:text-slate-300 font-bold block mb-1">Height (cm)</label>
                  <input
                    type="number"
                    value={athleteForm.height}
                    onChange={(e) => setAthleteForm({ ...athleteForm, height: e.target.value })}
                    placeholder="182"
                    className="w-full bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl p-2.5 text-gray-900 dark:text-white outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-700 dark:text-slate-300 font-bold block mb-1 flex items-center gap-1.5">
                    <Phone size={13} className="text-emerald-500" />
                    <span>WhatsApp / Phone</span>
                  </label>
                  <input
                    type="tel"
                    value={athleteForm.whatsapp}
                    onChange={(e) => setAthleteForm({ ...athleteForm, whatsapp: e.target.value })}
                    placeholder="+1 555-0199"
                    className="w-full bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl p-2.5 text-gray-900 dark:text-white outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="text-gray-700 dark:text-slate-300 font-bold block mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Mail size={13} className="text-sky-500" />
                      <span>Email Address</span>
                    </span>
                    <span className="text-[10px] text-gray-400 font-normal">Optional</span>
                  </label>
                  <input
                    type="email"
                    value={athleteForm.email}
                    onChange={(e) => setAthleteForm({ ...athleteForm, email: e.target.value })}
                    placeholder="athlete@example.com"
                    className="w-full bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl p-2.5 text-gray-900 dark:text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-gray-700 dark:text-slate-300 font-bold block mb-1 flex items-center justify-between">
                  <span>RFID / NFC Tag UID</span>
                  <span className="text-[10px] text-gray-400 font-normal">Optional</span>
                </label>
                <input
                  type="text"
                  value={athleteForm.rfidUid}
                  onChange={(e) => setAthleteForm({ ...athleteForm, rfidUid: e.target.value })}
                  placeholder="e.g. 04:A2:3B:5C:88"
                  className="w-full bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl p-2.5 text-gray-900 dark:text-white outline-none font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 mt-2 pt-3 border-t border-gray-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAthleteModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-800 dark:text-white font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black transition shadow-md"
                >
                  {editingAthleteId ? 'Update Athlete' : 'Enroll Athlete'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: BATCH ASSIGN SQUAD                                                 */}
      {/* ========================================================================= */}
      {isBatchSquadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl flex flex-col gap-4 text-gray-900 dark:text-slate-100">
            <h3 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Layers size={18} className="text-[#00D084]" />
              Batch Assign Squad
            </h3>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Assign all {selectedRosterIds.length} selected athletes to a specific training squad:
            </p>

            <select
              value={batchTargetSquad}
              onChange={(e) => setBatchTargetSquad(e.target.value)}
              className="bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl p-3 text-xs font-bold text-gray-900 dark:text-white outline-none focus:border-emerald-500 shadow-xs"
            >
              {availableSquads.map(sq => (
                <option key={sq.id || sq.name} value={sq.name}>{sq.name}</option>
              ))}
            </select>

            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => setIsBatchSquadModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-800 dark:text-white font-bold text-xs transition"
              >
                Cancel
              </button>
              <button
                onClick={handleBatchAssignSquad}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition shadow-sm"
              >
                Apply to {selectedRosterIds.length} Athletes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PRINTABLE ATHLETE QR CREDENTIALS & BIB BADGES                      */}
      {/* ========================================================================= */}
      {isQrBadgeModalOpen && (
        <AthleteQrBadgeModal
          isOpen={isQrBadgeModalOpen}
          onClose={() => setIsQrBadgeModalOpen(false)}
          roster={roster}
          availableSquads={availableSquads}
          initialSquad={selectedSquad}
          isDark={typeof document !== 'undefined' && document.documentElement.classList.contains('dark')}
        />
      )}

    </div>
  );
}
