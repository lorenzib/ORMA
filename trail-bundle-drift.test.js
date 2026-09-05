const fs = require('fs');
const path = require('path');

const { OUTPUT, SOURCES, bundleSource } = require('./scripts/build-trail-page-bundle.js');

// trail-app.bundle.js inlines about thirty source files -- metrics.js,
// scoring.js, hike-mode.js, trail.js and the rest -- and trail.html loads the
// bundle rather than those files. So editing a source without rerunning
// `npm run build:trail-page-bundle` leaves the trail page running the old copy,
// with every other test still green because they read the sources directly.
//
// Nothing caught that: the existing bundle tests assert its version string or
// read its contents, and none of them rebuild it. This does.

describe('the trail page bundle matches its sources', () => {
  test('every declared source still exists', () => {
    const missing = SOURCES.filter(file => !fs.existsSync(path.join(__dirname, file)));
    expect(missing).toEqual([]);
  });

  test('the committed bundle is byte-identical to a fresh build', () => {
    const committed = fs.readFileSync(path.join(__dirname, OUTPUT), 'utf8');
    const rebuilt = bundleSource();
    if(committed !== rebuilt){
      // Name the drifted sources rather than dumping a megabyte of diff.
      const drifted = SOURCES.filter(file => {
        const source = fs.readFileSync(path.join(__dirname, file), 'utf8').trimEnd();
        return !committed.includes(`\n// ---- ${file} ----\n${source}\n;`);
      });
      throw new Error(
        `${OUTPUT} is stale. Run: npm run build:trail-page-bundle\n` +
        `Drifted source(s): ${drifted.join(', ') || '(ordering or banner only)'}`
      );
    }
    expect(committed).toBe(rebuilt);
  });
});
