(function(root){
  'use strict';

  const params = new URLSearchParams(root.location.search);
  const trailId = params.get('trail') || 'alpe-siusi';
  const trailName = params.get('name') || 'Alpe di Siusi Meadow Loop';
  const back = document.getElementById('reviewBack');
  const list = document.getElementById('reviewList');
  const status = document.getElementById('reviewStatus');
  const summary = document.getElementById('reviewSummary');
  const composer = document.getElementById('reviewComposer');
  const body = document.getElementById('reviewBody');
  const submit = document.getElementById('submitReview');
  const write = document.getElementById('writeReview');
  const picker = document.getElementById('starPicker');
  let rating = 0;
  let loading = false;

  function esc(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, character => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
    })[character]);
  }

  function dateLabel(value){
    const date = value && typeof value.toDate === 'function' ? value.toDate() : null;
    return date && !Number.isNaN(date.getTime())
      ? date.toLocaleDateString(undefined, { day:'numeric', month:'short', year:'numeric' })
      : 'Recently';
  }

  function stars(number){
    const n = Math.max(0, Math.min(5, Math.round(Number(number) || 0)));
    return `<span class="review-stars" aria-label="${n} out of 5 stars">${'★'.repeat(n)}<span style="opacity:.25">${'★'.repeat(5 - n)}</span></span>`;
  }

  function publicReviews(items){
    return (Array.isArray(items) ? items : []).filter(review =>
      root.DoloPawsCommunityStates
      && root.DoloPawsCommunityStates.countsTowardRating(review.status)
      && Number(review.rating) >= 1 && Number(review.rating) <= 5
    );
  }

  function render(items){
    const reviews = publicReviews(items);
    list.setAttribute('aria-busy', 'false');
    if(!reviews.length){
      summary.hidden = true;
      list.innerHTML = '<div class="flow-card"><strong>No approved reviews yet</strong><p>Be the first to share how this route felt for your dog. Submissions appear only after moderation.</p></div>';
      return;
    }
    const average = reviews.reduce((total, review) => total + Number(review.rating), 0) / reviews.length;
    document.getElementById('reviewAverage').textContent = average.toFixed(1);
    document.getElementById('reviewCount').textContent = `(${reviews.length} ${reviews.length === 1 ? 'review' : 'reviews'})`;
    summary.hidden = false;
    list.innerHTML = reviews.map(review => {
      const dogName = review.dogContext && review.dogContext.name;
      const dogBreed = review.dogContext && review.dogContext.breed;
      const name = dogName ? `${dogName}’s human` : 'A DoloPaws member';
      const meta = dogBreed || 'Verified community member';
      return `<article class="review-card">
        <div class="review-card-head"><span class="review-avatar">${esc(name.charAt(0))}</span><span class="review-person"><b>${esc(name)}</b><small>${esc(meta)}</small></span><span class="review-date">${stars(review.rating)}<br>${esc(dateLabel(review.createdAt))}</span></div>
        ${review.status === 'reported' ? '<p class="community-review__notice">Reported · under moderation review</p>' : ''}
        ${review.text ? `<p>${esc(review.text)}</p>` : ''}
      </article>`;
    }).join('');
  }

  async function load(){
    if(loading || !(root.DoloPawsCommunity && root.DoloPawsCommunity.getReviews)) return;
    loading = true;
    status.hidden = false;
    status.textContent = 'Loading approved reviews…';
    list.setAttribute('aria-busy', 'true');
    try{
      const reviews = await Promise.race([
        root.DoloPawsCommunity.getReviews(trailId),
        new Promise((resolve, reject) => setTimeout(() => reject(new Error('review-timeout')), 8000)),
      ]);
      render(reviews);
      status.hidden = true;
    }catch(error){
      list.setAttribute('aria-busy', 'false');
      status.textContent = 'Reviews are unavailable right now. Please check your connection and try again.';
    }finally{
      loading = false;
    }
  }

  function signedIn(){
    return !!(root.DoloPawsAuth && root.DoloPawsAuth.currentUser);
  }

  function openComposer(){
    if(!signedIn()){
      if(root.DoloPawsAuthUI) root.DoloPawsAuthUI.openLogin();
      else status.textContent = 'Log in to write a review.';
      status.hidden = false;
      return;
    }
    composer.hidden = false;
    write.hidden = true;
    picker.querySelector('button').focus();
  }

  function closeComposer(){
    composer.hidden = true;
    write.hidden = false;
    rating = 0;
    body.value = '';
    Array.from(picker.children).forEach(button => {
      button.classList.remove('on');
      button.setAttribute('aria-pressed', 'false');
    });
    sync();
    write.focus();
  }

  function sync(){
    submit.disabled = !rating || !body.value.trim();
  }

  back.href = `trail.html?id=${encodeURIComponent(trailId)}`;
  back.textContent = `← ${trailName}`;
  write.addEventListener('click', openComposer);
  document.getElementById('cancelReview').addEventListener('click', closeComposer);
  picker.addEventListener('click', event => {
    const button = event.target.closest('button');
    if(!button) return;
    rating = Array.from(picker.children).indexOf(button) + 1;
    Array.from(picker.children).forEach((candidate, index) => {
      candidate.classList.toggle('on', index < rating);
      candidate.setAttribute('aria-pressed', index < rating ? 'true' : 'false');
    });
    sync();
  });
  body.addEventListener('input', sync);
  submit.addEventListener('click', async () => {
    if(!(signedIn() && root.DoloPawsCommunity && root.DoloPawsCommunity.setReview)){
      status.textContent = 'Log in to submit a review.';
      status.hidden = false;
      return;
    }
    submit.disabled = true;
    submit.textContent = 'Submitting…';
    const result = await root.DoloPawsCommunity.setReview(trailId, rating, body.value.trim(), null);
    submit.textContent = 'Submit review';
    if(!result.ok){
      status.textContent = result.message || 'Your review could not be submitted. Please try again.';
      status.hidden = false;
      sync();
      return;
    }
    closeComposer();
    await load();
    status.textContent = 'Review submitted for moderation. It will appear here only after approval.';
    status.hidden = false;
  });

  root.addEventListener('dolopaws-auth-ready', load, { once:true });
  root.addEventListener('dolopaws-auth-changed', event => {
    if(!event.detail.user && !composer.hidden) closeComposer();
    load();
  });
  if(root.DoloPawsAuthReady) load();
})(window);
