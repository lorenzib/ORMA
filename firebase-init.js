const firebaseConfig = {
  apiKey: "AIzaSyDnEJKnoDltKwpl4QdhA-qLH3a4ugLd68M",
  authDomain: "auth.app-orma.com",
  projectId: "dolopaws",
  storageBucket: "dolopaws.firebasestorage.app",
  messagingSenderId: "331415525455",
  appId: "1:331415525455:web:4a714eea0e95dc9a4ff23a",
  measurementId: "G-LDBKZZDJ2G"
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut as fbSignOut, onAuthStateChanged, GoogleAuthProvider, OAuthProvider, signInWithPopup,
  sendPasswordResetEmail, deleteUser, reauthenticateWithCredential,
  EmailAuthProvider, reauthenticateWithPopup, verifyBeforeUpdateEmail,
  sendEmailVerification, reload, updateProfile, getIdTokenResult
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, deleteDoc,
  collection, addDoc, serverTimestamp, query, where, Timestamp,
  getCountFromServer, getDocs, updateDoc, writeBatch, increment,
  orderBy, limit, runTransaction
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
// Apple sign-in is wired but stays hidden until the provider is configured
// in Firebase with the Apple Developer Services ID — flip this to true then.
const APPLE_SIGNIN_READY = false;
const appleProvider = new OAuthProvider('apple.com');
appleProvider.addScope('email');
appleProvider.addScope('name');

let currentUser = null;
let authResolved = false;
let lastDogProfileError = null;
const changeListeners = [];
let profileSummarySyncVersion = 0;

function cacheProfileSummary(summary) {
  if (summary) localStorage.setItem('dolopaws-profile-summary', JSON.stringify(summary));
  else localStorage.removeItem('dolopaws-profile-summary');
  window.dispatchEvent(new CustomEvent('dolopaws-profile-summary-changed', {
    detail: { summary: summary || null },
  }));
}

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  authResolved = true;
  // Remove a cached member immediately on a definitive logout before any
  // listeners decide whether to show protected UI. Signed-in refreshes can
  // continue asynchronously without blocking the restored session.
  syncProfileSummary(user);
  changeListeners.forEach(fn => fn(user));
});

// Cached multi-dog summary so static pages can paint the selected dog and
// offer the same switcher even when they do not load Firebase themselves.
// Cleared on logout.
async function syncProfileSummary(user) {
  const syncVersion = ++profileSummarySyncVersion;
  try {
    if (!user) { cacheProfileSummary(null); return; }
    const dogState = await getDogProfiles();
    // Keep the last known-good header/profile summary during a transient
    // Firestore failure. Replacing it with an empty account is what made the
    // header and the profile manager disagree after navigation.
    if (dogState && dogState.loadError) return;
    const dog = dogState.dogs.find(item => item.id === dogState.activeDogId) || dogState.dogs[0] || null;
    // Breed/fitness/saved-count feed the header dog menu on the static
    // pages, which have no Firebase and read only this cache.
    let saved = null;
    try { saved = Object.keys((await getFavorites()) || {}).length; } catch (e) {}
    let moderator = false;
    try { moderator = (await getIdTokenResult(user)).claims.moderator === true; } catch (e) {}
    // A slower request started before a profile/photo save must never replace
    // the newer cache when it eventually finishes.
    if (syncVersion !== profileSummarySyncVersion || !currentUser || currentUser.uid !== user.uid) return;
    cacheProfileSummary({
      uid: user.uid,
      hasProfile: !!dog,
      activeDogId: dog && dog.id || null,
      name: dog && dog.name ? String(dog.name).slice(0, 40) : null,
      breed: dog && dog.breed ? String(dog.breed).slice(0, 240) : null,
      fitness: dog && dog.fitness ? String(dog.fitness).slice(0, 20) : null,
      dogs: dogState.dogs.map(item => ({
        id:item.id,
        name:item.name ? String(item.name).slice(0, 40) : 'Your dog',
        breed:item.breed ? String(item.breed).slice(0, 240) : null,
        fitness:item.fitness ? String(item.fitness).slice(0, 20) : null,
        photo:typeof item.photo === 'string' && item.photo.startsWith('data:image/') ? item.photo : null,
      })),
      moderator,
      saved,
    });
  } catch (e) { /* cache only — never break auth over it */ }
}

async function getFavorites() {
  if (!currentUser) return {};
  try {
    const snap = await getDoc(doc(db, "users", currentUser.uid));
    return snap.exists() ? (snap.data().favorites || {}) : {};
  } catch (e) {
    console.error("Failed to load favorites:", e);
    return {};
  }
}

async function setFavorites(favoritesObj) {
  if (!currentUser) return false;
  try {
    await setDoc(doc(db, "users", currentUser.uid), { favorites: favoritesObj }, { merge: true });
    return true;
  } catch (e) {
    console.error("Failed to save favorites:", e);
    return false;
  }
}

function dogId(dog, index) {
  if (dog && typeof dog.id === 'string' && /^[A-Za-z0-9._-]{1,80}$/.test(dog.id)) return dog.id;
  const base = String(dog && dog.name || 'dog').toLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'dog';
  return `${base}-${index + 1}`;
}

// Older single-dog profiles predate the strict Firestore schema. In
// particular, medical notes used to live at vet.medical. Multi-dog writes
// must not copy unsupported legacy keys into the new `dogs` array because
// Firestore validates every dog in the document, including existing ones.
function sanitizedDogProfile(dog, index) {
  const source = dog && typeof dog === 'object' ? dog : {};
  const clean = {};
  const stringFields = {
    name:40, breed:240, dob:10, ageBand:10, weightBand:10,
    size:20, neuter:20, coat:20, healthNotes:1000, photoId:80,
  };
  Object.entries(stringFields).forEach(([field, maximum]) => {
    if (source[field] == null) {
      if (source[field] === null) clean[field] = null;
      return;
    }
    if (typeof source[field] === 'string') clean[field] = source[field].slice(0, maximum);
  });
  if (['low', 'moderate', 'high'].includes(source.fitness)) clean.fitness = source.fitness;
  if (typeof source.weight === 'number' && source.weight >= 2 && source.weight <= 60) clean.weight = source.weight;
  if (source.age === null || (typeof source.age === 'number' && source.age >= 0 && source.age <= 30)) clean.age = source.age;
  if (Array.isArray(source.sens)) clean.sens = source.sens.slice(0, 10);
  if (Array.isArray(source.conditions)) clean.conditions = source.conditions.slice(0, 10);
  const validPhoto = value => typeof value === 'string'
    && /^data:image\/(jpeg|jpg|png|webp);base64,/.test(value)
    && value.length <= 700000;
  const requestedPhotos = Array.isArray(source.photos) ? source.photos : [];
  const photos = [];
  let photoDataSize = 0;
  requestedPhotos.forEach(value => {
    if(!validPhoto(value) || photos.includes(value) || photos.length >= 4) return;
    if(photoDataSize + value.length > 780000) return;
    photos.push(value);
    photoDataSize += value.length;
  });
  if(validPhoto(source.photo) && !photos.includes(source.photo)
    && photos.length < 4 && photoDataSize + source.photo.length <= 780000){
    photos.unshift(source.photo);
  }
  if(photos.length){
    clean.photos = photos.slice(0, 4);
    clean.photo = clean.photos[0];
  } else if(source.photo === null || source.photos != null){
    clean.photo = null;
    clean.photos = [];
  }
  ['jointIssues', 'heatIssues'].forEach(field => {
    if (typeof source[field] === 'boolean') clean[field] = source[field];
  });

  if (source.vet && typeof source.vet === 'object') {
    clean.vet = {};
    const limits = { name:100, phone:40, chip:80, insurer:100, policy:100 };
    Object.entries(limits).forEach(([field, maximum]) => {
      if (typeof source.vet[field] === 'string') clean.vet[field] = source.vet[field].slice(0, maximum);
    });
    if (!clean.healthNotes && typeof source.vet.medical === 'string') {
      clean.healthNotes = source.vet.medical.slice(0, 1000);
    }
  }
  if (source.owner && typeof source.owner === 'object') {
    clean.owner = {};
    const limits = { name:100, phone:40, email:254, emName:100, emPhone:40 };
    Object.entries(limits).forEach(([field, maximum]) => {
      if (typeof source.owner[field] === 'string') clean.owner[field] = source.owner[field].slice(0, maximum);
    });
  }
  clean.id = dogId({ ...source, ...clean }, index);
  return clean;
}

