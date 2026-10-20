'use strict';

const fs=require('fs');
const os=require('os');
const path=require('path');
const {REGIONS,parseArgs,featureFor,screen,main}=require('./import-scouted-trail');
const {hardWayForDogs,buildPhase1Query,MAX_KM}=require('./fetch-dog-friendly-routes');
const {heldForImport}=require('../backoffice/workflows/new-trail-intake');

const ROOT=path.resolve(__dirname,'..');

/**
 * The scouting lane had no exit. A selected candidate lived only in Firestore
 * -- an id, a name, an OSM relation and an empty path -- and publication
 * restates nine fields from a catalogue record it had not got, so the walk was
 * verified, had its research and its copy paid for, reached the mapping gate
 * and stopped there for ever.
 *
 * This is the step that lets it in: one feature added to the region's route
 * file, and then the promoter derives the record the way it does for every
 * other trail.
 */

/** A relation in the shape Overpass `out geom` returns. */
function relation(tags={},{points=40,closed=true}={}){
  const geometry=[];
  if(closed){
    for(let index=0;index<points;index+=1){
      const angle=index/points*2*Math.PI;
      geometry.push({lat:46.57+0.009*Math.sin(angle),lon:11.56+0.012*Math.cos(angle)});
    }
    geometry.push({...geometry[0]});
  } else {
    // A straight line, because a ring with its last point dropped still ends
    // within the loop tolerance of where it started -- the first version of
    // this fixture did, and asserted the opposite of what it built.
    for(let index=0;index<points;index+=1){
      geometry.push({lat:46.57+index*0.0008,lon:11.56+index*0.0011});
    }
  }
  return {type:'relation',id:987654321,
    tags:{name:'Testweg Kastelruth',route:'hiking',ref:'99',network:'lwn',...tags},
    members:[{type:'way',ref:1,role:'',geometry}]};
}
const PATH_WAY=[{type:'way',id:1,tags:{surface:'gravel',highway:'path'}}];
const answering=(rel,ways)=>async query=>query.includes('out geom')?{elements:[rel]}:{elements:ways};

function emptyRoutes(){
  const file=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'orma-import-')),'routes.geojson');
  fs.writeFileSync(file,JSON.stringify({type:'FeatureCollection',features:[]}));
  return file;
}
const quiet=()=>{const log=console.log;console.log=()=>{};return ()=>{console.log=log;};};
async function run(argv,options){const restore=quiet();try{return await main({argv,...options});}finally{restore();}}

describe('the screening is the discovery pass’s own',()=>{
  // Two readings of one rule: the sweep asks Overpass for these as set
  // expressions, and a single relation is read from its member tags. Dogs are
  // the reason the rule exists, so the query is read out of the source and
  // every condition in it is put to the predicate.
  test('every way the region sweep calls hard is hard here too',()=>{
    const query=buildPhase1Query();
    const conditions=[...query.matchAll(/way\(r\.routes\)\[([^\]]*)\]/g)].map(match=>match[1]);
    expect(conditions.length).toBe(6);
    const asTags=condition=>{
      const exact=condition.match(/^"([^"]+)"="([^"]+)"$/);
      if(exact)return {[exact[1]]:exact[2]};
      const matches=condition.match(/^"([^"]+)"~"(.*)"$/);
      if(matches)return {[matches[1]]:'alpine_hiking'};
      const present=condition.match(/^"([^"]+)"$/);
      return {[present[1]]:'yes'};
    };
    for(const condition of conditions){
      expect({condition,hard:hardWayForDogs(asTags(condition))}).toEqual({condition,hard:true});
    }
  });

  test('and an ordinary path is not',()=>{
    for(const tags of [{highway:'path'},{sac_scale:'hiking'},{surface:'gravel'},{},null]){
      expect({tags,hard:hardWayForDogs(tags)}).toEqual({tags,hard:false});
    }
  });

  test('a relation the sweep would refuse is refused by name',()=>{
    expect(screen(relation({dog:'no'}),PATH_WAY,{}).reasons).toContain('relation tagged dog=no');
    expect(screen(relation({sac_scale:'alpine_hiking'}),PATH_WAY,{}).reasons)
      .toContain('relation sac_scale=alpine_hiking');
    expect(screen(relation(),[{type:'way',id:1,tags:{highway:'via_ferrata'}}],{}).hardWays).toEqual([1]);
    expect(screen(relation({distance:`${MAX_KM+5} km`}),PATH_WAY,{}).reasons)
      .toContain(`distance ${MAX_KM+5} km > ${MAX_KM} km`);
    // Not a walking route, and no name to put on a page.
    expect(screen(relation({route:'bicycle'}),PATH_WAY,{}).reasons)
      .toContain('route=bicycle is not a walking route');
    const {name,...unnamed}=relation().tags;
    expect(screen({...relation(),tags:unnamed},PATH_WAY,{}).reasons).toContain('the relation has no name');
  });

  test('and a manual exclusion still excludes',()=>{
    const refused=screen(relation(),PATH_WAY,{'987654321':{include:false,note:'dogs banned on the ground'}});
    expect(refused.keep).toBe(false);
    expect(refused.reasons[0]).toMatch(/manual exclude/);
  });

  test('an ordinary walk is kept',()=>{
    expect(screen(relation(),PATH_WAY,{})).toMatchObject({keep:true,reasons:[],hardWays:[]});
  });
});

