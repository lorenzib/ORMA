const fs = require('fs');
const vm = require('vm');

// "Back" from a trail is the one thing a reader does more than anything else,
// and until now it worked from everywhere except the surface that ranks trails
// for their dog. safeTrailReturn allowed four list pages by name; the homepage
// is "/", which the guard rejected along with every other absolute path, so
// every card on it sent the reader to a page whose breadcrumb read "All
// trails" — losing their ranking, their map view and their chosen day.
function load(){
  const source = fs.readFileSync('trail.js', 'utf8');
  const start = source.indexOf('function safeTrailReturn(');
  const end = source.indexOf('let trailInitStarted');
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${source.slice(start, end)}\nthis.__exports = { safeTrailReturn };`, context);
  return context.__exports.safeTrailReturn;
}

describe('where "back" is allowed to go', () => {
  const safeTrailReturn = load();

  test.each([
    ['/', 'the homepage'],
    ['/?view=returning', 'the homepage with its view'],
    ['browse-trails.html', 'browse'],
    ['browse-trails.html?search=Braies', 'browse with a query'],
    ['saved.html', 'saved'],
    ['journal.html', 'the journal'],
    ['compare.html?ids=a,b', 'a comparison'],
  ])('%s is this site (%s)', value => {
    expect(safeTrailReturn(value)).toBe(value);
  });

  test.each([
    ['//evil.example.com', 'a protocol-relative host'],
    ['https://evil.example.com', 'another origin'],
    ['javascript:alert(1)', 'a script url'],
    ['/account.html', 'an absolute path that is not the homepage'],
    ['/../etc/passwd', 'a traversal'],
    ['settings.html', 'a page that is not a list'],
    ['', 'nothing'],
  ])('%s is refused (%s)', value => {
    expect(safeTrailReturn(value)).toBe('');
  });
});
