# QA-03 — Internal usability protocol

**Status:** Session protocol ready; the 5–8 owner recommendation cohort and an
uncoached end-to-end session remain pending.

## Purpose

Verify that a person unfamiliar with the implementation can complete the beta
journey without coaching. This is observed usability evidence, not a design
review and not a substitute for the physical airplane-mode test.

## Participant and setup

- For the full end-to-end rehearsal, use one participant who did not design or
  implement the current journey. Run the recommendation decision cohort below
  with 5–8 dog owners before treating the discovery UI as validated.
- Use a familiar, low-risk beta route; never ask the participant to go off-route.
- Start with a verified test account and a test dog profile, but do not expose
  moderator privileges.
- Use the supported iPhone target first. Repeat the same journey on the selected
  Android target before including Android in the beta support claim.
- Screen-record only with informed consent. Do not record passwords, exact home
  location, or an unnecessary continuous GPS history.

The facilitator may read each task but must not explain labels, point at
controls, or rescue the participant until the task has clearly failed. Record
the first action, hesitation, error, recovery, completion time, and the
participant's own words.

## Recommendation decision cohort: 5–8 dog owners

Recruit owners with a useful spread of dog size, age, fitness and mountain-walk
experience. Include at least two owners who rarely use hiking apps and at least
two who already use a product such as AllTrails, Komoot, Outdooractive or
Wikiloc. Use the participant's own dog profile where practical; otherwise use a
clearly described test dog. Do not collect unnecessary health information.

Give every participant the same uncoached scenario:

> “You want to walk near Tre Cime tomorrow with your dog. Use ORMA to choose the
> trail you would feel most comfortable taking.”

Observe these stages before asking any follow-up question:

| Stage | Pass evidence |
|---|---|
| Orient | Participant identifies the top recommendation, selected dog, place and date without prompting. |
| Connect | Participant connects list ranks 1–6 with the same numbered map markers and understands that grey markers are other trails. |
| Explain | Participant explains the match category, confidence and provenance in their own words and mentions at least one dog-fit reason and one caution. |
| Act | Participant finds **View trail details** as the main next step and does not mistake **Show on map** for starting navigation. |
| Adjust | Participant changes one need, such as shade or distance, and recognises that the ranking has changed. |

Record time to first trail choice, the first control used, any hesitation longer
than five seconds, changes of mind, the final selected trail, and one verbatim
sentence explaining why they trusted or rejected it. Do not demonstrate the UI
until the task is finished or clearly failed.

The cohort passes when at least 7 of 8 participants—or 6 of 7, 5 of 6, or 4 of
5—complete Orient, Connect, Explain and Act without coaching; at least 80% can
accurately distinguish trail difficulty from dog fit; and no participant reads
confidence or provenance as a safety guarantee. Any safety-critical
misinterpretation is a launch blocker regardless of the aggregate result.

## Uncoached tasks

| Stage | Task read to participant | Pass evidence |
|---|---|---|
| Discover | “Find a walk near Carezza that you think suits your dog.” | Participant reaches a relevant trail and can name why it fits. |
| Explain | “Tell me what makes this suitable or unsuitable.” | Participant explains the recommendation using match category, confidence, provenance, distance, terrain, water, heat and cautions. |
| Compare | “Compare it with another plausible walk.” | Participant can distinguish the two routes without losing the selected dog context. |
| Prepare | “Get this route ready for a walk where the signal may disappear.” | Participant distinguishes Save from Download, signs in if needed, and waits for **Ready offline**. |
| Verify | “Show me how you know it will work without signal.” | Participant finds and understands the offline self-test and package state. |
| Navigate | “Start the walk and show where you are.” | Participant starts recording, sees walked distance, GPS accuracy, route position, elevation context, and map controls. |
| Recover | “If you were just away from the route, how would you get back?” | Participant finds **Find closest trail point** and understands that guidance follows packaged mapped paths. |
| Restore | Close and reopen the browser/PWA in the controlled test state. | Participant restores the same active hike once without starting over. |
| Finish | “Finish the walk and record whether it suited your dog.” | Completion saves before optional outcome; an offline outcome is visibly queued. |
| Manage | “Find the downloaded route and remove it from this device.” | Participant understands package removal versus logout or account deletion. |

If the account contains two dogs, add one supporting check after the core
journey: ask the participant to switch dogs, add a second photo, and return to
the first dog. Pass when both dogs and their separate photos remain intact and
the active dog's name is consistent across homepage, discovery, and trail
detail. A failure is a shipped-feature defect but does not redefine the core
single-dog journey.

## Required comprehension questions

Ask only after the participant finishes the relevant task:

1. What do the match category and confidence label mean, and what do they not guarantee?
2. What is the difference between saving and downloading a trail?
3. What does **Ready offline** tell you?
4. What would you do if GPS accuracy became poor?
5. Does the elevation cursor show exact GPS altitude?
6. Would you treat ORMA as emergency navigation? Why not?

## Recording template

Copy this table for each session. Use `Pass`, `Pass with hesitation`, or `Fail`.

| Stage | Result | Time | First action and hesitation | Error/recovery | Exact participant quote | Defect ID |
|---|---|---:|---|---|---|---|
| Discover |  |  |  |  |  |  |
| Explain |  |  |  |  |  |  |
| Compare |  |  |  |  |  |  |
| Prepare |  |  |  |  |  |  |
| Verify |  |  |  |  |  |  |
| Navigate |  |  |  |  |  |  |
| Recover |  |  |  |  |  |  |
| Restore |  |  |  |  |  |  |
| Finish |  |  |  |  |  |  |
| Manage |  |  |  |  |  |  |

## Pass and stop rules

QA-03 passes only when:

- the participant completes every core stage without coaching;
- the participant can explain the recommendation and offline state accurately;
- Save and Download are not confused;
- no safety-critical, accessibility, authentication, or data-loss dead end occurs;
- every hesitation and recovery is recorded; and
- any unresolved issue is classified by severity and linked from the readiness ledger.

Stop the session immediately for unsafe behavior, an incorrect route, a false
offline-ready claim, data loss, inaccessible core action, or confident guidance
from unreliable GPS. Those are launch-blocking defects, not usability notes.
