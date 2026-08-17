(function(){
  'use strict';

  const QUEUE_URL = 'backoffice-data/logistics-review.json';
  const STORAGE_KEY = 'orma-backoffice-decisions-v1';
  const state = document.getElementById('backofficeState');
  const queueElement = document.getElementById('backofficeQueue');
  const summaryElement = document.getElementById('backofficeSummary');
  const exportButton = document.getElementById('exportDecisions');
  let queue = null;
  let decisions = readDecisions();
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

  function saveDecision(input){
    decisions = window.ORMAReviewDecisions.applyDecision(decisions, { ...input, reviewedBy: reviewer });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(decisions));
    paintDecision(input.candidateId);
    exportButton.disabled = !Object.keys(decisions).length;
  }

  function paintDecision(candidateId){
    const output = document.querySelector(`[data-decision-for="${candidateId}"]`);
    if(!output) return;
    const decision = decisions[candidateId];
    output.textContent = decision
      ? `Saved locally: ${decision.action.replaceAll('-', ' ')} · ${new Date(decision.reviewedAt).toLocaleString()}`
      : 'No decision saved yet.';
  }

  function addMap(container, candidate){
    if(typeof L === 'undefined'){
      container.textContent = 'Map library unavailable.';
      return;
    }
    const route = candidate.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
    const map = L.map(container, { scrollWheelZoom: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18, attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    const line = L.polyline(route, { color: '#2f684e', weight: 5, opacity: .9 }).addTo(map);
    map.fitBounds(line.getBounds(), { padding: [24, 24] });
    (candidate.logistics.parkingSuggestions || []).forEach(parking => {
      const [lng, lat] = parking.position;
      L.marker([lat, lng]).addTo(map).bindPopup(
        `${parking.rank}. ${parking.name}<br>${parking.distanceToRouteM} m from route`
      );
    });
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

    const grid = element('div', 'bo-card-grid');
    const map = element('div', 'bo-map');
    map.id = `map-${candidate.id}`;
    const review = element('div', 'bo-review');
    review.append(element('h3', '', 'Where to park'));
    const suggestions = candidate.logistics.parkingSuggestions || [];
    if(!suggestions.length){
      review.append(element('div', 'bo-empty', 'No mapped parking was found within the search radius. This remains unresolved.'));
    }
    suggestions.forEach(parking => {
      const label = element('label', 'bo-parking');
      const radio = element('input');
      radio.type = 'radio';
      radio.name = `parking-${candidate.id}`;
      radio.value = String(parking.rank);
      const body = element('span');
      body.append(
        element('strong', '', `${parking.rank}. ${parking.name}`),
        element('small', '', `${parking.distanceToRouteM} m from route · confidence ${Math.round(parking.confidence * 100)}%`),
        element('small', '', `${parking.position[1].toFixed(6)}, ${parking.position[0].toFixed(6)}${parking.osmId ? ` · ${parking.osmId}` : ' · OSM ID absent from stored snapshot'}`)
      );
      label.append(radio, body);
      review.append(label);
    });
    const note = element('label', 'bo-note');
    note.append(element('span', '', 'Editorial note'));
    const textarea = element('textarea');
    textarea.maxLength = 500;
    textarea.placeholder = 'Why you accepted, rejected, or left this unresolved…';
    note.append(textarea);
    review.append(note);

    const actions = element('div', 'bo-actions');
    const approve = element('button', '', 'Approve selected parking');
    approve.type = 'button'; approve.dataset.action = 'approve-parking'; approve.disabled = !suggestions.length;
    approve.addEventListener('click', () => {
      const selected = review.querySelector(`input[name="parking-${candidate.id}"]:checked`);
      if(!selected){ window.alert('Select a parking suggestion first.'); return; }
      const parking = suggestions.find(item => item.rank === Number(selected.value));
      saveDecision({ candidateId: candidate.id, action: 'approve-parking', parking, note: textarea.value });
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
    card.append(head, grid);
    queueElement.append(card);
    requestAnimationFrame(() => addMap(map, candidate));
    paintDecision(candidate.id);
  }

  function render(){
    queueElement.replaceChildren();
    queue.candidates.forEach(renderCandidate);
    summaryElement.replaceChildren();
    summaryElement.append(
      element('span', '', `${queue.candidates.length} candidates`),
      element('span', '', `${queue.logistics.withParkingSuggestions} with suggestions`),
      element('span', '', `${queue.logistics.unresolvedParking} unresolved`),
      element('span', '', `${Object.keys(decisions).length} decisions saved locally`)
    );
    summaryElement.hidden = false;
    exportButton.disabled = !Object.keys(decisions).length;
    state.textContent = `${queue.candidates.length} candidates ready for review. Nothing is published by this page.`;
  }

  async function loadQueue(){
    try{
      const response = await fetch(QUEUE_URL, { cache: 'no-store' });
      if(!response.ok) throw new Error(`HTTP ${response.status}`);
      queue = await response.json();
      render();
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
    const url = URL.createObjectURL(new Blob([`${JSON.stringify(record, null, 2)}\n`], { type: 'application/json' }));
    const link = element('a');
    link.href = url;
    link.download = `orma-review-decisions-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
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
