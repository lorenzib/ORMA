const firebaseConfig = {
  apiKey: "AIzaSyDnEJKnoDltKwpl4QdhA-qLH3a4ugLd68M",
  authDomain: "dolopaws.firebaseapp.com",
  projectId: "dolopaws",
  storageBucket: "dolopaws.firebasestorage.app",
  messagingSenderId: "331415525455",
  appId: "1:331415525455:web:4a714eea0e95dc9a4ff23a",
  measurementId: "G-LDBKZZDJ2G"
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut as fbSignOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup,
  sendPasswordResetEmail, deleteUser, reauthenticateWithCredential,
  EmailAuthProvider, reauthenticateWithPopup, verifyBeforeUpdateEmail,
  sendEmailVerification, reload, updateProfile, getIdTokenResult
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, deleteDoc,
  collection, addDoc, serverTimestamp, query, where, Timestamp,
  getCountFromServer, getDocs, updateDoc, writeBatch, increment,
  orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

let currentUser = null;
let authResolved = false;
const changeListeners = [];

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
  try {
    if (!user) { localStorage.removeItem('dolopaws-profile-summary'); return; }
    const dogState = await getDogProfiles();
    const dog = dogState.dogs.find(item => item.id === dogState.activeDogId) || dogState.dogs[0] || null;
    // Breed/fitness/saved-count feed the header dog menu on the static
    // pages, which have no Firebase and read only this cache.
    let saved = null;
    try { saved = Object.keys((await getFavorites()) || {}).length; } catch (e) {}
    let moderator = false;
    try { moderator = (await getIdTokenResult(user)).claims.moderator === true; } catch (e) {}
    localStorage.setItem('dolopaws-profile-summary', JSON.stringify({
      uid: user.uid,
      hasProfile: !!dog,
      activeDogId: dog && dog.id || null,
      name: dog && dog.name ? String(dog.name).slice(0, 40) : null,
      breed: dog && dog.breed ? String(dog.breed).slice(0, 40) : null,
      fitness: dog && dog.fitness ? String(dog.fitness).slice(0, 20) : null,
      dogs: dogState.dogs.map(item => ({
        id:item.id,
        name:item.name ? String(item.name).slice(0, 40) : 'Your dog',
        breed:item.breed ? String(item.breed).slice(0, 40) : null,
        fitness:item.fitness ? String(item.fitness).slice(0, 20) : null,
        photo:typeof item.photo === 'string' && item.photo.startsWith('data:image/') ? item.photo : null,
      })),
      moderator,
      saved,
    }));
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
    name:40, breed:100, dob:10, ageBand:10, weightBand:10,
    size:20, neuter:20, coat:20, healthNotes:1000,
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
  if (source.photo === null || (
    typeof source.photo === 'string'
    && /^data:image\/(jpeg|jpg|png|webp);base64,/.test(source.photo)
    && source.photo.length <= 700000
  )) clean.photo = source.photo;
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

function normalizedDogState(data) {
  let dogs = Array.isArray(data && data.dogs) ? data.dogs.filter(Boolean) : [];
  if (!dogs.length && data && data.dog) dogs = [data.dog];
  dogs = dogs.slice(0, 5).map(sanitizedDogProfile);
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
    return { dogs:[], activeDogId:null };
  }
}

async function getDogProfile() {
  const state = await getDogProfiles();
  if (!state) return null;
  return state.dogs.find(dog => dog.id === state.activeDogId) || state.dogs[0] || null;
}

async function writeDogState(state) {
  if (!currentUser) return false;
  const dogs = state.dogs.slice(0, 5).map(sanitizedDogProfile);
  const active = dogs.find(dog => dog.id === state.activeDogId) || dogs[0] || null;
  const userRef = doc(db, "users", currentUser.uid);
  const existingSnap = await getDoc(userRef);
  const existing = existingSnap.exists() ? existingSnap.data() : {};
  const payload = {
    dogs,
    activeDogId:active ? active.id : null,
    // Compatibility mirror for pages deployed before multi-dog support.
    dog:active,
  };
  // Rebuild the private document from the current allow-list instead of
  // merging. Firestore validates the complete post-write document, so one
  // malformed legacy value in an unchanged field would otherwise block the
  // multi-dog migration forever.
  if (existing.favorites && typeof existing.favorites === 'object' && !Array.isArray(existing.favorites)) {
    payload.favorites = Object.fromEntries(Object.entries(existing.favorites).slice(0, 250));
  }
  if (Array.isArray(existing.lastMatches)) payload.lastMatches = existing.lastMatches.slice(0, 250);
  if (existing.createdAt instanceof Timestamp) payload.createdAt = existing.createdAt;
  if (existing.updatedAt instanceof Timestamp) payload.updatedAt = existing.updatedAt;
  await setDoc(userRef, payload);
  await syncProfileSummary(currentUser);
  window.dispatchEvent(new CustomEvent('dolopaws-dog-profile-saved', {
    detail:{ profile:active, dogs, activeDogId:payload.activeDogId }
  }));
  return true;
}

async function setDogProfile(dogObj) {
  if (!currentUser) return false;
  try {
    const state = await getDogProfiles();
    if (!dogObj) {
      const dogs = state.dogs.filter(dog => dog.id !== state.activeDogId);
      return await writeDogState({ dogs, activeDogId:dogs[0] && dogs[0].id || null });
    }
    const index = state.dogs.findIndex(dog => dog.id === state.activeDogId);
    if (index < 0) return await addDogProfile(dogObj);
    const dogs = state.dogs.slice();
    dogs[index] = { ...dogs[index], ...dogObj, id:dogs[index].id };
    return await writeDogState({ dogs, activeDogId:dogs[index].id });
  } catch (e) {
    console.error("Failed to save dog profile:", e);
    return false;
  }
}

async function addDogProfile(dogObj) {
  if (!currentUser) return false;
  try {
    const state = await getDogProfiles();
    if (state.dogs.length >= 5) return false;
    const occupied = new Set(state.dogs.map(dog => dog.id));
    let id = dogId(dogObj, state.dogs.length);
    let suffix = 2;
    while (occupied.has(id)) id = `${dogId(dogObj, state.dogs.length).slice(0, 70)}-${suffix++}`;
    const dog = { ...dogObj, id };
    return await writeDogState({ dogs:state.dogs.concat(dog), activeDogId:id });
  } catch (e) {
    console.error("Failed to add dog profile:", e);
    return false;
  }
}

async function selectDogProfile(id) {
  if (!currentUser) return false;
  try {
    const state = await getDogProfiles();
    if (!state.dogs.some(dog => dog.id === id)) return false;
    return await writeDogState({ dogs:state.dogs, activeDogId:id });
  } catch (e) {
    console.error("Failed to switch dog profile:", e);
    return false;
  }
}

async function removeDogProfile(id) {
  if (!currentUser) return false;
  try {
    const state = await getDogProfiles();
    if (state.dogs.length <= 1) return false;
    const dogs = state.dogs.filter(dog => dog.id !== id);
    if (dogs.length === state.dogs.length) return false;
    const activeDogId = state.activeDogId === id
      ? dogs[0] && dogs[0].id || null : state.activeDogId;
    return await writeDogState({ dogs, activeDogId });
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
  if (!currentUser) return { ok: false, message: "Not logged in." };
  const providerId = currentUser.providerData[0] && currentUser.providerData[0].providerId;
  const uid = currentUser.uid;
  let removedOutcomes = 0;
  let removedProfile = false;
  try {
    if (providerId === "google.com") {
      await reauthenticateWithPopup(currentUser, googleProvider);
    } else {
      if (!password) return { ok: false, message: "Enter your password to confirm." };
      const credential = EmailAuthProvider.credential(currentUser.email, password);
      await reauthenticateWithCredential(currentUser, credential);
    }
  } catch (e) {
    return { ok: false, stage: "reauthentication", message: friendlyError(e.code) };
  }

  try {
    const outcomes = await getDocs(collection(db, "users", uid, "outcomes"));
    for (const outcome of outcomes.docs) {
      await deleteDoc(outcome.ref);
      removedOutcomes += 1;
    }
    await deleteDoc(doc(db, "users", uid));
    removedProfile = true;
  } catch (e) {
    return {
      ok: false,
      stage: "private-data",
      partial: removedOutcomes > 0,
      server: { removedOutcomes, removedProfile },
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
      server: { removedOutcomes, removedProfile },
      message: "Your private profile was removed, but the sign-in could not be deleted. Sign in again and retry account deletion, or contact support.",
    };
  }
  return {
    ok: true,
    server: {
      authenticationDeleted: true,
      profileDeleted: true,
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
      message: "This account cannot submit community contributions. Contact DoloPaws if you think this is a mistake.",
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
  selectDogProfile,
  removeDogProfile,
  getLastMatches,
  setLastMatches,
  deleteAccount,
  getContributionEligibility,
  sendContributionVerificationEmail,
  async signUp(email, password, displayName) {
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
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
      await signInWithEmailAndPassword(auth, email, password);
      return { ok: true };
    } catch (e) {
      return { ok: false, code: e.code || "auth/unknown", message: friendlyError(e.code) };
    }
  },
  async signInGoogle() {
    try {
      await signInWithPopup(auth, googleProvider);
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

function moderationItem(type, snapshot, reportReasons = [], reportIds = []) {
  const data = snapshot.data();
  return {
    type,
    id: snapshot.id,
    trailId: data.trailId,
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
    batch.set(auditRef, {
      contentType: item.type,
      contentId: item.id,
      trailId: item.trailId,
      authorUid: item.authorUid,
      fromStatus: item.status,
      toStatus,
      moderatorUid: moderator.uid,
      reason: String(reason || "").slice(0, 300),
      createdAt: serverTimestamp(),
    });
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

window.DoloPawsPrivateOutcomes = {
  saveOutcome: saveHikeOutcome,
};

window.DoloPawsAuthReady = true;
window.dispatchEvent(new CustomEvent('dolopaws-auth-ready'));
