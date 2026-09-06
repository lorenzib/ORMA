(function(global){
  'use strict';

  const PRESENTATION = {
    safe:{ label:'Low concern', groupTitle:'Safe to pass, not to eat', icon:'shield', tone:'safe', meaning:'No known poisoning risk from normal proximity or sniffing. This does not mean edible.' },
    caution:{ label:'In-between', groupTitle:'Avoid chewing or contact', icon:'triangle', tone:'caution', meaning:'Prevent chewing, ingestion or irritating contact.' },
    dangerous:{ label:'Dangerous', groupTitle:'Keep out of your dog’s mouth', icon:'octagon', tone:'dangerous', meaning:'Prevent chewing and keep fallen berries, seeds, bulbs and cuttings out of reach.' },
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
  const AVOID_COPY = {
    'common-yarrow':'Do not let your dog graze the flower heads or leaves.',
    'wild-rose':'Keep your dog out of thorny growth and discourage eating hips or foliage.',
    'hens-and-chicks':'Discourage chewing, even though this plant is classed as non-toxic.',
    'buttercup':'Do not let your dog chew fresh flowers, leaves or stems.',
    'stinging-nettle':'Avoid face, eye, paw and bare-skin contact with the stinging hairs.',
    'monkshood':'Keep your dog from mouthing any part of the plant.',
    'autumn-crocus':'Keep your dog away from flowers, leaves, seeds and bulbs.',
    'alpine-rhododendron':'Do not allow chewing of flowers, leaves or woody stems.',
    'foxglove':'Keep all parts out of your dog’s mouth, including fallen flowers and leaves.',
    'lily-of-the-valley':'Prevent chewing of leaves, flowers, berries and underground stems.',
    'european-yew':'Keep your dog from needles, twigs, seeds, red arils and hedge clippings.',
    'daffodil':'Prevent chewing and digging; bulbs carry the greatest concentration of toxin.',
    'arum':'Keep your dog from biting the leaves, flower or bright berry spike.',
    'spring-crocus':'Prevent grazing and digging; an uncertain crocus-like plant should be treated cautiously.',
    'alpine-cyclamen':'Prevent chewing and digging; the underground tuber carries the greatest risk.',
    'roman-chamomile':'Do not let your dog graze the flowers or foliage.',
    'golden-cinquefoil':'Discourage grazing even though cinquefoil is classed as non-toxic.',
    'fireweed':'Discourage eating large amounts of flowers or foliage.',
    'cornflower':'Discourage grazing and do not assume every blue flower is cornflower.',
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

  function expandIcon(){
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></svg>';
  }

  function collapseIcon(){
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8h5V3M21 8h-5V3M3 16h5v5M21 16h-5v5"/></svg>';
  }

  function floweringMonths(values){
    const months = (values || []).map(value => MONTHS[Number(value) - 1]).filter(Boolean);
    return months.length ? months.join(', ') : 'Varies / not applicable';
  }

  function plantCard(plant){
    const status = PRESENTATION[plant.safety];
    const image = plant.image && plant.image.src
      ? `<figure class="apg-image"><img src="${escapeHtml(plant.image.src)}" alt="${escapeHtml(plant.image.alt)}" loading="lazy"><details class="apg-photo-credit"><summary aria-label="Show photo credit" title="Photo credit">C</summary><div>Photo: <a href="${escapeHtml(plant.image.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(plant.image.credit)}</a> · ${escapeHtml(plant.image.license)}</div></details></figure>`
      : '<div class="apg-image apg-image--missing" aria-label="No botanically verified image is available"><span aria-hidden="true">⌁</span><b>Verified image pending</b><small>Use the visible identification features below.</small></div>';
    const avoid = plant.avoid || AVOID_COPY[plant.id] || plant.summary;
    const monitor = (plant.monitor || plant.symptoms || []).slice(0, 5).join(', ');
    const expandButton = plant.image && plant.image.src
      ? `<button class="apg-photo-expand" type="button" data-plant-image="${escapeHtml(plant.image.src)}" data-plant-alt="${escapeHtml(plant.image.alt)}" aria-label="Expand ${escapeHtml(plant.commonName)} photograph">${expandIcon()}</button>` : '';
    return `<article class="apg-card apg-card--${status.tone}" data-plant-id="${escapeHtml(plant.id)}">
      <div class="apg-card-visual">${image}</div>
      <div class="apg-card-copy">
        <div class="apg-card-label apg-card-label--${status.tone}">${icon(status.icon)}<span>${status.label}</span></div>
        <h2>${escapeHtml(plant.commonName)}</h2>
        <p class="apg-scientific"><i>${escapeHtml(plant.scientificName)}</i></p>
        <p class="apg-dog-rule"><b>Avoid:</b> ${escapeHtml(avoid)}</p>
        <p class="apg-monitor"><b>Monitor for:</b> ${escapeHtml(monitor || 'persistent vomiting, diarrhoea or unusual behaviour after chewing plant material')}.</p>
      </div>
      ${expandButton}
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
    const dropdowns = [controls.season, controls.habitat]
      .map(select => global.OrmaAreaDropdown && global.OrmaAreaDropdown.enhance(select))
      .filter(Boolean);
    const state = stateFromUrl(window.location);
    let plants = [];
    let activeExpandTrigger = null;
    const lightbox = document.createElement('dialog');
    lightbox.className = 'apg-lightbox';
    lightbox.setAttribute('aria-label', 'Expanded plant photograph');
    lightbox.innerHTML = `<div class="apg-lightbox__panel"><img class="apg-lightbox__image" alt=""><button class="apg-lightbox__close" type="button" aria-label="Close expanded photograph">${collapseIcon()}</button></div>`;
    document.body.append(lightbox);

    function closeLightbox(){
      if(lightbox.open) lightbox.close();
    }

    function openLightbox(trigger){
      const source = trigger.dataset.plantImage;
      if(!source) return;
      activeExpandTrigger = trigger;
      const image = lightbox.querySelector('.apg-lightbox__image');
      image.src = source;
      image.alt = trigger.dataset.plantAlt || '';
      lightbox.showModal();
      lightbox.querySelector('.apg-lightbox__close').focus();
    }

    controls.results.addEventListener('click', event => {
      const trigger = event.target.closest('.apg-photo-expand');
      if(trigger) openLightbox(trigger);
    });
    lightbox.querySelector('.apg-lightbox__close').addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', event => {
      if(event.target === lightbox || !event.target.closest('.apg-lightbox__image, .apg-lightbox__close')) closeLightbox();
    });
    lightbox.addEventListener('close', () => {
      const image = lightbox.querySelector('.apg-lightbox__image');
      image.removeAttribute('src');
      image.alt = '';
      if(activeExpandTrigger && activeExpandTrigger.isConnected) activeExpandTrigger.focus();
      activeExpandTrigger = null;
    });

    function syncControls(){
      controls.query.value = state.query;
      controls.safetyButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.plantSafety === state.safety)));
      controls.season.value = state.season;
      controls.habitat.value = state.habitat;
      dropdowns.forEach(dropdown => dropdown.refresh());
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
        : '<div class="apg-empty"><h2>No plants match these filters</h2><p>Clear filters, and treat any unknown plant cautiously.</p><button type="button" data-clear-plants>Clear all filters</button></div>';
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
