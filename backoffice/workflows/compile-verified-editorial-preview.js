'use strict';

const COPY = Object.freeze({
  'osm-relation-1484751': {
    title: 'Tre Cime di Lavaredo classic circuit',
    about: 'A demanding 9.528 km circuit from Rifugio Auronzo around the Tre Cime, following trails 101 and 105. The official itinerary gives 468 m of ascent, about 3 hours 30 minutes and a high point of 2,454 m. This is a hard, open high-alpine walk rather than a casual sightseeing loop.',
    dog: 'Dogs are accepted on the route but must stay on lead throughout. Seasonal livestock may be present beside the Lavaredo pasture segment, so keep your dog close and pass animals conservatively. The route has very little dependable shade and includes a narrower section, although no ferrata equipment is required.',
    practical: 'Start and finish at Rifugio Auronzo. The seasonal toll road and parking are weather-dependent and normally require advance booking; roadside parking is prohibited. Carry sufficient water. A fountain is identified at Malga LangAlm, but its seasonal availability and potability are not guaranteed.',
  },
  'osm-relation-6678431': {
    title: 'Cinque Torri three-refuges assisted circuit',
    about: 'This chairlift-assisted circuit begins at Bai de Dones, rises on the 5 Torri lift and returns on foot through the Cinque Torri open-air museum, refuge area and forest. The approved track contains 1.37 km of lift transport followed by approximately 3.95 km of predominantly downhill walking, with about two hours allowed for the itinerary.',
    dog: 'Dogs of any size may use the 5 Torri lift free of charge, but both leash and muzzle are required. The upper museum and refuge area is open alpine terrain, while the lower return enters forest. Seasonal sheep grazing is documented in the wider area, so keep dogs close even though an encounter on the exact circuit is variable.',
    practical: 'This itinerary depends on the 5 Torri chairlift operating. The published 2026 season is 6 June to 11 October, subject to weather and snow. Use the approved Bai de Dones parking pin. Carry water: the three refuges are possible service stops, but no freely accessible potable dog-water point has been verified.',
  },
  'osm-way-25736154': {
    title: 'Lago di Braies Seeweg circuit',
    about: 'A complete 3.6 km circuit around Lago di Braies, starting and finishing near the lake hotel and tavern area. Allow about one hour and 39 m of ascent and descent. The path alternates between broad forest and lakeshore sections, narrower rooted ground, uphill steps and a section beside a vertical rock wall.',
    dog: 'The route is dog-friendly, but dogs must remain on lead inside the nature park. No livestock is expected around this exact lakeshore circuit based on the editor’s direct local knowledge; the lead rule still applies because wildlife disturbance remains relevant. Carry all the water your dog needs and do not present the protected lake as a drinking source.',
    practical: 'Use the approved official P1, P2, P3 and P4 parking set. From 1 July to 15 September 2026, between 09:00 and 16:00, valley access is controlled and requires public transport, walking, cycling, or the relevant parking reservation or transit permit. Carry and use a muzzle on public transport.',
  },
});

function compileVerifiedEditorialPreview(queue, options = {}){
  const at = options.at || new Date().toISOString();
  const outputs = queue.items.flatMap(item => {
    const copy = COPY[item.candidateId];
    if(!copy) throw new Error(`Missing locked-fact copy template for ${item.candidateId}`);
    if(!item.heroCandidate) throw new Error(`Missing approved hero candidate for ${item.candidateId}`);
    const source = { label: 'Locked ORMA evidence dossier', url: item.dossierRef, checkedAt: at.slice(0, 10), supports: 'Every factual statement in the proposed trail copy' };
    return [
      {
        jobId: `verified-${item.candidateId}-copy`, agentId: 'copywriter', status: 'ready-for-review',
        responseId: null, model: 'codex-assisted-locked-fact-draft', error: null,
        candidateId: item.candidateId,
        result: {
          title: copy.title,
          summary: 'First editorial draft compiled strictly from the supported dossier claims. Safety and operational caveats remain explicit.',
          changes: [
            { section: 'About the trail', before: 'No verified editorial draft.', after: copy.about, reason: 'Turns the approved identity and metrics into concise visitor-facing copy.' },
            { section: 'Why it suits dogs', before: 'No verified editorial draft.', after: copy.dog, reason: 'Preserves the approved dog-access, livestock, exposure, shade and water guidance.' },
            { section: 'Important practical notes', before: 'No verified editorial draft.', after: copy.practical, reason: 'Keeps parking, seasonal access and operational limitations prominent.' },
          ],
          sources: [source], openQuestions: [],
        },
      },
      {
        jobId: `verified-${item.candidateId}-visual`, agentId: 'visualDirector', status: 'ready-for-review',
        responseId: null, model: 'codex-assisted-licensed-asset-packet', error: null,
        candidateId: item.candidateId,
        result: {
          searchSummary: 'One geolocated hero candidate has complete creator, licence, credit and direct-preview metadata. It is suitable for location context only and not as evidence of current trail conditions.',
          candidates: [{
            title: `${item.trailName} hero candidate`, sourcePageUrl: item.heroCandidate.filePage,
            assetUrl: item.heroCandidate.directAssetUrl, creator: item.heroCandidate.creator,
            license: item.heroCandidate.licence, licenseUrl: item.heroCandidate.licenceUrl,
            credit: item.heroCandidate.requiredCredit, matchEvidence: `Geolocated to the verified trail area. Do not infer: ${item.heroCandidate.prohibitedInference}`,
            altText: item.heroCandidate.proposedAlt, status: 'ready',
          }],
          coverageGaps: ['Operational field photographs remain desirable for parking, surfaces, dog context and facilities.'],
        },
      },
    ];
  });
  return {
    contractVersion: '1.0.0', generatedAt: at, mode: 'draft-only', stage: 'verified-trail-editorial-review',
    executionOrigin: 'codex-assisted-locked-fact-preview', sourceQueue: 'backoffice-data/verified-trail-editorial-queue.json',
    publicMutationAllowed: false, publicationAuthorized: false, outputs,
    summary: { trails: queue.items.length, readyForReview: outputs.length, blocked: 0, publicationReady: 0 },
  };
}

module.exports = { COPY, compileVerifiedEditorialPreview };
