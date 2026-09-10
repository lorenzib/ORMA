const fs = require('fs');
const path = require('path');
const vm = require('vm');

// breeds-data.js is a plain bundle source (no exports), so evaluate it in a
// sandbox and lift the functions under test onto the context.
function loadBreeds(){
  const context = {};
  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, 'breeds-data.js'), 'utf8') +
      '\n;this.breedGroupId = breedGroupId; this.FCI_BREED_GROUPS = FCI_BREED_GROUPS;',
    context,
  );
  return context;
}

describe('breedGroupId — coarse FCI group for the anonymous walk tally', () => {
  const { breedGroupId, FCI_BREED_GROUPS } = loadBreeds();

  test('maps a listed breed to its FCI group', () => {
    // Every group returns its own id for a breed it actually contains.
    FCI_BREED_GROUPS.forEach(group => {
      if(Array.isArray(group.breeds) && group.breeds.length){
        expect(breedGroupId(group.breeds[0])).toBe(group.id);
      }
    });
    expect(breedGroupId('Border Collie')).toBe('g1');
  });

  test('a cross takes its first recognised parent, and never throws', () => {
    expect(breedGroupId('Border Collie + Some Unlisted Thing')).toBe('g1');
  });

  test('blank, unknown or non-string breeds fall back to "unknown"', () => {
    expect(breedGroupId('')).toBe('unknown');
    expect(breedGroupId('Sofa Hound 3000')).toBe('unknown');
    expect(breedGroupId(null)).toBe('unknown');
    expect(breedGroupId(undefined)).toBe('unknown');
  });

  test('the result is always a short, rule-safe token (<= 12 chars)', () => {
    // The Firestore rule caps group at 12 characters.
    const samples = ['Border Collie', 'Airedale Terrier', '', 'Sofa Hound'];
    samples.forEach(name => expect(breedGroupId(name).length).toBeLessThanOrEqual(12));
  });
});
