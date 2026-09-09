(function(){
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
    button.setAttribute('aria-label', open ? `Close ${cardTitle} trail advice` : `Open ${cardTitle} trail advice`);
    button.querySelector('.breed-card-toggle__label').textContent = open ? 'Close trail advice' : 'Open trail advice';
  }

  cards.forEach((card, index) => {
    const title = card.querySelector('h2');
    const image = card.querySelector('.breed-card-image');
    const label = card.querySelector('.scan-card-label');
    const examples = card.querySelector('.scan-examples');
    const guidance = Array.from(card.children).filter(element =>
      element.matches('.scan-rule, .scan-list, .breed-edge')
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
    button.innerHTML = '<span class="breed-card-toggle__label">Open trail advice</span><span class="breed-card-toggle__icon" aria-hidden="true">+</span>';

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
})();
