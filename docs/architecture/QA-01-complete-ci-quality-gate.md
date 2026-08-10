# QA-01 — Complete CI quality gate

## One local command

From the repository root, run:

```sh
npm ci
npm run quality:gate
```

Local prerequisites are Node.js 20+, npm, Git, and a Java 21 JDK available as
`java`. GitHub Actions provisions Node and Java explicitly. The gate checks Java
before starting and gives a direct error instead of failing late inside the
Firestore emulator.

The gate fails immediately when any required stage fails:

1. canonical trail schema examples;
2. the complete production trail catalog;
3. provenance and evidence contracts;
4. application, accessibility, privacy, security, and feature tests;
5. Firestore authorization in the local emulator;
6. static links and local assets;
7. clean-room regeneration of pages, sitemap, validation report, and regional
   runtime payloads.

No Firebase production project, service account, browser login, or other
production credential is read by this command. Firestore tests use the local
emulator with a temporary cached binary.

## Generated-artifact policy

`npm run check:generated` copies only Git-tracked files to a temporary directory,
runs the production generators there, compares every declared generated output,
and deletes the temporary directory. It never rewrites the developer's working
tree. The regional manifest's informational generation timestamp is normalized
during comparison; all functional content remains byte-for-byte checked.

If it fails, run:

```sh
npm run generate:artifacts
```

Review and commit the generated changes. Do not bypass the check by editing a
generated file directly.

## GitHub enforcement

`.github/workflows/validate.yml` runs the exact same `npm run quality:gate`
command for pull requests and pushes to `main`. Configure the repository's
`main` branch protection to require the **quality-gate** job before merge and
disallow bypass for ordinary contributors. Deployment workflows may then rely
on an already validated `main` commit; production credentials remain isolated
to the deployment workflow.
