(function(root){
  'use strict';

  // SOCIAL-06 — add a walk from a file. For the walk recorded on a watch,
  // Strava or Komoot because nobody pressed Start in ORMA. The file is read on
  // the phone, matched to the ORMA trail it follows, and judged by the same
  // check hike mode uses (walk-proof.js): most of the trail's line walked, in
  // one go, at a walking pace. A walk that passes is marked `proof: 'gpx'`,
  // which earns a passport stamp just like a recording made in ORMA.
  //
  // Three kinds of file are read: GPX (most apps), TCX (Garmin and older
  // Strava exports) and FIT, the binary file Garmin, Wahoo, Coros and Suunto
  // watches write. A gzipped one (Strava's bulk export) is unzipped first.
  // Every kind becomes the same list of timed points and gets the same check,
  // and a passing walk is marked `proof: 'gpx'` whichever kind it came from:
  // the mark means "proven from a file", and the database accepts only
  // 'gps' and 'gpx'.
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

  // TCX: <Trackpoint> with <Time> and <Position>. A <Courses> file with no
  // <Activities> is a route planned for the watch to follow, not a walk.
  function parseTcx(text){
    var source = typeof text === 'string' ? text : '';
    var empty = { points: [], timed: false, name: '', error: 'not-gpx' };
    if(!source || source.length > MAX_FILE_CHARS || !/<TrainingCenterDatabase[\s>]/i.test(source)) return empty;
    var plan = /<Courses[\s>]/i.test(source) && !/<Activities[\s>]/i.test(source);
    var points = [];
    var untimed = 0, noPosition = 0;
    var re = /<Trackpoint\b[^>]*>([\s\S]*?)<\/Trackpoint>/gi;
    var m;
    var tag = function(body, name){
      var x = new RegExp('<' + name + '>\\s*([^<\\s]+)\\s*</' + name + '>', 'i').exec(body);
      return x ? x[1] : '';
    };
    while((m = re.exec(source))){
      var lat = Number(tag(m[1], 'LatitudeDegrees'));
      var lng = Number(tag(m[1], 'LongitudeDegrees'));
      if(!tag(m[1], 'LatitudeDegrees') || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180){
        noPosition++;
        continue;
      }
      var t = Date.parse(tag(m[1], 'Time'));
      if(!Number.isFinite(t)){ untimed++; continue; }
      points.push({ lat: lat, lng: lng, t: t });
    }
    points.sort(function(a, b){ return a.t - b.t; });
    return { points: points, timed: points.length > 0, untimed: untimed, noPosition: noPosition, plan: plan, name: '', error: null };
  }

  // FIT: the binary file watches write. Only what the walk needs is read:
  // `record` messages (global number 20) with a position and a time, and the
  // file's type (`file_id`, number 0), where 6 means a course, a plan.
  // Positions are "semicircles"; times are seconds since 31 Dec 1989 UTC.
  var FIT_EPOCH_S = 631065600;
  var SEMICIRCLE = 180 / 2147483648;
  function isFit(bytes){
    return bytes && bytes.length >= 12 && bytes[0] >= 12 &&
      bytes[8] === 0x2E && bytes[9] === 0x46 && bytes[10] === 0x49 && bytes[11] === 0x54; // ".FIT"
  }
  function parseFit(input){
    var bytes = toBytes(input);
    var empty = { points: [], timed: false, name: '', error: 'not-gpx' };
    if(!isFit(bytes) || bytes.length > MAX_FILE_CHARS) return empty;
    var view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    var points = [];
    var untimed = 0, noPosition = 0, plan = false, broken = false;
    var offset = 0;
    // A FIT file can be several files one after another ("chained").
    while(!broken && offset + 12 <= bytes.length && isFit(bytes.subarray(offset))){
      var pos = offset + bytes[offset];
      var end = Math.min(bytes.length, pos + view.getUint32(offset + 4, true));
      var defs = {};
      var lastTs = null;
      while(pos < end){
        var head = bytes[pos++];
        var local, compressedTs = null;
        if(head & 0x80){
          // Compressed timestamp header: a 5-bit offset from the last full time.
          local = (head >> 5) & 0x03;
          if(lastTs !== null){
            var off = head & 0x1F;
            compressedTs = lastTs + ((off - (lastTs & 0x1F)) & 0x1F);
            lastTs = compressedTs;
          }
        } else if(head & 0x40){
          local = head & 0x0F;
          if(pos + 5 > end){ broken = true; break; }
          var little = bytes[pos + 1] === 0;
          var def = { global: view.getUint16(pos + 2, little), little: little, fields: [], size: 0, devSize: 0 };
          var count = bytes[pos + 4];
          pos += 5;
          if(pos + count * 3 > end){ broken = true; break; }
          for(var f = 0; f < count; f++, pos += 3){
            def.fields.push({ num: bytes[pos], size: bytes[pos + 1], at: def.size });
            def.size += bytes[pos + 1];
          }
          if(head & 0x20){ // developer fields: skipped, but their bytes counted
            var devCount = bytes[pos++];
            if(pos + devCount * 3 > end){ broken = true; break; }
            for(var d = 0; d < devCount; d++, pos += 3) def.devSize += bytes[pos + 1];
          }
          defs[local] = def;
          continue;
        } else {
          local = head & 0x0F;
        }
        var msg = defs[local];
        if(!msg || pos + msg.size + msg.devSize > end){ broken = true; break; }
        var ts = compressedTs, lat = null, lng = null, type = null;
        msg.fields.forEach(function(field){
          var at = pos + field.at;
          if(field.num === 253 && field.size === 4){
            var v = view.getUint32(at, msg.little);
            if(v !== 0xFFFFFFFF){ ts = v; lastTs = v; }
          } else if(msg.global === 20 && field.size === 4 && (field.num === 0 || field.num === 1)){
            var s = view.getInt32(at, msg.little);
            if(s !== 0x7FFFFFFF){ if(field.num === 0) lat = s * SEMICIRCLE; else lng = s * SEMICIRCLE; }
          } else if(msg.global === 0 && field.num === 0 && field.size === 1){
            type = bytes[at];
          }
        });
        pos += msg.size + msg.devSize;
        if(msg.global === 0 && type === 6) plan = true;
        if(msg.global !== 20) continue;
        if(lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180){ noPosition++; continue; }
        if(ts === null){ untimed++; continue; }
        points.push({ lat: lat, lng: lng, t: (ts + FIT_EPOCH_S) * 1000 });
      }
      offset = end + 2; // the file's CRC
    }
    if(!points.length && broken) return empty;
    points.sort(function(a, b){ return a.t - b.t; });
    return { points: points, timed: points.length > 0, untimed: untimed, noPosition: noPosition, plan: plan, name: '', error: null };
  }

  function toBytes(input){
    // Tag checks rather than instanceof, so bytes from another frame or realm still count.
    var tag = Object.prototype.toString.call(input);
    if(tag === '[object Uint8Array]') return input;
    if(tag === '[object ArrayBuffer]') return new Uint8Array(input);
    if(input && ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    return new Uint8Array(0);
  }

  // Any of the three, from the file's own bytes (or text), not its name.
  function readWalkFile(input){
    if(typeof input === 'string'){
      return /<TrainingCenterDatabase[\s>]/i.test(input) ? parseTcx(input) : parseGpx(input);
    }
    var bytes = toBytes(input);
    if(isFit(bytes)) return parseFit(bytes);
    if(bytes.length > MAX_FILE_CHARS) return { points: [], timed: false, name: '', error: 'not-gpx' };
    var text = typeof TextDecoder === 'function' ? new TextDecoder('utf-8').decode(bytes) : '';
    return readWalkFile(text);
  }

  // Strava's bulk export gzips each file (.gpx.gz, .fit.gz). Unzip on the
  // phone when the browser can; otherwise hand back the bytes unchanged.
  function gunzip(input){
    var bytes = toBytes(input);
    var zipped = bytes.length > 2 && bytes[0] === 0x1F && bytes[1] === 0x8B;
    if(!zipped || typeof DecompressionStream !== 'function' || typeof Response !== 'function' || typeof Blob !== 'function'){
      return Promise.resolve(bytes);
    }
    var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).arrayBuffer().then(function(buffer){ return new Uint8Array(buffer); });
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
  //   reason: 'not-gpx' (no file we can read) | 'a-plan' | 'no-gps' | 'no-times'
  //           | 'too-few-points' | 'in-the-future'
  //           | 'no-trail' | 'too-little-of-the-route' | 'not-one-walk' | 'too-fast' | 'proven'
  function assessGpx(text, trails, options){
    return assessParsed(parseGpx(text), trails, options);
  }

  // A GPX, TCX or FIT file, as text or bytes (already unzipped: see gunzip).
  function assessFile(input, trails, options){
    return assessParsed(readWalkFile(input), trails, options);
  }

  function assessParsed(parsed, trails, options){
    var opts = options || {};
    var now = Number(opts.now) || 0;
    var fail = function(reason, extra){ return Object.assign({ ok: false, reason: reason, proven: false }, extra || {}); };
    if(parsed.error) return fail(parsed.error);
    if(parsed.plan) return fail('a-plan');
    if(!parsed.timed) return fail(parsed.untimed ? 'no-times' : parsed.noPosition ? 'no-gps' : 'not-gpx');
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
    parseGpx: parseGpx, parseTcx: parseTcx, parseFit: parseFit, readWalkFile: readWalkFile, gunzip: gunzip,
    assessGpx: assessGpx, assessFile: assessFile, isDuplicate: isDuplicate, buildEntry: buildEntry,
    project: project, prepareLine: prepareLine,
  };
  root.DoloPawsGpxWalk = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
