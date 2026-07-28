/**
 * trail-reports.js — community dog-safety flags on the trail detail page.
 *
 * Renders active flags as banners in a "Trail reports" section, places
 * km-tagged flags as ⚠️ markers on the route map, and provides the
 * "Report something" modal (structured flag types, optional position
 * slider, short note).
 *
 * Product rule this file enforces: community flags display ALONGSIDE the
 * DoloPaws verified safety score — they never alter it. Flags older than
 * 60 days render collapsed and grey ("from last season — unconfirmed"),
 * so stale warnings can't erode trust in fresh ones.
 *
 * Usage: initTrailReports(map, trail) inside trail.js's map 'load'
 * handler. Include this file in trail.html BEFORE trail.js.
 * Data functions live in firebase-init.js (window.DoloPawsCommunity).
 */

const FLAG_TYPES = {
  'guard-dogs-livestock': { icon: '🐑', label: 'Livestock guard dogs on route', severe: true },
  'dangerous-terrain':    { icon: '⚠️', label: 'Terrain dangerous for dogs',    severe: true },
  'not-dog-friendly':     { icon: '🚫', label: 'Not dog-friendly',              severe: true },
  'water-dry':            { icon: '💧', label: 'Water source dry',              severe: false },
  'lift-refused-dog':     { icon: '🚡', label: 'Lift refused a dog',            severe: false },
  'other':                { icon: '📝', label: 'Other',                          severe: false },
};

const STALE_FLAG_DAYS = 60;

