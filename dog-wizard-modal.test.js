const fs = require('fs');
const path = require('path');

const wizardScript = fs.readFileSync(path.join(__dirname, 'dog-wizard.js'), 'utf8');
const styles = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');

describe('shared dog-profile modal', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '<button id="profileOpener">Add your dog</button>';
    window.eval(wizardScript);
  });

  test('injects and opens the same wizard on pages without homepage markup', () => {
    const opener = document.getElementById('profileOpener');
    window.DoloPawsWizard.open(null, { opener });

    expect(document.getElementById('dogWizard')).not.toBeNull();
    expect(document.getElementById('dogWizard').hidden).toBe(false);
    expect(document.getElementById('dwTitle').textContent).toBe('Add a dog');
  });

  test('clicking the backdrop closes immediately and returns focus', () => {
    const opener = document.getElementById('profileOpener');
    opener.focus();
    window.DoloPawsWizard.open(null, { opener });
    const overlay = document.getElementById('dogWizard');

    overlay.dispatchEvent(new MouseEvent('click', { bubbles:true, cancelable:true }));

    expect(overlay.hidden).toBe(true);
    expect(document.activeElement).toBe(opener);
  });

  test('uses the guest-home modal surface and backdrop colours', () => {
    expect(styles).toContain('.dw-overlay{position:fixed;inset:0;background:rgba(23,42,28,.55)');
    expect(styles).toContain('.dw-modal{position:relative;background:var(--bg);');
    expect(styles).toContain('.auth-modal-redesign.modal-overlay{background:rgba(23,42,28,.55);');
  });
});
