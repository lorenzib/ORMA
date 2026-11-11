/**
 * @jest-environment node
 */
// Node, not jsdom: phones have TextEncoder and DecompressionStream; jsdom has neither.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
require('./walk-proof.js');
const files = require('./gpx-walk.js');

const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');
const fixture = name => new Uint8Array(fs.readFileSync(path.join(__dirname, 'test-support/walk-files', name)));

// The same 3 km trail as gpx-walk.test.js, running east from 46.5, 11.7.
const KM_LNG = 1 / (111.32 * Math.cos(46.5 * Math.PI / 180));
const line = (lat, lng0, km) => Array.from({ length: km * 10 + 1 }, (_, i) => [lat, lng0 + i * 0.1 * KM_LNG]);
const TRAILS = [
  { id: 'ridge', name: 'Ridge walk', valley: 'Val Gardena', path: line(46.5, 11.7, 3), distance: 3 },
  { id: 'far', name: 'Far away', valley: 'Val di Fassa', path: line(46.4, 11.8, 2), distance: 2 },
];
const START = Date.parse('2026-11-01T09:00:00Z');
const NOW = Date.parse('2026-11-10T12:00:00Z');

// Fixes every 20 m along the ridge at `kmh`.
function fixes(kmh, count){
  const n = count || 151;
  return Array.from({ length: n }, (_, i) => ({
    lat: 46.50005, lng: 11.7 + i * 0.02 * KM_LNG, t: START + i * (0.02 / kmh) * 3600000,
  }));
}

// ---- A small FIT writer, following the FIT protocol, for the cases Garmin's
// SDK does not write: big-endian messages, compressed timestamps, developer
// fields and two files chained together.
const FIT_EPOCH_S = 631065600;
const semi = d => Math.round(d * 2147483648 / 180);
function fitFile(points, opts){
  const o = opts || {};
  const little = !o.bigEndian;
  const out = [];
  const u8 = v => out.push(v & 0xFF);
  const u16 = v => little ? (u8(v), u8(v >> 8)) : (u8(v >> 8), u8(v));
  const u32 = v => {
    const b = [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF];
    (little ? b : b.reverse()).forEach(u8);
  };
  const define = (local, global, fields, dev) => {
    u8(0x40 | (dev ? 0x20 : 0) | local); u8(0); u8(little ? 0 : 1); u16(global); u8(fields.length);
    fields.forEach(([num, size, base]) => { u8(num); u8(size); u8(base); });
    if(dev){ u8(1); u8(0); u8(dev); u8(0); }
  };
  // file_id: type (field 0, 1 byte)
  define(0, 0, [[0, 1, 0]]);
  u8(0); u8(o.type || 4);
  // record with a full timestamp; local 1
  define(1, 20, [[253, 4, 0x86], [0, 4, 0x85], [1, 4, 0x85]], o.devBytes);
  // record without a timestamp, for compressed headers; local 2
  define(2, 20, [[0, 4, 0x85], [1, 4, 0x85]]);
  points.forEach((p, i) => {
    const s = Math.round(p.t / 1000) - FIT_EPOCH_S;
    const lat = p.lat === null ? 0x7FFFFFFF : semi(p.lat);
    const lng = p.lng === null ? 0x7FFFFFFF : semi(p.lng);
    if(o.compressed && i > 0 && i % 4 !== 0){
      u8(0x80 | (2 << 5) | (s & 0x1F)); u32(lat); u32(lng);
    } else {
      u8(1); u32(s); u32(lat); u32(lng);
      if(o.devBytes) for(let k = 0; k < o.devBytes; k++) u8(0xAB);
    }
  });
  const data = Uint8Array.from(out);
  const header = new Uint8Array(14);
  header[0] = 14; header[1] = 0x20;
  new DataView(header.buffer).setUint16(2, 2100, true);
  new DataView(header.buffer).setUint32(4, data.length, true);
  header.set([0x2E, 0x46, 0x49, 0x54], 8);
  const all = new Uint8Array(14 + data.length + 2);
  all.set(header); all.set(data, 14);
  return all;
}

