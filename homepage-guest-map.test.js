const fs = require('fs');
const path = require('path');

// Guests get the map too (owner, 28 Nov 2026): the Trails page's map sits
// under the guest search hero, coloured for the dog being previewed.
const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');

describe('guest homepage map', () => {
  const html = read('index.html');
  const guest = html.slice(html.indexOf('id="newCustomerHomepage"'), html.indexOf('id="returningCustomerHomepage"'));
  const controller = read('homepage-search.js');

  test('the map sits in the guest homepage, outside the content the controller rewrites', () => {
    expect(guest).toContain('id="hpMap"');
    expect(guest.indexOf('id="hpMap"')).toBeLessThan(guest.indexOf('id="hpContent"'));
    expect(guest).toContain('id="hpMapExpandBtn"');
    expect(guest).toContain('id="hpMapDrawBtn"');
  });

  test('it is the Trails page map, loaded before the guest controller', () => {
    expect(html.indexOf('<script src="explore-map.js')).toBeLessThan(html.indexOf('<script src="browse-map.js'));
    expect(html.indexOf('<script src="browse-map.js')).toBeLessThan(html.indexOf('<script src="homepage-search.js'));
    expect(controller).toContain("window.DoloPawsBrowseMap.create({");
    expect(controller).toContain("containerId: 'hpMap'");
  });

  test('it is coloured for the previewed dog and follows the list filters', () => {
    expect(controller).toContain('verdictFor: verdictOf');
    expect(controller).toContain('scoreFor: scoreOf');
    expect(controller).toMatch(/function renderAll\(\) \{[\s\S]*?renderMap\(\);\s*\}/);
    expect(controller).toContain('guestMap.update(rankedList()');
  });

  test('the Italian homepage has it too', () => {
    expect(read('it/index.html')).toContain('id="hpMap"');
  });
});
