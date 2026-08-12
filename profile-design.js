(function(){
  const root=document.getElementById('profileDesign');
  if(!root)return;
  const t=(key,fallback,vars)=>{
    if(!window.t)return fallback;
    const value=window.t(key,vars);
    return value===key?fallback:value;
  };
  const name=document.getElementById('profileName'),breed=document.getElementById('profileBreed'),age=document.getElementById('profileAge'),weight=document.getElementById('profileWeight'),notes=document.getElementById('profileNotes');
  let fitness='moderate';
  const CONDITION_CODES={
    'Joint or hip issues':'joints','Back / disc history':'back','Heart condition':'cardiac',
    'Overweight':'overweight','Recovering from injury':'injury','Impaired vision':'vision',
    'Heat sensitivity':'heat'
  };
  function canonicalBreeds(){return typeof DOG_BREEDS!=='undefined'?DOG_BREEDS:[];}
  // Type-ahead combobox: a text input backed by a datalist, so typing
  // filters the (alphabetical) catalogue natively. Free text stays valid —
  // it replaces the old separate "Other (not listed)" field.
  function setBreedValue(value){
    // Skip while the user is typing: mirror() runs from a MutationObserver
    // and must never clobber (or fight) live input.
    if(document.activeElement!==breed)breed.value=String(value||'');
  }
  (function populateBreedOptions(){
    const list=document.getElementById('profileBreedList');
    if(!list)return;
    list.replaceChildren();
    canonicalBreeds().forEach(value=>{
      const option=document.createElement('option');
      option.value=value;
      list.appendChild(option);
    });
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
  const observer=new MutationObserver(mirror);observer.observe(document.getElementById('loggedInState'),{attributes:true,subtree:true});
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
    if(legacyBreed){legacyBreed.value=breed.value.trim();legacyBreed.dispatchEvent(new Event('input',{bubbles:true}));}
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
