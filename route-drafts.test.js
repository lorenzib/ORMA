describe('route draft storage', () => {
  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    require('./route-drafts.js');
  });

  test('saves, reopens and removes normalized drafts', () => {
    const store = window.DoloPawsRouteDrafts;
    const record = store.save({
      id:'loop-1', name:'Draft loop', distanceM:1234, graphUrl:'graph.json', coverageId:'area-1',
      points:[{lat:46,lng:11},{lat:46.01,lng:11.01},{lat:46.02,lng:11.02}],
      path:[[46,11],[46.01,11.01],[46,11]],
    });
    expect(record.distanceM).toBe(1234);
    expect(store.find('loop-1').coverageId).toBe('area-1');
    expect(store.remove('loop-1')).toBe(true);
    expect(store.read()).toEqual([]);
  });

  test('rejects incomplete route records', () => {
    expect(window.DoloPawsRouteDrafts.save({ id:'bad', points:[], path:[] })).toBeNull();
    expect(window.DoloPawsRouteDrafts.save({ id:'one', points:[{lat:46,lng:11}], path:[[46,11],[46.01,11.01]] })).toBeNull();
  });

  test('saves a two-point open route, the minimum the planner lets you finish', () => {
    // Point-to-point and out-and-back finish at two points; only a loop needs
    // three, and that is the planner's rule, not the store's.
    const store = window.DoloPawsRouteDrafts;
    const record = store.save({
      id:'point-to-point-1', name:'Draft point to point · 15.7 km', shape:'point-to-point', distanceM:15700,
      points:[{lat:46.6,lng:11.9},{lat:46.62,lng:12.05}],
      path:[[46.6,11.9],[46.61,11.97],[46.62,12.05]],
    });
    expect(record).not.toBeNull();
    expect(record.points).toHaveLength(2);
    expect(store.find('point-to-point-1').distanceM).toBe(15700);
  });
});
