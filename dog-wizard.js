(function () {
  'use strict';

  var OTHER_VALUE = '__other__';
  var DRAFT_KEY_PREFIX = 'dolopaws-dog-draft';

  var STEPS = [
    { id: 'basics', label: 'Basics' },
    { id: 'breed',  label: 'Breed & Size' },
    { id: 'health', label: 'Health' },
    { id: 'review', label: 'Review' },
  ];

  // ---- State ----
  var stepIndex = 0;
  var isEditing = false;
  var isDirty   = false;
  var phase     = 'form'; // 'draft-prompt' | 'form' | 'close-confirm'
  var data      = makeEmptyData();

  // ---- DOM ----
  var overlay   = document.getElementById('dogWizard');
  var titleEl   = document.getElementById('dwTitle');
  var subtitleEl= document.getElementById('dwSubtitle');
  var stepperEl = document.getElementById('dwStepper');
  var bodyEl    = document.getElementById('dwBody');
  var footerEl  = document.getElementById('dwFooter');
  var backBtn   = document.getElementById('dwBackBtn');
  var nextBtn   = document.getElementById('dwNextBtn');
  var closeBtn  = document.getElementById('dwCloseBtn');
  var toastEl   = document.getElementById('dwToast');

  // Pages without the wizard markup: register a no-op API and bail
  // instead of crashing on the missing elements.
  if (!overlay || !nextBtn || !backBtn || !closeBtn) {
    window.DoloPawsWizard = { open: function () {} };
    return;
  }

  // ---- Helpers ----
  // Data model matches the account page and scoring.js exactly:
  // ageBand / weightBand / structured conditions drive the match score.
  function makeEmptyData() {
    return {
      name: '', ageBand: '',
      breed: '', breedOther: '', weightBand: '', fitness: '',
      conditions: [], healthNotes: '', photo: null,
    };
  }

  function isDogPhoto(value) {
    return typeof value === 'string' && value.startsWith('data:image/');
  }

  function downscaleDogPhoto(file) {
    return new Promise(function (resolve, reject) {
      var image = new Image();
      var url = URL.createObjectURL(file);
      image.onload = function () {
        try {
          var scale = Math.min(1, 300 / Math.max(image.width, image.height));
          var canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } catch (error) {
          URL.revokeObjectURL(url);
          reject(error);
        }
      };
      image.onerror = function () { URL.revokeObjectURL(url); reject(new Error('decode failed')); };
      image.src = url;
    });
  }

  var AGE_BANDS = [
    ['u1', 'Under 1 year (puppy)'], ['1-2', '1–2 years'],
    ['3-4', '3–4 years'], ['5-6', '5–6 years'],
    ['7-8', '7–8 years'], ['9-10', '9–10 years'],
    ['11-12', '11–12 years'], ['13plus', '13 years or older'],
  ];
  var WEIGHT_BANDS = [
    ['u5', 'Under 5 kg'], ['5-10', '5–10 kg'], ['10-15', '10–15 kg'],
    ['15-20', '15–20 kg'], ['20-30', '20–30 kg'], ['30-40', '30–40 kg'],
    ['40-55', '40–55 kg'], ['55plus', 'Over 55 kg'],
  ];
  var CONDITION_OPTIONS = [
    ['joints', 'Joint or mobility issues (hip or elbow dysplasia, arthritis, luxating patella)'],
    ['back', 'Back or disc problems (e.g. IVDD)'],
    ['heat', 'Heat sensitivity or breathing difficulty (incl. flat-nosed breeds)'],
    ['cardiac', 'Heart condition'],
    ['recovering', 'Recovering from injury or surgery'],
    ['vision', 'Impaired vision or hearing'],
    ['overweight', 'Overweight'],
  ];
  var CONDITION_LABELS = {
    joints: 'Joint or mobility issues', back: 'Back or disc problems',
    heat: 'Heat sensitivity / breathing', cardiac: 'Heart condition',
    recovering: 'Recovering from injury or surgery', vision: 'Impaired vision or hearing',
    overweight: 'Overweight',
  };

  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ---- Draft persistence ----
  function getDraftKey() {
    var uid = window.DoloPawsAuth &&
              window.DoloPawsAuth.currentUser &&
              window.DoloPawsAuth.currentUser.uid;
    return uid ? DRAFT_KEY_PREFIX + '-' + uid : DRAFT_KEY_PREFIX;
  }

  function saveDraft() {
    try {
      localStorage.setItem(getDraftKey(), JSON.stringify({
        data: data, step: stepIndex, ts: Date.now()
      }));
    } catch (e) {}
  }

  function loadDraft() {
    try {
      var raw = localStorage.getItem(getDraftKey());
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.data !== 'object') return null;
      // Expire after 7 days
      if (Date.now() - (parsed.ts || 0) > 7 * 86400 * 1000) {
        clearDraft();
        return null;
      }
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function clearDraft() {
    try { localStorage.removeItem(getDraftKey()); } catch (e) {}
  }

  // ---- Focus management ----
  var preFocusEl = null;

  function getFocusable() {
    return Array.from(overlay.querySelectorAll(
      'a[href],button:not([disabled]),input:not([disabled]),' +
      'select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
    )).filter(function (el) { return !el.closest('[hidden]') && el.offsetParent !== null; });
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      requestClose();
      return;
    }
    if (e.key !== 'Tab') return;
    var focusable = getFocusable();
    if (!focusable.length) return;
    var first = focusable[0];
    var last  = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { last.focus(); e.preventDefault(); }
    } else {
      if (document.activeElement === last)  { first.focus(); e.preventDefault(); }
    }
  }

  // ---- Render ----
  function render() {
    renderStepper();
    renderBody();
    renderFooter();
  }

  function renderStepper() {
    // Mobile app chrome (Dog Profile Setup design): thin progress bar +
    // "Step X of Y" label. The elements only display at phone widths.
    var progressEl = document.getElementById('dwProgress');
    var stepCountEl = document.getElementById('dwStepCount');
    if (phase !== 'form') {
      stepperEl.hidden = true;
      if (progressEl) progressEl.hidden = true;
      if (stepCountEl) stepCountEl.hidden = true;
      return;
    }
    if (progressEl) {
      progressEl.hidden = false;
      var fill = progressEl.firstElementChild;
      if (fill) fill.style.width = Math.round(((stepIndex + 1) / STEPS.length) * 100) + '%';
    }
    if (stepCountEl) {
      stepCountEl.hidden = false;
      stepCountEl.textContent = 'Step ' + (stepIndex + 1) + ' of ' + STEPS.length;
    }
    stepperEl.hidden = false;
    stepperEl.innerHTML = STEPS.map(function (s, i) {
      var cls = i < stepIndex ? 'done' : (i === stepIndex ? 'active' : '');
      var dot = i < stepIndex ? '&#10003;' : (i + 1);
      var ariaCurrent = i === stepIndex ? 'step' : 'false';
      var connector = i < STEPS.length - 1
        ? '<div class="dw-connector" aria-hidden="true"></div>'
        : '';
      return '<div class="dw-step ' + cls + '" role="listitem" aria-current="' + ariaCurrent + '">' +
               '<div class="dw-step-dot" aria-hidden="true">' + dot + '</div>' +
               '<span class="dw-step-label">' + esc(s.label) + '</span>' +
             '</div>' + connector;
    }).join('');
  }

  function renderFooter() {
    if (phase !== 'form') {
      footerEl.hidden = true;
      return;
    }
    footerEl.hidden = false;
    // Desktop keeps the invisible-but-present Back so "Next" stays pinned
    // right; the phone layout collapses it entirely (see .dw-back-none).
    backBtn.style.visibility = stepIndex === 0 ? 'hidden' : 'visible';
    backBtn.classList.toggle('dw-back-none', stepIndex === 0);
    var isLast = stepIndex === STEPS.length - 1;
    var isGuest = !(window.DoloPawsAuth && window.DoloPawsAuth.currentUser);
    if (isLast) {
      nextBtn.textContent = isEditing ? 'Save changes'
        : (isGuest ? 'See ' + (data.name.trim() || 'my dog') + '\u2019s matches \u2192' : 'Save dog');
    } else {
      nextBtn.textContent = 'Next \u2192';
    }
    nextBtn.disabled = false;
  }

  function renderBody() {
    bodyEl.innerHTML = '';
    if (phase === 'draft-prompt') {
      renderDraftPrompt();
    } else if (phase === 'close-confirm') {
      renderCloseConfirm();
    } else if (phase === 'payoff') {
      renderPayoff();
    } else {
      renderFormStep();
    }
    bodyEl.scrollTop = 0;
  }

  // ---- Draft prompt view ----
  function renderDraftPrompt() {
    var draft = loadDraft();
    var dogName = draft && draft.data && draft.data.name
      ? ' for ' + esc(draft.data.name)
      : '';
    titleEl.textContent = 'Resume your draft?';
    subtitleEl.textContent = '';
    bodyEl.innerHTML =
      '<div class="dw-info-panel">' +
        '<div class="dw-info-icon" aria-hidden="true">&#128221;</div>' +
        '<p class="dw-info-text">You have an unfinished profile' + dogName + '. ' +
          'Pick up where you left off or start fresh.</p>' +
        '<div class="dw-info-actions">' +
          '<button class="dw-btn-primary" id="dwResumeDraftBtn">Resume draft</button>' +
          '<button class="dw-btn-ghost" id="dwStartOverBtn">Start over</button>' +
        '</div>' +
      '</div>';
    document.getElementById('dwResumeDraftBtn').addEventListener('click', resumeDraft);
    document.getElementById('dwStartOverBtn').addEventListener('click', startFresh);
  }

  function resumeDraft() {
    var draft = loadDraft();
    if (draft) {
      data      = Object.assign(makeEmptyData(), draft.data);
      if (!Array.isArray(data.conditions)) data.conditions = [];
      stepIndex = Math.min(draft.step || 0, STEPS.length - 1);
    }
    setFormTitle();
    phase    = 'form';
    isDirty  = false;
    render();
    focusFirstIn(bodyEl);
  }

  function startFresh() {
    clearDraft();
    data      = makeEmptyData();
    stepIndex = 0;
    setFormTitle();
    phase    = 'form';
    isDirty  = false;
    render();
    focusFirstIn(bodyEl);
  }

  // ---- Close-confirm view ----
  function renderCloseConfirm() {
    titleEl.textContent = 'Save your progress?';
    subtitleEl.textContent = '';
    bodyEl.innerHTML =
      '<div class="dw-info-panel">' +
        '<div class="dw-info-icon" aria-hidden="true">&#128190;</div>' +
        '<p class="dw-info-text">You haven\'t finished adding your dog. ' +
          'Save a draft to continue later, or discard your changes.</p>' +
        '<div class="dw-info-actions">' +
          '<button class="dw-btn-primary" id="dwSaveDraftBtn">Save draft</button>' +
          '<button class="dw-btn-ghost" id="dwDiscardCloseBtn">Discard &amp; close</button>' +
        '</div>' +
        '<button class="dw-keep-link" id="dwKeepEditingBtn">&#8592; Keep editing</button>' +
      '</div>';
    document.getElementById('dwSaveDraftBtn').addEventListener('click', function () {
      saveDraft();
      doClose();
    });
    document.getElementById('dwDiscardCloseBtn').addEventListener('click', function () {
      clearDraft();
      doClose();
    });
    document.getElementById('dwKeepEditingBtn').addEventListener('click', function () {
      setFormTitle();
      phase = 'form';
      render();
      focusFirstIn(bodyEl);
    });
  }

  // ---- Form steps ----
  function renderFormStep() {
    var step = STEPS[stepIndex];
    if (step.id === 'basics')  renderBasicsStep();
    else if (step.id === 'breed')  renderBreedStep();
    else if (step.id === 'health') renderHealthStep();
    else if (step.id === 'review') renderReviewStep();
  }

  function renderBasicsStep() {
    var ageOpts = '<option value="">Select an age\u2026</option>' +
      AGE_BANDS.map(function (b) {
        return '<option value="' + b[0] + '"' + (data.ageBand === b[0] ? ' selected' : '') + '>' + b[1] + '</option>';
      }).join('');

    bodyEl.innerHTML =
      '<div class="dw-field-group">' +
        '<label class="dw-label" for="dwName">' +
          'Dog name <span class="dw-required" aria-label="required">*</span>' +
        '</label>' +
        '<input type="text" class="dw-input" id="dwName" placeholder="e.g. Eddie"' +
               ' value="' + esc(data.name) + '" maxlength="40" autocomplete="off"' +
               ' aria-required="true" aria-describedby="dwNameErr">' +
        '<span class="dw-field-error" id="dwNameErr" role="alert" hidden>' +
          'Please enter your dog\'s name (2\u201340 characters).' +
        '</span>' +
      '</div>' +
      '<div class="dw-field-group">' +
        '<label class="dw-label" for="dwAgeBand">' +
          'Age <span class="dw-required" aria-label="required">*</span>' +
        '</label>' +
        '<select class="dw-select" id="dwAgeBand" aria-required="true" aria-describedby="dwAgeErr">' +
          ageOpts +
        '</select>' +
        '<span class="dw-field-error" id="dwAgeErr" role="alert" hidden>' +
          'Please select an age range.' +
        '</span>' +
      '</div>' +
      '<div class="dw-field-group">' +
        '<span class="dw-label">Photo <span class="dw-optional">(optional)</span></span>' +
        '<div class="dw-photo-picker">' +
          '<div class="dw-photo-preview" id="dwPhotoPreview" aria-hidden="true"></div>' +
          '<div class="dw-photo-actions">' +
            '<button type="button" class="dw-btn-ghost" id="dwPhotoBtn">' +
              (isDogPhoto(data.photo) ? 'Change photo' : 'Add photo') +
            '</button>' +
            '<button type="button" class="dw-photo-remove" id="dwPhotoRemove"' +
              (isDogPhoto(data.photo) ? '' : ' hidden') + '>Remove</button>' +
            '<span class="dw-photo-help" id="dwPhotoHelp">JPG, PNG or WebP · maximum 8 MB</span>' +
          '</div>' +
        '</div>' +
        '<input type="file" id="dwPhotoInput" accept="image/jpeg,image/png,image/webp" hidden>' +
      '</div>';

    var nameInput = document.getElementById('dwName');
    nameInput.addEventListener('input', function () {
      data.name = nameInput.value;
      isDirty   = true;
      document.getElementById('dwNameErr').hidden = true;
    });
    var ageSelect = document.getElementById('dwAgeBand');
    ageSelect.addEventListener('change', function () {
      data.ageBand = ageSelect.value;
      isDirty      = true;
      document.getElementById('dwAgeErr').hidden = true;
    });

    var photoInput = document.getElementById('dwPhotoInput');
    var photoButton = document.getElementById('dwPhotoBtn');
    var photoRemove = document.getElementById('dwPhotoRemove');
    var photoPreview = document.getElementById('dwPhotoPreview');
    var photoHelp = document.getElementById('dwPhotoHelp');
    function paintPhoto() {
      if (isDogPhoto(data.photo)) {
        photoPreview.style.backgroundImage = 'url("' + data.photo + '")';
        photoPreview.classList.add('has-photo');
        photoButton.textContent = 'Change photo';
        photoRemove.hidden = false;
      } else {
        photoPreview.style.backgroundImage = '';
        photoPreview.classList.remove('has-photo');
        photoButton.textContent = 'Add photo';
        photoRemove.hidden = true;
      }
    }
    paintPhoto();
    photoButton.addEventListener('click', function () { photoInput.click(); });
    photoRemove.addEventListener('click', function () {
      data.photo = null;
      isDirty = true;
      photoHelp.textContent = 'Photo removed';
      paintPhoto();
    });
    photoInput.addEventListener('change', function () {
      var file = photoInput.files && photoInput.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/') || file.size > 8 * 1024 * 1024) {
        photoHelp.textContent = 'Choose a JPG, PNG or WebP smaller than 8 MB.';
        photoInput.value = '';
        return;
      }
      photoButton.disabled = true;
      photoHelp.textContent = 'Preparing photo…';
      downscaleDogPhoto(file).then(function (photo) {
        data.photo = photo;
        isDirty = true;
        photoButton.disabled = false;
        photoHelp.textContent = 'Photo ready to save with this dog.';
        paintPhoto();
      }).catch(function () {
        photoButton.disabled = false;
        photoHelp.textContent = 'That image could not be read. Please choose another.';
      });
      photoInput.value = '';
    });
    setTimeout(function () { nameInput.focus(); }, 50);
  }

  function renderBreedStep() {
    var breeds = (typeof DOG_BREEDS !== 'undefined') ? DOG_BREEDS : [];
    var opts = '<option value="">Select a breed\u2026</option>' +
      breeds.map(function (b) {
        return '<option value="' + esc(b) + '"' + (data.breed === b ? ' selected' : '') + '>' + esc(b) + '</option>';
      }).join('') +
      '<option value="' + OTHER_VALUE + '"' + (data.breed === OTHER_VALUE ? ' selected' : '') + '>Other (not listed)</option>';

    bodyEl.innerHTML =
      '<div class="dw-field-group">' +
        '<label class="dw-label" for="dwBreed">' +
          'Breed <span class="dw-required" aria-label="required">*</span>' +
        '</label>' +
        '<select class="dw-select" id="dwBreed" aria-required="true" aria-describedby="dwBreedErr">' +
          opts +
        '</select>' +
        '<input type="text" class="dw-input" id="dwBreedOther"' +
               ' placeholder="Tell us the breed" value="' + esc(data.breedOther) + '"' +
               ' style="margin-top:8px;' + (data.breed === OTHER_VALUE ? '' : 'display:none;') + '"' +
               ' aria-label="Other breed name">' +
        '<span class="dw-field-error" id="dwBreedErr" role="alert" hidden>' +
          'Please select a breed.' +
        '</span>' +
      '</div>' +
      '<div class="dw-field-group">' +
        '<label class="dw-label" for="dwWeightBand">' +
          'Weight <span class="dw-optional">(optional \u2014 improves accuracy)</span>' +
        '</label>' +
        '<select class="dw-select" id="dwWeightBand">' +
          '<option value="">Select a weight range\u2026</option>' +
          WEIGHT_BANDS.map(function (b) {
            return '<option value="' + b[0] + '"' + (data.weightBand === b[0] ? ' selected' : '') + '>' + b[1] + '</option>';
          }).join('') +
        '</select>' +
      '</div>' +
      '<div class="dw-field-group">' +
        '<span class="dw-label" id="dwFitnessLabel">' +
          'Fitness level <span class="dw-required" aria-label="required">*</span>' +
        '</span>' +
        '<div class="dw-option-group" role="group" aria-labelledby="dwFitnessLabel">' +
          optBtn('fitness', 'low',      'Low \u2014 puppy, senior, or just starting out') +
          optBtn('fitness', 'moderate', 'Moderate \u2014 everyday walker') +
          optBtn('fitness', 'high',     'High \u2014 mountain-ready') +
        '</div>' +
        '<span class="dw-field-error" id="dwFitnessErr" role="alert" hidden>' +
          'Please select a fitness level.' +
        '</span>' +
      '</div>';

    var breedSelect = document.getElementById('dwBreed');
    var breedOther  = document.getElementById('dwBreedOther');

    breedSelect.addEventListener('change', function () {
      data.breed = breedSelect.value;
      isDirty    = true;
      breedOther.style.display = breedSelect.value === OTHER_VALUE ? '' : 'none';
      document.getElementById('dwBreedErr').hidden = true;
    });
    breedOther.addEventListener('input', function () {
      data.breedOther = breedOther.value;
      isDirty = true;
    });
    var weightSelect = document.getElementById('dwWeightBand');
    weightSelect.addEventListener('change', function () {
      data.weightBand = weightSelect.value;
      isDirty = true;
    });
    wireOptionGroup(bodyEl);
    setTimeout(function () { breedSelect.focus(); }, 50);
  }

  function renderHealthStep() {
    bodyEl.innerHTML =
      '<p class="dw-step-hint">All fields in this step are optional — they help us flag trails that might not be a good fit. Only these structured facts move the score; free-text notes are kept for you.</p>' +
      '<div class="dw-field-group">' +
        '<span class="dw-label" id="dwCondLabel">' +
          'Health conditions <span class="dw-optional">(optional)</span>' +
        '</span>' +
        '<div class="dw-cond-list" role="group" aria-labelledby="dwCondLabel">' +
          CONDITION_OPTIONS.map(function (c) {
            var checked = data.conditions.indexOf(c[0]) !== -1 ? ' checked' : '';
            return '<label class="dw-cond-item"><input type="checkbox" name="dwCond" value="' + c[0] + '"' + checked + '> <span>' + c[1] + '</span></label>';
          }).join('') +
        '</div>' +
      '</div>' +
      '<div class="dw-field-group">' +
        '<label class="dw-label" for="dwNotes">' +
          'Anything else worth knowing? <span class="dw-optional">(optional)</span>' +
        '</label>' +
        '<textarea class="dw-textarea" id="dwNotes" rows="3" maxlength="400"' +
                  ' placeholder="Allergies, medications, recent injuries, vet notes…">' + esc(data.healthNotes) + '</textarea>' +
      '</div>';

    bodyEl.querySelectorAll('input[name="dwCond"]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        data.conditions = Array.from(bodyEl.querySelectorAll('input[name="dwCond"]:checked'))
          .map(function (el) { return el.value; });
        isDirty = true;
      });
    });
    var notesEl = document.getElementById('dwNotes');
    notesEl.addEventListener('input', function () { data.healthNotes = notesEl.value; isDirty = true; });
  }

  function renderReviewStep() {
    var breedDisplay = data.breed === OTHER_VALUE ? data.breedOther : data.breed;
    var fitMap = { low: 'Low', moderate: 'Moderate', high: 'High' };
    var ageLabel = (AGE_BANDS.filter(function (b) { return b[0] === data.ageBand; })[0] || [])[1] || '';
    var weightLabel = (WEIGHT_BANDS.filter(function (b) { return b[0] === data.weightBand; })[0] || [])[1] || '';
    var condLabels = data.conditions.map(function (c) { return CONDITION_LABELS[c] || c; }).join(', ');

    function row(label, value) {
      return value
        ? '<div class="dw-review-row"><span class="dw-review-key">' + label + '</span>' +
          '<span class="dw-review-val">' + esc(value) + '</span></div>'
        : '';
    }

    var healthSection = (data.conditions.length || data.healthNotes)
      ? '<div class="dw-review-section">' +
          '<div class="dw-review-title">Health</div>' +
          '<div class="dw-review-rows">' +
            row('Conditions', condLabels) +
            row('Notes', data.healthNotes) +
          '</div>' +
        '</div>'
      : '';

    bodyEl.innerHTML =
      '<p class="dw-step-hint">Review your dog\'s profile before saving.</p>' +
      '<div class="dw-review-card">' +
        '<div class="dw-review-section">' +
          '<div class="dw-review-title">Basics</div>' +
          '<div class="dw-review-rows">' +
            row('Name', data.name) +
            row('Age',  ageLabel) +
          '</div>' +
        '</div>' +
        '<div class="dw-review-section">' +
          '<div class="dw-review-title">Breed &amp; Size</div>' +
          '<div class="dw-review-rows">' +
            row('Breed',         breedDisplay) +
            row('Weight',        weightLabel) +
            row('Fitness level', fitMap[data.fitness] || data.fitness) +
          '</div>' +
        '</div>' +
        healthSection +
      '</div>';
  }

  // ---- Shared helpers ----
  function optBtn(key, value, label) {
    var sel = data[key] === value ? ' selected' : '';
    return '<button type="button" class="dw-option' + sel + '" data-key="' + key + '" data-value="' + value + '">' +
             label +
           '</button>';
  }

  function wireOptionGroup(container) {
    var errMap = {
      fitness: 'dwFitnessErr',
    };
    container.querySelectorAll('.dw-option').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.dataset.key;
        data[key] = btn.dataset.value;
        isDirty   = true;
        btn.closest('.dw-option-group').querySelectorAll('.dw-option')
           .forEach(function (b) { b.classList.remove('selected'); });
        btn.classList.add('selected');
        if (errMap[key]) {
          var errEl = document.getElementById(errMap[key]);
          if (errEl) errEl.hidden = true;
        }
      });
    });
  }

  function focusFirstIn(container) {
    setTimeout(function () {
      var focusable = getFocusable();
      if (focusable.length) focusable[0].focus();
    }, 50);
  }

  // ---- Validation ----
  function validateCurrentStep() {
    var step = STEPS[stepIndex];
    if (step.id === 'basics') {
      var nameOk = data.name.trim().length >= 2;
      var ageOk  = !!data.ageBand;
      if (!nameOk) document.getElementById('dwNameErr').hidden = false;
      if (!ageOk)  document.getElementById('dwAgeErr').hidden  = false;
      if (!nameOk) { document.getElementById('dwName').focus(); }
      else if (!ageOk) { document.getElementById('dwAgeBand').focus(); }
      return nameOk && ageOk;
    }
    if (step.id === 'breed') {
      var breedOk   = !!(data.breed && (data.breed !== OTHER_VALUE || data.breedOther.trim()));
      var fitnessOk = !!data.fitness;
      if (!breedOk)   document.getElementById('dwBreedErr').hidden   = false;
      if (!fitnessOk) document.getElementById('dwFitnessErr').hidden = false;
      if (!breedOk) { document.getElementById('dwBreed').focus(); }
      return breedOk && fitnessOk;
    }
    return true;
  }

  // ---- Navigation ----
  nextBtn.addEventListener('click', function () {
    if (!validateCurrentStep()) return;
    if (stepIndex === STEPS.length - 1) {
      finishWizard();
    } else {
      stepIndex++;
      render();
      focusFirstIn(bodyEl);
    }
  });

  backBtn.addEventListener('click', function () {
    if (stepIndex > 0) {
      stepIndex--;
      render();
      focusFirstIn(bodyEl);
    }
  });

  // ---- Close ----
  function requestClose() {
    if (phase === 'close-confirm' || phase === 'draft-prompt' || phase === 'payoff') {
      doClose();
      return;
    }
    if (isDirty) {
      phase = 'close-confirm';
      render();
      focusFirstIn(bodyEl);
    } else {
      doClose();
    }
  }

  function doClose() {
    overlay.hidden = true;
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKeyDown);
    phase = 'form';
    if (preFocusEl) { preFocusEl.focus(); preFocusEl = null; }
  }

  closeBtn.addEventListener('click', requestClose);

  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) requestClose();
  });

  // ---- Submit ----
  // Builds the SAME profile object account.js saves, so scoring.js,
  // script.js and trail.js read it with zero translation.
  function buildProfile() {
    var conditions = data.conditions.slice();
    return {
      name:       data.name.trim(),
      breed:      data.breed === OTHER_VALUE ? data.breedOther.trim() : data.breed,
      fitness:    data.fitness,
      dob:        null,
      ageBand:    data.ageBand || null,
      weightBand: data.weightBand || null,
      conditions: conditions,
      healthNotes: data.healthNotes.trim(),
      photo:      isDogPhoto(data.photo) ? data.photo : null,
      // Legacy mirrors so any cached older script keeps working.
      jointIssues: conditions.indexOf('joints') !== -1,
      heatIssues:  conditions.indexOf('heat') !== -1,
    };
  }

  function finishWizard() {
    var profile = buildProfile();
    var user = window.DoloPawsAuth && window.DoloPawsAuth.currentUser;

    if (user) {
      // Logged in: persist immediately, exactly like the account page.
      nextBtn.disabled = true;
      nextBtn.textContent = 'Saving…';
      var save = typeof window.DoloPawsAuth.addDogProfile === 'function'
        ? window.DoloPawsAuth.getDogProfiles().then(function(state){
            return state && state.dogs.length
              ? window.DoloPawsAuth.addDogProfile(profile)
              : window.DoloPawsAuth.setDogProfile(profile);
          })
        : window.DoloPawsAuth.setDogProfile(profile);
      save.then(function (ok) {
        nextBtn.disabled = false;
        if (!ok) {
          nextBtn.textContent = 'Save dog';
          showToast('Something went wrong — please try again.');
          return;
        }
        clearDraft();
        window.dispatchEvent(new CustomEvent('dolopaws-dog-profile-saved', { detail: { profile: profile } }));
        doClose();
        showToast(profile.name + ' was saved successfully.');
      });
      return;
    }

    // Guest: show the payoff (their dog's real matches) BEFORE any
    // account ask. The draft is kept so nothing is lost if they bail.
    saveDraft();
    phase = 'payoff';
    render();
    focusFirstIn(bodyEl);
  }

  // ---- Payoff view (guests only) ----
  var PENDING_PROFILE_KEY = 'dolopaws-pending-dog-profile';

  function renderPayoff() {
    var profile = buildProfile();
    stepperEl.hidden = true;
    footerEl.hidden  = true;

    var canScore = typeof trails !== 'undefined'
      && typeof scoreTrail === 'function'
      && typeof effectiveOverrides === 'function';

    var countLine = '';
    var topCards  = '';
    if (canScore) {
      var overrides = effectiveOverrides(profile, null);
      var scored = trails
        .map(function (t) { return { t: t, score: scoreTrail(t, overrides) }; })
        .sort(function (a, b) { return b.score - a.score; });
      // Same bar the homepage uses for "a match" (NEW_MATCH_THRESHOLD).
      var good = scored.filter(function (s) { return s.score >= 70; });
      var strong = scored.filter(function (s) { return s.score >= 85; });

      // For a fit dog nearly everything clears 70% — "163 of 167" reads
      // as no filter at all. When matches are abundant, lead with the
      // strong ones instead; the number stays honest either way.
      if (good.length > trails.length * 0.6 && strong.length > 0) {
        titleEl.textContent = strong.length + ' trails are a strong match for ' + profile.name;
      } else {
        titleEl.textContent = good.length + ' of ' + trails.length + ' trails match ' + profile.name;
      }
      subtitleEl.textContent = 'Scored on terrain, distance, exposure, heat and shade — for ' +
        profile.name + '’s build, age and health.';

      topCards = '<div class="dw-payoff-list">' +
        scored.slice(0, 3).map(function (s) {
          return '<div class="dw-payoff-row">' +
            '<span class="dw-payoff-name">' + esc(s.t.name) + '</span>' +
            '<span class="dw-payoff-meta">' + esc(s.t.area || '') + (s.t.distance ? ' · ' + s.t.distance + ' km' : '') + '</span>' +
            '<span class="dw-payoff-score">' + s.score + '%</span>' +
          '</div>';
        }).join('') +
        '</div>';
    } else {
      titleEl.textContent = profile.name + '’s profile is ready';
      subtitleEl.textContent = '';
    }

    bodyEl.innerHTML =
      '<div class="dw-payoff">' +
        topCards +
        '<button class="dw-btn-primary dw-payoff-cta" id="dwSaveProfileBtn">' +
          'Create a free account to save ' + esc(profile.name) + '’s profile →' +
        '</button>' +
        '<p class="dw-payoff-hint">Their matches will follow you across devices — nothing to re-enter.</p>' +
        '<button class="dw-keep-link" id="dwSkipSaveBtn">Not now — keep browsing</button>' +
      '</div>';

    document.getElementById('dwSaveProfileBtn').addEventListener('click', function () {
      try {
        localStorage.setItem(PENDING_PROFILE_KEY, JSON.stringify(profile));
      } catch (e) {}
      doClose();
      if (window.DoloPawsAuthUI) {
        window.DoloPawsAuthUI.openSignup();
        // Reframe the auth modal: the user is saving, not "registering".
        var authTitle = document.getElementById('authTitle');
        var authHint  = document.getElementById('authHint');
        if (authTitle) authTitle.textContent = 'Save ' + profile.name + '’s profile';
        if (authHint)  authHint.textContent  = 'Create a free account so ' + profile.name +
          '’s matches follow you across devices.';
      }
    });
    document.getElementById('dwSkipSaveBtn').addEventListener('click', function () {
      // Draft already saved — they can resume any time from the CTA.
      doClose();
      showToast(profile.name + '’s profile is kept as a draft on this device.');
    });
  }

  // ---- Toast ----
  var toastTimer = null;
  function showToast(message) {
    if (!toastEl) return;
    if (toastTimer) clearTimeout(toastTimer);
    toastEl.textContent = message;
    toastEl.hidden = false;
    toastEl.className = 'dw-toast dw-toast--in';
    toastTimer = setTimeout(function () {
      toastEl.hidden = true;
      toastEl.className = 'dw-toast';
    }, 3500);
  }

  // ---- Title helper ----
  function setFormTitle() {
    titleEl.textContent   = isEditing ? 'Edit dog' : 'Add a dog';
    subtitleEl.textContent = isEditing
      ? 'Update your dog\'s profile.'
      : 'Tell us about your dog to personalize trail recommendations.';
  }

  // ---- Open ----
  function openWizard(existingDog) {
    preFocusEl = document.activeElement;
    isEditing  = !!(existingDog && existingDog.name);

    if (isEditing) {
      var known = (typeof DOG_BREEDS !== 'undefined') && DOG_BREEDS.includes(existingDog.breed);
      data = Object.assign(makeEmptyData(), {
        name:        existingDog.name       || '',
        breed:       known ? existingDog.breed : (existingDog.breed ? OTHER_VALUE : ''),
        breedOther:  known ? '' : (existingDog.breed || ''),
        ageBand:     existingDog.ageBand    || '',
        weightBand:  existingDog.weightBand || '',
        fitness:     existingDog.fitness    || '',
        conditions:  Array.isArray(existingDog.conditions) ? existingDog.conditions.slice() : [],
        healthNotes: existingDog.healthNotes || '',
        photo:       isDogPhoto(existingDog.photo) ? existingDog.photo : null,
      });
      stepIndex = 0;
      isDirty   = false;
      phase     = 'form';
    } else {
      var draft = loadDraft();
      data      = makeEmptyData();
      stepIndex = 0;
      isDirty   = false;
      phase     = draft ? 'draft-prompt' : 'form';
    }

    setFormTitle();
    render();
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);

    setTimeout(function () {
      var focusable = getFocusable();
      if (focusable.length) focusable[0].focus();
    }, 50);
  }

  // ---- Public API ----
  window.DoloPawsWizard = { open: openWizard };

  // Deep link from the header dog menu on pages that don't load the
  // wizard: "＋ Add another dog" lands here and opens it straight away.
  // Waits for full load so the other deferred scripts can't race it.
  if (new URLSearchParams(window.location.search).get('addDog') === '1') {
    var autoOpen = function () { setTimeout(openWizard, 0); };
    if (document.readyState === 'complete') autoOpen();
    else window.addEventListener('load', autoOpen, { once: true });
  }
})();
