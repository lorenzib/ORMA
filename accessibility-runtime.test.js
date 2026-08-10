const path = require('path');

describe('shared accessibility runtime', () => {
  let a11y;

  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = '';
    window.requestAnimationFrame = callback => callback();
    global.requestAnimationFrame = window.requestAnimationFrame;
    a11y = require(path.join(__dirname, 'accessibility-runtime.js'));
  });

  test('traps dialog focus, handles Escape, and restores the opener', () => {
    document.body.innerHTML = `
      <button id="opener">Open</button>
      <div id="dialog" role="dialog">
        <button id="first">First</button>
        <button id="last">Last</button>
      </div>`;
    const opener = document.getElementById('opener');
    const dialog = document.getElementById('dialog');
    const first = document.getElementById('first');
    const last = document.getElementById('last');
    const onEscape = jest.fn();
    opener.focus();

    const release = a11y.openDialog(dialog, { initialFocus:'#first', onEscape });
    expect(document.activeElement).toBe(first);

    last.focus();
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key:'Tab', bubbles:true }));
    expect(document.activeElement).toBe(first);

    first.focus();
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key:'Tab', shiftKey:true, bubbles:true }));
    expect(document.activeElement).toBe(last);

    dialog.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', bubbles:true }));
    expect(onEscape).toHaveBeenCalledTimes(1);
    release();
    expect(document.activeElement).toBe(opener);
  });

  test('makes a radio group roving and arrow-key operable', () => {
    document.body.innerHTML = `
      <div id="group" role="radiogroup">
        <button role="radio" data-value="a" aria-checked="true">A</button>
        <button role="radio" data-value="b" aria-checked="false">B</button>
      </div>`;
    const group = document.getElementById('group');
    const items = Array.from(group.querySelectorAll('[role="radio"]'));
    a11y.wireRadioGroup(group, target => {
      items.forEach(item => item.setAttribute('aria-checked', String(item === target)));
      return target;
    });

    expect(items.map(item => item.tabIndex)).toEqual([0, -1]);
    items[0].focus();
    group.dispatchEvent(new KeyboardEvent('keydown', { key:'ArrowRight', bubbles:true }));
    expect(items[1].getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(items[1]);
  });
});
