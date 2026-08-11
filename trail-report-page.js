(function(){
  const params=new URLSearchParams(location.search),trail=params.get('trail')||'alpe-siusi',name=params.get('name')||'Alpe di Siusi Meadow Loop';
  let hazard='',severity='Moderate',photos=[];
  const locationField=document.getElementById('reportLocation'),submit=document.getElementById('submitReport'),photoInput=document.getElementById('reportPhotoInput'),photosEl=document.getElementById('reportPhotos'),status=document.getElementById('reportSubmitStatus');
  const hazardTypes={damage:'dangerous-terrain',livestock:'guard-dogs-livestock',water:'water-dry',blocked:'dangerous-terrain',other:'other'};
  document.getElementById('reportTrail').textContent=name;document.getElementById('reportBack').href='trail.html?id='+encodeURIComponent(trail);document.getElementById('reportDone').href='trail.html?id='+encodeURIComponent(trail);
  function sync(){submit.disabled=!(hazard&&locationField.value.trim());}
  document.getElementById('hazardOptions').addEventListener('click',e=>{const b=e.target.closest('[data-value]');if(!b)return;hazard=b.dataset.value;document.querySelectorAll('.hazard-option').forEach(x=>x.classList.toggle('on',x===b));sync();});
  document.getElementById('severity').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;severity=b.textContent;document.querySelectorAll('#severity button').forEach(x=>x.classList.toggle('on',x===b));});
  locationField.addEventListener('input',sync);
  document.getElementById('addReportPhoto').addEventListener('click',()=>photoInput.click());
  photoInput.addEventListener('change',async()=>{const files=Array.from(photoInput.files).slice(0,4-photos.length);photoInput.value='';status.hidden=true;for(const file of files){try{photos.push(await window.DoloPawsTrailPhotoPrep.prepare(file));renderPhotos();}catch(error){status.textContent=error.message||'This photo could not be prepared.';status.hidden=false;}}});
  function renderPhotos(){photosEl.innerHTML=photos.map((p,i)=>'<div class="photo-tile" style="background-image:url('+JSON.stringify(p)+')"><button class="photo-remove" data-remove="'+i+'" aria-label="Remove photo">×</button></div>').join('')+(photos.length<4?'<button id="addReportPhotoAgain" class="photo-add-tile" aria-label="Add another photo">+</button>':'');const again=document.getElementById('addReportPhotoAgain');if(again)again.addEventListener('click',()=>photoInput.click());}
  photosEl.addEventListener('click',e=>{const b=e.target.closest('[data-remove]');if(!b)return;photos.splice(Number(b.dataset.remove),1);renderPhotos();});
  submit.addEventListener('click',async()=>{
    status.hidden=true;submit.disabled=true;submit.textContent='Submitting…';
    if(!(window.DoloPawsCommunity&&window.DoloPawsCommunity.addFlag)){
      status.textContent='Account services are still loading. Please try again.';status.hidden=false;sync();return;
    }
    const note=document.getElementById('reportNotes').value.trim();
    const text=[severity,locationField.value.trim(),note].filter(Boolean).join(' · ').slice(0,300);
    const result=await window.DoloPawsCommunity.addFlag(trail,hazardTypes[hazard],null,text);
    if(!result.ok){
      status.textContent=result.message||'This report could not be submitted.';status.hidden=false;sync();return;
    }
    let queued=result.queued?1:0;
    for(const photo of photos){
      const photoResult=await window.DoloPawsCommunity.addTrailPhoto(trail,photo,'Photo attached to a pending hazard report');
      if(!photoResult.ok){
        status.textContent='The hazard was submitted, but an attached photo could not be added. '+(photoResult.message||'');
        status.hidden=false;
        return;
      }
      if(photoResult.queued)queued++;
    }
    document.getElementById('reportMain').hidden=true;
    document.getElementById('reportSuccess').hidden=false;
    document.getElementById('reportSuccessCopy').textContent=queued
      ? 'Your report is saved on this device and waiting to sync when you reconnect.'
      : 'Your report for '+name+' is pending moderation. It will appear publicly only after approval.';
  });
  sync();
})();
