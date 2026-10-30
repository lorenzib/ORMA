/**
 * regions-config.js, ORMA region & valley taxonomy.
 *
 * Assigns every trail (curated AND imported, identically) a `region` and
 * `valley` at page load, from the nearest known locality, the same
 * nearest-locality logic the import pipeline uses. trails-data.js is never
 * modified. Load AFTER all trail data files and BEFORE script.js.
 */
(function () {
  'use strict';

  // [locality, lat, lng, valley, region, province]
  const LOCALITIES = [
    // ---- Dolomites ----
    ['Cortina d\'Ampezzo', 46.5405, 12.1357, 'Cortina – Ampezzo', 'dolomites', 'belluno'],
    ['Ortisei / Val Gardena', 46.5747, 11.6717, 'Val Gardena', 'dolomites', 'alto-adige'],
    ['Selva di Val Gardena', 46.5551, 11.7605, 'Val Gardena', 'dolomites', 'alto-adige'],
    ['Canazei / Val di Fassa', 46.4770, 11.7714, 'Val di Fassa', 'dolomites', 'trentino'],
    ['Corvara / Alta Badia', 46.5504, 11.8746, 'Val Badia', 'dolomites', 'alto-adige'],
    ['San Cassiano / Alta Badia', 46.5687, 11.9312, 'Val Badia', 'dolomites', 'alto-adige'],
    ['Dobbiaco / Toblach', 46.7357, 12.2210, 'Alta Pusteria – Tre Cime', 'dolomites', 'alto-adige'],
    ['San Candido / Innichen', 46.7327, 12.2800, 'Alta Pusteria – Tre Cime', 'dolomites', 'alto-adige'],
    ['Sesto / Sexten', 46.7025, 12.3500, 'Alta Pusteria – Tre Cime', 'dolomites', 'alto-adige'],
    ['Braies / Prags', 46.7207, 12.1350, 'Alta Pusteria – Tre Cime', 'dolomites', 'alto-adige'],
    ['Villabassa / Niederdorf', 46.7378, 12.1724, 'Alta Pusteria – Tre Cime', 'dolomites', 'alto-adige'],
    ['Carbonin / Schluderbach (Dobbiaco)', 46.6214, 12.2120, 'Alta Pusteria – Tre Cime', 'dolomites', 'alto-adige'],
    ['Auronzo di Cadore', 46.5527, 12.4419, 'Alta Pusteria – Tre Cime', 'dolomites', 'belluno'],
    ['Alpe di Siusi / Seiser Alm', 46.5402, 11.6181, 'Alpe di Siusi – Sciliar', 'dolomites', 'alto-adige'],
    ['Castelrotto / Kastelruth', 46.5670, 11.5599, 'Alpe di Siusi – Sciliar', 'dolomites', 'alto-adige'],
    ['Val di Funes / Villnöss', 46.6440, 11.6810, 'Val di Funes – Odle', 'dolomites', 'alto-adige'],
    ['Bressanone / Brixen', 46.7151, 11.6570, 'Valle Isarco – Eisacktal', 'dolomites', 'alto-adige'],
    ['Nova Levante / Carezza', 46.4300, 11.5380, 'Val di Fiemme – Latemar', 'dolomites', 'alto-adige'],
    ['Predazzo / Val di Fiemme', 46.3110, 11.6010, 'Val di Fiemme – Latemar', 'dolomites', 'trentino'],
    ['Cavalese', 46.2910, 11.4600, 'Val di Fiemme – Latemar', 'dolomites', 'trentino'],
    // The lower Val di Fiemme and its South Tyrol neighbour. Without them
    // Capriana fell through to Montan and Altrei to Cavalese, each across the
    // provincial border.
    ['Capriana', 46.2620, 11.3390, 'Val di Fiemme – Latemar', 'dolomites', 'trentino'],
    ['Valfloriana', 46.2500, 11.3430, 'Val di Fiemme – Latemar', 'dolomites', 'trentino'],
    ['Anterivo / Altrei', 46.2780, 11.3670, 'Oltradige – Bassa Atesina', 'dolomites', 'alto-adige'],
    ['San Martino di Castrozza', 46.2612, 11.8022, 'Primiero – Pale', 'dolomites', 'trentino'],
    ['Fiera di Primiero', 46.1770, 11.8290, 'Primiero – Pale', 'dolomites', 'trentino'],
    ['Falcade / Val Biois', 46.3576, 11.8712, 'Belluno – Agordino', 'dolomites', 'belluno'],
    ['Arabba', 46.4977, 11.8747, 'Val Badia', 'dolomites', 'belluno'],
    ['Alleghe', 46.4066, 12.0209, 'Belluno – Agordino', 'dolomites', 'belluno'],
    ['Agordo', 46.2820, 12.0330, 'Belluno – Agordino', 'dolomites', 'belluno'],
    ['Belluno', 46.1420, 12.2167, 'Belluno – Agordino', 'dolomites', 'belluno'],
    ['Pieve di Cadore', 46.4276, 12.3730, 'Belluno – Agordino', 'dolomites', 'belluno'],
    // Bolzano sat in 'Val di Fiemme – Latemar' and Vipiteno in 'Val di Funes –
    // Odle'; neither city is in the valley it named. Because both are big
    // enough to be the nearest entry for a wide area, they handed that wrong
    // valley to every trail that fell through to them.
    ['Bolzano / Bozen', 46.4983, 11.3548, 'Conca di Bolzano', 'dolomites', 'alto-adige'],
    ['Collalbo / Klobenstein (Renon / Ritten)', 46.5397, 11.4597, 'Conca di Bolzano', 'dolomites', 'alto-adige'],
    ['Brunico / Bruneck', 46.7966, 11.9376, 'Alta Pusteria – Tre Cime', 'dolomites', 'alto-adige'],
    ['Vipiteno / Sterzing', 46.8977, 11.4331, 'Valle Isarco – Eisacktal', 'dolomites', 'alto-adige'],
    ['Madonna di Campiglio', 46.2295, 10.8269, 'Brenta', 'dolomites', 'trentino'],

    // Valleys the OSM import reached that the original 56-entry list did not
    // cover. Without them every trail here fell through to the nearest big
    // town, up to 31 km away.
    ['Naturno / Naturns', 46.6499, 11.0042, 'Val Venosta – Vinschgau', 'dolomites', 'alto-adige'],
    ['Ultimo / Ulten', 46.5486, 11.0042, 'Val d\'Ultimo – Ultental', 'dolomites', 'alto-adige'],
    ['Merano / Meran', 46.6714, 11.1646, 'Burgraviato – Merano', 'dolomites', 'alto-adige'],
    ['Avelengo / Hafling', 46.6626, 11.2542, 'Burgraviato – Merano', 'dolomites', 'alto-adige'],
    ['Verano / Vöran', 46.6224, 11.2444, 'Burgraviato – Merano', 'dolomites', 'alto-adige'],
    ['San Leonardo in Passiria / St. Leonhard', 46.7877, 11.2751, 'Val Passiria – Passeier', 'dolomites', 'alto-adige'],
    ['Sarentino / Sarnthein', 46.6430, 11.3566, 'Val Sarentino – Sarntal', 'dolomites', 'alto-adige'],
    ['Valdurna / Durnholz', 46.7397, 11.4392, 'Val Sarentino – Sarntal', 'dolomites', 'alto-adige'],
    ['Meltina / Mölten', 46.5930, 11.2503, 'Salto – Tschögglberg', 'dolomites', 'alto-adige'],
    ['San Genesio / Jenesien', 46.5671, 11.3280, 'Salto – Tschögglberg', 'dolomites', 'alto-adige'],
    ['Caldaro / Kaltern', 46.4135, 11.2469, 'Oltradige – Bassa Atesina', 'dolomites', 'alto-adige'],
    ['Termeno / Tramin', 46.3415, 11.2423, 'Oltradige – Bassa Atesina', 'dolomites', 'alto-adige'],
    ['Montagna / Montan', 46.3308, 11.3046, 'Oltradige – Bassa Atesina', 'dolomites', 'alto-adige'],
    ['Salorno / Salurn', 46.2457, 11.2029, 'Oltradige – Bassa Atesina', 'dolomites', 'alto-adige'],
    ['Lauregno / Laurein', 46.4795, 11.0465, 'Val di Non – Nonsberg', 'dolomites', 'alto-adige'],
    ['Vandoies / Vintl', 46.8758, 11.7209, 'Val Pusteria – Pustertal', 'dolomites', 'alto-adige'],
    ['Terento / Terenten', 46.8515, 11.7820, 'Val Pusteria – Pustertal', 'dolomites', 'alto-adige'],
    ['Chienes / Kiens', 46.8226, 11.8326, 'Val Pusteria – Pustertal', 'dolomites', 'alto-adige'],
    ['Valle di Casies / Gsies', 46.8241, 12.2325, 'Val Pusteria – Pustertal', 'dolomites', 'alto-adige'],
    ['Anterselva / Antholz', 46.8640, 12.1180, 'Val Pusteria – Pustertal', 'dolomites', 'alto-adige'],
    ['Lago di Anterselva / Antholzer See', 46.8870, 12.1720, 'Val Pusteria – Pustertal', 'dolomites', 'alto-adige'],
    ['Valles / Vals', 46.8698, 11.6202, 'Valle Isarco – Eisacktal', 'dolomites', 'alto-adige'],
    ['San Martino in Badia / St. Martin', 46.6509, 11.8417, 'Val Badia', 'dolomites', 'alto-adige'],
    ['Andalo', 46.1617, 11.0076, 'Paganella', 'dolomites', 'trentino'],
    ['Fai della Paganella', 46.1793, 11.0689, 'Paganella', 'dolomites', 'trentino'],
    ['Baselga di Piné', 46.1313, 11.2568, 'Valsugana', 'dolomites', 'trentino'],
    ['Pieve Tesino', 46.1986, 11.5441, 'Valsugana', 'dolomites', 'trentino'],
    // The Val di Cembra. Without it Lases and Lisignago fell through to
    // Baselga di Piné, Giovo to Fai della Paganella and Cembra to Salorno.
    ['Cembra', 46.1745, 11.2190, 'Val di Cembra', 'dolomites', 'trentino'],
    ['Lisignago', 46.1630, 11.1870, 'Val di Cembra', 'dolomites', 'trentino'],
    ['Lases', 46.1430, 11.2210, 'Val di Cembra', 'dolomites', 'trentino'],
    ['Verla di Giovo', 46.1550, 11.1530, 'Val di Cembra', 'dolomites', 'trentino'],
    ['Segonzano', 46.1890, 11.2640, 'Val di Cembra', 'dolomites', 'trentino'],
    ['Faver (Altavalle)', 46.1880, 11.2350, 'Val di Cembra', 'dolomites', 'trentino'],
    ['Grumes (Altavalle)', 46.2210, 11.2930, 'Val di Cembra', 'dolomites', 'trentino'],
    ['Montesover (Sover)', 46.2232, 11.3376, 'Val di Cembra', 'dolomites', 'trentino'],
    // Keeps the walks above Valfloriana in Fiemme now Montesover is listed.
    ['Malga Sass (Valfloriana)', 46.2009, 11.3787, 'Val di Fiemme – Latemar', 'dolomites', 'trentino'],
    ['Tambre / Alpago', 46.0973, 12.4389, 'Alpago', 'dolomites', 'belluno'],

    // Western Trentino. Without them a walk anywhere from the Val di Sole to
    // Lake Garda fell through to Madonna di Campiglio or Andalo, up to 40 km off.
    ['Malè', 46.3530, 10.9130, 'Val di Sole', 'dolomites', 'trentino'],
    ['Dimaro', 46.3260, 10.8720, 'Val di Sole', 'dolomites', 'trentino'],
    ['Vermiglio', 46.2970, 10.6910, 'Val di Sole', 'dolomites', 'trentino'],
    // The Trentino side of the pass; without it the forts walks fell to Ponte di Legno.
    ['Passo del Tonale (Vermiglio)', 46.2600, 10.6100, 'Val di Sole', 'dolomites', 'trentino'],
    ['Cogolo (Peio)', 46.3570, 10.6710, 'Val di Sole', 'dolomites', 'trentino'],
    ['San Bernardo (Rabbi)', 46.4010, 10.8480, 'Val di Sole', 'dolomites', 'trentino'],
    ['Cles', 46.3640, 11.0350, 'Val di Non', 'dolomites', 'trentino'],
    ['Coredo (Predaia)', 46.3480, 11.0910, 'Val di Non', 'dolomites', 'trentino'],
    ['Fondo (Borgo d\'Anaunia)', 46.4370, 11.1380, 'Val di Non', 'dolomites', 'trentino'],
    ['Pinzolo', 46.1600, 10.7650, 'Val Rendena', 'dolomites', 'trentino'],
    ['Villa Rendena (Porte di Rendena)', 46.0640, 10.7120, 'Val Rendena', 'dolomites', 'trentino'],
    ['Tione di Trento', 46.0360, 10.7260, 'Giudicarie', 'dolomites', 'trentino'],
    ['Ponte Arche (Comano Terme)', 46.0360, 10.8730, 'Giudicarie', 'dolomites', 'trentino'],
    ['Pieve di Bono', 45.9440, 10.6380, 'Giudicarie', 'dolomites', 'trentino'],
    ['Storo', 45.8490, 10.5800, 'Giudicarie', 'dolomites', 'trentino'],
    ['Riva del Garda', 45.8850, 10.8410, 'Garda Trentino', 'dolomites', 'trentino'],
    ['Arco', 45.9180, 10.8860, 'Garda Trentino', 'dolomites', 'trentino'],
    ['Pieve di Ledro', 45.8880, 10.7310, 'Garda Trentino', 'dolomites', 'trentino'],

    // ---- Savoy ----
    ['Chamonix-Mont-Blanc', 45.9237, 6.8694, 'Chamonix – Mont Blanc', 'savoy', 'haute-savoie'],
    ['Les Houches', 45.8906, 6.7986, 'Chamonix – Mont Blanc', 'savoy', 'haute-savoie'],
    ['Saint-Gervais-les-Bains', 45.8926, 6.7130, 'Chamonix – Mont Blanc', 'savoy', 'haute-savoie'],
    ['Passy', 45.9236, 6.6980, 'Chamonix – Mont Blanc', 'savoy', 'haute-savoie'],
    ['Megève', 45.8567, 6.6176, 'Aravis – Annecy', 'savoy', 'haute-savoie'],
    ['Annecy', 45.8992, 6.1294, 'Aravis – Annecy', 'savoy', 'haute-savoie'],
    ['Arbusigny', 46.0860, 6.2080, 'Aravis – Annecy', 'savoy', 'haute-savoie'],
    ['Talloires / Lac d\'Annecy', 45.8410, 6.2140, 'Aravis – Annecy', 'savoy', 'haute-savoie'],
    ['Duingt', 45.8274, 6.2020, 'Aravis – Annecy', 'savoy', 'haute-savoie'],
    ['La Clusaz', 45.9045, 6.4237, 'Aravis – Annecy', 'savoy', 'haute-savoie'],
    ['Le Grand-Bornand', 45.9410, 6.4280, 'Aravis – Annecy', 'savoy', 'haute-savoie'],
    ['Plateau des Glières', 45.9615, 6.3345, 'Aravis – Annecy', 'savoy', 'haute-savoie'],
    ['Morzine', 46.1791, 6.7090, 'Chablais – Portes du Soleil', 'savoy', 'haute-savoie'],
    ['Avoriaz', 46.1912, 6.7742, 'Chablais – Portes du Soleil', 'savoy', 'haute-savoie'],
    ['Samoëns', 46.0826, 6.7266, 'Chablais – Portes du Soleil', 'savoy', 'haute-savoie'],
    ['Thonon-les-Bains', 46.3705, 6.4784, 'Chablais – Portes du Soleil', 'savoy', 'haute-savoie'],
    ['Évian-les-Bains', 46.4009, 6.5877, 'Chablais – Portes du Soleil', 'savoy', 'haute-savoie'],
    ['Chambéry', 45.5646, 5.9178, 'Chambéry – Bauges', 'savoy', 'savoie'],
    ['Aix-les-Bains', 45.6886, 5.9151, 'Chambéry – Bauges', 'savoy', 'savoie'],
    ['Albertville', 45.6754, 6.3925, 'Beaufortain', 'savoy', 'savoie'],
    ['Beaufort / Beaufortain', 45.7192, 6.5735, 'Beaufortain', 'savoy', 'savoie'],
    ['Bourg-Saint-Maurice', 45.6180, 6.7690, 'Tarentaise – Vanoise', 'savoy', 'savoie'],
    ['Val d\'Isère', 45.4489, 6.9797, 'Tarentaise – Vanoise', 'savoy', 'savoie'],
    ['Tignes', 45.4685, 6.9060, 'Tarentaise – Vanoise', 'savoy', 'savoie'],
    ['Courchevel', 45.4154, 6.6340, 'Tarentaise – Vanoise', 'savoy', 'savoie'],
    ['La Plagne', 45.5073, 6.6765, 'Tarentaise – Vanoise', 'savoy', 'savoie'],
    ['Méribel', 45.3966, 6.5654, 'Tarentaise – Vanoise', 'savoy', 'savoie'],
    ['Pralognan-la-Vanoise', 45.3810, 6.7220, 'Tarentaise – Vanoise', 'savoy', 'savoie'],
    ['Modane / Maurienne', 45.2016, 6.6580, 'Maurienne', 'savoy', 'savoie'],
    ['Valloire', 45.1650, 6.4300, 'Maurienne', 'savoy', 'savoie'],
    ['Saint-Jean-de-Maurienne', 45.2760, 6.3460, 'Maurienne', 'savoy', 'savoie'],
    ['Vallorcine', 46.0340, 6.9325, 'Chamonix – Mont Blanc', 'savoy', 'haute-savoie'],
    ['La Chapelle-d\'Abondance', 46.2957, 6.7883, 'Chablais – Portes du Soleil', 'savoy', 'haute-savoie'],
    ['Habère-Poche', 46.2486, 6.4735, 'Chablais – Portes du Soleil', 'savoy', 'haute-savoie'],
    ['Valmorel / Les Avanchers', 45.4782, 6.4562, 'Tarentaise – Vanoise', 'savoy', 'savoie'],
    ['Saint-Martin-de-Belleville', 45.3798, 6.5046, 'Tarentaise – Vanoise', 'savoy', 'savoie'],
    ['Les Échelles / Chartreuse', 45.4359, 5.7546, 'Chambéry – Bauges', 'savoy', 'savoie'],
    ['Val Thorens', 45.2979, 6.5823, 'Tarentaise – Vanoise', 'savoy', 'savoie'],
    // ---- Lombardy ----
    ['Sondrio', 46.1699, 9.8715, 'Valtellina', 'lombardy', 'sondrio'],
    ['Morbegno', 46.1356, 9.5714, 'Valtellina', 'lombardy', 'sondrio'],
    ['Val Masino', 46.2430, 9.6380, 'Valtellina', 'lombardy', 'sondrio'],
    ['Teglio', 46.1717, 10.0640, 'Valtellina', 'lombardy', 'sondrio'],
    ['Tirano', 46.2160, 10.1690, 'Valtellina', 'lombardy', 'sondrio'],
    ['Aprica', 46.1540, 10.1500, 'Valtellina', 'lombardy', 'sondrio'],
    ['Chiesa in Valmalenco', 46.2667, 9.8500, 'Valmalenco', 'lombardy', 'sondrio'],
    ['Bormio', 46.4669, 10.3705, 'Bormio – Livigno', 'lombardy', 'sondrio'],
    ['Valdidentro', 46.4980, 10.2600, 'Bormio – Livigno', 'lombardy', 'sondrio'],
    ['Santa Caterina Valfurva', 46.4120, 10.4950, 'Bormio – Livigno', 'lombardy', 'sondrio'],
    ['Livigno', 46.5386, 10.1357, 'Bormio – Livigno', 'lombardy', 'sondrio'],
    ['Chiavenna', 46.3195, 9.4010, 'Valchiavenna', 'lombardy', 'sondrio'],
    ['Madesimo', 46.4400, 9.3570, 'Valchiavenna', 'lombardy', 'sondrio'],
    ['Villa di Chiavenna', 46.3310, 9.4800, 'Valchiavenna', 'lombardy', 'sondrio'],
    ['Como', 45.8081, 9.0852, 'Lake Como', 'lombardy', 'como'],
    ['Brunate', 45.8193, 9.0960, 'Lake Como', 'lombardy', 'como'],
    ['Nesso', 45.9116, 9.1557, 'Lake Como', 'lombardy', 'como'],
    ['Canzo / Triangolo Lariano', 45.8481, 9.2722, 'Lake Como', 'lombardy', 'como'],
    ['Bellagio', 45.9870, 9.2610, 'Lake Como', 'lombardy', 'como'],
    ['Menaggio', 46.0200, 9.2390, 'Lake Como', 'lombardy', 'como'],
    ['Dongo / Alto Lario', 46.1230, 9.2810, 'Lake Como', 'lombardy', 'como'],
    ['Lecco', 45.8566, 9.3977, 'Lake Como – Grigne', 'lombardy', 'lecco'],
    ['Mandello del Lario', 45.9170, 9.3190, 'Lake Como – Grigne', 'lombardy', 'lecco'],
    ['Varenna', 46.0100, 9.2840, 'Lake Como – Grigne', 'lombardy', 'lecco'],
    ['Pasturo / Valsassina', 45.9520, 9.4430, 'Lake Como – Grigne', 'lombardy', 'lecco'],
    ['Colico', 46.1360, 9.3720, 'Lake Como – Grigne', 'lombardy', 'lecco'],
    ['Darfo Boario Terme', 45.8800, 10.1820, 'Val Camonica', 'lombardy', 'brescia'],
    ['Breno', 45.9570, 10.3040, 'Val Camonica', 'lombardy', 'brescia'],
    ['Capo di Ponte', 46.0310, 10.3450, 'Val Camonica', 'lombardy', 'brescia'],
    ['Edolo', 46.1780, 10.3330, 'Val Camonica', 'lombardy', 'brescia'],
    ['Ponte di Legno', 46.2590, 10.5100, 'Val Camonica', 'lombardy', 'brescia'],
    // ---- Friuli Venezia Giulia ----
    // Carnia, Sappada, the Tarvisio and Julian Alps valleys, the Friulian
    // Dolomites and Piancavallo.
    ['Sappada', 46.5667, 12.6847, 'Sappada', 'friuli', 'udine'],
    ['Sorgenti del Piave (Sappada)', 46.6100, 12.7120, 'Sappada', 'friuli', 'udine'],
    ['Forni di Sopra', 46.4236, 12.5839, 'Dolomiti Friulane', 'friuli', 'udine'],
    ['Forni di Sotto', 46.3929, 12.6716, 'Dolomiti Friulane', 'friuli', 'udine'],
    ['Sauris', 46.4665, 12.7080, 'Carnia', 'friuli', 'udine'],
    ['Ampezzo (Carnia)', 46.4168, 12.7966, 'Carnia', 'friuli', 'udine'],
    ['Ovaro / Val Degano', 46.4836, 12.8656, 'Carnia', 'friuli', 'udine'],
    ['Forni Avoltri', 46.5865, 12.7754, 'Carnia', 'friuli', 'udine'],
    ['Ravascletto / Zoncolan', 46.5237, 12.9226, 'Carnia', 'friuli', 'udine'],
    ['Paluzza / Timau', 46.5326, 13.0155, 'Carnia', 'friuli', 'udine'],
    ['Arta Terme', 46.4797, 13.0177, 'Carnia', 'friuli', 'udine'],
    ['Paularo', 46.5310, 13.1186, 'Carnia', 'friuli', 'udine'],
    ['Tolmezzo', 46.4057, 13.0131, 'Carnia', 'friuli', 'udine'],
    ['Pontebba', 46.5058, 13.3060, 'Tarvisio – Alpi Giulie', 'friuli', 'udine'],
    ['Malborghetto-Valbruna', 46.5072, 13.4405, 'Tarvisio – Alpi Giulie', 'friuli', 'udine'],
    ['Tarvisio', 46.5054, 13.5785, 'Tarvisio – Alpi Giulie', 'friuli', 'udine'],
    ['Fusine in Valromana', 46.4794, 13.6655, 'Tarvisio – Alpi Giulie', 'friuli', 'udine'],
    ['Sella Nevea', 46.3893, 13.4752, 'Tarvisio – Alpi Giulie', 'friuli', 'udine'],
    ['Dogna', 46.4482, 13.3155, 'Canal del Ferro – Val Resia', 'friuli', 'udine'],
    ['Chiusaforte / Canal del Ferro', 46.4073, 13.3089, 'Canal del Ferro – Val Resia', 'friuli', 'udine'],
    ['Moggio Udinese', 46.4090, 13.1993, 'Canal del Ferro – Val Resia', 'friuli', 'udine'],
    ['Resia / Val Resia', 46.3741, 13.3050, 'Canal del Ferro – Val Resia', 'friuli', 'udine'],
    ['Venzone', 46.3326, 13.1383, 'Gemonese – Prealpi Giulie', 'friuli', 'udine'],
    ['Gemona del Friuli', 46.2757, 13.1385, 'Gemonese – Prealpi Giulie', 'friuli', 'udine'],
    ['Claut / Valcellina', 46.2690, 12.5140, 'Dolomiti Friulane', 'friuli', 'pordenone'],
    ['Cimolais', 46.2884, 12.4382, 'Dolomiti Friulane', 'friuli', 'pordenone'],
    ['Erto e Casso', 46.2755, 12.3713, 'Dolomiti Friulane', 'friuli', 'pordenone'],
    // Piancavallo stays in the Dolomites region: its curated loop is part of the
    // Dolomites lake-loops collection, and a collection holds one region.
    ['Barcis', 46.1908, 12.5605, 'Valcellina – Piancavallo', 'dolomites', 'pordenone'],
    ['Piancavallo', 46.1060, 12.5230, 'Valcellina – Piancavallo', 'dolomites', 'pordenone'],
    // ---- Tyrol & Carinthia (Austria) ----
    ['Lienz', 46.8299, 12.7681, 'Lienz – Lienz Dolomites', 'tyrol', 'osttirol'],
    ['Tristach', 46.8171, 12.7881, 'Lienz – Lienz Dolomites', 'tyrol', 'osttirol'],
    ['Dölsach', 46.8257, 12.8410, 'Lienz – Lienz Dolomites', 'tyrol', 'osttirol'],
    ['Nußdorf-Debant', 46.8370, 12.7900, 'Lienz – Lienz Dolomites', 'tyrol', 'osttirol'],
    ['Ainet', 46.8661, 12.6902, 'Iseltal', 'tyrol', 'osttirol'],
    ['Assling', 46.7862, 12.6399, 'Hochpustertal', 'tyrol', 'osttirol'],
    ['Anras', 46.7724, 12.5562, 'Hochpustertal', 'tyrol', 'osttirol'],
    ['Strassen', 46.7505, 12.4871, 'Hochpustertal', 'tyrol', 'osttirol'],
    ['Sillian', 46.7473, 12.4180, 'Hochpustertal', 'tyrol', 'osttirol'],
    ['Innervillgraten', 46.8078, 12.3721, 'Villgratental', 'tyrol', 'osttirol'],
    ['Außervillgraten', 46.7865, 12.4291, 'Villgratental', 'tyrol', 'osttirol'],
    ['Kartitsch', 46.7254, 12.4975, 'Tiroler Gailtal', 'tyrol', 'osttirol'],
    ['Obertilliach', 46.7100, 12.6147, 'Tiroler Gailtal', 'tyrol', 'osttirol'],
    ['St. Jakob in Defereggen', 46.9178, 12.3313, 'Defereggental', 'tyrol', 'osttirol'],
    ['Staller Sattel / Obersee', 46.8960, 12.2090, 'Defereggental', 'tyrol', 'osttirol'],
    ['St. Veit in Defereggen', 46.9248, 12.4236, 'Defereggental', 'tyrol', 'osttirol'],
    ['Hopfgarten in Defereggen', 46.9218, 12.5209, 'Defereggental', 'tyrol', 'osttirol'],
    ['Matrei in Osttirol', 47.0011, 12.5387, 'Matrei – Tauerntal', 'tyrol', 'osttirol'],
    ['Virgen', 46.9995, 12.4305, 'Virgental', 'tyrol', 'osttirol'],
    ['Prägraten am Großvenediger', 47.0168, 12.3786, 'Virgental', 'tyrol', 'osttirol'],
    ['Kals am Großglockner', 47.0024, 12.6458, 'Kals am Großglockner', 'tyrol', 'osttirol'],
    ['Maria Luggau / Lesachtal', 46.7056, 12.7348, 'Lesachtal', 'tyrol', 'hermagor'],
    ['Liesing / Lesachtal', 46.6923, 12.8180, 'Lesachtal', 'tyrol', 'hermagor'],
    ['Kötschach-Mauthen', 46.6617, 12.9712, 'Gailtal', 'tyrol', 'hermagor'],
    ['Sonnenalpe Nassfeld', 46.5639, 13.2745, 'Gailtal – Nassfeld', 'tyrol', 'hermagor'],
    ['Hermagor', 46.6268, 13.3702, 'Gailtal', 'tyrol', 'hermagor'],
    ['Techendorf / Weissensee', 46.7140, 13.2950, 'Weissensee', 'tyrol', 'spittal'],
    ['Neusach / Weissensee', 46.7085, 13.3480, 'Weissensee', 'tyrol', 'spittal'],

    // ---- Valle d'Aosta ----
    // Courmayeur and Chamonix are 15 km apart through the Mont Blanc tunnel,
    // so both sides need listing or a walk above Courmayeur is called Savoy.
    ['Courmayeur', 45.7967, 6.9690, 'Courmayeur – Mont Blanc', 'aosta', 'aosta'],
    ['La Thuile', 45.7139, 6.9500, 'Courmayeur – Mont Blanc', 'aosta', 'aosta'],
    ['Morgex / La Salle', 45.7570, 7.0380, 'Courmayeur – Mont Blanc', 'aosta', 'aosta'],
    ['Aosta', 45.7372, 7.3206, 'Aosta – Plaine', 'aosta', 'aosta'],
    ['Cogne', 45.6085, 7.3567, 'Cogne – Gran Paradiso', 'aosta', 'aosta'],
    ['Valsavarenche', 45.5920, 7.2100, 'Cogne – Gran Paradiso', 'aosta', 'aosta'],
    ['Rhêmes-Notre-Dame', 45.5700, 7.1180, 'Valgrisenche – Rhêmes', 'aosta', 'aosta'],
    ['Valgrisenche', 45.6300, 7.0640, 'Valgrisenche – Rhêmes', 'aosta', 'aosta'],
    ['Valtournenche', 45.8760, 7.6230, 'Valtournenche – Cervinia', 'aosta', 'aosta'],
    ['Breuil-Cervinia', 45.9330, 7.6300, 'Valtournenche – Cervinia', 'aosta', 'aosta'],
    ['Champoluc (Ayas)', 45.8300, 7.7270, 'Ayas – Gressoney', 'aosta', 'aosta'],
    ['Gressoney-Saint-Jean', 45.7760, 7.8260, 'Ayas – Gressoney', 'aosta', 'aosta'],
    ['Gressoney-La-Trinité', 45.8290, 7.8240, 'Ayas – Gressoney', 'aosta', 'aosta']
  ];

  const REGIONS = {
    dolomites: { label: 'Dolomites', country: 'Italy', countryCode: 'IT' },
    savoy: { label: 'Savoy', country: 'France', countryCode: 'FR' },
    lombardy: { label: 'Lombardy', country: 'Italy', countryCode: 'IT' },
    friuli: { label: 'Friuli Venezia Giulia', country: 'Italy', countryCode: 'IT' },
    aosta: { label: 'Valle d\'Aosta', country: 'Italy', countryCode: 'IT' },
    tyrol: { label: 'Tyrol & Carinthia', country: 'Austria', countryCode: 'AT' }
  };

  function countryForRegion(region) {
    return REGIONS[region] ? REGIONS[region].countryCode : null;
  }

  function regionForCountry(countryCode) {
    return Object.keys(REGIONS).find(region => REGIONS[region].countryCode === countryCode) || null;
  }

  const VALLEY_PROVINCE = new Map();
  for (const [, , , valley, , province] of LOCALITIES) {
    if (province && !VALLEY_PROVINCE.has(valley)) {
      VALLEY_PROVINCE.set(valley, province);
    }
  }

  function provinceFromTrail(trail) {
    if (!trail || !trail.valley) return null;
    return VALLEY_PROVINCE.get(trail.valley) || null;
  }

  function kmBetween(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const s = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  // Returns the nearest locality AND how far away it is. The distance is the
  // part that matters: this lookup has no cap, so when the table does not cover
  // a valley it still answers, with whatever town happens to be closest. That
  // is how a trail at Naturns came to be labelled Bolzano, 31 km away.
  // locality-coverage.test.js asserts the distance stays small.
  function nearestLocality(lat, lng) {
    let best = null;
    let bestD = Infinity;
    for (const [name, la, ln, valley, region, province] of LOCALITIES) {
      const d = kmBetween(lat, lng, la, ln);
      if (d < bestD) {
        bestD = d;
        best = { name, valley, region, province: province || null, km: d };
      }
    }
    return best;
  }

  function nearest(lat, lng) {
    return nearestLocality(lat, lng);
  }

  function assign(list) {
    if (!Array.isArray(list)) return;
    for (const t of list) {
      if (!t.province) {
        const inferredProvince = provinceFromTrail(t);
        if (inferredProvince) t.province = inferredProvince;
      }
      if (t.region && t.valley && t.province) continue;
      if (t.region && t.valley) continue;
      if (typeof t.lat !== 'number' || typeof t.lng !== 'number') {
        t.region = t.region || 'dolomites'; // safe default for coordinate-less entries
        t.valley = t.valley || 'Other';
        continue;
      }
      const n = nearest(t.lat, t.lng);
      t.region = t.region || n.region;
      t.valley = t.valley || n.valley;
      if (!t.province && n.province) t.province = n.province;
      if (!t.area) t.area = n.name;
    }
  }

  function valleysFor(list, region, province) {
    const counts = new Map();
    for (const t of list) {
      if (t.region !== region) continue;
      if (province && province !== 'all' && t.province !== province) continue;
      counts.set(t.valley, (counts.get(t.valley) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }

  function provincesFor(list, region) {
    const counts = new Map();
    for (const t of list) {
      if (t.region !== region || !t.province) continue;
      counts.set(t.province, (counts.get(t.province) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }

  window.DoloPawsRegions = {
    REGIONS,
    // The import pipeline used to carry its own copy of this table. The two
    // drifted, so a trail could be given an `area` from one list and a `valley`
    // from the other, naming different places. This is now the only copy.
    LOCALITIES,
    nearestLocality,
    assign,
    valleysFor,
    provincesFor,
    countryForRegion,
    regionForCountry
  };
})();
