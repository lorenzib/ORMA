# ORMA agent instructions

For any change to the backoffice, scheduled agents, editorial tooling, review
desks, publishing automation, or files under `backoffice-data/`, read
`backoffice/OPERATING_STANDARD.md` before making changes.

Treat that document as the current product contract. Preserve its team
boundaries, human gates, queue behaviour, review cadence, and publishing
semantics unless the user explicitly asks to change the operating model.

When implementation and the operating standard disagree, do not silently
redefine the workflow. Either bring the implementation into conformance or
make the proposed standards change explicit to the user.

## Coding delivery standard

- Use one Codex task for one distinct outcome. Start a new task when the goal
  changes, instead of accumulating unrelated changes in a long-running task.
- Do feature and repair work in a clean, isolated Git worktree created from the
  latest `origin/main`. Never use the shared local `main` checkout as a scratch
  workspace.
- Use a `codex/` branch and a pull request for every change. Do not push feature
  commits directly to `main`.
- Keep backoffice state, generated trail artifacts, and product/UI changes in
  separate commits or pull requests unless one cannot work without the other.
- Run focused tests while working, then run `npm run quality:gate` before asking
  to merge. If a local prerequisite is unavailable, state that clearly and rely
  on the identical required GitHub check; never describe a partial run as the
  full gate.
- Commit generated outputs only when their source changed, and regenerate them
  with the repository scripts. Before committing, confirm that the branch has
  no unrelated tracked or untracked files.
- Handoff must name the branch, commit, pull request, test result, and whether
  the change is merely pushed, merged, deployed, or blocked.
