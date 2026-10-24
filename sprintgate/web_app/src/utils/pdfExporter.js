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
 * pdfExporter.js
 * Velocity Lab - Dynamic PDF Engine Loader
 * 
 * Dynamically imports jsPDF and jspdf-autotable on demand so that the heavy
 * 800 KB PDF binary chunks are never downloaded until a user triggers an export.
 */

let cachedPdfEngine = null;

export async function getPdfEngine() {
  if (cachedPdfEngine) return cachedPdfEngine;

  try {
    const [jsPdfModule, autoTableModule] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable')
    ]);

    const jsPDF = jsPdfModule.default;
    const autoTable = autoTableModule.default;
    const applyPlugin = autoTableModule.applyPlugin;

    try {
      if (typeof applyPlugin === 'function') {
        applyPlugin(jsPDF);
      }
    } catch (e) {
      console.warn("jspdf-autotable applyPlugin:", e);
    }

    if (typeof jsPDF === 'function' && jsPDF.prototype && !jsPDF.prototype.autoTable) {
      jsPDF.prototype.autoTable = function(options) {
        return autoTable(this, options);
      };
    }

    cachedPdfEngine = { jsPDF, autoTable };
    return cachedPdfEngine;
  } catch (err) {
    console.error("Failed to load PDF engine dynamically:", err);
    throw err;
  }
}
