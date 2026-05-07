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
  'genderConsiderations'
];

var SINGLE_VALUE_FIELDS = [
  'regType', 'orgCategory', 'orgParish', 'parish', 'classification',
  'contactGender', 'marketCustomer', 'marketRevenue', 'marketOMCoverage',
  'hybridMarketPct', 'hybridAnchorPartner', 'publicAgencyAdopt', 'publicNDCAlign',
  'maintenanceDuration', 'accessibilityNeeds', 'capacityAccessibilityNeeds',
  'bankAccount', 'benefitIntensity', 'benefitTiming'
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
      if (hv.indexOf('partial') >= 0 || hv.indexOf('indirect') >= 0) out.housingVulnerability = 'partial';
      else if (hv.indexOf('direct') >= 0) out.housingVulnerability = 'direct';
      else if (hv.indexOf('not a focus') >= 0 || hv.indexOf('no —') >= 0 || /^no\b/.test(hv)) out.housingVulnerability = 'no';
    }
  })();

  // Reference number — accept either ref_number or referenceNumber
  if (!out.ref_number && out.referenceNumber) out.ref_number = out.referenceNumber;
  if (!out.referenceNumber && out.ref_number) out.referenceNumber = out.ref_number;

  // Submission date/time — derive from submittedAt for renderer cover/headers.
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
      out.submission_date = d.toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
      });
    }
    if (!out.submission_time) {
      out.submission_time = d.toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit', hour12: true
      });
    }
  })();

  // Footer 'Generated on …' should reflect the submission time, not the
  // wall-clock time of this re-render. Pin it to submission_date/time.
  if (!out.generationDate && out.submission_date) out.generationDate = out.submission_date;
  if (!out.generationTime && out.submission_time) out.generationTime = out.submission_time;

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

  // ---- Labelize document type codes. The Sheet stores documentType as
  //      the form's input name ('regCertificate', 'orgCapacity', etc.).
  //      The renderer uppercases these for display, producing
  //      'REGCERTIFICATE' etc. Map to friendly section headers. -----
  var DOC_TYPE_LABELS = {
    'letterOfIntent':   'Letter of Intent and Authorisation',
    'budgetBreakdown':  'Detailed Budget Breakdown',
    'regCertificate':   'Organisation Registration Certificate',
    'orgCapacity':      'Organisational Capacity / Previous Work'
  };
  if (Array.isArray(out.documents)) {
    out.documents = out.documents.map(function (d) {
      var code = d.documentType || '';
      var label = DOC_TYPE_LABELS[code] || code;
      return Object.assign({}, d, { documentType: label });
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
