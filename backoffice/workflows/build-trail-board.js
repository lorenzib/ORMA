'use strict';

/**
 * The trail board: every catalogue trail, where it is in verification, and
 * what happens next.
 *
 * The hosted backoffice cannot read the catalogue (it is served without
 * `data/`), and the orchestration it can read holds only the trails already in
 * the pipeline -- 61 of 162 on 21 October 2026 -- so Backoffice Home could not
 * answer the first question anybody asks of it: where is this trail? The
 * worker has both the checkout and the credential, so it joins them and writes
 * the answer down, the way recordRegionalCoverage already does.
 *
 * Eleven orchestration states are too many to scan. They fold into six stages
 * a person can follow -- not started, route check, research, publishing,
 * passed, stopped -- and the raw state stays on the row for anyone who needs it.
 */

const fs = require('fs');
const path = require('path');
const evidence = require('../../trust/evidence-v1.js');
const { actionsFor, ROUTE_STATES, RESEARCH_STATES } = require('./trail-requests');
const { verifiedByHand } = require('./record-hand-verifications');

const CHECKS = Object.freeze(['photo', 'route', 'routeNumbers', 'mapPoints', 'elevation',
  'water', 'heat', 'exposure', 'livestock', 'surfaceHazards', 'access']);
const CHECK_LABELS = Object.freeze({ photo: 'photo', route: 'route', routeNumbers: 'trail numbers',
  mapPoints: 'map points', elevation: 'elevation', water: 'water', heat: 'heat', exposure: 'exposure',
  livestock: 'livestock', surfaceHazards: 'ground', access: 'dog access' });
// `hand` is not a step on the pipeline's road: it is where a walk verified by
// hand sits, beside Passed rather than inside it, so the pipeline's own count
// stays what the evidence policy actually approved.
const STAGES = Object.freeze(['queued', 'route', 'research', 'publish', 'passed', 'hand', 'stopped']);
const STAGE_LABELS = Object.freeze({ queued: 'Not started', route: 'Route check', research: 'Research',
  publish: 'Publishing', passed: 'Passed', hand: 'Verified by hand', stopped: 'Stopped' });
const STATE_TEXT = Object.freeze({
  'geometry-audit': 'Route survey by the cartographer',
  'geometry-human-gate': 'Route decision, settled by the evidence policy',
  'evidence-research': 'Agents researching directions and safety facts',
  'evidence-resolution': 'Agents settling the questions still open',
  'provenance-audit': 'Checking where each fact came from',
  'red-team': 'Red team challenging the dossier',
  'dossier-human-gate': 'Dossier decision, settled by the evidence policy',
});
const BLOCKER_TEXT = Object.freeze({
  'not-closed-loop': 'the line does not close into a loop',
  'declared-route-unavailable': 'the declared route could not be found',
  'relation-rebuild-incomplete': 'the line could not be rebuilt from the map',
  'official-distance-conflict': 'the distance does not match the official figure',
  'off-declared-route': 'the line leaves the declared route',
  'automated-resolution-attempts-exhausted': 'automatic attempts ran out',
  'disconnected-components': 'the line is in disconnected pieces',
});
const TERMINAL = new Set(['imported', 'rejected', 'blocked']);
const ACTIVE_JOB = new Set(['queued', 'running', 'in-progress', 'processing']);

/** The badge the public page shows, by the rule generate-trail-pages uses. */
function badgeOf(trail){
  const tier = evidence.tierOf(trail);
  if(tier === 'field-verified' || tier === 'route-audited') return 'verified';
  if(tier === 'mapped' && trail && trail.curated !== false) return 'reviewed';
  return 'imported';
}

function completedChecks(trail){
  const done = new Set(Array.isArray(trail?.graduation?.completed) ? trail.graduation.completed : []);
  return CHECKS.filter(check => done.has(check));
}

