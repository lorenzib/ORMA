(function(){
  'use strict';

  const QUEUE_URL = 'backoffice-data/logistics-review.json';
  const DOSSIER_URLS = {
    'osm-relation-1484751': 'backoffice/dossiers/tre-cime.json',
    'osm-relation-6678431': 'backoffice/dossiers/cinque-torri.json',
    'osm-way-25736154': 'backoffice/dossiers/lago-braies.json',
  };
  const CARTOGRAPHER_URLS = { 'osm-relation-1484751': 'backoffice-data/cartographer-review.json' };
  const CAMPAIGN_URL = 'backoffice-data/catalogue-campaign.json';
  const CAMPAIGN_EXECUTION_URL = 'backoffice-data/campaign-execution.json';
  const DECISION_RESOLUTION_URL = 'backoffice-data/decision-resolution-post-route-audit.json';
  const ROUTE_REVIEW_URL = 'backoffice-data/route-review.json';
  const CONTENT_OPERATIONS_URL = 'backoffice-data/content-operations.json';
  const CONTENT_EXECUTION_URL = 'backoffice-data/content-execution.json';
  const CLAIM_OWNERS = {
    route: 'Cartographer', elevation: 'Terrain & POI Analyst', parking: 'Logistics',
    water: 'Terrain & POI Analyst', heat: 'Terrain & POI Analyst',
    exposure: 'Cartographer', livestock: 'Terrain & POI Analyst',
    surfaceHazards: 'Cartographer', access: 'Regulatory Ranger',
    photo: 'Visual Director', provenance: 'Evidence Librarian',
  };
  const STORAGE_KEY = 'orma-backoffice-decisions-v1';
  const ROUTE_STORAGE_KEY = 'orma-backoffice-route-decisions-v1';
  const ENRICHMENT_STORAGE_KEY = 'orma-backoffice-enrichment-decisions-v1';
  const VERIFICATION_STORAGE_KEY = 'orma-backoffice-verification-decisions-v1';
  const state = document.getElementById('backofficeState');
  const queueElement = document.getElementById('backofficeQueue');
  const summaryElement = document.getElementById('backofficeSummary');
  const exportButton = document.getElementById('exportDecisions');
  const campaignPanel = document.getElementById('campaignPanel');
  const campaignStatus = document.getElementById('campaignStatus');
  const campaignMetrics = document.getElementById('campaignMetrics');
  const campaignJobs = document.getElementById('campaignJobs');
  const batchSize = document.getElementById('campaignBatchSize');
  const queueNext = document.getElementById('queueNextBatch');
  const contentDesk = document.getElementById('contentDesk');
  const contentDeskStatus = document.getElementById('contentDeskStatus');
  const contentDeskMetrics = document.getElementById('contentDeskMetrics');
  const contentDeskStreams = document.getElementById('contentDeskStreams');
  const contentDeskResults = document.getElementById('contentDeskResults');
  const planContentCycleButton = document.getElementById('planContentCycle');
  const contentSocialEnabled = document.getElementById('contentSocialEnabled');
  const contentGuideId = document.getElementById('contentGuideId');
  const runGuideAgentsButton = document.getElementById('runGuideAgents');
  const guideRunnerStatus = document.getElementById('guideRunnerStatus');
  const CONTENT_STORAGE_KEY = 'orma-backoffice-content-decisions-v1';
  let queue = null;
  let decisionResolutions = [];
  let currentResolutionAttempt = null;
  let currentResolutionLabel = null;
  let decisions = readDecisions();
  let routeReview = null;
  let routeDecisions = readRouteDecisions();
  let enrichmentDecisions = readEnrichmentDecisions();
  let verificationDecisions = readVerificationDecisions();
  let contentDecisions = readContentDecisions();
  let contentExecution = null;
  let reviewer = 'local-editor';
  let booted = false;

  function element(tag, className, text){
    const node = document.createElement(tag);
    if(className) node.className = className;
    if(text !== undefined) node.textContent = text;
    return node;
  }

  function readDecisions(){
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch(error){ return {}; }
  }

  function readRouteDecisions(){
    try { return JSON.parse(localStorage.getItem(ROUTE_STORAGE_KEY) || '{}'); }
    catch(error){ return {}; }
  }

  function readEnrichmentDecisions(){
    try { return JSON.parse(localStorage.getItem(ENRICHMENT_STORAGE_KEY) || '{}'); }
    catch(error){ return {}; }
  }

  function readVerificationDecisions(){
    try { return JSON.parse(localStorage.getItem(VERIFICATION_STORAGE_KEY) || '{}'); }
    catch(error){ return {}; }
  }

  function readContentDecisions(){
    try { return JSON.parse(localStorage.getItem(CONTENT_STORAGE_KEY) || '{}'); }
    catch(error){ return {}; }
  }

  function saveContentDecision(input){
    contentDecisions = window.ORMAContentReviewDecisions.applyDecision(contentDecisions, { ...input, reviewedBy: reviewer });
    localStorage.setItem(CONTENT_STORAGE_KEY, JSON.stringify(contentDecisions));
    renderContentResults(); renderSummary(); exportButton.disabled = false;
  }

  function saveEnrichmentDecision(input){
    enrichmentDecisions = window.ORMAEnrichmentReviewDecisions.applyDecision(
      enrichmentDecisions, { ...input, reviewedBy: reviewer }
    );
    localStorage.setItem(ENRICHMENT_STORAGE_KEY, JSON.stringify(enrichmentDecisions));
    paintEnrichmentDecision(input.candidateId);
    renderSummary();
    exportButton.disabled = !Object.keys(decisions).length
      && !Object.keys(routeDecisions).length && !Object.keys(enrichmentDecisions).length
      && !Object.keys(verificationDecisions).length;
  }

  function paintEnrichmentDecision(candidateId){
    const output = document.querySelector(`[data-enrichment-decision-for="${candidateId}"]`);
    if(!output) return;
    const decision = enrichmentDecisions[candidateId];
    output.textContent = decision
      ? `Saved locally: ${decision.action.replaceAll('-', ' ')} · ${new Date(decision.reviewedAt).toLocaleString()}`
      : 'No enrichment decision saved yet.';
  }

  function saveVerificationDecision(input){
    verificationDecisions = window.ORMAVerificationReviewDecisions.applyDecision(
      verificationDecisions, { ...input, reviewedBy: reviewer }
    );
    localStorage.setItem(VERIFICATION_STORAGE_KEY, JSON.stringify(verificationDecisions));
    paintVerificationDecision(input.candidateId);
    renderSummary();
    exportButton.disabled = !Object.keys(decisions).length
      && !Object.keys(routeDecisions).length && !Object.keys(enrichmentDecisions).length
      && !Object.keys(verificationDecisions).length;
  }

  function paintVerificationDecision(candidateId){
    const output = document.querySelector(`[data-verification-decision-for="${candidateId}"]`);
    if(!output) return;
    const decision = verificationDecisions[candidateId];
    output.textContent = decision
      ? `Saved locally: ${decision.action.replaceAll('-', ' ')} · ${new Date(decision.reviewedAt).toLocaleString()}`
      : 'No final verification decision saved yet.';
  }

  function saveRouteDecision(input){
    routeDecisions = window.ORMARouteReviewDecisions.applyDecision(routeDecisions, { ...input, reviewedBy: reviewer });
    localStorage.setItem(ROUTE_STORAGE_KEY, JSON.stringify(routeDecisions));
    paintRouteDecision(input.candidateId);
    renderSummary();
    exportButton.disabled = !Object.keys(decisions).length
      && !Object.keys(routeDecisions).length && !Object.keys(enrichmentDecisions).length
      && !Object.keys(verificationDecisions).length;
  }

  function paintRouteDecision(candidateId){
    const output = document.querySelector(`[data-route-decision-for="${candidateId}"]`);
    if(!output) return;
    const decision = routeDecisions[candidateId];
    output.textContent = decision
      ? `Saved locally: ${decision.action.replaceAll('-', ' ')} · ${new Date(decision.reviewedAt).toLocaleString()}`
      : 'No route decision saved yet.';
  }

  function saveDecision(input){
    decisions = window.ORMAReviewDecisions.applyDecision(decisions, { ...input, reviewedBy: reviewer });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(decisions));
    paintDecision(input.candidateId);
    renderSummary();
    exportButton.disabled = !Object.keys(decisions).length
      && !Object.keys(routeDecisions).length && !Object.keys(enrichmentDecisions).length
      && !Object.keys(verificationDecisions).length;
  }

  function paintDecision(candidateId){
    const output = document.querySelector(`[data-decision-for="${candidateId}"]`);
    if(!output) return;
    const decision = decisions[candidateId];
    output.textContent = decision
      ? `Saved locally: ${decision.action.replaceAll('-', ' ')} · ${new Date(decision.reviewedAt).toLocaleString()}`
      : 'No decision saved yet.';
  }

  function addMap(container, candidate, parkingSuggestions, routeItem){
    if(typeof L === 'undefined'){
      container.textContent = 'Map library unavailable.';
      return;
    }
    const route = candidate.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
    const map = L.map(container, { scrollWheelZoom: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18, attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    const line = L.polyline(route, { color: '#2f684e', weight: 4, opacity: .65 }).addTo(map);
    line.bindPopup('Stored ORMA candidate line');
    const mapLayers = [line];
    const proposals = routeItem && (routeItem.proposals || (routeItem.proposal ? [routeItem.proposal] : [])) || [];
    proposals.forEach((proposal, index) => {
      if(!proposal.geometry) return;
      const proposed = proposal.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
      const proposalLine = L.polyline(proposed, {
        color: index === 0 ? '#2868a8' : '#7655a6', weight: 5, opacity: .9,
        dashArray: index === 0 ? null : '9 6',
      }).addTo(map).bindPopup(proposal.label);
      mapLayers.push(proposalLine);
    });
    map.fitBounds(L.featureGroup(mapLayers).getBounds(), { padding: [24, 24] });
    (parkingSuggestions || candidate.logistics.parkingSuggestions || []).forEach(parking => {
      const [lng, lat] = parking.position;
      L.marker([lat, lng]).addTo(map).bindPopup(
        `${parking.rank}. ${parking.name}<br>${parking.distanceToRouteM === null ? 'Exact route distance requires review' : `${parking.distanceToRouteM} m from route`}`
      );
    });
  }

  function renderRouteReview(candidate){
    const item = routeReview && routeReview.items.find(entry => entry.candidateId === candidate.id);
    if(!item) return null;
    const panel = element('section', 'bo-route-review');
    const heading = element('div', 'bo-route-heading');
    const headingCopy = element('div');
    headingCopy.append(
      element('p', 'bo-route-kicker', `Route gate · Priority ${item.priority} · ${item.agent}`),
      element('h3', '', item.title),
      element('p', '', item.routeIdentity)
    );
    heading.append(headingCopy, element('span', `bo-route-state is-${item.reviewState}`, item.reviewState.replaceAll('-', ' ')));
    panel.append(heading);

    const metrics = element('div', 'bo-route-metrics');
    [
      ['Stored line', item.metrics.storedDistanceKm === null ? 'Unknown' : `${item.metrics.storedDistanceKm} km`],
      ['Reconstructed', item.metrics.reconstructedDistanceKm === null ? 'Not ready' : `${item.metrics.reconstructedDistanceKm} km`],
      ['Official reference', item.metrics.officialDistanceKm === null ? 'Not attached' : `${item.metrics.officialDistanceKm} km`],
      ['Official ascent', item.metrics.officialAscentM === null ? 'Not attached' : `${item.metrics.officialAscentM} m`],
    ].forEach(([label, value]) => {
      const metric = element('div');
      metric.append(element('small', '', label), element('strong', '', value));
      metrics.append(metric);
    });
    panel.append(metrics, element('p', 'bo-route-assessment', item.metrics.distanceAssessment));

    const proposals = item.proposals || (item.proposal ? [item.proposal] : []);
    const selectedProposalIds = new Set();
    if(proposals.length){
      const proposalPicker = element('fieldset', 'bo-route-proposals');
      proposalPicker.append(element('legend', '', proposals.length > 1 ? 'Choose one route proposal' : 'Proposed route'));
      proposals.forEach(proposal => {
        const option = element('label', 'bo-route-proposal');
        const radio = element('input');
        radio.type = item.selectionMode === 'one-or-more' ? 'checkbox' : 'radio';
        radio.name = `route-proposal-${candidate.id}`; radio.value = proposal.id;
        const copy = element('span');
        const title = element('strong', '', proposal.label);
        if(proposal.recommended) title.append(element('span', 'bo-recommended', 'ORMA recommended'));
        copy.append(title, element('p', '', proposal.summary));
        const proposalMetrics = proposal.metrics || {};
        copy.append(element('small', '', [
          `${proposalMetrics.computedDistanceKm ?? 'Unknown'} km computed`,
          proposalMetrics.officialDistanceKm === null ? 'official distance not published' : `${proposalMetrics.officialDistanceKm} km official`,
          `${proposalMetrics.pointCount ?? 'Unknown'} points`,
          `${proposalMetrics.closureDistanceM ?? 'Unknown'} m closure gap`,
        ].join(' · ')));
        (proposal.warnings || []).forEach(warning => copy.append(element('span', 'bo-proposal-warning', warning)));
        option.append(radio, copy);
        radio.addEventListener('change', () => {
          if(item.selectionMode === 'one-or-more'){
            if(radio.checked) selectedProposalIds.add(proposal.id);
            else selectedProposalIds.delete(proposal.id);
          }else{
            selectedProposalIds.clear(); selectedProposalIds.add(proposal.id);
          }
          const approveButton = panel.querySelector('[data-action="approve-route"]');
          if(approveButton){
            const selected = proposals.filter(entry => selectedProposalIds.has(entry.id));
            approveButton.disabled = !item.approvalAllowed || !selected.length
              || selected.some(entry => entry.eligibility !== 'ready-for-human-review' || !entry.geometry);
            approveButton.title = approveButton.disabled ? 'This proposal is not ready for human geometry approval.' : '';
            approveButton.textContent = selected.length > 1 ? 'Approve as separate route variants' : 'Approve selected route';
          }
        });
        proposalPicker.append(option);
      });
      panel.append(proposalPicker);
    }

    const columns = element('div', 'bo-route-columns');
    const findings = element('div');
    findings.append(element('h4', '', 'Agent findings'));
    const findingList = element('ul');
    item.findings.forEach(finding => findingList.append(element('li', '', finding)));
    findings.append(findingList);
    const blockers = element('div', 'bo-route-blockers');
    blockers.append(element('h4', '', `${item.blockers.length} blocking or downstream requirements`));
    const blockerList = element('ol');
    item.blockers.forEach(blocker => blockerList.append(element('li', '', blocker)));
    blockers.append(blockerList);
    columns.append(findings, blockers);
    panel.append(columns);

    if(item.evidence.length){
      const evidence = element('div', 'bo-route-evidence');
      evidence.append(element('h4', '', 'Evidence inspected'));
      item.evidence.forEach(record => {
        const row = element('div', 'bo-route-evidence-row');
        const link = element('a', '', `${record.label} ↗`);
        link.href = record.url; link.target = '_blank'; link.rel = 'noopener';
        row.append(link, element('span', '', record.authority), element('p', '', record.conclusion));
        evidence.append(row);
      });
      panel.append(evidence);
    }

    const checks = element('details', 'bo-route-checks');
    checks.open = true;
    checks.append(element('summary', '', `${item.humanChecks.length} checks for the human editor`));
    const checkList = element('ul');
    item.humanChecks.forEach(check => checkList.append(element('li', '', check)));
    checks.append(checkList);
    panel.append(checks);

    const next = element('div', 'bo-next-agent-action');
    const attemptLabel = item.nextAgentAction.completedAttempts >= item.nextAgentAction.maximumAttempts
      ? `Automated research · ${item.nextAgentAction.maximumAttempts} of ${item.nextAgentAction.maximumAttempts} attempts exhausted`
      : item.nextAgentAction.action.startsWith('await-human')
        ? `Automated research · ${item.nextAgentAction.completedAttempts} of ${item.nextAgentAction.maximumAttempts} attempts used · human review ready`
        : `Next agent action · attempt ${item.nextAgentAction.attempt} of ${item.nextAgentAction.maximumAttempts}`;
    next.append(
      element('strong', '', attemptLabel),
      element('p', '', item.nextAgentAction.instructions)
    );
    panel.append(next);

    const note = element('label', 'bo-note');
    note.append(element('span', '', 'Route review note'));
    const textarea = element('textarea');
    textarea.maxLength = 1000;
    textarea.placeholder = 'Record why the source is rejected, what the next attempt must resolve, or why a proposal is accepted…';
    note.append(textarea);
    panel.append(note);

    const actions = element('div', 'bo-actions bo-route-actions');
    const approve = element('button', '', 'Approve selected route');
    approve.type = 'button'; approve.dataset.action = 'approve-route';
    approve.disabled = true;
    approve.title = 'Select a source-matched route proposal to enable approval.';
    approve.addEventListener('click', () => {
      const selected = proposals.filter(entry => selectedProposalIds.has(entry.id));
      if(!selected.length){ window.alert('Select at least one route proposal first.'); return; }
      if(selected.length > 1){
        saveRouteDecision({
          candidateId: candidate.id,
          action: 'approve-route-variants',
          routes: selected.map(proposal => ({
            proposalId: proposal.id, geometry: proposal.geometry, sourceRefs: proposal.sourceRefs,
          })),
          note: textarea.value,
        });
      }else{
        const proposal = selected[0];
        saveRouteDecision({
          candidateId: candidate.id,
          action: 'approve-route',
          proposalId: proposal.id,
          route: proposal.geometry,
          sourceRefs: proposal.sourceRefs,
          note: textarea.value,
        });
      }
    });
    const research = element('button', '', 'Request Cartographer refinement');
    research.type = 'button'; research.dataset.action = 'request-route-research';
    research.disabled = item.nextAgentAction.attempt >= item.nextAgentAction.maximumAttempts;
    research.addEventListener('click', () => saveRouteDecision({ candidateId: candidate.id, action: 'request-route-research', note: textarea.value }));
    const unresolved = element('button', '', 'Keep route unresolved');
    unresolved.type = 'button';
    unresolved.addEventListener('click', () => saveRouteDecision({ candidateId: candidate.id, action: 'route-unresolved', note: textarea.value }));
    const reject = element('button', '', 'Reject current route source');
    reject.type = 'button'; reject.dataset.action = 'reject-route-source';
    reject.addEventListener('click', () => saveRouteDecision({ candidateId: candidate.id, action: 'reject-route-source', note: textarea.value }));
    const clear = element('button', '', 'Clear route decision');
    clear.type = 'button';
    clear.addEventListener('click', () => saveRouteDecision({ candidateId: candidate.id, action: 'clear-route-decision' }));
    actions.append(approve, research, unresolved, reject, clear);
    panel.append(actions);
    const decision = element('p', 'bo-decision');
    decision.dataset.routeDecisionFor = candidate.id;
    panel.append(decision);
    requestAnimationFrame(() => paintRouteDecision(candidate.id));
    return panel;
  }

  function renderCandidate(candidate){
    const card = element('article', 'bo-card');
    const head = element('div', 'bo-card-head');
    const title = element('div');
    title.append(element('h2', '', candidate.name));
    const meta = element('div', 'bo-meta');
    meta.append(
      element('span', 'bo-chip', candidate.state.replaceAll('_', ' ')),
      element('span', 'bo-chip', `${candidate.geometryAssessment.distanceKm} km mapped geometry`),
      element('span', 'bo-chip', `${candidate.logistics.searchRadiusM} m parking search`)
    );
    title.append(meta);
    const source = element('a', '', 'Open source route ↗');
    source.href = candidate.source.url;
    source.target = '_blank';
    source.rel = 'noopener';
    head.append(title, source);
    card.append(head);
    const routePanel = renderRouteReview(candidate);
    if(routePanel) card.append(routePanel);

    if(candidate.dossier){
      const dossier = element('section', 'bo-dossier');
      if(candidate.cartographer){
        const result = candidate.cartographer;
        const cartographer = element('section', 'bo-agent-result');
        cartographer.append(
          element('div', 'bo-agent-result-title', 'Cartographer · current source verification'),
          element('p', '', `OSM ${result.relation.id}, version ${result.relation.version || 'unknown'} · ${result.geometry.coordinates.length} points · ${result.components.length} disconnected component(s)`),
          element('p', 'bo-agent-result-tags', `Current tags: ${JSON.stringify(result.relation.tags)}`),
          element('p', 'bo-agent-result-conflict', `Computed ${result.comparison.reconstructedDistanceKm} km versus official ${result.comparison.officialDistanceKm} km (${result.comparison.distanceDeltaPercent}% difference).`)
        );
        const resultBlockers = element('ul');
        result.blockers.forEach(blocker => resultBlockers.append(element('li', '', blocker)));
        cartographer.append(resultBlockers);
        dossier.append(cartographer);
      }
      const dossierHead = element('div', 'bo-dossier-head');
      const accepted = candidate.dossier.reviewState === 'accepted';
      dossierHead.append(
        element(
          'div',
          accepted ? 'bo-gate bo-gate-ready' : 'bo-gate bo-gate-blocked',
          accepted ? 'ORMA Verified · not published' : 'Promotion blocked'
        ),
        element('p', '', candidate.dossier.editorialSummary)
      );
      dossier.append(dossierHead);
      if(candidate.dossier.promotionGate.blockers.length){
        const blockers = element('details', 'bo-blockers');
        blockers.open = true;
        blockers.append(element('summary', '', `${candidate.dossier.promotionGate.blockers.length} blocking requirements`));
        const blockerList = element('ol');
        candidate.dossier.promotionGate.blockers.forEach(blocker => blockerList.append(element('li', '', blocker)));
        blockers.append(blockerList);
        dossier.append(blockers);
      }
      const claims = element('div', 'bo-claims');
      candidate.dossier.claims.forEach(claim => {
        const row = element('article', `bo-claim is-${claim.state}`);
        const claimHead = element('div', 'bo-claim-head');
        const claimStatus = element('div', 'bo-claim-status');
        claimStatus.append(
          element('span', 'bo-claim-owner', `Owner: ${CLAIM_OWNERS[claim.category] || 'Auditor'}`),
          element('span', `bo-claim-state is-${claim.state}`, claim.state)
        );
        claimHead.append(element('strong', '', claim.label), claimStatus);
        row.append(claimHead, element('p', 'bo-proposed', claim.proposedValue), element('p', '', claim.evidenceSummary));
        if(claim.blocker) row.append(element('p', 'bo-claim-blocker', `Blocker: ${claim.blocker}`));
        if(claim.humanChecks && claim.humanChecks.length){
          const checks = element('ul', 'bo-human-checks');
          claim.humanChecks.forEach(check => checks.append(element('li', '', check)));
          row.append(checks);
        }
        const links = element('div', 'bo-source-links');
        claim.sourceIds.forEach(sourceId => {
          const sourceRecord = candidate.dossier.sources.find(source => source.id === sourceId);
          if(!sourceRecord) return;
          const link = element('a', '', sourceRecord.label);
          link.href = sourceRecord.url; link.target = '_blank'; link.rel = 'noopener';
          links.append(link);
        });
        row.append(links);
        if(claim.state === 'supported'){
          const reviewed = element('label', 'bo-claim-review');
          const checkbox = element('input');
          checkbox.type = 'checkbox';
          checkbox.value = claim.id;
          checkbox.dataset.supportedClaimFor = candidate.id;
          checkbox.checked = Boolean(
            enrichmentDecisions[candidate.id]
            && enrichmentDecisions[candidate.id].supportedClaimIds.includes(claim.id)
          );
          reviewed.append(checkbox, element('span', '', 'I reviewed this supported claim and its cited evidence.'));
          row.append(reviewed);
        }
        claims.append(row);
      });
      dossier.append(claims);

      const enrichmentActions = element('section', 'bo-enrichment-actions');
      enrichmentActions.append(element('h4', '', 'Enrichment human gate'));
      const enrichmentNote = element('label', 'bo-note');
      enrichmentNote.append(element('span', '', 'Enrichment review note'));
      const enrichmentTextarea = element('textarea');
      enrichmentTextarea.maxLength = 1500;
      enrichmentTextarea.placeholder = 'Record evidence concerns, field checks, or what the next automated attempt must resolve…';
      enrichmentNote.append(enrichmentTextarea);
      enrichmentActions.append(enrichmentNote);
      const enrichmentButtons = element('div', 'bo-actions');
      const confirmSupported = element('button', '', 'Confirm reviewed supported claims');
      confirmSupported.type = 'button';
      confirmSupported.addEventListener('click', () => {
        const supported = candidate.dossier.claims.filter(claim => claim.state === 'supported').map(claim => claim.id);
        const checked = [...dossier.querySelectorAll(`[data-supported-claim-for="${candidate.id}"]:checked`)].map(input => input.value);
        if(checked.length !== supported.length){
          window.alert(`Review and check all ${supported.length} supported claims before confirming them.`);
          return;
        }
        saveEnrichmentDecision({
          candidateId: candidate.id, action: 'confirm-supported-claims', supportedClaimIds: checked,
          unresolvedClaimIds: candidate.dossier.claims.filter(claim => claim.state !== 'supported').map(claim => claim.id),
          note: enrichmentTextarea.value,
        });
      });
      const requestResolution = element('button', '', 'Confirm supported + resolve blockers');
      requestResolution.type = 'button';
      requestResolution.addEventListener('click', () => {
        const supported = candidate.dossier.claims.filter(claim => claim.state === 'supported').map(claim => claim.id);
        const checked = [...dossier.querySelectorAll(`[data-supported-claim-for="${candidate.id}"]:checked`)].map(input => input.value);
        if(checked.length !== supported.length){
          window.alert(`Review and check all ${supported.length} supported claims before sending the blockers to the next automated pass.`);
          return;
        }
        saveEnrichmentDecision({
          candidateId: candidate.id, action: 'request-enrichment-resolution',
          supportedClaimIds: checked,
          unresolvedClaimIds: candidate.dossier.claims.filter(claim => claim.state !== 'supported').map(claim => claim.id),
          note: enrichmentTextarea.value,
        });
      });
      const keepBlocked = element('button', '', 'Keep enrichment blocked');
      keepBlocked.type = 'button';
      keepBlocked.addEventListener('click', () => saveEnrichmentDecision({
        candidateId: candidate.id, action: 'keep-enrichment-blocked',
        supportedClaimIds: [],
        unresolvedClaimIds: candidate.dossier.claims.filter(claim => claim.state !== 'supported').map(claim => claim.id),
        note: enrichmentTextarea.value,
      }));
      const clearEnrichment = element('button', '', 'Clear enrichment decision');
      clearEnrichment.type = 'button';
      clearEnrichment.addEventListener('click', () => saveEnrichmentDecision({
        candidateId: candidate.id, action: 'clear-enrichment-decision',
      }));
      enrichmentButtons.append(confirmSupported, requestResolution, keepBlocked, clearEnrichment);
      enrichmentActions.append(enrichmentButtons);
      const enrichmentDecision = element('p', 'bo-enrichment-decision');
      enrichmentDecision.dataset.enrichmentDecisionFor = candidate.id;
      enrichmentActions.append(enrichmentDecision);
      dossier.append(enrichmentActions);

      if(candidate.dossier.verificationReview){
        const verification = candidate.dossier.verificationReview;
        const finalGate = element('section', 'bo-enrichment-actions bo-verification-actions');
        finalGate.append(element('h4', '', 'Final ORMA Verification gate'));
        const verificationAccepted = verification.state === 'accepted';
        const verificationReady = verification.state === 'ready-for-human-review';
        const gateState = element(
          'div',
          verificationAccepted || verificationReady ? 'bo-gate bo-gate-ready' : 'bo-gate bo-gate-blocked',
          verificationAccepted ? 'ORMA Verified approved · publication separate'
            : verificationReady ? 'Red Team review ready' : 'Verification blocked'
        );
        finalGate.append(gateState);
        const reportLink = element('a', '', 'Open complete Red Team report ↗');
        reportLink.href = verification.reportUrl;
        reportLink.target = '_blank';
        reportLink.rel = 'noopener';
        finalGate.append(reportLink);

        if(verification.seriousObjections && verification.seriousObjections.length){
          const objections = element('div', 'bo-blockers');
          objections.append(element('strong', '', `${verification.seriousObjections.length} serious objection`));
          const objectionList = element('ul');
          verification.seriousObjections.forEach(objection => objectionList.append(
            element('li', '', objection.label || objection.reason || objection.id)
          ));
          objections.append(objectionList);
          finalGate.append(objections);
        }

        const acknowledgements = verification.requiredAcknowledgements || [];
        if(acknowledgements.length){
          const acknowledgementGroup = element('fieldset', 'bo-final-acknowledgements');
          acknowledgementGroup.append(element('legend', '', 'Required final acknowledgements'));
          acknowledgements.forEach(acknowledgement => {
            const label = element('label', 'bo-claim-review');
            const checkbox = element('input');
            checkbox.type = 'checkbox';
            checkbox.value = acknowledgement.id;
            checkbox.dataset.verificationAcknowledgementFor = candidate.id;
            checkbox.checked = Boolean(
              verificationDecisions[candidate.id]
              && verificationDecisions[candidate.id].acknowledgementIds.includes(acknowledgement.id)
            );
            label.append(checkbox, element('span', '', acknowledgement.label));
            acknowledgementGroup.append(label);
          });
          finalGate.append(acknowledgementGroup);
        }

        const finalNote = element('label', 'bo-note');
        finalNote.append(element('span', '', 'Final verification note'));
        const finalTextarea = element('textarea');
        finalTextarea.maxLength = 1500;
        finalTextarea.placeholder = 'Record the final rationale or the reason ORMA Verification remains blocked…';
        finalNote.append(finalTextarea);
        finalGate.append(finalNote);

        const finalButtons = element('div', 'bo-actions');
        if(verification.state === 'ready-for-human-review'){
          const approveVerified = element('button', '', 'Approve ORMA Verified status');
          approveVerified.type = 'button';
          approveVerified.addEventListener('click', () => {
            const requiredAcknowledgementIds = acknowledgements.map(item => item.id);
            const acknowledgementIds = [...finalGate.querySelectorAll(`[data-verification-acknowledgement-for="${candidate.id}"]:checked`)]
              .map(input => input.value);
            if(acknowledgementIds.length !== requiredAcknowledgementIds.length){
              window.alert(`Review and check all ${requiredAcknowledgementIds.length} final acknowledgements first.`);
              return;
            }
            saveVerificationDecision({
              candidateId: candidate.id,
              action: 'approve-orma-verified',
              reviewReady: true,
              acknowledgementIds,
              requiredAcknowledgementIds,
              note: finalTextarea.value,
            });
          });
          finalButtons.append(approveVerified);
        }
        const keepVerificationBlocked = element('button', '', 'Keep verification blocked');
        keepVerificationBlocked.type = 'button';
        keepVerificationBlocked.addEventListener('click', () => saveVerificationDecision({
          candidateId: candidate.id,
          action: 'keep-verification-blocked',
          acknowledgementIds: [],
          note: finalTextarea.value,
        }));
        const clearVerification = element('button', '', 'Clear verification decision');
        clearVerification.type = 'button';
        clearVerification.addEventListener('click', () => saveVerificationDecision({
          candidateId: candidate.id,
          action: 'clear-verification-decision',
        }));
        finalButtons.append(keepVerificationBlocked, clearVerification);
        finalGate.append(finalButtons);
        const finalDecision = element('p', 'bo-enrichment-decision');
        finalDecision.dataset.verificationDecisionFor = candidate.id;
        finalGate.append(finalDecision);
        dossier.append(finalGate);
      }
      card.append(dossier);
    }else{
      const pending = element('div', 'bo-dossier-pending', 'Detailed source dossier not started. All approval actions remain blocked.');
      card.append(pending);
    }

    const resolution = decisionResolutions.find(item => item.candidateId === candidate.id);
    if(resolution){
      const panel = element('section', `bo-resolution is-${resolution.state}`);
      panel.append(
        element('div', 'bo-resolution-title', `${currentResolutionLabel || `Resolution attempt ${currentResolutionAttempt || '?'} of 5`} · ${resolution.agent}`),
        element('p', 'bo-resolution-state', resolution.state.replaceAll('-', ' ')),
        element('p', '', resolution.recommendedParking)
      );
      const facts = element('ul');
      resolution.accessFacts.forEach(fact => facts.append(element('li', '', fact)));
      panel.append(facts);
      const links = element('div', 'bo-source-links');
      resolution.sources.forEach(sourceRecord => {
        const link = element('a', '', `${sourceRecord.label} ↗`);
        link.href = sourceRecord.url; link.target = '_blank'; link.rel = 'noopener';
        links.append(link);
      });
      panel.append(links);
      if(resolution.parkingOptions && resolution.parkingOptions.length){
        const options = element('div', 'bo-resolution-options');
        resolution.parkingOptions.forEach(option => {
          const coordinates = Number.isFinite(option.lat) && Number.isFinite(option.lng)
            ? `${option.lat.toFixed(6)}, ${option.lng.toFixed(6)}` : 'exact pin unresolved';
          options.append(element('p', '', `${option.label} · ${coordinates} · ${option.distanceNote || option.role}`));
        });
        panel.append(options);
      }
      const checks = element('details');
      checks.append(element('summary', '', `${resolution.remainingHumanChecks.length} remaining human checks`));
      const list = element('ul');
      resolution.remainingHumanChecks.forEach(check => list.append(element('li', '', check)));
      checks.append(list); panel.append(checks); card.append(panel);
    }

    const grid = element('div', 'bo-card-grid');
    const map = element('div', 'bo-map');
    map.id = `map-${candidate.id}`;
    const review = element('div', 'bo-review');
    review.append(element('h3', '', 'Where to park'));
    const resolvedSuggestions = resolution && Array.isArray(resolution.parkingOptions) && resolution.parkingOptions.length
      ? (resolution.parkingOptions || []).filter(option => Number.isFinite(option.lat) && Number.isFinite(option.lng)).map((option, index) => ({
          rank: index + 1, name: option.label, position: [option.lng, option.lat],
          distanceToRouteM: null, confidence: option.confidence === 'strong-consensus' ? .9 : .85,
          osmId: option.osmId, evidenceState: option.confidence,
        })) : [];
    const suggestions = resolvedSuggestions.length
      ? resolvedSuggestions : (candidate.logistics.parkingSuggestions || []);
    if(!suggestions.length){
      review.append(element('div', 'bo-empty', 'No mapped parking was found within the search radius. This remains unresolved.'));
    }
    const isParkingSet = resolution && resolution.parkingOptions && resolution.parkingOptions.length > 1;
    suggestions.forEach(parking => {
      const label = element('label', 'bo-parking');
      const radio = element('input');
      radio.type = isParkingSet ? 'checkbox' : 'radio';
      radio.name = `parking-${candidate.id}`;
      radio.value = String(parking.rank);
      const body = element('span');
      body.append(
        element('strong', '', `${parking.rank}. ${parking.name}`),
        element('small', '', `${parking.distanceToRouteM === null ? 'Trailhead distance requires map review' : `${parking.distanceToRouteM} m from route`} · confidence ${Math.round(parking.confidence * 100)}%`),
        element('small', '', `${parking.position[1].toFixed(6)}, ${parking.position[0].toFixed(6)}${parking.osmId ? ` · ${parking.osmId}` : ' · OSM ID absent from stored snapshot'}`)
      );
      label.append(radio, body);
      review.append(label);
    });
    if(isParkingSet && suggestions.length){
      const selectAll = element('button', 'bo-select-all', 'Select all four official options');
      selectAll.type = 'button';
      selectAll.addEventListener('click', () => {
        review.querySelectorAll(`input[name="parking-${candidate.id}"]`).forEach(input => { input.checked = true; });
        selectAll.textContent = 'All official options selected';
      });
      review.append(selectAll);
    }
    const note = element('label', 'bo-note');
    note.append(element('span', '', 'Editorial note'));
    const textarea = element('textarea');
    textarea.maxLength = 500;
    textarea.placeholder = 'Why you accepted, rejected, or left this unresolved…';
    note.append(textarea);
    review.append(note);

    const actions = element('div', 'bo-actions');
    const approve = element('button', '', isParkingSet ? 'Approve selected parking set' : 'Approve selected parking');
    approve.type = 'button'; approve.dataset.action = 'approve-parking';
    const resolutionAllowsParkingApproval = resolution && resolution.state.startsWith('parking-ready');
    approve.disabled = !suggestions.length || (!resolutionAllowsParkingApproval
      && (!candidate.dossier || !candidate.dossier.promotionGate.canApproveParking));
    approve.addEventListener('click', () => {
      const selected = [...review.querySelectorAll(`input[name="parking-${candidate.id}"]:checked`)];
      if(!selected.length){ window.alert('Select at least one parking suggestion first.'); return; }
      const selectedParkings = selected.map(input => suggestions.find(item => item.rank === Number(input.value)));
      saveDecision(isParkingSet
        ? { candidateId: candidate.id, action: 'approve-parking-set', parkings: selectedParkings, note: textarea.value }
        : { candidateId: candidate.id, action: 'approve-parking', parking: selectedParkings[0], note: textarea.value });
    });
    const unresolved = element('button', '', 'Keep parking unresolved');
    unresolved.type = 'button'; unresolved.dataset.action = 'parking-unresolved';
    unresolved.addEventListener('click', () => saveDecision({ candidateId: candidate.id, action: 'parking-unresolved', note: textarea.value }));
    const reject = element('button', '', 'Reject candidate');
    reject.type = 'button'; reject.dataset.action = 'reject-candidate';
    reject.addEventListener('click', () => {
      if(window.confirm(`Reject ${candidate.name} as a trail candidate?`)){
        saveDecision({ candidateId: candidate.id, action: 'reject-candidate', note: textarea.value });
      }
    });
    const clear = element('button', '', 'Clear decision');
    clear.type = 'button';
    clear.addEventListener('click', () => saveDecision({ candidateId: candidate.id, action: 'clear' }));
    actions.append(approve, unresolved, reject, clear);
    review.append(actions);
    const decision = element('p', 'bo-decision');
    decision.dataset.decisionFor = candidate.id;
    review.append(decision);
    grid.append(map, review);
    card.append(grid);
    queueElement.append(card);
    const routeItem = routeReview && routeReview.items.find(item => item.candidateId === candidate.id);
    requestAnimationFrame(() => addMap(map, candidate, suggestions, routeItem));
    paintDecision(candidate.id);
    paintEnrichmentDecision(candidate.id);
    paintVerificationDecision(candidate.id);
  }

  function render(){
    queueElement.replaceChildren();
    queue.candidates.forEach(renderCandidate);
    renderSummary();
    exportButton.disabled = !Object.keys(decisions).length
      && !Object.keys(routeDecisions).length && !Object.keys(enrichmentDecisions).length
      && !Object.keys(verificationDecisions).length;
    state.textContent = `${queue.candidates.length} candidates ready for review. Nothing is published by this page.`;
  }

  function renderSummary(){
    if(!queue) return;
    summaryElement.replaceChildren();
    summaryElement.append(
      element('span', '', `${queue.candidates.length} candidates`),
      element('span', '', `${queue.logistics.withParkingSuggestions} with suggestions`),
      element('span', '', `${queue.logistics.unresolvedParking} unresolved`),
      element('span', '', `${Object.keys(decisions).length} parking decisions saved locally`),
      element('span', '', `${Object.keys(routeDecisions).length} route decisions saved locally`),
      element('span', '', `${Object.keys(enrichmentDecisions).length} enrichment decisions saved locally`),
      element('span', '', `${Object.keys(verificationDecisions).length} final verification decisions saved locally`)
    );
    summaryElement.hidden = false;
  }

  function renderCampaign(campaign, execution){
    campaignPanel.hidden = false;
    campaignStatus.textContent = `${campaign.summary.jobsCreated} draft jobs in the current batch. ${campaign.summary.remainingQueueable} trails remain available to queue.`;
    campaignMetrics.replaceChildren();
    [
      `${campaign.summary.total} catalogue trails`,
      `${campaign.summary.modernGraduationVerified} ORMA verified`,
      `${campaign.summary.previouslyQueued || 0} previously queued`,
      `${campaign.summary.sourceIdentityRequired} need source identity`,
    ].forEach(label => campaignMetrics.append(element('span', '', label)));
    campaignJobs.replaceChildren();
    campaign.selectedTrailIds.forEach(trailId => {
      const item = campaign.items.find(candidate => candidate.trailId === trailId);
      const job = campaign.jobs.find(candidate => candidate.candidateId === trailId);
      const outcome = execution && execution.jobs.find(candidate => candidate.candidateId === trailId);
      const row = element('li', outcome ? `is-${outcome.outcome || outcome.status}` : 'is-queued');
      row.append(element('strong', '', item ? item.name : trailId));
      row.append(element('span', '', ` · ${outcome ? (outcome.outcome || outcome.status).replaceAll('-', ' ') : job.action.replaceAll('-', ' ')}`));
      if(outcome && outcome.blockers && outcome.blockers.length){
        row.append(element('span', 'bo-job-blocker', ` · ${outcome.blockers.join(', ')}`));
      }
      if(outcome && outcome.outputRefs && outcome.outputRefs[0]){
        const link = element('a', '', 'Open Cartographer evidence ↗');
        link.href = outcome.outputRefs[0]; link.target = '_blank'; link.rel = 'noopener';
        row.append(link);
      }
      campaignJobs.append(row);
    });
    if(!campaign.jobs.length) campaignJobs.append(element('li', '', 'No additional trails are available to queue.'));
  }

  async function loadCampaign(){
    try{
      const [campaignResponse, executionResponse] = await Promise.all([
        fetch(CAMPAIGN_URL, { cache: 'no-store' }),
        fetch(CAMPAIGN_EXECUTION_URL, { cache: 'no-store' }),
      ]);
      if(campaignResponse.ok){
        renderCampaign(await campaignResponse.json(), executionResponse.ok ? await executionResponse.json() : null);
      }
    }catch(error){ /* The logistics review remains usable without a campaign artifact. */ }
  }

  function renderContentOperations(plan){
    contentDesk.hidden = false;
    contentDeskStatus.textContent = `Cycle ${plan.cycleDate} · ${plan.summary.jobs} draft jobs · nothing published automatically.`;
    contentDeskMetrics.replaceChildren();
    [
      `${plan.summary.activeWorkstreams} active workstreams`,
      `${plan.summary.parkedWorkstreams} parked`,
      `${plan.jobs.filter(job => job.agentId === 'copywriter').length} editing jobs`,
      `${plan.jobs.filter(job => job.agentId === 'visualDirector').length} picture jobs`,
    ].forEach(label => contentDeskMetrics.append(element('span', '', label)));
    contentDeskStreams.replaceChildren();
    plan.workstreams.forEach(stream => {
      const card = element('article', `bo-content-stream is-${stream.status}`);
      const head = element('div', 'bo-content-stream-head');
      const title = element('div');
      title.append(element('h3', '', stream.label), element('p', '', stream.goal));
      head.append(title, element('span', `bo-content-status is-${stream.status}`, stream.status));
      card.append(head);
      const schedule = stream.nextRunOn
        ? `${stream.cadence.replaceAll('-', ' ')} · next cycle ${stream.nextRunOn}`
        : `${stream.cadence.replaceAll('-', ' ')} · waiting for launch`;
      card.append(element('p', 'bo-content-schedule', schedule));
      const outputs = element('ul', 'bo-content-outputs');
      stream.outputs.forEach(output => outputs.append(element('li', '', output)));
      card.append(outputs);
      const jobs = plan.jobs.filter(job => job.action.endsWith(stream.id));
      if(jobs.length){
        const jobList = element('div', 'bo-content-jobs');
        jobs.forEach(job => {
          const row = element('div', 'bo-content-job');
          row.append(
            element('strong', '', job.agentId === 'copywriter' ? 'Copywriter' : 'Visual Director'),
            element('span', '', job.action.replaceAll('-', ' ')),
            element('span', 'bo-content-job-state', job.status)
          );
          jobList.append(row);
        });
        card.append(jobList);
      }else card.append(element('p', 'bo-content-parked', 'No jobs will be created until this workstream is enabled.'));
      contentDeskStreams.append(card);
    });
  }

  async function loadContentOperations(){
    try{
      const response = await fetch(CONTENT_OPERATIONS_URL, { cache: 'no-store' });
      if(response.ok) renderContentOperations(await response.json());
      else contentDeskStatus.textContent = 'No content cycle planned yet. Select “Plan this cycle” to create one.';
    }catch(error){
      contentDeskStatus.textContent = 'Content operations are unavailable through this server.';
    }
  }

  function contentActions(output){
    const wrapper = element('div', 'bo-content-review-actions');
    const note = element('textarea'); note.placeholder = 'Review note or revision instructions…'; note.maxLength = 1500;
    const actions = element('div', 'bo-actions');
    [['approve', 'Approve'], ['request-revision', 'Request revision'], ['reject', 'Reject'], ['clear', 'Clear']].forEach(([action, label]) => {
      const button = element('button', '', label); button.type = 'button';
      if(action === 'approve' && output.status !== 'ready-for-review') button.disabled = true;
      button.addEventListener('click', () => saveContentDecision({ jobId: output.jobId, agentId: output.agentId, action, note: note.value }));
      actions.append(button);
    });
    const saved = contentDecisions[output.jobId];
    wrapper.append(note, actions, element('p', 'bo-decision', saved ? `Saved locally: ${saved.action.replaceAll('-', ' ')}` : 'No content decision saved yet.'));
    return wrapper;
  }

  function renderContentResults(){
    contentDeskResults.replaceChildren();
    if(!contentExecution) return;
    contentDeskResults.append(element('h3', '', `Ready for review · ${contentExecution.subject.id}`));
    contentExecution.outputs.forEach(output => {
      const panel = element('article', `bo-content-result is-${output.status}`);
      panel.append(element('div', 'bo-content-result-head', `${output.agentId === 'copywriter' ? 'Copywriter' : 'Visual Director'} · ${output.status.replaceAll('-', ' ')}`));
      if(output.error) panel.append(element('p', 'bo-job-blocker', output.error));
      if(output.result && output.agentId === 'copywriter'){
        panel.append(element('h4', '', output.result.title), element('p', '', output.result.summary));
        (output.result.changes || []).forEach(change => {
          const diff = element('div', 'bo-content-diff');
          diff.append(element('strong', '', change.section), element('del', '', change.before), element('ins', '', change.after), element('small', '', change.reason));
          panel.append(diff);
        });
        const links = element('div', 'bo-source-links');
        (output.result.sources || []).forEach(source => {
          const link = element('a', '', `${source.label} ↗`); link.href = source.url; link.target = '_blank'; link.rel = 'noopener'; links.append(link);
        });
        panel.append(links);
      }
      if(output.result && output.agentId === 'visualDirector'){
        panel.append(element('p', '', output.result.searchSummary));
        const grid = element('div', 'bo-picture-grid');
        (output.result.candidates || []).forEach(candidate => {
          const item = element('article', `bo-picture-candidate is-${candidate.status}`);
          if(candidate.assetUrl && candidate.status === 'ready'){
            const image = element('img'); image.src = candidate.assetUrl; image.alt = candidate.altText; image.loading = 'lazy'; item.append(image);
          }
          const link = element('a', '', `${candidate.title} ↗`); link.href = candidate.sourcePageUrl; link.target = '_blank'; link.rel = 'noopener';
          item.append(link, element('p', '', candidate.matchEvidence), element('small', '', `${candidate.creator || 'Creator missing'} · ${candidate.license || 'Licence missing'} · ${candidate.status}`));
          grid.append(item);
        });
        panel.append(grid);
      }
      panel.append(contentActions(output)); contentDeskResults.append(panel);
    });
  }

  async function loadContentExecution(){
    try{
      const response = await fetch(CONTENT_EXECUTION_URL, { cache: 'no-store' });
      if(response.ok){ contentExecution = await response.json(); renderContentResults(); }
    }catch(error){ /* Planning remains available without executed work. */ }
  }

  async function loadQueue(){
    try{
      const [response, resolutionResponse, routeReviewResponse] = await Promise.all([
        fetch(QUEUE_URL, { cache: 'no-store' }),
        fetch(DECISION_RESOLUTION_URL, { cache: 'no-store' }),
        fetch(ROUTE_REVIEW_URL, { cache: 'no-store' }),
      ]);
      if(!response.ok) throw new Error(`HTTP ${response.status}`);
      queue = await response.json();
      if(resolutionResponse.ok){
        const resolutionArtifact = await resolutionResponse.json();
        decisionResolutions = resolutionArtifact.resolutions || [];
        currentResolutionAttempt = resolutionArtifact.resolutionAttempt || null;
        currentResolutionLabel = resolutionArtifact.resolutionLabel || null;
      }
      if(routeReviewResponse.ok){
        routeReview = await routeReviewResponse.json();
        await Promise.all(routeReview.items.flatMap(item => (
          item.proposals || (item.proposal ? [item.proposal] : [])
        ).filter(proposal => proposal.geometryRef).map(async proposal => {
          const proposalResponse = await fetch(proposal.geometryRef, { cache: 'no-store' });
          if(!proposalResponse.ok) return;
          const feature = await proposalResponse.json();
          proposal.geometry = feature.geometry;
          proposal.geometryProperties = feature.properties;
        })));
      }
      await Promise.all(queue.candidates.map(async candidate => {
        const dossierUrl = DOSSIER_URLS[candidate.id];
        if(!dossierUrl) return;
        const dossierResponse = await fetch(dossierUrl, { cache: 'no-store' });
        if(dossierResponse.ok) candidate.dossier = await dossierResponse.json();
        const cartographerUrl = CARTOGRAPHER_URLS[candidate.id];
        if(cartographerUrl){
          const resultResponse = await fetch(cartographerUrl, { cache: 'no-store' });
          if(resultResponse.ok) candidate.cartographer = await resultResponse.json();
        }
      }));
      render();
      loadCampaign();
    }catch(error){
      state.classList.add('is-error');
      state.textContent = 'The local logistics queue is unavailable. Run the discovery and logistics commands, then serve the project over HTTP.';
    }
  }

  async function authorize(){
    if(booted) return;
    const local = ['localhost', '127.0.0.1'].includes(location.hostname);
    if(local){
      booted = true;
      state.textContent = 'Local operator mode. Loading review queue…';
      loadQueue();
      return;
    }
    if(!window.DoloPawsModeration) return;
    const result = await window.DoloPawsModeration.getModeratorStatus();
    if(!result.ok){
      state.classList.add('is-error');
      state.textContent = 'Access denied. Sign in with an authorized moderator account.';
      return;
    }
    reviewer = 'firebase-moderator';
    booted = true;
    loadQueue();
  }

  exportButton.addEventListener('click', () => {
    const record = window.ORMAReviewDecisions.exportRecord(queue, decisions);
    record.routeReview = window.ORMARouteReviewDecisions.exportRecord(routeReview, routeDecisions, record.exportedAt);
    record.enrichmentReview = window.ORMAEnrichmentReviewDecisions.exportRecord(enrichmentDecisions, record.exportedAt);
    record.verificationReview = window.ORMAVerificationReviewDecisions.exportRecord(verificationDecisions, record.exportedAt);
    const url = URL.createObjectURL(new Blob([`${JSON.stringify(record, null, 2)}\n`], { type: 'application/json' }));
    const link = element('a');
    link.href = url;
    link.download = `orma-review-decisions-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  });

  batchSize.addEventListener('change', () => { queueNext.textContent = `Queue next ${batchSize.value}`; });
  queueNext.addEventListener('click', async () => {
    queueNext.disabled = true;
    campaignStatus.textContent = 'Creating the next bounded draft batch…';
    try{
      const response = await fetch('/api/campaign/next', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: Number(batchSize.value) }),
      });
      const result = await response.json();
      if(!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
      renderCampaign(result.campaign, null);
    }catch(error){
      campaignStatus.textContent = `Could not queue the next batch: ${error.message}. This control works through the localhost Backoffice server.`;
    }finally{ queueNext.disabled = false; }
  });

  if(planContentCycleButton) planContentCycleButton.addEventListener('click', async () => {
    planContentCycleButton.disabled = true;
    contentDeskStatus.textContent = 'Planning this Content Desk cycle…';
    try{
      const response = await fetch('/api/content-operations/plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ socialEnabled: contentSocialEnabled.checked }),
      });
      const result = await response.json();
      if(!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
      renderContentOperations(result.plan);
    }catch(error){
      contentDeskStatus.textContent = `Could not plan the content cycle: ${error.message}.`;
    }finally{ planContentCycleButton.disabled = false; }
  });

  if(runGuideAgentsButton) runGuideAgentsButton.addEventListener('click', async () => {
    runGuideAgentsButton.disabled = true;
    guideRunnerStatus.textContent = 'Copywriter and Visual Director are working…';
    try{
      const response = await fetch('/api/content-operations/run-guide', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guideId: contentGuideId.value.trim() || null }),
      });
      const result = await response.json();
      if(!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
      contentExecution = result.execution; renderContentResults();
      guideRunnerStatus.textContent = `${contentExecution.summary.readyForReview} results ready; ${contentExecution.summary.blocked} blocked.`;
    }catch(error){ guideRunnerStatus.textContent = `Could not run guide agents: ${error.message}.`; }
    finally{ runGuideAgentsButton.disabled = false; }
  });

  window.addEventListener('dolopaws-auth-ready', authorize, { once: true });
  window.addEventListener('dolopaws-auth-ready', () => {
    if(window.DoloPawsAuth && typeof window.DoloPawsAuth.onChange === 'function'){
      window.DoloPawsAuth.onChange(authorize);
    }
  }, { once: true });
  if(window.DoloPawsAuthReady){
    if(window.DoloPawsAuth && typeof window.DoloPawsAuth.onChange === 'function'){
      window.DoloPawsAuth.onChange(authorize);
    }
    authorize();
  }
  else if(['localhost', '127.0.0.1'].includes(location.hostname)) authorize();
})();
