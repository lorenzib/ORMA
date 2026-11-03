(function(){
  // Script-written wording goes through i18n.js; the English sentence is its own key.
  function tx(text, vars){
    const i18n = typeof window !== 'undefined' && window.DoloPawsI18n;
    if (i18n && typeof i18n.phrase === 'function') return i18n.phrase(text, vars);
    return vars ? String(text).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : text;
  }
  const params=new URLSearchParams(location.search), trail=params.get('trail')||'alpe-siusi', name=params.get('name')||'Alpe di Siusi Meadow Loop';
  const input=document.getElementById('photoInput'), grid=document.getElementById('photoGrid'), empty=document.getElementById('photoEmpty'), submit=document.getElementById('submitPhotos'), status=document.getElementById('photoSubmitStatus');
  let photos=[];
  document.getElementById('uploadTrail').textContent=name;
  document.getElementById('uploadBack').href='trail.html?id='+encodeURIComponent(trail);
  document.getElementById('uploadDone').href='trail.html?id='+encodeURIComponent(trail);
  function render(){empty.hidden=photos.length>0;grid.hidden=!photos.length;grid.innerHTML=photos.map((p,i)=>'<div class="photo-tile" style="background-image:url('+JSON.stringify(p)+')"><button class="photo-remove" data-remove="'+i+'" aria-label="'+tx('Remove photo')+'">×</button></div>').join('');submit.disabled=!photos.length;submit.textContent=photos.length?(photos.length===1?tx('Submit 1 photo'):tx('Submit {count} photos',{count:photos.length})):tx('Submit');}
  function choose(capture){ if(capture) input.setAttribute('capture','environment'); else input.removeAttribute('capture'); input.click(); }
  document.getElementById('takePhoto').addEventListener('click',()=>choose(true));
  document.getElementById('choosePhoto').addEventListener('click',()=>choose(false));
  input.addEventListener('change',async()=>{const files=Array.from(input.files).slice(0,4-photos.length);input.value='';status.hidden=true;for(const file of files){try{photos.push(await window.DoloPawsTrailPhotoPrep.prepare(file));render();}catch(error){status.textContent=error.message||tx('This photo could not be prepared.');status.hidden=false;}}});
  grid.addEventListener('click',e=>{const b=e.target.closest('[data-remove]');if(!b)return;photos.splice(Number(b.dataset.remove),1);render();});
  submit.addEventListener('click',async()=>{
    status.hidden=true;submit.disabled=true;submit.textContent=tx('Submitting…');
    if(!(window.DoloPawsCommunity&&window.DoloPawsCommunity.addTrailPhoto)){
      status.textContent=tx('Account services are still loading. Please try again.');status.hidden=false;render();return;
    }
    const caption=document.getElementById('photoCaption').value.trim();
    let queued=0;
    for(const photo of photos){
      const result=await window.DoloPawsCommunity.addTrailPhoto(trail,photo,caption);
      if(!result.ok){
        status.textContent=result.message||tx('This photo could not be submitted.');status.hidden=false;render();return;
      }
      if(result.queued)queued++;
    }
    document.getElementById('uploadMain').hidden=true;
    document.getElementById('uploadSuccess').hidden=false;
    document.getElementById('uploadSuccessCopy').textContent=queued
      ? (queued===1?tx('Your 1 photo is saved on this device and waiting to sync when you reconnect.'):tx('Your {count} photos are saved on this device and waiting to sync when you reconnect.',{count:queued}))
      : (photos.length===1?tx('Your 1 photo of {name} is pending moderation and will appear only after approval.',{name}):tx('Your {count} photos of {name} are pending moderation and will appear only after approval.',{count:photos.length,name}));
  });
  render();
})();
