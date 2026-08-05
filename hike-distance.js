(function(root){
  'use strict';

  const METRES_PER_DEGREE = 111000;

  function finite(value){
    return typeof value === 'number' && Number.isFinite(value);
  }

  function metresBetween(first, second){
    const dLat = (second.lat - first.lat) * METRES_PER_DEGREE;
    const dLng = (second.lng - first.lng) * METRES_PER_DEGREE *
      Math.cos(((first.lat + second.lat) / 2) * Math.PI / 180);
    return Math.hypot(dLat, dLng);
  }

  function create(initialKm){
    return {
      distanceM:finite(initialKm) && initialKm > 0 ? initialKm * 1000 : 0,
      anchor:null,
    };
  }

  function routeDelta(first, second, totalRouteM, loop){
    const direct = Math.abs(second - first);
    return loop && finite(totalRouteM) && totalRouteM > 0
      ? Math.min(direct, Math.max(0, totalRouteM - direct))
      : direct;
  }

  function update(state, fix, options){
    const current = state && finite(state.distanceM) ? state : create(0);
    if(!fix || fix.usable !== true || !finite(fix.lat) || !finite(fix.lng) ||
       !finite(fix.timestamp) || !finite(fix.accuracyM)) return current;
    const anchor = {
      lat:fix.lat,
      lng:fix.lng,
      timestamp:fix.timestamp,
      accuracyM:fix.accuracyM,
      routePositionM:finite(fix.routePositionM) ? fix.routePositionM : null,
      nearRoute:fix.nearRoute === true,
    };
    if(!current.anchor) return { ...current, anchor };

    const elapsedSeconds = (fix.timestamp - current.anchor.timestamp) / 1000;
    if(!finite(elapsedSeconds) || elapsedSeconds <= 0 || elapsedSeconds > 120){
      return { ...current, anchor };
    }
    const rawM = metresBetween(current.anchor, anchor);
    const canUseRoute = current.anchor.nearRoute && anchor.nearRoute &&
      finite(current.anchor.routePositionM) && finite(anchor.routePositionM);
    const movementM = canUseRoute
      ? routeDelta(
        current.anchor.routePositionM,
        anchor.routePositionM,
        options && options.totalRouteM,
        !!(options && options.loop)
      )
      : rawM;
    const uncertaintyM = Math.max(current.anchor.accuracyM, anchor.accuracyM);
    const movementThresholdM = Math.max(6, Math.min(30, uncertaintyM * 0.6));
    if(movementM < movementThresholdM) return current;

    // Reject jumps that are implausible for a person travelling on foot. The
    // accuracy allowance prevents a noisy but legitimate fix from resetting a
    // long, slow segment prematurely.
    const plausibleMaximumM = elapsedSeconds * 4.5 + movementThresholdM;
    if(movementM > plausibleMaximumM) return { ...current, anchor };
    return {
      distanceM:current.distanceM + movementM,
      anchor,
    };
  }

  root.DoloPawsHikeDistance = Object.freeze({
    create,
    update,
    routeDelta,
    metresBetween,
  });
})(typeof window !== 'undefined' ? window : globalThis);
