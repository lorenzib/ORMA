const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { writePublicSnapshot, publicSnapshot } = require('./workflows/hazard-snapshot');

const warning = (id, extra) => ({ id, state:'active', severity:'severe', title:`${id} warning`, expiresAt:'2026-09-11T00:00:00+00:00', ...extra });

async function tmpRoot(previous){
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'orma-hazard-snapshot-'));
  if(previous){
    await fs.mkdir(path.join(root, 'data'), { recursive:true });
    await fs.writeFile(path.join(root, 'data', 'dynamic-hazards.json'), `${JSON.stringify(previous, null, 2)}\n`);
  }
  return root;
}

describe('the public warning snapshot', () => {
  test('carries only the public contract, never the protection flag', () => {
    const snapshot = publicSnapshot({ contractVersion:'1.0.0', generatedAt:'2026-09-10T10:00:00.000Z', hazards:[warning('a')], publicMutationAllowed:false });
    expect(Object.keys(snapshot)).toEqual(['contractVersion', 'generatedAt', 'hazards']);
  });

  test('is left alone when only the timestamp moved', async () => {
    const previous = { contractVersion:'1.0.0', generatedAt:'2026-09-08T13:07:04.685Z', hazards:[warning('a')] };
    const root = await tmpRoot(previous);
    const result = await writePublicSnapshot(root, { ...previous, generatedAt:'2026-09-10T10:00:00.000Z', publicMutationAllowed:false });
    expect(result.changed).toBe(false);
    const onDisk = JSON.parse(await fs.readFile(path.join(root, 'data', 'dynamic-hazards.json'), 'utf8'));
    expect(onDisk.generatedAt).toBe('2026-09-08T13:07:04.685Z');
  });

  test('is rewritten when the warning set changes', async () => {
    const root = await tmpRoot({ contractVersion:'1.0.0', generatedAt:'2026-09-08T13:07:04.685Z', hazards:[warning('a'), warning('b')] });
    const result = await writePublicSnapshot(root, { contractVersion:'1.0.0', generatedAt:'2026-09-10T10:00:00.000Z', hazards:[warning('a', { expiresAt:'2026-09-12T00:00:00+00:00' })], publicMutationAllowed:false });
    expect(result).toMatchObject({ changed:true, hazards:1 });
    const onDisk = JSON.parse(await fs.readFile(result.file, 'utf8'));
    expect(onDisk).toEqual({ contractVersion:'1.0.0', generatedAt:'2026-09-10T10:00:00.000Z', hazards:[warning('a', { expiresAt:'2026-09-12T00:00:00+00:00' })] });
    expect(onDisk.publicMutationAllowed).toBeUndefined();
  });

  test('is created when no snapshot exists yet', async () => {
    const root = await tmpRoot(null);
    const result = await writePublicSnapshot(root, { hazards:[warning('a')] });
    expect(result.changed).toBe(true);
    expect(JSON.parse(await fs.readFile(result.file, 'utf8')).hazards).toHaveLength(1);
  });
});
