'use strict';

const { getApps, initializeApp, applicationDefault, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');

const COLLECTIONS = Object.freeze({
  artifacts: 'backofficeArtifacts',
  jobs: 'backofficeJobs',
  reviews: 'backofficeReviews',
  publicationReviews: 'backofficePublicationReviews',
  dossierReviews: 'backofficeDossierReviews',
  newTrailReviews:'backofficeNewTrailReviews',
  hazardReviews:'backofficeHazardReviews',
  editorialReviews:'backofficeEditorialReviews',
  imageReviews:'backofficeImageReviews',
  imageUploads:'backofficeImageUploads',
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
  }

  invalidate(prefix){
    for(const key of this.queryCache.keys()) if(key.startsWith(prefix)) this.queryCache.delete(key);
  }

  async getArtifact(id){
    if(this.artifactCache.has(id)) return this.artifactCache.get(id);
    const snapshot = await this.db.collection(COLLECTIONS.artifacts).doc(id).get();
    const data=snapshot.exists ? decodeArtifactData(snapshot.data()) : null;
    this.artifactCache.set(id,data);return data;
  }

  async setArtifact(id, data, metadata = {}){
    await this.db.collection(COLLECTIONS.artifacts).doc(id).set({
      contractVersion: '1.0.0', artifactId: id, ...metadata,
      ...encodeArtifactData(data), updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    this.artifactCache.set(id,data);
  }

  async setArtifactIfAbsent(id,data,metadata={}){
    const ref=this.db.collection(COLLECTIONS.artifacts).doc(id);
    const created=await this.db.runTransaction(async transaction=>{
      const snapshot=await transaction.get(ref);if(snapshot.exists)return false;
      transaction.set(ref,{contractVersion:'1.0.0',artifactId:id,...metadata,
        ...encodeArtifactData(data),updatedAt:FieldValue.serverTimestamp()});return true;
    });
    if(created)this.artifactCache.set(id,data);else this.artifactCache.delete(id);
    return created;
  }

  async getImageUpload(reference){
    const match=String(reference||'').match(/^backofficeImageUploads\/([A-Za-z0-9_-]+)$/);
    if(!match)throw new Error('Invalid temporary trail image reference');
    const snapshot=await this.db.collection(COLLECTIONS.imageUploads).doc(match[1]).get();
    return snapshot.exists?{id:snapshot.id,...snapshot.data()}:null;
  }

  async deleteImageUpload(reference){
    const match=String(reference||'').match(/^backofficeImageUploads\/([A-Za-z0-9_-]+)$/);
    if(!match)throw new Error('Invalid temporary trail image reference');
    await this.db.collection(COLLECTIONS.imageUploads).doc(match[1]).delete();
  }

  async putJob(job){
    await this.db.collection(COLLECTIONS.jobs).doc(job.id).set({ ...job, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    this.invalidate('jobs:');
  }

  async putJobIfAbsent(job){
    const ref=this.db.collection(COLLECTIONS.jobs).doc(job.id);
    return this.db.runTransaction(async transaction=>{
      const snapshot=await transaction.get(ref);if(snapshot.exists){this.invalidate('jobs:');return false;}
      transaction.set(ref,{...job,updatedAt:FieldValue.serverTimestamp()});return true;
    }).finally(()=>this.invalidate('jobs:'));
  }

  async listJobs(statuses = ['queued']){
    const key=`jobs:${[...statuses].sort().join(',')}`;
    if(this.queryCache.has(key)) return this.queryCache.get(key);
    const snapshots = await Promise.all(statuses.map(status => this.db.collection(COLLECTIONS.jobs).where('status', '==', status).get()));
    const jobs=snapshots.flatMap(snapshot => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
      .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
    this.queryCache.set(key,jobs);return jobs;
  }

  async recoverExpiredJobs(options = {}){
    const now = options.now || new Date();
    const snapshot = await this.db.collection(COLLECTIONS.jobs).where('status', '==', 'running').get();
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
    this.invalidate('jobs:');
    return expired.map(doc => doc.id);
  }

  async claimJob(id, workerId, options = {}){
    const now = options.now || new Date();
    const leaseMs = options.leaseMs || 15 * 60 * 1000;
    const ref = this.db.collection(COLLECTIONS.jobs).doc(id);
    return this.db.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref);
      if(!snapshot.exists) return null;
      const job = snapshot.data();
      const notBefore = job.notBefore?.toDate ? job.notBefore.toDate() : job.notBefore ? new Date(job.notBefore) : null;
      if(job.status !== 'queued' || (notBefore && notBefore > now)) return null;
      transaction.update(ref, {
        status: 'running', workerId, startedAt: Timestamp.fromDate(now),
        leaseExpiresAt: Timestamp.fromDate(new Date(now.getTime() + leaseMs)), updatedAt: FieldValue.serverTimestamp(),
      });
      return { id, ...job, status: 'running', workerId, startedAt: now.toISOString() };
    }).finally(()=>this.invalidate('jobs:'));
  }

  async completeJob(id, fields = {}){
    await this.db.collection(COLLECTIONS.jobs).doc(id).update({
      ...fields, status: 'ready-for-review', completedAt: FieldValue.serverTimestamp(),
      leaseExpiresAt: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp(),
    });
    this.invalidate('jobs:');
  }

  async completeSystemJob(id, fields={}){
    await this.db.collection(COLLECTIONS.jobs).doc(id).update({...fields,status:'completed',completedAt:FieldValue.serverTimestamp(),
      leaseExpiresAt:FieldValue.delete(),updatedAt:FieldValue.serverTimestamp()});
    this.invalidate('jobs:');
  }

  async markJobReviewed(id, action, reviewedAt){
    const status = action === 'approve' ? 'approved'
      : action === 'reject' ? 'rejected'
        : action === 'request-revision' ? 'revision-requested' : 'ready-for-review';
    await this.db.collection(COLLECTIONS.jobs).doc(id).update({
      status, reviewAction:action, reviewedAt:Timestamp.fromDate(new Date(reviewedAt)),
      updatedAt:FieldValue.serverTimestamp(),
    });
    this.invalidate('jobs:');
  }

  async failJob(id, error, options = {}){
    const ref = this.db.collection(COLLECTIONS.jobs).doc(id);
    await this.db.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref); if(!snapshot.exists) return;
      const job = snapshot.data(); const failures = Number(job.systemFailures || 0) + 1;
      const maximum = options.maximumFailures || 3; const blocked = failures >= maximum;
      const delayMs = (options.retryDelaysMs || [60_000, 360_000, 1_440_000])[Math.min(failures - 1, 2)];
      transaction.update(ref, {
        status: blocked ? 'blocked' : 'queued', systemFailures: failures,
        lastError: String(error?.message || error).slice(0, 2000),
        notBefore: blocked ? FieldValue.delete() : Timestamp.fromMillis(Date.now() + delayMs),
        leaseExpiresAt: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp(),
      });
    }).finally(()=>this.invalidate('jobs:'));
  }

  async listReviewCollection(collection,status){
    const key=`reviews:${collection}:${status}`;
    if(this.queryCache.has(key))return this.queryCache.get(key);
    const snapshot=await this.db.collection(collection).where('status','==',status).get();
    const reviews=snapshot.docs.map(doc=>({id:doc.id,...doc.data()}));
    this.queryCache.set(key,reviews);return reviews;
  }

  async markReviewCollection(collection,id,status,fields={}){
    await this.db.collection(collection).doc(id).update({status,...fields,processedAt:FieldValue.serverTimestamp()});
    this.invalidate(`reviews:${collection}:`);
  }

  async listReviews(status = 'queued'){
    return this.listReviewCollection(COLLECTIONS.reviews,status);
  }

  async markReview(id, status, fields = {}){
    return this.markReviewCollection(COLLECTIONS.reviews,id,status,fields);
  }

  async listPublicationReviews(status = 'queued'){
    return this.listReviewCollection(COLLECTIONS.publicationReviews,status);
  }

  async markPublicationReview(id, status, fields = {}){
    return this.markReviewCollection(COLLECTIONS.publicationReviews,id,status,fields);
  }

  async listDossierReviews(status = 'queued'){
    return this.listReviewCollection(COLLECTIONS.dossierReviews,status);
  }

  async markDossierReview(id,status,fields={}){
    return this.markReviewCollection(COLLECTIONS.dossierReviews,id,status,fields);
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

  async listImageReviews(status='queued'){
    return this.listReviewCollection(COLLECTIONS.imageReviews,status);
  }

  async markImageReview(id,status,fields={}){
    return this.markReviewCollection(COLLECTIONS.imageReviews,id,status,fields);
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
