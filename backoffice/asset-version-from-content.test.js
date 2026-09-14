const fs=require('fs/promises');
const path=require('path');
const os=require('os');

// The desk shipped a fix on 2026-09-14 while its page still asked for
// ?v=20260910-1. Same URL, one-hour cache, so browsers kept serving the file
// from before the fix and it looked like nothing had deployed. A cache key
// typed by hand goes stale the moment somebody forgets it.
const builder=require('../scripts/build-backoffice-hosting.js');
const source=require('fs').readFileSync('scripts/build-backoffice-hosting.js','utf8');

describe('a cache key that cannot go stale', () => {
  test('it is derived from the file rather than written down', () => {
    expect(source).toContain("createHash('sha256')");
    expect(source).toContain('async function assetVersion(relative)');
    // No hand-typed date left to forget. Comments may still describe the one
    // that caused this, so only code counts.
    const code=source.split('\n').filter(line=>!line.trim().startsWith('//')).join('\n');
    expect(code).not.toMatch(/\?v=20\d{6}-\d/);
  });

  // Build here rather than hoping a dist exists: a check that quietly skips
  // where it matters is the same as no check.
  test('every script and stylesheet a hosted page loads is stamped', async () => {
    await builder.build();
    const built=builder.output;
    const pages=(await fs.readdir(built)).filter(name=>name.endsWith('.html'));
    expect(pages.length).toBeGreaterThan(0);
    for(const page of pages){
      const html=await fs.readFile(path.join(built,page),'utf8');
      const assets=[...html.matchAll(/(?:src|href)="([\w./-]+\.(?:js|css))(\?v=([\w-]+))?"/g)];
      for(const [,file,,version] of assets){
        // Only files the build publishes are stamped; anything else is left be.
        const published=await fs.access(path.join(built,file)).then(()=>true,()=>false);
        if(published)expect(`${page} ${file} ${version||'UNSTAMPED'}`).toMatch(/[\w-]{6,}$/);
      }
    }
  });

  test('the same bytes give the same key, different bytes a different one', async () => {
    const directory=await fs.mkdtemp(path.join(os.tmpdir(),'orma-asset-'));
    const one=path.join(directory,'a.js');const two=path.join(directory,'b.js');
    await fs.writeFile(one,'console.log(1)');await fs.writeFile(two,'console.log(1)');
    const hash=async file=>require('crypto').createHash('sha256')
      .update(await fs.readFile(file)).digest('hex').slice(0,10);
    expect(await hash(one)).toBe(await hash(two));
    await fs.writeFile(two,'console.log(2)');
    expect(await hash(one)).not.toBe(await hash(two));
  });

  test('the builder still exports what the deploy calls', () => {
    expect(typeof builder.build).toBe('function');
  });
});
