// A walk's name as the reader sees it (i18n.js); search also keeps the English one.
function trailDisplayName(trail){ var i18n = typeof window !== 'undefined' && window.DoloPawsI18n; return i18n && typeof i18n.trailName === 'function' ? i18n.trailName(trail) : String((trail && trail.name) || ''); }


// Script-written wording goes through i18n.js; the English sentence is its own key.
function tx(text, vars){
  const i18n = typeof window !== 'undefined' && window.DoloPawsI18n;
  if (i18n && typeof i18n.phrase === 'function') return i18n.phrase(text, vars);
  return vars ? String(text).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : text;
}
// A number as the reader writes it (6,7 km in Italian); English is unchanged.
function localNum(value){ const i18n = typeof window!=='undefined' && window.DoloPawsI18n; return i18n && typeof i18n.num==='function' ? i18n.num(value) : value; }

function safetyLabel(level){
  if(level === 'low-risk') return t('safety.low');
  if(level === 'moderate') return t('safety.moderate');
  return t('safety.caution');
}
function trailSafetyLabel(trail){
  const base = safetyLabel(trail.safetyLevel);
  return window.DoloPawsTrailTrust ? window.DoloPawsTrailTrust.riskLabel(trail, base) : base;
}
function safetyClass(level){
  if(level === 'low-risk') return 'safety-low';
  if(level === 'moderate') return 'safety-moderate';
  return 'safety-caution';
}
function productBadge(type, label){
  if(window.DoloPawsIcons) return window.DoloPawsIcons.badgeHtml(type, label);
  return `<span class="dp-badge dp-badge--${type}"><span>${label}</span></span>`;
}
function productIcon(icon, size = 14){
  return window.DoloPawsIcons ? window.DoloPawsIcons.renderIconSvg(icon, { mode:'inline', color:'currentColor', size }) : '';
}
function trailCardVisual(trail, options = {}){
  if(window.DoloPawsTrailVisual) return window.DoloPawsTrailVisual.render(trail, options);
  const className = options.className || 'photo';
  const data = options.dataTrailId ? ` data-trail-id="${options.dataTrailId}"` : '';
  const fallback = trail.imageIcon ? `<img src="${trail.imageIcon}" alt="${trailDisplayName(trail)}" loading="lazy">` : (pathThumbnailSvg(trail.path) || '');
  return `<div class="${className}"${data}>${fallback}</div>`;
}

// ============================================================
// The profile a visitor is scored against before they add a dog. Read through
// scoring.js so there is one definition, but tolerate it being absent: script.js
// is also evaluated standalone (tests, and any page that loads it without the
// scoring stack), and a missing engine must not take the homepage down.
function guestOverrides(){
  const scoring = window.DoloPawsScoring;
  return (scoring && scoring.GUEST_SUBJECT) || {};
}

// Scores a trail against the medium-dog guest profile, for surfaces shown
// before anyone has added a dog.
function guestMatchScore(trail){
  const scoring = window.DoloPawsScoring;
  if(!scoring || typeof scoring.scoreTrail !== 'function') return null;
  try{ return scoring.scoreTrail(trail, scoring.GUEST_SUBJECT); }
  catch(error){ return null; }
}

// GUEST TEASER, generic default profile, illustrative blurred scores
// ============================================================
function renderTeaser(){
  const grid = document.getElementById('teaserGrid');
  if(!grid || typeof trails === 'undefined') return;

  const generic = guestOverrides();
  const picks = ['lago-braies', 'alpe-siusi', 'santa-maddalena']
    .map(id => trails.find(t => t.id === id))
    .filter(Boolean);

  grid.innerHTML = picks.map(t => `
    <div class="teaser-card">
      ${trailCardVisual(t, { className:'photo' })}
      <div class="row">
        <div class="name">${trailDisplayName(t)}</div>
        <div class="match">${scoreTrail(t, generic)}%<span class="match-note">${window.t('teaser.example')}</span></div>
      </div>
      <div class="meta">${t.ref ? window.t('card.trailRef', {ref: t.ref}) + ' · ' : ''}${t.area} · ${localNum(t.distance)} km</div>
    </div>
  `).join('');
}

function goToProfileCreation(){
  const user = window.DoloPawsAuth && window.DoloPawsAuth.currentUser;
  if(user){
    window.location.href = 'account.html?mode=add&next=%2F';
  } else if(window.DoloPawsWizard){
    // Guests build the dog profile FIRST (no account needed); the
    // signup ask comes only after they've seen their dog's matches.
    window.DoloPawsWizard.open();
  } else if(window.DoloPawsAuthUI){
    window.DoloPawsAuthUI.openSignup();
  }
}

renderTeaser();
const createProfileBtn = document.getElementById('createProfileBtn');
if(createProfileBtn) createProfileBtn.addEventListener('click', goToProfileCreation);

// Deep link from trail pages: index.html?profile=1 opens the wizard for
// guests (trail pages don't carry the wizard markup themselves).
if(new URLSearchParams(location.search).get('profile') === '1'){
  window.addEventListener('load', () => {
    const user = window.DoloPawsAuth && window.DoloPawsAuth.currentUser;
    if(!user && window.DoloPawsWizard) window.DoloPawsWizard.open();
  });
}
const unlockBtn = document.getElementById('unlockBtn');
// The teaser button previews the catalog (30 trails visible, details
// locked behind login) instead of jumping straight to signup.
if(unlockBtn) unlockBtn.addEventListener('click', () => { window.location.href = 'browse-trails.html'; });

// ============================================================
// RETURNING VISITOR, real profile, real scoring, real favorites,
// genuine "new since last visit" detection (not a decorative badge).
// ============================================================
const NEW_MATCH_THRESHOLD = 70; // trails scoring at/above this count as "a match" for new-match tracking
let adjustOverride = null; // session-only override, never saved to the profile
let showFullList = false;  // homepage: top matches first, full catalog on demand
const TOP_MATCHES = 6;

// ---- Browse-map cartography -------------------------------------------
// A browse map answers "which of these walks?", and only the six numbered
// matches are candidates for that answer. Everything else -- the other 51
// catalogue trails, the full marked network, the relief -- is context, and it
// was all drawn at the weight of an answer.
//
// `rank` is 1..TOP_MATCHES on a match and absent on the rest.
const TOP_MATCH_TEST = ['<=', ['coalesce', ['get', 'rank'], 999], TOP_MATCHES];


// The top few recommendations each receive the full explanation and primary
// action, presented as co-equal picks; the remaining ranked trails stay compact
// alternatives below them.
const TOP_PICKS = 3;
let currentFavorites = {};
let homeActionStatusTimer = null;

function showHomeActionStatus(message){
  let status = document.getElementById('homeActionStatus');
  if(!status){
    status = document.createElement('div');
    status.id = 'homeActionStatus';
    status.className = 'dw-toast';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    document.body.appendChild(status);
  }
  if(homeActionStatusTimer) clearTimeout(homeActionStatusTimer);
  status.textContent = message;
  status.hidden = false;
  status.className = 'dw-toast dw-toast--in';
  homeActionStatusTimer = setTimeout(() => {
    status.hidden = true;
    status.className = 'dw-toast';
  }, 4200);
}

(function showAccountDeletionReceipt(){
  try{
    const url = new URL(window.location.href);
    if(url.searchParams.get('accountDeleted') !== '1') return;
    const device = url.searchParams.get('device');
    const translate = (key, fallback) => window.t ? window.t(key) : fallback;
    const message = device === 'removed'
      ? translate('account.delete.receipt.removed', 'Account deleted. Private server data and ORMA data on this device were removed. Community and moderation records may be retained for safety or legal obligations.')
      : device === 'maps-retained'
        ? translate('account.delete.receipt.mapsRetained', 'Account deleted. Private server data was removed. Downloaded public maps remain on this device; community and moderation records may also be retained.')
        : translate('account.delete.receipt.cleanupIncomplete', 'Account deleted, but device cleanup did not finish. Clear ORMA site data in your browser settings before sharing this device.');
    showHomeActionStatus(message);
    url.searchParams.delete('accountDeleted');
    url.searchParams.delete('device');
    window.history.replaceState({}, '', url.pathname + (url.search ? url.search : '') + url.hash);
  }catch(error){ /* deletion already completed; receipt failure must not break home */ }
})();

let showingSavedOnly = false;
let activeArea = 'all';

// Pagination for the trail list, 15 cards per page. The map always shows
// ALL trails matching the current filters; only the card list paginates.
const TRAILS_PER_PAGE = 15;
let currentPage = 1;
let lastFilterKey = '';            // legacy, kept for safety
// Geography is no longer a set of dropdowns: the unified search and the map
// are the geography controls, so the homepage loads every region and defaults
// to "all". A ?region= deep link still narrows the initial view.
// The region a ?region= link asked for, kept apart from activeRegion: the
// page sets activeRegion itself when it opens on a region, and that must not
// be read back as a link someone shared.
const LI_LINKED_REGION = (() => {
  try {
    const requested = new URLSearchParams(window.location.search).get('region');
    if(requested && requested !== 'all' && Object.prototype.hasOwnProperty.call(liRegionConfigs(), requested)) return requested;
    return 'all';
  } catch(e) { return 'all'; }
})();
let activeRegion = LI_LINKED_REGION;
let activeCountry = liCountryForRegion(activeRegion);
let activeValley = 'all';
// The geography the map replaced, so "Clear map area" puts back the area the
// owner chose rather than dropping them at the location gate to choose again.
// Held in memory only: a reload returns to the stored typed area anyway, which
// is the same answer by a different route.
let liContextBeforeMapArea = null;
// What "Show all trails" in the list header left: the area and the filters,
// so its "Back to Alta Pusteria" puts both back. Memory only, like the above.
let liContextBeforeShowAll = null;
// When our own reframing (fitBounds) should be finished by. Movement before
// then is ours, not the reader's, and must not be read as "look here instead".
// A deadline rather than a one-shot flag: an eased fitBounds, and the resize
// that follows a pane switch, can settle in more than one moveend, and the
// second one used to arrive looking exactly like a pan.
let liMapAutoFramingUntil = 0;
const LI_MAP_AUTO_FRAME_MS = 1400;
let sortKey = 'match';             // 'match' | 'distance' | 'effort', Companion sort control
// Said beside the list's count: the order the trails are in.
const LI_SORT_ORDER_WORDS = Object.freeze({
  get match(){ return tx('best fit first'); }, get distance(){ return tx('shortest first'); },
  get effort(){ return tx('least climb first'); }, get today(){ return tx('best for today first'); },
});
let selectedTrailId = null;        // map pin / card selection (Companion layout)
// "In season" in the list header: only the walks in season this month, by
// the same rule as the "Out of season" tag (trail-season-words.js
// outOfSeason). The order stays the ranked one.
let liInSeasonOnly = false;

// Logged-in shell (map + list app layout), header search + filter panel state.
// These sit on top of the region/valley filters above.
let liQuery = '';                  // header search box
// Filter semantics follow the design's chip options (AppShell FilterBar):
// dist 'any'|'u5'|'5to10'|'10p' · risk 'any'|'low-risk'|'moderate'|'caution'
// · terrain 'any'|'soft'|'mixed'|'rocky' · shade 'any'|'40'|'60'.
let liFilters = { dist: 'any', risk: 'any', terrain: 'any', shade: 'any', minMatch: 0, water: false, duration: 'day', lifts: '' };
// Whether the dog the list is ranked for may ride an open chairlift: declared
// safe in the profile and light enough to be held. Everything else hides
// chairlift-assisted routes from the list; the trail page still explains why.
let liChairliftSafe = false;
let liShellWired = false;          // header/menus are wired once per page load
let liDevView = false;             // ?view=returning preview without an account
let liNewMatchIds = new Set();
let liNewMatchSyncKey = '';
let liNewMatchSyncInFlight = null;
let liPendingLocationCenter = null;

// A dog-fit score is not a useful homepage recommendation until it is scoped
// to somewhere the owner can actually walk. Exact device coordinates live in
// sessionStorage only; a manually chosen region or valley is remembered
// between visits. Neither is written to the user's cloud profile.
const LI_LOCATION_RADIUS_KM = 25;
// A town is a place someone is staying, not where they are standing, so it
// reaches further than "Use my location" does. data/towns.json is built with
// the same number and only keeps towns that have a walk inside it.
const LI_TOWN_RADIUS_KM = 40;
let liTowns = null;
const LI_LOCATION_SESSION_KEY = 'orma-home-current-location-v1';
// The region or valley the reader last chose, kept in this browser so a
// reload or a new visit opens where they left it. It lived in sessionStorage
// for a while, so a new tab or a reopened app forgot it and fell back to
// whatever region the page guessed -- Friuli, for anyone who had last opened
// Laghi di Fusine. v1 was kept per visit; v2 is the durable key.
const LI_AREA_STORAGE_KEY = 'orma-home-chosen-area-v2';
const LI_VISIT_AREA_KEY = 'orma-home-selected-area-v1';
const LI_WALK_DATE_SESSION_KEY = 'orma-home-walk-date-v1';
const LI_LOCATION_LABEL_ALIASES = Object.freeze({
  'Alta Pusteria – Tre Cime':'Alta Pusteria',
});
// The whole catalogue, for the ?all=1 link only. A walk is planned in one
// place, so the page itself never opens on the Dolomites and Savoy mixed.
const LI_ALL_TRAILS_CONTEXT = Object.freeze({ kind:'area', country:'all', region:'all', valley:'all', label:'All ORMA trails', transient:true });
const LI_REGION_LABELS = Object.freeze({ dolomites:'The Dolomites', savoy:'Savoy', frenchalps:'French Alps', lombardy:'Lombardy', friuli:'Friuli Venezia Giulia', aosta:'Valle d’Aosta', piedmont:'Piedmont', veneto:'Veneto', tyrol:'Tyrol & Carinthia', switzerland:'Switzerland' });
// The last trails opened, kept by trail.js in this browser only, for the
// dog menu's shortlist.
const LI_RECENT_TRAILS_KEY = 'orma-recent-trails-v1';

// One region. `auto` marks a region the page chose for itself, which a
// location already allowed may still narrow to "near you"; one the reader
// picked is kept for the visit instead.
function liRegionContext(region, auto){
  const context = {
    kind:'area', country:liCountryForRegion(region), region, valley:'all',
    label:LI_REGION_LABELS[region] || region,
  };
  if(auto){ context.transient = true; context.auto = true; }
  return context;
}

function liCatalogueTrails(){
  return typeof trails !== 'undefined' && Array.isArray(trails) ? trails : [];
}

// Where the page opens with nothing chosen: the Dolomites, the launch region.
// It used to follow the trail looked at most recently, so opening one trail
// elsewhere quietly moved every later visit there. A location already allowed
// still narrows this to "near you" after load (liProbeLocationPermission).
function liDefaultLocationContext(){
  return liRegionContext('dolomites', true);
}
function liIsAllTrailsContext(context){
  return !!context && context.kind === 'area'
    && (context.country || 'all') === 'all' && (context.region || 'all') === 'all' && (context.valley || 'all') === 'all';
}
let liLocationContext = liLoadLocationContext();
let liAreaChoices = [];
let liLocationForecastKey = '';

function liDisplayLocationLabel(label){
  const value = String(label || '');
  return LI_LOCATION_LABEL_ALIASES[value] || value;
}

// The place names ORMA writes itself, said in the reader's language. Stored
// contexts keep the English label; only what is shown goes through here.
function liShownPlaceLabel(label){
  const value = liDisplayLocationLabel(label);
  const own = {
    'All ORMA trails':tx('All ORMA trails'), 'Map area':tx('Map area'),
    'The Dolomites':tx('The Dolomites'), 'Dolomites':tx('Dolomites'), 'Savoy':tx('Savoy'),
    'Lombardy':tx('Lombardy'), 'Tyrol & Carinthia':tx('Tyrol & Carinthia'),
    'Italy':tx('Italy'), 'France':tx('France'), 'Austria':tx('Austria'),
    'Switzerland':tx('Switzerland'), 'French Alps':tx('French Alps'), 'Piedmont':tx('Piedmont'),
  };
  return Object.prototype.hasOwnProperty.call(own, value) ? own[value] : value;
}

// The kind of place a search suggestion is. The type itself stays English,
// because it is compared ("Valley"); only the shown word is translated.
function liPlaceTypeLabel(type){
  const own = { City:tx('City'), Town:tx('Town'), Valley:tx('Valley'), Country:tx('Country'), Region:tx('Region') };
  return Object.prototype.hasOwnProperty.call(own, type) ? own[type] : type;
}

