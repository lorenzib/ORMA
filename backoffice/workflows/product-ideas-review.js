'use strict';

const ACTIONS = new Set(['prioritise', 'investigate-further', 'park', 'dismiss']);

function applyProductIdeaReview(packet, queue, input, at = new Date().toISOString()){
  if(!packet || !Array.isArray(packet.ideas)) throw new Error('Product ideas packet is unavailable');
  const idea = packet.ideas.find(item => item.id === input.ideaId);
  if(!idea) throw new Error('Product idea was not found');
  if(!ACTIONS.has(input.action)) throw new Error('Product idea action is invalid');
  const note = String(input.note || '').trim().slice(0, 1500);
  const decision = {
    ideaId: idea.id, action: input.action, note, reviewedAt: at, reviewedBy: 'local-editor',
    publicMutationAllowed: false, featureWorkAuthorized: false,
    designExplorationAuthorized: input.action === 'prioritise', implementationAuthorized: false,
  };
  const decisions = [...(queue.decisions || []).filter(item => item.ideaId !== idea.id), decision];
  const jobs = [...(queue.jobs || []).filter(job => !(job.ideaId === idea.id && job.status === 'queued'))];
  if(input.action === 'investigate-further'){
    jobs.push({
      jobId: `product-investigation-${idea.id}-${at.replace(/[:.]/g, '-')}`, ideaId: idea.id,
      agentId: 'marketOpportunity', status: 'queued', createdAt: at,
      focus: note || idea.suggestedInvestigation.join(' '), publicMutationAllowed: false,
    });
  }
  if(input.action === 'prioritise'){
    jobs.push({
      jobId: `product-design-${idea.id}-${at.replace(/[:.]/g, '-')}`, ideaId: idea.id,
      agentId: 'productDesigner', action: 'create-reviewable-mockup', status: 'queued', createdAt: at,
      brief: note || idea.ormaOpportunity, humanGate: 'ceo-mockup-approval', publicMutationAllowed: false,
      implementationAuthorized: false,
    });
  }
  return { contractVersion: '1.0.0', updatedAt: at, decisions, jobs };
}

module.exports = { ACTIONS, applyProductIdeaReview };
