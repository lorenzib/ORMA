'use strict';

const {ensureResolutionEntries,resolutionCandidates,
  NOTHING_MAPPED}=require('./workflows/claim-resolution');
const {placesOnRoute,categoriesTheMapFoundNothingFor,
  CLAIM_PLACE_KINDS}=require('./workflows/places-on-route');

// An optional claim gets three materially different web searches. Measured
// across the catalogue on 14 October 2026, 111 of 225 such claims spent that
// ladder and came back having found nothing -- roughly half the money spent on
// optional detail bought the word "unknown".
//
// Some of those were never answerable. ORMA already measures the mapped water,
// huts and bars along each walk from its own line, and a walk with no mapped
// water is one the web is unlikely to find a fountain on. Paying three searches
// to confirm that is three searches for nothing.

const walk=[[46.54,11.62],[46.545,11.625],[46.55,11.63]];
const feature=(lat,lng,props)=>({type:'Feature',properties:props,
  geometry:{type:'Point',coordinates:[lng,lat]}});

const unresolved=claimId=>({agentId:'terrainPoi',jobId:'poi-1',
  result:{claims:[{id:claimId,category:'terrain',finding:'unresolved',
    proposedValue:'',sources:[],blockers:[]}]}});

const entriesFor=(claimId,unmapped)=>
  ensureResolutionEntries({},resolutionCandidates([unresolved(claimId)]),unmapped);

describe('do not search for what the map says is not there',()=>{
  test('a measured walk with nothing on it names every category',()=>{
    const found=placesOnRoute(walk,[]);
    expect(found.measured).toBe(true);
    expect(categoriesTheMapFoundNothingFor(found).sort())
      .toEqual(Object.keys(CLAIM_PLACE_KINDS).sort());
  });

  test('a category that IS on the walk is still researched',()=>{
    // Presence on the map is not current availability -- whether the water is
    // drinkable now still needs a source, and that is worth paying for.
    const found=placesOnRoute(walk,[feature(46.545,11.625,{amenity:'drinking_water',name:'Brunnen'})]);
    expect(found.water).toHaveLength(1);
    expect(categoriesTheMapFoundNothingFor(found)).not.toContain('water');
    expect(entriesFor('water',categoriesTheMapFoundNothingFor(found))['terrainPoi:water'].state)
      .toBe('researchable');
  });

  test('a category the map found nothing of is settled, and queues no job',()=>{
    const entry=entriesFor('water',['water','mountain-huts','food-drink'])['terrainPoi:water'];
    // queueClaimResolution only ever queues a researchable entry.
    expect(entry.state).toBe('source-exhausted');
    expect(entry.attempts).toEqual([]);
    expect(entry.settledBy).toBe('mapped-features');
    // And the record says what was done rather than going quiet.
    expect(entry.note).toBe(NOTHING_MAPPED);
    expect(NOTHING_MAPPED).toMatch(/automated research strategies were exhausted/);
  });

  test('a walk nobody measured settles nothing',()=>{
    // Not looking is not a finding. A walk with no line, or a run with no
    // mapped features to read, must not be read as "there is nothing there".
    expect(categoriesTheMapFoundNothingFor(placesOnRoute([[46,11]],[]))).toEqual([]);
    expect(categoriesTheMapFoundNothingFor(null)).toEqual([]);
    expect(entriesFor('water',[])['terrainPoi:water'].state).toBe('researchable');
  });

  test('a hut on the walk settles the food claim but not the hut claim',()=>{
    const found=placesOnRoute(walk,[feature(46.545,11.625,{tourism:'alpine_hut',name:'Schutzhaus'})]);
    const nothing=categoriesTheMapFoundNothingFor(found);
    expect(nothing).toContain('food-drink');
    expect(nothing).toContain('water');
    expect(nothing).not.toContain('mountain-huts');
  });

  test('the route claims are untouched, whatever the map holds',()=>{
    // These decide whether a trail verifies at all and keep their full ladder.
    const entry=entriesFor('recommended-start',['water','mountain-huts','food-drink']);
    expect(entry['terrainPoi:recommended-start'].state).toBe('researchable');
  });
});
