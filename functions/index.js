"use strict";

const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const {
  decideContributorEligibility,
  contributorClaims,
} = require("./contributor-eligibility");

initializeApp();

exports.refreshContributorEligibility = onCall(
  {
    region: "europe-west1",
    timeoutSeconds: 30,
    memory: "256MiB",
  },
  async request => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in before enabling contributions.");
    }

    const adminAuth = getAuth();
    const userRecord = await adminAuth.getUser(request.auth.uid);
    const decision = decideContributorEligibility(userRecord);
    const currentClaims = userRecord.customClaims || {};

    if (!decision.eligible) {
      if (currentClaims.contributor === true) {
        await adminAuth.setCustomUserClaims(
          userRecord.uid,
          contributorClaims(currentClaims, false)
        );
      }
      if (decision.reason === "email-unverified") {
        throw new HttpsError(
          "failed-precondition",
          "Verify your email before enabling contributions."
        );
      }
      throw new HttpsError(
        "permission-denied",
        "This account is not eligible to contribute."
      );
    }

    if (currentClaims.contributor !== true) {
      await adminAuth.setCustomUserClaims(
        userRecord.uid,
        contributorClaims(currentClaims, true)
      );
    }

    return {
      eligible: true,
      reason: decision.reason,
    };
  }
);
