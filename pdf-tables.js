/**
 * J-USE REOI 2026 Full Application PDF Renderer — Dynamic Table Rendering
 *
 * Renders all loop-driven tables and dynamic HTML blocks that require
 * iterating over arrays from the application data object.
 *
 * Depends on: v(), setHTML() from pdf-core.js
 *
 * Tables rendered:
 *   - outcomeMetrics          (Section 3 — 4-column)
 *   - focusLenses             (Section 3 — 2-column)
 *   - benefitTraceability     (Section 4 — 7-column with Intensity/Timing)
 *   - implementationStructure (Section 6 — 3-column from implementation_roles[] or flat)
 *   - enablersDetail          (Section 6 — dynamic .enabler-item blocks)
 *   - budgetBreakdown         (Section 7 — REMOVED; now uploaded Excel reference)
 *   - milestones              (Section 7 — REMOVED; no longer rendered)
 *   - iucnCriteria            (Section 8 — 5 description-blocks)
 *   - tnaMatrix               (Section 8 — 16 competency rows from tna_scores[] or flat)
 *   - documents               (Section 9 — grouped by documentType)
 *
 * Authored by T. Valerie Onu, c/o Audrey Richards, Sustainable Financing
 * Mechanism Specialist and Team, Edge Catalyst Finance
 */

'use strict';

/**
 * Derive the 6 Cross-Cutting Focus Lenses from data the applicant has
 * already provided in the form. Used as a fallback when the application
 * has no explicit focusLenses array (which is the case for every real
 * applicant — the form has no UI for these fields). The prefilled
 * sample/walkthrough still wins because it provides focusLenses directly.
 *
 * Each derivation rule produces a structured row:
 *   { lensName, selectedOption, selectedLabel }
 *   - lensName:       human-readable lens name (e.g. "Climate Additionality")
 *   - selectedOption: short rating tag (High/Medium/Low/Intentional/etc.)
 *   - selectedLabel:  one-line justification quoting the applicant's data
 *
 * @param {Object} data - Application data object (post-labelization)
 * @returns {Array<Object>} Six derived lens rows.
 */
