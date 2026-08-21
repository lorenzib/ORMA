(function(){
  'use strict';
  const api = window.DoloPawsCollections;
  const grid = document.getElementById('collectionsGrid');
  if(!api || !grid || typeof trails === 'undefined') return;
  const countrySelect = document.getElementById('collectionCountrySelect');
  const regionSelect = document.getElementById('collectionRegionSelect');
  const countryDropdown = window.OrmaAreaDropdown.enhance(countrySelect);
  const regionDropdown = window.OrmaAreaDropdown.enhance(regionSelect);
  const resultCount = document.getElementById('collectionResultCount');
  const clear = document.getElementById('collectionFiltersClear');

  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
  })[char]);
  const href = collection => `collection.html?id=${encodeURIComponent(collection.id)}`;
  const waterSpecific = value => /\b(water|lake|lakeside|river|stream|fountain|hydration)\b/i.test(String(value || ''));
  let country = 'all';
  let region = 'all';

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

  function matches(collection){
    return (country === 'all' || collection.countryCode === country)
      && (region === 'all' || collection.region === region);
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
  function renderAreaFilters(){
    countrySelect.replaceChildren(...COUNTRIES.map(item => option(item, countForCountry(item.value))));
    countrySelect.value = country;
    countryDropdown.refresh();
    const availableRegions = REGIONS.filter(item => item.value === 'all'
      || country === 'all' || item.countryCode === country);
    regionSelect.replaceChildren(...availableRegions.map(item => option(item, countForRegion(item.value))));
    regionSelect.value = region;
    regionDropdown.refresh();
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
    resultCount.textContent = `${filtered.length} ${filtered.length === 1 ? 'collection' : 'collections'} in this area`;
    clear.hidden = country === 'all' && region === 'all';
  }
  countrySelect.addEventListener('change', () => {
    country = countrySelect.value;
    const selectedRegion = REGIONS.find(item => item.value === region);
    if(selectedRegion && selectedRegion.countryCode !== 'all' && selectedRegion.countryCode !== country) region = 'all';
    render();
  });
  regionSelect.addEventListener('change', () => {
    region = regionSelect.value;
    const selectedRegion = REGIONS.find(item => item.value === region);
    if(selectedRegion && selectedRegion.countryCode !== 'all') country = selectedRegion.countryCode;
    render();
  });
  clear.addEventListener('click', () => { country = 'all'; region = 'all'; render(); });
  render();
})();
