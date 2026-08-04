(function(){
  const input = document.getElementById('fullSearch');
  const clear = document.getElementById('searchClear');
  const summary = document.getElementById('searchSummary');
  const refine = document.getElementById('searchRefine');
  const results = document.getElementById('searchResults');
  let active = 'Everything';
  let searchResultRecorded = false;
  const initialQuery = new URLSearchParams(location.search).get('q');
  if(initialQuery !== null) input.value = initialQuery;
  const areas = [
    ['Alpe di Siusi / Seiser Alm','14 trails · Dolomites, Italy'],
    ['Val Gardena','18 trails · Dolomites, Italy'],
    ['Sciliar / Schlern','9 trails · Dolomites, Italy']
  ];
  const collections = [
    ['Short and flat','14 trails · under 5 km, gentle ground','90','gentle'],
    ['Rifugio days','9 trails · dog-friendly huts on route','72','water']
  ];
  function esc(value){ const d=document.createElement('div'); d.textContent=String(value == null ? '' : value); return d.innerHTML; }
  function imageFor(trail, index){
    const known = ['images/lago-di-braies.webp','images/lago-di-carezza.webp','images/boucle-du-lac-vert.webp','images/sentier-des-buis.webp'];
    return trail.image || known[index % known.length];
  }
  function hrefFor(t){ return 'trail.html?id=' + encodeURIComponent(t.id) + '&from=search.html'; }
  function row(t, index){
    const match = Math.max(42, 94 - index * 3);
    return '<a class="search-row" href="' + hrefFor(t) + '"><img src="' + esc(imageFor(t,index)) + '" alt=""><span><h3>' + esc(t.name) + '</h3><p>' + esc(t.distance) + ' km · ' + esc(t.elevation) + ' m climb · ' + esc(t.hours) + ' h</p><span class="li-badge">' + esc(t.safetyLevel || 'Low-risk') + '</span></span><span class="search-row-match"><b>' + match + '%</b><small>match</small></span></a>';
  }
  function render(){
    const q = input.value.trim().toLowerCase();
    clear.hidden = !q;
    if(!q){
      summary.textContent = '';
      refine.hidden = true;
      results.innerHTML = '<section class="search-empty"><h2>Search the Dolomites and Savoy</h2><p>Try a valley, a lake, or a trail name — German and Italian names both work.</p></section>';
      return;
    }
    refine.hidden = false;
    let matched = trails.filter(t => (t.name + ' ' + t.area).toLowerCase().includes(q));
    if(!matched.length) matched = trails.filter(t => (t.name + ' ' + t.area).toLowerCase().includes(q.split(/\s+/)[0]));
    matched = matched.slice(0,6);
    if(!searchResultRecorded && window.DoloPawsMetricFunnel){
      const state = matched.length ? 'results_viewed' : 'no_results';
      const recorded = window.DoloPawsMetricFunnel.recordOnce(
        'discovery-results', 'search', 'discovery_search', state, {
          resultCount:matched.length,
          activeFilterCount:active === 'Everything' ? 0 : 1,
          profilePresent:false,
        }
      );
      searchResultRecorded = !!(recorded && recorded.ok);
    }
    summary.innerHTML = matched.length + ' match' + (matched.length === 1 ? '' : 'es') + ' · ranked for <b>Nala</b>';
    let html = '';
    if(active === 'Everything' || active === 'Trails'){
      if(matched.length) html += '<section class="search-results">' + matched.map(row).join('') + '</section>';
      else html += '<section class="search-empty"><h2>Nothing matches that yet</h2><p>We cover the Dolomites and Savoy so far. Try a different valley or lake name.</p></section>';
    }
    if(active === 'Everything' || active === 'Areas'){
      html += '<h2 class="search-subtitle">Areas</h2>' + areas.map(a => '<a class="search-linkrow" href="browse-trails.html?search=' + encodeURIComponent(a[0]) + '"><span><b>' + a[0] + '</b><small>' + a[1] + '</small></span></a>').join('');
    }
    if(active === 'Everything' || active === 'Collections'){
      html += '<h2 class="search-subtitle" style="margin-top:22px">Collections</h2>' + collections.map(c => '<a class="search-linkrow" href="browse-trails.html?collection=' + c[3] + '"><span><b>' + c[0] + '</b><small>' + c[1] + '</small></span><em>' + c[2] + '%</em></a>').join('');
    }
    if(active === 'Guides'){
      html = '<a class="search-linkrow" href="guides/paw-protection.html"><span><b>Protecting paw pads on rocky terrain</b><small>Guide · paws &amp; terrain</small></span></a><a class="search-linkrow" href="guides/water-for-dogs-on-trail.html"><span><b>Water for dogs on alpine trails</b><small>Guide · heat &amp; hydration</small></span></a>';
    }
    results.innerHTML = html;
  }
  input.addEventListener('input', render);
  clear.addEventListener('click', function(){ input.value=''; input.focus(); render(); });
  refine.addEventListener('click', function(event){
    const button = event.target.closest('button[data-refine]');
    if(!button) return;
    active = button.dataset.refine;
    refine.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === button));
    render();
  });
  results.addEventListener('click', function(event){
    const link = event.target.closest('.search-row');
    if(!link || !window.DoloPawsMetricFunnel) return;
    const id = new URL(link.href, window.location.href).searchParams.get('id');
    if(id){
      window.DoloPawsMetricFunnel.recordOnce(
        'trail-selected', id, 'trail_decision', 'selected', { trailId:id }
      );
    }
  });
  render();
})();
