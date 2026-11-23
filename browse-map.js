(function(root){
  'use strict';
  // A walk's name as the reader sees it (i18n.js); search also keeps the English one.
  function trailDisplayName(trail){ var i18n = typeof window !== 'undefined' && window.DoloPawsI18n; return i18n && typeof i18n.trailName === 'function' ? i18n.trailName(trail) : String((trail && trail.name) || ''); }

  // Script-written wording goes through i18n.js; the English sentence is its own key.
  // A number as the reader writes it (6,7 km in Italian); English is unchanged.
  function num(value){ const i18n = root && root.DoloPawsI18n; return i18n && typeof i18n.num==='function' ? i18n.num(value) : value; }
  function tx(text, vars){
    const i18n = typeof window !== 'undefined' && window.DoloPawsI18n;
    if (i18n && typeof i18n.phrase === 'function') return i18n.phrase(text, vars);
    return vars ? String(text).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : text;
  }

  function escapeHtml(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, character => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
    })[character]);
  }

  function coordinateFor(trail){
    if(!trail) return null;
    const start = trail.startPoint || {};
    const startLat = start.lat == null ? NaN : Number(start.lat);
    const startLng = start.lng == null ? NaN : Number(start.lng);
    const lat = Number.isFinite(startLat) ? startLat : (trail.lat == null ? NaN : Number(trail.lat));
    const lng = Number.isFinite(startLng) ? startLng : (trail.lng == null ? NaN : Number(trail.lng));
    if(!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if(lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return [lng, lat];
  }

  function withinBounds(trail, bounds){
    if(!bounds) return true;
    const coordinate = coordinateFor(trail);
    if(!coordinate) return false;
    const [lng, lat] = coordinate;
    const withinLng = bounds.west <= bounds.east
      ? lng >= bounds.west && lng <= bounds.east
      : lng >= bounds.west || lng <= bounds.east;
    return withinLng && lat >= bounds.south && lat <= bounds.north;
  }

  // From this zoom every walk is drawn as its line, on the same shared map
  // as the homepage (explore-map.js); a dot marks each start at every zoom.
  const LINE_MIN_ZOOM = 7;

  function trailFeature(trail, presentation){
    const coordinate = coordinateFor(trail);
    if(!coordinate) return null;
    const view = presentation || {};
    const score = Number(view.score);
    return {
      type:'Feature',
      geometry:{ type:'Point', coordinates:coordinate },
      properties:{
        id:String(trail.id || ''),
        name:String(trailDisplayName(trail) || 'Trail'),
        area:String(trail.area || trail.valley || ''),
        distance:Number(trail.distance) || 0,
        hours:Number(trail.hours) || 0,
        // No rating is not a moderate rating. Nothing styles by this today,
        // which is exactly why the default was easy to miss: the first thing
        // to colour a pin by it would have called every unrated trail moderate.
        risk:String(trail.safetyLevel || ''),
        score:Number.isFinite(score) ? score : 0,
        // The verdict's tier, so a pin is the colour of the words on its card.
        fit:String(view.fit || ''),
        saved:view.saved ? 1 : 0,
        // Out of season this month (trail-season-words.js): the pin fades and
        // sits under the walks to go on now, the order the list is in.
        out:outOfSeasonNow(trail) ? 1 : 0,
        // Whether the walk also has a line on the map.
        line:Array.isArray(trail.path) && trail.path.length > 1 ? 1 : 0,
      },
    };
  }

  // The walk's own line, for the map to draw instead of a dot (owner, 19 Nov:
  // "show the lines instead of the dots"). Null when the walk has no path.
  function trailLineFeature(trail, presentation){
    if(!trail || !Array.isArray(trail.path) || trail.path.length < 2) return null;
    const coordinates = trail.path.map(point => [Number(point[1]), Number(point[0])])
      .filter(point => point.every(Number.isFinite));
    if(coordinates.length < 2) return null;
    const view = presentation || {};
    const score = Number(view.score);
    return {
      type:'Feature',
      geometry:{ type:'LineString', coordinates },
      properties:{
        id:String(trail.id || ''),
        score:Number.isFinite(score) ? score : 0,
        fit:String(view.fit || ''),
        out:outOfSeasonNow(trail) ? 1 : 0,
      },
    };
  }

  function outOfSeasonNow(trail){
    const words = root && root.DoloPawsTrailSeasonWords;
    return Boolean(words && trail && trail.season && words.outOfSeason(trail.season, new Date().getMonth() + 1));
  }

  // The Trails page map is the homepage map (explore-map.js): the same base,
  // Layers panel, Draw a route and Expand. Owner, 20 Nov: "applying the
  // homepage map to trails as well". Here every walk stands out, coloured by
  // its fit for the dog the page is about, because this list is every walk.
  function create(options){
    const settings = options || {};
    const containerId = settings.containerId || 'browseMap';
    const container = document.getElementById(containerId);
    if(!container) return null;
    const explore = root.ORMAExploreMap;

    const searchAreaButton = document.getElementById(settings.searchAreaButtonId || 'browseSearchArea');
    let map = null;
    let loaded = false;
    let trails = [];
    let selectedId = '';
    let pendingFit = true;
    let ignoreNextMove = false;
    let popup = null;

    function verdictFor(trail){
      return typeof settings.verdictFor === 'function' ? (settings.verdictFor(trail) || null) : null;
    }

    function fitFor(trail){
      const verdict = verdictFor(trail);
      return verdict && root.ORMAMapStyle ? root.ORMAMapStyle.fitForCategory(verdict.category) : '';
    }

    function presentationFor(trail){
      return {
        score:typeof settings.scoreFor === 'function' ? settings.scoreFor(trail) : trail.score,
        fit:fitFor(trail),
        saved:typeof settings.savedFor === 'function' ? settings.savedFor(trail) : trail.saved,
      };
    }

    function data(){
      return {
        type:'FeatureCollection',
        features:trails.map(trail => trailFeature(trail, presentationFor(trail))).filter(Boolean),
      };
    }

    function lineData(){
      return {
        type:'FeatureCollection',
        features:trails.map(trail => trailLineFeature(trail, presentationFor(trail))).filter(Boolean),
      };
    }

    // The picked walk keeps its fit colour: a dark green line under a red
    // "Not recommended" card read as a good fit.
    function routeColourFor(trail){
      const style = root.ORMAMapStyle;
      const fit = fitFor(trail);
      if(style && style.MATCH_COLOURS && style.MATCH_COLOURS[fit]) return style.MATCH_COLOURS[fit];
      const score = presentationFor(trail).score;
      return style ? style.matchColour(score) : '#4A7856';
    }

    function fitToTrails(){
      if(!loaded || !map || !trails.length || !root.maplibregl) return;
      const points = trails.map(coordinateFor).filter(Boolean);
      if(!points.length) return;
      if(points.length === 1){
        ignoreNextMove = true;
        map.flyTo({ center:points[0], zoom:12.5, duration:360 });
        return;
      }
      const bounds = new root.maplibregl.LngLatBounds();
      points.forEach(point => bounds.extend(point));
      ignoreNextMove = true;
      map.fitBounds(bounds, {
        padding:{ top:64, right:54, bottom:54, left:54 },
        maxZoom:12.5,
        duration:420,
      });
    }

    function selectedTrail(){
      return trails.find(trail => String(trail.id) === String(selectedId));
    }

    function syncSelection(){
      if(!loaded || !map) return;
      const trail = selectedTrail();
      explore.setSelected(map, trail || null, { routeColor:trail ? routeColourFor(trail) : null, fit:false });
    }

    function showPopup(trail){
      if(!map || !root.maplibregl || !trail) return;
      const coordinate = coordinateFor(trail);
      if(!coordinate) return;
      if(popup) popup.remove();
      const metadata = [
        trail.area || trail.valley || '',
        trail.distance ? `${num(trail.distance)} km` : '',
        trail.hours ? num(root.ORMARouteReturn ? root.ORMARouteReturn.formatDuration(trail.hours) : `${trail.hours} h`) : '',
      ].filter(Boolean).join(' · ');
      // The same verdict, for the same dog, as the trail's card in the list.
      const verdict = verdictFor(trail);
      const subject = typeof settings.subjectLabel === 'function' ? settings.subjectLabel() : '';
      const verdictLine = verdict && verdict.label
        ? `<p class="browse-map-popup__verdict">${subject ? `<small>${escapeHtml(subject)}</small>` : ''}<b style="color:${escapeHtml(verdict.color || '#2E4034')}">${escapeHtml(verdict.label)}</b></p>`
        : '';
      popup = new root.maplibregl.Popup({ offset:18, closeButton:true, maxWidth:'250px' })
        .setLngLat(coordinate)
        .setHTML(`<div class="browse-map-popup"><strong>${escapeHtml(trailDisplayName(trail) || tx('Trail'))}</strong>${metadata ? `<span>${escapeHtml(metadata)}</span>` : ''}${verdictLine}<a href="trail.html?id=${encodeURIComponent((window.DoloPawsRegionalData && window.DoloPawsRegionalData.slugFor ? window.DoloPawsRegionalData.slugFor(trail.id) : (trail.id)))}">${tx('Open trail →')}</a></div>`)
        .addTo(map);
    }

    function select(id, selectOptions){
      selectedId = String(id || '');
      syncSelection();
      const trail = selectedTrail();
      if(!trail) return;
      const opts = selectOptions || {};
      if(opts.popup) showPopup(trail);
      if(opts.fly && map){
        const coordinate = coordinateFor(trail);
        if(coordinate){
          ignoreNextMove = true;
          map.easeTo({ center:coordinate, zoom:Math.max(map.getZoom(), 12), duration:320 });
        }
      }
    }

    function applyData(shouldFit){
      if(!loaded || !map) return;
      const points = map.getSource('trail-points');
      if(points) points.setData(data());
      const lines = map.getSource('trail-paths');
      if(lines) lines.setData(lineData());
      syncSelection();
      if(shouldFit) fitToTrails();
    }

    function initialise(){
      map = new root.maplibregl.Map(explore.mapOptions({ container:containerId, center:[11.3, 46.45], zoom:7.3 }));
      const wrap = container.closest('.li-map');
      explore.addChrome(map, {
        wrap,
        expandButton:settings.expandButtonId ? document.getElementById(settings.expandButtonId) : null,
        drawLinks:(settings.drawLinkIds || []).map(linkId => document.getElementById(linkId)),
      });
      map.on('load', async () => {
        const beforeIds = await explore.setupBase(map);
        const fitColour = root.ORMAMapStyle.fitColourExpression('fit', 'score');
        const layers = explore.addTrailLayers(map, beforeIds, {
          colour:fitColour,
          // Every walk is in the list, so every line stands out in its fit
          // colour and every start is a dot in the same colour.
          lineEmphasis:true,
          pinEmphasis:false,
          pinOtherColour:fitColour,
          pinRadius:5,
          pinOpacity:0.95,
        });
        layers.clickLayers.forEach(layerId => {
          map.on('click', layerId, event => {
            const feature = event.features && event.features[0];
            if(!feature) return;
            const id = feature.properties.id;
            select(id, { popup:true });
            if(typeof settings.onSelect === 'function') settings.onSelect(id);
          });
          map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
          map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
        });
        explore.addOverlays(map, containerId);
        loaded = true;
        applyData(pendingFit);
        pendingFit = false;
        container.querySelectorAll('.browse-map-placeholder').forEach(element => element.remove());
      });
      map.on('moveend', () => {
        if(ignoreNextMove){ ignoreNextMove = false; return; }
        if(searchAreaButton) searchAreaButton.hidden = false;
        if(typeof settings.onMove === 'function') settings.onMove();
      });
      return map;
    }

    const schedule = root.DoloPawsMapRuntime
      ? root.DoloPawsMapRuntime.whenVisible(container, initialise, { rootMargin:'520px 0px' })
      : null;

    return {
      update(nextTrails, updateOptions){
        trails = (Array.isArray(nextTrails) ? nextTrails : []).filter(coordinateFor);
        const shouldFit = !updateOptions || updateOptions.fit !== false;
        pendingFit = pendingFit || shouldFit;
        applyData(shouldFit);
      },
      select,
      showPopup(id){
        const trail = trails.find(item => String(item.id) === String(id));
        if(trail) showPopup(trail);
      },
      bounds(){
        if(!map) return null;
        const current = map.getBounds();
        return { west:current.getWest(), east:current.getEast(), south:current.getSouth(), north:current.getNorth() };
      },
      resize(){ if(map) map.resize(); else if(schedule && schedule.start) schedule.start(); },
      map(){ return map; },
    };
  }

  const api = { create, coordinateFor, withinBounds, trailFeature, trailLineFeature, LINE_MIN_ZOOM };
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  if(root) root.DoloPawsBrowseMap = api;
})(typeof window !== 'undefined' ? window : null);
