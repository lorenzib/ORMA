(function(){
  'use strict';
  // Script-written wording goes through i18n.js; the English sentence is its own key.
  function tx(text, vars){
    var i18n = typeof window !== 'undefined' && window.DoloPawsI18n;
    if (i18n && typeof i18n.phrase === 'function') return i18n.phrase(text, vars);
    return vars ? String(text).replace(/\{(\w+)\}/g, function(m, k){ return (k in vars ? vars[k] : m); }) : text;
  }
  var params = new URLSearchParams(location.search), uid = params.get('uid'), dogId = params.get('dog');
  var $ = function(id){ return document.getElementById(id); };
  var profile = null, dog = null, followState = null;
  function status(text, error){ $('profileStatus').textContent = text || ''; $('profileStatus').style.color = error ? '#9C3A25' : '#4A7856'; }
  function buttonText(){
    if(!followState) return tx('Follow');
    return followState.status === 'pending' ? tx('Requested') : tx('Following');
  }
  async function render(user){
    if(!uid){ $('profileBio').textContent = tx('This profile link is incomplete.'); return; }
    try { profile = await window.DoloPawsAuth.getPublicProfile(uid); }
    catch(error){ $('profileBio').textContent = tx('This trail profile is not available.'); return; }
    if(!profile){ $('profileBio').textContent = tx('This trail profile is not available.'); return; }
    dog = (profile.dogs || []).find(function(item){ return item.id === dogId && item.public; }) || (profile.dogs || []).find(function(item){ return item.public; }) || null;
    $('profileName').textContent = dog ? dog.name : profile.displayName;
    $('profileOwner').textContent = dog ? tx('Adventures with {name}', { name: profile.displayName }) : tx('ORMA trail member');
    if(dog && dog.photo){ $('profileAvatar').style.backgroundImage = 'url("' + dog.photo.replace(/"/g, '%22') + '")'; $('profileAvatar').textContent = ''; }
    var privateProfile = profile.visibility === 'private';
    $('profileBio').textContent = privateProfile ? '' : (dog && dog.bio || profile.bio || tx('Finding the next good trail.'));
    $('profilePrivacy').hidden = !privateProfile;
    if(!user || user.uid === uid) return;
    followState = await window.DoloPawsAuth.getFollowState(dog ? 'dog' : 'human', dog ? dog.id : uid);
    var button = $('profileFollow'); button.hidden = false; button.textContent = buttonText(); button.classList.toggle('secondary', !!followState);
  }
  async function toggleFollow(){
    var api = window.DoloPawsAuth, button = this;
    if(!api.currentUser){ location.href = 'login.html?next=' + encodeURIComponent(location.pathname + location.search); return; }
    button.disabled = true;
    try {
      if(followState){ await api.unfollowPublicIdentity(dog ? 'dog' : 'human', dog ? dog.id : uid); followState = null; status(tx('You are no longer following this profile.')); }
      else { var result = await api.followPublicIdentity(uid, dog ? 'dog' : 'human', dog ? dog.id : uid, profile.visibility === 'private'); followState = { status:result.status }; status(result.status === 'pending' ? tx('Follow request sent.') : tx('You are now following this profile.')); }
      button.textContent = buttonText(); button.classList.toggle('secondary', !!followState);
    } catch(error){ status(tx('That follow action did not work. Please try again.'), true); }
    button.disabled = false;
  }
  function ready(){ if(!window.DoloPawsAuth){ setTimeout(ready,80); return; } window.DoloPawsAuth.onChange(render); $('profileFollow').addEventListener('click', toggleFollow); }
  document.addEventListener('DOMContentLoaded', ready);
})();
