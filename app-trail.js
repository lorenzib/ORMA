// The iPhone app's trail page opens on a big map of the walk, with a
// Photo/Map switch at the top and the trail photo as a small corner picture.
// scripts/build-app.js adds this script to the app's trail.html only; the
// website never loads it. The map, its controls and the photo are the page's
// own elements, moved to the top, so every handler keeps working; the look is
// in app-shell.css under .td2.app-trail-map.
(function(){
  if(window.__ormaAppTrail) return;
  window.__ormaAppTrail = true;

  const label = (key, fallback) => {
    const text = typeof window.t === 'function' ? window.t(key) : '';
    return text && text !== key ? text : fallback;
  };

  // MapLibre redraws to its box on a window resize.
  const redrawMap = () => window.dispatchEvent(new Event('resize'));

  function setup(){
    const td2 = document.querySelector('.td2');
    const hero = td2 && td2.querySelector('.td2-hero');
    const mapCard = td2 && td2.querySelector('.td2-mapcard');
    const mapBox = document.getElementById('trailMapBox');
    if(!hero || !mapCard || !mapBox || td2.classList.contains('app-trail-map')) return;

    td2.insertBefore(mapCard, hero);
    const back = document.getElementById('tdBreadcrumb');
    if(back) td2.insertBefore(back, mapCard);
    td2.classList.add('app-trail-map');

    const photo = document.getElementById('tdHeroPhoto');
    const photoSrc = () => photo && !photo.hidden ? (photo.currentSrc || photo.getAttribute('src') || '') : '';

    const views = document.createElement('div');
    views.className = 'app-trail-switch';
    views.setAttribute('role', 'group');
    views.setAttribute('aria-label', label('appTrail.view', 'Show'));
    const buttons = {};
    [['photo', label('appTrail.photo', 'Photo')], ['map', label('appTrail.map', 'Map')]].forEach(([view, text]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = text;
      button.addEventListener('click', () => show(view));
      buttons[view] = button;
      views.appendChild(button);
    });
    td2.insertBefore(views, mapCard);

    const thumb = document.createElement('button');
    thumb.type = 'button';
    thumb.className = 'app-trail-thumb';
    thumb.setAttribute('aria-label', label('appTrail.showPhoto', 'Show the photo'));
    thumb.addEventListener('click', () => show('photo'));
    mapBox.appendChild(thumb);

    function show(view){
      td2.classList.toggle('app-trail-photo', view === 'photo');
      buttons.photo.setAttribute('aria-pressed', String(view === 'photo'));
      buttons.map.setAttribute('aria-pressed', String(view === 'map'));
      if(view === 'map') redrawMap();
    }

    // A trail without a photo is just the map: no switch, no corner picture.
    function syncPhoto(){
      const src = photoSrc();
      views.hidden = !src;
      thumb.hidden = !src;
      if(src) thumb.style.backgroundImage = `url("${src.replace(/"/g, '%22')}")`;
      else show('map');
    }
    if(photo){
      photo.addEventListener('load', syncPhoto);
      new MutationObserver(syncPhoto).observe(photo, { attributes:true, attributeFilter:['src', 'hidden'] });
    }
    show('map');
    syncPhoto();
    redrawMap();
    window.addEventListener('load', redrawMap, { once:true });
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();
})();
