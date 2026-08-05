(function(){
  'use strict';
  const api = window.DoloPawsCollections;
  const visual = window.DoloPawsTrailVisual;
  const shell = document.getElementById('collectionDetail');
  if(!api || !visual || !shell || typeof trails === 'undefined') return;

  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
  })[char]);
  const id = new URLSearchParams(window.location.search).get('id');
  const collection = api.get(id);
  if(!collection){
    document.title = 'Collection not found | DoloPaws';
    shell.innerHTML = '<section class="collection-not-found"><h1>Collection not found</h1><p>This collection may have moved or is not available yet.</p><a class="collection-cta" href="collections.html">View all collections</a></section>';
    return;
  }

  const selected = api.trailsFor(collection, trails);
  document.title = `${collection.title} | DoloPaws collections`;
  const description = document.querySelector('meta[name="description"]');
  if(description) description.content = collection.description;

  function safetyLabel(value){
    return {'low-risk':'Low-risk','moderate':'Moderate','caution':'Extra care'}[value] || 'Check details';
  }
  function card(trail){
    const visualHtml = visual.render(trail, { className:'collection-detail-card__visual' });
    const facts = [
      Number.isFinite(trail.distance) ? `${trail.distance} km` : null,
      Number.isFinite(trail.elevation) ? `${trail.elevation} m climb` : null,
      trail.hours ? `${trail.hours} h` : null,
    ].filter(Boolean).join(' · ');
    return `<article class="collection-detail-card">
      <a class="collection-detail-card__image" href="trail.html?id=${encodeURIComponent(trail.id)}">${visualHtml}</a>
      <div class="collection-detail-card__body">
        <div class="collection-detail-card__area">${esc(trail.area || 'Alps')}</div>
        <h2><a href="trail.html?id=${encodeURIComponent(trail.id)}">${esc(trail.name)}</a></h2>
        <p>${esc(facts)}</p>
        <div class="collection-detail-card__footer"><span>${esc(safetyLabel(trail.safetyLevel))}</span><a href="trail.html?id=${encodeURIComponent(trail.id)}">View trail →</a></div>
      </div>
    </article>`;
  }

  shell.innerHTML = `<section class="collection-detail-hero" style="--collection-cover:url('${esc(collection.coverImage)}')">
      <div class="collection-detail-hero__overlay">
        <a class="collection-detail-back" href="collections.html">← All collections</a>
        <div class="collection-detail-kick">DoloPaws collection · ${selected.length} ${selected.length === 1 ? 'trail' : 'trails'}</div>
        <h1>${esc(collection.title)}</h1>
        <p>${esc(collection.subtitle)}</p>
      </div>
    </section>
    <section class="collection-detail-content">
      <div class="collection-detail-intro"><p>${esc(collection.description)}</p>
        <div class="collection-chips">${collection.chips.map(chip => `<span>${esc(chip)}</span>`).join('')}</div>
      </div>
      <div class="collection-detail-heading"><h2>Trails in this collection</h2><span>${selected.length} shown</span></div>
      <div class="collection-detail-grid">${selected.map(card).join('')}</div>
    </section>`;
})();
