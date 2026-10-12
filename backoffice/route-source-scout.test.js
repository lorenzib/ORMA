'use strict';

const fs=require('fs');
const os=require('os');
const path=require('path');
const {confirmProposal,quoteIsInPage,readableText,normalise,prompt,
  scoutRouteSource,mergeSourcedPages,MIN_QUOTE}=require('./workflows/scout-route-sources');
const {needsSource,retrieve,main}=require('./cli/scout-route-sources');
const {applyRouteNumberEvidence,sourcedRoutePages}=require('../scripts/route-number-evidence');

const at='2026-10-12T20:00:00.000Z';
const QUOTE='Il sentiero parte dalla chiesa di San Vito e sale al rifugio';
const PAGE=`<html><head><style>p{color:red}</style></head><body><h1>Sentiero 5</h1>
  <script>var x=1;</script><p>Il  sentiero parte dalla chiesa di San Vito e sale al rifugio.</p></body></html>`;
const trail=(overrides={})=>({id:'osm-1',name:'Anello di San Vito',valley:'Val di Zoldo',
  province:'belluno',region:'dolomites',routeRefs:['5'],...overrides});
const proposal=(overrides={})=>({found:true,url:'https://comune.sanvito.bl.it/sentiero-5',
  publisher:'Comune di San Vito',name:'Sentiero 5',quote:QUOTE,describesRoute:true,
  searched:'comune, park, CAI',...overrides});
const page=(body=PAGE)=>({ok:true,body});

describe('a find has to prove itself against the page it cites',()=>{
  const rule=(p,pg=page())=>confirmProposal(p,trail(),pg).rule;

  test('a real quote on a retrievable official page is confirmed',()=>{
    const verdict=confirmProposal(proposal(),trail(),page());
    expect(verdict.confirmed).toBe(true);
    expect(verdict.source).toEqual(expect.objectContaining({
      url:'https://comune.sanvito.bl.it/sentiero-5',publisher:'Comune di San Vito',trailId:'osm-1'}));
  });

  // The check that replaces a reviewer.
  test('a quote that is not on the page is dropped',()=>{
    expect(rule(proposal({quote:'Il sentiero parte dal parcheggio comunale del paese'})))
      .toBe('quote-is-not-on-the-page');
  });

  test('a page that cannot be retrieved is not evidence',()=>{
    expect(rule(proposal(),{ok:false,error:'HTTP 404'})).toBe('page-could-not-be-retrieved');
    expect(rule(proposal(),null)).toBe('page-could-not-be-retrieved');
  });

  test('an aggregator is not a route authority, whatever it contains',()=>{
    for(const host of ['wikiloc.com','alltrails.com','komoot.com','hiking.waymarkedtrails.org','outdooractive.com']){
      expect(rule(proposal({url:`https://${host}/route/5`}))).toBe('not-a-route-authority');
    }
  });

  test('finding nothing is an answer and is not an error',()=>{
    expect(rule(proposal({found:false,url:null,quote:null}))).toBe('no-page-found');
  });

  test('a page that only mentions the area is refused',()=>{
    expect(rule(proposal({describesRoute:false}))).toBe('page-does-not-describe-the-route');
  });

  test('http and a too-short quote are refused',()=>{
    expect(rule(proposal({url:'http://comune.sanvito.bl.it/x'}))).toBe('not-an-https-page');
    expect(rule(proposal({quote:'Il sentiero'}))).toBe('quote-too-short-to-prove-anything');
  });

  test('typography a CMS rewrites does not fail a true quote',()=>{
    expect(quoteIsInPage('l’escursione — parte dal paese',
      "<p>L'escursione - parte dal paese</p>")).toBe(true);
  });

  // Accents distinguish two different pages, so they are not normalised away.
  test('but an accent difference is a different page',()=>{
    expect(quoteIsInPage('le sentier du Lac Vert monte depuis le parking du village',
      '<p>Le sentier du Lac Vèrt monte depuis le parking du village</p>')).toBe(false);
  });

  test('script and style content cannot satisfy a quote',()=>{
    expect(readableText(PAGE)).not.toContain('var x=1');
    expect(normalise('  a   B  ')).toBe('a b');
  });

  test('the minimum quote is long enough to be evidence',()=>{
    expect(MIN_QUOTE).toBeGreaterThanOrEqual(20);
  });
});

describe('what the agent is asked',()=>{
  test('it is told the walk, the place and the number signed on the ground',()=>{
    const asked=prompt(trail({startPoint:{label:'San Vito church'},distance:6.2}))[1].content;
    expect(asked).toContain('Anello di San Vito');
    expect(asked).toContain('Val di Zoldo · belluno · dolomites');
    expect(asked).toContain('Route number(s) signed on the ground: 5');
    expect(asked).toContain('Recorded start: San Vito church');
  });

  test('the relation is given for identification and named as not the source',()=>{
    const asked=prompt(trail({waymarkedtrails:'https://hiking.waymarkedtrails.org/#route?id=1'}))[1].content;
    expect(asked).toContain('never as the source');
  });

  test('aggregators are ruled out in the instructions too, not only in code',()=>{
    expect(prompt(trail())[0].content).toMatch(/Wikiloc|AllTrails|Komoot/);
  });

  test('it searches the web',async()=>{
    let asked=null;
    await scoutRouteSource(trail(),{runAgent:async request=>{asked=request;
      return {model:'m',responseId:'r',data:proposal()};}});
    expect(asked.webSearch).toBe(true);
  });

  test('a trail with no id is refused rather than searched for',async()=>{
    await expect(scoutRouteSource({},{})).rejects.toThrow('A trail is required');
  });
});

