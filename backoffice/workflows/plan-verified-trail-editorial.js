'use strict';

const { createAgentJob } = require('../contracts/agent-job-v1');

const LOCKED_FACT_FIELDS = Object.freeze([
  'route geometry', 'distance and elevation', 'parking coordinates', 'dog access rules',
  'surface and exposure', 'water guidance', 'livestock guidance', 'seasonal access',
]);

const DOSSIER_SLUGS = Object.freeze({
  'osm-relation-1484751': 'tre-cime',
  'osm-relation-6678431': 'cinque-torri',
  'osm-way-25736154': 'lago-braies',
});

function planVerifiedTrailEditorial(registry, dossiers, mediaPacket, options = {}){
  const at = options.at || new Date().toISOString();
  const dossierById = new Map(dossiers.map(dossier => [dossier.candidateId, dossier]));
  const assetById = new Map((mediaPacket.assets || []).map(asset => [asset.candidateId, asset]));
  const items = (registry.verified || []).map(verified => {
    const dossier = dossierById.get(verified.candidateId);
    if(!dossier) throw new Error(`Missing dossier for verified trail ${verified.candidateId}`);
    if(dossier.reviewState !== 'accepted' || dossier.ormaVerification?.status !== 'verified'){
      throw new Error(`Trail ${verified.candidateId} is not currently accepted and verified`);
    }
    if(dossier.claims.some(claim => claim.state !== 'supported')){
      throw new Error(`Verified trail ${verified.candidateId} has unsupported claims`);
    }
    const asset = assetById.get(verified.candidateId) || null;
    return {
      candidateId: verified.candidateId,
      trailName: verified.trailName,
      dossierRef: `backoffice/dossiers/${DOSSIER_SLUGS[verified.candidateId]}.json`,
      verifiedAt: verified.verifiedAt,
      verificationConditions: verified.conditions,
      lockedFacts: dossier.claims.map(claim => ({ id: claim.id, label: claim.label, value: claim.proposedValue, sourceIds: claim.sourceIds })),
      editorialBrief: {
        objective: 'Produce concise premium ORMA trail copy using only the locked dossier facts.',
        requiredSections: ['About the trail', 'Why it suits dogs', 'Important practical notes'],
        prohibited: ['invent facts', 'soften safety caveats', 'change metrics', 'claim current operating conditions'],
      },
      heroCandidate: asset ? {
        filePage: asset.filePage, directAssetUrl: asset.directAssetUrl, creator: asset.creator,
        licence: asset.licence, licenceUrl: asset.licenceUrl, requiredCredit: asset.requiredCredit,
        proposedAlt: asset.proposedAlt, prohibitedInference: asset.prohibitedInference,
      } : null,
      humanGates: [
        { id: 'editorial-approval', status: 'pending', checks: ['copy matches locked facts', 'mandatory caveats remain prominent', 'tone matches ORMA'] },
        { id: 'asset-and-licensing-approval', status: 'pending', checks: ['file page and creator verified', 'credit and licence displayed', 'alt text approved', 'image is not treated as condition evidence'] },
        { id: 'publication-approval', status: 'locked', checks: ['copy and asset gates approved', 'website field mapping reviewed', 'explicit separate publish decision recorded'] },
      ],
    };
  });
  const jobs = items.flatMap(item => [
    createAgentJob({ id: `verified-${item.candidateId}-copy`, agentId: 'copywriter', action: 'draft-verified-trail-copy', candidateId: item.candidateId, inputRefs: [item.dossierRef], humanGate: 'editorial-approval' }, { at }),
    createAgentJob({ id: `verified-${item.candidateId}-visual`, agentId: 'visualDirector', action: 'prepare-verified-trail-assets', candidateId: item.candidateId, inputRefs: [item.dossierRef, 'backoffice-data/media-licensing-packet-attempt-4.json'], humanGate: 'asset-and-licensing-approval' }, { at }),
  ]);
  return {
    contractVersion: '1.0.0', generatedAt: at, mode: 'draft-only', stage: 'verified-trail-editorial-readiness',
    sourceRegistry: 'backoffice-data/orma-verified-registry.json', publicMutationAllowed: false,
    publicationAuthorized: false, lockedFactFields: LOCKED_FACT_FIELDS, items, jobs,
    summary: { verifiedTrails: items.length, copywriterJobs: items.length, visualDirectorJobs: items.length, humanGatesPending: items.length * 2, publicationGatesLocked: items.length },
  };
}

module.exports = { LOCKED_FACT_FIELDS, planVerifiedTrailEditorial };
