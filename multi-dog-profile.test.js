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
  });

  test('the wizard appends instead of overwriting an existing dog', () => {
    const wizard = source('dog-wizard.js');
    expect(wizard).toContain('DoloPawsAuth.getDogProfiles()');
    expect(wizard).toContain('DoloPawsAuth.addDogProfile(profile)');
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
});
