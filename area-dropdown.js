(function(global){
  'use strict';

  const instances = new Set();

  function enhance(select){
    if(!select) return null;
    if(select._ormaAreaDropdown) return select._ormaAreaDropdown;

    const shell = select.closest('.area-select-shell');
    if(!shell) return null;

    const menuId = `${select.id}Menu`;
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'area-select-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', menuId);
    trigger.setAttribute('aria-label', select.getAttribute('aria-label') || 'Choose an option');
    const controlKicker = select.dataset.controlKicker;
    if(controlKicker){
      trigger.classList.add('area-select-trigger--kicker');
      if(select.hasAttribute('data-kicker-until-selected')){
        trigger.classList.add('area-select-trigger--kicker-until-selected');
      }
      trigger.innerHTML = '<span class="area-select-trigger__copy"><span class="area-select-trigger__kicker"></span><span class="area-select-trigger__label"></span></span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      trigger.querySelector('.area-select-trigger__kicker').textContent = controlKicker;
    }else{
      trigger.innerHTML = '<span class="area-select-trigger__label"></span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }

    const menu = document.createElement('div');
    menu.id = menuId;
    menu.className = 'area-select-menu';
    menu.setAttribute('role', 'listbox');
    menu.setAttribute('aria-label', select.getAttribute('aria-label') || 'Options');
    menu.hidden = true;

    select.classList.add('area-native-select');
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');
    shell.append(trigger, menu);

    function close(){
      menu.hidden = true;
      shell.removeAttribute('data-open');
      trigger.setAttribute('aria-expanded', 'false');
    }

    function refresh(){
      const selected = select.options[select.selectedIndex] || select.options[0];
      const selectedLabel = selected ? selected.textContent : 'Choose';
      trigger.classList.toggle('area-select-trigger--has-selection',
        !select.hasAttribute('data-kicker-until-selected') || select.value !== 'all');
      trigger.querySelector('.area-select-trigger__label').textContent = select.hasAttribute('data-compact-label')
        ? selectedLabel.replace(/\s+\(\d+\)$/, '')
        : selectedLabel;
      menu.replaceChildren(...Array.from(select.options).map(nativeOption => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'area-select-option';
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', String(nativeOption.value === select.value));
        item.dataset.value = nativeOption.value;
        item.innerHTML = `<span>${nativeOption.textContent}</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 8.5 3 3 6-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        item.addEventListener('click', () => {
          select.value = nativeOption.value;
          select.dispatchEvent(new Event('change', { bubbles:true }));
          close();
          trigger.focus();
        });
        return item;
      }));
    }

    function open(){
      instances.forEach(instance => { if(instance !== api) instance.close(); });
      refresh();
      menu.hidden = false;
      shell.setAttribute('data-open', '');
      trigger.setAttribute('aria-expanded', 'true');
    }

    trigger.addEventListener('click', () => menu.hidden ? open() : close());
    trigger.addEventListener('keydown', event => {
      if(event.key === 'ArrowDown' || event.key === 'ArrowUp'){
        event.preventDefault();
        open();
        const selectedItem = menu.querySelector('[aria-selected="true"]');
        (selectedItem || menu.querySelector('.area-select-option'))?.focus();
      }
      if(event.key === 'Escape') close();
    });
    menu.addEventListener('keydown', event => {
      const items = Array.from(menu.querySelectorAll('.area-select-option'));
      const current = items.indexOf(document.activeElement);
      if(event.key === 'Escape'){
        event.preventDefault();
        close();
        trigger.focus();
      }else if(event.key === 'ArrowDown' || event.key === 'ArrowUp'){
        event.preventDefault();
        const delta = event.key === 'ArrowDown' ? 1 : -1;
        items[(current + delta + items.length) % items.length]?.focus();
      }else if(event.key === 'Home' || event.key === 'End'){
        event.preventDefault();
        items[event.key === 'Home' ? 0 : items.length - 1]?.focus();
      }
    });
    document.addEventListener('click', event => { if(!shell.contains(event.target)) close(); });

    const api = { refresh, close };
    select._ormaAreaDropdown = api;
    instances.add(api);
    refresh();
    return api;
  }

  global.OrmaAreaDropdown = { enhance };
})(typeof window !== 'undefined' ? window : globalThis);