function deriveFocusLenses(data) {
  function num(x) {
    if (x === null || x === undefined || x === '') return null;
    var n = Number(String(x).replace(/[^0-9.\-]/g, ''));
    return isFinite(n) ? n : null;
  }
  function arrHas(arr, needle) {
    // Tolerate single-string serialisations: when an applicant ticks only
    // one box in a multi-select, FormData stores the field as a string,
    // not an array. Treat it as a 1-element list.
    if (typeof arr === 'string') arr = arr ? [arr] : [];
    if (!Array.isArray(arr)) return false;
    var n = String(needle).toLowerCase();
    return arr.some(function (s) { return String(s).toLowerCase().indexOf(n) >= 0; });
  }
  function strHas(s, needle) {
    if (s === null || s === undefined) return false;
    return String(s).toLowerCase().indexOf(String(needle).toLowerCase()) >= 0;
  }

  var rows = [];

  // ---- 1. Climate Additionality -------------------------------------------
  var jr = num(data.juseRequest);
  var tc = num(data.totalCost);
  var addRatio = (jr !== null && tc !== null && tc > 0) ? jr / tc : null;
  var addOpt, addLbl;
  if (addRatio === null) {
    addOpt = 'Not assessable';
    addLbl = 'Total cost or J-USE request not provided.';
  } else if (addRatio >= 0.60) {
    addOpt = 'High';
    addLbl = 'J-USE grant is ' + Math.round(addRatio * 100) + '% of total project cost (catalytic — project unlikely to proceed at scale without it).';
  } else if (addRatio >= 0.30) {
    addOpt = 'Medium';
    addLbl = 'J-USE grant is ' + Math.round(addRatio * 100) + '% of total project cost (leverage — meaningful but not the largest share).';
  } else {
    addOpt = 'Low';
    addLbl = 'J-USE grant is ' + Math.round(addRatio * 100) + '% of total project cost (other capital is the primary driver).';
  }
  rows.push({ lensName: 'Climate Additionality', selectedOption: addOpt, selectedLabel: addLbl });

  // ---- 2. Gender ----------------------------------------------------------
  // genderConsiderations may arrive as array or single-string (FormData quirk
  // when only one box is ticked).
  var gcRaw = data.genderConsiderations;
  var gc = Array.isArray(gcRaw) ? gcRaw : (typeof gcRaw === 'string' && gcRaw ? [gcRaw] : []);
  var gcCount = gc.length;
  var hasWomenLed     = arrHas(gc, 'women-led') || arrHas(gc, 'women-majority');
  var hasTargetedWomen= arrHas(gc, 'targeted activities for women');
  var hasEqualAccess  = arrHas(gc, 'equal access');
  var hasGenderAnalysis = arrHas(gc, 'gender analysis');
  var hasGBV          = arrHas(gc, 'gbv') || arrHas(gc, 'gender-based violence');
  var womenPct = num(data.womenPct);
  var genderOpt, genderLbl;
  if (gcCount === 0) {
    genderOpt = 'Not addressed';
    genderLbl = 'No gender considerations indicated.';
  } else if (hasWomenLed || hasTargetedWomen || (hasGenderAnalysis && gcCount >= 3)) {
    genderOpt = 'Intentional';
    var pieces = [];
    if (hasWomenLed) pieces.push('women-led / women-majority project');
    if (hasTargetedWomen) pieces.push('targeted activities for women');
    if (hasGenderAnalysis) pieces.push('gender analysis conducted');
    if (hasGBV) pieces.push('GBV risk assessed');
    genderLbl = pieces.join(' + ');
    if (womenPct !== null) genderLbl += ' (' + womenPct + '% women beneficiaries).';
    else genderLbl += '.';
  } else if (hasEqualAccess || hasGenderAnalysis) {
    genderOpt = 'Mainstreamed';
    genderLbl = (hasGenderAnalysis ? 'Gender analysis conducted' : 'Equal access designed') +
      (womenPct !== null ? ' — ' + womenPct + '% women beneficiaries.' : '.');
  } else {
    genderOpt = 'Limited';
    genderLbl = 'One gender consideration selected (' + gc[0] + ').';
  }
  rows.push({ lensName: 'Gender', selectedOption: genderOpt, selectedLabel: genderLbl });

  // ---- 3. Youth -----------------------------------------------------------
  var tg = Array.isArray(data.targetGroups) ? data.targetGroups : [];
  var youthInTarget = arrHas(tg, 'youth');
  var youthPct = num(data.youthPct);
  var youthOpt, youthLbl;
  if (!youthInTarget) {
    youthOpt = 'Not addressed';
    youthLbl = 'Youth not selected as a target group.';
  } else if (youthPct !== null && youthPct >= 50) {
    youthOpt = 'Core';
    youthLbl = 'Youth (18–35) in target groups AND ' + youthPct + '% of beneficiaries are youth.';
  } else if (youthPct !== null && youthPct >= 25) {
    youthOpt = 'Strong';
    youthLbl = 'Youth in target groups; ' + youthPct + '% of beneficiaries are youth.';
  } else {
    youthOpt = 'Included';
    youthLbl = 'Youth in target groups' +
      (youthPct !== null ? ' (' + youthPct + '% of beneficiaries).' : '; specific share not stated.');
  }
  rows.push({ lensName: 'Youth', selectedOption: youthOpt, selectedLabel: youthLbl });

  // ---- 4. Vulnerability ---------------------------------------------------
  var vulnPct = num(data.vulnerablePct);
  var lowIncomePct = num(data.lowIncomePct);
  var hv = String(data.housingVulnerability || '').toLowerCase();
  var hvDirect  = strHas(hv, 'direct') && !strHas(hv, 'indirect');
  var hvPartial = strHas(hv, 'partial') || strHas(hv, 'indirect');
  var vulnOpt, vulnLbl;
  if (vulnPct === null && !hv) {
    vulnOpt = 'Not assessable';
    vulnLbl = 'Vulnerability metrics not provided.';
  } else if ((vulnPct !== null && vulnPct >= 50) || hvDirect) {
    vulnOpt = 'High';
    var pieces2 = [];
    if (vulnPct !== null) pieces2.push(vulnPct + '% vulnerable beneficiaries');
    if (hvDirect) pieces2.push('direct housing vulnerability');
    vulnLbl = pieces2.join(' + ') + '.';
  } else if ((vulnPct !== null && vulnPct >= 25) || hvPartial) {
    vulnOpt = 'Moderate';
    var pieces3 = [];
    if (vulnPct !== null) pieces3.push(vulnPct + '% vulnerable beneficiaries');
    if (hvPartial) pieces3.push('partial housing vulnerability');
    vulnLbl = pieces3.join(' + ') + '.';
  } else {
    vulnOpt = 'Low';
    vulnLbl = 'Beneficiaries report low direct vulnerability' +
      (vulnPct !== null ? ' (' + vulnPct + '%).' : '.');
  }
  rows.push({ lensName: 'Vulnerability', selectedOption: vulnOpt, selectedLabel: vulnLbl });

  // ---- 5. Disability Inclusion -------------------------------------------
  var an = String(data.accessibilityNeeds || '').toLowerCase();
  var can = String(data.capacityAccessibilityNeeds || '').toLowerCase();
  var disOpt, disLbl;
  var bothChannels = strHas(an, 'both') || strHas(can, 'both') ||
                     (strHas(an, 'yes') && strHas(can, 'yes'));
  var anyYes = strHas(an, 'yes') || strHas(can, 'yes');
  if (bothChannels) {
    disOpt = 'Inclusive';
    disLbl = 'Accommodations planned for both online and in-person activities.';
  } else if (anyYes) {
    disOpt = 'Accessible';
    var channel = strHas(an, 'online') || strHas(can, 'online') ? 'online / virtual' : 'in-person';
    disLbl = 'Accommodations planned for ' + channel + ' activities.';
  } else if (an || can) {
    disOpt = 'Not addressed';
    disLbl = 'No accessibility accommodations indicated.';
  } else {
    disOpt = 'Not assessable';
    disLbl = 'Accessibility fields not provided.';
  }
  rows.push({ lensName: 'Disability Inclusion', selectedOption: disOpt, selectedLabel: disLbl });

  // ---- 6. Financial Sustainability ---------------------------------------
  var pw = String(data.pathway || '').toLowerCase();
  var md = String(data.maintenanceDuration || '').toLowerCase();
  var mf = Array.isArray(data.maintenanceFunding) ? data.maintenanceFunding : [];
  var hasRevenueFunding = arrHas(mf, 'revenue') || arrHas(mf, 'self');
  var sustOpt, sustLbl;
  if (!pw && !md) {
    sustOpt = 'Plan unclear';
    sustLbl = 'Sustainability fields not provided.';
  } else if (strHas(pw, 'revenue') || strHas(pw, 'market') ||
             (strHas(md, 'perpetual') && hasRevenueFunding)) {
    sustOpt = 'Self-sustaining';
    sustLbl = 'Revenue-generating model' +
      (hasRevenueFunding ? '; maintenance funded from revenue.' :
       strHas(md, 'perpetual') ? '; maintenance designed to be perpetual.' : '.');
  } else if (strHas(pw, 'blended') || strHas(pw, 'hybrid')) {
    sustOpt = 'Hybrid';
    sustLbl = 'Blended Model with revenue + public-good streams' +
      (hasRevenueFunding ? '; maintenance funded from revenue.' : '.');
  } else if (strHas(pw, 'community benefit') || strHas(pw, 'public')) {
    if (hasRevenueFunding) {
      sustOpt = 'Hybrid';
      sustLbl = 'Community benefit model with some revenue in the maintenance funding mix.';
    } else {
      sustOpt = 'Grant-dependent';
      sustLbl = 'Community Benefit model; no revenue identified in maintenance funding mix.';
    }
  } else {
    sustOpt = 'Plan unclear';
    sustLbl = 'Pathway/maintenance fields incomplete.';
  }
  rows.push({ lensName: 'Financial Sustainability', selectedOption: sustOpt, selectedLabel: sustLbl });

  return rows;
}

