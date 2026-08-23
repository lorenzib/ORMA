(function () {
  'use strict';

  const tabs = Array.from(document.querySelectorAll('[data-paw-surface]'));
  const panels = Array.from(document.querySelectorAll('[data-paw-panel]'));

  function selectSurface(surface, focusTab) {
    tabs.forEach((tab) => {
      const selected = tab.dataset.pawSurface === surface;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && focusTab) tab.focus();
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.pawPanel !== surface;
    });
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectSurface(tab.dataset.pawSurface, false));
    tab.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      let nextIndex = index;
      if (event.key === 'Home') nextIndex = 0;
      else if (event.key === 'End') nextIndex = tabs.length - 1;
      else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % tabs.length;
      else nextIndex = (index - 1 + tabs.length) % tabs.length;
      selectSurface(tabs[nextIndex].dataset.pawSurface, true);
    });
  });

  if (tabs.length) selectSurface(tabs[0].dataset.pawSurface, false);

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
