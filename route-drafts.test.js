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

  test('keeps the shape and climb of a draft, so it reopens as it was drawn', () => {
    const store = window.DoloPawsRouteDrafts;
    store.save({
      id:'oab-1', name:'Draft out & back · 4 km', shape:'out-and-back', distanceM:4000, ascentM:212.4,
      points:[{lat:46.6,lng:11.9},{lat:46.62,lng:12.05}],
      path:[[46.6,11.9],[46.62,12.05],[46.6,11.9]],
    });
    expect(store.find('oab-1')).toMatchObject({ shape:'out-and-back', ascentM:212 });
  });

  test('an adjusted walk keeps the walk it came from, its share on that line and its heights', () => {
    const store = window.DoloPawsRouteDrafts;
    store.save({
      id:'loop-2', name:'Your version of Lago di Braies · 4 km', shape:'loop', distanceM:4000,
      basedOn:{ id:'lago-braies', name:'Lago di Braies' }, onLineShare:0.82, heights:[1496, 1501.6, 1496],
      points:[{lat:46.6,lng:11.9},{lat:46.61,lng:11.95},{lat:46.62,lng:12.05}],
      path:[[46.6,11.9],[46.61,11.95],[46.6,11.9]],
    });
    expect(store.find('loop-2')).toMatchObject({
      basedOn:{ id:'lago-braies', name:'Lago di Braies' }, onLineShare:0.82, heights:[1496, 1502, 1496],
    });
  });
});