// Older builds could copy one unlabelled photo into several dog profiles.
// New uploads carry a unique photoId, so the same image is allowed only when
// it was deliberately uploaded for each dog. For legacy duplicates, retain
// the first stable owner and clear the accidental copies.
function reconcileLegacyDogPhotos(dogs) {
  const groups = new Map();
  dogs.forEach((dog, index) => {
    if (!dog.photo) return;
    const group = groups.get(dog.photo) || [];
    group.push({ dog, index });
    groups.set(dog.photo, group);
  });
  groups.forEach(group => {
    if (group.length < 2) return;
    const marked = group.filter(item => item.dog.photoId);
    const keptPhotoIds = new Set();
    group.forEach((item, groupIndex) => {
      const marker = item.dog.photoId;
      const keep = marked.length
        ? !!marker && !keptPhotoIds.has(marker)
        : groupIndex === 0;
      if (keep && marker) keptPhotoIds.add(marker);
      if (!keep) {
        item.dog.photo = null;
        delete item.dog.photoId;
      }
    });
  });
  return dogs;
}

function newDogPhotoId(id) {
  const random = Math.random().toString(36).slice(2, 10);
  return `photo-${String(id || 'dog').slice(0, 40)}-${Date.now().toString(36)}-${random}`.slice(0, 80);
}

function normalizedDogState(data) {
  let dogs = Array.isArray(data && data.dogs) ? data.dogs.filter(Boolean) : [];
  if (!dogs.length && data && data.dog) dogs = [data.dog];
  dogs = reconcileLegacyDogPhotos(dogs.slice(0, 5).map(sanitizedDogProfile));
  const requested = data && data.activeDogId;
  const activeDogId = dogs.some(dog => dog.id === requested)
    ? requested : dogs[0] && dogs[0].id || null;
  return { dogs, activeDogId };
}

async function getDogProfiles() {
  if (!currentUser) return null;
  try {
    const snap = await getDoc(doc(db, "users", currentUser.uid));
    return normalizedDogState(snap.exists() ? snap.data() : {});
  } catch (e) {
    console.error("Failed to load dog profiles:", e);
    // A failed read is not the same thing as an account with no dogs.
    return {
      dogs:[], activeDogId:null, loadError:true,
      errorCode:e && e.code ? String(e.code) : 'profile-read-failed',
    };
  }
}

async function getDogProfile() {
  const state = await getDogProfiles();
  if (!state) return null;
  return state.dogs.find(dog => dog.id === state.activeDogId) || state.dogs[0] || null;
}

function dogStatePayload(state, existing) {
  existing = existing && typeof existing === 'object' ? existing : {};
  const dogs = state.dogs.slice(0, 5).map(sanitizedDogProfile);
  const active = dogs.find(dog => dog.id === state.activeDogId) || dogs[0] || null;
  const payload = { dogs, activeDogId:active ? active.id : null, dog:active };
  if (existing.favorites && typeof existing.favorites === 'object' && !Array.isArray(existing.favorites)) {
    payload.favorites = Object.fromEntries(Object.entries(existing.favorites).slice(0, 250));
  }
  if (Array.isArray(existing.lastMatches)) payload.lastMatches = existing.lastMatches.slice(0, 250);
  if (Array.isArray(existing.notifSeen)) payload.notifSeen = existing.notifSeen.slice(-300);
  if (existing.notifSeenAt instanceof Timestamp) payload.notifSeenAt = existing.notifSeenAt;
  if (existing.createdAt instanceof Timestamp) payload.createdAt = existing.createdAt;
  if (existing.updatedAt instanceof Timestamp) payload.updatedAt = existing.updatedAt;
  return { payload, dogs, active };
}

// A dog write is complete when its Firestore transaction commits. Paint the
// new selected dog into the local summary immediately so navigation updates
// without waiting for unrelated favorites and moderator lookups.
function cacheCommittedDogSummary(user, committed) {
  if (!user || !committed) return;
  try {
    let previous = null;
    try {
      previous = JSON.parse(localStorage.getItem('dolopaws-profile-summary') || 'null');
    } catch (e) {}
    const sameUser = previous && previous.uid === user.uid ? previous : null;
    const dog = committed.active;
    cacheProfileSummary({
      uid:user.uid,
      hasProfile:!!dog,
      activeDogId:dog && dog.id || null,
      name:dog && dog.name ? String(dog.name).slice(0, 40) : null,
      breed:dog && dog.breed ? String(dog.breed).slice(0, 240) : null,
      fitness:dog && dog.fitness ? String(dog.fitness).slice(0, 20) : null,
      dogs:committed.dogs.map(item => ({
        id:item.id,
        name:item.name ? String(item.name).slice(0, 40) : 'Your dog',
        breed:item.breed ? String(item.breed).slice(0, 240) : null,
        fitness:item.fitness ? String(item.fitness).slice(0, 20) : null,
        photo:typeof item.photo === 'string' && item.photo.startsWith('data:image/') ? item.photo : null,
      })),
      moderator:sameUser ? sameUser.moderator === true : false,
      saved:sameUser && typeof sameUser.saved === 'number' ? sameUser.saved : null,
    });
  } catch (e) { /* cache only — the committed save still succeeded */ }
}

// Every dog mutation is transactional. Photo uploads, profile switches and
// edits can therefore finish in any order without one stale full-document
// write erasing another dog's newer photo.
async function mutateDogState(mutator) {
  if (!currentUser) return false;
  const mutationUser = currentUser;
  const userRef = doc(db, "users", mutationUser.uid);
  let committed = null;
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(userRef);
    const existing = snapshot.exists() ? snapshot.data() : {};
    const current = normalizedDogState(existing);
    const next = mutator(current);
    if (!next) return;
    committed = dogStatePayload(next, existing);
    transaction.set(userRef, committed.payload);
  });
  if (!committed) return false;
  if (currentUser && currentUser.uid === mutationUser.uid) {
    cacheCommittedDogSummary(mutationUser, committed);
    // Refresh favorites and moderator status in the background. Neither is
    // part of saving a dog, so a slow lookup must not hold the form hostage.
    syncProfileSummary(mutationUser);
  }
  window.dispatchEvent(new CustomEvent('dolopaws-dog-profile-saved', {
    detail:{ profile:committed.active, dogs:committed.dogs, activeDogId:committed.payload.activeDogId }
  }));
  return true;
}

