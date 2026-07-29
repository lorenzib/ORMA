(function(){
  const params = new URLSearchParams(location.search);
  const trailId = params.get('trail') || 'alpe-siusi';
  const trailName = params.get('name') || 'Alpe di Siusi Meadow Loop';
  const baseReviews = [
    {name:'Sofia',meta:'Labrador · moderate fitness',stars:5,date:'3 weeks ago',body:"Perfect first hike for a dog that's not used to altitude. Wide gravel the whole way and the fountain at Compatsch was running.",helpful:12},
    {name:'Jonas',meta:'Bernese Mountain Dog · low fitness',stars:4,date:'2 months ago',body:'Easy underfoot but busier than expected after 10am. Went early and had the meadow mostly to ourselves.',helpful:6},
    {name:'Elena',meta:'Border Collie · high fitness',stars:5,date:'2 months ago',body:'My collie could have done this twice over, but it was a lovely relaxed walk with great views the whole way round.',helpful:4}
  ];
  let reviews = baseReviews.slice();
  let rating = 0;
  try { reviews = JSON.parse(localStorage.getItem('dolopaws-design-reviews-' + trailId) || 'null') || reviews; } catch(e){}
  const back = document.getElementById('reviewBack');
  back.href = 'trail.html?id=' + encodeURIComponent(trailId);
  back.textContent = '← ' + trailName;
  const list = document.getElementById('reviewList');
  const composer = document.getElementById('reviewComposer');
  const body = document.getElementById('reviewBody');
  const submit = document.getElementById('submitReview');
  const picker = document.getElementById('starPicker');
  function stars(n){ return '<span class="review-stars">' + '★'.repeat(n) + '<span style="opacity:.25">' + '★'.repeat(5-n) + '</span></span>'; }
  function render(){
    const avg = reviews.reduce((sum,r)=>sum+r.stars,0) / reviews.length;
    document.getElementById('reviewAverage').textContent = avg.toFixed(1);
    document.getElementById('reviewCount').textContent = '(' + reviews.length + ' reviews)';
    list.innerHTML = reviews.map((r,i) => '<article class="review-card"><div class="review-card-head"><span class="review-avatar">' + r.name.charAt(0) + '</span><span class="review-person"><b>' + r.name + '</b><small>' + r.meta + '</small></span><span class="review-date">' + stars(r.stars) + '<br>' + r.date + '</span></div><p>' + r.body + '</p><button class="review-helpful" data-helpful="' + i + '">✓ Helpful' + (r.helpful ? ' · ' + r.helpful : '') + '</button></article>').join('');
  }
  function sync(){ submit.disabled = !rating || !body.value.trim(); }
  document.getElementById('writeReview').addEventListener('click', ()=>{ composer.hidden=false; document.getElementById('writeReview').hidden=true; });
  document.getElementById('cancelReview').addEventListener('click', ()=>{ composer.hidden=true; document.getElementById('writeReview').hidden=false; });
  picker.addEventListener('click', e => { const b=e.target.closest('button'); if(!b)return; rating=Array.from(picker.children).indexOf(b)+1; Array.from(picker.children).forEach((x,i)=>x.classList.toggle('on',i<rating)); sync(); });
  body.addEventListener('input',sync);
  submit.addEventListener('click',()=>{ reviews.unshift({name:'You',meta:'Nala · just now',stars:rating,date:'Just now',body:body.value.trim(),helpful:0}); try{localStorage.setItem('dolopaws-design-reviews-'+trailId,JSON.stringify(reviews));}catch(e){} composer.hidden=true; document.getElementById('writeReview').hidden=false; rating=0; body.value=''; Array.from(picker.children).forEach(x=>x.classList.remove('on')); render(); });
  list.addEventListener('click',e=>{const b=e.target.closest('[data-helpful]');if(!b)return;const i=Number(b.dataset.helpful);reviews[i].helpful++;render();});
  render();
})();
