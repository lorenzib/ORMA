'use strict';

const path=require('path');
const {loadProductionTrails}=require('../scripts/load-production-trails');
const {isCurrentSiteTrail,currentSiteTrails}=require('./services/public-site-trails');

describe('the existing-site verification boundary',()=>{
  test('includes the 149 trail pages that have artwork, whatever the catalogue holds',()=>{
    // The boundary is artwork, and it is not publication: the catalogue grew
    // from 162 to 163 and the drafts fell from 22 to 2 without either moving
    // this number. The two were equal only while the drafts and the
    // artwork-less records happened to be the same 22 records.
    //
    // 140 until Lago di Carezza gained a heroImage; its photograph had been on
    // disk all along, and this boundary needs both an icon and a hero. Then 144
    // when the Boucle du Taillefer, Les Marais d'Albens and the Sentier des Buis
    // took licensed covers in place of three whose sources grant no reuse.
    // Then 149 after the photo audit: five Savoy walks were already carrying a
    // Wikimedia photograph whose licence was named in the credit text and
    // nowhere else, and were missing only a hero image and alt text. Eight
    // more still have an icon and no hero.
    const catalogue=loadProductionTrails(path.resolve(__dirname,'..'));
    expect(catalogue).toHaveLength(163);
    expect(currentSiteTrails(catalogue)).toHaveLength(149);
  });

  test('requires the artwork the public trail page needs',()=>{
    expect(isCurrentSiteTrail({id:'public',imageIcon:'card.jpg',heroImage:'hero.jpg'})).toBe(true);
    expect(isCurrentSiteTrail({id:'draft',imageIcon:'',heroImage:''})).toBe(false);
    expect(isCurrentSiteTrail({id:'intake',imageIcon:'card.jpg',heroImage:'hero.jpg',publicRecordPresent:false})).toBe(false);
  });
});
