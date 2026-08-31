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
  });
});
