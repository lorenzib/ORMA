(function(){
  const button = document.getElementById('markRead');
  if (!button) return;
  button.addEventListener('click', function(){
    document.querySelectorAll('.notification-dot').forEach(dot => dot.remove());
    button.textContent = 'All read';
    button.disabled = true;
    try { localStorage.setItem('dolopaws-notifications-read', String(Date.now())); } catch (e) {}
  });
  try {
    if (localStorage.getItem('dolopaws-notifications-read')) button.click();
  } catch (e) {}
})();
