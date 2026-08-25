#!/usr/bin/env node
'use strict';

const fs = require('fs/promises');
const path = require('path');
const { runProductDiscovery } = require('../workflows/run-product-discovery');
const { auditImageCoverage } = require('../workflows/audit-image-coverage');
const { planContentOperations } = require('../workflows/plan-content-operations');
const { planNewTrailScouting } = require('../workflows/plan-new-trail-scouting');
const { runEditorialCycle } = require('../workflows/run-editorial-cycle');
const { runNewsletter, newsletterIsDue } = require('../workflows/run-newsletter');
const { loadProductionTrails } = require('../../scripts/load-production-trails');

async function readJson(file){ try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(error){if(error.code==='ENOENT')return null;throw error;} }
async function writeJson(file,value){await fs.writeFile(file,`${JSON.stringify(value,null,2)}\n`,'utf8');}

async function main(options = {}){
  const root=options.root||path.resolve(__dirname,'..','..');const data=path.join(root,'backoffice-data');const at=options.at||new Date().toISOString();
  const newsletterEnabled=options.newsletterEnabled===true;
  const productPath=path.join(data,'product-ideas.json');const existing=await readJson(productPath);
  const age=existing?.generatedAt?new Date(at).getTime()-new Date(existing.generatedAt).getTime():Infinity;
  let productStatus='still-fresh';
  if(age>=6.5*24*60*60*1000){
    try{const packet=await runProductDiscovery({at});await writeJson(productPath,packet);productStatus=`${packet.summary.total} ideas refreshed`;}
    catch(error){productStatus=`blocked: ${error.message}`;}
  }
  const libraryConfig=await readJson(path.join(data,'image-library-config.local.json'));
  const audit=await auditImageCoverage(root,{at,personalLibraryPath:libraryConfig?.folderPath});await writeJson(path.join(data,'image-coverage.json'),audit);
  const sources=await Promise.all([
    readJson(path.join(root,'dog-friendly-routes.geojson')).then(source=>({region:'dolomites',data:source})),
    readJson(path.join(root,'dog-friendly-routes-savoy.geojson')).then(source=>({region:'savoy',data:source})),
  ]);
  const scouting=planNewTrailScouting(sources,loadProductionTrails(root),{at,limit:25});await writeJson(path.join(data,'new-trail-scouting.json'),scouting);
  const contentPlan=planContentOperations({asOf:at,at,newsletterEnabled});await writeJson(path.join(data,'content-operations.json'),contentPlan);
  const editorial=await (options.runEditorialCycle||runEditorialCycle)(root,{at,limit:3,...(options.editorialOptions||{})});
  const [ledger,publication,hazards,ideas]=await Promise.all([
    readJson(path.join(data,'editorial-ledger.json')),
    readJson(path.join(data,'publication-staging.json')),
    readJson(path.join(root,'data','dynamic-hazards.json')),
    readJson(productPath),
  ]);
  const cutoff=new Date(at).getTime()-14*24*60*60*1000;
  const newsletterInputs={contractVersion:'1.0.0',generatedAt:at,issueCadence:'every-14-days-after-launch',status:newsletterEnabled?'ready-for-newsletter-agent':'parked-awaiting-content-readiness',publicMutationAllowed:false,
    newlyPublishedTrails:(publication?.items||[]).filter(item=>['published','deployed'].includes(item.state)||item.status==='published'),
    publishedEditorialChanges:(ledger?.items||[]).filter(item=>item.status==='published'&&new Date(item.lastPublishedAt||0).getTime()>=cutoff),
    timelySafetySignals:(hazards?.hazards||[]).filter(item=>item.state==='active').map(item=>({title:item.title,area:item.area,sourceLabel:item.sourceLabel,sourceUrl:item.sourceUrl,expiresAt:item.expiresAt,note:'Topic signal only; do not describe as a trail closure.'})),
    currentEditorialSignals:(ideas?.ideas||[]).filter(item=>item.category==='editorial-gap'),
    policy:'Use only approved ORMA facts and directly linked current sources. One assembled issue receives one CEO review.'};
  await writeJson(path.join(data,'newsletter-inputs.json'),newsletterInputs);
  const newsletterPacketPath=path.join(data,'newsletter-review-packet.json');
  const [newsletterPacket,newsletterReview]=await Promise.all([readJson(newsletterPacketPath),readJson(path.join(data,'newsletter-review.json'))]);
  let newsletterStatus=newsletterEnabled?'not due':'parked until content readiness';
  if(newsletterEnabled&&newsletterIsDue(newsletterPacket,newsletterReview,at)){
    const next=await (options.runNewsletter||runNewsletter)(newsletterInputs,{root,at,...(options.newsletterOptions||{})});
    await writeJson(newsletterPacketPath,next);
    newsletterStatus=next.summary.readyForReview?'draft ready':`blocked: ${next.outputs[0]?.error||'no draft produced'}`;
  }
  console.log(`[strategy-cycle] Product discovery: ${productStatus}.`);
  console.log(`[strategy-cycle] Trail-photo coverage: ${audit.summary.missing} gaps across ${audit.summary.trailsScanned} published trails.`);
  console.log(`[strategy-cycle] New Trail scouting: ${scouting.summary.candidates} candidates ranked.`);
  console.log(`[strategy-cycle] Editorial: ${editorial.preserved.length} preserved, ${editorial.generated.length} generated, ${editorial.blocked.length} blocked.`);
  console.log(`[strategy-cycle] Newsletter inputs: ${newsletterInputs.newlyPublishedTrails.length} trails, ${newsletterInputs.publishedEditorialChanges.length} editorial changes, ${newsletterInputs.timelySafetySignals.length} timely signals.`);
  console.log(`[strategy-cycle] Newsletter: ${newsletterStatus}.`);
  console.log('[strategy-cycle] Review packets updated. Nothing was published.');
  return {productStatus,audit,scouting,contentPlan,editorial,newsletterInputs,newsletterStatus};
}

if(require.main===module)main().catch(error=>{console.error(`[strategy-cycle] ${error.message}`);process.exitCode=1;});

module.exports={main};
