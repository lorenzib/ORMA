(function(root){
  'use strict';

  const VERSION = '1.0.0';
  const THRESHOLDS = Object.freeze({
    goodAccuracyM: 25,
    warningAccuracyM: 50,
    progressAccuracyM: 100,
    currentFixMs: 15000,
    agingFixMs: 45000,
    offRouteM: 60,
    onRouteM: 40,
    confirmedFixes: 3,
    farFromRouteM: 2000,
  });

  function finiteNonNegative(value){
    return typeof value === 'number' && Number.isFinite(value) && value >= 0;
  }

  function accuracyBand(accuracyM){
    if(!finiteNonNegative(accuracyM)) return 'unavailable';
    if(accuracyM <= THRESHOLDS.goodAccuracyM) return 'good';
    if(accuracyM <= THRESHOLDS.warningAccuracyM) return 'fair';
    if(accuracyM <= THRESHOLDS.progressAccuracyM) return 'weak';
    return 'unusable';
  }

  function freshnessBand(ageMs){
    if(!finiteNonNegative(ageMs)) return 'unavailable';
    if(ageMs <= THRESHOLDS.currentFixMs) return 'current';
    if(ageMs <= THRESHOLDS.agingFixMs) return 'aging';
    return 'stale';
  }

  function assessFix(input){
    const now = finiteNonNegative(input && input.now) ? input.now : Date.now();
    const timestamp = finiteNonNegative(input && input.timestamp)
      ? input.timestamp
      : NaN;
    const accuracyM = finiteNonNegative(input && input.accuracyM)
      ? input.accuracyM
      : NaN;
    const routeDistanceM = finiteNonNegative(input && input.routeDistanceM)
      ? input.routeDistanceM
      : NaN;
    const previousStreak = Number.isInteger(input && input.previousOffRouteStreak)
      ? Math.max(0, input.previousOffRouteStreak)
      : 0;
    const ageMs = Number.isFinite(timestamp) ? Math.max(0, now - timestamp) : NaN;
    const accuracy = accuracyBand(accuracyM);
    const freshness = freshnessBand(ageMs);
    const reliableForWarning =
      (accuracy === 'good' || accuracy === 'fair') && freshness === 'current';
    const usableForProgress =
      accuracy !== 'unavailable' && accuracy !== 'unusable' &&
      freshness !== 'unavailable' && freshness !== 'stale';
    const lowerBoundM = Number.isFinite(routeDistanceM) && Number.isFinite(accuracyM)
      ? Math.max(0, routeDistanceM - accuracyM)
      : NaN;
    const upperBoundM = Number.isFinite(routeDistanceM) && Number.isFinite(accuracyM)
      ? routeDistanceM + accuracyM
      : NaN;

    let nextOffRouteStreak = 0;
    let offRouteState = 'none';
    if(reliableForWarning && Number.isFinite(lowerBoundM)){
      if(lowerBoundM > THRESHOLDS.offRouteM){
        nextOffRouteStreak = previousStreak + 1;
        offRouteState = nextOffRouteStreak >= THRESHOLDS.confirmedFixes
          ? 'confirmed'
          : 'possible';
      }else if(upperBoundM < THRESHOLDS.onRouteM){
        nextOffRouteStreak = 0;
      }else{
        nextOffRouteStreak = Math.max(0, previousStreak - 1);
      }
    }

    return {
      version: VERSION,
      accuracy,
      freshness,
      ageMs,
      accuracyM,
      routeDistanceM,
      lowerBoundM,
      upperBoundM,
      reliableForWarning,
      usableForProgress,
      offRouteState,
      nextOffRouteStreak,
      farFromRoute: reliableForWarning &&
        Number.isFinite(lowerBoundM) &&
        lowerBoundM > THRESHOLDS.farFromRouteM,
    };
  }

  root.DoloPawsGpsPolicy = Object.freeze({
    VERSION,
    THRESHOLDS,
    accuracyBand,
    freshnessBand,
    assessFix,
  });
})(typeof window !== 'undefined' ? window : globalThis);