function liLocalDateIso(date){
  const value = date instanceof Date ? date : new Date(date);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function liDateOffsetIso(days){
  const value = new Date();
  value.setHours(12, 0, 0, 0);
  value.setDate(value.getDate() + days);
  return liLocalDateIso(value);
}

function liLoadWalkDate(){
  const today = liDateOffsetIso(0);
  const latest = liDateOffsetIso(14);
  try{
    const stored = sessionStorage.getItem(LI_WALK_DATE_SESSION_KEY);
    if(/^\d{4}-\d{2}-\d{2}$/.test(stored || '') && stored >= today && stored <= latest) return stored;
  }catch(error){}
  return today;
}

let liWalkDate = liLoadWalkDate();

// Read as the end of the headline: "...in Alta Pusteria tomorrow",
// "...on Saturday 25 Oct".
function liWalkDateLabel(){
  if(liWalkDate === liDateOffsetIso(0)) return tx('today');
  if(liWalkDate === liDateOffsetIso(1)) return tx('tomorrow');
  const value = new Date(`${liWalkDate}T12:00:00`);
  return tx('on {date}', { date:value.toLocaleDateString(undefined, { weekday:'long', month:'short', day:'numeric' }) });
}

function liStoredJson(storage, key){
  try { return JSON.parse(storage.getItem(key) || 'null'); } catch(error){ return null; }
}

function liValidLocationContext(value){
  if(!value || typeof value !== 'object') return null;
  if(value.kind === 'current' && Number.isFinite(value.lat) && Number.isFinite(value.lng)){
    return { kind:'current', lat:value.lat, lng:value.lng, radiusKm:LI_LOCATION_RADIUS_KM };
  }
  if(value.kind === 'town' && value.label && Number.isFinite(value.lat) && Number.isFinite(value.lng)){
    return {
      kind:'town', lat:value.lat, lng:value.lng, label:String(value.label),
      radiusKm:Number.isFinite(value.radiusKm) ? value.radiusKm : LI_TOWN_RADIUS_KM,
      country:String(value.country || 'all'), region:String(value.region || 'all'),
    };
  }
  // Framing a viewport is an explicit geographic act -- more explicit than
  // picking a valley from a list -- so it satisfies the rule above rather than
  // working around it. Bounds are plain numbers so the shape stays comparable
  // and serialisable; a LngLatBounds object would not survive storage.
  if(value.kind === 'map' && value.bounds
    && ['west','south','east','north'].every(edge => Number.isFinite(value.bounds[edge]))){
    return { kind:'map', bounds:{
      west:value.bounds.west, south:value.bounds.south,
      east:value.bounds.east, north:value.bounds.north,
    }, label:'Map area' };
  }
  if(value.kind === 'area' && value.label && (value.country || value.region || value.valley)){
    const region = String(value.region || 'all');
    const inferredCountry = liCountryForRegion(region);
    return {
      kind:'area',
      country:String(value.country || inferredCountry),
      region,
      valley:String(value.valley || 'all'),
      label:liDisplayLocationLabel(value.label),
    };
  }
  return null;
}

function liLoadLocationContext(){
  // A region deep link is already an explicit geographic choice. Keep its
  // scope broad because that is what the shared URL promises.
  if(LI_LINKED_REGION !== 'all'){
    return { ...liRegionContext(LI_LINKED_REGION), transient:true };
  }
  if(typeof sessionStorage !== 'undefined'){
    const current = liValidLocationContext(liStoredJson(sessionStorage, LI_LOCATION_SESSION_KEY));
    if(current) return current;
  }
  if(typeof localStorage !== 'undefined'){
    const area = liValidLocationContext(liStoredJson(localStorage, LI_AREA_STORAGE_KEY));
    if(area && area.kind !== 'map') return area;
    // An old v1 key left in localStorage is weeks stale: forget it.
    try{ localStorage.removeItem(LI_VISIT_AREA_KEY); }catch(error){}
  }
  // A choice made under v1 this visit is still a choice: carry it over.
  if(typeof sessionStorage !== 'undefined'){
    const area = liValidLocationContext(liStoredJson(sessionStorage, LI_VISIT_AREA_KEY));
    if(area && area.kind !== 'map'){ liRememberLocationContext(area); return area; }
  }
  return liDefaultLocationContext();
}

function liRememberLocationContext(context){
  try{
    if(typeof sessionStorage !== 'undefined') sessionStorage.removeItem(LI_LOCATION_SESSION_KEY);
    if(typeof sessionStorage !== 'undefined') sessionStorage.removeItem(LI_VISIT_AREA_KEY);
    // Near me is a choice too, and supersedes the area chosen before it, as
    // does a reset. A transient context (a ?region= link, "Show all", the
    // page's own pick) leaves the reader's choice for the next visit.
    if((!context || context.kind === 'current') && typeof localStorage !== 'undefined') localStorage.removeItem(LI_AREA_STORAGE_KEY);
    if(context && context.kind === 'current' && typeof sessionStorage !== 'undefined'){
      sessionStorage.setItem(LI_LOCATION_SESSION_KEY, JSON.stringify(context));
    } else if(context && (context.kind === 'area' || context.kind === 'town') && !context.transient && !liIsAllTrailsContext(context) && typeof localStorage !== 'undefined'){
      localStorage.setItem(LI_AREA_STORAGE_KEY, JSON.stringify(context));
    }
  }catch(error){ /* Storage can be unavailable in private browsing. */ }
}

function liClearLocationConditions(){
  liLocationForecastKey = '';
  if(window.DoloPawsHomeConditions && typeof window.DoloPawsHomeConditions.reset === 'function'){
    window.DoloPawsHomeConditions.reset();
  }
  const today = document.getElementById('liToday');
  if(today) today.hidden = true;
}

function liApplyLocationGeography(){
  if(!liLocationContext) return;
  // The map supersedes any typed area: panning to another valley and pressing
  // "Search this area" should show what is there, not the intersection with an
  // area chosen earlier, which is usually empty. Clearing these is what makes
  // the downstream region and valley filters no-ops.
  if(liLocationContext.kind === 'map'){
    activeCountry = 'all';
    activeRegion = 'all';
    activeValley = 'all';
    return;
  }
  if(liLocationContext.kind === 'area'){
    activeRegion = liLocationContext.region || 'all';
    activeCountry = liLocationContext.country || liCountryForRegion(activeRegion);
    activeValley = liLocationContext.valley || 'all';
  } else {
    activeCountry = 'all';
    activeRegion = 'all';
    activeValley = 'all';
    liPendingLocationCenter = [liLocationContext.lng, liLocationContext.lat];
  }
}

function liDistanceKm(originLat, originLng, targetLat, targetLng){
  const toRadians = degrees => degrees * Math.PI / 180;
  const dLat = toRadians(targetLat - originLat);
  const dLng = toRadians(targetLng - originLng);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(originLat)) * Math.cos(toRadians(targetLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function filterTrailsForLocationContext(list){
  if(!liLocationContext) return [];
  if(liLocationContext.kind === 'current' || liLocationContext.kind === 'town'){
    return list.filter(trail => {
      const point = liTrailLngLat(trail);
      return point && liDistanceKm(liLocationContext.lat, liLocationContext.lng, point[1], point[0]) <= liLocationContext.radiusKm;
    });
  }
  if(liLocationContext.kind === 'map') return liTrailsInBounds(liLocationContext.bounds, list);
  if(liLocationContext.kind === 'area'){
    return list.filter(trail =>
      (!liLocationContext.country || liLocationContext.country === 'all'
        || liCountryForRegion(trail.region) === liLocationContext.country)
      &&
      (!liLocationContext.region || liLocationContext.region === 'all' || trail.region === liLocationContext.region)
      && (!liLocationContext.valley || liLocationContext.valley === 'all' || trail.valley === liLocationContext.valley));
  }
  // Allows isolated controller tests to opt into a synthetic catalogue
  // context without weakening any context created by the product UI.
  return list;
}

function liLocationForecastCenter(){
  if(!liLocationContext || typeof trails === 'undefined') return null;
  // Never send the owner's device coordinates to the forecast provider. The
  // centre of the ORMA trails already matched locally is accurate enough for
  // an area forecast and preserves the in-session location promise.
  const scoped = filterTrailsForLocationContext(trails).filter(trail => Number.isFinite(trail.lat) && Number.isFinite(trail.lng));
  if(!scoped.length) return null;
  const total = scoped.reduce((sum, trail) => ({ lat:sum.lat + trail.lat, lng:sum.lng + trail.lng }), { lat:0, lng:0 });
  return [total.lat / scoped.length, total.lng / scoped.length];
}

function liEnsureLocationConditions(){
  const conditions = window.DoloPawsHomeConditions;
  const center = liLocationForecastCenter();
  if(!conditions || typeof conditions.load !== 'function' || !center) return;
  const key = `${center[0].toFixed(4)}|${center[1].toFixed(4)}|${liWalkDate}`;
  if(key === liLocationForecastKey) return;
  liLocationForecastKey = key;
  conditions.load(center[0], center[1], { date:liWalkDate }).then(ok => {
    if(!ok && key === liLocationForecastKey) liLocationForecastKey = '';
  });
}

/**
 * What the map is currently showing, as the catalogue's own areas, the
 * best-represented first. "Map area" is true but says nothing; the valley
 * whose trails fill the view is the answer to "where am I looking?", and it
 * is also the list of places worth offering under "Change". Both read from
 * here, so the heading and the picker cannot disagree about what is in view.
 */
// True while the map view is what the list is filtered to. The view's own box
// does the filtering, in filterTrailsForLocationContext; this is what stops
// the map re-framing to the list it just produced, and what makes the view
// count as one of the active filters.
/**
 * Where the map is, as scale and centre. Two moveends with the same signature
 * are the same view: the box around it changed, the map did not.
 */
function liMapViewSignature(map){
  if(!map || typeof map.getCenter !== 'function') return '';
  const centre = map.getCenter();
  return `${map.getZoom().toFixed(3)}|${centre.lng.toFixed(5)},${centre.lat.toFixed(5)}`;
}

/**
 * Whether a settled map movement is the reader's, and so means "look here
 * instead". Two kinds are not, and both used to throw the reader's chosen area
 * away without being asked:
 *
 *  - our own reframing after a render, which is why the deadline exists rather
 *    than a one-shot flag: an eased fitBounds can settle in more than one
 *    moveend, and the second arrived looking exactly like a pan;
 *  - a resize -- switching to the map pane, rotating the phone, expanding the
 *    map -- which ends in a moveend nobody asked for. It changes the box
 *    without moving the map, so an unchanged signature is the test for one.
 *    The gesture's own event is not: the zoom buttons move the map without
 *    carrying one.
 */
function liMapMoveIsReaders(signature, lastSignature, now, framingUntil){
  const at = Number.isFinite(now) ? now : Date.now();
  const until = Number.isFinite(framingUntil) ? framingUntil : liMapAutoFramingUntil;
  if(at < until) return false;
  return !!signature && signature !== lastSignature;
}

function liViewIsTheFilter(){
  return !!(liLocationContext && liLocationContext.kind === 'map');
}

function liTrailIsInBounds(trail, box){
  const point = liTrailLngLat(trail);
  return !!(point && box && point[0] >= box.west && point[0] <= box.east
    && point[1] >= box.south && point[1] <= box.north);
}

// The list defaults to the catalogue, but callers pass their own: a scored
// list holds copies of the trails, so matching them by identity finds nothing.
function liTrailsInBounds(box, list){
  if(!box) return [];
  const source = list || (typeof trails === 'undefined' ? [] : trails);
  return source.filter(trail => liTrailIsInBounds(trail, box));
}

function liAreasInView(limit){
  if(!liLocationContext || liLocationContext.kind !== 'map') return [];
  const counts = new Map();
  liTrailsInBounds(liLocationContext.bounds).forEach(trail => {
    if(!trail.region || !trail.valley) return;
    const key = `${trail.region}::${trail.valley}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  if(!counts.size) return [];
  liEnsureAreaChoices();
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => liAreaChoices.find(choice =>
      choice.kind === 'area' && `${choice.region}::${choice.valley}` === key))
    .filter(Boolean)
    .slice(0, limit || 4);
}

/**
 * The one place that holds every trail the map is showing, for the heading.
 * The busiest valley in view is the right first suggestion under "Change",
 * but not a name for the view: zoomed out over the Alps it read "in Alta
 * Pusteria" above a list of 468 trails from Savoy to Friuli. So a valley
 * names the view only when every trail in it is that valley's, a region when
 * they are all that region's, and anything wider is just the map view.
 */
function liPlaceInView(){
  if(!liLocationContext || liLocationContext.kind !== 'map') return null;
  const inView = liTrailsInBounds(liLocationContext.bounds).filter(trail => trail.region);
  if(!inView.length) return null;
  const regions = new Set(inView.map(trail => trail.region));
  if(regions.size !== 1) return null;
  const region = inView[0].region;
  const valleys = new Set(inView.map(trail => trail.valley || ''));
  if(valleys.size === 1 && inView[0].valley){
    const area = liAreasInView(1)[0];
    if(area) return area;
  }
  return LI_REGION_LABELS[region] ? { label:LI_REGION_LABELS[region] } : null;
}

function liLocationContextLabel(){
  if(!liLocationContext) return '';
  if(liLocationContext.kind === 'current') return tx('Your location · within {km} km', { km:liLocationContext.radiusKm });
  if(liLocationContext.kind === 'town') return tx('{place} · within {km} km', { place:liLocationContext.label, km:liLocationContext.radiusKm });
  if(liLocationContext.kind === 'map'){
    const place = liPlaceInView();
    return place ? tx('{place} · on the map', { place:liShownPlaceLabel(place.label) }) : tx('The map view');
  }
  return liShownPlaceLabel(liLocationContext.label);
}

function liRecommendationLocationPhrase(){
  if(!liLocationContext || liIsAllTrailsContext(liLocationContext)) return '';
  if(liLocationContext.kind === 'current') return tx('near you');
  if(liLocationContext.kind === 'town') return tx('near {place}', { place:liLocationContext.label });
  if(liLocationContext.kind === 'map'){
    const place = liPlaceInView();
    return place ? liInPlacePhrase(place.label) : tx('in the map view');
  }
  return liInPlacePhrase(liLocationContext.label);
}

// "in the Dolomites", not "in The Dolomites". Italian names plural mountain
// ranges with an article ("nelle Dolomiti", "nelle Alpi francesi") but not
// countries, regions or valleys ("in Italia", "in Alta Pusteria").
function liInPlacePhrase(label){
  const shown = liShownPlaceLabel(label).replace(/^The /, 'the ');
  const i18n = typeof window !== 'undefined' && window.DoloPawsI18n;
  if(i18n && i18n.lang === 'it' && /^(Dolomiti|Alpi|Prealpi)\b/.test(shown)) return `nelle ${shown}`;
  return tx('in {place}', { place:shown });
}

/**
 * The town list, fetched once and only when the destination picker is
 * actually shown. It is 19 KB of data that most visits never need: someone
 * with a saved area or "Use my location" never opens this.
 */
async function liLoadTowns(){
  if(liTowns) return liTowns;
  try{
    const response = await fetch('data/towns.json', { cache:'force-cache' });
    if(!response.ok) throw new Error(String(response.status));
    const payload = await response.json();
    liTowns = Array.isArray(payload && payload.towns) ? payload.towns : [];
  }catch(error){
    // Country, region and valley still work. A missing town list narrows the
    // search, it does not break it.
    liTowns = [];
  }
  return liTowns;
}

/** Add the towns to the suggestions once they arrive. */
async function liAddTownChoices(){
  const towns = await liLoadTowns();
  if(!towns.length) return;
  const searchList = document.getElementById('liAreaSuggestions');
  const seen = new Set(liAreaChoices.map(choice => choice.label.toLowerCase()));
  const added = [];
  towns.forEach(town => {
    // Either half of "Klausen - Chiusa" should find it, and so should the
    // whole. Each spelling is its own suggestion pointing at one place.
    (Array.isArray(town.names) && town.names.length ? town.names : [town.name]).forEach(name => {
      const key = String(name).toLowerCase();
      if(!name || seen.has(key)) return;
      seen.add(key);
      added.push({
        kind:'town', label:String(name), lat:town.lat, lng:town.lng,
        radiusKm:LI_TOWN_RADIUS_KM, country:town.country, region:town.region,
        type:town.place === 'city' ? 'City' : 'Town',
      });
    });
  });
  if(!added.length) return;
  liAreaChoices = [...liAreaChoices, ...added].sort((a, b) => a.label.localeCompare(b.label));
  // The towns usually land after the first keystrokes; a suggestion list
  // already open is repainted so the town appears without another key.
  const search = document.getElementById('liSearch');
  const suggestions = document.getElementById('liSearchSuggest');
  if(search && suggestions && !suggestions.hidden && search.value.trim()){
    renderLiSearchSuggestions(typeof currentProfileForAdjust !== 'undefined' ? currentProfileForAdjust : null);
  }
  if(searchList){
    added.forEach(choice => {
      const option = document.createElement('option');
      option.value = choice.label;
      option.label = tx('{type} · within {km} km', { type:liPlaceTypeLabel(choice.type), km:choice.radiusKm });
      searchList.appendChild(option);
    });
  }
}

// The places the search bar can take you: every country, region and valley
// with a walk in it, plus the towns once they arrive. Built on first use of
// the search, so a visit that never types a place never pays for it.
let liAreaChoicesReady = false;
function liEnsureAreaChoices(){
  if(liAreaChoicesReady || typeof trails === 'undefined') return;
  const configs = liRegionConfigs();
  const valleys = new Map();
  trails.forEach(trail => {
    if(!trail.region || !trail.valley) return;
    const key = `${trail.region}::${trail.valley}`;
    if(!valleys.has(key)) valleys.set(key, {
      kind:'area',
      country:liCountryForRegion(trail.region),
      region:trail.region,
      valley:trail.valley,
      label:liDisplayLocationLabel(trail.valley),
      type:'Valley',
    });
  });
  const countries = new Map();
  Object.entries(configs).forEach(([region, config]) => {
    if(!config || !config.countryCode) return;
    countries.set(config.countryCode, { kind:'area', country:config.countryCode, region:'all', valley:'all', label:config.country, type:'Country' });
  });
  const regions = Object.entries(configs).map(([region, config]) => ({
    kind:'area', country:config.countryCode, region, valley:'all', label:config.label, type:'Region'
  }));
  liAreaChoices = [...countries.values(), ...regions, ...valleys.values()]
    .sort((a, b) => a.label.localeCompare(b.label));
  liAreaChoicesReady = true;
  liAddTownChoices();
}

function liPlaceChoiceDetail(choice){
  if(choice.kind === 'town') return tx('{type} · within {km} km', { type:liPlaceTypeLabel(choice.type), km:choice.radiusKm });
  const configs = liRegionConfigs();
  const region = choice.region !== 'all' && configs[choice.region] ? configs[choice.region].label : null;
  return region && choice.type === 'Valley' ? `${liPlaceTypeLabel(choice.type)} · ${liShownPlaceLabel(region)}` : liPlaceTypeLabel(choice.type);
}

function liPlaceChoicesFor(query){
  const needle = String(query || '').trim().toLowerCase();
  if(!needle) return [];
  return liAreaChoices
    .filter(choice => choice.label.toLowerCase().includes(needle))
    .sort((a, b) => {
      const aStarts = a.label.toLowerCase().startsWith(needle) ? 0 : 1;
      const bStarts = b.label.toLowerCase().startsWith(needle) ? 0 : 1;
      return aStarts - bStarts || a.label.localeCompare(b.label);
    })
    .slice(0, 4);
}

function liSyncWalkDateInputs(){
  const min = liDateOffsetIso(0);
  const max = liDateOffsetIso(14);
  ['liWalkDate','liRecommendationDate'].forEach(id => {
    const input = document.getElementById(id);
    if(!input) return;
    input.min = min;
    input.max = max;
    input.value = liWalkDate;
  });
}

function liSetWalkDate(value){
  const min = liDateOffsetIso(0);
  const max = liDateOffsetIso(14);
  liWalkDate = /^\d{4}-\d{2}-\d{2}$/.test(value || '') && value >= min && value <= max ? value : min;
  try{ sessionStorage.setItem(LI_WALK_DATE_SESSION_KEY, liWalkDate); }catch(error){}
  liLocationForecastKey = '';
  liClearLocationConditions();
  liSyncWalkDateInputs();
  renderReturningHomepage(currentProfileForAdjust);
}

// Changing where you look is the search bar: a town, a valley or a region
// typed there becomes the context. "Change" just takes you to it.
function liFocusSearchForPlace(){
  const search = document.getElementById('liSearch');
  if(!search) return;
  liCloseMenus();
  search.focus();
  search.select();
  // Rendered here rather than left to the focus handler: "Change" must open
  // with its offer already on screen, and a field that was focused already
  // fires nothing.
  renderLiSearchSuggestions(currentProfileForAdjust);
  if(typeof search.scrollIntoView === 'function') search.scrollIntoView({ block:'nearest' });
}

// Location is asked in place, never by a gate and never on page load. A
// permission already granted is used quietly; one not yet decided is offered
// with a button that asks only when tapped; one refused gets an explanation
// and the search bar. The list is always there underneath.
const LI_LOCATION_NUDGE_DISMISSED_KEY = 'orma-home-location-nudge-dismissed-v1';
let liLocationPermission = 'unknown';   // unknown | prompt | granted | denied | error | unavailable
let liLocationRequestPending = false;
// Set when the reader's position has no ORMA walk within reach: the page
// stays on the Dolomites and says so, with how far the nearest walk is.
let liOutOfRange = null;
const LI_LOCATION_ASKED_KEY = 'orma-location-asked-v1';
let liLocationAsked = false;   // also kept here, for browsers that block storage
const LI_OUT_OF_RANGE_DISMISSED_KEY = 'orma-out-of-range-dismissed-v1';

// Dismissing it is an answer, not a mood: someone who closed this does not
// want to be asked again next time they open ORMA. localStorage rather than
// sessionStorage, so "no" survives the tab closing. Explore > Near me clears
// it, which is the way back for anyone who changes their mind.
function liLocationNudgeDismissed(){
  try{ return localStorage.getItem(LI_LOCATION_NUDGE_DISMISSED_KEY) === '1'; }catch(error){ return false; }
}

function liDismissLocationNudge(){
  if(liOutOfRange){
    // Closing "ORMA isn't in your area yet" is for this visit only; the
    // offer to turn on location is a separate, longer-lived choice.
    try{ sessionStorage.setItem(LI_OUT_OF_RANGE_DISMISSED_KEY, '1'); }catch(error){}
  } else {
    try{ localStorage.setItem(LI_LOCATION_NUDGE_DISMISSED_KEY, '1'); }catch(error){}
  }
  liRenderLocationNudge();
}

function liOutOfRangeDismissed(){
  try{ return sessionStorage.getItem(LI_OUT_OF_RANGE_DISMISSED_KEY) === '1'; }catch(error){ return false; }
}

// The nearest ORMA walk to a position, in whole km, or null with no catalogue.
function liNearestTrailKm(lat, lng){
  let best = Infinity;
  liCatalogueTrails().forEach(trail => {
    const point = liTrailLngLat(trail);
    if(!point) return;
    const km = liDistanceKm(lat, lng, point[1], point[0]);
    if(km < best) best = km;
  });
  return Number.isFinite(best) ? Math.round(best) : null;
}

// Anything ORMA has within reach of a position. The page only moves itself
// to "near you" when there is something there; a reader at home far from
// any trail stays on every trail rather than opening on an empty list.
function liAnyTrailNear(lat, lng, radiusKm){
  return liCatalogueTrails().some(trail => {
    const point = liTrailLngLat(trail);
    return point && liDistanceKm(lat, lng, point[1], point[0]) <= radiusKm;
  });
}

// `auto` is the page acting by itself (a permission already granted, or the
// one ask on a first visit), not the reader pressing Near me. Either way a
// position with nothing close keeps the Dolomites and says so.
function liRequestCurrentLocation(options){
  const auto = !!(options && options.auto);
  if(typeof navigator === 'undefined' || !navigator.geolocation){
    liLocationPermission = 'unavailable';
    liRenderLocationNudge();
    return;
  }
  if(liLocationRequestPending) return;
  liLocationRequestPending = true;
  liRenderLocationNudge();
  navigator.geolocation.getCurrentPosition(position => {
    liLocationRequestPending = false;
    liLocationPermission = 'granted';
    const lat = Number(position.coords.latitude);
    const lng = Number(position.coords.longitude);
    if(!liAnyTrailNear(lat, lng, LI_LOCATION_RADIUS_KM)){
      // Nothing within reach: show the Dolomites and say why, rather than an
      // empty "near you" list. Jumping to whichever region had the nearest
      // trail opened the page somewhere nobody chose.
      liOutOfRange = { nearestKm:liNearestTrailKm(lat, lng) };
      if(!auto && liLocationContext && liLocationContext.kind === 'current') liSetLocationContext(liDefaultLocationContext());
      liRenderLocationNudge();
      return;
    }
    liOutOfRange = null;
    liSetLocationContext({ kind:'current', lat, lng, radiusKm:LI_LOCATION_RADIUS_KM });
  }, error => {
    liLocationRequestPending = false;
    liLocationPermission = error && error.code === 1 ? 'denied' : 'error';
    liRenderLocationNudge();
  }, { enableHighAccuracy:false, timeout:10000, maximumAge:300000 });
}

// Reads the permission state without asking for anything. Only a permission
// the owner already granted is acted on, and only when nothing else was
// chosen: a saved town or valley is a decision, and a position is not.
function liLocationAskedThisVisit(){
  if(liLocationAsked) return true;
  try{ return sessionStorage.getItem(LI_LOCATION_ASKED_KEY) === '1'; }catch(error){ return false; }
}

async function liProbeLocationPermission(){
  if(typeof navigator === 'undefined' || !navigator.geolocation){
    liLocationPermission = 'unavailable';
    liRenderLocationNudge();
    return;
  }
  let state = 'prompt';
  try{
    if(navigator.permissions && typeof navigator.permissions.query === 'function'){
      const result = await navigator.permissions.query({ name:'geolocation' });
      state = result.state || 'prompt';
      if(typeof result.addEventListener === 'function'){
        result.addEventListener('change', () => {
          liLocationPermission = result.state || 'prompt';
          liRenderLocationNudge();
        });
      }
    }
  }catch(error){ state = 'prompt'; }
  liLocationPermission = state;
  const chosenNothing = !!(liLocationContext && liLocationContext.auto);
  if(state === 'granted' && chosenNothing) liRequestCurrentLocation({ auto:true });
  else if(state === 'prompt' && chosenNothing && !liLocationAskedThisVisit()){
    // The homepage follows where the reader is, so a first visit with no
    // place chosen asks once. Saying no leaves the Dolomites and the band.
    liLocationAsked = true;
    try{ sessionStorage.setItem(LI_LOCATION_ASKED_KEY, '1'); }catch(error){}
    liRequestCurrentLocation({ auto:true });
  }
  else liRenderLocationNudge();
}

function liRenderLocationNudge(){
  const nudge = document.getElementById('liLocationNudge');
  if(!nudge) return;
  const title = document.getElementById('liLocationNudgeTitle');
  const detail = document.getElementById('liLocationNudgeDetail');
  const button = document.getElementById('liLocationNudgeBtn');
  const located = !!liLocationContext && liLocationContext.kind === 'current';
  // Picking a town or valley clears liOutOfRange (liSetLocationContext), so
  // the caveat shows only until the reader has chosen somewhere.
  const outOfRange = !!liOutOfRange && !located && !liOutOfRangeDismissed();
  const show = outOfRange || (!located && !liLocationNudgeDismissed() && liLocationPermission !== 'granted');
  nudge.hidden = !show;
  if(!show) return;
  const nearest = liOutOfRange && Number.isFinite(liOutOfRange.nearestKm) ? liOutOfRange.nearestKm : null;
  const copy = outOfRange
    ? { title:tx('ORMA isn’t in your area yet'),
        detail:nearest !== null
          ? tx('The nearest ORMA walk is {km} km away. We cover the Dolomites and parts of the Alps, so here are the Dolomites. Search a town or valley to look elsewhere.', { km:nearest.toLocaleString() })
          : tx('We cover the Dolomites and parts of the Alps, so here are the Dolomites. Search a town or valley to look elsewhere.'),
        button:null }
    : liLocationRequestPending
    ? { title:tx('Finding you…'), detail:tx('Your position stays in this browser session and is not added to your profile.'), button:tx('Finding you…'), disabled:true }
    : liLocationPermission === 'denied'
      ? { title:tx('Location is off for ORMA in this browser'), detail:tx('Turn it on in your browser’s site settings, or search for a town or valley.'), button:null }
      : liLocationPermission === 'unavailable'
        ? { title:tx('Location is not available in this browser'), detail:tx('Search for a town or valley to look somewhere specific.'), button:null }
        : liLocationPermission === 'error'
          ? { title:tx('We could not find your location'), detail:tx('Try again, or search for a town or valley.'), button:tx('Try again') }
          : { title:tx('See trails near you'), detail:tx('Your position stays in this browser session and is not added to your profile.'), button:tx('Turn on location') };
  if(title) title.textContent = copy.title;
  if(detail) detail.textContent = copy.detail;
  if(button){
    button.hidden = !copy.button;
    button.disabled = !!copy.disabled;
    if(copy.button) button.textContent = copy.button;
  }
  nudge.dataset.state = outOfRange ? 'out-of-range' : liLocationRequestPending ? 'pending' : liLocationPermission;
}

// The dog menu lists the last trails opened as a shortlist, never as a history.
function liRecentTrails(){
  try{
    const list = JSON.parse(localStorage.getItem(LI_RECENT_TRAILS_KEY) || '[]');
    return Array.isArray(list) ? list.filter(item => item && item.id && item.name).slice(0, 5) : [];
  }catch(error){ return []; }
}

function liRenderRecentTrails(){
  const host = document.getElementById('liRecentList');
  if(!host) return;
  host.replaceChildren();
  const recent = liRecentTrails();
  if(!recent.length){
    const note = document.createElement('span');
    note.className = 'li-menu-note';
    note.textContent = tx('Trails you open will appear here.');
    host.append(note);
    return;
  }
  // One row per trail: a small photo, then the name on one line with the
  // area under it. Name and area used to sit side by side, each wrapping in
  // its own narrow column.
  const catalogue = typeof trails !== 'undefined' && Array.isArray(trails) ? trails : [];
  recent.forEach(item => {
    const link = document.createElement('a');
    link.className = 'li-menu-item li-recent-item';
    link.href = liTrailHref(item.id);
    const thumb = document.createElement('span');
    thumb.className = 'li-recent-thumb';
    thumb.setAttribute('aria-hidden', 'true');
    const trail = catalogue.find(entry => entry && entry.id === item.id);
    if(trail && trail.imageIcon){
      const img = document.createElement('img');
      img.src = trail.imageIcon;
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      thumb.append(img);
    }
    const copy = document.createElement('span');
    copy.className = 'li-recent-copy';
    const name = document.createElement('span');
    name.className = 'li-recent-name';
    name.textContent = trailDisplayName(item);
    copy.append(name);
    if(item.area){
      const where = document.createElement('small');
      where.className = 'li-recent-area';
      where.textContent = item.area;
      copy.append(where);
    }
    link.title = item.area ? `${trailDisplayName(item)}, ${item.area}` : trailDisplayName(item);
    link.append(thumb, copy);
    host.append(link);
  });
}

// The two regions in the place menu, each with its trail count, the one in
// use marked. "Near you" sits inside a region, so neither is marked then.
function liRenderRegionChoices(){
  const list = liCatalogueTrails();
  document.querySelectorAll('[data-li-region]').forEach(button => {
    const region = button.dataset.liRegion;
    const count = button.querySelector('[data-li-region-count]');
    if(count){
      const n = list.filter(trail => trail.region === region).length;
      const config = liRegionConfigs()[region];
      count.textContent = `${config ? config.country : 'Italy'} · ${n} ${n === 1 ? 'trail' : 'trails'}`;
      // A region opens before its first walk is published; don't offer it
      // empty. Ask the manifest, not the list: a page opened on one region
      // has only that region loaded, and every other one would count 0.
      const published = window.DoloPawsRegionManifest && window.DoloPawsRegionManifest.regions
        && window.DoloPawsRegionManifest.regions[region];
      button.hidden = !!published && !published.trailCount;
    }
    const on = !!liLocationContext && liLocationContext.kind === 'area'
      && liLocationContext.region === region && (liLocationContext.valley || 'all') === 'all';
    button.setAttribute('aria-pressed', String(on));
  });
}

// Country, Region and Valley beside the search, as on Trails and Collections.
// They show the area in use and choosing one sets it. Near you, a town or the
// map view are not one of these areas, so the pickers then read "All".
const LI_PICKER_COUNTRIES = Object.freeze([
  { code:'IT', label:'Italy' }, { code:'FR', label:'France' },
  { code:'AT', label:'Austria' }, { code:'CH', label:'Switzerland' },
]);
let liAreaDropdowns = null;

function liAreaPickerSelects(){
  const ids = ['liCountrySelect', 'liRegionSelect', 'liValleySelect'];
  const selects = ids.map(id => document.getElementById(id));
  return selects.every(Boolean) ? selects : null;
}

// The region's name as Trails and Collections write it ("Dolomites").
function liPickerRegionLabel(id){
  const i18n = window.DoloPawsI18n;
  const key = 'browse.geo.' + (id === 'switzerland' ? 'swissRegion' : id);
  const named = i18n && typeof i18n.t === 'function' ? i18n.t(key) : key;
  if(named && named !== key) return named;
  const configs = liRegionConfigs();
  return liShownPlaceLabel(LI_REGION_LABELS[id] || (configs[id] && configs[id].label) || id);
}

function liPickerOption(value, label, count){
  const option = document.createElement('option');
  option.value = value;
  option.textContent = count == null ? label : `${label} (${count})`;
  return option;
}

function liRenderAreaPickers(){
  const selects = liAreaPickerSelects();
  if(!selects) return;
  const [countrySelect, regionSelect, valleySelect] = selects;
  const list = liCatalogueTrails();
  const configs = liRegionConfigs();
  let context = liLocationContext && liLocationContext.kind === 'area' ? liLocationContext : null;
  // The map view is named by the place that holds it (the headline does the
  // same), so the pickers say that place too.
  if(liLocationContext && liLocationContext.kind === 'map'){
    const inView = liTrailsInBounds(liLocationContext.bounds).filter(trail => trail.region);
    const regions = new Set(inView.map(trail => trail.region));
    if(regions.size === 1){
      const valleys = new Set(inView.map(trail => trail.valley || ''));
      const only = inView[0];
      context = { region:only.region, valley:valleys.size === 1 && only.valley ? only.valley : 'all' };
    }
  }
  const region = context ? (context.region || 'all') : 'all';
  const country = context ? (context.country && context.country !== 'all' ? context.country : liCountryForRegion(region)) : 'all';
  const valley = context ? (context.valley || 'all') : 'all';
  const published = id => {
    const regions = window.DoloPawsRegionManifest && window.DoloPawsRegionManifest.regions;
    return !regions || !regions[id] || regions[id].trailCount > 0 || id === region;
  };
  const inCountry = code => trail => code === 'all' || liCountryForRegion(trail.region) === code;

  countrySelect.replaceChildren(
    liPickerOption('all', tx('All countries'), list.length),
    ...LI_PICKER_COUNTRIES
      .filter(item => list.some(inCountry(item.code)) || item.code === country)
      .map(item => liPickerOption(item.code, liShownPlaceLabel(item.label), list.filter(inCountry(item.code)).length)),
  );
  countrySelect.value = country;

  const regionIds = Object.keys(configs).filter(id => (country === 'all' || configs[id].countryCode === country) && published(id));
  regionSelect.replaceChildren(
    liPickerOption('all', tx('All regions'), list.filter(inCountry(country)).length),
    ...regionIds.map(id => liPickerOption(id, liPickerRegionLabel(id), list.filter(trail => trail.region === id).length)),
  );
  regionSelect.value = region;

  const scoped = list.filter(trail => region !== 'all' ? trail.region === region : inCountry(country)(trail));
  const counts = new Map();
  scoped.forEach(trail => { if(trail.valley) counts.set(trail.valley, (counts.get(trail.valley) || 0) + 1); });
  const valleys = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  valleySelect.replaceChildren(
    liPickerOption('all', tx('All valleys'), scoped.length),
    ...valleys.map(([name, count]) => liPickerOption(name, liShownPlaceLabel(name), count)),
  );
  valleySelect.value = valleys.some(([name]) => name === valley) ? valley : 'all';

  if(!liAreaDropdowns && window.OrmaAreaDropdown){
    liAreaDropdowns = selects.map(select => window.OrmaAreaDropdown.enhance(select));
  }
  if(liAreaDropdowns) liAreaDropdowns.forEach(dropdown => dropdown && dropdown.refresh());
  // The trigger names the choice without its count.
  selects.forEach(select => {
    const label = select.closest('.area-select-shell')?.querySelector('.area-select-trigger__label');
    const chosen = select.options[select.selectedIndex];
    if(label && chosen) label.textContent = chosen.textContent.replace(/\s+\(\d+\)$/, '');
  });
}

// What the pickers say, as a location context: the narrowest choice names it.
function liAreaContextFromPickers(changed){
  const selects = liAreaPickerSelects();
  if(!selects) return null;
  let [country, region, valley] = selects.map(select => select.value || 'all');
  if(changed === 'country'){ region = 'all'; valley = 'all'; }
  if(changed === 'region'){
    valley = 'all';
    if(region !== 'all') country = liCountryForRegion(region);
  }
  if(changed === 'valley' && valley !== 'all'){
    const trail = liCatalogueTrails().find(item => item.valley === valley
      && (region === 'all' || item.region === region));
    if(trail){ region = trail.region; country = liCountryForRegion(region); }
  }
  const configs = liRegionConfigs();
  const countryLabel = (LI_PICKER_COUNTRIES.find(item => item.code === country) || {}).label;
  const label = valley !== 'all' ? valley
    : region !== 'all' ? (LI_REGION_LABELS[region] || (configs[region] && configs[region].label) || region)
    : country !== 'all' ? countryLabel || country
    : LI_ALL_TRAILS_CONTEXT.label;
  const context = { kind:'area', country, region, valley, label };
  // The whole catalogue is not kept as the area to reopen on.
  if(country === 'all') context.transient = true;
  return context;
}

function liWireAreaPickers(){
  const selects = liAreaPickerSelects();
  if(!selects) return;
  ['country', 'region', 'valley'].forEach((kind, index) => {
    selects[index].addEventListener('change', () => {
      const context = liAreaContextFromPickers(kind);
      if(context) liSetLocationContext(context);
    });
  });
}

function liRenderLocationContext(profile){
  const toolbar = document.getElementById('liToolbar');
  const workspace = document.querySelector('#returningCustomerHomepage .li-body');
  const summary = document.getElementById('liLocationSummary');
  const summaryLabel = document.getElementById('liLocationSummaryLabel');
  const summaryKick = document.getElementById('liLocationSummaryKick');
  // The list and the map are always there: a place narrows them, it does not
  // unlock them.
  if(toolbar) toolbar.hidden = false;
  if(workspace) workspace.hidden = false;
  if(document.body){
    document.body.classList.remove('li-location-needed');
    document.body.classList.add('li-location-ready');
  }
  if(summary){
    // A whole region is already ticked in the list below, so the line naming
    // it would say the same thing twice; a valley, town or "near you" keeps it.
    const wholeRegion = !!liLocationContext && liLocationContext.kind === 'area'
      && !!LI_REGION_LABELS[liLocationContext.region] && (liLocationContext.valley || 'all') === 'all';
    summary.hidden = !liLocationContext || wholeRegion;
    if(summaryLabel) summaryLabel.textContent = liLocationContextLabel();
    if(summaryKick){
      summaryKick.textContent = !liLocationContext ? '' : liIsAllTrailsContext(liLocationContext)
        ? tx('Showing')
        : (liLocationContext.kind === 'current' || liLocationContext.kind === 'town') ? tx('Looking near') : tx('Looking in');
    }
  }
  liRenderRegionChoices();
  liRenderAreaPickers();
  liSyncWalkDateInputs();
  liRenderLocationNudge();
}


/**
 * Where you are looking, changed by looking. Deliberately does less than
 * liSetLocationContext: moving the map is not a new search, so the text in
 * the search box, the selected trail and the remembered area all survive it,
 * and the area is not written to storage -- a viewport is not somewhere you
 * walk, and greeting someone next visit with one would erase the area it
 * stood in front of.
 */
function liApplyMapViewport(view){
  if(!view || typeof view.getWest !== 'function') return;
  // The first move away from a chosen area is what "Back to Val Gardena"
  // returns to; the ones after it must not overwrite that with a viewport.
  if(!liLocationContext || liLocationContext.kind !== 'map') liContextBeforeMapArea = liLocationContext;
  liLocationContext = { kind:'map', bounds:{
    west:view.getWest(), south:view.getSouth(),
    east:view.getEast(), north:view.getNorth(),
  }};
  // Clears the region and valley filters, so panning to another valley shows
  // what is there rather than its empty intersection with the area you left.
  liApplyLocationGeography();
  selectedTrailId = null;
  liEnsureLocationConditions();
  renderReturningHomepage(currentProfileForAdjust);
}

function liSetLocationContext(context){
  const next = liValidLocationContext(context);
  if(!next) return;
  // Choosing any real place by another door makes the way back stale.
  if(!liIsAllTrailsContext(next)) liContextBeforeShowAll = null;
  // A place the reader picks answers "ORMA isn't in your area yet"; the
  // Dolomites the page falls back to does not.
  if(!(context && context.auto)) liOutOfRange = null;
  liLocationContext = next;
  // A new area supersedes the old map framing and selection; the filters and
  // the date are about the dog and the day, so they stay.
  // Typing a place, "Show all" and a restored area all arrive here, so the
  // button and the remembered context are unwound once, here, rather than at
  // each door out -- missing one is what leaves the button contradicting the
  // heading.
  if(next.kind !== 'map') liExitMapArea();
  selectedTrailId = null;
  liPendingLocationCenter = (liLocationContext.kind === 'current' || liLocationContext.kind === 'town')
    ? [liLocationContext.lng, liLocationContext.lat]
    : null;
  // A map area is where you are looking, not where you walk: remembering it
  // would greet you next visit with a viewport instead of your area, and would
  // erase the stored area it replaced.
  if(liLocationContext.kind !== 'map') liRememberLocationContext(liLocationContext);
  liApplyLocationGeography();
  liQuery = '';
  const search = document.getElementById('liSearch');
  if(search) search.value = '';
  liClearLocationConditions();
  renderReturningHomepage(currentProfileForAdjust);
  liEnsureLocationConditions();
  if(typeof window.CustomEvent === 'function'){
    window.dispatchEvent(new window.CustomEvent('dolopaws-home-location-context-changed', { detail:{ ready:true } }));
  }
  scheduleTrailMap();
  startMobileTrailMap();
  if(trailMapInstance) requestAnimationFrame(() => trailMapInstance.resize());
}

// Back to the whole catalogue, forgetting any remembered area.
function liResetLocationContext(){
  liLocationContext = liDefaultLocationContext();
  liRememberLocationContext(null);
  activeCountry = 'all';
  activeRegion = 'all';
  activeValley = 'all';
  liExitMapArea();
  selectedTrailId = null;
  liPendingLocationCenter = null;
  liClearLocationConditions();
  renderReturningHomepage(currentProfileForAdjust);
  if(typeof window.CustomEvent === 'function'){
    window.dispatchEvent(new window.CustomEvent('dolopaws-home-location-context-changed', { detail:{ ready:true } }));
  }
}

// The list header's "Show all trails": out of the area, the map area and the
// filters into the whole catalogue, still ranked for the dog. The area is
// not remembered (the all-trails context is transient), so a reload still
// opens on the reader's own area.
function liShowAllTrails(){
  const base = liLocationContext && liLocationContext.kind === 'map' ? liContextBeforeMapArea : liLocationContext;
  // Already on all trails with only a filter or a pan to clear: keep the
  // earlier way back rather than overwriting it with "all trails".
  if(base && !liIsAllTrailsContext(base)){
    liContextBeforeShowAll = { context:base, filters:{ ...liFilters }, savedOnly:showingSavedOnly };
  }
  liFilters = { dist: 'any', risk: 'any', terrain: 'any', shade: 'any', minMatch: 0, water: false, duration: 'day', lifts: '' };
  showingSavedOnly = false;
  liSetLocationContext({ ...LI_ALL_TRAILS_CONTEXT });
}

function liBackFromAllTrails(){
  const saved = liContextBeforeShowAll;
  if(!saved) return;
  liContextBeforeShowAll = null;
  liFilters = { ...saved.filters };
  showingSavedOnly = saved.savedOnly;
  liSetLocationContext(saved.context);
}

// One button, three states: narrowed -> "Show all trails"; on all trails
// with a place to return to -> "Back to <area>"; otherwise nothing to offer.
function liSyncShowAllButton(){
  const button = document.getElementById('liShowAllTrails');
  if(!button) return;
  const narrowed = !liIsAllTrailsContext(liLocationContext) || liActiveFilterCount() > 0 || !!liQuery.trim();
  const back = !narrowed && liContextBeforeShowAll;
  button.hidden = !narrowed && !back;
  button.dataset.mode = back ? 'back' : 'all';
  button.textContent = back
    ? tx('Back to {place}', { place:liShownPlaceLabel(back.context.label) || tx('your area') })
    : tx('Show all trails');
}

liApplyLocationGeography();
window.DoloPawsHomepageLocation = {
  hasContext:() => !!liLocationContext,
  filterTrails:filterTrailsForLocationContext,
  // The homepage's own "Near me" and "Show all" act through these, and so
  // does the ?near=1 / ?all=1 entry below.
  nearMe:() => {
    // The dismissal is kept in localStorage, so clearing it from sessionStorage
    // removed nothing and asking for Near me left the band dismissed.
    try{ localStorage.removeItem(LI_LOCATION_NUDGE_DISMISSED_KEY); }catch(error){}
    liRequestCurrentLocation();
  },
  showAll:() => liSetLocationContext({ ...LI_ALL_TRAILS_CONTEXT }),
};

// ?near=1 asks for the position, ?all=1 opens the whole catalogue. The Explore
// group that sent people here is gone -- both scope actions now sit on the
// homepage itself -- so nothing in the site produces these any more; they are
// kept for links and bookmarks already out there. Read once and removed from
// the address, so a reload does not ask again.
function liConsumeExploreIntent(){
  const location = window.location || {};
  const search = String(location.search || '');
  const has = name => new RegExp('(?:^\\?|&)' + name + '=1(?:&|$)').test(search);
  const intent = has('near') ? 'near' : has('all') ? 'all' : null;
  if(!intent) return null;
  const kept = search.replace(/^\?/, '').split('&')
    .filter(pair => pair && !/^(?:near|all)=1$/.test(pair));
  const next = (location.pathname || '/') + (kept.length ? `?${kept.join('&')}` : '') + String(location.hash || '');
  try{ window.history.replaceState(window.history.state, '', next); }catch(error){}
  return intent;
}

// Today, for this area, corrected for each trail's altitude. Undefined until a
// forecast arrives, which makes the engine report conditions as not included --
// the same answer the trail page gives for the same trail.
function liConditionsFor(trail){
  const shared = window.ORMAScoringConditions;
  return shared ? shared.forTrail(trail) : undefined;
}

// Map the refine bar's state onto the shared discovery-filter vocabulary and
// let DoloPawsDiscoveryFilters.matches be the single source of truth for the
// decision filters. Water stays a separate looser toggle and match% is scored,
// so both are handled by the caller; geography/search/map are handled there too.
// The chairlift question, answered the way the engine answers it. The shared
// adapter knows the weight bands; without it, only an explicit weight counts.
function liProfileChairliftSafe(profile){
  if(!profile) return false;
  const adapters = window.DoloPawsRecommendationAdaptersV1;
  if(adapters && typeof adapters.chairliftSafe === 'function') return adapters.chairliftSafe(profile);
  const kg = Number(profile.weightKg);
  return !!(profile.behaviour && profile.behaviour.chairlift === 'ok') && Number.isFinite(kg) && kg <= 8;
}

function liRefineState(){
  return {
    duration: liFilters.duration,
    distance: liFilters.dist === 'any' ? '' : liFilters.dist,
    risk: liFilters.risk === 'any' ? '' : liFilters.risk,
    terrain: liFilters.terrain === 'any' ? '' : liFilters.terrain,
    heat: liFilters.shade === '40' ? 'shade-40' : liFilters.shade === '60' ? 'shade-60' : '',
    water: liFilters.water,
    lifts: liFilters.lifts,
  };
}

function liMatchesRefineFilters(x){
  const filters = window.DoloPawsDiscoveryFilters;
  if(filters) return filters.matches(x, liRefineState(), { chairliftSafe: liChairliftSafe });
  const lift = x && x.liftAccess;
  if(liFilters.lifts !== 'include' && !liChairliftSafe && lift && lift.dependency === 'required' && lift.type !== 'none' && lift.type !== 'gondola') return false;
  // Fallback if the shared filter has not loaded: the same thresholds inline.
  const multiDay = window.DoloPawsTrailTrust
    ? window.DoloPawsTrailTrust.isMultiDay(x) : Number(x.distance) > 25;
  if(liFilters.duration === 'multi' ? !multiDay : multiDay) return false;
  if(liFilters.dist === 'u5' && !(x.distance < 5)) return false;
  if(liFilters.dist === '5to10' && !(x.distance >= 5 && x.distance <= 10)) return false;
  if(liFilters.dist === '10p' && !(x.distance > 10)) return false;
  if(liFilters.risk !== 'any' && x.safetyLevel !== liFilters.risk) return false;
  if(liFilters.terrain === 'soft' && !(Number(x.terrainRank) <= 0)) return false;
  if(liFilters.terrain === 'mixed' && !(Number(x.terrainRank) <= 1)) return false;
  if(liFilters.terrain === 'rocky' && !(Number(x.terrainRank) <= 2)) return false;
  if(liFilters.shade === '40' && !((x.shadeCoverage || 0) >= 40)) return false;
  if(liFilters.shade === '60' && !((x.shadeCoverage || 0) >= 60)) return false;
  if(liFilters.water && !(Array.isArray(x.waterSources) && x.waterSources.length > 0)) return false;
  return true;
}

function filterTrailsForReturningView(list){
  let displayList = filterTrailsForLocationContext(list);
  if(showingSavedOnly) displayList = displayList.filter(x => currentFavorites[x.id]);
  const seasonRule = window.DoloPawsTrailSeasonWords;
  if(liInSeasonOnly && seasonRule){
    const month = new Date().getMonth() + 1;
    displayList = displayList.filter(x => !seasonRule.outOfSeason(x.season, month));
  }
  if(activeCountry !== 'all'){
    displayList = displayList.filter(x => {
      return liCountryForRegion(x.region) === activeCountry;
    });
  }
  if(activeRegion !== 'all') displayList = displayList.filter(x => x.region === activeRegion);
  if(activeValley !== 'all') displayList = displayList.filter(x => x.valley === activeValley);

  // Logged-in shell: header search + filter-panel refinements. All of these
  // read real trail fields; items arrive already scored (t.score).
  const q = liQuery.trim().toLowerCase();
  if(q) displayList = displayList.filter(x => liTrailSearchText(x).includes(q));
  // The decision filters (duration, distance, trail rating, terrain, shade) run
  // through the one shared discovery filter, so "Under 5 km", "Multi-day" or
  // "Water on route" means exactly the same thing here as on Browse and the
  // guest homepage. Geography, search, map bounds and match% stay local: they
  // are either richer here (region/country labels in search) or scored on this
  // runtime catalogue.
  displayList = displayList.filter(x => liMatchesRefineFilters(x));
  if(liFilters.minMatch > 0) displayList = displayList.filter(x => x.score >= liFilters.minMatch);

  // Sort is applied last so it always reflects the current filtered set.
  // 'match' just keeps the incoming order, the list is already sorted by
  // score desc before filtering, in renderReturningHomepage().
  if(sortKey === 'distance') displayList = displayList.slice().sort((a, b) => a.distance - b.distance);
  else if(sortKey === 'effort') displayList = displayList.slice().sort((a, b) => a.elevation - b.elevation);
  else if(sortKey === 'today'){
    // "Coolest", lowest heat load first, from the trail's real heat fields
    // (heatRisk tier, then shade). Stable sort keeps match order within ties.
    const hr = { low: 0, moderate: 1, high: 2 };
    displayList = displayList.slice().sort((a, b) =>
      ((hr[a.heatRisk] ?? 1) - (hr[b.heatRisk] ?? 1)) || ((b.shadeCoverage || 0) - (a.shadeCoverage || 0)));
  }
  // Whatever the order, the walks to go on now come first; those out of
  // season this month follow in the same order (trail-season-words.js).
  const seasonWords = window.DoloPawsTrailSeasonWords;
  if(seasonWords) displayList = seasonWords.inSeasonFirst(displayList, x => x.season, new Date().getMonth() + 1);

  return displayList;
}

// The searchable text for a trail: its own name/area/valley plus the region and
// country labels, so typing "Savoy" or "France" narrows the list just like the
// old region dropdown did — geography-by-typing.
function liTrailSearchText(trail){
  const configs = liRegionConfigs();
  const region = configs[trail.region];
  return [trail.name, trailDisplayName(trail), trail.area, trail.valley, region && region.label, region && region.country]
    .map(value => String(value || '').toLowerCase())
    .join(' ');
}

// The [lng, lat] a trail is pinned at on the map, matching updateMapMarkers:
// the verified trailhead, else the route start, else the area coordinate.
function liTrailLngLat(trail){
  if(trail.startPoint && typeof trail.startPoint.lat === 'number') return [trail.startPoint.lng, trail.startPoint.lat];
  if(Array.isArray(trail.path) && trail.path.length > 0) return [trail.path[0][1], trail.path[0][0]];
  if(typeof trail.lat === 'number' && typeof trail.lng === 'number') return [trail.lng, trail.lat];
  return null;
}


// The guest preview map used to live here. Its container #guestPreviewMap was
// removed from index.html in 784afd0b (2026-07-17) and never replaced, so
// initGuestMap() returned on its first line and roughly 160 lines of map
// setup, terrain, hiking network, route rails, lift markers, POI layers, // could not run. Signed-out visitors see no map on the homepage at all.
//
// It was still being maintained: the recent cartography work restyled layers
// in here that nothing renders. Deleted rather than left to collect edits.

let trailMapInstance = null;
let currentMapTrails = [];
let trailMapLoaded = false;
let pendingPathList = null;
let pendingMarkerList = null;

function initTrailMap(){
  if(trailMapInstance || typeof maplibregl === 'undefined') return;
  const el = document.getElementById('trailMap');
  if(!el) return;
  // Note: MapLibre uses [lng, lat] order, the opposite of Leaflet's [lat, lng].
  // The same map as the Trails page (explore-map.js): base, controls and
  // trail drawing; this page adds its ranked list and its numbered picks.
  // Scroll zoom is fine here: in the logged-in shell the map is a fixed
  // pane (the document doesn't scroll), so the wheel can't hijack scrolling.
  const exploreMap = window.ORMAExploreMap;
  trailMapInstance = new maplibregl.Map(exploreMap.mapOptions({ container:'trailMap' }));
  // "Draw a route here" and the toolbar's Draw a route open the planner on
  // the area on screen.
  const chrome = exploreMap.addChrome(trailMapInstance, {
    wrap:document.getElementById('trailMapWrap'),
    expandButton:document.getElementById('homeMapExpandBtn'),
    drawLinks:[document.getElementById('homeMapDrawBtn'), document.getElementById('liDrawRouteBtn')],
  });
  window.DoloPawsBrowseMapFS = {
    enter:() => chrome.setFullscreen(true),
    exit:() => chrome.setFullscreen(false),
  };

  // The map is the geography control, and it acts as one: the list ranks what
  // the view is showing, updated when the view settles. It used to ask first
  // ("Search this area"), which meant zooming somewhere and reading a list of
  // trails that were not there until you noticed the button. The button stays
  // as the way back to the area the map replaced, which zooming out cannot do.
  const areaButton = document.getElementById('liSearchThisArea');
  let mapViewTimer = null;
  const syncAreaButton = () => {
    if(!areaButton) return;
    const showing = !!(liLocationContext && liLocationContext.kind === 'map');
    areaButton.hidden = !showing;
    areaButton.classList.toggle('is-clear', showing);
    if(showing){
      const back = liContextBeforeMapArea;
      areaButton.textContent = back && !liIsAllTrailsContext(back)
        ? tx('Back to {place}', { place:liShownPlaceLabel(back.label) })
        : tx('Show all trails');
    }
  };
  if(areaButton){
    // Where the map starts, not nothing: the first moveend, when the map
    // finishes loading, compared with '' and read as a pan to "the map view".
    let lastMapView = liMapViewSignature(trailMapInstance);
    trailMapInstance.on('moveend', event => {
      const signature = liMapViewSignature(trailMapInstance);
      // The page's own framing says so on the event. The time window alone
      // missed a fit that settled late, on a map just revealed or still
      // loading tiles, and read it as a pan to "the map view".
      if(event && event.liAutoFrame){ lastMapView = signature; return; }
      if(!liMapMoveIsReaders(signature, lastMapView)){ lastMapView = signature; return; }
      lastMapView = signature;
      if(mapViewTimer) clearTimeout(mapViewTimer);
      // A pan is a series of moveends; wait for the hand to stop before
      // re-ranking, so one gesture costs one render and one forecast.
      mapViewTimer = setTimeout(() => {
        liApplyMapViewport(trailMapInstance.getBounds());
        syncAreaButton();
      }, 350);
    });
    areaButton.addEventListener('click', () => {
      if(mapViewTimer) clearTimeout(mapViewTimer);
      // Nothing to go back to means the map view was the whole location:
      // clearing it shows the catalogue, not a map area with no map.
      liSetLocationContext(liExitMapArea() || liDefaultLocationContext());
      syncAreaButton();
    });
    syncAreaButton();
  }

  trailMapInstance.on('load', async () => {
    const beforeIds = await exploreMap.setupBase(trailMapInstance);
    // The six decision candidates stand out, coloured and numbered like the
    // list; the rest of the catalogue stays as quiet grey context.
    exploreMap.addTrailLayers(trailMapInstance, beforeIds, {
      colour:window.ORMAMapStyle.matchColourExpression('score'),
      lineEmphasis:TOP_MATCH_TEST,
      pinEmphasis:TOP_MATCH_TEST,
      rankLabels:true,
    });

    trailMapInstance.on('click', 'trail-unclustered', (e) => {
      const feature = e.features && e.features[0];
      if(!feature) return;
      const selected = currentMapTrails.find(t => t.id === feature.properties.id);
      if(selected){
        selectTrail(selected);
        jumpToCard(selected.id);
      }
    });
    // The route line itself is a click target too, no need to hunt for
    // the trailhead dot. Clicking anywhere on a trail opens the single,
    // full-width ORMA trail card below the map.
    trailMapInstance.on('click', 'trail-paths-hit', (e) => {
      const feature = e.features && e.features[0];
      if(!feature) return;
      const selected = currentMapTrails.find(t => t.id === feature.properties.id);
      if(selected){
        selectTrail(selected);
        jumpToCard(selected.id);
      }
    });
    ['trail-unclustered','trail-paths-hit'].forEach(layerId => {
      trailMapInstance.on('mouseenter', layerId, () => { trailMapInstance.getCanvas().style.cursor = 'pointer'; });
      trailMapInstance.on('mouseleave', layerId, () => { trailMapInstance.getCanvas().style.cursor = ''; });
    });

    exploreMap.addOverlays(trailMapInstance, 'trailMap');

    trailMapLoaded = true;
    if(pendingPathList) updatePathLayer(pendingPathList);
    if(pendingMarkerList) updateMapMarkers(pendingMarkerList);
    if(liPendingLocationCenter && currentMapTrails.length === 0){
      trailMapInstance.flyTo({ center:liPendingLocationCenter, zoom:10 }, { liAutoFrame:true });
    }
    const selected = currentMapTrails.find(trail => trail.id === selectedTrailId);
    if(selected) setSelectedTrailRoute(selected, { fit:false });
  });
}

let trailMapSchedule = null;
function scheduleTrailMap(){
  if(trailMapInstance || trailMapSchedule) return;
  const target = document.getElementById('trailMap');
  if(!target) return;
  if(window.DoloPawsMapRuntime){
    trailMapSchedule = window.DoloPawsMapRuntime.whenVisible(target, initTrailMap, {
      rootMargin:'360px 0px',
      triggers:[document.getElementById('homeMapExpandBtn')],
    });
    const expand = document.getElementById('homeMapExpandBtn');
    if(expand){
      expand.addEventListener('click', async event => {
        if(trailMapInstance || !trailMapSchedule || !trailMapSchedule.start) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        await trailMapSchedule.start();
        if(trailMapInstance) expand.click();
      }, { capture:true });
    }
  } else {
    initTrailMap();
  }
}

// On phones the map is the homepage itself, not content farther down the
// document. The returning-member panel and the fixed mobile shell become
// visible in separate auth/layout callbacks, so an IntersectionObserver
// created between those callbacks can observe the old zero-sized layout and
// never start. Explicitly start the already-idempotent scheduler on mobile;
// desktop keeps its lazy-loading behaviour.
function startMobileTrailMap(){
  const returningHome = document.getElementById('returningCustomerHomepage');
  const isMobile = typeof window.matchMedia === 'function'
    && window.matchMedia('(max-width: 700px)').matches;
  if(!isMobile || !returningHome || returningHome.hidden) return Promise.resolve(null);

  scheduleTrailMap();
  if(trailMapInstance){
    requestAnimationFrame(() => trailMapInstance.resize());
    return Promise.resolve(trailMapInstance);
  }
  if(!trailMapSchedule || typeof trailMapSchedule.start !== 'function') return Promise.resolve(null);

  return trailMapSchedule.start().then(result => {
    if(trailMapInstance) requestAnimationFrame(() => trailMapInstance.resize());
    return result;
  });
}

window.addEventListener('dolopaws-mobile-layout-change', () => {
  if(document.body.classList.contains('mhome-active')) startMobileTrailMap();
});

function pathThumbnailSvg(path){
  if(!Array.isArray(path) || path.length < 2) return null;
  const lats = path.map(p => p[0]), lngs = path.map(p => p[1]);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const W = 120, H = 90, pad = 10;
  const spanLat = (maxLat - minLat) || 0.0001;
  const spanLng = (maxLng - minLng) || 0.0001;
  const scale = Math.min((W - pad*2) / spanLng, (H - pad*2) / spanLat);
  const points = path.map(([lat, lng]) => {
    const x = pad + (lng - minLng) * scale + (W - pad*2 - spanLng*scale) / 2;
    const y = pad + (maxLat - lat) * scale + (H - pad*2 - spanLat*scale) / 2; // flip Y (lat increases upward)
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block;">
    <rect width="${W}" height="${H}" fill="var(--sage-dim)"/>
    <polyline points="${points}" fill="none" stroke="var(--ink)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`;
}

// Compact dot marker for trails, replaces MapLibre's default teardrop
// pin, which turns into a wall of signposts with 100+ trails on screen.
function makeTrailDot(){
  const el = document.createElement('div');
  el.className = 'dp-marker-dot';
  return el;
}

// Companion selection: syncs the map pin, the floating callout, and the
// card border/shadow for one trail at a time. Reused by pin clicks,
// "Locate on map", and clicking a card thumbnail.
function selectTrail(t){
  selectedTrailId = t.id;
  setSelectedTrailPoint(t.id);
  setSelectedTrailRoute(t);
  document.querySelectorAll('#returningTrailList .tc-selected').forEach(c => c.classList.remove('tc-selected'));
  const card = document.getElementById(`trail-card-${t.id}`);
  if(card) card.classList.add('tc-selected');
  if(typeof showMapCallout === 'function') showMapCallout(t);
}

function setSelectedTrailPoint(id){
  if(!trailMapLoaded || !trailMapInstance || !trailMapInstance.getLayer('trail-selected-point')) return;
  trailMapInstance.setFilter('trail-selected-point', ['==', ['get', 'id'], id || '__none__']);
}

// The chosen walk, drawn by the shared explore map in its match colour.
function setSelectedTrailRoute(trail, options){
  if(!trailMapLoaded || !trailMapInstance) return;
  window.ORMAExploreMap.setSelected(trailMapInstance, trail, Object.assign({
    routeColor:window.ORMAMapStyle.matchColour(trail ? trail.score : null),
  }, options || {}));
  setSelectedTrailPoint(selectedTrailId);
}

function jumpToCard(trailId){
  const card = document.getElementById(`trail-card-${trailId}`);
  if(!card) return;
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  card.classList.add('highlighted');
  setTimeout(() => card.classList.remove('highlighted'), 2000);
}

function updatePathLayer(list){
  if(!trailMapLoaded){
    pendingPathList = list;
    return;
  }
  const features = list
    .filter(t => Array.isArray(t.path) && t.path.length > 1)
    .map((t, index) => ({
      type: 'Feature',
      properties: {
        id: t.id, name: trailDisplayName(t), safetyLevel: t.safetyLevel,
        score: typeof t.score === 'number' ? t.score : 0,
        rank: index + 1,
      },
      geometry: { type: 'LineString', coordinates: t.path.map(([lat, lng]) => [lng, lat]) },
    }));
  trailMapInstance.getSource('trail-paths').setData({ type: 'FeatureCollection', features });
  // NOTE: The 'water-sources' source is managed exclusively by initializeWaterSources(),
  // which loads the full OSM dataset (Trentino, Veneto, Savoy) from
  // water-sources-all-regions.geojson. Do NOT overwrite it here, the old code that
  // replaced its data with per-trail points was wiping out all the fountain markers.
}

function liOutOfSeasonNow(trail){
  const words = window.DoloPawsTrailSeasonWords;
  return Boolean(words && trail && trail.season && words.outOfSeason(trail.season, new Date().getMonth() + 1));
}

function updateMapMarkers(list){
  // Recommendations can render before the deferred map is constructed. Keep
  // their geographic scope so the first map paint opens on the same area as
  // the list instead of flashing the map's catalogue default.
  if(!trailMapInstance){
    pendingMarkerList = list.slice();
    pendingPathList = list.slice();
    return;
  }
  updatePathLayer(list);
  currentMapTrails = list.slice();
  if(!trailMapLoaded || !trailMapInstance.getSource('trail-points')){
    pendingMarkerList = list.slice();
    return;
  }

  const features = list.map((t, index) => {
    if(typeof t.lat !== 'number' || typeof t.lng !== 'number') return null;
    // Prefer the verified trailhead over an approximate area coordinate.
    let markerLat = t.lat, markerLng = t.lng;
    if(t.startPoint){
      markerLat = t.startPoint.lat; markerLng = t.startPoint.lng;
    } else if(Array.isArray(t.path) && t.path.length > 0){
      [markerLat, markerLng] = t.path[0];
    }
    return {
      type: 'Feature',
      properties: {
        id: t.id, name: trailDisplayName(t), safetyLevel: t.safetyLevel,
        score: typeof t.score === 'number' ? t.score : 0,
        rank: index + 1,
        saved: currentFavorites[t.id] ? 1 : 0,
        // Out of season this month (trail-season-words.js): faded, and drawn
        // under the walks to go on now.
        out: liOutOfSeasonNow(t) ? 1 : 0,
      },
      geometry: { type: 'Point', coordinates: [markerLng, markerLat] },
    };
  }).filter(Boolean);
  trailMapInstance.getSource('trail-points').setData({ type: 'FeatureCollection', features });
  setSelectedTrailPoint(selectedTrailId);
  pendingMarkerList = null;

  // Fit the view to whatever's currently visible, so filtering the list
  // also re-frames the map instead of leaving it zoomed to the wrong area.
  // Exception: when the map itself is the filter ("Search this area"),
  // reframing would fight the viewport the user just chose, so leave it.
  const validList = list.filter(t => typeof t.lat === 'number' && typeof t.lng === 'number');
  if(validList.length > 0 && !liViewIsTheFilter()){
    const bounds = new maplibregl.LngLatBounds();
    validList.forEach(t => {
      if(Array.isArray(t.path) && t.path.length > 1){
        t.path.forEach(([lat, lng]) => bounds.extend([lng, lat]));
      } else {
        bounds.extend([t.lng, t.lat]);
      }
    });
    liMapAutoFramingUntil = Date.now() + LI_MAP_AUTO_FRAME_MS;
    trailMapInstance.fitBounds(bounds, { padding: 40, maxZoom: 12 }, { liAutoFrame:true });
  }
}

const companionPanelToggle = document.getElementById('companionPanelToggle');
const companionPanelClose = document.getElementById('companionPanelClose');
const companionPanelBackdrop = document.getElementById('companionPanelBackdrop');
const companionSidebar = document.getElementById('companionSidebar');

function companionPanelIsMobile(){
  return window.matchMedia('(max-width: 900px)').matches;
}

function setCompanionPanelOpen(open, returnFocus){
  const next = !!open && companionPanelIsMobile();
  document.body.classList.toggle('companion-mobile-panel-open', next);
  if(companionPanelToggle) companionPanelToggle.setAttribute('aria-expanded', String(next));
  if(companionSidebar) companionSidebar.setAttribute('aria-hidden', String(companionPanelIsMobile() && !next));
  if(next && companionPanelClose) companionPanelClose.focus();
  if(!next && returnFocus && companionPanelToggle) companionPanelToggle.focus();
}

if(companionPanelToggle){
  companionPanelToggle.addEventListener('click', () => setCompanionPanelOpen(true));
}
if(companionPanelClose){
  companionPanelClose.addEventListener('click', () => setCompanionPanelOpen(false, true));
}
if(companionPanelBackdrop){
  companionPanelBackdrop.addEventListener('click', () => setCompanionPanelOpen(false, true));
}
document.addEventListener('keydown', (e) => {
  if(e.key === 'Escape' && document.body.classList.contains('companion-mobile-panel-open')){
    setCompanionPanelOpen(false, true);
  }
});
window.addEventListener('resize', () => setCompanionPanelOpen(false));
setCompanionPanelOpen(false);

function liRegionConfigs(){
  return window.DoloPawsRegions && window.DoloPawsRegions.REGIONS
    ? window.DoloPawsRegions.REGIONS
    : {
        dolomites: { label: 'Dolomites', country: 'Italy', countryCode: 'IT' },
        savoy: { label: 'Savoy', country: 'France', countryCode: 'FR' }
      };
}

// A region's country comes from its row in regions-config.js. Austria made a
// third country, so "not Savoy" no longer means Italy.
function liCountryForRegion(region){
  if(!region || region === 'all') return 'all';
  const config = liRegionConfigs()[region];
  return config ? config.countryCode : (region === 'savoy' ? 'FR' : 'IT');
}

function liRegionIdsForCountry(countryCode){
  return Object.entries(liRegionConfigs())
    .filter(([, config]) => countryCode === 'all' || config.countryCode === countryCode)
    .map(([region]) => region);
}

function liSelectedGeographyLabel(){
  const configs = liRegionConfigs();
  if(activeRegion !== 'all') return liShownPlaceLabel((configs[activeRegion] && configs[activeRegion].label) || activeRegion);
  if(activeCountry !== 'all'){
    const config = Object.values(configs).find(item => item.countryCode === activeCountry);
    return config ? liShownPlaceLabel(config.country) : tx('All regions');
  }
  return tx('All countries');
}

function liTrailIsInSelectedGeography(trail, includeValley){
  if(activeCountry !== 'all' && liCountryForRegion(trail.region) !== activeCountry) return false;
  if(activeRegion !== 'all' && trail.region !== activeRegion) return false;
  return !includeValley || activeValley === 'all' || trail.valley === activeValley;
}

async function activateReturningGeography(country, region, profile){
  if(country === activeCountry && region === activeRegion) return true;
  try {
    const regions = region === 'all' ? liRegionIdsForCountry(country) : [region];
    if(window.DoloPawsRegionalData){
      await Promise.all(regions.map(regionId => window.DoloPawsRegionalData.loadRegion(regionId)));
    }
    activeCountry = country;
    activeRegion = region;
    activeValley = 'all';
    selectedTrailId = null;
    hideMapCallout();
    if(trailMapInstance) await updateRegionalMapData(trailMapInstance, regions);
    renderReturningHomepage(profile);
    return true;
  } catch(e) {
    showHomeActionStatus(tx('That area could not be loaded. Check your connection and try again.'));
    return false;
  }
}

// "Saved" is a view of the ranked list, shown as a tab beside Sort rather than
// as a filter chip. Paint both tabs from showingSavedOnly and the saved count.
function renderLiSavedControl(){
  const count = Object.keys(currentFavorites || {}).length;
  const countEl = document.getElementById('liSavedOnlyCount');
  if(countEl) countEl.textContent = String(count);
  const allTab = document.getElementById('liViewAll');
  const savedTab = document.getElementById('liViewSaved');
  if(allTab){
    allTab.classList.toggle('active', !showingSavedOnly);
    allTab.setAttribute('aria-selected', String(!showingSavedOnly));
  }
  if(savedTab){
    savedTab.classList.toggle('active', showingSavedOnly);
    savedTab.setAttribute('aria-pressed', String(showingSavedOnly));
  }
}

// Companion sidebar, dog profile card. Avatar, breed/age line, and up to
// three trait chips reused straight from breedInsights() titles (so the
// wording is always identical to the homepage insight card and the
// per-trail "why this works" copy, one source of truth, three surfaces).
function renderDogProfileCard(profile){
  const nameEl = document.getElementById('companionDogName');
  const metaEl = document.getElementById('companionDogMeta');
  const chipsEl = document.getElementById('companionDogChips');
  const avatarEl = document.getElementById('companionDogAvatar');
  if(!nameEl || !metaEl || !chipsEl || !avatarEl) return;

  const name = (profile && profile.name) ? profile.name : tx('Your dog');
  nameEl.textContent = name;
  const mobileLabel = document.getElementById('companionMobileDogLabel');
  if(mobileLabel) mobileLabel.textContent = profile && profile.name ? tx('{name}\'s profile', { name:profile.name }) : tx('dog profile');

  const breed = profile && profile.breed;
  const hasBreedName = breed && !NON_BREED_LABELS.has(breed);
  const age = profile ? dogAgeYears(profile) : null;
  const ageLabel = age != null ? (age < 1 ? tx('under 1 yr') : tx('{n} yrs', { n:Math.round(age) })) : null;
  metaEl.textContent = [hasBreedName ? breed : null, ageLabel].filter(Boolean).join(' · ') || (profile ? tx('Profile saved') : tx('No profile yet'));

  // Physical identity only (size/weight, coat, life stage), the WHY behind
  // each trait (cold at rest, thin skin, etc.) is the breed-insight card's
  // job just below. Repeating those same titles up here read as duplicated
  // content once both cards were on screen together, so this card now
  // sticks to a quick-glance ID, not the reasoning.
  const kg = profile ? dogWeightKg(profile) : null;
  const sizeLabel = kg == null ? null : kg < 10 ? tx('Small') : kg <= 25 ? tx('Medium') : kg <= 45 ? tx('Large') : tx('Giant');
  const tr = (typeof breedTraits === 'function' && breed) ? breedTraits(breed) : {};
  const chips = [];
  if(sizeLabel) chips.push(kg ? `${sizeLabel} · ${Math.round(kg)} kg` : sizeLabel);
  if(tr.thickCoat) chips.push(tx('Heavy double coat'));
  else if(tr.brachy) chips.push(tx('Flat-faced'));
  const fitness = profile && profile.fitness;
  if(fitness) chips.push(tx('{level} fitness', { level:fitness.charAt(0).toUpperCase() + fitness.slice(1) }));
  if(age != null && age < 1) chips.push(tx('Puppy'));
  else if(age != null && age >= 8) chips.push(tx('Senior'));
  chipsEl.innerHTML = chips.slice(0, 3).map(c => `<span class="companion-chip">${c}</span>`).join('');

  const photo = profile && profile.photo;
  avatarEl.innerHTML = (typeof photo === 'string' && photo.startsWith('data:image/'))
    ? `<img src="${photo}" alt="${name}">`
    : (window.DoloPawsIcons ? window.DoloPawsIcons.renderIconSvg('dog', { mode:'inline', color:'currentColor', size:24 }) : '');

  // Greeting-avatar switcher panel mirrors the same identity.
  const greetName = document.getElementById('liGreetRowName');
  if(greetName) greetName.textContent = name;
  const greetMeta = document.getElementById('liGreetRowMeta');
  if(greetMeta) greetMeta.textContent = metaEl.textContent;
  liFillAvatar(document.getElementById('liGreetRowAvatar'), profile);
}

// Companion sidebar, conditions / readiness card. ORMA has no live
// weather feed, so rather than inventing a temperature this reflects the
// dog's REAL heat-sensitivity (breed traits + declared health conditions,
// the same flag effectiveOverrides() already uses to penalise the score)
// and points at the real adjust-for-today tool instead of a fake forecast.
function renderConditionsCard(profile){
  const card = document.getElementById('companionConditionsCard');
  const labelEl = document.getElementById('companionConditionsLabel');
  const barsEl = document.getElementById('companionHeatBars');
  const readingEl = document.getElementById('companionHeatReading');
  const noteEl = document.getElementById('companionConditionsNote');
  if(!card) return;

  // The "Adjust for today" button lives inside this card, so the card
  // itself must stay visible even with no saved profile yet, otherwise
  // a logged-in user without a dog profile would have no way to reach it.
  if(!profile){
    labelEl.textContent = tx('HEAT READINESS');
    barsEl.innerHTML = [0,1,2].map(() => '<span class="bar"></span>').join('');
    readingEl.textContent = '';
    noteEl.innerHTML = tx('Add your dog\'s details to see their real heat tolerance here. Meanwhile, trails below use an average-dog default.');
    card.hidden = false;
    return;
  }

  const overrides = effectiveOverrides(profile, null);
  const sensitive = !!overrides.heatSensitive;
  const level = sensitive ? 2 : 1; // segments lit out of 3
  const name = profile.name || tx('your dog');

  labelEl.textContent = sensitive ? tx('HEAT-SENSITIVE DOG') : tx('HEAT READINESS');
  barsEl.innerHTML = [0,1,2].map(i => `<span class="bar${i < level ? ' on' : ''}"></span>`).join('');
  readingEl.textContent = sensitive ? tx('Higher risk') : tx('Typical');
  noteEl.innerHTML = sensitive
    ? tx('{name}\'s breed or health profile runs hotter on exposed climbs, so shaded and low routes are ranked higher below. <strong>Start early on warm days.</strong>', { name })
    : tx('Match scores already account for {name}\'s heat tolerance. Use "Adjust for today" if today\'s weather changes what\'s sensible.', { name });
  card.hidden = false;
}

// Personalised breed-insight card on the logged-in homepage. Reads documented
// physical traits via breedInsights() (breeds-data.js) and shows only lines
// that apply. Unknown/mixed breeds → card stays hidden (health profile does the
// work instead). Physical traits only, never temperament.
// Breed labels that carry no classifiable breed information, coarse
// size buckets or a genuine unknown. The card still renders for these,
// just headed by the dog's name instead of a breed name (profileInsights
// still supplies weight/age/condition-derived lines for them).
const NON_BREED_LABELS = new Set([
  'Mixed breed, small (under 10 kg)', 'Mixed breed, medium (10–25 kg)',
  'Mixed breed, large (over 25 kg)', 'Rescue / unknown mix',
]);

function renderBreedInsight(profile){
  const card = document.getElementById('breedInsightCard');
  if(!card || typeof profileInsights !== 'function') return;
  const kicker = document.getElementById('breedInsightKicker');
  const grid = document.getElementById('breedInsightGrid');
  const note = document.getElementById('breedInsightNote');
  const cta = document.getElementById('breedInsightCta');

  const breed = profile && profile.breed;
  const lines = profileInsights(profile);
  if(!lines.length){ card.hidden = true; return; }

  const ICONS = {
    paw:'<circle cx="8" cy="8.2" r="1.6" fill="#5DCAA5"/><circle cx="12" cy="6.6" r="1.6" fill="#5DCAA5"/><circle cx="16" cy="8.2" r="1.6" fill="#5DCAA5"/><path d="M8.4 16.5c0-2.4 1.5-4.2 3.6-4.2s3.6 1.8 3.6 4.2c0 1.4-1.1 2.5-2.5 2.5-.7 0-1.1-.3-1.7-.7-.5.4-1 .7-1.7.7-1.3 0-2.3-1.1-2.3-2.5Z" fill="#1D9E75"/>',
    shade:'<path d="M12 5v14M7 19h10M6 12c0-3 2.7-6 6-6s6 3 6 6Z" fill="none" stroke="#4A7856" stroke-width="1.8"/><path d="m7 12-3 3M17 12l3 3" fill="none" stroke="#4A7856" stroke-width="1.8"/>',
    heat:'<circle cx="12" cy="12" r="4" fill="#D6A038"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" fill="none" stroke="#D6A038" stroke-width="1.8" stroke-linecap="round"/>',
    mountain:'<path d="m4 18 6-10 3 5 2-3 5 8Z" fill="none" stroke="#BA7517" stroke-width="1.8" stroke-linejoin="round"/>',
    loop:'<path d="M18 8a7 7 0 1 0 1 7M18 4v4h-4" fill="none" stroke="#3E7A91" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>',
    crowd:'<circle cx="6.3" cy="4.6" r="2.1" fill="none" stroke="#8B6F47" stroke-width="1.7"/><path d="M7.8 6.6c3.4 2 7.6 3.6 8.6 8.2" fill="none" stroke="#8B6F47" stroke-width="1.7" stroke-linecap="round"/><circle cx="17.3" cy="17.3" r="2.4" fill="none" stroke="#8B6F47" stroke-width="1.7"/>',
    cold:'<path d="M12 3v18M12 3l-2.2 2.2M12 3l2.2 2.2M12 21l-2.2-2.2M12 21l2.2-2.2M4 8l16 8M4 8l2.8.6M4 8l1-2.7M20 16l-2.8-.6M20 16l-1 2.7M4 16l16-8M4 16l2.8-.6M4 16l1 2.7M20 8l-2.8.6M20 8l-1-2.7" fill="none" stroke="#4C87C6" stroke-width="1.4" stroke-linecap="round"/>',
    water:'<path d="M12 4c2.8 3.4 4.5 6 4.5 8.4a4.5 4.5 0 1 1-9 0C7.5 10 9.2 7.4 12 4Z" fill="#378ADD"/>'
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
  const name = (profile && profile.name) ? profile.name : tx('your dog');
  const hasBreedName = breed && !NON_BREED_LABELS.has(breed);
  if(kicker) kicker.textContent = hasBreedName
    ? tx('What the mountains ask of a {breed}', { breed })
    : tx('What matters for {name}\u2019s hikes', { name });
  // 3 columns reads best; if only 1-2 lines the grid still balances.
  grid.style.gridTemplateColumns = 'repeat(' + Math.min(3, Math.max(1, lines.length)) + ', 1fr)';
  grid.innerHTML = lines.slice(0, 6).map(function(l){
    return '<div class="breed-insight-signal"><svg viewBox="0 0 24 24" aria-hidden="true">' +
      (ICONS[l.icon] || ICONS.paw) + '</svg><span><b>' + esc(l.title) +
      '</b><small>' + esc(l.sub) + '</small></span></div>';
  }).join('');

  if(note) note.textContent = tx('Baked into every match score for {name}.', { name });
  if(cta) cta.textContent = tx('See trails picked for {name} \u2192', { name });
  card.hidden = false;
}

// ============================================================
// LOGGED-IN SHELL, header search, filter panel, account menu and
// on-map conditions card for the map-first homepage layout.
// ============================================================

function liActiveFilterCount(){
  return [
    liFilters.dist !== 'any',
    liFilters.risk !== 'any',
    liFilters.terrain !== 'any',
    liFilters.shade !== 'any',
    liFilters.minMatch > 0,
    liFilters.water,
    liFilters.duration !== 'day',
    showingSavedOnly,
    liInSeasonOnly,
    liViewIsTheFilter(),
  ].filter(Boolean).length;
}

function liResetAllFilters(){
  liQuery = '';
  liFilters = { dist: 'any', risk: 'any', terrain: 'any', shade: 'any', minMatch: 0, water: false, duration: 'day', lifts: '' };
  showingSavedOnly = false;
  liInSeasonOnly = false;
  liSyncInSeasonToggle();
  activeValley = 'all';
  const search = document.getElementById('liSearch');
  if(search) search.value = '';
  // A map area counts as a filter, so resetting clears it -- but it is also
  // the location, so clearing it has to hand the location back instead of
  // leaving the heading reading "Map area" over an unframed list, with the
  // button that offered the way out now hidden.
  if(liLocationContext && liLocationContext.kind === 'map'){
    liSetLocationContext(liExitMapArea() || liDefaultLocationContext());
    return;
  }
  liClearMapAreaFilter();
  renderReturningHomepage(currentProfileForAdjust);
}

// The headline is the control: "Best walk for Teo in Alta Pusteria today",
// where the place and the day are buttons that open their own small menus.
// The whole catalogue has no place phrase, so its button says so instead of
// leaving a blank to press.
function liRenderHeadline(profile, locationPhrase, dayLabel){
  const host = document.getElementById('liToolbarGreeting');
  if(!host) return;
  const token = (kind, text) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'li-head-tok';
    button.dataset.liHead = kind;
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-expanded', 'false');
    button.textContent = text;
    return button;
  };
  // The place is chosen with Country, Region and Valley beside the search,
  // so in the headline it is plain words; only the day is pressed here.
  const place = document.createElement('span');
  place.className = 'li-head-place';
  place.dataset.liHead = 'area';
  place.textContent = locationPhrase || tx('across all trails');
  host.textContent = `${profile && profile.name ? tx('Best walk for {name}', { name:profile.name }) : tx('Best walk')} `;
  host.append(
    place,
    ' ',
    token('day', dayLabel),
  );
}

function liToggleHeadMenu(button){
  const menu = document.getElementById(button.dataset.liHead === 'day' ? 'liDayMenu' : 'liAreaMenu');
  if(!menu) return;
  const willOpen = menu.hidden;
  liCloseMenus();
  if(!willOpen) return;
  // Opened under the word that was pressed, kept inside the toolbar.
  const greet = menu.offsetParent || menu.parentElement;
  const left = greet
    ? button.getBoundingClientRect().left - greet.getBoundingClientRect().left
    : 0;
  menu.style.left = `${Math.max(0, Math.round(left))}px`;
  menu.hidden = false;
  button.setAttribute('aria-expanded', 'true');
}


function liCloseMenus(){
  ['liFiltersMenu', 'liNewMenu', 'liAccountMenu', 'liGreetSwitchMenu', 'liBellMenu', 'liAreaMenu', 'liDayMenu', 'liSortMenu'].forEach(id => {
    const menu = document.getElementById(id);
    if(menu) menu.hidden = true;
  });
  ['liFiltersBtn', 'liNewBtn', 'liAccountBtn', 'liGreetSwitchBtn', 'liBellBtn', 'liSortBtn'].forEach(id => {
    const btn = document.getElementById(id);
    if(btn) btn.setAttribute('aria-expanded', 'false');
  });
  document.querySelectorAll('[data-li-head]').forEach(btn => btn.setAttribute('aria-expanded', 'false'));
}

// Put the map-view button back to its idle state, without triggering a
// re-render (callers decide when to repaint).
function liClearMapAreaFilter(){
  const button = document.getElementById('liSearchThisArea');
  if(button){
    button.hidden = true;
    button.classList.remove('is-clear');
    button.textContent = tx('Search this area');
  }
}

// Leaving a map area has three things to put back, and only one of them is the
// filter: the viewport bounds, the button offering to clear them, and the
// context the map area replaced. Whichever is left behind outlives the map
// area -- a button still reading "Clear map area" over a valley typed since,
// where pressing it frames a new area instead of clearing one. Returns the
// context the map area replaced, for callers that are handing the location
// back rather than replacing it.
function liExitMapArea(){
  const restored = liContextBeforeMapArea;
  liContextBeforeMapArea = null;
  liClearMapAreaFilter();
  return restored;
}

// Dog photo resolution shared by the account pill and the conditions card:
// account profile first, then the per-uid cache, then the legacy device key.
function liDogPhoto(profile){
  const isImage = v => typeof v === 'string' && v.startsWith('data:image/');
  const uid = window.DoloPawsAuth && window.DoloPawsAuth.currentUser && window.DoloPawsAuth.currentUser.uid;
  const candidates = [profile && profile.photo];
  try {
    if(uid && profile && profile.id) candidates.push(localStorage.getItem('dolopaws-dog-photo-' + uid + '-' + profile.id));
    if(!profile || !profile.id){
      if(uid) candidates.push(localStorage.getItem('dolopaws-dog-photo-' + uid));
      candidates.push(localStorage.getItem('dolopaws-dog-photo'));
    }
  } catch(e){}
  return candidates.find(isImage) || null;
}

function liFillAvatar(el, profile){
  if(!el) return;
  const photo = liDogPhoto(profile);
  const name = (profile && profile.name) ? profile.name.trim() : '';
  if(photo){
    el.style.backgroundImage = `url(${photo})`;
    el.textContent = '';
  } else {
    el.style.backgroundImage = 'none';
    el.textContent = name ? name.charAt(0).toUpperCase() : '🐾';
  }
}

// Profile reads and the cached summary are refreshed independently. If a
// network read briefly returns null, keep painting the active cached dog
// instead of flashing the signed-in fallback between completed renders.
function liResolveActiveProfile(profile){
  if(profile && profile.name) return profile;
  const summary = liCachedSummary();
  if(!(summary && summary.hasProfile !== false)) return profile;
  const dogs = Array.isArray(summary.dogs) ? summary.dogs : [];
  const active = dogs.find(dog => dog && dog.id === summary.activeDogId) || dogs[0];
  if(active && active.name) return active;
  return summary.name ? summary : profile;
}

// firebase-init.js keeps the summary it last wrote in memory as well. Prefer
// it: a phone with a full localStorage refuses the write, and the stored copy
// is then the guest's, with no dogs, even after a refresh.
function liCachedSummary(){
  const auth = typeof window !== 'undefined' ? window.DoloPawsAuth : null;
  const live = auth ? auth.profileSummary : undefined;
  if(live !== undefined) return live && typeof live === 'object' ? live : null;
  try { return JSON.parse(localStorage.getItem('dolopaws-profile-summary') || 'null'); } catch(e){ return null; }
}

function renderLiDogLists(profile){
  const summary = liCachedSummary();
  const dogs = summary && Array.isArray(summary.dogs) && summary.dogs.length
    ? summary.dogs : profile ? [profile] : [];
  const activeId = summary && summary.activeDogId || (profile && profile.id);
  ['liDogList','liGreetDogList'].forEach(id => {
    const list = document.getElementById(id);
    if(!list) return;
    list.innerHTML = '';
    dogs.forEach(dog => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'nav-dogmenu-row' + (dog.id === activeId ? ' on' : '');
      row.setAttribute('aria-pressed', String(dog.id === activeId));
      const avatar = document.createElement('span');
      avatar.className = 'li-avatar';
      liFillAvatar(avatar, dog);
      const copy = document.createElement('span');
      copy.style.cssText = 'flex:1;min-width:0;';
      const name = document.createElement('b');
      name.textContent = dog.name || tx('Your dog');
      const meta = document.createElement('small');
      meta.textContent = [dog.breed, dog.fitness ? tx('{level} fitness', { level:dog.fitness }) : null].filter(Boolean).join(' · ');
      copy.append(name, meta);
      row.append(avatar, copy);
      // A dog card opens that dog's profile. account.html makes the dog
      // active itself when ?dog= names another one.
      row.addEventListener('click', () => {
        // The account dropdown is not a modal. Dismiss it first.
        liCloseMenus();
        window.location.href = dog.id
          ? `account.html?dog=${encodeURIComponent(dog.id)}&next=%2F`
          : 'account.html?next=%2F';
      });
      list.appendChild(row);
    });
  });
}

// Dog pill + switcher panel labels. Called on every render so a wizard
// save or photo upload is reflected immediately.
function renderLiHeader(profile){
  const nameEl = document.getElementById('liAccountName');
  // The pill carries the dog itself (design TopNav dog pill), not the human.
  if(nameEl) nameEl.textContent = (profile && profile.name) ? profile.name : tx('Your dog');
  renderLiToolbarContext(profile);
  liFillAvatar(document.getElementById('liAccountAvatar'), profile);
  // Phone greeting row carries the dog's face next to the greeting.
  liFillAvatar(document.getElementById('liGreetAvatar'), profile);
  liFillAvatar(document.getElementById('liDogCtxAvatar'), profile);
  renderLiDogLists(profile);
  // The dog cards open each profile, so this link is only for a member
  // who has no dog yet.
  ['liManageLink','liGreetManageLink'].forEach(id => {
    const setup = document.getElementById(id);
    if(setup) setup.hidden = Boolean(profile && profile.name);
  });
  const matchLabel = document.getElementById('liMatchSecLabel');
  if(matchLabel) matchLabel.textContent = (profile && profile.name)
    ? tx('Minimum match for {name}', { name:profile.name })
    : tx('Minimum match');
}

function renderLiToolbarContext(profile){
  const dogName = (profile && profile.name) ? profile.name : tx('Your dog');
  const breed = profile && profile.breed ? profile.breed : '';
  // Desktop trail context is static; dog switching lives in the main nav.
  const ctxName = document.getElementById('liDogCtxName');
  if(ctxName) ctxName.textContent = dogName;
  const ctxBreed = document.getElementById('liDogCtxBreed');
  const ctxBreedSep = document.getElementById('liDogCtxBreedSep');
  const hasBreedName = breed && !NON_BREED_LABELS.has(breed);
  if(ctxBreed){
    ctxBreed.textContent = breed;
    ctxBreed.hidden = !hasBreedName;
    ctxBreed.title = hasBreedName ? tx('Read hiking caveats for {breed}', { breed }) : '';
  }
  if(ctxBreedSep) ctxBreedSep.hidden = !hasBreedName;
  const greeting = document.getElementById('liToolbarGreeting');
  if(greeting) greeting.textContent = profile && profile.name
    ? tx('Where are we going today, {name}?', { name:profile.name })
    : tx('Where are we going today?');
}

// The iPhone app asks three questions instead of five rows of choices: how
// long, what ground, and what the walk must have (shade, water). Trail rating
// and minimum match are left out because the verdict for your dog already
// weighs both, and nothing else can set them, so they stay at Any. Tapping
// the chosen length again goes back to any length.
function renderLiAppFilterQuestions(){
  const menu = document.getElementById('liFiltersMenu');
  if(!menu) return;
  const relabel = (el, text) => {
    if(!el) return;
    el.removeAttribute('data-i18n');
    el.textContent = text;
  };
  relabel(menu.querySelector('.li-fhead > span'), tx('What kind of walk?'));
  menu.querySelectorAll('.li-fsec').forEach(sec => {
    const next = sec.nextElementSibling;
    const id = next && next.id;
    if(id === 'liDistSeg') relabel(sec, tx('How long?'));
    else if(id === 'liTerrainSeg') relabel(sec, tx('Ground for paws'));
    else if(next && next.classList.contains('li-quick-filters')) relabel(sec, tx('Must have'));
    else if(id === 'liRiskSeg' || id === 'liMatchSeg') sec.hidden = true;
  });
  ['liRiskSeg', 'liMatchSeg'].forEach(id => {
    const el = document.getElementById(id);
    if(el){ el.hidden = true; el.innerHTML = ''; }
  });
  // Must have comes last, just above Show trails.
  const quick = menu.querySelector('.li-quick-filters');
  const apply = document.getElementById('liFiltersApply');
  if(quick && apply && quick.nextElementSibling !== apply){
    menu.insertBefore(quick.previousElementSibling, apply);
    menu.insertBefore(quick, apply);
  }

  const question = (elId, opts, cur, pick, clearTo) => {
    const el = document.getElementById(elId);
    if(!el) return;
    el.innerHTML = '';
    el.classList.add('li-seg--choices');
    opts.forEach(o => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'li-segbtn' + (o.v === cur ? ' on' : '');
      b.setAttribute('aria-pressed', String(o.v === cur));
      const name = document.createElement('b');
      name.textContent = o.label;
      const note = document.createElement('small');
      note.textContent = o.note;
      b.append(name, note);
      b.addEventListener('click', () => {
        pick(o.v === cur && clearTo !== undefined ? clearTo : o.v);
        renderReturningHomepage(currentProfileForAdjust);
      });
      el.appendChild(b);
    });
  };
  question('liDistSeg', [
    { label: tx('Short'), note: tx('under 5 km'), v: 'u5' },
    { label: tx('Half day'), note: '5–10 km', v: '5to10' },
    { label: tx('Long'), note: '10 km+', v: '10p' },
  ], liFilters.dist, v => { liFilters.dist = v; }, 'any');
  question('liTerrainSeg', [
    { label: tx('Soft'), note: tx('gentle only'), v: 'soft' },
    { label: tx('Mixed'), note: tx('some stones'), v: 'mixed' },
    { label: tx('Any'), note: tx('rocky is ok'), v: 'any' },
  ], liFilters.terrain, v => { liFilters.terrain = v; });
}

// Filter panel, segmented options + toggle rows. Rebuilt on every render
// so the active states always mirror the real filter state.
function renderLiControls(){
  const seg = (elId, opts, cur, pick) => {
    const el = document.getElementById(elId);
    if(!el) return;
    el.innerHTML = '';
    opts.forEach(o => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'li-segbtn' + (o.v === cur ? ' on' : '');
      b.setAttribute('aria-pressed', String(o.v === cur));
      b.textContent = o.label;
      b.addEventListener('click', () => { pick(o.v); renderReturningHomepage(currentProfileForAdjust); });
      el.appendChild(b);
    });
  };

  if(document.documentElement.classList.contains('orma-app')){
    renderLiAppFilterQuestions();
  } else {
    seg('liDistSeg', [
      { label: tx('Any'), v: 'any' }, { label: tx('Under 5 km'), v: 'u5' }, { label: '5–10 km', v: '5to10' }, { label: '10 km+', v: '10p' },
    ], liFilters.dist, v => { liFilters.dist = v; });
    seg('liRiskSeg', [
      { label: tx('Any'), v: 'any' }, { label: tx('Low risk'), v: 'low-risk' }, { label: tx('Moderate risk'), v: 'moderate' }, { label: tx('Higher risk'), v: 'caution' },
    ], liFilters.risk, v => { liFilters.risk = v; });
    seg('liTerrainSeg', [
      { label: tx('Any'), v: 'any' }, { label: tx('Gentle only'), v: 'soft' }, { label: tx('Up to moderate'), v: 'mixed' }, { label: tx('Steep is okay'), v: 'rocky' },
    ], liFilters.terrain, v => { liFilters.terrain = v; });
    seg('liMatchSeg', [
      { label: tx('Any'), v: 0 }, { label: '60%+', v: 60 }, { label: '75%+', v: 75 }, { label: '85%+', v: 85 },
    ], liFilters.minMatch, v => { liFilters.minMatch = v; });
  }

  // In the app the list follows the map as you move it; that is where you are
  // looking, not a filter you chose, so the badge leaves it out.
  const n = liActiveFilterCount()
    - (document.documentElement.classList.contains('orma-app') && liViewIsTheFilter() ? 1 : 0);
  const badge = document.getElementById('liFiltersBadge');
  if(badge) badge.textContent = n > 0 ? `(${n})` : '';
  const filtBtn = document.getElementById('liFiltersBtn');
  if(filtBtn) filtBtn.classList.toggle('on', n > 0);

  const quickStates = [
    ['liQuickShade', liFilters.shade === '60'],
    ['liQuickWater', liFilters.water],
  ];
  quickStates.forEach(([id, on]) => {
    const button = document.getElementById(id);
    if(button) button.setAttribute('aria-pressed', String(on));
  });

  renderLiChips();
}

// ---- Inline filter chips (design FilterBar): Any area · Distance ·
// Terrain · Shade · Water. Desktop-width control; phones keep the
// condensed Filters panel. Each chip is a popover listing its options;
// an active (non-default) chip shows its value with the accent tint. ----
let liOpenChipKey = null;
let liChipsOutsideWired = false;
function renderLiChips(){
  const wrap = document.getElementById('liChips');
  if(!wrap || typeof trails === 'undefined') return;

  const DIST_OPTS = [['any',tx('Any')], ['u5',tx('Under 5 km')], ['5to10','5–10 km'], ['10p','10 km+']];
  const TERRAIN_OPTS = [['any',tx('Any')], ['soft',tx('Gentle only')], ['mixed',tx('Up to moderate')], ['rocky',tx('Steep is okay')]];
  const SHADE_OPTS = [['any',tx('Any')], ['40',tx('Over 40%')], ['60',tx('Over 60%')]];
  const RISK_OPTS = [['any',tx('Any')], ['low-risk',tx('Low risk')], ['moderate',tx('Moderate risk')], ['caution',tx('Higher risk')]];
  const MATCH_OPTS = [[0,tx('Any')], [60,'60%+'], [75,'75%+'], [85,'85%+']];
  const label = (opts, v) => (opts.find(([k]) => k === v) || opts[0])[1];

  // The slim refine bar: only the four filters that change a walking decision.
  // Everything else (trail rating, minimum match) lives behind "More filters".
  const moreCount = (liFilters.risk !== 'any' ? 1 : 0) + (liFilters.minMatch > 0 ? 1 : 0);
  const chips = [
    { key: 'duration', title: tx('Duration'),
      display: liFilters.duration === 'multi' ? tx('Multi-day') : tx('Day hikes'),
      on: liFilters.duration !== 'day',
      options: [
        { label: tx('Day hikes'), selected: liFilters.duration !== 'multi', pick(){ liFilters.duration = 'day'; } },
        { label: tx('Multi-day'), selected: liFilters.duration === 'multi', pick(){ liFilters.duration = 'multi'; } },
      ] },
    { key: 'dist', title: tx('Distance'),
      display: liFilters.dist === 'any' ? tx('Distance') : label(DIST_OPTS, liFilters.dist),
      on: liFilters.dist !== 'any',
      options: DIST_OPTS.map(([k, l]) => ({ label: l, selected: liFilters.dist === k, pick(){ liFilters.dist = k; } })) },
    { key: 'terrain', title: tx('Difficulty'),
      display: liFilters.terrain === 'any' ? tx('Difficulty') : label(TERRAIN_OPTS, liFilters.terrain),
      on: liFilters.terrain !== 'any',
      options: TERRAIN_OPTS.map(([k, l]) => ({ label: l, selected: liFilters.terrain === k, pick(){ liFilters.terrain = k; } })) },
    { key: 'shade', title: tx('Shade'),
      display: liFilters.shade === 'any' ? tx('Shade') : tx('{value} shade', { value:label(SHADE_OPTS, liFilters.shade) }),
      on: liFilters.shade !== 'any',
      options: SHADE_OPTS.map(([k, l]) => ({ label: l, selected: liFilters.shade === k, pick(){ liFilters.shade = k; } })) },
    { key: 'water', title: tx('Water'),
      display: liFilters.water ? tx('Water on route') : tx('Water'),
      on: liFilters.water,
      options: [
        { label: tx('Any'), selected: !liFilters.water, pick(){ liFilters.water = false; } },
        { label: tx('Water on route'), selected: liFilters.water, pick(){ liFilters.water = true; } },
      ] },
    { key: 'more', title: tx('More filters'),
      display: moreCount > 0 ? tx('More filters ({n})', { n:moreCount }) : tx('More filters'),
      on: moreCount > 0,
      groups: [
        { title: tx('Trail rating'), options: RISK_OPTS.map(([k, l]) => ({ label: l, selected: liFilters.risk === k, pick(){ liFilters.risk = k; } })) },
        { title: tx('Minimum match'), options: MATCH_OPTS.map(([k, l]) => ({ label: l, selected: liFilters.minMatch === k, pick(){ liFilters.minMatch = k; } })) },
      ] },
  ];

  wrap.innerHTML = '';
  chips.forEach(chip => {
    const holder = document.createElement('div');
    holder.className = 'li-menuwrap li-chipwrap' + (chip.key === 'more' ? ' li-chipwrap-more' : '');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'li-chip' + (chip.on ? ' on' : '');
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', String(liOpenChipKey === chip.key));
    btn.innerHTML = `${chip.display} <span class="li-caret" aria-hidden="true">▾</span>`;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      liOpenChipKey = liOpenChipKey === chip.key ? null : chip.key;
      renderLiChips();
    });
    holder.appendChild(btn);

    if(liOpenChipKey === chip.key){
      const menu = document.createElement('div');
      menu.className = 'li-menu li-chipmenu';
      const appendOption = (o) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'li-menu-item' + (o.selected ? ' li-chip-selected' : '');
        item.textContent = o.label;
        item.addEventListener('click', async () => {
          item.disabled = true;
          try {
            await o.pick();
            liOpenChipKey = null;
            renderReturningHomepage(currentProfileForAdjust);
          } catch(e) {
            showHomeActionStatus(tx('That filter could not be applied. Check your connection and try again.'));
          } finally {
            item.disabled = false;
          }
        });
        menu.appendChild(item);
      };
      if(chip.groups){
        chip.groups.forEach(group => {
          const kick = document.createElement('div');
          kick.className = 'li-menu-kick';
          kick.textContent = group.title;
          menu.appendChild(kick);
          group.options.forEach(appendOption);
        });
      } else {
        const kick = document.createElement('div');
        kick.className = 'li-menu-kick';
        kick.textContent = chip.title;
        menu.appendChild(kick);
        chip.options.forEach(appendOption);
      }
      holder.appendChild(menu);
    }
    wrap.appendChild(holder);
  });

  if(!liChipsOutsideWired){
    liChipsOutsideWired = true;
    document.addEventListener('click', (e) => {
      if(liOpenChipKey && !e.target.closest('.li-chipwrap')){
        liOpenChipKey = null;
        renderLiChips();
      }
    });
    document.addEventListener('keydown', (e) => {
      if(e.key === 'Escape' && liOpenChipKey){
        liOpenChipKey = null;
        renderLiChips();
      }
    });
  }
}

