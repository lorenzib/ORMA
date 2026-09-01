const fs = require('fs');
const path = require('path');
const vm = require('vm');

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
    expect(client).toContain('currentUser = credential.user;');
    expect(client).toContain('loadError:true');
    expect(client).toContain('if (dogState && dogState.loadError) return;');
  });

  test('the account editor switches dogs and adds another in the same screen', () => {
    const page = source('account.html');
    const controller = source('account.js');
    expect(page).toContain('id="profileDogList"');
    expect(page).toContain('id="profileAddDog"');
    expect(page).not.toContain('class="profile-kicker"');
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
    expect(controller).toContain("localStorage.getItem('dolopaws-pending-dog-profile')");
    expect(controller).toContain('const recovered = await window.DoloPawsAuth.setDogProfile(pendingProfile);');
    expect(controller).toContain('async function loadDogProfiles(user)');
    expect(controller).toContain('cachedDogStateFor(user)');
    expect(controller).toContain('if(!profileLoadDegraded && profilesState && !profilesState.dogs.length)');
    expect(page).toContain('id="profileLoadRetry"');
    expect(controller).not.toContain('missingDog || missingOwner');
    expect(controller).toContain("detail:{ ok, addMode }");
    expect(source('profile-design.js')).toContain("'dolopaws-account-save-result'");
    expect(source('profile-design.js')).not.toContain("status.textContent='Profile saved.'");
    expect(source('profile-design.js')).toContain("name.addEventListener('input'");
    expect(source('profile-design.js')).toContain("legacyName.dispatchEvent(new Event('input',{bubbles:true}))");
    expect(page).toContain('placeholder="Your dog\'s name"');
    expect(page).toContain('profile-design.js?v=20260825-2');
  });

  test('the visible profile name is copied into the persisted account form before save', () => {
    document.open();
    document.write(source('account.html'));
    document.close();
    window.t = key => key;
    window.eval(source('profile-design.js'));
    const visibleName = document.getElementById('profileName');
    const storedName = document.getElementById('dogName');
    const legacySave = document.querySelector('.saveBtn');
    const saveSpy = jest.fn();
    legacySave.disabled = false;
    legacySave.addEventListener('click', saveSpy);

    visibleName.value = 'Moka';
    visibleName.dispatchEvent(new Event('input', { bubbles:true }));
    document.getElementById('profileSave').click();

    expect(storedName.value).toBe('Moka');
    expect(saveSpy).toHaveBeenCalledTimes(1);
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
    // One alphabetical catalogue behind mobile-safe type-ahead listboxes.
    expect(breeds).toContain('.sort((a, b) => a.localeCompare(b');
    expect(wizard).toContain('aria-controls="dwBreedList"');
    expect(wizard).toContain('class="breed-suggestions" role="listbox"');
    expect(page).toContain('aria-controls="profileBreedList"');
    expect(page).toContain('class="breed-suggestions" role="listbox"');
    expect(breeds).toContain('function breedSuggestions(query, limit = 8)');
    expect(breeds).toContain('mutt|mongrel');
    expect(page).not.toContain('id="profileBreedOther"');
    expect(page).not.toContain('<option>Border Collie</option><option>Labrador Retriever</option>');
  });

  test('informal mutt searches return selectable mixed-breed suggestions', () => {
    const context = {};
    vm.createContext(context);
    vm.runInContext(source('breeds-data.js'), context);
    const suggestions = vm.runInContext('breedSuggestions("mutt")', context);
    expect(Array.from(suggestions)).toEqual(expect.arrayContaining([
      'Mixed breed — small (under 10 kg)', 'Mixed breed — medium (10–25 kg)',
      'Mixed breed — large (over 25 kg)', 'Rescue / unknown mix',
    ]));
  });

  test('combines physical traits and guidance for a two-breed mix', () => {
    const context = {};
    vm.createContext(context);
    vm.runInContext(source('breeds-data.js'), context);
    const result = vm.runInContext('({ traits:breedTraits("French Bulldog + Siberian Husky"), lines:breedInsights("French Bulldog + Siberian Husky") })', context);
    expect(result.traits.brachy).toBe(true);
    expect(result.traits.thickCoat).toBe(true);
    expect(Array.from(result.lines).length).toBeGreaterThan(0);
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
    expect(controller).toContain("['liManageLink','liGreetManageLink']");
    expect(homepage).toContain('id="liGreetManageLink"');
    expect(source('mobile-nav.js')).toContain("activeId ? 'dog=' + encodeURIComponent(activeId) + '&' : ''");
  });

  test('dog selection dismisses navigation layers and does not reload the homepage', () => {
    const nav = source('mobile-nav.js');
    const controller = source('script.js');
    expect(nav).toContain("a, #accountBtn, .nav-dogmenu-row, .nav-dogmenu-item");
    expect(nav).toMatch(/row\.addEventListener\('click',[\s\S]*?setOpen\(false\);[\s\S]*?selectDogProfile\(d\.id\)/);
    expect(controller).toMatch(/row\.addEventListener\('click',[\s\S]*?liCloseMenus\(\);[\s\S]*?selectDogProfile\(dog\.id\)/);
    const homepageSwitcher = controller.slice(
      controller.indexOf('function renderLiDogLists'),
      controller.indexOf('function renderLiHeader')
    );
    expect(homepageSwitcher).not.toContain('window.location.reload()');
    expect(homepageSwitcher).not.toContain('window.location.href');
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
