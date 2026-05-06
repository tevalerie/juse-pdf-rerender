/**
 * J-USE REOI 2026 Full Application PDF Renderer — Section Population
 *
 * Populates every scalar field, description-block, and conditional section
 * across all 10 PDF sections plus the cover page and headers/footers.
 *
 * Depends on: v(), setField(), setRawField(), setHTML() from pdf-core.js
 *
 * Authored by T. Valerie Onu, c/o Audrey Richards, Sustainable Financing
 * Mechanism Specialist and Team, Edge Catalyst Finance
 */

'use strict';

/**
 * Populate all section-level fields (non-table).
 * Called by renderFullApplicationPDF() from pdf-core.js.
 *
 * @param {Object} data - Application data object
 */
function populatePDFSections(data) {

  /* ======================================================================
     COVER PAGE
     ====================================================================== */
  setField('ref_number', data.ref_number);
  setField('orgName', data.orgName);
  setField('projectTitle', data.projectTitle);
  setField('parish', data.parish);
  setField('submission_date', data.submission_date);
  setField('submission_time', data.submission_time);
  setField('coverContactName', data.contactName);
  setField('coverContactEmail', data.email);
  setRawField('footerRef_cover', data.ref_number);

  /* ======================================================================
     ALL HEADERS & FOOTERS  (Sections 1–10)
     ====================================================================== */
  for (var i = 1; i <= 10; i++) {
    setRawField('headerRef' + i, data.ref_number);
    setRawField('badgeRef' + i, data.ref_number);
    setRawField('footerRef' + i, data.ref_number);
  }
  // Section 1 header also shows date/time
  setRawField('headerDate1', v(data.submission_date) + ' at ' + v(data.submission_time));

  /* ======================================================================
     SECTION 1: ORGANIZATION DETAILS
     ====================================================================== */
  setField('orgName', data.orgName, true);
  setField('regType', data.regType, true);
  setField('regTypeOtherText', data.regTypeOtherText);
  setField('orgCategory', data.orgCategory, true);
  setField('orgCategoryOtherText', data.orgCategoryOtherText);
  setField('orgCapacity', data.orgCapacity, true);
  setField('dateOfFormation', data.dateOfFormation, true);

  // Hide Date of Formation and Registration Number rows when regType is Government or SOE (not applicable)
  var dateRow = document.getElementById('dateOfFormationRow');
  var regNumRow = document.getElementById('regNumberRow');
  var regTypeVal = (data.regType || '').toLowerCase();
  if (regTypeVal === 'government' || regTypeVal === 'soe') {
    if (dateRow) dateRow.style.display = 'none';
    if (regNumRow) regNumRow.style.display = 'none';
  }
  setField('regNumber', data.regNumber, true);
  setField('orgParish', data.orgParish, true);
  setField('orgAddress', data.orgAddress, true);
  setField('website', data.website, true);
  setField('socialMedia', data.socialMedia, true);
  setField('bankAccount', data.bankAccount, true);

  // Primary Contact
  setField('contactName', data.contactName, true);
  setField('contactTitle', data.contactTitle, true);
  setField('contactGender', data.contactGender, true);
  setField('email', data.email, true);
  setField('phone', data.phone, true);

  // SOE / Government Head (conditional section)
  var orgCat = (data.orgCategory || '').toLowerCase();
  var soeSection = document.getElementById('soe-gov-contact-section');
  var soeHeader = document.getElementById('soe-gov-contact-header');

  if (orgCat.indexOf('soe') !== -1 || orgCat.indexOf('state') !== -1) {
    soeSection.style.display = '';
    soeHeader.textContent = 'SOE Head Contact';
    setField('secondaryContactName', data.soeHeadName, true);
    setField('secondaryContactTitle', data.soeHeadTitle, true);
    setField('secondaryContactEmail', data.soeHeadEmail, true);
    setField('secondaryContactPhone', data.soeHeadPhone, true);
  } else if (orgCat.indexOf('government') !== -1 || orgCat.indexOf('gov') !== -1) {
    soeSection.style.display = '';
    soeHeader.textContent = 'Government Head Contact';
    setField('secondaryContactName', data.govHeadName, true);
    setField('secondaryContactTitle', data.govHeadTitle, true);
    setField('secondaryContactEmail', data.govHeadEmail, true);
    setField('secondaryContactPhone', data.govHeadPhone, true);
  } else {
    soeSection.style.display = 'none';
  }

  /* ======================================================================
     SECTION 2: CLIMATE RISK & CONTEXT
     ====================================================================== */
  setField('parish', data.parish, true);
  setField('location', data.location, true);
  setField('classification', data.classification, true);
  setField('hazards', data.hazards);
  setField('climateChallenge', data.climateChallenge);
  setField('copingMechanisms', data.copingMechanisms);
  setField('copingDescription', data.copingDescription, true);
  setField('systemFlows', data.systemFlows);
  setField('priorityNeeds', data.priorityNeeds, true);
  setField('systemTransformation', data.systemTransformation);

  /* ======================================================================
     SECTION 3: NbCS INTERVENTION & PROJECT DESIGN
     (tables handled by pdf-tables.js)
     ====================================================================== */
  setField('projectTitle', data.projectTitle, true);
  setField('nbcsIntervention', data.nbcsIntervention);
  setField('nbcsOtherText', data.nbcsOtherText);
  setField('nbcsSecondary', data.nbcsSecondary);
  setField('nbcsSecondaryOtherText', data.nbcsSecondaryOtherText);
  // Housing Vulnerability — 3-tier classification with conditional context
  var housingTier = data.housingVulnerabilityTier || data.housingVulnerability || '';
  var housingTierLower = housingTier.toLowerCase();
  var housingBadge = document.getElementById('housingVulnerabilityBadge');
  var housingContextSection = document.getElementById('housingVulnerabilityContextSection');
  var housingTierRow = document.getElementById('housingVulnerabilityTierRow');

  if (housingTierRow) {
    // Show/hide the entire tier row based on whether we have a value
    if (!housingTier) {
      housingTierRow.style.display = 'none';
    }
  }

  // Normalise tier to one of: 'direct' / 'partial' / 'no'.
  // Accepts BOTH the form's radio codes ('direct', 'partial', 'no') AND the
  // legacy human-readable strings ('Yes \u2014 Directly and centrally', etc.).
  var normalisedTier = '';
  if (housingTierLower === 'direct' ||
      (housingTierLower.indexOf('yes') !== -1 && housingTierLower.indexOf('direct') !== -1 && housingTierLower.indexOf('indirect') === -1)) {
    normalisedTier = 'direct';
  } else if (housingTierLower === 'partial' ||
             housingTierLower.indexOf('partially') !== -1 ||
             housingTierLower.indexOf('partial') !== -1 ||
             housingTierLower.indexOf('indirect') !== -1) {
    normalisedTier = 'partial';
  } else if (housingTierLower === 'no' || housingTierLower.indexOf('not a focus') !== -1 || housingTierLower === 'none') {
    normalisedTier = 'no';
  }

  // Friendly badge label (renders 'Yes \u2014 Directly and centrally' instead of 'direct')
  var tierLabel =
    normalisedTier === 'direct'  ? 'Yes \u2014 Directly and centrally' :
    normalisedTier === 'partial' ? 'Partially / Indirectly' :
    normalisedTier === 'no'      ? 'No \u2014 Not a focus' :
    v(housingTier);

  if (housingBadge) {
    if (normalisedTier === 'direct') {
      housingBadge.className = 'score-badge';
      housingBadge.textContent = '\u{1F7E2} ' + tierLabel;
    } else if (normalisedTier === 'partial') {
      housingBadge.className = 'score-badge medium';
      housingBadge.textContent = '\u{1F7E1} ' + tierLabel;
    } else if (normalisedTier === 'no') {
      housingBadge.className = 'score-badge low';
      housingBadge.textContent = '\u26AA ' + tierLabel;
    } else {
      housingBadge.textContent = tierLabel;
    }
  }

  if (housingContextSection) {
    // Show context whenever the project has any housing relevance (direct OR partial)
    if (normalisedTier === 'direct' || normalisedTier === 'partial') {
      housingContextSection.style.display = '';
      setField('housingVulnerabilityContext', data.housingVulnerabilityContext || data.housingContextDesc || '');
    } else {
      housingContextSection.style.display = 'none';
    }
  }
  setField('projectDescription', data.projectDescription);
  setField('summary', data.summary);

  // Causal chain: populate intervention and hazard references
  setField('chainIntervention', data.nbcsIntervention);
  setField('chainReduces', data.hazards);
  setField('logicBiophysical', data.logicBiophysical);
  setField('logicBeneficiaries', data.logicBeneficiaries);

  /* ======================================================================
     SECTION 4: BENEFICIARIES & INCLUSION
     (benefitTraceability table handled by pdf-tables.js)
     ====================================================================== */
  setRawField('directBeneficiaries', data.directBeneficiaries || '—');
  setRawField('indirectBeneficiaries', data.indirectBeneficiaries || '—');
  setRawField('publicBeneficiaries', data.publicBeneficiaries || '—');
  setField('beneficiaryEstimation', data.beneficiaryEstimation);
  setRawField('jobsCreated', data.jobsCreated || '—');
  setRawField('peopleTrained', data.peopleTrained || '—');

  setRawField('womenPct', data.womenPct != null ? data.womenPct + '%' : '—');
  setRawField('youthPct', data.youthPct != null ? data.youthPct + '%' : '—');
  setRawField('lowIncomePct', data.lowIncomePct != null ? data.lowIncomePct + '%' : '—');
  setRawField('vulnerablePct', data.vulnerablePct != null ? data.vulnerablePct + '%' : '—');

  setField('targetGroups', data.targetGroups);
  setField('targetGroupsOtherText', data.targetGroupsOtherText);
  setField('exposureDescription', data.exposureDescription, true);
  setField('vulnerabilityDescription', data.vulnerabilityDescription, true);
  setField('adaptiveCapacity', data.adaptiveCapacity, true);

  setField('inclusionApproach', data.inclusionApproach);
  setField('genderConsiderations', data.genderConsiderations);

  // Gender Analysis Conducted — conditional block
  var genderAnalysisSection = document.getElementById('gender-analysis-section');
  if (genderAnalysisSection) {
    if (data.genderAnalysisConducted) {
      genderAnalysisSection.style.display = '';
      setField('genderAnalysisFindings', data.genderAnalysisFindings);
    } else {
      genderAnalysisSection.style.display = 'none';
    }
  }

  // GBV Risk Considered — conditional block
  var gbvRiskSection = document.getElementById('gbv-risk-section');
  if (gbvRiskSection) {
    if (data.gbvRiskConsidered) {
      gbvRiskSection.style.display = '';
      setField('gbvMitigationMeasures', data.gbvMitigationMeasures);
    } else {
      gbvRiskSection.style.display = 'none';
    }
  }

  setRawField('jobsWomen', data.jobsWomen || '—');
  setRawField('womenEnterprises', data.womenEnterprises || '—');
  setRawField('womenEmployed', data.womenEmployed || '—');
  setRawField('youthEmployed', data.youthEmployed || '—');
  setRawField('pwdEmployed', data.pwdEmployed || '—');

  setField('socialBenefits', data.socialBenefits);
  setField('vulnerabilityBenefitsLink', data.vulnerabilityBenefitsLink, true);

  /* ======================================================================
     SECTION 5: VALUE PROPOSITION
     ====================================================================== */
  // Normalize pathway value for display — strict single-model labels
  var pathwayVal = (data.pathway || '').toLowerCase();
  var pathwayDisplay = '';
  if (pathwayVal === 'market') pathwayDisplay = 'Revenue-Generating Model';
  else if (pathwayVal === 'hybrid') pathwayDisplay = 'Hybrid Model (Revenue + Public Goods)';
  else if (pathwayVal === 'public') pathwayDisplay = 'Public Goods Model';
  setField('pathway', pathwayDisplay);

  // Show/hide pathway boxes and orange warning based on selected pathway
  var warningEl = document.getElementById('pathway-no-selection-warning');
  var pathways = ['market', 'hybrid', 'public'];
  pathways.forEach(function (pw) {
    var el = document.getElementById('pathway-' + pw);
    if (el) {
      el.style.display = (pathwayVal === pw) ? '' : 'none';
    }
  });

  // Show orange warning if no pathway selected
  if (warningEl) {
    warningEl.style.display = pathwayVal ? 'none' : '';
  }

  // Market Pathway fields
  setField('marketRevenue', data.marketRevenue, true);
  setField('marketCustomer', data.marketCustomer, true);
  setField('marketCustomerOther', data.marketCustomerOther);
  setField('marketOMCoverage', data.marketOMCoverage, true);

  // Hybrid Pathway fields
  setField('hybridMarketPct', data.hybridMarketPct, true);
  setField('hybridAnchorPartner', data.hybridAnchorPartner, true);
  setField('hybridPublicGoods', data.hybridPublicGoods);

  // Public Goods Pathway fields
  setField('publicBeneficiaries', data.publicBeneficiaries, true);
  setField('publicAgencyAdopt', data.publicAgencyAdopt, true);
  setField('publicNDCAlign', data.publicNDCAlign, true);

  setField('pathwayRationale', data.pathwayRationale);
  setField('sustainability', data.sustainability, true);
  setField('scalingPotential', data.scalingPotential, true);
  setField('scalingPathway', data.scalingPathway, true);

  /* ======================================================================
     SECTION 5: PATHWAY QUALIFYING QUESTIONS
     Conditionally renders pathway-specific qualifying questions based on
     the selected value_pathway. Uses data.pathway_questions JSON object
     when available; falls back to individual flat pathway fields.
     ====================================================================== */
  var pqSection = document.getElementById('pathway-qualifying-section');
  var pqContainer = document.getElementById('pathway-qualifying-content');

  if (pqSection && pqContainer) {
    if (!pathwayVal) {
      // No pathway selected — hide qualifying questions (orange warning handles it)
      pqSection.style.display = 'none';
    } else {
      // Build qualifying questions from pathway_questions object or flat fields
      var qualifyingQuestions = [];

      if (data.pathway_questions && typeof data.pathway_questions === 'object') {
        // pathway_questions object may contain: pathway, and pathway-specific fields
        var pq = data.pathway_questions;

        if (pathwayVal === 'market') {
          qualifyingQuestions = [
            { label: 'Target Customer Segment', value: pq.marketCustomer || data.marketCustomer || '' },
            { label: 'Revenue Model', value: pq.marketRevenue || data.marketRevenue || '' },
            { label: 'O&M Cost Coverage', value: pq.marketOMCoverage || data.marketOMCoverage || '' }
          ];
        } else if (pathwayVal === 'hybrid') {
          qualifyingQuestions = [
            { label: 'Market Revenue Percentage', value: pq.hybridMarketPct || data.hybridMarketPct || '' },
            { label: 'Anchor Partner', value: pq.hybridAnchorPartner || data.hybridAnchorPartner || '' },
            { label: 'Public Goods Contribution', value: pq.hybridPublicGoods || data.hybridPublicGoods || '' }
          ];
        } else if (pathwayVal === 'public') {
          qualifyingQuestions = [
            { label: 'Public Beneficiaries', value: pq.publicBeneficiaries || data.publicBeneficiaries || '' },
            { label: 'Agency Adoption Plan', value: pq.publicAgencyAdopt || data.publicAgencyAdopt || '' },
            { label: 'NDC Alignment', value: pq.publicNDCAlign || data.publicNDCAlign || '' }
          ];
        }
      } else {
        // Fallback: build from individual flat fields
        if (pathwayVal === 'market') {
          qualifyingQuestions = [
            { label: 'Target Customer Segment', value: data.marketCustomer || '' },
            { label: 'Revenue Model', value: data.marketRevenue || '' },
            { label: 'O&M Cost Coverage', value: data.marketOMCoverage || '' }
          ];
        } else if (pathwayVal === 'hybrid') {
          qualifyingQuestions = [
            { label: 'Market Revenue Percentage', value: data.hybridMarketPct || '' },
            { label: 'Anchor Partner', value: data.hybridAnchorPartner || '' },
            { label: 'Public Goods Contribution', value: data.hybridPublicGoods || '' }
          ];
        } else if (pathwayVal === 'public') {
          qualifyingQuestions = [
            { label: 'Public Beneficiaries', value: data.publicBeneficiaries || '' },
            { label: 'Agency Adoption Plan', value: data.publicAgencyAdopt || '' },
            { label: 'NDC Alignment', value: data.publicNDCAlign || '' }
          ];
        }
      }

      // Only show section if at least one qualifying question has a value
      var hasAnyAnswer = qualifyingQuestions.some(function (q) {
        return q.value && q.value !== '' && q.value !== 'Not provided';
      });

      if (hasAnyAnswer) {
        pqSection.style.display = '';
        var pqHtml = '';
        qualifyingQuestions.forEach(function (q) {
          pqHtml += '<tr>'
            + '<td class="label-cell">' + q.label + '</td>'
            + '<td class="value-cell">' + v(q.value) + '</td>'
            + '</tr>';
        });
        pqContainer.innerHTML = pqHtml;
      } else {
        pqSection.style.display = 'none';
      }
    }
  }

  /* ======================================================================
     SECTION 6: IMPLEMENTATION
     (implementationStructure + enablersDetail tables handled by pdf-tables.js)
     ====================================================================== */
  setField('enablingConditionsReflection', data.enablingConditionsReflection);

  // Maintenance & Sustainability Plan
  setField('maintenanceWho', data.maintenanceWho, true);
  setField('maintenanceFunding', data.maintenanceFunding, true);
  setField('maintenanceDuration', data.maintenanceDuration, true);
  setField('maintenanceFallback', data.maintenanceFallback, true);

  // Learning & Accessibility
  setField('learningFormat', data.learningFormat, true);
  setField('accessibilityNeeds', data.accessibilityNeeds, true);
  setField('accessibilityDetails', data.accessibilityDetails, true);

  /* ======================================================================
     SECTION 7: BUDGET & TIMELINE
     (budgetBreakdown + milestones tables handled by pdf-tables.js)
     ====================================================================== */
  setField('totalCost', data.totalCost);
  setField('juseRequest', data.juseRequest);
  setField('otherFunding', data.otherFunding);
  setField('startDate', data.startDate, true);
  setField('endDate', data.endDate, true);

  /* ======================================================================
     SECTION 8: IUCN NbCS CRITERIA & TNA
     (iucnCriteria + tnaMatrix tables handled by pdf-tables.js)
     ====================================================================== */
  setField('priorityNeedsSection8', data.priorityNeeds);

  /* -- Section 8: Priority Capacity Building Needs -- */
  var capNeeds = data.capacityBuildingNeeds;
  if (capNeeds && Array.isArray(capNeeds) && capNeeds.length > 0) {
    var capHtml = '';
    capNeeds.forEach(function (item) {
      var needText = '';
      if (typeof item === 'object' && item !== null) {
        needText = item.need || item.description || item.text || item.title || '';
      } else {
        needText = item;
      }
      if (needText && needText !== '') {
        capHtml += '<div class="description-block">' + v(needText) + '</div>';
      }
    });
    setHTML('capacityBuildingNeeds', capHtml || '<p style="font-size: 9pt; color: #999;">Not provided</p>');
  } else if (capNeeds && typeof capNeeds === 'string' && capNeeds !== '') {
    setHTML('capacityBuildingNeeds', '<div class="description-block">' + v(capNeeds) + '</div>');
  } else {
    setHTML('capacityBuildingNeeds', '<p style="font-size: 9pt; color: #999;">Not provided</p>');
  }

  /* -- Section 8: Preferred Learning Formats -- */
  var learnFmt = data.preferredLearningFormats;
  if (learnFmt && Array.isArray(learnFmt) && learnFmt.length > 0) {
    var lfHtml = '<table class="data-table"><thead><tr>'
      + '<th style="width: 35%;">Format</th>'
      + '<th style="width: 65%;">Details / Notes</th>'
      + '</tr></thead><tbody>';
    learnFmt.forEach(function (item) {
      if (typeof item === 'object' && item !== null) {
        lfHtml += '<tr>'
          + '<td>' + v(item.format || item.type || item.name) + '</td>'
          + '<td>' + v(item.notes || item.details || item.description) + '</td>'
          + '</tr>';
      } else if (item && item !== '') {
        lfHtml += '<tr><td>' + v(item) + '</td><td></td></tr>';
      }
    });
    lfHtml += '</tbody></table>';
    setHTML('preferredLearningFormats', lfHtml);
  } else if (learnFmt && typeof learnFmt === 'string' && learnFmt !== '') {
    setHTML('preferredLearningFormats', '<div class="description-block">' + v(learnFmt) + '</div>');
  } else {
    setHTML('preferredLearningFormats', '<p style="font-size: 9pt; color: #999;">Not provided</p>');
  }

  /* -- Section 8: Accessibility Accommodations -- */
  setField('capacityAccessibilityNeeds', data.capacityAccessibilityNeeds, true);
  setField('capacityAccessibilityDetails', data.capacityAccessibilityDetails, true);

  /* ======================================================================
     SECTION 10: DECLARATIONS & AUTHORIZATION
     (documents handled by pdf-tables.js)
     ====================================================================== */
  // Declaration checkboxes (✓ if true, empty otherwise)
  // Handles declaration1 through declaration8 if present in data
  var declFields = ['declaration1','declaration2','declaration3','declaration4','declaration5','declaration6','declaration7','declaration8'];
  declFields.forEach(function (field) {
    var els = document.querySelectorAll('[data-field="' + field + '"]');
    var checked = !!data[field];
    els.forEach(function (el) {
      el.textContent = checked ? '\u2713' : '';
    });
  });

  // Authorized Representative
  setField('authName', data.authName, true);
  setField('authTitle', data.authTitle, true);
  setField('authEmail', data.authEmail, true);
  setField('authPhone', data.authPhone, true);
  setField('authDate', data.authDate, true);
  setField('authIpAddress', data.authIpAddress, true);
  setField('digitalSignature', data.digitalSignature, true);

  // Additional Comments (show section only if provided)
  var commentsSection = document.getElementById('additional-comments-section');
  if (data.additionalComments && data.additionalComments !== '') {
    commentsSection.style.display = '';
    setField('additionalComments', data.additionalComments);
  } else {
    commentsSection.style.display = 'none';
  }
}
