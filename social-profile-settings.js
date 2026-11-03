(function(){
  'use strict';
  // Script-written wording goes through i18n.js; the English sentence is its own key.
  function tx(text, vars){
    var i18n = typeof window !== 'undefined' && window.DoloPawsI18n;
    if (i18n && typeof i18n.phrase === 'function') return i18n.phrase(text, vars);
    return vars ? String(text).replace(/\{(\w+)\}/g, function(m, k){ return (k in vars ? vars[k] : m); }) : text;
  }
  var $ = function(id){ return document.getElementById(id); };
  var loaded = false;

  function setStatus(message, error){
    var node = $('publicProfileStatus');
    if(!node) return;
    node.textContent = message || '';
    node.style.color = error ? '#9C3A25' : '#4A7856';
  }

  function activeDog(state){
    return (state.dogs || []).find(function(dog){ return dog.id === state.activeDogId; }) || (state.dogs || [])[0] || null;
  }

  async function renderRequests(api){
    var panel = $('followRequestsPanel'), list = $('followRequestsList');
    if(!panel || !list) return;
    var requests = await api.getFollowRequests();
    panel.hidden = !requests.length;
    list.innerHTML = '';
    requests.forEach(function(request){
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;background:#FAF8F1;border:1px solid #E3DFD2;border-radius:12px;padding:12px 14px;';
      var label = document.createElement('span');
      label.textContent = request.targetType === 'dog' ? tx('A member would like to follow your dog.') : tx('A member would like to follow you.');
      var actions = document.createElement('span');
      actions.style.cssText = 'display:flex;gap:8px;';
      [[tx('Accept'), true], [tx('Decline'), false]].forEach(function(item){
        var button = document.createElement('button');
        button.type = 'button'; button.className = item[1] ? 'btn-p' : 'btn-g'; button.textContent = item[0];
        button.addEventListener('click', async function(){
          button.disabled = true;
          await api.resolveFollowRequest(request.id, item[1]);
          renderRequests(api);
        });
        actions.appendChild(button);
      });
      row.appendChild(label); row.appendChild(actions); list.appendChild(row);
    });
  }

  async function load(user){
    if(loaded || !user || !window.DoloPawsAuth || !$('publicProfileSave')) return;
    loaded = true;
    var api = window.DoloPawsAuth;
    var dogState = await api.getDogProfiles();
    var dog = activeDog(dogState);
    var profile = await api.getPublicProfile(user.uid);
    $('publicDisplayName').value = profile && profile.displayName || '';
    $('publicBio').value = profile && profile.bio || '';
    $('publicVisibility').value = profile && profile.visibility || 'private';
    $('publicTagPermission').value = profile && profile.tagPermission || 'followers';
    var publicDog = profile && (profile.dogs || []).find(function(item){ return dog && item.id === dog.id; });
    $('publicDogEnabled').checked = !!(publicDog && publicDog.public);
    $('publicDogBio').value = publicDog && publicDog.bio || '';
    $('publicDogLabel').textContent = dog && dog.name ? tx('Show {name}', { name: dog.name }) : tx('Show my dog');
    $('publicDogEnabled').disabled = !dog;
    $('publicProfileView').hidden = !profile;
    $('publicProfileView').href = 'profile.html?uid=' + encodeURIComponent(user.uid) + (dog ? '&dog=' + encodeURIComponent(dog.id) : '');
    $('publicProfileSave').addEventListener('click', async function(){
      var button = this; button.disabled = true; setStatus(tx('Saving…'));
      try {
        var dogs = (profile && profile.dogs || []).filter(function(item){ return !dog || item.id !== dog.id; });
        if(dog) dogs.push({
          id:dog.id,
          name:dog.name || 'Your dog',
          bio:$('publicDogBio').value,
          photo:$('publicDogEnabled').checked ? (dog.photo || '') : '',
          public:$('publicDogEnabled').checked,
        });
        var result = await api.setPublicProfile({
          displayName:$('publicDisplayName').value,
          bio:$('publicBio').value,
          visibility:$('publicVisibility').value,
          tagPermission:$('publicTagPermission').value,
          dogs:dogs,
        });
        if(!result.ok) throw new Error(result.message || tx('Could not save this profile.'));
        profile = result.profile;
        $('publicProfileView').hidden = false;
        setStatus(tx('Public profile saved. Private account details were not shared.'));
      } catch(error) {
        setStatus(error.message || tx('Could not save this profile.'), true);
      } finally { button.disabled = false; }
    });
    renderRequests(api).catch(function(){});
  }

  function ready(){
    if(!window.DoloPawsAuth) { setTimeout(ready, 80); return; }
    window.DoloPawsAuth.onChange(load);
  }
  document.addEventListener('DOMContentLoaded', ready);
})();
