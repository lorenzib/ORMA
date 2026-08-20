#!/usr/bin/env node
/**
 * generate-trail-pages.js — ORMA static trail page generator.
 *
 * Reads the three trail datasets plus trail-audits.js, assigns regions via
 * regions-config.js, and emits:
 *
 *   trails/<slug>.html   one crawlable, pre-rendered page per trail
 *   sitemap.xml          all public pages + every trail page
 *
 * Run at build time only (GitHub Actions or locally). Nothing here ships
 * as client-side JS. Pages reuse styles.css so they match the live site.
 *
 * Usage: node scripts/generate-trail-pages.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const evidenceContract = require('../trust/evidence-v1.js');
const recommendationContract = require('../scoring/recommendation-v1.js');
const { loadProductionTrails } = require('./load-production-trails');
const { buildCanonicalCatalog } = require('./trail-adapter');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'trails');
const BASE_URL = 'https://www.app-orma.com';

// ---------------------------------------------------------------
// 1. Load trail data exactly the way the browser does: concatenate
//    the scripts so they share one scope, then hand back `trails`.
// ---------------------------------------------------------------
function loadTrails() {
  return loadProductionTrails(ROOT);
}

// ---------------------------------------------------------------
// 2. Helpers
// ---------------------------------------------------------------
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugify(name) {
  return String(name)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function truncate(s, n) {
  s = String(s || '').trim();
  if (s.length <= n) return s;
  return s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…';
}

function safetyClass(level) {
  if (level === 'low-risk') return 'safety-low';
  if (level === 'moderate') return 'safety-moderate';
  return 'safety-caution';
}

function safetyLabel(level) {
  if (level === 'low-risk') return 'Low-risk terrain';
  if (level === 'moderate') return 'Moderate';
  return 'Caution';
}

function displaySafetyLabel(t) {
  return safetyLabel(t.safetyLevel);
}

function displayWaterLabel(t, label) {
  if (t.curated !== false) return label;
  return String(label || 'Water point')
    .replace(/Drinking water\s*\(OSM-verified location\)/i, 'Water point mapped in OpenStreetMap')
    .replace(/OSM-verified/gi, 'mapped in OpenStreetMap');
}

function displayStartLabel(t, label) {
  if (t.curated !== false) return label;
  const cleaned = String(label || 'Route start')
    .replace(/^Start here\s*[—-]\s*/i, '')
    .replace(/^Route start per OpenStreetMap\s*[—-]\s*/i, '')
    .replace(/\s*\(OSM-verified access point\)/gi, '')
    .replace(/OSM-verified/gi, 'mapped in OpenStreetMap');
  return `Mapped start suggestion — ${cleaned}. Check current access before travelling.`;
}

const REGION_LABEL = { dolomites: 'Dolomites, Italy', savoy: 'Savoy, France' };
const REVIEW_CATEGORIES = ['water', 'heat', 'exposure', 'livestock', 'surfaceHazards', 'access'];
const GRADUATION_CATEGORIES = ['photo', 'route', 'mapPoints', 'elevation', ...REVIEW_CATEGORIES];

function reviewProgress(t) {
  if (!t.verified || !Array.isArray(t.verified.categories)) return null;
  return REVIEW_CATEGORIES.filter(category => t.verified.categories.includes(category));
}

function graduationProgress(t) {
  if (!t.graduation || !Array.isArray(t.graduation.completed)) return null;
  const required = Array.isArray(t.graduation.required) && t.graduation.required.length
    ? t.graduation.required
    : GRADUATION_CATEGORIES;
  const completed = required.filter(check => t.graduation.completed.includes(check));
  return {
    completed: completed.length,
    total: required.length,
    verified: t.graduation.status === 'verified' && completed.length === required.length,
  };
}

function categoryVerified(t, category) {
  const progress = reviewProgress(t);
  return progress === null || progress.includes(category);
}

function formatReviewDate(value) {
  return evidenceContract.dateText(value);
}

// Valley hub guides (add here as new area guides are published)
const VALLEY_GUIDES = {
  'Val Gardena': { href: '../guides/dog-friendly-hikes-val-gardena.html', label: 'Dog-friendly hikes in Val Gardena' },
  'Alta Pusteria – Tre Cime': { href: '../guides/dog-friendly-hikes-lago-di-braies.html', label: 'Lago di Braies & Tre Cime with a dog' },
};

// ---------------------------------------------------------------
// 2b. Per-trail visuals & computed copy (all derived from data —
//     nothing invented; sections skip cleanly when data is absent)
// ---------------------------------------------------------------

