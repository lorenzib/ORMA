const fs = require('fs');
const path = require('path');

const read = name => fs.readFileSync(path.join(__dirname, name), 'utf8');

describe('Trail Tales journal experience', () => {
  const journal = read('journal.html');
  const card = read('walk-card.js');

  test('puts the stats first, then one row per walk', () => {
    // The big "Latest Trail Tale" panel is gone; what it showed lives on each walk.
    expect(journal).not.toContain('id="jnFeature"');
    expect(journal.indexOf('id="jnStats"')).toBeLessThan(journal.indexOf('id="jnTimeline"'));
    expect(journal).toContain("translate('journal.stats.outdoors', 'Outdoors', {})");
    expect(journal).toContain("translate('journal.stats.trails', 'Trails', {})");
    // Each walk: its photo, or its route, or a prompt to add a photo.
    expect(journal).toContain("var route = e.photo ? '' : routeThumb(activeSegments(e));");
    expect(journal).toContain("translate('journal.after.addPhotos', 'Add photos', {})");
    expect(journal).toContain('data-jn-tale=');
    expect(journal).toContain('data-jn-share=');
    expect(journal).toContain('trail && Array.isArray(trail.path) && trail.path.length > 1');
  });

  test('a walk that just ended opens asking for a photo and who came along', () => {
    expect(journal).toContain('id="jnAfterOverlay"');
    expect(journal).toContain('id="jnAfterPhotoBtn"');
    expect(journal).toContain('id="jnWithChips"');
    expect(journal).toContain('id="jnWithForm"');
    expect(journal).toContain("var savedId = journalParams.get('saved');");
    expect(journal).toContain('window.DoloPawsAuth.getDogProfiles().then(');
    // Both recorders hand the journal the walk they just saved.
    expect(read('walk-page.js')).toContain("window.location.href = 'journal.html?saved=' + encodeURIComponent(entry.id);");
    const hike = read('hike-mode.js');
    expect(hike).toContain('savedEntryId = saveWalkNow(user);');
    expect(hike).toContain('if(savedEntryId) removeJournalEntry(savedEntryId);');
    expect(hike).toContain('`journal.html?saved=${encodeURIComponent(id)}`');
  });

  test('renders private routes locally instead of sending their location to a tile service', () => {
    expect(journal).toContain('private recorded route never leaves');
    // Stretch-aware: a walk the phone stopped following is drawn with the
    // unrecorded part left blank, still without asking a tile server where
    // the owner was.
    expect(journal).toContain('window.DoloPawsWalkCard.projectSegments');
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
    expect(journal).toContain('id="jnShareInstagram"');
    expect(journal).toContain('id="jnShareFacebook"');
    expect(journal).toContain('id="jnShareNative"');
    expect(journal).toContain('id="jnShareDownload"');
    expect(journal).toContain('id="jnShareCopy"');
    expect(card).toContain("'orma-trail-tale.png'");
    expect(card).toContain('shareWalkCardToPlatform');
  });

  test('does not introduce a public activity link or journal sync', () => {
    expect(journal).not.toMatch(/publicActivity|shareUrl|activityUrl/);
    expect(journal).toContain("return 'dolopaws-journal-' + uid");
    expect(journal).toContain('localStorage.setItem(key(), JSON.stringify(state.entries))');
  });
});
