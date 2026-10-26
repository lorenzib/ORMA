const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, 'walk-page.js'), 'utf8');

function renderWalkPage(auth, summary){
  document.body.innerHTML = `
    <span id="wrTime"></span><span id="wrDist"></span><span id="wrGps"></span><span id="wrDog"></span>
    <button id="wrStart"></button><button id="wrPause"></button><button id="wrFinish"></button><button id="wrDiscard"></button>
    <div id="wrGate"></div><div id="wrMap"></div>`;
  localStorage.clear();
  if(summary) localStorage.setItem('dolopaws-profile-summary', JSON.stringify(summary));
  const recorder = {
    status:'idle', distanceM:0,
    elapsedMs:jest.fn(() => 0),
    start:jest.fn(function(){ this.status = 'recording'; }),
    resume:jest.fn(), pause:jest.fn(), finish:jest.fn(), addFix:jest.fn(),
    snapshot:jest.fn(() => ({ points:[] })), restore:jest.fn(),
    summary:jest.fn(() => ({ route:[] })),
  };
  window.DoloPawsWalkRecorder = {
    createRecorder:jest.fn(() => recorder),
    buildJournalEntry:jest.fn(),
    haversineM:jest.fn(() => 0),
  };
  window.DoloPawsAuth = auth;
  window.DoloPawsAuthReady = true;
  window.eval(source);
  return { recorder, gate:document.getElementById('wrGate'), start:document.getElementById('wrStart') };
}

function setGeolocation(overrides = {}){
  const position = { coords:{ latitude:46.5, longitude:11.6, accuracy:12 }, timestamp:Date.now() };
  Object.defineProperty(navigator, 'geolocation', {
    configurable:true,
    value:{
      getCurrentPosition:jest.fn(success => success(position)),
      watchPosition:jest.fn(() => 17),
      clearWatch:jest.fn(),
      ...overrides,
    },
  });
}

