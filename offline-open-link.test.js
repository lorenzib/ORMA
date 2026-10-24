const fs = require('fs');
const path = require('path');

// Fenn Promenade downloaded correctly, but "Open offline map" opened Lago di
// Carezza: trail.html carried a fixed link to the first pilot and nothing
// replaced it. With every Verified trail downloadable, each must open its own.
describe('the trail page opens the offline map of the trail it shows', () => {
  function panelFor(id){
    document.body.innerHTML = `
      <section id="offlinePackagePanel" hidden>
        <button id="offlineDownloadBtn"></button>
        <a id="offlineOpenBtn" href="offline/trail.html" hidden>Open offline map</a>
        <button id="offlineRemoveBtn"></button>
        <p id="offlinePackageStatus"></p>
      </section>`;
    window.history.replaceState({}, '', `/trail.html?id=${id}`);
    jest.isolateModules(() => {
      require('./offline-packages.js');
    });
    return document.getElementById('offlineOpenBtn');
  }

  test.each(['osm-11839597', 'lago-braies', 'lago-carezza'])('%s opens its own package', id => {
    expect(panelFor(id).getAttribute('href')).toBe(`/offline/trail.html?id=${id}`);
  });

  test('trail.html no longer names a trail in the link', () => {
    const html = fs.readFileSync(path.join(__dirname, 'trail.html'), 'utf8');
    expect(html).not.toMatch(/id="offlineOpenBtn"[^>]*lago-carezza/);
  });
});
