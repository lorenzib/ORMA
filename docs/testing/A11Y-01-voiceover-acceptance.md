# A11Y-01 — VoiceOver acceptance record

**Status:** Protocol ready; production iPhone acceptance pending.

## Purpose

Confirm that a person using Safari with VoiceOver can complete the ORMA beta
journey without an unlabeled control, trapped focus, missing status, or repeated
GPS announcement. Automated contracts cover structure and keyboard behaviour;
this record covers the human screen-reader experience they cannot reproduce.

## Supported test target

- Device: iPhone 13 Pro
- Browser: Safari
- Screen reader: VoiceOver
- Site: `https://www.dolopaws.com/`
- Trail: Lago di Carezza Loop

Record the installed iOS version and test time. Do not record credentials or a
precise live location in the evidence.

## Procedure

1. Enable VoiceOver. Open the homepage and activate **Skip to main content**.
   Search for “Carezza”, move through suggestions, and open the trail.
2. Return home, open login, and open the dog-profile wizard. Confirm every field
   and choice has a useful name, focus stays inside each dialog, and closing it
   returns focus to the control that opened it.
3. Open the account page. Move between tabs and dog profiles. Confirm the active
   tab and active dog are spoken and that adding or removing a dog is not
   confused with deleting the account.
4. Compare two trails, remove one, and confirm the removed trail and remaining
   count are announced without moving focus to the top of the page.
5. On Carezza, start the offline download and readiness check. Confirm progress,
   success, and failure states are spoken once and remain visually available.
6. On a safe physical test, enter hike mode. Confirm position state, GPS
   accuracy, elevation, and an off-route warning are understandable. Normal GPS
   refreshes must not produce continuous speech.
7. Complete the hike. Choose the outcome and conditions, submit them, and confirm
   both the selected choice and successful completion are spoken.
8. Enable **Reduce Motion** and repeat opening a dialog and changing account
   tabs. Confirm no information or focus state is lost.

## Evidence record

| Field | Result |
|---|---|
| Tested at (ISO date/time and timezone) |  |
| Tester |  |
| iOS version |  |
| Safari version |  |
| VoiceOver enabled | Pass / Fail |
| Skip link and Carezza search | Pass / Fail |
| Dialog names, focus trap, and focus return | Pass / Fail |
| Account tabs and dog switching | Pass / Fail |
| Compare removal announcement | Pass / Fail |
| Offline and readiness announcements | Pass / Fail |
| Hike status understandable without speech flooding | Pass / Fail |
| Completion choices and confirmation | Pass / Fail |
| Reduce Motion journey | Pass / Fail |
| Unlabeled or ambiguous controls | None / defect IDs |
| Unexpected focus moves | None / defect IDs |
| Missing or excessive announcements | None / defect IDs |
| Notes |  |

## Pass and stop rules

The `ACCESSIBILITY-VOICEOVER` gate passes only when every journey row passes and
the three defect rows say `None`. An inaccessible core action, focus trap,
unlabeled control, silent safety-critical state, or repeated GPS speech is a
release defect. Keep the gate pending until it is fixed and the affected journey
is repeated from the beginning.
