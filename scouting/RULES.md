# Scouting rules

These are the owner's rules for which tourist-board walks can become ORMA walks. They apply to every scouting run, on the laptop or in the cloud.

Only the owner changes these rules. If a walk doesn't fit them, hold it and list it as an owner call. Never relax a rule yourself.

## Scope
- **Where:**
  - The Dolomites come first.
  - Then the Northern Italy mountains: Lombardy, Piedmont, Veneto, Liguria, Aosta Valley, Trentino and Friuli.
  - Switzerland, France and Austria are paused.
  - Liguria has no region file yet. Its walks can be screened, but building them needs a region PR first.
- **Sources:** official tourist boards, parks and public bodies only. On Outdooractive, the "Responsible for this content" publisher must be one of these.
  - Private users don't count.
  - Neither do CAI sections, unless the owner adds them.
- **Size:** 1.5–15.5 km and at most 810 m of climb, after any there-and-back doubling.
- **Not in scope:** multi-day stages, plain or lowland walks, seasonal village routes, and variants of another route.

## The line
- `scripts/build-board-line.js` must draw the board's own line on OSM paths. It checks two things:
  - guide coverage of at least 95%;
  - length within 10% of the board's figure.
- **Folds:** a line that goes out and comes straight back mid-walk is refused. The exception is the walkedTwice rule: if the board's own line walks a stretch twice, the walk may do so too (dry run with `tools/run-fold.js`).
- **Duplicates:** a walk that is 70% or more on an existing ORMA walk is a duplicate.

## Roads (hamlet lanes rule, 18 Nov)
- Quiet asphalt lanes (OSM `unclassified`, `residential`, `service`) are fine for up to half the walk.
- A walk with 300 m or more on tertiary or bigger roads is held. Crossings are fine.
- An all-asphalt walk is held.

## Grade (T2 rule, 18 Nov)
- OSM `sac_scale=mountain_hiking` (T2) is allowed. The walk gets a caution line giving the T2 length.
- T3 or harder (`demanding_mountain_hiking` and above) holds the walk. So does a published grade of T3+ or EE.

## One way (12 and 16 Nov)
- A walk the board publishes one way, with no return given, is sealed there and back on the same path:
  - km ×2;
  - climb = up + down;
  - the time is measured (DIN 33466 from EU-DEM, `tools/elev.py`), not doubled.
- A page that only suggests another way back is fine.
- Variants, extensions, two-car returns, and bus or lift returns are held.
- So is a walk that ends on a main road.

## Variant wording
- Hold the walk if its page offers a variant of the walk itself. Examples: "variante", "a seconda della variante scelta", an optional ending, "consigliato anche il giro ad anello".
- "È possibile proseguire" (an onward option) is fine.

## Times
- Use the board's time.
- If the board gives no usable time, or the walk is doubled, use an ORMA-measured time and say so on the page.
- If a page gives two different times, hold the walk.

## Photo
- One photo taken **on the walk**: within about 30 m of the line, in season (no snow on a summer walk), and showing the path or what the walker sees.
- It must be openly licensed: CC BY, CC BY-SA or CC0. Wikimedia Commons or Mapillary.
- These don't count:
  - photos taken away from the walk;
  - car or dashcam frames on roads;
  - blurred or tilted frames;
  - bare winter trees on a summer walk.
- With no photo the walk is held. It is the most common hold.

## Dogs (19 Nov)
- Every ORMA walk should accept dogs. Show a dog rule only when it restricts the walk:
  - a ban on the route;
  - a seasonal limit;
  - a mandatory lead.
- Never write "Dogs allowed", or that no rule was found.
- A real ban on the route (e.g. national park core zones) means the walk isn't built. Flag it.
- Check these for every walk: the commune's police or animal regulation, park rules, and Natura 2000 measures. Give a source for each.
- A ban on land beside the path (meadows, churchyards, lakes) is not a walk ban. Gardens are.

## Lifts
- A walk where a lift is optional is fine.
- A walk that needs a lift or a bus is held.
