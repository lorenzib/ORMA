'use strict';

const { createAgentJob } = require('../contracts/agent-job-v1');
const { validateContentOperations } = require('../contracts/content-operations-v1');

const DAY_MS = 24 * 60 * 60 * 1000;

const WORKSTREAM_DEFINITIONS = Object.freeze([
  {
    id: 'guides', label: 'Guides', cadence: 'weekly', status: 'active',
    goal: 'Create or refresh one useful, evidence-backed dog hiking guide.',
    outputs: ['editorial brief', 'edited guide draft', 'picture shortlist', 'source and freshness notes'],
  },
  {
    id: 'collections', label: 'Collections', cadence: 'weekly', status: 'active',
    goal: 'Create or refresh one intent-led trail collection using existing verified catalogue facts.',
    outputs: ['collection concept', 'title and description draft', 'trail inclusion rationale', 'cover picture shortlist'],
  },
  {
    id: 'newsletter', label: 'Newsletter', cadence: 'every-14-days', status: 'active',
    goal: 'Package the strongest approved ORMA material into one concise newsletter.',
    outputs: ['subject options', 'preheader', 'newsletter draft', 'picture shortlist', 'link plan'],
  },
  {
    id: 'library-enrichment', label: 'Library enrichment', cadence: 'weekly', status: 'active',
    goal: 'Audit the guide library for stale or missing material and propose evidence-backed updates.',
    outputs: ['freshness audit', 'update priorities', 'edited drafts', 'replacement picture candidates'],
  },
  {
    id: 'social', label: 'Social media', cadence: 'weekly-after-launch', status: 'parked',
    goal: 'Turn approved ORMA content into a channel-ready editorial queue after social launch.',
    outputs: ['post concepts', 'captions', 'picture shortlist', 'alt text', 'source links'],
  },
]);

function isoDate(value){
  const date = new Date(value);
  if(Number.isNaN(date.getTime())) throw new Error('asOf must be a valid date');
  return date.toISOString().slice(0, 10);
}

function addDays(dateString, days){
  return new Date(new Date(`${dateString}T00:00:00.000Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

function jobsFor(stream, cycleDate, at){
  const base = `content-ops-${cycleDate}-${stream.id}`;
  const inputRef = `content-operations/workstreams/${stream.id}`;
  return [
    createAgentJob({
      id: `${base}-edit`, agentId: 'copywriter', action: `edit-${stream.id}`,
      inputRefs: [inputRef], humanGate: 'editorial-approval',
    }, { at }),
    createAgentJob({
      id: `${base}-pictures`, agentId: 'visualDirector', action: `gather-pictures-${stream.id}`,
      inputRefs: [inputRef], humanGate: 'asset-and-licensing-approval',
    }, { at }),
  ];
}

function planContentOperations(options = {}){
  const at = options.at || new Date().toISOString();
  const cycleDate = isoDate(options.asOf || at);
  const socialEnabled = options.socialEnabled === true;
  const workstreams = WORKSTREAM_DEFINITIONS.map(definition => {
    const status = definition.id === 'social' && socialEnabled ? 'active' : definition.status;
    const nextRunOn = definition.id === 'newsletter' ? addDays(cycleDate, 14)
      : status === 'active' ? addDays(cycleDate, 7) : null;
    return { ...definition, status, cycleDate, nextRunOn };
  });
  const active = workstreams.filter(stream => stream.status === 'active');
  const jobs = active.flatMap(stream => jobsFor(stream, cycleDate, at));
  const plan = {
    contractVersion: '1.0.0',
    generatedAt: at,
    cycleDate,
    mode: 'draft-only',
    publicMutationAllowed: false,
    editorialPolicy: {
      reuseApprovedMaterialFirst: true,
      currentClaimsRequireDatedSources: true,
      medicalAndSafetyClaimsRequireHumanReview: true,
      noAutomaticPublishing: true,
      noUnlicensedMediaDownloads: true,
    },
    workstreams,
    jobs,
    summary: { activeWorkstreams: active.length, parkedWorkstreams: workstreams.length - active.length, jobs: jobs.length },
  };
  const errors = validateContentOperations(plan);
  if(errors.length) throw new Error(errors.join('; '));
  return plan;
}

module.exports = { WORKSTREAM_DEFINITIONS, addDays, planContentOperations };
