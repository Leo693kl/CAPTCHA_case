import test from 'node:test';
import assert from 'node:assert/strict';
import seed from '../src/data/crm.json' with {type:'json'};
import demo from '../docs/plans/demo-interview.json' with {type:'json'};
import {crmApi} from '../src/api/crmApi.ts';
const key='decision-radar-v1', crmKey='decision-radar-simulated-crm-v1', today='2026-11-19';
function memory(){const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};return storage;}
for(const brokenKey of [key,crmKey])test(`incomplete ${brokenKey} is preserved and falls back before React`,async()=>{
 const storage=memory(),raw='{"snapshots":[]}';storage.set(brokenKey,raw);const notices=[];
 const loaded=await crmApi.load(message=>notices.push(message));assert.deepEqual(loaded,seed);
 assert.ok(notices.join(' ').includes('Неполная')&&notices.join(' ').includes('сохранена'));
 assert.ok([...storage].some(([k,v])=>k.startsWith(brokenKey+':recovery:')&&v===raw));
 assert.ok(storage.get(brokenKey)!==raw);assert.deepEqual(await crmApi.load(),seed);
});
test('malformed nested records and invalid JSON cannot reach React; intact legacy data is retained',async()=>{
 const storage=memory();for(const raw of ['{',JSON.stringify({...seed,people:[{id:'broken'}]}),JSON.stringify({...seed,interactions:[{...seed.interactions[0],evidence:{kind:'interview',sourceLabel:'test',sourceExcerpt:'test',preferences:{topics:42}}}]})]){
  storage.set(key,raw);assert.deepEqual(await crmApi.load(),seed);assert.ok([...storage.values()].includes(raw));
 }
 const legacy=structuredClone(seed);delete legacy.snapshots;storage.set(key,JSON.stringify(legacy));
 const loaded=await crmApi.load();assert.deepEqual(loaded.people,legacy.people);assert.ok(loaded.snapshots.length);assert.equal(storage.get(key),JSON.stringify(legacy));
});
test('failed recovery backup retains the original bytes and still opens safe data',async()=>{
 const storage=memory();const raw='{"snapshots":[]}';storage.set(key,raw);localStorage.setItem=()=>{throw Error('quota')};const notices=[];
 assert.deepEqual(await crmApi.load(m=>notices.push(m)),seed);assert.equal(storage.get(key),raw);assert.ok(notices.join('').includes('оставлена'));
});
test('two independent tab states sharing one storage keep both interviews and a stale retry keeps its ID',async()=>{
 const storage=memory();let tabA=await crmApi.load(),tabB=await crmApi.load();assert.notEqual(tabA,tabB);
 const a={...structuredClone(demo),requestId:'tab-a',summary:'Интервью вкладки A'};const b={...structuredClone(demo),requestId:'tab-b',summary:'Интервью вкладки B'};
 const first=await crmApi.saveInteraction(tabA,'bank',a,undefined,today,next=>{tabA=next});const second=await crmApi.saveInteraction(tabB,'bank',b,undefined,today,next=>{tabB=next});
 assert.equal(first.ok,true);assert.equal(second.ok,true);const durable=JSON.parse(storage.get(key));assert.equal(durable.interactions.length,seed.interactions.length+2);
 assert.ok(durable.interactions.some(i=>i.summary===a.summary));assert.ok(durable.interactions.some(i=>i.summary===b.summary));
 assert.deepEqual(await crmApi.saveInteraction(tabA,'bank',a,undefined,today,()=>{}),first);
 assert.equal((await crmApi.load()).interactions.length,seed.interactions.length+2);
});
test('stale contact edit and stale confirmed role cannot replace another tab’s interview',async()=>{
 const storage=memory();const tabA=await crmApi.load(),tabB=await crmApi.load();
 await crmApi.saveInteraction(tabA,'bank',{...structuredClone(demo),requestId:'first'},undefined,today,()=>{});
 const before=storage.get(key);const edited=structuredClone(tabB);edited.people[0].title='Старая вкладка';
 await assert.rejects(crmApi.save(edited,tabB),/другой вкладке/);assert.equal(storage.get(key),before);
 const result=await crmApi.saveInteraction(tabB,'bank',{...structuredClone(demo),requestId:'stale-role'},{kind:'role',personId:'bank-p0',role:'influencer'},today,()=>{});
 assert.equal(result.ok,false);assert.match(result.error,/другой вкладке/);assert.equal(storage.get(key),before);
});
test('simultaneous independent saves serialize into two durable records',async()=>{
 memory();const a=await crmApi.load(),b=await crmApi.load();
 const results=await Promise.all([crmApi.saveInteraction(a,'bank',{...structuredClone(demo),requestId:'parallel-a'},undefined,today,()=>{}),crmApi.saveInteraction(b,'bank',{...structuredClone(demo),requestId:'parallel-b'},undefined,today,()=>{})]);
 assert.ok(results.every(r=>r.ok));assert.equal((await crmApi.load()).interactions.length,seed.interactions.length+2);
});

test('recovery keeps a valid working copy or valid CRM baseline instead of discarding local knowledge',async()=>{
 const storage=memory();const valid=structuredClone(seed);valid.people[0].title='Сохранённая должность';
 storage.set(crmKey,JSON.stringify(valid));storage.set(key,'{"snapshots":[]}');assert.deepEqual(await crmApi.load(),valid);
 storage.set(key,JSON.stringify(valid));storage.set(crmKey,'{"snapshots":[]}');assert.deepEqual(await crmApi.load(),valid);
});
