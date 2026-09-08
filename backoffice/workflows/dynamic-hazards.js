'use strict';

const DOG_CRITICAL_EVENTS = /avalanche|forest fire|wildfire|thunderstorm|snow|ice|extreme temperature|high temperature|heat|flood/i;
const SEVERITY_RANK = { extreme: 4, severe: 3, moderate: 2, minor: 1, unknown: 0 };

// The event family a warning belongs to, with its colour/severity prefix and the
// trailing "warning" stripped: "Orange Thunderstorm Warning" -> "thunderstorm".
function warningEventLabel(event){
  return String(event || '')
    .replace(/^(?:red|orange|yellow|moderate|severe|extreme)\s+/i, '')
    .replace(/\s+warning$/i, '').trim().toLowerCase() || 'weather';
}

function warningSlug(value){
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// MeteoAlarm issues a separate CAP alert per validity window (and per severity
// step) for one ongoing event, so the same warning arrives several times with
// distinct identifiers. Keying a published hazard by source + event family +
// area collapses those into a single card instead of stacking near-identical
// duplicates that differ only by expiry.
function canonicalWarningId(sourceKey, event, area){
  return `${sourceKey || 'warning'}:${warningSlug(warningEventLabel(event))}:${warningSlug(area)}`;
}

// When alerts collapse onto the same card, keep the worst severity (its title and
// message) and the latest expiry, and union the affected trails, so the card
// shows the most serious currently-active version of the warning.
function mergeWarnings(a, b){
  const primary = (SEVERITY_RANK[b.severity] || 0) > (SEVERITY_RANK[a.severity] || 0) ? b : a;
  const later = (x, y) => !x ? y : !y ? x : (new Date(x).getTime() >= new Date(y).getTime() ? x : y);
  const earlier = (x, y) => !x ? y : !y ? x : (new Date(x).getTime() <= new Date(y).getTime() ? x : y);
  const union = (x, y) => [...new Set([...(x || []), ...(y || [])])];
  return {
    ...a,
    severity: primary.severity, event: primary.event, title: primary.title, message: primary.message,
    identifier: primary.identifier, sourceUrl: primary.sourceUrl || a.sourceUrl,
    expiresAt: later(a.expiresAt, b.expiresAt),
    effectiveAt: earlier(a.effectiveAt, b.effectiveAt),
    firstPublishedAt: earlier(a.firstPublishedAt, b.firstPublishedAt),
    lastSeenAt: later(a.lastSeenAt, b.lastSeenAt),
    trailIds: union(a.trailIds, b.trailIds),
    trailNames: union(a.trailNames, b.trailNames),
  };
}

// Collapse weather warnings that share a canonical (source + event + area) key
// into one, re-keying them to that canonical id so legacy per-alert duplicates
// heal on the next pass. Community hazards keep their own identity and lifecycle.
function dedupeHazards(hazards = []){
  const order = [];
  const byKey = new Map();
  for(const hazard of hazards){
    if(hazard.origin === 'community'){ order.push({ community: hazard }); continue; }
    const key = canonicalWarningId(hazard.sourceKey, hazard.event, hazard.area);
    const normalized = { ...hazard, id: key };
    if(byKey.has(key)) byKey.set(key, mergeWarnings(byKey.get(key), normalized));
    else { byKey.set(key, normalized); order.push({ key }); }
  }
  return order.map(entry => entry.community ? entry.community : byKey.get(entry.key));
}

function decodeXml(value = ''){
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&')
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function tag(block, name){
  const pattern = new RegExp(`<(?:(?:[a-z][\\w.-]*):)?${name}\\b[^>]*>([\\s\\S]*?)<\\/(?:(?:[a-z][\\w.-]*):)?${name}>`, 'i');
  return decodeXml(block.match(pattern)?.[1] || '');
}

function link(block){
  const matches = [...block.matchAll(/<link\b([^>]*)\/?\s*>/gi)];
  const preferred = matches.find(match => /application\/cap\+xml/i.test(match[1])) || matches[0];
  return decodeXml(preferred?.[1].match(/href=["']([^"']+)["']/i)?.[1] || '');
}

function parseAtomFeed(xml, source = {}){
  if(typeof xml !== 'string' || !/<feed\b/i.test(xml)) throw new Error('Warning source did not return an Atom feed');
  return [...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)].map(match => {
    const entry = match[1];
    const identifier = tag(entry, 'identifier') || tag(entry, 'id');
    const event = tag(entry, 'event') || tag(entry, 'title') || 'Weather warning';
    const area = tag(entry, 'areaDesc');
    const severity = (tag(entry, 'severity') || 'unknown').toLowerCase();
    return {
      id: `${source.key || 'warning'}:${identifier || `${event}:${area}:${tag(entry, 'sent')}`}`,
      sourceKey: source.key || 'warning-source', sourceLabel: source.label || 'Official warning source',
      sourceUrl: link(entry) || source.url || '', identifier, event, area, severity,
      certainty: (tag(entry, 'certainty') || 'unknown').toLowerCase(),
      urgency: (tag(entry, 'urgency') || 'unknown').toLowerCase(),
      sentAt: tag(entry, 'sent') || tag(entry, 'updated') || null,
      effectiveAt: tag(entry, 'effective') || tag(entry, 'onset') || null,
      expiresAt: tag(entry, 'expires') || null,
      title: tag(entry, 'title') || `${event} — ${area}`,
      summary: tag(entry, 'summary') || tag(entry, 'content') || '',
    };
  }).filter(alert => alert.area && alert.identifier);
}

function trailWarningArea(trail){
  const text = `${trail.area || ''} ${trail.valley || ''}`.toLowerCase();
  if(trail.region === 'savoy') return trail.province === 'haute-savoie' ? 'Haute-Savoie' : 'Savoie';
  if(/friuli|carnia|tarvis/.test(text)) return 'Friuli-Venezia Giulia';
  if(trail.province === 'belluno') return 'Veneto';
  if(['alto-adige', 'trentino'].includes(trail.province)) return 'Trentino-Alto Adige';
  return null;
}

function alertAppliesToTrail(alert, trail){
  const target = trailWarningArea(trail);
  if(!target) return false;
  const area = alert.area.toLowerCase();
  if(target === 'Haute-Savoie') return /haute[- ]savoie/.test(area) || /auvergne[- ]rh[oô]ne[- ]alpes/.test(area);
  if(target === 'Savoie') return (!/haute[- ]savoie/.test(area) && /(^|\W)savoie(\W|$)/.test(area)) || /auvergne[- ]rh[oô]ne[- ]alpes/.test(area);
  const alternatives = {
    'Trentino-Alto Adige': /trentino|alto adige|s[uü]dtirol/,
    Veneto: /veneto/,
    'Friuli-Venezia Giulia': /friuli|venezia giulia/,
  };
  return alternatives[target]?.test(area) || false;
}

function shouldPublishAlert(alert){
  if(['severe', 'extreme'].includes(alert.severity)) return true;
  return alert.severity === 'moderate' && DOG_CRITICAL_EVENTS.test(alert.event);
}

function publicWarning(alert, trails, at){
  const matched = trails.filter(trail => alertAppliesToTrail(alert, trail));
  if(!matched.length || !shouldPublishAlert(alert)) return null;
  const eventLabel=warningEventLabel(alert.event);
  return {
    id: canonicalWarningId(alert.sourceKey, alert.event, alert.area), state: 'active', severity: alert.severity, event: alert.event, area: alert.area,
    title: `${eventLabel} warning for ${alert.area}`,
    message: `An official ${alert.severity} ${eventLabel.toLowerCase()} warning applies to this area. Check the source and local conditions before setting out. This is not a trail-closure notice.`,
    sourceKey: alert.sourceKey, sourceLabel: alert.sourceLabel, sourceUrl: alert.sourceUrl,
    identifier: alert.identifier, effectiveAt: alert.effectiveAt, expiresAt: alert.expiresAt,
    firstPublishedAt: at, lastSeenAt: at, removalRequiresHumanReview: true,
    trailIds: matched.map(trail => trail.id), trailNames: matched.map(trail => trail.name),
  };
}

function reconcileHazards(previous = [], observations = [], sourceResults = [], trails = [], options = {}){
  const at = options.at || new Date().toISOString();
  const successful = new Set(sourceResults.filter(source => source.ok).map(source => source.key));
  const complete = new Set(sourceResults.filter(source => source.ok && source.completeSnapshot === true).map(source => source.key));
  const failed = new Map(sourceResults.filter(source => !source.ok).map(source => [source.key, source.error || 'Source unavailable']));
  const observed = new Map();
  observations.forEach(alert => {
    const warning = publicWarning(alert, trails, at);
    if(!warning) return;
    const existing = observed.get(warning.id);
    observed.set(warning.id, existing ? mergeWarnings(existing, warning) : warning);
  });
  const next = [];
  previous.forEach(old => {
    // Community hazards have their own lifecycle: they are vetted, re-vetted and
    // expired by the Hazard Analyst, never reconciled against the weather feeds.
    if(old.origin === 'community'){ next.push(old); return; }
    const fresh = observed.get(old.id);
    if(fresh){
      next.push({ ...old, ...fresh, firstPublishedAt: old.firstPublishedAt || at, sourceStatus: 'available' });
      observed.delete(old.id);
      return;
    }
    if(failed.has(old.sourceKey)){
      next.push({ ...old, sourceStatus: 'unavailable', sourceError: failed.get(old.sourceKey), lastCheckedAt: at });
      return;
    }
    // A complete successful feed is the authoritative snapshot of currently
    // active warnings. Absence here is upstream removal evidence, not outage.
    if(complete.has(old.sourceKey)) return;
    // A warning whose own stated expiry has passed, on a source that answered
    // successfully, is over. Removal is automatic; there is no human gate.
    const expired = old.expiresAt && new Date(old.expiresAt).getTime() <= new Date(at).getTime();
    if(successful.has(old.sourceKey) && expired) return;
    next.push({ ...old, lastCheckedAt: at });
  });
  next.push(...observed.values());
  return dedupeHazards(next).sort((a, b) => String(b.severity).localeCompare(String(a.severity)) || a.title.localeCompare(b.title));
}

function buildHazardArtifacts(previousData, observations, sourceResults, trails, options = {}){
  const at = options.at || new Date().toISOString();
  const hazards = reconcileHazards(previousData?.hazards || [], observations, sourceResults, trails, { at });
  // Compare on the canonical key, not the raw id, so a warning that was merged or
  // re-keyed (legacy per-alert id -> canonical id) is not misreported as removed.
  const remainingKeys = new Set(hazards.map(item => canonicalWarningId(item.sourceKey, item.event, item.area)));
  const completeSources = new Set(sourceResults.filter(source => source.ok && source.completeSnapshot === true).map(source => source.key));
  const automaticallyRemoved = (previousData?.hazards || []).filter(item => item.origin !== 'community' && !remainingKeys.has(canonicalWarningId(item.sourceKey, item.event, item.area))).map(item => ({
    hazardId:item.id, sourceKey:item.sourceKey, sourceLabel:item.sourceLabel || null,
    title:item.title || null, removedAt:at,
    reason:completeSources.has(item.sourceKey)?'absent-from-complete-authoritative-snapshot':'source-warning-expired',
  }));
  return {
    publicData: { contractVersion: '1.0.0', generatedAt: at, hazards },
    reviewQueue: { contractVersion: '1.0.0', generatedAt: at, items: hazards.filter(item => item.state === 'resolution-review') },
    status: {
      contractVersion: '1.0.0', checkedAt: at,
      summary: { active: hazards.filter(item => item.state === 'active').length, awaitingRemovalReview: hazards.filter(item => item.state === 'resolution-review').length, automaticallyRemoved: automaticallyRemoved.length, sourceFailures: sourceResults.filter(item => !item.ok).length },
      sources: sourceResults,
      automaticRemovals: automaticallyRemoved,
      policy: 'Authoritative warnings are added and removed automatically: a warning absent from a complete successful snapshot, or past its own stated expiry on a source that answered, is removed without human review. Source failure never means safe. Community reports follow the separate Hazard Analyst vetting lifecycle.',
    },
  };
}

function applyHazardReview(publicData, ledger, input, options = {}){
  const at = options.at || new Date().toISOString();
  const actions = new Set(['confirm-resolved', 'keep-active']);
  if(!actions.has(input.action)) throw new Error('A valid hazard review action is required');
  const hazard = (publicData.hazards || []).find(item => item.id === input.hazardId);
  if(!hazard) throw new Error('Hazard review item was not found');
  if(input.action === 'confirm-resolved' && hazard.state !== 'resolution-review') throw new Error('Only a resolution candidate can be removed');
  const decision = { hazardId: hazard.id, action: input.action, note: String(input.note || '').trim().slice(0, 1000), reviewedAt: at, reviewedBy: 'local-editor' };
  const hazards = input.action === 'confirm-resolved'
    ? publicData.hazards.filter(item => item.id !== hazard.id)
    : publicData.hazards.map(item => item.id === hazard.id ? { ...item, state: 'active', keptActiveAt: at, nextRemovalReviewAt:new Date(new Date(at).getTime()+24*60*60*1000).toISOString(), resolutionDetectedAt: null } : item);
  return {
    publicData: { ...publicData, generatedAt: at, hazards },
    ledger: { contractVersion: '1.0.0', updatedAt: at, decisions: [...(ledger?.decisions || []), decision] },
    decision,
  };
}

module.exports = { parseAtomFeed, trailWarningArea, alertAppliesToTrail, shouldPublishAlert, reconcileHazards, buildHazardArtifacts, applyHazardReview, canonicalWarningId, mergeWarnings, dedupeHazards };
