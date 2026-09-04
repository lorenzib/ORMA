'use strict';

const TARGETS = Object.freeze({
  'osm-relation-1484751': { trailId: 'tre-cime', operation: 'update-existing', routeRef: 'backoffice-data/route-proposals/tre-cime-classic.geojson' },
  'osm-relation-6678431': { trailId: 'cinque-torri-assisted', operation: 'create-new', routeRef: 'backoffice-data/route-proposals/cinque-torri-three-refuges-assisted.geojson' },
  'osm-way-25736154': { trailId: 'lago-braies', operation: 'update-existing', routeRef: 'backoffice-data/route-proposals/lago-braies-circuit.geojson' },
});

const VERIFIED_FIELDS = Object.freeze({
  'osm-relation-1484751': { area:'Alta Pusteria – Tre Cime', distance:9.528, elevation:468, hours:'3.5', paid:true,
    terrainType:'High-alpine dirt and rocky mountain paths, including one narrower section', terrainRank:2,
    shadeCoverage:null, heatRisk:'high', safetyLevel:'caution', exposure:false, waterSources:[],
    startPoint:{lat:46.612849,lng:12.292858,label:'Parcheggio Rifugio Auronzo (P1) — approved parking pin'} },
  'osm-relation-6678431': { area:'Cortina / Cinque Torri', distance:3.95, elevation:10, hours:'2', paid:true,
    terrainType:'Museum and trench paths, cart track and forest hiking path', terrainRank:1,
    shadeCoverage:null, heatRisk:'moderate', safetyLevel:'moderate', exposure:false, waterSources:[],
    startPoint:{lat:46.518917,lng:12.037604,label:'Bai de Dones — approved parking pin'} },
  'osm-way-25736154': { area:'Prags Valley', distance:3.6, elevation:39, hours:'1', paid:true,
    terrainType:'Forest and lakeshore paths with roots, steps and a narrow rock-wall section', terrainRank:1,
    shadeCoverage:null, heatRisk:'moderate', safetyLevel:'moderate', exposure:false, waterSources:[],
    startPoint:{lat:46.699015,lng:12.085296,label:'Lago di Braies access — use the approved official P1–P4 parking set'} },
});

function latestDecisions(reviewQueue){
  const latest = new Map();
  for(const submission of reviewQueue?.submissions || []){
    for(const decision of submission.decisions || []) latest.set(decision.jobId, { ...decision, submissionId: submission.submissionId });
  }
  return latest;
}

function section(result, name){ return result?.changes?.find(change => change.section === name)?.after || null; }

function routeNumberGuidance(item){
  const facts=new Map((item?.lockedFacts||[]).map(fact=>[fact.id,fact]));
  const start=facts.get('logistics-recommended-start');
  const status=facts.get('logistics-route-number-status');
  const sequence=facts.get('logistics-route-number-sequence');
  const switches=facts.get('logistics-route-number-switches');
  if(!start||!status||!sequence||!switches)return null;
  const sourceIds=[...new Set([start,status,sequence,switches].flatMap(fact=>fact.sourceIds||[]))];
  const sources=(item.evidenceSources||[]).filter(source=>sourceIds.includes(source.id)).map(source=>({
    label:source.label,url:source.url,authority:source.authority||null,accessedAt:source.accessedAt||null,
  }));
  return {start:start.value,status:status.value,sequence:sequence.value,switches:switches.value,sources};
}

