// The iPhone and Android apps show the ORMA paw, drawn by
// scripts/build-app-icons.py from images/brand/orma-icon-2048.png, not
// Capacitor's stock logo.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const file = (p) => path.join(__dirname, p);
const read = (p) => fs.readFileSync(file(p), 'utf8');
const sha = (p) => crypto.createHash('sha1').update(fs.readFileSync(file(p))).digest('hex');

// Width, height and colour type from a PNG header (type 2 = RGB, no alpha).
function png(p) {
  const b = fs.readFileSync(file(p));
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), colourType: b[25] };
}

// Capacitor 8's template images, as they were before ORMA's.
const CAPACITOR_IOS_ICON = 'a7b7b6229e6b73866ff6de90569182789e9ab743';

describe('app icons', () => {
  test('the iPhone icon is a 1024 square with no transparency, as the App Store requires', () => {
    const icon = png('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png');
    expect(icon).toEqual({ width: 1024, height: 1024, colourType: 2 });
    expect(sha('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png')).not.toBe(CAPACITOR_IOS_ICON);
  });

  test('the Android icon and launch screen sit on the logo green', () => {
    expect(read('android/app/src/main/res/values/ic_launcher_background.xml'))
      .toContain('<color name="ic_launcher_background">#384239</color>');
    expect(read('android/app/src/main/res/values/styles.xml'))
      .toContain('<item name="windowSplashScreenBackground">@color/ic_launcher_background</item>');
  });

  test('every Android density has its icons, sized for that density', () => {
    const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
    for (const [density, k] of Object.entries(densities)) {
      const dir = `android/app/src/main/res/mipmap-${density}/`;
      expect(png(dir + 'ic_launcher.png').width).toBe(48 * k);
      expect(png(dir + 'ic_launcher_round.png').width).toBe(48 * k);
      expect(png(dir + 'ic_launcher_foreground.png').width).toBe(108 * k);
    }
  });
});
