'use strict';

const ACTIONS = new Set(['use-orma-library', 'upload-owner-photo', 'approve-uploaded-photo', 'approve-image-candidate', 'find-licensed', 'generate-ai', 'park']);

function applyImageCoverageReview(audit, queue, input, at = new Date().toISOString()){
  const gap = audit?.gaps?.find(item => item.slug === input.slug);
  if(!gap) throw new Error('Image coverage gap was not found');
  if(!ACTIONS.has(input.action)) throw new Error('Image coverage action is invalid');
  if(input.action === 'use-orma-library' && !input.assetRef && !gap.libraryMatches.length) throw new Error('Select an ORMA library image first');
  const note = String(input.note || '').trim().slice(0, 1500);
  const assetRef = String(input.assetRef || '').trim() || null;
  if(['upload-owner-photo','approve-uploaded-photo'].includes(input.action) && !/^backofficeImageUploads\/[A-Za-z0-9_-]+$/.test(String(input.uploadRef||assetRef||''))){
    throw new Error('An uploaded trail photo is required');
  }
  const uploadRef=['upload-owner-photo','approve-uploaded-photo'].includes(input.action)?String(input.uploadRef||assetRef||'').trim()||null:null;
  if(input.action==='approve-image-candidate'&&!/^(?:images\/|https:\/\/)/i.test(assetRef||''))throw new Error('A reviewable owned or licensed image candidate is required');
  const decision = {
    slug: gap.slug, trailId:gap.trailId||gap.slug, sourceRef: gap.sourceRef, action: input.action, assetRef, uploadRef,
    note, fileName:String(input.fileName||'').slice(0,240),mimeType:String(input.mimeType||'').slice(0,120),
    fileSize:Number(input.fileSize||0),width:Number(input.width||0),height:Number(input.height||0),
    creator:String(input.creator||'').trim().slice(0,160),rightsBasis:String(input.rightsBasis||'').slice(0,80),
    altText:String(input.altText||'').trim().slice(0,500),reviewedAt: at, reviewedBy: 'local-editor', publicMutationAllowed: false,
    sourcePageUrl:String(input.sourcePageUrl||'').slice(0,1000),license:String(input.license||'').slice(0,160),
    licenseUrl:String(input.licenseUrl||'').slice(0,1000),sourceType:String(input.sourceType||'').slice(0,80),
  };
  const decisions = [...(queue.decisions || []).filter(item => item.slug !== gap.slug), decision];
  const jobs = [...(queue.jobs || []).filter(job => !(job.slug === gap.slug && job.status === 'queued'))];
  if(input.action !== 'park') jobs.push({
    jobId: `image-coverage-${gap.slug}-${at.replace(/[:.]/g, '-')}`, slug: gap.slug, trailId:gap.trailId||gap.slug, sourceRef: gap.sourceRef,
    agentId: 'visualDirector', status: 'queued', createdAt: at, sourcePreference: input.action,
    assetRef, uploadRef, fileName:decision.fileName,mimeType:decision.mimeType,fileSize:decision.fileSize,
    width:decision.width,height:decision.height,creator:decision.creator,rightsBasis:decision.rightsBasis,altText:decision.altText,
    sourcePageUrl:decision.sourcePageUrl,license:decision.license,licenseUrl:decision.licenseUrl,sourceType:decision.sourceType,
    brief: note || gap.reasons.join(' '), requiresAssetApproval: !['approve-uploaded-photo','approve-image-candidate'].includes(input.action),
    requiresLicensingApproval: input.action === 'find-licensed', publicMutationAllowed: false,
  });
  return { contractVersion: '1.0.0', updatedAt: at, decisions, jobs };
}

module.exports = { ACTIONS, applyImageCoverageReview };
