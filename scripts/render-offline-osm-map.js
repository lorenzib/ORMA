#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'data', 'offline-map-sources', 'lago-carezza.osm');
const routePath = path.join(root, 'offline', 'packages', 'lago-carezza', 'route.geojson');
const outputPath = path.join(root, 'offline', 'packages', 'lago-carezza', 'map.svg');
const WIDTH = 1200;
const HEIGHT = 1140;

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
  return { bounds, nodes, ways };
}

function project(bounds, lat, lng){
  const midLat = (bounds.north + bounds.south) / 2 * Math.PI / 180;
  const westX = bounds.west * Math.cos(midLat);
  const eastX = bounds.east * Math.cos(midLat);
  const valueX = lng * Math.cos(midLat);
  return [
    (valueX - westX) / (eastX - westX) * WIDTH,
    (bounds.north - lat) / (bounds.north - bounds.south) * HEIGHT,
  ];
}

function pointsFor(way, nodes, bounds){
  return way.refs
    .map(ref => nodes.get(ref))
    .filter(Boolean)
    .map(node => project(bounds, node.lat, node.lng));
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

function render(){
  const xml = fs.readFileSync(sourcePath, 'utf8');
  const route = JSON.parse(fs.readFileSync(routePath, 'utf8'));
  const { bounds, nodes, ways } = readOsm(xml);
  const areas = [];
  const waterways = [];
  const roads = [];
  const paths = [];
  const barriers = [];
  const labels = [];

  for(const way of ways){
    const t = way.tags;
    const points = pointsFor(way, nodes, bounds);
    if(points.length < 2) continue;
    const closed = way.refs.length > 3 && way.refs[0] === way.refs[way.refs.length - 1];
    let areaClass = '';
    if(closed && (t.natural === 'water' || t.water === 'lake')) areaClass = 'water';
    else if(closed && (t.landuse === 'forest' || t.natural === 'wood')) areaClass = 'forest';
    else if(closed && t.natural === 'scrub') areaClass = 'scrub';
    else if(closed && ['meadow', 'grass'].includes(t.landuse)) areaClass = 'meadow';
    else if(closed && t.amenity === 'parking') areaClass = 'parking';
    else if(closed && t.building) areaClass = 'building';
    if(areaClass){
      areas.push(`<path class="${areaClass}" d="${pathData(points, true)}"/>`);
      if(t.name && ['water', 'parking'].includes(areaClass)){
        const [x, y] = centroid(points);
        labels.push(`<text class="feature-label ${areaClass}-label" x="${x.toFixed(1)}" y="${y.toFixed(1)}">${esc(t['name:it'] || t.name)}</text>`);
      }
      continue;
    }

    if(t.waterway){
      waterways.push(`<path class="stream" d="${pathData(points, false)}"/>`);
    }else if(t.highway === 'primary'){
      roads.push(`<path class="road-casing" d="${pathData(points, false)}"/><path class="road primary" d="${pathData(points, false)}"/>`);
    }else if(['service', 'residential'].includes(t.highway)){
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

  for(const node of nodes.values()){
    const t = node.tags;
    if(!(t.amenity || t.tourism || t.highway === 'bus_stop')) continue;
    const [x, y] = project(bounds, node.lat, node.lng);
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
  const routePoints = routeCoordinates.map(([lng, lat]) => project(bounds, lat, lng));
  const routeSvgPath = pathData(routePoints, false);
  const [startX, startY] = routePoints[0];
  const [lakeLabelX, lakeLabelY] = project(bounds, 46.40925, 11.57515);
  const midLatRadians = (bounds.north + bounds.south) / 2 * Math.PI / 180;
  const mapWidthMeters = (bounds.east - bounds.west) * 111320 * Math.cos(midLatRadians);
  const scaleWidth = 100 / mapWidthMeters * WIDTH;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-labelledby="title desc">
  <title id="title">Lago di Carezza offline trail map</title>
  <desc id="desc">A locally rendered OpenStreetMap basemap with the Lago di Carezza route, lake, surrounding paths, roads, parking and useful points.</desc>
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
  <g class="map-text" transform="translate(${lakeLabelX.toFixed(1)} ${lakeLabelY.toFixed(1)})" text-anchor="middle"><text class="feature-label" y="0">Lago di Carezza</text><text class="small" y="26">Karersee</text></g>
  <path class="route-casing" d="${routeSvgPath}"/><path class="route" d="${routeSvgPath}"/>
  <g transform="translate(${startX.toFixed(1)} ${startY.toFixed(1)})"><circle r="22" fill="#294239" stroke="#fff" stroke-width="6"/><path d="M0-11 7 7 0 3-7 7Z" fill="#fff"/></g>
  <g class="map-text" transform="translate(1125 82)" text-anchor="middle"><path d="M0-45 16 8 0-2-16 8Z" fill="#294239"/><text class="north" y="34">N</text></g>
  <g class="map-text" transform="translate(55 1060)"><path d="M0 0H${scaleWidth.toFixed(1)}M0-8V8M${scaleWidth.toFixed(1)}-8V8" fill="none" stroke="#294239" stroke-width="5"/><text class="scale" x="${(scaleWidth / 2).toFixed(1)}" y="27" text-anchor="middle">100 m</text></g>
  <rect x="670" y="1084" width="510" height="42" rx="10" fill="#294239" opacity=".94"/>
  <text class="map-text attribution" x="1160" y="1111" text-anchor="end">© OpenStreetMap contributors · ODbL</text>
</svg>
`;
  fs.writeFileSync(outputPath, svg);
  console.log(`Rendered ${outputPath}`);
  console.log(JSON.stringify({ bounds, nodes: nodes.size, ways: ways.length, bytes: Buffer.byteLength(svg) }, null, 2));
}

render();
