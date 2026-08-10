(function(global){
  'use strict';

  const FOCUSABLE = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  function visibleFocusable(root){
    return Array.from(root.querySelectorAll(FOCUSABLE)).filter(element =>
      !element.hidden && element.getAttribute('aria-hidden') !== 'true' &&
      !element.closest('[hidden]')
    );
  }

  function openDialog(dialog, options){
    if(!dialog) return function(){};
    const opts = options || {};
    const returnFocus = document.activeElement && document.activeElement !== document.body
      ? document.activeElement : null;
    let closed = false;

    function focusInitial(){
      let target = null;
      if(typeof opts.initialFocus === 'function') target = opts.initialFocus(dialog);
      else if(typeof opts.initialFocus === 'string') target = dialog.querySelector(opts.initialFocus);
      if(!target) target = visibleFocusable(dialog)[0] || dialog;
      if(target === dialog && !dialog.hasAttribute('tabindex')) dialog.setAttribute('tabindex', '-1');
      target.focus();
    }

    function onKeyDown(event){
      if(event.key === 'Escape' && opts.closeOnEscape !== false){
        event.preventDefault();
        if(typeof opts.onEscape === 'function') opts.onEscape();
        return;
      }
      if(event.key !== 'Tab') return;
      const focusable = visibleFocusable(dialog);
      if(!focusable.length){
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if(event.shiftKey && document.activeElement === first){
        event.preventDefault();
        last.focus();
      }else if(!event.shiftKey && document.activeElement === last){
        event.preventDefault();
        first.focus();
      }
    }

    dialog.addEventListener('keydown', onKeyDown);
    requestAnimationFrame(focusInitial);
    return function closeDialog(){
      if(closed) return;
      closed = true;
      dialog.removeEventListener('keydown', onKeyDown);
      if(opts.restoreFocus !== false && returnFocus && document.contains(returnFocus)) returnFocus.focus();
    };
  }

  function wireRadioGroup(group, onSelect){
    if(!group) return;
    const radios = () => Array.from(group.querySelectorAll('[role="radio"]:not([disabled])'));
    const sync = () => {
      const items = radios();
      let active = items.find(item => item.getAttribute('aria-checked') === 'true') || items[0];
      items.forEach(item => { item.tabIndex = item === active ? 0 : -1; });
    };
    group.onkeydown = event => {
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)) return;
      const items = radios();
      if(!items.length) return;
      event.preventDefault();
      const current = Math.max(0, items.indexOf(document.activeElement));
      let next = current;
      if(event.key === 'Home') next = 0;
      else if(event.key === 'End') next = items.length - 1;
      else if(event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (current - 1 + items.length) % items.length;
      else next = (current + 1) % items.length;
      const target = items[next];
      const replacement = typeof onSelect === 'function' ? onSelect(target) : (target.click(), null);
      requestAnimationFrame(() => {
        const focusTarget = replacement && replacement.focus
          ? replacement
          : group.querySelector('[role="radio"][aria-checked="true"]') || target;
        if(document.contains(focusTarget)) focusTarget.focus();
      });
    };
    sync();
  }

  global.DoloPawsA11y = { FOCUSABLE, visibleFocusable, openDialog, wireRadioGroup };
  if(typeof module !== 'undefined' && module.exports){
    module.exports = global.DoloPawsA11y;
  }
})(typeof window !== 'undefined' ? window : globalThis);
