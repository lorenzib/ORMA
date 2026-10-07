/**
 * @jest-environment jsdom
 */
const fs=require('fs');
const source=fs.readFileSync('./trail-verify-desk.js','utf8');

// Drive the real control, for the same reason desk-accept-blockers.test.js
// does: whether a recommendation ends up accepting something is behaviour, not
// a string a source-level test can see.
function buildControl(){
  const start=source.indexOf('  const MIN_ACCEPT_REASON=10;');
  const end=source.indexOf('  function card(decision){');
  expect(start).toBeGreaterThan(-1);
  return new Function('document','looseText',`
    function el(tag,className,text){const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n;}
    ${source.slice(start,end)}
    return acceptanceList;`)(document,text=>String(text));
}

const {routeGuidanceBlockingReasons}=require('./backoffice/workflows/compile-verified-dossier.js');
const [ROUTE_GUIDANCE]=routeGuidanceBlockingReasons([]);
const EXHAUSTED='terrainPoi/livestock: five automated resolution strategies exhausted';
const REASON='The pasture is fenced away from the path for its whole length.';

const ACCEPT={blocker:EXHAUSTED,recommendation:'accept',reason:REASON,confidence:'corroborated',
  sources:[{url:'https://comune.example/notice',publisher:'Comune di Example',quote:'Recinzione lungo il sentiero.'},
    {url:'https://parco.example/pascoli',publisher:'Parco Example',quote:'Il pascolo e recintato.'}]};

function attach(result){document.body.replaceChildren(result.node);return result;}

describe('a recommendation is an offer, not a decision',()=>{
  let acceptanceList;
  beforeEach(()=>{acceptanceList=buildControl();});

  test('it types the reason in and leaves the tick to her',()=>{
    const {node,accepted}=attach(acceptanceList({blockers:[EXHAUSTED],ready:false,verdicts:[ACCEPT]},()=>{}));
    expect(node.querySelector('.vd-accept-why').value).toBe(REASON);
    // The box is filled and nothing is accepted: the sentence is kept with the
    // verification, so a person has to put their name to it.
    expect(node.querySelector('input[type=checkbox]').checked).toBe(false);
    expect(accepted.size).toBe(0);
  });

  test('her tick is what accepts it, and the suggested reason is what gets kept',()=>{
    const {node,accepted}=attach(acceptanceList({blockers:[EXHAUSTED],ready:false,verdicts:[ACCEPT]},()=>{}));
    node.querySelector('input[type=checkbox]').click();
    expect(accepted.get(EXHAUSTED)).toBe(REASON);
  });

  test('she can replace it, and hers is what is kept',()=>{
    const {node,accepted}=attach(acceptanceList({blockers:[EXHAUSTED],ready:false,verdicts:[ACCEPT]},()=>{}));
    const why=node.querySelector('.vd-accept-why');
    node.querySelector('input[type=checkbox]').click();
    why.value='I walked this in June and the fence is there.';
    why.dispatchEvent(new window.Event('input'));
    expect(accepted.get(EXHAUSTED)).toBe('I walked this in June and the fence is there.');
  });

  test('the sources are there to be opened, in a new tab',()=>{
    const {node}=attach(acceptanceList({blockers:[EXHAUSTED],ready:false,verdicts:[ACCEPT]},()=>{}));
    const links=[...node.querySelectorAll('.vd-verdict-sources a')];
    expect(links.map(link=>link.href)).toEqual(['https://comune.example/notice','https://parco.example/pascoli']);
    expect(links.every(link=>link.rel==='noopener noreferrer'&&link.target==='_blank')).toBe(true);
    expect(node.querySelector('.vd-verdict-confidence').textContent).toContain('two independent sources agree');
  });

  // "Nobody could justify this" is the useful answer more often than the other
  // one, and it must not look like nobody tried.
  test('a refusal is shown and fills nothing in',()=>{
    const refusal={blocker:EXHAUSTED,recommendation:'cannot-accept',
      reason:'Nothing published either way.',confidence:'unsourced',sources:[]};
    const {node,accepted}=attach(acceptanceList({blockers:[EXHAUSTED],ready:false,verdicts:[refusal]},()=>{}));
    expect(node.querySelector('.vd-accept-why').value).toBe('');
    expect(node.querySelector('.vd-verdict.is-cannot-accept')).not.toBeNull();
    expect(node.querySelector('.vd-verdict-reason').textContent).toBe('Nothing published either way.');
    expect(accepted.size).toBe(0);
  });

  test('a gate with no recommendation behaves exactly as before',()=>{
    const {node,accepted}=attach(acceptanceList({blockers:[EXHAUSTED],ready:false},()=>{}));
    expect(node.querySelector('.vd-accept-why').value).toBe('');
    expect(node.querySelector('.vd-verdict')).toBeNull();
    node.querySelector('input[type=checkbox]').click();
    expect(accepted.size).toBe(0);
  });

  test('route guidance is still never offered a tick-box',()=>{
    const {node,waivable}=attach(acceptanceList({blockers:[ROUTE_GUIDANCE],ready:false,
      verdicts:[{blocker:ROUTE_GUIDANCE,recommendation:'accept',reason:REASON,confidence:'corroborated',sources:[]}]},()=>{}));
    expect(waivable).toEqual([]);
    expect(node.querySelector('input[type=checkbox]')).toBeNull();
    expect(node.querySelector('.vd-accept-blocked')).not.toBeNull();
  });
});