describe('the feature it writes is one the promoter cannot tell apart',()=>{
  // Compared against the real file rather than a list typed here, so a
  // property the discovery pass starts writing is noticed.
  test('it carries the same properties as the features already on file',()=>{
    const onFile=JSON.parse(fs.readFileSync(path.join(ROOT,'dog-friendly-routes.geojson'),'utf8'));
    const existing=onFile.features.find(feature=>feature.properties.ref&&feature.properties.surfaces);
    const built=featureFor(relation(),PATH_WAY,{});
    expect(Object.keys(built.properties).sort()).toEqual(Object.keys(existing.properties).sort());
    expect(built.geometry.type).toBe('LineString');
  });

  test('and measures the line itself rather than trusting the tag',()=>{
    const built=featureFor(relation({distance:'1 km'}),PATH_WAY,{});
    // `distance_km` prefers the tag where there is one, as the sweep does, but
    // the loop flag is the geometry's answer and nothing else's.
    expect(built.properties.loop).toBe(true);
    expect(featureFor(relation({},{closed:false}),PATH_WAY,{}).properties.loop).toBe(false);
  });
});

describe('it adds one walk and nothing else',()=>{
  test('a dry run writes nothing',async()=>{
    const file=emptyRoutes();
    const result=await run(['--relation','987654321'],
      {routesPath:file,fetchQuery:answering(relation(),PATH_WAY)});
    expect(result.status).toBe('dry-run');
    expect(JSON.parse(fs.readFileSync(file,'utf8')).features).toEqual([]);
  });

  test('--apply appends exactly one feature',async()=>{
    const file=emptyRoutes();
    await run(['--relation','987654321','--apply'],
      {routesPath:file,fetchQuery:answering(relation(),PATH_WAY)});
    const written=JSON.parse(fs.readFileSync(file,'utf8'));
    expect(written.features).toHaveLength(1);
    expect(written.features[0].properties.osm_relation).toBe(987654321);
  });

  test('a walk already on file is left alone',async()=>{
    const file=emptyRoutes();
    await run(['--relation','987654321','--apply'],
      {routesPath:file,fetchQuery:answering(relation(),PATH_WAY)});
    const before=fs.readFileSync(file,'utf8');
    const second=await run(['--relation','987654321','--apply'],
      {routesPath:file,fetchQuery:answering(relation(),PATH_WAY)});
    expect(second.status).toBe('already-present');
    expect(fs.readFileSync(file,'utf8')).toBe(before);
  });

  test('a refused walk is not written',async()=>{
    const file=emptyRoutes();
    const result=await run(['--relation','987654321','--apply'],
      {routesPath:file,fetchQuery:answering(relation(),[{type:'way',id:1,tags:{ladder:'yes'}}])});
    expect(result.status).toBe('refused');
    expect(JSON.parse(fs.readFileSync(file,'utf8')).features).toEqual([]);
  });

  test('and so is a relation OpenStreetMap does not return',async()=>{
    const file=emptyRoutes();
    const result=await run(['--relation','987654321','--apply'],
      {routesPath:file,fetchQuery:async()=>({elements:[]})});
    expect(result.status).toBe('not-found');
    expect(JSON.parse(fs.readFileSync(file,'utf8')).features).toEqual([]);
  });

  test('it knows both regions, and refuses one it does not',async()=>{
    expect(Object.keys(REGIONS).sort()).toEqual(['dolomites','savoy']);
    expect(await run(['--relation','1','--region','narnia'],{})).toBeNull();
    expect(await run(['--apply'],{})).toBeNull();
    expect(parseArgs(['--relation','7','--region=savoy','--apply']))
      .toEqual({relation:7,region:'savoy',apply:true});
  });
});

describe('and the intake hold names it',()=>{
  // #865 holds a candidate the catalogue does not have. The hold was right and
  // the remedy did not exist; it does now, so the reason says what to run.
  test('a held candidate is told how to be let in',()=>{
    const [held]=heldForImport([{id:'osm-99',name:'Scouted',osmRelation:99}],[]).held;
    expect(held.reason).toMatch(/import-scouted-trail\.js --relation 99 --apply/);
  });
});
