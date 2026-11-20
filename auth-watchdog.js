// Pages that wait for sign-in (Account, Saved, Settings, Journal) used to wait
// forever when firebase-init.js could not load: on a mountain with weak
// signal the page sat on its loading placeholder with no way out. After
// AUTH_WAIT_MS without 'dolopaws-auth-ready' this says so and offers a retry.
(function(root){
  'use strict';
  var AUTH_WAIT_MS = 10000;

  function say(key, fallback){
    var value = typeof root.t === 'function' ? root.t(key) : '';
    return value && value !== key ? value : fallback;
  }

  function notice(doc){
    var box = doc.createElement('div');
    box.className = 'auth-unavailable';
    box.setAttribute('role', 'alert');
    box.style.cssText = 'margin:16px auto;max-width:640px;padding:16px 18px;border:1px solid var(--paper-line,#ddd);'
      + 'border-radius:14px;background:var(--card,#fff);color:var(--ink,#222);font-size:15px;line-height:1.45;';
    var text = doc.createElement('p');
    text.style.margin = '0 0 10px';
    text.textContent = say('auth.unavailable',
      'We can’t reach ORMA’s sign-in right now. Check your signal and try again.');
    var button = doc.createElement('button');
    button.type = 'button';
    button.className = 'empty-state__action';
    button.textContent = say('auth.unavailable.retry', 'Try again');
    button.addEventListener('click', function(){ root.location.reload(); });
    box.appendChild(text);
    box.appendChild(button);
    return box;
  }

  function giveUp(doc){
    if(root.DoloPawsAuthReady || doc.querySelector('.auth-unavailable')) return false;
    root.DoloPawsAuthUnavailable = true;
    Array.prototype.forEach.call(doc.querySelectorAll('[data-auth-loading]'), function(el){
      el.hidden = true;
      el.removeAttribute('aria-busy');
    });
    // Just above the page's own heading, below the site header and banners.
    var heading = doc.querySelector('.section-page-head') || doc.querySelector('h1');
    var box = notice(doc);
    if(heading && heading.parentNode) heading.parentNode.insertBefore(box, heading);
    else doc.body.insertBefore(box, doc.body.firstChild);
    root.dispatchEvent(new CustomEvent('dolopaws-auth-unavailable'));
    return true;
  }

  function watch(doc, waitMs){
    var timer = setTimeout(function(){
      if(doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', function(){ giveUp(doc); }, { once:true });
      else giveUp(doc);
    }, waitMs);
    root.addEventListener('dolopaws-auth-ready', function(){
      clearTimeout(timer);
      var box = doc.querySelector('.auth-unavailable');
      if(box) box.remove();
      root.DoloPawsAuthUnavailable = false;
    }, { once:true });
    return timer;
  }

  var api = { AUTH_WAIT_MS:AUTH_WAIT_MS, giveUp:giveUp, watch:watch };
  root.DoloPawsAuthWatchdog = api;
  if(typeof module === 'object' && module.exports) module.exports = api;
  else if(root.document) watch(root.document, AUTH_WAIT_MS);
})(typeof window !== 'undefined' ? window : globalThis);
