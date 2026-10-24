'use strict';

const path=require('path');
const {loadProductionTrails}=require('../scripts/load-production-trails');
const {isCurrentSiteTrail,currentSiteTrails}=require('./services/public-site-trails');

describe('the existing-site verification boundary',()=>{
  test('includes the 178 trail pages that have artwork, whatever the catalogue holds',()=>{
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
    // nowhere else, and were missing only a hero image and alt text. Then 152
    // when Circuit Béatrice de Savoie, Le Belvédère and the Boucle du Lac de la
    // Thuile took licensed photographs in place of ones whose sources grant no
    // reuse. Five more still have an icon and no hero. Then 165 and 154 when
    // the Sissiweg and the Sonnenberger Panoramaweg arrived verified, each with
    // a licensed photograph, then 167 and 156 with the Algunder and Maiser
    // Waalwege, then 171 and 160 with the Marlinger Waalweg, the Aschbach
    // forest trail, the Höfeweg and the Gsindboden loop. Then 163 when La Croix
    // des Salles, Le Mont d'Arbois and La Galoppaz were verified by hand with
    // licensed photographs in place of an illustration and two unlicensed ones,
    // then 174 and 166 with the Mühlenweg, the Katharinaberg loop and the
    // Quellenpromenade, then 177 and 169 with the Törggeleweg and the
    // Niedertal and Mittertal loops in Antholz, then 180 and 172 with the
    // Kulturwanderweg Peter Mitterhofer, the Hinzlweg and the Martinsweg. Then
    // 178 when six walks with no usable picture -- Sentier du Four, the Marais
    // de Pré Lombard, the Anton Schwingshackl Weg, Marmottes, La Plagne and the
    // Demoiselles Coiffées -- gained an ORMA illustration (they stay Reviewed,
    // never Verified), then 184 and 182 with PanaRaida, the Feldthurns
    // Panoramaweg, the Antholzer See loop and the Poststeig. Then 181 when
    // Chalets de Salvadon, Alpage de Commune and Rundweg Rotwand were removed
    // outright, and 179 because their photographs went with them: withdrawn,
    // they were drafts with artwork, which this boundary still counted.
    const catalogue=loadProductionTrails(path.resolve(__dirname,'..'));
    expect(catalogue).toHaveLength(181);
    expect(currentSiteTrails(catalogue)).toHaveLength(179);
  });

  test('requires the artwork the public trail page needs',()=>{
    expect(isCurrentSiteTrail({id:'public',imageIcon:'card.jpg',heroImage:'hero.jpg'})).toBe(true);
    expect(isCurrentSiteTrail({id:'draft',imageIcon:'',heroImage:''})).toBe(false);
    expect(isCurrentSiteTrail({id:'intake',imageIcon:'card.jpg',heroImage:'hero.jpg',publicRecordPresent:false})).toBe(false);
  });
});
