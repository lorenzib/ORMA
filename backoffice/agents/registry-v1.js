'use strict';

const VERSION = '1.0.0';

const AGENTS = Object.freeze({
  scout: {
    name: 'Scout Agent',
    phase: 'discovery',
    owns: ['candidate-discovery', 'hard-disqualifier-screening'],
    humanGates: ['candidate-selection'],
  },
  auditor: {
    name: 'Auditor Agent',
    phase: 'audit',
    owns: ['initial-dossier', 'claim-resolution', 'conflict-synthesis'],
    humanGates: ['claim-review', 'contact-or-field-escalation'],
  },
  cartographer: {
    name: 'Cartographer Agent',
    phase: 'audit',
    prompt: 'backoffice/agents/prompts/cartographer.md',
    owns: ['route-identity', 'full-geometry', 'route-ordering', 'route-metrics', 'trailhead-connection'],
    mayPropose: ['geometry', 'routeType', 'distanceKm', 'trailhead'],
    mayApprove: [],
    humanGates: ['geometry-approval', 'trailhead-approval'],
  },
  regulatoryRanger: {
    name: 'Regulatory Ranger',
    phase: 'audit',
    prompt: 'backoffice/agents/prompts/regulatory-ranger.md',
    owns: ['dog-access', 'leash-rules', 'protected-area-rules', 'seasonal-restrictions', 'hunting-restrictions'],
    mayPropose: ['accessStatus', 'restrictions', 'applicability', 'effectiveDates'],
    mayApprove: [],
    humanGates: ['safety-and-access-interpretation'],
  },
  evidenceLibrarian: {
    name: 'Evidence Librarian',
    phase: 'cross-cutting',
    prompt: 'backoffice/agents/prompts/evidence-librarian.md',
    owns: ['source-provenance', 'source-authority', 'freshness', 'deduplication', 'claim-source-links'],
    mayPropose: ['sourceState', 'freshnessState', 'replacementSources'],
    mayApprove: [],
    humanGates: ['source-conflict-resolution'],
  },
  redTeam: {
    name: 'Red Team Agent',
    phase: 'pre-editorial-gate',
    prompt: 'backoffice/agents/prompts/red-team.md',
    owns: ['counter-evidence', 'unsupported-inference', 'variant-mismatch', 'promotion-objections'],
    mayPropose: ['objections', 'reopenedClaims', 'clearanceRecommendations'],
    mayApprove: [],
    humanGates: ['serious-objection-review'],
  },
  logistics: {
    name: 'Logistics Agent',
    phase: 'audit',
    owns: ['parking', 'road-access', 'public-transport', 'pedestrian-connection'],
    humanGates: ['parking-approval'],
  },
  terrainPoi: {
    name: 'Terrain & POI Analyst',
    phase: 'enrichment',
    owns: ['elevation', 'shade', 'surface', 'water', 'pois', 'livestock-indicators'],
    humanGates: ['safety-input-review'],
  },
  copywriter: {
    name: 'Copywriter Agent',
    phase: 'editorial',
    prompt: 'backoffice/agents/prompts/copywriter.md',
    owns: ['trail-copy', 'dog-notes'],
    mayPropose: ['name', 'desc', 'tips', 'altText'],
    mayApprove: [],
    humanGates: ['editorial-approval'],
  },
  visualDirector: {
    name: 'Visual Director Agent',
    phase: 'media',
    prompt: 'backoffice/agents/prompts/visual-director.md',
    owns: ['asset-gaps', 'shot-lists', 'licensing-prompts'],
    mayPropose: ['imageCandidates', 'imageCredit', 'altText'],
    mayApprove: [],
    humanGates: ['asset-and-licensing-approval'],
  },
  groundskeeper: {
    name: 'Groundskeeper Agent',
    phase: 'maintenance',
    owns: ['closures', 'stale-evidence', 'material-changes'],
    humanGates: ['maintenance-decision'],
  },
  marketDiscovery: {
    name: 'Market Discovery Agent',
    phase: 'strategy',
    owns: ['competitor-signals', 'app-reviews', 'outdoor-technology'],
    humanGates: ['product-review'],
  },
  marketOpportunity: {
    name: 'Market Opportunity Agent',
    phase: 'strategy',
    owns: ['opportunity-ranking', 'experiment-proposals'],
    humanGates: ['product-prioritisation'],
  },
  productDesigner: {
    name: 'Product Designer',
    phase: 'design',
    prompt: 'backoffice/agents/prompts/product-designer.md',
    owns: ['product-prototypes', 'screen-flows', 'interaction-hypotheses', 'design-rationale'],
    mayPropose: ['visualDirection', 'screens', 'userFlow', 'successCriteria', 'implementationNotes'],
    mayApprove: [],
    humanGates: ['ceo-mockup-approval'],
  },
});

function getAgent(id){
  return AGENTS[id] || null;
}

function validateRegistry(){
  const errors = [];
  Object.entries(AGENTS).forEach(([id, agent]) => {
    if(!agent.name) errors.push(`${id}: name is required`);
    if(!agent.phase) errors.push(`${id}: phase is required`);
    if(!Array.isArray(agent.owns) || !agent.owns.length) errors.push(`${id}: owns is required`);
    if(!Array.isArray(agent.humanGates)) errors.push(`${id}: humanGates is required`);
    if(agent.mayApprove && agent.mayApprove.length) errors.push(`${id}: agents cannot approve claims or publication`);
  });
  return errors;
}

module.exports = { VERSION, AGENTS, getAgent, validateRegistry };
