'use strict';

// The loop, as reported: "the page continuously prompts me to log in".
//
// Reading the moderator claim minted a new token every call, and twenty-seven
// call sites go through that check -- nine of them while one desk is still
// loading. Firebase rate-limits the token endpoint; the limit arrives as a
// throw; the throw was caught and returned as a bare null, which every caller
// reads as "not a moderator". So a moderator in good standing was told she had
// no access and sent back to sign in, where the same check failed the same way.
//
// These drive the guard directly rather than a browser, because what went wrong
// is the shape of an answer, not the drawing of a page.

const fs=require('fs');
const path=require('path');
const vm=require('vm');

const GUARD=fs.readFileSync(path.join(__dirname,'backoffice-auth-guard.js'),'utf8');

/** The guard closes over the window it was loaded with, so each case gets one. */
function pageAt(page,moderation,currentUser){
  const redirects=[];
  const root={
    location:{hostname:'backoffice.app-orma.com',pathname:`/${page}`,
      replace:url=>redirects.push(url)},
    document:{documentElement:{classList:{add(){},remove(){}}}},
    addEventListener(){},dispatchEvent(){},
    CustomEvent:class{constructor(type,init){this.type=type;Object.assign(this,init);}},
    URLSearchParams,
    DoloPawsAuthReady:true,
    DoloPawsModeration:moderation,
    DoloPawsAuth:{currentUser},
  };
  return {root,redirects};
}

/** Load the guard against that window and let its own start() run enforce. */
async function enforceWith(root){
  const context=vm.createContext({window:root,globalThis:root,module:{exports:{}},URLSearchParams,setTimeout,CustomEvent:root.CustomEvent});
  vm.runInContext(GUARD,context);
  await new Promise(resolve=>setTimeout(resolve,0));
}
const reasonOf=url=>new URLSearchParams(url.split('?')[1]||'').get('reason');

describe('a moderator is not locked out by a check that failed',()=>{
  const signedIn={uid:'mod-1'};

  test('a claim that could not be read sends her back as check-failed, not forbidden',async()=>{
    const {root,redirects}=pageAt('trail-verify-desk.html',
      {getModeratorStatus:async()=>({ok:false,reason:'check-failed',error:'Sign-in is temporarily limited.'})},signedIn);
    await enforceWith(root);
    expect(redirects).toHaveLength(1);
    expect(reasonOf(redirects[0])).toBe('check-failed');
  });

  test('an account genuinely without the claim is still forbidden',async()=>{
    const {root,redirects}=pageAt('trail-verify-desk.html',
      {getModeratorStatus:async()=>({ok:false,reason:'not-moderator'})},signedIn);
    await enforceWith(root);
    expect(reasonOf(redirects[0])).toBe('not-moderator');
  });

  test('a signed-out visitor is signed-out',async()=>{
    const {root,redirects}=pageAt('trail-verify-desk.html',
      {getModeratorStatus:async()=>({ok:false,reason:'signed-out'})},null);
    await enforceWith(root);
    expect(reasonOf(redirects[0])).toBe('signed-out');
  });

  test('a moderator is let through and never redirected',async()=>{
    const {root,redirects}=pageAt('trail-verify-desk.html',
      {getModeratorStatus:async()=>({ok:true,uid:'mod-1'})},signedIn);
    await enforceWith(root);
    expect(redirects).toEqual([]);
  });
});

describe('the login page says which of the two happened',()=>{
  const source=fs.readFileSync(path.join(__dirname,'backoffice-login.js'),'utf8');

  test('it reads the reason the guard sent, which nothing did before',()=>{
    expect(source).toContain("params.get('reason')");
  });

  test('a failed check is described as temporary, not as a wrong account',()=>{
    const message=source.match(/'check-failed':'([^']+)'/);
    expect(message).not.toBeNull();
    expect(message[1]).toMatch(/try again/i);
    expect(message[1]).not.toMatch(/does not have/i);
  });

  test('and a refusal still tells her to use the authorized account',()=>{
    expect(source).toMatch(/forbidden:'This account does not have ORMA backoffice access/);
  });
});

describe('the claim is not re-minted on every call',()=>{
  const source=fs.readFileSync(path.join(__dirname,'backoffice-firebase.js'),'utf8');

  test('a positive answer is held rather than asked again',()=>{
    expect(source).toContain('CLAIM_TTL_MS');
    expect(source).toContain('claimCache');
  });

  // Twenty-seven call sites reach the check. Without a cache each one asks
  // Firebase for a new token, and that is what trips the limit.
  test('every gated call still goes through one check',()=>{
    const gated=(source.match(/await moderatorIdentity\(\)/g)||[]).length;
    expect(gated).toBeGreaterThan(20);
  });

  // A claim granted after the current token was minted is invisible until a
  // refresh, so a cached "no" must never be trusted.
  test('a negative answer is never served from the cache',()=>{
    const body=source.match(/async function moderatorCheck\(\)\{[\s\S]*?\n\}/)[0];
    expect(body).toMatch(/cached&&cached\.moderator/);
    expect(body).toContain('getIdTokenResult(currentUser,true)');
  });

  test('a failed check records nothing about the account',()=>{
    const body=source.match(/async function moderatorCheck\(\)\{[\s\S]*?\n\}/)[0];
    const afterCatch=body.slice(body.indexOf('catch'));
    expect(afterCatch).not.toContain('claimCache=');
  });
});
