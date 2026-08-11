#!/usr/bin/env node
'use strict';

/**
 * Diagnostic fetch for drinking fountains and benches in Trentino-Alto Adige.
 *
 * Usage: npm run fetch:amenities
 * Output: summary on stdout only. This tool does not update production map
 * assets; the governed production POI commands are documented in TOOL-01.
 */

// Trentino Alto Adige bounding box (south, west, north, east)
// This covers the entire Trentino Alto Adige / Südtirol region
const TRENTINO_BBOX = {
  south: 45.70,
  west: 10.40,
  north: 47.09,
  east: 12.84,
};

/**
 * Fetch drinking fountains in the region
 */
async function fetchDrinkingFountains() {
  const bbox = `${TRENTINO_BBOX.south},${TRENTINO_BBOX.west},${TRENTINO_BBOX.north},${TRENTINO_BBOX.east}`;
  
  const query = `[bbox:${bbox}];
    (
      node["amenity"="drinking_water"];
      way["amenity"="drinking_water"];
      relation["amenity"="drinking_water"];
    );
    out geom;`;
  
  return queryOverpass(query, 'drinking_fountains');
}

/**
 * Fetch resting stops (benches) in the region
 */
async function fetchRestingStops() {
  const bbox = `${TRENTINO_BBOX.south},${TRENTINO_BBOX.west},${TRENTINO_BBOX.north},${TRENTINO_BBOX.east}`;
  
  const query = `[bbox:${bbox}];
    (
      node["amenity"="bench"];
      way["amenity"="bench"];
    );
    out geom;`;
  
  return queryOverpass(query, 'resting_stops');
}

/**
 * Fetch both amenities at once
 */
async function fetchAllAmenities() {
  try {
    const fountains = await fetchDrinkingFountains();
    const benches = await fetchRestingStops();
    
    return {
      fountains,
      benches,
      totalFountains: fountains?.features?.length || 0,
      totalBenches: benches?.features?.length || 0,
    };
  } catch (error) {
    console.error('Error fetching amenities:', error);
    throw error;
  }
}

/**
 * Query Overpass API
 */
async function queryOverpass(query, label) {
  const url = 'https://overpass-api.de/api/interpreter';
  
  try {
    console.log(`Fetching ${label}...`);
    
    const response = await fetch(url, {
      method: 'POST',
      body: query,
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    const geojson = osmToGeojson(data);
    
    console.log(`✅ Fetched ${geojson.features.length} ${label}`);
    return geojson;
  } catch (error) {
    console.error(`❌ Error fetching ${label}:`, error.message);
    throw error;
  }
}

/**
 * Convert OSM data to GeoJSON format
 */
function osmToGeojson(osmData) {
  const features = [];
  
  // Handle nodes
  const nodeMap = {};
  (osmData.elements || []).forEach(elem => {
    if (elem.type === 'node') {
      nodeMap[elem.id] = elem;
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [elem.lon, elem.lat],
        },
        properties: {
          id: elem.id,
          name: elem.tags?.name || 'Unnamed',
          tags: elem.tags || {},
        },
      });
    }
  });
  
  // Handle ways
  (osmData.elements || []).forEach(elem => {
    if (elem.type === 'way' && elem.geometry) {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: elem.geometry.map(node => [node.lon, node.lat]),
        },
        properties: {
          id: elem.id,
          name: elem.tags?.name || 'Unnamed',
          tags: elem.tags || {},
        },
      });
    }
  });
  
  return {
    type: 'FeatureCollection',
    features,
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    fetchDrinkingFountains,
    fetchRestingStops,
    fetchAllAmenities,
    queryOverpass,
    osmToGeojson,
  };
}

// Auto-run if executed directly
if (typeof require !== 'undefined' && require.main === module) {
  (async () => {
    const data = await fetchAllAmenities();
    console.log('\n📍 Summary:');
    console.log(`   Drinking fountains: ${data.totalFountains}`);
    console.log(`   Resting stops: ${data.totalBenches}`);
    console.log('\n✅ Data ready to use!');
  })();
}
