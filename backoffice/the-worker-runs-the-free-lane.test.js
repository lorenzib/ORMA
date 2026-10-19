'use strict';

const path=require('path');
const {refreshPublicationStaging,ingestTrailReviews,processEditorialFirstPassJobs}
  =require('./workflows/run-live-backoffice-worker');
const {automateEditorialReviews,automatePublicationReviews}
  =require('./workflows/automate-existing-trail-verification');
const {compileVerifiedDossier}=require('./workflows/compile-verified-dossier');
const {buildVerifiedEditorialHandoff}=require('./workflows/verified-editorial-handoff');
const {singleRelationGuidance}=require('./workflows/route-guidance-from-map');
const {loadProductionTrails}=require('../scripts/load-production-trails');

const ROOT=path.resolve(__dirname,'..');
const AT='2026-10-19T10:00:00Z';

/**
 * The free lane, as the worker runs it rather than as a harness calls it.
 *
 * `publication-staging` was written in one place only: inside the loop that
 * applies an editorial decision. That held while every verified trail queued a
 * copywriter, because there was always a decision and staging was rebuilt as a
 * side effect of applying it.
 *
 * A trail already on the site keeps its own description now, so no copywriter
 * is queued, so there is no decision, so nothing rebuilt its staging and the
 * publication policy -- which reads that artifact -- never saw it. The walk was
 * verified, its handoff was written, and it stopped there: nothing queued,
 * nothing failing, and nothing saying so. Every test of this chain called
 * `buildPublicationStaging` directly and so could not see it.
 */
function catalogueTrail(){
  const record=loadProductionTrails(ROOT).find(entry=>entry.id==='osm-11839597');
  if(!record)throw new Error('osm-11839597 left the catalogue; pick another surveyed trail');
  return record;
}

function verifiedHandoff(record){
  const trail={candidateId:record.id,trailId:record.id,trailName:record.name,...record};
  const survey={routeGuidance:singleRelationGuidance({tags:{ref:'20'}}),
    relation:{tags:{ref:'20',name:record.name}},
    source:{url:'https://www.openstreetmap.org/relation/11839597',externalId:'relation/11839597',
      endpoint:'https://api.openstreetmap.org/x',relationVersion:1,
      relationTimestamp:'2026-09-01T00:00:00Z',licence:'ODbL-1.0'},
    geometry:{type:'LineString',coordinates:record.path.map(point=>[point[1],point[0]])},
    assessment:{issues:[],pointCount:record.path.length,distanceKm:record.distance},claims:[]};
  const dossier=compileVerifiedDossier({reviewId:'r',approvalAllowed:true,blockingReasons:[],
    specialistOutputs:[{agentId:'cartographer',jobId:'c1',result:survey}]},trail,{at:AT,trail});
  return buildVerifiedEditorialHandoff(dossier,
    {candidateId:trail.candidateId,trailName:trail.trailName,verifiedAt:AT,conditions:[]},
    null,{at:AT,preserveExistingAssets:true,existingTrail:record});
}

/** A store that refuses anything the free lane has no business doing. */
function store(seed){
  const artifacts={...seed};
  const submitted=[];
  return {artifacts,submitted,
    async getArtifact(id){return artifacts[id]||null;},
    async setArtifact(id,value){artifacts[id]=value;},
    async listReviews(){return [];},
    async listPublicationReviews(){return [];},
    async listJobs(){return [];},
    async submitContentReview(review){submitted.push({kind:'content',review});return {reviewId:'cr'};},
    async submitPublicationReview(review){submitted.push({kind:'publication',review});return {reviewId:'pr'};},
    async markReview(){},async putJob(){},async putJobIfAbsent(){return true;},
    async claimJob(){throw new Error('the free lane claimed a job');}};
}

describe('the worker carries a free-lane trail to publication',()=>{
  const record=catalogueTrail();
  const handoff=verifiedHandoff(record);
  const options={now:AT,at:AT,productionTrails:[record]};

  test('the handoff queues nothing, which is what makes the lane free',()=>{
    expect(handoff.jobs).toEqual([]);
  });

  test('so no editorial decision exists, and nothing rebuilds staging on its own',async()=>{
    const s=store({'verified-trail-editorial-queue':handoff.queue,
      'verified-trail-editorial-execution':{contractVersion:'1.0.0',outputs:[]},
      'content-review-queue':{submissions:[]}});
    expect(await automateEditorialReviews(s,options)).toEqual([]);
    expect(await ingestTrailReviews(s,options)).toEqual([]);
    expect(s.artifacts['publication-staging']).toBeUndefined();
  });

  test('the pass builds it, and the publication policy then sees the trail',async()=>{
    const s=store({'verified-trail-editorial-queue':handoff.queue,
      'verified-trail-editorial-execution':{contractVersion:'1.0.0',outputs:[]},
      'content-review-queue':{submissions:[]}});
    const staged=await refreshPublicationStaging(s,options);
    expect(staged).toEqual({status:'written',items:1,ready:1});

    const publications=await automatePublicationReviews(s,options);
    expect(publications).toEqual([{candidateId:record.id,status:'queued',reviewId:'pr'}]);
    expect(s.submitted.map(entry=>entry.kind)).toEqual(['publication']);
    expect(s.submitted[0].review.action).toBe('approve-for-pr-creation');
  });

  test('and no editorial first pass is run, because there is no job to run',async()=>{
    const s=store({'verified-trail-editorial-queue':handoff.queue});
    // claimJob throws, so this passing at all means nothing was claimed.
    expect(await processEditorialFirstPassJobs(s,{...options,env:{},
      runAgent:async()=>{throw new Error('the free lane called a model');}})).toEqual([]);
  });

  // The pass runs every half hour against a free-tier quota, so a rebuild that
  // changes nothing must not cost a write.
  test('a second pass with nothing new writes nothing',async()=>{
    const s=store({'verified-trail-editorial-queue':handoff.queue,
      'verified-trail-editorial-execution':{contractVersion:'1.0.0',outputs:[]},
      'content-review-queue':{submissions:[]}});
    expect((await refreshPublicationStaging(s,options)).status).toBe('written');
    expect((await refreshPublicationStaging(s,options))).toEqual({status:'unchanged',items:1});
  });

  test('and an empty editorial queue is said, not staged',async()=>{
    const s=store({'verified-trail-editorial-queue':{items:[]}});
    expect(await refreshPublicationStaging(s,options)).toEqual({status:'nothing-to-stage',items:0});
    expect(s.artifacts['publication-staging']).toBeUndefined();
  });
});
