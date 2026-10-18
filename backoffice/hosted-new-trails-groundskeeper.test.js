'use strict';

const {nextScoutingAt,refreshLiveNewTrailScouting}=require('./workflows/refresh-live-new-trail-scouting');
const {ingestNewTrailReviews,ingestHazardReviews}=require('./workflows/run-live-backoffice-worker');

const at='2026-08-20T12:00:00.000Z';
function feature(relation,name='Fresh loop'){return {type:'Feature',properties:{osm_relation:String(relation),name,distance_km:4,loop:true},geometry:{type:'LineString',coordinates:[[11,46],[11.01,46.01],[11,46]]}};}
function memoryStore(seed={}){const artifacts={...seed};const jobs=[];const marked=[];return {artifacts,jobs,marked,getArtifact:async id=>artifacts[id]||null,setArtifact:async(id,value)=>{artifacts[id]=value;},putJobIfAbsent:async job=>{if(jobs.some(item=>item.id===job.id))return false;jobs.push(job);return true;},listNewTrailReviews:async()=>[],markNewTrailReview:async(id,status,fields)=>marked.push({kind:'new',id,status,fields}),listHazardReviews:async()=>[],markHazardReview:async(id,status,fields)=>marked.push({kind:'hazard',id,status,fields})};}

describe('hosted New Trails and Groundskeeper operations',()=>{
  test('six-day scouting refresh preserves every unresolved packet and excludes trails already in verification',async()=>{
    const previous={candidates:[{id:'osm-relation-10',name:'Unresolved',region:'dolomites',expansionTier:'existing-area',priority:1},{id:'osm-relation-11',name:'Decided',region:'dolomites',expansionTier:'existing-area',priority:2},{id:'osm-relation-12',name:'Already admitted',region:'dolomites',expansionTier:'existing-area',priority:3}]};
    const store=memoryStore({'new-trail-scouting':previous,'new-trail-scouting-review':{decisions:[{candidateId:'osm-relation-11',action:'park'}]},'trail-orchestration':{trails:[{candidateId:'osm-relation-12'}]}});
    const result=await refreshLiveNewTrailScouting(store,[{region:'dolomites',data:{features:[feature(20)]}}],[],{at,limit:25,runId:'123'});
    expect(result.packet.candidates.map(item=>item.id)).toEqual(['osm-relation-10','osm-relation-20']);
    expect(store.artifacts['new-trail-scouting-status']).toEqual(expect.objectContaining({status:'healthy',runId:'123',cadence:'monday-through-saturday',primaryRegion:'dolomites',publicMutationAllowed:false}));
  });

  test('the scouting receipt skips Sunday when scheduling the next refresh',()=>{
    expect(nextScoutingAt('2026-08-22T06:30:00.000Z')).toBe('2026-08-24T06:30:00.000Z');
  });

  test('only the latest New Trail click is effective, preventing an older selection from admitting a parked candidate',async()=>{
    const packet={candidates:[{id:'osm-relation-20',osmRelation:20,name:'Candidate',region:'dolomites',center:[11,46],distanceKm:4,sourceUrl:'https://www.openstreetmap.org/relation/20'}]};
    const store=memoryStore({'new-trail-scouting':packet});store.listNewTrailReviews=async()=>[
      {id:'older',candidateId:'osm-relation-20',action:'send-to-verification',note:'',submittedAt:'2026-08-20T11:00:00Z'},
      {id:'latest',candidateId:'osm-relation-20',action:'park',note:'Wait.',submittedAt:'2026-08-20T11:01:00Z'},
    ];
    const outcomes=await ingestNewTrailReviews(store);
    expect(outcomes).toEqual([expect.objectContaining({reviewId:'older',status:'superseded'}),expect.objectContaining({reviewId:'latest',status:'processed',action:'park'})]);
    expect(store.jobs).toEqual([]);expect(store.artifacts['new-trail-scouting-review'].decisions).toEqual([expect.objectContaining({candidateId:'osm-relation-20',action:'park'})]);
  });

  function selection(id){
    return {packet:{candidates:[{id,osmRelation:21,name:'Candidate 21',region:'dolomites',
      center:[11,46],distanceKm:4,sourceUrl:`https://www.openstreetmap.org/relation/21`}]},
      review:{id:'selection',candidateId:id,action:'send-to-verification',
        note:'Audit geometry.',submittedAt:at,submittedBy:'moderator'}};
  }

  test('a selected candidate enters the same stable, five-cap Cartographer fleet without publication',async()=>{
    const {packet,review}=selection('osm-relation-21');
    const store=memoryStore({'new-trail-scouting':packet,'trail-orchestration':{contractVersion:'1.0.0',publicMutationAllowed:false,trails:[]}});store.listNewTrailReviews=async()=>[review];
    // The catalogue holds this walk, so there is a record for a publication to
    // restate and admitting it can lead somewhere.
    const outcomes=await ingestNewTrailReviews(store,{productionTrails:[{id:'osm-relation-21',name:'Candidate 21'}]});
    expect(outcomes).toEqual([expect.objectContaining({status:'processed',jobIds:['trail-verification-osm-relation-21-cartographer-1']})]);
    expect(store.jobs[0]).toEqual(expect.objectContaining({agentId:'cartographer',publicMutationAllowed:false,humanGate:'geometry-approval'}));
    expect(store.artifacts['trail-orchestration'].trails[0]).toEqual(expect.objectContaining({candidateId:'osm-relation-21',state:'geometry-audit',publicMutationAllowed:false}));
  });

  // A scouted walk lives only in Firestore -- an id, a name, a relation and an
  // empty path -- and publication restates nine fields from a catalogue record
  // it has not got. Admitting it spends the research agents, the copywriter
  // and the visual director on a walk that stops at the mapping gate for ever.
  test('a candidate the catalogue does not hold is kept back rather than paid for',async()=>{
    const {packet,review}=selection('osm-relation-21');
    const store=memoryStore({'new-trail-scouting':packet,'trail-orchestration':{contractVersion:'1.0.0',publicMutationAllowed:false,trails:[]}});store.listNewTrailReviews=async()=>[review];
    const outcomes=await ingestNewTrailReviews(store,{productionTrails:[]});
    expect(store.jobs).toEqual([]);
    expect(store.artifacts['trail-orchestration'].trails).toEqual([]);
    // Held, not dropped: the reason is on the artifact and in the outcome.
    expect(outcomes[0].summary).toEqual({selected:1,heldForImport:1});
    expect(store.artifacts['new-trail-intake'].heldForImport[0])
      .toEqual(expect.objectContaining({id:'osm-relation-21',reason:expect.stringMatching(/not in the catalogue/)}));
  });

  test('Groundskeeper removal approval updates protected state and leaves a truthful publication-pending receipt',async()=>{
    const hazard={id:'warning:1',state:'resolution-review',title:'Snow warning',message:'Warning.',severity:'severe',area:'Dolomites',trailNames:['Trail A']};
    const store=memoryStore({'dynamic-hazards':{contractVersion:'1.0.0',hazards:[hazard]}});store.listHazardReviews=async()=>[{id:'hazard-review',hazardId:'warning:1',action:'confirm-resolved',note:'Official source expired.',submittedAt:at,submittedBy:'moderator'}];
    const outcomes=await ingestHazardReviews(store);
    expect(outcomes).toEqual([expect.objectContaining({status:'processed',websiteState:'publication-integration-pending'})]);
    expect(store.artifacts['dynamic-hazards'].hazards).toEqual([]);
    expect(store.artifacts['hazard-release-receipts'].receipts[0]).toEqual(expect.objectContaining({status:'protected-update-applied',publicMutationAllowed:false}));
  });
});
