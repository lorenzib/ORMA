const fs=require('fs');
const {hazardFromVetting,hazardPosition}=require('./backoffice/workflows/community-hazard-vetting.js');

const AT='2026-09-08T10:00:00.000Z';
const REPORT={id:'r1',trailId:'giro-del-bulacia',trailName:'Giro della Bullaccia',
  area:'Alpe di Siusi',category:'livestock',createdAt:AT,
  location:{lat:46.5496457,lng:11.6039329,km:0.77}};
const CORROBORATED={verdict:'corroborated',plausible:true,severity:'severe',
  title:'Guardian dogs on the pasture crossing',message:'Working dogs are loose on the pasture.',
  reasoning:'',expectedDurationDays:14,
  sources:[{url:'https://example.org/notice',publisher:'Comune',publishedOn:'2026-09-01',quote:'x'}]};

describe('a reported position survives vetting', () => {
  test('the published hazard carries where it was seen', () => {
    const hazard=hazardFromVetting(REPORT,CORROBORATED,AT);
    expect(hazard.at).toEqual({lat:46.5496457,lng:11.6039329,km:0.77});
  });

  test('an unplaced report still publishes, with no position', () => {
    const hazard=hazardFromVetting({...REPORT,location:undefined},CORROBORATED,AT);
    expect(hazard).not.toBeNull();
    expect(hazard.at).toBeNull();
  });

  // Vetting judges whether the hazard is real, not where it was seen. A verdict
  // must never move or invent the position the reporter gave.
  test('vetting does not move the position', () => {
    const unverified=hazardFromVetting(REPORT,
      {...CORROBORATED,verdict:'uncorroborated',sources:[]},AT);
    expect(unverified.verificationState).toBe('reported-unverified');
    expect(unverified.at).toEqual(hazardFromVetting(REPORT,CORROBORATED,AT).at);
  });
});

describe('a position is published only when it is whole', () => {
  test.each([
    ['nothing',null],
    ['a missing km',{lat:46.5,lng:11.6}],
    ['a non-numeric value',{lat:46.5,lng:11.6,km:'near the gate'}],
    ['an out-of-range latitude',{lat:120,lng:11.6,km:1}],
    ['a negative km',{lat:46.5,lng:11.6,km:-2}],
  ])('%s is dropped rather than guessed at', (_label,location) => {
    expect(hazardPosition(location)).toBeNull();
  });

  test('a whole position is kept, rounded to the centimetre of a km', () => {
    expect(hazardPosition({lat:46.5,lng:11.6,km:1.2345})).toEqual({lat:46.5,lng:11.6,km:1.23});
  });
});

describe('the report carries a position to Firestore', () => {
  const client=fs.readFileSync('firebase-init.js','utf8');
  const rules=fs.readFileSync('firestore.rules','utf8');

  test('the transport accepts and validates a placed location', () => {
    expect(client).toContain('function hazardReportLocation(location)');
    expect(client).toContain('async function reportTrailHazard(trail, category, description, observedOn, location)');
    // A point the locator judged to be off this route is not a position on it.
    expect(client).toContain('if (location.onRoute === false) return null;');
    expect(client).toContain('...(withLocation ? { location: placed } : {}),');
  });

  // Rules and the static site deploy on separate workflows. A report must not be
  // lost to the window where the client sends a position the rules do not admit.
  test('a position rejected by the rules costs the pin, not the report', () => {
    expect(client).toContain('await addDoc(collection(db, "trailHazardReports"), report(false));');
    expect(client).toContain('if (!placed || !String(error && error.code || "").includes("permission-denied")) throw error;');
  });

  test('the rules admit a location and bound every part of it', () => {
    expect(rules).toContain('function validHazardLocation(data)');
    expect(rules).toContain("!data.keys().hasAny(['location'])");
    expect(rules).toContain("data.location.keys().hasOnly(['lat', 'lng', 'km'])");
    expect(rules).toContain('validHazardLocation(data)');
    // Still admitted on the report schema, or every placed report is rejected.
    expect(rules).toMatch(/'observedOn', 'location', 'uid'/);
  });
});

describe('the page loads the locator before it is needed', () => {
  const nav=fs.readFileSync('mobile-nav.js','utf8');
  const page=fs.readFileSync('trail.js','utf8');

  test('the locator is injected ahead of the hazard script', () => {
    // Compare the src assignments, not prose: a comment naming the other file
    // would otherwise decide the order this test believes in.
    const locator=nav.indexOf('locationScript.src=');
    const hazards=nav.indexOf('hazardScript.src=');
    expect(locator).toBeGreaterThan(-1);
    expect(hazards).toBeGreaterThan(-1);
    expect(locator).toBeLessThan(hazards);
    expect(nav).toContain('hazard-location.js?v=');
  });

  test('the trail page publishes its map and route for placing', () => {
    expect(page).toContain('window.DoloPawsTrailMapContext = { map, trail: t };');
    expect(page).toContain("dolopaws-trail-map-ready");
  });
});
