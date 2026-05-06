/**
 * J-USE REOI 2026 Full Application PDF Renderer — Core Engine
 *
 * Provides data population helpers and the main renderFullApplicationPDF()
 * entry point. Delegates field population to pdf-sections.js and
 * dynamic table rendering to pdf-tables.js.
 *
 * Authored by T. Valerie Onu, c/o Audrey Richards, Sustainable Financing
 * Mechanism Specialist and Team, Edge Catalyst Finance
 */

'use strict';

/* ==========================================================================
   HELPERS — resolve, set, and format data values into the DOM
   ========================================================================== */

/**
 * Resolve a field value: null/undefined/"" → "Not provided";
 * arrays → joined with ", "; otherwise → string.
 */
function v(field) {
  if (field === null || field === undefined || field === '') return 'Not provided';
  if (Array.isArray(field)) return field.length > 0 ? field.join(', ') : 'Not provided';
  return String(field);
}

/**
 * Resolve a field but return "—" instead of "Not provided" for
 * numbers, percentages, and optional counts.
 */
function n(field) {
  if (field === null || field === undefined || field === '') return '—';
  return String(field);
}

/**
 * Set textContent on all elements matching a data-field selector.
 * Supports data-prefix siblings and optional hide-if-empty for parent <tr>.
 */
function setField(fieldName, value, hideIfEmpty) {
  var els = document.querySelectorAll('[data-field="' + fieldName + '"]');
  var resolved = v(value);
  els.forEach(function (el) {
    var prefix = el.getAttribute('data-prefix');
    if (prefix) {
      el.textContent = (value && value !== '') ? prefix + v(value) : '';
      if (hideIfEmpty && (!value || value === '')) {
        el.style.display = 'none';
      } else {
        el.style.display = '';
      }
    } else {
      el.textContent = resolved;
    }
  });

  // Hide parent <tr> if value is empty
  if (hideIfEmpty && (!value || value === '')) {
    var trs = document.querySelectorAll('[data-hide-if-empty="' + fieldName + '"]');
    trs.forEach(function (tr) {
      tr.style.display = 'none';
    });
  }
}

/**
 * Set textContent on all elements matching a data-field selector using
 * raw value (no "Not provided" fallback — returns empty string instead).
 */
function setRawField(fieldName, value) {
  var els = document.querySelectorAll('[data-field="' + fieldName + '"]');
  els.forEach(function (el) {
    el.textContent = (value !== null && value !== undefined && value !== '')
      ? String(value)
      : '';
  });
}

/**
 * Set innerHTML on all elements matching a data-field selector.
 * Used for dynamic table bodies and rich content blocks.
 */
function setHTML(fieldName, html) {
  var els = document.querySelectorAll('[data-field="' + fieldName + '"]');
  els.forEach(function (el) {
    el.innerHTML = html;
  });
}

/* ==========================================================================
   MAIN ENTRY POINT
   ========================================================================== */

/**
 * Render the full J-USE REOI 2026 application PDF.
 *
 * This is the single public API called by the PDF generation pipeline.
 * It delegates to:
 *   - populatePDFSections(data)  — defined in pdf-sections.js
 *   - renderPDFTables(data)      — defined in pdf-tables.js
 *
 * @param {Object} data - Application data object (PocketBase-compatible schema)
 */
function renderFullApplicationPDF(data) {
  if (!data) return;

  // Resolve reference number (available for all downstream functions)
  var refNum = v(data.ref_number);

  // 1) Populate all scalar / description-block fields (pdf-sections.js)
  if (typeof populatePDFSections === 'function') {
    populatePDFSections(data);
  }

  // 2) Render all dynamic loop-driven tables (pdf-tables.js)
  if (typeof renderPDFTables === 'function') {
    renderPDFTables(data);
  }

  // 3) Generation timestamp (final footer)
  var genDate = data.generationDate || '';
  var genTime = data.generationTime || '';
  if (!genDate || !genTime) {
    var now = new Date();
    var months = [
      'January','February','March','April','May','June',
      'July','August','September','October','November','December'
    ];
    genDate = months[now.getMonth()] + ' ' + now.getDate() + ', ' + now.getFullYear();
    var hours = now.getHours();
    var ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    var mins = now.getMinutes() < 10 ? '0' + now.getMinutes() : now.getMinutes();
    genTime = hours + ':' + mins + ' ' + ampm;
  }
  var tsEl = document.querySelector('[data-field="generationTimestamp"]');
  if (tsEl) {
    tsEl.textContent = 'Generated on ' + genDate + ' at ' + genTime;
  }
}
