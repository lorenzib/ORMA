'use strict';

const fs = require('fs');
const path = require('path');
const { REMOVED_TRAILS } = require('./removed-trails');
const { loadProductionTrails } = require('./load-production-trails');
const { buildTrailBoard } = require('../backoffice/workflows/build-trail-board');
const { planNewTrailScouting } = require('../backoffice/workflows/plan-new-trail-scouting');
const { materializeApprovedPublications } = require('../backoffice/workflows/materialize-approved-publications');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const json = file => JSON.parse(read(file));

/**
 * On 22 October three walks were withdrawn: kept as drafts, off the site, on
 * the trail board as "taken off the site pending review". On 24 October the
 * owner decided there was nothing to review and removed them outright. These
 * tests fail if any of them comes back by any door.
 */
describe('walks removed from ORMA stay removed', () => {
  test('the list names the three the owner removed', () => {
    expect(REMOVED_TRAILS.map(trail => trail.name).sort())
      .toEqual(['Alpage de Commune', 'Chalets de Salvadon', 'Rundweg Rotwand']);
  });

  const catalogue = loadProductionTrails(ROOT);

  describe.each(REMOVED_TRAILS.map(trail => [trail.name, trail]))('%s', (name, trail) => {
    test('is not in the catalogue, so not on the trail board', () => {
      expect(catalogue.find(entry => entry.id === trail.id || Number(entry.osmRelation) === trail.osmRelation)).toBeUndefined();
      const board = buildTrailBoard({ trails: catalogue, at: '2026-10-24T00:00:00.000Z' });
      expect(board.trails.find(entry => entry.id === trail.id)).toBeUndefined();
    });

    test('has no override, photo, detail file, page, slug or sitemap entry', () => {
      expect(json('data/verified-trail-overrides.json').trails.filter(entry => entry.id === trail.id)).toEqual([]);
      expect(json('data/trail-image-overrides.json').trails.filter(entry => entry.id === trail.id)).toEqual([]);
      expect(fs.readdirSync(path.join(ROOT, 'images/trails')).filter(file => file.startsWith(`${trail.id}-`))).toEqual([]);
      expect(fs.existsSync(path.join(ROOT, 'data/trail-details', `${trail.id}.js`))).toBe(false);
      expect(fs.existsSync(path.join(ROOT, 'trails', `${trail.slug}.html`))).toBe(false);
      expect(json('data/regions-manifest.json').trailSlug[trail.id]).toBeUndefined();
      expect(read('sitemap.xml')).not.toContain(`/${trail.slug}`);
    });

    test('is in no backoffice state that could queue it again', () => {
      const files = ['backoffice-data/route-source-identity.json', 'backoffice-data/catalogue-campaign.json',
        'backoffice-data/new-trail-scouting.json', 'backoffice-data/trail-orchestration.json',
        ...fs.readdirSync(path.join(ROOT, 'backoffice-data/valley-research'))
          .filter(file => file.endsWith('.json')).map(file => `backoffice-data/valley-research/${file}`)];
      for (const file of files) expect({ file, mentions: read(file).includes(trail.id) }).toEqual({ file, mentions: false });
    });

    test('the new-trail scout does not offer it as a new walk', () => {
      const feature = {
        type: 'Feature',
        properties: { osm_relation: trail.osmRelation, name: trail.name, loop: true, distance_km: 4 },
        geometry: { type: 'LineString', coordinates: [[6.77, 46.06], [6.78, 46.07], [6.77, 46.06]] },
      };
      const packet = planNewTrailScouting([{ region: 'savoy', data: { features: [feature] } }], [], { at: '2026-10-24T00:00:00.000Z' });
      expect(packet.candidates).toEqual([]);
    });

    test('a retried publication approved before the removal is refused', () => {
      const candidateId = `osm-relation-${trail.osmRelation}`;
      const result = materializeApprovedPublications({
        requests: { requests: [{ id: 'pub-before-removal', candidateId, status: 'publication-failed' }] },
        staging: { items: [{ candidateId, targetTrailId: trail.id, state: 'ready-for-publication-preview', proposedWebsiteFields: { name: trail.name } }] },
        routesByCandidate: { [candidateId]: { geometry: { coordinates: [[6.77, 46.06], [6.78, 46.07]] } } },
        overrides: { contractVersion: '1.0.0', trails: [] },
        operationalFacts: { trails: [] },
        at: '2026-10-24T00:00:00.000Z',
      });
      expect(result.overrides.trails).toEqual([]);
      expect(result.refused).toEqual([expect.objectContaining({ trailId: trail.id, reason: 'trail-removed' })]);
    });
  });
});