// Conditions card on the map, real profile-derived readings only (heat
// tolerance and paw/terrain tolerance from the same overrides the scorer
// uses, plus today's great-match count). No invented weather.
function renderLiConditionsCard(profile, displayList){
  const card = document.getElementById('liConditionsCard');
  if(!card) return;
  if(!profile){ card.hidden = true; return; }

  const overrides = effectiveOverrides(profile, null);
  const name = profile.name || tx('Your dog');
  // Desktop card: "{dog}'s conditions". The phone pill shows just the
  // dog's name, the greeting lives above the search bar there, and
  // "Eddie's conditions" read oddly as a map title. Both spans render;
  // CSS picks one per layout, so re-renders stay safe.
  const condTitle = document.getElementById('liCondTitle');
  condTitle.innerHTML = '<span class="li-cond-t-desk"></span><span class="li-cond-t-mobile"></span>';
  condTitle.querySelector('.li-cond-t-desk').textContent = tx('{name}\'s conditions', { name });
  condTitle.querySelector('.li-cond-t-mobile').textContent = name;
  document.getElementById('liCondSub').textContent =
    tx('{place} · today', { place:liSelectedGeographyLabel() });
  liFillAvatar(document.getElementById('liCondAvatar'), profile);

  const great = (displayList || []).filter(x => x.score >= 85).length;
  const tiles = [
    // The band above states the day. A tile reading "Good" underneath it while
    // heat is rising would contradict it on the same screen, so today's area
    // reading is folded in alongside the dog's own sensitivity.
    (function(){
      const today = window.DoloPawsHomeConditions && typeof window.DoloPawsHomeConditions.band === 'function'
        ? window.DoloPawsHomeConditions.band() : null;
      const hot = today && today.tone === 'high';
      const warm = today && today.tone === 'moderate';
      return (hot || (warm && overrides.heatSensitive) || overrides.heatSensitive)
        ? { v: tx('Watch'), c: '#8A5A16', l: tx('Heat') }
        : { v: tx('Good'), c: '#2C5C34', l: tx('Heat') };
    })(),
    overrides.terrain === '0'
      ? { v: tx('Tender'), c: '#8A5A16', l: tx('Paws') }
      : { v: tx('Good'), c: '#2C5C34', l: tx('Paws') },
    { v: String(great), c: '#2E4034', l: great === 1 ? tx('Great fit') : tx('Great fits') },
  ];
  document.getElementById('liCondTiles').innerHTML = tiles.map(ti =>
    `<div class="li-cond-tile"><b style="color:${ti.c};">${ti.v}</b><small>${ti.l}</small></div>`).join('');
  card.hidden = false;
}

