const path = require('path');
const { loadProductionTrails } = require('./scripts/load-production-trails');
const planner = require('./backoffice/workflows/plan-catalogue-campaign');

// The campaign admitted candidates without knowing whether they could clear the
// gate they were being admitted towards, and scored a trail's missing evidence
// upward. The queue filled with routes that cannot produce route guidance at
// all: 16 in the pipeline, 0 verified, 23 claim-resolution jobs blocked.

const root = __dirname;
const trail = (id, over = {}) => ({
  id, name:id, region:'dolomites', distance:5, path:[[46,11],[46.1,11.1]], ...over,
});

function order(list){
  const plan = planner.planCatalogueCampaign(list, { jobLimit: 10 });
  const items = (plan.campaign ? plan.campaign.items : plan.items) || [];
  return items.map(item => item.trailId || item.id);
}

describe('the campaign prefers trails that can finish', () => {
  test('a trail that can clear the gate outranks one that cannot, however empty', () => {
    // The unobtainable trail is deliberately the emptier one: before this, its
    // missing evidence pulled it to the front.
    const ranked = order([
      trail('cannot-but-empty', { routeNumberStatus:'not-listed-in-mapped-source' }),
      trail('can-clear', { routeNumberStatus:'mapped-relation-ref', reviewedAt:'2026-01-01',
        sourceLinks:['https://example.invalid'] }),
    ]);
    expect(ranked[0]).toBe('can-clear');
  });

  test('unknown ranks between clearable and unobtainable', () => {
    const ranked = order([
      trail('c-unobtainable', { routeNumberStatus:'not-listed-in-mapped-source' }),
      trail('a-clearable', { routeNumberStatus:'mapped-relation-ref' }),
      trail('b-unknown', { routeNumberStatus:'verification-pending' }),
    ]);
    expect(ranked).toEqual(['a-clearable', 'b-unknown', 'c-unobtainable']);
  });

  test('nobody has looked is not the same as nobody can number it', () => {
    expect(planner.routeGuidanceOutlook({ routeNumberStatus:'verification-pending' })).toBe('unknown');
    expect(planner.routeGuidanceOutlook({ routeNumberStatus:'not-listed-in-mapped-source' })).toBe('unobtainable');
    expect(planner.routeGuidanceOutlook({})).toBe('unknown');
  });

  test('the gate tier outranks everything else the score can reach', () => {
    // base 200/300 + sourced 15 + sourceLinks 10 + blockers 20 = 345 at most.
    expect(planner.GATE_CLEARABLE_WEIGHT).toBeGreaterThan(345);
    expect(planner.GATE_CLEARABLE_WEIGHT).toBeGreaterThan(planner.GATE_UNKNOWN_WEIGHT);
  });

  test('missing evidence still orders trails within a tier', () => {
    // Both clear the gate and both carry sources, so the only difference is a
    // missing review date. The original preference for the emptier trail is
    // preserved where it does no harm -- inside a tier that can finish.
    const ranked = order([
      trail('a-complete', { routeNumberStatus:'mapped-relation-ref', reviewedAt:'2026-01-01',
        sourceLinks:['https://example.invalid'] }),
      trail('b-missing-date', { routeNumberStatus:'mapped-relation-ref',
        sourceLinks:['https://example.invalid'] }),
    ]);
    expect(ranked[0]).toBe('b-missing-date');
  });

  test('against the real catalogue, the next admissions can all finish', () => {
    const production = loadProductionTrails(root);
    const next = order(production).slice(0, 10)
      .map(id => production.find(t => t.id === id))
      .filter(Boolean);
    const clearable = next.filter(t => planner.routeGuidanceOutlook(t) === 'clearable');
    expect(clearable.length).toBe(10);
  });
});

// Tre Cime, Lago di Braies and Cinque Torri graduated under the curated
// process, before the four route-guidance claims became the contract, and have
// never been through the agentic pipeline at all. They carry a seal no current
// rule has ever tested, and the campaign skipped them for being verified
// already -- so the one standard was not applied to every trail.
describe('one standard for every trail',()=>{
  const graduated=(id)=>trail(id,{graduation:{status:'verified',
    completed:[...planner.GRADUATION_CHECKS||[]].length
      ?[...planner.GRADUATION_CHECKS]
      :['photo','route','routeNumbers','mapPoints','elevation','water','heat','exposure','livestock','surfaceHazards','access']}});

  const list=[graduated('already-sealed'),trail('ordinary-a'),trail('ordinary-b')];

  test('a graduated trail is still left alone by default',()=>{
    const plan=planner.planCatalogueCampaign(list,{jobLimit:10});
    expect(plan.selectedTrailIds).not.toContain('already-sealed');
    expect(plan.summary.reverifying).toBe(0);
  });

  test('naming it puts it through the pipeline like any other trail',()=>{
    const plan=planner.planCatalogueCampaign(list,{jobLimit:10,reverifyTrailIds:['already-sealed']});
    expect(plan.selectedTrailIds).toContain('already-sealed');
    expect(plan.summary.reverifying).toBe(1);
  });

  test('a named trail is picked first, not buried below the ungraduated ones',()=>{
    // A graduated trail has no baseline blockers, so it scores near the floor.
    // Asking for it by name and watching it never be picked is the same as not
    // being able to ask.
    const plan=planner.planCatalogueCampaign(list,{jobLimit:1,reverifyTrailIds:['already-sealed']});
    expect(plan.selectedTrailIds).toEqual(['already-sealed']);
  });

  test('naming a trail that was never graduated changes nothing about it',()=>{
    const plan=planner.planCatalogueCampaign(list,{jobLimit:10,reverifyTrailIds:['ordinary-a']});
    expect(plan.selectedTrailIds).toContain('ordinary-a');
    expect(plan.summary.reverifying).toBe(0);
  });
});
