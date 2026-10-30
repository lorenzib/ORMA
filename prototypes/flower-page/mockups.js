// Shared helpers for the flower-page mockups. Reads the live plant catalogue.
(function(global){
  'use strict';
  const RISK = {
    dangerous:{ label:'Dangerous', short:'Keep out of mouth', order:0 },
    caution:{ label:'In-between', short:'No chewing or contact', order:1 },
    safe:{ label:'Low concern', short:'Safe to pass, not to eat', order:2 },
  };
  const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const api = global.DoloPawsAlpinePlants || {};

  function esc(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
  }
  // Catalogue image paths are relative to /guides/; mockups live two levels down.
  function img(plant){ return plant.image && plant.image.src ? plant.image.src.replace(/^\.\.\//, '../../') : ''; }
  function tag(safety){ return `<span class="fm-tag fm-tag--${safety}"><span class="fm-dot fm-dot--${safety}"></span>${RISK[safety].label}</span>`; }
  function monthsBar(plant, labels){
    const on = new Set(plant.floweringMonths || []);
    const cells = MONTH_SHORT.map((m, i) => `<span class="${on.has(i + 1) ? 'on' : ''}" title="${m}"></span>`).join('');
    const legend = labels ? `<div class="fm-months-labels">${MONTH_SHORT.map(m => `<span>${m[0]}</span>`).join('')}</div>` : '';
    return `<div class="fm-months fm-months--${plant.safety}">${cells}</div>${legend}`;
  }
  function avoidText(plant){
    const card = api.plantCard ? api.plantCard(plant) : '';
    const match = card.match(/<b>Avoid:<\/b>\s*([^<]*)/);
    return match ? match[1].trim() : plant.summary;
  }
  function sortPlants(list){
    return list.slice().sort((a, b) => RISK[a.safety].order - RISK[b.safety].order || a.commonName.localeCompare(b.commonName));
  }
  function load(){
    return fetch('../../data/alpine-plants.json').then(r => r.json()).then(d => sortPlants(d.plants || []));
  }
  function bindHelp(){
    document.querySelectorAll('.fm-help').forEach(help => {
      const button = help.querySelector('.fm-help-btn');
      if(!button) return;
      button.addEventListener('click', () => {
        const open = help.classList.toggle('open');
        button.setAttribute('aria-expanded', String(open));
        button.textContent = open ? 'Hide steps' : 'What to do, step by step';
      });
    });
  }
  global.FlowerMock = { RISK, MONTH_SHORT, esc, img, tag, monthsBar, avoidText, load, bindHelp, habitatFacets:api.habitatFacets, HABITATS:api.HABITATS };
})(window);
