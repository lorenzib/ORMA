const care = require('./veterinary-care.js');

describe('ORMA compact veterinary care', () => {
  test('queries only mapped veterinary facilities around the trail start', () => {
    const query = care.buildQuery({ lat:46.54, lng:11.72 });
    expect(query).toContain('nwr["amenity"="veterinary"]');
    expect(query).toContain('(around:30000,46.54,11.72)');
    expect(query).toContain('out center 50');
    expect(query).not.toContain('phone');
    expect(query).not.toContain('opening_hours');
  });

  test('normalizes nodes, ways and relations, distance-ranks, and limits to three', () => {
    const origin = { lat:46, lng:11 };
    const results = care.normalizeResults([
      { type:'node', id:1, lat:46.3, lon:11, tags:{ name:'Far', phone:'do not render' } },
      { type:'way', id:2, center:{ lat:46.1, lon:11 }, tags:{ name:'Near', 'addr:street':'Via Roma', 'addr:housenumber':'2' } },
      { type:'relation', id:3, center:{ lat:46.2, lon:11 }, tags:{ website:'https://clinic.example/' } },
      { type:'node', id:4, lat:46.4, lon:11, tags:{ name:'Fourth' } },
      { type:'way', id:5, tags:{ name:'No coordinates' } },
    ], origin);

    expect(results).toHaveLength(3);
    expect(results.map(result => result.id)).toEqual(['way/2', 'relation/3', 'node/1']);
    expect(results[0].address).toBe('Via Roma 2');
    expect(results[1].name).toBe('Mapped veterinary facility');
    expect(results[1].website).toBe('https://clinic.example/');
    expect(JSON.stringify(results)).not.toContain('phone');
  });

  test('rejects unsafe website schemes and uses trail start without geolocation', () => {
    expect(care.safeWebsite('javascript:alert(1)')).toBe('');
    expect(care.safeWebsite('https://example.com')).toBe('https://example.com/');
    expect(care.trailStart({ path:[[46.6, 11.7], [46.7, 11.8]] })).toEqual({ lat:46.6, lng:11.7 });
  });

  test('fails over between Overpass mirrors and caches location metadata', async () => {
    const storage = { value:null, getItem(){ return this.value; }, setItem(key, value){ this.value = value; } };
    const fetchImpl = jest.fn()
      .mockResolvedValueOnce({ ok:false, status:503 })
      .mockResolvedValueOnce({ ok:true, json:async () => ({ elements:[{ type:'node', id:8, lat:46.1, lon:11.1, tags:{ name:'Clinic' } }] }) });
    const point = { lat:46, lng:11 };
    const first = await care.fetchFacilities(point, { fetchImpl, storage, now:1000 });
    const second = await care.fetchFacilities(point, { fetchImpl, storage, now:2000 });

    expect(first).toHaveLength(1);
    expect(second).toEqual(first);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(storage.value).toContain('retrievedAt');
  });

  test('trail markup retains FNOVI as fallback and avoids unsafe care claims', () => {
    const fs = require('fs');
    const html = fs.readFileSync(require('path').join(__dirname, 'trail.html'), 'utf8');
    expect(html).toContain('id="vetCareButton"');
    expect(html).toContain('id="vetCareDialog"');
    expect(html).toContain('Verify or search more on FNOVI');
    expect(html).not.toMatch(/open now|verified available|24\/7 veterinary/i);
  });
});