describe('a confirmed page reaches the trail it was found for',()=>{
  test('the stored file is keyed by trail and sorted for a readable diff',()=>{
    const merged=mergeSourcedPages({sources:{'osm-9':{url:'https://b.example/x'}}},
      [{trailId:'osm-1',url:'https://comune.example/x',publisher:'Comune',name:'S5',quote:QUOTE}],{at});
    expect(Object.keys(merged.sources)).toEqual(['osm-1','osm-9']);
    expect(merged.sources['osm-1']).toEqual(expect.objectContaining({
      foundBy:'orma-route-source-scout',verifiedAt:at}));
  });

  test('and the build cites it as the official route page',()=>{
    const [result]=applyRouteNumberEvidence([trail()],'.',new Map(),
      new Map([['osm-1',{url:'https://comune.example/s5',publisher:'comune.example',name:'S5'}]]));
    expect(result.routeNumberStatus).toBe('official-route-page');
    expect(result.routeNumberSource.url).toBe('https://comune.example/s5');
  });

  // A trail that declares its own status keeps it; only the citation is added.
  test('a declared status is never overwritten',()=>{
    const [result]=applyRouteNumberEvidence([trail({routeNumberStatus:'official-numbered-route'})],'.',
      new Map(),new Map([['osm-1',{url:'https://comune.example/s5'}]]));
    expect(result.routeNumberStatus).toBe('official-numbered-route');
    expect(result.routeNumberSource.url).toBe('https://comune.example/s5');
  });

  test('an absent file is the normal state and reads as empty',()=>{
    expect(sourcedRoutePages(os.tmpdir()).size).toBe(0);
  });
});

describe('the pass end to end, with no network and no model',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'orma-scout-'));
  const waiting=[trail({id:'osm-1',sourceLinks:[
    {url:'https://hiking.waymarkedtrails.org/#route?id=1'}]})];
  const run=(overrides={})=>main({root,trails:waiting,argv:['--limit','1','--apply'],at,
    runAgent:async()=>({model:'m',responseId:'r',data:proposal()}),
    fetchImpl:async()=>({ok:true,status:200,text:async()=>PAGE}),...overrides});

  test('a confirmed find is written where the build will read it',async()=>{
    const result=await run();
    expect(result.confirmed).toHaveLength(1);
    const written=JSON.parse(fs.readFileSync(path.join(root,'data/route-sources.json'),'utf8'));
    expect(Object.keys(written.sources)).toEqual(['osm-1']);
    expect(written.sources['osm-1'].quote).toBe(QUOTE);
    expect(written.sources['osm-1'].url).toBe('https://comune.sanvito.bl.it/sentiero-5');
  });

  test('a dry run searches and fetches but writes nothing',async()=>{
    const bare=fs.mkdtempSync(path.join(os.tmpdir(),'orma-scout-dry-'));
    await main({root:bare,trails:waiting,argv:['--limit','1'],at,
      runAgent:async()=>({model:'m',responseId:'r',data:proposal()}),
      fetchImpl:async()=>({ok:true,status:200,text:async()=>PAGE})});
    expect(fs.existsSync(path.join(bare,'data/route-sources.json'))).toBe(false);
  });

  test('a dead page writes nothing, and says why',async()=>{
    const bare=fs.mkdtempSync(path.join(os.tmpdir(),'orma-scout-dead-'));
    const result=await main({root:bare,trails:waiting,argv:['--limit','1','--apply'],at,
      runAgent:async()=>({model:'m',responseId:'r',data:proposal()}),
      fetchImpl:async()=>({ok:false,status:404,text:async()=>''})});
    expect(result.confirmed).toEqual([]);
    expect(result.dropped[0].rule).toBe('page-could-not-be-retrieved');
    expect(fs.existsSync(path.join(bare,'data/route-sources.json'))).toBe(false);
  });

  test('a fetch that throws is a dropped find, not a crashed pass',async()=>{
    expect(await retrieve('https://nope.example/x',async()=>{throw new Error('getaddrinfo ENOTFOUND');}))
      .toEqual({ok:false,error:'getaddrinfo ENOTFOUND'});
  });

  test('it only scouts trails that cannot already cite a source',()=>{
    const ready={id:'r1',sourceLinks:[{url:'https://comune.example/x'}]};
    const bare={id:'b1',sourceLinks:[{url:'https://hiking.waymarkedtrails.org/#route?id=1'}]};
    expect(needsSource([ready,bare],{}).map(entry=>entry.id)).toEqual(['b1']);
  });

  test('and honours the region scope it was given',()=>{
    const dolo={id:'d1',region:'dolomites',sourceLinks:[]};
    const savoy={id:'s1',region:'savoy',sourceLinks:[]};
    expect(needsSource([dolo,savoy],{region:'dolomites'}).map(entry=>entry.id)).toEqual(['d1']);
  });
});

