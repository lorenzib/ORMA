(function(global){
  'use strict';

  // JOURNAL-03 — a walk keeps several photos. They are too big to live inside
  // the walk (a Firestore document stops at 1 MB), so each photo is its own
  // file in Firebase Storage at users/{uid}/journal/{entryId}/{photoId}.jpg,
  // and the walk keeps only the list of photo ids.
  //
  // This browser keeps its own copy of every photo in IndexedDB, so a photo
  // taken on a mountain with no signal is in the journal at once, and goes up
  // to the account the next time the journal is open and online. localStorage
  // is not used: it holds about 5 MB, which a few walks of photos would fill.
  //
  // Walks saved before this kept one photo inline as a data URL (`photo`).
  // That photo is still read, and shown first.

  var journalStore = global.DoloPawsJournalStore
    || (typeof require === 'function' ? require('./journal-store.js') : null);
  var MAX_PHOTOS = journalStore.MAX_PHOTOS;
  var MAX_EDGE = 1600;            // px, longest side after downscaling
  var JPEG_QUALITY = 0.8;
  var MAX_PHOTO_BYTES = 2 * 1024 * 1024;   // storage.rules refuses anything larger
  var ENTRY_ID = /^[A-Za-z0-9._:-]{1,120}$/;
  var LEGACY_ID = 'inline';

  // The id rule lives with the rest of the walk's shape, in journal-store.js.
  function validPhotoId(id){ return journalStore.photoIdsOf({ photoIds:[id] }).length === 1; }

  function hasLegacyPhoto(entry){
    return !!(entry && typeof entry.photo === 'string' && /^data:image\//.test(entry.photo));
  }

  // Every photo of a walk, in the order they are shown: the old inline photo
  // first, then the stored ones.
  function photoListOf(entry){
    var legacy = hasLegacyPhoto(entry);
    return (legacy ? [LEGACY_ID] : []).concat(journalStore.photoIdsOf(entry, legacy ? 1 : 0));
  }

  function photoCount(entry){ return photoListOf(entry).length; }

  function newPhotoId(now){
    var suffix = '';
    try {
      if(global.crypto && typeof global.crypto.getRandomValues === 'function'){
        var bytes = new Uint8Array(4);
        global.crypto.getRandomValues(bytes);
        suffix = Array.prototype.map.call(bytes, function(byte){
          return ('0' + byte.toString(16)).slice(-2);
        }).join('');
      }
    } catch(e){}
    if(!suffix) suffix = ('0000000' + Math.floor(Math.random() * 4294967296).toString(16)).slice(-8);
    return 'p' + Math.max(0, Math.floor(Number(now) || 0)).toString(36) + suffix;
  }

  function photoPath(uid, entryId, photoId){
    if(!uid || !ENTRY_ID.test(String(entryId || '')) || !validPhotoId(photoId)) return '';
    return 'users/' + uid + '/journal/' + entryId + '/' + photoId + '.jpg';
  }

  // ---- This browser's copy -------------------------------------------------
  // One record per photo: { key, uid, entryId, photoId, blob, state }.
  // state is 'pending' (not in the account yet), 'synced', or 'delete' (the
  // account copy still has to go). Falls back to memory where IndexedDB is
  // missing, which is also what the tests use.

  var DB_NAME = 'orma-journal-photos';
  var STORE = 'photos';

  function recordKey(uid, entryId, photoId){ return uid + '/' + entryId + '/' + photoId; }

  function memoryBackend(){
    var rows = new Map();
    return {
      put: function(row){ rows.set(row.key, Object.assign({}, row)); return Promise.resolve(); },
      get: function(key){ var row = rows.get(key); return Promise.resolve(row ? Object.assign({}, row) : null); },
      remove: function(key){ rows.delete(key); return Promise.resolve(); },
      all: function(){ return Promise.resolve([...rows.values()].map(function(row){ return Object.assign({}, row); })); },
    };
  }

  function indexedDbBackend(factory){
    var opening = null;
    function open(){
      if(opening) return opening;
      opening = new Promise(function(resolve, reject){
        var request = factory.open(DB_NAME, 1);
        request.onupgradeneeded = function(){ request.result.createObjectStore(STORE, { keyPath:'key' }); };
        request.onsuccess = function(){ resolve(request.result); };
        request.onerror = function(){ opening = null; reject(request.error); };
      });
      return opening;
    }
    function run(mode, work){
      return open().then(function(db){
        return new Promise(function(resolve, reject){
          var tx = db.transaction(STORE, mode);
          var result = work(tx.objectStore(STORE));
          tx.oncomplete = function(){ resolve(result && 'result' in result ? result.result : undefined); };
          tx.onerror = function(){ reject(tx.error); };
          tx.onabort = function(){ reject(tx.error); };
        });
      });
    }
    return {
      put: function(row){ return run('readwrite', function(store){ store.put(row); }); },
      get: function(key){ return run('readonly', function(store){ return store.get(key); }).then(function(row){ return row || null; }); },
      remove: function(key){ return run('readwrite', function(store){ store.delete(key); }); },
      all: function(){ return run('readonly', function(store){ return store.getAll(); }).then(function(rows){ return rows || []; }); },
    };
  }

  function createLocalStore(backend){
    backend = backend || (global.indexedDB ? indexedDbBackend(global.indexedDB) : memoryBackend());
    return {
      // A new photo, taken here, not yet in the account.
      add: function(uid, entryId, photoId, blob){
        return backend.put({ key:recordKey(uid, entryId, photoId), uid:uid, entryId:entryId, photoId:photoId, blob:blob, state:'pending' });
      },
      // A photo fetched from the account, kept so it shows offline next time.
      keep: function(uid, entryId, photoId, blob){
        return backend.put({ key:recordKey(uid, entryId, photoId), uid:uid, entryId:entryId, photoId:photoId, blob:blob, state:'synced' });
      },
      get: function(uid, entryId, photoId){
        return backend.get(recordKey(uid, entryId, photoId)).then(function(row){
          return row && row.state !== 'delete' ? row.blob : null;
        });
      },
      markSynced: function(uid, entryId, photoId){
        var key = recordKey(uid, entryId, photoId);
        return backend.get(key).then(function(row){
          if(row && row.state === 'pending') return backend.put(Object.assign(row, { state:'synced' }));
        });
      },
      // Removed from the walk. A photo the account never had just goes; one it
      // has waits here until the account copy is deleted too.
      remove: function(uid, entryId, photoId){
        var key = recordKey(uid, entryId, photoId);
        return backend.get(key).then(function(row){
          if(row && row.state === 'pending') return backend.remove(key);
          return backend.put({ key:key, uid:uid, entryId:entryId, photoId:photoId, blob:null, state:'delete' });
        });
      },
      forget: function(uid, entryId, photoId){ return backend.remove(recordKey(uid, entryId, photoId)); },
      // What still has to reach the account: uploads and deletions.
      outstanding: function(uid){
        return backend.all().then(function(rows){
          return rows.filter(function(row){ return row.uid === uid && (row.state === 'pending' || row.state === 'delete'); });
        });
      },
    };
  }

  // Bring the account in line with this browser: upload new photos, delete
  // removed ones. Each photo is tried on its own, so one failure does not hold
  // up the rest; whatever fails stays outstanding for the next sync.
  function syncOutstanding(local, uid, remote){
    return local.outstanding(uid).then(function(rows){
      return rows.reduce(function(chain, row){
        return chain.then(function(done){
          var step = row.state === 'delete'
            ? remote.remove(row.entryId, row.photoId).then(function(ok){
              return ok ? local.forget(uid, row.entryId, row.photoId).then(function(){ return ok; }) : ok;
            })
            : remote.upload(row.entryId, row.photoId, row.blob).then(function(ok){
              return ok ? local.markSynced(uid, row.entryId, row.photoId).then(function(){ return ok; }) : ok;
            });
          return step.then(function(ok){ return done + (ok ? 1 : 0); }, function(){ return done; });
        });
      }, Promise.resolve(0)).then(function(done){ return { done:done, left:rows.length - done }; });
    });
  }

  // ---- Making a photo small enough ----------------------------------------

  function dataUrlToBlob(dataUrl){
    var match = /^data:([^;,]+);base64,(.*)$/.exec(String(dataUrl || ''));
    if(!match) return null;
    var binary = global.atob(match[2]);
    var bytes = new Uint8Array(binary.length);
    for(var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type:match[1] });
  }

  // A picked file, as a JPEG no longer than MAX_EDGE on its longest side.
  // Resolves null when the browser cannot read it as an image.
  function downscale(file){
    return new Promise(function(resolve){
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function(){
        var s = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
        var canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * s);
        canvas.height = Math.round(img.height * s);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        var finish = function(blob){ resolve(blob && blob.size <= MAX_PHOTO_BYTES ? blob : null); };
        if(canvas.toBlob) canvas.toBlob(finish, 'image/jpeg', JPEG_QUALITY);
        else finish(dataUrlToBlob(canvas.toDataURL('image/jpeg', JPEG_QUALITY)));
      };
      img.onerror = function(){ URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  }

  var api = {
    MAX_PHOTOS: MAX_PHOTOS,
    MAX_PHOTO_BYTES: MAX_PHOTO_BYTES,
    LEGACY_ID: LEGACY_ID,
    validPhotoId: validPhotoId,
    photoListOf: photoListOf,
    photoCount: photoCount,
    hasLegacyPhoto: hasLegacyPhoto,
    newPhotoId: newPhotoId,
    photoPath: photoPath,
    memoryBackend: memoryBackend,
    createLocalStore: createLocalStore,
    syncOutstanding: syncOutstanding,
    dataUrlToBlob: dataUrlToBlob,
    downscale: downscale,
  };

  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  global.DoloPawsJournalPhotos = api;
})(typeof window !== 'undefined' ? window : globalThis);
