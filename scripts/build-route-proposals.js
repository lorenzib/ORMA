'use strict';

const fs = require('fs');
const path = require('path');
const { proposalFeature } = require('../backoffice/services/gpx-route');

const root = path.resolve(__dirname, '..');
const outputDirectory = path.join(root, 'backoffice-data', 'route-proposals');
const proposals = [
  {
    input: 'tre-cime-official.gpx', output: 'tre-cime-classic.geojson',
    properties: {
      proposalId: 'tre-cime-classic-101-105',
      name: 'Classic Tre Cime circuit — trails 101/105',
      sourceUrl: 'https://www.trecimetrek.it/wp-content/uploads/geodata/gpx/tre_cim_di.gpx',
      sourceAuthority: 'official-destination-route-portal',
      retrievedAt: '2026-08-18',
    },
  },
  {
    input: 'tre-cime-monte-paterno-official.gpx', output: 'tre-cime-monte-paterno.geojson',
    properties: {
      proposalId: 'tre-cime-monte-paterno-101-104-105',
      name: 'Extended Tre Cime and Monte Paterno circuit — trails 101/104/105',
      sourceUrl: 'https://www.trecimetrek.it/wp-content/uploads/geodata/gpx/gir_del_tre.gpx',
      sourceAuthority: 'official-destination-route-portal',
      retrievedAt: '2026-08-18',
    },
  },
  {
    input: 'lago-braies-reference.gpx', output: 'lago-braies-circuit.geojson',
    properties: {
      proposalId: 'lago-braies-seeweg-circuit',
      name: 'Lago di Braies Seeweg circuit',
      sourceUrl: 'https://www.pustertal.org/external/gpx/?id=1803&lang_id=12',
      sourceAuthority: 'regional-destination-route-portal',
      retrievedAt: '2026-08-18',
    },
  },
  {
    input: 'cinque-torri-three-refuges-official.gpx', output: 'cinque-torri-three-refuges-assisted.geojson',
    properties: {
      proposalId: 'cinque-torri-three-refuges-assisted',
      name: 'Cinque Torri three-refuges chairlift-assisted circuit',
      sourceUrl: 'https://5torri.it/GPX/Il-giro-dei-3-rifugi.gpx',
      sourceAuthority: 'local-lift-and-destination-route-portal',
      retrievedAt: '2026-08-18',
    },
  },
];

fs.mkdirSync(outputDirectory, { recursive: true });
for(const proposal of proposals){
  const input = path.join(root, 'backoffice-data', proposal.input);
  const feature = proposalFeature(fs.readFileSync(input, 'utf8'), proposal.properties);
  const output = path.join(outputDirectory, proposal.output);
  fs.writeFileSync(output, `${JSON.stringify(feature)}\n`, 'utf8');
  console.log(`[route-proposal] ${feature.properties.proposalId} · ${feature.properties.computedDistanceKm} km · ${feature.properties.pointCount} points`);
}
