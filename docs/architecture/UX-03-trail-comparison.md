# UX-03 — Trail comparison

Status: Complete in code (2026-07-29)

## Decision journey

Browse is the selection surface. A visitor can add up to three trails without
an account. Selection is stored under the versioned
`dolopaws-comparison-v1` key and a fixed tray stays visible once the first
trail is selected. The comparison action becomes available at two trails.

The comparison URL is shareable and carries:

- the ordered trail IDs;
- the active dog context; and
- the canonical Browse URL, including its current filters and page.

Opening a trail from the comparison passes the comparison URL as the safe
return target. Removing a trail updates the URL and stored selection.

## Comparison contract

`comparison-model.js` creates the same ordered decision fields for every
trail: dog-match category and score, reasons or cautions, distance, elevation,
duration, terrain, exposure, shade, heat, water, surface hazards, dog
restrictions, and verification tier.

The model consumes the canonical recommendation and normalized evidence
contracts. A positive safety statement is only made where the relevant
evidence category is reviewed. Missing review is rendered as
`Unknown — … not reviewed`; it is not rendered as “none”, “low”, or “safe”.
Mapped facts, reviewed facts, cautions, and unknowns have distinct visual
states.

## Mobile behaviour

On narrow screens the table scrolls horizontally. The decision-field column
remains sticky, so the meaning of each value stays visible while comparing
two or three trail columns. The scroll region is keyboard focusable and has
an accessible label.

## Verification

Automated checks cover:

- selection normalization, persistence, maximum size, and URL context;
- all required comparison rows;
- reviewed versus unknown evidence semantics;
- mobile overflow and sticky labels; and
- remove, detail, and safe-return controls.
