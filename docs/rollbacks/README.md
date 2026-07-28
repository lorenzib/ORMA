# Production rollback records

## AUTH-02 Firestore rollout — 2026-07-28

- Firebase project: `dolopaws`
- Active rules release before rollout:
  `projects/dolopaws/releases/cloud.firestore`
- Previous ruleset:
  `projects/dolopaws/rulesets/a9875580-c5f7-40a1-8d04-0a74dd422755`
- Previous rules SHA-256:
  `6fa2b27515463992ce62d9bc416ab0c9abbf793b2845084842456c7c4a7af44d`
- Previous composite indexes: none
- Rules source:
  `firestore.rules.pre-auth02-2026-07-28`
- Deployed AUTH-02 ruleset:
  `projects/dolopaws/rulesets/4691b460-e972-4d4d-80c4-76763a70eac9`
- Deployed rules SHA-256:
  `cc379c879efd6a590ffe8ea084d7ec481b195e94c2ff7c7afacb37a3978aa388`
- Post-deployment index state: all four repository indexes `READY`
- Post-deployment smoke checks: public active flags, visible reviews, and
  trail-photo queries passed; anonymous report/user access and unfiltered flag
  listing were denied as expected.
- Corrective ruleset after the first-review production test:
  `projects/dolopaws/rulesets/a13e2a29-0459-4d28-af75-08414ce2d986`
- Corrective rules SHA-256:
  `92e5300c3f14137749d8e42be80cdff361b2501660cf16803d3e563dd9e06aa5`
- Corrective verification: owner-only pending-review reads passed the emulator;
  pending submission, anonymous denial, manual approval, public rendering, and
  test-record deletion passed in production.

If rollback is required, deploy the recorded source as the Firestore rules file
or repoint the `cloud.firestore` release to the previous ruleset through the
Firebase Rules API. Indexes may remain in place because they do not broaden
document access.