async function setDogProfile(dogObj, targetDogId) {
  if (!currentUser) return false;
  try {
    if (!dogObj) {
      return await mutateDogState(state => {
        const dogs = state.dogs.filter(dog => dog.id !== state.activeDogId);
        return { dogs, activeDogId:dogs[0] && dogs[0].id || null };
      });
    }
    return await mutateDogState(state => {
      const requestedId = typeof targetDogId === 'string' ? targetDogId : state.activeDogId;
      const index = state.dogs.findIndex(dog => dog.id === requestedId);
      if (index < 0) {
        if (typeof targetDogId === 'string') return null;
        if (state.dogs.length >= 5) return null;
        const occupied = new Set(state.dogs.map(dog => dog.id));
        let id = dogId(dogObj, state.dogs.length), suffix = 2;
        while (occupied.has(id)) id = `${dogId(dogObj, state.dogs.length).slice(0, 70)}-${suffix++}`;
        const dog = { ...dogObj, id };
        if (typeof dog.photo === 'string' && dog.photo.startsWith('data:image/')) dog.photoId = newDogPhotoId(id);
        return { dogs:state.dogs.concat(dog), activeDogId:id };
      }
      const dogs = state.dogs.slice();
      const existingDog = dogs[index];
      const nextDog = { ...existingDog, ...dogObj, id:existingDog.id };
      if (Array.isArray(dogObj.photos)) {
        nextDog.photos = dogObj.photos.slice(0, 4);
        nextDog.photo = nextDog.photos[0] || null;
      }
      if (Object.prototype.hasOwnProperty.call(dogObj, 'photo')) {
        if (typeof dogObj.photo === 'string' && dogObj.photo.startsWith('data:image/')) {
          if (dogObj.photo !== existingDog.photo || !existingDog.photoId) {
            nextDog.photoId = newDogPhotoId(existingDog.id);
          }
        } else {
          delete nextDog.photoId;
        }
      }
      dogs[index] = nextDog;
      return { dogs, activeDogId:dogs[index].id };
    });
  } catch (e) {
    console.error("Failed to save dog profile:", e);
    return false;
  }
}

async function addDogProfile(dogObj) {
  lastDogProfileError = null;
  if (!currentUser) {
    lastDogProfileError = { code:'not-signed-in', message:'Sign in again before saving this dog.' };
    return false;
  }
  let limitReached = false;
  try {
    const saved = await mutateDogState(state => {
      if (state.dogs.length >= 5) {
        limitReached = true;
        return null;
      }
      const occupied = new Set(state.dogs.map(dog => dog.id));
      let id = dogId(dogObj, state.dogs.length), suffix = 2;
      while (occupied.has(id)) id = `${dogId(dogObj, state.dogs.length).slice(0, 70)}-${suffix++}`;
      const dog = { ...dogObj, id };
      if (typeof dog.photo === 'string' && dog.photo.startsWith('data:image/') && !dog.photoId) dog.photoId = newDogPhotoId(id);
      return { dogs:state.dogs.concat(dog), activeDogId:id };
    });
    if (!saved && limitReached) {
      lastDogProfileError = { code:'dog-limit', message:'An ORMA account can store up to five dogs.' };
    }
    return saved;
  } catch (e) {
    console.error("Failed to add dog profile:", e);
    lastDogProfileError = {
      code:e && e.code ? String(e.code) : 'profile-save-failed',
      message:e && e.message ? String(e.message) : 'The dog profile could not be saved.',
    };
    return false;
  }
}

function getLastDogProfileError() {
  return lastDogProfileError ? { ...lastDogProfileError } : null;
}

async function selectDogProfile(id) {
  if (!currentUser) return false;
  try {
    return await mutateDogState(state => state.dogs.some(dog => dog.id === id)
      ? { dogs:state.dogs, activeDogId:id } : null);
  } catch (e) {
    console.error("Failed to switch dog profile:", e);
    return false;
  }
}

async function removeDogProfile(id) {
  if (!currentUser) return false;
  try {
    return await mutateDogState(state => {
      if (state.dogs.length <= 1) return null;
      const dogs = state.dogs.filter(dog => dog.id !== id);
      if (dogs.length === state.dogs.length) return null;
      const activeDogId = state.activeDogId === id
        ? dogs[0] && dogs[0].id || null : state.activeDogId;
      return { dogs, activeDogId };
    });
  } catch (e) {
    console.error("Failed to remove dog profile:", e);
    return false;
  }
}

// Notification read-state, synced through the account so a notification
// read on the phone stays read on the laptop (Facebook semantics).
async function getNotifSeen() {
  if (!currentUser) return [];
  try {
    const snap = await getDoc(doc(db, "users", currentUser.uid));
    const seen = snap.exists() ? snap.data().notifSeen : null;
    return Array.isArray(seen) ? seen : [];
  } catch (e) { return []; }
}

async function setNotifSeen(ids) {
  if (!currentUser) return false;
  try {
    await setDoc(doc(db, "users", currentUser.uid), {
      notifSeen: (Array.isArray(ids) ? ids : []).slice(-300).map(String),
      notifSeenAt: serverTimestamp(),
    }, { merge: true });
    return true;
  } catch (e) { return false; }
}

async function getLastMatches() {
  if (!currentUser) return null;
  try {
    const snap = await getDoc(doc(db, "users", currentUser.uid));
    if (!snap.exists()) return null;
    return Array.isArray(snap.data().lastMatches) ? snap.data().lastMatches : null;
  } catch (e) {
    return null;
  }
}

async function setLastMatches(trailIds) {
  if (!currentUser) return false;
  try {
    await setDoc(doc(db, "users", currentUser.uid), { lastMatches: trailIds }, { merge: true });
    return true;
  } catch (e) {
    console.error("Failed to save last matches:", e);
    return false;
  }
}

async function saveHikeOutcome(record) {
  if (!currentUser || !record || record.ownerId !== currentUser.uid) return false;
  const outcomeId = String(record.outcomeId || "").slice(0, 200);
  if (!outcomeId) return false;
  try {
    const ref = doc(db, "users", currentUser.uid, "outcomes", outcomeId);
    const existing = await getDoc(ref);
    if (existing.exists()) {
      const data = existing.data();
      return data.outcomeId === outcomeId
        && data.completionId === record.completionId
        && data.trailId === record.trailId;
    }
    await setDoc(ref, {
      schemaVersion: 1,
      outcomeId,
      completionId: String(record.completionId || "").slice(0, 180),
      trailId: String(record.trailId || "").slice(0, 80),
      response: record.response,
      waterAccuracy: record.waterAccuracy || null,
      hazards: Array.isArray(record.hazards) ? record.hazards.slice(0, 6) : [],
      recordedHikePresent: record.recordedHikePresent === true,
      offlinePackageUsed: record.offlinePackageUsed === true,
      createdAt: serverTimestamp(),
    });
    return true;
  } catch (e) {
    return false;
  }
}

function friendlyError(code) {
  const map = {
    "auth/email-already-in-use": "That email already has an account — try logging in instead.",
    "auth/invalid-email": "That email address doesn't look right.",
    "auth/weak-password": "Password should be at least 6 characters.",
    "auth/user-not-found": "No account found with that email.",
    "auth/wrong-password": "Incorrect password.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/popup-closed-by-user": "Google sign-in was closed before finishing.",
    "auth/requires-recent-login": "For security, please confirm your identity again before this action.",
    "auth/too-many-requests": "Too many attempts. Wait a moment, then try again.",
  };
  return map[code] || "Something went wrong — please try again.";
}

