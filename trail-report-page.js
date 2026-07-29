(function(){
  const params=new URLSearchParams(location.search),trail=params.get('trail')||'alpe-siusi',name=params.get('name')||'Alpe di Siusi Meadow Loop';
  let hazard='',severity='Moderate',photos=[];
  const locationField=document.getElementById('reportLocation'),submit=document.getElementById('submitReport'),photoInput=document.getElementById('reportPhotoInput'),photosEl=document.getElementById('reportPhotos');
  document.getElementById('reportTrail').textContent=name;document.getElementById('reportBack').href='trail.html?id='+encodeURIComponent(trail);document.getElementById('reportDone').href='trail.html?id='+encodeURIComponent(trail);
  function sync(){submit.disabled=!(hazard&&locationField.value.trim());}
  document.getElementById('hazardOptions').addEventListener('click',e=>{const b=e.target.closest('[data-value]');if(!b)return;hazard=b.dataset.value;document.querySelectorAll('.hazard-option').forEach(x=>x.classList.toggle('on',x===b));sync();});
  document.getElementById('severity').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;severity=b.textContent;document.querySelectorAll('#severity button').forEach(x=>x.classList.toggle('on',x===b));});
  locationField.addEventListener('input',sync);
  document.getElementById('addReportPhoto').addEventListener('click',()=>photoInput.click());
  photoInput.addEventListener('change',()=>{Array.from(photoInput.files).slice(0,4-photos.length).forEach(file=>{const r=new FileReader();r.onload=()=>{photos.push(r.result);renderPhotos();};r.readAsDataURL(file);});photoInput.value='';});
  function renderPhotos(){photosEl.innerHTML=photos.map((p,i)=>'<div class="photo-tile" style="background-image:url('+JSON.stringify(p)+')"><button class="photo-remove" data-remove="'+i+'" aria-label="Remove photo">×</button></div>').join('')+(photos.length<4?'<button id="addReportPhotoAgain" class="photo-add-tile" aria-label="Add another photo">+</button>':'');const again=document.getElementById('addReportPhotoAgain');if(again)again.addEventListener('click',()=>photoInput.click());}
  photosEl.addEventListener('click',e=>{const b=e.target.closest('[data-remove]');if(!b)return;photos.splice(Number(b.dataset.remove),1);renderPhotos();});
  submit.addEventListener('click',()=>{const report={trail,hazard,severity,location:locationField.value.trim(),notes:document.getElementById('reportNotes').value.trim(),photos:photos.length,createdAt:new Date().toISOString()};try{const all=JSON.parse(localStorage.getItem('dolopaws-design-reports')||'[]');all.unshift(report);localStorage.setItem('dolopaws-design-reports',JSON.stringify(all));}catch(e){}document.getElementById('reportMain').hidden=true;document.getElementById('reportSuccess').hidden=false;document.getElementById('reportSuccessCopy').textContent='Other owners will see this on '+name+' within the hour. You’ll get a reply here if we need more detail.';});
  sync();
})();
