'use strict';

const { createAgentJob } = require('../contracts/agent-job-v1');
const { validateContentFlow } = require('../contracts/content-flow-v1');

const EDITABLE_FIELDS = Object.freeze(['name', 'desc', 'tips']);
const PROTECTED_FIELDS = Object.freeze([
  'path', 'lat', 'lng', 'distance', 'elevation', 'hours', 'terrainType',
  'terrainRank', 'surfaceHazards', 'shadeCoverage', 'heatRisk', 'safetyLevel',
  'exposure', 'waterSources', 'startPoint', 'decisionPoints', 'rifugi',
  'routeRefs', 'routeRefSegments', 'routeNumberStatus', 'routeNumberSource',
  'routeNumberGuidance',
]);

function compactTrail(trail){
  return {
    id: trail.id,
    name: trail.name || '',
    area: trail.area || '',
    region: trail.region || null,
    desc: trail.desc || '',
    tips: trail.tips || '',
    existingImage: trail.imageIcon || null,
    existingImageCredit: trail.imageCredit || null,
    sourceLinks: Array.isArray(trail.sourceLinks) ? trail.sourceLinks : [],
  };
}

function planContentFlow(trails, options = {}){
  const at = options.at || new Date().toISOString();
  const limit = options.limit || 10;
  const requested = new Set(options.trailIds || []);
  const selected = trails
    .filter(trail => !requested.size || requested.has(trail.id))
    .slice(0, limit);
  if(requested.size){
    const found = new Set(selected.map(trail => trail.id));
    const missing = [...requested].filter(id => !found.has(id));
    if(missing.length) throw new Error(`Unknown trail id(s): ${missing.join(', ')}`);
  }

  const items = selected.map(compactTrail);
  const jobs = items.flatMap(item => [
    createAgentJob({
      id: `content-${item.id}-copy`, agentId: 'copywriter', action: 'edit-copy',
      candidateId: item.id, inputRefs: [`content-flow/items/${item.id}`],
      humanGate: 'editorial-approval',
    }, { at }),
    createAgentJob({
      id: `content-${item.id}-pictures`, agentId: 'visualDirector', action: 'gather-pictures',
      candidateId: item.id, inputRefs: [`content-flow/items/${item.id}`],
      humanGate: 'asset-and-licensing-approval',
    }, { at }),
  ]);
  const flow = {
    contractVersion: '1.0.0',
    generatedAt: at,
    mode: 'draft-only',
    publicMutationAllowed: false,
    scope: {
      responsibilities: ['editing', 'picture-gathering'],
      editableFields: EDITABLE_FIELDS,
      protectedFields: PROTECTED_FIELDS,
      prohibitedActions: ['change-trail-facts', 'change-safety-claims', 'publish', 'download-unlicensed-media'],
    },
    execution: {
      strategy: 'parallel-per-trail',
      mergeRequires: ['editorial-approval', 'asset-and-licensing-approval'],
    },
    items,
    jobs,
    summary: { trails: items.length, editingJobs: items.length, pictureJobs: items.length },
  };
  const errors = validateContentFlow(flow);
  if(errors.length) throw new Error(errors.join('; '));
  return flow;
}

module.exports = { EDITABLE_FIELDS, PROTECTED_FIELDS, compactTrail, planContentFlow };
