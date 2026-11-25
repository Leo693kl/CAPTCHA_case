import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createElement, act } from 'react';
import { create } from 'react-test-renderer';
import { unlink } from 'node:fs/promises';
import seed from '../src/data/crm.json' with { type: 'json' };
import { buildMapSlice } from '../src/api/mapSlice.ts';
import { prepareInteraction } from '../src/api/interactionTransaction.ts';
import { interactionSource, sourcePerson } from '../src/lib/interactionSource.ts';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const bundle=new URL('./.interaction-source-test-bundle.mjs',import.meta.url);
await build({entryPoints:['src/components/SourceRecord.tsx'],bundle:true,platform:'node',format:'esm',outfile:fileURLToPath(bundle),external:['react','react/jsx-runtime'],loader:{'.css':'empty'},jsx:'automatic',logLevel:'silent'});
const {SourceRecord}=await import(bundle.href);after(async()=>{await unlink(bundle)});globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const today='2026-11-19';
const draft=JSON.parse(readFileSync(new URL('../docs/plans/demo-interview.json',import.meta.url)));
function deletedContact(){
 const saved=prepareInteraction(structuredClone(seed),'bank',draft,undefined,today);
 const person=saved.data.people.find(p=>p.id===draft.personId);
 saved.data.people=saved.data.people.filter(p=>p.id!==person.id);
 saved.data.snapshots.push({personId:person.id,date:today,person:{...person,name:'Михаил Титов (бывший контакт)'},deleted:true});
 return {data:saved.data,id:saved.result.interactionId};
}

test('deleted author source is scoped by interaction, company and date without restoring a graph person',()=>{
 const {data,id}=deletedContact();const slice=buildMapSlice(data,'bank',today,today,null);
 assert.ok(interactionSource(slice,id));assert.equal(sourcePerson(slice,draft.personId).name,'Михаил Титов (бывший контакт)');
 assert.ok(!slice.people.some(p=>p.id===draft.personId));
 assert.equal(interactionSource(buildMapSlice(data,'retail',today,today,null),id),undefined);
 assert.equal(interactionSource(buildMapSlice(data,'bank','2026-11-18',today,null),id),undefined);
 // Date is also checked when the caller still holds an older list of records.
 assert.equal(interactionSource({...slice,asOf:'2026-11-18'},id),undefined);
 // A company-scoped source can predate the first available identity snapshot.
 const older={...data,people:structuredClone(seed.people),snapshots:[],interactions:[{...interactionSource(slice,id),date:'2026-11-01'}]};
 const historical=buildMapSlice(older,'bank','2026-11-02',today,null);
 assert.equal(sourcePerson(historical,draft.personId),undefined);assert.ok(interactionSource(historical,id));
});

test('source card shows snapshot identity, separate channels, explicit signals and calendar days',async()=>{
 const {data,id}=deletedContact();const slice=buildMapSlice(data,'bank',today,today,null);
 const record={...interactionSource(slice,id),evidence:{...draft.evidence,preferences:{channel:'Почта'},signals:[{kind:'initiative'},{kind:'resumption'},{kind:'approval',requestedOn:'2026-11-16'}]}};
 let returned=0,view;await act(async()=>{view=create(createElement(SourceRecord,{interaction:record,slice,onBack:()=>returned++}))});
 const plain=node=>typeof node==='string'?node:Array.isArray(node)?node.map(plain).join(''):node?.children?plain(node.children):'';
 const text=plain(view.toJSON());for(const expected of ['Михаил Титов (бывший контакт)','контакт удалён из активной карты','Канал касания','Встреча','Канал связи: ','Почта','Контакт предложил следующий шаг','Контакт вернулся к обсуждению','3 дн.'])assert.ok(text.includes(expected),expected);
 await act(async()=>view.root.findAllByType('button').find(b=>b.children.includes('Вернуться к месту открытия')).props.onClick());assert.equal(returned,1);
 assert.ok(!slice.people.some(p=>p.id===draft.personId));await act(async()=>view.unmount());
});
