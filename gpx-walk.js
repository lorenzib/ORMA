(function(root){
  'use strict';

  // SOCIAL-06 — add a walk from a GPX file. For the walk recorded on a watch,
  // Strava or Komoot because nobody pressed Start in ORMA. The file is read on
  // the phone, matched to the ORMA trail it follows, and judged by the same
  // check hike mode uses (walk-proof.js): most of the trail's line walked, in
  // one go, at a walking pace. A walk that passes is marked `proof: 'gpx'`,
  // which earns a passport stamp just like a recording made in ORMA.
  //
  // A file needs a time on its points. A route planned on a map has none, and
  // a plan is not a walk. Like hike mode, these checks run on the phone, so
  // they stop honest mistakes and casual claims, not a forged file.
  //
  // No DOM, no Firebase, no clock of its own (`now` is passed in).

  var MAX_FILE_CHARS = 15 * 1024 * 1024; // far past a day's walking
  var MIN_POINTS = 20;
  var THIN_M = 8;               // points closer than this to the last kept add nothing
  var MAX_POINTS = 6000;
  var MAX_SAVED_POINTS = 1500;  // what the journal keeps of the line
  var CANDIDATE_MARGIN_M = 300; // a trail is considered when its box is this near the track's
  var MIN_SHOWN_SHARE = 0.3;    // below this a trail is not "the one you walked"
  var DUPLICATE_MS = 30 * 60 * 1000;

  function proofApi(){ return root.DoloPawsWalkProof || null; }

  // ---- Reading the file ------------------------------------------------------

  function attr(tag, name){
    var m = new RegExp('\\b' + name + '\\s*=\\s*["\']([^"\']+)["\']', 'i').exec(tag);
    return m ? Number(m[1]) : NaN;
  }

  // Track points only (<trkpt>): <rtept> and <wpt> are plans and places, not
  // where somebody walked. Returns { points:[{lat,lng,t}], timed, name }.
  function parseGpx(text){
    var source = typeof text === 'string' ? text : '';
    if(!source || source.length > MAX_FILE_CHARS) return { points: [], timed: false, name: '', error: 'not-gpx' };
    if(!/<gpx[\s>]/i.test(source)) return { points: [], timed: false, name: '', error: 'not-gpx' };
    var nameMatch = /<trk>[\s\S]*?<name>([\s\S]*?)<\/name>/i.exec(source) || /<name>([\s\S]*?)<\/name>/i.exec(source);
    var name = nameMatch ? nameMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim().slice(0, 120) : '';
    var points = [];
    var untimed = 0;
    var re = /<trkpt\b([^>]*?)(\/>|>([\s\S]*?)<\/trkpt>)/gi;
    var m;
    while((m = re.exec(source))){
      var lat = attr(m[1], 'lat');
      var lng = attr(m[1], 'lon');
      if(!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
      var timeMatch = m[3] ? /<time>\s*([^<\s]+)\s*<\/time>/i.exec(m[3]) : null;
      var t = timeMatch ? Date.parse(timeMatch[1]) : NaN;
      if(!Number.isFinite(t)){ untimed++; continue; }
      points.push({ lat: lat, lng: lng, t: t });
    }
    points.sort(function(a, b){ return a.t - b.t; });
    return { points: points, timed: points.length > 0, untimed: untimed, name: name, error: null };
  }

  // ---- Geometry --------------------------------------------------------------

  var R = 6371000;
  function rad(d){ return d * Math.PI / 180; }
  function haversine(a, b){
    var dLat = rad(b[0] - a[0]), dLng = rad(b[1] - a[1]);
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function thin(points){
    var kept = [];
    points.forEach(function(p){
      var last = kept[kept.length - 1];
      if(!last || haversine([last.lat, last.lng], [p.lat, p.lng]) >= THIN_M) kept.push(p);
    });
    if(kept.length > 1 && kept[kept.length - 1] !== points[points.length - 1]) kept.push(points[points.length - 1]);
    if(kept.length <= MAX_POINTS) return kept;
    var step = Math.ceil(kept.length / MAX_POINTS);
    return kept.filter(function(p, i){ return i % step === 0 || i === kept.length - 1; });
  }

  function trackKm(points){
    var m = 0;
    for(var i = 1; i < points.length; i++) m += haversine([points[i - 1].lat, points[i - 1].lng], [points[i].lat, points[i].lng]);
    return m / 1000;
  }

  function box(latlngs){
    var b = { minLat: Infinity, maxLat: -Infinity, minLng: Infinity, maxLng: -Infinity };
    latlngs.forEach(function(p){
      if(p[0] < b.minLat) b.minLat = p[0];
      if(p[0] > b.maxLat) b.maxLat = p[0];
      if(p[1] < b.minLng) b.minLng = p[1];
      if(p[1] > b.maxLng) b.maxLng = p[1];
    });
    return b;
  }

  function boxesNear(a, b, marginM){
    var dLat = marginM / 111320;
    var dLng = marginM / (111320 * Math.max(0.2, Math.cos(rad((a.minLat + a.maxLat) / 2))));
    return a.minLat - dLat <= b.maxLat && b.minLat - dLat <= a.maxLat &&
      a.minLng - dLng <= b.maxLng && b.minLng - dLng <= a.maxLng;
  }

  function validPath(path){
    return (Array.isArray(path) ? path : []).filter(function(p){
      return Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]);
    });
  }

  // The trail's line in local metres, with the distance along it at each vertex.
  function prepareLine(path){
    var lat0 = path.reduce(function(s, p){ return s + p[0]; }, 0) / path.length;
    var kx = 111320 * Math.cos(rad(lat0)), ky = 110540;
    var xy = path.map(function(p){ return [p[1] * kx, p[0] * ky]; });
    var cum = [0];
    for(var i = 1; i < path.length; i++) cum.push(cum[i - 1] + haversine(path[i - 1], path[i]));
    return { xy: xy, cum: cum, kx: kx, ky: ky, lengthM: cum[cum.length - 1] };
  }

  // Nearest point of the line to a fix: how far along the line, and how far off it.
  function project(line, lat, lng){
    var px = lng * line.kx, py = lat * line.ky;
    var best = { alongM: 0, distanceM: Infinity };
    for(var i = 1; i < line.xy.length; i++){
      var ax = line.xy[i - 1][0], ay = line.xy[i - 1][1];
      var dx = line.xy[i][0] - ax, dy = line.xy[i][1] - ay;
      var len2 = dx * dx + dy * dy;
      var f = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
      var ex = ax + dx * f - px, ey = ay + dy * f - py;
      var d = Math.sqrt(ex * ex + ey * ey);
      if(d < best.distanceM){
        best = { alongM: line.cum[i - 1] + (line.cum[i] - line.cum[i - 1]) * f, distanceM: d };
      }
    }
    return best;
  }

  // ---- Judging the walk ------------------------------------------------------

  // How much of one trail the track walked, judged exactly as hike mode does.
  function judgeTrail(points, trail){
    var proof = proofApi();
    var path = validPath(trail && trail.path);
    if(!proof || path.length < 2) return null;
    var line = prepareLine(path);
    if(!(line.lengthM > 0)) return null;
    var coverage = proof.createCoverage(line.lengthM);
    points.forEach(function(p){
      coverage = proof.markFix(coverage, project(line, p.lat, p.lng));
    });
    var verdict = proof.assessHike({
      coverage: coverage,
      startedAt: points[0].t,
      completedAt: points[points.length - 1].t,
    });
    return { trail: trail, share: verdict.share, proven: verdict.proof === 'gps', reason: verdict.reason };
  }

  // Read the file and find the ORMA trail it walked.
  // Returns { ok, reason, trail, share, proven, km, minutes, startedAt, completedAt, track }.
  //   reason: 'not-gpx' | 'no-times' | 'too-few-points' | 'in-the-future'
  //           | 'no-trail' | 'too-little-of-the-route' | 'not-one-walk' | 'too-fast' | 'proven'
  function assessGpx(text, trails, options){
    var opts = options || {};
    var now = Number(opts.now) || 0;
    var parsed = parseGpx(text);
    var fail = function(reason, extra){ return Object.assign({ ok: false, reason: reason, proven: false }, extra || {}); };
    if(parsed.error) return fail(parsed.error);
    if(!parsed.timed) return fail(parsed.untimed ? 'no-times' : 'not-gpx');
    var points = thin(parsed.points);
    if(points.length < MIN_POINTS) return fail('too-few-points');
    var startedAt = points[0].t, completedAt = points[points.length - 1].t;
    if(now && completedAt > now + 5 * 60 * 1000) return fail('in-the-future');
    var summary = {
      km: Math.round(trackKm(points) * 10) / 10,
      minutes: Math.max(1, Math.round((completedAt - startedAt) / 60000)),
      startedAt: startedAt,
      completedAt: completedAt,
      name: parsed.name,
      track: savedTrack(points),
    };
    var trackBox = box(points.map(function(p){ return [p.lat, p.lng]; }));
    var best = null;
    (Array.isArray(trails) ? trails : []).forEach(function(trail){
      var path = validPath(trail && trail.path);
      if(!trail || !trail.id || path.length < 2) return;
      if(!boxesNear(trackBox, box(path), CANDIDATE_MARGIN_M)) return;
      var judged = judgeTrail(points, trail);
      if(!judged) return;
      // A proven trail beats an unproven one; then the bigger share; then the
      // longer line (a long loop over a short spur it contains).
      var better = !best ||
        (judged.proven !== best.proven ? judged.proven :
          judged.share !== best.share ? judged.share > best.share :
            validPath(trail.path).length > validPath(best.trail.path).length);
      if(better) best = judged;
    });
    if(!best || best.share < MIN_SHOWN_SHARE) return fail('no-trail', summary);
    return Object.assign({
      ok: true,
      reason: best.reason,
      trail: best.trail,
      share: best.share,
      proven: best.proven,
    }, summary);
  }

  function savedTrack(points){
    var step = Math.max(1, Math.ceil(points.length / MAX_SAVED_POINTS));
    var kept = points.filter(function(p, i){ return i % step === 0 || i === points.length - 1; });
    return kept.map(function(p){ return [p.lat, p.lng]; });
  }

  // Is this walk already in the journal (same trail, started within half an hour)?
  function isDuplicate(result, entries){
    return (Array.isArray(entries) ? entries : []).some(function(e){
      if(!e || !result) return false;
      var sameTrail = result.trail ? e.trailId === result.trail.id : !e.trailId;
      var t = Date.parse(e.date || '');
      return sameTrail && Number.isFinite(t) && Math.abs(t - result.startedAt) < DUPLICATE_MS;
    });
  }

  // The journal entry for an assessed file. `stamp` is false when the walker
  // chose to keep a walk that did not pass: it is saved, but earns nothing.
  function buildEntry(result, options){
    var opts = options || {};
    var trail = result.trail || null;
    var entry = {
      id: opts.id,
      updatedAt: Number(opts.now) || 0,
      date: new Date(result.startedAt).toISOString(),
      trailId: trail ? trail.id : null,
      trail: trail ? trail.name : (result.name || opts.defaultName || ''),
      region: trail ? (trail.valley || trail.area || '') : '',
      dist: result.km > 0.1 ? result.km.toFixed(1) : '',
      dur: String(result.minutes || ''),
      cond: '',
      rating: null,
      note: '',
      photos: 0,
      shareToTrail: false,
      recorded: false,
      segments: result.track && result.track.length > 1 ? [result.track] : [],
    };
    if(result.proven && trail) entry.proof = 'gpx';
    return entry;
  }

  var api = {
    MAX_FILE_CHARS: MAX_FILE_CHARS, MIN_SHOWN_SHARE: MIN_SHOWN_SHARE,
    parseGpx: parseGpx, assessGpx: assessGpx, isDuplicate: isDuplicate, buildEntry: buildEntry,
    project: project, prepareLine: prepareLine,
  };
  root.DoloPawsGpxWalk = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
