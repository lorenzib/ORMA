(function(global){
  'use strict';

  const PRESENTATION = {
    safe:{ label:'Low concern', groupTitle:'Safe to pass, not to eat', icon:'shield', tone:'safe', meaning:'No known poisoning risk from normal proximity or sniffing. This does not mean edible.' },
    caution:{ label:'In-between', groupTitle:'Avoid chewing or contact', icon:'triangle', tone:'caution', meaning:'Prevent chewing, ingestion or irritating contact.' },
    dangerous:{ label:'Toxic if eaten', groupTitle:'Toxic if eaten', icon:'octagon', tone:'dangerous', meaning:'Prevent chewing and keep fallen berries, seeds, bulbs and cuttings out of reach.' },
  };
  const HABITATS = {
    meadow:{ label:'Meadow / pasture', pattern:/meadow|pasture|grassland|lawn|field/i },
    woodland:{ label:'Woodland / edge', pattern:/wood|forest|hedge|scrub|edge|shade/i },
    wet:{ label:'Wet / streamside', pattern:/wet|stream|marsh|damp|river|water|moist/i },
    rocky:{ label:'Rocky / dry', pattern:/rock|scree|dry|wall|alpine turf|slope/i },
    village:{ label:'Village / garden', pattern:/garden|village|roadside|park|ornamental|settlement/i },
  };
  const MONTH_INITIALS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
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
    'monkshood':'Do not let your dog chew or lick any part of the plant.',
    'autumn-crocus':'Keep your dog away from flowers, leaves, seeds and bulbs.',
    'alpine-rhododendron':'Do not allow chewing of flowers, leaves or woody stems.',
    'foxglove':'Do not let your dog chew any part, including fallen flowers and leaves.',
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

  function seasonOfMonth(month){
    if(month === 12 || month <= 2) return 'winter';
    if(month <= 5) return 'spring';
    return month <= 8 ? 'summer' : 'autumn';
  }

  function inFlower(plant, month){
    return Boolean(month) && (plant.floweringMonths || []).includes(Number(month));
  }

  // A month shows what is in flower then, plus anything whose leaves, berries
  // or bulbs are still around in that season.
  function aroundInMonth(plant, month){
    return !month || inFlower(plant, month) || plant.season.includes(seasonOfMonth(Number(month)));
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
      aroundInMonth(plant, state.month) &&
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

  function monthBar(plant){
    const flowering = new Set(plant.floweringMonths || []);
    const cells = MONTH_INITIALS.map((initial, index) => `<li class="${flowering.has(index + 1) ? 'is-on' : ''}"><span>${initial}</span></li>`).join('');
    return `<ol class="apg-months apg-months--${PRESENTATION[plant.safety].tone}" aria-label="Flowers in ${escapeHtml(floweringMonths(plant.floweringMonths))}">${cells}</ol>`;
  }

  function plantCard(plant, month){
    const status = PRESENTATION[plant.safety];
    const image = plant.image && plant.image.src
      ? `<figure class="apg-image"><img src="${escapeHtml(plant.image.src)}" alt="${escapeHtml(plant.image.alt)}" loading="lazy"><details class="apg-photo-credit"><summary aria-label="Show photo credit" title="Photo credit">C</summary><div>Photo: <a href="${escapeHtml(plant.image.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(plant.image.credit)}</a> · ${escapeHtml(plant.image.license)}</div></details></figure>`
      : '<div class="apg-image apg-image--missing" aria-label="No botanically verified image is available"><span aria-hidden="true">⌁</span><b>Verified image pending</b><small>Use the visible identification features below.</small></div>';
    const avoid = plant.avoid || AVOID_COPY[plant.id] || plant.summary;
    const monitor = (plant.monitor || plant.symptoms || []).slice(0, 5).join(', ');
    const expandButton = plant.image && plant.image.src
      ? `<button class="apg-photo-expand" type="button" data-plant-image="${escapeHtml(plant.image.src)}" data-plant-alt="${escapeHtml(plant.image.alt)}" aria-label="Expand ${escapeHtml(plant.commonName)} photograph">${expandIcon()}</button>` : '';
    const flowering = inFlower(plant, month) ? `<span class="apg-in-flower">In flower in ${MONTHS[Number(month) - 1]}</span>` : '';
    const detailId = `plant-more-${escapeHtml(plant.id)}`;
    const identification = (plant.identification || []).slice(0, 3).map(line => `<li>${escapeHtml(line)}</li>`).join('');
    const lookalike = (plant.lookalikes || [])[0];
    return `<article class="apg-card apg-card--${status.tone}" data-plant-id="${escapeHtml(plant.id)}">
      <div class="apg-card-visual">${image}<div class="apg-card-label apg-card-label--${status.tone}">${icon(status.icon)}<span>${status.label}</span></div>${expandButton}</div>
      <div class="apg-card-copy">
        ${flowering}
        <h2>${escapeHtml(plant.commonName)}</h2>
        <p class="apg-scientific"><i>${escapeHtml(plant.scientificName)}</i></p>
        <p class="apg-dog-rule"><b>Avoid:</b> ${escapeHtml(avoid)}</p>
        <button class="apg-more" type="button" aria-expanded="false" aria-controls="${detailId}"><span>How to recognise it</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
      </div>
      <div class="apg-card-more" id="${detailId}" hidden>
        ${identification ? `<h3>Look for</h3><ul>${identification}</ul>` : ''}
        ${lookalike ? `<h3>Can be confused with</h3><p>${escapeHtml(lookalike)}</p>` : ''}
        <h3>Flowers</h3>${monthBar(plant)}
        <p class="apg-monitor"><b>Monitor for:</b> ${escapeHtml(monitor || 'persistent vomiting, diarrhoea or unusual behaviour after chewing plant material')}.</p>
        ${plant.interestingFact ? `<p class="apg-fact"><b>Did you know?</b> ${escapeHtml(plant.interestingFact)}</p>` : ''}
      </div>
    </article>`;
  }

  function stateFromUrl(location){
    const params = new URLSearchParams(location.search);
    return {
      query:params.get('q') || '', safety:params.get('safety') || '',
      season:params.get('season') || '', habitat:params.get('habitat') || '',
      month:/^(?:[1-9]|1[0-2])$/.test(params.get('month') || '') ? params.get('month') : '',
      dangerousFirst:params.get('dangerousFirst') === '1' || params.get('context') === 'emergency',
    };
  }

  function init(){
    const root = document.getElementById('alpinePlantsGuide');
    if(!root) return;
    const controls = {
      query:document.getElementById('plantSearch'), safety:document.getElementById('plantSafety'),
      months:document.getElementById('plantMonths'), habitat:document.getElementById('plantHabitat'),
      clear:document.getElementById('plantClear'),
      results:document.getElementById('plantResults'), count:document.getElementById('plantResultCount'),
      active:document.getElementById('plantActiveFilters'),
    };
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

    function toggleCard(button){
      const card = button.closest('.apg-card');
      const panel = document.getElementById(button.getAttribute('aria-controls'));
      const open = button.getAttribute('aria-expanded') !== 'true';
      button.setAttribute('aria-expanded', String(open));
      button.querySelector('span').textContent = open ? 'Show less' : 'How to recognise it';
      panel.hidden = !open;
      card.classList.toggle('is-open', open);
    }

    controls.results.addEventListener('click', event => {
      const trigger = event.target.closest('.apg-photo-expand');
      if(trigger) openLightbox(trigger);
      const more = event.target.closest('.apg-more');
      if(more) toggleCard(more);
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

    // Counts and month bars follow the other filters, so each choice shows
    // what it would leave on screen before it is pressed.
    function renderControls(){
      const others = key => plants.filter(plant => matches(plant, { ...state, [key]:'' }));
      const bySafety = others('safety');
      controls.safety.innerHTML = [['', 'All plants'], ['dangerous', PRESENTATION.dangerous.label], ['caution', PRESENTATION.caution.label], ['safe', PRESENTATION.safe.label]]
        .map(([key, label]) => {
          const count = bySafety.filter(plant => !key || plant.safety === key).length;
          return `<button type="button" data-plant-safety="${key}" aria-pressed="${state.safety === key}">${key ? `<span class="apg-dot apg-dot--${PRESENTATION[key].tone}" aria-hidden="true"></span>` : ''}${label} <small>${count}</small></button>`;
        }).join('');
      const byMonth = others('month');
      const bar = (list, safety) => {
        const count = list.filter(plant => plant.safety === safety).length;
        return `<i class="apg-bar apg-bar--${PRESENTATION[safety].tone}" style="height:${count ? Math.min(34, 4 + count * 4) : 0}px"></i>`;
      };
      const thisMonth = new Date().getMonth() + 1;
      controls.months.innerHTML = `<button type="button" class="apg-month apg-month--any" data-plant-month="" aria-pressed="${!state.month}">Any time</button>` +
        MONTHS.map((name, index) => {
          const month = index + 1;
          const flowering = byMonth.filter(plant => inFlower(plant, month));
          return `<button type="button" class="apg-month${month === thisMonth ? ' is-now' : ''}" data-plant-month="${month}" aria-pressed="${String(state.month) === String(month)}" aria-label="${name}: ${flowering.length} plants in flower"><span class="apg-bars" aria-hidden="true">${bar(flowering, 'dangerous')}${bar(flowering, 'caution')}${bar(flowering, 'safe')}</span>${name.slice(0, 3)}</button>`;
        }).join('');
      const pressedMonth = controls.months.querySelector('[aria-pressed="true"]');
      if(pressedMonth && controls.months.scrollWidth > controls.months.clientWidth){
        controls.months.scrollLeft = pressedMonth.offsetLeft - controls.months.offsetLeft - 16;
      }
      controls.habitat.innerHTML = Object.keys(HABITATS)
        .map(key => `<button type="button" class="apg-chip-button" data-plant-habitat="${key}" aria-pressed="${state.habitat === key}">${HABITATS[key].label}</button>`).join('');
      if(controls.query.value !== state.query) controls.query.value = state.query;
    }

    function syncUrl(){
      const params = new URLSearchParams();
      if(state.query) params.set('q', state.query);
      if(state.safety) params.set('safety', state.safety);
      if(state.month) params.set('month', state.month);
      if(state.season) params.set('season', state.season);
      if(state.habitat) params.set('habitat', state.habitat);
      history.replaceState(null, '', `${location.pathname}${params.size ? `?${params}` : ''}${location.hash}`);
    }

    function render(){
      const filtered = plants.filter(plant => matches(plant, state));
      const order = { dangerous:0, caution:1, safe:2 };
      filtered.sort((a, b) => order[a.safety] - order[b.safety] || Number(inFlower(b, state.month)) - Number(inFlower(a, state.month)) || a.commonName.localeCompare(b.commonName));
      const flowering = filtered.filter(plant => inFlower(plant, state.month)).length;
      controls.count.textContent = `${filtered.length} ${filtered.length === 1 ? 'plant' : 'plants'}` +
        (state.month ? ` around in ${MONTHS[state.month - 1]}, ${flowering} in flower` : '');
      const active = [
        state.query && `Search: ${state.query}`,
        state.season && state.season[0].toUpperCase() + state.season.slice(1),
      ].filter(Boolean);
      controls.active.innerHTML = active.map(value => `<span class="apg-active-chip">${escapeHtml(value)}</span>`).join('');
      controls.clear.hidden = !(active.length || state.safety || state.month || state.habitat);
      renderControls();
      controls.results.innerHTML = filtered.length
        ? `<div class="apg-grid">${filtered.map(plant => plantCard(plant, state.month)).join('')}</div>`
        : '<div class="apg-empty"><h2>No plants match these filters</h2><p>Clear filters, and treat any unknown plant cautiously.</p><button type="button" data-clear-plants>Clear all filters</button></div>';
      const emptyClear = controls.results.querySelector('[data-clear-plants]');
      if(emptyClear) emptyClear.addEventListener('click', clearAll);
      controls.results.setAttribute('aria-busy', 'false');
      syncUrl();
    }

    function clearAll(){
      Object.assign(state, { query:'', safety:'', season:'', month:'', habitat:'', dangerousFirst:false });
      render();
      controls.query.focus();
    }

    controls.query.addEventListener('input', event => {
      state.query = event.target.value;
      render();
    });
    root.querySelector('.apg-tools').addEventListener('click', event => {
      const safety = event.target.closest('[data-plant-safety]');
      const month = event.target.closest('[data-plant-month]');
      const habitat = event.target.closest('[data-plant-habitat]');
      if(safety) state.safety = safety.dataset.plantSafety;
      else if(month){ state.month = month.dataset.plantMonth; state.season = ''; }
      else if(habitat) state.habitat = state.habitat === habitat.dataset.plantHabitat ? '' : habitat.dataset.plantHabitat;
      else return;
      render();
    });
    controls.clear.addEventListener('click', clearAll);
    controls.query.value = state.query;

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

  const api = { PRESENTATION, HABITATS, normalized, habitatFacets, matches, floweringMonths, seasonOfMonth, inFlower, stateFromUrl, plantCard };
  global.DoloPawsAlpinePlants = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  if(typeof document !== 'undefined'){
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
