'use strict';

const VERSION = '1.0.0';
const ITEM_STATES = Object.freeze([
  'identity-check-queued',
  'source-identity-required',
  'verified-monitoring',
  'rejected',
]);

function validateCampaign(campaign){
  const errors = [];
  if(!campaign || typeof campaign !== 'object') return ['campaign must be an object'];
  if(campaign.contractVersion !== VERSION) errors.push(`contractVersion must be ${VERSION}`);
  if(!campaign.summary || campaign.summary.total !== (campaign.items || []).length){
    errors.push('summary.total must match items');
  }
  if(!Array.isArray(campaign.jobs)) errors.push('jobs must be an array');
  (campaign.items || []).forEach((item, index) => {
    if(typeof item.trailId !== 'string' || !item.trailId) errors.push(`items[${index}].trailId is required`);
    if(!ITEM_STATES.includes(item.campaignState)) errors.push(`items[${index}].campaignState is invalid`);
    if(!Number.isFinite(item.priorityScore)) errors.push(`items[${index}].priorityScore is required`);
    if(!Array.isArray(item.baselineBlockers)) errors.push(`items[${index}].baselineBlockers must be an array`);
  });
  return errors;
}

module.exports = { VERSION, ITEM_STATES, validateCampaign };
