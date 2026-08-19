'use strict';

const ACTIONS = new Set(['use-orma-library', 'check-personal-library', 'find-licensed', 'generate-ai', 'park']);

function applyImageCoverageReview(audit, queue, input, at = new Date().toISOString()){
  const gap = audit?.gaps?.find(item => item.slug === input.slug);
  if(!gap) throw new Error('Image coverage gap was not found');
  if(!ACTIONS.has(input.action)) throw new Error('Image coverage action is invalid');
  if(input.action === 'use-orma-library' && !input.assetRef && !gap.libraryMatches.length) throw new Error('Select an ORMA library image first');
  const note = String(input.note || '').trim().slice(0, 1500);
  const assetRef = String(input.assetRef || '').trim() || null;
  const decision = { slug: gap.slug, sourceRef: gap.sourceRef, action: input.action, assetRef, note, reviewedAt: at, reviewedBy: 'local-editor', publicMutationAllowed: false };
  const decisions = [...(queue.decisions || []).filter(item => item.slug !== gap.slug), decision];
  const jobs = [...(queue.jobs || []).filter(job => !(job.slug === gap.slug && job.status === 'queued'))];
  if(input.action !== 'park') jobs.push({
    jobId: `image-coverage-${gap.slug}-${at.replace(/[:.]/g, '-')}`, slug: gap.slug, sourceRef: gap.sourceRef,
    agentId: 'visualDirector', status: 'queued', createdAt: at, sourcePreference: input.action,
    assetRef, brief: note || gap.reasons.join(' '), requiresAssetApproval: true, requiresLicensingApproval: input.action === 'find-licensed', publicMutationAllowed: false,
  });
  return { contractVersion: '1.0.0', updatedAt: at, decisions, jobs };
}

module.exports = { ACTIONS, applyImageCoverageReview };
