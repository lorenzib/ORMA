/**
 * @jest-environment jsdom
 */
const fs=require('fs');
const source=fs.readFileSync('./trail-verify-desk.js','utf8');
const styles=fs.readFileSync('./backoffice-review.css','utf8');

// Drive the real acceptance control, because the rule that matters -- approve
// stays disabled until every blocker carries a real reason -- is behaviour, not
// a string a source-level test can see.
function attach(result){document.body.replaceChildren(result.node);return result;}

function buildControl(){
  const start=source.indexOf('  const MIN_ACCEPT_REASON=10;');
  const end=source.indexOf('  function card(decision){');
  expect(start).toBeGreaterThan(-1);
  return new Function('document','looseText',`
    function el(tag,className,text){const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n;}
    ${source.slice(start,end)}
    return acceptanceList;`)(document,text=>String(text));
}

const EXHAUSTED='terrainPoi/livestock: five automated resolution strategies exhausted';
const OPEN_QUESTION='logistics: open question — is the parking usable?';
const ROUTE_GUIDANCE='logistics/route-number-sequence: supported authoritative route guidance is required';

describe('ticking a blocker off', () => {
  let acceptanceList;
  beforeEach(()=>{acceptanceList=buildControl();});

  test('a tick with no reason accepts nothing', () => {
    const changes=[];
    const {node,accepted}=attach(acceptanceList({blockers:[EXHAUSTED],ready:false},()=>changes.push(1)));
    node.querySelector('input[type=checkbox]').click();
    expect(accepted.size).toBe(0);
    expect(changes.length).toBeGreaterThan(0);
  });

  test('a reason that is too short still accepts nothing', () => {
    const {node,accepted}=attach(acceptanceList({blockers:[EXHAUSTED],ready:false},()=>{}));
    node.querySelector('input[type=checkbox]').click();
    const why=node.querySelector('.vd-accept-why');
    why.value='ok';why.dispatchEvent(new window.Event('input'));
    expect(accepted.size).toBe(0);
  });

  test('a tick with a real reason accepts exactly that blocker', () => {
    const {node,accepted}=attach(acceptanceList({blockers:[EXHAUSTED,OPEN_QUESTION],ready:false},()=>{}));
    const [first]=node.querySelectorAll('input[type=checkbox]');
    first.click();
    const why=node.querySelector('.vd-accept-why');
    why.value='Walked it in August; the pasture is fenced.';
    why.dispatchEvent(new window.Event('input'));
    expect([...accepted]).toEqual([[EXHAUSTED,'Walked it in August; the pasture is fenced.']]);
  });

  test('unticking it takes the acceptance back', () => {
    const {node,accepted}=attach(acceptanceList({blockers:[EXHAUSTED],ready:false},()=>{}));
    const tick=node.querySelector('input[type=checkbox]');
    tick.click();
    const why=node.querySelector('.vd-accept-why');
    why.value='Walked it in August; the pasture is fenced.';
    why.dispatchEvent(new window.Event('input'));
    expect(accepted.size).toBe(1);
    tick.click();
    expect(accepted.size).toBe(0);
  });

  test('the reason field is closed until the blocker is ticked', () => {
    const {node}=attach(acceptanceList({blockers:[EXHAUSTED],ready:false},()=>{}));
    expect(node.querySelector('.vd-accept-why').disabled).toBe(true);
    node.querySelector('input[type=checkbox]').click();
    expect(node.querySelector('.vd-accept-why').disabled).toBe(false);
  });
});

// A walker follows the directions, so they must be supplied rather than excused.
describe('route guidance offers no tick at all', () => {
  test('it is explained instead of made acceptable', () => {
    const acceptanceList=buildControl();
    const {node,waivable}=attach(acceptanceList({blockers:[ROUTE_GUIDANCE],ready:false},()=>{}));
    expect(waivable).toEqual([]);
    expect(node.querySelectorAll('input[type=checkbox]')).toHaveLength(0);
    expect(node.querySelector('.vd-accept-blocked').textContent).toContain('have to be supplied');
  });

  test('a mixed card offers a tick only for the rest', () => {
    const acceptanceList=buildControl();
    const {node,waivable}=attach(acceptanceList({blockers:[ROUTE_GUIDANCE,EXHAUSTED],ready:false},()=>{}));
    expect(waivable).toEqual([EXHAUSTED]);
    expect(node.querySelectorAll('input[type=checkbox]')).toHaveLength(1);
  });
});

describe('the desk carries the decision to the contract', () => {
  test('approve is gated on every blocker being accepted', () => {
    expect(source).toContain('acceptance.waivable.length===decision.blockers.length');
    expect(source).toContain('acceptance.accepted.size===acceptance.waivable.length');
    expect(source).toContain("'Tick off every blocker with a reason, or send it back'");
  });

  test('the acceptances reach submitDossierReview', () => {
    expect(source).toContain('acceptedBlockers:acceptedBlockers||[]');
    const client=fs.readFileSync('./backoffice-firebase.js','utf8');
    expect(client).toContain('acceptedBlockers:(Array.isArray(input.acceptedBlockers)?input.acceptedBlockers:[])');
    const rules=fs.readFileSync('./firestore.rules','utf8');
    expect(rules).toContain('function validAcceptedBlockers(data)');
    expect(rules).toContain("'action', 'targetAgent', 'note', 'acceptedBlockers',");
  });

  test('the control is styled', () => {
    expect(styles).toContain('.vd-accept{');
    expect(styles).toContain('.vd-accept-why:disabled');
  });
});
