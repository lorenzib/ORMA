// Where on the trail a hazard actually is.
//
// A hazard reported as "partway up the ascent" is prose: it cannot be sorted,
// filtered, put on the map, or warned about on approach. A hazard at km 1.8 can
// be all of those. This turns a dropped pin, a GPS fix or a scouted coordinate
// into that km mark by projecting it onto the trail's own path.
//
// Shared by the browser (the report control and the trail page) and by node
// (the Hazard Analyst lane), so the km a reader sees is the km the agent wrote.
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.OrmaHazardLocation=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const EARTH_RADIUS_M=6371008.8;
  const KM_PER_DEGREE=111.32;
  // Beyond this a pin is not describing a point on this trail. Alpine paths are
  // mapped loosely and a walker's GPS drifts under tree cover, so the tolerance
  // is generous; it exists to catch a pin dropped in the wrong valley, not to
  // police accuracy.
  const MAX_OFF_ROUTE_M=250;

  function toRadians(value){return value*Math.PI/180;}

  function metresBetween(a,b){
    const lat1=toRadians(a.lat),lat2=toRadians(b.lat);
    const deltaLat=lat2-lat1,deltaLng=toRadians(b.lng-a.lng);
    const h=Math.sin(deltaLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(deltaLng/2)**2;
    return 2*EARTH_RADIUS_M*Math.asin(Math.min(1,Math.sqrt(h)));
  }

  // Trail paths are [lat,lng] pairs; map events and GPS give {lat,lng}. Accept
  // both rather than making every caller remember which.
  function point(value){
    if(Array.isArray(value)&&value.length>=2)return finite({lat:Number(value[0]),lng:Number(value[1])});
    if(value&&typeof value==='object')return finite({lat:Number(value.lat),lng:Number(value.lng)});
    return null;
  }

  function finite(candidate){
    if(!Number.isFinite(candidate.lat)||!Number.isFinite(candidate.lng))return null;
    if(candidate.lat<-90||candidate.lat>90||candidate.lng<-180||candidate.lng>180)return null;
    return candidate;
  }

  function routePoints(path){
    return (Array.isArray(path)?path:[]).map(point).filter(Boolean);
  }

  /**
   * Project a coordinate onto the trail and report where along it that falls.
   * Returns null when the trail has no usable path — a hazard is never given a
   * position invented from a path that does not exist.
   */
  function locateOnRoute(coordinate,path){
    const origin=point(coordinate);
    const points=routePoints(path);
    if(!origin||points.length<2)return null;

    // Flat projection: over a single trail segment the error is far below the
    // tolerance, and it avoids a spherical solve per segment on every drag.
    const lngScale=KM_PER_DEGREE*Math.max(0.01,Math.cos(toRadians(origin.lat)));
    let best=null;
    for(let index=0;index<points.length-1;index+=1){
      const start=points[index],end=points[index+1];
      const startX=(start.lng-origin.lng)*lngScale,startY=(start.lat-origin.lat)*KM_PER_DEGREE;
      const endX=(end.lng-origin.lng)*lngScale,endY=(end.lat-origin.lat)*KM_PER_DEGREE;
      const deltaX=endX-startX,deltaY=endY-startY;
      const lengthSquared=deltaX**2+deltaY**2;
      const projected=lengthSquared>0?-((startX*deltaX)+(startY*deltaY))/lengthSquared:0;
      const fraction=Math.max(0,Math.min(1,projected));
      const snapped={lat:start.lat+((end.lat-start.lat)*fraction),lng:start.lng+((end.lng-start.lng)*fraction)};
      const offRouteM=metresBetween(origin,snapped);
      if(!best||offRouteM<best.offRouteM)best={index,fraction,snapped,offRouteM};
    }
    if(!best)return null;

    // Distance along the path to the projected point: whole segments before it,
    // plus the fraction of the one it lands on.
    let km=0;
    for(let index=0;index<best.index;index+=1)km+=metresBetween(points[index],points[index+1]);
    km+=metresBetween(points[best.index],best.snapped);

    return {
      lat:Math.round(best.snapped.lat*1e6)/1e6,
      lng:Math.round(best.snapped.lng*1e6)/1e6,
      km:Math.round((km/1000)*100)/100,
      offRouteM:Math.round(best.offRouteM),
      onRoute:best.offRouteM<=MAX_OFF_ROUTE_M,
    };
  }

  /** How a located hazard is said out loud, on a card or in a warning. */
  function describeLocation(location){
    if(!location||!Number.isFinite(location.km))return null;
    if(location.km<0.05)return 'At the start of the route';
    return `About ${location.km<10?location.km.toFixed(1):Math.round(location.km)} km along the route`;
  }

  return {MAX_OFF_ROUTE_M,locateOnRoute,describeLocation,metresBetween};
});
