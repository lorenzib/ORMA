(function () {
  'use strict';

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', () => {
      const target = document.querySelector(link.getAttribute('href'));
      if (target && target.tagName === 'DETAILS') target.open = true;
    });
  });

  function openLinkedDetail() {
    if (!window.location.hash) return;
    const target = document.querySelector(window.location.hash);
    if (target && target.tagName === 'DETAILS') target.open = true;
  }

  window.addEventListener('hashchange', openLinkedDetail);
  openLinkedDetail();
})();
