'use strict';

const fs=require('fs');
const path=require('path');
const {automateEvidenceGates,gateDecision}=require('./workflows/automate-existing-trail-verification');

/**
 * The CEO asked for verification with no desk in it. Until 12 October the
 * evidence policy was handed `currentSiteTrails`, so the 22 catalogue trails
 * not yet on the public site had no automatic decision and waited for her --
 * 8 of them, 3 with nothing blocking them at all. Nothing covered the scope,
 * so the whole suite passed either way.
 */

const at='2026-10-12T16:00:00.000Z';
const PUBLISHED='tre-cime';
const UNPUBLISHED='osm-16363583';

const gate=(candidateId,blockingReasons=[])=>({
  reviewId:`dossier-approval-${candidateId}`,candidateId,trailId:candidateId,
  trailName:candidateId,gateType:'geometry-approval',state:'awaiting-human',
  approvalAllowed:!blockingReasons.length,blockingReasons,
  attempts:{},resolutionAttempts:{},jobIds:[]});

function store(items){
  const submitted=[];
  const artifacts={
    'dossier-review-queue':{items},
    'trail-orchestration':{trails:items.map(item=>({candidateId:item.candidateId,
      trailId:item.trailId,state:'dossier-human-gate',attempts:{},resolutionAttempts:{},jobIds:[]}))},
  };
  return {submitted,
    getArtifact:async id=>artifacts[id]||null,
    setArtifact:async(id,value)=>{artifacts[id]=value;},
    listDossierReviews:async()=>[],
    submitDossierReview:async input=>{submitted.push(input);
      return {ok:true,reviewId:input.reviewId,status:'queued'};}};
}

describe('a clean gate is decided for any trail in the catalogue',()=>{
  // Both are in the catalogue; only one is on the public site.
  const catalogue=[{id:PUBLISHED},{id:UNPUBLISHED}];

  test('a published trail is decided, as it always was',async()=>{
    const subject=store([gate(PUBLISHED)]);
    const outcomes=await automateEvidenceGates(subject,{at,productionTrails:catalogue});
    expect(outcomes).toHaveLength(1);
    expect(subject.submitted[0]).toEqual(expect.objectContaining({
      candidateId:PUBLISHED,action:'approve'}));
  });

  // The case that waited at a desk.
  test('a catalogue trail not yet on the site is decided too',async()=>{
    const subject=store([gate(UNPUBLISHED)]);
    const outcomes=await automateEvidenceGates(subject,{at,productionTrails:catalogue});
    expect(outcomes).toHaveLength(1);
    expect(subject.submitted[0]).toEqual(expect.objectContaining({
      candidateId:UNPUBLISHED,action:'approve'}));
  });

  test('the policy decides, and the decision is the policy actor’s, not hers',async()=>{
    const subject=store([gate(UNPUBLISHED)]);
    await automateEvidenceGates(subject,{at,productionTrails:catalogue});
    expect(subject.submitted[0].submittedBy).toBe('orma-existing-trail-verifier-v1');
  });

  test('a trail that is not in the catalogue at all is still left alone',async()=>{
    const subject=store([gate('osm-999999')]);
    expect(await automateEvidenceGates(subject,{at,productionTrails:catalogue})).toEqual([]);
    expect(subject.submitted).toEqual([]);
  });

  test('nothing is decided twice: a queued decision is not re-submitted',async()=>{
    const subject=store([gate(UNPUBLISHED)]);
    subject.listDossierReviews=async()=>[{reviewId:`dossier-approval-${UNPUBLISHED}`}];
    expect(await automateEvidenceGates(subject,{at,productionTrails:catalogue})).toEqual([]);
    expect(subject.submitted).toEqual([]);
  });

  test('it can be switched off, and then decides nothing',async()=>{
    const subject=store([gate(UNPUBLISHED)]);
    expect(await automateEvidenceGates(subject,
      {at,productionTrails:catalogue,autoVerificationEnabled:false})).toEqual([]);
  });
});

describe('what the policy does instead of asking her',()=>{
  const orchestration=candidateId=>({trails:[{candidateId,trailId:candidateId,
    state:'dossier-human-gate',attempts:{},resolutionAttempts:{},jobIds:[]}]});
  const decide=(item)=>gateDecision(item,{items:[item]},orchestration(item.candidateId),new Set());

  test('nothing blocking becomes an approval',()=>{
    expect(decide(gate(UNPUBLISHED))).toEqual(expect.objectContaining({action:'approve'}));
  });

  // Route guidance is the directions a walker follows; no written reason
  // replaces them. While an agent can still go and find them, the policy asks
  // the agent -- it does not park the trail at a desk and it does not give up.
  test('missing route guidance is sent to the agent that can supply it',()=>{
    const decision=decide(gate(UNPUBLISHED,
      ['logistics/recommended-start: no supported authoritative route guidance']));
    expect(decision).toEqual(expect.objectContaining({
      action:'request-revision',targetAgent:'logistics',acceptedBlockers:[]}));
  });

  // Only once nobody can supply them does it withhold verification, and it
  // withholds rather than waiving: an unwaivable blocker is never accepted.
  test('route evidence nobody can establish withholds verification',()=>{
    const item=gate(UNPUBLISHED,
      ['logistics/recommended-start: five automated resolution strategies exhausted']);
    const exhausted={trails:[{candidateId:item.candidateId,trailId:item.trailId,
      state:'dossier-human-gate',attempts:{},resolutionAttempts:{logistics:5},jobIds:[]}]};
    const decision=gateDecision(item,{items:[item]},exhausted,new Set());
    expect(decision.action).toBe('reject');
    expect(decision.note).toContain('critical route evidence could not be established');
    expect(decision.acceptedBlockers).toEqual([]);
  });

  test('and it never asks her to accept a route-guidance blocker',()=>{
    const decision=decide(gate(UNPUBLISHED,
      ['logistics/route-number-switches: no supported authoritative route guidance']));
    expect(decision.acceptedBlockers).toEqual([]);
  });
});

// The scope is decided at the call site, so the cases above pass whichever list
// the worker hands over -- which is exactly how this shipped narrow and stayed
// narrow. This pins the wiring itself.
describe('the worker hands the policy the whole catalogue',()=>{
  const worker=fs.readFileSync(path.join(__dirname,'workflows','run-live-backoffice-worker.js'),'utf8');

  test('every evidence-policy pass is given the catalogue',()=>{
    const calls=worker.match(/automateEvidenceGates\(store,\{\.\.\.options,productionTrails:(\w+)\}\)/g)||[];
    expect(calls.length).toBeGreaterThan(0);
    expect([...new Set(calls)]).toEqual(
      ['automateEvidenceGates(store,{...options,productionTrails:catalogueTrails})']);
  });

  test('and the catalogue is every trail, not just the published ones',()=>{
    expect(worker).toMatch(/const catalogueTrails=productionTrails;/);
    expect(worker).not.toMatch(/const catalogueTrails=currentSiteTrails/);
  });

  // Publication is a different question and keeps its own lane.
  test('publication review is still scoped to the site, not widened with it',()=>{
    expect(worker).toMatch(/automatePublicationReviews\(store,\{[^}]*siteTrails/);
  });
});
