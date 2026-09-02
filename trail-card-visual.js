(function(global){
  function escapeHtml(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, function(char){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char];
    });
  }

  function safeClassName(value){
    return String(value || '').replace(/[^a-zA-Z0-9 _-]/g, '').trim();
  }

  function usablePath(path){
    return Array.isArray(path) && path.length > 1 && path.every(function(point){
      return Array.isArray(point) && Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1]));
    });
  }

  function sampledPath(path){
    if(path.length <= 120) return path;
    var step = Math.ceil(path.length / 119);
    var sample = path.filter(function(_, index){ return index % step === 0; });
    if(sample[sample.length - 1] !== path[path.length - 1]) sample.push(path[path.length - 1]);
    return sample;
  }

  function routeSvg(path){
    if(!usablePath(path)) return '';
    var points = sampledPath(path);
    var lats = points.map(function(point){ return Number(point[0]); });
    var lngs = points.map(function(point){ return Number(point[1]); });
    var minLat = Math.min.apply(null, lats), maxLat = Math.max.apply(null, lats);
    var minLng = Math.min.apply(null, lngs), maxLng = Math.max.apply(null, lngs);
    var width = 240, height = 160, pad = 22;
    var spanLat = (maxLat - minLat) || 0.0001;
    var spanLng = (maxLng - minLng) || 0.0001;
    var scale = Math.min((width - pad * 2) / spanLng, (height - pad * 2) / spanLat);
    var offsetX = (width - pad * 2 - spanLng * scale) / 2;
    var offsetY = (height - pad * 2 - spanLat * scale) / 2;
    var projected = points.map(function(point){
      return [
        pad + (Number(point[1]) - minLng) * scale + offsetX,
        pad + (maxLat - Number(point[0])) * scale + offsetY,
      ];
    });
    var line = projected.map(function(point){ return point[0].toFixed(1) + ',' + point[1].toFixed(1); }).join(' ');
    var start = projected[0], end = projected[projected.length - 1];
    return '<svg class="trail-visual-route" viewBox="0 0 240 160" aria-hidden="true" focusable="false">' +
      '<path d="M18 45c42-22 76-19 111-3s61 14 93-5M13 116c44-18 79-16 116 1s65 15 99-3" fill="none" stroke="currentColor" stroke-width="1" opacity=".12"/>' +
      '<polyline points="' + line + '" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<circle cx="' + start[0].toFixed(1) + '" cy="' + start[1].toFixed(1) + '" r="5" fill="#D6A038" stroke="#fff" stroke-width="2"/>' +
      '<circle cx="' + end[0].toFixed(1) + '" cy="' + end[1].toFixed(1) + '" r="4" fill="currentColor" stroke="#fff" stroke-width="2"/>' +
    '</svg>';
  }

  function fallbackIcon(){
    if(global.DoloPawsIcons){
      return global.DoloPawsIcons.renderIconSvg('mountain', { mode:'inline', color:'currentColor', size:30 });
    }
    return '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" aria-hidden="true"><path d="m4 18 5.2-8 2.2 3.1L14.6 7 20 18z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
  }

  var responsivePhotos = {
    'images/lago-di-braies.webp': [480, 900],
    'images/lago-di-carezza.webp': [480, 900],
    'images/boucle-du-marais-des-chassettes.webp': [480, 960, 1280],
    'images/circuit-beatrice-de-savoie.webp': [480, 960, 1280],
    'images/itineraire-decouverte-de-la-nature.webp': [480, 960, 1280],
  };

  var responsivePhotoByTrailId = {
    'lago-braies': 'images/lago-di-braies.webp',
    'lago-carezza': 'images/lago-di-carezza.webp',
    'osm-16322228': 'images/boucle-du-marais-des-chassettes.webp',
    'osm-3982382': 'images/circuit-beatrice-de-savoie.webp',
    'osm-10116380': 'images/itineraire-decouverte-de-la-nature.webp',
  };

  function isCommonsRedirect(source){
    return /^https:\/\/commons\.wikimedia\.org\/wiki\/Special:Redirect\/file\//i.test(source || '');
  }

  function withWidth(source, width){
    return source + (source.indexOf('?') === -1 ? '?' : '&') + 'width=' + width;
  }

  function photoAttributes(source){
    var widths = responsivePhotos[source];
    if(!widths){
      if(isCommonsRedirect(source)){
        return ' srcset="' + escapeHtml(withWidth(source, 320)) + ' 320w, ' + escapeHtml(withWidth(source, 640)) + ' 640w" sizes="(max-width: 640px) 42vw, 240px" decoding="async"';
      }
      return ' decoding="async"';
    }
    var stem = source.replace(/\.webp$/, '');
    var entries = widths.map(function(width, index){
      var url = width === 900 ? source : stem + '-' + width + '.webp';
      return escapeHtml(url) + ' ' + width + 'w';
    });
    return ' srcset="' + entries.join(', ') + '" sizes="(max-width: 640px) 42vw, 240px" decoding="async"';
  }

  function photoFallback(source){
    if(isCommonsRedirect(source)) return withWidth(source, 480);
    return responsivePhotos[source] ? source.replace(/\.webp$/, '.jpg') : source;
  }

  function render(trail, options){
    options = options || {};
    trail = trail || {};
    var name = String(trail.name || 'Trail');
    var className = safeClassName(options.className || '');
    var classes = ['trail-visual'];
    if(className) classes.push(className);
    var attrs = '';
    if(options.dataTrailId != null) attrs += ' data-trail-id="' + escapeHtml(options.dataTrailId) + '"';
    if(options.clickable) classes.push('trail-visual--clickable');

    if(typeof trail.imageIcon === 'string' && trail.imageIcon.trim()){
      var photoSource = responsivePhotoByTrailId[trail.id] || trail.imageIcon;
      classes.push('trail-visual--photo');
      return '<div class="' + classes.join(' ') + '"' + attrs + '><img src="' + escapeHtml(photoFallback(photoSource)) + '"' + photoAttributes(photoSource) + ' alt="' + escapeHtml(name) + '" loading="lazy"></div>';
    }
    if(usablePath(trail.path)){
      classes.push('trail-visual--route');
      var routeLabel = String(options.routeLabel || (name + ': route preview')).split('{name}').join(name);
      return '<div class="' + classes.join(' ') + '" role="img" aria-label="' + escapeHtml(routeLabel) + '"' + attrs + '>' + routeSvg(trail.path) + '</div>';
    }
    classes.push('trail-visual--placeholder');
    var placeholder = String(options.placeholderLabel || 'Photo coming soon');
    var placeholderAria = String(options.placeholderAria || (name + ': photo coming soon')).split('{name}').join(name);
    return '<div class="' + classes.join(' ') + '" role="img" aria-label="' + escapeHtml(placeholderAria) + '"' + attrs + '><span class="trail-visual-placeholder-icon" aria-hidden="true">' + fallbackIcon() + '</span><span class="trail-visual-placeholder-label">' + escapeHtml(placeholder) + '</span></div>';
  }

  var api = { render:render, routeSvg:routeSvg, usablePath:usablePath };
  global.DoloPawsTrailVisual = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
