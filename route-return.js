(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.ORMARouteReturn=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  // A one-way walk's figures cover one direction only: the authority publishes
  // the walk from A to B, and a reader without a bus back walks it twice. This
  // works out the figures for walking it there and back, so the page can show
  // them and score the dog on the longer walk.
  //
  // Climb is not simply doubled. Walking back, the outward descent becomes
  // climb: Rotwandwiesen from the gondola is 1 m up and 561 m down, so there
  // and back is about 562 m up, not 2 m. The descent of one leg is the stated
  // ascent less the net height gained, read from the trail's own profile ends;
  // the summed profile itself undercounts, so it is not used for the climb.

  const VIEWS=Object.freeze({ONE_WAY:'one-way',OUT_AND_BACK:'out-and-back'});

  function isOneWay(trail){
    return Boolean(trail&&trail.routeShape==='point-to-point'
      &&Number.isFinite(Number(trail.distance))&&Number(trail.distance)>0);
  }

  // Net height gained from start to finish, or null when the profile is too
  // thin to say.
  function netGain(trail){
    const profile=Array.isArray(trail&&trail.elevationProfile)?trail.elevationProfile:[];
    if(profile.length<2)return null;
    const first=Number(profile[0]&&profile[0].elev);
    const last=Number(profile[profile.length-1]&&profile[profile.length-1].elev);
    return Number.isFinite(first)&&Number.isFinite(last)?last-first:null;
  }

  // Hours are authored as strings: "0.75", "2.5–3", "3:38". Each bound is read
  // as hours, an h:mm bound as hours and minutes.
  function parseHoursRange(value){
    const text=String(value==null?'':value);
    const bounds=(text.match(/\d+:\d{2}|\d+(?:\.\d+)?/g)||[]).slice(0,2).map(part=>{
      if(part.includes(':')){
        const [h,m]=part.split(':').map(Number);
        return h+m/60;
      }
      return Number(part);
    }).filter(Number.isFinite);
    return bounds.length?bounds:null;
  }

  function formatHours(hours){
    const quarter=Math.max(0.25,Math.round(hours*4)/4);
    return String(Number(quarter.toFixed(2)));
  }

  // The standard walking-time rule (DIN 33466: 4 km/h on the flat, 300 m an
  // hour up, 500 m an hour down; the larger part plus half the smaller). It is
  // used only as a ratio, to scale the authority's own time for the leg back,
  // so a symmetric walk comes out at exactly double.
  function ruleHours(km,up,down){
    const flat=km/4;
    const vertical=up/300+down/500;
    return Math.max(flat,vertical)+Math.min(flat,vertical)/2;
  }

  function outAndBack(trail){
    if(!isOneWay(trail))return null;
    const km=Number(trail.distance);
    const up=Number.isFinite(Number(trail.elevation))?Math.max(0,Number(trail.elevation)):null;
    const net=netGain(trail);
    // A profile that gains more than the stated ascent is noise at the ends;
    // the descent cannot be below zero.
    const down=up===null?null:net===null?up:Math.max(0,up-net);
    const climb=up===null?null:Math.round(up+down);
    const bounds=parseHoursRange(trail.hours);
    let hours=trail.hours;
    if(bounds&&up!==null){
      const out=ruleHours(km,up,down);
      const back=ruleHours(km,down,up);
      const factor=out>0?1+back/out:2;
      hours=bounds.map(bound=>formatHours(bound*factor)).filter((v,i,all)=>all.indexOf(v)===i).join('–');
    }else if(bounds){
      hours=bounds.map(bound=>formatHours(bound*2)).filter((v,i,all)=>all.indexOf(v)===i).join('–');
    }
    return {
      ...trail,
      distance:Math.round(km*2*10)/10,
      elevation:climb,
      descent:climb,
      hours,
      routeShape:'out-and-back',
      // What the copy was made from, so a reader of the record can tell the
      // estimate from the authority's figures.
      returnLeg:{
        oneWayDistance:km,
        oneWayAscent:up,
        oneWayDescent:down===null?null:Math.round(down),
        oneWayHours:trail.hours,
        hoursEstimated:true,
      },
    };
  }

  // The view the reader picked on this page. Not remembered between pages: a
  // walk opens on the authority's own one-way figures.
  let current=VIEWS.ONE_WAY;
  function view(){return current;}
  function setView(next){
    const value=next===VIEWS.OUT_AND_BACK?VIEWS.OUT_AND_BACK:VIEWS.ONE_WAY;
    if(value===current)return;
    current=value;
    if(typeof window!=='undefined'&&typeof window.dispatchEvent==='function'&&typeof CustomEvent==='function'){
      window.dispatchEvent(new CustomEvent('orma-route-view-changed',{detail:{view:value}}));
    }
  }
  // The trail as the page should show and score it right now.
  function forView(trail){
    return current===VIEWS.OUT_AND_BACK&&isOneWay(trail)?outAndBack(trail):trail;
  }

  return {VIEWS,isOneWay,netGain,parseHoursRange,formatHours,ruleHours,outAndBack,view,setView,forView};
});
