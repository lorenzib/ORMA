(function () {
  'use strict';

  // Script-written wording goes through i18n.js; the English sentence is its own key.
  function tx(text, vars) {
    const i18n = typeof window !== 'undefined' && window.DoloPawsI18n;
    if (i18n && typeof i18n.phrase === 'function') return i18n.phrase(text, vars);
    return vars ? String(text).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : text;
  }

  const choices = Array.from(document.querySelectorAll('[data-altitude-state]'));
  const result = document.querySelector('[data-altitude-result]');
  const label = document.querySelector('[data-altitude-label]');
  const title = document.querySelector('[data-altitude-title]');
  const copy = document.querySelector('[data-altitude-copy]');
  const note = document.querySelector('[data-altitude-note]');

  if (!choices.length || !result || !label || !title || !copy || !note) return;

  const guidance = {
    normal: {
      label: tx('Continue conservatively'),
      title: tx('Use the first outing as a baseline check'),
      copy: tx('Keep the route short and easy. Pause early on flat ground and compare breathing, gait, interest and recovery with your dog’s normal before gaining more height.'),
      note: tx('Normal now is not a promise for later: reassess after every meaningful climb and again that evening.'),
    },
    caution: {
      label: tx('Stop ascending'),
      title: tx('Rest, reassess and be ready to descend'),
      copy: tx('End the climb and let your dog rest in a calm, cool place. If breathing, energy or behaviour does not move back toward normal, descend and finish the hike.'),
      note: tx('Contact a veterinarian if signs persist after descent, recur, or worsen at any point.'),
    },
    emergency: {
      label: tx('Urgent action'),
      title: tx('Descend now and seek veterinary help'),
      copy: tx('Breathing difficulty at rest, pale or bluish gums, collapse, disorientation or loss of coordination are emergencies. Minimise exertion and carry your dog if it is safe.'),
      note: tx('Call a veterinarian or emergency clinic while arranging the fastest safe descent and transport.'),
    },
  };

  function render(state) {
    const selected = guidance[state];
    if (!selected) return;
    choices.forEach((choice) => choice.setAttribute('aria-pressed', String(choice.dataset.altitudeState === state)));
    result.dataset.tone = state;
    label.textContent = selected.label;
    title.textContent = selected.title;
    copy.textContent = selected.copy;
    note.textContent = selected.note;
  }

  choices.forEach((choice) => choice.addEventListener('click', () => render(choice.dataset.altitudeState)));
})();