// Inline SVG of the route line — same idea as the browse-page cards.
function routeSvg(t) {
  if (!Array.isArray(t.path) || t.path.length < 2) return '';
  const lats = t.path.map((p) => p[0]);
  const lngs = t.path.map((p) => p[1]);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const W = 640, H = 280, pad = 24;
  const spanLat = (maxLat - minLat) || 1e-4;
  const spanLng = (maxLng - minLng) || 1e-4;
  const s = Math.min((W - pad * 2) / spanLng, (H - pad * 2) / spanLat);
  const pts = t.path.map(([lat, lng]) =>
    `${(pad + (lng - minLng) * s + (W - pad * 2 - spanLng * s) / 2).toFixed(1)},${(pad + (maxLat - lat) * s + (H - pad * 2 - spanLat * s) / 2).toFixed(1)}`
  ).join(' ');
  const [sx, sy] = pts.split(' ')[0].split(',');
  return `<svg class="sp-route" viewBox="0 0 ${W} ${H}" role="img" aria-label="Route shape of ${escapeHtml(t.name)}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${W}" height="${H}" rx="12" fill="#E7ECE3"/>
    <polyline points="${pts}" fill="none" stroke="#2E4034" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${sx}" cy="${sy}" r="6" fill="#2E4034" stroke="#fff" stroke-width="2"/>
  </svg>`;
}

const RESPONSIVE_PHOTOS = {
  'images/lago-di-braies.webp': { widths:[480, 900], fallback:'images/lago-di-braies.jpg' },
  'images/lago-di-carezza.webp': { widths:[480, 900], fallback:'images/lago-di-carezza.jpg' },
  'images/boucle-du-marais-des-chassettes.webp': { widths:[480, 960, 1280], fallback:'images/boucle-du-marais-des-chassettes.jpg' },
  'images/circuit-beatrice-de-savoie.webp': { widths:[480, 960, 1280], fallback:'images/circuit-beatrice-de-savoie.jpg' },
  'images/itineraire-decouverte-de-la-nature.webp': { widths:[480, 960, 1280], fallback:'images/itineraire-decouverte-de-la-nature.jpg' },
};

