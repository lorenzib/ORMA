const fs = require('fs');

// A route choice was recorded in Firestore and the desk went on asking for it:
// the question lives in the route-review artifact, which only a cartographer
// run rebuilds, and the receipt lived in a variable that a page load threw
// away. So every visit asked again for a decision already taken.

const source = fs.readFileSync('./trail-verify-desk.js', 'utf8');
const html = fs.readFileSync('./trail-verify-desk.html', 'utf8');
const styles = fs.readFileSync('./backoffice-review.css', 'utf8');

/** routeAnswers and the stamp reader it leans on, run for real. */
function loadRouteAnswers(){
  const start = source.indexOf('function stampMs');
  const end = source.indexOf('async function submitRouteChoice');
  const body = source.slice(start, end);
  if(body.length < 200) throw new Error(`routeAnswers body not found (got ${body.length} chars)`);
  const run = new Function('routeReview', 'routeDecisions', 'routeReceipts', `${body}\nreturn routeAnswers();`);
  return (routeReview, routeDecisions = [], routeReceipts = {}) => run(routeReview, routeDecisions, routeReceipts);
}

const asked = { generatedAt: '2026-09-01T09:00:00Z' };

describe('the desk knows what it has already been told', () => {
  const answers = loadRouteAnswers();

  test('a choice recorded in Firestore is an answer', () => {
    const found = answers(asked, [{ candidateId: 'tre-cime', action: 'approve-route-variants',
      status: 'queued', submittedAt: '2026-09-01T13:38:18Z' }]);
    expect(found.get('tre-cime')).toEqual(expect.objectContaining({ action: 'approve-route-variants' }));
  });

  test('a choice just made in this tab is an answer before Firestore is re-read', () => {
    const found = answers(asked, [], { 'tre-cime': { at: Date.parse('2026-09-01T13:38:18Z'), action: 'reject-route-source' } });
    expect(found.get('tre-cime').action).toBe('reject-route-source');
  });

  test('a decision automation refused is not an answer', () => {
    expect(answers(asked, [{ candidateId: 'tre-cime', action: 'approve-route', status: 'blocked',
      submittedAt: '2026-09-01T13:38:18Z' }]).has('tre-cime')).toBe(false);
  });

  test('a decision a later one replaced is not an answer on its own', () => {
    expect(answers(asked, [{ candidateId: 'tre-cime', action: 'approve-route', status: 'superseded',
      submittedAt: '2026-09-01T11:00:00Z' }]).has('tre-cime')).toBe(false);
  });

  test('the later decision answers for both', () => {
    const found = answers(asked, [
      { candidateId: 'tre-cime', action: 'approve-route', status: 'superseded', submittedAt: '2026-09-01T11:00:00Z' },
      { candidateId: 'tre-cime', action: 'request-route-research', status: 'queued', submittedAt: '2026-09-01T13:38:18Z' },
    ]);
    expect(found.get('tre-cime').action).toBe('request-route-research');
  });

  test('a question asked again is not answered by the decision before it', () => {
    // A rebuilt artifact is the cartographer asking again, with new findings.
    expect(answers(asked, [{ candidateId: 'tre-cime', action: 'approve-route', status: 'queued',
      submittedAt: '2026-08-20T10:00:00Z' }]).has('tre-cime')).toBe(false);
  });

  test('a Firestore timestamp reads the same as an ISO string', () => {
    const found = answers(asked, [{ candidateId: 'tre-cime', action: 'approve-route', status: 'queued',
      submittedAt: { seconds: Math.floor(Date.parse('2026-09-01T13:38:18Z') / 1000) } }]);
    expect(found.get('tre-cime').at).toBe(Date.parse('2026-09-01T13:38:18Z'));
  });
});

describe('an answered choice leaves the queue', () => {
  test('the queue is built from the unanswered questions only', () => {
    expect(source).toContain('.filter(item=>!answers.has(item.candidateId)).map(routeCard)');
  });

  test('the answer is still on the page, under the queue', () => {
    expect(html).toContain('id="verifyAnswered"');
    expect(html.indexOf('id="verifyQueue"')).toBeLessThan(html.indexOf('id="verifyAnswered"'));
    expect(source).toContain('already recorded');
    expect(source).toContain('waiting on the next automation run, not on you');
    expect(styles).toContain('.vd-answered-row');
  });

  test('what was decided is named, not just that something was', () => {
    ['approve-route', 'approve-route-variants', 'request-route-research', 'reject-route-source']
      .forEach(action => expect(source).toContain(`'${action}':'`));
  });
});

describe('reading the answers back cannot drain the daily quota', () => {
  // The desk polls every minute; backofficeRouteReviews is a hundred-document
  // read. Firestore here is the free tier, and a desk left open all day on that
  // poll would spend the whole allowance on it.
  test('the minute poll re-reads artifacts, never the decisions', () => {
    expect(source).toContain('window.setInterval(()=>{if(!document.hidden&&!busy())load();},60000)');
    const calls = source.match(/loadRouteDecisions\(\)(?!\{)/g) || [];
    // First load, the Refresh button, and after a submit. Nowhere else.
    expect(calls).toHaveLength(3);
  });
});