function buildPublicationStaging(editorialQueue, execution, reviewQueue, options = {}){
  const at = options.at || new Date().toISOString();
  const decisions = latestDecisions(reviewQueue);
  const outputs = new Map((execution?.outputs || []).map(output => [output.jobId, output]));
  const items = editorialQueue.items.map(item => {
    const target = TARGETS[item.candidateId]||(item.targetTrailId?{trailId:item.targetTrailId,operation:'update-existing',routeRef:null}:null);
    const verifiedFields=VERIFIED_FIELDS[item.candidateId]||null;
    const copyJobId = `verified-${item.candidateId}-copy`;
    const visualJobId = `verified-${item.candidateId}-visual`;
    const copyDecision = decisions.get(copyJobId) || null;
    const visualDecision = decisions.get(visualJobId) || null;
    const copyApproved = copyDecision?.action === 'approve';
    const visualApproved = visualDecision?.action === 'approve';
    const missingApprovals = [!copyApproved && 'editorial-approval', !visualApproved && 'asset-and-licensing-approval'].filter(Boolean);
    const copyOutput = outputs.get(copyJobId);
    const visualOutput = outputs.get(visualJobId);
    const hero = visualOutput?.result?.candidates?.find(candidate => candidate.status === 'ready') || null;
    const about = section(copyOutput?.result, 'About the trail');
    const dog = section(copyOutput?.result, 'Why it suits dogs');
    const practical = section(copyOutput?.result, 'Important practical notes');
    const routeGuidance=routeNumberGuidance(item);
    const publicationMappingBlockers=[!target&&'website-target-mapping',!verifiedFields&&'structured-website-fields',!routeGuidance&&'route-number-guidance'].filter(Boolean);
    const state=missingApprovals.length?'waiting-content-approvals':publicationMappingBlockers.length?'waiting-publication-mapping':'ready-for-publication-preview';
    return {
      candidateId: item.candidateId, targetTrailId: target?.trailId||item.candidateId, operation: target?.operation||'mapping-required',
      state,missingApprovals,publicationMappingBlockers,
      sourceApprovals: { copy: copyDecision, visual: visualDecision },
      proposedWebsiteFields: state!=='ready-for-publication-preview' ? null : {
        name: copyOutput.result.title,
        desc: `${about}\n\n${dog}`,
        tips: practical,
        routeRef: target.routeRef,
        imageIcon: hero.assetUrl,
        imageCredit: { text:hero.credit, url:hero.sourcePageUrl },
        heroImage: hero.assetUrl,
        imageSourcePage: hero.sourcePageUrl,
        imageCreator: hero.creator,
        imageLicence: hero.license,
        imageLicenceUrl: hero.licenseUrl,
        imageCreditText: hero.credit,
        imageAlt: hero.altText,
        ormaVerified: true,
        routeNumberGuidance:routeGuidance,
        ...verifiedFields,
        reviewedAt: item.verifiedAt.slice(0,10), reviewedBy:'ORMA verified-trail workflow',
        verified:{ categories:['water','heat','exposure','livestock','surfaceHazards','access'], sources:['Locked ORMA evidence dossier'], date:item.verifiedAt.slice(0,10) },
        graduation:{ status:'verified', required:['photo','route','routeNumbers','mapPoints','elevation','water','heat','exposure','livestock','surfaceHazards','access'], completed:['photo','route','routeNumbers','mapPoints','elevation','water','heat','exposure','livestock','surfaceHazards','access'] },
        verifiedAt: item.verifiedAt,
      },
      lockedEvidence: { dossierRef: item.dossierRef, facts: item.lockedFacts, verificationConditions: item.verificationConditions },
      humanGate: 'website-preview-and-publication-approval',
      publicationAuthorized: false,
      publicMutationAllowed: false,
    };
  });
  return {
    contractVersion: '1.0.0', generatedAt: at, mode: 'staging-only', stage: 'website-publication-preview',
    sourceEditorialQueue: 'backoffice-data/verified-trail-editorial-queue.json',
    sourceExecution: 'backoffice-data/verified-trail-editorial-execution.json',
    sourceReviewQueue: 'backoffice-data/content-review-queue.json',
    publicMutationAllowed: false, publicationAuthorized: false, items,
    summary: {
      trails: items.length,
      readyForPreview: items.filter(item => item.state === 'ready-for-publication-preview').length,
      waitingForApprovals: items.filter(item => item.state === 'waiting-content-approvals').length,
      waitingForMapping:items.filter(item=>item.state==='waiting-publication-mapping').length,
      publicMutations: 0,
    },
  };
}

module.exports = { TARGETS, VERIFIED_FIELDS, latestDecisions, routeNumberGuidance, buildPublicationStaging };
