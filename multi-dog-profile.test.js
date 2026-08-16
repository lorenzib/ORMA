const fs = require('fs');
const path = require('path');

function source(file){
  return fs.readFileSync(path.join(__dirname, file), 'utf8');
}

describe('multi-dog account experience', () => {
  test('Firebase exposes explicit list, add, select and remove operations', () => {
    const client = source('firebase-init.js');
    expect(client).toContain('async function getDogProfiles()');
    expect(client).toContain('async function addDogProfile(dogObj)');
    expect(client).toContain('async function selectDogProfile(id)');
    expect(client).toContain('async function removeDogProfile(id)');
    expect(client).toContain('dogs:state.dogs');
    expect(client).toContain('activeDogId:active ? active.id : null');
    expect(client).toContain('dog:active');
    expect(client).toContain('function sanitizedDogProfile(dog, index)');
    expect(client).toContain('source.vet.medical');
    expect(client).toContain('reconcileLegacyDogPhotos(dogs.slice(0, 5).map(sanitizedDogProfile))');
    expect(client).toContain('Object.entries(existing.favorites).slice(0, 250)');
    expect(client).toContain('existing.lastMatches.slice(0, 250)');
    expect(client).toContain('await runTransaction(db, async transaction =>');
    expect(client).toContain('transaction.set(userRef, committed.payload);');
  });

  test('the account editor switches dogs and adds another in the same screen', () => {
    const page = source('account.html');
    const controller = source('account.js');
    expect(page).toContain('id="profileDogList"');
    expect(page).toContain('id="profileAddDog"');
    expect(controller).toContain("accountParams.get('mode') === 'add'");
    expect(controller).toContain('DoloPawsAuth.addDogProfile(buildProfile())');
    expect(controller).toContain('DoloPawsAuth.selectDogProfile(dog.id)');
    expect(controller).toContain('DoloPawsAuth.removeDogProfile');
    expect(page).toContain('id="profileRemoveDog"');
    expect(controller).toContain('const canRemoveDog = !addMode && dogProfiles.length > 1;');
    expect(controller).toContain('window.location.assign(accountHref({}))');
    expect(source('profile-design.js')).toContain("document.getElementById('removeDogBtn')");
    expect(source('firebase-init.js')).toContain('if (state.dogs.length <= 1) return null;');
    expect(controller).toContain('const disabled = missingDog;');
    expect(controller).not.toContain('missingDog || missingOwner');
    expect(controller).toContain("detail:{ ok, addMode }");
    expect(source('profile-design.js')).toContain("'dolopaws-account-save-result'");
    expect(source('profile-design.js')).not.toContain("status.textContent='Profile saved.'");
    expect(source('profile-design.js')).toContain("name.addEventListener('input'");
    expect(source('profile-design.js')).toContain("legacyName.dispatchEvent(new Event('input',{bubbles:true}))");
    expect(page).toContain('placeholder="Your dog\'s name"');
  });

  test('the wizard appends instead of overwriting an existing dog', () => {
    const wizard = source('dog-wizard.js');
    expect(wizard).toContain('DoloPawsAuth.getDogProfiles()');
    expect(wizard).toContain('DoloPawsAuth.addDogProfile(profile)');
    expect(wizard).toContain('id="dwPhotoInput"');
    expect(wizard).toContain('photo:      isDogPhoto(data.photo) ? data.photo : null');
  });

  test('both add-dog views use the same comprehensive breed catalogue', () => {
    const wizard = source('dog-wizard.js');
    const manager = source('profile-design.js');
    const page = source('account.html');
    const breeds = source('breeds-data.js');
    expect(wizard).toContain("typeof DOG_BREEDS !== 'undefined'");
    expect(manager).toContain("typeof DOG_BREEDS!=='undefined'?DOG_BREEDS:[]");
    // One alphabetical catalogue behind type-ahead comboboxes (datalist);
    // free text replaces the old "Other (not listed)" branch on both views.
    expect(breeds).toContain('.sort((a, b) => a.localeCompare(b');
    expect(wizard).toContain('list="dwBreedList"');
    expect(wizard).toContain('<datalist id="dwBreedList">');
    expect(page).toContain('list="profileBreedList"');
    expect(page).toContain('<datalist id="profileBreedList">');
    expect(page).not.toContain('id="profileBreedOther"');
    expect(page).not.toContain('<option>Border Collie</option><option>Labrador Retriever</option>');
  });

  test('moderator access is outside the dog profile and in the account menu', () => {
    const account = source('account.html');
    const nav = source('mobile-nav.js');
    const homepage = source('index.html');
    expect(account).not.toContain('id="moderatorToolsBox"');
    expect(account).not.toContain('Open moderation queue');
    expect(nav).toContain("'moderation.html', 'mobile.moderator'");
    expect(homepage).toContain('id="liModeratorLink"');
  });

  test('the signed-in homepage renders every dog as a real switch control', () => {
    const homepage = source('index.html');
    const controller = source('script.js');
    expect(homepage).toContain('id="liDogList"');
    expect(homepage).toContain('id="liGreetDogList"');
    expect(controller).toContain('function renderLiDogLists(profile)');
    expect(controller).toContain('DoloPawsAuth.selectDogProfile(dog.id)');
  });

  test('account settings lists and switches every dog without relying on a header menu', () => {
    const settings = source('settings.html');
    expect(settings).toContain('DoloPawsAuth.getDogProfiles()');
    expect(settings).toContain('DoloPawsAuth.selectDogProfile(p.id)');
    expect(settings).toContain('class="st-btn st-dog-select"');
    expect(settings).toContain("'account.html?dog=' + encodeURIComponent(p.id)");
    expect(settings).toContain('account.html?mode=add&amp;next=settings.html');
    expect(settings).not.toContain("document.querySelector('.topnav .nav-user')");
  });

  test('account settings changes the selected dog in place', async () => {
    const settings = source('settings.html');
    document.open();
    document.write(settings);
    document.close();
    const controller = [...settings.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
      .map(match => match[1])
      .find(script => script.includes('Account settings — standalone page'));
    const dogs = [
      { id:'eddie', name:'Eddie', breed:'Podenco Andaluz', fitness:'high' },
      { id:'pippo', name:'Pippo', breed:'Briard', fitness:'moderate' },
    ];
    let selectedId = 'eddie';
    window.DoloPawsAuth = {
      currentUser:{ uid:'owner-1', email:'owner@example.com', providerData:[{ providerId:'password' }] },
      getDogProfiles:jest.fn(async () => ({ dogs, activeDogId:selectedId })),
      selectDogProfile:jest.fn(async id => { selectedId = id; return true; }),
      setDogProfile:jest.fn(async () => true),
      updateEmail:jest.fn(),
      resetPassword:jest.fn(),
    };
    window.DoloPawsMetrics = { consent:() => 'denied', setConsent:jest.fn() };
    window.eval(controller);
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await Promise.resolve();
    await Promise.resolve();

    expect(document.querySelectorAll('.st-dog-row')).toHaveLength(2);
    expect(document.querySelector('.st-dog-row.is-selected .st-dog-name').textContent).toBe('Eddie');
    document.querySelector('.st-dog-select').click();
    await Promise.resolve();
    await Promise.resolve();

    expect(window.DoloPawsAuth.selectDogProfile).toHaveBeenCalledWith('pippo');
    expect(document.querySelector('.st-dog-row.is-selected .st-dog-name').textContent).toBe('Pippo');
    expect(document.getElementById('stDogStatus').textContent).toContain('Pippo is now selected');
  });

  test('photos remain isolated to the active dog', () => {
    const account = source('account.js');
    const nav = source('mobile-nav.js');
    const homepage = source('script.js');
    expect(account).toContain("const dogKey = addMode ? 'new' : (base.id || activeDogId || 'new')");
    expect(account).toContain("(addMode ? 'new' : (activeDogId || 'new'))");
    expect(account).toContain("setDogProfile({ photo: dataUrl }, base.id || activeDogId)");
    expect(source('firebase-init.js')).toContain('newDogPhotoId(existingDog.id)');
    expect(nav).toContain('summary.dogs.find(dog => dog.id === summary.activeDogId)');
    expect(nav).toContain("return typeof photo === 'string' && photo.startsWith('data:image/') ? photo : null");
    expect(homepage).toContain('const photo = liDogPhoto(profile);');
  });

  test('the beta charter matches the implemented optional multi-dog scope', () => {
    const charter = source('docs/roadmap/day-07-beta-charter.md');
    const architecture = source('docs/architecture/PROFILE-01-multi-dog-profiles.md');
    const excluded = charter.slice(charter.indexOf('## Explicitly excluded'));
    expect(charter).toContain('### Optional multiple-dog profile amendment');
    expect(excluded).not.toContain('- multiple dog profiles;');
    expect(architecture).toContain('up to five dog profiles');
    expect(architecture).toContain('activeDogId');
    expect(architecture).toContain('photo isolation');
  });
});