async function deleteAccount(password) {
  if (!currentUser) return { ok: false, messageKey: "account.delete.notLoggedIn", message: "Not logged in." };
  const providerId = currentUser.providerData[0] && currentUser.providerData[0].providerId;
  const uid = currentUser.uid;
  let removedOutcomes = 0;
  let removedProfile = false;
  let removedPublicProfile = false;
  try {
    if (providerId === "google.com") {
      await reauthenticateWithPopup(currentUser, googleProvider);
    } else {
      if (!password) return { ok: false, messageKey: "account.delete.passwordRequired", message: "Enter your password to confirm." };
      const credential = EmailAuthProvider.credential(currentUser.email, password);
      await reauthenticateWithCredential(currentUser, credential);
    }
  } catch (e) {
    return { ok: false, stage: "reauthentication", code: e.code || "auth/unknown", message: friendlyError(e.code) };
  }

  try {
    const outcomes = await getDocs(collection(db, "users", uid, "outcomes"));
    for (const outcome of outcomes.docs) {
      await deleteDoc(outcome.ref);
      removedOutcomes += 1;
    }
    const outgoingFollows = await getDocs(query(collection(db, "follows"), where("followerUid", "==", uid)));
    const incomingFollows = await getDocs(query(collection(db, "follows"), where("ownerUid", "==", uid)));
    const followRefs = new Map();
    outgoingFollows.docs.concat(incomingFollows.docs).forEach(item => followRefs.set(item.ref.path, item.ref));
    for (const ref of followRefs.values()) await deleteDoc(ref);
    await deleteDoc(doc(db, "publicProfiles", uid));
    removedPublicProfile = true;
    await deleteDoc(doc(db, "users", uid));
    removedProfile = true;
  } catch (e) {
    return {
      ok: false,
      stage: "private-data",
      partial: removedOutcomes > 0,
      server: { removedOutcomes, removedProfile, removedPublicProfile },
      messageKey: removedOutcomes > 0
        ? "account.delete.partialPrivateData"
        : "account.delete.privateDataError",
      message: removedOutcomes > 0
        ? "Some private hike outcomes were removed, but server cleanup did not finish. Your sign-in has not been deleted. Please try again."
        : "Your private server data could not be removed, so your sign-in was not deleted. Please try again.",
    };
  }

  try {
    await deleteUser(currentUser);
  } catch (e) {
    return {
      ok: false,
      stage: "authentication",
      partial: true,
      server: { removedOutcomes, removedProfile, removedPublicProfile },
      messageKey: "account.delete.authenticationError",
      message: "Your private profile was removed, but the sign-in could not be deleted. Sign in again and retry account deletion, or contact support.",
    };
  }
  return {
    ok: true,
    server: {
      authenticationDeleted: true,
      profileDeleted: true,
      publicProfileDeleted: removedPublicProfile,
      privateOutcomesDeleted: removedOutcomes,
      retainedForSafetyAndModeration: ["community contributions", "reports", "moderation records"],
    },
  };
}

function contributionResult(state, message, action, messageKey) {
  return {
    ok: state === "eligible",
    state,
    message,
    action: action || null,
    messageKey: messageKey || null,
  };
}

async function getContributionEligibility() {
  if (!currentUser) {
    return contributionResult(
      "signed-out",
      "Log in to contribute.",
      "login",
      "account.contribution.signedOut"
    );
  }

  try {
    await reload(currentUser);
    if (!currentUser.emailVerified) {
      return contributionResult(
        "email-unverified",
        "Verify your email before contributing. Open Account → Settings to resend the verification link.",
        "verify-email",
        "account.contribution.verifyEmail"
      );
    }

    return contributionResult(
      "eligible",
      "Your verified account can submit community contributions for review.",
      null,
      "account.contribution.eligible"
    );
  } catch (error) {
    console.error("Contributor eligibility check failed:", error);
    return contributionResult(
      "unavailable",
      "We could not confirm contribution access. Check your connection and try again.",
      "retry",
      "account.contribution.error"
    );
  }
}

function contributionWriteError(error, fallback) {
  if (String(error && error.code || "").includes("permission-denied")) {
    return {
      ok: false,
      state: "unavailable",
      action: "contact-support",
      message: "This account cannot submit community contributions. Contact ORMA if you think this is a mistake.",
    };
  }
  return { ok: false, message: fallback };
}

function contributionClientId(type) {
  const random = globalThis.crypto && typeof globalThis.crypto.randomUUID === "function"
    ? globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 20)
    : Math.random().toString(36).slice(2, 14);
  return `${type}-${Date.now().toString(36)}-${random}`.slice(0, 80);
}

function socialEdgeId(targetType, targetId) {
  if (!currentUser) return "";
  return [currentUser.uid, String(targetType || "human"), String(targetId || "")]
    .join("_").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 180);
}

function cleanPublicProfile(input) {
  const source = input || {};
  const dogs = Array.isArray(source.dogs) ? source.dogs.slice(0, 5).map(dog => ({
    id: String(dog && dog.id || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80),
    name: String(dog && dog.name || "Your dog").trim().slice(0, 40),
    bio: String(dog && dog.bio || "").trim().slice(0, 180),
    photo: String(dog && dog.photo || "").slice(0, 700000),
    public: dog && dog.public === true,
  })).filter(dog => dog.id) : [];
  return {
    displayName: String(source.displayName || "").trim().slice(0, 40),
    bio: String(source.bio || "").trim().slice(0, 240),
    visibility: source.visibility === "private" ? "private" : "public",
    tagPermission: ["everyone", "followers", "none"].includes(source.tagPermission)
      ? source.tagPermission : "followers",
    dogs,
  };
}

async function getPublicProfile(uid) {
  const targetUid = String(uid || currentUser && currentUser.uid || "").slice(0, 128);
  if (!targetUid) return null;
  const snap = await getDoc(doc(db, "publicProfiles", targetUid));
  return snap.exists() ? Object.assign({ uid:targetUid }, snap.data()) : null;
}

async function setPublicProfile(input) {
  if (!currentUser) return { ok:false, message:"Log in to create a public profile." };
  const profile = cleanPublicProfile(input);
  if (!profile.displayName) return { ok:false, message:"Add a public display name." };
  await setDoc(doc(db, "publicProfiles", currentUser.uid), Object.assign({}, profile, {
    uid:currentUser.uid,
    updatedAt:serverTimestamp(),
  }), { merge:true });
  return { ok:true, profile:Object.assign({ uid:currentUser.uid }, profile) };
}

async function getFollowState(targetType, targetId) {
  if (!currentUser) return null;
  const id = socialEdgeId(targetType, targetId);
  if (!id) return null;
  const snap = await getDoc(doc(db, "follows", id));
  return snap.exists() ? Object.assign({ id }, snap.data()) : null;
}

async function followPublicIdentity(ownerUid, targetType, targetId, isPrivate) {
  if (!currentUser) return { ok:false, message:"Log in to follow this profile." };
  if (ownerUid === currentUser.uid) return { ok:false, message:"This is your profile." };
  const id = socialEdgeId(targetType, targetId);
  const record = {
    followerUid:currentUser.uid,
    ownerUid:String(ownerUid || "").slice(0, 128),
    targetType:targetType === "dog" ? "dog" : "human",
    targetId:String(targetId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80),
    status:isPrivate ? "pending" : "accepted",
    updatedAt:serverTimestamp(),
  };
  await setDoc(doc(db, "follows", id), Object.assign({}, record, { createdAt:serverTimestamp() }));
  return { ok:true, status:record.status };
}

async function unfollowPublicIdentity(targetType, targetId) {
  if (!currentUser) return { ok:false };
  await deleteDoc(doc(db, "follows", socialEdgeId(targetType, targetId)));
  return { ok:true };
}

async function getFollowRequests() {
  if (!currentUser) return [];
  const snap = await getDocs(query(collection(db, "follows"), where("ownerUid", "==", currentUser.uid)));
  return snap.docs.map(item => Object.assign({ id:item.id }, item.data()))
    .filter(item => item.status === "pending");
}

async function resolveFollowRequest(edgeId, accept) {
  if (!currentUser) return { ok:false };
  const ref = doc(db, "follows", String(edgeId || "").slice(0, 180));
  if (accept) await updateDoc(ref, { status:"accepted", updatedAt:serverTimestamp() });
  else await deleteDoc(ref);
  return { ok:true };
}

