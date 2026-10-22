'use strict';

const path=require('path');
const {existingCopyFields,RETAINED_COPY_FIELDS,buildVerifiedEditorialHandoff}
  =require('./workflows/verified-editorial-handoff');
const {buildPublicationStaging}=require('./workflows/build-publication-staging');
const {materializeApprovedPublications}=require('./workflows/materialize-approved-publications');
const {compileVerifiedDossier}=require('./workflows/compile-verified-dossier');
const {singleRelationGuidance}=require('./workflows/route-guidance-from-map');
const {loadProductionTrails}=require('../scripts/load-production-trails');

const ROOT=path.resolve(__dirname,'..');
const AT='2026-10-18T10:00:00Z';

/**
 * Establishing a walk's directions cost a model call to rewrite a description
 * that already existed, was already approved, and is on the live page.
 *
 * The photograph has had the opposite rule for a long time: a trail already on
 * the site keeps the one it has rather than having a new one sourced and
 * licensed. Its words had no such rule.
 */
function lane({record,existingTrail=record,outputs={outputs:[]},reviewQueue={submissions:[]}}){
  const trail={candidateId:record.id,trailId:record.id,trailName:record.name,...record};
  const survey={routeGuidance:singleRelationGuidance({tags:{ref:'20'}}),
    relation:{tags:{ref:'20',name:record.name}},
    source:{url:'https://www.openstreetmap.org/relation/11839597',externalId:'relation/11839597',
      endpoint:'x',relationVersion:3,relationTimestamp:'2026-09-01T00:00:00Z',licence:'ODbL-1.0'},
    geometry:{type:'LineString',coordinates:record.path.map(point=>[point[1],point[0]])},
    assessment:{issues:[],pointCount:record.path.length,distanceKm:record.distance},claims:[]};
  const review={reviewId:'r',approvalAllowed:true,blockingReasons:[],
    specialistOutputs:[{agentId:'cartographer',jobId:'c1',result:survey}]};
  const dossier=compileVerifiedDossier(review,trail,{at:AT,trail});
  const handoff=buildVerifiedEditorialHandoff(dossier,
    {candidateId:trail.candidateId,trailName:trail.trailName,verifiedAt:AT,conditions:[]},
    null,{at:AT,preserveExistingAssets:Boolean(existingTrail),existingTrail});
  const staging=buildPublicationStaging(handoff.queue,outputs,reviewQueue,
    {at:AT,productionTrails:[record]});
  return {trail,survey,handoff,staging,item:staging.items[0]};
}

function catalogueTrail(){
  const record=loadProductionTrails(ROOT).find(entry=>entry.id==='osm-11839597');
  if(!record)throw new Error('osm-11839597 left the catalogue; pick another surveyed trail');
  return record;
}

describe('an existing trail keeps the description it already has',()=>{
  test('every catalogue trail can supply its own copy',()=>{
    const trails=loadProductionTrails(ROOT);
    const cannot=trails.filter(record=>!existingCopyFields(record)).map(record=>record.id);
    expect(trails.length).toBeGreaterThan(150);
    expect(cannot).toEqual([]);
  });

  // All three or nothing: not having the copy and not asking for it must not
  // look the same, and a record missing one of them has no copy to keep.
  test('a record missing any one of the three supplies none of it',()=>{
    const whole={name:'A walk',desc:'A gentle promenade.',tips:'Carry water.'};
    expect(existingCopyFields(whole)).toEqual(whole);
    for(const field of RETAINED_COPY_FIELDS){
      expect({field,copy:existingCopyFields({...whole,[field]:'  '})}).toEqual({field,copy:null});
      const {[field]:dropped,...missing}=whole;
      expect({field,copy:existingCopyFields(missing)}).toEqual({field,copy:null});
    }
    expect(existingCopyFields(null)).toBeNull();
  });

  test('no copywriter is queued for a trail that has its own words',()=>{
    const {handoff}=lane({record:catalogueTrail()});
    expect(handoff.jobs).toEqual([]);
    expect(handoff.item.copyPolicy).toBe('preserve-existing');
    // Nothing to review, so no gate stands on reviewing it.
    expect(handoff.item.gates.map(gate=>gate.id)).toEqual(['publication-quality-gate']);
    expect(handoff.queue.summary).toMatchObject({copywriterJobs:0,retainedCopy:1,visualDirectorJobs:0});
  });

  test('and one is queued for a trail whose record cannot supply them',()=>{
    const record=catalogueTrail();
    const {handoff}=lane({record,existingTrail:{...record,tips:''}});
    expect(handoff.jobs.map(job=>job.agentId)).toEqual(['copywriter']);
    expect(handoff.item.copyPolicy).toBe('draft-new');
    expect(handoff.item.gates.map(gate=>gate.id)).toContain('editorial-evidence-policy');
  });

  test('a new trail still gets both, because it has nothing to keep',()=>{
    const {handoff}=lane({record:catalogueTrail(),existingTrail:null});
    expect(handoff.jobs.map(job=>job.agentId)).toEqual(['copywriter','visualDirector']);
    expect(handoff.item.copyPolicy).toBe('draft-new');
  });
});