function remoteAsset(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

function trailPageAssetUrl(value) {
  const asset = String(value || '').trim();
  return remoteAsset(asset) ? asset : `../${asset.replace(/^\/+/, '')}`;
}

function publicAssetUrl(value) {
  const asset = String(value || '').trim();
  return remoteAsset(asset) ? asset : `${BASE_URL}/${asset.replace(/^\/+/, '')}`;
}

function photoHtml(t) {
  if(!t.imageIcon) return '';
  const responsive = RESPONSIVE_PHOTOS[t.imageIcon];
  const alt = t.imageAlt || t.name;
  if(!responsive) return `<img class="sp-img" src="${escapeHtml(trailPageAssetUrl(t.imageIcon))}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async">`;
  const stem = t.imageIcon.replace(/\.webp$/, '');
  const srcset = responsive.widths.map((width, index) => {
    const source = width === 900 ? t.imageIcon : `${stem}-${width}.webp`;
    return `../${source} ${width}w`;
  }).join(', ');
  return `<picture>
    <source type="image/webp" srcset="${srcset}" sizes="(max-width: 760px) 100vw, 1100px">
    <img class="sp-img" src="../${responsive.fallback}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async">
  </picture>`;
}

// Inline SVG of the elevation profile.
function elevSvg(t) {
  const ep = t.elevationProfile;
  if (!Array.isArray(ep) || ep.length < 2) return '';
  const kms = ep.map((p) => p.km), els = ep.map((p) => p.elev);
  const minE = Math.min(...els), maxE = Math.max(...els);
  const maxK = Math.max(...kms) || 1;
  const spanE = (maxE - minE) || 1;
  const W = 640, H = 150, padX = 34, padY = 18;
  const X = (km) => padX + (km / maxK) * (W - padX * 2);
  const Y = (e) => padY + (1 - (e - minE) / spanE) * (H - padY * 2);
  const line = ep.map((p, i) => `${i ? 'L' : 'M'}${X(p.km).toFixed(1)},${Y(p.elev).toFixed(1)}`).join(' ');
  const area = `${line} L${X(maxK).toFixed(1)},${H - padY} L${padX},${H - padY} Z`;
  return `<figure class="sp-elev">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Elevation profile: ${minE} to ${maxE} m" xmlns="http://www.w3.org/2000/svg">
      <path d="${area}" fill="#2E4034" opacity="0.12"/>
      <path d="${line}" fill="none" stroke="#2E4034" stroke-width="2.5" stroke-linejoin="round"/>
      <text x="${padX}" y="${padY - 5}" font-size="12" fill="#666">${maxE} m</text>
      <text x="${padX}" y="${H - 4}" font-size="12" fill="#666">${minE} m</text>
      <text x="${W - padX}" y="${H - 4}" font-size="12" fill="#666" text-anchor="end">${maxK} km</text>
    </svg>
    <figcaption class="sp-src">Elevation profile: lowest ${minE} m, highest ${maxE} m.</figcaption>
  </figure>`;
}

function highestPoint(t) {
  const ep = t.elevationProfile;
  if (!Array.isArray(ep) || !ep.length) return null;
  return Math.max(...ep.map((p) => p.elev));
}

function isLoop(t) {
  if (!Array.isArray(t.path) || t.path.length < 3) return null;
  const a = t.path[0], b = t.path[t.path.length - 1];
  const dLat = (a[0] - b[0]) * 111320;
  const dLng = (a[1] - b[1]) * 111320 * Math.cos((a[0] * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng) < 120;
}

// A short, factual "at a glance" paragraph for imported trails, so the 147
// OSM pages read differently from one another. Every clause is computed
// from the trail's own data; sentence choice is keyed to the data, not random.
function atAGlance(t) {
  const bits = [];
  const loop = isLoop(t);
  const gain = typeof t.elevation === 'number' ? t.elevation : null;

  if (loop === true) bits.push(`This is a true loop: it closes back on its own start point, so there's no return leg to plan`);
  else if (loop === false) bits.push(`This is a point-to-point route, so plan the return: retrace your steps or check local buses`);

  if (gain !== null) {
    if (gain < 150) bits.push(`with only ${gain} m of climbing, it's one of the gentler options in the area for older dogs or hot days`);
    else if (gain < 400) bits.push(`the ${gain} m of climbing is steady rather than steep, a fair ask for most fit dogs`);
    else if (gain < 700) bits.push(`${gain} m of gain over ${t.distance} km is a real climb: budget rests, and halve expectations for short-legged dogs`);
    else bits.push(`${gain} m of climbing makes this a big physical day, for conditioned dogs only, with turn-back discipline`);
  }

  // Water/hut counts are NOT repeated here: the dedicated sections below
  // list them. Only the absence of water is called out (no section then).
  const w = Array.isArray(t.waterSources) ? t.waterSources.length : 0;
  if (w === 0) bits.push(`no water points are mapped on this route, so carry everything your dog will drink`);

  if (!bits.length) return '';
  const text = bits.join('; ') + '.';
  return `<h2>At a glance</h2>
    <p>${text.charAt(0).toUpperCase() + text.slice(1)}</p>`;
}

// Up to 4 other trails in the same valley (fill from region if needed).
function nearbySection(t, slug, all) {
  const sameValley = all.filter((o) => o.slug !== slug && o.valley === t.valley);
  const sameRegion = all.filter((o) => o.slug !== slug && o.region === t.region && o.valley !== t.valley);
  const picks = sameValley.slice(0, 4);
  for (const o of sameRegion) { if (picks.length >= 4) break; picks.push(o); }
  if (!picks.length) return '';
  const items = picks.map((o) =>
    `<a class="sp-near" href="../trail.html?id=${encodeURIComponent(o.id)}">
        <span class="sp-near-name">${escapeHtml(o.name)}</span>
        <span class="sp-near-meta"><span class="dp-badge dp-badge--${o.safetyLevel}"><span data-dp-icon="${o.safetyLevel === 'low-risk' ? 'verified' : 'warning'}" data-dp-icon-size="13" aria-hidden="true"></span><span>${displaySafetyLabel(o)}</span></span> ${o.distance} km</span>
      </a>`
  ).join('\n      ');
  const hub = VALLEY_GUIDES[t.valley];
  const hubLine = hub
    ? `\n    <p>Planning a few days here? Read our area guide: <a href="${hub.href}">${escapeHtml(hub.label)}</a>.</p>`
    : '';
  return `<h2>Nearby trails</h2>
    <div class="sp-near-grid">
      ${items}
    </div>${hubLine}`;
}

// ---------------------------------------------------------------
// 3. Page template
// ---------------------------------------------------------------
function trailPage(t, slug, all) {
  const title = `${t.name} — dog-friendly trail — ORMA`;
  const desc = truncate(
    t.desc || `${t.name}: a ${t.distance} km dog-friendly trail near ${t.area}.`,
    155
  );
  const canonical = `${BASE_URL}/trails/${slug}.html`;
  const regionLabel = REGION_LABEL[t.region] || 'Dolomites, Italy';
  const verified = t.curated !== false; // curated file entries have no `curated` flag
  const graduation = graduationProgress(t);
  const progress = reviewProgress(t);
  const fullyReviewed = graduation
    ? graduation.verified
    : progress
      ? progress.length === REVIEW_CATEGORIES.length
      : verified;
  const reviewLabel = fullyReviewed ? 'Verified by ORMA' : 'Imported trail';
  const reviewStyle = fullyReviewed ? 'verified' : 'imported';
  const badge = `<span class="dp-badge dp-badge--${reviewStyle}"><span data-dp-icon="${reviewStyle}" data-dp-icon-size="13" aria-hidden="true"></span><span>${reviewLabel}</span></span>`;

  const ogImage = t.imageIcon ? publicAssetUrl(t.imageIcon) : `${BASE_URL}/icon-512.png`;

  // Guard against upstream "NaN%" surface strings (promote-osm-trails.js bug)
  const terrain = !categoryVerified(t, 'surfaceHazards')
    ? (t.terrainType || 'Variable mountain terrain')
    : /NaN/.test(String(t.terrainType || ''))
    ? 'Surface data not yet mapped'
    : t.terrainType;

  const highest = highestPoint(t);
  const facts = [
    ['Distance', `${t.distance} km`],
    ['Elevation gain', t.elevation != null ? `${t.elevation} m` : null],
    ['Highest point', highest !== null ? `${highest} m` : null],
    ['Duration', t.hours != null ? `${t.hours} h` : null],
    ['Terrain', terrain],
    ['Trail rating', displaySafetyLabel(t)],
    ['Area', `${t.area} · ${regionLabel}`],
  ]
    .filter(([, v]) => v != null && v !== '')
    .map(
      ([k, v]) =>
        `<div class="sp-fact"><div class="sp-fact-k">${escapeHtml(k)}</div><div class="sp-fact-v">${escapeHtml(v)}</div></div>`
    )
    .join('\n      ');

  const waterHtml = !categoryVerified(t, 'water')
    ? `<h2>Bring your own water</h2><p>Do not rely on potential water locations being available or drinkable. Carry enough for the full walk.</p>`
    :
    Array.isArray(t.waterSources) && t.waterSources.length
      ? `<h2><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style="flex:none;vertical-align:-2.5px;margin-right:2px;"><path d="M12 3c3 3.6 4.8 6.3 4.8 8.8a4.8 4.8 0 11-9.6 0C7.2 9.3 9 6.6 12 3z" fill="#378ADD"></path></svg> ${verified ? 'Water on trail' : 'Potential water points'}</h2>
    <ul>${t.waterSources
          .map((w) => `<li>km ${escapeHtml(w.km)} · ${escapeHtml(displayWaterLabel(t, w.label))}</li>`)
          .join('')}</ul>${verified ? '' : '<p class="sp-src">Availability can change. Carry a full supply.</p>'}`
      : '';

  const rifugiHtml =
    Array.isArray(t.rifugi) && t.rifugi.length
      ? `<h2><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style="flex:none;vertical-align:-2.5px;margin-right:2px;"><path d="M4 11l8-7 8 7" fill="none" stroke="#8A5A16" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path><path d="M6 10v9h12v-9" fill="#D6A038" stroke="#8A5A16" stroke-width="1.6" stroke-linejoin="round"></path><path d="M10 19v-5h4v5" fill="#8A5A16"></path></svg> Rifugi &amp; refreshment</h2>
    <ul>${t.rifugi
          .map((r) => `<li>km ${escapeHtml(r.km)} · ${escapeHtml(r.name || 'Rifugio')}</li>`)
          .join('')}</ul>`
      : '';

  const tipsHtml = t.tips || !verified
    ? `<h2>Good to know</h2>
    <p>${verified ? escapeHtml(t.tips) : 'Use the live forecast, check local access information and be ready for changing mountain conditions.'}</p>`
    : '';

  const startHtml =
    t.startPoint && t.startPoint.label
      ? `<h2><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style="flex:none;vertical-align:-2.5px;margin-right:2px;"><path d="M7 21V4" stroke="#2E4034" stroke-width="2" stroke-linecap="round"></path><path d="M7 5h10l-2.4 3.5L17 12H7z" fill="#E24B4A"></path></svg> Where to start</h2>
    <p>${escapeHtml(displayStartLabel(t, t.startPoint.label))}</p>`
      : '';

  const insightsHtml =
    Array.isArray(t.insights) && t.insights.length
      ? `<h2>Field notes</h2>
    ${t.insights
          .map((i) => {
            const srcLabel = i.source ? escapeHtml(i.source) : '';
            const src = i.url
              ? ` <span class="sp-src">· <a href="${escapeHtml(i.url)}" rel="noopener">${srcLabel}</a></span>`
              : srcLabel
                ? ` <span class="sp-src">· ${srcLabel}</span>`
                : '';
            return `<p>${escapeHtml(i.en || '')}${src}</p>`;
          })
          .join('\n    ')}`
      : '';

  const reviewSummary = graduation
    ? graduation.verified
      ? 'This trail has been reviewed by ORMA. Check current conditions before setting out.'
      : 'Based on mapped route data and available ORMA sources. Check current conditions before setting out.'
    : progress
      ? progress.length === REVIEW_CATEGORIES.length
        ? 'Trail details have been source-checked by ORMA. Check current conditions before setting out.'
        : 'Based on mapped route data and available ORMA sources. Check current conditions before setting out.'
      : t.routeAudit && t.reviewedAt
        ? 'Route details have been reviewed by ORMA. Check current conditions before setting out.'
        : !verified
          ? 'Based on mapped route data and available ORMA sources. Check local access rules and current conditions before setting out.'
          : 'Trail information prepared by ORMA. Check current conditions before setting out.';
  const sourceLinks = Array.isArray(t.sourceLinks) && t.sourceLinks.length
    ? `<ul>${t.sourceLinks.map(source => `<li><a href="${escapeHtml(source.url)}" rel="noopener">${escapeHtml(source.label)}</a></li>`).join('')}</ul>`
    : '';
  const sourceRecord = `<h2>Sources &amp; data</h2>
    <details class="sp-source-details"><summary>View source details</summary>
      <p>${escapeHtml(reviewSummary)}</p>
${sourceLinks}
      <p class="sp-src">Map data: <a href="https://www.openstreetmap.org/copyright" rel="noopener">OpenStreetMap contributors</a> and Waymarked Trails<br>Weather: Open-Meteo</p>
    </details>`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TouristAttraction',
    name: t.name,
    description: desc,
    url: canonical,
    geo: { '@type': 'GeoCoordinates', latitude: t.lat, longitude: t.lng },
    isAccessibleForFree: !t.paid,
    address: { '@type': 'PostalAddress', addressCountry: t.region === 'savoy' ? 'FR' : 'IT' },
  };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'All trails', item: `${BASE_URL}/browse-trails.html` },
      { '@type': 'ListItem', position: 2, name: regionLabel, item: `${BASE_URL}/browse-trails.html` },
      { '@type': 'ListItem', position: 3, name: t.name, item: canonical },
    ],
  };

  const glanceHtml = !verified ? atAGlance(t) : '';
  const routeHtml = routeSvg(t);
  const elevHtml = elevSvg(t);
  const nearbyHtml = nearbySection(t, slug, all);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}">