/**
 * Helper: render a TNA radio level as a styled badge.
 * Maps beginner/intermediate/advanced/na to color-coded score-badge spans.
 */
function tnaBadge(level) {
  if (!level || level === '' || level === 'Not provided') return '<span style="color:#999;">Not provided</span>';
  var val = String(level).toLowerCase();
  var label = level;
  var cls = '';
  if (val === 'beginner' || val === 'basic') { cls = 'low'; label = 'Beginner'; }
  else if (val === 'intermediate') { cls = 'medium'; label = 'Intermediate'; }
  else if (val === 'advanced' || val === 'expert') { cls = ''; label = 'Advanced'; }
  else if (val === 'na' || val === 'not_applicable' || val === 'n/a') { label = 'N/A'; }
  return '<span class="score-badge ' + cls + '">' + label + '</span>';
}

/**
 * Render all dynamic tables and loop-driven HTML blocks.
 * Called by renderFullApplicationPDF() from pdf-core.js.
 *
 * @param {Object} data - Application data object
 */
function renderPDFTables(data) {

  /* ======================================================================
     SECTION 3: OUTCOME METRICS TABLE
     Expected array: [{outcomeName, outcomeBaseline, outcomeExpected, outcomeMeasured}]
     ====================================================================== */
  if (data.outcomeMetrics && data.outcomeMetrics.length > 0) {
    var omHtml = '';
    data.outcomeMetrics.forEach(function (row) {
      omHtml += '<tr>'
        + '<td>' + v(row.outcomeName) + '</td>'
        + '<td>' + v(row.outcomeBaseline) + '</td>'
        + '<td>' + v(row.outcomeExpected) + '</td>'
        + '<td>' + v(row.outcomeMeasured) + '</td>'
        + '</tr>';
    });
    setHTML('outcomeMetrics', omHtml);
  } else {
    setHTML('outcomeMetrics',
      '<tr><td colspan="4" style="color:#999; text-align:center; padding: 12px;">Not provided</td></tr>');
  }

  /* ======================================================================
     SECTION 3: CROSS-CUTTING FOCUS LENSES TABLE
     Expected array: [{lensName|name|label, selectedOption|option|value, selectedLabel?}]
     If the application has no explicit focusLenses array (real applicants
     don't — there's no form UI for these), derive the six lenses from
     fields the applicant has already provided. The walkthrough/sample
     still wins because it provides focusLenses directly.
     ====================================================================== */
  var lensesToRender = (data.focusLenses && data.focusLenses.length > 0)
    ? data.focusLenses
    : deriveFocusLenses(data);
  if (lensesToRender && lensesToRender.length > 0) {
    var flHtml = '';
    lensesToRender.forEach(function (row) {
      var lens  = v(row.lensName || row.name || row.label || row.lens || '');
      // Prefer the rich descriptive label when provided; fall back to the bare
      // option code so legacy data renders something rather than nothing.
      var optEl = row.selectedLabel || row.label_text ||
                  row.selectedOption || row.option || row.value || row.selected || '';
      flHtml += '<tr>'
        + '<td>' + lens + '</td>'
        + '<td>' + v(optEl) + '</td>'
        + '</tr>';
    });
    setHTML('focusLenses', flHtml);
  } else {
    setHTML('focusLenses',
      '<tr><td colspan="2" style="color:#999; text-align:center; padding: 12px;">Not provided</td></tr>');
  }

  /* ======================================================================
     SECTION 4: BENEFIT TRACEABILITY MATRIX TABLE
     Expected array: [{outcomeLabel, sector, groups, how, intensity, timing, verification}]
     Per-row intensity/timing with global fallback to benefitIntensity/benefitTiming.
     ====================================================================== */
  if (data.benefitTraceability && data.benefitTraceability.length > 0) {
    var btHtml = '';
    var globalIntensity = data.benefitIntensity || '';
    var globalTiming = data.benefitTiming || '';

    data.benefitTraceability.forEach(function (row) {
      // Per-row intensity/timing take precedence; fall back to global values
      var intensity = row.intensity || globalIntensity || '';
      var timing = row.timing || globalTiming || '';
      var verification = row.verification || '';

      btHtml += '<tr>'
        + '<td>' + v(row.outcomeLabel) + '</td>'
        + '<td>' + v(row.sector) + '</td>'
        + '<td>' + v(row.groups) + '</td>'
        + '<td>' + v(row.how) + '</td>'
        + '<td>' + (intensity ? v(intensity) : '<span style="color:#999;">Not provided</span>') + '</td>'
        + '<td>' + (timing ? v(timing) : '<span style="color:#999;">Not provided</span>') + '</td>'
        + '<td>' + (verification ? v(verification) : '<span style="color:#999;">Not provided</span>') + '</td>'
        + '</tr>';
    });
    setHTML('benefitTraceability', btHtml);
  } else {
    setHTML('benefitTraceability',
      '<tr><td colspan="7" style="color:#999; text-align:center; padding: 12px;">Not provided</td></tr>');
  }

  /* ======================================================================
     SECTION 6: IMPLEMENTATION STRUCTURE TABLE
     Primary: Loop from data.implementation_roles[] array.
     Fallback: 6 fixed roles from flat fields (implLead, implTechnical, etc.).
     ====================================================================== */
  var implData = [];

  // Check for implementation_roles array first
  if (data.implementation_roles && Array.isArray(data.implementation_roles) && data.implementation_roles.length > 0) {
    implData = data.implementation_roles.map(function (item) {
      return {
        role: v(item.role || item.roleName || ''),
        name: v(item.name || item.organization || item.entity || ''),
        resp: v(item.resp || item.responsibility || item.responsibilities || '')
      };
    });
  } else {
    // Fallback: build from flat fields (original 6 roles)
    implData = [
      { role: 'Implementation Lead',  name: data.implLead,        resp: data.implLeadResp },
      { role: 'Technical Partner',   name: data.implTechnical,    resp: data.implTechnicalResp },
      { role: 'Community Partner',   name: data.implCommunity,    resp: data.implCommunityResp },
      { role: 'Government Partner',  name: data.implGovernment,   resp: data.implGovernmentResp },
      { role: 'M&E Lead',            name: data.implME,           resp: data.implMEResp },
      { role: 'Financial Manager',   name: data.implFinancial,    resp: data.implFinancialResp }
    ];
  }

  var implHtml = '';
  var hasImpl = false;
  implData.forEach(function (r) {
    if (r.name !== 'Not provided' || r.resp !== 'Not provided') {
      hasImpl = true;
      implHtml += '<tr>'
        + '<td>' + r.role + '</td>'
        + '<td>' + r.name + '</td>'
        + '<td>' + r.resp + '</td>'
        + '</tr>';
    }
  });
  setHTML('implementationStructure',
    hasImpl
      ? implHtml
      : '<tr><td colspan="3" style="color:#999; text-align:center; padding: 12px;">Not provided</td></tr>');

  /* ======================================================================
     SECTION 6: IMPLEMENTATION ENABLERS
     Expected array: [{enablerLabel|enablerName, status, notes}]
     Rendered as .enabler-item blocks with header + body rows.
     ====================================================================== */
  if (data.enablersDetail && data.enablersDetail.length > 0) {
    var enHtml = '';
    data.enablersDetail.forEach(function (en) {
      enHtml += '<div class="enabler-item">'
        + '<div class="enabler-header">' + v(en.enablerLabel || en.enablerName) + '</div>'
        + '<div class="enabler-body">'
        + '<div class="enabler-row"><span class="enabler-label">Status:</span><span>' + v(en.status) + '</span></div>'
        + '<div class="enabler-row"><span class="enabler-label">Notes:</span><span>' + v(en.notes) + '</span></div>'
        + '</div></div>';
    });
    setHTML('enablersDetail', enHtml);
  } else {
    setHTML('enablersDetail', '<p style="font-size: 9pt; color: #999;">Not provided</p>');
  }

  /* ======================================================================
     SECTION 7: BUDGET BREAKDOWN — REMOVED
     Budget breakdown is now an uploaded Excel file.
     See description-block in juse-full-pdf-renderer.html Section 7.
     ====================================================================== */

  /* ======================================================================
     SECTION 7: KEY MILESTONES — REMOVED
     Key milestones section has been removed from the PDF renderer.
     ====================================================================== */

  /* ======================================================================
     SECTION 8: IUCN NbCS CRITERIA
     5 hardcoded criteria rendered as description-blocks.
     Flat fields: iucn_mitigation, iucn_biodiversity, iucn_governance,
                  iucn_tradeoffs, iucn_grant_compliance
     ====================================================================== */
  var iucnItems = [
    { label: '1. Climate Mitigation Impact', field: data.iucn_mitigation },
    { label: '2. Biodiversity Conservation', field: data.iucn_biodiversity },
    { label: '3. Governance',                 field: data.iucn_governance },
    { label: '4. Trade-offs',                 field: data.iucn_tradeoffs },
    { label: '5. Grant Compliance',           field: data.iucn_grant_compliance }
  ];

  // Check if ANY IUCN field has actual data
  var hasIucn = iucnItems.some(function (item) {
    return item.field !== null && item.field !== undefined && item.field !== '';
  });

  if (hasIucn) {
    var iucnHtml = '';
    iucnItems.forEach(function (item) {
      iucnHtml += '<div style="margin-bottom: 10px;">'
        + '<div style="font-weight: 700; font-size: 9pt; color: #2E8B57; margin-bottom: 4px;">' + item.label + '</div>'
        + '<div class="description-block">' + v(item.field) + '</div>'
        + '</div>';
    });
    setHTML('iucnCriteria', iucnHtml);
  } else {
    setHTML('iucnCriteria',
      '<p style="font-size: 9pt; color: #b35900; padding: 10px 14px; background: #fff8f0; border-left: 4px solid #e67e22; border-radius: 0 4px 4px 0; margin: 6px 0;">'
      + '&#9888; IUCN criteria not mapped &mdash; no NbCS standard criteria assessment data was provided for this application.</p>');
  }

  /* ======================================================================
     SECTION 8: TECHNICAL NEEDS ASSESSMENT (TNA) MATRIX
     Primary: Loop from data.tna_scores[] array.
     Fallback: data.tna_scores as object with selfAssessment sub-key.
     Final fallback: 16 flat tna_* fields with radio badge rendering.
     Each row displays the competency label and a styled level badge.
     ====================================================================== */

  // Master list of 16 competencies with their flat-field key mapping
  var tnaCompetencies = [
    { label: 'Monitoring & Evaluation Systems',      key: 'tna_me' },
    { label: 'Stakeholder Engagement',               key: 'tna_stakeholder' },
    { label: 'Value Chain Analysis',                  key: 'tna_value' },
    { label: 'Co-financing & Resource Mobilization', key: 'tna_cofin' },
    { label: 'Business Planning',                     key: 'tna_business' },
    { label: 'Grant Management',                      key: 'tna_grant' },
    { label: 'Gender Mainstreaming',                  key: 'tna_gender' },
    { label: 'Disaggregated Data Collection',          key: 'tna_disagg' },
    { label: 'Community Engagement',                  key: 'tna_community' },
    { label: 'Digital Tools & Technology',            key: 'tna_digital' },
    { label: 'Climate Science Knowledge',             key: 'tna_climate' },
    { label: 'NbCS Design & Implementation',          key: 'tna_nbcs_design' },
    { label: 'Strategic Planning',                     key: 'tna_planning' },
    { label: 'Systems Thinking',                       key: 'tna_system' },
    { label: 'Native Species Knowledge',              key: 'tna_native' },
    { label: 'Budget Management',                      key: 'tna_budget' }
  ];

  var tnaData = [];

  // Build a lookup map from competency key to its level value
  var tnaLookup = {};

  // Strategy 1: tna_scores as an array of objects
  if (data.tna_scores && Array.isArray(data.tna_scores) && data.tna_scores.length > 0) {
    data.tna_scores.forEach(function (item) {
      var itemKey = (item.key || item.competency || '').toLowerCase();
      var itemLevel = item.level || item.score || item.value || '';
      if (itemKey) {
        tnaLookup[itemKey] = itemLevel;
      }
    });
  }

  // Strategy 2: tna_scores as an object with selfAssessment sub-key
  if (Object.keys(tnaLookup).length === 0 && data.tna_scores && typeof data.tna_scores === 'object' && !Array.isArray(data.tna_scores)) {
    var selfAssessment = data.tna_scores.selfAssessment || data.tna_scores;
    if (selfAssessment && typeof selfAssessment === 'object') {
      Object.keys(selfAssessment).forEach(function (k) {
        tnaLookup[k.toLowerCase()] = selfAssessment[k];
      });
    }
  }

  // Build final TNA data array
  if (Object.keys(tnaLookup).length > 0) {
    tnaData = tnaCompetencies.map(function (comp) {
      return {
        label: comp.label,
        level: tnaLookup[comp.key] || ''
      };
    });
  } else {
    // Strategy 3: Fall back to flat tna_* fields
    tnaData = tnaCompetencies.map(function (comp) {
      return {
        label: comp.label,
        level: data[comp.key] || ''
      };
    });
  }

  // Render TNA matrix rows with styled radio badges
  var tnaHtml = '';
  var hasTna = false;
  tnaData.forEach(function (item) {
    if (item.level) hasTna = true;
    tnaHtml += '<tr>'
      + '<td>' + item.label + '</td>'
      + '<td>' + tnaBadge(item.level) + '</td>'
      + '</tr>';
  });
  setHTML('tnaMatrix',
    hasTna
      ? tnaHtml
      : '<tr><td colspan="2" style="color:#b35900; text-align:center; padding: 14px; background: #fff8f0;">'
        + '&#9888; TNA assessment data incomplete &mdash; no competency self-assessment scores were provided.</td></tr>');

  /* ======================================================================
     SECTION 9: SUPPORTING DOCUMENTS
     Expected array: [{documentType, fileName, fileUrl}]
     Grouped by documentType with sorted section headers and file lists.
     ====================================================================== */
  if (data.documents && data.documents.length > 0) {
    // Group documents by type
    var grouped = {};
    data.documents.forEach(function (doc) {
      var type = v(doc.documentType);
      if (type === 'Not provided') type = 'Other Documents';
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push(doc);
    });

    var docHtml = '';
    Object.keys(grouped).sort().forEach(function (type) {
      docHtml += '<div class="sub-section-header">' + type + '</div>';
      docHtml += '<ul class="file-list">';
      grouped[type].forEach(function (doc) {
        var fileName = v(doc.fileName);
        if (fileName !== 'Not provided') {
          if (doc.fileUrl && doc.fileUrl !== '') {
            docHtml += '<li><a href="' + doc.fileUrl + '" target="_blank">' + fileName + '</a></li>';
          } else {
            docHtml += '<li>' + fileName + '</li>';
          }
        }
      });
      docHtml += '</ul>';
    });
    setHTML('documents', docHtml);
  } else {
    setHTML('documents', '<p style="font-size: 9pt; color: #999;">No documents submitted.</p>');
  }
}