function queueOfflineContribution(type, payload, options) {
  if (options && options.skipOfflineQueue) return null;
  const queue = window.DoloPawsOfflineContributions;
  if (!(queue && currentUser && currentUser.emailVerified)) return null;
  const result = queue.enqueue(type, payload, currentUser.uid, {
    id: options && options.queueId,
  });
  return result.ok ? {
    ok: true,
    queued: true,
    queueId: result.record.id,
    message: "Saved on this device — waiting to sync when you reconnect.",
  } : {
    ok: false,
    state: "queue-unavailable",
    message: result.error === "queue-full"
      ? "Your offline contribution queue is full. Reconnect before adding more."
      : "This contribution could not be saved on this device.",
  };
}

async function sendContributionVerificationEmail() {
  if (!currentUser) {
    return { ok: false, messageKey:"account.contribution.loginToVerify", message: "Log in before requesting a verification email." };
  }
  try {
    await reload(currentUser);
    if (currentUser.emailVerified) {
      return { ok: true, alreadyVerified: true, messageKey:"account.contribution.alreadyVerified", message: "Your email is already verified." };
    }
    await sendEmailVerification(currentUser);
    return {
      ok: true,
      messageKey:"account.contribution.verificationSent",
      messageVars:{ email:currentUser.email || "your email" },
      message: `Verification link sent to ${currentUser.email || "your email"}.`,
    };
  } catch (error) {
    return { ok: false, code:error.code || "auth/unknown", message: friendlyError(error.code) };
  }
}

window.DoloPawsAuth = {
  get currentUser() { return currentUser; },
  get authResolved() { return authResolved; },
  onChange(fn) { changeListeners.push(fn); if (authResolved) fn(currentUser); },
  getFavorites,
  setFavorites,
  getDogProfile,
  setDogProfile,
  getDogProfiles,
  addDogProfile,
  getLastDogProfileError,
  selectDogProfile,
  removeDogProfile,
  getLastMatches,
  setLastMatches,
  deleteAccount,
  getContributionEligibility,
  sendContributionVerificationEmail,
  getPublicProfile,
  setPublicProfile,
  getFollowState,
  followPublicIdentity,
  unfollowPublicIdentity,
  getFollowRequests,
  resolveFollowRequest,
  async signUp(email, password, displayName) {
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      // Firebase resolves the credential promise before onAuthStateChanged is
      // guaranteed to have run. Profile handoffs happen immediately after
      // sign-up, so expose the authenticated user synchronously instead of
      // briefly making the first dog save look signed out.
      currentUser = credential.user;
      if (displayName) {
        try {
          await updateProfile(credential.user, { displayName });
        } catch (profileError) {
          console.error("Account name could not be saved:", profileError);
        }
      }
      try {
        await sendEmailVerification(credential.user);
        return { ok: true, verificationSent: true };
      } catch (verificationError) {
        console.error("Verification email could not be sent:", verificationError);
        return { ok: true, verificationSent: false };
      }
    } catch (e) {
      return { ok: false, code: e.code || "auth/unknown", message: friendlyError(e.code) };
    }
  },
  async signIn(email, password) {
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      currentUser = credential.user;
      return { ok: true };
    } catch (e) {
      return { ok: false, code: e.code || "auth/unknown", message: friendlyError(e.code) };
    }
  },
  async signInGoogle() {
    try {
      const credential = await signInWithPopup(auth, googleProvider);
      currentUser = credential.user;
      return { ok: true };
    } catch (e) {
      return { ok: false, code: e.code || "auth/unknown", message: friendlyError(e.code) };
    }
  },
  appleSignInReady: APPLE_SIGNIN_READY,
  async signInApple() {
    try {
      const credential = await signInWithPopup(auth, appleProvider);
      currentUser = credential.user;
      return { ok: true };
    } catch (e) {
      return { ok: false, code: e.code || "auth/unknown", message: friendlyError(e.code) };
    }
  },
  async logOut() {
    await fbSignOut(auth);
  },
  async resetPassword(email) {
    try {
      await sendPasswordResetEmail(auth, email);
      return { ok: true };
    } catch (e) {
      return { ok: false, code: e.code || "auth/unknown", message: friendlyError(e.code) };
    }
  },
  // Sends a confirmation link to the NEW address; the login email only
  // changes once that link is clicked, so a typo can't lock anyone out.
  async updateEmail(newEmail) {
    if (!currentUser) return { ok: false, message: "Not logged in." };
    try {
      await verifyBeforeUpdateEmail(currentUser, newEmail);
      return { ok: true };
    } catch (e) {
      return { ok: false, message: friendlyError(e.code) };
    }
  },
};

// ============================================================
// COMMUNITY v0 — anonymous "dogs hiked this week" counter.
// One event per hike start: trail id + server timestamp, nothing else.
// No identity, no location. Subcollection-per-trail layout means the
// weekly count query only needs a single-field index (no composite
// index setup required in the Firebase console).
// ============================================================
async function recordHikeStart(trailId) {
  try {
    await addDoc(collection(db, "hikeEvents", String(trailId).slice(0, 80), "events"), {
      startedAt: serverTimestamp(),
    });
    return true;
  } catch (e) {
    return false; // counter is a nice-to-have — never break hike mode over it
  }
}

async function getWeeklyHikeCount(trailId) {
  try {
    const weekAgo = Timestamp.fromMillis(Date.now() - 7 * 24 * 3600 * 1000);
    const q = query(
      collection(db, "hikeEvents", String(trailId).slice(0, 80), "events"),
      where("startedAt", ">", weekAgo)
    );
    const snap = await getCountFromServer(q); // aggregation: counts server-side
    return snap.data().count;
  } catch (e) {
    return null;
  }
}

// ============================================================
// COMMUNITY — dog-safety flags, reviews, abuse reports.
// Security is enforced by Firestore rules; these functions just write
// well-formed documents and never break the page on failure.
// ============================================================
async function addFlag(trailId, type, km, text, options) {
  const queuePayload = { trailId, type, km, text };
  const clientId = options && options.queueId || contributionClientId("hazard");
  const eligibility = await getContributionEligibility();
  if (!eligibility.ok) {
    if (eligibility.state === "unavailable") {
      const queued = queueOfflineContribution("hazard", queuePayload, options);
      if (queued) return queued;
    }
    return eligibility;
  }
  try {
    const dog = await getDogProfile();
    const expiry = window.DoloPawsCommunityStates &&
      window.DoloPawsCommunityStates.hazardExpiryDate
      ? window.DoloPawsCommunityStates.hazardExpiryDate(type)
      : new Date(Date.now() + 30 * 24 * 3600 * 1000);
    const flagRef = doc(db, "flags", `${currentUser.uid}_${clientId}`.slice(0, 180));
    try {
      const existing = await getDoc(flagRef);
      if (existing.exists()) return { ok: true, duplicate: true };
    } catch (error) {
      // A missing document cannot satisfy the owner-read rule. Creation below
      // remains independently constrained by the full contributor schema.
      if (!String(error && error.code || "").includes("permission-denied")) throw error;
    }
    await setDoc(flagRef, {
      trailId: String(trailId).slice(0, 80),
      uid: currentUser.uid,
      type,
      km: (typeof km === "number" && isFinite(km)) ? km : null,
      text: String(text || "").slice(0, 300),
      dogContext: dog ? { name: dog.name || null, breed: dog.breed || null } : null,
      status: "pending",
      confirmationSource: "community",
      confirmations: 0,
      disputes: 0,
      expiresAt: Timestamp.fromDate(expiry),
      createdAt: serverTimestamp(),
    });
    return { ok: true };
  } catch (e) {
    console.error("addFlag failed:", e);
    if (!String(e && e.code || "").includes("permission-denied")) {
      const queued = queueOfflineContribution("hazard", queuePayload, {
        ...options,
        queueId: options && options.queueId || clientId,
      });
      if (queued) return queued;
    }
    return contributionWriteError(e, "Could not save your report — please try again.");
  }
}

