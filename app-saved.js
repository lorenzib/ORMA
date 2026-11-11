// A walk's name as the reader sees it (i18n.js); search also keeps the English one.
function trailDisplayName(trail){ var i18n = typeof window !== 'undefined' && window.DoloPawsI18n; return i18n && typeof i18n.trailName === 'function' ? i18n.trailName(trail) : String((trail && trail.name) || ''); }
// The iPhone app's Saved tab: the trails you saved, split into the ones that
// are good today and the ones that are not, with the reason (out of season, a
// low match for your dog), and the routes you drew underneath.
// scripts/build-app.js adds this script to the app's saved.html only; the
// website never loads it. It shows on saved.html opened plainly; any query or
// hash is the full page as before. The verdicts are the ones Explore shows:
// the same engine (recommendTrail), the same words (match-verdict.js) and the
// same season rule (trail-season-words.js). The look is in app-shell.css
// under .app-saved.
(function(){
  if(window.__ormaAppSaved) return;
  window.__ormaAppSaved = true;
  if(window.location.search || window.location.hash) return;

  // Script-written wording goes through i18n.js; the English sentence is its own key.
  function tx(text, vars){
    const i18n = window.DoloPawsI18n;
    if(i18n && typeof i18n.phrase === 'function') return i18n.phrase(text, vars);
    return vars ? String(text).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : text;
  }
  // A number as the reader writes it (6,7 km in Italian); English is unchanged.
  function num(value){ const i18n = typeof window!=='undefined' && window.DoloPawsI18n; return i18n && typeof i18n.num==='function' ? i18n.num(value) : value; }
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
  }[ch]));

  const HEART = '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z"/></svg>';
  const PEN = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6"/></g></svg>';

  let root = null;
  let favs = {};
  let profile = null;
  let state = 'loading';
  let note = '';
  let busy = false;

  function catalogue(){
    // regional-trails-loader.js declares the list at the top level.
    // eslint-disable-next-line no-undef
    return typeof trails !== 'undefined' && Array.isArray(trails) ? trails : [];
  }

  // "7.5 km · 150 m climb · 2 h", as on Explore's cards. A one-way walk is
  // shown there and back (route-return.js).
  function meta(t){
    const routeReturn = window.ORMARouteReturn;
    const shown = routeReturn && routeReturn.isOneWay(t) ? routeReturn.forView(t) : t;
    const back = shown !== t;
    // One decimal: some trails carry 9.528.
    const km = value => Math.round(Number(value) * 10) / 10;
    const parts = [back ? tx('{km} km there and back', { km:km(shown.distance) }) : `${num(km(t.distance))} km`];
    if(Number.isFinite(shown.elevation)) parts.push(tx('{m} m climb', { m:shown.elevation }));
    if(shown.hours) parts.push(`${back ? '≈ ' : ''}${routeReturn ? num(routeReturn.formatDuration(shown.hours)) : `${num(shown.hours)} h`}`);
    return parts.join(' · ');
  }

  // Each saved trail scored the way the old Saved page and Explore score it,
  // then sorted into good today and not today.
  function sortOut(){
    const ov = profile && typeof effectiveOverrides === 'function'
      // eslint-disable-next-line no-undef
      ? effectiveOverrides(profile, null)
      : { terrain:'1', distance:'10', heatSensitive:false };
    const words = window.DoloPawsTrailSeasonWords;
    const verdicts = window.OrmaMatchVerdict;
    const decision = window.DoloPawsRecommendationDecision;
    const month = new Date().getMonth() + 1;
    const guest = typeof window.t === 'function' ? window.t('recommendation.subject.guest') : '';
    const subject = (profile && String(profile.name || '').trim())
      || (guest && guest !== 'recommendation.subject.guest' ? guest : 'a medium dog');
    const good = [];
    const notToday = [];
    catalogue().filter(trail => favs[trail.id]).forEach(trail => {
      // eslint-disable-next-line no-undef
      const rec = typeof recommendTrail === 'function'
        // eslint-disable-next-line no-undef
        ? recommendTrail(trail, ov, window.ORMAScoringConditions && window.ORMAScoringConditions.forTrail(trail))
        : { score:0, category:'not-recommended', cautions:[], unknowns:[] };
      const declared = rec.category === 'recommended' ? 'strong-option' : rec.category;
      // verdictFor already says it in the reader's language.
      const verdict = verdicts ? verdicts.verdictFor({ score:rec.score, category:declared }) : { category:declared, label:'', color:'inherit' };
      const row = { trail, score:rec.score };
      if(words && trail.season && words.outOfSeason(trail.season, month)){
        const best = words.bestTime(trail.season);
        row.why = best ? tx('Out of season. {best}.', { best }) : tx('Out of season this month.');
        notToday.push(row);
      } else if(verdict.category === 'not-recommended'){
        const item = (rec.cautions || [])[0] || (rec.unknowns || [])[0];
        // The reasons say "{name}"; who that is, as Explore says it.
        // A sentence with no dictionary entry comes back as the engine wrote it.
        row.why = item
          ? String(decision ? decision.translatedMessage(item, window.t, { name:subject }) : item.message).split('{name}').join(subject)
          : tx('A low match for your dog today.');
        notToday.push(row);
      } else {
        row.line = verdict.label;
        row.color = verdict.color;
        good.push(row);
      }
    });
    const byScore = (a, b) => b.score - a.score;
    return { good:good.sort(byScore), notToday:notToday.sort(byScore) };
  }

  function card(row, dim){
    const trail = row.trail;
    // The trail's readable address, as everywhere else in the app.
    const regional = window.DoloPawsRegionalData;
    const slug = regional && regional.slugFor ? regional.slugFor(trail.id) : trail.id;
    const href = `trail.html?id=${encodeURIComponent(slug)}&from=saved.html`;
    const thumb = window.DoloPawsTrailVisual
      ? window.DoloPawsTrailVisual.render(trail, { className:'app-saved-ph' })
      : '<div class="trail-visual trail-visual--placeholder app-saved-ph"></div>';
    const line = dim
      ? `<span class="app-saved-why">${esc(row.why)}</span>`
      : `<span class="app-saved-verdict" style="color:${esc(row.color)}">${esc(row.line)}</span>`;
    return `<article class="app-saved-card${dim ? ' is-dim' : ''}">` +
      `<a class="app-saved-link" href="${esc(href)}">${thumb}` +
        `<span class="app-saved-text"><span class="app-saved-name">${esc(trailDisplayName(trail))}</span>` +
        `<span class="app-saved-meta">${esc(meta(trail))}</span>${line}</span></a>` +
      `<button type="button" class="app-saved-heart" data-remove="${esc(trail.id)}" aria-label="${esc(tx('Remove {name} from saved', { name:trailDisplayName(trail) }))}">${HEART}</button>` +
    '</article>';
  }

  function routes(){
    const drafts = window.DoloPawsRouteDrafts ? window.DoloPawsRouteDrafts.read() : [];
    let html = `<h2 class="app-saved-label">${esc(tx('My routes'))}${drafts.length ? ` · ${drafts.length}` : ''}</h2>`;
    if(!drafts.length){
      return html + `<a class="app-saved-route is-empty" href="route-planner.html"><span class="app-saved-ri">${PEN}</span>` +
        `<span class="app-saved-text"><span class="app-saved-name">${esc(tx('Draw a route'))}</span>` +
        `<span class="app-saved-meta">${esc(tx('Routes you draw are kept here.'))}</span></span></a>`;
    }
    return html + drafts.map(record => {
      const distance = record.distanceM < 1000
        ? `${Math.round(record.distanceM / 10) * 10} m`
        : `${num((record.distanceM / 1000).toFixed(1))} km`;
      const date = new Date(record.updatedAt || record.createdAt);
      const when = Number.isNaN(date.getTime()) ? '' : tx('drawn {date}', { date:date.toLocaleDateString(undefined, { day:'numeric', month:'short' }) });
      return `<a class="app-saved-route" href="route-planner.html?route=${encodeURIComponent(record.id)}"><span class="app-saved-ri">${PEN}</span>` +
        `<span class="app-saved-text"><span class="app-saved-name">${esc(record.name)}</span>` +
        `<span class="app-saved-meta">${esc(when ? `${distance} · ${when}` : distance)}</span></span></a>`;
    }).join('');
  }

  function message(title, copy, action){
    return `<div class="app-saved-empty"><p class="app-saved-empty-title">${esc(title)}</p>` +
      `<p class="app-saved-empty-copy">${esc(copy)}</p>${action || ''}</div>`;
  }

  function draw(){
    if(!root) return;
    let count = null;
    let body = '';
    if(state === 'signed-out'){
      body = message(tx('Log in to see your saved trails'), tx('Tap the heart on any trail to keep it here.'),
        `<button type="button" class="app-saved-btn" data-login>${esc(tx('Log in'))}</button>`);
    } else if(state === 'loading'){
      body = `<p class="app-saved-status" role="status">${esc(tx('Loading your saved trails…'))}</p>`;
    } else if(state === 'error'){
      body = message(tx('Your saved trails did not load'), tx('They are still safe. Check your connection and try again.'),
        `<button type="button" class="app-saved-btn" data-retry>${esc(tx('Try again'))}</button>`);
    } else {
      const { good, notToday } = sortOut();
      count = good.length + notToday.length;
      const missing = Object.keys(favs).filter(id => favs[id] && !catalogue().some(trail => trail.id === id)).length;
      if(!count){
        body = message(tx('Nothing saved yet'), tx('Tap the heart on any trail to keep it here.'),
          `<a class="app-saved-btn" href="index.html">${esc(tx('Explore trails'))}</a>`);
      }
      if(good.length) body += `<h2 class="app-saved-label">${esc(tx('Good today'))} · ${good.length}</h2>${good.map(row => card(row, false)).join('')}`;
      if(notToday.length) body += `<h2 class="app-saved-label">${esc(tx('Not today'))} · ${notToday.length}</h2>${notToday.map(row => card(row, true)).join('')}`;
      if(missing) body += `<p class="app-saved-status">${esc(missing === 1
        ? tx('1 saved trail is not available right now. It stays saved.')
        : tx('{count} saved trails are not available right now. They stay saved.', { count:missing }))}</p>`;
    }
    const dog = profile && profile.name;
    root.innerHTML = '<header class="app-saved-head">' +
        `<h1 class="app-saved-title">${esc(tx('Saved'))}</h1>` +
        (count ? `<span class="app-saved-count">${esc(count === 1 ? tx('1 trail') : tx('{n} trails', { n:count }))}</span>` : '') +
      '</header>' +
      '<div class="app-saved-body">' +
        (dog && count ? `<p class="app-saved-sub">${esc(tx('Ranked for {name} today', { name:dog }))}</p>` : '') +
        (note ? `<p class="app-saved-status" role="status">${esc(note)}</p>` : '') +
        body + routes() +
      '</div>';
  }

  function load(){
    const auth = window.DoloPawsAuth;
    note = '';
    if(!auth || !auth.currentUser){
      state = 'signed-out';
      favs = {};
      profile = null;
      draw();
      return;
    }
    state = 'loading';
    draw();
    Promise.all([auth.getFavorites(), auth.getDogProfile()]).then(([nextFavs, nextProfile]) => {
      favs = nextFavs || {};
      profile = nextProfile || null;
      state = 'ready';
      draw();
    }).catch(() => {
      state = 'error';
      draw();
    });
  }

  function onClick(event){
    if(event.target.closest('[data-login]')){
      const accountBtn = document.getElementById('accountBtn');
      if(accountBtn) accountBtn.click();
      return;
    }
    if(event.target.closest('[data-retry]')){ load(); return; }
    const remove = event.target.closest('[data-remove]');
    if(!remove || busy || !window.DoloPawsAuth) return;
    const next = Object.assign({}, favs);
    delete next[remove.dataset.remove];
    busy = true;
    remove.disabled = true;
    window.DoloPawsAuth.setFavorites(next).then(saved => {
      if(!saved) throw new Error('save failed');
      favs = next;
      note = '';
    }).catch(() => {
      note = tx('Could not remove it. Check your connection and try again.');
    }).then(() => {
      busy = false;
      draw();
    });
  }

  function start(){
    document.body.classList.add('app-saved-hub');
    root = document.createElement('div');
    root.className = 'app-saved';
    document.body.insertBefore(root, document.body.firstChild);
    root.addEventListener('click', onClick);
    if(window.DoloPawsAuth) load();
    else { draw(); window.addEventListener('dolopaws-auth-ready', load, { once:true }); }
    window.addEventListener('dolopaws-auth-changed', load);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