// One-time event wiring for the shell chrome (menus, search, logout…).
// Bell badge from the derived feed (saved-trail advisories, audits, profile
// events) minus the durable read list. The notification centre resolves all
// items it displays, so a refresh cannot recreate their badge. Runs at shell
// init and again once favorites have loaded, since advisories depend on them.
function liReadList(){
  try {
    const read = JSON.parse(localStorage.getItem('dolopaws-notif-seen') || '[]');
    const list = Array.isArray(read) ? read : [];
    // One-time migration for people who opened the old centre: a glance meant
    // the bell was resolved, so preserve that intent in the unified state.
    const legacy = JSON.parse(localStorage.getItem('dolopaws-notif-glanced') || '[]');
    if(Array.isArray(legacy)) legacy.forEach(id => { if(!list.includes(id)) list.push(id); });
    localStorage.setItem('dolopaws-notif-seen', JSON.stringify(list));
    localStorage.removeItem('dolopaws-notif-glanced');
    return list;
  } catch(e){}
  return [];
}
function refreshLiBellBadge(){
  const dot = document.getElementById('liBellDot');
  let bellUnread = 0;
  try {
    if(window.DoloPawsNotifFeed && typeof trails !== 'undefined'){
      const feed = window.DoloPawsNotifFeed.build({
        trails, favorites: currentFavorites || {}, now: Date.now()
      });
      const read = window.DoloPawsNotifFeed.migrateReadIds(feed, liReadList());
      localStorage.setItem('dolopaws-notif-seen', JSON.stringify(read));
      bellUnread = window.DoloPawsNotifFeed.badgeCount(feed, read);
      localStorage.setItem('dolopaws-notif-unread', String(bellUnread));
      window.dispatchEvent(new CustomEvent('dolopaws-notifications-changed', {
        detail:{ unread:bellUnread }
      }));
    }
  } catch(e){}
  if(dot) dot.hidden = bellUnread === 0;
  refreshLiBellBadgeLive();
}

