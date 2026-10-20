'use strict';

const path=require('path');
const {heldForImport,admitNewTrailIntake,candidateToTrail}=require('./workflows/new-trail-intake');
const {inTheCatalogue,buildPublicationStaging}=require('./workflows/build-publication-staging');
const {loadProductionTrails}=require('../scripts/load-production-trails');

const ROOT=path.resolve(__dirname,'..');
const AT='2026-10-18T10:00:00Z';

/**
 * A scouted walk exists only in Firestore: an id, a name, an OSM relation and
 * an empty path. Nothing writes it into `data/`, and publication restates nine
 * fields from a catalogue record it has not got -- so it was verified, had a
 * copywriter and a visual director paid for, reached staging and stopped there
 * for ever, on a blocker that reads as a record missing some of its fields.
 */
describe('a trail the catalogue does not hold says so',()=>{
  const catalogue=loadProductionTrails(ROOT);
  const known=catalogue[0];

  test('the blocker names the real problem',()=>{
    const trailsById=new Map(catalogue.map(record=>[record.id,record]));
    expect(inTheCatalogue({candidateId:'osm-99999'},{trailId:'osm-99999'},trailsById)).toBe(false);
    expect(inTheCatalogue({candidateId:known.id},{trailId:known.id},trailsById)).toBe(true);
    // The three hand-typed entries still count as supplied.
    expect(inTheCatalogue({candidateId:'osm-relation-1484751'},null,new Map())).toBe(true);
  });

  test('and staging reports it instead of missing fields',()=>{
    const queue={items:[{candidateId:'osm-99999',trailName:'Scouted Walk',targetTrailId:'osm-99999',
      assetPolicy:'source-new-asset',lockedFacts:[],verifiedAt:AT,verificationConditions:[]}]};
    const [item]=buildPublicationStaging(queue,{outputs:[]},{submissions:[]},
      {at:AT,productionTrails:catalogue}).items;
    expect(item.publicationMappingBlockers).toContain('trail-not-in-the-catalogue');
    expect(item.publicationMappingBlockers).not.toContain('structured-website-fields');
    // And it is not called an update of something that does not exist.
    expect(item.operation).toBe('create-new');
  });

  test('a trail the catalogue does hold still reports a missing field as one',()=>{
    const {startPoint,...incomplete}=known;
    const queue={items:[{candidateId:known.id,trailName:known.name,targetTrailId:known.id,
      assetPolicy:'preserve-existing',lockedFacts:[],verifiedAt:AT,verificationConditions:[]}]};
    const [item]=buildPublicationStaging(queue,{outputs:[]},{submissions:[]},
      {at:AT,productionTrails:[incomplete]}).items;
    expect(item.publicationMappingBlockers).toContain('structured-website-fields');
    expect(item.publicationMappingBlockers).not.toContain('trail-not-in-the-catalogue');
    expect(item.operation).toBe('update-existing');
  });
});

describe('and is not admitted to be paid for',()=>{
  const catalogue=loadProductionTrails(ROOT);

  test('a candidate with no record is held back and named',()=>{
    const {admit,held}=heldForImport(
      [{id:'osm-99999',name:'Scouted'},{id:catalogue[0].id,name:catalogue[0].name}],catalogue);
    expect(admit.map(trail=>trail.id)).toEqual([catalogue[0].id]);
    // The reason now carries the command that clears the hold, which did not
    // exist when this was written: a candidate was held with nowhere to go.
    expect(held).toHaveLength(1);
    expect(held[0]).toMatchObject({id:'osm-99999',name:'Scouted'});
    expect(held[0].reason).toMatch(/^not in the catalogue: publication restates a record this walk has not got\./);
    expect(held[0].reason).toMatch(/import-scouted-trail\.js --relation/);
  });

  // A missing argument must not become a silent stop.
  test('a caller that passes no catalogue is not saying the catalogue is empty',()=>{
    const trails=[{id:'osm-99999',name:'Scouted'}];
    expect(heldForImport(trails,undefined)).toEqual({admit:trails,held:[]});
  });

  test('nothing is queued for a held candidate, and the summary says why',async()=>{
    const written=new Map();const campaigns=[];
    const store={
      async setArtifact(id,value){written.set(id,value);},
      async getArtifact(id){return written.get(id)||null;},
      async putJob(job){campaigns.push(job);},
    };
    const packet={candidates:[{id:'osm-99999',name:'Scouted',region:'dolomites',
      osmRelation:99999,center:[11.7,46.6],distanceKm:5.2,sourceUrl:'https://example.test/x'}]};
    const review={decisions:[{candidateId:'osm-99999',action:'send-to-verification'}]};
    const result=await admitNewTrailIntake(store,packet,review,{at:AT,productionTrails:catalogue});

    expect(result.jobIds).toEqual([]);
    expect(campaigns).toEqual([]);
    expect(result.summary).toEqual({selected:1,heldForImport:1});
    // The reason travels on the artifact too, so the next reader finds it.
    expect(written.get('new-trail-intake').candidates).toEqual([]);
    expect(written.get('new-trail-intake').heldForImport[0].reason).toMatch(/not in the catalogue/);
  });

  test('the candidate the intake builds is the one that cannot publish',()=>{
    // From the producer, so this cannot pass against a shape nothing emits.
    const candidate=candidateToTrail({id:'osm-99999',name:'Scouted',region:'dolomites',
      osmRelation:99999,center:[11.7,46.6],distanceKm:5.2,sourceUrl:'https://example.test/x'});
    expect(candidate.path).toEqual([]);
    for(const field of ['hours','terrainType','terrainRank','safetyLevel','waterSources','startPoint']){
      expect({field,value:candidate[field]}).toEqual({field,value:undefined});
    }
  });
});
