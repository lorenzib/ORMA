(function(global){
  'use strict';

  // Script-written wording goes through i18n.js; the English sentence is its own key.
  function tx(text, vars){
    const i18n = typeof window !== 'undefined' && window.DoloPawsI18n;
    if (i18n && typeof i18n.phrase === 'function') return i18n.phrase(text, vars);
    return vars ? String(text).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : text;
  }

  // The catalogue and its photos sit beside this script, not beside the page:
  // the guide is also served one folder deeper, as the Italian copy in /it/.
  const SCRIPT_URL = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';
  const fromSite = path => (SCRIPT_URL ? new URL(path, SCRIPT_URL).href : '../' + path);
  // Photo paths in the catalogue are written for guides/, where the English page lives.
  const photoUrl = src => (SCRIPT_URL && src && !/^[a-z]+:|^\//i.test(src) ? new URL(src, new URL('guides/', SCRIPT_URL)).href : src);

  const PRESENTATION = {
    safe:{ label:tx('Low concern'), groupTitle:tx('Safe to pass, not to eat'), icon:'shield', tone:'safe', meaning:tx('No known poisoning risk from normal proximity or sniffing. This does not mean edible.') },
    caution:{ label:tx('In-between'), groupTitle:tx('Avoid chewing or contact'), icon:'triangle', tone:'caution', meaning:tx('Prevent chewing, ingestion or irritating contact.') },
    dangerous:{ label:tx('Toxic if eaten'), groupTitle:tx('Toxic if eaten'), icon:'octagon', tone:'dangerous', meaning:tx('Prevent chewing and keep fallen berries, seeds, bulbs and cuttings out of reach.') },
  };
  const HABITATS = {
    meadow:{ label:tx('Meadow / pasture'), pattern:/meadow|pasture|grassland|lawn|field/i },
    woodland:{ label:tx('Woodland / edge'), pattern:/wood|forest|hedge|scrub|edge|shade/i },
    wet:{ label:tx('Wet / streamside'), pattern:/wet|stream|marsh|damp|river|water|moist/i },
    rocky:{ label:tx('Rocky / dry'), pattern:/rock|scree|dry|wall|alpine turf|slope/i },
    village:{ label:tx('Village / garden'), pattern:/garden|village|roadside|park|ornamental|settlement/i },
  };
  const MONTHS = [tx('January'), tx('February'), tx('March'), tx('April'), tx('May'), tx('June'), tx('July'), tx('August'), tx('September'), tx('October'), tx('November'), tx('December')];
  // Initials follow the month names, so they stay right in every language.
  const MONTH_INITIALS = MONTHS.map(name => name.charAt(0));
  const SEASON_LABELS = { winter:tx('Winter'), spring:tx('Spring'), summer:tx('Summer'), autumn:tx('Autumn') };
  const SEARCH_SYNONYMS = {
    fruit:['fruit', 'berry', 'berries', 'aril', 'arils', 'hip', 'hips'],
    berry:['berry', 'berries', 'fruit', 'aril', 'arils', 'hip', 'hips'],
    berries:['berry', 'berries', 'fruit', 'aril', 'arils', 'hip', 'hips'],
    purple:['purple', 'violet', 'lilac'],
    frutto:['frutt', 'bacc', 'arill', 'cinorrod'],
    frutti:['frutt', 'bacc', 'arill', 'cinorrod'],
    bacca:['bacc', 'frutt', 'arill', 'cinorrod'],
    bacche:['bacc', 'frutt', 'arill', 'cinorrod'],
    viola:['viola', 'violett', 'lilla'],
  };

  // The catalogue is written in English; the Italian page swaps each text field
  // for its translation from data/alpine-plants-it.json (keyed by the English).
  // Codes used for filtering and sorting (ids, safety, severity, season, months)
  // stay as they are, and habitat facets keep reading the English habitats.
  const TEXT_FIELDS = ['commonName', 'summary', 'ingestionRisk', 'elevation', 'dogSafety', 'avoid', 'interestingFact', 'severityLabel'];
  const LIST_FIELDS = ['aliases', 'habitats', 'identification', 'lookalikes', 'symptoms', 'monitor', 'actionIfIngested'];

  function pageLang(){
    const i18n = typeof window !== 'undefined' && window.DoloPawsI18n;
    if(i18n && i18n.lang) return i18n.lang;
    return (typeof document !== 'undefined' && document.documentElement.getAttribute('data-orma-lang')) || 'en';
  }

  function localizePlant(plant, dictionary){
    if(!plant || !dictionary) return plant;
    const say = text => (typeof text === 'string' && Object.prototype.hasOwnProperty.call(dictionary, text) ? dictionary[text] : text);
    const localized = { ...plant, habitatsEn:plant.habitatsEn || plant.habitats };
    TEXT_FIELDS.forEach(field => { if(typeof plant[field] === 'string') localized[field] = say(plant[field]); });
    LIST_FIELDS.forEach(field => { if(Array.isArray(plant[field])) localized[field] = plant[field].map(say); });
    if(Array.isArray(localized.aliases)){
      localized.aliases = localized.aliases.filter((alias, index, list) => alias !== localized.commonName && list.indexOf(alias) === index);
    }
    if(plant.image) localized.image = { ...plant.image, alt:say(plant.image.alt) };
    return localized;
  }
  const AVOID_COPY = {
    'common-yarrow':tx('Do not let your dog graze the flower heads or leaves.'),
    'wild-rose':tx('Keep your dog out of thorny growth and discourage eating hips or foliage.'),
    'hens-and-chicks':tx('Discourage chewing, even though this plant is classed as non-toxic.'),
    'buttercup':tx('Do not let your dog chew fresh flowers, leaves or stems.'),
    'stinging-nettle':tx('Avoid face, eye, paw and bare-skin contact with the stinging hairs.'),
    'monkshood':tx('Do not let your dog chew or lick any part of the plant.'),
    'autumn-crocus':tx('Keep your dog away from flowers, leaves, seeds and bulbs.'),
    'alpine-rhododendron':tx('Do not allow chewing of flowers, leaves or woody stems.'),
    'foxglove':tx('Do not let your dog chew any part, including fallen flowers and leaves.'),
    'lily-of-the-valley':tx('Prevent chewing of leaves, flowers, berries and underground stems.'),
    'european-yew':tx('Keep your dog from needles, twigs, seeds, red arils and hedge clippings.'),
    'daffodil':tx('Prevent chewing and digging; bulbs carry the greatest concentration of toxin.'),
    'arum':tx('Keep your dog from biting the leaves, flower or bright berry spike.'),
    'spring-crocus':tx('Prevent grazing and digging; an uncertain crocus-like plant should be treated cautiously.'),
    'alpine-cyclamen':tx('Prevent chewing and digging; the underground tuber carries the greatest risk.'),
    'roman-chamomile':tx('Do not let your dog graze the flowers or foliage.'),
    'golden-cinquefoil':tx('Discourage grazing even though cinquefoil is classed as non-toxic.'),
    'fireweed':tx('Discourage eating large amounts of flowers or foliage.'),
    'cornflower':tx('Discourage grazing and do not assume every blue flower is cornflower.'),
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
    const source = (plant.habitatsEn || plant.habitats || []).join(' ');
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
    return months.length ? months.join(', ') : tx('Varies / not applicable');
  }

  // Plain-language reading of the catalogue's severity field.
  const SEVERITY = {
    critical:{ label:tx('If eaten: emergency'), tone:'dangerous' },
    high:{ label:tx('If eaten: serious'), tone:'dangerous' },
    moderate:{ label:tx('If eaten: moderate'), tone:'caution' },
    low:{ label:tx('If eaten: mild'), tone:'safe' },
  };

  function monthBar(plant){
    const flowering = new Set(plant.floweringMonths || []);
    const cells = MONTH_INITIALS.map((initial, index) => `<li class="${flowering.has(index + 1) ? 'is-on' : ''}"><span>${initial}</span></li>`).join('');
    return `<ol class="apg-months apg-months--${PRESENTATION[plant.safety].tone}" aria-label="${tx('Flowers in {months}', { months:escapeHtml(floweringMonths(plant.floweringMonths)) })}">${cells}</ol>`;
  }

  function plantCard(plant, month){
    const status = PRESENTATION[plant.safety];
    const image = plant.image && plant.image.src
      ? `<figure class="apg-image"><img src="${escapeHtml(plant.image.src)}" alt="${escapeHtml(plant.image.alt)}" loading="lazy"><details class="apg-photo-credit"><summary aria-label="${tx('Show photo credit')}" title="${tx('Photo credit')}">C</summary><div>${tx('Photo:')} <a href="${escapeHtml(plant.image.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(plant.image.credit)}</a> · ${escapeHtml(plant.image.license)}</div></details></figure>`
      : `<div class="apg-image apg-image--missing" aria-label="${tx('No botanically verified image is available')}"><span aria-hidden="true">⌁</span><b>${tx('Verified image pending')}</b><small>${tx('Use the visible identification features below.')}</small></div>`;
    const avoid = plant.avoid || AVOID_COPY[plant.id] || plant.summary;
    const monitor = (plant.monitor || plant.symptoms || []).slice(0, 5).join(', ');
    const expandButton = plant.image && plant.image.src
      ? `<button class="apg-photo-expand" type="button" data-plant-image="${escapeHtml(plant.image.src)}" data-plant-alt="${escapeHtml(plant.image.alt)}" aria-label="${tx('Expand {name} photograph', { name:escapeHtml(plant.commonName) })}">${expandIcon()}</button>` : '';
    const flowering = inFlower(plant, month) ? `<span class="apg-in-flower">${tx('In flower in {month}', { month:MONTHS[Number(month) - 1] })}</span>` : '';
    const detailId = `plant-more-${escapeHtml(plant.id)}`;
    const identification = (plant.identification || []).slice(0, 3).map(line => `<li>${escapeHtml(line)}</li>`).join('');
    const lookalike = (plant.lookalikes || [])[0];
    const severity = SEVERITY[plant.severity];
    const aliases = (plant.aliases || []).map(escapeHtml).join(', ');
    const habitats = (plant.habitats || []).slice(0, 3).map(escapeHtml).join(', ');
    const source = (plant.evidence || [])[0];
    const habitatsText = habitats && habitats[0].toUpperCase() + habitats.slice(1);
    return `<article class="apg-card apg-card--${status.tone}" data-plant-id="${escapeHtml(plant.id)}">
      <div class="apg-card-visual">${image}<div class="apg-card-label apg-card-label--${status.tone}">${icon(status.icon)}<span>${status.label}</span></div>${expandButton}</div>
      <div class="apg-card-copy">
        ${flowering}
        <h2>${escapeHtml(plant.commonName)}</h2>
        <p class="apg-scientific"><i>${escapeHtml(plant.scientificName)}</i></p>
        <p class="apg-dog-rule"><b>${tx('Avoid:')}</b> ${escapeHtml(avoid)}</p>
        <button class="apg-more" type="button" aria-expanded="false" aria-controls="${detailId}"><span>${tx('How to recognise it')}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
      </div>
      <div class="apg-card-more" id="${detailId}" hidden>
        <div class="apg-more-col">
          <p class="apg-facts">${severity ? `<span class="apg-fact-pill apg-fact-pill--${severity.tone}">${plant.severityLabel ? escapeHtml(plant.severityLabel) : severity.label}</span>` : ''}<span class="apg-fact-pill">${plant.proximitySafe === false ? tx('Avoid touching it too') : tx('Safe to walk past')}</span></p>
          ${plant.ingestionRisk ? `<h3>${tx('Why it matters')}</h3><p>${escapeHtml(plant.ingestionRisk)}</p>` : ''}
          ${identification ? `<h3>${tx('Look for')}</h3><ul>${identification}</ul>` : ''}
          ${lookalike ? `<h3>${tx('Can be confused with')}</h3><p>${escapeHtml(lookalike)}</p>` : ''}
          ${aliases ? `<h3>${tx('Also called')}</h3><p>${aliases}</p>` : ''}
        </div>
        <div class="apg-more-col">
          ${habitats ? `<h3>${tx('Where it grows')}</h3><p>${habitatsText}${plant.elevation ? `. ${escapeHtml(plant.elevation)}` : ''}.</p>` : ''}
          <h3>${tx('Flowers')}</h3>${monthBar(plant)}
          <p class="apg-monitor"><b>${tx('Monitor for:')}</b> ${escapeHtml(monitor || tx('persistent vomiting, diarrhoea or unusual behaviour after chewing plant material'))}.</p>
          ${plant.interestingFact ? `<p class="apg-fact"><b>${tx('Did you know?')}</b> ${escapeHtml(plant.interestingFact)}</p>` : ''}
          ${source ? `<p class="apg-source">${tx('Source:')} <a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.label)}</a></p>` : ''}
        </div>
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
    lightbox.setAttribute('aria-label', tx('Expanded plant photograph'));
    lightbox.innerHTML = `<div class="apg-lightbox__panel"><img class="apg-lightbox__image" alt=""><button class="apg-lightbox__close" type="button" aria-label="${tx('Close expanded photograph')}">${collapseIcon()}</button></div>`;
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
      button.querySelector('span').textContent = open ? tx('Show less') : tx('How to recognise it');
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
      controls.safety.innerHTML = [['', tx('All plants')], ['dangerous', PRESENTATION.dangerous.label], ['caution', PRESENTATION.caution.label], ['safe', PRESENTATION.safe.label]]
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
      controls.months.innerHTML = `<button type="button" class="apg-month apg-month--any" data-plant-month="" aria-pressed="${!state.month}">${tx('Any time')}</button>` +
        MONTHS.map((name, index) => {
          const month = index + 1;
          const flowering = byMonth.filter(plant => inFlower(plant, month));
          return `<button type="button" class="apg-month${month === thisMonth ? ' is-now' : ''}" data-plant-month="${month}" aria-pressed="${String(state.month) === String(month)}" aria-label="${tx('{month}: {count} plants in flower', { month:name, count:flowering.length })}"><span class="apg-bars" aria-hidden="true">${bar(flowering, 'dangerous')}${bar(flowering, 'caution')}${bar(flowering, 'safe')}</span>${name.slice(0, 3)}</button>`;
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
      const plantCount = filtered.length === 1 ? tx('1 plant') : tx('{count} plants', { count:filtered.length });
      controls.count.textContent = state.month
        ? tx('{plants} around in {month}, {flowering} in flower', { plants:plantCount, month:MONTHS[state.month - 1], flowering })
        : plantCount;
      const active = [
        state.query && tx('Search: {query}', { query:state.query }),
        state.season && (SEASON_LABELS[state.season] || state.season[0].toUpperCase() + state.season.slice(1)),
      ].filter(Boolean);
      controls.active.innerHTML = active.map(value => `<span class="apg-active-chip">${escapeHtml(value)}</span>`).join('');
      controls.clear.hidden = !(active.length || state.safety || state.month || state.habitat);
      renderControls();
      controls.results.innerHTML = filtered.length
        ? `<div class="apg-grid">${filtered.map(plant => plantCard(plant, state.month)).join('')}</div>`
        : '<div class="apg-empty"><h2>' + tx('No plants match these filters') + '</h2><p>' + tx('Clear filters, and treat any unknown plant cautiously.') + '</p><button type="button" data-clear-plants>' + tx('Clear all filters') + '</button></div>';
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

    const fetchJson = path => fetch(fromSite(path))
      .then(response => { if(!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); });
    // A missing translation file leaves the catalogue in English rather than failing.
    const translation = pageLang() === 'it' ? fetchJson('data/alpine-plants-it.json').catch(() => null) : Promise.resolve(null);
    Promise.all([fetchJson('data/alpine-plants.json'), translation])
      .then(([collection, dictionary]) => {
        plants = (Array.isArray(collection.plants) ? collection.plants : []).map(plant => {
          const localized = localizePlant(plant, dictionary && typeof dictionary === 'object' ? dictionary : null);
          return localized && localized.image && localized.image.src ? { ...localized, image:{ ...localized.image, src:photoUrl(localized.image.src) } } : localized;
        });
        render();
      })
      .catch(() => {
        controls.results.setAttribute('aria-busy', 'false');
        controls.results.innerHTML = '<div class="apg-empty"><h2>' + tx('The plant catalogue could not load') + '</h2><p>' + tx('The emergency guidance above remains available. Reload when you have a connection, and treat unknown plants cautiously.') + '</p></div>';
        controls.count.textContent = tx('Plant catalogue unavailable');
      });
  }

  const api = { PRESENTATION, HABITATS, normalized, habitatFacets, matches, floweringMonths, seasonOfMonth, inFlower, stateFromUrl, plantCard, localizePlant };
  global.DoloPawsAlpinePlants = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  if(typeof document !== 'undefined'){
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
