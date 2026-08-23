(function () {
  'use strict';

  const personal = {
    kicker: document.querySelector('[data-paw-personal-kicker]'),
    title: document.querySelector('[data-paw-personal-title]'),
    intro: document.querySelector('[data-paw-personal-intro]'),
    cta: document.querySelector('[data-paw-personal-cta]'),
    list: document.querySelector('[data-paw-personal-list]'),
  };

  function note(number, title, copy) {
    const article = document.createElement('article');
    article.className = 'paw2-personal-note';
    const index = document.createElement('b');
    index.setAttribute('aria-hidden', 'true');
    index.textContent = String(number).padStart(2, '0');
    const heading = document.createElement('strong');
    heading.textContent = title;
    const body = document.createElement('span');
    body.textContent = copy;
    article.append(index, heading, body);
    return article;
  }

  function replaceNotes(notes) {
    if (!personal.list) return;
    personal.list.replaceChildren(...notes.slice(0, 3).map((item, index) => note(index + 1, item.title, item.copy)));
  }

  function renderGuest() {
    if (!personal.title) return;
    personal.kicker.textContent = 'Advice for your dog';
    personal.title.textContent = 'Make this advice about your dog';
    personal.intro.textContent = 'Add your dog to combine breed, build, age, coat and conditioning—without assuming every dog of one breed has the same paws.';
    personal.cta.textContent = 'Add your dog — 2 minutes';
    personal.cta.href = '/?wizard=1';
    replaceNotes([
      { title:'Breed & build', copy:'Changes the load, stride and effort your dog brings to limestone.' },
      { title:'Coat & snow', copy:'Long paw hair can collect ice and hide grit between the toes.' },
      { title:'Age & conditioning', copy:'Recent experience on the surface matters more than distance on easy ground.' },
    ]);
  }

  function profileTraits(profile) {
    if (typeof window.breedTraits !== 'function') return {};
    return window.breedTraits(profile.breed || '') || {};
  }

  function personalisedNotes(profile) {
    const traits = profileTraits(profile);
    const sens = Array.isArray(profile.sens) ? profile.sens : [];
    const conditions = Array.isArray(profile.conditions) ? profile.conditions : [];
    const coat = String(profile.coat || '').toLowerCase();
    const notes = [];

    if (sens.includes('paws')) {
      notes.push({ title:'Sensitive paws: check sooner', copy:'Use the first rough or warm section as the test. Do not wait for visible damage before turning back.' });
    }

    if (coat === 'long' || coat === 'curly') {
      notes.push({ title:'Snow can hide between the toes', copy:'Long or curly paw hair holds packed snow and grit. Check between every toe, not only the pad surface.' });
    }

    if (traits.brachy || traits.thickCoat || sens.includes('heat') || conditions.includes('heat')) {
      notes.push({ title:'Hot ground is not the only limit', copy:'This profile can struggle with heat before the pads look sore. Choose a cooler window and keep the whole dog in view.' });
    }

    const heavy = traits.giant || ['30-40', '40-55', '55plus'].includes(profile.weightBand) || ['Large', 'Extra large'].includes(profile.size);
    if (heavy) {
      notes.push({ title:'Check early on limestone descents', copy:'A heavier build adds repeated load on hard, angular ground. Shorten the first outing and inspect pad rims early.' });
    } else if (traits.shortLegged || profile.weightBand === 'u5' || profile.size === 'Small') {
      notes.push({ title:'More steps across rough ground', copy:'A smaller or short-legged dog takes more steps over the same distance. Keep the first limestone outing short.' });
    }

    const youngOrSenior = profile.ageBand === 'u1' || ['9-10', '11-12', '13plus'].includes(profile.ageBand);
    if (profile.fitness === 'low' || youngOrSenior || conditions.includes('joints') || conditions.includes('back')) {
      notes.push({ title:'Build surface time gradually', copy:'Age, mobility or current conditioning makes a short rehearsal more useful than relying on ordinary walking distance.' });
    } else if (profile.fitness === 'high') {
      notes.push({ title:'Fitness does not equal tough pads', copy:'Mountain fitness helps stamina, but pads adapt to recent surfaces. Reintroduce limestone after time away.' });
    } else {
      notes.push({ title:'Condition for the actual surface', copy:'Everyday walks do not prove snow or limestone readiness. Add one new surface or distance increase at a time.' });
    }

    if (notes.length < 3) {
      notes.push({ title:'Today’s paws override the profile', copy:'Dryness, a recent split or tenderness matters more than breed. Check what is in front of you before leaving.' });
    }

    if (notes.length < 3) {
      notes.push({ title:'No breed shortcut', copy:'The universal rules still lead: test heat, remove snow, start limestone short and recheck after the walk.' });
    }

    return notes;
  }

  function renderProfile(profile, saved) {
    if (!personal.title || !profile || !profile.name) return renderGuest();
    const name = String(profile.name).slice(0, 40);
    const breed = profile.breed ? String(profile.breed).slice(0, 100) : 'individual profile';
    personal.kicker.textContent = 'Personalised paw guidance';
    personal.title.textContent = `For ${name}’s paws`;
    personal.intro.textContent = `The universal rules still apply. These notes use ${name}’s ${breed}, build, age, coat and conditioning where the profile provides them.`;
    personal.cta.textContent = saved ? `Update ${name}’s profile` : `Complete ${name}’s profile`;
    personal.cta.href = saved ? '../account.html?next=%2Fguides%2Fpaw-protection.html' : '/?wizard=1';
    replaceNotes(personalisedNotes(profile));
  }

  function storedJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); }
    catch (error) { return null; }
  }

  function cachedProfile() {
    const summary = storedJson('dolopaws-profile-summary');
    if (!summary || typeof summary !== 'object') return null;
    if (Array.isArray(summary.dogs) && summary.dogs.length) {
      return summary.dogs.find((dog) => dog.id === summary.activeDogId) || summary.dogs[0];
    }
    return summary.name ? summary : null;
  }

  function renderStoredState() {
    const cached = cachedProfile();
    if (cached) return renderProfile(cached, true);
    const draft = storedJson('dolopaws-pending-dog-profile');
    if (draft && draft.name) return renderProfile(draft, false);
    renderGuest();
  }

  async function hydrateProfile() {
    if (!window.DoloPawsAuth || !window.DoloPawsAuth.currentUser || typeof window.DoloPawsAuth.getDogProfile !== 'function') return;
    try {
      const profile = await window.DoloPawsAuth.getDogProfile();
      if (profile) renderProfile(profile, true);
    } catch (error) { /* cached guidance remains available */ }
  }

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', () => {
      const target = document.querySelector(link.getAttribute('href'));
      if (target && target.tagName === 'DETAILS') target.open = true;
    });
  });

  function openLinkedDetail() {
    if (!window.location.hash) return;
    const target = document.querySelector(window.location.hash);
    if (target && target.tagName === 'DETAILS') target.open = true;
  }

  renderStoredState();
  if (window.DoloPawsAuthReady) hydrateProfile();
  else window.addEventListener('dolopaws-auth-ready', hydrateProfile, { once:true });
  window.addEventListener('dolopaws-profile-summary-changed', renderStoredState);
  window.addEventListener('dolopaws-dog-profile-saved', (event) => {
    const profile = event.detail && event.detail.profile;
    if (profile) renderProfile(profile, true);
    else hydrateProfile();
  });
  window.addEventListener('hashchange', openLinkedDetail);
  openLinkedDetail();
})();
