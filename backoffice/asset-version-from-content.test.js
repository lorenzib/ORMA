const fs=require('fs/promises');
const path=require('path');
const os=require('os');
const {assetVersion,stampAssets}=require('../scripts/build-backoffice-hosting.js');
const source=require('fs').readFileSync('scripts/build-backoffice-hosting.js','utf8');

// The desk deployed a fix at 16:19 on 2026-09-14 while its page still asked for
// trail-verify-desk.js?v=20260910-1. Same URL, one-hour cache, so a browser
// served the file from before the fix and it looked like nothing had shipped.
// A cache key written by hand goes stale the moment somebody forgets it, and
// forgetting is invisible: the deploy succeeds and the tester gets old code.
//
// These exercise the stamping directly rather than building, because the build
// writes into a directory another suite reads and jest runs suites in parallel.

describe('the key is derived from the file', () => {
  test('no hand-typed version is left in the builder', () => {
    const code=source.split('\n').filter(line=>!line.trim().startsWith('//')&&!line.trim().startsWith('*')).join('\n');
    expect(code).not.toMatch(/\?v=20\d{6}-\d/);
    expect(source).toContain("createHash('sha256')");
  });

  test('the same bytes give the same key, different bytes a different one', async () => {
    const directory=await fs.mkdtemp(path.join(os.tmpdir(),'orma-asset-'));
    const write=async(name,body)=>{const file=path.join(directory,name);await fs.writeFile(file,body);return file;};
    await write('a.js','console.log(1)');await write('b.js','console.log(1)');
    const relative=name=>path.relative(process.cwd(),path.join(directory,name));
    expect(await assetVersion(relative('a.js'))).toBe(await assetVersion(relative('b.js')));
    await write('b.js','console.log(2)');
    expect(await assetVersion(relative('a.js'))).not.toBe(await assetVersion(relative('b.js')));
  });

  test('a key is short enough to read and long enough to differ', async () => {
    const directory=await fs.mkdtemp(path.join(os.tmpdir(),'orma-asset-'));
    await fs.writeFile(path.join(directory,'a.js'),'x');
    const version=await assetVersion(path.relative(process.cwd(),path.join(directory,'a.js')));
    expect(version).toMatch(/^[0-9a-f]{10}$/);
  });
});

describe('every reference on a page is stamped', () => {
  const versions=new Map([
    ['backoffice-firebase.js','aaaaaaaaaa'],
    ['trail-verify-desk.js','bbbbbbbbbb'],
    ['backoffice-review.css','cccccccccc'],
    ['backoffice/dashboard-model.js','dddddddddd'],
  ]);

  test('a script, a stylesheet and a path-qualified file all get one', () => {
    const html=stampAssets(['<script src="trail-verify-desk.js"></script>',
      '<link rel="stylesheet" href="backoffice-review.css">',
      '<script src="backoffice/dashboard-model.js"></script>'].join('\n'),versions);
    expect(html).toContain('trail-verify-desk.js?v=bbbbbbbbbb');
    expect(html).toContain('backoffice-review.css?v=cccccccccc');
    expect(html).toContain('backoffice/dashboard-model.js?v=dddddddddd');
  });

  test('an existing stale version is replaced, not appended', () => {
    const html=stampAssets('<script src="trail-verify-desk.js?v=20260910-1"></script>',versions);
    expect(html).toContain('trail-verify-desk.js?v=bbbbbbbbbb');
    expect(html).not.toContain('20260910-1');
  });

  test('the public Firebase module becomes the backoffice one', () => {
    expect(stampAssets('<script type="module" src="firebase-init.js"></script>',versions))
      .toContain('src="backoffice-firebase.js?v=aaaaaaaaaa"');
  });

  test('a file the build does not publish is left alone', () => {
    const html=stampAssets('<script src="https://cdn.example.org/thing.js"></script>',versions);
    expect(html).toContain('https://cdn.example.org/thing.js');
    expect(html).not.toContain('?v=');
  });
});
