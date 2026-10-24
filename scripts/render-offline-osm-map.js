#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const WIDTH = 1200;
// The two hand-built pilots keep the heights their device tests were run on.
const PILOT_HEIGHTS = Object.freeze({ 'lago-carezza':1140, 'alpe-siusi':720 });

function decodeXml(value){
  return String(value || '')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function attrs(text){
  const result = {};
  String(text || '').replace(/([\w:-]+)="([^"]*)"/g, (_, key, value) => {
    result[key] = decodeXml(value);
    return '';
  });
  return result;
}

function tags(body){
  const result = {};
  String(body || '').replace(/<tag\b([^>]*?)\/>/g, (_, text) => {
    const tag = attrs(text);
    if(tag.k) result[tag.k] = tag.v || '';
    return '';
  });
  return result;
}

function esc(value){
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function readOsm(xml){
  const boundsMatch = xml.match(/<bounds\b([^>]*?)\/>/);
  if(!boundsMatch) throw new Error('OSM extract has no bounds.');
  const boundsAttrs = attrs(boundsMatch[1]);
  const bounds = {
    south: Number(boundsAttrs.minlat),
    west: Number(boundsAttrs.minlon),
    north: Number(boundsAttrs.maxlat),
    east: Number(boundsAttrs.maxlon),
  };

  const nodes = new Map();
  xml.replace(/<node\b([^>]*?)(?:\/>|>([\s\S]*?)<\/node>)/g, (_, text, body) => {
    const node = attrs(text);
    nodes.set(node.id, {
      id: node.id,
      lat: Number(node.lat),
      lng: Number(node.lon),
      tags: tags(body),
    });
    return '';
  });

  const ways = [];
  xml.replace(/<way\b([^>]*)>([\s\S]*?)<\/way>/g, (_, text, body) => {
    const way = attrs(text);
    const refs = [];
    body.replace(/<nd\b([^>]*?)\/>/g, (_match, ndText) => {
      refs.push(attrs(ndText).ref);
      return '';
    });
    ways.push({ id: way.id, refs, tags: tags(body) });
    return '';
  });

  const relations = [];
  xml.replace(/<relation\b([^>]*)>([\s\S]*?)<\/relation>/g, (_, text, body) => {
    const members = [];
    body.replace(/<member\b([^>]*?)\/>/g, (_match, memberText) => {
      const member = attrs(memberText);
      if(member.type === 'way') members.push({ ref: member.ref, role: member.role || 'outer' });
      return '';
    });
    relations.push({ id: attrs(text).id, members, tags: tags(body) });
    return '';
  });
  return { bounds, nodes, ways, relations };
}

/**
 * Closed rings from a multipolygon's member ways. A big lake or forest is
 * stored as a relation whose outline is split over several ways, none closed
 * on its own; joined end to end they close. A ring that cannot close (a member
 * missing from the extract) is left out rather than filled wrongly.
 */
function ringsFrom(memberRefs, waysById){
  const pieces = memberRefs.map(ref => waysById.get(ref)).filter(Boolean).map(way => way.refs.slice());
  const rings = [];
  while(pieces.length){
    let ring = pieces.shift();
    let grown = true;
    while(ring[0] !== ring[ring.length - 1] && grown){
      grown = false;
      for(let index = 0; index < pieces.length; index += 1){
        const piece = pieces[index];
        const head = ring[0];
        const tail = ring[ring.length - 1];
        if(piece[0] === tail) ring = ring.concat(piece.slice(1));
        else if(piece[piece.length - 1] === tail) ring = ring.concat(piece.slice().reverse().slice(1));
        else if(piece[piece.length - 1] === head) ring = piece.concat(ring.slice(1));
        else if(piece[0] === head) ring = piece.slice().reverse().concat(ring.slice(1));
        else continue;
        pieces.splice(index, 1);
        grown = true;
        break;
      }
    }
    if(ring.length > 3 && ring[0] === ring[ring.length - 1]) rings.push(ring);
  }
  return rings;
}

function areaClassFor(t, closed){
  if(!closed) return '';
  if(t.natural === 'water' || t.water === 'lake') return 'water';
  if(t.landuse === 'forest' || t.natural === 'wood') return 'forest';
  if(t.natural === 'scrub') return 'scrub';
  if(['meadow', 'grass'].includes(t.landuse)) return 'meadow';
  if(t.amenity === 'parking') return 'parking';
  if(t.building) return 'building';
  return '';
}

function project(bounds, lat, lng, height){
  const midLat = (bounds.north + bounds.south) / 2 * Math.PI / 180;
  const westX = bounds.west * Math.cos(midLat);
  const eastX = bounds.east * Math.cos(midLat);
  const valueX = lng * Math.cos(midLat);
  return [
    (valueX - westX) / (eastX - westX) * WIDTH,
    (bounds.north - lat) / (bounds.north - bounds.south) * height,
  ];
}

function pointsFor(way, nodes, bounds, height, simplifyPx){
  const points = way.refs
    .map(ref => nodes.get(ref))
    .filter(Boolean)
    .map(node => project(bounds, node.lat, node.lng, height));
  return simplifyPx ? thinned(points, simplifyPx) : points;
}

// A wide corridor draws a village's every building and fence at a few pixels
// per metre; a vertex closer than this to the last one kept adds bytes and no
// visible shape. The ends always stay, so a closed way stays closed.
function thinned(points, minPx){
  if(points.length <= 2) return points;
  const kept = [points[0]];
  for(let index = 1; index < points.length - 1; index += 1){
    const last = kept[kept.length - 1];
    if(Math.hypot(points[index][0] - last[0], points[index][1] - last[1]) >= minPx) kept.push(points[index]);
  }
  kept.push(points[points.length - 1]);
  return kept;
}

// The scale bar the pilots were drawn with is 100 m. On a corridor several
// kilometres wide that is a few pixels, so a generated map takes the round
// distance closest to a fifth of its width.
function scaleMetresFor(mapWidthMeters){
  const target = mapWidthMeters / 5;
  const steps = [100, 200, 250, 500, 1000, 2000, 2500, 5000];
  return steps.reduce((best, step) => Math.abs(step - target) < Math.abs(best - target) ? step : best, steps[0]);
}

function scaleText(metres){
  return metres >= 1000 ? `${metres / 1000} km` : `${metres} m`;
}

function pathData(points, close){
  if(!points.length) return '';
  const data = points.map((point, index) =>
    `${index ? 'L' : 'M'}${point[0].toFixed(1)} ${point[1].toFixed(1)}`
  ).join(' ');
  return close ? `${data} Z` : data;
}

function centroid(points){
  if(!points.length) return [0, 0];
  return points.reduce((sum, point) => [sum[0] + point[0], sum[1] + point[1]], [0, 0])
    .map(value => value / points.length);
}

function inFrame(points, height){
  const margin = 40;
  return points.some(([x, y]) => x >= -margin && x <= WIDTH + margin && y >= -margin && y <= height + margin);
}

function boxArea(points){
  const xs = points.map(point => point[0]);
  const ys = points.map(point => point[1]);
  return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
}

/**
 * `generated` is for the packages build-offline-packages.js makes, whose
 * corridors run to several kilometres. It leaves the two pilots' drawing
 * exactly as it was, and on a wide map: draws the secondary and minor roads a
 * valley walk follows, drops ways wholly outside the frame (Overpass returns
 * every node of a way that touches the box), and names only lakes big enough
 * to read, never two names on top of each other.
 */
function renderOfflineMap({ trailId, xml, route, height, scaleMeters = 100, simplifyPx = 0, generated = false }){
  const HEIGHT = height;
  const { bounds, nodes, ways, relations } = readOsm(xml);
  const placedLabels = [];
  const labelFits = (x, y) => {
    if(!generated) return true;
    if(x < 60 || x > WIDTH - 60 || y < 30 || y > HEIGHT - 90) return false;
    if(placedLabels.some(([px, py]) => Math.abs(px - x) < 170 && Math.abs(py - y) < 34)) return false;
    placedLabels.push([x, y]);
    return true;
  };
  const majorRoads = generated ? ['primary', 'secondary', 'tertiary', 'trunk'] : ['primary'];
  const minorRoads = generated ? ['service', 'residential', 'unclassified', 'living_street'] : ['service', 'residential'];
  const areas = [];
  const waterways = [];
  const roads = [];
  const paths = [];
  const barriers = [];
  const labels = [];
  if(generated){
    const waysById = new Map(ways.map(way => [way.id, way]));
    for(const relation of relations){
      const t = relation.tags;
      if(t.type !== 'multipolygon') continue;
      const areaClass = areaClassFor(t, true);
      if(!areaClass || areaClass === 'building') continue;
      const outer = ringsFrom(relation.members.filter(member => member.role !== 'inner').map(member => member.ref), waysById);
      const inner = ringsFrom(relation.members.filter(member => member.role === 'inner').map(member => member.ref), waysById);
      const outerPoints = outer.map(ring => pointsFor({ refs: ring }, nodes, bounds, HEIGHT, simplifyPx));
      if(!outerPoints.some(points => inFrame(points, HEIGHT))) continue;
      const d = [...outerPoints, ...inner.map(ring => pointsFor({ refs: ring }, nodes, bounds, HEIGHT, simplifyPx))]
        .map(points => pathData(points, true)).join(' ');
      areas.push(`<path class="${areaClass}" fill-rule="evenodd" d="${d}"/>`);
      const largest = outerPoints.sort((a, b) => boxArea(b) - boxArea(a))[0];
      if(t.name && areaClass === 'water' && largest && boxArea(largest) >= 2500){
        const [x, y] = centroid(largest);
        if(labelFits(x, y)){
          labels.push(`<text class="feature-label ${areaClass}-label" x="${x.toFixed(1)}" y="${y.toFixed(1)}">${esc(t['name:it'] || t.name)}</text>`);
        }
      }
    }
  }

  for(const way of ways){
    const t = way.tags;
    const points = pointsFor(way, nodes, bounds, HEIGHT, simplifyPx);
    if(points.length < 2) continue;
    if(generated && !inFrame(points, HEIGHT)) continue;
    const closed = way.refs.length > 3 && way.refs[0] === way.refs[way.refs.length - 1];
    const areaClass = areaClassFor(t, closed);
    if(areaClass){
      areas.push(`<path class="${areaClass}" d="${pathData(points, true)}"/>`);
      const labelled = generated
        ? areaClass === 'water' && boxArea(points) >= 2500
        : ['water', 'parking'].includes(areaClass);
      const [x, y] = t.name && labelled ? centroid(points) : [0, 0];
      if(t.name && labelled && labelFits(x, y)){
        labels.push(`<text class="feature-label ${areaClass}-label" x="${x.toFixed(1)}" y="${y.toFixed(1)}">${esc(t['name:it'] || t.name)}</text>`);
      }
      continue;
    }

    if(t.waterway){
      waterways.push(`<path class="stream" d="${pathData(points, false)}"/>`);
    }else if(majorRoads.includes(t.highway)){
      roads.push(`<path class="road-casing" d="${pathData(points, false)}"/><path class="road primary" d="${pathData(points, false)}"/>`);
    }else if(minorRoads.includes(t.highway)){
      roads.push(`<path class="road-casing service-casing" d="${pathData(points, false)}"/><path class="road service" d="${pathData(points, false)}"/>`);
    }else if(['track'].includes(t.highway)){
      paths.push(`<path class="track" d="${pathData(points, false)}"/>`);
    }else if(['footway', 'path', 'steps', 'pedestrian'].includes(t.highway)){
      const cls = t.highway === 'steps' ? 'footpath steps' : 'footpath';
      paths.push(`<path class="${cls}" d="${pathData(points, false)}"/>`);
    }else if(t.barrier){
      barriers.push(`<path class="barrier" d="${pathData(points, false)}"/>`);
    }
  }

  const placedPoints = [];
  const pointFits = (x, y) => {
    if(!generated) return true;
    if(x < 0 || x > WIDTH || y < 0 || y > HEIGHT) return false;
    if(placedPoints.some(([px, py]) => Math.hypot(px - x, py - y) < 28)) return false;
    placedPoints.push([x, y]);
    return true;
  };
  // Water first: it is the point a dog walker needs, so it wins a crowded spot.
  const pointNodes = generated
    ? [...nodes.values()].sort((a, b) =>
      (b.tags.amenity === 'drinking_water') - (a.tags.amenity === 'drinking_water'))
    : nodes.values();
  for(const node of pointNodes){
    const t = node.tags;
    if(!(t.amenity || t.tourism || t.highway === 'bus_stop')) continue;
    const [x, y] = project(bounds, node.lat, node.lng, HEIGHT);
    const drawn = t.amenity === 'drinking_water' || t.amenity === 'parking' ||
      t.amenity === 'toilets' || t.tourism === 'viewpoint';
    if(!drawn || !pointFits(x, y)) continue;
    if(t.amenity === 'drinking_water'){
      labels.push(`<g class="poi water-point" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><circle r="13"/><path d="M-3-7C5-1 6 4 0 9-6 4-5-1-3-7Z"/></g>`);
    }else if(t.amenity === 'parking'){
      labels.push(`<g class="poi parking-point" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><rect x="-14" y="-14" width="28" height="28" rx="6"/><text y="8">P</text></g>`);
    }else if(t.amenity === 'toilets'){
      labels.push(`<g class="poi utility" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><circle r="11"/><text y="5">WC</text></g>`);
    }else if(t.tourism === 'viewpoint'){
      labels.push(`<g class="poi viewpoint" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><circle r="8"/><circle r="3"/></g>`);
    }
  }

  const routeCoordinates = route.features[0].geometry.coordinates;
  const trailName = route.features[0].properties.name;
  const routePoints = routeCoordinates.map(([lng, lat]) => project(bounds, lat, lng, HEIGHT));
  const routeSvgPath = pathData(routePoints, false);
  const [startX, startY] = routePoints[0];
  const carezzaLabel = trailId === 'lago-carezza'
    ? (() => {
      const [x, y] = project(bounds, 46.40925, 11.57515, HEIGHT);
      return `<g class="map-text" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})" text-anchor="middle"><text class="feature-label" y="0">Lago di Carezza</text><text class="small" y="26">Karersee</text></g>`;
    })()
    : '';
  const midLatRadians = (bounds.north + bounds.south) / 2 * Math.PI / 180;
  const mapWidthMeters = (bounds.east - bounds.west) * 111320 * Math.cos(midLatRadians);
  const scaleMetres = scaleMeters === 'auto' ? scaleMetresFor(mapWidthMeters) : scaleMeters;
  const scaleWidth = scaleMetres / mapWidthMeters * WIDTH;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-labelledby="title desc">
  <title id="title">${esc(trailName)} offline trail map</title>
  <desc id="desc">A locally rendered OpenStreetMap basemap with the ${esc(trailName)} route, surrounding paths, roads and useful points.</desc>
  <defs>
    <filter id="route-shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#1d2d25" flood-opacity=".35"/></filter>
  </defs>
  <style>
    .forest{fill:#cbdcc5;stroke:#b7cbb2;stroke-width:1.5}.scrub{fill:#d8e4d0;stroke:#c5d5be;stroke-width:1.2}.meadow{fill:#e4ebce;stroke:#d5dfbd;stroke-width:1.2}
    .water{fill:#acd4df;stroke:#70a9ba;stroke-width:4}.parking{fill:#deddd8;stroke:#aaa9a4;stroke-width:2}.building{fill:#c8b9aa;stroke:#9c8878;stroke-width:2}
    .stream{fill:none;stroke:#72b3c5;stroke-width:4;stroke-linecap:round}.road-casing{fill:none;stroke:#fff;stroke-width:22;stroke-linecap:round;stroke-linejoin:round}.road{fill:none;stroke:#d9b982;stroke-width:15;stroke-linecap:round;stroke-linejoin:round}
    .service-casing{stroke-width:13}.service{stroke:#e6d8ba;stroke-width:8}.track{fill:none;stroke:#b39363;stroke-width:5;stroke-dasharray:12 7;stroke-linecap:round}.footpath{fill:none;stroke:#8c7458;stroke-width:4;stroke-dasharray:7 6;stroke-linecap:round}.steps{stroke:#78624d;stroke-dasharray:3 4}.barrier{fill:none;stroke:#777;stroke-width:2;stroke-dasharray:3 4}
    .route-casing{fill:none;stroke:#fff;stroke-width:18;stroke-linecap:round;stroke-linejoin:round;filter:url(#route-shadow)}.route{fill:none;stroke:#b84931;stroke-width:10;stroke-linecap:round;stroke-linejoin:round}
    .feature-label{font:700 23px Arial,sans-serif;fill:#294239;text-anchor:middle;paint-order:stroke;stroke:#f5f2e9;stroke-width:6;stroke-linejoin:round}.parking-label{font-size:16px}
    .poi circle,.poi rect{fill:#fff;stroke:#294239;stroke-width:4}.poi text{font:800 16px Arial,sans-serif;fill:#294239;text-anchor:middle}.water-point circle{fill:#3e7a91}.water-point path{fill:#fff}.utility text{font-size:10px}.viewpoint circle:first-child{fill:#fff}.viewpoint circle:last-child{fill:#294239;stroke:none}
    .map-text{font-family:Arial,sans-serif;fill:#294239}.small{font-size:16px}.attribution{font-size:15px;fill:#fff}.north{font-size:20px;font-weight:800}.scale{font-size:14px;font-weight:700}
  </style>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#eef1e7"/>
  <g id="land">${areas.join('')}</g>
  <g id="waterways">${waterways.join('')}</g>
  <g id="roads">${roads.join('')}</g>
  <g id="paths">${paths.join('')}</g>
  <g id="barriers">${barriers.join('')}</g>
  <g id="labels">${labels.join('')}</g>
  ${carezzaLabel}
  <path class="route-casing" d="${routeSvgPath}"/><path class="route" d="${routeSvgPath}"/>
  <g transform="translate(${startX.toFixed(1)} ${startY.toFixed(1)})"><circle r="22" fill="#294239" stroke="#fff" stroke-width="6"/><path d="M0-11 7 7 0 3-7 7Z" fill="#fff"/></g>
  <g class="map-text" transform="translate(1125 82)" text-anchor="middle"><path d="M0-45 16 8 0-2-16 8Z" fill="#294239"/><text class="north" y="34">N</text></g>
  <g class="map-text" transform="translate(55 ${HEIGHT - 80})"><path d="M0 0H${scaleWidth.toFixed(1)}M0-8V8M${scaleWidth.toFixed(1)}-8V8" fill="none" stroke="#294239" stroke-width="5"/><text class="scale" x="${(scaleWidth / 2).toFixed(1)}" y="27" text-anchor="middle">${scaleText(scaleMetres)}</text></g>
  <rect x="670" y="${HEIGHT - 56}" width="510" height="42" rx="10" fill="#294239" opacity=".94"/>
  <text class="map-text attribution" x="1160" y="${HEIGHT - 29}" text-anchor="end">© OpenStreetMap contributors · ODbL</text>
</svg>
`;
  return { svg, stats:{ bounds, nodes: nodes.size, ways: ways.length, bytes: Buffer.byteLength(svg) } };
}

function renderPilot(trailId){
  if(!/^[a-z0-9-]+$/.test(trailId)) throw new Error('Trail ID must contain only lowercase letters, numbers, and hyphens.');
  const sourcePath = path.join(root, 'data', 'offline-map-sources', `${trailId}.osm`);
  const routePath = path.join(root, 'offline', 'packages', trailId, 'route.geojson');
  const outputPath = path.join(root, 'offline', 'packages', trailId, 'map.svg');
  const { svg, stats } = renderOfflineMap({
    trailId,
    xml:fs.readFileSync(sourcePath, 'utf8'),
    route:JSON.parse(fs.readFileSync(routePath, 'utf8')),
    height:PILOT_HEIGHTS[trailId] || 720,
  });
  fs.writeFileSync(outputPath, svg);
  console.log(`Rendered ${outputPath}`);
  console.log(JSON.stringify(stats, null, 2));
}

module.exports = { renderOfflineMap, readOsm, scaleMetresFor };

if(require.main === module) renderPilot(process.argv[2] || 'lago-carezza');
