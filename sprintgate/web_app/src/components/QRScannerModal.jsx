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

import React, { useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X } from 'lucide-react';

/**
 * QRScannerModal.jsx
 * Velocity Lab - Lazy-Loaded Camera Scanner Modal
 * 
 * Bundles html5-qrcode on-demand so camera scanning libraries
 * are never downloaded until a coach explicitly clicks "Scan QR".
 */
export default function QRScannerModal({ onScan, onClose, title = "Scan Athlete QR" }) {
  useEffect(() => {
    let html5QrCode = null;
    try {
      html5QrCode = new Html5Qrcode("queue-reader");
      html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          if (html5QrCode) {
            html5QrCode.stop()
              .then(() => onScan(decodedText))
              .catch(() => onScan(decodedText));
          }
        },
        () => {} // ignore frame read failures
      ).catch(err => {
        console.error("Camera access failed", err);
      });
    } catch (e) {
      console.warn("Failed to initialize html5-qrcode scanner:", e);
    }

    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(() => {});
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl max-w-sm w-full relative flex flex-col items-center shadow-2xl border border-gray-200 dark:border-slate-800">
        <div className="w-full flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{title}</h2>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
          >
            <X size={18} />
          </button>
        </div>
        <div className="w-full bg-black rounded-2xl overflow-hidden mb-5 relative border border-slate-800" style={{ minHeight: '250px' }}>
          <div id="queue-reader" className="w-full"></div>
        </div>
        <button 
          onClick={onClose} 
          className="w-full py-2.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-xl font-bold transition text-xs"
        >
          Cancel Scan
        </button>
      </div>
    </div>
  );
}
