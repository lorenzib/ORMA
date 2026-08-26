'use strict';

const IMAGE_FIELDS = new Set([
  'imageIcon','heroImage','imageAlt','imageCredit','imageCreditText','imageCreator',
  'imageLicence','imageLicenceUrl','imageSourcePage','imageSourceType',
]);

function applyTrailImageOverrides(trails, artifact){
  const next=trails.map(trail=>({...trail}));
  const knownIds=new Set(next.map(trail=>trail.id));
  for(const entry of artifact?.trails||[]){
    if(!entry||typeof entry.id!=='string'||!entry.fields||typeof entry.fields!=='object'){
      throw new Error('Trail image override must contain an id and image fields');
    }
    if(!knownIds.has(entry.id))throw new Error(`Trail image override targets an unknown trail: ${entry.id}`);
    const keys=Object.keys(entry.fields);
    if(!keys.length||keys.some(key=>!IMAGE_FIELDS.has(key)))throw new Error(`Trail image override contains unsupported fields: ${entry.id}`);
    if(typeof entry.fields.imageIcon!=='string'||!entry.fields.imageIcon.trim())throw new Error(`Trail image override needs imageIcon: ${entry.id}`);
    const index=next.findIndex(trail=>trail.id===entry.id);
    next[index]={...next[index],...entry.fields,id:entry.id};
  }
  return next;
}

module.exports={IMAGE_FIELDS,applyTrailImageOverrides};
