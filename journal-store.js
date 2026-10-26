(function(global){
  'use strict';

  // JOURNAL-02 — the walk journal belongs to the account, not to the browser
  // it was recorded in. This module owns everything about that which can be
  // decided without a network: what a stored entry may contain, how a track is
  // written down, and which of two copies of the same walk is the newer one.
  // No Firebase, no DOM, no clock of its own, so it is testable on its own.

  var MAX_ENTRIES = 500;          // per account, newest kept
  var MAX_TRACK_CHARS = 60000;    // ~3,000 points, far past a day's walking
  var MAX_PHOTO_CHARS = 700000;   // same bound dog photos already use
  var MAX_NOTE_CHARS = 2000;
  // Who came along: your dogs and friends, by name. Kept in the account as one
  // newline-separated string so the rule can bound it with a single size check.
  var MAX_COMPANIONS = 12;
  var MAX_COMPANION_CHARS = 40;
  var MAX_WALKED_WITH_CHARS = 400;
  // JOURNAL-03: a walk's photos are files in Firebase Storage; the walk keeps
  // only their ids. The old inline `photo` still counts towards the six.
  var MAX_PHOTOS = 6;
  var PHOTO_ID = /^p[a-z0-9]{6,32}$/;
  var COORD_PRECISION = 1e5;      // ~1 m, the precision the recorder stores

  function text(value, limit){
    return String(value == null ? '' : value).slice(0, limit);
  }

  function finite(value){
    var number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function validSegments(segments){
    if(!Array.isArray(segments)) return [];
    return segments.map(function(segment){
      return Array.isArray(segment) ? segment.filter(function(point){
        return Array.isArray(point) && Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1]));
      }) : [];
    }).filter(function(segment){ return segment.length > 0; });
  }

  // Firestore has no nested arrays, so a track travels as one string:
  // segments separated by "|", points by ";", latitude and longitude by ",".
  // The separators keep the gaps in a broken recording visible on the far side.
  function encodeTrack(segments){
    var encoded = validSegments(segments).map(function(segment){
      return segment.map(function(point){
        return round(point[0]) + ',' + round(point[1]);
      }).join(';');
    }).join('|');
    if(encoded.length <= MAX_TRACK_CHARS) return encoded;
    // Truncate on a point boundary rather than mid-coordinate.
    var cut = encoded.lastIndexOf(';', MAX_TRACK_CHARS);
    var bar = encoded.lastIndexOf('|', MAX_TRACK_CHARS);
    return encoded.slice(0, Math.max(0, Math.max(cut, bar)));
  }

  function round(value){
    return Math.round(Number(value) * COORD_PRECISION) / COORD_PRECISION;
  }

  function decodeTrack(encoded){
    if(typeof encoded !== 'string' || !encoded) return [];
    return encoded.split('|').map(function(segment){
      return segment.split(';').map(function(pair){
        var parts = pair.split(',');
        return [Number(parts[0]), Number(parts[1])];
      }).filter(function(point){
        return Number.isFinite(point[0]) && Number.isFinite(point[1]);
      });
    }).filter(function(segment){ return segment.length > 0; });
  }

  function flatten(segments){
    return validSegments(segments).reduce(function(all, segment){ return all.concat(segment); }, []);
  }

  // The segments of an entry, whichever vintage wrote it. Entries recorded
  // before walks were kept in stretches carry one flat route.
  function entrySegments(entry){
    var segments = validSegments(entry && entry.segments);
    if(segments.length) return segments;
    var route = validSegments([entry && entry.route]);
    return route;
  }

  function entryTimestamp(entry){
    return finite(entry && entry.updatedAt)
      || Date.parse((entry && entry.date) || '')
      || 0;
  }

  // What a journal entry looks like in the account. Deliberately a fixed, small
  // set of fields: the Firestore rule allows exactly these and nothing else, so
  // a future field has to be added in both places on purpose.
  function toRemote(entry, options){
    options = options || {};
    var now = finite(options.now) || 0;
    var segments = entrySegments(entry);
    var photo = typeof entry.photo === 'string'
      && /^data:image\/(jpeg|jpg|png|webp);base64,/.test(entry.photo)
      && entry.photo.length <= MAX_PHOTO_CHARS
      ? entry.photo : null;
    var remote = {
      schemaVersion: 1,
      entryId: text(entry.id, 120),
      date: text(entry.date, 40),
      trail: text(entry.trail, 120),
      trailId: entry.trailId ? text(entry.trailId, 80) : null,
      region: text(entry.region, 80),
      dist: text(entry.dist, 12),
      dur: text(entry.dur, 12),
      cond: text(entry.cond, 40),
      rating: finite(entry.rating) || null,
      note: text(entry.note, MAX_NOTE_CHARS),
      photo: photo,
      photos: finite(entry.photos) || 0,
      shareToTrail: entry.shareToTrail === true,
      recorded: entry.recorded === true,
      track: encodeTrack(segments),
      gaps: finite(entry.gaps) || 0,
      tale: taleOf(entry),
      updatedAt: entryTimestamp(entry) || now,
    };
    // Optional, and only sent when there is someone to name: a walk without
    // companions writes exactly the fields older rules already accept.
    var companions = walkedWithOf(entry);
    if(companions.length) remote.walkedWith = companions.join('\n');
    // Same for photos kept in Storage: only sent when there are some.
    var photoIds = photoIdsOf(entry, photo ? 1 : 0);
    if(photoIds.length) remote.photoIds = photoIds;
    return remote;
  }

  // A clean list of names: trimmed, de-duplicated, bounded. Anything that is
  // not a list of strings becomes an empty list rather than an error.
  function walkedWithOf(entry){
    var list = entry && entry.walkedWith;
    if(typeof list === 'string') list = list.split('\n');
    if(!Array.isArray(list)) return [];
    var seen = new Set();
    var clean = [];
    list.forEach(function(name){
      var value = text(name, MAX_COMPANION_CHARS).replace(/\n/g, ' ').trim();
      var key = value.toLowerCase();
      if(!value || seen.has(key) || clean.length >= MAX_COMPANIONS) return;
      seen.add(key);
      clean.push(value);
    });
    while(clean.join('\n').length > MAX_WALKED_WITH_CHARS) clean.pop();
    return clean;
  }

  // The stored photo ids a walk carries: valid, de-duplicated, and no more
  // than fit beside `reserved` other photos (the old inline one).
  function photoIdsOf(entry, reserved){
    var list = entry && entry.photoIds;
    if(!Array.isArray(list)) return [];
    var seen = new Set();
    return list.filter(function(id){
      if(typeof id !== 'string' || !PHOTO_ID.test(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    }).slice(0, Math.max(0, MAX_PHOTOS - (finite(reserved) || 0)));
  }

  function taleOf(entry){
    var tale = entry && entry.tale;
    if(!tale || typeof tale !== 'object') return {};
    var clean = {};
    ['paws', 'energy', 'moment'].forEach(function(group){
      if(typeof tale[group] === 'string') clean[group] = text(tale[group], 20);
    });
    return clean;
  }

  function fromRemote(remote){
    var segments = decodeTrack(remote && remote.track);
    return {
      id: text(remote.entryId, 120),
      date: text(remote.date, 40),
      trail: text(remote.trail, 120),
      trailId: remote.trailId || null,
      region: text(remote.region, 80),
      dist: text(remote.dist, 12),
      dur: text(remote.dur, 12),
      cond: text(remote.cond, 40),
      rating: finite(remote.rating),
      note: text(remote.note, MAX_NOTE_CHARS),
      photo: typeof remote.photo === 'string' ? remote.photo : undefined,
      photos: finite(remote.photos) || 0,
      shareToTrail: remote.shareToTrail === true,
      recorded: remote.recorded === true,
      route: flatten(segments),
      segments: segments,
      gaps: finite(remote.gaps) || 0,
      tale: taleOf(remote),
      walkedWith: walkedWithOf(remote),
      photoIds: photoIdsOf(remote, typeof remote.photo === 'string' ? 1 : 0),
      updatedAt: finite(remote.updatedAt) || 0,
    };
  }

  // Two copies of one account's journal, on two devices that were both offline
  // at some point. Same walk on both sides: the later edit wins. A walk only
  // one side has is kept either way — a journal never loses a walk silently,
  // and deletion is an explicit act that goes straight to the account.
  function mergeEntries(local, remote){
    var byId = new Map();
    (Array.isArray(remote) ? remote : []).forEach(function(entry){
      if(entry && entry.id) byId.set(entry.id, entry);
    });
    (Array.isArray(local) ? local : []).forEach(function(entry){
      if(!entry || !entry.id) return;
      var rival = byId.get(entry.id);
      if(!rival || entryTimestamp(entry) >= entryTimestamp(rival)) byId.set(entry.id, entry);
    });
    return [...byId.values()]
      .sort(function(a, b){ return new Date(b.date) - new Date(a.date); })
      .slice(0, MAX_ENTRIES);
  }

  // Entries whose local copy is newer than the copy the account has, including
  // walks the account has never seen. This is what a sync pushes up.
  function entriesToPush(merged, remote){
    var remoteStamp = new Map();
    (Array.isArray(remote) ? remote : []).forEach(function(entry){
      if(entry && entry.id) remoteStamp.set(entry.id, entryTimestamp(entry));
    });
    return (Array.isArray(merged) ? merged : []).filter(function(entry){
      if(!entry || !entry.id) return false;
      if(!remoteStamp.has(entry.id)) return true;
      return entryTimestamp(entry) > remoteStamp.get(entry.id);
    });
  }

  // Entries now sync to the account, so two phones must never mint the same id
  // for two different walks in the same millisecond: one walk would overwrite
  // the other in the account and be lost.
  function newId(now){
    var suffix = '';
    try {
      if(global.crypto && typeof global.crypto.getRandomValues === 'function'){
        var bytes = new Uint8Array(3);
        global.crypto.getRandomValues(bytes);
        suffix = Array.prototype.map.call(bytes, function(byte){
          return ('0' + byte.toString(16)).slice(-2);
        }).join('');
      }
    } catch(e){}
    if(!suffix) suffix = ('00000' + Math.floor(Math.random() * 16777216).toString(16)).slice(-6);
    return 'w' + (finite(now) || 0) + '-' + suffix;
  }

  function stamp(entry, now){
    return Object.assign({}, entry, { updatedAt: finite(now) || 0 });
  }

  var api = {
    MAX_ENTRIES: MAX_ENTRIES,
    MAX_TRACK_CHARS: MAX_TRACK_CHARS,
    MAX_PHOTO_CHARS: MAX_PHOTO_CHARS,
    encodeTrack: encodeTrack,
    decodeTrack: decodeTrack,
    entrySegments: entrySegments,
    entryTimestamp: entryTimestamp,
    flatten: flatten,
    toRemote: toRemote,
    walkedWithOf: walkedWithOf,
    MAX_COMPANIONS: MAX_COMPANIONS,
    MAX_PHOTOS: MAX_PHOTOS,
    photoIdsOf: photoIdsOf,
    fromRemote: fromRemote,
    mergeEntries: mergeEntries,
    entriesToPush: entriesToPush,
    newId: newId,
    stamp: stamp,
  };
  global.DoloPawsJournalStore = api;
  if(typeof module !== 'undefined' && module.exports){ module.exports = api; }
})(typeof window !== 'undefined' ? window : globalThis);
