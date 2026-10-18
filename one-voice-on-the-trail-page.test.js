'use strict';

const fs=require('fs');
const path=require('path');
const {loadProductionTrails}=require('./scripts/load-production-trails');

const read=file=>fs.readFileSync(path.join(__dirname,file),'utf8');

/**
 * Two faults in one card, both visible in a screenshot and neither covered:
 * the lead paragraph told the reader where ORMA got the route, and it was set
 * in a different size, leading and colour from the directions beneath it.
 */

describe('the card speaks to a walker, not about the pipeline',()=>{
  // The blueprint is a browser script, so the rule is read from its source the
  // way the other static checks in this repository read theirs.
  const blueprint=read('trail-blueprint.js');
  const apply=input=>{
    const body=blueprint.match(/const readerVoice = \(s\) => String\(s\)([\s\S]*?);\n  const cardCopy/);
    expect(body).not.toBeNull();
    // eslint-disable-next-line no-new-func
    return new Function('s',`return String(s)${body[1]};`)(input);
  };

  test('it stops telling the reader the route was imported',()=>{
    expect(apply('A 4.1 km loop near Valloire, imported from the OpenStreetMap hiking network (trail 23).'))
      .toBe('A 4.1 km loop near Valloire.');
  });

  test('the screening sentence is said in a reader’s words',()=>{
    expect(apply('Passed automated dog-suitability screening: no via ferrata, ladders, or alpine-grade (T3+) sections on record.'))
      .toBe('No via ferrata, ladders, or alpine-grade (T3+) sections are recorded on this route.');
  });

  test('a start point is not labelled with how it was verified',()=>{
    expect(apply('Lift station Vinouve, 20 m from the route (OSM-verified access point)'))
      .toBe('Lift station Vinouve, 20 m from the route');
  });

  test('copy that never mentioned the pipeline is untouched',()=>{
    const human='A demanding circuit from Rifugio Auronzo around the Tre Cime, following trails 101 and 105.';
    expect(apply(human)).toBe(human);
  });

  // "Head to , Lift station Vinouve" shipped because the prefix rule listed
  // every separator except the comma that is actually used.
  test('stripping "Start here" takes its comma with it',()=>{
    const rule=blueprint.match(/\.replace\((\/\^Start here[^/]*\/i), ''\)/);
    expect(rule).not.toBeNull();
    // eslint-disable-next-line no-new-func
    const strip=new Function('s',`return String(s).replace(${rule[1]},'');`);
    expect(strip('Start here, Lift station Vinouve')).toBe('Lift station Vinouve');
    expect(strip('Start here: Rifugio Auronzo')).toBe('Rifugio Auronzo');
    expect(strip('Start here — Passo Giau')).toBe('Passo Giau');
    expect(strip('Start here Prato Piazza')).toBe('Prato Piazza');
    expect(strip('Starting meadow')).toBe('Starting meadow');
  });

  // This pinned trail-trust's spelling of the rule -- `[,—-]`, which did not
  // list the colon -- as the thing the blueprint had to match. trail-trust was
  // the one that was wrong: every start label in the catalogue writes
  // "Start here: parking du lac", so seven pages read "Suggested start, Start
  // here: parking du lac". Asserting a spelling protected the narrower rule.
  // Both are asserted by behaviour now, against the same inputs.
  test('and every copy of the rule strips the same prefixes',()=>{
    const sources=['trail-trust.js','scripts/generate-trail-pages.js','trail-blueprint.js'];
    const cases=['Start here, Lift station Vinouve','Start here: Rifugio Auronzo',
      'Start here — Passo Giau','Start here Prato Piazza','Starting meadow'];
    for(const file of sources){
      const rule=read(file).match(/\.replace\((\/\^Start here[^/]*\/i), *''\)/);
      expect({file,found:Boolean(rule)}).toEqual({file,found:true});
      // eslint-disable-next-line no-new-func
      const strip=new Function('s',`return String(s).replace(${rule[1]},'');`);
      expect({file,stripped:cases.map(strip)}).toEqual({file,stripped:[
        'Lift station Vinouve','Rifugio Auronzo','Passo Giau','Prato Piazza','Starting meadow']});
    }
  });
});

describe('one voice inside the About card',()=>{
  const css=read('trail.html');
  const declaration=selector=>{
    const found=css.match(new RegExp(`${selector}\\{([^}]*)\\}`));
    expect(found).not.toBeNull();
    return Object.fromEntries(found[1].split(';').filter(Boolean)
      .map(part=>part.split(':').map(piece=>piece.trim().toLowerCase())));
  };

  const lead=()=>declaration('#matchDescription');
  const body=()=>declaration('\\.td2-about-getting \\.td2-park \\.s,\\.td2-about-around \\.td2-park \\.s');

  test('the lead paragraph and the directions are set the same',()=>{
    for(const property of ['font-size','line-height','color']){
      expect([property,lead()[property]]).toEqual([property,body()[property]]);
    }
  });

  // It was an id against a class, so the card's own rule never had a chance.
  test('the lead no longer overrides the card with a size of its own',()=>{
    expect(lead()['font-size']).toBe('14px');
    expect(lead()['line-height']).toBe('1.65');
  });
});

describe('what the reader is actually shown now',()=>{
  const trails=loadProductionTrails(path.resolve(__dirname));

  // The counts that made this worth fixing rather than a one-page typo.
  test('the catalogue still carries the pipeline wording the card now hides',()=>{
    const imported=trails.filter(trail=>/imported from the OpenStreetMap/i.test(String(trail.desc||'')));
    const verifiedStart=trails.filter(trail=>/OSM-verified access point/i.test(String(trail.startPoint&&trail.startPoint.label||'')));
    expect(imported.length).toBeGreaterThan(100);
    expect(verifiedStart.length).toBeGreaterThan(50);
  });

  // The separator is not the point, and pinning one was a trap: the promoter
  // writes "Start here \u2014 X" while the curated entries write "Start here, X",
  // so an assertion about the comma counted 13 and read as the prefix having
  // become rare. What matters is that the prefix is common, whatever follows
  // it, because that is what the stripping rule is for.
  test('and a "Start here" label is the common shape, not an edge case',()=>{
    const prefixed=trails.filter(trail=>/^Start here\b/i.test(String(trail.startPoint&&trail.startPoint.label||'')));
    expect(prefixed.length).toBeGreaterThan(20);
    // Both separators are in the catalogue, and both must strip.
    expect(prefixed.some(trail=>/^Start here\s*,/i.test(trail.startPoint.label))).toBe(true);
    expect(prefixed.some(trail=>/^Start here\s*\u2014/i.test(trail.startPoint.label))).toBe(true);
  });
});
