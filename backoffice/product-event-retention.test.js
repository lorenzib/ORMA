const {cutoffIso,pruneProductEvents}=require('./cli/prune-product-events');

function fakeDb(records){
  const state=new Map(records.map(record=>[record.id,record]));
  return {
    state,
    collection(name){
      expect(name).toBe('productEvents');
      let cutoff='';let cap=400;
      return {
        where(field,operator,value){expect([field,operator]).toEqual(['occurredHour','<']);cutoff=value;return this;},
        orderBy(field,direction){expect([field,direction]).toEqual(['occurredHour','asc']);return this;},
        limit(value){cap=value;return this;},
        async get(){
          const docs=[...state.values()].filter(item=>item.occurredHour<cutoff).sort((a,b)=>a.occurredHour.localeCompare(b.occurredHour)).slice(0,cap)
            .map(item=>({id:item.id,ref:{id:item.id}}));
          return {docs,size:docs.length,empty:docs.length===0};
        },
      };
    },
    batch(){
      const ids=[];
      return {delete(ref){ids.push(ref.id);},async commit(){ids.forEach(id=>state.delete(id));}};
    },
  };
}

describe('product event retention',()=>{
  test('uses the same coarse 30-day boundary as the client queue',()=>{
    expect(cutoffIso('2026-09-10T14:37:00.000Z')).toBe('2026-08-11T14:00:00.000Z');
  });

  test('deletes only expired product events in bounded batches',async()=>{
    const db=fakeDb([
      {id:'old-1',occurredHour:'2026-08-01T10:00:00.000Z'},
      {id:'old-2',occurredHour:'2026-08-10T10:00:00.000Z'},
      {id:'current',occurredHour:'2026-09-01T10:00:00.000Z'},
    ]);
    const result=await pruneProductEvents(db,{at:'2026-09-10T14:37:00.000Z',batchSize:1,maxBatches:5});
    expect(result).toEqual(expect.objectContaining({deleted:2,batches:2,capped:false}));
    expect([...db.state.keys()]).toEqual(['current']);
  });
});
