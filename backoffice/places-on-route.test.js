'use strict';

const fs=require('fs');
const path=require('path');
const {placesOnRoute,isDrinkable,placeKind,pointOf,ON_ROUTE_METRES}
  =require('./workflows/places-on-route');
const {mappedPlacesFor,PLACE_FILES,PROMPTS}=require('./workflows/run-trail-specialist');

// terrainPoi is asked to establish the water, huts, bars and restaurants on
// each route, and answers by searching the web -- while 12,938 mapped water
// points and 19,837 places sit in data/regions and are never consulted. 911
// searches went on optional detail across the catalogue and 111 of 225 such
// claims exhausted their ladder having found nothing.

function catalogue(region){
  const read=file=>JSON.parse(fs.readFileSync(
    path.join(__dirname,'../data/regions',file),'utf8')).features;
  return [...read(`${region}-water.geojson`),...read(`${region}-huts-bars.geojson`)];
}
function trail(id,region='dolomites'){
  const src=fs.readFileSync(path.join(__dirname,`../data/regions/${region}-trails.js`),'utf8');
  return JSON.parse(src.match(/var incoming=(\[[\s\S]*?\]);/)[1]).find(item=>item.id===id);
}

describe('what the map already says is on a walk',()=>{
  test('an ornamental fountain is not drinking water',()=>{
    // OSM uses amenity=fountain for ornamental ones and the catalogue holds
    // 1,155 of them. Offering those as water for a dog would be the invention
    // this whole contract refuses.
    expect(isDrinkable({amenity:'fountain'})).toBe(false);
    expect(isDrinkable({amenity:'drinking_water'})).toBe(true);
    expect(isDrinkable({amenity:'fountain',drinking_water:'yes'})).toBe(true);
  });

  test('an explicit drinking_water=no is believed',()=>{
    // Sorgente del Brenta is tagged exactly that way: somebody looked.
    expect(isDrinkable({natural:'spring',drinking_water:'no'})).toBe(false);
    expect(isDrinkable({amenity:'drinking_water',drinking_water:'no'})).toBe(false);
  });

  test('huts, shelters and places to eat are told apart from everything else',()=>{
    expect(placeKind({amenity:'alpine_hut'})).toBe('mountain hut');
    expect(placeKind({tourism:'wilderness_hut'})).toBe('mountain hut');
    expect(placeKind({amenity:'restaurant'})).toBe('restaurant');
    expect(placeKind({amenity:'place_of_worship'})).toBeNull();
    expect(placeKind({amenity:'boat_rental'})).toBeNull();
  });

  test('GeoJSON is [lng, lat] and the walk is [lat, lng]',()=>{
    // Reading one as the other puts the Dolomites in the Indian Ocean.
    expect(pointOf({geometry:{coordinates:[12.2961,46.6122]}})).toEqual([46.6122,12.2961]);
  });

  test('it finds the rifugi ORMA curated by hand, at the right kilometres',()=>{
    const found=placesOnRoute(trail('tre-cime').path,catalogue('dolomites'));
    const names=found.places.map(place=>place.name||'').join(' | ');
    for(const expected of ['Rifugio Auronzo','Rifugio Lavaredo','Rifugio Locatelli']){
      expect(names).toContain(expected);
    }
    // In walking order, with a distance from the start.
    const kms=found.places.map(place=>place.km);
    expect([...kms].sort((a,b)=>a-b)).toEqual(kms);
    expect(found.places.every(place=>place.metresOffRoute<=ON_ROUTE_METRES)).toBe(true);
  });

  test('a place in the same valley but off the walk is not on it',()=>{
    const line=[[46.60,11.70],[46.61,11.70],[46.62,11.70]];
    const far={geometry:{coordinates:[11.75,46.61]},properties:{amenity:'restaurant'}};
    const near={geometry:{coordinates:[11.7002,46.61]},properties:{amenity:'restaurant'}};
    expect(placesOnRoute(line,[far]).places).toHaveLength(0);
    expect(placesOnRoute(line,[near]).places).toHaveLength(1);
  });

  test('the bounding box changes speed, never the answer',()=>{
    const line=trail('sassolungo').path;
    const features=catalogue('dolomites');
    const wide=placesOnRoute(line,features,{radiusMetres:60});
    // Every kept point is genuinely within the radius, box or no box.
    expect(wide.places.every(place=>place.metresOffRoute<=60)).toBe(true);
    expect(wide.water.every(point=>point.metresOffRoute<=60)).toBe(true);
  });

  test('a walk too short to measure says it did not measure',()=>{
    // `measured` is the difference between "nothing is on this walk" and "we
    // never looked". The first lets a claim be settled without paying for
    // three web searches; the second must never be read as the first.
    expect(placesOnRoute([[46,11]],catalogue('dolomites')))
      .toEqual({measured:false,water:[],places:[]});
  });
});

describe('what the agent is handed',()=>{
  test('the places, and what they do and do not establish',()=>{
    const got=mappedPlacesFor(trail('tre-cime'));
    expect(got.places.length).toBeGreaterThan(0);
    expect(got.note).toContain('Presence on the map is not current availability');
    // The part that still needs a search is named, so the agent spends there.
    expect(got.note).toContain('still needs a source');
  });

  test('a walk with nothing mapped on it hands over nothing, rather than an empty promise',()=>{
    expect(mappedPlacesFor({path:[[0,0],[0.001,0.001]]})).toBeNull();
    expect(mappedPlacesFor({})).toBeNull();
  });

  test('every region file the catalogue ships is read',()=>{
    for(const file of PLACE_FILES){
      expect(fs.existsSync(path.join(__dirname,'../data/regions',file))).toBe(true);
    }
  });

  test('the prompt says to start from it and where to spend a search instead',()=>{
    expect(PROMPTS.terrainPoi).toContain('mappedPlaces');
    expect(PROMPTS.terrainPoi).toContain('Start from it rather than searching for what it already lists');
    // An empty category is not an absent one: the map is not a facility list.
    expect(PROMPTS.terrainPoi).toContain('is not thereby absent');
  });
});