describe('walk recorder authentication restoration', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    delete window.maplibregl;
    setGeolocation();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    delete window.DoloPawsAuth;
    delete window.DoloPawsAuthReady;
    delete window.DoloPawsWalkRecorder;
    delete navigator.geolocation;
  });

  test('a cached confirmed member can record while Firebase restores', () => {
    const auth = { currentUser:null, authResolved:false, onChange:jest.fn() };
    const view = renderWalkPage(auth, { uid:'user-1', name:'Eddie' });
    expect(view.gate.hidden).toBe(true);
    expect(document.getElementById('wrDog').textContent).toBe('Walking with Eddie');
    view.start.click();
    expect(view.recorder.start).toHaveBeenCalledTimes(1);
    expect(view.gate.hidden).toBe(true);
  });

  test('a definitively logged-out visitor still sees the account gate', () => {
    const auth = { currentUser:null, authResolved:true, onChange:fn => fn(null) };
    const view = renderWalkPage(auth, null);
    expect(view.gate.hidden).toBe(false);
    view.start.click();
    expect(view.recorder.start).not.toHaveBeenCalled();
  });

  test('does not start a walk when location permission is denied', () => {
    setGeolocation({ getCurrentPosition:jest.fn((success, error) => error({ code:1 })) });
    const auth = { currentUser:null, authResolved:false, onChange:jest.fn() };
    const view = renderWalkPage(auth, { uid:'user-1', name:'Eddie' });
    view.start.click();
    expect(view.recorder.start).not.toHaveBeenCalled();
    expect(view.recorder.resume).not.toHaveBeenCalled();
    expect(view.recorder.addFix).not.toHaveBeenCalled();
    expect(document.getElementById('wrGps').textContent).toContain('Location access is off');
    expect(view.start.hidden).toBe(false);
    expect(view.start.disabled).toBe(false);
  });

  test('does not start a walk until a usable location is available', () => {
    let locate;
    setGeolocation({ getCurrentPosition:jest.fn(success => { locate = success; }) });
    const auth = { currentUser:null, authResolved:false, onChange:jest.fn() };
    const view = renderWalkPage(auth, { uid:'user-1', name:'Eddie' });
    view.start.click();
    expect(view.recorder.start).not.toHaveBeenCalled();
    expect(view.start.disabled).toBe(true);
    locate({ coords:{ latitude:46.5, longitude:11.6, accuracy:15 }, timestamp:Date.now() });
    expect(view.recorder.start).toHaveBeenCalledTimes(1);
    expect(view.recorder.addFix).toHaveBeenCalledWith(expect.objectContaining({ lat:46.5, lng:11.6, accuracy:15 }));
  });

  test('rejects an inaccurate location without beginning the timer', () => {
    setGeolocation({ getCurrentPosition:jest.fn(success => success({
      coords:{ latitude:46.5, longitude:11.6, accuracy:120 }, timestamp:Date.now(),
    })) });
    const auth = { currentUser:null, authResolved:false, onChange:jest.fn() };
    const view = renderWalkPage(auth, { uid:'user-1', name:'Eddie' });
    view.start.click();
    expect(view.recorder.start).not.toHaveBeenCalled();
    expect(document.getElementById('wrGps').textContent).toContain('GPS signal is too weak');
  });

  // The stub recorder above proves what the page does with the engine. These
  // run the real engine behind the real page, feeding the watch the way a
  // phone feeds it, and read back what actually lands in the journal.
  describe('what a recorded walk leaves in the journal', () => {
    const recorderSource = fs.readFileSync(path.join(__dirname, 'walk-recorder.js'), 'utf8');
    const storeSource = fs.readFileSync(path.join(__dirname, 'journal-store.js'), 'utf8');
    const T0 = 1770000000000;

    function recordWith(feed){
      document.body.innerHTML = `
        <span id="wrTime"></span><span id="wrDist"></span><span id="wrGps"></span><span id="wrDog"></span>
        <button id="wrStart"></button><button id="wrPause"></button><button id="wrFinish"></button><button id="wrDiscard"></button>
        <div id="wrGate"></div><div id="wrMap"></div>`;
      localStorage.clear();
      localStorage.setItem('dolopaws-profile-summary', JSON.stringify({ uid:'user-1', name:'Teo' }));
      jest.setSystemTime(new Date(T0));
      window.eval(recorderSource);
      window.eval(storeSource);
      const watchers = [];
      Object.defineProperty(navigator, 'geolocation', { configurable:true, value:{
        getCurrentPosition:success => success({
          coords:{ latitude:46.5, longitude:11.6, accuracy:10 }, timestamp:T0,
        }),
        watchPosition:success => { watchers.push(success); return 1; },
        clearWatch:jest.fn(),
      }});
      window.DoloPawsAuth = { currentUser:{ uid:'user-1' }, authResolved:true, onChange:fn => fn({ uid:'user-1' }) };
      window.DoloPawsAuthReady = true;
      window.confirm = () => true;
      window.eval(source);
      document.getElementById('wrStart').click();
      feed((lat, lng, at, accuracy = 10) => {
        jest.setSystemTime(new Date(at));
        watchers.forEach(watcher => watcher({ coords:{ latitude:lat, longitude:lng, accuracy }, timestamp:at }));
      });
      document.getElementById('wrFinish').click();
      return JSON.parse(localStorage.getItem('dolopaws-journal-user-1'))[0];
    }

    test('a walk the phone follows all the way is stored as the shape walked', () => {
      const entry = recordWith(send => {
        for(let i = 1; i <= 200; i++){
          const angle = (i / 200) * Math.PI;
          send(46.5 + 0.004 * Math.sin(angle), 11.6 + 0.004 * (1 - Math.cos(angle)), T0 + i * 2000);
        }
      });
      expect(entry.segments.length).toBe(1);
      expect(entry.gaps).toBe(0);
      // A curve, not two points with a line between them.
      expect(entry.route.length).toBeGreaterThan(20);
      expect(Number(entry.dist)).toBeGreaterThan(0.9);
    });

    // 16 October 2026: a walk came back as one straight line from start to end,
    // 1.3 km, because the phone was pocketed and the page frozen. The single
    // fix delivered on the way home was joined to the start.
    test('a walk the phone stops following is not joined up across the gap', () => {
      const entry = recordWith(send => {
        for(let i = 1; i <= 30; i++) send(46.5 + i * 0.0001, 11.6, T0 + i * 2000);
        send(46.5105, 11.6085, T0 + 13 * 60e3);   // back in hand, a kilometre away
      });
      expect(entry.segments.length).toBe(2);
      expect(entry.gaps).toBe(1);
      // The kilometre nobody recorded is not in the distance.
      expect(Number(entry.dist)).toBeLessThan(0.6);
      expect(document.getElementById('wrGps').textContent).toContain('Recording stopped');
    });

    test('a saved walk is stamped and uniquely named so the account can take it', () => {
      const entry = recordWith(send => {
        for(let i = 1; i <= 30; i++) send(46.5 + i * 0.0001, 11.6, T0 + i * 2000);
      });
      expect(entry.id).toMatch(/^w\d+-[0-9a-f]{12}(\.[0-9a-z]+)?$/);
      expect(entry.updatedAt).toBe(T0 + 30 * 2000);
      expect(window.DoloPawsJournalStore.entriesToPush([entry], [])).toEqual([entry]);
    });
  });

  test('the screen lock is asked for in the tap, not after the location lookup', () => {
    const request = jest.fn(() => Promise.resolve({ release(){ return Promise.resolve(); } }));
    Object.defineProperty(navigator, 'wakeLock', { configurable:true, value:{ request } });
    let locate;
    setGeolocation({ getCurrentPosition:jest.fn(success => { locate = success; }) });
    const auth = { currentUser:null, authResolved:false, onChange:jest.fn() };
    const view = renderWalkPage(auth, { uid:'user-1', name:'Eddie' });
    view.start.click();
    // A request made later, from the geolocation callback, has lost the user
    // gesture; a browser that refuses it lets the screen sleep and the page
    // freeze, which is how a recording stops without saying so.
    expect(request).toHaveBeenCalledWith('screen');
    locate({ coords:{ latitude:46.5, longitude:11.6, accuracy:15 }, timestamp:Date.now() });
    expect(view.recorder.start).toHaveBeenCalledTimes(1);
    delete navigator.wakeLock;
  });

  test('the live trace draws each tracked stretch on its own', () => {
    expect(source).toContain("type: 'MultiLineString'");
    expect(source).toContain('recorder.summary(Date.now()).segments');
  });

  test('Firebase stores the UID and does not notify before auth resolves', () => {
    const firebase = fs.readFileSync(path.join(__dirname, 'firebase-init.js'), 'utf8');
    expect(firebase).toContain('uid: user.uid');
    expect(firebase).toContain('if (authResolved) fn(currentUser)');
  });

  test('recorder map includes live position, accuracy, and homepage map controls', () => {
    expect(source).toContain("map.addSource('walk-position'");
    expect(source).toContain("id: 'walk-position-accuracy'");
    expect(source).toContain("id: 'walk-position-dot'");
    expect(source).toContain('Marked hiking routes');
    expect(source).toContain("lazyLayerChip('Lifts'");
    expect(source).toContain("lazyLayerChip('Water'");
    expect(source).toContain("lazyLayerChip('Huts'");
    expect(source).toContain("lazyLayerChip('Food'");
    expect(source).toContain('Satellite');
    expect(source).toContain('data-wr-3d');
    expect(source).toContain('Centre map on my position');
    expect(source).toContain("'raster-opacity': 1");
    expect(source).toMatch(/id: 'walk-line'[\s\S]*?}, 'waymarked-hiking-layer'\);/);
  });
});
