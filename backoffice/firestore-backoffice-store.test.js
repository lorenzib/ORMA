'use strict';

const {
  ARTIFACT_DATA_ENCODING,
  encodeArtifactData,
  decodeArtifactData,
} = require('./services/firestore-backoffice-store');

describe('Firestore backoffice artifact encoding', () => {
  const dossierWithTrailCoordinates = {
    candidateId:'osm-16322228',
    specialistOutputs:[{
      agentId:'cartographer',
      result:{geometry:{type:'LineString',coordinates:[[5.97,45.55],[5.98,45.56]]}},
    }],
  };

  test('serializes nested trail-coordinate arrays into a Firestore-safe string', () => {
    const encoded = encodeArtifactData(dossierWithTrailCoordinates);

    expect(encoded.dataEncoding).toBe(ARTIFACT_DATA_ENCODING);
    expect(typeof encoded.data).toBe('string');
    expect(decodeArtifactData(encoded)).toEqual(dossierWithTrailCoordinates);
  });

  test('continues to read artifacts written before JSON encoding was introduced', () => {
    expect(decodeArtifactData({data:dossierWithTrailCoordinates})).toEqual(dossierWithTrailCoordinates);
    expect(decodeArtifactData(null)).toBeNull();
  });

  test('rejects values that cannot be represented in JSON', () => {
    expect(() => encodeArtifactData(undefined)).toThrow('must be JSON-serializable');
  });
});