function tcx(points, opts){
  const o = opts || {};
  const tp = points.map(p => `<Trackpoint>${o.noTimes ? '' : `<Time>${new Date(p.t).toISOString()}</Time>`}` +
    (p.lat === null ? '' : `<Position><LatitudeDegrees>${p.lat}</LatitudeDegrees><LongitudeDegrees>${p.lng}</LongitudeDegrees></Position>`) +
    '<AltitudeMeters>1500</AltitudeMeters></Trackpoint>').join('\n');
  const body = o.course
    ? `<Courses><Course><Name>Ridge</Name><Track>${tp}</Track></Course></Courses>`
    : `<Activities><Activity Sport="Other"><Id>${new Date(START).toISOString()}</Id><Lap StartTime="${new Date(START).toISOString()}"><Track>${tp}</Track></Lap></Activity></Activities>`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">${body}</TrainingCenterDatabase>`;
}

describe('SOCIAL-06 walks from FIT files', () => {
  test('a walk written by Garmin’s own FIT SDK is read and earns a stamp', () => {
    const parsed = files.readWalkFile(fixture('ridge-walk-garmin.fit'));
    expect(parsed.points).toHaveLength(151);
    expect(parsed.points[0].t).toBe(START);
    expect(parsed.points[0].lat).toBeCloseTo(46.50005, 6);
    expect(parsed.points[0].lng).toBeCloseTo(11.7, 6);
    const r = files.assessFile(fixture('ridge-walk-garmin.fit'), TRAILS, { now: NOW });
    expect(r).toMatchObject({ ok: true, proven: true, reason: 'proven', km: 3, minutes: 45 });
    expect(r.trail.id).toBe('ridge');
    expect(files.buildEntry(r, { id: 'w1', now: NOW }).proof).toBe('gpx');
  });

  test('a course made for the watch to follow is a plan, not a walk', () => {
    expect(files.assessFile(fixture('ridge-course-garmin.fit'), TRAILS, { now: NOW }))
      .toMatchObject({ ok: false, reason: 'a-plan', proven: false });
  });

  test('a recording with no GPS (a treadmill, GPS switched off) says so', () => {
    expect(files.assessFile(fixture('treadmill-no-gps-garmin.fit'), TRAILS, { now: NOW }))
      .toMatchObject({ ok: false, reason: 'no-gps' });
  });

  test('big-endian messages, compressed times and developer fields read the same', () => {
    const plain = files.parseFit(fitFile(fixes(4))).points;
    expect(plain).toHaveLength(151);
    [{ bigEndian: true }, { compressed: true }, { devBytes: 3 }, { bigEndian: true, compressed: true, devBytes: 2 }].forEach(opts => {
      const pts = files.parseFit(fitFile(fixes(4), opts)).points;
      expect(pts).toHaveLength(151);
      pts.forEach((p, i) => {
        expect(p.t).toBe(plain[i].t);
        expect(p.lat).toBeCloseTo(plain[i].lat, 7);
        expect(p.lng).toBeCloseTo(plain[i].lng, 7);
      });
    });
  });

  test('two files chained together are read as one walk', () => {
    const all = fixes(4);
    const a = fitFile(all.slice(0, 80)), b = fitFile(all.slice(80));
    const chained = new Uint8Array(a.length + b.length);
    chained.set(a); chained.set(b, a.length);
    expect(files.parseFit(chained).points).toHaveLength(151);
    expect(files.assessFile(chained, TRAILS, { now: NOW }).proven).toBe(true);
  });

  test('a ride on the watch is still too fast; fixes with no position are left out', () => {
    expect(files.assessFile(fitFile(fixes(25)), TRAILS, { now: NOW }).reason).toBe('too-fast');
    const gappy = fixes(4).map((p, i) => i % 10 === 5 ? { ...p, lat: null, lng: null } : p);
    const parsed = files.parseFit(fitFile(gappy));
    expect(parsed.points).toHaveLength(136);
    expect(parsed.noPosition).toBe(15);
  });

  test('a cut-off or broken file does not crash', () => {
    const full = fixture('ridge-walk-garmin.fit');
    expect(() => files.assessFile(full.slice(0, 600), TRAILS, { now: NOW })).not.toThrow();
    const cut = files.assessFile(full.slice(0, 600), TRAILS, { now: NOW });
    expect(cut).toMatchObject({ ok: false, reason: 'no-trail' }); // the first 0.7 km of 3 km
    expect(cut.km).toBeLessThan(1);
    expect(files.assessFile(full.slice(0, 200), TRAILS, { now: NOW }).reason).toBe('too-few-points');
    const junk = full.slice();
    junk.fill(0x41, 14, 40); // the first definitions overwritten
    expect(files.assessFile(junk, TRAILS, { now: NOW })).toMatchObject({ ok: false, reason: 'not-gpx' });
    expect(files.assessFile(new Uint8Array([1, 2, 3]), TRAILS, { now: NOW }).reason).toBe('not-gpx');
  });
});

