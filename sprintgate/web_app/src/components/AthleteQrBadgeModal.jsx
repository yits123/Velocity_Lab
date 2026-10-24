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

import React, { useState, useMemo, useRef } from 'react';
import { 
  X, Download, Printer, QrCode, Check, CheckSquare, 
  Square, Search, Filter, Layers, Users, Loader2, Sparkles
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { jsPDF } from 'jspdf';
import { savePdfFile } from '../utils/pdfDownloader';
import { addVelocityLabLogoToPdf } from '../utils/logoPdfHelper';

export default function AthleteQrBadgeModal({
  isOpen = false,
  onClose,
  roster = [],
  availableSquads = [],
  initialSquad = 'All',
  isDark = true
}) {
  // State
  const [selectedSquadFilter, setSelectedSquadFilter] = useState(initialSquad || 'All');
  const [searchQuery, setSearchQuery] = useState('');
  const [badgeLayout, setBadgeLayout] = useState('6_per_page'); // '6_per_page' (lanyard) | '4_per_page' (chest bib)
  const [selectedAthleteIds, setSelectedAthleteIds] = useState(() => {
    return new Set(roster.map(a => a.id || a.bib || a.name));
  });
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);

  // Hidden offscreen container ref for guaranteed canvas availability
  const offscreenContainerRef = useRef(null);

  // Filter roster by squad and search query
  const filteredAthletes = useMemo(() => {
    return roster.filter(athlete => {
      if (!athlete) return false;
      const matchesSquad = selectedSquadFilter === 'All' || 
        (athlete.squad || '').toLowerCase() === selectedSquadFilter.toLowerCase();
      if (!matchesSquad) return false;

      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase().trim();
      const name = (athlete.name || '').toLowerCase();
      const bib = String(athlete.bib || '').toLowerCase();
      const sport = (athlete.sport || '').toLowerCase();
      return name.includes(query) || bib.includes(query) || sport.includes(query);
    });
  }, [roster, selectedSquadFilter, searchQuery]);

  // Selection helpers
  const allFilteredSelected = useMemo(() => {
    if (filteredAthletes.length === 0) return false;
    return filteredAthletes.every(a => selectedAthleteIds.has(a.id || a.bib || a.name));
  }, [filteredAthletes, selectedAthleteIds]);

  const toggleSelectAll = () => {
    const next = new Set(selectedAthleteIds);
    if (allFilteredSelected) {
      filteredAthletes.forEach(a => next.delete(a.id || a.bib || a.name));
    } else {
      filteredAthletes.forEach(a => next.add(a.id || a.bib || a.name));
    }
    setSelectedAthleteIds(next);
  };

  const toggleAthlete = (id) => {
    const next = new Set(selectedAthleteIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedAthleteIds(next);
  };

  // Get squad color helper
  const getSquadColor = (squadName) => {
    const sq = availableSquads.find(s => (s.name || '').toLowerCase() === (squadName || '').toLowerCase());
    return sq?.color || '#00D084';
  };

  // Helper to extract hex color to RGB
  const hexToRgb = (hex) => {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255
    };
  };

  // Generate and Download PDF Sheet
  const handleDownloadPdf = async () => {
    const targetAthletes = filteredAthletes.filter(a => selectedAthleteIds.has(a.id || a.bib || a.name));
    if (targetAthletes.length === 0) {
      alert("Please select at least one athlete to generate badges.");
      return;
    }

    setIsGeneratingPdf(true);
    setPdfProgress(10);

    try {
      // Create A4 Portrait jsPDF document
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = 210;
      const pageHeight = 297;
      const is6Grid = badgeLayout === '6_per_page';

      // Layout geometry (in mm)
      const cols = 2;
      const rows = is6Grid ? 3 : 2;
      const badgesPerPage = cols * rows;

      const cardWidth = 88;
      const cardHeight = is6Grid ? 80 : 120;
      const leftMargin = (pageWidth - (cols * cardWidth + 10)) / 2;
      const topMargin = is6Grid ? 20 : 22;
      const colGap = 10;
      const rowGap = is6Grid ? 8 : 10;

      const totalPages = Math.ceil(targetAthletes.length / badgesPerPage);

      for (let i = 0; i < targetAthletes.length; i++) {
        const athlete = targetAthletes[i];
        const athleteKey = athlete.id || athlete.bib || athlete.name;
        const pageIndex = Math.floor(i / badgesPerPage);
        const indexOnPage = i % badgesPerPage;

        // Add new page if moving past first page
        if (i > 0 && indexOnPage === 0) {
          doc.addPage();
        }

        // Draw Page Header on first badge of every page
        if (indexOnPage === 0) {
          // Velocity Lab Logo & Title
          try {
            addVelocityLabLogoToPdf(doc, {
              x: leftMargin,
              y: 6,
              width: 32,
              isDark: false
            });
          } catch (e) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(15, 23, 42);
            doc.text("VELOCITY LAB", leftMargin, 11);
          }

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(100, 116, 139);
          doc.text("OFFICIAL COMBINE CREDENTIAL SHEET", leftMargin + 36, 10);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          const dateStr = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
          doc.text(`Squad: ${selectedSquadFilter} • Date: ${dateStr}`, leftMargin + 36, 14);

          // Page Number at Top Right
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7);
          doc.setTextColor(148, 163, 184);
          doc.text(`PAGE ${pageIndex + 1} OF ${totalPages}`, pageWidth - leftMargin, 11, { align: 'right' });

          // Subtle divider line
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.3);
          doc.line(leftMargin, 16, pageWidth - leftMargin, 16);

          // Page Footer (Cutting Guide note)
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(6.5);
          doc.setTextColor(148, 163, 184);
          doc.text(
            "Cut along dashed guidelines. Compatible with Velocity Lab Camera Scan & SprintGate Hardware Beam Sync.",
            pageWidth / 2,
            pageHeight - 6,
            { align: 'center' }
          );
        }

        // Calculate (x, y) for current card
        const col = indexOnPage % cols;
        const row = Math.floor(indexOnPage / cols);
        const cardX = leftMargin + col * (cardWidth + colGap);
        const cardY = topMargin + row * (cardHeight + rowGap);

        // 1. Draw outer cutting guide (dashed outline)
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.25);
        doc.setLineDashPattern([2, 1.5], 0);
        doc.rect(cardX - 1.5, cardY - 1.5, cardWidth + 3, cardHeight + 3);
        doc.setLineDashPattern([], 0); // reset line dash

        // 2. Badge Card Body (solid rounded rectangle)
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(15, 23, 42);
        doc.setLineWidth(0.4);
        doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 3, 3, 'FD');

        // 3. Card Top Header Strip
        doc.setFillColor(15, 23, 42); // deep slate #0f172a
        doc.roundedRect(cardX, cardY, cardWidth, 12, 3, 3, 'F');
        // Clean square off bottom corners of header
        doc.rect(cardX, cardY + 8, cardWidth, 4, 'F');

        // Velocity Lab Brand Pill in Header
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(255, 255, 255);
        doc.text("VELOCITY LAB", cardX + 3.5, cardY + 7.5);

        // Squad Pill in Header (Right side)
        const squadColor = getSquadColor(athlete.squad);
        const rgb = hexToRgb(squadColor);
        doc.setFillColor(rgb.r, rgb.g, rgb.b);
        doc.roundedRect(cardX + cardWidth - 32, cardY + 2.5, 28, 6.5, 2, 2, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6);
        doc.setTextColor(15, 23, 42);
        const squadTruncated = (athlete.squad || 'Track & Field').length > 13 
          ? (athlete.squad || '').substring(0, 11) + '..' 
          : (athlete.squad || 'Track & Field');
        doc.text(squadTruncated.toUpperCase(), cardX + cardWidth - 18, cardY + 6.8, { align: 'center' });

        // 4. Athlete Name
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(is6Grid ? 11 : 13);
        doc.setTextColor(15, 23, 42);
        const athleteName = athlete.name || 'Unnamed Athlete';
        const displayName = athleteName.length > 22 ? athleteName.substring(0, 20) + '...' : athleteName;
        doc.text(displayName, cardX + 4, cardY + (is6Grid ? 19.5 : 21));

        // 5. Athlete Category / Sport Subtitle
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(is6Grid ? 6.5 : 7.5);
        doc.setTextColor(100, 116, 139);
        const sportText = athlete.sport || 'Track & Field';
        const genderAge = [athlete.gender ? (athlete.gender === 'F' ? 'Female' : 'Male') : null, athlete.age ? `${athlete.age} yrs` : null].filter(Boolean).join(' • ');
        const metaSubtitle = genderAge ? `${sportText} • ${genderAge}` : sportText;
        doc.text(metaSubtitle, cardX + 4, cardY + (is6Grid ? 24 : 26.5));

        // 6. Large BIB Number Pill
        const bibStr = athlete.bib != null && String(athlete.bib).trim() !== '' ? String(athlete.bib) : '--';
        doc.setFillColor(241, 245, 249);
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.3);
        doc.roundedRect(cardX + cardWidth - 24, cardY + (is6Grid ? 15 : 16.5), 20, 10, 2, 2, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(is6Grid ? 8 : 9);
        doc.setTextColor(15, 23, 42);
        doc.text(`BIB #${bibStr}`, cardX + cardWidth - 14, cardY + (is6Grid ? 21.5 : 23), { align: 'center' });

        // Divider below name
        doc.setDrawColor(241, 245, 249);
        doc.setLineWidth(0.3);
        doc.line(cardX + 4, cardY + (is6Grid ? 26.5 : 30), cardX + cardWidth - 4, cardY + (is6Grid ? 26.5 : 30));

        // 7. High-Res QR Code Image
        const qrCanvasId = `qr-canvas-${athleteKey}`;
        const canvas = document.getElementById(qrCanvasId);
        if (canvas) {
          try {
            const dataUrl = canvas.toDataURL('image/png');
            const qrSize = is6Grid ? 35 : 52;
            const qrX = cardX + (cardWidth - qrSize) / 2;
            const qrY = cardY + (is6Grid ? 29.5 : 36);

            // Subtle QR code backing border
            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.3);
            doc.roundedRect(qrX - 1, qrY - 1, qrSize + 2, qrSize + 2, 2, 2, 'FD');

            doc.addImage(dataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

            // Scan ID caption underneath QR code
            doc.setFont('courier', 'bold');
            doc.setFontSize(is6Grid ? 6.5 : 8);
            doc.setTextColor(71, 85, 105);
            const scanValue = athlete.rfidUid || athlete.bib || athlete.id || athlete.name;
            doc.text(`SCAN ID: ${scanValue}`, cardX + cardWidth / 2, qrY + qrSize + 4, { align: 'center' });
          } catch (e) {
            console.warn(`Failed to embed QR image for ${athlete.name}:`, e);
          }
        }

        // 8. Card Bottom Security / Brand Tag
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(cardX + 4, cardY + cardHeight - 7, cardWidth - 8, 4.5, 1.5, 1.5, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5);
        doc.setTextColor(100, 116, 139);
        doc.text("SPRINTGATE TIMING PASS • COMBINE VERIFIED", cardX + cardWidth / 2, cardY + cardHeight - 4, { align: 'center' });

        setPdfProgress(Math.round(((i + 1) / targetAthletes.length) * 100));
      }

      // Format clean filename
      const cleanSquad = selectedSquadFilter.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `VelocityLab_Athlete_Badges_${cleanSquad}_${new Date().toISOString().slice(0, 10)}.pdf`;
      savePdfFile(doc, filename);
    } catch (err) {
      console.error("Badge PDF generation error:", err);
      alert(`Failed to generate badge PDF: ${err.message || 'Unknown error'}`);
    } finally {
      setIsGeneratingPdf(false);
      setPdfProgress(0);
    }
  };

  // Direct Print via Browser
  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      {/* Printable CSS injected dynamically */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-badge-stage, #printable-badge-stage * {
            visibility: visible !important;
          }
          #printable-badge-stage {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
          .page-break {
            page-break-after: always !important;
            break-after: page !important;
          }
        }
      `}</style>

      {/* Guaranteed offscreen canvas bank for all selected athletes */}
      <div 
        ref={offscreenContainerRef} 
        style={{ position: 'fixed', left: '-9999px', top: '-9999px', opacity: 0, pointerEvents: 'none' }}
        aria-hidden="true"
      >
        {roster.map(athlete => {
          const key = athlete.id || athlete.bib || athlete.name;
          const qrVal = athlete.rfidUid || athlete.bib || athlete.id || athlete.name;
          return (
            <QRCodeCanvas
              key={`hidden-${key}`}
              id={`qr-canvas-${key}`}
              value={qrVal}
              size={220}
              level="H"
              includeMargin={true}
            />
          );
        })}
      </div>

      {/* Main Modal Box */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden transition-all animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between bg-gray-50/70 dark:bg-slate-950/40 no-print">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500">
              <QrCode size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-gray-900 dark:text-white">
                  Athlete QR Credentials &amp; Bib Badges
                </h2>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-slate-950">
                  Print Ready
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Generate high-contrast scannable QR credentials for lanyards or chest bibs.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Toolbar & Filters */}
        <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 no-print">
          
          {/* Left: Squad Filter & Search */}
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
            {/* Squad Filter Dropdown */}
            <div className="flex items-center bg-gray-100 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700/80 rounded-xl px-2.5 py-1.5 shadow-xs">
              <Filter size={13} className="text-gray-400 mr-2 shrink-0" />
              <select
                value={selectedSquadFilter}
                onChange={(e) => setSelectedSquadFilter(e.target.value)}
                className="bg-transparent text-xs font-bold text-gray-800 dark:text-gray-200 outline-none cursor-pointer pr-1"
              >
                <option value="All">All Squads ({roster.length})</option>
                {availableSquads.map(sq => (
                  <option key={sq.id || sq.name} value={sq.name}>
                    {sq.name} ({roster.filter(a => (a.squad || '').toLowerCase() === sq.name.toLowerCase()).length})
                  </option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div className="flex items-center bg-gray-100 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700/80 rounded-xl px-3 py-1.5 shadow-xs focus-within:border-emerald-500 w-44 sm:w-56">
              <Search size={13} className="text-gray-400 mr-2 shrink-0" />
              <input
                type="text"
                placeholder="Search athlete or bib..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-xs text-gray-800 dark:text-white outline-none w-full placeholder:text-gray-400"
              />
            </div>

            {/* Select All Toggle */}
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
            >
              {allFilteredSelected ? (
                <CheckSquare size={14} className="text-emerald-500" />
              ) : (
                <Square size={14} className="text-gray-400" />
              )}
              <span>{allFilteredSelected ? 'Deselect All' : 'Select All'}</span>
            </button>
          </div>

          {/* Right: Layout Toggle & Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Layout Mode */}
            <div className="flex items-center bg-gray-100 dark:bg-slate-800 p-1 rounded-xl border border-gray-200 dark:border-slate-700">
              <button
                onClick={() => setBadgeLayout('6_per_page')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                  badgeLayout === '6_per_page'
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
                title="6 standard badges per A4 page (85x55mm)"
              >
                6 / Sheet (Lanyard)
              </button>
              <button
                onClick={() => setBadgeLayout('4_per_page')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                  badgeLayout === '4_per_page'
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
                title="4 large chest bibs per A4 page"
              >
                4 / Sheet (Chest Bibs)
              </button>
            </div>

            {/* Direct Browser Print Button */}
            <button
              onClick={handlePrint}
              disabled={filteredAthletes.filter(a => selectedAthleteIds.has(a.id || a.bib || a.name)).length === 0}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-800 dark:text-white rounded-xl text-xs font-bold border border-gray-200 dark:border-slate-700 transition shadow-xs disabled:opacity-50"
              title="Print directly to physical printer via browser"
            >
              <Printer size={14} />
              <span>Print Now</span>
            </button>

            {/* Download PDF Button */}
            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf || filteredAthletes.filter(a => selectedAthleteIds.has(a.id || a.bib || a.name)).length === 0}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-black shadow-md transition disabled:opacity-50"
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Generating {pdfProgress}%</span>
                </>
              ) : (
                <>
                  <Download size={14} />
                  <span>Download PDF Sheet</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Selected Counter Strip */}
        <div className="px-6 py-2 bg-emerald-500/10 dark:bg-emerald-950/20 border-b border-emerald-500/20 flex items-center justify-between text-xs no-print">
          <span className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
            <Users size={13} />
            <span>
              {filteredAthletes.filter(a => selectedAthleteIds.has(a.id || a.bib || a.name)).length} of {filteredAthletes.length} athletes selected for credential printing
            </span>
          </span>
          <span className="font-mono text-[11px] text-gray-500 dark:text-slate-400">
            {badgeLayout === '6_per_page' ? 'Standard 88x80mm Badge Card' : 'Expanded 88x120mm Chest Bib'}
          </span>
        </div>

        {/* Badge Card Grid Preview Area */}
        <div 
          id="printable-badge-stage" 
          className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50/50 dark:bg-slate-950/30"
        >
          {filteredAthletes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users size={36} className="text-gray-400 mb-3" />
              <h3 className="text-base font-bold text-gray-800 dark:text-gray-200">No athletes match criteria</h3>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                Try selecting a different squad or clearing your search term.
              </p>
            </div>
          ) : (
            <div className={`grid gap-4 sm:gap-5 ${
              badgeLayout === '6_per_page' 
                ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' 
                : 'grid-cols-1 md:grid-cols-2'
            }`}>
              {filteredAthletes.map((athlete) => {
                const key = athlete.id || athlete.bib || athlete.name;
                const isSelected = selectedAthleteIds.has(key);
                const squadColor = getSquadColor(athlete.squad);
                const qrVal = athlete.rfidUid || athlete.bib || athlete.id || athlete.name;

                return (
                  <div
                    key={key}
                    onClick={() => toggleAthlete(key)}
                    className={`relative rounded-2xl border-2 transition-all cursor-pointer overflow-hidden flex flex-col justify-between bg-white dark:bg-slate-900 shadow-sm hover:shadow-md ${
                      isSelected 
                        ? 'border-emerald-500 ring-2 ring-emerald-500/20' 
                        : 'border-dashed border-gray-300 dark:border-slate-800 opacity-60 hover:opacity-90'
                    }`}
                  >
                    {/* Header Strip */}
                    <div className="bg-slate-950 text-white px-3.5 py-2 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-black tracking-wider uppercase text-emerald-400 font-mono">
                          VELOCITY LAB
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span 
                          className="px-2 py-0.5 rounded-md text-[9px] font-bold text-slate-950 uppercase tracking-wider"
                          style={{ backgroundColor: squadColor }}
                        >
                          {athlete.squad || 'Track & Field'}
                        </span>
                        <div className="no-print">
                          {isSelected ? (
                            <CheckSquare size={14} className="text-emerald-400" />
                          ) : (
                            <Square size={14} className="text-gray-500" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card Content */}
                    <div className="p-3.5 flex flex-col items-center flex-1">
                      {/* Name & BIB Header */}
                      <div className="w-full flex items-start justify-between gap-2 mb-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-black text-gray-900 dark:text-white truncate">
                            {athlete.name || 'Unnamed Athlete'}
                          </h4>
                          <span className="text-[10px] text-gray-500 dark:text-slate-400 block truncate">
                            {[athlete.sport || 'Track & Field', athlete.age ? `${athlete.age} yrs` : null, athlete.gender === 'F' ? 'Female' : 'Male'].filter(Boolean).join(' • ')}
                          </span>
                        </div>
                        <span className="px-2 py-1 rounded-lg bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs font-mono font-black text-gray-900 dark:text-white shrink-0">
                          BIB #{athlete.bib || '--'}
                        </span>
                      </div>

                      {/* Centered QR Canvas Box */}
                      <div className="p-2 rounded-xl bg-white border border-gray-200 dark:border-slate-700 shadow-xs flex flex-col items-center justify-center my-1">
                        <QRCodeCanvas
                          value={qrVal}
                          size={badgeLayout === '6_per_page' ? 120 : 150}
                          level="H"
                          includeMargin={true}
                        />
                      </div>

                      {/* Scannable ID Text */}
                      <span className="text-[10px] font-mono font-bold text-gray-600 dark:text-slate-400 mt-2">
                        SCAN ID: <span className="text-emerald-600 dark:text-emerald-400">{qrVal}</span>
                      </span>
                    </div>

                    {/* Bottom Security Banner */}
                    <div className="bg-gray-50 dark:bg-slate-950/60 border-t border-gray-200 dark:border-slate-800/80 px-3 py-1.5 flex items-center justify-between text-[9px] text-gray-400">
                      <span className="font-mono">PASS #0{athlete.bib || '0'}</span>
                      <span className="uppercase tracking-wider font-semibold">COMBINE VERIFIED</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-gray-200 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-950/40 flex items-center justify-between no-print">
          <span className="text-xs text-gray-500 dark:text-slate-400">
            Tip: Compatible with card stock, peel-off sticker sheets, or standard A4 paper for lanyard sleeves.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-bold text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-800 transition"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
