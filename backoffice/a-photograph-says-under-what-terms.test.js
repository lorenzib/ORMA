'use strict';

const path=require('path');
const {existingImageFields,NOT_A_PHOTOGRAPH}=require('./workflows/build-publication-staging');
const {standingOf,auditTrailPhotos}=require('../scripts/audit-trail-photos');
const {loadProductionTrails}=require('../scripts/load-production-trails');

const ROOT=path.resolve(__dirname,'..');

/**
 * A credit line says where a picture came from. It does not say that anyone
 * may use it.
 *
 * `existingImageFields` asked for a picture, a hero, alt text and a credit.
 * Sixteen Savoy walks were showing a photograph credited to a tourism board
 * or a commercial site -- "Decathlon Outdoor (edited)", "Lac Annecy Tourisme
 * fiche (Apidae)" -- with no licence, creator or terms recorded anywhere:
 * not on the trail, not in the image overrides, not in the provenance module.
 */
const complete=extra=>({id:'t',imageIcon:'images/x.webp',heroImage:'images/x.webp',
  imageAlt:'A gravel track between spruce',imageCreditText:'Somebody, via Somewhere',
  imageCreator:'Somebody',imageLicence:'CC BY 4.0',imageSourceType:'licensed-source',...extra});

describe('a photograph says who took it and under what terms',()=>{
  test('a complete record passes',()=>{
    expect(existingImageFields(complete())).toMatchObject({imageLicence:'CC BY 4.0'});
  });

  test('a credit without a licence or a creator does not',()=>{
    expect(existingImageFields(complete({imageLicence:''}))).toBeNull();
    expect(existingImageFields(complete({imageCreator:'  '}))).toBeNull();
    const {imageLicence,...noLicence}=complete();
    expect(existingImageFields(noLicence)).toBeNull();
  });

  // An AI illustration is honestly labelled on the page, and must not satisfy
  // a check that says this trail has a photograph of it.
  test('an illustration is not a photograph, however well credited',()=>{
    expect(NOT_A_PHOTOGRAPH).toContain('ai-illustration');
    expect(existingImageFields(complete({imageSourceType:'ai-illustration',
      imageCreator:'ORMA',imageLicence:'ORMA-owned'}))).toBeNull();
  });

  // Every trail that already had a complete record carried both, so this
  // refuses nothing that was passing.
  test('it refuses nothing the catalogue was already publishing',()=>{
    const trails=loadProductionTrails(ROOT);
    const published=trails.filter(existingImageFields);
    expect(published.length).toBeGreaterThan(140);
    const missing=published.filter(trail=>
      !String(trail.imageLicence||'').trim()||!String(trail.imageCreator||'').trim());
    expect(missing.map(trail=>trail.id)).toEqual([]);
  });
});

describe('the audit says what is known about each picture',()=>{
  const trails=loadProductionTrails(ROOT);
  const groups=auditTrailPhotos(trails);

  test('every trail lands in exactly one group',()=>{
    const total=Object.values(groups).reduce((sum,rows)=>sum+rows.length,0);
    expect(total).toBe(trails.length);
  });

  test('the five verified Wikimedia photographs are recorded with their terms',()=>{
    for(const [id,licence,creator] of [
      ['osm-6250300','CC BY-SA 3.0','Mangatome'],
      ['osm-10116283','CC BY 2.0','Guilhem Vellut'],
      // Replaced on 24 October 2026 by a photograph taken 85 m from the
      // walk (the previous one was 1.8 km away).
      ['osm-10116380','CC BY 2.0','Ylliab Photo'],
      ['osm-20347406','CC BY 2.0','Guilhem Vellut'],
      // The credit said only "CC BY-SA"; the source page says 4.0.
      ['osm-16322228','CC BY-SA 4.0','Anthony Levrot'],
    ]){
      const trail=trails.find(record=>record.id===id);
      expect({id,standing:standingOf(trail),licence:trail.imageLicence,creator:trail.imageCreator})
        .toEqual({id,standing:'established',licence,creator});
      expect(trail.imageLicenceUrl).toMatch(/^https:\/\/creativecommons\.org\/licenses\//);
      expect(trail.imageSourcePage).toMatch(/^https:\/\/(commons\.wikimedia|fr\.wikipedia)\.org\//);
      // Alt text describes the picture, not the trail's name.
      expect(trail.imageAlt.toLowerCase()).not.toBe(String(trail.name).toLowerCase());
      expect(trail.imageAlt.length).toBeGreaterThan(40);
    }
  });

  // Every trail drawn by scripts/render-trail-illustrations.js. Sentier du
  // Four's AI picture was the first illustration; it is now an ORMA one, and
  // La Croix des Salles left the list when it gained a licensed photograph.
  test('the illustrations are recorded as ORMA’s own and not as photographs',()=>{
    const listed=require('../data/trail-illustrations.json').trails.map(entry=>entry.id);
    expect(listed).toContain('osm-14987412');
    for(const id of listed){
      const trail=trails.find(record=>record.id===id);
      expect({id,standing:standingOf(trail),creator:trail.imageCreator,type:trail.imageSourceType})
        .toEqual({id,standing:'illustration',creator:'ORMA',type:'orma-illustration'});
      expect(existingImageFields(trail)).toBeNull();
    }
  });

  // The ones still owed an answer. Named, because a count cannot be acted on.
  // Le Marais de Pré Lombard was the last: its only picture came from a
  // commercial site with no licence. It is now an ORMA illustration, so no
  // picture is left whose terms nobody has recorded. A new one fails here.
  test('no picture is left whose terms nobody has recorded',()=>{
    const unestablished=groups['terms-not-established'].map(trail=>trail.id).sort();
    expect(unestablished).toEqual([]);
    for(const trail of groups['terms-not-established']){
      // None of them is being published as the trail's own.
      expect({id:trail.id,published:Boolean(existingImageFields(trail))})
        .toEqual({id:trail.id,published:false});
    }
  });
});