describe('SOCIAL-06 walks from TCX files', () => {
  test('a recorded TCX activity is matched and earns a stamp', () => {
    const r = files.assessFile(tcx(fixes(4)), TRAILS, { now: NOW });
    expect(r).toMatchObject({ ok: true, proven: true, km: 3, minutes: 45 });
    expect(r.trail.id).toBe('ridge');
  });

  test('a TCX course is a plan; untimed points and no positions say so', () => {
    expect(files.assessFile(tcx(fixes(4), { course: true }), TRAILS, { now: NOW }).reason).toBe('a-plan');
    expect(files.assessFile(tcx(fixes(4), { noTimes: true }), TRAILS, { now: NOW }).reason).toBe('no-times');
    expect(files.assessFile(tcx(fixes(4).map(p => ({ ...p, lat: null }))), TRAILS, { now: NOW }).reason).toBe('no-gps');
  });

  test('the file is recognised by what is in it, as bytes or text, not by its name', () => {
    const asBytes = new TextEncoder().encode(tcx(fixes(4)));
    expect(files.assessFile(asBytes, TRAILS, { now: NOW }).proven).toBe(true);
    const gpx = `<?xml version="1.0"?><gpx version="1.1"><trk><trkseg>${fixes(4).map(p =>
      `<trkpt lat="${p.lat}" lon="${p.lng}"><time>${new Date(p.t).toISOString()}</time></trkpt>`).join('')}</trkseg></trk></gpx>`;
    expect(files.assessFile(new TextEncoder().encode(gpx), TRAILS, { now: NOW }).proven).toBe(true);
    expect(files.assessFile(gpx, TRAILS, { now: NOW }).proven).toBe(true);
    expect(files.assessFile('just some text', TRAILS, { now: NOW }).reason).toBe('not-gpx');
  });
});

describe('SOCIAL-06 gzipped exports and the journal', () => {
  test('a gzipped file (Strava’s bulk export) is unzipped first; other files pass through', async () => {
    const zipped = new Uint8Array(zlib.gzipSync(Buffer.from(fixture('ridge-walk-garmin.fit'))));
    const unzipped = await files.gunzip(zipped);
    expect(files.assessFile(unzipped, TRAILS, { now: NOW }).proven).toBe(true);
    const plain = fixture('ridge-walk-garmin.fit');
    expect(await files.gunzip(plain)).toBe(plain);
  });

  test('the journal accepts the three kinds and reads the file as bytes', () => {
    const page = read('journal.html');
    expect(page).toMatch(/id="jnGpxInput" accept="\.gpx,\.fit,\.tcx,\.gz/);
    expect(page).toContain('file.arrayBuffer()');
    expect(page).toContain('gpx.gunzip(new Uint8Array(buffer))');
    expect(page).toContain('gpx.assessFile(bytes, allTrails(), { now: Date.now() })');
    expect(page).toContain("result.reason === 'a-plan'");
    expect(page).toContain("result.reason === 'no-gps'");
  });

  test('the new messages exist in English and Italian', () => {
    const i18n = read('i18n.js');
    ['journal.gpx.plan', 'journal.gpx.noGps'].forEach(key => expect(i18n.split(`'${key}':`).length - 1).toBe(2));
  });
});
