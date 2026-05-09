/**
 * Standalone labelize for the J-USE PDF Re-Render Tool.
 *
 * Mirrors the form's enrichDataForRenderer logic, but uses a bundled
 * label dictionary instead of querying the form's DOM. Idempotent:
 * raw codes get translated to friendly labels; values that already
 * look like labels are left unchanged.
 *
 * EXCLUSIONS (intentional — match the production form):
 *   - pathway and housingVulnerability are NOT labelized here. The
 *     renderer (pdf-sections.js) has its own labelizer for both that
 *     expects raw codes ('market'/'hybrid'/'public', 'direct'/
 *     'partial'/'no'). Sending labels would break those branches.
 *
 * Authored for the standalone re-render tool; safe to run with no
 * backend, no counter, no Sheet writes.
 */

'use strict';

// Bundled at build time from the production form HTML. To refresh:
//   cd juse-pdf-rerender-repo
//   python3 ../scripts/extract-label-dict.py  (regenerates labelDict.json)
// Then this file picks up the new dict via fetch on first render.
var LABEL_DICT = null;

// Lists mirror the form's enrichDataForRenderer allowlists, MINUS pathway
// and housingVulnerability (renderer handles those itself).
var MULTI_VALUE_FIELDS = [
  'nbcsIntervention', 'nbcsSecondary', 'climateChallenge', 'hazards',
  'copingMechanisms', 'targetGroups', 'socialBenefits', 'learningFormat',
  'maintenanceFunding', 'priorityNeeds', 'systemFlows', 'hybridPublicGoods',
  'genderConsiderations', 'publicBeneficiaries'
];

var SINGLE_VALUE_FIELDS = [
  'regType', 'orgCategory', 'orgParish', 'parish', 'classification',
  'contactGender', 'marketCustomer', 'marketRevenue', 'marketOMCoverage',
  'hybridMarketPct', 'hybridAnchorPartner', 'publicAgencyAdopt', 'publicNDCAlign',
  'maintenanceDuration', 'accessibilityNeeds', 'capacityAccessibilityNeeds',
  'bankAccount', 'benefitIntensity', 'benefitTiming', 'scalingPotential'
];

function getLabelForCode(field, code) {
  if (code === null || code === undefined || code === '') return code;
  if (!LABEL_DICT || !LABEL_DICT[field]) return code;
  // Idempotent: if the value isn't a known code in this field's dict,
  // it might already be a label (e.g., from a recently-submitted
  // application that was already labelized at submit time). Pass through.
  if (Object.prototype.hasOwnProperty.call(LABEL_DICT[field], code)) {
    return LABEL_DICT[field][code];
  }
  return code;
}

function labelizeOne(field, value) {
  return getLabelForCode(field, value);
}

function labelizeArray(field, codes) {
  if (codes === null || codes === undefined || codes === '') return codes;
  // Single-string case: FormData serialises 1 ticked checkbox as a string.
  if (typeof codes === 'string') return getLabelForCode(field, codes);
  if (!Array.isArray(codes)) return codes;
  return codes.map(function (c) { return getLabelForCode(field, c); });
}

/**
 * Apply labelize transformations to a flat application-data object.
 * @param {Object} data - Raw form data (from Sheet JSON column or PocketBase export).
 * @returns {Object} Enriched data ready for the renderer.
 */
