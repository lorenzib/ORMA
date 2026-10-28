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
    // Panoramaweg, the Antholzer See loop and the Poststeig, then 188 and 186
    // with the Sand in Taufers nature trail, the Aicha village walk, the
    // Gratschenbergrunde and the Römerweg in Kiens, then 190 and 188 with the
    // history walk in Teis and the Concordia loop on the Kronplatz, then 199
    // and 197 with nine Val di Fassa walks drawn on OSM along the APT's line.
    // Then 196 when Chalets de Salvadon, Alpage de Commune and Rundweg Rotwand
    // were removed outright, and 194 because their photographs went with them:
    // withdrawn, they were drafts with artwork, which this boundary still
    // counted. Then 199 and 197 with three more Val di Fassa walks: the
    // shepherds' walk from Vigo, the meadows above Pozza and the Fuciade alp. Then
    // 205 and 203 with six village walks in Primiero drawn on OSM along the APT
    // San Martino di Castrozza's line. Then 209 and 207 with four more: the Via
    // Nova loop from Mezzano, the Val di Roda from San Martino, the Valpiana
    // forest loop and the Cordognè loop to San Giovanni. Then 214 and 212
    // with five Cortina walks drawn on Cortina Marketing's line. Then 218 and
    // 216 with the first four Val di Fiemme walks: the Parco della Pieve and
    // the Rio Gambis in Cavalese, Cavalese to Castello and back, and the
    // little waterfalls above Roda. Then 220 and 218 with two more: the larch
    // woods from Prà del Manz to Anterivo and the meadows of Spianez. Then 221
    // and 219 with the forest walk from San Martino di Castrozza to Malga Ces. Then 224 and
    // 222 with three more Fiemme walks: the Prai de le Fior above Valfloriana,
    // the Passo Oclini loop and the old farmsteads below Capriana. Then 226 and
    // 224 with the forest walk to Malga Crel and the Croce degli Alpini on Vederna. Then 227 and
    // 225 with the botanical path from Grauno to Capriana. Then 229 and 227
    // with the rope-bridge loop from Mezzano and the old-fruit walk to Passo Gobbera.
    // Then 230 and 228 with the forest walk to Malga Valcigolera. Then 236 and
    // 234 with the first six Val di Cembra walks: the Lago Santo, two walks
    // at the Lago di Lases, San Leonardo above Lisignago, the Dos Paion on
    // Monte Corona and the Rifugio Potzmauer. Then 241 and
    // 239 with five more Val di Cembra walks: the Castello di Segonzano, Sevignano,
    // Grauno, the Monte Corona loop and the Masi di Grumes. Then 244 and
    // 242 with the Malghette, the Piz de le Agole and the old-trades path from Grumes. Then 246 and
    // 244 with the two walks at Malga Vernera above Sover. Then 250 and 248 with
    // four Alta Badia walks: Lech da Sompunt, Corvara – Colfosco, the Tru di artisć
    // and Corvara – La Villa. Then 252 and 250 with two more: the farms loop
    // above Pederoa and Furnacia – La Crusc. Then 255 and 253 with three more: the
    // Rit meadows above La Val, San Cassiano – Pralongiá – Corvara and the Pisciadú
    // waterfall from Corvara. Then 261 and 259 with six Val Gardena walks: the Lech
    // Sant, the Ortisei valley promenade, the Resciesa summit loop, Santa Croce –
    // Brogles, the Via Crucis above Santa Cristina and San Giacomo from Ortisei.
    // Then 268 and 266 with the first seven Hochpustertal walks: the Toblacher See,
    // the Gustav Mahler path, Innichen – Haselsberg – Toblach, Wildbad Innichen, the
    // Maistatt loop, St. Magdalena in Moos and the Grünwaldalm above the Pragser Wildsee.
    // Then 272 and 270 with four more Val di Fassa walks: Soraga to Tamion, Alba to
    // Penìa, Val Freida and Moena to Soraga.
    // Then 275 and 273 with three more Val di Fassa walks: Mazzin to Pera over
    // Ronch, Moena to Malga Roncac and Moena to Soraga over Someda.
    // Then 284 and 282 with the first nine western Trentino walks: five around the
    // Lago dei Caprioli and Rifugio Denza in the Val di Sole, the Javrè – Pelugo
    // cycle path loop, and Madonna del Lares, San Vigilio and San Martino in the
    // Giudicarie.
    // Then 288 and 286 with four more Val Gardena walks: the Vallunga, the Sëurasas,
    // the farms path above Santa Cristina and the Raida dl luech.
    // Then 293 and 291 with five more Hochpustertal walks: Innichen – Waldkapelle –
    // Sexten, Niederdorf – Bellavista, the Pragser Wildsee to the Rossalm, Schluderbach
    // to the Dürrensteinhütte, and down from the Helm to Vierschach.
    // Then 298 and 296 with the first five Lombardy walks, round Lake Como:
    // Brunate's churches, the Pognana Lario sculptures, Brogno to the Nuvolone
    // viewpoint, Lasnigo – Barni – Crezzo and Eupilio's Madonna della Neve.
    // Then 304 and 302 with the first six Valle d'Aosta walks: the Rû Courtaud,
    // Champoluc to the Mascognaz waterfall and Périasc to Antagnod in Ayas, and the
    // Sentiero della Regina, the Strada Lombarda and Alpenzù in Gressoney.
    // Then 309 and 307 with five Sexten walks drawn there and back: Sexten – Innichen,
    // Sexten church – Gasthof Panorama, Haus der Berge – Lärchenhütte, the Mitterberg
    // fort to the Helmhanghütte, and Sexten – Waldkapelle.
    // Then 315 and 313 with six more western Trentino walks: the Senter dei Popi,
    // Giustino's Giro del Belvedere, the Monclassico sundials, Passo del Tonale to
    // Forte Mero and to Forte Zaccarana, and Ortisè to Malga Stabli.
    // Then 320 and 318 with the first five Friuli Venezia Giulia walks: the Fusine
    // lakes, Ta Lipa Pot at Stolvizza, the Pustot beeches above Dordolla, Stavoli di
    // Moggio and the Lago di Verzegnis loop.
    // Then 323 and 321 with three Paganella walks: Andalo to the Tana
    // dell'Ermellino, the Toresela above Mezzolombardo over its suspension bridge,
    // and the hamlets of San Lorenzo in Banale.
    const catalogue=loadProductionTrails(path.resolve(__dirname,'..'));
    expect(catalogue).toHaveLength(323);
    expect(currentSiteTrails(catalogue)).toHaveLength(321);
  });

  test('requires the artwork the public trail page needs',()=>{
    expect(isCurrentSiteTrail({id:'public',imageIcon:'card.jpg',heroImage:'hero.jpg'})).toBe(true);
    expect(isCurrentSiteTrail({id:'draft',imageIcon:'',heroImage:''})).toBe(false);
    expect(isCurrentSiteTrail({id:'intake',imageIcon:'card.jpg',heroImage:'hero.jpg',publicRecordPresent:false})).toBe(false);
  });
});
