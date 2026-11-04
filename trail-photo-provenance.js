(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.DoloPawsPhotoProvenance=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  // Script-written wording goes through i18n.js; the English sentence is its own key.
  function tx(text,vars){
    const i18n=typeof window!=='undefined'&&window.DoloPawsI18n;
    if(i18n&&typeof i18n.phrase==='function')return i18n.phrase(text,vars);
    return vars?String(text).replace(/\{(\w+)\}/g,(m,k)=>(k in vars?vars[k]:m)):text;
  }
  // A trail's own words in the reader's language, from data/trail-text-it.
  function trailWords(text){
    const i18n=typeof window!=='undefined'&&window.DoloPawsI18n;
    return i18n&&typeof i18n.trailText==='function'?i18n.trailText(text):text;
  }

  function clean(value,maximum=1000){return String(value||'').trim().slice(0,maximum);}

  function normalizeCredit(value,fallbackUrl){
    const record=typeof value==='string'?{text:value}:(value&&typeof value==='object'?value:null);
    const text=clean(record?.text,500);if(!text)return null;
    const url=clean(record?.url||fallbackUrl);
    return {text,url:/^https:\/\//i.test(url)?url:'',bare:record?.bare===true,label:record?.bare===true?text:tx('Photo: {credit}',{credit:text})};
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

  // Openly licensed photographs shown before anyone has shared one
  // (data/trail-gallery-photos.json). Credited with creator and licence.
  function licensedPhotos(trail){
    return (Array.isArray(trail?.licensedPhotos)?trail.licensedPhotos:[])
      .filter(photo=>photo&&/^images\/trails\/[A-Za-z0-9_.-]+\.(?:jpe?g|webp)$/i.test(clean(photo.image))&&clean(photo.creator)&&clean(photo.licence)&&/^https:\/\//i.test(clean(photo.sourcePage)))
      .map((photo,index)=>({...photo,image:clean(photo.image),isLicensed:true,licensedOrder:index,status:'approved'}));
  }

  function licensedCredit(photo){
    if(!photo?.isLicensed)return null;
    const licenceUrl=clean(photo.licenceUrl);
    return {creator:clean(photo.creator,200),licence:clean(photo.licence,80),sourcePage:clean(photo.sourcePage),
      licenceUrl:/^https:\/\//i.test(licenceUrl)?licenceUrl:''};
  }

  function photoCaption(photo){
    const licensed=licensedCredit(photo);
    if(licensed)return tx('Photo: {creator} · {licence}',{creator:licensed.creator,licence:licensed.licence});
    const dog=photo?.dogContext?.name;
    const caption=photo?.isEditorial
      ? tx('Shared by the ORMA community')
      : (clean(photo?.caption,500)||(dog?tx('Shared by {dog}’s human',{dog}):tx('Shared by the ORMA community')));
    const credit=normalizeCredit(photo?.credit,photo?.creditUrl);
    const status=photo?.status==='reported'?tx('Reported, under review'):'';
    return [caption,photo?.isEditorial?'':credit?.label,status].filter(Boolean).join(' · ');
  }

  function photoAlt(photo){return clean(trailWords(photo?.alt),500)||clean(photo?.caption,500)||tx('Trail photograph');}

  return {clean,normalizeCredit,heroCredit,isIllustration,editorialPhotos,licensedPhotos,licensedCredit,photoCaption,photoAlt};
});
