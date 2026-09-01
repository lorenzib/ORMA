const fs = require('fs');
const path = require('path');

const wizardSource = fs.readFileSync(path.join(__dirname, 'dog-wizard.js'), 'utf8');

function installWizard(auth) {
  document.body.innerHTML = `
    <div id="dogWizard" hidden>
      <h2 id="dwTitle"></h2><p id="dwSubtitle"></p>
      <div id="dwProgress"><span></span></div><span id="dwStepCount"></span>
      <div id="dwStepper"></div><div id="dwBody"></div>
      <div id="dwFooter"><button id="dwBackBtn">Back</button><button id="dwNextBtn">Next</button></div>
      <button id="dwCloseBtn">Close</button>
    </div><div id="dwToast" hidden></div>`;
  window.DoloPawsAuth = auth;
  window.eval(wizardSource);
}

function change(id, value) {
  const element = document.getElementById(id);
  element.value = value;
  element.dispatchEvent(new Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles:true }));
}

function advanceToReview() {
  change('dwName', 'Eddie');
  change('dwAgeBand', '5-6');
  document.getElementById('dwNextBtn').click();
  change('dwBreed', 'Podenco Andaluz');
  document.querySelector('[data-key="fitness"][data-value="high"]').click();
  document.getElementById('dwNextBtn').click();
  document.getElementById('dwNextBtn').click();
}

async function flushSave() {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

describe('add-dog wizard persistence', () => {
  beforeEach(() => { jest.useFakeTimers(); localStorage.clear(); });
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    delete window.DoloPawsWizard;
    delete window.DoloPawsAuth;
  });

  test('adds another dog without a preliminary profile read', async () => {
    const auth = {
      currentUser:{ uid:'owner-1' }, getDogProfiles:jest.fn(),
      addDogProfile:jest.fn(async () => true), setDogProfile:jest.fn(async () => true),
    };
    installWizard(auth);
    window.DoloPawsWizard.open();
    advanceToReview();
    document.getElementById('dwNextBtn').click();
    expect(document.getElementById('dwNextBtn').textContent).toBe('Saving…');
    await flushSave();
    expect(auth.getDogProfiles).not.toHaveBeenCalled();
    expect(auth.addDogProfile).toHaveBeenCalledTimes(1);
    expect(auth.setDogProfile).not.toHaveBeenCalled();
    expect(document.getElementById('dogWizard').hidden).toBe(true);
  });

  test('recovers the save button when persistence rejects', async () => {
    const auth = {
      currentUser:{ uid:'owner-1' },
      addDogProfile:jest.fn(() => Promise.reject(new Error('offline'))), setDogProfile:jest.fn(),
    };
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    installWizard(auth);
    window.DoloPawsWizard.open();
    advanceToReview();
    document.getElementById('dwNextBtn').click();
    await flushSave();
    const saveButton = document.getElementById('dwNextBtn');
    expect(saveButton.disabled).toBe(false);
    expect(saveButton.textContent).toBe('Save dog');
    expect(document.getElementById('dwToast').textContent).toContain('Check your connection');
    expect(document.getElementById('dogWizard').hidden).toBe(false);
    consoleError.mockRestore();
  });

  test('saves edits to the original dog instead of creating a duplicate', async () => {
    const auth = {
      currentUser:{ uid:'owner-1' }, addDogProfile:jest.fn(), setDogProfile:jest.fn(async () => true),
    };
    installWizard(auth);
    window.DoloPawsWizard.open({
      id:'eddie-1', name:'Eddie', ageBand:'5-6', breed:'Podenco Andaluz', fitness:'high',
    });
    for (let step = 0; step < 4; step += 1) document.getElementById('dwNextBtn').click();
    await flushSave();
    expect(auth.setDogProfile).toHaveBeenCalledWith(expect.objectContaining({ name:'Eddie' }), 'eddie-1');
    expect(auth.addDogProfile).not.toHaveBeenCalled();
  });
});
