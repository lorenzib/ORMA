(function(){
  const root=document.getElementById('profileDesign');
  if(!root)return;
  const t=(key,fallback,vars)=>{
    if(!window.t)return fallback;
    const value=window.t(key,vars);
    return value===key?fallback:value;
  };
  const name=document.getElementById('profileName'),breed=document.getElementById('profileBreed'),age=document.getElementById('profileAge'),weight=document.getElementById('profileWeight'),notes=document.getElementById('profileNotes');
  let selectedBreeds=[];
  let fitness='moderate';
  const CONDITION_CODES={
    'Joint or hip issues':'joints','Back / disc history':'back','Heart condition':'cardiac',
    'Overweight':'overweight','Recovering from injury':'injury','Impaired vision':'vision',
    'Heat sensitivity':'heat'
  };
  function canonicalBreeds(){return typeof DOG_BREEDS!=='undefined'?DOG_BREEDS:[];}
  // Custom listbox works consistently on desktop and mobile browsers.
  function setBreedValue(value){
    // Skip while the user is typing: mirror() runs from a MutationObserver
    // and must never clobber (or fight) live input.
    if(document.activeElement!==breed){selectedBreeds=typeof breedParts==='function'?breedParts(value):String(value||'').split(/\s+\+\s+/).filter(Boolean);breed.value='';paintBreedSelection();}
  }
  function savedBreedValue(){return selectedBreeds.length?selectedBreeds.join(' + '):breed.value.trim();}
  function paintBreedSelection(){
    const chips=document.getElementById('profileBreedChips');
    chips.replaceChildren(...selectedBreeds.map((value,index)=>{const chip=document.createElement('button');chip.type='button';chip.className='breed-selection-chip';chip.textContent=value+' ×';chip.setAttribute('aria-label','Remove '+value);chip.addEventListener('click',()=>{selectedBreeds.splice(index,1);paintBreedSelection();paintBreedInsight();});return chip;}));
    paintBreedInsight();
  }
  function paintBreedInsight(){
    const card=document.getElementById('profileBreedInsight');
    const value=savedBreedValue();
    const lines=value&&typeof breedInsights==='function'?breedInsights(value):[];
    if(!value||!lines.length){card.hidden=true;return;}
    document.getElementById('profileBreedInsightTitle').textContent=selectedBreeds.length>1?'Heads-up for this mix':'Heads-up for this breed';
    document.getElementById('profileBreedInsightCopy').textContent=lines.slice(0,2).map(line=>line.sub).join(' ');
    card.hidden=false;
  }
  (function wireBreedOptions(){
    const list=document.getElementById('profileBreedList');
    if(!list)return;
    function paint(){
      const q=breed.value.trim();
      const values=typeof breedSuggestions==='function'?breedSuggestions(q,8):canonicalBreeds().filter(x=>x.toLowerCase().includes(q.toLowerCase())).slice(0,8);
      list.replaceChildren(...values.map(value=>{const option=document.createElement('button');option.type='button';option.className='breed-suggestion';option.setAttribute('role','option');option.textContent=value;option.addEventListener('pointerdown',event=>{event.preventDefault();if(!selectedBreeds.includes(value))selectedBreeds.push(value);breed.value='';list.hidden=true;breed.setAttribute('aria-expanded','false');paintBreedSelection();breed.focus();});return option;}));
      list.hidden=!q||!values.length;breed.setAttribute('aria-expanded',String(!list.hidden));
    }
    breed.addEventListener('input',()=>{paint();paintBreedInsight();});breed.addEventListener('focus',paint);
    breed.addEventListener('blur',()=>setTimeout(()=>{list.hidden=true;breed.setAttribute('aria-expanded','false');},150));
  })();
  function paintName(value){
    const display=value||t('account.yourDog','Your dog');
    const title=document.getElementById('profileTitle');
    if(title)title.textContent=t('account.profile.title','{name}’s profile',{name:display});
    root.querySelectorAll('[data-profile-avatar]').forEach(el=>el.textContent=display.charAt(0).toUpperCase());
  }
  function mirror(){
    const legacyName=document.getElementById('dogName'),legacyBreed=document.getElementById('dogBreed'),legacyNotes=document.getElementById('medicalNotes');
    const current=(legacyName&&legacyName.value)||'';
    if(document.activeElement!==name)name.value=current;
    paintName(current);
    if(legacyBreed&&legacyBreed.value)setBreedValue(legacyBreed.value);
    if(legacyNotes)notes.value=legacyNotes.value||'';
  }
  name.addEventListener('input',()=>{
    const legacyName=document.getElementById('dogName');
    if(legacyName){legacyName.value=name.value;legacyName.dispatchEvent(new Event('input',{bubbles:true}));}
    paintName(name.value.trim());
  });
  // Only react when authentication shows or hides the logged-in shell.
  // Watching every descendant attribute caused mirror() to observe its own
  // hidden/aria updates and spin indefinitely, freezing the account page.
  const loggedInState=document.getElementById('loggedInState');
  const observer=new MutationObserver(records=>{
    if(records.some(record=>record.attributeName==='hidden')&&!loggedInState.hidden)mirror();
  });
  observer.observe(loggedInState,{attributes:true,attributeFilter:['hidden']});
  window.addEventListener('dolopaws-account-profile-loaded',event=>{
    const p=event.detail&&event.detail.profile||{};
    mirror();
    setBreedValue(p.breed||'');
    if(p.ageBand)age.value=p.ageBand;
    if(p.weightBand)weight.value=p.weightBand;
    fitness=p.fitness||'moderate';
    document.querySelectorAll('[data-fitness]').forEach(x=>x.classList.toggle('on',x.dataset.fitness===fitness));
    const conditions=Array.isArray(p.conditions)?p.conditions:[];
    root.querySelectorAll('#profileConditions input').forEach(input=>{input.checked=conditions.includes(CONDITION_CODES[input.value]);});
    updateImpact();
  });
  setTimeout(mirror,300);
  document.getElementById('profileFitness').addEventListener('click',e=>{const b=e.target.closest('[data-fitness]');if(!b)return;fitness=b.dataset.fitness;document.querySelectorAll('[data-fitness]').forEach(x=>x.classList.toggle('on',x===b));updateImpact();});
  document.getElementById('profileConditions').addEventListener('change',updateImpact);
  function updateImpact(){
    const joint=!!root.querySelector('input[value="Joint or hip issues"]:checked'),heat=!!root.querySelector('input[value="Heat sensitivity"]:checked');
    const base=fitness==='low'?5:fitness==='moderate'?10:null;
    document.getElementById('profileDistanceCap').textContent=base==null?t('account.impact.noCap','no cap'):((joint?base*.75:base)+' km');
    const fitnessLabel=t('account.fitness.'+fitness,fitness.charAt(0).toUpperCase()+fitness.slice(1));
    document.getElementById('profileDistanceReason').textContent=joint
      ? t('account.impact.distanceJoint','{fitness} fitness{distance} × joint issues (0.75).',{fitness:fitnessLabel,distance:base?' ('+base+' km)':''})
      : t('account.impact.distance','{fitness} fitness{distance}.',{fitness:fitnessLabel,distance:base?' ('+base+' km)':''});
    document.getElementById('profileTerrain').textContent=fitness==='high'&&!joint
      ? t('account.impact.terrainRocky','rocky and below')
      : fitness==='low'||joint?t('account.impact.terrainGravel','gravel and below'):t('account.impact.terrainMixed','mixed and below');
    document.getElementById('profileTerrainReason').textContent=joint
      ? t('account.impact.terrainHealth','Health conditions lower the terrain tolerance by one level.')
      : t('account.impact.terrainStandard','No health modifier lowers the selected fitness tolerance.');
    document.getElementById('profileHeat').textContent=heat?t('account.impact.extraCautious','extra cautious'):t('account.impact.standard','standard');
    document.getElementById('profileHeatReason').textContent=heat
      ? t('account.impact.heatDeclared','Heat sensitivity is declared and always outranks breed assumptions.')
      : t('account.impact.heatStandard','No heat-sensitivity condition declared.');
  }
  document.getElementById('profilePhotoButton').addEventListener('click',()=>document.getElementById('dogPhotoInput').click());
  document.getElementById('profileRemoveDog').addEventListener('click',()=>{
    const remove=document.getElementById('removeDogBtn');
    if(remove&&!remove.disabled)remove.click();
  });
  const profileSaveStatus=document.getElementById('profileSaveStatus');
  window.addEventListener('dolopaws-account-save-result',event=>{
    const ok=!!(event.detail&&event.detail.ok);
    profileSaveStatus.textContent=ok
      ? (event.detail.addMode?t('account.dogAddedSuccess','Dog added successfully.'):t('account.profileSaved','Profile saved.'))
      : t('account.saveError','Something went wrong — please try again.');
    profileSaveStatus.style.color=ok?'#2C5C34':'#9C3A25';
    profileSaveStatus.hidden=false;
  });
  document.getElementById('profileSave').addEventListener('click',()=>{
    const legacyName=document.getElementById('dogName'),legacyBreed=document.getElementById('dogBreed'),legacyNotes=document.getElementById('medicalNotes');
    if(legacyName){legacyName.value=name.value;legacyName.dispatchEvent(new Event('input',{bubbles:true}));}
    if(legacyBreed){legacyBreed.value=savedBreedValue();legacyBreed.dispatchEvent(new Event('input',{bubbles:true}));}
    if(legacyNotes){legacyNotes.value=notes.value;legacyNotes.dispatchEvent(new Event('input',{bubbles:true}));}
    const conditions=Array.from(root.querySelectorAll('#profileConditions input:checked')).map(input=>CONDITION_CODES[input.value]).filter(Boolean);
    window.dispatchEvent(new CustomEvent('dolopaws-profile-design-values',{detail:{ageBand:age.value,weightBand:weight.value,fitness,conditions}}));
    const save=Array.from(document.querySelectorAll('.saveBtn')).find(b=>!b.disabled);
    if(save){
      profileSaveStatus.textContent=t('account.saving','Saving…');
      profileSaveStatus.style.color='';
      profileSaveStatus.hidden=false;
      save.click();
    }
    mirror();
  });
  updateImpact();
})();
