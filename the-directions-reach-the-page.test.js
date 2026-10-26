'use strict';

const fs=require('fs');
const path=require('path');
const {directionsSection}=require('./scripts/generate-trail-pages');
const {loadProductionTrails}=require('./scripts/load-production-trails');
const routeRefs=require('./trail-route-refs.js');
const {SOURCES}=require('./route-guidance-sources.js');

const ROOT=__dirname;
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
// What a reader sees: tags gone, entities decoded. The page escapes `&`, `<`,
// `>` and `"`, so comparing the raw sentence with the HTML failed on any of
// them -- an approved Geotrail Bulla publication was refused that way on every
// worker pass from 23 October, though the page showed it correctly.
const ENTITIES={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'"};
const text=html=>html.replace(/<[^>]+>/g,' ').replace(/&(amp|lt|gt|quot|#39);/g,entity=>ENTITIES[entity])
  .replace(/\s+/g,' ').trim();
// A sentence as written is not HTML: nothing in it is a tag to strip.
const plain=value=>String(value).replace(/\s+/g,' ').trim();

/**
 * ORMA establishes four answers about following a walk, and they reached only
 * the app. The crawlable page -- the one a search engine indexes and a reader
 * arrives on -- said how far the walk was and nothing about how to walk it.
 */
describe('the directions reach the crawlable page',()=>{
  const trails=loadProductionTrails(ROOT);
  const withGuidance=trails.filter(trail=>trail.routeNumberGuidance);

  test('there are trails with established directions to show',()=>{
    expect(withGuidance.length).toBeGreaterThan(0);
  });

  test('each one gets the section, with its own sentences in it',()=>{
    for(const trail of withGuidance){
      const section=directionsSection(trail);
      const rendered=text(section);
      expect({id:trail.id,heading:rendered.startsWith('How to follow this route')})
        .toEqual({id:trail.id,heading:true});
      for(const field of ['start','sequence','switches']){
        // The source sentence a value ends with is said once under the lines
        // rather than after each one, so the line is the value without it and
        // the note naming that source must be on the page.
        let said=plain(trail.routeNumberGuidance[field]);
        for(const source of SOURCES)for(const sentence of source.sentences){
          if(!said.includes(sentence))continue;
          said=plain(said.replace(sentence,''));
          expect({id:trail.id,field,note:rendered.includes(source.many.replace(/^are /,''))})
            .toEqual({id:trail.id,field,note:true});
        }
        expect({id:trail.id,field,present:rendered.includes(said)})
          .toEqual({id:trail.id,field,present:true});
      }
    }
  });

  test('a sentence with an ampersand, quotes or angle brackets is found as the reader sees it',()=>{
    const guidance={start:'Start at the church & car park ("Kirchplatz")',sequence:'Follow 4 <then> 4A',switches:"At Pufels' fork keep right"};
    const rendered=text(directionsSection({routeNumberGuidance:guidance}));
    for(const field of ['start','sequence','switches'])expect(rendered).toContain(plain(guidance[field]));
  });

  test('a start that already begins "Start" is not labelled "Start:" again',()=>{
    const section=directionsSection({routeNumberGuidance:{start:'Start at Rifugio Auronzo.',sequence:'Follow 101.',switches:'None.'}});
    expect(section).toContain('<p><b>Start</b> at Rifugio Auronzo.</p>');
    expect(text(section)).not.toMatch(/Start:\s*Start/);
    for(const trail of withGuidance)expect({id:trail.id,repeated:/Start:\s*Start/.test(text(directionsSection(trail)))})
      .toEqual({id:trail.id,repeated:false});
    // A sentence that begins otherwise keeps its label.
    expect(directionsSection({routeNumberGuidance:{start:'No official start is published.',sequence:'a',switches:'b'}}))
      .toContain('<b>Start:</b> No official start is published.');
  });

  test('the numbers shown are the ones the app shows, in the same order',()=>{
    for(const trail of withGuidance){
      const shields=[...directionsSection(trail).matchAll(/class="sp-route-ref">([^<]*)</g)]
        .map(match=>match[1]);
      expect({id:trail.id,shields}).toEqual({id:trail.id,shields:routeRefs.forTrail(trail)});
    }
  });

  test('a trail with no established directions gets no section at all',()=>{
    const none=trails.filter(trail=>!trail.routeNumberGuidance);
    expect(none.length).toBeGreaterThan(100);
    expect(none.map(directionsSection).filter(Boolean)).toEqual([]);
  });

  // Half a set of directions is worse than none: the reader cannot tell which
  // part is missing, and the three sentences only make sense together.
  test('a partial record is not published as directions',()=>{
    const whole={mode:'numbered',start:'Start at the car park.',
      sequence:'Follows route 20 end to end.',switches:'Stays on 20 throughout.'};
    expect(directionsSection({routeNumberGuidance:whole})).not.toBe('');
    for(const field of ['start','sequence','switches']){
      const {[field]:dropped,...partial}=whole;
      expect({field,html:directionsSection({routeNumberGuidance:partial})}).toEqual({field,html:''});
    }
    expect(directionsSection({})).toBe('');
    expect(directionsSection({routeNumberGuidance:'not an object'})).toBe('');
  });

  test('an unnumbered walk is given landmark labels, not trail-number ones',()=>{
    const landmarks=directionsSection({routeNumberGuidance:{mode:'landmarks',
      start:'Start at the square.',sequence:'Cross the fields.',switches:'Turn at the bridge.'}});
    expect(text(landmarks)).toContain('Route: Cross the fields.');
    expect(text(landmarks)).toContain('Key turns: Turn at the bridge.');
    expect(landmarks).not.toContain('Where to switch');
  });

  // The sentence that says whether ORMA confirmed how the numbers appear on
  // local signs. The app dropped it, so the card stated a number sequence as
  // though the signage were settled.
  test('the signage caveat is printed when the record carries one',()=>{
    const guidance={mode:'numbered',start:'Start at the car park.',
      status:'The mapped route carries trail number 20; ORMA has not confirmed the signs.',
      sequence:'Follows route 20 end to end.',switches:'Stays on 20 throughout.'};
    expect(text(directionsSection({routeNumberGuidance:guidance})))
      .toContain('Trail numbers: The mapped route carries trail number 20; ORMA has not confirmed the signs.');
    // And the five walks published before the pipeline wrote it have none, so
    // their sections must not grow an empty line.
    const {status,...without}=guidance;
    expect(directionsSection({routeNumberGuidance:without})).not.toContain('Trail numbers:');
  });
});

describe('the page and the app describe the route the same way',()=>{
  const page=read('scripts/generate-trail-pages.js');
  const blueprint=read('trail-blueprint.js');

  // Two renderers of one card. The labels are the thing a reader matches
  // between a phone and a browser tab, so they are the thing that must not
  // drift; the page was written from the blueprint and nothing kept them so.
  test('both use the same heading and the same four labels',()=>{
    for(const label of ['How to follow this route','Start','Trail numbers',
      'Trail numbers and route','Where to switch','Route','Key turns']){
      const names=source=>source.includes(`'${label}'`)
        ||source.includes(`<h2>${label}</h2>`)
        ||source.includes(`<b>${label}:</b>`);
      expect({label,page:names(page),app:names(blueprint)}).toEqual({label,page:true,app:true});
    }
  });

  test('both choose the landmark labels on the same condition',()=>{
    expect(page).toContain("guidance.mode === 'landmarks'");
    expect(blueprint).toContain("verifiedRouteGuidance.mode === 'landmarks'");
  });

  test('both print the signage caveat only when there is one',()=>{
    expect(page).toContain("String(guidance.status || '').trim()");
    expect(blueprint).toContain("String(verifiedRouteGuidance.status || '').trim()");
  });
});

describe('the published pages carry what the record established',()=>{
  const slugs=JSON.parse(read('data/regions-manifest.json')).trailSlug;
  const trails=loadProductionTrails(ROOT);

  test('every published trail with directions shows them on its page',()=>{
    const missing=[];
    for(const trail of trails){
      const file=path.join(ROOT,'trails',`${slugs[trail.id]}.html`);
      if(!fs.existsSync(file))continue;
      const html=fs.readFileSync(file,'utf8');
      const shows=html.includes('How to follow this route');
      if(Boolean(trail.routeNumberGuidance)!==shows)missing.push(`${trail.id}: record ${
        trail.routeNumberGuidance?'has':'has no'} guidance, page ${shows?'shows':'does not show'} it`);
    }
    expect(missing).toEqual([]);
  });
});
