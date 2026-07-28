"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  decideContributorEligibility,
  contributorClaims,
} = require("./contributor-eligibility");

function user(overrides = {}) {
  return {
    disabled: false,
    emailVerified: true,
    providerData: [{ providerId: "password" }],
    customClaims: {},
    ...overrides,
  };
}

test("verified email/password and Google identities are eligible", () => {
  assert.equal(decideContributorEligibility(user()).eligible, true);
  assert.equal(decideContributorEligibility(user({
    providerData: [{ providerId: "google.com" }],
  })).eligible, true);
});

test("unverified, disabled, suspended, and unsupported identities are denied", () => {
  assert.deepEqual(
    decideContributorEligibility(user({ emailVerified: false })),
    { eligible: false, reason: "email-unverified" }
  );
  assert.deepEqual(
    decideContributorEligibility(user({ disabled: true })),
    { eligible: false, reason: "disabled" }
  );
  assert.deepEqual(
    decideContributorEligibility(user({ customClaims: { suspended: true } })),
    { eligible: false, reason: "suspended" }
  );
  assert.deepEqual(
    decideContributorEligibility(user({
      providerData: [{ providerId: "github.com" }],
    })),
    { eligible: false, reason: "unsupported-provider" }
  );
});

test("claim changes preserve unrelated trusted claims", () => {
  assert.deepEqual(
    contributorClaims({ moderator: true }, true),
    { moderator: true, contributor: true }
  );
  assert.deepEqual(
    contributorClaims({ moderator: true, contributor: true }, false),
    { moderator: true }
  );
});
