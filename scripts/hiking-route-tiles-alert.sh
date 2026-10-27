#!/usr/bin/env bash
# One GitHub issue for "the hiking route tiles are not refreshing", shared by
# the weekly build and the deploy:
#
#   scripts/hiking-route-tiles-alert.sh raise "<what is wrong>"
#   scripts/hiking-route-tiles-alert.sh raise-once "<what is wrong>"
#   scripts/hiking-route-tiles-alert.sh clear "<what recovered>"
#
# raise opens the issue, or comments on the open one. raise-once only opens
# it: the deploy runs on every push, and a comment per push would bury it.
# clear closes it; only a successful weekly build does that, because only a
# new set of tiles is a recovery.
#
# Found by label, not by title search: issue search is indexed
# asynchronously, and a label lookup is exact and immediate.
# Needs GH_TOKEN with issues: write. Never fails the calling job.
set -uo pipefail

ACTION="$1"
MESSAGE="$2"
LABEL="orma-route-tiles-stale"
RUN_URL="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-}/actions/runs/${GITHUB_RUN_ID:-}"

gh label create "$LABEL" --description "The maps' hiking route tiles are not refreshing" --color B60205 >/dev/null 2>&1 || true
existing="$(gh issue list --state open --label "$LABEL" --limit 1 --json number --jq '.[0].number' 2>/dev/null || true)"

case "$ACTION" in
  clear)
    if [ -n "$existing" ]; then
      gh issue comment "$existing" --body "Recovered: ${MESSAGE} ${RUN_URL}" || true
      gh issue close "$existing" --reason completed || true
    fi
    ;;
  raise|raise-once)
    if [ -n "$existing" ]; then
      if [ "$ACTION" = "raise" ]; then
        gh issue comment "$existing" --body "Still not refreshed. ${MESSAGE} ${RUN_URL}" || true
      fi
    else
      body="${MESSAGE}

This run: ${RUN_URL}

The maps still work: they keep the last set of route tiles, or fall back to Waymarked Trails' raster if there is none. But the routes stop following OpenStreetMap until this is fixed.

To rebuild by hand, use \"Run workflow\" on the ORMA hiking route tiles workflow. This issue closes itself when a weekly build succeeds."
      gh issue create --title "Hiking route tiles are not refreshing" --body "$body" --label "$LABEL" || true
    fi
    ;;
  *)
    echo "Unknown action: $ACTION" >&2
    ;;
esac
exit 0
