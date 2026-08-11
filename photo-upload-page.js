(function(){
  const params=new URLSearchParams(location.search), trail=params.get('trail')||'alpe-siusi', name=params.get('name')||'Alpe di Siusi Meadow Loop';
  const input=document.getElementById('photoInput'), grid=document.getElementById('photoGrid'), empty=document.getElementById('photoEmpty'), submit=document.getElementById('submitPhotos'), status=document.getElementById('photoSubmitStatus');
  let photos=[];
  document.getElementById('uploadTrail').textContent=name;
  document.getElementById('uploadBack').href='trail.html?id='+encodeURIComponent(trail);
  document.getElementById('uploadDone').href='trail.html?id='+encodeURIComponent(trail);
  function render(){empty.hidden=photos.length>0;grid.hidden=!photos.length;grid.innerHTML=photos.map((p,i)=>'<div class="photo-tile" style="background-image:url('+JSON.stringify(p)+')"><button class="photo-remove" data-remove="'+i+'" aria-label="Remove photo">×</button></div>').join('');submit.disabled=!photos.length;submit.textContent=photos.length?'Submit '+photos.length+' photo'+(photos.length===1?'':'s'):'Submit';}
  function choose(capture){ if(capture) input.setAttribute('capture','environment'); else input.removeAttribute('capture'); input.click(); }
  document.getElementById('takePhoto').addEventListener('click',()=>choose(true));
  document.getElementById('choosePhoto').addEventListener('click',()=>choose(false));
  input.addEventListener('change',()=>{Array.from(input.files).slice(0,4-photos.length).forEach(file=>{const reader=new FileReader();reader.onload=()=>{photos.push(reader.result);render();};reader.readAsDataURL(file);});input.value='';});
  grid.addEventListener('click',e=>{const b=e.target.closest('[data-remove]');if(!b)return;photos.splice(Number(b.dataset.remove),1);render();});
  submit.addEventListener('click',async()=>{
    status.hidden=true;submit.disabled=true;submit.textContent='Submitting…';
    if(!(window.DoloPawsCommunity&&window.DoloPawsCommunity.addTrailPhoto)){
      status.textContent='Account services are still loading. Please try again.';status.hidden=false;render();return;
    }
    const caption=document.getElementById('photoCaption').value.trim();
    let queued=0;
    for(const photo of photos){
      const result=await window.DoloPawsCommunity.addTrailPhoto(trail,photo,caption);
      if(!result.ok){
        status.textContent=result.message||'This photo could not be submitted.';status.hidden=false;render();return;
      }
      if(result.queued)queued++;
    }
    document.getElementById('uploadMain').hidden=true;
    document.getElementById('uploadSuccess').hidden=false;
    document.getElementById('uploadSuccessCopy').textContent=queued
      ? 'Your '+queued+' photo'+(queued===1?' is':'s are')+' saved on this device and waiting to sync when you reconnect.'
      : 'Your '+photos.length+' photo'+(photos.length===1?'':'s')+' of '+name+' '+(photos.length===1?'is':'are')+' pending moderation and will appear only after approval.';
  });
  render();
})();