// Second pass with the Firestore content (hazard flags on saved trails,
// operator notices) once per page view, the sync pass above painted the
// derived-only count immediately.
let liBellLiveFetchKey = null;
let liBellLiveRequest = 0;
function refreshLiBellBadgeLive(){
  const auth = window.DoloPawsAuth;
  const community = window.DoloPawsCommunity;
  if(!auth || !auth.currentUser || !community || !window.DoloPawsNotifFeed) return;
  if(typeof community.getActiveFlagsForTrails !== 'function') return;
  const favoriteIds = Object.keys(currentFavorites || {}).sort();
  const fetchKey = favoriteIds.join('|');
  if(fetchKey === liBellLiveFetchKey) return;
  liBellLiveFetchKey = fetchKey;
  const requestId = ++liBellLiveRequest;
  Promise.all([
    community.getActiveFlagsForTrails(favoriteIds).catch(() => []),
    community.getSiteNotices().catch(() => []),
    typeof community.getNotifSeen === 'function' ? community.getNotifSeen().catch(() => []) : Promise.resolve([]),
  ]).then(([hazardFlags, siteNotices, remoteRead]) => {
    if(requestId !== liBellLiveRequest) return;
    const read = liReadList();
    if(Array.isArray(remoteRead)) remoteRead.forEach(id => { if(!read.includes(id)) read.push(id); });
    try { localStorage.setItem('dolopaws-notif-seen', JSON.stringify(read)); } catch(e){}
    const feed = window.DoloPawsNotifFeed.build({
      trails: typeof trails !== 'undefined' ? trails : [],
      favorites: currentFavorites || {},
      hazardFlags, siteNotices, now: Date.now()
    });
    const migratedRead = window.DoloPawsNotifFeed.migrateReadIds(feed, read);
    try { localStorage.setItem('dolopaws-notif-seen', JSON.stringify(migratedRead)); } catch(e){}
    const unread = window.DoloPawsNotifFeed.badgeCount(feed, migratedRead);
    try { localStorage.setItem('dolopaws-notif-unread', String(unread)); } catch(e){}
    const dot = document.getElementById('liBellDot');
    if(dot) dot.hidden = unread === 0;
    window.dispatchEvent(new CustomEvent('dolopaws-notifications-changed', { detail:{ unread } }));
  });
}

