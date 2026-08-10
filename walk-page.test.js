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

describe('walk recorder authentication restoration', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    delete window.maplibregl;
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    delete window.DoloPawsAuth;
    delete window.DoloPawsAuthReady;
    delete window.DoloPawsWalkRecorder;
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
    expect(source).toContain('Satellite');
    expect(source).toContain('data-wr-3d');
    expect(source).toContain('Centre map on my position');
  });
});
