(function () {
  'use strict';

  const checker = document.getElementById('pawSurfaceChecker');
  const scoreCard = document.getElementById('pawScore');
  const scoreNumber = document.getElementById('pawScoreNumber');
  const scoreStatus = document.getElementById('pawScoreStatus');
  const scoreSummary = document.getElementById('pawScoreSummary');
  const scoreReasons = document.getElementById('pawScoreReasons');

  function selectedInputs(){
    return checker ? Array.from(checker.querySelectorAll('input[type="radio"]:checked')) : [];
  }

  function updateSurfaceScore(){
    if (!checker || !scoreCard) return;
    const selected = selectedInputs();
    const deductions = selected.reduce((total, input) => total + Number(input.value || 0), 0);
    const score = Math.max(0, 100 - deductions);
    const reasons = selected.map(input => input.dataset.reason).filter(Boolean);

    let tone = 'good';
    let status = 'Good to go';
    let summary = 'Nothing here argues against the plan. Check pads at every break anyway, because the surface is the part that changes fastest.';
    if (score < 80 && score >= 55){
      tone = 'watch';
      status = 'Extra checks';
      summary = 'This combination asks for a shorter plan, more shade and more frequent pad checks. Turn back at the first change in stride.';
    } else if (score < 55){
      tone = 'stop';
      status = 'Choose another plan';
      summary = 'Today’s surface and paw condition do not support the original plan. Shorten, reroute or wait for better conditions.';
    }

    scoreCard.dataset.tone = tone;
    scoreNumber.textContent = String(score);
    scoreStatus.textContent = status;
    scoreSummary.textContent = summary;
    scoreReasons.textContent = reasons.length
      ? reasons.join(' ')
      : 'Nothing declared that we would subtract for. Keep checking anyway.';
  }

  if (checker){
    checker.addEventListener('change', updateSurfaceScore);
    updateSurfaceScore();
  }

  const checkboxes = Array.from(document.querySelectorAll('.paw-check-item input[type="checkbox"]'));
  const percent = document.getElementById('pawCheckPercent');
  const bar = document.getElementById('pawCheckProgress');
  const progress = document.querySelector('.paw-progress-track[role="progressbar"]');

  function updateChecklist(){
    if (!checkboxes.length) return;
    const checked = checkboxes.filter(input => input.checked).length;
    const value = Math.round((checked / checkboxes.length) * 100);
    if (percent) percent.textContent = `${value}%`;
    if (bar) bar.style.width = `${value}%`;
    if (progress) progress.setAttribute('aria-valuenow', String(checked));
  }

  checkboxes.forEach(input => input.addEventListener('change', updateChecklist));
  updateChecklist();
})();