window.addEventListener('dolopaws-notifications-changed', (event) => {
  const unread = Number(event.detail && event.detail.unread) || 0;
  const dot = document.getElementById('liBellDot');
  if(dot) dot.hidden = unread === 0;
});

function initLoggedInShell(){
  if(liShellWired) return;
  const filtersBtn = document.getElementById('liFiltersBtn');
  if(!filtersBtn) return;
  liShellWired = true;

  const recommendationDate = document.getElementById('liRecommendationDate');
  if(recommendationDate) recommendationDate.addEventListener('change', () => {
    liCloseMenus();
    liSetWalkDate(recommendationDate.value);
  });
  // The place and the day in the headline are rebuilt on every render, so
  // they are wired once here rather than on each button.
  const toolbarEl = document.getElementById('liToolbar');
  if(toolbarEl) toolbarEl.addEventListener('click', (e) => {
    const head = e.target.closest('button[data-li-head]');
    if(head){
      e.stopPropagation();
      liToggleHeadMenu(head);
      return;
    }
    const day = e.target.closest('[data-li-day]');
    if(day){
      liCloseMenus();
      liSetWalkDate(liDateOffsetIso(Number(day.dataset.liDay)));
    }
  });
  ['liAreaMenu', 'liDayMenu'].forEach(id => {
    const menu = document.getElementById(id);
    if(menu) menu.addEventListener('click', e => {
      if(!e.target.closest('[data-li-day]')) e.stopPropagation();
    });
  });
  liWireAreaPickers();
  const changeLocation = document.getElementById('liChangeLocationBtn');
  if(changeLocation) changeLocation.addEventListener('click', liFocusSearchForPlace);
  document.querySelectorAll('[data-li-region]').forEach(button => {
    button.addEventListener('click', () => {
      liCloseMenus();
      liSetLocationContext(liRegionContext(button.dataset.liRegion));
    });
  });
  const showAllButton = document.getElementById('liShowAllTrails');
  if(showAllButton) showAllButton.addEventListener('click', () => {
    liCloseMenus();
    if(showAllButton.dataset.mode === 'back') liBackFromAllTrails();
    else liShowAllTrails();
  });
  const nudgeButton = document.getElementById('liLocationNudgeBtn');
  if(nudgeButton) nudgeButton.addEventListener('click', liRequestCurrentLocation);
  const nudgeDismiss = document.getElementById('liLocationNudgeDismiss');
  if(nudgeDismiss) nudgeDismiss.addEventListener('click', liDismissLocationNudge);
  // "All trails" needed no new home: "Show all" beside the location summary is
  // the same act. "Near me" did -- the band that offers it can be dismissed for
  // the session, and Explore was the only way back. It now sits with the other
  // scope controls, and asking for it on purpose undoes a past dismissal so the
  // band can return if the permission is later revoked.
  const nearMe = document.getElementById('liNearMeBtn');
  if(nearMe) nearMe.addEventListener('click', () => {
    liCloseMenus();
    try{ localStorage.removeItem(LI_LOCATION_NUDGE_DISMISSED_KEY); }catch(error){}
    liRequestCurrentLocation();
  });

  const wireMenu = (btn, menu) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const willOpen = menu.hidden;
      liCloseMenus();
      menu.hidden = !willOpen;
      btn.setAttribute('aria-expanded', String(willOpen));
    });
    menu.addEventListener('click', e => e.stopPropagation());
  };
  wireMenu(filtersBtn, document.getElementById('liFiltersMenu'));
  const newBtn = document.getElementById('liNewBtn');
  const newMenu = document.getElementById('liNewMenu');
  if(newBtn && newMenu) wireMenu(newBtn, newMenu);
  // Recently viewed moved under the dog pill, so it is filled when that opens.
  const accountBtn = document.getElementById('liAccountBtn');
  wireMenu(accountBtn, document.getElementById('liAccountMenu'));
  if(accountBtn) accountBtn.addEventListener('click', liRenderRecentTrails);

  // Saved / All are views of the ranked list, wired as tabs beside Sort.
  const setSavedView = (saved) => {
    if(showingSavedOnly === saved) return;
    showingSavedOnly = saved;
    renderReturningHomepage(currentProfileForAdjust);
  };
  const viewAll = document.getElementById('liViewAll');
  const viewSaved = document.getElementById('liViewSaved');
  if(viewAll) viewAll.addEventListener('click', () => setSavedView(false));
  // One button, pressed or not: Saved on, then back to every match.
  if(viewSaved) viewSaved.addEventListener('click', () => setSavedView(!showingSavedOnly));

  const wireQuickFilter = (id, toggle) => {
    const button = document.getElementById(id);
    if(button) button.addEventListener('click', () => {
      toggle();
      renderReturningHomepage(currentProfileForAdjust);
    });
  };
  wireQuickFilter('liQuickShade', () => { liFilters.shade = liFilters.shade === '60' ? 'any' : '60'; });
  wireQuickFilter('liQuickWater', () => { liFilters.water = !liFilters.water; });

  // Greeting avatar = the same Switch dog panel, anchored under the avatar.
  const greetBtn = document.getElementById('liGreetSwitchBtn');
  const greetMenu = document.getElementById('liGreetSwitchMenu');
  if(greetBtn && greetMenu) wireMenu(greetBtn, greetMenu);
  const greetAdd = document.getElementById('liGreetAddDogBtn');
  if(greetAdd) greetAdd.addEventListener('click', () => {
    const addBtn = document.getElementById('liAddDogBtn');
    liCloseMenus();
    if(addBtn) addBtn.click();
  });

  // Keep discovery map-first: the same top-right control collapses and
  // restores the ranked-results panel, so it never moves between states.
  const collapseBtn = document.getElementById('liCollapseTrailsBtn');
  const liBody = document.querySelector('#returningCustomerHomepage .li-body');
  const setTrailsCollapsed = (collapsed) => {
    if(!liBody) return;
    liBody.classList.toggle('list-collapsed', collapsed);
    if(collapseBtn){
      collapseBtn.setAttribute('aria-expanded', String(!collapsed));
      collapseBtn.setAttribute('aria-label', collapsed ? tx('Expand ranked trails panel') : tx('Collapse ranked trails panel'));
      collapseBtn.textContent = collapsed ? '☰ ' + tx('Show trails') : '⇥';
      collapseBtn.title = collapsed ? '' : tx('Hide the trail list');
    }
    if(trailMapInstance) requestAnimationFrame(() => trailMapInstance.resize());
  };
  if(collapseBtn) collapseBtn.addEventListener('click', () => {
    setTrailsCollapsed(!liBody.classList.contains('list-collapsed'));
  });

  // Notification bell opens the full notification centre from the design.
  const bellBtn = document.getElementById('liBellBtn');
  const bellMenu = document.getElementById('liBellMenu');
  if(bellBtn && bellMenu){
    refreshLiBellBadge();
    bellMenu.hidden = true;
    bellBtn.setAttribute('aria-haspopup', 'false');
    bellBtn.addEventListener('click', () => { window.location.href = 'notifications.html'; });
  }

  document.addEventListener('click', liCloseMenus);
  document.addEventListener('click', (event) => {
    if(!event.target.closest('.li-search')) hideLiSearchSuggestions();
  });
  document.addEventListener('keydown', (e) => { if(e.key === 'Escape') liCloseMenus(); });
  document.addEventListener('keydown', (e) => {
    if((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'){
      e.preventDefault();
      const search = document.getElementById('liSearch');
      if(search) search.focus();
    }
  });

  const search = document.getElementById('liSearch');
  const suggestions = document.getElementById('liSearchSuggest');
  if(search){
    // The search box is the geography control now: typing narrows the ranked
    // list itself (liQuery), not just the typeahead popover. Debounce the list
    // repaint so every keystroke stays cheap; suggestions update immediately.
    let searchTimer = null;
    search.addEventListener('input', () => {
      renderLiSearchSuggestions(currentProfileForAdjust);
      const value = search.value.trim();
      if(searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        if(value === liQuery.trim()) return;
        liQuery = search.value;
        renderReturningHomepage(currentProfileForAdjust);
      }, 160);
    });
    search.addEventListener('focus', () => {
      liEnsureAreaChoices();
      renderLiSearchSuggestions(currentProfileForAdjust);
    });
    search.addEventListener('keydown', (event) => {
      if(event.key === 'Enter'){
        // Enter on an arrowed-into suggestion opens that trail; a plain Enter
        // just commits the text as a list filter and dismisses the popover.
        const options = suggestions && !suggestions.hidden
          ? Array.from(suggestions.querySelectorAll('[role="option"]')) : [];
        const active = options.findIndex(option => option.classList.contains('active-nav'));
        event.preventDefault();
        if(active >= 0){ options[active].click(); return; }
        if(searchTimer) clearTimeout(searchTimer);
        liQuery = search.value;
        hideLiSearchSuggestions();
        renderReturningHomepage(currentProfileForAdjust);
        return;
      }
      if(!suggestions || suggestions.hidden) return;
      const options = Array.from(suggestions.querySelectorAll('[role="option"]'));
      if(!options.length) return;
      let active = options.findIndex(option => option.classList.contains('active-nav'));
      if(event.key === 'ArrowDown' || event.key === 'ArrowUp'){
        event.preventDefault();
        active = event.key === 'ArrowDown'
          ? (active + 1) % options.length
          : (active <= 0 ? options.length - 1 : active - 1);
        options.forEach((option, index) => option.classList.toggle('active-nav', index === active));
        options[active].scrollIntoView({ block:'nearest' });
      } else if(event.key === 'Escape'){
        hideLiSearchSuggestions();
      }
    });
  }

  const reset = document.getElementById('liFiltersReset');
  if(reset) reset.addEventListener('click', liResetAllFilters);
  const apply = document.getElementById('liFiltersApply');
  if(apply) apply.addEventListener('click', liCloseMenus);

  const addDog = document.getElementById('liAddDogBtn');
  if(addDog) addDog.addEventListener('click', () => {
    liCloseMenus();
    // Signed-in additions use the account editor: one form, one validation
    // contract and one persistence path. The homepage wizard remains the
    // guest preview flow only.
    window.location.assign('account.html?mode=add&next=%2F');
  });

  const logoutBtn = document.getElementById('liLogoutBtn');
  if(logoutBtn) logoutBtn.addEventListener('click', async () => {
    liCloseMenus();
    if(liDevView){ window.location.href = '/'; return; }
    window.location.href = 'account.html?logout=1';
  });

  const intent = liConsumeExploreIntent();
  if(intent === 'near') window.DoloPawsHomepageLocation.nearMe();
  else if(intent === 'all') window.DoloPawsHomepageLocation.showAll();
  else liProbeLocationPermission();
}

function hideLiSearchSuggestions(){
  const search = document.getElementById('liSearch');
  const suggestions = document.getElementById('liSearchSuggest');
  if(suggestions){ suggestions.hidden = true; suggestions.innerHTML = ''; }
  if(search) search.setAttribute('aria-expanded', 'false');
}

function liEscapeHtml(value){
  return String(value == null ? '' : value).replace(/[&<>"']/g, character => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[character]));
}

/**
 * A town, valley, region or country offered here is a place to look, not a
 * trail to open: choosing one becomes the location context and the list
 * re-ranks around it. Places lead, because that is what the location gate
 * used to ask for and the only thing a trail name cannot express.
 */
function liRenderPlaceOptions(host, places, kicker){
  if(kicker && places.length){
    const head = document.createElement('div');
    head.className = 'li-search-kick';
    head.textContent = kicker;
    host.appendChild(head);
  }
  places.forEach(choice => {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'li-search-option li-search-place';
    option.setAttribute('role', 'option');
    option.setAttribute('aria-selected', 'false');
    option.innerHTML = `<span class="li-search-option-copy"><strong>${liEscapeHtml(liShownPlaceLabel(choice.label))}</strong><small>${liEscapeHtml(liPlaceChoiceDetail(choice))}</small></span><span class="li-search-place-tag">${tx('Place')}</span>`;
    option.addEventListener('click', () => {
      hideLiSearchSuggestions();
      liSetLocationContext(choice);
    });
    host.appendChild(option);
  });
}

function renderLiSearchSuggestions(profile){
  const search = document.getElementById('liSearch');
  const suggestions = document.getElementById('liSearchSuggest');
  if(!search || !suggestions || typeof trails === 'undefined') return;
  const query = search.value.trim().toLowerCase();
  // "Change" opens this box with nothing typed, which used to offer nothing:
  // a place picker that asks you to already know the name of the place. What
  // the map is showing is the one list it can offer without being told, and
  // it is the list someone who just zoomed somewhere actually wants.
  if(!query){
    const inView = liAreasInView(4);
    if(!inView.length){ hideLiSearchSuggestions(); return; }
    suggestions.innerHTML = '';
    liRenderPlaceOptions(suggestions, inView, tx('On the map right now'));
    suggestions.hidden = false;
    search.setAttribute('aria-expanded', 'true');
    return;
  }
  const overrides = profile ? effectiveOverrides(profile, adjustOverride) : guestOverrides();
  const matches = filterTrailsForLocationContext(trails)
    .filter(trail => liTrailIsInSelectedGeography(trail, true))
    .filter(trail => liTrailSearchText(trail).includes(query))
    .map(trail => ({ ...trail, score:recommendTrail(trail, overrides, liConditionsFor(trail)).score }))
    .sort((a, b) => b.score - a.score || a.distance - b.distance)
    .slice(0, 6);

  suggestions.innerHTML = '';
  // A town, valley, region or country typed here is a place to look, not a
  // trail to open: choosing one becomes the location context and the list
  // re-ranks around it. Places lead, because that is what the gate used to
  // ask for and the only thing a trail name cannot express.
  liEnsureAreaChoices();
  const places = liPlaceChoicesFor(query);
  liRenderPlaceOptions(suggestions, places);
  if(!matches.length){
    if(!places.length) suggestions.innerHTML = '<div class="li-search-empty">' + tx('No trails or places found.') + '</div>';
  } else {
    matches.forEach((trail, index) => {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'li-search-option' + (index === 0 ? ' active' : '');
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', String(index === 0));
      const tier = liMatchTier(trail.score);
      option.innerHTML = `<span class="li-search-option-copy"><strong>${liEscapeHtml(trailDisplayName(trail))}</strong><small>${liEscapeHtml([trail.valley, `${localNum(trail.distance)} km`].filter(Boolean).join(' · '))}</small></span><span class="li-search-option-match" style="color:${tier.color}">${liEscapeHtml(tier.label)}</span>`;
      option.addEventListener('click', () => {
        search.value = trailDisplayName(trail);
        hideLiSearchSuggestions();
        warmTrailDetail(trail);
        // A search result is a destination, not just a map-focus control.
        // Always use the dynamic detail route so catalogue trails that do not
        // have a generated static HTML page (for example the Rasa/Odle route)
        // open exactly like trails selected from the Trails page.
        window.location.href = liTrailHref(trail.id);
      });
      suggestions.appendChild(option);
    });
  }
  suggestions.hidden = false;
  search.setAttribute('aria-expanded', 'true');
}

// Match column shared by list rows and the map preview card. Tier steps
// mirror the map pins (85 great / 65 good) and the map legend's colours.
// Shade in the words the design asks for, but only where those words are a
// caution. Every trail carrying a shade figure is unreviewed for the heat
// category: 23 hold a value and none is curated. SCORING.md settles that case
// already, and this follows it rather than inventing a second rule. A warning
// still shows, because suppressing one for want of a review hides a real
// hazard. Reassurance does not, because "substantial shade" on a route nobody
// has reviewed reads as a promise when it only means nobody looked.
//
// Bands are the engine's own (trail.shade.very-low, .low, .good), so a card and
// a score cannot describe the same route differently.
function liShadeLabel(shade){
  if(!Number.isFinite(shade)) return null;
  if(shade < 20) return tx('little shade');
  if(shade < 40) return tx('limited shade');
  return tx('{n}% shade', { n:shade });
}

// Exposure under the same rule as shade, and it is the doc's own example:
// "no exposed section is recorded" reads as a safety claim when it only means
// nobody looked. So true is stated and false is not. Only 3 trails carry true
// and none is curated, but exposure is the heaviest caution the engine has --
// 30 points, 40 for a fragile or vision-impaired dog -- so those 3 are exactly
// the cards that should say it.
function liExposureLabel(exposure){
  return exposure === true ? tx('exposed') : null;
}

// Row meta per the design TrailRow: "7.5 km · 150 m climb · 2–2.5 h · little shade"
// Cautions follow the measured facts, gravest first.
function liRowMeta(t){
  // A one-way walk is shown, and scored, the way its source gives it: one way,
  // and says so, unless the reader picked there and back (route-return.js).
  const routeReturn = window.ORMARouteReturn;
  const oneWayWalk = !!(routeReturn && routeReturn.isOneWay(t));
  const shown = oneWayWalk ? routeReturn.forView(t) : t;
  const back = shown !== t;
  const tr = (key, fallback) => { const v = window.t ? window.t(key, { km:localNum(shown.distance) }) : ''; return v && v !== key ? v : fallback; };
  const parts = [back ? tr('card.thereAndBack', `${localNum(shown.distance)} km there and back`)
    : oneWayWalk ? tr('card.oneWay', `${localNum(t.distance)} km one way`) : `${localNum(t.distance)} km`];
  if(Number.isFinite(shown.elevation)) parts.push(tx('{m} m climb', { m:shown.elevation }));
  if(shown.hours) parts.push(`${back ? '≈ ' : ''}${routeReturn ? localNum(routeReturn.formatDuration(shown.hours)) : `${localNum(shown.hours)} h`}`);
  const exposure = liExposureLabel(t.exposure);
  if(exposure) parts.push(exposure);
  const shade = liShadeLabel(t.shadeCoverage);
  if(shade) parts.push(shade);
  return parts.join(' · ');
}

// One vocabulary, from match-verdict.js. This used to say "Great match" at 85
// and "Good" at 65 while the list below it said "Possible with cautions" at 60,
// so the same trail answered differently in the dropdown and in the results.
//
// The fallback was a copy of the table, kept for a page that failed to load
// the module -- a page with bigger problems than a missing label, and a copy
// free to disagree with the original the moment either changed. Where the
// words are unavailable the honest output is no words, not a guess at them.
function liMatchTier(score){
  const verdict = window.OrmaMatchVerdict;
  return verdict ? verdict.verdictFor(score) : { color:'inherit', label:'' };
}
function liPersonalisationText(value){
  return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[ch]));
}

function liRecommendationPresentation(trail, profile){
  const recommendation = trail && trail.recommendation ? trail.recommendation : {};
  const score = Number.isFinite(recommendation.score) ? recommendation.score
    : Number.isFinite(trail && trail.score) ? trail.score : 0;
  const verdict = window.OrmaMatchVerdict;
  // 'recommended' is the engine's older name for the same verdict.
  const declared = recommendation.category === 'recommended' ? 'strong-option' : recommendation.category;
  const category = verdict
    ? verdict.verdictFor({ score, category: declared })
    : { label:'', color:'inherit' };
  // The level, not words for it: match-verdict.js owns both the wording and
  // the rule about when it is worth saying. This file used to hold a third
  // vocabulary for the same field -- "High confidence / Moderate confidence /
  // Limited data" -- with no dictionary keys, so it stayed English whatever
  // language the reader had chosen.
  const confidence = recommendation.confidence || '';
  const evidenceTier = recommendation.evidenceTier || (trail && trail.curated === false ? 'imported' : 'route-audited');
  // And the tier's words come from trust/evidence-v1.js. The fallback here was
  // a copy of that table, free to drift from it the moment either changed.
  const provenance = window.DoloPawsEvidenceV1 && typeof window.DoloPawsEvidenceV1.tierLabel === 'function'
    ? window.DoloPawsEvidenceV1.tierLabel(evidenceTier)
    : '';
  const checkedAt = trail && (trail.reviewedAt || (trail.verified && trail.verified.date));
  let checkedLabel = '';
  if(/^\d{4}-\d{2}-\d{2}$/.test(String(checkedAt || ''))){
    const checkedDate = new Date(`${checkedAt}T00:00:00Z`);
    if(!Number.isNaN(checkedDate.getTime())){
      checkedLabel = `Checked ${checkedDate.toLocaleDateString(undefined, {
        day:'numeric', month:'short', year:'numeric', timeZone:'UTC',
      })}`;
    }
  }
  return { ...category, confidence, provenance, checkedLabel, dogName:liScoredSubject(profile) };
}
/**
 * Whose score this is. A reader with no dog is scored against a default, and
 * every list surface used to call that default "your dog" -- a claim of
 * personalisation that did not happen, on the one number the reader is meant
 * to trust. recommendation-decision.js already had the honest word for it, and
 * trail.html already used it; this is the same word, in the same places the
 * verdict appears.
 */
