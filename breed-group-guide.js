(function(){
  const buttons = Array.from(document.querySelectorAll('[data-breed-filter]'));
  const cards = Array.from(document.querySelectorAll('[data-breed-trait]'));
  const reset = document.querySelector('[data-breed-reset]');
  const status = document.querySelector('[data-breed-status]');
  const empty = document.querySelector('[data-breed-empty]');
  if(!buttons.length || !cards.length) return;

  const selected = new Set();

  function render(){
    let visible = 0;
    cards.forEach(card => {
      const show = !selected.size || selected.has(card.dataset.breedTrait);
      card.hidden = !show;
      if(show) visible += 1;
    });
    buttons.forEach(button => {
      button.setAttribute('aria-pressed', String(selected.has(button.dataset.breedFilter)));
    });
    if(reset) reset.hidden = !selected.size;
    if(empty) empty.hidden = visible !== 0;
    if(status){
      status.textContent = selected.size
        ? `Showing ${visible} of ${cards.length} trail checks. Select more traits or clear the filters.`
        : `Showing all ${cards.length} trail checks.`;
    }
  }

  buttons.forEach(button => {
    button.addEventListener('click', () => {
      const trait = button.dataset.breedFilter;
      if(selected.has(trait)) selected.delete(trait);
      else selected.add(trait);
      render();
    });
  });

  if(reset){
    reset.addEventListener('click', () => {
      selected.clear();
      render();
      buttons[0].focus();
    });
  }

  render();
})();