async function getActiveFlags(trailId) {
  try {
    // Keep the query boundary slightly ahead of the Rules request clock so
    // Firestore can prove every returned document is still unexpired.
    const activeCutoff = Timestamp.fromMillis(Date.now() + 60 * 1000);
    const q = query(collection(db, "flags"),
      where("trailId", "==", String(trailId).slice(0, 80)),
      where("status", "in", ["visible", "reported"]),
      where("expiresAt", ">", activeCutoff));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error("getActiveFlags failed:", e);
    return [];
  }
}

// Place dog policies are submitted as evidence and become "ORMA verified"
// only after an operator moves the record to the visible state.
async function submitPlaceDogFriendliness(place, policy, evidence, note) {
  const eligibility = await getContributionEligibility();
  if (!eligibility.ok) return eligibility;
  const allowedPolicies = ["welcome", "leashed", "not-allowed"];
  const allowedEvidence = ["visited", "staff-confirmed", "posted-sign"];
  if (!place || !place.id || !allowedPolicies.includes(policy) || !allowedEvidence.includes(evidence)) {
    return { ok: false, message: "Choose a dog policy and how you verified it." };
  }
  try {
    const coordinates = Array.isArray(place.coordinates) ? place.coordinates : [];
    await addDoc(collection(db, "placeDogReports"), {
      placeId: String(place.id).slice(0, 120),
      placeName: String(place.name || "Unnamed place").slice(0, 120),
      placeType: String(place.type || "place").slice(0, 40),
      coordinates: {
        lng: Number(coordinates[0]),
        lat: Number(coordinates[1]),
      },
      uid: currentUser.uid,
      policy,
      evidence,
      note: String(note || "").trim().slice(0, 300),
      status: "pending",
      createdAt: serverTimestamp(),
    });
    return { ok: true, message: "Thanks — your report is awaiting ORMA review." };
  } catch (error) {
    console.error("submitPlaceDogFriendliness failed:", error);
    return contributionWriteError(error, "Could not send your report — please try again.");
  }
}

async function getVerifiedPlaceDogFriendliness(placeId) {
  if (!placeId) return null;
  try {
    const snapshot = await getDocs(query(
      collection(db, "placeDogReports"),
      where("placeId", "==", String(placeId).slice(0, 120)),
      where("status", "in", ["visible", "reported"])
    ));
    const records = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    records.sort((a, b) => {
      const aMs = a.moderatedAt && a.moderatedAt.toMillis ? a.moderatedAt.toMillis() : 0;
      const bMs = b.moderatedAt && b.moderatedAt.toMillis ? b.moderatedAt.toMillis() : 0;
      return bMs - aMs;
    });
    return records[0] || null;
  } catch (error) {
    console.error("getVerifiedPlaceDogFriendliness failed:", error);
    return null;
  }
}

// Active hazard flags across the user's saved trails, for the notification
// centre. One indexed query per trail (Firestore allows a single `in`
// clause per query, and trailId+status already need one each), capped so a
// large saved list cannot fan out into unbounded reads.
async function getActiveFlagsForTrails(trailIds) {
  const ids = (Array.isArray(trailIds) ? trailIds : []).slice(0, 25);
  const results = await Promise.all(ids.map(id =>
    getActiveFlags(id).then(flags => flags.map(f => ({ ...f, trailId: id })))
  ));
  return results.flat();
}

// Broadcast notices are public content; no signed-in user required.
async function getSiteNotices() {
  try {
    const q = query(collection(db, "siteNotices"),
      orderBy("createdAt", "desc"), limit(10));
    const snap = await getDocs(q);
    const now = Date.now();
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(n => !n.expiresAt || (n.expiresAt.toMillis && n.expiresAt.toMillis() > now));
  } catch (e) {
    console.error("getSiteNotices failed:", e);
    return [];
  }
}

async function addSiteNotice(notice) {
  if (!currentUser) return { ok: false, message: "Sign in first." };
  try {
    const payload = {
      title: String(notice.title || "").slice(0, 80),
      body: String(notice.body || "").slice(0, 280),
      href: notice.href ? String(notice.href).slice(0, 200) : null,
      type: ["news", "trail", "safety"].includes(notice.type) ? notice.type : "news",
      createdAt: serverTimestamp(),
      expiresAt: Number.isFinite(notice.expiresDays)
        ? Timestamp.fromMillis(Date.now() + notice.expiresDays * 864e5)
        : null,
    };
    const ref = await addDoc(collection(db, "siteNotices"), payload);
    return { ok: true, id: ref.id };
  } catch (e) {
    console.error("addSiteNotice failed:", e);
    return { ok: false, message: "Could not post the notice." };
  }
}

async function deleteSiteNotice(noticeId) {
  if (!currentUser) return false;
  try { await deleteDoc(doc(db, "siteNotices", String(noticeId))); return true; }
  catch (e) { console.error("deleteSiteNotice failed:", e); return false; }
}

async function respondToHazard(flagId, stance) {
  const eligibility = await getContributionEligibility();
  if (!eligibility.ok) return eligibility;
  if (!["confirm", "dispute"].includes(stance)) {
    return { ok: false, message: "Choose confirm or dispute." };
  }
  const safeId = String(flagId || "").slice(0, 100);
  if (!safeId) return { ok: false, message: "This hazard report is unavailable." };
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, "flags", safeId, "responses", currentUser.uid), {
      flagId: safeId,
      uid: currentUser.uid,
      stance,
      createdAt: serverTimestamp(),
    });
    batch.update(doc(db, "flags", safeId), {
      [stance === "confirm" ? "confirmations" : "disputes"]: increment(1),
      lastCommunityResponseAt: serverTimestamp(),
    });
    await batch.commit();
    return { ok: true };
  } catch (e) {
    console.error("respondToHazard failed:", e);
    return contributionWriteError(
      e,
      "Your response could not be saved. You may already have responded to this report."
    );
  }
}

async function deleteFlag(flagId) {
  if (!currentUser) return false;
  try { await deleteDoc(doc(db, "flags", flagId)); return true; }
  catch (e) { return false; }
}

async function setReview(trailId, rating, text, hikedOn, options) {
  const queuePayload = { trailId, rating, text, hikedOn };
  const eligibility = await getContributionEligibility();
  if (!eligibility.ok) {
    if (eligibility.state === "unavailable") {
      const queued = queueOfflineContribution("review", queuePayload, options);
      if (queued) return queued;
    }
    return eligibility;
  }
  try {
    const dog = await getDogProfile();
    const id = `${String(trailId).slice(0, 80)}_${currentUser.uid}`;
    const reviewRef = doc(db, "reviews", id);
    let existing = null;
    try {
      existing = await getDoc(reviewRef);
    } catch (error) {
      // Firestore cannot authorize an owner read for a document that does not
      // exist yet because there is no stored uid to compare. Treat that
      // permission denial as the first-review path; the create rule below
      // still independently validates identity, eligibility, and document ID.
      if (!String(error && error.code || "").includes("permission-denied")) {
        throw error;
      }
    }
    await setDoc(reviewRef, {
      trailId: String(trailId).slice(0, 80),
      uid: currentUser.uid,
      rating: Math.max(1, Math.min(5, Math.round(rating))),
      text: String(text || "").slice(0, 1000),
      dogContext: dog ? { name: dog.name || null, breed: dog.breed || null } : null,
      hikedOn: hikedOn || null,
      status: "pending",
      createdAt: existing && existing.exists() && existing.data().createdAt
        ? existing.data().createdAt : serverTimestamp(),
    });
    return { ok: true };
  } catch (e) {
    console.error("setReview failed:", e);
    if (!String(e && e.code || "").includes("permission-denied")) {
      const queued = queueOfflineContribution("review", queuePayload, options);
      if (queued) return queued;
    }
    return contributionWriteError(e, "Could not save your review — please try again.");
  }
}

