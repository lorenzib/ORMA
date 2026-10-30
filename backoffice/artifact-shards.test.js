'use strict';

const fs=require('fs');
const path=require('path');
const {
  FirestoreBackofficeStore, SHARDED_ARTIFACT_ENCODING, ARTIFACT_DATA_ENCODING,
  SHARD_BYTES, MAX_ARTIFACT_SHARDS, shardDocumentId, splitUtf8,
} = require('./services/firestore-backoffice-store');

/**
 * dossier-review-queue outgrew one Firestore property when the catalogue
 * passed 400 trails (30 October 2026). The store writes an artifact over
 * SHARD_BYTES in pieces and reads it back whole, so nothing that reads the
 * queue changes. These hold the parts that would go wrong quietly: a piece
 * cut through a character, a reader joining two writes, and spare pieces
 * left to be read as current.
 */

// Firestore, as far as the store uses it for artifacts: documents by id,
// batched writes that land together, and getAll.
function memoryDb(){
  const docs=new Map();
  const ref=id=>({id,
    get:async()=>({exists:docs.has(id),data:()=>docs.get(id)}),
    set:async(value,options={})=>{docs.set(id,options.merge?{...(docs.get(id)||{}),...value}:value);},
  });
  const db={docs,settings(){},
    collection:()=>({doc:ref}),
    getAll:async(...refs)=>Promise.all(refs.map(item=>item.get())),
    batch(){
      const ops=[];
      return {
        set:(item,value,options)=>ops.push(()=>item.set(value,options)),
        delete:item=>ops.push(()=>docs.delete(item.id)),
        commit:async()=>{for(const op of ops)await op();},
      };
    },
  };
  return db;
}

// A queue-shaped artifact of about `bytes` bytes, with multi-byte letters
// throughout so some cut falls inside a character unless the split steps back.
function bigQueue(bytes){
  const item=index=>({reviewId:`r-${index}`,name:`Sentiero dei masi à Völs ${index}`,notes:'Ötzi è già passato '.repeat(20)});
  const items=[];let size=0;
  for(let index=0;size<bytes;index+=1){const next=item(index);items.push(next);size+=JSON.stringify(next).length;}
  return {contractVersion:'1.0.0',items};
}

describe('an artifact larger than one Firestore property',()=>{
  test('a small artifact is still one document, exactly as before',async()=>{
    const db=memoryDb();
    await new FirestoreBackofficeStore({db}).setArtifact('dossier-review-queue',{items:[]});
    expect(db.docs.get('dossier-review-queue').dataEncoding).toBe(ARTIFACT_DATA_ENCODING);
    expect(db.docs.has(shardDocumentId('dossier-review-queue',1))).toBe(false);
  });

  test('is written in pieces under the limit and read back whole by a fresh store',async()=>{
    const db=memoryDb();
    const queue=bigQueue(SHARD_BYTES*2.4);
    await new FirestoreBackofficeStore({db}).setArtifact('dossier-review-queue',queue);
    const head=db.docs.get('dossier-review-queue');
    expect(head.dataEncoding).toBe(SHARDED_ARTIFACT_ENCODING);
    expect(head.shardCount).toBe(3);
    for(const id of ['dossier-review-queue',shardDocumentId('dossier-review-queue',1),shardDocumentId('dossier-review-queue',2)])
      expect(Buffer.byteLength(db.docs.get(id).data,'utf8')).toBeLessThanOrEqual(SHARD_BYTES);
    expect(await new FirestoreBackofficeStore({db}).getArtifact('dossier-review-queue')).toEqual(queue);
  });

  test('never cuts a piece through a character',()=>{
    const text='aé'.repeat(10);
    const pieces=splitUtf8(text,4);
    expect(pieces.join('')).toBe(text);
    for(const piece of pieces)expect(Buffer.byteLength(piece,'utf8')).toBeLessThanOrEqual(4);
  });

  test('a reader that meets two writes reads again, and refuses rather than join them',async()=>{
    const db=memoryDb();
    await new FirestoreBackofficeStore({db}).setArtifact('dossier-review-queue',bigQueue(SHARD_BYTES*1.5));
    const shard=shardDocumentId('dossier-review-queue',1);
    db.docs.set(shard,{...db.docs.get(shard),shardToken:'another-write'});
    await expect(new FirestoreBackofficeStore({db}).getArtifact('dossier-review-queue'))
      .rejects.toThrow('split across documents from different writes');
  });

  test('a write that shrinks drops the pieces it no longer uses',async()=>{
    const db=memoryDb();
    const store=new FirestoreBackofficeStore({db});
    await store.setArtifact('dossier-review-queue',bigQueue(SHARD_BYTES*2.4));
    await store.setArtifact('dossier-review-queue',{items:[]});
    expect(db.docs.has(shardDocumentId('dossier-review-queue',1))).toBe(false);
    expect(db.docs.has(shardDocumentId('dossier-review-queue',2))).toBe(false);
    expect(await new FirestoreBackofficeStore({db}).getArtifact('dossier-review-queue')).toEqual({items:[]});
  });

  test('past the last piece it refuses the write instead of losing the end',async()=>{
    const db=memoryDb();
    await expect(new FirestoreBackofficeStore({db}).setArtifact('x',bigQueue(SHARD_BYTES*(MAX_ARTIFACT_SHARDS+0.5))))
      .rejects.toThrow(RangeError);
    expect(db.docs.size).toBe(0);
  });

  // The desk reads artifacts in the browser through its own module, which
  // imports Firebase from the CDN and cannot run here; read its source instead.
  test('the desk reads the pieces too',()=>{
    const source=fs.readFileSync(path.join(__dirname,'..','backoffice-firebase.js'),'utf8');
    expect(source).toContain(`'${SHARDED_ARTIFACT_ENCODING}'`);
    expect(source).toContain('~shard-${index+1}');
    expect(source).toMatch(/shardToken!==head\.shardToken/);
  });
});
