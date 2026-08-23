(function(global){
  'use strict';

  const PRESENTATION = {
    safe:{ label:'Low concern', groupTitle:'Safe to pass, not to eat', icon:'shield', tone:'safe', meaning:'No known poisoning risk from normal proximity or sniffing. This does not mean edible.' },
    caution:{ label:'In-between', groupTitle:'Avoid chewing or contact', icon:'triangle', tone:'caution', meaning:'Prevent chewing, ingestion or irritating contact.' },
    dangerous:{ label:'Dangerous', groupTitle:'Keep out of your dog’s mouth', icon:'octagon', tone:'dangerous', meaning:'Suspected ingestion needs urgent veterinary advice.' },
  };
  const HABITATS = {
    meadow:{ label:'Meadow / pasture', pattern:/meadow|pasture|grassland|lawn|field/i },
    woodland:{ label:'Woodland / edge', pattern:/wood|forest|hedge|scrub|edge|shade/i },
    wet:{ label:'Wet / streamside', pattern:/wet|stream|marsh|damp|river|water|moist/i },
    rocky:{ label:'Rocky / dry', pattern:/rock|scree|dry|wall|alpine turf|slope/i },
    village:{ label:'Village / garden', pattern:/garden|village|roadside|park|ornamental|settlement/i },
  };
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const SEARCH_SYNONYMS = {
    fruit:['fruit', 'berry', 'berries', 'aril', 'arils', 'hip', 'hips'],
    berry:['berry', 'berries', 'fruit', 'aril', 'arils', 'hip', 'hips'],
    berries:['berry', 'berries', 'fruit', 'aril', 'arils', 'hip', 'hips'],
    purple:['purple', 'violet', 'lilac'],
  };

  function escapeHtml(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, character => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
    })[character]);
  }

  function normalized(value){
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function habitatFacets(plant){
    const source = (plant.habitats || []).join(' ');
    return Object.keys(HABITATS).filter(key => HABITATS[key].pattern.test(source));
  }

  function matches(plant, state){
    const haystack = normalized([
      plant.commonName, plant.scientificName, ...(plant.aliases || []), plant.summary,
      ...(plant.identification || []), ...(plant.lookalikes || []), ...(plant.habitats || []), plant.image && plant.image.alt,
    ].join(' '));
    const queryTerms = normalized(state.query).split(/\s+/).filter(Boolean);
    return (!queryTerms.length || queryTerms.every(term => (SEARCH_SYNONYMS[term] || [term]).some(candidate => haystack.includes(candidate)))) &&
      (!state.safety || plant.safety === state.safety) &&
      (!state.season || plant.season.includes(state.season)) &&
      (!state.habitat || habitatFacets(plant).includes(state.habitat));
  }

  function icon(kind){
    if(kind === 'shield') return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.5 2.8 7.5 7 9.5 4.2-2 7-5 7-9.5V6l-7-3Z"/><path d="m9 12 2 2 4-5"/></svg>';
    if(kind === 'triangle') return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2.8 20h18.4L12 3Z"/><path d="M12 9v5m0 3h.01"/></svg>';
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 2-6 6v8l6 6h8l6-6V8l-6-6H8Z"/><path d="M12 7v6m0 4h.01"/></svg>';
  }

  function chips(values, className){
    return (values || []).map(value => `<span class="apg-chip ${className || ''}">${escapeHtml(value)}</span>`).join('');
  }

  function list(values, ordered){
    const tag = ordered ? 'ol' : 'ul';
    return `<${tag}>${(values || []).map(value => `<li>${escapeHtml(value)}</li>`).join('')}</${tag}>`;
  }

  function floweringMonths(values){
    const months = (values || []).map(value => MONTHS[Number(value) - 1]).filter(Boolean);
    return months.length ? months.join(', ') : 'Varies / not applicable';
  }

  function plantCard(plant){
    const status = PRESENTATION[plant.safety];
    const detailId = `plant-detail-${plant.id}`;
    const image = plant.image && plant.image.src
      ? `<figure class="apg-image"><img src="${escapeHtml(plant.image.src)}" alt="${escapeHtml(plant.image.alt)}" loading="lazy"><details class="apg-photo-credit"><summary aria-label="Show photo credit">©</summary><div>Photo: <a href="${escapeHtml(plant.image.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(plant.image.credit)}</a> · ${escapeHtml(plant.image.license)}</div></details></figure>`
      : '<div class="apg-image apg-image--missing" aria-label="No botanically verified image is available"><span aria-hidden="true">⌁</span><b>Verified image pending</b><small>Use the visible identification features below.</small></div>';
    const aliases = (plant.aliases || []).length ? `<p class="apg-aliases">Also known as ${escapeHtml(plant.aliases.join(', '))}</p>` : '';
    const urgent = plant.safety === 'dangerous'
      ? `<div class="apg-card-urgent"><strong>Suspected ingestion?</strong> ${escapeHtml(plant.actionIfIngested[0])} <a href="#plant-emergency">See emergency steps</a></div>` : '';
    return `<article class="apg-card apg-card--${status.tone}" data-plant-id="${escapeHtml(plant.id)}">
      <div class="apg-card-visual">${image}<div class="apg-card-status apg-card-status--${status.tone}">${icon(status.icon)}<span>${status.label}</span></div></div>
      <div class="apg-card-copy">
        <h2>${escapeHtml(plant.commonName)}</h2>
        <p class="apg-scientific"><i>${escapeHtml(plant.scientificName)}</i></p>
        ${aliases}
        <p class="apg-look"><b>Look for:</b> ${escapeHtml((plant.identification || []).slice(0, 2).join('. '))}.</p>
        <p class="apg-dog-rule"><b>For your dog:</b> ${escapeHtml(plant.summary)}</p>
        ${urgent}
        <details id="${detailId}" class="apg-detail">
          <summary>See identification, symptoms and what to do</summary>
          <div class="apg-detail-body">
            <div class="apg-chips">${chips(plant.season.map(value => value[0].toUpperCase() + value.slice(1)))}${chips(habitatFacets(plant).map(value => HABITATS[value].label), 'apg-chip--habitat')}</div>
            <section><h3>What to look for</h3>${list(plant.identification)}${plant.lookalikes.length ? `<h4>Possible lookalikes</h4>${list(plant.lookalikes)}` : ''}</section>
            <section><h3>Where and when</h3><p>${escapeHtml(plant.habitats.join('; '))}</p><p><strong>Broad elevation:</strong> ${escapeHtml(plant.elevation)}</p><p><strong>Flowering months:</strong> ${floweringMonths(plant.floweringMonths)}</p></section>
            <section><h3>Dog safety</h3><p>${escapeHtml(plant.dogSafety)}</p><h4>Possible symptoms</h4>${plant.symptoms.length ? list(plant.symptoms) : '<p>No poisoning symptoms are expected from normal proximity. Physical irritation or overeating can still cause problems.</p>'}</section>
            <section class="apg-action apg-action--${status.tone}"><h3>If eaten</h3>${list(plant.actionIfIngested, true)}</section>
            <section><h3>Interesting fact</h3><p>${escapeHtml(plant.interestingFact)}</p></section>
            <footer class="apg-evidence"><p><strong>Veterinary review required</strong> · Evidence confidence: ${escapeHtml(plant.confidence)} · Last content review: ${escapeHtml(plant.lastReviewed)}</p><ul>${plant.evidence.map(item => `<li><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.label)} <span class="sr-only">(opens in a new tab)</span></a></li>`).join('')}</ul></footer>
          </div>
        </details>
      </div>
    </article>`;
  }

  function stateFromUrl(location){
    const params = new URLSearchParams(location.search);
    return {
      query:params.get('q') || '', safety:params.get('safety') || '',
      season:params.get('season') || '', habitat:params.get('habitat') || '',
      dangerousFirst:params.get('dangerousFirst') === '1' || params.get('context') === 'emergency',
    };
  }

  function init(){
    const root = document.getElementById('alpinePlantsGuide');
    if(!root) return;
    const controls = {
      query:document.getElementById('plantSearch'), safetyButtons:[...document.querySelectorAll('[data-plant-safety]')],
      season:document.getElementById('plantSeason'), habitat:document.getElementById('plantHabitat'),
      clear:document.getElementById('plantClear'),
      results:document.getElementById('plantResults'), count:document.getElementById('plantResultCount'),
      active:document.getElementById('plantActiveFilters'),
    };
    const state = stateFromUrl(window.location);
    let plants = [];

    function syncControls(){
      controls.query.value = state.query;
      controls.safetyButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.plantSafety === state.safety)));
      controls.season.value = state.season;
      controls.habitat.value = state.habitat;
    }

    function syncUrl(){
      const params = new URLSearchParams();
      if(state.query) params.set('q', state.query);
      if(state.safety) params.set('safety', state.safety);
      if(state.season) params.set('season', state.season);
      if(state.habitat) params.set('habitat', state.habitat);
      history.replaceState(null, '', `${location.pathname}${params.size ? `?${params}` : ''}${location.hash}`);
    }

    function render(){
      let filtered = plants.filter(plant => matches(plant, state));
      const order = { dangerous:0, caution:1, safe:2 };
      filtered.sort((a, b) => order[a.safety] - order[b.safety] || a.commonName.localeCompare(b.commonName));
      controls.count.textContent = `${filtered.length} ${filtered.length === 1 ? 'plant' : 'plants'} shown`;
      const active = [
        state.query && `Search: ${state.query}`,
        state.safety && PRESENTATION[state.safety] && PRESENTATION[state.safety].label,
        state.season && state.season[0].toUpperCase() + state.season.slice(1),
        state.habitat && HABITATS[state.habitat] && HABITATS[state.habitat].label,
      ].filter(Boolean);
      controls.active.innerHTML = active.map(value => `<span class="apg-active-chip">${escapeHtml(value)}</span>`).join('');
      controls.clear.hidden = !active.length;
      controls.results.innerHTML = filtered.length
        ? ['dangerous', 'caution', 'safe'].map(safety => {
          const group = filtered.filter(plant => plant.safety === safety);
          if(!group.length) return '';
          const status = PRESENTATION[safety];
          return `<section class="apg-group apg-group--${status.tone}" aria-labelledby="plant-group-${status.tone}"><header><div class="apg-badge apg-badge--${status.tone}">${icon(status.icon)}<span>${status.label}</span></div><h2 id="plant-group-${status.tone}">${status.groupTitle}</h2><p>${status.meaning}</p></header><div class="apg-grid">${group.map(plantCard).join('')}</div></section>`;
        }).join('')
        : '<div class="apg-empty"><h2>No plants match these filters</h2><p>Clear filters—and treat any unknown plant cautiously.</p><button type="button" data-clear-plants>Clear all filters</button></div>';
      const emptyClear = controls.results.querySelector('[data-clear-plants]');
      if(emptyClear) emptyClear.addEventListener('click', clearAll);
      controls.results.setAttribute('aria-busy', 'false');
      syncUrl();
    }

    function clearAll(){
      Object.assign(state, { query:'', safety:'', season:'', habitat:'', dangerousFirst:false });
      syncControls();
      render();
      controls.query.focus();
    }

    function bind(control, key, eventName){
      control.addEventListener(eventName || 'change', event => {
        state[key] = control.type === 'checkbox' ? control.checked : event.target.value;
        render();
      });
    }
    bind(controls.query, 'query', 'input');
    bind(controls.season, 'season');
    bind(controls.habitat, 'habitat');
    controls.safetyButtons.forEach(button => button.addEventListener('click', () => {
      state.safety = state.safety === button.dataset.plantSafety ? '' : button.dataset.plantSafety;
      syncControls();
      render();
      document.getElementById('plantResults').scrollIntoView({ behavior:'smooth', block:'start' });
    }));
    controls.clear.addEventListener('click', clearAll);
    syncControls();

    fetch('../data/alpine-plants.json')
      .then(response => { if(!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); })
      .then(collection => {
        plants = Array.isArray(collection.plants) ? collection.plants : [];
        document.getElementById('plantLastReviewed').textContent = collection.meta.lastReviewed;
        render();
      })
      .catch(() => {
        controls.results.setAttribute('aria-busy', 'false');
        controls.results.innerHTML = '<div class="apg-empty"><h2>The plant catalogue could not load</h2><p>The emergency guidance above remains available. Reload when you have a connection, and treat unknown plants cautiously.</p></div>';
        controls.count.textContent = 'Plant catalogue unavailable';
      });
  }

  const api = { PRESENTATION, HABITATS, normalized, habitatFacets, matches, floweringMonths, stateFromUrl, plantCard };
  global.DoloPawsAlpinePlants = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  if(typeof document !== 'undefined'){
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
