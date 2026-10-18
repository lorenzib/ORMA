'use strict';

const fs=require('fs');
const path=require('path');
const {PUBLICATION_LEG,publicationLeg,buildFunnel}=require('./workflows/verification-funnel');

const ROOT=path.resolve(__dirname,'..');

/**
 * The funnel stopped at `ready-for-editorial`, which was honest while nothing
 * had ever gone further. A verified walk now goes on through an editorial
 * queue, publication staging, an approved request and the override file the
 * site is built from -- four more places it can stop, none of them reported.
 *
 * That matters most where it is quietest. The deadlock this leg exists to
 * surface was 23 trails waiting on an approval nothing could ever give, in a
 * state whose name reads as patience, with nothing anywhere saying so.
 */
describe('the funnel reaches the page',()=>{
  const editorialQueue={items:[
    {candidateId:'kept',trailName:'Kept Walk',copyPolicy:'preserve-existing',assetPolicy:'preserve-existing'},
    {candidateId:'drafting',trailName:'New Walk',copyPolicy:'draft-new',assetPolicy:'source-new-asset'},
  ]};
  const publicationStaging={items:[
    {candidateId:'kept',state:'ready-for-publication-preview',missingApprovals:[],publicationMappingBlockers:[]},
    {candidateId:'held',state:'waiting-publication-mapping',missingApprovals:[],
      publicationMappingBlockers:['route-number-guidance','structured-website-fields']},
  ]};
  const publicationRequests={requests:[{id:'p1',candidateId:'kept',status:'approved-for-pr-creation'}]};
  const overrides={trails:[
    {id:'out',candidateId:'out',approvalId:'a1',verificationScope:'routeReviewed',
      fields:{ormaVerified:false,routeNumberGuidance:{mode:'numbered'},
        graduation:{required:new Array(11),completed:new Array(4)}}},
    {id:'sealed',candidateId:'sealed',approvalId:'a2',
      fields:{ormaVerified:true,routeNumberGuidance:{mode:'numbered'},
        graduation:{required:new Array(11),completed:new Array(11)}}},
    // Hand-written, no approval: a declared route shape, not a publication.
    {id:'by-hand',verificationScope:'routeShape',fields:{routeShape:'loop'}},
    {id:'guided-by-hand',verificationScope:'routeGuidance',fields:{routeNumberGuidance:{mode:'landmarks'}}},
  ]};
  const leg=publicationLeg({editorialQueue,publicationStaging,publicationRequests,overrides});

  test('a trail is counted at the furthest place it reached, once',()=>{
    const total=leg.stages.reduce((sum,stage)=>sum+stage.trails,0);
    expect(total).toBe(5); // drafting, held, kept, out, sealed
    expect(leg.stages.map(stage=>[stage.stage,stage.trails])).toEqual([
      ['editorial-queue',1],['publication-staging',1],['publication-requested',1],['published',2]]);
  });

  // Counting a hand-written correction as a trail the lane published
  // overstated it by eight on the day this was written: eleven entries in the
  // override file, three publications.
  test('only an entry this lane wrote counts as published',()=>{
    expect(leg.reachedThePage).toBe(2);
    expect(leg.sealed).toBe(1);
    // And the wider number is said separately rather than folded in.
    expect(leg.directionsOnThePage).toBe(3);
  });

  test('what holds a trail is named, not just counted',()=>{
    expect(leg.heldBy).toEqual(expect.arrayContaining([
      ['route-number-guidance',1],['structured-website-fields',1]]));
    const held=leg.held.find(row=>row.candidateId==='held');
    expect(held).toMatchObject({at:'publication-staging',state:'waiting-publication-mapping'});
    expect(held.holds).toEqual(['route-number-guidance','structured-website-fields']);
  });

  test('a trail waiting on copy or an image says so while it is still in the queue',()=>{
    const drafting=leg.held.find(row=>row.candidateId==='drafting');
    expect(drafting.holds).toEqual(['copy not drafted','image not sourced']);
    // And one keeping its own words and photograph is not reported as held.
    expect(leg.held.map(row=>row.candidateId)).not.toContain('kept');
  });

  // The failure mode this is for: a lane that never ran and a lane with
  // nothing to do look the same, and both look like success.
  test('nothing published and nothing held is reported as nothing having entered',()=>{
    const empty=publicationLeg({editorialQueue:{items:[]},publicationStaging:{items:[]},
      publicationRequests:{requests:[]},overrides:{trails:[]}});
    expect(empty.reachedThePage).toBe(0);
    expect(empty.held).toEqual([]);
    expect(empty.stages.every(stage=>stage.trails===0)).toBe(true);
  });

  test('and a funnel asked for none of it says nothing rather than zero',()=>{
    const without=buildFunnel({orchestration:{trails:[]},jobs:[],reviewQueue:{items:[]}});
    expect(without.publication).toBeUndefined();
    const with_=buildFunnel({orchestration:{trails:[]},jobs:[],reviewQueue:{items:[]},overrides});
    expect(with_.publication.reachedThePage).toBe(2);
  });

  test('the leg runs in the order a trail travels',()=>{
    expect(PUBLICATION_LEG).toEqual(['editorial-queue','publication-staging','publication-requested','published']);
    expect(leg.stages.map(stage=>stage.stage)).toEqual([...PUBLICATION_LEG]);
  });

  // Against the real file, so the report cannot drift from what ships.
  test('the committed override file reads the way the leg expects',()=>{
    const live=JSON.parse(fs.readFileSync(path.join(ROOT,'data/verified-trail-overrides.json'),'utf8'));
    const real=publicationLeg({overrides:live});
    expect(real.reachedThePage).toBe(live.trails.filter(entry=>entry.approvalId).length);
    expect(real.directionsOnThePage).toBe(live.trails.filter(entry=>entry.fields?.routeNumberGuidance).length);
    expect(real.reachedThePage).toBeLessThan(live.trails.length);
  });
});
