/**
 * @jest-environment jsdom
 * @jest-environment-options {"url": "https://app-orma.com/?view=returning"}
 */
const fs=require('fs');
const source=fs.readFileSync('./script.js','utf8');
const page=fs.readFileSync('./index.html','utf8');
const styles=fs.readFileSync('./styles.css','utf8');

// Choosing a region is also what decides which catalogue to download: the
// Dolomites file is 800 KB, Savoy 329 KB, and nothing is in memory before one
// of them loads. So the question has to be asked. It did not have to cost four
// interactions before a single trail appeared.
function regionChoices(){
  const start=source.indexOf('const LI_REGION_CHOICES');
  const end=source.indexOf('function liRenderLocationContext');
  return new Function('window','document',`${source.slice(start,end)}
    return {LI_REGION_CHOICES,liRegionTrailCount,liRenderRegionChoices};`)(window,document);
}

describe('the first visit is one tap', () => {
  test('both regions are offered, with the country each is in', () => {
    const {LI_REGION_CHOICES}=regionChoices();
    expect(LI_REGION_CHOICES.map(choice=>choice.region)).toEqual(['dolomites','savoy']);
    expect(LI_REGION_CHOICES.map(choice=>choice.label)).toEqual(['The Dolomites','Savoy']);
  });

  test('a card says how many trails it holds, from the manifest', () => {
    window.DoloPawsRegionManifest={regions:{dolomites:{trailCount:109},savoy:{trailCount:53}}};
    const {liRegionTrailCount}=regionChoices();
    expect(liRegionTrailCount('dolomites')).toBe(109);
    expect(liRegionTrailCount('savoy')).toBe(53);
  });

  // A count nobody published is not invented.
  test('a missing count leaves the card working without one', () => {
    window.DoloPawsRegionManifest=undefined;
    const {liRegionTrailCount,liRenderRegionChoices}=regionChoices();
    expect(liRegionTrailCount('dolomites')).toBeNull();
    document.body.innerHTML='<div id="liLocationRegions"></div>';
    liRenderRegionChoices();
    const cards=[...document.querySelectorAll('.li-region-card')];
    expect(cards).toHaveLength(2);
    expect(cards[0].textContent).toContain('The Dolomites');
    expect(cards[0].textContent).not.toMatch(/\d+ trails/);
  });

  test('a card renders its count when there is one', () => {
    window.DoloPawsRegionManifest={regions:{dolomites:{trailCount:109},savoy:{trailCount:53}}};
    const {liRenderRegionChoices}=regionChoices();
    document.body.innerHTML='<div id="liLocationRegions"></div>';
    liRenderRegionChoices();
    expect(document.querySelector('.li-region-card').textContent).toContain('109 trails');
  });

  test('rendering twice does not stack duplicates', () => {
    const {liRenderRegionChoices}=regionChoices();
    document.body.innerHTML='<div id="liLocationRegions"></div>';
    liRenderRegionChoices(); liRenderRegionChoices();
    expect(document.querySelectorAll('.li-region-card')).toHaveLength(2);
  });
});

describe('the cards sit in the gate, and only for a first choice', () => {
  test('the slot is before the other ways in', () => {
    expect(page.indexOf('id="liLocationRegions"'))
      .toBeLessThan(page.indexOf('id="liUseLocationBtn"'));
  });

  // Offering two whole regions to somebody already in a valley is a step back.
  test('they are hidden while changing an area you already have', () => {
    expect(source).toContain('regions.hidden = changing;');
  });

  test('the location button and the search are still there', () => {
    expect(page).toContain('id="liUseLocationBtn"');
    expect(page).toContain('id="liChooseAreaBtn"');
    expect(page).toContain('id="liAreaSearch"');
  });

  test('a card produces a context the validator accepts', () => {
    // liValidLocationContext: kind 'area' with a label and one of country,
    // region or valley.
    const {LI_REGION_CHOICES}=regionChoices();
    LI_REGION_CHOICES.forEach(choice=>{
      expect(choice.region).toBeTruthy();
      expect(choice.country).toMatch(/^(IT|FR)$/);
      expect(choice.label).toBeTruthy();
    });
    expect(source).toContain("kind:'area', region:choice.region, country:choice.country,");
  });

  test('the cards are styled', () => {
    expect(styles).toContain('.li-region-card{');
    expect(styles).toContain('.li-location-regions{');
  });
});
