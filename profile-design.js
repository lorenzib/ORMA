(function(){
  const root=document.getElementById('profileDesign');
  if(!root)return;
  const name=document.getElementById('profileName'),breed=document.getElementById('profileBreed'),breedOther=document.getElementById('profileBreedOther'),age=document.getElementById('profileAge'),weight=document.getElementById('profileWeight'),notes=document.getElementById('profileNotes');
  const OTHER_BREED='__other__';
  let fitness='moderate';
  const CONDITION_CODES={
    'Joint or hip issues':'joints','Back / disc history':'back','Heart condition':'cardiac',
    'Overweight':'overweight','Recovering from injury':'injury','Impaired vision':'vision',
    'Heat sensitivity':'heat'
  };
  function canonicalBreeds(){return typeof DOG_BREEDS!=='undefined'?DOG_BREEDS:[];}
  function setBreedValue(value){
    const selected=String(value||'');
    const known=canonicalBreeds().includes(selected);
    breed.value=known?selected:(selected?OTHER_BREED:'');
    breedOther.value=known?'':selected;
    breedOther.hidden=breed.value!==OTHER_BREED;
  }
  function populateBreedOptions(selected){
    breed.replaceChildren();
    breed.add(new Option('Select a breed…',''));
    canonicalBreeds().forEach(value=>breed.add(new Option(value,value)));
    breed.add(new Option('Other (not listed)',OTHER_BREED));
    setBreedValue(selected);
  }
  populateBreedOptions('');
  breed.addEventListener('change',()=>{
    breedOther.hidden=breed.value!==OTHER_BREED;
    if(!breedOther.hidden)breedOther.focus();
  });
  function paintName(value){
    const display=value||'Your dog';
    root.querySelectorAll('[data-profile-name]').forEach(el=>el.textContent=display);
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
    document.getElementById('profileDistanceCap').textContent=base==null?'no cap':((joint?base*.75:base)+' km');
    document.getElementById('profileDistanceReason').textContent=(fitness.charAt(0).toUpperCase()+fitness.slice(1))+' fitness'+(base?' ('+base+' km)':'')+(joint?' × joint issues (0.75).':'.');
    document.getElementById('profileTerrain').textContent=fitness==='high'&&!joint?'rocky and below':fitness==='low'||joint?'gravel and below':'mixed and below';
    document.getElementById('profileTerrainReason').textContent=joint?'Health conditions lower the terrain tolerance by one level.':'No health modifier lowers the selected fitness tolerance.';
    document.getElementById('profileHeat').textContent=heat?'extra cautious':'standard';
    document.getElementById('profileHeatReason').textContent=heat?'Heat sensitivity is declared and always outranks breed assumptions.':'No heat-sensitivity condition declared.';
  }
  document.getElementById('profilePhotoButton').addEventListener('click',()=>document.getElementById('dogPhotoInput').click());
  const profileSaveStatus=document.getElementById('profileSaveStatus');
  window.addEventListener('dolopaws-account-save-result',event=>{
    const ok=!!(event.detail&&event.detail.ok);
    profileSaveStatus.textContent=ok
      ? (event.detail.addMode?'Dog added successfully.':'Profile saved.')
      : 'Something went wrong — please try again.';
    profileSaveStatus.style.color=ok?'#2C5C34':'#9C3A25';
    profileSaveStatus.hidden=false;
  });
  document.getElementById('profileSave').addEventListener('click',()=>{
    const legacyName=document.getElementById('dogName'),legacyBreed=document.getElementById('dogBreed'),legacyNotes=document.getElementById('medicalNotes');
    if(legacyName){legacyName.value=name.value;legacyName.dispatchEvent(new Event('input',{bubbles:true}));}
    if(legacyBreed){legacyBreed.value=breed.value===OTHER_BREED?breedOther.value.trim():breed.value;legacyBreed.dispatchEvent(new Event('input',{bubbles:true}));}
    if(legacyNotes){legacyNotes.value=notes.value;legacyNotes.dispatchEvent(new Event('input',{bubbles:true}));}
    const conditions=Array.from(root.querySelectorAll('#profileConditions input:checked')).map(input=>CONDITION_CODES[input.value]).filter(Boolean);
    window.dispatchEvent(new CustomEvent('dolopaws-profile-design-values',{detail:{ageBand:age.value,weightBand:weight.value,fitness,conditions}}));
    const save=Array.from(document.querySelectorAll('.saveBtn')).find(b=>!b.disabled);
    if(save){
      profileSaveStatus.textContent='Saving…';
      profileSaveStatus.style.color='';
      profileSaveStatus.hidden=false;
      save.click();
    }
    mirror();
  });
  updateImpact();
})();
