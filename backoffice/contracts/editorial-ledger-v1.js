'use strict';

const VERSION='1.0.0';
const STATUSES=['eligible','in-review','revision-requested','published','rejected'];

function validateEditorialLedger(ledger){
  const errors=[];
  if(!ledger||typeof ledger!=='object') return ['ledger must be an object'];
  if(ledger.contractVersion!==VERSION) errors.push(`contractVersion must be ${VERSION}`);
  if(!Array.isArray(ledger.items)) errors.push('items must be an array');
  const ids=new Set();
  (ledger.items||[]).forEach((item,index)=>{
    if(!item.contentId) errors.push(`items[${index}].contentId is required`);
    if(ids.has(item.contentId)) errors.push(`items[${index}].contentId is duplicated`); else ids.add(item.contentId);
    if(!item.sourceRef) errors.push(`items[${index}].sourceRef is required`);
    if(!STATUSES.includes(item.status)) errors.push(`items[${index}].status is invalid`);
    if(!item.contentFingerprint) errors.push(`items[${index}].contentFingerprint is required`);
  });
  return errors;
}

module.exports={VERSION,STATUSES,validateEditorialLedger};
