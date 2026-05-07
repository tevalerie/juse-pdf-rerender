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
  'hybridAnchorPartner', 'publicAgencyAdopt', 'publicNDCAlign',
  'maintenanceDuration', 'accessibilityNeeds', 'capacityAccessibilityNeeds',
  'bankAccount'
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

  return out;
}

// Load the bundled label dictionary once on script load.
(function loadDict() {
  fetch('labelDict.json?ts=' + Date.now())
    .then(function (r) { return r.json(); })
    .then(function (j) { LABEL_DICT = j; })
    .catch(function (e) { console.error('Failed to load labelDict.json:', e); });
})();
