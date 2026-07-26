const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, 'my-trails.js'), 'utf8');

function setup({ saveResult = true } = {}){
  document.body.innerHTML = `
    <p id="pageSubline"></p>
    <div id="loggedOutState"></div>
    <div id="loggedInState"></div>
    <div id="areaFilterRow"></div>
    <div id="filteredTrailsList"></div>`;

  window.trails = [{
    id: 'safe&id',
    name: '<img src=x onerror=alert(1)>',
    region: 'dolomites',
    valley: 'Val & Valley',
    area: '<b>Area</b>',
    distance: 4,
    elevation: 120,
    hours: 2,
    terrainType: '<script>bad()</script>',
    terrainRank: 0,
    safetyLevel: 'low-risk',
    shadeCoverage: 50,
    curated: true,
  }];
  window.DoloPawsRegions = {
    assign: jest.fn(),
    valleysFor: () => [['Val & Valley', 1]],
  };
  window.DoloPawsAuth = {
    onChange: callback => callback({ uid: 'user-1' }),
    getDogProfile: async () => ({ name: 'Fido', fitness: 'moderate' }),
    getFavorites: async () => ({}),
    setFavorites: jest.fn(async () => saveResult),
  };

  window.eval(source);
  return new Promise(resolve => setTimeout(resolve, 0));
}

afterEach(() => {
  delete window.trails;
  delete window.DoloPawsRegions;
  delete window.DoloPawsAuth;
});

test('escapes trail data and encodes trail links', async () => {
  await setup();

  const list = document.getElementById('filteredTrailsList');
  expect(list.querySelector('img')).toBeNull();
  expect(list.querySelector('script')).toBeNull();
  expect(list.querySelector('.name').textContent).toBe('<img src=x onerror=alert(1)>');
  expect(list.querySelector('.name').getAttribute('href')).toBe('trail.html?id=safe%26id');
  expect(document.querySelector('[data-valley="Val & Valley"]')).not.toBeNull();
  expect(document.getElementById('areaFilterRow').textContent).toContain('Val & Valley');
});

test('rolls back a favorite when persistence fails', async () => {
  await setup({ saveResult: false });

  document.querySelector('.save-btn').click();
  await new Promise(resolve => setTimeout(resolve, 0));

  expect(window.DoloPawsAuth.setFavorites).toHaveBeenCalledWith({ 'safe&id': true });
  expect(document.querySelector('.save-btn').textContent).toBe('Save');
  expect(document.getElementById('pageSubline').textContent).toMatch(/could not update/i);
  expect(document.getElementById('pageSubline').getAttribute('role')).toBe('alert');
});
