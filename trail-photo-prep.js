(function(root, factory){
  const api = factory(root);
  if(typeof module === 'object' && module.exports) module.exports = api;
  if(root) root.DoloPawsTrailPhotoPrep = api;
})(typeof window !== 'undefined' ? window : globalThis, function(root){
  'use strict';

  // Script-written wording goes through i18n.js; the English sentence is its own key.
  function tx(text, vars){
    const i18n = typeof window !== 'undefined' && window.DoloPawsI18n;
    if (i18n && typeof i18n.phrase === 'function') return i18n.phrase(text, vars);
    return vars ? String(text).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : text;
  }

  const MAX_INPUT_BYTES = 10 * 1024 * 1024;
  const MAX_DATA_URL_CHARS = 700000;
  const MAX_DIMENSION = 900;

  function validate(file){
    if(!file || typeof file.type !== 'string' || !file.type.startsWith('image/')){
      return { ok:false, error:tx('Choose an image file.') };
    }
    if(!Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_INPUT_BYTES){
      return { ok:false, error:tx('Choose an image smaller than 10 MB.') };
    }
    return { ok:true };
  }

  function prepare(file, environment){
    const valid = validate(file);
    if(!valid.ok) return Promise.reject(new Error(valid.error));
    const env = environment || {};
    const doc = env.document || root.document;
    const Url = env.URL || root.URL;
    const ImageCtor = env.Image || root.Image;
    if(!(doc && Url && ImageCtor)) return Promise.reject(new Error(tx('Photo preparation is unavailable.')));

    return new Promise((resolve, reject) => {
      const image = new ImageCtor();
      const objectUrl = Url.createObjectURL(file);
      const release = () => { try{ Url.revokeObjectURL(objectUrl); }catch(error){} };
      image.onerror = () => { release(); reject(new Error(tx('This image could not be decoded.'))); };
      image.onload = () => {
        try{
          const width = Number(image.naturalWidth || image.width);
          const height = Number(image.naturalHeight || image.height);
          if(!(width > 0 && height > 0)) throw new Error(tx('This image has invalid dimensions.'));
          const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
          const canvas = doc.createElement('canvas');
          canvas.width = Math.max(1, Math.round(width * scale));
          canvas.height = Math.max(1, Math.round(height * scale));
          const context = canvas.getContext('2d');
          if(!context) throw new Error(tx('Photo preparation is unavailable.'));
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          let result = '';
          for(const quality of [0.78, 0.66, 0.54, 0.42]){
            result = canvas.toDataURL('image/jpeg', quality);
            if(result.length <= MAX_DATA_URL_CHARS) break;
          }
          if(!/^data:image\/jpeg;base64,/.test(result) || result.length > MAX_DATA_URL_CHARS){
            throw new Error(tx('This photo is still too large after resizing. Try a simpler image.'));
          }
          release();
          resolve(result);
        }catch(error){ release(); reject(error); }
      };
      image.src = objectUrl;
    });
  }

  return Object.freeze({ MAX_INPUT_BYTES, MAX_DATA_URL_CHARS, MAX_DIMENSION, validate, prepare });
});
