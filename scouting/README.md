# scouting/

Tools and notes for finding new walks on official tourist-board sites. Nothing here is part of the website: `_config.yml` keeps this folder out of the build.

| File | What it is |
|---|---|
| `RULES.md` | The owner's rules for which walks can be built. Only the owner changes them. |
| `ROUTINE.md` | The step-by-step screen that the weekly cloud routine (Mondays 02:00 UTC) follows. |
| `queue.md` | Pools waiting to be screened. Claim one here before you start. |
| `log.md` | One line per run. |
| `findings/` | One report per screened pool: walks ready to build, holds, owner calls. |
| `pools/` | The candidate lists from the source surveys. |
| `tools/` | The screening scripts. They are dry: they never write the site's data. |

The routine only screens, and opens a **draft** PR with its findings. Building the walks, and every merge, stays with a laptop session and the owner.