// An official route sheet is very often a PDF -- an alpine club magazine, a
// comune leaflet. 18 of the 60 finds in the first Dolomites sweep were refused
// as `quote-is-not-on-the-page`, and several were PDFs whose text could not be
// read at all, so a good authority was thrown away for the wrong reason.
describe('a quote in a PDF can be proved too',()=>{
  const zlib=require('zlib');
  const {pdfText,looksLikePdf,pdfLiteral,pdfHexString}=require('./workflows/scout-route-sources');

  /**
   * A real little PDF, built here rather than committed as a binary, so the
   * fixture is derived from the format instead of being a blob nobody can read.
   * `pieces` are the strings the page draws, which is what a writer emits.
   */
  const buildPdf=(pieces,{compress=true,hex=false}={})=>{
    const draw=pieces.map(text=>hex
      ?`<${Buffer.from(text,'latin1').toString('hex')}> Tj`
      :`(${text.replace(/([()\\])/g,'\\$1')}) Tj`).join('\n');
    const content=`BT /F1 12 Tf 72 700 Td\n${draw}\nET`;
    const stream=compress?zlib.deflateSync(Buffer.from(content,'latin1')):Buffer.from(content,'latin1');
    return Buffer.concat([
      Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n4 0 obj<</Length '
        +stream.length+(compress?'/Filter/FlateDecode':'')+'>>stream\n','latin1'),
      stream,
      Buffer.from('\nendstream\nendobj\ntrailer<</Root 1 0 R>>\n%%EOF\n','latin1'),
    ]);
  };

  const SENTENCE='Il sentiero parte dalla chiesa di San Vito e sale al rifugio';

  test('a sentence drawn as one string is found',()=>{
    const pdf=buildPdf([SENTENCE]);
    expect(looksLikePdf(pdf)).toBe(true);
    expect(quoteIsInPage(SENTENCE,pdf,'application/pdf')).toBe(true);
  });

  test('a sentence split per word is found',()=>{
    const pdf=buildPdf(SENTENCE.split(' '));
    expect(quoteIsInPage(SENTENCE,pdf,'application/pdf')).toBe(true);
  });

  // What the real alpenverein.it magazine does: every character drawn on its
  // own for kerning, so the spaced reading breaks every word.
  test('a sentence split mid-word for kerning is still found',()=>{
    const pdf=buildPdf(SENTENCE.split(''));
    expect(pdfText(pdf).spaced).not.toContain('sentiero');
    expect(quoteIsInPage(SENTENCE,pdf,'application/pdf')).toBe(true);
  });

  test('an uncompressed stream and a hex string are both read',()=>{
    expect(quoteIsInPage(SENTENCE,buildPdf([SENTENCE],{compress:false}),'application/pdf')).toBe(true);
    expect(quoteIsInPage(SENTENCE,buildPdf([SENTENCE],{hex:true}),'application/pdf')).toBe(true);
  });

  // The guarantee that matters: reading PDFs must not make it easier to pass.
  test('a quote that is not in the PDF is still refused',()=>{
    const pdf=buildPdf([SENTENCE]);
    expect(quoteIsInPage('Il sentiero parte dal parcheggio comunale del paese',pdf,'application/pdf')).toBe(false);
  });

  test('a PDF with no text at all proves nothing',()=>{
    const scanned=Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n','latin1');
    expect(pdfText(scanned)).toEqual({spaced:'',tight:''});
    expect(quoteIsInPage(SENTENCE,scanned,'application/pdf')).toBe(false);
  });

  test('an unreadable or encrypted document returns nothing rather than guessing',()=>{
    const noise=Buffer.concat([Buffer.from('%PDF-1.7\n','latin1'),
      Buffer.from('stream\n','latin1'),Buffer.from([0x01,0x02,0x03,0x04,0x05]),
      Buffer.from('\nendstream\n','latin1')]);
    expect(pdfText(noise).tight).toBe('');
  });

  test('something that is not a PDF is not treated as one',()=>{
    expect(looksLikePdf('<html><p>hello</p></html>')).toBe(false);
    expect(pdfText(Buffer.from('<html><p>hello</p></html>'))).toEqual({spaced:'',tight:''});
  });

  test('html is still read as html, not as a document',()=>{
    expect(quoteIsInPage(SENTENCE,`<p>${SENTENCE}.</p>`,'text/html')).toBe(true);
  });

  test('PDF string escapes and hex strings decode as the spec says',()=>{
    expect(pdfLiteral('a\\(b\\)c')).toBe('a(b)c');
    expect(pdfLiteral('a\\101b')).toBe('aAb');
    expect(pdfHexString('48656c6c6f')).toBe('Hello');
  });

  test('a PDF declared only by its content type is read',()=>{
    const pdf=buildPdf([SENTENCE]);
    expect(quoteIsInPage(SENTENCE,pdf,'application/pdf; charset=binary')).toBe(true);
  });
});
