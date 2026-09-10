(function(root,factory){
  const library=factory();
  if(typeof module==='object'&&module.exports)module.exports=library;
  if(root)root.ORMAProductFunnelModel=library;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';

  const STEP_DEFINITIONS=[
    {id:'recommendations',label:'Recommendations shown',matches:event=>isHomepage(event,'discovery_search','results_viewed')},
    {id:'explanation',label:'Top match explanation seen',matches:event=>isHomepage(event,'trail_decision','explanation_viewed')},
    {id:'primary',label:'Primary “View trail details” chosen',matches:event=>isHomepage(event,'trail_decision','selected')&&event.properties.selectionSource==='primary_cta'},
    {id:'opened',label:'Trail details opened',matches:event=>matches(event,'trail_decision','opened')},
    {id:'offline',label:'Offline map ready',matches:event=>matches(event,'offline_package','ready')},
    {id:'hike',label:'Hike started',matches:event=>matches(event,'hike_session','started')},
    {id:'outcome',label:'Post-hike answer submitted',matches:event=>event.family==='post_hike_outcome'},
  ];

  function matches(event,family,state){
    return !!event&&event.family===family&&event.state===state;
  }

  function isHomepage(event,family,state){
    return matches(event,family,state)&&event.properties&&event.properties.surface==='homepage';
  }

  function clientId(event){
    return event&&typeof event.clientId==='string'&&event.clientId?event.clientId:null;
  }

  function clientSet(events,predicate){
    return new Set(events.filter(predicate).map(clientId).filter(Boolean));
  }

  function intersectionSize(first,second){
    let count=0;
    first.forEach(value=>{if(second.has(value))count+=1;});
    return count;
  }

  function percent(part,total){
    return total?Math.round(part/total*100):null;
  }

  function build(events){
    const valid=Array.isArray(events)?events.filter(event=>event&&typeof event==='object'):[];
    const allClients=clientSet(valid,()=>true);
    const resultClients=clientSet(valid,STEP_DEFINITIONS[0].matches);
    const discoveryClients=clientSet(valid,event=>isHomepage(event,'discovery_search','results_viewed')||isHomepage(event,'discovery_search','no_results'));
    const cohortSize=resultClients.size;
    const steps=STEP_DEFINITIONS.map((definition,index)=>{
      const matchingEvents=valid.filter(definition.matches);
      const reachedClients=clientSet(matchingEvents,()=>true);
      const browsers=index===0?reachedClients.size:intersectionSize(resultClients,reachedClients);
      return {
        id:definition.id,
        label:definition.label,
        browsers,
        eventCount:matchingEvents.length,
        rate:percent(browsers,cohortSize),
      };
    });
    const mapClients=clientSet(valid,event=>isHomepage(event,'trail_decision','selected')&&
      ['map_marker','route_line','list_map'].includes(event.properties.selectionSource));
    const adjustedClients=clientSet(valid,event=>isHomepage(event,'discovery_search','filters_changed'));
    const noResultClients=clientSet(valid,event=>isHomepage(event,'discovery_search','no_results'));
    const primary=steps.find(step=>step.id==='primary');
    return {
      eventCount:valid.length,
      consentedBrowsers:allClients.size,
      recommendationBrowsers:cohortSize,
      steps,
      primaryActionRate:primary.rate,
      mapInteractionRate:percent(intersectionSize(resultClients,mapClients),cohortSize),
      adjustmentRate:percent(intersectionSize(resultClients,adjustedClients),cohortSize),
      noResultRate:percent(noResultClients.size,discoveryClients.size),
    };
  }

  return {STEP_DEFINITIONS,build,percent};
});
