(function(root){
  'use strict';

  const LOCAL_HOSTS=new Set(['localhost','127.0.0.1']);
  const LOGIN_PAGE='backoffice-login.html';

  function reveal(){
    root.document.documentElement.classList.remove('bo-auth-pending');
    root.document.documentElement.classList.add('bo-authenticated');
  }

  function currentPage(){
    const page=(root.location.pathname.split('/').pop()||'backoffice-review.html');
    return /^[a-z0-9-]+\.html$/i.test(page)?page:'backoffice-review.html';
  }

  function sendToLogin(reason){
    const query=new URLSearchParams({next:currentPage(),reason});
    root.location.replace(`${LOGIN_PAGE}?${query.toString()}`);
  }

  async function enforce(){
    if(LOCAL_HOSTS.has(root.location.hostname)){reveal();return;}
    try{
      const moderator=await root.DoloPawsModeration?.getModeratorStatus();
      if(moderator?.ok){reveal();root.dispatchEvent(new CustomEvent('orma-backoffice-authenticated'));return;}
      // 'check-failed' means the claim could not be read, not that it said no.
      // This branch existed before and could never run: the check swallowed its
      // own errors and returned a bare no, so a rate-limited moderator was told
      // she was forbidden and sent round the loop again.
      if(moderator?.reason)sendToLogin(moderator.reason);
      else sendToLogin(root.DoloPawsAuth?.currentUser?'forbidden':'signed-out');
    }catch(error){sendToLogin('check-failed');}
  }

  function start(){
    if(LOCAL_HOSTS.has(root.location.hostname)){reveal();return;}
    if(root.DoloPawsAuthReady)enforce();
    else root.addEventListener('dolopaws-auth-ready',enforce,{once:true});
  }

  const api={currentPage,enforce,start};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')start();
})(typeof window!=='undefined'?window:globalThis);
