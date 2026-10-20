'use strict';

const path=require('path');
const {loadProductionTrails}=require('../scripts/load-production-trails');
const {isCurrentSiteTrail,currentSiteTrails}=require('./services/public-site-trails');

describe('the existing-site verification boundary',()=>{
  test('includes the 145 trail pages that have artwork, whatever the catalogue holds',()=>{
    // The catalogue grew from 162 to 163 when the member-role fix regenerated
    // it, and the trails held back as drafts fell from 22 to 7. Neither moves
    // this number: the boundary is artwork, and 23 catalogue records still have
    // none. The two counts were equal while the drafts and the artwork-less
    // records happened to be the same 22 records, and they no longer are.
    const catalogue=loadProductionTrails(path.resolve(__dirname,'..'));
    expect(catalogue).toHaveLength(163);
    // 145 since the photo audit: five Savoy walks were already carrying a
    // Wikimedia photograph whose licence was named in the credit text and
    // nowhere else, and were missing only a hero image and alt text.
    expect(currentSiteTrails(catalogue)).toHaveLength(145);
  });

  test('requires the artwork the public trail page needs',()=>{
    expect(isCurrentSiteTrail({id:'public',imageIcon:'card.jpg',heroImage:'hero.jpg'})).toBe(true);
    expect(isCurrentSiteTrail({id:'draft',imageIcon:'',heroImage:''})).toBe(false);
    expect(isCurrentSiteTrail({id:'intake',imageIcon:'card.jpg',heroImage:'hero.jpg',publicRecordPresent:false})).toBe(false);
  });
});
