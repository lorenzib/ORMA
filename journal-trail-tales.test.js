const fs = require('fs');
const path = require('path');

const read = name => fs.readFileSync(path.join(__dirname, name), 'utf8');

describe('Trail Tales journal experience', () => {
  const journal = read('journal.html');
  const card = read('walk-card.js');

  test('makes the latest walk a route-led Trail Tale', () => {
    expect(journal).toContain('id="jnFeature"');
    expect(journal).toContain('id="jnFeatureMap"');
    expect(journal).toContain('id="jnFeatureShare"');
    expect(journal).toContain('id="jnFeatureRecap"');
    expect(journal).toContain('data-jn-feature=');
    expect(journal).toContain('trail && Array.isArray(trail.path) ? trail.path');
  });

  test('renders private routes locally instead of sending their location to a tile service', () => {
    expect(journal).toContain('private recorded route never leaves');
    expect(journal).toContain('window.DoloPawsWalkCard.projectRoute');
    expect(journal).not.toContain('map-runtime.js');
    expect(journal).not.toContain('openfreemap');
    expect(journal).not.toContain('waymarkedtrails');
  });

  test('collects only optional, explicit dog recap choices', () => {
    expect(journal).toContain('id="jnTaleOverlay"');
    expect(journal).toContain('data-tale-group="paws"');
    expect(journal).toContain('data-tale-group="energy"');
    expect(journal).toContain('data-tale-group="moment"');
    expect(journal).toContain('Nothing is guessed.');
    expect(journal).toContain('Object.assign({}, entry.tale || {})');
  });

  test('offers social formats, visual choices, and privacy-first sharing', () => {
    expect(journal).toContain('data-format="post"');
    expect(journal).toContain('data-format="story"');
    expect(journal).toContain('data-format="square"');
    expect(journal).toContain('id="jnShareHideEnds" checked');
    expect(journal).toContain('id="jnShareHideRoute"');
    expect(journal).toContain('id="jnShareNative"');
    expect(journal).toContain('id="jnShareDownload"');
    expect(journal).toContain('id="jnShareCopy"');
    expect(card).toContain("'orma-trail-tale.png'");
  });

  test('does not introduce a public activity link or journal sync', () => {
    expect(journal).not.toMatch(/publicActivity|shareUrl|activityUrl/);
    expect(journal).toContain("return 'dolopaws-journal-' + uid");
    expect(journal).toContain('localStorage.setItem(key(), JSON.stringify(state.entries))');
  });
});
