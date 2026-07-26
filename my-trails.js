(function(){
  const FITNESS_DEFAULTS = {
    low:      { terrain:'0', distance:'5'  },
    moderate: { terrain:'1', distance:'10' },
    high:     { terrain:'2', distance:'99' },
  };

  function scoreTrail(t, overrides){
    let score = 100;
    const terrain = parseInt(overrides.terrain, 10);
    const maxDistance = parseFloat(overrides.distance);
    if(t.terrainRank > terrain) score -= (t.terrainRank - terrain) * 30;
    if(t.distance > maxDistance) score -= Math.min(35, (t.distance - maxDistance) * 5);
    if(t.exposure) score -= 30;
    if(t.heatRisk === 'high') score -= overrides.heatSensitive ? 25 : 12;
    else if(t.heatRisk === 'moderate') score -= overrides.heatSensitive ? 10 : 4;
    if(t.shadeCoverage < 20) score -= 10;
    else if(t.shadeCoverage < 40) score -= 5;
    if(t.surfaceHazards && t.surfaceHazards.length > 0){
      score -= Math.min(20, t.surfaceHazards.length * 8);
    }
    return Math.max(5, Math.round(score));
  }

  function safetyLabel(level){
    if(level === 'low-risk') return 'Low-risk terrain';
    if(level === 'moderate') return 'Moderate — some caution';
    return 'Caution — exposed sections';
  }
  function safetyClass(level){
    if(level === 'low-risk') return 'safety-low';
    if(level === 'moderate') return 'safety-moderate';
    return 'safety-caution';
  }

  function escapeHtml(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char]));
  }

  function trailUrl(id){
    return `trail.html?id=${encodeURIComponent(String(id == null ? '' : id))}`;
  }

  function showSaveError(){
    if(!pageSubline) return;
    pageSubline.textContent = 'We could not update your saved trails. Please try again.';
    pageSubline.setAttribute('role', 'alert');
  }

  const loggedOutState = document.getElementById('loggedOutState');
  const loggedInState = document.getElementById('loggedInState');
  const pageSubline = document.getElementById('pageSubline');
  const areaFilterRow = document.getElementById('areaFilterRow');
  const filteredTrailsList = document.getElementById('filteredTrailsList');

  let currentProfile = null;
  let currentFavorites = {};
  let activeArea = 'all';            // legacy
  let activeRegion = 'dolomites';
  let activeValley = 'all';
  let activeProvenance = 'all';

  function overridesFromProfile(profile){
    const defaults = FITNESS_DEFAULTS[profile && profile.fitness] || FITNESS_DEFAULTS.moderate;
    const breedIsHeatSensitive = (typeof HEAT_SENSITIVE_BREEDS !== 'undefined')
      && profile && HEAT_SENSITIVE_BREEDS.includes(profile.breed);
    return { terrain: defaults.terrain, distance: defaults.distance, heatSensitive: breedIsHeatSensitive };
  }

  function renderAreaFilters(){
    if(window.DoloPawsRegions) window.DoloPawsRegions.assign(trails);
    const heading = document.getElementById('trailCountHeading');
    if(heading) heading.textContent = `All our ${trails.length} trails`;
    const regionCounts = { dolomites: 0, savoy: 0 };
    trails.forEach(t => { if(regionCounts[t.region] !== undefined) regionCounts[t.region]++; });
    const valleys = window.DoloPawsRegions ? window.DoloPawsRegions.valleysFor(trails, activeRegion) : [];

    areaFilterRow.innerHTML = `
          <div class="region-tabs">
        ${['dolomites','savoy'].map(r => `
          <button class="region-tab ${r === activeRegion ? 'active' : ''}" data-region="${r}">
            ${r === 'dolomites' ? 'Dolomites' : 'Savoy'} <span class="count">${regionCounts[r]}</span>
          </button>`).join('')}
      </div>
      <div class="prov-row">
        <div class="valley-pills">
          <div class="area-pill ${activeValley === 'all' ? 'active' : ''}" data-valley="all">All valleys</div>
          ${valleys.map(([v, n]) => `
            <div class="area-pill ${v === activeValley ? 'active' : ''}" data-valley="${escapeHtml(v)}">${escapeHtml(v)} <span class="pill-count">${Number(n) || 0}</span></div>`).join('')}
        </div>
        <div class="prov-toggle">
          ${[['all','All'],['verified','🐾 Verified'],['imported','🗺️ Imported']].map(([k, label]) => `
            <div class="prov-opt ${k === activeProvenance ? 'active' : ''}" data-prov="${k}">${label}</div>`).join('')}
        </div>
      </div>`;

    areaFilterRow.querySelectorAll('.region-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        activeRegion = tab.dataset.region;
        activeValley = 'all';
        renderAreaFilters();
        renderList();
      });
    });
    areaFilterRow.querySelectorAll('[data-valley]').forEach(pill => {
      pill.addEventListener('click', () => {
        activeValley = pill.dataset.valley;
        renderAreaFilters();
        renderList();
      });
    });
    areaFilterRow.querySelectorAll('.prov-opt').forEach(opt => {
      opt.addEventListener('click', () => {
        activeProvenance = opt.dataset.prov;
        renderAreaFilters();
        renderList();
      });
    });
  }

  function renderList(){
    const overrides = overridesFromProfile(currentProfile);
    let filtered = trails.filter(t => t.region === activeRegion);
    if(activeValley !== 'all') filtered = filtered.filter(t => t.valley === activeValley);
    if(activeProvenance === 'verified') filtered = filtered.filter(t => t.curated !== false);
    if(activeProvenance === 'imported') filtered = filtered.filter(t => t.curated === false);
    const scored = filtered.map(t => ({...t, score: scoreTrail(t, overrides)})).sort((a,b) => b.score - a.score);

    filteredTrailsList.innerHTML = scored.map(t => {
      const isFav = !!currentFavorites[t.id];
      const url = trailUrl(t.id);
      return `
      <div class="trail-card">
        <div class="photo"></div>
        <div class="body">
          <div class="top-row">
            <span class="safety-badge ${safetyClass(t.safetyLevel)}">${safetyLabel(t.safetyLevel)}</span>
            ${t.curated !== false ? `<span style="font-size:10px;font-weight:700;color:#fff;background:#2E4034;padding:3px 8px;border-radius:10px;white-space:nowrap;">🐾 VERIFIED</span>` : `<span style="font-size:10px;font-weight:700;color:#00695c;background:#e0f2f1;padding:3px 8px;border-radius:10px;white-space:nowrap;">🗺️ IMPORTED</span>`}
            <div style="display:flex;align-items:center;gap:10px;margin-left:auto;">
              <span style="font-weight:700;font-size:12px;color:var(--success);white-space:nowrap;">${t.score}% match</span>
              <button class="fav-btn save-btn ${isFav ? 'saved' : ''}" data-id="${escapeHtml(t.id)}" style="font-size:11.5px;padding:5px 14px;">${isFav ? 'Saved' : 'Save'}</button>
            </div>
          </div>
          <a href="${url}" class="name" style="margin-top:6px;display:block;text-decoration:none;color:inherit;">${escapeHtml(t.name)}</a>
          <div class="meta">${escapeHtml(t.area)} · ${escapeHtml(t.distance)} km · ${escapeHtml(t.elevation)} m gain · ${escapeHtml(t.hours)} h</div>
          <span class="tag">${escapeHtml(t.terrainType)}</span>
          <a href="${url}" style="display:inline-block;margin-top:10px;font-size:12.5px;font-weight:700;color:var(--accent);text-decoration:none;">Trail details →</a>
        </div>
      </div>`;
    }).join('');

    filteredTrailsList.querySelectorAll('.save-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const wasFavorite = !!currentFavorites[id];
        if(currentFavorites[id]) delete currentFavorites[id];
        else currentFavorites[id] = true;
        btn.disabled = true;
        let saved = false;
        try{
          saved = !!(window.DoloPawsAuth && await window.DoloPawsAuth.setFavorites({...currentFavorites}));
        }catch(err){}
        if(!saved){
          if(wasFavorite) currentFavorites[id] = true;
          else delete currentFavorites[id];
          showSaveError();
        }
        renderList();
      });
    });
  }

  function waitForAuth(cb){
    if(window.DoloPawsAuth){ cb(); return; }
    window.addEventListener('dolopaws-auth-ready', cb, { once: true });
  }

  waitForAuth(() => {
    window.DoloPawsAuth.onChange(async (user) => {
      if(!user){
        pageSubline.textContent = "You're not logged in.";
        loggedOutState.hidden = false;
        loggedInState.hidden = true;
        return;
      }

      loggedOutState.hidden = true;
      loggedInState.hidden = false;

      currentProfile = await window.DoloPawsAuth.getDogProfile();
      currentFavorites = await window.DoloPawsAuth.getFavorites();
      pageSubline.textContent = currentProfile && currentProfile.name
        ? `Filtered and scored for ${currentProfile.name}.`
        : `Add your dog's details in Edit profile to see real match scores.`;

      renderAreaFilters();
      renderList();
    });
  });
})();
