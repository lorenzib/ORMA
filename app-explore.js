// The iPhone app's Explore map keeps Layers and Terrain side by side at its
// top-left, always in view. On a phone the trail list slides up over the
// bottom of the map, which is where Terrain used to sit, so it was hidden.
// scripts/build-app.js adds this script to the app's index.html only; the
// website never loads it. Both buttons are script.js's own, moved into one
// row, so their handlers keep working; the look is in app-shell.css under
// .app-map-tools. Draw a route has moved to the Record tab.
(function(){
  if(window.__ormaAppExplore) return;
  window.__ormaAppExplore = true;

  function group(map){
    const layers = map.querySelector(':scope > .map-btn');
    const terrain = map.querySelector(':scope > .td-layer-switch');
    if(!layers || !terrain) return false;
    const tools = document.createElement('div');
    tools.className = 'app-map-tools';
    map.insertBefore(tools, layers);
    tools.append(layers, terrain);
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