function trEsc(s){
  return String(s).replace(/[&<>"']/g,
    c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// One star glyph for every rating UI on the page (rows, average, picker) —
// filled or outlined, sized per context. Replaces the mixed ★/☆ text chars.
function starSvgIcon(filled, size){
  const s = size || 13;
  return filled
    ? `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="flex:none;display:block;"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.5 1.3 6.6L12 18l-5.9 3.1 1.3-6.6L2.5 9.4l6.6-.8z"/></svg>`
    : `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true" style="flex:none;display:block;"><path d="M12 3.6l2.6 5.4 5.9.7-4.4 4 1.2 5.9L12 16.8l-5.3 2.8 1.2-5.9-4.4-4 5.9-.7z"/></svg>`;
}

function initTrailReports(map, trail){
  const listEl = document.getElementById('trailFlagsList');
  const addBtn = document.getElementById('addReportBtn');
  const reviewListEl = document.getElementById('trailReviewsList');
  const addReviewBtn = document.getElementById('addReviewBtn');
  const ratingEl = document.getElementById('communityRating');
  const heroRatingEl = document.getElementById('heroRating');
  const photosListEl = document.getElementById('trailPhotosList');
  let actionStatusTimer = null;

  function showActionStatus(message){
    let status = document.getElementById('trailActionStatus');
    if (!status){
      status = document.createElement('div');
      status.id = 'trailActionStatus';
      status.className = 'dw-toast';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      document.body.appendChild(status);
    }
    if (actionStatusTimer) clearTimeout(actionStatusTimer);
    status.textContent = message;
    status.hidden = false;
    status.className = 'dw-toast dw-toast--in';
    actionStatusTimer = setTimeout(() => {
      status.hidden = true;
      status.className = 'dw-toast';
    }, 4200);
  }
  const addPhotoBtn = document.getElementById('addPhotoBtn');
  if (!listEl || !addBtn) return;

  let flagMarkers = [];

  function flagDate(f){
    // Firestore Timestamp -> Date (guard both shapes and nulls)
    if (f.createdAt && typeof f.createdAt.toDate === 'function') return f.createdAt.toDate();
    return null;
  }

  function reviewDate(review){
    if (review.createdAt && typeof review.createdAt.toDate === 'function') return review.createdAt.toDate();
    return null;
  }

  function renderReviews(reviews){
    const visible = reviews.filter(review => Number(review.rating) >= 1 && Number(review.rating) <= 5)
      .sort((a, b) => {
        const aDate = reviewDate(a), bDate = reviewDate(b);
        return (bDate ? bDate.getTime() : 0) - (aDate ? aDate.getTime() : 0);
      });

    if (ratingEl){
      if (!visible.length){
        ratingEl.hidden = true;
      } else {
        const average = visible.reduce((total, review) => total + Number(review.rating), 0) / visible.length;
        ratingEl.hidden = false;
        ratingEl.innerHTML = `<span class="community-rating__stars" aria-label="${average.toFixed(1)} out of 5 stars">${starSvgIcon(true, 13)}</span><strong>${average.toFixed(1)}</strong><span>${visible.length} ${visible.length === 1 ? 'review' : 'reviews'}</span>`;
      }
    }
    if (heroRatingEl){
      const starSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="flex:none;"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.5 1.3 6.6L12 18l-5.9 3.1 1.3-6.6L2.5 9.4l6.6-.8z"/></svg>';
      heroRatingEl.hidden = false;
      if (!visible.length){
        // Honest zero state in the design's rating slot: invite the first
        // review instead of pretending a score exists.
        heroRatingEl.classList.add('is-empty');
        heroRatingEl.innerHTML = `${starSvg} <span class="cnt">No reviews yet</span>`;
      } else {
        const average = visible.reduce((total, review) => total + Number(review.rating), 0) / visible.length;
        heroRatingEl.classList.remove('is-empty');
        heroRatingEl.innerHTML = `${starSvg} ${average.toFixed(1)} <span class="cnt">· ${visible.length} ${visible.length === 1 ? 'review' : 'reviews'}</span>`;
      }
      // The rating is a shortcut to the reviews section either way.
      heroRatingEl.style.cursor = 'pointer';
      heroRatingEl.onclick = () => {
        const list = document.getElementById('trailReviewsList');
        if (list) list.scrollIntoView({ behavior: 'smooth', block: 'center' });
      };
    }

    if (!reviewListEl) return;
    if (!visible.length){
      reviewListEl.innerHTML = `<div class="empty-state empty-state--compact">
        <p class="empty-state__title">No reviews yet</p>
        <p class="empty-state__copy">Share how the route felt for your dog and what another owner should know.</p>
        <div class="empty-state__actions"><button type="button" class="empty-state__action" data-empty-review>Leave the first review</button></div>
      </div>`;
      const emptyReview = reviewListEl.querySelector('[data-empty-review]');
      if (emptyReview) emptyReview.addEventListener('click', openReviewModal);
      return;
    }

    reviewListEl.innerHTML = visible.slice(0, 3).map(review => {
      const date = reviewDate(review);
      const dateLabel = date ? date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recently';
      const dogName = review.dogContext && review.dogContext.name;
      const reviewer = dogName ? `${trEsc(dogName)}’s human` : 'A DoloPaws member';
      const stars = [1, 2, 3, 4, 5].map(n => starSvgIcon(n <= Number(review.rating), 13)).join('');
      return `<article class="community-review">
        <div class="community-review__rating" aria-label="${review.rating} out of 5 stars">${stars}</div>
        ${review.text ? `<p>${trEsc(review.text)}</p>` : ''}
        <footer>${reviewer} <span>·</span> ${dateLabel}</footer>
      </article>`;
    }).join('');
  }

  function renderPhotos(photos){
    if (!photosListEl) return;
    const visible = photos.filter(photo => typeof photo.image === 'string' && photo.image.startsWith('data:image/'))
      .sort((a, b) => {
        const aDate = reviewDate(a), bDate = reviewDate(b);
        return (bDate ? bDate.getTime() : 0) - (aDate ? aDate.getTime() : 0);
      });
    if (!visible.length){
      photosListEl.innerHTML = `<div class="empty-state empty-state--compact">
        <p class="empty-state__title">No trail photos yet</p>
        <p class="empty-state__copy">Add a recent, useful view so others can recognise the route and conditions.</p>
        <div class="empty-state__actions"><button type="button" class="empty-state__action" data-empty-photo>Add the first photo</button></div>
      </div>`;
      const emptyPhoto = photosListEl.querySelector('[data-empty-photo]');
      if (emptyPhoto) emptyPhoto.addEventListener('click', openPhotoModal);
      return;
    }
    photosListEl.innerHTML = visible.slice(0, 6).map(photo => {
      const dog = photo.dogContext && photo.dogContext.name;
      const caption = photo.caption ? trEsc(photo.caption) : (dog ? `Shared by ${trEsc(dog)}’s human` : 'Shared by the DoloPaws community');
      return `<figure class="community-photo"><img src="${trEsc(photo.image)}" alt="${caption}"><figcaption>${caption}</figcaption></figure>`;
    }).join('');
  }

  function isStale(f){
    const d = flagDate(f);
    return d ? (Date.now() - d.getTime()) > STALE_FLAG_DAYS * 24 * 3600 * 1000 : false;
  }

  function dogContextLine(f){
    const dc = f.dogContext;
    if (!dc || (!dc.name && !dc.breed)) return '';
    const who = [dc.name ? `${dc.name}'s human` : null, dc.breed || null]
      .filter(Boolean).join(' · ');
    return window.t('reports.reportedBy', {who: trEsc(who)});
  }

  function render(flags){
    // Newest first; stale ones sink to the bottom.
    flags.sort((a, b) => {
      if (isStale(a) !== isStale(b)) return isStale(a) ? 1 : -1;
      const da = flagDate(a), db = flagDate(b);
      return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
    });

    const uid = window.DoloPawsAuth && window.DoloPawsAuth.currentUser
      ? window.DoloPawsAuth.currentUser.uid : null;

    if (flags.length === 0){
      listEl.innerHTML = `<div class="empty-state empty-state--compact">
        <p class="empty-state__title">No recent hazard reports</p>
        <p class="empty-state__copy">The community has not reported a current issue here. Conditions can still change, so report anything useful after your walk.</p>
      </div>`;
    } else {
      listEl.innerHTML = flags.map(f => {
        const t = FLAG_TYPES[f.type] || FLAG_TYPES.other;
        const stale = isStale(f);
        const d = flagDate(f);
        const dateStr = d ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
        const kmChip = (typeof f.km === 'number')
          ? `<span style="font-size:11px;font-weight:700;background:rgba(0,0,0,.07);padding:2px 8px;border-radius:10px;margin-left:8px;">km ${f.km}</span>` : '';
        const staleNote = stale
          ? `<div style="font-size:11px;color:var(--ink-soft);margin-top:4px;font-style:italic;">${window.t('reports.stale')}</div>` : '';
        const removeLink = (uid && f.uid === uid)
          ? ` · <a href="#" data-remove="${trEsc(f.id)}" style="color:#9C3A25;">${window.t('reports.remove')}</a>` : '';
        const reportLink = (uid && f.uid !== uid)
          ? ` · <a href="#" data-report="${trEsc(f.id)}" style="color:var(--ink-soft);">${window.t('reports.report')}</a>` : '';
        // Design tile: neutral inset card + a coloured flag square whose tone
        // carries severity, replacing the mixed emoji-per-type language.
        const tile = stale ? { bg: 'var(--sage-dim)', fg: 'var(--ink-soft)' }
          : t.severe ? { bg: '#F3D9D2', fg: '#9C3A25' }
          : { bg: '#F5E4C6', fg: '#8A5A16' };
        const flagSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5 3v18h2v-7h5l1 2h6V6h-5l-1-2H5z"/></svg>';
        return `
        <div style="display:flex;gap:12px;align-items:flex-start;background:#FAF8F1;border:1px solid #EDE9DD;border-radius:12px;padding:12px 14px;margin-bottom:10px;${stale ? 'opacity:.75;' : ''}">
          <span style="flex:none;width:28px;height:28px;border-radius:8px;display:grid;place-items:center;background:${tile.bg};color:${tile.fg};">${flagSvg}</span>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:800;color:var(--ink);font-size:13px;">${window.t('flag.' + f.type)}${kmChip}</div>
            ${f.text ? `<div style="font-size:12.5px;color:var(--ink-soft);line-height:1.5;margin-top:2px;">${trEsc(f.text)}</div>` : ''}
            <div style="font-size:11.5px;color:#8A9689;margin-top:4px;">${dateStr}${dogContextLine(f)}${removeLink}${reportLink}</div>
            ${staleNote}
          </div>
        </div>`;
      }).join('');
    }

    // Remove / report links
    listEl.querySelectorAll('[data-remove]').forEach(a => {
      a.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!confirm(window.t('reports.confirmRemove'))) return;
        await window.DoloPawsCommunity.deleteFlag(a.dataset.remove);
        load();
      });
    });
    listEl.querySelectorAll('[data-report]').forEach(a => {
      a.addEventListener('click', async (e) => {
        e.preventDefault();
        await window.DoloPawsCommunity.reportContent('flag', a.dataset.report, 'inappropriate or inaccurate');
        a.replaceWith(Object.assign(document.createElement('span'), { textContent: window.t('reports.reported') }));
      });
    });

    // Map markers for km-tagged, non-stale flags
    flagMarkers.forEach(m => m.remove());
    flagMarkers = [];
    if (map && Array.isArray(trail.path) && trail.path.length > 1 && typeof pointAtFraction === 'function'){
      flags.filter(f => typeof f.km === 'number' && !isStale(f)).forEach(f => {
        const t = FLAG_TYPES[f.type] || FLAG_TYPES.other;
        const fraction = trail.distance > 0 ? f.km / trail.distance : 0;
        const [lat, lng] = pointAtFraction(trail.path, fraction);
        const el = document.createElement('div');
        el.className = 'dp-marker';
        el.style.background = '#9C3A25';
        el.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="#fff" aria-hidden="true" style="display:block;margin:auto;"><path d="M5 3v18h2v-7h5l1 2h6V6h-5l-1-2H5z"/></svg>';
        const marker = new maplibregl.Marker({ element: el, offset: [0, 0] })
          .setLngLat([lng, lat])
          .setPopup(new maplibregl.Popup({ offset: 16 }).setHTML(
            `<b>${window.t('flag.' + f.type)}</b><br>Km ${f.km}${f.text ? `<br>${trEsc(f.text)}` : ''}<br><small>${window.t('reports.community')}</small>`))
          .addTo(map);
        flagMarkers.push(marker);
      });
    }
  }

  async function load(){
    if (!window.DoloPawsCommunity || !window.DoloPawsCommunity.getActiveFlags) return;
    const [flags, reviews, photos] = await Promise.all([
      window.DoloPawsCommunity.getActiveFlags(trail.id),
      window.DoloPawsCommunity.getReviews ? window.DoloPawsCommunity.getReviews(trail.id) : Promise.resolve([]),
      window.DoloPawsCommunity.getTrailPhotos ? window.DoloPawsCommunity.getTrailPhotos(trail.id) : Promise.resolve([]),
    ]);
    if (Array.isArray(flags)) render(flags);
    renderReviews(Array.isArray(reviews) ? reviews : []);
    renderPhotos(Array.isArray(photos) ? photos : []);
  }

  function downscaleTrailPhoto(file){
    return new Promise((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(file);
      image.onload = () => {
        try {
          const scale = Math.min(1, 900 / Math.max(image.width, image.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL('image/jpeg', 0.78));
        } catch (error) { URL.revokeObjectURL(url); reject(error); }
      };
      image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')); };
      image.src = url;
    });
  }

  function confirmDiscard(dirty){
    return !dirty || window.confirm(window.t('form.discard'));
  }

  function enableModalKeyboard(overlay, onEscape, initialFocus, returnFocus){
    const title = overlay.querySelector('h2');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    if (title){
      title.id = 'trailModalTitle-' + Math.random().toString(36).slice(2, 8);
      overlay.setAttribute('aria-labelledby', title.id);
    }
    const focusableSelector = 'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
    const onKeydown = event => {
      if (event.key === 'Escape'){
        event.preventDefault();
        onEscape();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(overlay.querySelectorAll(focusableSelector)).filter(el => !el.hidden);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first){
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last){
        event.preventDefault();
        first.focus();
      }
    };
    overlay.addEventListener('keydown', onKeydown);
    setTimeout(() => {
      const target = overlay.querySelector(initialFocus) || overlay.querySelector(focusableSelector);
      if (target) target.focus();
    }, 0);
    return () => {
      overlay.removeEventListener('keydown', onKeydown);
      if (returnFocus && document.contains(returnFocus)) returnFocus.focus();
    };
  }

  function openPhotoModal(){
    if (!(window.DoloPawsAuth && window.DoloPawsAuth.currentUser)){
      if (window.DoloPawsTrailAction) window.DoloPawsTrailAction.request('photo');
      return;
    }
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `<div class="modal" style="max-width:420px;">
      <button type="button" class="modal-close" data-close aria-label="Close"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      <h2 style="font-size:19px;">Add a trail photo</h2>
      <p class="hint">Share a recent, useful view of this trail. Photos appear with the community reviews.</p>
      <input data-photo type="file" accept="image/*" style="font-size:13px;margin:8px 0 12px;">
      <textarea data-caption maxlength="240" rows="3" placeholder="Add a short caption (optional)" style="width:100%;box-sizing:border-box;padding:10px;border:1.5px solid var(--paper-line);border-radius:10px;font-family:'Inter',sans-serif;font-size:13px;resize:vertical;"></textarea>
      <div data-err role="alert" style="color:#9C3A25;font-size:12.5px;margin-top:8px;" hidden></div>
      <button type="button" data-submit class="auth-submit" style="margin-top:12px;">Add photo</button>
    </div>`;
    document.body.appendChild(overlay);
    let dirty = false;
    const warnBeforeUnload = event => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    overlay.querySelector('[data-photo]').addEventListener('change', () => { dirty = true; });
    overlay.querySelector('[data-caption]').addEventListener('input', () => { dirty = true; });
    let cleanupKeyboard = () => {};
    const close = force => {
      if (force !== true && !confirmDiscard(dirty)) return;
      window.removeEventListener('beforeunload', warnBeforeUnload);
      cleanupKeyboard();
      overlay.remove();
    };
    cleanupKeyboard = enableModalKeyboard(overlay, () => close(false), '[data-photo]', addPhotoBtn);
    overlay.querySelector('[data-close]').addEventListener('click', () => close(false));
    overlay.addEventListener('click', event => { if (event.target === overlay) close(false); });
    overlay.querySelector('[data-submit]').addEventListener('click', async () => {
      const error = overlay.querySelector('[data-err]');
      const file = overlay.querySelector('[data-photo]').files[0];
      if (!file || !file.type.startsWith('image/') || file.size > 10 * 1024 * 1024){
        error.textContent = 'Choose an image smaller than 10 MB.';
        error.hidden = false;
        return;
      }
      const submit = overlay.querySelector('[data-submit]');
      submit.disabled = true;
      submit.textContent = 'Adding…';
      try {
        const image = await downscaleTrailPhoto(file);
        const result = await window.DoloPawsCommunity.addTrailPhoto(trail.id, image, overlay.querySelector('[data-caption]').value.trim());
        if (result.ok){
          close(true);
          await load();
          showActionStatus('Photo submitted for review. It will appear after approval.');
          return;
        }
        error.textContent = result.message || 'Could not add this photo — please try again.';
      } catch (e) { error.textContent = 'Could not prepare this photo — please try another image.'; }
      error.hidden = false;
      submit.disabled = false;
      submit.textContent = 'Add photo';
    });
  }

  // ---- "Leave a review" modal --------------------------------------------
  function openReviewModal(){
    if (!(window.DoloPawsAuth && window.DoloPawsAuth.currentUser)){
      if (window.DoloPawsTrailAction) window.DoloPawsTrailAction.request('review');
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="max-width:420px;">
        <button type="button" class="modal-close" data-close aria-label="Close"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
        <h2 style="font-size:19px;">Rate this trail</h2>
        <p class="hint">Your review helps other dogs and their humans choose the right walk.</p>
        <div data-stars class="review-star-picker" aria-label="Choose a rating">
          ${[1, 2, 3, 4, 5].map(value => `<button type="button" role="radio" aria-checked="false" data-rating="${value}" aria-label="${value} star${value === 1 ? '' : 's'}">${starSvgIcon(false, 24)}</button>`).join('')}
        </div>
        <textarea data-text maxlength="1000" rows="4" placeholder="What should other dog owners know? (optional)" style="width:100%;box-sizing:border-box;padding:10px;border:1.5px solid var(--paper-line);border-radius:10px;font-family:'Inter',sans-serif;font-size:13px;resize:vertical;"></textarea>
        <div data-err role="alert" style="color:#9C3A25;font-size:12.5px;margin-top:8px;" hidden></div>
        <button type="button" data-submit class="auth-submit" style="margin-top:12px;">Post review</button>
      </div>`;
    document.body.appendChild(overlay);

    let selectedRating = 0;
    let dirty = false;
    const warnBeforeUnload = event => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    const starButtons = Array.from(overlay.querySelectorAll('[data-rating]'));
    starButtons.forEach(button => {
      button.addEventListener('click', () => {
        dirty = true;
        selectedRating = Number(button.dataset.rating);
        starButtons.forEach(star => {
          const active = Number(star.dataset.rating) <= selectedRating;
          star.innerHTML = starSvgIcon(active, 24);
          star.classList.toggle('is-selected', active);
          star.setAttribute('aria-checked', Number(star.dataset.rating) === selectedRating ? 'true' : 'false');
        });
      });
    });
    overlay.querySelector('[data-text]').addEventListener('input', () => { dirty = true; });

    let cleanupKeyboard = () => {};
    function close(force){
      if (force !== true && !confirmDiscard(dirty)) return;
      window.removeEventListener('beforeunload', warnBeforeUnload);
      cleanupKeyboard();
      overlay.remove();
    }
    cleanupKeyboard = enableModalKeyboard(overlay, () => close(false), '[data-rating]', addReviewBtn);
    overlay.querySelector('[data-close]').addEventListener('click', () => close(false));
    overlay.addEventListener('click', event => { if (event.target === overlay) close(false); });
    overlay.querySelector('[data-submit]').addEventListener('click', async () => {
      const error = overlay.querySelector('[data-err]');
      if (!selectedRating){
        error.textContent = 'Please choose a star rating.';
        error.hidden = false;
        return;
      }
      const submit = overlay.querySelector('[data-submit]');
      submit.disabled = true;
      submit.textContent = 'Posting…';
      try {
        const result = await window.DoloPawsCommunity.setReview(
          trail.id,
          selectedRating,
          overlay.querySelector('[data-text]').value.trim(),
          null,
        );
        if (result.ok){
          close(true);
          await load();
          showActionStatus('Review submitted for moderation. It will appear after approval.');
          return;
        }
        error.textContent = result.message || 'Could not post your review — please try again.';
      } catch (e) {
        error.textContent = 'Could not post your review — please try again.';
      }
      error.hidden = false;
      submit.disabled = false;
      submit.textContent = 'Post review';
    });
  }

  // ---- "Report something" modal --------------------------------------------
  function openReportModal(){
    if (!(window.DoloPawsAuth && window.DoloPawsAuth.currentUser)){
      if (window.DoloPawsTrailAction) window.DoloPawsTrailAction.request('report');
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const maxKm = trail.distance || 10;
    overlay.innerHTML = `
      <div class="modal" style="max-width:420px;">
        <button type="button" class="modal-close" data-close aria-label="Close"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
        <h2 style="font-size:19px;">${window.t('reports.modalTitle')}</h2>
        <p class="hint">${window.t('reports.modalHint')}</p>
        <div data-types style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:14px 0;">
          ${Object.entries(FLAG_TYPES).map(([key, t]) => `
            <button type="button" aria-pressed="false" data-type="${key}" style="padding:10px 8px;border-radius:10px;border:1.5px solid var(--paper-line);background:none;font-size:12px;font-weight:600;color:var(--ink);cursor:pointer;text-align:left;font-family:'Inter',sans-serif;">${window.t('flag.' + key)}</button>`).join('')}
        </div>
        <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--ink);margin-bottom:6px;">
          <input type="checkbox" data-haskm> ${window.t('reports.knowWhere')}
        </label>
        <div data-kmrow hidden style="margin-bottom:12px;">
          <input type="range" data-km min="0" max="${maxKm}" step="0.1" value="0" style="width:100%;">
          <div style="font-size:12px;color:var(--ink-soft);text-align:center;">${window.t('reports.atKm', {max: maxKm})}</div>
        </div>
        <textarea data-text maxlength="300" rows="3" placeholder="${window.t('reports.placeholder')}" style="width:100%;box-sizing:border-box;padding:10px;border:1.5px solid var(--paper-line);border-radius:10px;font-family:'Inter',sans-serif;font-size:13px;resize:vertical;"></textarea>
        <div data-err role="alert" style="color:#9C3A25;font-size:12.5px;margin-top:8px;" hidden></div>
        <button type="button" data-submit class="auth-submit" style="margin-top:12px;">${window.t('reports.post')}</button>
      </div>`;
    document.body.appendChild(overlay);

    let selectedType = null;
    let dirty = false;
    const warnBeforeUnload = event => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    overlay.querySelectorAll('[data-type]').forEach(btn => {
      btn.addEventListener('click', () => {
        dirty = true;
        selectedType = btn.dataset.type;
        overlay.querySelectorAll('[data-type]').forEach(b => {
          b.style.background = 'none'; b.style.borderColor = 'var(--paper-line)'; b.style.color = 'var(--ink)';
          b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
        });
        btn.style.background = 'var(--ink)'; btn.style.borderColor = 'var(--ink)'; btn.style.color = '#fff';
      });
    });

    const hasKm = overlay.querySelector('[data-haskm]');
    const kmRow = overlay.querySelector('[data-kmrow]');
    const kmInput = overlay.querySelector('[data-km]');
    const kmVal = overlay.querySelector('[data-kmval]');
    hasKm.addEventListener('change', () => { dirty = true; kmRow.hidden = !hasKm.checked; });
    kmInput.addEventListener('input', () => { dirty = true; if (kmVal) kmVal.textContent = kmInput.value; });
    overlay.querySelector('[data-text]').addEventListener('input', () => { dirty = true; });

    let cleanupKeyboard = () => {};
    function close(force){
      if (force !== true && !confirmDiscard(dirty)) return;
      window.removeEventListener('beforeunload', warnBeforeUnload);
      cleanupKeyboard();
      overlay.remove();
    }
    cleanupKeyboard = enableModalKeyboard(overlay, () => close(false), '[data-type]', addBtn);
    overlay.querySelector('[data-close]').addEventListener('click', () => close(false));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });

    overlay.querySelector('[data-submit]').addEventListener('click', async () => {
      const err = overlay.querySelector('[data-err]');
      if (!selectedType){
        err.textContent = window.t('reports.pickType'); err.hidden = false; return;
      }
      const km = hasKm.checked ? Math.round(parseFloat(kmInput.value) * 10) / 10 : null;
      const text = overlay.querySelector('[data-text]').value.trim();
      const submitBtn = overlay.querySelector('[data-submit]');
      submitBtn.disabled = true; submitBtn.textContent = window.t('reports.posting');
      try {
        const res = await window.DoloPawsCommunity.addFlag(trail.id, selectedType, km, text);
        if (res.ok){
          close(true);
          await load();
          showActionStatus('Hazard report submitted for moderation.');
          return;
        }
        err.textContent = res.message || window.t('reports.error');
      } catch (e) {
        err.textContent = window.t('reports.error');
      }
      err.hidden = false;
      submitBtn.disabled = false; submitBtn.textContent = window.t('reports.post');
    });
  }

  addBtn.addEventListener('click', openReportModal);
  if (addReviewBtn) addReviewBtn.addEventListener('click', openReviewModal);
  if (addPhotoBtn) addPhotoBtn.addEventListener('click', openPhotoModal);

  let resumedAction = false;
  function resumePendingAction(user){
    if(resumedAction || !user || !window.DoloPawsTrailAction) return;
    const action = window.DoloPawsTrailAction.pending;
    const open = action === 'review' ? openReviewModal
      : action === 'photo' ? openPhotoModal
      : action === 'report' ? openReportModal
      : null;
    if(!open || !window.DoloPawsTrailAction.consume(action)) return;
    resumedAction = true;
    const targetTab = action === 'report' ? 'tabSafety' : 'tabReviews';
    const tabButton = document.querySelector(`[data-tab="${targetTab}"]`);
    if(tabButton) tabButton.click();
    open();
  }

  // Re-render on login/logout so Remove links appear/disappear, and resume
  // the exact community action that initiated an authentication detour.
  window.addEventListener('dolopaws-auth-changed', event => {
    load();
    resumePendingAction(event.detail.user);
  });

  if (window.DoloPawsCommunity) load();
  else window.addEventListener('dolopaws-auth-ready', load, { once: true });
  if(window.DoloPawsAuth) resumePendingAction(window.DoloPawsAuth.currentUser);
}
