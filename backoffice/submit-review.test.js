'use strict';

const { parseArgs, planDossier, planRoute } = require('./cli/submit-review');

function store(artifacts){
  return { getArtifact: async (id) => artifacts[id] || null };
}

const dossierQueue = {
  items: [
    { state:'awaiting-human', candidateId:'osm-ready', reviewId:'geometry-approval-osm-ready-1',
      gateType:'geometry-approval', trailName:'Ready Loop', approvalAllowed:true, blockingReasons:[] },
    { state:'awaiting-human', candidateId:'osm-blocked', reviewId:'geometry-approval-osm-blocked-1',
      gateType:'geometry-approval', trailName:'Gap Loop', approvalAllowed:false,
      blockingReasons:['not-closed-loop','disconnected-components'] },
    { state:'awaiting-human', candidateId:'osm-guidance', reviewId:'dossier-approval-osm-guidance-1',
      gateType:'dossier-approval', trailName:'No Start', approvalAllowed:false,
      blockingReasons:['recommended-start missing'] },
  ],
};
const routeReview = {
  items: [
    { candidateId:'osm-relation-1', reviewState:'ready-for-human-route-choice', title:'Choose loop',
      selectionMode:'one-or-more', proposals:[{id:'variant-a'},{id:'variant-b'}] },
  ],
};

describe('submit-review guardrails', () => {
  test('parseArgs reads candidate, action, blocker:reason, proposals and apply', () => {
    const a = parseArgs(['--candidate','osm-1','--action','approve','--accept-blocker','not-closed-loop:genuine loop',
      '--proposals','x,y','--apply']);
    expect(a.candidate).toBe('osm-1');
    expect(a.action).toBe('approve');
    expect(a.acceptedBlockers).toEqual([{ blocker:'not-closed-loop', reason:'genuine loop' }]);
    expect(a.proposals).toEqual(['x','y']);
    expect(a.apply).toBe(true);
  });

  test('approves a clean (approvalAllowed) gate with no blockers to waive', async () => {
    const plan = await planDossier(store({ 'dossier-review-queue':dossierQueue }),
      parseArgs(['--candidate','osm-ready']));
    expect(plan.payload).toMatchObject({ reviewId:'geometry-approval-osm-ready-1', action:'approve', acceptedBlockers:[] });
  });

  test('refuses to approve a gate with un-waived blockers', async () => {
    await expect(planDossier(store({ 'dossier-review-queue':dossierQueue }),
      parseArgs(['--candidate','osm-blocked']))).rejects.toThrow(/blocker\(s\) not waived/);
  });

  test('approves once every blocker is waived with a reason', async () => {
    const plan = await planDossier(store({ 'dossier-review-queue':dossierQueue }),
      parseArgs(['--candidate','osm-blocked',
        '--accept-blocker','not-closed-loop:returns via road',
        '--accept-blocker','disconnected-components:single mapped line']));
    expect(plan.payload.action).toBe('approve');
    expect(plan.payload.acceptedBlockers).toHaveLength(2);
  });

  test('never waives a route-guidance blocker', async () => {
    await expect(planDossier(store({ 'dossier-review-queue':dossierQueue }),
      parseArgs(['--candidate','osm-guidance','--accept-blocker','recommended-start missing:looks fine'])))
      .rejects.toThrow(/route-guidance blockers must be supplied/);
  });

  test('request-revision needs a note', async () => {
    await expect(planDossier(store({ 'dossier-review-queue':dossierQueue }),
      parseArgs(['--candidate','osm-blocked','--action','request-revision'])))
      .rejects.toThrow(/precise --note/);
  });

  test('unknown candidate is refused', async () => {
    await expect(planDossier(store({ 'dossier-review-queue':dossierQueue }),
      parseArgs(['--candidate','osm-nope']))).rejects.toThrow(/No awaiting-human dossier review/);
  });

  test('route: keeping a variant needs proposals; a valid one plans cleanly', async () => {
    await expect(planRoute(store({ 'route-review':routeReview }),
      parseArgs(['--kind','route','--candidate','osm-relation-1','--action','approve-route-variants'])))
      .rejects.toThrow(/needs --proposals/);
    const plan = await planRoute(store({ 'route-review':routeReview }),
      parseArgs(['--kind','route','--candidate','osm-relation-1','--action','approve-route-variants','--proposals','variant-a']));
    expect(plan.payload).toMatchObject({ candidateId:'osm-relation-1', action:'approve-route-variants', proposalIds:['variant-a'] });
  });
});