function plainBlocker(blocker){
  const text = String(blocker || '').trim();
  if(!text) return '';
  if(BLOCKER_TEXT[text]) return BLOCKER_TEXT[text];
  const plain = /^[a-z0-9]+(-[a-z0-9]+)+$/.test(text) ? text.replace(/-/g, ' ') : text;
  return plain.length > 140 ? `${plain.slice(0, 137)}…` : plain;
}

function list(items){
  const out = items.filter(Boolean);
  if(out.length <= 1) return out.join('');
  return `${out.slice(0, -1).join(', ')} and ${out[out.length - 1]}`;
}

function dateText(value){
  const ms = new Date(value || 0).getTime();
  if(!Number.isFinite(ms) || ms <= 0) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

function areaOf(trail){
  const area = String(trail?.area || '').split('/')[0].trim();
  const region = trail?.region || trail?.regionId || '';
  return { area, region: String(region) };
}

/** The newest publication request per trail. */
function publicationByTrail(requests){
  const out = new Map();
  for(const request of requests?.requests || []){
    const id = request.candidateId || request.trailId;
    if(!id) continue;
    const at = new Date(request.failedAt || request.publishedAt || request.pullRequestClosedAt || request.processedAt || request.submittedAt || request.createdAt || 0).getTime();
    const current = out.get(id);
    if(!current || at >= current.at) out.set(id, { request, at });
  }
  return new Map([...out].map(([id, value]) => [id, value.request]));
}

function publicationText(request){
  if(!request) return { next: 'Waiting to be published', failed: false, stuck: false };
  const status = String(request.status || '');
  if(status === 'publication-failed'){
    const manual = request.retryMode === 'manual' || request.retryable === false;
    const after = dateText(request.retryAfter);
    return {
      next: 'Publication failed',
      detail: manual ? 'Needs a fix before it can be retried' : after ? `Retries automatically after ${after}` : 'Retries automatically',
      reason: request.failureMessage ? plainBlocker(request.failureMessage) : null,
      failed: true, stuck: manual, retryable: request.retryable !== false,
    };
  }
  if(status === 'pull-request-opened') return { next: request.pullRequestMergedAt ? 'Publication merged, waiting to go live' : 'Publication pull request open', failed: false, stuck: false };
  if(status === 'pull-request-closed') return { next: 'Publication pull request closed unmerged', failed: false, stuck: false };
  if(status === 'hold') return { next: 'Publication on hold', failed: false, stuck: false };
  return { next: 'Waiting to be published', failed: false, stuck: false };
}

function entryFor(trail, flow, publication, jobOwed, slug){
  const badge = badgeOf(trail);
  const checks = completedChecks(trail);
  const missing = CHECKS.filter(check => !checks.includes(check));
  const { area, region } = areaOf(trail);
  const state = flow?.state || null;
  const blockers = (flow?.blockers || []).map(plainBlocker).filter(Boolean);
  const entry = {
    id: trail.id, name: trail.name || trail.id, area, region, slug: slug || null,
    inPipeline: Boolean(flow), state, badge,
    checks: checks.length, missing: missing.map(check => CHECK_LABELS[check]),
    since: dateText(flow?.updatedAt), jobOwed: Boolean(jobOwed),
    publicationFailed: false, flag: null, next: '', detail: '',
  };
  if(!flow){
    // Until the first pass records it, a walk verified by hand with no
    // orchestration entry is still a hand verification, not a pipeline pass.
    const hand = badge === 'verified' && verifiedByHand(trail);
    entry.stage = hand ? 'hand' : badge === 'verified' ? 'passed' : 'queued';
    entry.next = hand ? 'Verified by hand' : badge === 'verified' ? 'Verified' : 'Waiting for the daily intake';
    entry.detail = hand ? 'Not yet recorded in the backoffice; the next pass records it'
      : badge === 'verified' ? 'Verified through the route audit' : '';
  }else if(ROUTE_STATES.has(state) || RESEARCH_STATES.has(state)){
    entry.stage = ROUTE_STATES.has(state) ? 'route' : 'research';
    entry.next = STATE_TEXT[state];
    entry.detail = jobOwed ? 'An agent job is waiting' : blockers.length ? `Open: ${list(blockers.slice(0, 2))}` : 'Waiting for the next pass';
  }else if(state === 'ready-for-editorial'){
    const published = String(publication?.status || '') === 'published';
    if(published || badge !== 'imported'){
      entry.stage = 'passed';
      entry.next = badge === 'verified' ? 'Verified' : 'Reviewed';
      entry.detail = badge === 'verified' ? 'All eleven checks done' : `Missing for Verified: ${list(entry.missing)}`;
    }else{
      const text = publicationText(publication);
      entry.stage = 'publish';
      entry.next = text.next;
      entry.detail = [text.detail, text.reason].filter(Boolean).join(': ') || 'Approved by the evidence policy';
      entry.publicationFailed = text.failed && text.retryable;
      if(text.stuck) entry.flag = 'stuck';
    }
  }else if(state === 'verified-by-hand'){
    const hand = flow.handVerification || {};
    entry.stage = 'hand';
    entry.next = badge === 'verified' ? 'Verified by hand' : 'Recorded as verified by hand; the site has not caught up';
    entry.detail = [hand.reviewedAt ? `Checked ${hand.reviewedAt} against official sources` : 'Checked against official sources',
      hand.previousState ? `the pipeline had reached ${hand.previousState.replace(/-/g, ' ')}` : 'never admitted to the pipeline'].join('; ');
    entry.hand = { reviewedAt: hand.reviewedAt || null, reviewedBy: hand.reviewedBy || null,
      sources: hand.sources || [], previousState: hand.previousState || null };
    // The record says verified; if the site does not, somebody should know.
    if(badge !== 'verified') entry.flag = 'disagree';
  }else if(TERMINAL.has(state)){
    entry.stage = 'stopped';
    entry.stopKind = state === 'imported' ? 'resting' : state;
    if(state === 'imported'){
      entry.next = 'Resting: no official page to research from';
      entry.detail = 'Reopens only if a source appears';
    }else{
      entry.next = state === 'blocked' ? 'Blocked' : 'Rejected';
      entry.detail = blockers.length ? list(blockers.slice(0, 3)) : 'No reason recorded';
      if(state === 'blocked') entry.flag = 'stuck';
    }
    // The site and the pipeline can say different things: a trail verified
    // by the route audit and later rejected by a pipeline re-check keeps its
    // seal (no publication may take one away), and nobody would know unless
    // the board said so.
    // Stuck wins: a blocked trail needs somebody whatever its badge says, and
    // letting the disagreement overwrite it counted Sentier des Patriotes --
    // blocked 61 days -- as zero stuck trails on the first live board.
    if(state !== 'imported' && badge !== 'imported' && entry.flag !== 'stuck') entry.flag = 'disagree';
  }else{
    entry.stage = 'research';
    entry.next = state ? state.replace(/-/g, ' ') : 'In verification';
  }
  // The safety-research lane (OPERATING_STANDARD.md, "A reviewed trail is
  // sent back for its safety research"). A trail it sent back is research, not
  // a route problem, and says what it is being asked.
  const safety = flow?.safetyResearch;
  if(safety && flow?.stage === 'safety-research') entry.detail = `Safety research: ${list(entry.missing)}`;
  // A specialist met a document it could not read and marked the claim rather
  // than guessing (decision 3). Somebody has to read it.
  const audit = Array.isArray(safety?.handAudit) ? safety.handAudit : [];
  if(audit.length){
    entry.audit = audit.map(item => ({ claimId: item.claimId, sources: item.sources || [] }));
    if(!entry.flag) entry.flag = 'audit';
    entry.detail = [entry.detail, `Hand audit: ${list(audit.map(item => item.claimId))} rest on a document the agent could not read`].filter(Boolean).join('. ');
  }
  // Research found dogs are not allowed, so the walk was taken off the site
  // pending review (decision 2). Nothing a pass does lifts it.
  if(trail.withdrawal && trail.withdrawal.reason){
    entry.flag = 'withdrawn';
    entry.next = 'Taken off the site pending review';
    entry.detail = trail.withdrawal.note
      || (trail.withdrawal.reason === 'dogs-not-accepted'
        ? 'Research found dogs are not allowed on this walk'
        : `Withdrawn: ${trail.withdrawal.reason}`);
  }
  entry.stageLabel = STAGE_LABELS[entry.stage];
  entry.actions = actionsFor(entry);
  return entry;
}

/**
 * @param trails      the production catalogue (loadProductionTrails)
 * @param orchestration the `trail-orchestration` artifact
 * @param publicationRequests the `publication-requests` artifact
 * @param jobs        queued or running jobs, to tell a trail waiting on an
 *                    agent from one waiting on nothing (optional)
 */
/**
 * The public address of each trail. The site links by slug, never by raw id
 * (trail-slug-urls.test.js), and the slug map lives in the manifest the
 * checkout carries -- which the hosted desk cannot read, so it travels here.
 */
function slugMap(root = path.resolve(__dirname, '../..')){
  try{ return JSON.parse(fs.readFileSync(path.join(root, 'data/regions-manifest.json'), 'utf8')).trailSlug || {}; }
  catch{ return {}; }
}

function buildTrailBoard({ trails = [], orchestration = null, publicationRequests = null, jobs = [], at, slugs = slugMap() } = {}){
  const flows = new Map((orchestration?.trails || []).map(flow => [flow.trailId || flow.candidateId, flow]));
  const publications = publicationByTrail(publicationRequests);
  const owed = new Set((jobs || []).filter(job => ACTIVE_JOB.has(job.status || 'queued')).map(job => job.candidateId).filter(Boolean));
  const entries = trails.filter(trail => trail && trail.id)
    .map(trail => entryFor(trail, flows.get(trail.id), publications.get(trail.id), owed.has(trail.id), slugs[trail.id]));
  // What needs a look first, then what is moving, then what is settled, and
  // the long tail nobody has started last -- in journey order the board opened
  // on 141 untouched trails and buried the ones that mattered.
  const order = new Map(['publish', 'research', 'route', 'passed', 'hand', 'stopped', 'queued'].map((stage, index) => [stage, index]));
  const attention = entry => (entry.flag ? 0 : 1);
  entries.sort((a, b) => (attention(a) - attention(b)) || (order.get(a.stage) - order.get(b.stage)) || a.name.localeCompare(b.name));
  const count = predicate => entries.filter(predicate).length;
  return {
    contractVersion: '1.0.0',
    generatedAt: at || new Date().toISOString(),
    publicMutationAllowed: false,
    summary: {
      trails: entries.length,
      stages: Object.fromEntries(STAGES.map(stage => [stage, count(entry => entry.stage === stage)])),
      verified: count(entry => entry.badge === 'verified'),
      verifiedByHand: count(entry => entry.stage === 'hand'),
      reviewed: count(entry => entry.badge === 'reviewed'),
      stuck: count(entry => entry.flag === 'stuck'),
      disagree: count(entry => entry.flag === 'disagree'),
      audit: count(entry => entry.flag === 'audit'),
      withdrawn: count(entry => entry.flag === 'withdrawn'),
      stopped: {
        resting: count(entry => entry.stopKind === 'resting'),
        rejected: count(entry => entry.stopKind === 'rejected'),
        blocked: count(entry => entry.stopKind === 'blocked'),
      },
    },
    trails: entries,
  };
}

module.exports = { CHECKS, STAGES, STAGE_LABELS, badgeOf, plainBlocker, publicationText, buildTrailBoard };