describe('the lane runs end to end without a model call',()=>{
  const record=catalogueTrail();
  // No agent outputs, no decisions: nothing in this run was paid for.
  const {trail,survey,item}=lane({record});

  test('it reaches publication with nothing queued and nothing approved',()=>{
    expect({state:item.state,approvals:item.missingApprovals,blockers:item.publicationMappingBlockers})
      .toEqual({state:'ready-for-publication-preview',approvals:[],blockers:[]});
  });

  test('and publishes the trail\'s own words, unchanged',()=>{
    expect(item.proposedWebsiteFields).toMatchObject({
      name:record.name,desc:record.desc,tips:record.tips});
  });

  test('what it adds is the directions',()=>{
    expect(item.proposedWebsiteFields.routeNumberGuidance)
      .toEqual(expect.objectContaining({mode:'numbered',establishedBy:expect.any(Object)}));
  });

  test('and the override file takes it',()=>{
    const result=materializeApprovedPublications({
      requests:{requests:[{id:'pub-1',candidateId:trail.candidateId,
        status:'approved-for-pr-creation',approvedBy:'benedetta',approvedAt:AT}]},
      staging:{items:[item]},routesByCandidate:{[trail.candidateId]:{geometry:survey.geometry}},
      overrides:{contractVersion:'1.0.0',trails:[]},operationalFacts:{trails:[]},at:AT});
    const entry=result.overrides.trails[0];
    expect(entry.verificationScope).toBe('routeReviewed');
    expect(entry.fields.desc).toBe(record.desc);
  });

  test('a republication keeps a withdrawal a person made',()=>{
    // Taking a walk off the site is a human decision; a later publication
    // replaces the entry wholesale and must not quietly put it back.
    const withdrawal={reason:'not-a-walk',at:'2026-10-22'};
    const result=materializeApprovedPublications({
      requests:{requests:[{id:'pub-2',candidateId:trail.candidateId,
        status:'approved-for-pr-creation',approvedBy:'benedetta',approvedAt:AT}]},
      staging:{items:[item]},routesByCandidate:{[trail.candidateId]:{geometry:survey.geometry}},
      overrides:{contractVersion:'1.0.0',trails:[{id:item.targetTrailId,verificationScope:'routeReviewed',
        fields:{ormaVerified:false,withdrawal}}]},operationalFacts:{trails:[]},at:AT});
    expect(result.overrides.trails[0].fields.withdrawal).toEqual(withdrawal);
  });

  // A copywriter that did run still wins: this is about not paying for words
  // nobody needed, not about refusing words somebody wrote.
  test('a copywriter that did run is still what gets published',()=>{
    const copyJobId=`verified-${record.id}-copy`;
    const written=lane({record,
      outputs:{outputs:[{jobId:copyJobId,candidateId:record.id,agentId:'copywriter',
        result:{title:'A better name',changes:[
          {section:'About the trail',after:'Newly written.'},
          {section:'Why it suits dogs',after:'Shaded and quiet.'},
          {section:'Important practical notes',after:'Carry water.'}]}}]},
      reviewQueue:{submissions:[{submissionId:'s1',decisions:[
        {jobId:copyJobId,action:'approve',gateId:'editorial-evidence-policy',decidedBy:'benedetta'}]}]}});
    expect(written.item.proposedWebsiteFields).toMatchObject({
      name:'A better name',desc:'Newly written.\n\nShaded and quiet.',tips:'Carry water.'});
  });
});
