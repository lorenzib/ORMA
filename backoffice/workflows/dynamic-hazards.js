'use strict';

const DOG_CRITICAL_EVENTS = /avalanche|forest fire|wildfire|thunderstorm|snow|ice|extreme temperature|high temperature|heat|flood/i;

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
  const eventLabel=alert.event.replace(/^(?:red|orange|yellow|moderate|severe|extreme)\s+/i,'').replace(/\s+warning$/i,'').trim()||'weather';
  return {
    id: alert.id, state: 'active', severity: alert.severity, event: alert.event, area: alert.area,
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
  observations.forEach(alert => { const warning = publicWarning(alert, trails, at); if(warning) observed.set(warning.id, warning); });
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
  return next.sort((a, b) => String(b.severity).localeCompare(String(a.severity)) || a.title.localeCompare(b.title));
}

function buildHazardArtifacts(previousData, observations, sourceResults, trails, options = {}){
  const at = options.at || new Date().toISOString();
  const hazards = reconcileHazards(previousData?.hazards || [], observations, sourceResults, trails, { at });
  const remainingIds = new Set(hazards.map(item => item.id));
  const completeSources = new Set(sourceResults.filter(source => source.ok && source.completeSnapshot === true).map(source => source.key));
  const automaticallyRemoved = (previousData?.hazards || []).filter(item => item.origin !== 'community' && !remainingIds.has(item.id)).map(item => ({
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

module.exports = { parseAtomFeed, trailWarningArea, alertAppliesToTrail, shouldPublishAlert, reconcileHazards, buildHazardArtifacts, applyHazardReview };
