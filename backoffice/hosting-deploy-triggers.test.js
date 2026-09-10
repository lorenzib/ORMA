const fs=require('fs');

// trail-verify-desk.js was in the publish list and in no trigger path, so a
// change to the desk alone never deployed: #358 merged at 12:49 and the last
// deploy was 12:27. Every desk change since has shipped only by riding along
// with some other watched file, or not at all. Publishing a file and never
// noticing it changed are the same bug twice.
const workflow=fs.readFileSync('.github/workflows/deploy-backoffice-hosting.yml','utf8');
const builder=fs.readFileSync('scripts/build-backoffice-hosting.js','utf8');

function triggerPaths(){
  return [...workflow.matchAll(/^\s+- ([\w@./*-]+)$/gm)].map(match=>match[1]);
}

/** Everything the build copies or renders into the hosted site. */
function publishedFiles(){
  const listed=[...builder.matchAll(/'([\w@./-]+\.(?:js|css|png|svg))'/g)].map(match=>match[1]);
  const pages=[...builder.matchAll(/hostedPage\('([\w@./-]+\.html)'/g)].map(match=>match[1]);
  return [...new Set([...listed,...pages])];
}

function covered(file,paths){
  return paths.some(pattern=>{
    if(pattern===file)return true;
    if(!pattern.includes('*'))return false;
    const expression=new RegExp(`^${pattern.split('*').map(part=>part.replace(/[.+?^${}()|[\]\\]/g,'\\$&')).join('[^/]*')}$`);
    return expression.test(file);
  });
}

describe('every hosted file deploys when it changes', () => {
  test('the builder and the workflow are both readable as lists', () => {
    expect(publishedFiles().length).toBeGreaterThan(10);
    expect(triggerPaths().length).toBeGreaterThan(10);
  });

  test('nothing is published that no trigger path watches', () => {
    const paths=triggerPaths();
    const unwatched=publishedFiles().filter(file=>!covered(file,paths));
    expect(unwatched).toEqual([]);
  });

  test('the desk that this was found on is watched by name', () => {
    const paths=triggerPaths();
    expect(covered('trail-verify-desk.js',paths)).toBe(true);
    expect(covered('trail-verify-desk.html',paths)).toBe(true);
  });

  // Both the deploy job and the gate that guards it read the same list.
  test('the pull-request and push triggers watch the same files', () => {
    const blocks=workflow.split('paths:').slice(1)
      .map(block=>[...block.matchAll(/^\s+- ([\w@./*-]+)$/gm)].map(match=>match[1]));
    expect(blocks.length).toBeGreaterThanOrEqual(2);
    expect(blocks[0]).toEqual(blocks[1]);
  });
});
