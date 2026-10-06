'use strict';

// discover-composites and approve-composites rewrite the ledger's updatedAt on
// every run, whether or not they rule on anything. A workflow asking "is the
// file dirty" therefore cannot tell a run that approved a composite from one
// that held every proposal because Overpass was unreachable -- and on
// 6 October a run that approved nothing opened a pull request whose whole diff
// was a timestamp.
//
// What a reader cares about is whether any composite changed. That lives under
// `composites`, so the comparison is of that object alone, with keys sorted so
// a rewrite that reorders them is not mistaken for a decision.

function stable(value){
  if(Array.isArray(value)) return value.map(stable);
  if(value && typeof value === 'object'){
    return Object.keys(value).sort().reduce((out, key) => {
      out[key] = stable(value[key]);
      return out;
    }, {});
  }
  return value;
}

function compositesOf(json){
  if(typeof json === 'string'){
    try{ return JSON.parse(json).composites || {}; }
    // An unreadable baseline is not evidence that nothing changed. Returning a
    // value that cannot equal the other side keeps the run opening a pull
    // request, which is the direction that loses nothing.
    catch{ return null; }
  }
  return (json && json.composites) || {};
}

/** Whether any composite differs, ignoring the ledger's own timestamp. */
function compositesChanged(before, after){
  const left = compositesOf(before);
  const right = compositesOf(after);
  if(left === null || right === null) return true;
  return JSON.stringify(stable(left)) !== JSON.stringify(stable(right));
}

/** What changed, for a run to say out loud rather than leaving a reader to diff. */
function describeChange(before, after){
  const left = compositesOf(before) || {};
  const right = compositesOf(after) || {};
  const lines = [];
  for(const id of new Set([...Object.keys(left), ...Object.keys(right)])){
    const from = left[id] && left[id].state;
    const to = right[id] && right[id].state;
    if(from === to) continue;
    lines.push(`${id}: ${from || 'absent'} -> ${to || 'absent'}`);
  }
  return lines.sort();
}

module.exports = { stable, compositesOf, compositesChanged, describeChange };
