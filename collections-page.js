(function(){
  'use strict';
  const api = window.DoloPawsCollections;
  const grid = document.getElementById('collectionsGrid');
  const feature = document.getElementById('collectionFeature');
  if(!api || !grid || typeof trails === 'undefined') return;

  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
  })[char]);
  const href = collection => `collection.html?id=${encodeURIComponent(collection.id)}`;

  grid.innerHTML = api.all().map(collection => {
    const count = api.trailsFor(collection, trails).length;
    return `<a class="collection-card" href="${href(collection)}">
      <div class="collection-card__image" style="background-image:url('${esc(collection.coverImage)}')" role="img" aria-label="${esc(collection.title)}"></div>
      <div class="collection-card__body"><h2>${esc(collection.title)}</h2><p>${esc(collection.subtitle)}</p>
      <div class="collection-card__meta"><span>${count} ${count === 1 ? 'trail' : 'trails'}</span><span class="collection-card__open">Open collection →</span></div></div>
    </a>`;
  }).join('');

  if(feature){
    const collection = api.get('lake-loops');
    const selected = api.trailsFor(collection, trails).slice(0, 3);
    feature.innerHTML = `<div class="collection-feature__image" role="img" aria-label="${esc(collection.title)}"></div>
      <div class="collection-feature__body">
        <div class="collection-feature__kick">Collection of the month</div>
        <h2 id="featuredCollection">${esc(collection.title)}</h2>
        <p>${esc(collection.description)}</p>
        <div class="collection-chips">${collection.chips.map(chip => `<span>${esc(chip)}</span>`).join('')}</div>
        <div class="collection-trails">${selected.map(trail => `<a class="collection-trail" href="trail.html?id=${encodeURIComponent(trail.id)}"><b>${esc(trail.name)}</b><span>${esc(trail.distance)} km</span></a>`).join('')}</div>
        <a class="collection-cta" href="${href(collection)}">See all ${api.trailsFor(collection, trails).length} trails →</a>
      </div>`;
  }
})();
