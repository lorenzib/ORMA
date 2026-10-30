'use strict';

const fs=require('fs');
const path=require('path');
const vm=require('vm');
const {loadProductionTrails}=require('./scripts/load-production-trails');
const {buildCanonicalCatalog}=require('./scripts/trail-adapter');

const ROOT=__dirname;

/**
 * Only the seal may say "verified".
 *
 * The Alpe di Siusi meadow loop opened with "A real, GPS-verified loop ...
 * confirmed by multiple independent hiking guides", and further down the same
 * page the score card said "ORMA has not verified this trail's safety data
 * yet". The trail has never held the seal; the description was written before
 * the seal existed. A reader cannot tell a writer's "verified" from ORMA's, so
 * on a trail without the seal the published copy must not claim it.
 *
 * Saying what is not verified is honest and stays ("not yet verified by ORMA",
 * "unconfirmed"), and so does "OSM-verified", which names OpenStreetMap and is
 * reworded to "mapped in OpenStreetMap" where the trust layer prints it.
 */
function appTrust(){
  const sandbox={window:{},console};
  sandbox.self=sandbox;sandbox.globalThis=sandbox;
  vm.createContext(sandbox);
  for(const file of ['trust/evidence-v1.js','trail-trust.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT,file),'utf8'),sandbox,{filename:file});
  }
  return sandbox.window.DoloPawsTrailTrust;
}

// Record-keeping a reader never sees: the review records themselves, the
// provenance of a source and the backoffice's own notes.
const NOT_READER_COPY=new Set([
  'id','path','verified','graduation','routeAudit','reviewedBy','reviewedAt',
  'routeNumberStatus','routeNumberSource','sources','imageSourcePage','imageSourceType',
]);

const CLAIM=/\b(?:GPS[- ])?(?:verified|confirmed|checked)\b/gi;
// A claim is honest when the words around it deny it or name someone else.
const HONEST_BEFORE=/(?:\bnot(?: yet)?(?: been)?(?: field-)?|\bno\b[^.]*\b(?:has|have) been|\bOSM-|\bun)\s*$/i;

function claimsIn(text){
  const found=[];
  for(const match of String(text).matchAll(CLAIM)){
    const before=String(text).slice(Math.max(0,match.index-60),match.index);
    if(HONEST_BEFORE.test(before)) continue;
    found.push(String(text).slice(Math.max(0,match.index-40),match.index+match[0].length+20).trim());
  }
  return found;
}

function readerStrings(value,where,out){
  if(typeof value==='string') out.push([where,value]);
  else if(Array.isArray(value)) value.forEach((item,i)=>readerStrings(item,`${where}[${i}]`,out));
  else if(value&&typeof value==='object'){
    for(const [key,item] of Object.entries(value)){
      if(!NOT_READER_COPY.has(key)) readerStrings(item,where?`${where}.${key}`:key,out);
    }
  }
  return out;
}

describe('a trail without the seal never says it is verified',()=>{
  const trust=appTrust();
  const trails=loadProductionTrails(ROOT);
  const published=new Set(buildCanonicalCatalog(trails).records
    .filter(record=>record.lifecycle==='published').map(record=>record.id));
  const sealed=trail=>['route-audited','dolopaws-walked'].includes(trust.tierOf(trail));

  test('the catalogue is loaded, with trails on both sides of the seal',()=>{
    const live=trails.filter(trail=>published.has(trail.id));
    expect(live.length).toBeGreaterThan(150);
    expect(live.some(sealed)).toBe(true);
    expect(live.some(trail=>!sealed(trail))).toBe(true);
  });

  test('the detector catches the sentence that started this, and lets honest ones through',()=>{
    expect(claimsIn('A real, GPS-verified loop from Compatsch, confirmed by multiple independent hiking guides')).toHaveLength(2);
    expect(claimsIn('Route checked by our team.')).toHaveLength(1);
    expect(claimsIn('This walk is not yet verified by ORMA.')).toEqual([]);
    expect(claimsIn('ORMA has not confirmed how they appear on local signs.')).toEqual([]);
    expect(claimsIn('Surface not yet field-verified')).toEqual([]);
    expect(claimsIn('treat that as unconfirmed')).toEqual([]);
    expect(claimsIn('No car park or bus stop has been confirmed nearby.')).toEqual([]);
    expect(claimsIn('Drinking water (OSM-verified location)')).toEqual([]);
  });

  test('no published, unsealed trail claims verification in its copy',()=>{
    const offenders=[];
    for(const trail of trails){
      if(!published.has(trail.id)||sealed(trail)) continue;
      for(const [where,text] of readerStrings(trail,'',[])){
        for(const claim of claimsIn(text)) offenders.push(`${trail.id} ${where}: ${claim}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
