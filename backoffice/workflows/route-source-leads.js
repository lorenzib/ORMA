'use strict';

/**
 * Which walks are worth a scout's budget, decided before any model call.
 *
 * The scout runs with a budget in trails per run and took the trails that
 * happened to be queued first. Most of them were never going to have a page:
 * measured 16 October, of the 60 catalogue trails that can cite nothing, 24 are
 * generic village loops -- "Kranterrunde", "Bunkerweg", "Flaaser Rundweg" --
 * that no board has ever published, while walks with a real description sat
 * further down the queue. The hit rate of 25-50% is that ordering, not the
 * difficulty of sourcing.
 *
 * A regional tour portal indexes the walks a board has written up, and it can
 * be asked by name over plain HTTP. That answers "has anybody published this
 * walk?" deterministically, for free, with no model call, and the scout can
 * then spend its budget on the walks that answer yes.
 *
 * WHAT THIS IS NOT. A lead is never evidence and never a source. The portals
 * here are indexes, and one of them republishing a description does not make it
 * the authority that wrote it -- `NOT_AN_AUTHORITY` and the quote check in
 * `scout-route-sources` are untouched, and a lead's URL is never offered to the
 * agent, recorded, or cited. This file only changes the order of a queue.
 *
 * It is also never a filter. A walk this cannot find a lead for is still
 * scouted once the leads are used up, in exactly the order it would have been:
 * the portals are incomplete, and a miss on one is not a miss. Rundweg
 * Peitlerkofel is absent from the portal below and published by pustertal.org.
 */

const PROBE_TIMEOUT_MS = 15000;
// Enough to be found, short enough that two unrelated walks cannot share it.
const MIN_KEY = 7;

/**
 * The portals that can be asked by name, and where each one is trustworthy.
 *
 * One entry, because one is all that answers: the official boards
 * (suedtirol.info, pustertal.org) serve a JavaScript shell to a plain request
 * and cannot be queried this way. Adding a portal means adding a row.
 */
const PORTALS = Object.freeze([Object.freeze({
  id: 'suedtirol.live',
  // A South Tyrol portal that also indexes Trentino and Belluno. Over-reach is
  // harmless here: a wrong miss only means a walk is not promoted.
  provinces: Object.freeze(['alto-adige', 'trentino', 'belluno']),
  search: name => `https://suedtirol.live/de/suche?q=${encodeURIComponent(name)}`,
  // Tour pages are /de/tour/<slug>-t<id>.
  tours: /\/de\/tour\/([a-z0-9-]+-t\d+)/gi,
})]);

function portalFor(trail){
  const province = String(trail?.province || '').toLowerCase();
  return PORTALS.find(portal => portal.provinces.includes(province)) || null;
}

/**
 * The spellings a slug may use for this name.
 *
 * German slugs transliterate umlauts -- Höhenweg becomes hoehenweg -- so a key
 * that strips the diaeresis to a plain vowel matches nothing. Both are
 * generated, because Italian and Ladin names want the plain form.
 */
function slugKeys(name){
  const lower = String(name || '').toLowerCase();
  const transliterated = lower
    .replace(/ö/g, 'oe').replace(/ä/g, 'ae').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
  const stripped = lower.normalize('NFD').replace(/[̀-ͯ]/g, '');
  return [...new Set([transliterated, stripped])]
    .map(value => value.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''))
    .filter(key => key.length >= MIN_KEY);
}

/**
 * The walk's own name, without the second language.
 *
 * OSM carries doubles -- "Ruine Castelfeder - Rovine Castelfeder" -- and a
 * portal indexes one of them, so the whole string matches neither.
 */
function probeName(name){
  return String(name || '').split(/\s*[-–]\s*/)[0].trim();
}

