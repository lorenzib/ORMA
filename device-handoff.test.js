'use strict';

const fs=require('fs');
const path=require('path');
const { expectBundled, expectTrailBundleLoaded } = require('./test-support/trail-runtime.js');

const source=fs.readFileSync(path.join(__dirname,'device-handoff.js'),'utf8');

function isolatedWindow({mobile=false}={}){
  const frame=document.createElement('iframe');
  document.body.appendChild(frame);
  const target=frame.contentWindow;
  Object.defineProperty(target.navigator,'userAgentData',{configurable:true,value:{mobile}});
  target.matchMedia=jest.fn(query=>({
    matches:mobile&&query.includes('pointer: coarse'),
    addEventListener:jest.fn(),removeEventListener:jest.fn(),
  }));
  target.document.head.innerHTML='';
  target.document.body.innerHTML='<main><a id="record" href="http://localhost/walk.html">Record a walk</a><button id="start">Start hike</button></main>';
  target.eval(source);
  return target;
}

describe('desktop-to-phone handoff',()=>{
  beforeEach(()=>{document.body.innerHTML='';});

  test('opens the phone handoff instead of recording on a laptop',()=>{
    const target=isolatedWindow();
    const link=target.document.getElementById('record');
    const click=new target.MouseEvent('click',{bubbles:true,cancelable:true,button:0});
    link.dispatchEvent(click);

    expect(click.defaultPrevented).toBe(true);
    const dialog=target.document.querySelector('.device-handoff');
    expect(dialog.hidden).toBe(false);
    expect(dialog.querySelector('h2').textContent).toBe('Record your walk on your phone');
    expect(dialog.querySelector('.device-handoff__url').textContent).toBe('https://www.app-orma.com/walk.html');
    const qr=dialog.querySelector('.device-handoff__qr svg');
    expect(qr).not.toBeNull();
    expect(qr.getAttribute('aria-label')).toBe('QR code to open this action on your phone');
    expect(qr.querySelector('path').getAttribute('d').length).toBeGreaterThan(500);
    expect(source).not.toContain('api.qrserver.com');
    expect(target.document.body.style.overflow).toBe('hidden');
  });

  test('keeps Record a walk as a direct link on phones and tablets',()=>{
    const target=isolatedWindow({mobile:true});
    const link=target.document.getElementById('record');
    const click=new target.MouseEvent('click',{bubbles:true,cancelable:true,button:0});
    link.dispatchEvent(click);

    expect(click.defaultPrevented).toBe(false);
    expect(target.document.querySelector('.device-handoff')).toBeNull();
    expect(target.ORMADeviceHandoff.isHandheld()).toBe(true);
  });

  test('preserves the trail and hike deep link when sending to a phone',()=>{
    const target=isolatedWindow();
    const url=target.ORMADeviceHandoff.mobileUrlFor('http://127.0.0.1:4173/trail.html?id=roda-dles-viles&hike=1#start-hike');
    expect(url).toBe('https://www.app-orma.com/trail.html?id=roda-dles-viles&hike=1#start-hike');
  });

  test('closes with Escape and restores page scrolling',()=>{
    const target=isolatedWindow();
    target.ORMADeviceHandoff.open({url:'http://localhost/walk.html'});
    const dialog=target.document.querySelector('.device-handoff');
    dialog.dispatchEvent(new target.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
    expect(dialog.hidden).toBe(true);
    expect(target.document.body.style.overflow).toBe('');
  });

  test('hike mode hands new desktop sessions to the phone deep link',()=>{
    const hikeMode=fs.readFileSync(path.join(__dirname,'hike-mode.js'),'utf8');
    const trailPage=fs.readFileSync(path.join(__dirname,'trail.html'),'utf8');
    expect(hikeMode).toContain("phoneUrl.searchParams.set('hike','1')");
    expect(hikeMode).toContain("phoneUrl.searchParams.delete('from')");
    expect(hikeMode).toContain("phoneUrl.hash='start-hike'");
    expect(hikeMode).toContain('window.ORMADeviceHandoff.shouldHandoff()');
    expect(hikeMode).toContain("'dolopaws-hike-mode-ready'");
    expect(trailPage).toContain('device-handoff.js?v=20260904-1');
    expectTrailBundleLoaded();
    expectBundled('hike-mode.js');
  });

  test('a mobile hike deep link starts independently while the map loads in the background',()=>{
    const trail=fs.readFileSync(path.join(__dirname,'trail.js'),'utf8');
    const hikeMode=fs.readFileSync(path.join(__dirname,'hike-mode.js'),'utf8');
    expect(trail).toContain("const hikeDeepLinkRequested = params.get('hike') === '1'");
    expect(trail).toContain('initHikeMode(null, t, { container:hikeModeContainer })');
    expect(trail).toContain('hikeModeController.attachMap(map)');
    expect(trail).toContain('if(hikeDeepLinkRequested && detailMapSchedule && detailMapSchedule.start)');
    expect(trail).toContain('detailMapSchedule.start()');
    expect(trail).not.toContain('Preparing hike guidance…');
    expect(hikeMode).toContain('return { attachMap }');
    expect(hikeMode).toContain('if(map && map.easeTo && map.getZoom)');
  });
});