function standaloneLabelize(data) {
  if (!LABEL_DICT) {
    throw new Error('Label dictionary not loaded yet. Try again in a moment.');
  }
  var out = {};
  // Shallow clone first
  Object.keys(data).forEach(function (k) { out[k] = data[k]; });

  // Multi-value arrays
  MULTI_VALUE_FIELDS.forEach(function (f) {
    out[f] = labelizeArray(f, out[f]);
  });
  // Single-value selects/radios
  SINGLE_VALUE_FIELDS.forEach(function (f) {
    if (out[f]) out[f] = labelizeOne(f, out[f]);
  });

  // ---- Date fields — normalize ISO timestamps to "Month D, YYYY" -----
  // Sheet stores dates as Date objects → JSON.stringify produces ISO
  // strings like "2026-01-09T05:00:00.000Z", which the renderer just
  // surfaces verbatim. Format them to match the rest of the document.
  ['startDate', 'endDate', 'authDate', 'dateOfFormation'].forEach(function (f) {
    var v = out[f];
    if (!v) return;
    // Skip if already in a friendly format (no "T" suggests it's not ISO)
    if (typeof v === 'string' && v.indexOf('T') < 0 && v.indexOf('-') !== 4) return;
    try {
      var d = new Date(v);
      if (isNaN(d.getTime())) return;
      out[f] = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch (e) { /* leave as-is on parse failure */ }
  });

  // ---- TNA reshape — the rebuild endpoint returns tnaMatrix with
  // friendly labels in competency, but the renderer looks up flat tna_*
  // fields via Strategy 3 (codes like 'tna_climate'). Reverse-map each
  // row's label to its tna_X code and populate flat fields, so the
  // renderer's standard fallback path picks them up. -----
  if (Array.isArray(out.tnaMatrix) && out.tnaMatrix.length) {
    var TNA_LABEL_TO_KEY = {
      'climate science / ndc alignment':       'tna_climate',
      'grant compliance + reporting':           'tna_grant',
      'business model design':                  'tna_business',
      'value chain / market':                   'tna_value',
      'native species + ecology':               'tna_native',
      'nbcs design':                            'tna_nbcs_design',
      'systems thinking':                       'tna_system',
      'planning + project management':          'tna_planning',
      'm&e + impact measurement':               'tna_me',
      'disaggregated data':                     'tna_disagg',
      'gender-responsive design':               'tna_gender',
      'community engagement':                   'tna_community',
      'stakeholder engagement':                 'tna_stakeholder',
      'digital tools + tech':                   'tna_digital',
      'budgeting':                              'tna_budget',
      'co-financing':                           'tna_cofin'
    };
    out.tnaMatrix.forEach(function (row) {
      var label = String(row.competency || row.competency_area || '').toLowerCase().trim();
      var key = TNA_LABEL_TO_KEY[label];
      if (!key) return;
      var score = row.score || row.level || row.value || '';
      if (score && !out[key]) out[key] = score;
    });
  }

  // ---- Reverse-map pathway and housingVulnerability back to raw codes.
  //      Some submissions (e.g. JUSE-2026-000008) were submitted while the
  //      OLDER form had pathway/housingVulnerability in its labelize
  //      allowlist, so the Sheet stores the labelized strings instead of
  //      raw codes. The renderer's own labelizer expects exact-match raw
  //      codes ('market'/'hybrid'/'public', 'direct'/'partial'/'no'); long
  //      labels fall through and render as 'Not provided'.
  //      Convert labels back to codes when needed so the renderer succeeds. -----
  (function () {
    var pw = String(out.pathway || '').toLowerCase();
    if (pw && pw !== 'market' && pw !== 'hybrid' && pw !== 'public') {
      if (pw.indexOf('revenue-generating') >= 0 || pw.indexOf('revenue generating') >= 0) out.pathway = 'market';
      else if (pw.indexOf('blended') >= 0 || pw.indexOf('hybrid') >= 0) out.pathway = 'hybrid';
      else if (pw.indexOf('community benefit') >= 0 || pw.indexOf('public goods') >= 0 || pw.indexOf('public good') >= 0) out.pathway = 'public';
    }
    var hv = String(out.housingVulnerability || '').toLowerCase();
    if (hv && hv !== 'direct' && hv !== 'partial' && hv !== 'no') {
      // Order matters: the "No — Not a focus" label CONTAINS the word
      // "directly" (in "does not directly address..."), so a naive
      // `indexOf('direct')` check would mis-tag a "no" answer as "direct".
      // Disambiguate by emoji prefix first (🟢/🟡/⚪), then by the more
      // specific "not a focus"/"no —" text, then "partial"/"indirect",
      // and only fall through to the bare "direct" check last.
      if (hv.indexOf('🟢') >= 0) out.housingVulnerability = 'direct';
      else if (hv.indexOf('🟡') >= 0) out.housingVulnerability = 'partial';
      else if (hv.indexOf('⚪') >= 0) out.housingVulnerability = 'no';
      else if (hv.indexOf('not a focus') >= 0 || /^no\b/.test(hv) || /\bno\s*—/.test(hv)) out.housingVulnerability = 'no';
      else if (hv.indexOf('partial') >= 0 || hv.indexOf('indirect') >= 0) out.housingVulnerability = 'partial';
      else if (/\bdirectly\s+(target|address|impact)/.test(hv) || /^🟢|^yes\b|directly and centrally/.test(hv)) out.housingVulnerability = 'direct';
    }
  })();

  // Reference number — accept either ref_number or referenceNumber
  if (!out.ref_number && out.referenceNumber) out.ref_number = out.referenceNumber;
  if (!out.referenceNumber && out.ref_number) out.referenceNumber = out.ref_number;

  // Submission date/time — derive from submittedAt for renderer cover/headers.
  // This is the "Submitted on …" line, distinct from the footer "Generated on …".
  // The renderer reads data.submission_date / data.submission_time separately;
  // without this the cover + page headers render 'Submitted Not provided at
  // Not provided' even when submittedAt is populated.
  (function () {
    if (out.submission_date && out.submission_time) return;
    var iso = out.submittedAt || new Date().toISOString();
    var d;
    try { d = new Date(iso); } catch (e) { d = new Date(); }
    if (isNaN(d.getTime())) d = new Date();
    if (!out.submission_date) {
      // Force Jamaica timezone (EST year-round, UTC-5) so the displayed
      // date matches the applicant's local time regardless of which
      // browser does the re-render.
      out.submission_date = d.toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Jamaica'
      });
    }
    if (!out.submission_time) {
      out.submission_time = d.toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Jamaica'
      });
    }
  })();

  // Footer 'Generated on …' — use the highest-fidelity timestamp available so
  // re-renders reproduce the ORIGINAL PDF footer byte-for-byte.
  // Precedence:
  //   1. generationTimestamp        — captured by the form at the exact moment
  //                                   the user opened the print dialog (Task C,
  //                                   going-forward submissions)
  //   2. manualGenerationTimestamp  — typed into the standalone re-render tool
  //                                   by the user, read off the original PDF's
  //                                   footer (Task B, the 4 historical PDFs)
  //   3. pdfGeneratedAt             — Drive file dateCreated (within seconds of
  //                                   the original Save-PDF click)
  //   4. submittedAt                — Submit-click moment (drift of minutes)
  //   5. now                        — last resort
  (function () {
    if (out.generationDate && out.generationTime) return;
    var iso = out.generationTimestamp
           || out.manualGenerationTimestamp
           || out.pdfGeneratedAt
           || out.submittedAt
           || new Date().toISOString();
    var d;
    try { d = new Date(iso); } catch (e) { d = new Date(); }
    if (isNaN(d.getTime())) d = new Date();
    if (!out.generationDate) {
      out.generationDate = d.toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Jamaica'
      });
    }
    if (!out.generationTime) {
      out.generationTime = d.toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Jamaica'
      });
    }
  })();

  // ---- 'Priority Capacity Building Needs' sub-section reads
  //      data.capacityBuildingNeeds, but the form never captures that
  //      field — only sample data populates it. Real applicants' priority
  //      selections live in data.priorityNeeds. Alias the two so the
  //      sub-section renders the actual user-entered priorities. -----
  if (!out.capacityBuildingNeeds && out.priorityNeeds) {
    out.capacityBuildingNeeds = out.priorityNeeds;
  }
  // Same pattern for 'Preferred Learning Formats' — the renderer reads
  // data.preferredLearningFormats which the form never captures. Alias
  // from learningFormat (the user-entered multi-select).
  if (!out.preferredLearningFormats && out.learningFormat) {
    out.preferredLearningFormats = out.learningFormat;
  }
  // Same for 'Accessibility Accommodations' — Section 8 reads
  // capacityAccessibilityNeeds/Details. Form aliases at submit time but
  // historical submissions may only have accessibilityNeeds/Details.
  if (!out.capacityAccessibilityNeeds && out.accessibilityNeeds) {
    out.capacityAccessibilityNeeds = out.accessibilityNeeds;
  }
  if (!out.capacityAccessibilityDetails && out.accessibilityDetails) {
    out.capacityAccessibilityDetails = out.accessibilityDetails;
  }

  // ---- Labelize enablersDetail rows. The Sheet stores enabler_name as
  //      raw codes ('policy', 'technical_capacity', 'data_systems', etc.).
  //      Renderer surfaces these directly. Look each one up in the
  //      enablers dict so the PDF reads 'Policy/Regulatory Support' etc. ----
  if (Array.isArray(out.enablersDetail)) {
    out.enablersDetail = out.enablersDetail.map(function (e) {
      var code = e.enablerName || e.enablerLabel || '';
      var label = getLabelForCode('enablers', code) || code;
      return Object.assign({}, e, {
        enablerName:  label,  // friendly name for display
        enablerLabel: label
      });
    });
  }

  // ---- Labelize document type codes + map snake_case → camelCase
  //      field names. The renderer reads doc.documentType / doc.fileName /
  //      doc.fileUrl (camelCase). The rebuild endpoint returns the Sheet's
  //      snake_case columns (file_name, file_url) and the form's input-
  //      name codes ('regCertificate', 'orgCapacity', etc.). Map both to
  //      what the renderer expects, using the same friendly labels the
  //      form's own enrichDataForRenderer used at submit time. -----
  var DOC_TYPE_LABELS = {
    'regCertificate':   'Registration Certificate',
    'orgCapacity':      'Organisational Experience / Capacity Statement',
    'budgetBreakdown':  'Budget Workbook',
    'letterOfIntent':   'Letter of Intent'
  };
  if (Array.isArray(out.documents)) {
    out.documents = out.documents.map(function (d) {
      var code = d.documentType || '';
      var label = DOC_TYPE_LABELS[code] || code;
      return {
        documentType: label,
        fileName: d.fileName || d.file_name || '',
        fileUrl:  d.fileUrl  || d.file_url  || '',
        // preserve snake_case versions too in case anything else reads them
        file_name: d.file_name || d.fileName || '',
        file_url:  d.file_url  || d.fileUrl  || '',
        mime_type: d.mime_type || ''
      };
    });
  }

  // ---- Benefit traceability — labelize raw sector codes if the row's
  // sector is one of the 9 known codes (drr/food/health/etc.). The form
  // does this via DOM lookup, but historical/backfill submissions may
  // arrive with raw codes that the renderer would otherwise display
  // as "drr" instead of "Disaster Risk Reduction". Idempotent: already-
  // labeled values pass through untouched. -----
  if (Array.isArray(out.benefitTraceability)) {
    var SECTOR_LABELS = {
      'drr':         'Disaster Risk Reduction',
      'food':        'Food Security & Agriculture',
      'health':      'Health & Wellbeing',
      'livelihoods': 'Livelihoods & Economy',
      'education':   'Education & Awareness',
      'ecosystem':   'Ecosystem Services',
      'energy':      'Energy & Infrastructure',
      'governance':  'Governance & Policy',
      'other':       'Other'
    };
    out.benefitTraceability.forEach(function (bt) {
      var s = String(bt.sector || '').trim().toLowerCase();
      if (s && SECTOR_LABELS[s]) bt.sector = SECTOR_LABELS[s];
    });
  }

  // ---- Benefit traceability — populate the empty 'verification' column.
  // The form never captured a per-row verification field, but each outcome
  // metric has a 'how_measured' (outcomeMeasured) describing exactly how
  // it'll be verified. Map by outcome name; fall back to index. -----
  if (Array.isArray(out.benefitTraceability) && Array.isArray(out.outcomeMetrics)) {
    var byName = {};
    out.outcomeMetrics.forEach(function (om) {
      var n = String(om.outcomeName || '').trim();
      if (n) byName[n] = om.outcomeMeasured || '';
    });
    out.benefitTraceability.forEach(function (bt, i) {
      if (bt.verification) return;
      var name = String(bt.outcomeLabel || '').trim();
      var verif = byName[name];
      if (!verif && out.outcomeMetrics[i]) verif = out.outcomeMetrics[i].outcomeMeasured || '';
      if (verif) bt.verification = verif;
    });
  }

  return out;
}

// Load the bundled label dictionary once on script load.
(function loadDict() {
  fetch('labelDict.json?ts=' + Date.now())
    .then(function (r) { return r.json(); })
    .then(function (j) { LABEL_DICT = j; })
    .catch(function (e) { console.error('Failed to load labelDict.json:', e); });
})();
