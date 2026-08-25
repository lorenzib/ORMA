'use strict';

const PAUSED_SAFETY_GUIDE_IDS=new Set([
  'alpine-plants-for-dogs',
  'altitude-with-your-dog',
  'breed-group-caveats',
  'dogs-at-rifugi',
  'dogs-on-cable-cars',
  'heat-overheating',
  'livestock-guard-dogs',
  'paw-protection',
  'water-for-dogs-on-trail',
]);

function isPausedSafetyEditorialSubject(subject={}){
  if(subject.type==='page'&&subject.id==='safety-guide')return true;
  return subject.type==='guide'&&PAUSED_SAFETY_GUIDE_IDS.has(subject.id);
}

module.exports={PAUSED_SAFETY_GUIDE_IDS,isPausedSafetyEditorialSubject};
