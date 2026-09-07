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
    ['Auronzo di Cadore', 46.5527, 12.4419, 'Alta Pusteria – Tre Cime', 'dolomites', 'belluno'],
    ['Alpe di Siusi / Seiser Alm', 46.5402, 11.6181, 'Alpe di Siusi – Sciliar', 'dolomites', 'alto-adige'],
    ['Castelrotto / Kastelruth', 46.5670, 11.5599, 'Alpe di Siusi – Sciliar', 'dolomites', 'alto-adige'],
    ['Val di Funes / Villnöss', 46.6440, 11.6810, 'Val di Funes – Odle', 'dolomites', 'alto-adige'],
    ['Bressanone / Brixen', 46.7151, 11.6570, 'Valle Isarco – Eisacktal', 'dolomites', 'alto-adige'],
    ['Nova Levante / Carezza', 46.4300, 11.5380, 'Val di Fiemme – Latemar', 'dolomites', 'alto-adige'],
    ['Predazzo / Val di Fiemme', 46.3110, 11.6010, 'Val di Fiemme – Latemar', 'dolomites', 'trentino'],
    ['Cavalese', 46.2910, 11.4600, 'Val di Fiemme – Latemar', 'dolomites', 'trentino'],
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
    ['Valles / Vals', 46.8698, 11.6202, 'Valle Isarco – Eisacktal', 'dolomites', 'alto-adige'],
    ['San Martino in Badia / St. Martin', 46.6509, 11.8417, 'Val Badia', 'dolomites', 'alto-adige'],
    ['Andalo', 46.1617, 11.0076, 'Paganella', 'dolomites', 'trentino'],
    ['Fai della Paganella', 46.1793, 11.0689, 'Paganella', 'dolomites', 'trentino'],
    ['Baselga di Piné', 46.1313, 11.2568, 'Valsugana', 'dolomites', 'trentino'],
    ['Pieve Tesino', 46.1986, 11.5441, 'Valsugana', 'dolomites', 'trentino'],
    ['Tambre / Alpago', 46.0973, 12.4389, 'Alpago', 'dolomites', 'belluno'],

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
    ['Val Thorens', 45.2979, 6.5823, 'Tarentaise – Vanoise', 'savoy', 'savoie']
  ];

  const REGIONS = {
    dolomites: { label: 'Dolomites', country: 'Italy', countryCode: 'IT' },
    savoy: { label: 'Savoy', country: 'France', countryCode: 'FR' }
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
