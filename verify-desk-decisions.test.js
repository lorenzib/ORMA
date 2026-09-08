const fs = require('fs');

// The desk had the right actions in the wrong order: a route drawing, four
// gates, three evidence panels, machine output and retry history all came
// before the note and buttons, so the decision was the last thing you reached.
// And a revision needs a precise note, which meant typing one per trail.

const source = fs.readFileSync('./trail-verify-desk.js', 'utf8');
const styles = fs.readFileSync('./backoffice-review.css', 'utf8');

describe('the desk leads with the decision', () => {
  test('the note and buttons come before the evidence', () => {
    const decision = source.indexOf("article.append(note,actions,status");
    const evidence = source.indexOf("article.append(decision.evidence())");
    expect(decision).toBeGreaterThan(-1);
    expect(evidence).toBeGreaterThan(-1);
    expect(decision).toBeLessThan(evidence);
  });

  test('trails that are clean by every check are shown first', () => {
    expect(source).toContain('Number(b.ready===true)-Number(a.ready===true)');
  });
});

describe('a revision can be given in one click', () => {
  test('every gate offers reasons, not just a blank box', () => {
    // Four gates: route, findings, description, publication.
    expect((source.match(/^\s+reasons:\[/gm) || []).length).toBe(4);
  });

  test('the reasons are specific to the question being asked', () => {
    // A route reason would be meaningless on the publication gate.
    expect(source).toContain('The line does not follow the official route');
    expect(source).toContain('A finding is not supported by its source');
    expect(source).toContain('The description claims more than the evidence shows');
    expect(source).toContain('This maps to the wrong trail');
  });

  test('picking a reason writes the note the revision requires', () => {
    // apply-dossier-review rejects a revision without a precise note, so the
    // chip has to fill the field rather than only mark itself.
    expect(source).toContain('drafts[decision.key]={note:note.value}');
    expect(source).toContain("chip.classList.add('is-picked')");
  });

  test('a second reason adds to the note instead of replacing it', () => {
    expect(source).toMatch(/existing&&existing!==reason\?/);
  });

  test('reasons are hidden once a decision is recorded', () => {
    expect(source).toContain('if(reasons.length&&!receipt)');
  });

  test('the reason chips are styled and keyboard reachable', () => {
    expect(styles).toContain('.vd-reason');
    expect(styles).toContain('.vd-reason:focus-visible');
  });
});
