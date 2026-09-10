const model=require('./product-funnel-model');

function event(clientId,family,state,properties={}){
  return {clientId,family,state,properties};
}

describe('protected product funnel aggregation',()=>{
  test('uses homepage recommendation browsers as the conversion cohort',()=>{
    const events=[
      event('a','discovery_search','results_viewed',{surface:'homepage'}),
      event('b','discovery_search','results_viewed',{surface:'homepage'}),
      event('a','trail_decision','explanation_viewed',{surface:'homepage'}),
      event('a','trail_decision','selected',{surface:'homepage',selectionSource:'primary_cta'}),
      event('a','trail_decision','opened',{}),
      event('c','trail_decision','opened',{}),
      event('a','offline_package','ready',{}),
      event('a','hike_session','started',{}),
    ];
    const result=model.build(events);
    expect(result.recommendationBrowsers).toBe(2);
    expect(result.primaryActionRate).toBe(50);
    expect(result.steps.find(step=>step.id==='opened')).toEqual(expect.objectContaining({browsers:1,rate:50,eventCount:2}));
  });

  test('separates map exploration, adjustments, and no-result discovery',()=>{
    const events=[
      event('a','discovery_search','results_viewed',{surface:'homepage'}),
      event('b','discovery_search','no_results',{surface:'homepage'}),
      event('a','discovery_search','filters_changed',{surface:'homepage'}),
      event('a','trail_decision','selected',{surface:'homepage',selectionSource:'map_marker'}),
      event('outside','trail_decision','selected',{surface:'search',selectionSource:'map_marker'}),
    ];
    const result=model.build(events);
    expect(result.mapInteractionRate).toBe(100);
    expect(result.adjustmentRate).toBe(100);
    expect(result.noResultRate).toBe(50);
  });

  test('returns null rates when no recommendation cohort exists',()=>{
    const result=model.build([]);
    expect(result.primaryActionRate).toBeNull();
    expect(result.steps.every(step=>step.rate===null)).toBe(true);
  });
});
