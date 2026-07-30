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
  sendEmailVerification, reload, updateProfile
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, deleteDoc,
  collection, addDoc, serverTimestamp, query, where, Timestamp,
  getCountFromServer, getDocs
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

let currentUser = null;
const changeListeners = [];

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  changeListeners.forEach(fn => fn(user));
  syncProfileSummary(user);
});

// Tiny cached flag so the static trail pages (trails/*.html carry no
// Firebase by design) can adapt their "Is this trail right for your dog?"
// section. Stores at most the dog's first name; cleared on logout.
async function syncProfileSummary(user) {
  try {
    if (!user) { localStorage.removeItem('dolopaws-profile-summary'); return; }
    const dog = await getDogProfile();
    localStorage.setItem('dolopaws-profile-summary', JSON.stringify({
      hasProfile: !!dog,
      name: dog && dog.name ? String(dog.name).slice(0, 40) : null,
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

async function getDogProfile() {
  if (!currentUser) return null;
  try {
    const snap = await getDoc(doc(db, "users", currentUser.uid));
    if (!snap.exists()) return null;
    const data = snap.data();
    // Any dog object counts — a user may save a photo before their first
    // full profile save, and that photo must still load on other devices.
    if (data.dog && (data.dog.name || data.dog.photo || data.dog.breed)) return data.dog;
    if (Array.isArray(data.dogs) && data.dogs.length > 0) {
      const migrated = data.dogs[0];
      await setDoc(doc(db, "users", currentUser.uid), { dog: migrated }, { merge: true });
      return migrated;
    }
    return null;
  } catch (e) {
    console.error("Failed to load dog profile:", e);
    return null;
  }
}

async function setDogProfile(dogObj) {
  if (!currentUser) return false;
  try {
    await setDoc(doc(db, "users", currentUser.uid), { dog: dogObj }, { merge: true });
    return true;
  } catch (e) {
    console.error("Failed to save dog profile:", e);
    return false;
  }
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
  try {
    if (providerId === "google.com") {
      await reauthenticateWithPopup(currentUser, googleProvider);
    } else {
      if (!password) return { ok: false, message: "Enter your password to confirm." };
      const credential = EmailAuthProvider.credential(currentUser.email, password);
      await reauthenticateWithCredential(currentUser, credential);
    }
    await deleteDoc(doc(db, "users", currentUser.uid));
    await deleteUser(currentUser);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: friendlyError(e.code) };
  }
}

function contributionResult(state, message, action) {
  return {
    ok: state === "eligible",
    state,
    message,
    action: action || null,
  };
}

async function getContributionEligibility() {
  if (!currentUser) {
    return contributionResult(
      "signed-out",
      "Log in to contribute.",
      "login"
    );
  }

  try {
    await reload(currentUser);
    if (!currentUser.emailVerified) {
      return contributionResult(
        "email-unverified",
        "Verify your email before contributing. Open Account → Settings to resend the verification link.",
        "verify-email"
      );
    }

    return contributionResult(
      "eligible",
      "Your verified account can submit community contributions for review."
    );
  } catch (error) {
    console.error("Contributor eligibility check failed:", error);
    return contributionResult(
      "unavailable",
      "We could not confirm contribution access. Check your connection and try again.",
      "retry"
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

async function sendContributionVerificationEmail() {
  if (!currentUser) {
    return { ok: false, message: "Log in before requesting a verification email." };
  }
  try {
    await reload(currentUser);
    if (currentUser.emailVerified) {
      return { ok: true, alreadyVerified: true, message: "Your email is already verified." };
    }
    await sendEmailVerification(currentUser);
    return {
      ok: true,
      message: `Verification link sent to ${currentUser.email || "your email"}.`,
    };
  } catch (error) {
    return { ok: false, message: friendlyError(error.code) };
  }
}

window.DoloPawsAuth = {
  get currentUser() { return currentUser; },
  onChange(fn) { changeListeners.push(fn); if (currentUser !== null || auth.currentUser !== undefined) fn(currentUser); },
  getFavorites,
  setFavorites,
  getDogProfile,
  setDogProfile,
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
      return { ok: false, message: friendlyError(e.code) };
    }
  },
  async signIn(email, password) {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return { ok: true };
    } catch (e) {
      return { ok: false, message: friendlyError(e.code) };
    }
  },
  async signInGoogle() {
    try {
      await signInWithPopup(auth, googleProvider);
      return { ok: true };
    } catch (e) {
      return { ok: false, message: friendlyError(e.code) };
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
      return { ok: false, message: friendlyError(e.code) };
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
async function addFlag(trailId, type, km, text) {
  const eligibility = await getContributionEligibility();
  if (!eligibility.ok) return eligibility;
  try {
    const dog = await getDogProfile();
    await addDoc(collection(db, "flags"), {
      trailId: String(trailId).slice(0, 80),
      uid: currentUser.uid,
      type,
      km: (typeof km === "number" && isFinite(km)) ? km : null,
      text: String(text || "").slice(0, 300),
      dogContext: dog ? { name: dog.name || null, breed: dog.breed || null } : null,
      status: "pending",
      createdAt: serverTimestamp(),
    });
    return { ok: true };
  } catch (e) {
    console.error("addFlag failed:", e);
    return contributionWriteError(e, "Could not save your report — please try again.");
  }
}

async function getActiveFlags(trailId) {
  try {
    // Two equality filters only — Firestore merges single-field indexes,
    // so no composite index setup is needed. Sorting happens client-side.
    const q = query(collection(db, "flags"),
      where("trailId", "==", String(trailId).slice(0, 80)),
      where("status", "==", "active"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error("getActiveFlags failed:", e);
    return [];
  }
}

async function deleteFlag(flagId) {
  if (!currentUser) return false;
  try { await deleteDoc(doc(db, "flags", flagId)); return true; }
  catch (e) { return false; }
}

async function setReview(trailId, rating, text, hikedOn) {
  const eligibility = await getContributionEligibility();
  if (!eligibility.ok) return eligibility;
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
    return contributionWriteError(e, "Could not save your review — please try again.");
  }
}

async function getReviews(trailId) {
  try {
    const q = query(collection(db, "reviews"),
      where("trailId", "==", String(trailId).slice(0, 80)),
      where("status", "==", "visible"));
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

async function addTrailPhoto(trailId, image, caption) {
  const eligibility = await getContributionEligibility();
  if (!eligibility.ok) return eligibility;
  const imageData = String(image || '');
  if (!imageData.startsWith('data:image/') || imageData.length > 700000) {
    return { ok: false, message: "This photo is too large — please try another image." };
  }
  try {
    const dog = await getDogProfile();
    await addDoc(collection(db, "trailPhotos"), {
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
    return contributionWriteError(e, "Could not add this photo — please try again.");
  }
}

async function getTrailPhotos(trailId) {
  try {
    const q = query(collection(db, "trailPhotos"),
      where("trailId", "==", String(trailId).slice(0, 80)),
      where("status", "==", "visible"));
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

window.DoloPawsCommunity = {
  recordHikeStart, getWeeklyHikeCount,
  addFlag, getActiveFlags, deleteFlag,
  setReview, getReviews, deleteMyReview,
  addTrailPhoto, getTrailPhotos,
  reportContent,
};

window.DoloPawsPrivateOutcomes = {
  saveOutcome: saveHikeOutcome,
};

window.DoloPawsAuthReady = true;
window.dispatchEvent(new CustomEvent('dolopaws-auth-ready'));
