'use strict';

const { getApps, initializeApp, applicationDefault, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { providerOutage } = require('./provider-outage');
const { FirestoreUsageMeter, queryReads } = require('./firestore-usage');

const COLLECTIONS = Object.freeze({
  artifacts: 'backofficeArtifacts',
  jobs: 'backofficeJobs',
  reviews: 'backofficeReviews',
  publicationReviews: 'backofficePublicationReviews',
  dossierReviews: 'backofficeDossierReviews',
  routeReviews:'backofficeRouteReviews',
  newTrailReviews:'backofficeNewTrailReviews',
  hazardReviews:'backofficeHazardReviews',
  editorialReviews:'backofficeEditorialReviews',
  hazardReports:'trailHazardReports',
  newsletterReviews:'backofficeNewsletterReviews',
  analystReviews:'backofficeAnalystReviews',
});
const configuredDatabases = new WeakSet();
const ARTIFACT_DATA_ENCODING = 'json-v1';

function encodeArtifactData(data){
  const encoded = JSON.stringify(data);
  if(encoded === undefined) throw new TypeError('Backoffice artifact data must be JSON-serializable');
  return { data:encoded, dataEncoding:ARTIFACT_DATA_ENCODING };
}

function decodeArtifactData(document){
  if(!document) return null;
  return document.dataEncoding === ARTIFACT_DATA_ENCODING
    ? JSON.parse(document.data)
    : document.data;
}

function adminApp(options = {}){
  if(getApps().length) return getApps()[0];
  const raw = options.serviceAccountJson || process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const credential = raw ? cert(typeof raw === 'string' ? JSON.parse(raw) : raw) : applicationDefault();
  return initializeApp({
    credential,
    projectId: options.projectId || process.env.FIREBASE_PROJECT_ID || 'dolopaws',
  });
}

function backofficeDb(options = {}){
  const db = options.db || getFirestore(adminApp(options));
  if(typeof db.settings === 'function' && !configuredDatabases.has(db)){
    db.settings({ ignoreUndefinedProperties: true });
    configuredDatabases.add(db);
  }
  return db;
}

class FirestoreBackofficeStore {
  constructor(options = {}){
    this.db = backofficeDb(options);
    this.artifactCache = new Map();
    this.queryCache = new Map();
    // Documents read and written through this store, for the quota ledger.
    // Shared across stores when the caller passes one meter in.
    this.usage = options.usage || new FirestoreUsageMeter();
  }

  // Lazy, so a store built from the prototype without the constructor (as some
  // tests do) still meters instead of throwing on its first read.
  get usage(){ if(!this._usage) this._usage = new FirestoreUsageMeter(); return this._usage; }
  set usage(meter){ this._usage = meter; }

  /**
   * Job documents already read through this store, by id.
   *
   * getJobsByIds is the pass's single largest read: advanceTrailOrchestration
   * asks for every job each trail has ever had, twice per pass, and
   * `trail.jobIds` is append-only — so the cost grew with every job ever
   * created. The first metered drain put a pass at 2,304 reads to do ten jobs
   * of work. The status queries had a cache; the point reads had none.
   *
   * Lazy for the same reason `usage` is: a store built from the prototype
   * without the constructor, as several tests do, must still read and evict
   * rather than throw.
   */
  get jobCache(){ if(!this._jobCache) this._jobCache = new Map(); return this._jobCache; }

  invalidate(prefix){
    for(const key of this.queryCache.keys()) if(key.startsWith(prefix)) this.queryCache.delete(key);
  }

  /**
   * These job documents changed: the status queries are stale, and so is any
   * copy of the named documents.
   *
   * Every write to the jobs collection goes through here, which is what makes
   * the per-document cache safe to serve from — it can only hold a document
   * that no write through this store has touched since it was read. A caller
   * that writes a job must name it; `firestore-backoffice-store.test.js` asserts
   * that nothing in this file invalidates the job queries any other way.
   */
  forgetJobs(ids = []){
    this.invalidate('jobs:');
    for(const id of (Array.isArray(ids) ? ids : [ids])) if(id) this.jobCache.delete(String(id));
  }

  async getArtifact(id){
    if(this.artifactCache.has(id)) return this.artifactCache.get(id);
    const snapshot = await this.db.collection(COLLECTIONS.artifacts).doc(id).get();
    this.usage.read(1);
    const data=snapshot.exists ? decodeArtifactData(snapshot.data()) : null;
    this.artifactCache.set(id,data);return data;
  }

  async setArtifact(id, data, metadata = {}){
    await this.db.collection(COLLECTIONS.artifacts).doc(id).set({
      contractVersion: '1.0.0', artifactId: id, ...metadata,
      ...encodeArtifactData(data), updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    this.usage.write(1);
    this.artifactCache.set(id,data);
  }

  async setArtifactIfAbsent(id,data,metadata={}){
    const ref=this.db.collection(COLLECTIONS.artifacts).doc(id);
    const created=await this.db.runTransaction(async transaction=>{
      const snapshot=await transaction.get(ref);this.usage.read(1);if(snapshot.exists)return false;
      transaction.set(ref,{contractVersion:'1.0.0',artifactId:id,...metadata,
        ...encodeArtifactData(data),updatedAt:FieldValue.serverTimestamp()});this.usage.write(1);return true;
    });
    if(created)this.artifactCache.set(id,data);else this.artifactCache.delete(id);
    return created;
  }

  async putJob(job){
    await this.db.collection(COLLECTIONS.jobs).doc(job.id).set({ ...job, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    this.usage.write(1);
    this.forgetJobs([job.id]);
  }

  async putJobIfAbsent(job){
    const ref=this.db.collection(COLLECTIONS.jobs).doc(job.id);
    return this.db.runTransaction(async transaction=>{
      const snapshot=await transaction.get(ref);this.usage.read(1);if(snapshot.exists){this.forgetJobs([job.id]);return false;}
      transaction.set(ref,{...job,updatedAt:FieldValue.serverTimestamp()});this.usage.write(1);return true;
    }).finally(()=>this.forgetJobs([job.id]));
  }

  async listJobs(statuses = ['queued']){
    const key=`jobs:${[...statuses].sort().join(',')}`;
    if(this.queryCache.has(key)) return this.queryCache.get(key);
    const snapshots = await Promise.all(statuses.map(status => this.db.collection(COLLECTIONS.jobs).where('status', '==', status).get()));
    this.usage.read(snapshots.reduce((total, snapshot) => total + queryReads(snapshot), 0));
    const jobs=snapshots.flatMap(snapshot => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
      .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
    this.queryCache.set(key,jobs);return jobs;
  }

  // Reading every job in the collection to then filter by a known id list was the
  // dominant Firestore read cost: it grew with every job ever created and ran twice
  // per worker pass. Fetch only the referenced documents instead.
  async listHazardReports(status='pending',limit=25){
    const snapshot=await this.db.collection(COLLECTIONS.hazardReports).where('status','==',status).limit(limit).get();
    this.usage.read(queryReads(snapshot));
    return snapshot.docs.map(doc=>({id:doc.id,...doc.data()}));
  }

  async markHazardReport(id,status,fields={}){
    await this.db.collection(COLLECTIONS.hazardReports).doc(id).set({
      ...fields,status,vettedAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp(),
    },{merge:true});
    this.usage.write(1);
  }

  async getJobsByIds(ids = []){
    const unique = [...new Set(ids.filter(Boolean).map(String))];
    if(!unique.length) return [];
    const collection = this.db.collection(COLLECTIONS.jobs);
    const jobs = [];
    // Only ids this store has not already read, or has read and since written.
    // Within one pass the orchestration runs twice over very nearly the same id
    // list, so the second walk pays for the handful of jobs the pass itself
    // claimed, completed or queued rather than for all of them again.
    const wanted = unique.filter(id => !this.jobCache.has(id));
    for(const id of unique) if(this.jobCache.has(id)) jobs.push(this.jobCache.get(id));
    for(let index = 0; index < wanted.length; index += 300){
      const refs = wanted.slice(index, index + 300).map(id => collection.doc(id));
      const snapshots = await this.db.getAll(...refs);
      this.usage.read(refs.length);
      snapshots.forEach(snapshot => {
        if(!snapshot.exists) return;
        const job = { id: snapshot.id, ...snapshot.data() };
        // Absence is not cached. A missing id can be created later by
        // putJobIfAbsent, and re-reading it costs one document.
        this.jobCache.set(snapshot.id, job);
        jobs.push(job);
      });
    }
    return jobs.sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
  }

  async recoverExpiredJobs(options = {}){
    const now = options.now || new Date();
    const snapshot = await this.db.collection(COLLECTIONS.jobs).where('status', '==', 'running').get();
    this.usage.read(queryReads(snapshot));
    const expired = snapshot.docs.filter(doc => {
      const value = doc.data().leaseExpiresAt;
      const expiry = value?.toDate ? value.toDate() : value ? new Date(value) : null;
      return !expiry || expiry <= now;
    });
    if(!expired.length) return [];
    const batch = this.db.batch();
    expired.forEach(doc => batch.update(doc.ref, {
      status:'queued', workerId:FieldValue.delete(), startedAt:FieldValue.delete(),
      leaseExpiresAt:FieldValue.delete(), recoveredAt:Timestamp.fromDate(now),
      updatedAt:FieldValue.serverTimestamp(),
    }));
    await batch.commit();
    this.usage.write(expired.length);
    this.forgetJobs(expired.map(doc => doc.id));
    return expired.map(doc => doc.id);
  }

  // Jobs blocked by a provider outage before providerOutage() learned to spare
  // them. The rule is already written down in backoffice/services/provider-outage.js:
  // an outage says nothing about the job, so it must not spend the failure
  // budget. That guard only protects jobs failing from now on, and 'blocked' is
  // terminal — putJobIfAbsent will not recreate a job that already exists — so
  // work retired by a past outage stays retired forever unless something puts
  // it back.
  //
  // This applies the same rule retroactively: a blocked job whose recorded error
  // still reads as an outage is requeued with a fresh budget, because by current
  // policy it should never have been blocked at all. Jobs blocked for reasons of
  // their own are left exactly where they are.
  //
  // Bounded per pass on purpose. Releasing a large backlog at once would hit the
  // provider and the Firestore quota in the same breath, which is close to how
  // the backlog was created.
  async requeueOutageBlockedJobs(options = {}){
    const now = options.now || new Date();
    const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 10;
    const snapshot = await this.db.collection(COLLECTIONS.jobs)
      .where('status', '==', 'blocked').limit(200).get();
    this.usage.read(queryReads(snapshot));
    // Only lanes the caller still runs. A requeued job whose processor has been
    // removed goes back to 'queued' and stays there, and it spends the release
    // budget that live work needs: the first pass after this shipped released
    // ten image-coverage jobs, a lane retired the same day, while the
    // verification jobs behind them stayed blocked.
    const jobTypes = Array.isArray(options.jobTypes) && options.jobTypes.length
      ? new Set(options.jobTypes) : null;
    // One trail at a time when the caller asks for it. Releasing the whole
    // backlog means re-running every job that a provider outage killed, and if
    // they fail again for a reason of their own that is the credit budget spent
    // to learn it. Scoping to a single candidate answers the same question for
    // the price of one trail, using the same filter the specialist pass uses.
    const candidateId = String(options.specialistCandidateId || options.candidateId || '').trim() || null;
    const releasable = snapshot.docs
      .filter(doc => providerOutage(doc.data().lastError))
      .filter(doc => !jobTypes || jobTypes.has(doc.data().jobType))
      .filter(doc => !candidateId || doc.data().candidateId === candidateId)
      .slice(0, limit);
    if(!releasable.length) return [];
    const batch = this.db.batch();
    releasable.forEach(doc => batch.update(doc.ref, {
      status:'queued',
      // A fresh budget: the previous failures were the provider's, not the job's.
      systemFailures: 0,
      // lastError is kept. It is the only record of why the job stalled, and
      // the report groups by it.
      requeuedAfterOutageAt: Timestamp.fromDate(now),
      notBefore: FieldValue.delete(),
      workerId: FieldValue.delete(),
      startedAt: FieldValue.delete(),
      leaseExpiresAt: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    }));
    await batch.commit();
    this.usage.write(releasable.length);
    this.forgetJobs(releasable.map(doc => doc.id));
    return releasable.map(doc => doc.id);
  }

  // The sibling of requeueOutageBlockedJobs for a fault that was ours. The
  // caller names the error it has fixed; see workflows/requeue-fixed-jobs.js
  // for why there is no "release everything blocked".
  async requeueBlockedJobsMatching(jobIds = [], fields = {}){
    const ids = (Array.isArray(jobIds) ? jobIds : []).map(String).filter(Boolean);
    if(!ids.length) return [];
    const batch = this.db.batch();
    for(const id of ids){
      batch.update(this.db.collection(COLLECTIONS.jobs).doc(id), {
        status: 'queued',
        systemFailures: 0,
        requeuedAt: Timestamp.fromDate(new Date()),
        requeueReason: String(fields.requeueReason || 'the cause was fixed').slice(0, 300),
        notBefore: FieldValue.delete(),
        workerId: FieldValue.delete(),
        startedAt: FieldValue.delete(),
        leaseExpiresAt: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    this.usage.write(ids.length);
    this.forgetJobs(ids);
    return ids;
  }

  async claimJob(id, workerId, options = {}){
    const now = options.now || new Date();
    const leaseMs = options.leaseMs || 15 * 60 * 1000;
    const ref = this.db.collection(COLLECTIONS.jobs).doc(id);
    return this.db.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref);
      this.usage.read(1);
      if(!snapshot.exists) return null;
      const job = snapshot.data();
      const notBefore = job.notBefore?.toDate ? job.notBefore.toDate() : job.notBefore ? new Date(job.notBefore) : null;
      if(job.status !== 'queued' || (notBefore && notBefore > now)) return null;
      transaction.update(ref, {
        status: 'running', workerId, startedAt: Timestamp.fromDate(now),
        leaseExpiresAt: Timestamp.fromDate(new Date(now.getTime() + leaseMs)), updatedAt: FieldValue.serverTimestamp(),
      });
      this.usage.write(1);
      return { id, ...job, status: 'running', workerId, startedAt: now.toISOString() };
    }).finally(()=>this.forgetJobs([id]));
  }

  async completeJob(id, fields = {}){
    await this.db.collection(COLLECTIONS.jobs).doc(id).update({
      ...fields, status: 'ready-for-review', completedAt: FieldValue.serverTimestamp(),
      leaseExpiresAt: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp(),
    });
    this.usage.write(1);
    this.forgetJobs([id]);
  }

  async completeSystemJob(id, fields={}){
    await this.db.collection(COLLECTIONS.jobs).doc(id).update({...fields,status:'completed',completedAt:FieldValue.serverTimestamp(),
      leaseExpiresAt:FieldValue.delete(),updatedAt:FieldValue.serverTimestamp()});
    this.usage.write(1);
    this.forgetJobs([id]);
  }

  async markJobReviewed(id, action, reviewedAt){
    const status = action === 'approve' ? 'approved'
      : action === 'reject' ? 'rejected'
        : action === 'request-revision' ? 'revision-requested' : 'ready-for-review';
    await this.db.collection(COLLECTIONS.jobs).doc(id).update({
      status, reviewAction:action, reviewedAt:Timestamp.fromDate(new Date(reviewedAt)),
      updatedAt:FieldValue.serverTimestamp(),
    });
    this.usage.write(1);
    this.forgetJobs([id]);
  }

  async failJob(id, error, options = {}){
    const ref = this.db.collection(COLLECTIONS.jobs).doc(id);
    await this.db.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref); this.usage.read(1); if(!snapshot.exists) return;
      const job = snapshot.data();
      // A provider outage says nothing about the job, so it never counts towards
      // the failure budget and never blocks. It waits longer instead, because
      // retrying hard against an exhausted quota helps nobody.
      const outage = providerOutage(error);
      const failures = outage ? Number(job.systemFailures || 0) : Number(job.systemFailures || 0) + 1;
      const maximum = options.maximumFailures || 3;
      const blocked = !outage && failures >= maximum;
      const delayMs = outage
        ? (options.outageDelayMs || 1_800_000)
        : (options.retryDelaysMs || [60_000, 360_000, 1_440_000])[Math.min(failures - 1, 2)];
      transaction.update(ref, {
        status: blocked ? 'blocked' : 'queued', systemFailures: failures,
        lastError: String(error?.message || error).slice(0, 2000),
        ...(outage ? { providerOutages: Number(job.providerOutages || 0) + 1, lastOutageAt: FieldValue.serverTimestamp() } : {}),
        notBefore: blocked ? FieldValue.delete() : Timestamp.fromMillis(Date.now() + delayMs),
        leaseExpiresAt: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp(),
      });
      this.usage.write(1);
    }).finally(()=>this.forgetJobs([id]));
  }

  async listReviewCollection(collection,status){
    const key=`reviews:${collection}:${status}`;
    if(this.queryCache.has(key))return this.queryCache.get(key);
    const snapshot=await this.db.collection(collection).where('status','==',status).get();
    this.usage.read(queryReads(snapshot));
    const reviews=snapshot.docs.map(doc=>({id:doc.id,...doc.data()}));
    this.queryCache.set(key,reviews);return reviews;
  }

  async markReviewCollection(collection,id,status,fields={}){
    await this.db.collection(collection).doc(id).update({status,...fields,processedAt:FieldValue.serverTimestamp()});
    this.usage.write(1);
    this.invalidate(`reviews:${collection}:`);
  }

  async listReviews(status = 'queued'){
    return this.listReviewCollection(COLLECTIONS.reviews,status);
  }

  async markReview(id, status, fields = {}){
    return this.markReviewCollection(COLLECTIONS.reviews,id,status,fields);
  }

  async submitContentReview(input={}){
    const decisions=(Array.isArray(input.decisions)?input.decisions:[]).slice(0,20).map(decision=>({
      jobId:String(decision?.jobId||''),action:String(decision?.action||''),
      note:String(decision?.note||'').trim().slice(0,1500),
    })).filter(decision=>decision.jobId&&decision.action);
    if(!decisions.length)throw new Error('At least one content decision is required');
    const doc={contractVersion:'1.0.0',type:'verified-trail-content-review',gate:'content-review',status:'queued',
      decisions,submittedAt:FieldValue.serverTimestamp(),submittedBy:String(input.submittedBy||'backoffice-cli'),
      publicMutationAllowed:false};
    const ref=await this.db.collection(COLLECTIONS.reviews).add(doc);this.usage.write(1);
    this.invalidate(`reviews:${COLLECTIONS.reviews}:`);
    return {ok:true,reviewId:ref.id,status:'queued'};
  }

  async listPublicationReviews(status = 'queued'){
    return this.listReviewCollection(COLLECTIONS.publicationReviews,status);
  }

  async markPublicationReview(id, status, fields = {}){
    return this.markReviewCollection(COLLECTIONS.publicationReviews,id,status,fields);
  }

  async submitPublicationReview(input={}){
    const doc={contractVersion:'1.0.0',type:'verified-trail-publication-review',status:'queued',
      candidateId:String(input.candidateId||''),action:String(input.action||''),
      note:String(input.note||'').trim().slice(0,1500),submittedAt:FieldValue.serverTimestamp(),
      submittedBy:String(input.submittedBy||'backoffice-cli'),publicMutationAllowed:false};
    if(!doc.candidateId||!doc.action)throw new Error('Publication candidate and action are required');
    const ref=await this.db.collection(COLLECTIONS.publicationReviews).add(doc);this.usage.write(1);
    this.invalidate(`reviews:${COLLECTIONS.publicationReviews}:`);
    return {ok:true,reviewId:ref.id,status:'queued'};
  }

  async listDossierReviews(status = 'queued'){
    return this.listReviewCollection(COLLECTIONS.dossierReviews,status);
  }

  async markDossierReview(id,status,fields={}){
    return this.markReviewCollection(COLLECTIONS.dossierReviews,id,status,fields);
  }

  async listRouteReviews(status='queued'){
    return this.listReviewCollection(COLLECTIONS.routeReviews,status);
  }

  async markRouteReview(id,status,fields={}){
    return this.markReviewCollection(COLLECTIONS.routeReviews,id,status,fields);
  }

  // Submit an auditable decision from a credentialed context (CLI/workflow),
  // writing exactly the queued doc the desk's ORMABackoffice.submitDossierReview
  // writes, so the worker's apply step reads it identically. The actor field
  // distinguishes moderator decisions from the existing-trail evidence policy.
  async submitDossierReview(input={}){
    const doc={
      contractVersion:'1.0.0',type:'trail-dossier-review',status:'queued',
      reviewId:String(input.reviewId||''),candidateId:String(input.candidateId||''),
      action:String(input.action||''),targetAgent:String(input.targetAgent||''),
      note:String(input.note||'').trim().slice(0,1500),
      acceptedBlockers:(Array.isArray(input.acceptedBlockers)?input.acceptedBlockers:[])
        .slice(0,50)
        .map(entry=>({blocker:String(entry&&entry.blocker||'').slice(0,300),
          reason:String(entry&&entry.reason||'').trim().slice(0,300)}))
        .filter(entry=>entry.blocker&&entry.reason),
      submittedAt:FieldValue.serverTimestamp(),
      submittedBy:String(input.submittedBy||'backoffice-cli'),publicMutationAllowed:false,
    };
    const ref=await this.db.collection(COLLECTIONS.dossierReviews).add(doc);this.usage.write(1);
    // The cache key is `reviews:<collection>:<status>`, so the prefix has to
    // carry the `reviews:` segment -- see listReviewCollection. Without it the
    // apply step later in the same pass re-reads the pre-submit list.
    this.invalidate(`reviews:${COLLECTIONS.dossierReviews}:`);
    return {ok:true,reviewId:ref.id,status:'queued'};
  }

  async submitRouteReview(input={}){
    const doc={
      contractVersion:'1.0.0',type:'route-choice-review',status:'queued',
      candidateId:String(input.candidateId||''),action:String(input.action||''),
      proposalIds:Array.isArray(input.proposalIds)?input.proposalIds.map(id=>String(id)).slice(0,6):[],
      note:String(input.note||'').trim().slice(0,1500),
      submittedAt:FieldValue.serverTimestamp(),
      submittedBy:String(input.submittedBy||'backoffice-cli'),publicMutationAllowed:false,
    };
    const ref=await this.db.collection(COLLECTIONS.routeReviews).add(doc);this.usage.write(1);
    this.invalidate(`reviews:${COLLECTIONS.routeReviews}:`);
    return {ok:true,reviewId:ref.id,status:'queued'};
  }

  async listNewTrailReviews(status='queued'){
    return this.listReviewCollection(COLLECTIONS.newTrailReviews,status);
  }

  async markNewTrailReview(id,status,fields={}){
    return this.markReviewCollection(COLLECTIONS.newTrailReviews,id,status,fields);
  }

  async listHazardReviews(status='queued'){
    return this.listReviewCollection(COLLECTIONS.hazardReviews,status);
  }

  async markHazardReview(id,status,fields={}){
    return this.markReviewCollection(COLLECTIONS.hazardReviews,id,status,fields);
  }

  async listEditorialReviews(status='queued'){
    return this.listReviewCollection(COLLECTIONS.editorialReviews,status);
  }

  async markEditorialReview(id,status,fields={}){
    return this.markReviewCollection(COLLECTIONS.editorialReviews,id,status,fields);
  }

  async listNewsletterReviews(status='queued'){
    return this.listReviewCollection(COLLECTIONS.newsletterReviews,status);
  }

  async markNewsletterReview(id,status,fields={}){
    return this.markReviewCollection(COLLECTIONS.newsletterReviews,id,status,fields);
  }

  async listAnalystReviews(status='queued'){
    return this.listReviewCollection(COLLECTIONS.analystReviews,status);
  }

  async markAnalystReview(id,status,fields={}){
    return this.markReviewCollection(COLLECTIONS.analystReviews,id,status,fields);
  }
}

module.exports = {
  COLLECTIONS, ARTIFACT_DATA_ENCODING, encodeArtifactData, decodeArtifactData,
  adminApp, backofficeDb, FirestoreBackofficeStore,
};
