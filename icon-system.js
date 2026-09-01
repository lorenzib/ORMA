(function(global){
  const ICON_MIN_ZOOM = 12;

  const BASE_COLORS = {
    adjust: '#2E4034',
    routes: '#2C5C34',
    lifts: '#4E90A8',
    water: '#4E90A8',
    shade: '#2C5C34',
    hut: '#8A5A16',
    food: '#C4652F',
    veterinary: '#B44435',
    nearby: '#4E90A8',
    information: '#28736B',
    dog: '#2E4034',
    start: '#2E4034',
    switch: '#D6A038',
    toilets: '#5B7A99',
    verified: '#2C5C34',
    imported: '#28736B',
    new: '#8A5A16',
    heat: '#9C3A25',
    warning: '#9C3A25',
    mountain: '#5A5548',
    camera: '#2E4034',
    gentle: '#2C5C34',
    summer: '#C4652F',
    scenic: '#28736B',
    'pace-low': '#4E7256',
    'pace-medium': '#2C5C34',
    'pace-high': '#8A5A16',
    unknown: '#5A5548',
  };

  const MAP_ICON_VARIANTS = {
    lifts: { icon: 'lifts', color: '#4E90A8' },
    'water-drinking': { icon: 'water', color: '#4E90A8' },
    'water-fountain': { icon: 'water', color: '#2E7FA8' },
    'water-spring': { icon: 'water', color: '#228B22' },
    'water-tap': { icon: 'water', color: '#0077BE' },
    'water-point': { icon: 'water', color: '#5DB8D0' },
    'hut-alpine': { icon: 'hut', color: '#8A5A16' },
    'hut-wilderness': { icon: 'hut', color: '#B0741C' },
    'hut-shelter': { icon: 'hut', color: '#5A5548' },
    'food-bar': { icon: 'food', color: '#9C3A25' },
    'food-pub': { icon: 'food', color: '#7a2818' },
    'food-cafe': { icon: 'food', color: '#D6A038' },
    'food-restaurant': { icon: 'food', color: '#C4652F' },
    'food-fast': { icon: 'food', color: '#C4652F' },
    'food-icecream': { icon: 'food', color: '#D6A038' },
    'food-biergarten': { icon: 'food', color: '#9C3A25' },
    toilets: { icon: 'toilets', color: '#5B7A99' },
    viewpoint: { icon: 'camera', color: '#28736B' },
    picnic: { icon: 'picnic', color: '#4E7256' },
    sight: { icon: 'sight', color: '#5A5548' },
    information: { icon: 'information', color: '#28736B' },
    unknown: { icon: 'unknown', color: '#5A5548' },
  };

  const ICON_PATHS = {
    adjust: `
      <path d="M6 7h12"></path>
      <path d="M6 12h12"></path>
      <path d="M6 17h12"></path>
      <circle cx="9" cy="7" r="2"></circle>
      <circle cx="15" cy="12" r="2"></circle>
      <circle cx="11" cy="17" r="2"></circle>
    `,
    routes: `
      <path d="M6 18c2-5 5.5-9 12-12"></path>
      <circle cx="7" cy="18" r="1.5"></circle>
      <circle cx="18" cy="6" r="1.5"></circle>
      <path d="M10.2 13.4h1.8"></path>
      <path d="M13.7 10h1.8"></path>
    `,
    lifts: `
      <path d="M5 6h14"></path>
      <path d="M9 6v3"></path>
      <path d="M15 6v3"></path>
      <rect x="8" y="9" width="8" height="7" rx="2"></rect>
      <path d="M10.5 16v2"></path>
      <path d="M13.5 16v2"></path>
    `,
    water: `
      <path d="M12 5c2.6 3 4.1 5.4 4.1 7.5a4.1 4.1 0 1 1-8.2 0C7.9 10.4 9.4 8 12 5Z"></path>
    `,
    shade: `
      <path d="M12 3.2 6.6 10h3.1L5.8 15h4.4v5.8h3.6V15h4.4l-3.9-5h3.1Z"></path>
    `,
    hut: `
      <path d="M5 11l7-6 7 6"></path>
      <path d="M7 10.5V18h10v-7.5"></path>
      <path d="M10 18v-4h4v4"></path>
    `,
    food: `
      <path d="M8 5v6"></path>
      <path d="M6 5v4"></path>
      <path d="M10 5v4"></path>
      <path d="M8 11v8"></path>
      <path d="M15 5v14"></path>
      <path d="M15 5c2 0 3 2 3 4s-1 4-3 4"></path>
    `,
    veterinary: `
      <path d="M12 5v14"></path>
      <path d="M5 12h14"></path>
    `,
    nearby: `
      <path d="M7.5 18.5c-2.2-2.7-3.3-4.9-3.3-6.7a3.3 3.3 0 0 1 6.6 0c0 1.8-1.1 4-3.3 6.7Z"></path>
      <circle cx="7.5" cy="11.8" r="1"></circle>
      <path d="M16.5 18.5c-2.2-2.7-3.3-4.9-3.3-6.7a3.3 3.3 0 0 1 6.6 0c0 1.8-1.1 4-3.3 6.7Z"></path>
      <circle cx="16.5" cy="11.8" r="1"></circle>
    `,
    information: `
      <circle cx="12" cy="12" r="7"></circle>
      <path d="M12 11v5"></path>
      <path d="M12 8h.01"></path>
    `,
    dog: `
      <circle cx="8" cy="8.2" r="1.6"></circle>
      <circle cx="12" cy="6.6" r="1.6"></circle>
      <circle cx="16" cy="8.2" r="1.6"></circle>
      <path d="M8.4 16.5c0-2.4 1.5-4.2 3.6-4.2s3.6 1.8 3.6 4.2c0 1.4-1.1 2.5-2.5 2.5-.7 0-1.1-.3-1.7-.7-.5.4-1 .7-1.7.7-1.3 0-2.3-1.1-2.3-2.5Z"></path>
    `,
    start: `
      <path d="M8 19V5"></path>
      <path d="M8 6h8l-2 3 2 3H8"></path>
    `,
    switch: `
      <path d="M12 19v-7"></path>
      <path d="M12 12 7 7"></path>
      <path d="M12 12l5-5"></path>
      <path d="M7 7h4"></path>
      <path d="M13 7h4"></path>
    `,
    toilets: `
      <circle cx="8.5" cy="6.2" r="1.7"></circle>
      <path d="M8.5 8.5v5.5"></path>
      <path d="M6.6 10h3.8"></path>
      <path d="M8.5 14v4"></path>
      <circle cx="15.5" cy="6.2" r="1.7"></circle>
      <path d="M15.5 8.5l-1.8 5h3.6z"></path>
      <path d="M15.5 14v4"></path>
    `,
    verified: `
      <circle cx="12" cy="12" r="7"></circle>
      <path d="m8.7 12.2 2.1 2.1 4.6-5"></path>
    `,
    imported: `
      <path d="m5 6 4-2 6 2 4-2v14l-4 2-6-2-4 2z"></path>
      <path d="M9 4v14"></path>
      <path d="M15 6v14"></path>
    `,
    new: `
      <path d="M12 4.5c.5 4.2 2.8 6.5 7 7-4.2.5-6.5 2.8-7 7-.5-4.2-2.8-6.5-7-7 4.2-.5 6.5-2.8 7-7Z"></path>
    `,
    heat: `
      <path d="M10 5a2 2 0 0 1 4 0v8.2a4 4 0 1 1-4 0z"></path>
      <path d="M12 9v6"></path>
    `,
    warning: `
      <path d="M12 4 20 19H4z"></path>
      <path d="M12 9v4"></path>
      <path d="M12 16h.01"></path>
    `,
    mountain: `
      <path d="m4 18 5.2-8 2.2 3.1L14.6 7 20 18z"></path>
      <path d="m7.8 12.2 1.4-2.2 1.4 2"></path>
    `,
    camera: `
      <path d="M5 8h3l1.2-2h5.6L16 8h3v10H5z"></path>
      <circle cx="12" cy="13" r="3"></circle>
    `,
    gentle: `
      <path d="M12 12v8"></path>
      <path d="M12 16c-2.8-1.8-4.8-.8-5.8 1.4 2.7.8 4.7.2 5.8-1.4Z"></path>
      <circle cx="12" cy="6" r="2.5"></circle>
      <circle cx="16" cy="9" r="2.5"></circle>
      <circle cx="14.4" cy="13.4" r="2.5"></circle>
      <circle cx="9.6" cy="13.4" r="2.5"></circle>
      <circle cx="8" cy="9" r="2.5"></circle>
      <circle cx="12" cy="10" r="2.2"></circle>
    `,
    summer: `
      <circle cx="12" cy="12" r="3.5"></circle>
      <path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M18 6l-1.4 1.4M7.4 16.6 6 18"></path>
    `,
    scenic: `
      <path d="m4 18 5.2-8 2.2 3.1L14.6 7 20 18z"></path>
      <circle cx="17.5" cy="6" r="2"></circle>
    `,
    'pace-low': `
      <path d="M5 15c2.5-3 5.5-4.5 9-4.5"></path>
      <path d="m12 8.5 2 2-2 2"></path>
      <path d="M5 18h6"></path>
    `,
    'pace-medium': `
      <path d="M4 16c3-4 6.5-6 11-6"></path>
      <path d="m13 7.5 2.5 2.5-2.5 2.5"></path>
      <path d="M4 19h9"></path>
    `,
    'pace-high': `
      <path d="M4 17c3.5-5.5 8-8.5 14-9"></path>
      <path d="m15.5 5.5 2.8 2.4-2.4 2.8"></path>
      <path d="M4 20h12"></path>
    `,
    picnic: `
      <path d="M4 9.5h16"></path>
      <path d="M8 9.5 5.5 18"></path>
      <path d="m16 9.5 2.5 8.5"></path>
      <path d="M6.6 14.5h10.8"></path>
    `,
    sight: `
      <path d="M8 20V4.5"></path>
      <path d="M8 5.5h8.5l-2.1 3 2.1 3H8"></path>
    `,
    unknown: `
      <circle cx="12" cy="12" r="7"></circle>
      <path d="M9.8 10a2.5 2.5 0 1 1 4 2c-.9.6-1.8 1.1-1.8 2.3"></path>
      <path d="M12 17h.01"></path>
    `,
  };
  // Multicolor glyphs — the same drawings used in the trail itinerary, so
  // the map bubbles, the Layers chips and the legend all speak one language.
  const COLOR_GLYPHS = {
    water: '<path d="M12 4c2.9 3.4 4.6 6 4.6 8.4a4.6 4.6 0 11-9.2 0C7.4 10 9.1 7.4 12 4z" fill="#378ADD"/>',
    shade: '<path d="M12 3.2 6.6 10h3.1L5.8 15h4.4v5.8h3.6V15h4.4l-3.9-5h3.1Z" fill="#2C5C34"/><path d="M10.2 20.8h3.6V15h-3.6Z" fill="#8A5A16"/>',
    hut: '<path d="M5 11.2l7-6.2 7 6.2" fill="none" stroke="#8A5A16" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.8 10.4V18h10.4v-7.6" fill="#D6A038" stroke="#8A5A16" stroke-width="1.5" stroke-linejoin="round"/><path d="M10.4 18v-4.2h3.2V18" fill="#8A5A16"/>',
    food: '<path d="M6 9.5h9.5v5a3.5 3.5 0 01-3.5 3.5H9.5A3.5 3.5 0 016 14.5z" fill="#BA7517"/><path d="M15.5 10.5h1.4a2 2 0 010 4h-1.4" fill="none" stroke="#BA7517" stroke-width="1.6"/><path d="M9 7.2c0-.9.7-1.2.7-2M12 7.2c0-.9.7-1.2.7-2" stroke="#BA7517" stroke-width="1.4" stroke-linecap="round" fill="none"/>',
    lifts: '<path d="M4 7h16" stroke="#5A5548" stroke-width="1.6" stroke-linecap="round"/><path d="M12 7v3" stroke="#5A5548" stroke-width="1.6"/><rect x="8" y="10" width="8" height="7" rx="2" fill="#4E90A8"/><rect x="10" y="11.8" width="4" height="2.6" rx="0.8" fill="#fff"/>',
    routes: '<path d="M6.5 18c2-5 5.5-8.5 11-11" fill="none" stroke="#2C5C34" stroke-width="2" stroke-linecap="round" stroke-dasharray="0.1 3.4"/><circle cx="6.5" cy="18" r="1.8" fill="#2C5C34"/><path d="M17.5 4.2l2.6 1-1 2.5-2.6-1z" fill="#E24B4A"/>',
    dog: '<ellipse cx="12" cy="15" rx="3.7" ry="3.1" fill="#1D9E75"/><ellipse cx="7.4" cy="10.6" rx="1.4" ry="1.9" fill="#5DCAA5"/><ellipse cx="10.7" cy="8.7" rx="1.4" ry="1.9" fill="#5DCAA5"/><ellipse cx="13.9" cy="8.7" rx="1.4" ry="1.9" fill="#5DCAA5"/><ellipse cx="17" cy="10.6" rx="1.4" ry="1.9" fill="#5DCAA5"/>',
    start: '<path d="M8 20V4.5" stroke="#2E4034" stroke-width="1.9" stroke-linecap="round"/><path d="M8 5.5h9l-2.2 3.2L17 12H8z" fill="#E24B4A"/>',
    gentle: '<path d="M12 12v8" stroke="#2C5C34" stroke-width="1.8" stroke-linecap="round"/><path d="M12 16c-2.8-1.8-4.8-.8-5.8 1.4 2.7.8 4.7.2 5.8-1.4Z" fill="#5DCAA5"/><circle cx="12" cy="6" r="2.5" fill="#D98AA3"/><circle cx="16" cy="9" r="2.5" fill="#E6A6B8"/><circle cx="14.4" cy="13.4" r="2.5" fill="#D98AA3"/><circle cx="9.6" cy="13.4" r="2.5" fill="#E6A6B8"/><circle cx="8" cy="9" r="2.5" fill="#D98AA3"/><circle cx="12" cy="10" r="2.2" fill="#D6A038"/><circle cx="11.4" cy="9.4" r=".65" fill="#F6E7B0"/>',
    summer: '<circle cx="12" cy="12" r="4.2" fill="#D6A038"/><g stroke="#C4652F" stroke-width="1.8" stroke-linecap="round"><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6"/></g><circle cx="10.5" cy="10.5" r="1.3" fill="#F6E7B0" opacity=".9"/>',
    scenic: '<path d="m3.5 18.5 5.8-9 2.5 3.5 3.3-5.7 5.4 11.2z" fill="#4E90A8"/><path d="m7.3 12.6 2-3.1 2.5 3.5 1.2-2.1 2 2.2-2.1-.6-1.1 1.8-2.4-1.7z" fill="#F4F1E7"/><path d="M3.5 18.5h17l-5.5-3.8-3.1 1.6-3.1-1.8z" fill="#2C5C34"/><circle cx="18" cy="6" r="2.2" fill="#D6A038"/>',
    toilets: '<circle cx="8.5" cy="5.8" r="1.8" fill="#5B7A99"/><path d="M8.5 8.2v5.6M6.4 9.8h4.2M8.5 13.8v4.4" stroke="#5B7A99" stroke-width="1.8" stroke-linecap="round" fill="none"/><circle cx="15.5" cy="5.8" r="1.8" fill="#5B7A99"/><path d="M15.5 8.2l-2 5.4h4z" fill="#5B7A99"/><path d="M15.5 13.8v4.4" stroke="#5B7A99" stroke-width="1.8" stroke-linecap="round"/>',
    switch: '<path d="M12 19.5v-7M12 12.5L7 7M12 12.5L17 7" fill="none" stroke="#7F77DD" stroke-width="2" stroke-linecap="round"/><circle cx="7" cy="7" r="1.6" fill="#7F77DD"/><circle cx="17" cy="7" r="1.6" fill="#AFA9EC"/>',
    veterinary: '<circle cx="12" cy="12" r="9" fill="#B44435"/><path d="M12 7v10M7 12h10" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>',
    nearby: '<path d="M7.5 19c-2.3-2.9-3.5-5.2-3.5-7a3.5 3.5 0 017 0c0 1.8-1.2 4.1-3.5 7z" fill="#4E90A8"/><circle cx="7.5" cy="12" r="1.2" fill="#fff"/><path d="M16.5 19c-2.3-2.9-3.5-5.2-3.5-7a3.5 3.5 0 017 0c0 1.8-1.2 4.1-3.5 7z" fill="#2C5C34"/><circle cx="16.5" cy="12" r="1.2" fill="#fff"/>',
    information: '<circle cx="12" cy="12" r="9" fill="#28736B"/><path d="M12 10.5v6" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="7.5" r="1.2" fill="#fff"/>',
  };

  const VALID_MODES = new Set(['inline', 'legend', 'marker', 'map']);
  const SAFE_COLOR = /^(currentColor|#[0-9a-fA-F]{6})$/;

  function escapeHtml(value){
    return String(value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char]));
  }

  function svgDataUri(markup){
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  }

  function getIconMarkup(iconKey){
    return ICON_PATHS[iconKey] || ICON_PATHS.unknown;
  }

  function getCategoryColor(iconKey){
    return BASE_COLORS[iconKey] || BASE_COLORS.unknown;
  }

  function normalizeIconKey(iconKey){
    return ICON_PATHS[iconKey] ? iconKey : 'unknown';
  }

  function normalizeMode(mode){
    return VALID_MODES.has(mode) ? mode : 'inline';
  }

  function normalizeColor(color, iconKey){
    return SAFE_COLOR.test(color || '') ? color : getCategoryColor(iconKey);
  }

  function defaultSizeForMode(mode){
    return mode === 'legend' ? 18 : mode === 'marker' || mode === 'map' ? 28 : 16;
  }

  function normalizeSize(size, mode){
    const normalized = Number(size);
    return Number.isFinite(normalized) && normalized > 0 && normalized <= 64 ? normalized : defaultSizeForMode(mode);
  }

  function renderIconSvg(iconKey, options = {}){
    const normalizedKey = normalizeIconKey(iconKey);
    const mode = normalizeMode(options.mode || 'inline');
    // Verification only has a clear meaning beside a text label. A bare
    // checkmark on a map can be mistaken for a destination, completion or
    // live safety state, so never render it as a standalone map pin.
    if(normalizedKey === 'verified' && (mode === 'marker' || mode === 'map')) return '';
    const size = normalizeSize(options.size, mode);
    const badge = mode === 'legend' || mode === 'marker' || mode === 'map';

    // Multicolor drawings: colorful glyph on a soft white bubble (badges)
    // or bare (inline chips) — matches the itinerary icons exactly.
    if(COLOR_GLYPHS[normalizedKey]){
      const bubble = badge
        ? '<circle cx="12" cy="12" r="10.2" fill="#ffffff" stroke="#D8D5C8" stroke-width="1"></circle>'
        : '';
      const inner = badge
        ? `<g transform="translate(12 12) scale(0.78) translate(-12 -12)">${COLOR_GLYPHS[normalizedKey]}</g>`
        : COLOR_GLYPHS[normalizedKey];
      return `<svg xmlns="http://www.w3.org/2000/svg" class="dp-icon-svg dp-icon-svg--${escapeHtml(mode)}" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" aria-hidden="true">${bubble}${inner}</svg>`;
    }

    const color = normalizeColor(options.color || getCategoryColor(normalizedKey), normalizedKey);
    const stroke = badge ? '#ffffff' : color;
    const strokeWidth = badge ? 1.8 : 1.9;
    const background = badge ? `<circle cx="12" cy="12" r="9" fill="${color}" stroke="#ffffff" stroke-width="1.5"></circle>` : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" class="dp-icon-svg dp-icon-svg--${escapeHtml(mode)}" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" aria-hidden="true">
      ${background}
      <g stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
        ${getIconMarkup(normalizedKey)}
      </g>
    </svg>`;
  }

  function createSvgElement(iconKey, options = {}){
    if(!global.document || typeof global.DOMParser !== 'function') return null;
    const markup = renderIconSvg(iconKey, options);
    if(!markup) return null;
    const parser = new global.DOMParser();
    const doc = parser.parseFromString(markup, 'image/svg+xml');
    return global.document.importNode(doc.documentElement, true);
  }

  function chipHtml(iconKey, label){
    return `<span class="dp-chip-label">${renderIconSvg(iconKey, { mode: 'inline', color: 'currentColor', size: 16 })}<span>${escapeHtml(label)}</span></span>`;
  }

  function legendItemHtml(iconKey, label, options = {}){
    const color = options.color || getCategoryColor(iconKey);
    return `<span class="dp-legend-item">${renderIconSvg(iconKey, { mode: 'legend', color, size: 18 })}<span>${escapeHtml(label)}</span></span>`;
  }

  const BADGE_TYPES = {
    verified: { icon: 'verified' },
    imported: { icon: 'imported' },
    new: { icon: 'new' },
    'low-risk': { icon: 'verified' },
    moderate: { icon: 'warning' },
    caution: { icon: 'warning' },
    'heat-low': { icon: 'heat' },
    'heat-moderate': { icon: 'heat' },
    'heat-high': { icon: 'heat' },
    neutral: { icon: null },
  };

  function badgeHtml(type, label, options = {}){
    const normalizedType = BADGE_TYPES[type] ? type : 'neutral';
    const config = BADGE_TYPES[normalizedType];
    const iconKey = options.icon === false ? null : (options.icon || config.icon);
    const icon = iconKey ? renderIconSvg(iconKey, { mode: 'inline', color: 'currentColor', size: 13 }) : '';
    return `<span class="dp-badge dp-badge--${normalizedType}">${icon}<span>${escapeHtml(label)}</span></span>`;
  }

  function createMarkerElement(iconKey, options = {}){
    const el = global.document.createElement('div');
    el.className = 'dp-marker dp-marker--icon';
    const svg = createSvgElement(iconKey, { mode: 'marker', color: options.color || getCategoryColor(iconKey), size: options.size || 30 });
    if(svg) el.replaceChildren(svg);
    else el.hidden = true;
    return el;
  }

  function getMapImageName(variantKey){
    return `dp-map-icon-${variantKey}`;
  }

  function getPoiCircleColorExpression(group){
    if(group === 'water'){
      return [
        'case',
        ['==', ['get', 'amenity'], 'drinking_water'], '#4E90A8',
        ['==', ['get', 'amenity'], 'fountain'], '#2E7FA8',
        ['==', ['get', 'natural'], 'spring'], '#228B22',
        ['==', ['get', 'man_made'], 'water_tap'], '#0077BE',
        ['==', ['get', 'amenity'], 'water_point'], '#5DB8D0',
        '#5A5548',
      ];
    }
    if(group === 'huts'){
      return [
        'case',
        ['==', ['get', 'tourism'], 'alpine_hut'], '#8A5A16',
        ['==', ['get', 'tourism'], 'wilderness_hut'], '#B0741C',
        '#5A5548',
      ];
    }
    if(group === 'food'){
      return [
        'case',
        ['==', ['get', 'amenity'], 'bar'], '#9C3A25',
        ['==', ['get', 'amenity'], 'pub'], '#7A2818',
        ['==', ['get', 'amenity'], 'cafe'], '#D6A038',
        ['==', ['get', 'amenity'], 'restaurant'], '#C4652F',
        ['==', ['get', 'amenity'], 'fast_food'], '#C4652F',
        ['==', ['get', 'amenity'], 'ice_cream'], '#D6A038',
        ['==', ['get', 'amenity'], 'biergarten'], '#9C3A25',
        '#5A5548',
      ];
    }
    if(group === 'places'){
      // Trail-amenity features carry a first-class `kind` property.
      return [
        'case',
        ['==', ['get', 'kind'], 'viewpoint'], '#28736B',
        ['==', ['get', 'kind'], 'picnic'], '#4E7256',
        ['==', ['get', 'kind'], 'toilets'], '#5B7A99',
        ['==', ['get', 'kind'], 'information'], '#28736B',
        '#5A5548',
      ];
    }
    return '#5A5548';
  }

  function getPoiClusterColor(group){
    if(group === 'water') return '#4E90A8';
    if(group === 'huts') return '#8A5A16';
    if(group === 'food') return '#9C3A25';
    if(group === 'places') return '#28736B';
    return '#5A5548';
  }

  function getPoiMapIconExpression(group){
    if(group === 'water'){
      return [
        'case',
        ['==', ['get', 'amenity'], 'drinking_water'], getMapImageName('water-drinking'),
        ['==', ['get', 'amenity'], 'fountain'], getMapImageName('water-fountain'),
        ['==', ['get', 'natural'], 'spring'], getMapImageName('water-spring'),
        ['==', ['get', 'man_made'], 'water_tap'], getMapImageName('water-tap'),
        ['==', ['get', 'amenity'], 'water_point'], getMapImageName('water-point'),
        ['==', ['get', 'amenity'], 'toilets'], getMapImageName('toilets'),
        getMapImageName('unknown'),
      ];
    }
    if(group === 'huts'){
      return [
        'case',
        ['==', ['get', 'tourism'], 'alpine_hut'], getMapImageName('hut-alpine'),
        ['==', ['get', 'tourism'], 'wilderness_hut'], getMapImageName('hut-wilderness'),
        ['==', ['get', 'amenity'], 'shelter'], getMapImageName('hut-shelter'),
        getMapImageName('unknown'),
      ];
    }
    if(group === 'food'){
      return [
        'case',
        ['==', ['get', 'amenity'], 'bar'], getMapImageName('food-bar'),
        ['==', ['get', 'amenity'], 'pub'], getMapImageName('food-pub'),
        ['==', ['get', 'amenity'], 'cafe'], getMapImageName('food-cafe'),
        ['==', ['get', 'amenity'], 'restaurant'], getMapImageName('food-restaurant'),
        ['==', ['get', 'amenity'], 'fast_food'], getMapImageName('food-fast'),
        ['==', ['get', 'amenity'], 'ice_cream'], getMapImageName('food-icecream'),
        ['==', ['get', 'amenity'], 'biergarten'], getMapImageName('food-biergarten'),
        getMapImageName('unknown'),
      ];
    }
    if(group === 'places'){
      return [
        'case',
        ['==', ['get', 'kind'], 'viewpoint'], getMapImageName('viewpoint'),
        ['==', ['get', 'kind'], 'picnic'], getMapImageName('picnic'),
        ['==', ['get', 'kind'], 'toilets'], getMapImageName('toilets'),
        ['==', ['get', 'kind'], 'sight'], getMapImageName('sight'),
        ['==', ['get', 'kind'], 'information'], getMapImageName('information'),
        getMapImageName('unknown'),
      ];
    }
    return getMapImageName('unknown');
  }

  /**
   * Rasterize an SVG string to ImageData via <img> + canvas.
   *
   * Why not map.loadImage(): MapLibre GL v4+ made loadImage Promise-based
   * (the old callback form is silently ignored — awaiting a wrapper around
   * it hangs forever and killed everything queued after it: layer setup,
   * the Layers filter panel, POI clicks). And even the Promise form can't
   * decode SVG data URIs in Chromium (createImageBitmap limitation).
   * An HTMLImageElement decodes SVG data URIs everywhere.
   * Always resolves (with null on failure) — never blocks map setup.
   */
  function rasterizeSvg(svgMarkup, pixelSize){
    return new Promise((resolve) => {
      try {
        const img = new global.Image();
        img.onload = () => {
          try {
            const canvas = global.document.createElement('canvas');
            canvas.width = pixelSize;
            canvas.height = pixelSize;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, pixelSize, pixelSize);
            resolve(ctx.getImageData(0, 0, pixelSize, pixelSize));
          } catch (e) { resolve(null); }
        };
        img.onerror = () => resolve(null);
        img.src = svgDataUri(svgMarkup);
      } catch (e) { resolve(null); }
    });
  }

  function registerMapImages(map){
    if(!map || typeof map.addImage !== 'function' || !global.document) return Promise.resolve();
    const loads = Object.entries(MAP_ICON_VARIANTS).map(([variantKey, config]) => {
      const imageName = getMapImageName(variantKey);
      if(map.hasImage && map.hasImage(imageName)) return Promise.resolve();
      const svg = renderIconSvg(config.icon, { mode: 'map', color: config.color, size: 30 });
      return rasterizeSvg(svg, 60).then((imageData) => {
        try {
          if(imageData && (!map.hasImage || !map.hasImage(imageName))){
            map.addImage(imageName, imageData, { pixelRatio: 2 });
          }
        } catch (e) { /* a missing icon must never break the map */ }
      });
    });
    return Promise.all(loads);
  }

  function hydrate(root){
    if(!root || typeof root.querySelectorAll !== 'function') return;
    root.querySelectorAll('[data-dp-icon]').forEach((el) => {
      const iconKey = normalizeIconKey(el.getAttribute('data-dp-icon') || 'unknown');
      const mode = normalizeMode(el.getAttribute('data-dp-icon-mode') || 'inline');
      const color = normalizeColor(el.getAttribute('data-dp-icon-color') || getCategoryColor(iconKey), iconKey);
      const size = normalizeSize(el.getAttribute('data-dp-icon-size'), mode);
      el.classList.add('dp-icon-host', `dp-icon-host--${mode}`);
      const svg = createSvgElement(iconKey, { mode, color, size });
      if(svg) el.replaceChildren(svg);
    });
  }

  const api = {
    ICON_MIN_ZOOM,
    badgeHtml,
    chipHtml,
    createMarkerElement,
    createSvgElement,
    escapeHtml,
    getCategoryColor,
    getMapImageName,
    getPoiCircleColorExpression,
    getPoiClusterColor,
    getPoiMapIconExpression,
    hydrate,
    legendItemHtml,
    registerMapImages,
    renderIconSvg,
  };

  global.DoloPawsIcons = api;

  if(typeof module !== 'undefined' && module.exports){
    module.exports = api;
  }

  if(global.document){
    if(global.document.readyState === 'loading'){
      global.document.addEventListener('DOMContentLoaded', () => hydrate(global.document));
    } else {
      hydrate(global.document);
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
