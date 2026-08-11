/** @jest-environment jsdom */

const fs = require('fs');
const path = require('path');

function flush(){ return new Promise(resolve => setTimeout(resolve, 0)); }

function page(){
  document.body.innerHTML = `
    <a id="reviewBack"></a>
    <div id="reviewSummary" hidden><strong id="reviewAverage"></strong><span id="reviewCount"></span></div>
    <button id="writeReview">Write</button>
    <section id="reviewComposer" hidden>
      <div id="starPicker"><button>1</button><button>2</button><button>3</button><button>4</button><button>5</button></div>
      <textarea id="reviewBody"></textarea>
      <button id="submitReview" disabled>Submit review</button>
      <button id="cancelReview">Cancel</button>
    </section>
    <p id="reviewStatus"></p><section id="reviewList"></section>`;
}

describe('production review page', () => {
  beforeEach(() => {
    jest.resetModules();
    history.replaceState({}, '', '/reviews.html?trail=demo-loop&name=Demo%20Loop');
    page();
    window.DoloPawsCommunityStates = {
      countsTowardRating:status => ['visible', 'reported'].includes(status),
    };
    window.DoloPawsAuth = { currentUser:{ uid:'user-1' } };
    window.DoloPawsAuthReady = true;
  });

  afterEach(() => {
    delete window.DoloPawsCommunityStates;
    delete window.DoloPawsCommunity;
    delete window.DoloPawsAuth;
    delete window.DoloPawsAuthReady;
  });

  test('renders only approved Firestore reviews and escapes contribution text', async () => {
    window.DoloPawsCommunity = {
      getReviews:jest.fn().mockResolvedValue([
        { status:'visible', rating:5, text:'Useful <script>', dogContext:{ name:'Luna' } },
        { status:'pending', rating:1, text:'Not approved' },
      ]),
      setReview:jest.fn(),
    };
    require('./reviews-page');
    await flush();
    expect(window.DoloPawsCommunity.getReviews).toHaveBeenCalledWith('demo-loop');
    expect(document.getElementById('reviewList').textContent).toContain('Useful <script>');
    expect(document.getElementById('reviewList').innerHTML).not.toContain('<script>');
    expect(document.getElementById('reviewList').textContent).not.toContain('Not approved');
    expect(document.getElementById('reviewAverage').textContent).toBe('5.0');
  });

  test('submits through the moderated Firebase API without local publication', async () => {
    const setReview = jest.fn().mockResolvedValue({ ok:true });
    window.DoloPawsCommunity = {
      getReviews:jest.fn().mockResolvedValue([]),
      setReview,
    };
    const localWrite = jest.spyOn(Storage.prototype, 'setItem');
    require('./reviews-page');
    await flush();
    document.getElementById('writeReview').click();
    document.querySelectorAll('#starPicker button')[3].click();
    const body = document.getElementById('reviewBody');
    body.value = 'Good route';
    body.dispatchEvent(new Event('input'));
    document.getElementById('submitReview').click();
    await flush();
    await flush();
    expect(setReview).toHaveBeenCalledWith('demo-loop', 4, 'Good route', null);
    expect(localWrite).not.toHaveBeenCalled();
    expect(document.getElementById('reviewStatus').textContent).toContain('submitted for moderation');
    expect(document.getElementById('reviewList').textContent).toContain('No approved reviews yet');
    localWrite.mockRestore();
  });

  test('HTML loads moderation states and Firebase before the review controller', () => {
    const html = fs.readFileSync(path.join(__dirname, 'reviews.html'), 'utf8');
    expect(html.indexOf('community-content-states.js')).toBeLessThan(html.indexOf('firebase-init.js'));
    expect(html.indexOf('firebase-init.js')).toBeLessThan(html.indexOf('reviews-page.js'));
    expect(html).toContain('role="status" aria-live="polite"');
    expect(html).toContain('.review-summary[hidden]{display:none}');
  });
});
