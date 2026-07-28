"use strict";

const SUPPORTED_PROVIDERS = new Set(["password", "google.com"]);

function providerIds(userRecord) {
  return new Set(
    (userRecord.providerData || [])
      .map(provider => provider && provider.providerId)
      .filter(Boolean)
  );
}

function decideContributorEligibility(userRecord) {
  const claims = userRecord.customClaims || {};
  if (userRecord.disabled) {
    return { eligible: false, reason: "disabled" };
  }
  if (claims.suspended === true) {
    return { eligible: false, reason: "suspended" };
  }
  if (userRecord.emailVerified !== true) {
    return { eligible: false, reason: "email-unverified" };
  }

  const providers = providerIds(userRecord);
  const supported = Array.from(providers).some(provider =>
    SUPPORTED_PROVIDERS.has(provider)
  );
  if (!supported) {
    return { eligible: false, reason: "unsupported-provider" };
  }
  return { eligible: true, reason: "verified-identity" };
}

function contributorClaims(existingClaims, eligible) {
  const next = { ...(existingClaims || {}) };
  if (eligible) next.contributor = true;
  else delete next.contributor;
  return next;
}

module.exports = {
  SUPPORTED_PROVIDERS,
  decideContributorEligibility,
  contributorClaims,
};
