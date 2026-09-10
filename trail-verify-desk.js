(function(){
  'use strict';
  /**
   * Trail verification, as one queue of plain questions.
   *
   * The older desks were organised around the pipeline: evidence on one page,
   * content on another, release on a third, each with its own vocabulary. One
   * trail therefore cost four visits. This desk keeps the same gates and the
   * same submit APIs, but presents them as a single list of trails, each with
   * the question that trail is actually waiting on.
   *
   * The rule for every card: the human check comes first, the machine's
   * workings go behind "Show the evidence". Nothing here publishes; the final
   * website diff stays a separate, deliberate check further down the page.
   */
  const URLS={
    dossier:'backoffice-data/dossier-review-queue.json',
    orchestration:'backoffice-data/trail-orchestration.json',
    editorial:'backoffice-data/verified-trail-editorial-execution.json',
    staging:'backoffice-data/publication-staging.json',
    catalogue:'backoffice-data/catalogue-campaign.json',
    registry:'backoffice-data/orma-verified-registry.json',
    pipeline:'backoffice-data/pipeline-health.json',
    worker:'backoffice-data/worker-health.json',
  };
  const LOCAL_MODE=['localhost','127.0.0.1'].includes(location.hostname);
  const DRAFT_KEY='orma-verify-notes-v1';
  const RECEIPT_KEY='orma-verify-receipts-v1';

  const stateNode=document.getElementById('verifyState');
  const queueNode=document.getElementById('verifyQueue');
  const countNode=document.getElementById('verifyCount');
  const machineNodes={
    state:document.getElementById('verifyMachineState'),
    work:document.getElementById('verifyMachineWork'),
    controls:document.getElementById('verifyMachineControls'),
    stuck:document.getElementById('verifyStuck'),
    age:document.getElementById('verifyMachineAge'),
  };
  const blockedNode=document.getElementById('verifyBlocked');
  const prNode=document.getElementById('verifyPr');
  const prCountNode=document.getElementById('verifyPrCount');
  const refreshBtn=document.getElementById('verifyRefresh');

  let dossier={items:[]},orchestration={trails:[],summary:{}},editorial={outputs:[]},staging={items:[]},publication={requests:[]};
  let catalogue={items:[]},registry={verified:[]};
  let pipeline=null,worker=null;
  let coverageError='';
  let drafts=stored(DRAFT_KEY),receipts=stored(RECEIPT_KEY);

  function stored(key){try{return JSON.parse(localStorage.getItem(key)||'{}');}catch(error){return {};}}
  function persist(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch(error){/* convenience only */}}
  function el(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
  function num(value,suffix=''){return value===undefined||value===null||value===''?'—':`${value}${suffix}`;}
  function plural(count,word){return `${count} ${word}${count===1?'':'s'}`;}

  async function getJson(url,fallback){
    const response=await fetch(url,{cache:'no-store'});
    if(!response.ok){if(fallback!==undefined)return fallback;throw new Error(`Could not load ${url} (${response.status})`);}
    return response.json();
  }
  async function remote(){
    if(window.ORMABackoffice)return window.ORMABackoffice;
    await new Promise(resolve=>{window.addEventListener('dolopaws-auth-ready',resolve,{once:true});window.setTimeout(resolve,10000);});
    if(!window.ORMABackoffice)throw new Error('Sign in with a moderator account, then reload this page.');
    return window.ORMABackoffice;
  }
  async function artifact(id,url,fallback){
    if(LOCAL_MODE)return getJson(url,fallback);
    const result=await (await remote()).getArtifact(id);
    if(!result.ok){if(result.error==='artifact-not-found'&&fallback!==undefined)return fallback;throw new Error(`Could not load ${id}: ${result.error}`);}
    return result.data;
  }

  // ---- turning pipeline gates into questions a person can answer ----

  const GATES={
    'geometry-approval':{
      label:'Check the route',
      question:'Does this route match the official one?',
      checklist:[
        'The drawn line follows the official route',
        'The name and trail numbers match',
        'Branches and road crossings look right',
      ],
      reasons:[
        'The line does not follow the official route',
        'The start point or direction is wrong',
        'The name or trail numbers do not match',
        'A branch or crossing is drawn wrongly',
      ],
      scope:'This is about the route only. Parking and trail facts are checked separately.',
      approve:'Route looks right',
    },
    'dossier-approval':{
      label:'Check the trail facts',
      question:'Are these findings about the trail correct?',
      checklist:[],
      reasons:[
        'A finding is not supported by its source',
        'The evidence is too thin to verify',
        'A finding contradicts what the source says',
        'Something important about the trail is missing',
      ],
      scope:'Approving marks the trail verified. It still does not change the website.',
      approve:'Mark verified',
    },
    content:{
      label:'Check the description',
      question:'Is the written description right for this trail?',
      checklist:[
        'The summary matches what the route actually is',
        'Nothing claims a fact the evidence did not establish',
      ],
      reasons:[
        'The description claims more than the evidence shows',
        'The summary does not match the route',
        'The tone or wording is wrong for ORMA',
      ],
      scope:'Approving releases the text for publishing. The website diff is still checked at the end.',
      approve:'Description is right',
    },
    publish:{
      label:'Approve for publishing',
      question:'Ready to prepare this trail for the website?',
      checklist:['The trail page maps to the right existing trail or a new one'],
      reasons:[
        'This maps to the wrong trail',
        'It should be a new trail, not an update',
        'Not ready to publish yet',
      ],
      scope:'This prepares a pull request. You still review the website diff before anything goes live.',
      approve:'Prepare for publishing',
    },
  };


  /**
   * Blockers arrive as one machine string per failed claim, so a single
   * missing thing can appear three times:
   *
   *   logistics/recommended-start:    supported authoritative route guidance is required
   *   logistics/route-number-status:  supported authoritative route guidance is required
   *   logistics/route-number-sequence:supported authoritative route guidance is required
   *
   * That is one problem, not three. Each group states the problem once, in the
   * words of the thing a walker would miss, and says what would clear it.
   */
  const BLOCKER_GROUPS=[
    {
      match:/^logistics\/(recommended-start|route-number-)/,
      title:'No start point or directions',
      detail:'ORMA cannot say where this walk begins or which way to go. No authoritative source '
        + 'was found giving a start point, and no numbered or landmark sequence to follow.',
      remedy:'Find the official route sheet for this trail, a comune or department fiche giving the '
        + 'start and the order of the route. Without one the trail cannot be verified.',
    },
  ];

  /**
   * Not every blocking reason is a problem to read.
   *
   * advance-trail-orchestration pushes three different kinds of string into one
   * flat list: the claim that failed, the agent's overall recommendation, and
   * every open question the agent wrote down. Only the first names something a
   * person can act on. The other two are the agent thinking aloud, and a card
   * showed all of them at equal weight, so one missing route sheet arrived as
   * four full-width blocks under the same heading.
   *
   * They are the machine's working, so they go where the rest of the working
   * already goes: behind a disclosure.
   */
  const WORKING_NOTES=[
    // "recommendation is needs-resolution" restates that the check did not
    // pass, which the word BLOCKED at the top of the card already said.
    /:\s*recommendation is /,
    /:\s*open question\s*[—-]/,
  ];
  const isWorkingNote=text=>WORKING_NOTES.some(pattern=>pattern.test(text));

  /**
   * The checks, by the thing they look at. There are five of them and they do
   * not change often, so naming them beats "Terrain poi", which is the
   * variable name with a space put in it.
   */
  const CHECK_LABELS={
    logistics:'Getting there and getting around',
    regulatoryRanger:'Rules and access',
    terrainPoi:'Terrain and what is on the route',
    cartographer:'The route itself',
    evidenceLibrarian:'The sources behind the findings',
  };
  const checkLabel=agent=>CHECK_LABELS[agent]||blockerLabel(agent);

  /**
   * The heading already names the check that filed it, so repeating
   * "terrainPoi/" in the line under it says nothing. Strip the prefix and open
   * out what remains: "terrainPoi/surface: conflicted" becomes "Surface —
   * conflicted" under a heading of "Terrain poi".
   */
  function looseText(text){
    const stripped=String(text).replace(/^[A-Za-z][A-Za-z0-9]*[/:]\s*/,'');
    const parts=stripped.split(': ');
    if(parts.length<2)return stripped;
    return `${blockerLabel(parts[0])} — ${parts.slice(1).join(': ')}`;
  }

  /**
   * One entry per distinct problem, with the raw ids kept for hovering, plus
   * the agent's working kept separately so the card can fold it away.
   */
  function groupBlockers(reasons){
    const groups=[],loose=[],working=[];
    (reasons||[]).forEach(reason=>{
      const text=String(reason);
      const group=BLOCKER_GROUPS.find(candidate=>candidate.match.test(text));
      if(group){
        let existing=groups.find(entry=>entry.group===group);
        if(!existing){existing={group,raw:[]};groups.push(existing);}
        existing.raw.push(text);
        return;
      }
      (isWorkingNote(text)?working:loose).push(text);
    });
    // Several reasons from one agent used to render as several full-width
    // blocks, and "logistics/parking" and "logistics/access" made two of them
    // even though they are one check reporting twice. Key on the agent, which
    // is everything before the first slash or colon, so one check is one
    // heading with its reasons listed under it.
    const byHeading=new Map();
    loose.forEach(text=>{
      const heading=checkLabel(String(text).split(/[/:]/)[0]);
      if(!byHeading.has(heading))byHeading.set(heading,[]);
      byHeading.get(heading).push(text);
    });
    return {groups,loose:[...byHeading.entries()].map(([heading,texts])=>({heading,texts})),working};
  }

  const MIN_NOTE=10;
  const SHAPES=[['out-and-back','There and back'],['point-to-point','Point to point']];

  function shapeHelper(candidateId){
    const box=el('section','vd-shape');
    box.append(el('strong','','This route does not return to its start'));
    box.append(el('p','vd-shape-lede','If that is correct, declare its shape. The check then stops treating it as broken geometry. This composes the command; it does not save anything.'));

    let shape='out-and-back';
    const picker=el('div','vd-shape-picker');
    const command=el('code','vd-shape-command');
    const copy=el('button','vd-shape-copy','Copy command');copy.type='button';
    const note=el('input');
    note.type='text';
    note.placeholder='Why is it this shape? Recorded with the declaration.';

    // The CLI refuses a note under ten characters, so the desk must not hand out
    // a line that will fail. Quotes are escaped or the shell would eat the note.
    const render=()=>{
      const reason=note.value.trim();
      const ready=reason.length>=MIN_NOTE;
      command.textContent=`npm run backoffice:route-shape -- --trail ${candidateId} --shape ${shape} --note "${(ready?reason:'why this shape').replace(/"/g,'\\"')}"`;
      copy.disabled=!ready;
      copy.title=ready?'':`Add a note of at least ${MIN_NOTE} characters first`;
    };
    SHAPES.forEach(([value,label])=>{
      const chip=el('button','vd-shape-option',label);chip.type='button';
      if(value===shape)chip.classList.add('is-picked');
      chip.addEventListener('click',()=>{
        shape=value;
        [...picker.children].forEach(other=>other.classList.remove('is-picked'));
        chip.classList.add('is-picked');render();
      });
      picker.append(chip);
    });
    note.addEventListener('input',render);

    copy.addEventListener('click',async()=>{
      try{await navigator.clipboard.writeText(command.textContent);copy.textContent='Copied';}
      // A denied clipboard should not look like a failed declaration.
      catch(error){copy.textContent='Select the line and copy it';}
      setTimeout(()=>{copy.textContent='Copy command';},2500);
    });
    render();
    box.append(picker,note,command,copy);
    return box;
  }

  function geometryFacts(result){
    const comparison=result.comparison||{},assessment=result.assessment||{};
    return [
      ['Measured',num(comparison.reconstructedDistanceKm,' km')],
      ['Official',num(comparison.officialDistanceKm,' km')],
      ['Difference',num(comparison.distanceDeltaPercent,'%')],
      ['Closed loop',assessment.isClosed===undefined?'—':(assessment.isClosed?`Yes · ${num(assessment.closureDistanceM,' m')} gap`:'No')],
    ];
  }

  function routeSvg(coordinates){
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 700 300');svg.setAttribute('role','img');
    svg.setAttribute('aria-label','Route drawn from the mapped data');svg.classList.add('bo-route-svg');
    if(!coordinates||!coordinates.length)return svg;
    const xs=coordinates.map(point=>point[0]),ys=coordinates.map(point=>point[1]);
    const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    const dx=maxX-minX||1,dy=maxY-minY||1;
    const points=coordinates.map(([x,y])=>`${30+(x-minX)/dx*640},${270-(y-minY)/dy*240}`).join(' ');
    const line=document.createElementNS(svg.namespaceURI,'polyline');
    line.setAttribute('points',points);line.setAttribute('fill','none');line.setAttribute('stroke','currentColor');
    line.setAttribute('stroke-width','5');line.setAttribute('stroke-linejoin','round');line.setAttribute('stroke-linecap','round');
    svg.append(line);return svg;
  }

  /**
   * The queue carries a summary of each agent output, not the record: the
   * record is its own document, and copying every one of them into the queue
   * is what pushed that artifact past what Firestore will store. So the full
   * output is fetched when someone actually opens it, which is the only time
   * it is read.
   */
  function machineOutput(output){
    const raw=el('details','vd-raw');
    const summary=el('summary','','Machine output');
    raw.append(summary);
    const body=el('pre','','');
    raw.append(body);
    let loaded=false;
    raw.addEventListener('toggle',async()=>{
      if(!raw.open||loaded)return;
      loaded=true;
      if(!output.resultRef){body.textContent=JSON.stringify(output.result||{},null,2);return;}
      const id=String(output.resultRef).replace(/^firestore:/,'');
      body.textContent='Loading…';
      try{
        const full=await artifact(id,`backoffice-data/${id}.json`,null);
        body.textContent=full?JSON.stringify(full,null,2)
          :'That agent output is no longer stored. The summary above is what the queue kept.';
      }catch(error){
        // A failed fetch must not read as an agent that found nothing.
        loaded=false;
        body.textContent=`Could not load the full output: ${error.message}`;
      }
    });
    return raw;
  }

  function evidenceBlock(item){
    const details=el('details','vd-evidence');
    details.append(el('summary','','Show the evidence'));
    // A card whose detail the queue could not afford to carry says so, rather
    // than looking like an agent that reported nothing.
    if(item.detailWithheld&&!(item.specialistOutputs||[]).length){
      const note=el('p','vd-evidence-withheld',
        'The queue was too full to keep this review’s detail. Nothing is lost: each agent output is stored separately, listed below.');
      details.append(note);
      (item.specialistOutputRefs||[]).forEach(ref=>details.append(el('p','vd-raw',String(ref).replace(/^firestore:/,''))));
    }
    (item.specialistOutputs||[]).forEach(output=>{
      const result=output.result||{};
      const panel=el('div','vd-evidence-panel');
      panel.append(el('h4','',`${output.agentId} · ${result.summary||result.assessment?.status||'result'}`));
      if(result.geometry?.coordinates)panel.append(routeSvg(result.geometry.coordinates));
      if(result.source?.url){
        const link=el('a','','Open the official source');
        link.href=result.source.url;link.target='_blank';link.rel='noopener';
        panel.append(link);
      }
      panel.append(machineOutput(output));
      details.append(panel);
    });
    if(item.claimResolution&&item.claimResolution.length){
      const history=el('div','vd-evidence-panel');
      history.append(el('h4','','What the agents already retried'));
      history.append(el('p','',item.claimResolution.map(entry=>`${entry.category}: ${String(entry.state||'').replace(/-/g,' ')}`).join(' · ')));
      details.append(history);
    }
    return details;
  }

  function claimLines(item){
    const claims=[];
    (item.specialistOutputs||[]).forEach(output=>(output.result?.claims||[]).forEach(claim=>claims.push(claim)));
    return claims;
  }

  function fromDossier(){
    return (dossier.items||[]).filter(item=>item.state==='awaiting-human').map(item=>({
      key:item.reviewId,
      gate:GATES[item.gateType]||GATES['dossier-approval'],
      trailName:item.trailName||item.candidateId,
      candidateId:item.candidateId,
      blockers:item.blockingReasons||[],
      ready:item.approvalAllowed!==false,
      facts:(()=>{const carto=(item.specialistOutputs||[]).find(output=>output.agentId==='cartographer');return carto?geometryFacts(carto.result||{}):[];})(),
      openRoute:(()=>{const carto=(item.specialistOutputs||[]).find(output=>output.agentId==='cartographer');
        return carto?.result?.assessment?.isClosed===false;})(),
      claims:claimLines(item),
      evidence:()=>evidenceBlock(item),
      // Revision goes back to whoever raised the finding, so there is no
      // "revision owner" dropdown to think about.
      targetAgent:(item.specialistOutputs||[])[0]?.agentId||'auditor',
      submit:(action,note,acceptedBlockers)=>send('dossier',{reviewId:item.reviewId,candidateId:item.candidateId,action,
        targetAgent:(item.specialistOutputs||[])[0]?.agentId||'auditor',note,acceptedBlockers:acceptedBlockers||[]}),
    }));
  }

  function fromContent(){
    return (editorial.outputs||[]).filter(output=>output.state==='awaiting-human'||output.reviewState==='awaiting-human').map(output=>({
      key:`content-${output.candidateId}`,
      gate:GATES.content,
      trailName:output.result?.title||output.trailName||output.candidateId,
      candidateId:output.candidateId,
      blockers:output.blockers||[],
      ready:true,
      facts:[],
      claims:[],
      summary:output.result?.summary||output.result?.intro||'',
      evidence:()=>{const details=el('details','vd-evidence');details.append(el('summary','','Show the evidence'));const raw=el('pre','',JSON.stringify(output.result||output,null,2));details.append(raw);return details;},
      submit:(action,note)=>send('content',{candidateId:output.candidateId,action,note}),
    }));
  }

  function fromPublish(){
    return (staging.items||[]).filter(item=>item.state==='awaiting-human').map(item=>({
      key:`publish-${item.candidateId}`,
      gate:GATES.publish,
      trailName:item.trailName||item.targetTrailId||item.candidateId,
      candidateId:item.candidateId,
      blockers:item.blockers||[],
      ready:true,
      facts:[['Maps to',item.targetTrailId||'new trail']],
      claims:[],
      evidence:()=>{const details=el('details','vd-evidence');details.append(el('summary','','Show the evidence'),el('pre','',JSON.stringify(item,null,2)));return details;},
      submit:(action,note)=>send('publication',{candidateId:item.candidateId,action,note}),
    }));
  }

  async function send(kind,payload){
    if(LOCAL_MODE)return {ok:true,reviewId:'local'};
    const api=await remote();
    if(kind==='dossier')return api.submitDossierReview(payload);
    if(kind==='publication')return api.submitPublicationReview(payload);
    return api.submitTrailReview({gate:'content-review',decisions:[payload]});
  }


  // ---- coverage: how much of the catalogue is actually verified ----

  const coverageNodes={
    headline:document.getElementById('verifyHeadline'),
    bar:document.getElementById('verifyBarFill'),
    split:document.getElementById('verifySplit'),
    blockers:document.getElementById('verifyBlockers'),
    age:document.getElementById('verifyCoverageAge'),
    checks:document.getElementById('verifyChecks'),
    why:document.getElementById('verifyWhy'),
    stages:document.getElementById('verifyStages'),
    guidance:document.getElementById('verifyGuidance'),
  };

  // The eleven checks a trail must complete. Spelled out because the desk kept
  // being asked why the count was zero, and the answer is not guessable from a
  // number: the safety *values* (shade cover, heat risk, exposure) feed the
  // match score and the blockers, and are not checks at all.
  const GRADUATION_CHECKS=[
    ['photo','Photo'],['route','Route'],['routeNumbers','Route numbers'],
    ['mapPoints','Map points'],['elevation','Elevation'],['water','Water'],
    ['heat','Heat'],['exposure','Exposure'],['livestock','Livestock'],
    ['surfaceHazards','Surface hazards'],['access','Access'],
  ];

  // campaignState is where a trail actually sits. Machine names read as
  // jargon, so each one says what it means for the person reading.
  const STAGE_LABELS={
    'verified-monitoring':'Verified, now monitored',
    'identity-check-queued':'Waiting for a route identity check',
    'source-identity-required':'Needs a route source before it can start',
    'agent-execution-failure':'Stuck: the agent run failed',
  };

  /**
   * Blocker ids are written for machines ("shadeCoverage-unknown"). Split the
   * camelCase and the dashes back into words rather than keeping a hand-built
   * dictionary that would silently miss every new blocker.
   */
  /**
   * What would actually clear each of the counted blockers. The list kept being
   * read as "add some links and 156 trails unblock", which is not what any of
   * these say: a link is evidence, and only two of them are about evidence at
   * all. Spelling out the remedy is cheaper than the wasted afternoon.
   */
  const BLOCKER_REMEDIES={
    'review-date-missing':'No date is recorded on which anyone reviewed this trail\'s safety facts. Only doing the review sets it; a link cannot.',
    'claim-sources-missing':'Every safety category claimed as reviewed must name a link covering it. Links help here, but only together with the review that cites them.',
    'category-review-incomplete':'Fewer than all six safety categories have been reviewed: water, heat, exposure, livestock, surface hazards, access.',
    'shadeCoverage-unknown':'No shade figure recorded. This feeds the match score, not verification.',
    'heatRisk-unknown':'No heat rating recorded. This feeds the match score, not verification.',
    'exposure-unknown':'No exposure rating recorded. This feeds the match score, not verification.',
    'surfaceHazards-unknown':'No surface hazards recorded. This feeds the match score, not verification.',
    'route-source-identity-unresolved':'No authoritative source names this route. An official route sheet is the one thing that clears it.',
    'route-number-guidance-unverified':'No authoritative start point or route order. An official route sheet is the one thing that clears it.',
    'usable-geometry-missing':'No usable line is stored for this route.',
  };

  function blockerLabel(id){
    const words=String(id||'').replace(/([a-z0-9])([A-Z])/g,'$1 $2').replace(/[-_]/g,' ').trim().toLowerCase();
    return words.charAt(0).toUpperCase()+words.slice(1);
  }

  function renderCoverage(){
    const items=catalogue.items||[];
    if(!items.length){
      // Never render "0 verified" when the figures simply could not be read:
      // a daily Firestore quota is a real and recurring cause here, and a
      // silent zero reads exactly like genuine bad news.
      coverageNodes.headline.textContent=coverageError
        ? 'Could not read the catalogue figures, so this is not a count of zero.'
        : 'Catalogue figures are not available yet.';
      if(coverageError)coverageNodes.split.textContent=coverageError;
      return;
    }
    // The registry is the record of what actually shipped as verified; the
    // catalogue flag can lag behind it, so trust whichever knows about more.
    const flagged=items.filter(item=>item.modernGraduationVerified===true).length;
    const registryCount=(registry.verified||[]).length;
    const verified=Math.max(flagged,registryCount);
    const total=items.length;
    const remaining=Math.max(total-verified,0);
    const imported=items.filter(item=>item.origin==='imported').length;
    const curated=total-imported;

    coverageNodes.headline.textContent=`${verified} of ${total} trails verified · ${remaining} to go`;
    coverageNodes.bar.style.width=`${Math.max((verified/total)*100,verified?1.5:0)}%`;
    coverageNodes.split.textContent=`${curated} written by hand · ${imported} imported from OpenStreetMap`;
    if(catalogue.generatedAt){
      const when=new Date(catalogue.generatedAt);
      if(!Number.isNaN(when.valueOf()))coverageNodes.age.textContent=`Counted ${when.toLocaleDateString()}`;
    }

    // The eleven checks, listed so "verified" is not a word of unknown meaning.
    coverageNodes.checks.replaceChildren();
    GRADUATION_CHECKS.forEach(([, label])=>coverageNodes.checks.append(el('li','',label)));

    // Why the number is low. Deliberately no invented "entered" metric: a
    // trail waiting on a route source has not started either, so counting it
    // as progress would overstate exactly what this panel exists to explain.
    const why=[`${plural(flagged,'trail')} of ${total} ${flagged===1?'has':'have'} completed all eleven checks. `
      + 'The rest are not failing them, they are waiting earlier in the process:'];
    // The registry and the catalogue flag can disagree, and showing the larger
    // number beside a smaller stage count reads as a contradiction. Say it.
    if(registryCount!==flagged){
      why.push(`The verified registry lists ${registryCount}, while the catalogue flags ${flagged}. `
        + 'They disagree, which usually means the catalogue was counted before the most recent verification.');
    }
    coverageNodes.why.textContent=why.join(' ');

    const stages=new Map();
    items.forEach(item=>{
      const state=item.campaignState||'unknown';
      stages.set(state,(stages.get(state)||0)+1);
    });
    coverageNodes.stages.replaceChildren();
    [...stages.entries()].sort((a,b)=>b[1]-a[1]).forEach(([state,count])=>{
      const row=el('li');
      row.append(el('strong','',String(count)),el('span','',STAGE_LABELS[state]||state.replace(/-/g,' ')));
      row.title=state;
      coverageNodes.stages.append(row);
    });

    // The route-guidance gate is the actual ceiling: a trail nobody can number
    // can never complete the routeNumbers check, however much else is done.
    const summary=catalogue.summary||{};
    const outstanding=Number(summary.routeNumberGuidanceOutstanding);
    coverageNodes.guidance.textContent=Number.isFinite(outstanding)&&outstanding
      ? `Route guidance is the requirement that stops most trails: ${plural(outstanding,'trail')} still cannot show an authoritative `
        + `start point and direction, and cannot complete the route numbers check until they can.`
      : 'Every admitted trail must show authoritative route guidance: a start point '
        + 'and direction, or an ordered landmark sequence.';

    // Ranked, because the same handful of gaps blocks almost every trail:
    // closing one of them advances a hundred trails, reviewing one advances one.
    const counts=new Map();
    items.forEach(item=>{
      if(item.modernGraduationVerified===true)return;
      (item.baselineBlockers||[]).forEach(id=>counts.set(id,(counts.get(id)||0)+1));
    });
    const ranked=[...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6);
    coverageNodes.blockers.replaceChildren();
    if(!ranked.length){
      coverageNodes.blockers.append(el('li','','Nothing is recorded as blocking.'));
      return;
    }
    ranked.forEach(([id,count])=>{
      const row=el('li');
      const text=el('span','vd-blocker-text');
      text.append(el('span','vd-blocker-name',blockerLabel(id)));
      if(BLOCKER_REMEDIES[id])text.append(el('small','vd-blocker-remedy',BLOCKER_REMEDIES[id]));
      row.append(el('strong','',String(count)),text);
      row.title=id;
      coverageNodes.blockers.append(row);
    });
  }

  // ---- what the machine is doing, and where it has stopped ----

  const WORKER_RUN_URL='https://github.com/lorenzib/ORMA/actions/workflows/orma-backoffice-worker.yml';

  // Lane ids are the job type as the code writes it. Naming the ones that exist
  // beats a hand-built dictionary going stale, so unknown lanes fall back to the
  // id with its dashes opened out rather than being hidden.
  const LANE_LABELS={
    'trail-verification-specialist':'Gathering evidence about a trail',
    'trail-claim-resolution':'Re-checking findings that came back unresolved',
    'verified-trail-revision':'Rewriting a trail page after a revision',
    'hosted-editorial-publication':'Publishing written content',
    'verified-trail-editorial-first-pass':'Writing a first draft',
    'image-coverage':'Finding a photo for a trail',
  };
  function laneLabel(jobType){
    if(LANE_LABELS[jobType])return LANE_LABELS[jobType];
    const words=String(jobType||'').replace(/-/g,' ').trim();
    return words.charAt(0).toUpperCase()+words.slice(1);
  }

  function ago(value){
    const when=value?new Date(value):null;
    if(!when||Number.isNaN(when.valueOf()))return null;
    const hours=(Date.now()-when.valueOf())/3600000;
    if(hours<1)return 'less than an hour ago';
    if(hours<48)return `${Math.round(hours)} hours ago`;
    return `${Math.round(hours/24)} days ago`;
  }

  /**
   * A command with a copy button. The desk cannot run these itself: Firestore
   * refuses every write to backofficeJobs from a browser, deliberately, so a
   * button that claimed to stop a lane would be a lie. Handing over the exact
   * line is the honest version of the same control.
   */
  function commandBox(label, command){
    const box=el('div','vd-command');
    const code=el('code','',command);
    const copy=el('button','vd-command-copy',label);copy.type='button';
    copy.addEventListener('click',async()=>{
      try{await navigator.clipboard.writeText(command);copy.textContent='Copied';}
      catch(error){copy.textContent='Select the line and copy it';}
      window.setTimeout(()=>{copy.textContent=label;},2500);
    });
    box.append(code,copy);
    return box;
  }

  /** Is it running at all, and did the last run work? */
  function renderMachineState(){
    const node=machineNodes.state;
    node.classList.remove('is-bad','is-good');
    if(!worker){
      node.textContent='No record of the automation running. Either it has never run, or its figures could not be read.';
      return;
    }
    const last=worker.completedAt||worker.lastSuccessfulAt||worker.startedAt;
    const when=ago(last);
    const overdueAfter=Number(worker.delayAfterMinutes)||45;
    const minutesSince=last?(Date.now()-new Date(last).valueOf())/60000:null;
    const overdue=minutesSince!==null&&minutesSince>overdueAfter;

    if(worker.status==='running'){node.textContent=`A run is going on now, started ${ago(worker.startedAt)||'just now'}.`;return;}
    if(worker.status==='failed'){
      node.classList.add('is-bad');
      node.textContent=`The last run failed ${when||'recently'}: ${worker.lastFailure?.message||'no reason was recorded'}`;
      return;
    }
    if(worker.status==='blocked'){
      node.classList.add('is-bad');
      node.textContent=`The last run stopped before publishing ${when||'recently'}: ${worker.publicationGate?.message||'the website publication gate is closed'}`;
      return;
    }
    // Healthy but stale is the case that matters: nothing is broken, nothing is
    // running either, and a count of "0 failures" reads as if all were well.
    if(overdue){
      node.classList.add('is-bad');
      node.textContent=`The last run worked, but it was ${when}. It expects to run every ${Math.round((Number(worker.expectedIntervalMinutes)||180)/60)||3} hours, so it is behind or switched off.`;
      return;
    }
    node.classList.add('is-good');
    node.textContent=`The last run worked, ${when||'recently'}.`;
  }

  function renderMachine(){
    if(!machineNodes.state)return;
    renderMachineState();

    const work=pipeline&&pipeline.working?pipeline.working:null;
    const trailsRunning=Number((orchestration.summary||{}).running||0);
    const parts=[];
    if(trailsRunning)parts.push(`${plural(trailsRunning,'trail')} in progress`);
    if(work){
      if(work.running)parts.push(`${plural(work.running,'task')} running`);
      if(work.queued)parts.push(`${plural(work.queued,'task')} queued`);
    }
    machineNodes.work.textContent=parts.length?`${parts.join(' · ')}.`:'Nothing is in progress right now.';
    if(pipeline&&pipeline.generatedAt){
      const seen=ago(pipeline.generatedAt);
      machineNodes.age.textContent=seen?`Last counted ${seen}`:'';
    }

    machineNodes.controls.replaceChildren();
    const run=el('a','vd-run-now','Run it now');
    run.href=WORKER_RUN_URL;run.target='_blank';run.rel='noopener';
    machineNodes.controls.append(run);
    machineNodes.controls.append(el('small','vd-run-note',
      'Opens the automation on GitHub. "Run workflow" starts a pass immediately; it also runs itself every three hours.'));

    renderStuck();
  }

  function renderStuck(){
    const node=machineNodes.stuck;
    node.replaceChildren();
    if(!pipeline||!pipeline.stopped){
      node.append(el('p','vd-empty','No record of stopped work yet. It is written by the automation at the end of each run.'));
      return;
    }
    const stopped=pipeline.stopped;
    if(!stopped.total){
      node.append(el('p','vd-empty','Nothing has stopped. Every task is either running, queued or done.'));
      return;
    }

    node.append(el('h3','vd-stuck-title',`${plural(stopped.total,'task')} stopped`));
    // The distinction the whole panel exists for. A count of "88 blocked" reads
    // as a broken pipeline when 68 of them are an unpaid bill that resumes on
    // its own the moment it is paid.
    const split=el('p','vd-stuck-split');
    split.append(el('strong','',String(stopped.needsDecision)),el('span','',' need a decision from you · '),
      el('strong','',String(stopped.resumesItself)),el('span','',' start again on their own once the cause clears'));
    node.append(split);
    if(stopped.oldest)node.append(el('p','vd-stuck-age',`The oldest stopped ${ago(stopped.oldest)}.`));

    (pipeline.lanes||[]).filter(lane=>lane.stopped).forEach(lane=>{
      const row=el('article','vd-lane');
      const head=el('div','vd-lane-head');
      head.append(el('h4','',laneLabel(lane.jobType)),el('span','vd-lane-count',plural(lane.stopped,'task')));
      row.append(head);
      row.title=lane.jobType;

      (lane.causes||[]).forEach(cause=>{
        const item=el('div','vd-cause');
        item.append(el('strong','',`${cause.count}× ${cause.message}`));
        item.append(el('p','vd-cause-remedy',cause.remedy));
        row.append(item);
      });

      // A retired lane is the whole story: whatever its tasks failed on, no
      // code is left to run them, so "add credit and they resume" would be
      // false. Say that before anything about the errors themselves.
      if(lane.laneRetired&&!lane.carriesVerification){
        row.append(el('p','vd-lane-note is-retired',
          'Nothing runs this any more. These tasks cannot succeed and will not restart, whatever their reason says — clearing them is all that is left.'));
        row.append(commandBox('Copy the stop command',
          `npm run backoffice:retire-blocked-jobs -- --job-type ${lane.jobType} --apply --reason "no longer part of the pipeline"`));
        node.append(row);
        return;
      }
      if(lane.resumesItself===lane.stopped){
        row.append(el('p','vd-lane-note','Nothing to do here. The automation puts these back itself, ten per run, once the cause clears.'));
      }else if(lane.carriesVerification){
        // Retiring one of these would drop a trail out of verification without
        // anyone deciding to, so the desk offers no way to do it.
        row.append(el('p','vd-lane-note','This work carries trail verification, so it cannot be stopped from here. Fix the cause, or the trails waiting on it never finish.'));
      }else{
        row.append(el('p','vd-lane-note','If this kind of work no longer exists, stop it. That clears the stopped tasks; it does not delete any trail.'));
        row.append(commandBox('Copy the stop command',
          `npm run backoffice:retire-blocked-jobs -- --job-type ${lane.jobType} --apply --reason "no longer part of the pipeline"`));
      }
      node.append(row);
    });

    node.append(el('p','vd-lane-note','To list everything that can be stopped, without changing anything: npm run backoffice:retire-blocked-jobs'));
  }

  // ---- rendering ----

  const MIN_ACCEPT_REASON=10;
  const ROUTE_GUIDANCE_BLOCKER=/supported authoritative route guidance is required$/;

  // Ticking a blocker off. Five agents researching a trail always leave loose
  // ends, and a gate that opens only when none remain never opens. Accepting one
  // says this dossier can be verified; it never says the claim is true, so the
  // reason is required and is kept with the verification.
  //
  // One row per raw blocker string, because that string is what the contract
  // matches on. The grouped explanation above stays as it is: it is for reading,
  // this is for deciding.
  function acceptanceList(decision,onChange){
    const waivable=decision.blockers.filter(reason=>!ROUTE_GUIDANCE_BLOCKER.test(String(reason)));
    const supplied=decision.blockers.filter(reason=>ROUTE_GUIDANCE_BLOCKER.test(String(reason)));
    const box=el('div','vd-accept');
    const accepted=new Map();

    if(supplied.length){
      const note=el('p','vd-accept-blocked');
      note.textContent=supplied.length===1
        ?'Directions cannot be ticked off: a walker follows them, so they have to be supplied. Send it back to the agent.'
        :`${supplied.length} route-guidance blockers cannot be ticked off: a walker follows them, so they have to be supplied. Send it back to the agent.`;
      box.append(note);
    }
    if(!waivable.length)return {node:box,accepted,waivable};

    box.append(el('p','vd-accept-lede',
      'If you have looked at these and they do not stop the trail being verified, say why. Your reason is kept with the verification, and the claim itself stays exactly as the agent left it.'));

    waivable.forEach((reason,index)=>{
      const row=el('label','vd-accept-row');
      const tick=el('input');tick.type='checkbox';
      const text=el('span','vd-accept-text',looseText(String(reason)));
      const why=el('input');why.type='text';why.className='vd-accept-why';
      why.placeholder='Why does this not stop verification?';
      why.disabled=true;
      const update=()=>{
        why.disabled=!tick.checked;
        const value=why.value.trim();
        if(tick.checked&&value.length>=MIN_ACCEPT_REASON)accepted.set(String(reason),value);
        else accepted.delete(String(reason));
        row.classList.toggle('is-accepted',accepted.has(String(reason)));
        onChange();
      };
      tick.addEventListener('change',()=>{if(tick.checked)window.setTimeout(()=>why.focus(),0);update();});
      why.addEventListener('input',update);
      row.append(tick,text,why);
      box.append(row);
      if(index===0)row.classList.add('is-first');
    });
    return {node:box,accepted,waivable};
  }

  function card(decision){
    const article=el('article',`vd-card${decision.ready?'':' is-blocked'}`);
    const head=el('div','vd-card-head');
    const heading=el('div');
    heading.append(el('p','vd-gate',decision.gate.label),el('h2','',decision.trailName));
    head.append(heading);
    if(!decision.ready)head.append(el('span','vd-lock','Blocked'));
    article.append(head);
    // The question and its checklist are for deciding an approvable trail.
    // On a blocked one they are noise above the reason it is blocked.
    if(decision.ready)article.append(el('p','vd-question',decision.gate.question));

    // A blocked trail cannot be approved, so the reason is the story: it goes
    // directly under the name, before the question and the approval checklist.
    if(decision.blockers.length){
      const {groups,loose,working}=groupBlockers(decision.blockers);
      const box=el('div','vd-blockers');
      box.append(el('h3','','Cannot be approved yet'));
      groups.forEach(({group,raw})=>{
        const item=el('div','vd-blocker');
        item.append(el('strong','',group.title),el('p','',group.detail),el('p','vd-remedy',group.remedy));
        // The machine ids stay reachable without taking up the card.
        item.title=raw.join('\n');
        box.append(item);
      });
      loose.forEach(({heading,texts})=>{
        const item=el('div','vd-blocker');
        item.append(el('strong','',heading));
        texts.forEach(text=>item.append(el('p','',looseText(text))));
        // The machine ids stay reachable without taking up the card.
        item.title=texts.join('\n');
        box.append(item);
      });
      // The agent's open questions and its own recommendation. If something
      // above already named the problem they add nothing, so they fold away.
      // If nothing did, they are all the card has and must stay visible.
      if(working.length){
        const named=groups.length||loose.length;
        const host=named?el('details','vd-blocker-working'):el('div','vd-blocker');
        if(named){
          host.append(el('summary','',`What the check was still asking (${working.length})`));
        }else{
          host.append(el('strong','','The check did not finish'));
        }
        working.forEach(text=>host.append(el('p','',text)));
        box.append(host);
      }
      article.append(box);
    }

    // Declared before the buttons so the gate can read it; filled in below.
    let acceptance=null;
    const approvable=()=>decision.ready
      ||(acceptance&&acceptance.waivable.length===decision.blockers.length
        &&acceptance.accepted.size===acceptance.waivable.length);

    if(decision.summary)article.append(el('p','vd-summary',decision.summary));

    // The checklist is the job. It used to be one sentence at the bottom of
    // the cartographer panel; here it is the first thing on the card.
    const checks=decision.ready?decision.gate.checklist.slice():[];
    if(decision.ready)decision.claims.forEach(claim=>checks.push(`${claim.category}: ${claim.proposedValue}`));
    if(checks.length){
      const list=el('ul','vd-checklist');
      checks.forEach(text=>list.append(el('li','',text)));
      article.append(el('h3','vd-checklist-title','What to check'),list);
    }

    if(decision.ready&&decision.facts.length){
      const facts=el('div','vd-facts');
      decision.facts.forEach(([label,value])=>{const box=el('div');box.append(el('small','',label),el('strong','',value));facts.append(box);});
      article.append(facts);
    }

    const receipt=receipts[decision.key];
    const note=el('textarea');
    note.placeholder='If it needs work, say exactly what is wrong.';
    note.value=(drafts[decision.key]||receipt?.note||'');
    note.addEventListener('input',()=>{drafts[decision.key]={note:note.value};persist(DRAFT_KEY,drafts);});

    // A revision needs a precise note, and typing one for every trail is the
    // slow part. The common reasons for this gate write the note in one click,
    // and remain editable afterwards for anything they do not cover.
    const reasons=decision.gate.reasons||[];
    if(reasons.length&&!receipt){
      const list=el('div','vd-reasons');
      list.append(el('small','vd-reasons-label','Needs work because:'));
      reasons.forEach(reason=>{
        const chip=el('button','vd-reason',reason);chip.type='button';
        chip.addEventListener('click',()=>{
          const existing=note.value.trim();
          note.value=existing&&existing!==reason?`${existing}\n${reason}`:reason;
          drafts[decision.key]={note:note.value};persist(DRAFT_KEY,drafts);
          chip.classList.add('is-picked');
          note.dispatchEvent(new Event('input'));
        });
        list.append(chip);
      });
      article.append(list);
    }

    const actions=el('div','vd-actions');
    const status=el('p','vd-status',receipt?`Saved ${new Date(receipt.at).toLocaleTimeString()}. The next automation run picks it up.`:'');
    let approveButton=null;
    const syncApprove=()=>{
      if(!approveButton||receipt)return;
      const ok=approvable();
      approveButton.disabled=!ok;
      approveButton.title=ok?'':'Tick off every blocker with a reason, or send it back';
    };
    [['approve',decision.gate.approve,'is-approve'],['request-revision','Needs work',''],['reject','Reject','is-reject']].forEach(([action,label,cls])=>{
      const button=el('button',cls,label);button.type='button';
      if(action==='approve')approveButton=button;
      if(receipt)button.disabled=true;
      button.addEventListener('click',()=>decide(decision,action,note,article,status,
        action==='approve'&&acceptance?[...acceptance.accepted].map(([blocker,reason])=>({blocker,reason})):[]));
      actions.append(button);
    });
    if(!decision.ready&&decision.blockers.length){
      acceptance=acceptanceList(decision,syncApprove);
      article.append(acceptance.node);
    }
    syncApprove();
    if(receipt){note.disabled=true;}
    article.append(note,actions,status,el('p','vd-scope',decision.gate.scope));
    if(decision.openRoute&&decision.candidateId)article.append(shapeHelper(decision.candidateId));
    article.append(decision.evidence());
    return article;
  }

  async function decide(decision,action,note,article,status,acceptedBlockers){
    if(action!=='approve'&&!note.value.trim()){
      status.textContent='Say what needs fixing before sending it back.';
      note.focus();return;
    }
    article.querySelectorAll('button').forEach(button=>button.disabled=true);
    status.textContent='Saving…';
    try{
      const result=await decision.submit(action,note.value.trim(),acceptedBlockers||[]);
      if(result&&result.ok===false)throw new Error(result.error||'submit-failed');
      receipts[decision.key]={action,note:note.value.trim(),at:new Date().toISOString()};persist(RECEIPT_KEY,receipts);
      delete drafts[decision.key];persist(DRAFT_KEY,drafts);
      status.textContent='Saved. The next automation run picks it up.';
      note.disabled=true;
      window.setTimeout(load,1200);
    }catch(error){
      status.textContent=`Could not save: ${error.message}`;
      article.querySelectorAll('button').forEach(button=>{button.disabled=false;});
    }
  }

  function renderPullRequests(){
    const requests=(publication.requests||[]).filter(request=>request.state==='awaiting-human'||request.status==='awaiting-review');
    prCountNode.textContent=requests.length?plural(requests.length,'website change'):'Nothing waiting';
    prNode.replaceChildren();
    if(!requests.length){prNode.append(el('p','vd-empty','No website changes are waiting for a final look.'));return;}
    requests.forEach(request=>{
      const row=el('article','vd-pr');
      row.append(el('h3','',request.title||request.targetTrailId||request.candidateId));
      if(request.pullRequestUrl){
        const link=el('a','','Open the website diff');
        link.href=request.pullRequestUrl;link.target='_blank';link.rel='noopener';
        row.append(link);
      }
      row.append(el('p','vd-scope','Merging this pull request is what changes the live website.'));
      prNode.append(row);
    });
  }

  // Trails that gave up. A blocked trail has no gate, so it appears in no review
  // queue and the desk showed it nowhere at all -- it simply vanished from the
  // pipeline with no way to see that it had. It is terminal by design and frees
  // capacity for other work, but silently losing a trail is not the same as
  // deciding to stop on it.
  function blockedTrails(){
    return (orchestration.trails||[])
      .filter(trail=>trail.state==='blocked')
      .map(trail=>({
        trailId:trail.trailId||trail.candidateId,
        name:trail.trailName||trail.trailId||trail.candidateId,
        reasons:(trail.blockers||[]).map(String),
        stoppedAt:trail.updatedAt||null,
      }));
  }

  function renderBlocked(){
    if(!blockedNode)return;
    const stopped=blockedTrails();
    blockedNode.replaceChildren();
    blockedNode.hidden=!stopped.length;
    if(!stopped.length)return;
    blockedNode.append(el('h2','vd-blocked-title',
      `${plural(stopped.length,'trail')} stopped after every attempt`));
    blockedNode.append(el('p','vd-blocked-lede',
      'These are out of the queue and no longer hold a place, so other trails keep moving. They stay here until their evidence or their source changes.'));
    stopped.forEach(trail=>{
      const row=el('article','vd-blocked-row');
      row.append(el('strong','',trail.name));
      // One line per trail, so it names the problems and never the working.
      const {groups,loose,working}=groupBlockers(trail.reasons);
      const said=[...groups.map(entry=>entry.group.title),...loose.map(entry=>entry.heading)];
      if(!said.length&&working.length)said.push('The check did not finish');
      row.append(el('p','vd-blocked-why',said.length?said.join(' · '):'No reason was recorded.'));
      if(trail.stoppedAt)row.append(el('small','',`Stopped ${new Date(trail.stoppedAt).toLocaleDateString()}`));
      blockedNode.append(row);
    });
  }

  function render(){
    // Trails that are clean by every automated check come first: they are one
    // click each, and burying them under the ones needing thought is what makes
    // a short queue feel long.
    const decisions=[...fromDossier(),...fromContent(),...fromPublish()]
      .sort((a,b)=>Number(b.ready===true)-Number(a.ready===true));
    countNode.textContent=decisions.length?plural(decisions.length,'trail'):'Nothing waiting';
    queueNode.replaceChildren();
    if(!decisions.length){
      queueNode.append(el('p','vd-empty','Nothing needs you right now.'));
    }else{
      decisions.forEach(decision=>queueNode.append(card(decision)));
    }
    renderMachine();
    renderBlocked();
    renderCoverage();
    renderPullRequests();
  }

  async function load(){
    refreshBtn.disabled=true;
    try{
      [dossier,orchestration,editorial,staging,publication,catalogue,registry,pipeline,worker]=await Promise.all([
        artifact('dossier-review-queue',URLS.dossier,{items:[]}),
        artifact('trail-orchestration',URLS.orchestration,{trails:[],summary:{}}),
        artifact('verified-trail-editorial-execution',URLS.editorial,{outputs:[]}),
        artifact('publication-staging',URLS.staging,{items:[]}),
        artifact('publication-requests',null,{requests:[]}),
        artifact('catalogue-campaign',URLS.catalogue,{items:[]}),
        artifact('orma-verified-registry-live',URLS.registry,{verified:[]}),
        artifact('pipeline-health',URLS.pipeline,null),
        artifact('worker-health',URLS.worker,null),
      ]);
      coverageError='';
      stateNode.textContent='';
      stateNode.classList.remove('is-error');
      render();
    }catch(error){
      coverageError=error.message;
      stateNode.classList.add('is-error');
      stateNode.textContent=/quota/i.test(error.message)
        ? `${error.message} The daily Firestore quota resets after midnight Pacific; the figures are stale, not zero.`
        : error.message;
      renderCoverage();
    }finally{
      refreshBtn.disabled=false;
    }
  }

  refreshBtn.addEventListener('click',load);
  load();
  // Poll once a minute, and only while the tab is visible, so a backgrounded
  // desk cannot drain the Firestore daily quota.
  window.setInterval(()=>{if(!document.hidden)load();},60000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});
})();