async function getReviews(trailId) {
  try {
    const q = query(collection(db, "reviews"),
      where("trailId", "==", String(trailId).slice(0, 80)),
      where("status", "in", ["visible", "reported"]));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    return [];
  }
}

async function deleteMyReview(trailId) {
  if (!currentUser) return false;
  try {
    await deleteDoc(doc(db, "reviews", `${String(trailId).slice(0, 80)}_${currentUser.uid}`));
    return true;
  } catch (e) { return false; }
}

async function addTrailPhoto(trailId, image, caption, options) {
  const queuePayload = { trailId, image, caption };
  const clientId = options && options.queueId || contributionClientId("photo");
  const eligibility = await getContributionEligibility();
  if (!eligibility.ok) {
    if (eligibility.state === "unavailable") {
      const queued = queueOfflineContribution("photo", queuePayload, options);
      if (queued) return queued;
    }
    return eligibility;
  }
  const imageData = String(image || '');
  if (!imageData.startsWith('data:image/') || imageData.length > 700000) {
    return { ok: false, message: "This photo is too large — please try another image." };
  }
  try {
    const dog = await getDogProfile();
    const photoRef = doc(db, "trailPhotos", `${currentUser.uid}_${clientId}`.slice(0, 180));
    try {
      const existing = await getDoc(photoRef);
      if (existing.exists()) return { ok: true, duplicate: true };
    } catch (error) {
      if (!String(error && error.code || "").includes("permission-denied")) throw error;
    }
    await setDoc(photoRef, {
      trailId: String(trailId).slice(0, 80),
      uid: currentUser.uid,
      image: imageData,
      caption: String(caption || '').slice(0, 240),
      dogContext: dog ? { name: dog.name || null } : null,
      status: "pending",
      createdAt: serverTimestamp(),
    });
    return { ok: true };
  } catch (e) {
    console.error("addTrailPhoto failed:", e);
    if (!String(e && e.code || "").includes("permission-denied")) {
      const queued = queueOfflineContribution("photo", queuePayload, {
        ...options,
        queueId: options && options.queueId || clientId,
      });
      if (queued) return queued;
    }
    return contributionWriteError(e, "Could not add this photo — please try again.");
  }
}

async function getTrailPhotos(trailId) {
  try {
    const q = query(collection(db, "trailPhotos"),
      where("trailId", "==", String(trailId).slice(0, 80)),
      where("status", "in", ["visible", "reported"]));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    return [];
  }
}

async function reportContent(targetType, targetId, reason) {
  if (!currentUser) return false;
  try {
    await addDoc(collection(db, "reports"), {
      targetType: String(targetType).slice(0, 20),
      targetId: String(targetId).slice(0, 100),
      uid: currentUser.uid,
      reason: String(reason || "").slice(0, 200),
      status: "open",
      createdAt: serverTimestamp(),
    });
    return true;
  } catch (e) { return false; }
}

const MODERATION_COLLECTIONS = {
  flag: "flags",
  review: "reviews",
  photo: "trailPhotos",
  placeDog: "placeDogReports",
};

async function moderatorIdentity() {
  if (!currentUser) return null;
  try {
    const token = await getIdTokenResult(currentUser, true);
    return token.claims && token.claims.moderator === true
      ? { uid: currentUser.uid }
      : null;
  } catch (e) {
    return null;
  }
}

async function getBackofficeArtifact(artifactId) {
  if (!await moderatorIdentity()) return { ok:false, error:'moderator-required', data:null };
  try {
    const snapshot = await getDoc(doc(db, 'backofficeArtifacts', artifactId));
    if(!snapshot.exists()) return { ok:false, error:'artifact-not-found', data:null };
    const artifact = snapshot.data();
    const data = artifact.dataEncoding === 'json-v1'
      ? JSON.parse(artifact.data)
      : artifact.data;
    return { ok:true, data, updatedAt:artifact.updatedAt || null };
  } catch (error) {
    console.error('getBackofficeArtifact failed:', error);
    return { ok:false, error:'artifact-read-failed', data:null };
  }
}

async function getBackofficeRevisionJobs() {
  if (!await moderatorIdentity()) return { ok:false, error:'moderator-required', jobs:[] };
  try {
    const snapshot = await getDocs(query(collection(db, 'backofficeJobs'), orderBy('createdAt', 'desc'), limit(100)));
    return { ok:true, jobs:snapshot.docs.map(item => ({ id:item.id, ...item.data() })) };
  } catch (error) {
    console.error('getBackofficeRevisionJobs failed:', error);
    return { ok:false, error:'job-read-failed', jobs:[] };
  }
}

async function submitBackofficeTrailReview(payload) {
  const moderator = await moderatorIdentity();
  if (!moderator) return { ok:false, error:'moderator-required' };
  if (!payload || payload.gate !== 'content-review' || !Array.isArray(payload.decisions) || !payload.decisions.length) {
    return { ok:false, error:'decisions-required' };
  }
  try {
    const review = await addDoc(collection(db, 'backofficeReviews'), {
      contractVersion:'1.0.0', type:'verified-trail-content-review', gate:'content-review', status:'queued',
      decisions:payload.decisions, submittedAt:serverTimestamp(), submittedBy:moderator.uid, publicMutationAllowed:false,
    });
    return { ok:true, reviewId:review.id, status:'queued' };
  } catch (error) {
    console.error('submitBackofficeTrailReview failed:', error);
    return { ok:false, error:'review-submit-failed' };
  }
}

async function submitBackofficePublicationReview(input) {
  const moderator = await moderatorIdentity();
  if (!moderator) return { ok:false, error:'moderator-required' };
  try {
    const review = await addDoc(collection(db, 'backofficePublicationReviews'), {
      contractVersion:'1.0.0', type:'verified-trail-publication-review', status:'queued',
      candidateId:String(input.candidateId || ''), action:String(input.action || ''),
      note:String(input.note || '').trim().slice(0,1500), submittedAt:serverTimestamp(),
      submittedBy:moderator.uid, publicMutationAllowed:false,
    });
    return { ok:true, reviewId:review.id, status:'queued' };
  } catch (error) {
    console.error('submitBackofficePublicationReview failed:', error);
    return { ok:false, error:'publication-review-submit-failed' };
  }
}

async function submitBackofficeDossierReview(input) {
  const moderator=await moderatorIdentity();
  if(!moderator)return {ok:false,error:'moderator-required'};
  try{
    const review=await addDoc(collection(db,'backofficeDossierReviews'),{
      contractVersion:'1.0.0',type:'trail-dossier-review',status:'queued',
      reviewId:String(input.reviewId||''),candidateId:String(input.candidateId||''),
      action:String(input.action||''),targetAgent:String(input.targetAgent||''),
      note:String(input.note||'').trim().slice(0,1500),submittedAt:serverTimestamp(),
      submittedBy:moderator.uid,publicMutationAllowed:false,
    });
    return {ok:true,reviewId:review.id,status:'queued'};
  }catch(error){console.error('submitBackofficeDossierReview failed:',error);return {ok:false,error:'dossier-review-submit-failed'};}
}

