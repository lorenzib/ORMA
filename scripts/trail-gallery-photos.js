'use strict';

// Photographs shown in a trail's Photos section before anyone has shared one,
// from data/trail-gallery-photos.json. Each is openly licensed, committed to
// images/trails/ and credited where it is shown. They are not the hero: that
// one lives in data/trail-image-overrides.json.

const OPEN_LICENCES = /^(CC BY(-SA)? [0-9.]+( [A-Za-z]+)?|CC0( 1\.0)?|Public domain)$/;
const ATTRIBUTION_FREE = /^(CC0( 1\.0)?|Public domain)$/;
const PHOTO_FIELDS = ['image','alt','title','creator','licence','licenceUrl','sourcePage'];

function invalid(id, message){ return new Error(`Trail gallery photo for ${id}: ${message}`); }

function checkedPhoto(id, photo){
  if(!photo || typeof photo !== 'object') throw invalid(id, 'each photo must be an object');
  const extra = Object.keys(photo).filter(key => !PHOTO_FIELDS.includes(key));
  if(extra.length) throw invalid(id, `unsupported fields ${extra.join(', ')}`);
  for(const key of ['image','alt','creator','licence','sourcePage']){
    if(typeof photo[key] !== 'string' || !photo[key].trim()) throw invalid(id, `needs ${key}`);
  }
  if(!/^images\/trails\/[a-z0-9-]+\.(?:jpe?g|webp)$/.test(photo.image)) throw invalid(id, `image must be committed under images/trails/: ${photo.image}`);
  if(!/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/.test(photo.sourcePage)) throw invalid(id, 'sourcePage must be a Wikimedia Commons file page');
  if(!OPEN_LICENCES.test(photo.licence)) throw invalid(id, `licence is not an open one: ${photo.licence}`);
  if(!ATTRIBUTION_FREE.test(photo.licence) && !/^https:\/\/creativecommons\.org\/licenses\//.test(String(photo.licenceUrl || ''))){
    throw invalid(id, 'a CC BY licence needs its licenceUrl');
  }
  return { ...photo };
}

function applyTrailGalleryPhotos(trails, artifact){
  const next = trails.map(trail => ({ ...trail }));
  const byId = new Map(next.map((trail, index) => [trail.id, index]));
  for(const entry of artifact?.trails || []){
    if(!entry || typeof entry.id !== 'string' || !Array.isArray(entry.photos) || !entry.photos.length){
      throw new Error('Trail gallery entry must contain an id and photos');
    }
    if(!byId.has(entry.id)) throw new Error(`Trail gallery entry targets an unknown trail: ${entry.id}`);
    if(entry.photos.length > 2) throw invalid(entry.id, 'at most two photos per trail');
    const index = byId.get(entry.id);
    const photos = entry.photos.map(photo => checkedPhoto(entry.id, photo));
    if(photos.some(photo => photo.image === next[index].heroImage || photo.sourcePage === next[index].imageSourcePage)){
      throw invalid(entry.id, 'repeats the hero photograph');
    }
    next[index] = { ...next[index], licensedPhotos:photos };
  }
  return next;
}

module.exports = { OPEN_LICENCES, applyTrailGalleryPhotos };