/**
 * Whether a tour slug is this walk, and not merely a walk with the same noun.
 *
 * Whole-name containment only. A fallback on the longest or first word matches
 * the generic head of the name: "Rundweg Peitlerkofel", "Rundweg Kasserol" and
 * "Rundweg Reischach" all contain "rundweg", and all three once matched one
 * unrelated `rundweg-trejer-alm` page.
 */
function slugIsWalk(slug, keys){
  const value = String(slug || '').toLowerCase();
  return (keys || []).some(key => value.includes(key));
}

/**
 * Has anybody published this walk? `likely`, `unlikely`, or `unknown`.
 *
 * `unknown` is the answer whenever the portal could not be asked -- no portal
 * covers the area, the request failed, the site was down. It is deliberately
 * distinct from `unlikely`: a walk nobody could look up keeps its place in the
 * queue, while a walk looked up and absent goes behind one that was found.
 */
async function probeLead(trail, options = {}){
  const portal = portalFor(trail);
  const name = probeName(trail?.name);
  const keys = slugKeys(name);
  const unknown = reason => ({ trailId: String(trail?.id || ''), lead: 'unknown',
    portal: portal?.id || null, slug: null, reason });
  if(!portal) return unknown('no-portal-covers-this-area');
  if(!keys.length) return unknown('name-too-short-to-look-up');
  const fetchImpl = options.fetchImpl || fetch;
  try{
    const response = await fetchImpl(portal.search(name), { redirect: 'follow',
      signal: AbortSignal.timeout(options.timeoutMs || PROBE_TIMEOUT_MS),
      headers: { 'User-Agent': 'ORMA-route-source-leads/1.0' } });
    if(!response.ok) return unknown(`HTTP ${response.status}`);
    const html = await response.text();
    const slugs = [...new Set([...String(html).matchAll(portal.tours)].map(match => match[1]))];
    const slug = slugs.find(candidate => slugIsWalk(candidate, keys)) || null;
    return { trailId: String(trail?.id || ''), lead: slug ? 'likely' : 'unlikely',
      portal: portal.id, slug, reason: null };
  }catch(error){
    return unknown(String(error?.message || error).slice(0, 120));
  }
}

const RANK = Object.freeze({ likely: 0, unknown: 1, unlikely: 2 });

/**
 * The batch to scout, best-first, and never worse than the queue's own order.
 *
 * Trails are probed in queue order and only as far as needed: the walk stops
 * once the budget is filled with leads, so a run with leads near the front
 * costs a handful of requests rather than one per waiting trail. `window`
 * bounds the requests a single run will make of a third party.
 *
 * A short budget is topped up from the trails that were not promoted, in their
 * original order, so this never scouts fewer trails than before and never
 * drops one. Within a rank the queue's order is kept, which makes the whole
 * change an ordering and nothing else.
 */
async function leadsFirst(waiting, options = {}){
  const limit = Number.isFinite(options.limit) ? Math.max(0, options.limit) : 5;
  const window = Number.isFinite(options.window) ? Math.max(0, options.window) : limit * 8;
  const probe = options.probe || (trail => probeLead(trail, options));
  const queue = [...(waiting || [])];
  const probes = new Map();
  let likely = 0;
  for(const trail of queue.slice(0, window)){
    if(likely >= limit) break;
    const result = await probe(trail);
    probes.set(String(trail.id), result);
    if(result?.lead === 'likely') likely += 1;
    if(options.pauseMs) await new Promise(resolve => setTimeout(resolve, options.pauseMs));
  }
  const ranked = queue
    .map((trail, index) => ({ trail, index,
      rank: RANK[probes.get(String(trail.id))?.lead] ?? RANK.unknown }))
    .sort((a, b) => (a.rank === b.rank ? a.index - b.index : a.rank - b.rank))
    .map(entry => entry.trail);
  return { ordered: ranked, batch: ranked.slice(0, limit), probes,
    probed: probes.size, leads: likely };
}

module.exports = { PORTALS, MIN_KEY, portalFor, slugKeys, probeName, slugIsWalk,
  probeLead, leadsFirst };
