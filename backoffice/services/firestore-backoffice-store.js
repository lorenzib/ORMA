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
  return initializeApp({ credential, projectId: options.projectId || process.env.FIREBASE_PROJECT_ID || 'dolopaws' });
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
  constructor(options = {}){ this.db = backofficeDb(options); }

  async getArtifact(id){
    const snapshot = await this.db.collection(COLLECTIONS.artifacts).doc(id).get();
    return snapshot.exists ? decodeArtifactData(snapshot.data()) : null;
  }

  async setArtifact(id, data, metadata = {}){
    await this.db.collection(COLLECTIONS.artifacts).doc(id).set({
      contractVersion: '1.0.0', artifactId: id, ...metadata,
      ...encodeArtifactData(data), updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  async setArtifactIfAbsent(id,data,metadata={}){
    const ref=this.db.collection(COLLECTIONS.artifacts).doc(id);
    return this.db.runTransaction(async transaction=>{
      const snapshot=await transaction.get(ref);if(snapshot.exists)return false;
      transaction.set(ref,{contractVersion:'1.0.0',artifactId:id,...metadata,
        ...encodeArtifactData(data),updatedAt:FieldValue.serverTimestamp()});return true;
    });
  }

  async putJob(job){
    await this.db.collection(COLLECTIONS.jobs).doc(job.id).set({ ...job, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }

  async putJobIfAbsent(job){
    const ref=this.db.collection(COLLECTIONS.jobs).doc(job.id);
    return this.db.runTransaction(async transaction=>{
      const snapshot=await transaction.get(ref);if(snapshot.exists)return false;
      transaction.set(ref,{...job,updatedAt:FieldValue.serverTimestamp()});return true;
    });
  }

  async listJobs(statuses = ['queued']){
    const snapshots = await Promise.all(statuses.map(status => this.db.collection(COLLECTIONS.jobs).where('status', '==', status).get()));
    return snapshots.flatMap(snapshot => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
      .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
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
    });
  }

  async completeJob(id, fields = {}){
    await this.db.collection(COLLECTIONS.jobs).doc(id).update({
      ...fields, status: 'ready-for-review', completedAt: FieldValue.serverTimestamp(),
      leaseExpiresAt: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp(),
    });
  }

  async completeSystemJob(id, fields={}){
    await this.db.collection(COLLECTIONS.jobs).doc(id).update({...fields,status:'completed',completedAt:FieldValue.serverTimestamp(),
      leaseExpiresAt:FieldValue.delete(),updatedAt:FieldValue.serverTimestamp()});
  }

  async markJobReviewed(id, action, reviewedAt){
    const status = action === 'approve' ? 'approved'
      : action === 'reject' ? 'rejected'
        : action === 'request-revision' ? 'revision-requested' : 'ready-for-review';
    await this.db.collection(COLLECTIONS.jobs).doc(id).update({
      status, reviewAction:action, reviewedAt:Timestamp.fromDate(new Date(reviewedAt)),
      updatedAt:FieldValue.serverTimestamp(),
    });
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
    });
  }

  async listReviews(status = 'queued'){
    const snapshot = await this.db.collection(COLLECTIONS.reviews).where('status', '==', status).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async markReview(id, status, fields = {}){
    await this.db.collection(COLLECTIONS.reviews).doc(id).update({ status, ...fields, processedAt: FieldValue.serverTimestamp() });
  }

  async listPublicationReviews(status = 'queued'){
    const snapshot = await this.db.collection(COLLECTIONS.publicationReviews).where('status', '==', status).get();
    return snapshot.docs.map(doc => ({ id:doc.id, ...doc.data() }));
  }

  async markPublicationReview(id, status, fields = {}){
    await this.db.collection(COLLECTIONS.publicationReviews).doc(id).update({ status, ...fields, processedAt:FieldValue.serverTimestamp() });
  }

  async listDossierReviews(status = 'queued'){
    const snapshot=await this.db.collection(COLLECTIONS.dossierReviews).where('status','==',status).get();
    return snapshot.docs.map(doc=>({id:doc.id,...doc.data()}));
  }

  async markDossierReview(id,status,fields={}){
    await this.db.collection(COLLECTIONS.dossierReviews).doc(id).update({status,...fields,processedAt:FieldValue.serverTimestamp()});
  }

  async listNewTrailReviews(status='queued'){
    const snapshot=await this.db.collection(COLLECTIONS.newTrailReviews).where('status','==',status).get();
    return snapshot.docs.map(doc=>({id:doc.id,...doc.data()}));
  }

  async markNewTrailReview(id,status,fields={}){
    await this.db.collection(COLLECTIONS.newTrailReviews).doc(id).update({status,...fields,processedAt:FieldValue.serverTimestamp()});
  }

  async listHazardReviews(status='queued'){
    const snapshot=await this.db.collection(COLLECTIONS.hazardReviews).where('status','==',status).get();
    return snapshot.docs.map(doc=>({id:doc.id,...doc.data()}));
  }

  async markHazardReview(id,status,fields={}){
    await this.db.collection(COLLECTIONS.hazardReviews).doc(id).update({status,...fields,processedAt:FieldValue.serverTimestamp()});
  }

  async listEditorialReviews(status='queued'){
    const snapshot=await this.db.collection(COLLECTIONS.editorialReviews).where('status','==',status).get();
    return snapshot.docs.map(doc=>({id:doc.id,...doc.data()}));
  }

  async markEditorialReview(id,status,fields={}){
    await this.db.collection(COLLECTIONS.editorialReviews).doc(id).update({status,...fields,processedAt:FieldValue.serverTimestamp()});
  }

  async listImageReviews(status='queued'){
    const snapshot=await this.db.collection(COLLECTIONS.imageReviews).where('status','==',status).get();
    return snapshot.docs.map(doc=>({id:doc.id,...doc.data()}));
  }

  async markImageReview(id,status,fields={}){
    await this.db.collection(COLLECTIONS.imageReviews).doc(id).update({status,...fields,processedAt:FieldValue.serverTimestamp()});
  }

  async listNewsletterReviews(status='queued'){
    const snapshot=await this.db.collection(COLLECTIONS.newsletterReviews).where('status','==',status).get();
    return snapshot.docs.map(doc=>({id:doc.id,...doc.data()}));
  }

  async markNewsletterReview(id,status,fields={}){
    await this.db.collection(COLLECTIONS.newsletterReviews).doc(id).update({status,...fields,processedAt:FieldValue.serverTimestamp()});
  }

  async listAnalystReviews(status='queued'){
    const snapshot=await this.db.collection(COLLECTIONS.analystReviews).where('status','==',status).get();
    return snapshot.docs.map(doc=>({id:doc.id,...doc.data()}));
  }

  async markAnalystReview(id,status,fields={}){
    await this.db.collection(COLLECTIONS.analystReviews).doc(id).update({status,...fields,processedAt:FieldValue.serverTimestamp()});
  }
}

module.exports = {
  COLLECTIONS, ARTIFACT_DATA_ENCODING, encodeArtifactData, decodeArtifactData,
  adminApp, backofficeDb, FirestoreBackofficeStore,
};