function liScoredSubject(profile){
  if(profile && profile.name) return profile.name;
  return liT('recommendation.subject.guest', 'a medium dog');
}

/**
 * A link to a trail that carries the plan the reader made to get here: the
 * list they were looking at, and the day they were looking at it for.
 *
 * Without `from`, the trail page's breadcrumb reads "All trails" and going
 * back means finding the ranked list, the map view and the date again. Without
 * `date` the page answers for today, so a walk planned for Saturday was read
 * against Thursday's heat and Thursday's daylight -- a different question,
 * asked silently.
 */
function liTrailHref(trailId){
  const query = [`id=${encodeURIComponent(trailId)}`];
  if(liWalkDate && liWalkDate !== liDateOffsetIso(0)) query.push(`date=${encodeURIComponent(liWalkDate)}`);
  const here = `${window.location.pathname || ''}${window.location.search || ''}`;
  if(here) query.push(`from=${encodeURIComponent(here)}`);
  return `trail.html?${query.join('&')}`;
}

function liMatchColHtml(t, profile, overrides){
  const presentation = liRecommendationPresentation(t, profile);
  // Spoken, not shown: the level is a key, so the words come from its owner.
  // Reading "Strong option for Eddie. high." to a screen reader is what
  // interpolating the raw field would do.
  const verdict = window.OrmaMatchVerdict;
  const spokenConfidence = verdict
    ? verdict.confidenceLabel(presentation.confidence, window.t)
    : '';
  // No tooltip: it used to join the engine's raw sentences ("Terrain is within
  // this dog's effective tolerance...") over the card's own plain "Why it
  // fits" list, which every card with a verdict now carries.
  const spoken = [tx('{label} for {name}', { label:presentation.label, name:presentation.dogName }), spokenConfidence]
    .filter(Boolean).join('. ');
  return `<div class="li-match" aria-label="${liPersonalisationText(`${spoken}.`)}">
      <b style="color:${presentation.color};">${presentation.label}</b>
      <span class="li-match-lbl">${tx('For {name}', { name:liPersonalisationText(presentation.dogName) })}</span>
    </div>`;
}

// One line for how well a verdict is known: where the evidence came from, any
// caveat on it, and when it was checked. Confidence beside "Verified by ORMA"
// was the same statement twice, so evidenceLine decides when it is worth
// saying -- and with no vocabulary loaded there is nothing to say.
function liProvenanceHtml(trail, profile){
  const presentation = liRecommendationPresentation(trail, profile);
  const verdict = window.OrmaMatchVerdict;
  const qualifier = verdict
    ? verdict.evidenceLine({ confidence: presentation.confidence, translate: window.t }).trim()
    : '';
  const detail = [qualifier, presentation.checkedLabel].filter(Boolean)
    .map(text => `<span>${liPersonalisationText(text)}</span>`).join('');
  return `<div class="li-row-trust"><strong>${liPersonalisationText(presentation.provenance)}</strong>${detail}</div>`;
}

/**
 * Unknowns name their owner in their code: dog.* is a field the reader can
 * fill in right now, everything else is trail data nobody here can supply.
 * The wizard leaves weight, health and behaviour optional on purpose -- the
 * engine says what it does not know rather than guessing a value -- but until
 * now the homepage only stated the consequence ("Weight is missing, so size
 * adjustments are not applied") with no way to act on it. The trail page has
 * had the actionable version all along; this is the same one.
 */
function liDogGapFields(recommendation){
  return (recommendation.unknowns || [])
    .filter(entry => entry && typeof entry.code === 'string' && entry.code.startsWith('dog.'))
    .map(entry => entry.code.split('.')[1])
    .filter(Boolean);
}

/** Same contract as trail-recommendation.js's tr: translated, else the copy here. */
function liT(key, fallback, vars){
  if(typeof window.t === 'function'){
    const value = window.t(key, vars);
    if(value && value !== key) return value;
  }
  let output = fallback;
  for(const name of Object.keys(vars || {})) output = output.split(`{${name}}`).join(vars[name]);
  return output;
}

function liGapFieldList(fields){
  const labels = fields.map(field => liT(`recommendation.profileField.${field}`, field));
  if(labels.length <= 1) return labels.join('');
  return liT('recommendation.list.and', '{first} and {last}', {
    first:labels.slice(0, -1).join(', '),
    last:labels[labels.length - 1],
  });
}

/**
 * The engine writes one sentence per factor, in its own auditable vocabulary:
 * "Terrain is within this dog’s effective tolerance." then "The 3.6 km route
 * is within this dog’s effective range." Read together on a card they are the
 * same sentence three times with the nouns swapped, which is what makes them
 * sound machine-written rather than merely precise.
 *
 * recommendation-decision.js already solved this for the trail page. It
 * translates each factor by its code, and folds every positive that cost no
 * points into a single line -- "Fine for Eddie: the terrain, the 3.6 km
 * distance and the 462 m climb." The homepage renders that same view instead
 * of keeping a second, blunter copy of the reasoning.
 */
function liRecommendationView(trail, profile){
  const recommendation = trail && trail.recommendation;
  const decision = window.DoloPawsRecommendationDecision;
  if(!recommendation) return null;
  if(!decision) return null;
  return decision.present(recommendation, {
    translate: typeof window.t === 'function' ? window.t : null,
    dogName: profile && profile.name ? profile.name : '',
  });
}

// What "New for <dog>" means, said where it is shown: the badge's tooltip and
// the card's own explanation, so a phone, which has no tooltip, still gets it.
function liNewForMeaning(profile){
  return tx('It now scores {n}% or more for {name}, and it did not at your last visit.', { n:NEW_MATCH_THRESHOLD, name:liPersonalisationText(liScoredSubject(profile)) });
}

// "Why it fits Teo" above a card whose verdict says no contradicts it.
// Such a card asks why not, and lists what was fine as a plain fact.
function liIsNotRecommended(trail){
  return Boolean(trail && trail.recommendation && trail.recommendation.category === 'not-recommended');
}

function liWhyLabel(trail, dogName){
  return liIsNotRecommended(trail) ? tx('Why not for {name}', { name:dogName }) : tx('Why it fits {name}', { name:dogName });
}

function liRecommendationExplanationHtml(trail, profile, open, isNew = false, showGap = true){
  const recommendation = trail && trail.recommendation;
  const view = liRecommendationView(trail, profile);
  if(!view) return '';
  const dogName = liScoredSubject(profile);
  // One verdict line and the cautions under it. The card used to list "Why
  // it fits" beside "What to know today": five bullets of equal weight on one
  // side ("The terrain is manageable.") and, as often as not, a single line on
  // the other that had nothing to do with today. A card is skimmed in a list
  // of a dozen, so it now says the verdict in one sentence -- "Good for Teo:
  // 9.6 km, a gentle 170 m climb and water on the way." -- and the one or two
  // things to check. The trail page keeps the full row-by-row breakdown.
  // Two short lines: what fits, tagged "Fits", and the one thing to watch,
  // tagged "Watch". The trail page has the rest, so the card no longer counts
  // what it left out ("The trail page has one more").
  const facts = view.cardVerdict ? String(view.cardVerdict.facts || '') : '';
  const verdict = facts
    ? `<p class="li-answer-verdict"><span class="li-answer-tag is-fit">${tx('Fits')}</span><span>${liPersonalisationText(facts.charAt(0).toUpperCase() + facts.slice(1))}</span></p>`
    : '';
  // Cautions first (hard stops already lead them), then what is simply not
  // known, which is a different kind of statement and belongs after. Only
  // trail unknowns: a missing profile field becomes the prompt below, and
  // saying the same thing twice on one card reads as two problems. A strong
  // option says one; any other verdict says why it is not one, so two.
  // One thing to watch; a low match, which has no "Fits" line, says two.
  // Unknowns are not watch lines: "we haven't found the dog rules" on a site
  // where every walk takes dogs only adds doubt (owner, 19 Nov).
  const limit = recommendation && recommendation.category === 'not-recommended' ? 2 : 1;
  const concerns = view.cardCautions.slice(0, limit);
  const know = concerns
    .map(entry => `<p class="li-answer-check"><span class="li-answer-tag is-watch">${tx('Watch')}</span><span>${liPersonalisationText(entry)}</span></p>`).join('');
  const fresh = isNew
    ? `<p class="li-answer-new"><b>${tx('New for {name}.', { name:liPersonalisationText(dogName) })}</b> ${liNewForMeaning(profile)}</p>`
    : '';
  // Opens the wizard on the dog it is talking about, rather than sending the
  // reader to the account page to find it themselves.
  // Said once, on the first card, rather than as a third line on every card.
  const gapFields = showGap && profile && profile.name ? liDogGapFields(recommendation) : [];
  const gap = gapFields.length
    ? `<p class="li-answer-gap"><button type="button" class="li-answer-gap-btn" data-complete-dog>${
        liPersonalisationText(liT('recommendation.gap.fields', 'Add {name}\u2019s {fields} to sharpen this score \u2192', {
          name:dogName, fields:liGapFieldList(gapFields),
        }))}</button></p>`
    : '';
  // Every card carries this now, so the panel is addressed by its own id and
  // the card's toggle controls it. "Show on map" moved to the bar above, which
  // every card also has: two of the same button on one card is one too many.
  const panelId = `li-why-${encodeURIComponent(trail.id)}`;
  return `<div class="li-answer-explanation" id="${panelId}"${open ? '' : ' hidden'}>
    ${fresh}${verdict}${know}${gap}
    <div class="li-answer-actions">
      <a class="li-answer-open" href="${liTrailHref(trail.id)}">${tx('View trail details')}</a>
    </div>
  </div>`;
}

/** The control that opens the panel above, and the panel's own id. */
function liWhyPanelId(trailId){ return `li-why-${encodeURIComponent(trailId)}`; }

function liWhyToggleHtml(trail, profile, open){
  const dogName = liScoredSubject(profile);
  return `<button type="button" class="li-bar-act li-why-toggle" data-why-toggle aria-expanded="${open}" aria-controls="${liWhyPanelId(trail.id)}">` +
    `<span class="li-why-label">${open ? tx('Hide the reasons') : liPersonalisationText(liWhyLabel(trail, dogName))}</span>` +
    `<span class="li-why-caret" aria-hidden="true">▾</span></button>`;
}

function liScheduleNewMatchSync(scored, profile){
  const auth = window.DoloPawsAuth;
  const user = auth && auth.currentUser;
  if(!user || typeof auth.getLastMatches !== 'function' || typeof auth.setLastMatches !== 'function') return;
  const key = `${user.uid || 'signed-in'}|${profile && profile.id || 'active'}`;
  if(key === liNewMatchSyncKey) return;
  liNewMatchSyncKey = key;
  liNewMatchIds = new Set();
  const currentTopIds = scored.filter(trail => trail.score >= NEW_MATCH_THRESHOLD).map(trail => trail.id);
  liNewMatchSyncInFlight = Promise.resolve()
    .then(() => auth.getLastMatches())
    .then(previous => {
      if(key !== liNewMatchSyncKey) return;
      liNewMatchIds = Array.isArray(previous)
        ? new Set(currentTopIds.filter(id => !previous.includes(id)))
        : new Set();
      renderReturningHomepage(currentProfileForAdjust, { skipNewMatchSync:true });
      return auth.setLastMatches(currentTopIds);
    })
    .catch(error => console.warn('Could not refresh new-match history.', error))
    .finally(() => {
      if(key === liNewMatchSyncKey) liNewMatchSyncInFlight = null;
    });
}

// The forecast lands after the first paint. Without this the list keeps the
// order and the scores it had before the day was known.
if(typeof window !== 'undefined'){
  window.addEventListener('dolopaws-area-conditions-ready', () => {
    if(typeof currentProfileForAdjust !== 'undefined' && currentProfileForAdjust) renderReturningHomepage(currentProfileForAdjust);
  });
}

// The list's own empty state, with the way out it offers.
function liEmptyStateHtml(buttonId){
  const label = liSelectedGeographyLabel();
  const nearHere = liLocationContext && liLocationContext.kind === 'current' && !liQuery.trim() && liActiveFilterCount() === 0;
  const msg = showingSavedOnly
    ? t('home.noSaved')
    : (liQuery.trim() || liActiveFilterCount() > 0)
      ? tx('Try widening your search or filters.')
      : liLocationContext && liLocationContext.kind === 'current'
        ? tx('No ORMA trails within {km} km yet.', { km:liLocationContext.radiusKm })
        : t('home.noTrailsValley', {label});
  return {
    html: `
      <div class="li-empty">
        <div class="li-empty-title">${tx('No trails match')}</div>
        <p>${msg}</p>
        <button type="button" id="${buttonId}">${nearHere ? tx('Choose another area') : tx('Reset filters')}</button>
      </div>`,
    action: nearHere ? liResetLocationContext : liResetAllFilters,
  };
}

async function renderReturningHomepage(profile, options = {}){
  profile = liResolveActiveProfile(profile);
  const heading = document.getElementById('returningHeading');
  const listEl = document.getElementById('returningTrailList');
  if(!heading || typeof trails === 'undefined') return;

  renderLiSavedControl();
  renderDogProfileCard(profile);
  renderLiHeader(profile);
  refreshLiBellBadge();
  renderLiControls();
  liRenderLocationContext(profile);

  // Do not calculate, display, map, or remember a personalised match until
  // the owner has supplied an explicit geographic context.
  if(!liLocationContext){
    if(listEl) listEl.innerHTML = '';
    updateMapMarkers([]);
    return;
  }
  liEnsureLocationConditions();

  const name = (profile && profile.name) ? profile.name : 'there';
  const overrides = profile ? effectiveOverrides(profile, adjustOverride) : guestOverrides();
  liChairliftSafe = liProfileChairliftSafe(profile);


  const scored = trails.map(t => {
    const recommendation = recommendTrail(t, overrides, liConditionsFor(t));
    return {...t, score: recommendation.score, recommendation};
  }).sort((a,b) => b.score - a.score);
  if(listEl && window.DoloPawsScoring){
    listEl.dataset.scoringVersion = window.DoloPawsScoring.VERSION;
  }

  // Paint first. Match-history comparison is useful but non-critical, so it
  // runs after the page is interactive instead of blocking every mobile load.
  const newIds = liNewMatchIds;
  if(!options.skipNewMatchSync) liScheduleNewMatchSync(filterTrailsForLocationContext(scored), profile);

  const dayLabel = liWalkDateLabel();
  const locationPhrase = liRecommendationLocationPhrase();
  // The place phrase is empty for the whole catalogue, so the title is
  // assembled from its parts rather than templated around a blank.
  const answerTitle = [tx('Best walk'), profile && profile.name ? tx('for {name}', { name:profile.name }) : '', locationPhrase, dayLabel]
    .filter(Boolean).join(' ');
  heading.textContent = answerTitle;
  // No line under it: the headline names the scope itself ("in the
  // Dolomites", "near you").
  liRenderHeadline(profile, locationPhrase, dayLabel);
  // "N new matches since your last visit" used to head the list. It counted
  // trails now at NEW_MATCH_THRESHOLD or more that were not at the last
  // visit -- which the weather or a profile change can cause as easily as a
  // new trail -- so it said less than it seemed to. Each such card now says
  // "New for <dog>" and what that means.

  renderBreedInsight(profile);

  let displayList = filterTrailsForReturningView(scored);
  // The headline already says "Best walk for Teo…", so the list does not say
  // "Best matches for Teo" again: its label is how many, and beside it the
  // order they are in.
  const n = displayList.length;
  const titleEl = document.getElementById('companionListTitle');
  if(titleEl) titleEl.textContent = `${n} ${showingSavedOnly ? 'saved ' : ''}${n === 1 ? 'trail' : 'trails'}`;
  const countEl = document.getElementById('companionListCount');
  if(countEl) countEl.textContent = LI_SORT_ORDER_WORDS[sortKey] || LI_SORT_ORDER_WORDS.match;
  liSyncShowAllButton();

  renderLiConditionsCard(profile, displayList);


  // "Show N trails", the apply button doubles as the live result count.
  const applyBtn = document.getElementById('liFiltersApply');
  if(applyBtn) applyBtn.textContent = displayList.length === 1 ? tx('Show 1 trail') : tx('Show {count} trails', { count: displayList.length });

  if(!showingSavedOnly && displayList.length && !displayList.some(trail => trail.id === selectedTrailId)){
    selectedTrailId = displayList[0].id;
  }
  updateMapMarkers(displayList);
  if(!showingSavedOnly && displayList.length && trailMapLoaded) setSelectedTrailRoute(displayList[0], { fit:false });

  // Reset to page 1 whenever the filters change; clamp if the list shrank.
  const filterKey = `${liLocationContextLabel()}|${activeCountry}|${activeRegion}|${activeValley}|${showingSavedOnly}|${liInSeasonOnly}|${liQuery}|${JSON.stringify(liFilters)}|${sortKey}`;
  if (filterKey !== lastFilterKey){ currentPage = 1; lastFilterKey = filterKey; }
  const collapsed = !showFullList && !showingSavedOnly && displayList.length > TOP_MATCHES + 2;
  const totalPages = collapsed ? 1 : Math.max(1, Math.ceil(displayList.length / TRAILS_PER_PAGE));
  if (currentPage > totalPages) currentPage = totalPages;
  const pageList = collapsed
    ? displayList.slice(0, TOP_MATCHES)
    : displayList.slice((currentPage - 1) * TRAILS_PER_PAGE, currentPage * TRAILS_PER_PAGE);
  if(savedTrailsBtn){
    const savedLabel = savedTrailsBtn.querySelector('.txt-label');
    if(savedLabel) savedLabel.textContent = showingSavedOnly
      ? t('home.allTrailsBtn')
      : (profile && profile.name) ? tx('Saved for {name}', { name:profile.name }) : t('home.savedTrails');
    const savedCountEl = document.getElementById('companionSavedCount');
    if(savedCountEl) savedCountEl.textContent = Object.keys(currentFavorites).length;
    savedTrailsBtn.classList.toggle('active', showingSavedOnly);
  }

  if(displayList.length === 0){
    // Geography is now search/map, so the label is simply the current scope.
    const empty = liEmptyStateHtml('liEmptyReset');
    listEl.innerHTML = empty.html;
    const emptyReset = document.getElementById('liEmptyReset');
    if(emptyReset) emptyReset.addEventListener('click', empty.action);
    return;
  }

  const adjustActive = !!adjustOverride;
  const fitCount = displayList.filter(x => x.score >= 60).length;
  const summaryBar = adjustActive
    ? `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 14px;margin-bottom:12px;background:var(--sage-dim);border-radius:12px;font-size:12.5px;font-weight:600;color:var(--ink);">${t('home.fitLine', {a: fitCount, b: displayList.length})}</div>`
    : '';

  const resultRanks = new Map(displayList.map((trail, index) => [trail.id, index + 1]));

  listEl.innerHTML = summaryBar + pageList.map((t, index) => {
    const isFav = !!currentFavorites[t.id];
    const isNew = newIds.has(t.id);
    const dim = adjustActive && t.score < 60;
    const thumb = trailCardVisual(t, { className:'li-thumb photo', dataTrailId:t.id, clickable:true });
    const selected = t.id === selectedTrailId;
    const newBadge = isNew
      ? `<span class="li-new-for" title="${liEscapeHtml(liNewForMeaning(profile))}">${productBadge('new', tx('New for {name}', { name:liPersonalisationText(liScoredSubject(profile)) }))}</span>`
      : '';
    const rank = resultRanks.get(t.id) || index + 1;
    const isPrimary = !showingSavedOnly && index < TOP_PICKS;
    // Every card can explain itself; the top picks start open, because they
    // are the answer the page was asked for -- unless the reader has hidden
    // reasons with the switch in the list header.
    const startsOpen = isPrimary && !liReasonsHidden;
    const explanation = liRecommendationExplanationHtml(t, profile, startsOpen, isNew, index === 0);
    return `${isPrimary ? '' : index === TOP_PICKS && !showingSavedOnly ? `<div class="li-alternatives-heading"><span>${tx('Other options for {name}', { name:liPersonalisationText(liScoredSubject(profile)) })}</span><a href="browse-trails.html">${tx('See the full catalogue →')}</a></div>` : ''}
    <div class="li-row${selected ? ' tc-selected' : ''}${isPrimary ? ' li-row--answer' : ''}${explanation && startsOpen ? ' is-why-open' : ''}" id="trail-card-${t.id}" data-id="${t.id}" data-rank="${rank}" aria-label="${tx('Rank {rank}: {name}', { rank, name:liPersonalisationText(t.name) })}"${dim ? ' style="opacity:.55;"' : ''}>
      <span class="li-result-rank" aria-hidden="true" style="background:${liRecommendationPresentation(t, profile).color};">${rank}</span>
      ${thumb}
      <div class="li-row-body">
        <a href="${liTrailHref(t.id)}" class="li-row-name">${trailDisplayName(t)}</a>
        <div class="li-row-meta">${liRowMeta(t)}</div>
        ${newBadge ? `<div class="li-row-badges">${newBadge}</div>` : ''}
        ${liProvenanceHtml(t, profile)}
        <div class="li-rating-row"><span class="li-rating-kick">${tx('Trail rating')}</span><span class="safety-badge ${safetyClass(t.safetyLevel)}">${trailSafetyLabel(t)}</span></div>
      </div>
      ${liMatchColHtml(t, profile, overrides)}
      <button type="button" class="li-heart save-btn" data-id="${t.id}" aria-pressed="${isFav}" aria-label="${isFav ? tx('Remove {name} from saved trails', { name:trailDisplayName(t) }) : tx('Save {name}', { name:trailDisplayName(t) })}">${isFav ? '♥' : '♡'}</button>
      <div class="li-row-bar">
        ${explanation ? liWhyToggleHtml(t, profile, startsOpen) : ''}
        <button type="button" class="li-bar-act locate-btn" data-id="${t.id}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11Z"/><circle cx="12" cy="10" r="2"/></svg>${tx('See on map')}</button>
        ${directionsBarHtml(t)}
      </div>
      ${explanation}
    </div>`;
  }).join('');

  // Opening a card's reasons is reading, not navigating: it never leaves the
  // page and never changes the list, so it only moves its own panel.
  listEl.querySelectorAll('[data-why-toggle]').forEach(toggle => {
    toggle.addEventListener('click', event => {
      event.stopPropagation();
      const panel = document.getElementById(toggle.getAttribute('aria-controls'));
      if(!panel) return;
      const open = panel.hidden;
      panel.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      const card = toggle.closest('.li-row');
      if(card) card.classList.toggle('is-why-open', open);
      const label = toggle.querySelector('.li-why-label');
      if(label){
        const row = toggle.closest('.li-row');
        const trail = trails.find(item => row && item.id === row.dataset.id);
        // The scored copy carries the verdict the label has to match.
        const scored = pageList.find(item => row && item.id === row.dataset.id) || trail;
        const dogName = liScoredSubject(profile || currentProfileForAdjust);
        label.textContent = open ? tx('Hide the reasons') : liWhyLabel(scored, dogName);
        if(open) warmTrailDetail(trail);
      }
    });
  });

  // Whole row opens the trail page, except clicks on the heart, links,
  // or the thumbnail (which locates the trail on the map instead).
  listEl.querySelectorAll('.li-row').forEach(row => {
    row.addEventListener('click', (e) => {
      if(e.target.closest('a, button, .photo')) return;
      const trail = trails.find(item => item.id === row.dataset.id);
      warmTrailDetail(trail);
      window.location.href = liTrailHref(row.dataset.id);
    });
    // Hovering a card highlights its pin on the map, and leaving restores the
    // selected trail's pin. Pointer-only, so it never fires on touch.
    row.addEventListener('mouseenter', () => setSelectedTrailPoint(row.dataset.id));
    row.addEventListener('mouseleave', () => setSelectedTrailPoint(selectedTrailId));
  });

  listEl.querySelectorAll('.li-row-name').forEach(link => {
    link.addEventListener('click', () => {
      const row = link.closest('.li-row');
      const trail = trails.find(item => row && item.id === row.dataset.id);
      warmTrailDetail(trail);
    });
  });

  listEl.querySelectorAll('.save-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const wasSaved = !!currentFavorites[id];
      const nextFavorites = { ...currentFavorites };
      if(wasSaved) delete nextFavorites[id];
      else nextFavorites[id] = true;
      btn.disabled = true;
      const saved = window.DoloPawsAuth
        ? await window.DoloPawsAuth.setFavorites(nextFavorites)
        : false;
      if(saved){
        currentFavorites = nextFavorites;
        renderReturningHomepage(profile);
        showHomeActionStatus(window.t(wasSaved ? 'save.removed' : 'save.added'));
      } else {
        btn.disabled = false;
        showHomeActionStatus(window.t('save.error'));
      }
    });
  });

  listEl.querySelectorAll('.photo[data-trail-id]').forEach(el => {
    el.addEventListener('click', () => {
      focusMapOnTrail(el.dataset.trailId, displayList);
    });
  });

  listEl.querySelectorAll('.locate-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      focusMapOnTrail(btn.dataset.id, displayList);
    });
  });

  // Opens the wizard on the dog the card is about, at the step holding the
  // field it named. Sending the reader to the account page to find the dog
  // themselves is how a one-line fix becomes a task nobody does.
  listEl.querySelectorAll('[data-complete-dog]').forEach(btn => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      const dog = liResolveActiveProfile(currentProfileForAdjust);
      if(window.DoloPawsWizard && typeof window.DoloPawsWizard.open === 'function'){
        window.DoloPawsWizard.open(dog || null, { returnToPage:true });
        return;
      }
      // Pages that never load the wizard still get somewhere useful.
      window.location.href = 'account.html';
    });
  });

  // Apple-device chooser: Get directions opens a two-app menu.
  listEl.querySelectorAll('.li-dir-toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const menu = btn.parentElement.querySelector('.li-dir-menu');
      const open = menu.hidden;
      listEl.querySelectorAll('.li-dir-menu').forEach(m => { m.hidden = true; });
      listEl.querySelectorAll('.li-dir-toggle').forEach(b => b.setAttribute('aria-expanded', 'false'));
      menu.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
    });
  });
  if(!listEl.dataset.dirMenuDismiss){
    listEl.dataset.dirMenuDismiss = '1';
    document.addEventListener('click', () => {
      listEl.querySelectorAll('.li-dir-menu').forEach(m => { m.hidden = true; });
      listEl.querySelectorAll('.li-dir-toggle').forEach(b => b.setAttribute('aria-expanded', 'false'));
    });
  }

  // Top-matches ↔ full-catalog toggle
  if(collapsed){
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'page-btn';
    more.style.cssText = 'display:block;margin:18px auto 0;';
    more.textContent = t('home.showAll', {n: displayList.length});
    more.addEventListener('click', () => { showFullList = true; currentPage = 1; renderReturningHomepage(profile); });
    listEl.appendChild(more);
  } else if(showFullList && !showingSavedOnly && displayList.length > TOP_MATCHES + 2){
    const less = document.createElement('button');
    less.type = 'button';
    less.style.cssText = 'display:block;margin:16px auto 0;background:none;border:none;color:var(--accent);font-size:12.5px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif;';
    less.textContent = t('home.showTop');
    less.addEventListener('click', () => { showFullList = false; currentPage = 1; renderReturningHomepage(profile); listEl.scrollIntoView({behavior:'smooth', block:'start'}); });
    listEl.appendChild(less);
  }

  // Pagination controls
  if (!collapsed && totalPages > 1){
    const nav = document.createElement('div');
    nav.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:14px;margin-top:18px;';
    const mkBtn = (label, disabled, delta) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.disabled = disabled;
      b.className = 'page-btn';
      if (!disabled) b.addEventListener('click', () => {
        currentPage += delta;
        renderReturningHomepage(profile);
        listEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      return b;
    };
    nav.appendChild(mkBtn(t('page.prev'), currentPage === 1, -1));
    const info = document.createElement('span');
    info.className = 'page-info';
    info.textContent = t('page.of', {a: currentPage, b: totalPages});
    nav.appendChild(info);
    nav.appendChild(mkBtn(t('page.next'), currentPage === totalPages, 1));
    listEl.appendChild(nav);
  }
}

