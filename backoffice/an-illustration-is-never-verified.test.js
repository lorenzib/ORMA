'use strict';

// The owner's rule, 24 October 2026: a trail shown with an illustration is
// never Verified. It stays Reviewed until somebody takes a photograph of the
// walk, it is reviewed, and it becomes the trail's picture.

const fs=require('fs');
const path=require('path');
const {NOT_A_PHOTOGRAPH,graduationFor}=require('./workflows/build-publication-staging');
const {loadProductionTrails}=require('../scripts/load-production-trails');
const {heroCredit}=require('../trail-photo-provenance');
const {cardSvg}=require('../scripts/render-trail-illustrations');

const ROOT=path.resolve(__dirname,'..');
const trails=loadProductionTrails(ROOT);
const listed=require('../data/trail-illustrations.json').trails;

describe('an illustration is never a photograph', () => {
  test('both kinds of drawn picture are listed as not a photograph',()=>{
    expect(NOT_A_PHOTOGRAPH).toEqual(expect.arrayContaining(['ai-illustration','orma-illustration']));
  });

  test('no illustrated trail is verified, or credited with the photo check',()=>{
    const illustrated=trails.filter(trail=>NOT_A_PHOTOGRAPH.includes(String(trail.imageSourceType||'')));
    expect(illustrated.length).toBeGreaterThanOrEqual(listed.length);
    for(const trail of illustrated){
      expect({id:trail.id,status:trail.graduation?.status||null,tier:trail.tier||null})
        .not.toMatchObject({status:'verified'});
      expect(trail.tier).not.toBe('route-audited');
      expect(trail.graduation?.completed||[]).not.toContain('photo');
    }
  });

  test('the seal counts no photograph when the trail has none',()=>{
    expect(graduationFor([],false,true).completed).not.toContain('photo');
  });

  test('every listed trail carries its drawing, and the page calls it an illustration',()=>{
    for(const {id,reason} of listed){
      expect(reason).toMatch(/\S/);
      const trail=trails.find(record=>record.id===id);
      expect(trail).toBeDefined();
      expect(trail.heroImage).toBe(`images/trails/${id}-orma-illustration.jpg`);
      expect(trail.imageIcon).toBe(trail.heroImage);
      expect(fs.existsSync(path.join(ROOT,trail.heroImage))).toBe(true);
      const credit=heroCredit(trail);
      expect(credit.isIllustration).toBe(true);
      expect(credit.label).not.toMatch(/^Photo:/);
      expect(credit.label).toMatch(/illustration/i);
    }
  });

  test('the drawing says it is an illustration and shows the walk’s own figures',()=>{
    const trail=trails.find(record=>record.id===listed[0].id);
    const svg=cardSvg(trail);
    expect(svg).toContain('ILLUSTRATION');
    expect(svg).toContain(`${trail.distance} km`);
    expect(svg).toContain(`${trail.elevation} m climb`);
  });
});
