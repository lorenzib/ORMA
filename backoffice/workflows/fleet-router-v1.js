'use strict';

const CLAIM_OWNERS = Object.freeze({
  route: 'cartographer',
  geometry: 'cartographer',
  elevation: 'terrainPoi',
  parking: 'logistics',
  water: 'terrainPoi',
  heat: 'terrainPoi',
  exposure: 'cartographer',
  livestock: 'terrainPoi',
  surfaceHazards: 'cartographer',
  access: 'regulatoryRanger',
  photo: 'visualDirector',
  provenance: 'evidenceLibrarian',
});

function ownerForClaim(category){
  return CLAIM_OWNERS[category] || 'auditor';
}

function auditHandoffs(dossier){
  const grouped = {};
  (dossier.claims || []).filter(claim => claim.state !== 'supported').forEach(claim => {
    const owner = ownerForClaim(claim.category);
    if(!grouped[owner]) grouped[owner] = [];
    grouped[owner].push(claim.id);
  });
  return Object.entries(grouped).map(([agentId, claimIds]) => ({ agentId, claimIds }));
}

function preEditorialSequence(dossier){
  const unresolved = (dossier.claims || []).filter(claim => claim.state !== 'supported');
  if(unresolved.length) return { ready: false, next: auditHandoffs(dossier) };
  return {
    ready: false,
    next: [
      { agentId: 'evidenceLibrarian', action: 'final-provenance-audit' },
      { agentId: 'redTeam', action: 'challenge-supported-dossier' },
    ],
    humanGate: 'serious-objection-review',
  };
}

module.exports = { CLAIM_OWNERS, ownerForClaim, auditHandoffs, preEditorialSequence };
