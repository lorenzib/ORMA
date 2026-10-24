(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.DoloPawsPhotoProvenance=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function clean(value,maximum=1000){return String(value||'').trim().slice(0,maximum);}

  function normalizeCredit(value,fallbackUrl){
    const record=typeof value==='string'?{text:value}:(value&&typeof value==='object'?value:null);
    const text=clean(record?.text,500);if(!text)return null;
    const url=clean(record?.url||fallbackUrl);
    return {text,url:/^https:\/\//i.test(url)?url:'',bare:record?.bare===true,label:record?.bare===true?text:`Photo: ${text}`};
  }

  // An illustration is not a photograph, so its line is not headed "Photo:"
  // and carries no photographer or licence. The same two types are listed as
  // NOT_A_PHOTOGRAPH in backoffice/workflows/build-publication-staging.js.
  const ILLUSTRATION_TYPES=['ai-illustration','orma-illustration'];
  function isIllustration(trail){return ILLUSTRATION_TYPES.includes(String(trail?.imageSourceType||''));}

  function heroCredit(trail){
    if(isIllustration(trail)){
      const credit=normalizeCredit({text:typeof trail.imageCredit==='string'?trail.imageCredit:trail?.imageCredit?.text,bare:true});
      return credit?{...credit,url:'',isIllustration:true}:null;
    }
    return normalizeCredit(trail?.imageCredit,trail?.imageSourcePage);
  }

  function editorialPhotos(trail){
    return (Array.isArray(trail?.editorialPhotos)?trail.editorialPhotos:[])
      .filter(photo=>photo&&photo.source==='orma-editorial'&&/^images\/[A-Za-z0-9_./-]+\.(?:avif|jpe?g|png|webp)$/i.test(clean(photo.image)))
      .map((photo,index)=>({...photo,image:clean(photo.image),isEditorial:true,editorialOrder:index,status:'approved'}));
  }

  function photoCaption(photo){
    const dog=photo?.dogContext?.name;
    const caption=photo?.isEditorial
      ? 'Shared by the ORMA community'
      : (clean(photo?.caption,500)||(dog?`Shared by ${dog}’s human`:'Shared by the ORMA community'));
    const credit=normalizeCredit(photo?.credit,photo?.creditUrl);
    const status=photo?.status==='reported'?'Reported, under review':'';
    return [caption,photo?.isEditorial?'':credit?.label,status].filter(Boolean).join(' · ');
  }

  function photoAlt(photo){return clean(photo?.alt,500)||clean(photo?.caption,500)||'Trail photograph';}

  return {clean,normalizeCredit,heroCredit,isIllustration,editorialPhotos,photoCaption,photoAlt};
});
