(function(root){
  'use strict';
  root.document.querySelectorAll('[data-backoffice-sign-out]').forEach(button=>{
    button.addEventListener('click',async()=>{
      button.disabled=true;
      try{await root.DoloPawsAuth?.logOut();}
      finally{root.location.replace('backoffice-login.html');}
    });
  });
})(window);
