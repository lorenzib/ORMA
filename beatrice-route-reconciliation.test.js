const fs = require('fs');
const path = require('path');
const { loadProductionTrails } = require('./scripts/load-production-trails');
const { adaptLegacyTrail } = require('./scripts/trail-adapter');
const { parseGpx } = require('./backoffice/services/gpx-route');

const root = path.resolve(__dirname);
const GPX_URL = 'https://static.apidae-tourisme.com/filestore/objets-touristiques/plans/71/97/21193031/beatrice-de-savoie-9fev24.gpx';

describe('Circuit Béatrice de Savoie official-route reconciliation', () => {
  const source = loadProductionTrails(root).find(trail => trail.id === 'osm-3982382');
  const parsed = parseGpx(fs.readFileSync(
    path.join(root, 'backoffice-data', 'beatrice-de-savoie-official.gpx'),
    'utf8'
  ));

  test('publishes the continuous official GPX instead of the fragmented OSM reconstruction', () => {
    expect(parsed.assessment).toMatchObject({
      status: 'passed', routeShape: 'loop', pointCount: 435, issues: [],
    });
    expect(source.path).toHaveLength(435);
    expect(source.path.slice(0, -1)).toEqual(
      parsed.geometry.coordinates.slice(0, -1).map(([lng, lat]) => [lat, lng])
    );
    expect(source.path.at(-1)).toEqual(source.path[0]);
    expect(parsed.closureDistanceM).toBeLessThanOrEqual(2);
  });

  test('uses the official headline metrics, start and source', () => {
    expect(source).toMatchObject({
      lat: 45.43596,
      lng: 5.75551,
      distance: 4.9,
      elevation: 173,
      hours: '1.5',
      routeShape: 'loop',
      startPoint: { lat: 45.43596, lng: 5.75551 },
      routeSource: {
        kind: 'official-gpx',
        externalId: 'apidae/21193031',
        geometryUrl: GPX_URL,
        geometryApprovedAt: '2026-09-10',
      },
    });
  });

  test('adapts the approved GPX as an official source, not OSM evidence', () => {
    const canonical = adaptLegacyTrail(source).record;
    const routeSource = canonical.sources.find(item => item.provider === 'Chartreuse Tourisme / Apidae');

    expect(routeSource).toMatchObject({
      kind: 'official',
      url: source.routeSource.url,
      retrievedAt: '2026-09-10',
      licence: null,
    });
  });

  test('retains the failed OSM diagnosis as superseded evidence', () => {
    const identity = JSON.parse(fs.readFileSync(
      path.join(root, 'backoffice-data', 'route-source-identity.json'),
      'utf8'
    )).checks['osm-3982382'];

    expect(identity).toMatchObject({
      reviewState: 'superseded-by-official-gpx',
      blockers: [],
      componentCount: 3,
      supersededAssessment: {
        reviewState: 'blocked',
        blockers: ['disconnected-components'],
        componentCount: 3,
      },
      resolution: {
        sourceExternalId: 'apidae/21193031',
        pointCount: 435,
        geometryIssues: [],
      },
    });
  });
});
