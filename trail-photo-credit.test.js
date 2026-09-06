'use strict';

const fs=require('fs');
const path=require('path');
const overrides=require('./data/trail-image-overrides.json');

const root=__dirname;
const escapeHtml=value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// A photo published under a Creative Commons licence must carry its attribution
// on the page, not merely in the data. Losing the credit is a licence breach, and
// it is the kind of thing that goes unnoticed until someone complains.
describe('every licensed trail photo is credited on its page',()=>{
  const licensed=(overrides.trails||[]).filter(entry=>entry.fields?.imageSourceType==='licensed-source');

  test('there is at least one licensed photo to check',()=>{
    expect(licensed.length).toBeGreaterThan(0);
  });

  test.each(licensed.map(entry=>[entry.id,entry]))('%s records a complete rights set',(id,entry)=>{
    const f=entry.fields;
    expect(f.imageCreator).toBeTruthy();
    expect(f.imageLicence).toBeTruthy();
    expect(f.imageLicenceUrl).toMatch(/^https:\/\//);
    expect(f.imageSourcePage).toMatch(/^https:\/\//);
    expect(f.imageAlt).toBeTruthy();
    // The alt text describes the photograph; it must not be a bare trail name.
    expect(f.imageAlt.trim().length).toBeGreaterThan(10);
  });

  const pageFor=assetRef=>fs.readdirSync(path.join(root,'trails'))
    .filter(name=>name.endsWith('.html'))
    .find(name=>fs.readFileSync(path.join(root,'trails',name),'utf8').includes(assetRef));

  test.each(licensed.map(entry=>[entry.id,entry]))('%s renders creator, licence and source on the page',(id,entry)=>{
    const f=entry.fields;
    const page=pageFor(f.imageIcon);
    expect(page).toBeDefined();
    const html=fs.readFileSync(path.join(root,'trails',page),'utf8');
    const body=html.match(/<div class="sp-photo-credit__body">([\s\S]*?)<\/div>/)?.[1];
    expect(body).toBeDefined();
    expect(body).toContain(escapeHtml(f.imageCreator));
    expect(body).toContain(escapeHtml(f.imageLicence));
    expect(body).toContain(f.imageLicenceUrl);
    expect(body).toContain(f.imageSourcePage);
  });

  test('a licensed photo is committed to the repository, never hot-linked',()=>{
    for(const entry of licensed){
      expect(entry.fields.imageIcon).toMatch(/^images\/trails\//);
      expect(fs.existsSync(path.join(root,entry.fields.imageIcon))).toBe(true);
    }
  });

  test('no photograph is reused across two trails',()=>{
    const refs=(overrides.trails||[]).map(entry=>entry.fields?.imageIcon).filter(Boolean);
    expect(new Set(refs).size).toBe(refs.length);
  });
});
