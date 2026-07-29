(function(){
  const root=document.getElementById('profileDesign');
  if(!root)return;
  const name=document.getElementById('profileName'),breed=document.getElementById('profileBreed'),age=document.getElementById('profileAge'),weight=document.getElementById('profileWeight'),notes=document.getElementById('profileNotes');
  let fitness='moderate';
  function mirror(){
    const legacyName=document.getElementById('dogName'),legacyBreed=document.getElementById('dogBreed'),legacyNotes=document.getElementById('medicalNotes');
    const current=(legacyName&&legacyName.value)||'Your dog';
    name.value=current;root.querySelectorAll('[data-profile-name]').forEach(el=>el.textContent=current);root.querySelectorAll('[data-profile-avatar]').forEach(el=>el.textContent=current.charAt(0).toUpperCase());
    if(legacyBreed&&legacyBreed.value){const found=Array.from(breed.options).find(o=>o.textContent.toLowerCase()===legacyBreed.value.toLowerCase());if(found)breed.value=found.value;}
    if(legacyNotes)notes.value=legacyNotes.value||'';
  }
  const observer=new MutationObserver(mirror);observer.observe(document.getElementById('loggedInState'),{attributes:true,subtree:true});
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
  document.getElementById('profileAddDog').addEventListener('click',()=>{const btn=document.getElementById('liAddDogBtn');if(btn)btn.click();else location.href='onboarding.html';});
  document.getElementById('profileSave').addEventListener('click',()=>{
    const legacyName=document.getElementById('dogName'),legacyBreed=document.getElementById('dogBreed'),legacyNotes=document.getElementById('medicalNotes');
    if(legacyName){legacyName.value=name.value;legacyName.dispatchEvent(new Event('input',{bubbles:true}));}
    if(legacyBreed){legacyBreed.value=breed.value;legacyBreed.dispatchEvent(new Event('input',{bubbles:true}));}
    if(legacyNotes){legacyNotes.value=notes.value;legacyNotes.dispatchEvent(new Event('input',{bubbles:true}));}
    const save=Array.from(document.querySelectorAll('.saveBtn')).find(b=>!b.disabled);if(save)save.click();
    const status=document.getElementById('profileSaveStatus');status.textContent='Profile saved.';status.hidden=false;setTimeout(()=>status.hidden=true,2500);mirror();
  });
  updateImpact();
})();
