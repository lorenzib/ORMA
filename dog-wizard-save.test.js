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
  advanceToSaveStep();
}

// Every step after the breed step is optional, so walk forward until the
// footer offers the save action. Counting clicks would silently break the
// save assertions each time a step is added to the wizard.
function advanceToSaveStep() {
  const nextBtn = document.getElementById('dwNextBtn');
  for (let index = 0; index < 10 && nextBtn.textContent.startsWith('Next'); index += 1) {
    nextBtn.click();
  }
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
    delete window.DOG_BREEDS;
    delete window.breedSuggestions;
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

  test('accepts a breed chosen by click when no pointer event is delivered', () => {
    const auth = { currentUser:{ uid:'owner-1' }, addDogProfile:jest.fn(async () => true) };
    installWizard(auth);
    window.DOG_BREEDS = ['Podenco Andaluz'];
    window.breedSuggestions = () => ['Podenco Andaluz'];
    window.DoloPawsWizard.open();
    change('dwName', 'Eddie');
    change('dwAgeBand', '5-6');
    document.getElementById('dwNextBtn').click();
    change('dwBreed', 'Pod');

    const option = document.querySelector('[data-breed="Podenco Andaluz"]');
    option.dispatchEvent(new MouseEvent('click', { bubbles:true }));

    expect(document.getElementById('dwBreed').value).toBe('Podenco Andaluz');
  });

  test('validates and saves the visible breed when a mobile keyboard omits its final event', async () => {
    const auth = { currentUser:{ uid:'owner-1' }, addDogProfile:jest.fn(async () => true) };
    installWizard(auth);
    window.DoloPawsWizard.open();
    change('dwName', 'Eddie');
    change('dwAgeBand', '5-6');
    document.getElementById('dwNextBtn').click();
    document.getElementById('dwBreed').value = 'Podenco Andaluz';
    document.querySelector('[data-key="fitness"][data-value="high"]').click();

    document.getElementById('dwNextBtn').click();

    expect(document.getElementById('dwNotes')).not.toBeNull();
    advanceToSaveStep();
    document.getElementById('dwNextBtn').click();
    await flushSave();

    expect(auth.addDogProfile).toHaveBeenCalledWith(expect.objectContaining({
      name:'Eddie', breed:'Podenco Andaluz', fitness:'high',
    }));
  });

  test('PROFILE-02 behaviour answers reach the saved profile', async () => {
    const auth = {
      currentUser:{ uid:'owner-1' }, addDogProfile:jest.fn(async () => true),
      setDogProfile:jest.fn(async () => true),
    };
    installWizard(auth);
    window.DoloPawsWizard.open();
    change('dwName', 'Eddie');
    change('dwAgeBand', '5-6');
    document.getElementById('dwNextBtn').click();
    change('dwBreed', 'Border Collie');
    document.querySelector('[data-key="fitness"][data-value="moderate"]').click();
    document.getElementById('dwNextBtn').click();
    document.getElementById('dwNextBtn').click();

    change('dwB_recall', 'variable');
    change('dwB_preyDrive', 'high');
    change('dwB_preferredDurationMin', '90');
    advanceToSaveStep();
    document.getElementById('dwNextBtn').click();
    await flushSave();

    expect(auth.addDogProfile).toHaveBeenCalledWith(expect.objectContaining({
      behaviour:{ recall:'variable', preyDrive:'high', preferredDurationMin:90 },
    }));
  });

  test('an unanswered behaviour question is left out rather than defaulted', async () => {
    const auth = {
      currentUser:{ uid:'owner-1' }, addDogProfile:jest.fn(async () => true),
      setDogProfile:jest.fn(async () => true),
    };
    installWizard(auth);
    window.DoloPawsWizard.open();
    advanceToReview();
    document.getElementById('dwNextBtn').click();
    await flushSave();

    // An absent key is what makes the scorer stay silent about that trait.
    // Writing an easy default here would quietly reassure the owner instead.
    expect(auth.addDogProfile).toHaveBeenCalledWith(expect.objectContaining({ behaviour:{} }));
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
    advanceToSaveStep();
    document.getElementById('dwNextBtn').click();
    await flushSave();
    expect(auth.setDogProfile).toHaveBeenCalledWith(expect.objectContaining({ name:'Eddie' }), 'eddie-1');
    expect(auth.addDogProfile).not.toHaveBeenCalled();
  });
});
