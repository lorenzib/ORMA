# WALK-01 — Recording a walk with the phone in a pocket

**Status:** investigated, not built. Recommendation is to wait.

## The question

On 16 October 2026 a walk recorded at app-orma.com came back as a straight
line. The cause was proven: iOS Safari freezes a page when the screen locks,
so the phone stopped sending positions while it was in a pocket. PR #850 makes
that honest — the walk is kept as stretches, a silence over 45 seconds breaks
the line, the gap is drawn as a gap and left out of the distance, and the page
says so.

Honest is not the same as recorded. The question here is whether ORMA can keep
recording while the phone is away.

## The short answer

In a web page, no. A web page in iOS Safari has no background location. There
is no flag, no permission and no workaround. Adding the site to the home
screen does not change it. The screen wake lock, which #850 now asks for
correctly, keeps the screen awake while the page is open and the phone is
unlocked — a phone held in the hand, or strapped to an arm or a handlebar,
records fine. A phone in a pocket does not.

The only place in this product where background location is possible is the
Capacitor iOS app.

## Why it is not being built now

**The iOS app does not exist yet.** There is no `ios/` directory in the
repository. What the repository has is `capacitor.config.json` and
`scripts/build-app.js`, which assembles the public web bundle into `dist/app`.
That is the web half. The native project has never been generated, never been
built and never been run on a phone. Background location is the last step of
shipping an iOS app, not the first.

**Three tools are missing on the build machine.** `@capacitor/ios` is not a
dependency (only `@capacitor/cli` and `@capacitor/core` are). Xcode is not
installed — only the Command Line Tools, so `xcodebuild` and `simctl` do not
run. CocoaPods is not installed, and `npx cap sync ios` needs it. Installing
Xcode is a large App Store download tied to an Apple ID; there is room for it
(91 GB free) but it is not a decision to take on someone's behalf.

**#850 is not yet confirmed on a real phone.** Nobody has recorded a walk on
an iPhone since the fix. Rewriting the geolocation plumbing in `walk-page.js`
on top of an unconfirmed fix means that if the next walk is still wrong, there
is no way to tell which change caused it. Confirm #850 first.

**An adapter written today could not be proved.** The web-side change is a
seam in `walk-page.js`: take fixes from a background-capable source when the
app provides one, fall back to `navigator.geolocation.watchPosition`
otherwise. That seam is easy to write and easy to test — against a fake
plugin. A test like that proves the fake matches the adapter. It proves
nothing about the real plugin on a real phone, which is the only thing in
question. Dead code with a green test is worse than no code.

## What it would take

In order. Nothing later works without everything earlier.

1. **Confirm #850.** Record a real walk on the iPhone, screen on, phone in
   hand. Check the distance and the line. This costs one walk and settles
   whether an app is needed at all.
2. **Install Xcode and CocoaPods** on the Mac.
3. **Generate the native project.** `npm install @capacitor/ios`, then
   `npx cap add ios`, then `npm run app:sync`. This creates `ios/` and is the
   first time the app has ever been built. Expect the usual first-build
   problems, unrelated to location.
4. **Add the plugin.** `@capacitor-community/background-geolocation`, version
   1.2.26, MIT licensed, free. Its own table lists Capacitor v7 as supported,
   which matches the `^7.6.8` pinned here. It registers as
   `BackgroundGeolocation` through `registerPlugin` and calls back with
   `{latitude, longitude, accuracy, time, …}` — close enough to the shape
   `walk-recorder.addFix` already takes that the engine needs no change.
5. **Add the iOS permissions.** Three keys in `Info.plist`:
   `NSLocationWhenInUseUsageDescription`,
   `NSLocationAlwaysAndWhenInUseUsageDescription`, and `UIBackgroundModes`
   containing `location`. The two description strings are shown to the walker
   in Apple's own prompt and have to be true: that ORMA records where the walk
   went so it can be saved in their own private journal, and nowhere else.
6. **Build to a real iPhone and walk.** There is a valid
   `Apple Development: benedetta.22@hotmail.it` signing identity on this Mac
   already, so this step may be cheaper than it looks. Worth checking whether
   that is a free personal team or the paid programme: a free team can build
   to your own phone, but the profile expires after seven days. Background
   Modes is normally available to free teams — confirm it rather than assume.
   This is the step that proves the feature. Nothing before it does.
7. **Apple Developer Program, $99 a year**, for anything beyond your own
   phone: TestFlight, other people, the App Store.
8. **App Store review.** Always-on location gets looked at closely. The app
   has to explain, in the app and not only in the listing, why it needs
   location while closed. Weeks of calendar time, and it can come back.

## One blocker nobody has named yet

ORMA loads Firebase over the network, as ES modules from
`https://www.gstatic.com/firebasejs/10.13.0/`. `scripts/build-app.js` vendors
Google Fonts and MapLibre into the app bundle precisely so the app works
without a signal — it does not vendor Firebase.

That matters for this feature specifically. A walk recorded in a pocket on a
mountain has no signal, and since #850 the journal lives in the member's
account through Firestore. So background recording in the app also needs
Firebase bundled locally, or the walk is captured and then cannot be saved.
This is separate work and should be sized separately.

## Recommendation

Do step 1 and then decide. A pocket is not the only way to carry a phone, and
if a held phone with the screen on records a walk correctly, this whole
project may not be worth $99 a year and an App Store review for one feature.

If the answer after that walk is that background recording is genuinely
needed, it is a multi-week piece of work with a hard external dependency on
Apple, and it should be planned as one — not slipped in behind a fix to the
web page.
