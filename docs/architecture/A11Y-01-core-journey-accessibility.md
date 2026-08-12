# A11Y-01 — Core journey accessibility

## Scope completed in code

The beta journey now has shared, testable keyboard and screen-reader behaviour:

- a skip link moves directly to the visible page content;
- homepage search follows the combobox/listbox pattern, supports arrow keys and
  announces the result count;
- the homepage dog-profile wizard, login, readiness, journal, and completion
  dialogs move and trap focus, handle Escape where it is safe, and restore the
  opener;
- account tabs and completion choices use arrow-key navigation and roving
  `tabindex`;
- comparison removal preserves focus and announces what changed;
- download verification, readiness checks, live hike state, off-route warnings,
  and completion choices expose status to assistive technology;
- focus indicators, colour contrast for primary text/actions, and reduced-motion
  preferences are enforced by automated contracts.

Automated coverage lives in `accessibility-runtime.test.js` and
`accessibility-contract.test.js`. It supplements the existing authentication,
profile, readiness, download, hike, and outcome tests.

## Manual acceptance still required

Automated tests cannot reproduce a person's screen-reader experience. Before
marking A11Y-01 fully complete, perform this short VoiceOver pass on a production
preview or the deployed site:

1. On the homepage, activate **Skip to main content**, search for “Carezza”, use
   Up/Down to inspect suggestions, and press Enter to open one.
2. Open login and the dog-profile wizard. Confirm focus stays inside each dialog,
   every field/choice has a useful name and closing returns to its opener.
3. In the account page, move between tabs with arrow keys. In Compare, remove a
   trail and confirm the removal and remaining count are spoken.
4. On a trail, start the offline download and readiness check. Confirm progress,
   success, and failures are spoken without repeatedly announcing the whole page.
5. Enter hike mode on a safe test route. Confirm position state and an off-route
   warning are spoken, but normal GPS refreshes do not become a continuous stream.
6. Complete the hike. Select outcome and conditions with arrow keys, verify the
   choice is spoken, then submit and confirm focus returns to a sensible control.
7. Enable **Reduce motion** and repeat opening a dialog and changing account tabs.

Record device/browser, screen reader, any unlabeled control, any unexpected focus
move, and any message that is too frequent. The current supported manual target is
Safari + VoiceOver on the owner's iPhone 13 Pro; a second browser/screen-reader
combination remains part of QA-03 rather than being claimed here.

Record the production result in
`docs/testing/A11Y-01-voiceover-acceptance.md`. Automated checks or an informal
spot-check alone do not close the `ACCESSIBILITY-VOICEOVER` readiness gate.
