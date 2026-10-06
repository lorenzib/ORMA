const fs = require('fs');
const path = require('path');
const { normalizeLiftAccess, LIFT_TYPES, LIFT_DEPENDENCIES } = require('./scripts/lift-access');

// data/lift-access.json is hand curation: it says which routes ride a lift
// and which only pass one. A "required" open chairlift is a hard stop for
// every dog except a declared small one, so each entry here is a product
// decision, and flipping one must be deliberate rather than a side effect.
describe('the lift-access ledger', () => {
  const ledger = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/lift-access.json'), 'utf8'));
  const byId = Object.fromEntries(ledger.trails.map(entry => [entry.id, entry.fields.liftAccess]));

  test('every entry is a valid lift record with a name and a reason', () => {
    for(const entry of ledger.trails){
      const lift = normalizeLiftAccess(entry.fields.liftAccess);
      expect(LIFT_TYPES).toContain(lift.type);
      expect(LIFT_DEPENDENCIES).toContain(lift.dependency);
      expect(lift.name).toBeTruthy();
      expect(lift.notes.length).toBeGreaterThan(40);
    }
  });

  test('the two routes measured near chairlift top stations in #444 were curated as walkable loops', () => {
    // Giro della Bullaccia starts and ends in Compatsch; the official itinerary
    // offers the Puflatsch–Bullaccia Telemix only to spare the first ascent.
    expect(byId['giro-del-bulacia']).toMatchObject({ type: 'mixed', dependency: 'optional' });
    // Roda de Cherz is a loop on the Cherz plateau reached on foot from Passo
    // Campolongo or by the open Cherz I chair; the loop itself rides nothing.
    expect(byId['osm-11855879']).toMatchObject({ type: 'chairlift', dependency: 'optional' });
    // The one route that does ride an open chair stays a hard stop.
    expect(byId['cinque-torri-assisted']).toMatchObject({ type: 'chairlift', dependency: 'required' });
  });
});
