# GUIDE-01 — Contextual caution guides

Status: complete (2026-08-11)

## Decision

The canonical recommendation remains the decision surface. Supporting guides
appear separately in the trail sidebar, below current hazard reports, and only
when a recommendation caution has a guide that helps the owner act.

Guide selection uses stable caution codes rather than matching translated or
changing prose. It is deterministic, deduplicated, and capped at two links so
it cannot turn a trail decision into a reading list.

## Current mappings

- heat and low-shade cautions → recognising overheating early;
- missing reviewed water → water for dogs on alpine trails;
- terrain, surface-hazard, and joint-load cautions → paw protection; and
- exposed terrain → the dog hiking safety guide.

Distance, ascent, access, and other cautions do not receive a generic link when
there is no guide that directly helps with that specific issue.

## Acceptance evidence

- Links are derived from `hardStops` and `cautions`, never positive reasons or
  unknown evidence.
- Duplicate cautions in one topic yield one guide.
- At most two guides render.
- No relevant caution means the sidebar card remains hidden.
- The recommendation card copy and actions are unchanged.

