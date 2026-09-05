'use strict';

const path=require('path');
const {refreshTrailPhotoBackfill}=require('./workflows/run-live-backoffice-worker');
const {PUBLISHED_TRAIL_PHOTO_DIRECTORY}=require('./workflows/audit-image-coverage');

describe('trail-photo backfill inside the worker pass',()=>{
  const root=path.resolve(__dirname,'..');

  function store(){
    const artifacts=new Map();const jobs=[];
    return {artifacts,jobs,
      getArtifact:async id=>artifacts.get(id)??null,
      setArtifact:async(id,value)=>{artifacts.set(id,value);},
      listJobs:async()=>[],
      putJobIfAbsent:async job=>{jobs.push(job);return true;}};
  }

  test('a photo already published for one trail is never offered to another',async()=>{
    const {auditImageCoverage}=require('./workflows/audit-image-coverage');
    expect(PUBLISHED_TRAIL_PHOTO_DIRECTORY).toBe('trails');
    const audit=await auditImageCoverage(root,{at:'2026-09-05T10:00:00Z'});
    const offered=audit.gaps.flatMap(gap=>gap.libraryMatches.map(match=>match.sourceRef));
    expect(offered.length).toBeGreaterThan(0);
    expect(offered.filter(ref=>String(ref).startsWith('images/trails/'))).toEqual([]);
  });

  test('scans the catalogue, writes the audit and queues scouting for the gaps',async()=>{
    const target=store();
    const result=await refreshTrailPhotoBackfill(target,{root,at:'2026-09-05T10:00:00Z',imageSourcingCapacity:3});
    expect(result.status).toBe('running');
    expect(result.trailsScanned).toBeGreaterThan(0);
    expect(target.artifacts.get('image-coverage').mode).toBe('trail-photo-coverage-audit');
    expect(target.jobs).toHaveLength(3);
    expect(target.jobs.every(job=>job.jobType==='hosted-image-sourcing'&&job.sourcePreference==='find-licensed')).toBe(true);
  });

  test('reports complete and queues nothing once every trail has a photo',async()=>{
    const target=store();
    const covered=[{id:'seceda',name:'Seceda',region:'dolomites',imageIcon:'images/trails/seceda.jpg'}];
    const result=await refreshTrailPhotoBackfill(target,{root,at:'2026-09-05T10:00:00Z',productionTrails:covered});
    expect(result.status).toBe('complete');
    expect(result.missing).toBe(0);
    expect(target.jobs).toHaveLength(0);
  });

  test('a failed scan is reported, not thrown, so the rest of the pass still runs',async()=>{
    const target=store();
    target.setArtifact=async()=>{throw new Error('Firestore is unavailable');};
    const result=await refreshTrailPhotoBackfill(target,{root,at:'2026-09-05T10:00:00Z'});
    expect(result.status).toBe('failed');
    expect(result.error).toContain('Firestore is unavailable');
  });
});
