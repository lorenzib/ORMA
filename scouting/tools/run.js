// Dry-run wrapper around origin/main scripts/build-board-line.js (never --apply).
// usage: node run.js <repoDir> <tileCacheDir> <oaHtml> -- <builder args...>
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const [repo,cache,oaHtml]=process.argv.slice(2,5);
const argv=process.argv.slice(process.argv.indexOf('--')+1).filter(a=>a!=='--apply');
const B=require(path.join(repo,'scripts','build-board-line.js'));
const UA='ORMA/1.0 (github lorenzib/ORMA; board-line builder)';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let last=0;
async function getJson(url){
  const f=path.join(cache,crypto.createHash('md5').update(url).digest('hex')+'.json');
  if(fs.existsSync(f)) return JSON.parse(fs.readFileSync(f,'utf8'));
  for(let i=0;i<6;i++){
    const wait=1100-(Date.now()-last); if(wait>0) await sleep(wait); last=Date.now();
    const r=await fetch(url,{headers:{'User-Agent':UA}});
    if(r.ok){const t=await r.text(); fs.writeFileSync(f,t); return JSON.parse(t);}
    if(r.status===509||r.status===429||r.status>=500){await sleep(15000*(i+1));continue;}
    throw new Error(url+' '+r.status);
  }
  throw new Error('gave up '+url);
}
(async()=>{
  const res=await B.main({argv,fetchText:async()=>fs.readFileSync(oaHtml,'utf8'),fetchJson:getJson,pauseMs:0,routesPath:path.join(repo,'data','board-line-routes.geojson')});
  if(res&&res.feature) fs.writeFileSync(process.env.OUT||'/dev/null',JSON.stringify(res.feature));
  if(res&&res.verdict) console.log('VERDICT',JSON.stringify({gc:res.verdict.guideCovered,lc:res.verdict.lineCovered,km:res.verdict.km,keep:res.verdict.keep}));
  if(res&&res.shape) console.log('SHAPE',JSON.stringify({kind:res.shape.kind,overlap:res.shape.overlap}));
  console.log('STATUS',res&&res.status);
})().catch(e=>{console.error(e.stack);process.exit(1)});
