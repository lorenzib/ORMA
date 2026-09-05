(function(root){
  'use strict';

  const HOSTED=/\.web\.app$/i.test(root.location.hostname)||root.location.hostname==='backoffice.app-orma.com';
  const ALL_DESTINATIONS=new Set([
    'backoffice-review.html','trail-dossier-desk.html','trail-content-desk.html',
    'new-trail-scouting-desk.html','hazard-review-desk.html',
    'image-coverage-desk.html','community-moderation-desk.html',
  ]);
  const ALLOWED_DESTINATIONS=HOSTED?new Set(['backoffice-review.html','trail-dossier-desk.html','trail-content-desk.html','community-moderation-desk.html']):ALL_DESTINATIONS;
  const params=new URLSearchParams(root.location.search);
  const requested=params.get('next');
  const destination=ALLOWED_DESTINATIONS.has(requested)?requested:'backoffice-review.html';
  const form=root.document.getElementById('backofficeLoginForm');
  const email=root.document.getElementById('backofficeEmail');
  const password=root.document.getElementById('backofficePassword');
  const submit=root.document.getElementById('backofficeLoginSubmit');
  const google=root.document.getElementById('backofficeGoogle');
  const switchAccount=root.document.getElementById('backofficeSwitchAccount');
  const message=root.document.getElementById('backofficeLoginMessage');

  function show(text,type='error'){
    message.textContent=text;message.hidden=false;message.dataset.type=type;
  }
  function busy(value){submit.disabled=value;if(google)google.disabled=value;}
  function authUnavailable(){
    if(root.DoloPawsAuth&&root.DoloPawsModeration)return false;
    show('The secure sign-in service is still loading. Refresh this page and try again.');
    return true;
  }

  async function moderatorStatus(){
    const status=await root.DoloPawsModeration.getModeratorStatus();
    if(status.ok){root.location.replace(destination);return true;}
    return false;
  }

  async function resolveIdentity(){
    if(await moderatorStatus())return;
    root.document.documentElement.classList.remove('bo-auth-pending');
    if(root.DoloPawsAuth.currentUser){
      show('This account does not have ORMA backoffice access. Use the authorized moderator account.');
      switchAccount.hidden=false;
    }
  }

  async function signIn(action){
    if(authUnavailable())return;
    busy(true);message.hidden=true;
    try{
      const result=await action();
      if(!result.ok){show(result.message||'Sign-in failed.');return;}
      if(!await moderatorStatus()){
        show('Sign-in succeeded, but this account is not an authorized ORMA moderator.');
        switchAccount.hidden=false;
      }
    }catch(error){show('Backoffice access could not be checked. Please try again.');}
    finally{busy(false);}
  }

  form.addEventListener('submit',event=>{
    event.preventDefault();
    signIn(()=>root.DoloPawsAuth.signIn(email.value.trim(),password.value));
  });
  if(google)google.addEventListener('click',()=>signIn(()=>root.DoloPawsAuth.signInGoogle()));
  switchAccount.addEventListener('click',async()=>{
    await root.DoloPawsAuth.logOut();switchAccount.hidden=true;message.hidden=true;email.focus();
  });

  if(root.DoloPawsAuthReady)resolveIdentity();
  else root.addEventListener('dolopaws-auth-ready',resolveIdentity,{once:true});
  root.setTimeout(()=>{
    if(!root.DoloPawsAuthReady)authUnavailable();
  },5000);
})(window);