function moderationItem(type, snapshot, reportReasons = [], reportIds = []) {
  const data = snapshot.data();
  return {
    type,
    id: snapshot.id,
    trailId: data.trailId || null,
    targetId: data.placeId || data.trailId,
    authorUid: data.uid,
    status: data.status,
    createdAt: data.createdAt,
    content: {
      type: data.type || null,
      km: typeof data.km === "number" ? data.km : null,
      rating: typeof data.rating === "number" ? data.rating : null,
      text: data.text || null,
      hikedOn: data.hikedOn || null,
      image: data.image || null,
      caption: data.caption || null,
      placeName: data.placeName || null,
      placeType: data.placeType || null,
      policy: data.policy || null,
      evidence: data.evidence || null,
      note: data.note || null,
      confirmationSource: data.confirmationSource || null,
      confirmations: Number(data.confirmations) || 0,
      disputes: Number(data.disputes) || 0,
      expiresAt: data.expiresAt || null,
      lifecyclePresent: data.confirmationSource != null &&
        data.confirmations != null &&
        data.disputes != null &&
        data.expiresAt != null,
    },
    reportReasons,
    reportIds,
  };
}

async function getModerationQueue() {
  if (!await moderatorIdentity()) return { ok: false, error: "moderator-required", items: [] };
  try {
    const types = Object.keys(MODERATION_COLLECTIONS);
    const [contentResults, reportResult] = await Promise.all([
      Promise.all(types.map(async type => {
        const queueStates = type === "flag"
          ? ["pending", "visible", "reported", "hidden", "removed"]
          : ["pending", "reported", "hidden", "removed"];
        const snap = await getDocs(query(
          collection(db, MODERATION_COLLECTIONS[type]),
          where("status", "in", queueStates)
        ));
        return snap.docs
          .map(item => moderationItem(type, item))
          .filter(item => type !== "flag" || item.status !== "visible" ||
            !item.content.lifecyclePresent ||
            !item.content.expiresAt ||
            item.content.expiresAt.toMillis() <= Date.now());
      })),
      getDocs(query(collection(db, "reports"), where("status", "==", "open"))),
    ]);
    const openReports = reportResult.docs.map(item => ({ id: item.id, ...item.data() }));
    const byTarget = new Map();
    openReports.forEach(report => {
      const key = `${report.targetType}:${report.targetId}`;
      const group = byTarget.get(key) || { reasons: [], ids: [] };
      group.reasons.push({
        text: String(report.reason || "").slice(0, 200),
        createdAt: report.createdAt || null,
      });
      group.ids.push(report.id);
      byTarget.set(key, group);
    });
    const items = contentResults.flat();
    const existing = new Set(items.map(item => `${item.type}:${item.id}`));
    for (const [key, reports] of byTarget) {
      const separator = key.indexOf(":");
      const type = key.slice(0, separator);
      const id = key.slice(separator + 1);
      if (existing.has(key) || !MODERATION_COLLECTIONS[type]) continue;
      const target = await getDoc(doc(db, MODERATION_COLLECTIONS[type], id));
      if (target.exists()) items.push(moderationItem(type, target, reports.reasons, reports.ids));
    }
    items.forEach(item => {
      const reports = byTarget.get(`${item.type}:${item.id}`);
      if (reports) {
        item.reportReasons = reports.reasons;
        item.reportIds = reports.ids;
      }
    });
    items.sort((a, b) => {
      const aMs = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
      const bMs = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
      return bMs - aMs;
    });
    return { ok: true, items };
  } catch (e) {
    console.error("getModerationQueue failed:", e);
    return { ok: false, error: "queue-unavailable", items: [] };
  }
}

async function moderateContent(item, toStatus, reason, options = {}) {
  const moderator = await moderatorIdentity();
  if (!moderator || !item || !MODERATION_COLLECTIONS[item.type]) {
    return { ok: false, error: "moderator-required" };
  }
  const allowed = {
    pending: ["visible", "hidden", "removed"],
    visible: ["visible", "hidden", "removed"],
    reported: ["visible", "hidden", "removed"],
    hidden: ["visible", "removed"],
    removed: ["visible"],
  };
  if (!allowed[item.status] || !allowed[item.status].includes(toStatus)) {
    return { ok: false, error: "invalid-transition" };
  }
  try {
    const batch = writeBatch(db);
    const confirmationSource = item.type === "flag" &&
      ["community", "dolopaws-reviewed", "official"].includes(options.confirmationSource)
      ? options.confirmationSource : null;
    const needsLifecycle = item.type === "flag" && !item.content.lifecyclePresent;
    if (item.status !== toStatus || confirmationSource || needsLifecycle) {
      const update = {
        status: toStatus,
        moderatedAt: serverTimestamp(),
        moderatedBy: moderator.uid,
      };
      if (item.type === "flag" && (confirmationSource || needsLifecycle)) {
        const expiry = window.DoloPawsCommunityStates &&
          window.DoloPawsCommunityStates.hazardExpiryDate
          ? window.DoloPawsCommunityStates.hazardExpiryDate(item.content.type)
          : new Date(Date.now() + 30 * 24 * 3600 * 1000);
        update.confirmationSource = confirmationSource || "community";
        if (needsLifecycle) {
          update.confirmations = 0;
          update.disputes = 0;
        }
        if (update.confirmationSource !== "community") {
          update.confirmedAt = serverTimestamp();
          update.confirmedBy = moderator.uid;
        }
        update.expiresAt = Timestamp.fromDate(expiry);
      }
      batch.update(doc(db, MODERATION_COLLECTIONS[item.type], item.id), update);
    }
    const auditRef = doc(collection(db, "moderationAudit"));
    const auditRecord = {
      contentType: item.type,
      contentId: item.id,
      targetId: item.targetId,
      authorUid: item.authorUid,
      fromStatus: item.status,
      toStatus,
      moderatorUid: moderator.uid,
      reason: String(reason || "").slice(0, 300),
      createdAt: serverTimestamp(),
    };
    if (item.trailId) auditRecord.trailId = item.trailId;
    batch.set(auditRef, auditRecord);
    for (const reportId of item.reportIds || []) {
      batch.update(doc(db, "reports", reportId), {
        status: toStatus === "visible" ? "dismissed" : "actioned",
        resolvedAt: serverTimestamp(),
        resolvedBy: moderator.uid,
      });
    }
    await batch.commit();
    return { ok: true, auditId: auditRef.id };
  } catch (e) {
    console.error("moderateContent failed:", e);
    return { ok: false, error: "decision-failed" };
  }
}

window.DoloPawsCommunity = {
  recordHikeStart, getWeeklyHikeCount,
  addFlag, getActiveFlags, respondToHazard, deleteFlag,
  submitPlaceDogFriendliness, getVerifiedPlaceDogFriendliness,
  getActiveFlagsForTrails, getSiteNotices, addSiteNotice, deleteSiteNotice,
  getNotifSeen, setNotifSeen,
  setReview, getReviews, deleteMyReview,
  addTrailPhoto, getTrailPhotos,
  reportContent,
};

window.DoloPawsModeration = {
  getModeratorStatus: async () => ({ ok: !!await moderatorIdentity() }),
  getQueue: getModerationQueue,
  decide: moderateContent,
};

window.ORMABackoffice = {
  getArtifact:getBackofficeArtifact,
  getRevisionJobs:getBackofficeRevisionJobs,
  submitTrailReview:submitBackofficeTrailReview,
  submitPublicationReview:submitBackofficePublicationReview,
  submitDossierReview:submitBackofficeDossierReview,
};

window.DoloPawsPrivateOutcomes = {
  saveOutcome: saveHikeOutcome,
};

window.DoloPawsAuthReady = true;
window.dispatchEvent(new CustomEvent('dolopaws-auth-ready'));
