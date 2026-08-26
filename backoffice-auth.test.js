'use strict';

const fs=require('fs');
const path=require('path');
const {TextEncoder,TextDecoder}=require('util');
global.TextEncoder=global.TextEncoder||TextEncoder;global.TextDecoder=global.TextDecoder||TextDecoder;
const {JSDOM}=require('jsdom');

const root=__dirname;
const protectedPages=[
  'backoffice-review.html','trail-dossier-desk.html','trail-content-desk.html',
  'content-desk.html','new-trail-scouting-desk.html','hazard-review-desk.html',
  'image-coverage-desk.html','newsletter-desk.html','social-desk.html',
  'product-ideas-desk.html',
];

describe('private ORMA backoffice authentication',()=>{
  test('uses a dedicated unlinked login with no public-app navigation',()=>{
    const login=fs.readFileSync(path.join(root,'backoffice-login.html'),'utf8');
    const publicHome=fs.readFileSync(path.join(root,'index.html'),'utf8');
    expect(login).toContain('Restricted operator access');
    expect(login).toContain('noindex,nofollow,noarchive');
    expect(login).not.toContain('Browse all Trails');
    expect(publicHome).not.toContain('backoffice-login.html');
    expect(publicHome).not.toContain('backoffice-review.html');
  });

  test.each(protectedPages)('%s requires the shared moderator guard',page=>{
    const html=fs.readFileSync(path.join(root,page),'utf8');
    expect(html).toContain("classList.add('bo-auth-pending')");
    expect(html).toContain('src="firebase-init.js"');
    expect(html).toContain('src="backoffice-auth-guard.js');
  });

  test('local development remains available without a moderator session',async()=>{
    const script=fs.readFileSync(path.join(root,'backoffice-auth-guard.js'),'utf8');
    const dom=new JSDOM('<!doctype html><html class="bo-auth-pending"><body></body></html>',{url:'http://localhost:4173/backoffice-review.html',runScripts:'outside-only'});
    dom.window.eval(script);
    await new Promise(resolve=>dom.window.setTimeout(resolve,0));
    expect(dom.window.document.documentElement.classList.contains('bo-auth-pending')).toBe(false);
    expect(dom.window.document.documentElement.classList.contains('bo-authenticated')).toBe(true);
    dom.window.close();
  });

  test('keeps the hosted login visible while authentication resolves',()=>{
    const styles=fs.readFileSync(path.join(root,'backoffice-review.css'),'utf8');
    expect(styles).not.toContain('html.bo-auth-pending body{visibility:hidden}');
  });

  test('cache-busts the hosted Firebase module',()=>{
    const login=fs.readFileSync(path.join(root,'backoffice-hosted-login.html'),'utf8');
    const build=fs.readFileSync(path.join(root,'scripts/build-backoffice-hosting.js'),'utf8');
    const firebase=fs.readFileSync(path.join(root,'backoffice-firebase.js'),'utf8');
    expect(login).toContain('backoffice-firebase.js?v=20260826-1');
    expect(build).toContain('backoffice-firebase.js?v=20260826-1');
    expect(firebase).toContain('authDomain: "dolopaws.firebaseapp.com"');
  });
});
