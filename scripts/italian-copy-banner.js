'use strict';

// An Italian reader who lands on the English copy of a page (a search result,
// a shared link) is offered its Italian copy at /it/... in a line under the
// top bar. Italian means their saved choice, else the browser language: the
// same rule as i18n.js. It is a link, not a redirect, so search engines and
// anyone who wants the English page keep it (seo-trail-handoff.test.js). The
// line sits in the head of the English guides, legal pages and trail pages;
// the Italian copies leave it out. The phone app ships no Italian copies, so
// scripts/build-app.js takes the line out there.
const ITALIAN_COPY_BANNER = "<script>(function(){try{var l=localStorage.getItem('dolopaws-lang');if(l!=='it'&&(l||!/^it/i.test(navigator.language||'')))return;document.addEventListener('DOMContentLoaded',function(){var a=document.createElement('a');a.href='/it'+location.pathname+location.search+location.hash;a.lang='it';a.className='orma-it-copy';a.textContent='Questa pagina è disponibile in italiano →';a.style.cssText='display:block;padding:10px 16px;background:#E8EFE6;color:#2E4034;font:600 14px/1.4 Inter,system-ui,sans-serif;text-align:center;text-decoration:underline;text-underline-offset:3px';var n=document.querySelector('.topnav');n?n.after(a):document.body.prepend(a)})}catch(e){}})();</script>";

module.exports = { ITALIAN_COPY_BANNER };
