// The Android app (android/, Capacitor 8): the twin of the iPhone project,
// built from the same dist/app bundle.
const fs = require('fs');
const path = require('path');

const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');

describe('the Android app project', () => {
  test('has the same app id as the iPhone app and capacitor.config.json', () => {
    const appId = JSON.parse(read('capacitor.config.json')).appId;
    expect(read('android/app/build.gradle')).toContain(`applicationId "${appId}"`);
    expect(read('android/app/src/main/res/values/strings.xml')).toContain('<string name="app_name">ORMA</string>');
  });

  test('stays off the website and out of the repository checks', () => {
    expect(read('_config.yml')).toMatch(/^\s+- android$/m);
    const { GENERATED_DIRECTORIES } = require('./scripts/generated-directories');
    expect(GENERATED_DIRECTORIES).toContain('android');
  });

  test('does not commit the copied app bundle', () => {
    expect(read('android/.gitignore')).toMatch(/^app\/src\/main\/assets\/public$/m);
  });

  // Without this, the back button on a trail page closes the whole app.
  test("Android's back button goes to the previous page before leaving the app", () => {
    const activity = read('android/app/src/main/java/com/apporma/orma/MainActivity.java');
    expect(activity).toContain('getOnBackPressedDispatcher().addCallback');
    expect(activity).toMatch(/web\.canGoBack\(\)\)\s*\{\s*web\.goBack\(\);/);
  });
});
