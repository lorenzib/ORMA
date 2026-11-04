(function(){
  // Script-written wording goes through i18n.js; the English sentence is its own key.
  function tx(text, vars){
    const i18n = typeof window !== 'undefined' && window.DoloPawsI18n;
    if (i18n && typeof i18n.phrase === 'function') return i18n.phrase(text, vars);
    return vars ? String(text).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : text;
  }
  const cards = Array.from(document.querySelectorAll('[data-breed-trait]'));
  if(!cards.length) return;

  function setCardOpen(card, open){
    const button = card.querySelector('[data-breed-card-toggle]');
    const content = card.querySelector('.breed-card-content');
    if(!button || !content) return;
    const cardTitle = card.querySelector('h2').textContent.trim();

    card.classList.toggle('is-open', open);
    content.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? tx('Close {title} trail advice', { title:cardTitle }) : tx('Open {title} trail advice', { title:cardTitle }));
    button.querySelector('.breed-card-toggle__label').textContent = open ? tx('Close trail advice') : tx('Open trail advice');
  }

  cards.forEach((card, index) => {
    const title = card.querySelector('h2');
    const image = card.querySelector('.breed-card-image');
    const label = card.querySelector('.scan-card-label');
    const examples = card.querySelector('.scan-examples');
    const guidance = Array.from(card.children).filter(element =>
      element.matches('.scan-rule, .scan-list, .breed-edge, .breed-photo-credit')
    );
    if(!image || !label || !title || !examples || !guidance.length) return;

    const summary = document.createElement('div');
    summary.className = 'breed-card-summary';

    const summaryCopy = document.createElement('div');
    summaryCopy.className = 'breed-card-summary__copy';
    summaryCopy.append(label, title, examples);
    summary.append(image, summaryCopy);

    const content = document.createElement('div');
    content.className = 'breed-card-content';
    content.id = `${card.id || `breed-card-${index + 1}`}-guidance`;
    guidance.forEach(element => content.appendChild(element));

    const button = document.createElement('button');
    button.className = 'breed-card-toggle';
    button.type = 'button';
    button.dataset.breedCardToggle = '';
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', content.id);
    button.innerHTML = '<span class="breed-card-toggle__label">' + tx('Open trail advice') + '</span><span class="breed-card-toggle__icon" aria-hidden="true">+</span>';

    summary.append(button);
    card.prepend(summary);
    card.append(content);
    card.classList.add('is-enhanced');
    setCardOpen(card, false);

    button.addEventListener('click', () => {
      setCardOpen(card, !card.classList.contains('is-open'));
    });

    card.addEventListener('click', event => {
      if(card.classList.contains('is-open') || event.target.closest('button, a, summary, details')) return;
      setCardOpen(card, true);
    });
  });

  const hashCard = window.location.hash && document.getElementById(window.location.hash.slice(1));
  if(hashCard && hashCard.matches('[data-breed-trait]')) setCardOpen(hashCard, true);

  // Breed finder: type a breed, or filter by what you know, and only the cards
  // that apply stay visible. Matching uses the trait lists in breeds-data.js;
  // three cards have no list there, so they match on the breeds the card names.
  const finder = document.querySelector('[data-breed-finder]');
  if(!finder || typeof FCI_BREED_GROUPS === 'undefined') return;

  const input = finder.querySelector('[data-breed-input]');
  const list = finder.querySelector('datalist');
  const groupSelect = finder.querySelector('[data-breed-group]');
  const chips = Array.from(finder.querySelectorAll('[data-breed-filter]'));
  const status = finder.querySelector('[data-breed-status]');
  const reset = finder.querySelector('[data-breed-reset]');

  const lists = {
    brachy: typeof BRACHY_BREEDS !== 'undefined' ? BRACHY_BREEDS : [],
    thick: typeof THICK_COAT_BREEDS !== 'undefined' ? THICK_COAT_BREEDS : [],
    giant: typeof GIANT_BREEDS !== 'undefined' ? GIANT_BREEDS : [],
    heavy: typeof HEAVY_BUILD_BREEDS !== 'undefined' ? HEAVY_BUILD_BREEDS : [],
    shortLegged: typeof SHORT_LEGGED_BREEDS !== 'undefined' ? SHORT_LEGGED_BREEDS : [],
    backRisk: typeof BACK_RISK_BREEDS !== 'undefined' ? BACK_RISK_BREEDS : [],
    toy: typeof TOY_BREEDS !== 'undefined' ? TOY_BREEDS : [],
    lean: typeof LEAN_PRIMITIVE_BREEDS !== 'undefined' ? LEAN_PRIMITIVE_BREEDS : [],
    guardian: typeof LIVESTOCK_GUARDIAN_BREEDS !== 'undefined' ? LIVESTOCK_GUARDIAN_BREEDS : [],
    spitz: typeof INDEPENDENT_SPITZ_BREEDS !== 'undefined' ? INDEPENDENT_SPITZ_BREEDS : [],
    curly: typeof CURLY_COAT_BREEDS !== 'undefined' ? CURLY_COAT_BREEDS : [],
    wiry: typeof WIRY_COAT_BREEDS !== 'undefined' ? WIRY_COAT_BREEDS : [],
  };
  const groupOf = {};
  FCI_BREED_GROUPS.forEach(group => group.breeds.forEach(name => { groupOf[name] = group.id; }));
  const allBreeds = Object.keys(groupOf).sort((a, b) => a.localeCompare(b, 'en'));
  const has = (key, name) => lists[key].includes(name);
  const inGroups = (name, ids) => ids.includes(groupOf[name]);

  const MATCH = {
    airway:name => has('brachy', name),
    dense:name => has('thick', name),
    giant:name => has('giant', name) || has('heavy', name),
    deep:name => /Great Dane|Weimaraner|Irish Red Setter|Gordon Setter|Poodle|Dobermann|German Shepherd|Saint Bernard/i.test(name),
    spine:name => has('shortLegged', name) || has('backRisk', name),
    small:name => has('toy', name),
    thin:name => inGroups(name, ['g10']) || has('lean', name),
    drive:name => inGroups(name, ['g1', 'g7', 'g8']),
    prey:name => inGroups(name, ['g3', 'g6', 'g7', 'g10']) || has('spitz', name),
    guardian:name => has('guardian', name),
    coat:name => has('curly', name) || has('wiry', name) || /Spaniel|Setter|Bearded Collie|Briard|Golden Retriever|Flat Coated Retriever|Basset/i.test(name),
    collapse:name => /Labrador|Border Collie/i.test(name),
  };
  // Which cards each filter button keeps.
  const FILTERS = {
    small:['small'], spine:['spine'], giant:['giant', 'deep'],
    heat:['airway', 'dense', 'drive'], cold:['small', 'thin'],
    dense:['dense'], thin:['thin'], coat:['coat'],
    herd:['drive'], hunt:['prey'], guard:['guardian'],
  };
  const traitBreeds = {};
  Object.keys(MATCH).forEach(trait => { traitBreeds[trait] = allBreeds.filter(MATCH[trait]); });

  allBreeds.forEach(name => {
    const option = document.createElement('option');
    option.value = name;
    list.appendChild(option);
  });

  const state = { breed:'', unknown:'', filters:new Set(), group:'' };

  function findBreed(query){
    const q = query.trim().toLowerCase();
    if(!q) return '';
    return allBreeds.find(name => name.toLowerCase() === q)
      || allBreeds.find(name => name.toLowerCase().startsWith(q))
      || allBreeds.find(name => name.toLowerCase().includes(q))
      || null;
  }

  function cardApplies(card){
    const trait = card.dataset.breedTrait;
    if(trait === 'individual') return true;
    if(state.unknown) return false;
    if(state.breed && !MATCH[trait](state.breed)) return false;
    if(state.filters.size && ![...state.filters].some(filter => FILTERS[filter].includes(trait))) return false;
    if(state.group && !traitBreeds[trait].some(name => groupOf[name] === state.group)) return false;
    return true;
  }

  function render(){
    const active = Boolean(state.breed || state.unknown || state.filters.size || state.group);
    let shown = 0;
    cards.forEach(card => {
      const applies = cardApplies(card);
      card.hidden = !applies;
      if(applies && card.dataset.breedTrait !== 'individual') shown += 1;
    });
    const total = cards.length - 1;
    if(state.unknown) status.textContent = tx('No breed called “{query}” in our list. Try the filters instead.', { query:state.unknown });
    else if(state.breed) status.textContent = tx('{breed}: {shown} of {total} cards apply, plus the card for every dog.', { breed:state.breed, shown, total });
    else if(active && !shown) status.textContent = tx('No cards match these filters. Try fewer.');
    else if(active) status.textContent = tx('{shown} of {total} cards match, plus the card for every dog.', { shown, total });
    else status.textContent = tx('All {count} cards shown.', { count:cards.length });
    reset.hidden = !active;
  }

  input.addEventListener('change', () => {
    const value = input.value.trim();
    const match = findBreed(value);
    state.breed = match || '';
    state.unknown = value && !match ? value : '';
    if(match) input.value = match;
    render();
  });
  input.addEventListener('keydown', event => {
    if(event.key === 'Enter'){
      event.preventDefault();
      input.dispatchEvent(new Event('change'));
    }
  });
  input.addEventListener('search', () => input.dispatchEvent(new Event('change')));
  chips.forEach(chip => chip.addEventListener('click', () => {
    const key = chip.dataset.breedFilter;
    const on = !state.filters.has(key);
    if(on) state.filters.add(key); else state.filters.delete(key);
    chip.setAttribute('aria-pressed', String(on));
    render();
  }));
  groupSelect.addEventListener('change', () => { state.group = groupSelect.value; render(); });
  reset.addEventListener('click', () => {
    state.breed = ''; state.unknown = ''; state.group = ''; state.filters.clear();
    input.value = ''; groupSelect.value = '';
    chips.forEach(chip => chip.setAttribute('aria-pressed', 'false'));
    render();
  });
  render();
})();
