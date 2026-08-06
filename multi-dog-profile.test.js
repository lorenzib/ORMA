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
    expect(client).toContain('dogs = dogs.slice(0, 5).map(sanitizedDogProfile)');
    expect(client).toContain('Object.entries(existing.favorites).slice(0, 250)');
    expect(client).toContain('existing.lastMatches.slice(0, 250)');
    expect(client).toContain('await setDoc(userRef, payload);');
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
    expect(source('firebase-init.js')).toContain('if (state.dogs.length <= 1) return false;');
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
    expect(wizard).toContain("typeof DOG_BREEDS !== 'undefined'");
    expect(manager).toContain("typeof DOG_BREEDS!=='undefined'?DOG_BREEDS:[]");
    expect(wizard).toContain('Other (not listed)');
    expect(manager).toContain("new Option('Other (not listed)',OTHER_BREED)");
    expect(page).toContain('id="profileBreedOther"');
    expect(page).not.toContain('<option>Border Collie</option><option>Labrador Retriever</option>');
  });

  test('moderator access is outside the dog profile and in the account menu', () => {
    const account = source('account.html');
    const nav = source('mobile-nav.js');
    const homepage = source('index.html');
    expect(account).not.toContain('id="moderatorToolsBox"');
    expect(account).not.toContain('Open moderation queue');
    expect(nav).toContain("menuItem('Moderator workspace', 'moderation.html')");
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

  test('photos remain isolated to the active dog', () => {
    const account = source('account.js');
    const nav = source('mobile-nav.js');
    const homepage = source('script.js');
    expect(account).toContain("const dogKey = addMode ? 'new' : (activeDogId || 'new')");
    expect(account).toContain("(addMode ? 'new' : (activeDogId || 'new'))");
    expect(nav).toContain('summary.dogs.find(dog => dog.id === summary.activeDogId)');
    expect(nav).toContain("return typeof photo === 'string' && photo.startsWith('data:image/') ? photo : null");
    expect(homepage).toContain('const photo = liDogPhoto(profile);');
  });
});