// Destination-only handoff to a maps app. Apple devices get a two-option
// chooser (Apple Maps or Google Maps, many iPhone users prefer Google);
// everywhere else links straight to Google Maps, the only one of the two
// that exists there.
function trailheadCoords(t){
  return t.startPoint && Number.isFinite(t.startPoint.lat) && Number.isFinite(t.startPoint.lng)
    ? t.startPoint
    : (Number.isFinite(t.lat) && Number.isFinite(t.lng) ? { lat:t.lat, lng:t.lng } : null);
}

function directionsBarHtml(t){
  const sp = trailheadCoords(t);
  if(!sp) return '';
  const icon = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>';
  const google = `https://www.google.com/maps/dir/?api=1&destination=${sp.lat},${sp.lng}&travelmode=driving`;
  if(!/iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent)){
    return `<a class="li-bar-act" href="${google}" target="_blank" rel="noopener">${icon}${tx('Get directions')}</a>`;
  }
  const apple = `https://maps.apple.com/?daddr=${sp.lat},${sp.lng}`;
  return `<div class="li-dir-wrap">
    <button type="button" class="li-bar-act li-dir-toggle" aria-haspopup="true" aria-expanded="false">${icon}${tx('Get directions')}</button>
    <div class="li-dir-menu" hidden>
      <a href="${apple}" target="_blank" rel="noopener">Apple Maps</a>
      <a href="${google}" target="_blank" rel="noopener">Google Maps</a>
    </div>
  </div>`;
}

function focusMapOnTrail(trailId, list){
  if(!trailMapInstance) return;
  const t = list.find(x => x.id === trailId);
  if(!t) return;
  selectTrail(t);
  // On the phone layout the sheet covers the map, let it duck down.
  window.dispatchEvent(new CustomEvent('dolopaws-map-focus'));
  document.getElementById('trailMap').scrollIntoView({ behavior: 'smooth', block: 'center' });
  if(Array.isArray(t.path) && t.path.length > 1){
    const bounds = new maplibregl.LngLatBounds();
    t.path.forEach(([lat, lng]) => bounds.extend([lng, lat]));
    trailMapInstance.fitBounds(bounds, { padding: 60, maxZoom: 15 });
  } else if(typeof t.lat === 'number' && typeof t.lng === 'number'){
    trailMapInstance.flyTo({ center: [t.lng, t.lat], zoom: 13 });
  }
}

// Adjust-for-today panel wiring
const adjustToggle = document.getElementById('adjustToggle');
const adjustPanel = document.getElementById('adjustPanel');
const adjustCloseBtn = document.getElementById('adjustCloseBtn');
let currentProfileForAdjust = null;

// The Saved row opens the dedicated Saved screen (Companion structure).
const savedTrailsBtn = document.getElementById('savedTrailsBtn');
if(savedTrailsBtn){
  savedTrailsBtn.addEventListener('click', () => {
    window.location.href = 'saved.html';
  });
}

// "Hide reasons" in the list header: whether the top cards open with their
// reasons showing. A reading preference, so it is kept in this browser; each
// card's own toggle still opens or closes that card.
const LI_REASONS_HIDDEN_KEY = 'orma-home-reasons-hidden-v1';
let liReasonsHidden = (() => {
  try{ return localStorage.getItem(LI_REASONS_HIDDEN_KEY) === '1'; }catch(error){ return false; }
})();
function liSyncReasonsToggle(){
  const toggle = document.getElementById('liReasonsToggle');
  if(!toggle) return;
  toggle.setAttribute('aria-pressed', String(liReasonsHidden));
  const label = toggle.querySelector('.li-reasons-word');
  if(label) label.textContent = liReasonsHidden ? tx('Show reasons') : tx('Hide reasons');
}
const liReasonsToggle = document.getElementById('liReasonsToggle');
if(liReasonsToggle){
  liSyncReasonsToggle();
  liReasonsToggle.addEventListener('click', () => {
    liReasonsHidden = !liReasonsHidden;
    try{
      if(liReasonsHidden) localStorage.setItem(LI_REASONS_HIDDEN_KEY, '1');
      else localStorage.removeItem(LI_REASONS_HIDDEN_KEY);
    }catch(error){}
    liSyncReasonsToggle();
    renderReturningHomepage(currentProfileForAdjust);
  });
}

function liSyncInSeasonToggle(){
  const toggle = document.getElementById('liInSeason');
  if(toggle) toggle.setAttribute('aria-pressed', String(liInSeasonOnly));
}
const liInSeasonToggle = document.getElementById('liInSeason');
if(liInSeasonToggle){
  liInSeasonToggle.addEventListener('click', () => {
    liInSeasonOnly = !liInSeasonOnly;
    liSyncInSeasonToggle();
    renderReturningHomepage(currentProfileForAdjust);
  });
}

// Sort, one menu in the list header: Best fit / Shortest / Least climb /
// For today. The button names the choice; the menu ticks it.
const liSortBtn = document.getElementById('liSortBtn');
const liSortMenu = document.getElementById('liSortMenu');
if(liSortBtn && liSortMenu){
  liSortBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    const willOpen = liSortMenu.hidden;
    liCloseMenus();
    liSortMenu.hidden = !willOpen;
    liSortBtn.setAttribute('aria-expanded', String(willOpen));
  });
  liSortMenu.addEventListener('click', (event) => {
    event.stopPropagation();
    const option = event.target.closest('[data-li-sort]');
    if(!option) return;
    sortKey = option.dataset.liSort;
    liSortMenu.querySelectorAll('[data-li-sort]').forEach(item => {
      item.setAttribute('aria-checked', String(item === option));
    });
    const value = document.getElementById('liSortValue');
    if(value) value.textContent = option.textContent;
    liCloseMenus();
    liSortBtn.focus();
    renderReturningHomepage(currentProfileForAdjust);
  });
}

// Map pin / card selection callout, clears via the × on the callout.
const mapCalloutClose = document.getElementById('mapCalloutClose');
if(mapCalloutClose){
  mapCalloutClose.addEventListener('click', () => {
    selectedTrailId = null;
    hideMapCallout();
    document.querySelectorAll('#returningTrailList .tc-selected').forEach(c => c.classList.remove('tc-selected'));
    setSelectedTrailPoint(null);
    setSelectedTrailRoute(null, { fit:false });
  });
}
function warmTrailDetail(t){
  if(!t || !t.id) return;
  if(window.DoloPawsRegionalData && typeof window.DoloPawsRegionalData.primeTrailDetail === 'function'){
    window.DoloPawsRegionalData.primeTrailDetail(t);
    return;
  }
  try{
    sessionStorage.setItem('orma-trail-detail:' + t.id, JSON.stringify({ at:Date.now(), trail:t }));
  }catch(error){}
}
function placeMapCallout(){
  const callout = document.getElementById('mapCallout');
  const mapWrap = document.getElementById('trailMapWrap');
  if(!callout || !mapWrap) return;
  const mobileTarget = document.body.classList.contains('mhome-active');
  const target = mobileTarget ? document.body : mapWrap;
  if(callout.parentElement !== target) target.appendChild(callout);
}
window.addEventListener('dolopaws-mobile-layout-change', placeMapCallout);
function showMapCallout(t){
  const callout = document.getElementById('mapCallout');
  if(!callout) return;
  placeMapCallout();
  warmTrailDetail(t);
  const trailUrl = liTrailHref(t.id);
  const thumb = document.getElementById('mapCalloutThumb');
  if(thumb){
    thumb.innerHTML = trailCardVisual(t, { className:'li-thumb photo' });
    thumb.href = trailUrl;
    thumb.setAttribute('aria-label', tx('Open {name} trail details', { name:trailDisplayName(t) }));
  }
  const kickEl = document.getElementById('mapCalloutKick');
  if(kickEl) kickEl.textContent = [t.valley, t.area].filter(Boolean).join(' · ');
  const nameEl = document.getElementById('mapCalloutName');
  nameEl.textContent = trailDisplayName(t);
  nameEl.href = trailUrl;
  const metaEl = document.getElementById('mapCalloutMeta');
  if(metaEl) metaEl.textContent = liRowMeta(t);
  const ratingEl = document.getElementById('mapCalloutRating');
  if(ratingEl) ratingEl.innerHTML = `<span class="safety-badge ${safetyClass(t.safetyLevel)}">${trailSafetyLabel(t)}</span>`;
  const openEl = document.getElementById('mapCalloutOpen');
  if(openEl) openEl.href = trailUrl;
  // Directions is a destination-only handoff, same as the list rows: straight
  // to Google Maps, with a two-app chooser on Apple devices.
  const directionsEl = document.getElementById('mapCalloutDirections');
  const dirMenu = document.getElementById('mapCalloutDirMenu');
  if(directionsEl){
    const sp = trailheadCoords(t);
    const google = sp ? `https://www.google.com/maps/dir/?api=1&destination=${sp.lat},${sp.lng}&travelmode=driving` : '';
    const isApple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
    directionsEl.disabled = !sp;
    directionsEl.setAttribute('aria-expanded', 'false');
    if(dirMenu){
      dirMenu.hidden = true;
      const appleA = document.getElementById('mapCalloutDirApple');
      const googleA = document.getElementById('mapCalloutDirGoogle');
      if(appleA && sp) appleA.href = `https://maps.apple.com/?daddr=${sp.lat},${sp.lng}`;
      if(googleA && sp) googleA.href = google;
    }
    directionsEl.onclick = (e) => {
      if(!sp) return;
      if(!isApple || !dirMenu){
        window.open(google, '_blank', 'noopener');
        return;
      }
      e.stopPropagation();
      const open = dirMenu.hidden;
      dirMenu.hidden = !open;
      directionsEl.setAttribute('aria-expanded', String(open));
    };
    if(!document.body.dataset.calloutDirDismiss){
      document.body.dataset.calloutDirDismiss = '1';
      document.addEventListener('click', () => {
        const menu = document.getElementById('mapCalloutDirMenu');
        const btn = document.getElementById('mapCalloutDirections');
        if(menu) menu.hidden = true;
        if(btn) btn.setAttribute('aria-expanded', 'false');
      });
    }
  }
  const saveEl = document.getElementById('mapCalloutSave');
  if(saveEl){
    const paint = () => {
      const on = !!currentFavorites[t.id];
      saveEl.classList.toggle('saved', on);
      saveEl.textContent = on ? '♥ Saved' : '♡ Save';
      saveEl.setAttribute('aria-pressed', String(on));
    };
    paint();
    saveEl.onclick = async () => {
      const wasSaved = !!currentFavorites[t.id];
      const nextFavorites = { ...currentFavorites };
      if(wasSaved) delete nextFavorites[t.id];
      else nextFavorites[t.id] = true;
      saveEl.disabled = true;
      const saved = window.DoloPawsAuth ? await window.DoloPawsAuth.setFavorites(nextFavorites) : false;
      saveEl.disabled = false;
      if(saved){
        currentFavorites = nextFavorites;
        renderReturningHomepage(currentProfileForAdjust);
        paint();
        showHomeActionStatus(window.t(wasSaved ? 'save.removed' : 'save.added'));
      } else {
        showHomeActionStatus(window.t('save.error'));
      }
    };
  }
  const matchEl = document.getElementById('mapCalloutMatch');
  if(matchEl){
    const overrides = currentProfileForAdjust
      ? effectiveOverrides(currentProfileForAdjust, adjustOverride)
      : guestOverrides();
    matchEl.innerHTML = liMatchColHtml(t, currentProfileForAdjust, overrides);
  }
  callout.hidden = false;
}
function hideMapCallout(){
  const callout = document.getElementById('mapCallout');
  if(callout) callout.hidden = true;
}

if(adjustToggle){
  adjustToggle.addEventListener('click', () => {
    adjustPanel.hidden = false;
    adjustToggle.hidden = true;
    adjustToggle.setAttribute('aria-expanded', 'true');
    setCompanionPanelOpen(false);
    if(companionPanelIsMobile()) adjustPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}
if(adjustCloseBtn){
  adjustCloseBtn.addEventListener('click', () => {
    adjustPanel.hidden = true;
    adjustToggle.hidden = false;
    adjustToggle.setAttribute('aria-expanded', 'false');
    adjustOverride = null;
    renderReturningHomepage(currentProfileForAdjust);
  });
}
document.querySelectorAll('.adj-pill-row').forEach(row => {
  row.addEventListener('click', (e) => {
    const pill = e.target.closest('.adj-pill');
    if(!pill) return;
    row.querySelectorAll('.adj-pill').forEach(p => {
      p.style.background = 'none';
      p.style.color = 'var(--ink)';
      p.style.borderColor = 'var(--paper-line)';
      p.classList.remove('active');
      p.setAttribute('aria-pressed', 'false');
    });
    pill.style.background = 'var(--ink)';
    pill.style.color = '#fff';
    pill.style.borderColor = 'var(--ink)';
    pill.classList.add('active');
    pill.setAttribute('aria-pressed', 'true');

    const group = row.dataset.group;
    if(!adjustOverride){
      const base = currentProfileForAdjust ? effectiveOverrides(currentProfileForAdjust, null) : guestOverrides();
      adjustOverride = {...base};
    }
    adjustOverride[group] = pill.dataset.value;
    renderReturningHomepage(currentProfileForAdjust);
  });
});
document.querySelectorAll('.adj-pill').forEach(p => {
  p.style.padding = '8px 14px';
  p.style.borderRadius = '14px';
  p.style.border = '1.5px solid var(--paper-line)';
  p.style.fontSize = '12px';
  p.style.fontWeight = '600';
  p.style.color = 'var(--ink)';
  p.style.cursor = 'pointer';
  p.style.fontFamily = "'Inter',sans-serif";
  p.style.background = 'none'; // pills are now real <button>s, kill the UA default
});

// ============================================================
// AUTH STATE, switch between guest and returning homepage
// ============================================================
// Wizard saves while logged in should refresh the homepage immediately.
window.addEventListener('dolopaws-dog-profile-saved', (e) => {
  if(window.DoloPawsAuth && window.DoloPawsAuth.currentUser && e.detail && e.detail.profile){
    currentProfileForAdjust = e.detail.profile;
    adjustOverride = null;
    renderReturningHomepage(e.detail.profile);
  }
});

async function applyHomepageAuthState(e){
  const user = e.detail.user;
  const devReturning = !!(e.detail && e.detail.devView === 'returning');
  const newHome = document.getElementById('newCustomerHomepage');
  const returningHome = document.getElementById('returningCustomerHomepage');
  const browseNavLink = document.getElementById('browseNavLink');
  if(browseNavLink){
    // Primary navigation must be predictable: "Trails" always opens the
    // complete browse experience, regardless of authentication state.
    browseNavLink.href = 'browse-trails.html';
    const navSpan = browseNavLink.querySelector('span');
    if(navSpan) navSpan.textContent = tx('Trails');
  }
  if(!newHome || !returningHome) return;

  if((user && window.DoloPawsAuth) || devReturning){
    newHome.hidden = true;
    returningHome.hidden = false;
    document.documentElement.classList.remove('early-member');
    document.body.dataset.homepageView = 'returning';
    adjustOverride = null;
    // The guest homepage may already be fetching a catalogue-centroid
    // forecast. It must not leak into a location-scoped member ranking.
    liClearLocationConditions();
    if(liLocationContext){
      scheduleTrailMap();
      startMobileTrailMap();
    }
    // The map pane may have been hidden (or sized differently) when the map
    // was created, make sure MapLibre measures the now-visible container.
    if(trailMapInstance) requestAnimationFrame(() => trailMapInstance.resize());
    initLoggedInShell();

    // The local summary is intentionally small, but it is enough to rank and
    // paint the first screen while Firebase refreshes the full profile and
    // favourites. This removes the signed-in blank wait on mobile networks.
    let profile = liResolveActiveProfile(null);
    currentProfileForAdjust = profile;
    renderReturningHomepage(profile);
    if(user && window.DoloPawsAuth){
      // Guest-wizard handoff: if they built a dog profile before signing
      // up, persist it now, but never overwrite a profile that already
      // exists on the account (e.g. logging into an older account).
      try {
        const pendingRaw = localStorage.getItem('dolopaws-pending-dog-profile');
        if(pendingRaw){
          const pending = JSON.parse(pendingRaw);
          const state = await window.DoloPawsAuth.getDogProfiles();
          // An unreadable account is not an empty one: writing the guest dog
          // now would land it over the account's selected dog. Keep the
          // device copy; the account page retries once the read works.
          if(state && !state.loadError){
            if(pending && pending.name && !state.dogs.length){
              await window.DoloPawsAuth.setDogProfile(pending);
            }
            localStorage.removeItem('dolopaws-pending-dog-profile');
            localStorage.removeItem('dolopaws-dog-draft'); // guest draft now redundant
          }
        }
      } catch(err){ /* never block login on handoff */ }

      const [cloudProfile, cloudFavorites] = await Promise.all([
        window.DoloPawsAuth.getDogProfile().catch(() => null),
        window.DoloPawsAuth.getFavorites().catch(() => ({})),
      ]);
      profile = cloudProfile || profile;
      currentFavorites = cloudFavorites || {};
    } else {
      // ?view=returning preview, use the guest wizard draft if one exists.
      try { profile = JSON.parse(localStorage.getItem('dolopaws-pending-dog-profile') || 'null'); } catch(err){ profile = null; }
      currentFavorites = {};
    }
    currentProfileForAdjust = profile;
    renderReturningHomepage(profile);

    // Show the dog photo bubble (with uploaded photo or fallback paw)
    const dogBubble = document.getElementById('dogPhotoBubble');
    const dogBubbleImg = document.getElementById('dogBubbleImg');
    if(dogBubble){
      try {
        // Resolve only the active dog's synced photo or dog-ID cache. A dog
        // without a photo must keep the paw fallback, never another dog's image.
        const photo = liDogPhoto(profile);
        if(photo && dogBubbleImg){
          const fallback = dogBubble.querySelector('.dog-bubble-fallback');
          dogBubbleImg.onerror = () => {
            dogBubbleImg.hidden = true;
            if(fallback) fallback.style.display = '';
          };
          dogBubbleImg.src = photo;
          dogBubbleImg.hidden = false;
          if(fallback) fallback.style.display = 'none';
        }
      } catch(e){}
      dogBubble.hidden = false;
    }
  } else {
    if(liDevView) return; // keep the ?view=returning preview when real auth resolves logged-out
    newHome.hidden = false;
    returningHome.hidden = true;
    // Stale member cache (signed out elsewhere): reveal the guest page.
    document.documentElement.classList.remove('early-member');
    document.body.dataset.homepageView = 'new';
    const dogBubble = document.getElementById('dogPhotoBubble');
    if(dogBubble) dogBubble.hidden = true;
    // (No guest map to schedule: signed-out visitors get no homepage map.)
  }
}

window.addEventListener('dolopaws-auth-changed', applyHomepageAuthState);

// The multi-dog summary is cached asynchronously. firebase-init.js starts
// syncProfileSummary() and then tells its listeners the user changed without
// waiting for it, deliberately, so a slow network cannot hold up the whole
// sign-in. The consequence is that the auth-changed handler runs while
// dolopaws-profile-summary is still the guest's, and renderLiDogLists reads
// that cache: signing in from the dog wizard showed one dog, or none, on an
// account that has several, until the page was refreshed by hand.
//
// The header already re-renders on this signal. The homepage did not, which is
// the whole bug. Re-render on the same event rather than blocking sign-in on
// the read, or duplicating the fetch here.
window.addEventListener('dolopaws-profile-summary-changed', event => {
  if(!document.body || document.body.dataset.homepageView !== 'returning') return;
  const summary = event.detail && event.detail.summary;
  if(!summary) return;
  // liResolveActiveProfile re-reads the cache this event just wrote, so a
  // profile the first render could not name gets named now.
  const profile = liResolveActiveProfile(currentProfileForAdjust);
  currentProfileForAdjust = profile;
  renderReturningHomepage(profile);
});

// firebase-init.js exposes a replayable auth state, but auth-ui.js translates
// it into a DOM event. On a fast cached sign-in that event can be dispatched
// before this deferred homepage script attaches its listener. Re-apply the
// already-resolved state once so the first navigation cannot remain stuck
// between the guest and member homepages.
if(window.DoloPawsAuth && window.DoloPawsAuth.authResolved){
  applyHomepageAuthState({ detail:{ user:window.DoloPawsAuth.currentUser } });
}
// ============================================================
// LEGEND ENTRY
// ============================================================

/*
Add this to your legend:

<span>💧 Drinking water (12,921 sources)</span>

Optional color legend:
<span><span style="width:12px;height:12px;background:#4E90A8;display:inline-block;border-radius:50%;margin-right:4px;"></span>Fountain</span>
<span><span style="width:12px;height:12px;background:#228B22;display:inline-block;border-radius:50%;margin-right:4px;"></span>Spring</span>
<span><span style="width:12px;height:12px;background:#0077BE;display:inline-block;border-radius:50%;margin-right:4px;"></span>Water tap</span>
*/

// ============================================================
// DEV PREVIEW, index.html?view=returning shows the logged-in shell
// without an account (profile falls back to the guest wizard draft;
// cloud saves stay disabled). Mirrors the ?view= contract documented
// in homepage-view.js.
// ============================================================
(function(){
  try {
    const forced = new URLSearchParams(window.location.search).get('view');
    // The iPhone app opens every visitor, signed in or not, on the map and
    // ranked list: an app is used, not read about, so the website's guest
    // landing page has no place in it. scripts/build-app.js marks app pages
    // with the orma-app class; the website never has it.
    const inApp = document.documentElement.classList.contains('orma-app');
    if(forced === 'returning' || inApp){
      liDevView = true;
      window.dispatchEvent(new CustomEvent('dolopaws-auth-changed', { detail: { user: null, devView: 'returning' } }));
    }
  } catch(e){ /* preview-only convenience, never break the real page */ }
})();
