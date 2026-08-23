(function(){
  'use strict';
  const api = window.DoloPawsCollections;
  const grid = document.getElementById('collectionsGrid');
  if(!api || !grid || typeof trails === 'undefined') return;
  if(window.DoloPawsRegions) window.DoloPawsRegions.assign(trails);
  const countrySelect = document.getElementById('collectionCountrySelect');
  const regionSelect = document.getElementById('collectionRegionSelect');
  const valleySelect = document.getElementById('collectionValleySelect');
  const countryDropdown = window.OrmaAreaDropdown.enhance(countrySelect);
  const regionDropdown = window.OrmaAreaDropdown.enhance(regionSelect);
  const valleyDropdown = window.OrmaAreaDropdown.enhance(valleySelect);
  const resultCount = document.getElementById('collectionResultCount');
  const clear = document.getElementById('collectionFiltersClear');
  const search = document.getElementById('collectionSearch');
  const themeButtons = Array.from(document.querySelectorAll('[data-collection-theme]'));

  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
  })[char]);
  const href = collection => `collection.html?id=${encodeURIComponent(collection.id)}`;
  const waterSpecific = value => /\b(water|lake|lakeside|river|stream|fountain|hydration)\b/i.test(String(value || ''));
  let country = 'all';
  let region = 'all';
  let valley = 'all';
  let query = '';
  const themes = new Set();

  const COUNTRIES = [
    { value:'all', label:'All countries' },
    { value:'IT', label:'Italy' },
    { value:'FR', label:'France' },
  ];
  const REGIONS = [
    { value:'all', label:'All regions', countryCode:'all' },
    { value:'dolomites', label:'Dolomites', countryCode:'IT' },
    { value:'savoy', label:'Savoy', countryCode:'FR' },
  ];

  const THEME_MATCHERS = {
    gentle: collection => /gentler|short|flat|modest|easier/i.test(`${collection.id} ${collection.title} ${collection.subtitle}`),
    summer: collection => /hot-day|warmer|shade|water|woodland/i.test(`${collection.id} ${collection.title} ${collection.subtitle} ${collection.chips.join(' ')}`),
    scenic: collection => /lake|lakeside|woodland|scenery|high-level/i.test(`${collection.id} ${collection.title} ${collection.subtitle} ${collection.chips.join(' ')}`),
  };
  const trailsFor = collection => api.trailsFor(collection, trails);
  const trailInArea = trail => (country === 'all' || (country === 'IT' ? trail.region === 'dolomites' : trail.region === 'savoy'))
    && (region === 'all' || trail.region === region);
  const collectionInValley = collection => valley === 'all'
    || trailsFor(collection).some(trail => trail.valley === valley);
  function matches(collection){
    const searchable = `${collection.title} ${collection.subtitle} ${collection.description} ${collection.regionLabel} ${collection.country} ${collection.chips.join(' ')}`.toLowerCase();
    return (country === 'all' || collection.countryCode === country)
      && (region === 'all' || collection.region === region)
      && collectionInValley(collection)
      && (!query || searchable.includes(query))
      && (!themes.size || Array.from(themes).some(theme => THEME_MATCHERS[theme](collection)));
  }
  function countForCountry(value){
    return api.all().filter(item => value === 'all' || item.countryCode === value).length;
  }
  function countForRegion(value){
    return api.all().filter(item => (country === 'all' || item.countryCode === country)
      && (value === 'all' || item.region === value)).length;
  }
  function option(item, count){
    const el = document.createElement('option');
    el.value = item.value;
    el.textContent = `${item.label} (${count})`;
    return el;
  }
  function compactAreaTrigger(select){
    const label = select && select.closest('.area-select-shell')?.querySelector('.area-select-trigger__label');
    const selected = select && select.options[select.selectedIndex];
    if(label && selected) label.textContent = selected.textContent.replace(/\s+\(\d+\)$/, '');
  }
  function valleyEntries(){
    const counts = new Map();
    trails.filter(trailInArea).forEach(trail => {
      if(!trail.valley) return;
      const collections = api.all().filter(collection => trailsFor(collection).some(item => item.id === trail.id));
      if(collections.length) counts.set(trail.valley, new Set([
        ...(counts.get(trail.valley) || []),
        ...collections.map(collection => collection.id),
      ]));
    });
    return [...counts.entries()]
      .map(([name, ids]) => [name, ids.size])
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }
  function renderAreaFilters(){
    countrySelect.replaceChildren(...COUNTRIES.map(item => option(item, countForCountry(item.value))));
    countrySelect.value = country;
    countryDropdown.refresh();
    compactAreaTrigger(countrySelect);
    const availableRegions = REGIONS.filter(item => item.value === 'all'
      || country === 'all' || item.countryCode === country);
    regionSelect.replaceChildren(...availableRegions.map(item => option(item, countForRegion(item.value))));
    regionSelect.value = region;
    regionDropdown.refresh();
    compactAreaTrigger(regionSelect);
    const valleys = valleyEntries();
    if(valley !== 'all' && !valleys.some(([name]) => name === valley)) valley = 'all';
    const areaCollectionCount = api.all().filter(collection => (country === 'all' || collection.countryCode === country)
      && (region === 'all' || collection.region === region)).length;
    valleySelect.replaceChildren(
      option({ value:'all', label:'All valleys' }, areaCollectionCount),
      ...valleys.map(([name, count]) => option({ value:name, label:name }, count)),
    );
    valleySelect.value = valley;
    valleyDropdown.refresh();
    compactAreaTrigger(valleySelect);
  }
  function card(collection){
    const count = api.trailsFor(collection, trails).length;
    return `<article class="simple-card collection-list-card">
      <a class="photo collection-list-card__photo" href="${href(collection)}" style="background-image:url('${esc(collection.coverImage)}')" aria-label="Open ${esc(collection.title)}"></a>
      <a class="simple-card__main" href="${href(collection)}">
        <div class="name">${esc(collection.title)}</div>
        <div class="simple-card__meta">${esc(collection.regionLabel)} · ${esc(collection.country)} · ${count} ${count === 1 ? 'trail' : 'trails'}</div>
      </a>
      <div class="simple-card__facts">
        <span class="simple-card__reason"><b aria-hidden="true">✓</b>${esc(collection.tripLength)}</span>
        <span class="simple-card__reason${waterSpecific(collection.chips[0]) ? ' simple-card__reason--water' : ''}">${esc(collection.chips[0])}</span>
      </div>
      <div class="simple-card__match collection-list-card__scope">
        <div class="simple-card__match-actions"><a class="collection-list-card__open" href="${href(collection)}">Open collection →</a></div>
      </div>
    </article>`;
  }
  function render(){
    renderAreaFilters();
    const filtered = api.all().filter(matches);
    grid.innerHTML = filtered.map(card).join('');
    resultCount.textContent = `${filtered.length} ${filtered.length === 1 ? 'collection' : 'collections'}`;
    themeButtons.forEach(button => button.setAttribute('aria-pressed', String(themes.has(button.dataset.collectionTheme))));
    clear.hidden = country === 'all' && region === 'all' && valley === 'all' && !query && themes.size === 0;
  }
  countrySelect.addEventListener('change', () => {
    country = countrySelect.value;
    const selectedRegion = REGIONS.find(item => item.value === region);
    if(selectedRegion && selectedRegion.countryCode !== 'all' && selectedRegion.countryCode !== country) region = 'all';
    valley = 'all';
    render();
  });
  regionSelect.addEventListener('change', () => {
    region = regionSelect.value;
    const selectedRegion = REGIONS.find(item => item.value === region);
    if(selectedRegion && selectedRegion.countryCode !== 'all') country = selectedRegion.countryCode;
    valley = 'all';
    render();
  });
  valleySelect.addEventListener('change', () => { valley = valleySelect.value; render(); });
  themeButtons.forEach(button => button.addEventListener('click', () => {
    const theme = button.dataset.collectionTheme;
    if(themes.has(theme)) themes.delete(theme); else themes.add(theme);
    render();
  }));
  search.addEventListener('input', () => { query = search.value.trim().toLowerCase(); render(); });
  clear.addEventListener('click', () => {
    country = 'all'; region = 'all'; valley = 'all'; query = ''; themes.clear(); search.value = ''; render();
  });
  render();
})();
