#!/usr/bin/env node
'use strict';

// Read-only. The photo backfill queues nothing while the number of "occupied"
// trails is at or above capacity, and the occupancy number alone does not say
// which of the three sources is holding the slots. This breaks it down so the
// backlog can be cleared rather than guessed at.

const path=require('path');
const {FirestoreBackofficeStore}=require('../services/firestore-backoffice-store');
const {auditImageCoverage}=require('../workflows/audit-image-coverage');
const {DEFAULT_IMAGE_SOURCING_CAPACITY}=require('../workflows/hosted-image-coverage');

function tally(list,key){
  const counts=new Map();
  for(const item of list)counts.set(item[key]||'(none)',(counts.get(item[key]||'(none)')||0)+1);
  return [...counts.entries()].sort((a,b)=>b[1]-a[1]);
}

async function buildImageOccupancyReport({store,root,at=new Date().toISOString()}){
  const audit=await auditImageCoverage(root,{at});
  const gapSlugs=new Set(audit.gaps.map(gap=>gap.slug));
  const [jobs,results,requests]=await Promise.all([
    store.listJobs(['queued','running','ready-for-review']),
    store.getArtifact('image-coverage-results'),
    store.getArtifact('trail-image-publication-requests'),
  ]);

  const sourcingJobs=(jobs||[]).filter(job=>job.jobType==='hosted-image-sourcing'&&gapSlugs.has(job.slug));
  const awaitingPreview=(results?.items||[]).filter(item=>gapSlugs.has(item.slug)
    &&(item.candidates||[]).some(candidate=>candidate.status==='ready-for-asset-review'));
  const openRequests=(requests?.requests||[]).filter(request=>gapSlugs.has(request.trailId)&&request.status!=='published');

  const occupied=new Set([
    ...sourcingJobs.map(job=>job.slug),
    ...awaitingPreview.map(item=>item.slug),
    ...openRequests.map(request=>request.trailId),
  ]);

  // A slot held by an uploaded photo that only needs one approval is very different
  // from one held by a stuck job, so separate them.
  const uploads=awaitingPreview.filter(item=>(item.candidates||[])
    .some(candidate=>candidate.status==='ready-for-asset-review'&&candidate.uploadRef));

  return {
    generatedAt:at,capacity:DEFAULT_IMAGE_SOURCING_CAPACITY,
    gaps:audit.gaps.length,occupied:occupied.size,
    freeSlots:Math.max(0,DEFAULT_IMAGE_SOURCING_CAPACITY-occupied.size),
    holders:{
      sourcingJobs:sourcingJobs.length,
      awaitingPreview:awaitingPreview.length,
      awaitingPreviewFromYourUploads:uploads.length,
      openPublicationRequests:openRequests.length,
    },
    jobsByStatus:tally(sourcingJobs,'status'),
    jobsByPreference:tally(sourcingJobs,'sourcePreference'),
    requestsByStatus:tally(openRequests,'status'),
    sampleAwaitingPreview:awaitingPreview.slice(0,15).map(item=>item.slug),
    sampleSourcingJobs:sourcingJobs.slice(0,15).map(job=>({slug:job.slug,status:job.status,
      sourcePreference:job.sourcePreference,failures:job.systemFailures||0,lastError:(job.lastError||'').slice(0,120)})),
  };
}

async function main(options={}){
  const store=options.store||new FirestoreBackofficeStore();
  const root=options.root||path.resolve(__dirname,'../..');
  const report=await buildImageOccupancyReport({store,root,at:options.at});
  console.log(JSON.stringify(report,null,2));
  console.log(`\n[image-occupancy] ${report.occupied} of ${report.gaps} gap trails hold a slot; capacity ${report.capacity}; ${report.freeSlots} free.`);
  console.log(`[image-occupancy] ${report.holders.awaitingPreview} wait on your preview approval (${report.holders.awaitingPreviewFromYourUploads} of them your own uploads), ${report.holders.sourcingJobs} sit in agent jobs, ${report.holders.openPublicationRequests} in open publication requests.`);
  console.log('[image-occupancy] Nothing was changed.');
  return report;
}

if(require.main===module)main().catch(error=>{console.error(`[image-occupancy] ${error.stack||error.message}`);process.exitCode=1;});

module.exports={tally,buildImageOccupancyReport,main};
