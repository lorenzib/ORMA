const {runTrailSpecialist}=require('./workflows/run-trail-specialist');

// The campaign planner names two cartographer jobs: 'verify-current-relation'
// for a trail that is a single OSM relation, and
// 'locate-authoritative-route-geometry' for one whose identity is an approved
// composite of several. Only the first was ever built.
//
// The second fell straight into the single-relation reconstructor, which
// demands one externalId and threw 'route-source-identity-unresolved'. So
// alpe-siusi -- whose identity was settled on 2026-09-06 as an approved
// composite of relations 30, 7 and 6 at 100% coverage -- reported that its
// identity could not be resolved, on every attempt since the job was created.
// Releasing it only threw it again.
const compositeTrail={
  id:'alpe-siusi', name:'Alpe di Siusi Meadow Loop', distance:7.5,
  path:[[46.54017,11.61807],[46.53824,11.61941]],
};
const relationTrail={...compositeTrail, id:'giro-del-bulacia', osmRelation:9483250};

const job=(action,candidateId)=>({id:`j-${candidateId}`,agentId:'cartographer',action,candidateId});

describe('a cartographer job says what it cannot do', () => {
  test('an action nobody implements is refused as research, not as lost identity', async () => {
    await expect(runTrailSpecialist({
      job:job('locate-authoritative-route-geometry','alpe-siusi'), trail:compositeTrail, context:[],
    })).rejects.toThrow('source-identity-research-required');
  });

  test('and the message is the one run-catalogue-batch already uses', () => {
    const batch=require('fs').readFileSync(require('path').join(__dirname,'workflows/run-catalogue-batch.js'),'utf8');
    expect(batch).toContain("throw new Error('source-identity-research-required')");
  });

  test('the implemented action still runs', async () => {
    let reached=false;
    await runTrailSpecialist(
      { job:job('verify-current-relation','giro-del-bulacia'), trail:relationTrail, context:[] },
      { fetchRelation:async () => { reached=true; throw new Error('stop here'); } },
    ).catch(error => { if(error.message!=='stop here') throw error; });
    // It got past the gate and into the reconstructor, which is the point.
    expect(reached).toBe(true);
  });

  test('every action the planner emits is either handled or refused by name', () => {
    const planner=require('fs').readFileSync(require('path').join(__dirname,'workflows/plan-catalogue-campaign.js'),'utf8');
    const emitted=[...planner.matchAll(/action: item\.externalRelationId \? '([^']+)' : '([^']+)'/g)][0];
    expect(emitted).toBeTruthy();
    const [,withRelation,withoutRelation]=emitted;
    expect(withRelation).toBe('verify-current-relation');
    // If the planner ever starts emitting a third, this fails rather than
    // letting it fall through to a message about identity.
    expect(withoutRelation).toBe('locate-authoritative-route-geometry');
  });
});
