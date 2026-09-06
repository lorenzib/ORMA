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
    ['Bressanone / Brixen', 46.7151, 11.6570, 'Val di Funes – Odle', 'dolomites', 'alto-adige'],
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
    ['Bolzano / Bozen', 46.4983, 11.3548, 'Val di Fiemme – Latemar', 'dolomites', 'alto-adige'],
    ['Brunico / Bruneck', 46.7966, 11.9376, 'Alta Pusteria – Tre Cime', 'dolomites', 'alto-adige'],
    ['Vipiteno / Sterzing', 46.8977, 11.4331, 'Val di Funes – Odle', 'dolomites', 'alto-adige'],
    ['Madonna di Campiglio', 46.2295, 10.8269, 'Brenta', 'dolomites', 'trentino'],

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
    ['Saint-Jean-de-Maurienne', 45.2760, 6.3460, 'Maurienne', 'savoy', 'savoie']
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

  function nearest(lat, lng) {
    let best = null;
    let bestD = Infinity;
    for (const [name, la, ln, valley, region, province] of LOCALITIES) {
      // Squared equirectangular distance, plenty for nearest-of-56 lookups.
      const dLat = lat - la;
      const dLng = (lng - ln) * Math.cos((lat * Math.PI) / 180);
      const d = dLat * dLat + dLng * dLng;
      if (d < bestD) { bestD = d; best = { name, valley, region, province: province || null }; }
    }
    return best;
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
    assign,
    valleysFor,
    provincesFor,
    countryForRegion,
    regionForCountry
  };
})();
