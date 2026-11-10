// The iPhone app's Explore map keeps Layers and Terrain side by side at its
// top-left, always in view. On a phone the trail list slides up over the
// bottom of the map, which is where the map-style switch used to sit, hidden.
// Terrain opens that switch (Map, Satellite, 3D) just under the buttons, the
// way Layers opens its panel, and only one of the two is open at a time.
// scripts/build-app.js adds this script to the app's index.html only; the
// website never loads it. Layers and the switch are script.js's own, so their
// handlers keep working; the look is in app-shell.css under .app-map-tools.
// Draw a route has moved to the Record tab.
(function(){
  if(window.__ormaAppExplore) return;
  window.__ormaAppExplore = true;

  const phrase = text => {
    const i18n = window.DoloPawsI18n;
    return i18n && typeof i18n.phrase === 'function' ? i18n.phrase(text) : text;
  };

  function group(map){
    const layers = map.querySelector(':scope > .map-btn');
    const styles = map.querySelector(':scope > .td-layer-switch');
    if(!layers || !styles) return false;

    const tools = document.createElement('div');
    tools.className = 'app-map-tools';
    const terrain = document.createElement('button');
    terrain.type = 'button';
    terrain.className = 'map-btn app-terrain-btn';
    terrain.textContent = phrase('Terrain');
    styles.id = styles.id || 'trailMapStylePanel';
    styles.classList.add('app-terrain-panel');
    terrain.setAttribute('aria-controls', styles.id);
    terrain.setAttribute('aria-expanded', 'false');
    map.insertBefore(tools, layers);
    tools.append(layers, terrain);

    const layersOpen = () => layers.getAttribute('aria-expanded') === 'true';
    function setTerrain(open){
      styles.classList.toggle('is-open', open);
      terrain.setAttribute('aria-expanded', String(open));
      terrain.classList.toggle('on', open);
    }
    terrain.addEventListener('click', () => {
      const open = !styles.classList.contains('is-open');
      if(open && layersOpen()) layers.click();
      setTerrain(open);
    });
    // Layers opening closes Terrain. Capture runs before script.js's own
    // handler flips aria-expanded, so this reads the state it is leaving.
    layers.addEventListener('click', () => { if(!layersOpen()) setTerrain(false); }, true);
    // Choosing a style is the answer; the panel can go.
    styles.addEventListener('click', event => {
      if(event.target.closest('button')) setTerrain(false);
    });
    return true;
  }

  function start(){
    const map = document.getElementById('trailMap');
    if(!map || map.querySelector('.app-map-tools') || group(map)) return;
    // The map builds its controls once its style has loaded.
    const watch = new MutationObserver(() => { if(group(map)) watch.disconnect(); });
    watch.observe(map, { childList:true });
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