<link rel="canonical" href="${canonical}">
<meta name="theme-color" content="#2E4034">
<meta property="og:type" content="article">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(desc)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${escapeHtml(ogImage)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" sizes="32x32" href="../favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="../favicon-16.png">
<link rel="apple-touch-icon" href="../apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../styles.css?v=20260818-17">
<style>
  .sp-hero{padding-top:28px;}
  .sp-breadcrumb{font-size:.85rem;color:var(--ink-soft,#666);margin-bottom:14px;}
  .sp-breadcrumb a{color:inherit;}
  .sp-badges{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:10px 0 18px;}
  .sp-facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:18px 0 26px;}
  .sp-fact{background:rgba(0,0,0,.035);border-radius:10px;padding:10px 14px;}
  .sp-fact-k{font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;color:var(--ink-soft,#666);}
  .sp-fact-v{font-weight:600;margin-top:2px;}
  .sp-body h2{margin-top:28px;}
  .sp-src{font-size:.85rem;color:var(--ink-soft,#666);}
  .sp-source-details{font-size:.9rem;color:var(--ink-soft,#666);}
  .sp-source-details summary{cursor:pointer;font-weight:700;color:var(--forest,#2E4034);}
  .sp-cta{display:inline-block;margin:26px 0;padding:12px 22px;background:#2E4034;color:#fff;border-radius:10px;font-weight:600;text-decoration:none;}
  .sp-img{max-width:100%;width:480px;max-height:300px;object-fit:cover;border-radius:12px;margin:6px 0 14px;display:block;}
  .sp-route{max-width:100%;width:640px;display:block;margin:6px 0 14px;}
  .sp-elev{margin:14px 0;}
  .sp-elev svg{max-width:100%;width:640px;display:block;}
  .sp-near-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;margin:14px 0;}
  .sp-near{display:block;border:1px solid var(--paper-line,#ddd);border-radius:12px;padding:13px 15px;text-decoration:none;color:inherit;background:var(--card,#fff);}
  .sp-near:hover{border-color:#2E4034;}
  .sp-near-name{display:block;font-weight:700;font-size:14.5px;margin-bottom:6px;}
  .sp-near-meta{display:block;font-size:12.5px;color:var(--ink-soft,#666);}
</style>
<script type="application/ld+json">
${JSON.stringify(jsonLd, null, 1)}
</script>
<script type="application/ld+json">
${JSON.stringify(breadcrumbLd, null, 1)}
</script>
</head>
<body data-scoring-version="${recommendationContract.VERSION}">

<div class="topnav">
  <a class="brand" href="../index.html"><img src="../logo.svg?v=3" alt="ORMA logo">ORMA</a>
  <div class="links">
    <a href="../browse-trails.html" class="active">Browse all Trails</a>
    <a href="../browse-trails.html#collections">Collections</a>
    <a href="../safety-guide.html">Safety guide</a>
    <a href="../journal.html">My walk journal</a>
    <a class="account-btn" href="../index.html?view=login&amp;next=trails/${slug}.html" data-i18n="nav.login">Log in</a>
  </div>
</div>

<div class="wrap sp-hero">
  <div class="sp-breadcrumb"><a href="../browse-trails.html">All trails</a> › ${escapeHtml(regionLabel)} › ${escapeHtml(t.valley || t.area)}</div>
  <h1>${escapeHtml(t.name)}</h1>
  <div class="sp-badges">
    <span class="dp-badge dp-badge--${t.safetyLevel}"><span data-dp-icon="${t.safetyLevel === 'low-risk' ? 'verified' : 'warning'}" data-dp-icon-size="13" aria-hidden="true"></span><span>${displaySafetyLabel(t)}</span></span>
    ${badge}
    ${t.paid ? '<span class="dp-badge dp-badge--neutral"><span>Paid access</span></span>' : ''}
  </div>
  ${t.imageIcon ? photoHtml(t) : routeHtml}
  ${t.imageIcon && t.imageCredit ? `<p class="sp-src" style="margin:-8px 0 14px;">${t.imageCredit.bare ? '' : 'Photo: '}${t.imageCredit.url ? `<a href="${escapeHtml(t.imageCredit.url)}" rel="noopener nofollow">${escapeHtml(t.imageCredit.text)}</a>` : escapeHtml(t.imageCredit.text)}</p>` : ''}
  ${!t.imageIcon && t.imagePlaceholder ? `<p class="sp-src" style="display:flex;align-items:center;gap:8px;margin:-6px 0 14px;"><img src="../logo.svg" alt="" width="22" height="22" style="flex:none;"> We're working on adding photos of this trail.</p>` : ''}
  <p>${escapeHtml(t.desc || '')}</p>

  <div class="sp-facts">
      ${facts}
  </div>

  <a class="sp-cta" href="../trail.html?id=${encodeURIComponent(t.id)}">Open the full trail guide →</a>

  <div class="sp-body">
    ${glanceHtml}
    ${elevHtml}
    ${startHtml}
    ${waterHtml}
    ${rifugiHtml}
    ${tipsHtml}
    ${insightsHtml}
    ${sourceRecord}
    <div id="dogFit">
    <h2>Is this trail right for <em>your</em> dog?</h2>
    <p>The trail rating above describes the mountain, and it's the same for every dog. What it can't tell you is how this route pairs with your dog's build, age, and health. <a href="../account.html?next=trail.html%3Fid%3D${encodeURIComponent(t.id)}">Create your dog's free profile</a> for a personalised match.</p>
    </div>
    <script>
    (function(){
      try{
        var raw = localStorage.getItem('dolopaws-profile-summary');
        if(!raw) return; // guest: keep the static pitch above
        var p = JSON.parse(raw);
        var box = document.getElementById('dogFit');
        if(!box || !p) return;
        var esc = function(s){ var d = document.createElement('div'); d.textContent = s; return d.innerHTML; };
        if(p.hasProfile){
          var n = p.name ? esc(p.name) : 'your dog';
          box.innerHTML = '<h2>Is this trail right for <em>' + n + '</em>?</h2>'
            + '<p>' + n + '\u2019s profile is saved. Open the interactive trail guide to see their personalised match and any cautions.</p>'
            + '<p><a href="../trail.html?id=${encodeURIComponent(t.id)}">See ' + n + '\u2019s match for this trail \u2192</a></p>';
        } else {
          box.innerHTML = '<h2>One step left: save your dog\u2019s profile</h2>'
            + '<p>You\u2019re signed in, but there\u2019s no dog profile saved yet. Add your dog\u2019s build, age and health once, and every trail, including this one, gets a personal match score.</p>'
            + '<p><a href="../account.html?next=trail.html%3Fid%3D${encodeURIComponent(t.id)}">Finish your dog\u2019s profile \u2192</a></p>';
        }
      }catch(e){}
    })();
    </script>
    <p class="sp-src">Before you go: <a href="../safety-guide.html">the dog safety guide</a> · <a href="../guides/water-for-dogs-on-trail.html">water for dogs on trail</a> · <a href="../guides/dogs-on-cable-cars.html">dogs on cable cars</a> · <a href="../guides/livestock-guard-dogs.html">meeting a guardian dog</a></p>
    ${nearbyHtml}
  </div>
</div>

<footer class="site-footer hp-footer">
  <div class="hp-footer-grid">
    <div>
      <div class="hp-footer-brand"><img src="../logo.svg?v=5" alt=""><span>ORMA</span></div>
      <p class="hp-footer-blurb">The personalised trail guide for dogs and their humans, so every footprint left on the mountain is a safe one.</p>
    </div>
    <div>
      <div class="hp-footer-h">Trails</div>
      <div class="hp-footer-links">
        <a href="../how-scoring-works.html">How scoring works</a>
        <a href="../browse-trails.html">Browse all Trails</a>
        <a href="../collections.html">Collections</a>
        <a href="../compare.html">Compare trails</a>
      </div>
    </div>
    <div>
      <div class="hp-footer-h">Caring for your dog</div>
      <div class="hp-footer-links">
        <a href="../guides/water-for-dogs-on-trail.html">Heat &amp; hydration</a>
        <a href="../guides/paw-protection.html">Paw protection</a>
        <a href="../guides/breed-group-caveats.html">Breed group caveats</a>
        <a href="../guides/alpine-plants-for-dogs.html">Alpine plants guide</a>
      </div>
    </div>
    <div>
      <div class="hp-footer-h">Your walks</div>
      <div class="hp-footer-links">
        <a href="../journal.html">My walk journal</a>
        <a href="../saved.html">Saved trails</a>
        <a href="../downloads.html">Downloaded trails</a>
        <a href="../walk.html">Record a walk</a>
      </div>
    </div>
    <div>
      <div class="hp-footer-h">Connect</div>
      <div class="hp-footer-links">
        <a href="../about.html">Instagram</a>
        <a href="../about.html">Newsletter</a>
        <a href="../contact.html">Support</a>
      </div>
    </div>
    <div>
      <div class="hp-footer-h">Company</div>
      <div class="hp-footer-links">
        <a href="../about.html">About us</a>
        <a href="../contact.html">Contact</a>
        <a href="../privacy.html">Privacy</a>
        <a href="../terms.html">Terms</a>
      </div>
    </div>
  </div>
  <div class="hp-footer-base">
    <span>© 2026 ORMA · Rooted in the Italian Dolomites</span>
  </div>
</footer>

<script src="../icon-system.js?v=20260717" defer></script>
<script src="../mobile-nav.js?v=20260815-4"></script>
</body>
</html>
`;
}

// ---------------------------------------------------------------
// 4. Sitemap
// ---------------------------------------------------------------
function sitemap(urls) {
  // Filesystem mtimes change when CI copies the repository, so they cannot
  // produce a reproducible sitemap. Trail-data releases carry one explicit,
  // reviewed date instead.
  const releaseFile = path.join(ROOT, 'data', 'trail-data-release.json');
  const release = JSON.parse(fs.readFileSync(releaseFile, 'utf8'));
  if(release.schemaVersion !== 1 || !/^\d{4}-\d{2}-\d{2}$/.test(release.lastModified || '')){
    throw new Error('data/trail-data-release.json must contain a valid lastModified date');
  }
  const lastmod = release.lastModified;
  const items = urls
    .map(
      (u) => `  <url><loc>${u}</loc><lastmod>${lastmod}</lastmod></url>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</urlset>
`;
}

// ---------------------------------------------------------------
// 5. Crawlable trail index injected into browse-trails.html
//    (between TRAIL-INDEX-START/END markers)
// ---------------------------------------------------------------
function updateBrowseIndex(entries) {
  const file = path.join(ROOT, 'browse-trails.html');
  if (!fs.existsSync(file)) return console.warn('browse-trails.html not found — skipping index.');
  const html = fs.readFileSync(file, 'utf8');
  const START = '<!-- TRAIL-INDEX-START (auto-generated by scripts/generate-trail-pages.js — do not edit by hand) -->';
  const END = '<!-- TRAIL-INDEX-END -->';
  const a = html.indexOf(START);
  const b = html.indexOf(END);
  if (a === -1 || b === -1) return console.warn('Index markers not found in browse-trails.html — skipping.');

  const byRegion = { dolomites: [], savoy: [] };
  for (const e of entries) (byRegion[e.region] || byRegion.dolomites).push(e);
  for (const k of Object.keys(byRegion)) byRegion[k].sort((x, y) => x.name.localeCompare(y.name));

  const block = ['dolomites', 'savoy']
    .filter((r) => byRegion[r].length)
    .map(
      (r) =>
        `<p style="font-weight:700;color:var(--ink);break-inside:avoid;">${escapeHtml(REGION_LABEL[r])}</p>\n` +
        byRegion[r]
          .map((e) => `<a href="trail.html?id=${encodeURIComponent(e.id)}" style="display:block;color:inherit;">${escapeHtml(e.name)}</a>`)
          .join('\n')
    )
    .join('\n');

  fs.writeFileSync(file, html.slice(0, a + START.length) + '\n' + block + '\n' + html.slice(b), 'utf8');
  console.log(`Updated trail index in browse-trails.html (${entries.length} links).`);
}

// ---------------------------------------------------------------
// 6. Main
// ---------------------------------------------------------------
function main() {
  const sourceTrails = loadTrails();
  const catalog = buildCanonicalCatalog(sourceTrails);
  if (catalog.errors.length) {
    throw new Error(
      `Production trail validation failed:\n${catalog.errors.map(error => `- ${error}`).join('\n')}`
    );
  }
  const publishedIds = new Set(
    catalog.records
      .filter(record => record.lifecycle === 'published')
      .map(record => record.id)
  );
  const canonicalSlug = new Map(catalog.records.map(record => [record.id, record.slug]));
  const trails = sourceTrails.filter(trail => publishedIds.has(trail.id));
  console.log(
    `Loaded ${sourceTrails.length} trails; ${trails.length} pass publication validation `
    + `and ${catalog.excluded.length} remain drafts.`
  );

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const seen = new Set();
  const urls = [
    `${BASE_URL}/`,
    `${BASE_URL}/browse-trails.html`,
    `${BASE_URL}/safety-guide.html`,
    `${BASE_URL}/about.html`,
    `${BASE_URL}/how-scoring-works.html`,
    `${BASE_URL}/contact.html`,
    `${BASE_URL}/privacy.html`,
    `${BASE_URL}/terms.html`,
    `${BASE_URL}/guides/dogs-on-cable-cars.html`,
    `${BASE_URL}/guides/livestock-guard-dogs.html`,
    `${BASE_URL}/guides/dog-friendly-hikes-val-gardena.html`,
    `${BASE_URL}/guides/dog-friendly-hikes-lago-di-braies.html`,
    `${BASE_URL}/guides/water-for-dogs-on-trail.html`,
    `${BASE_URL}/guides/dogs-at-rifugi.html`,
    `${BASE_URL}/guides/alpine-plants-for-dogs.html`,
  ];

  // Pass 1: assign slugs so every page can link to its neighbours.
  const entries = [];
  for (const t of trails) {
    const slug = canonicalSlug.get(t.id);
    if (seen.has(slug)) throw new Error(`Duplicate validated slug: ${slug}`);
    seen.add(slug);
    entries.push({ t, slug });
  }
  const all = entries.map(({ t, slug }) => ({
    id: t.id, slug, name: t.name, valley: t.valley, region: t.region,
    distance: t.distance, safetyLevel: t.safetyLevel,
  }));

  // Pass 2: write pages.
  let written = 0;
  const indexEntries = [];
  for (const { t, slug } of entries) {
    fs.writeFileSync(path.join(OUT_DIR, `${slug}.html`), trailPage(t, slug, all), 'utf8');
    urls.push(`${BASE_URL}/trails/${slug}.html`);
    indexEntries.push({ id: t.id, slug, name: t.name, region: t.region });
    written++;
  }

  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemap(urls), 'utf8');
  updateBrowseIndex(indexEntries);

  // Remove stale pages for trails that no longer exist in the datasets
  // (renamed, or pulled entirely — e.g. routes where dogs turned out to be
  // prohibited on the ground). Keeps GitHub Pages from serving orphans.
  let removed = 0;
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (!f.endsWith('.html') || f === 'index.html') continue; // index.html is the directory redirect, not a trail page
    if (!seen.has(f.slice(0, -5))) {
      try { fs.unlinkSync(path.join(OUT_DIR, f)); removed++; }
      catch (e) { console.warn(`Could not remove stale page ${f}: ${e.message}`); }
    }
  }
  if (removed) console.log(`Removed ${removed} stale trail page(s).`);

  console.log(`Wrote ${written} trail pages and sitemap.xml (${urls.length} URLs).`);
}

if(require.main === module) main();

module.exports = { photoHtml, publicAssetUrl, trailPageAssetUrl, trailPage };
