import test from 'node:test';
import assert from 'node:assert/strict';
import seed from '../src/data/crm.json' with {type:'json'};
import demo from '../docs/plans/demo-interview.json' with {type:'json'};
import {prepareInteraction} from '../src/api/interactionTransaction.ts';
import {buildMapSlice} from '../src/api/mapSlice.ts';
import {communicationPreferences} from '../src/lib/communicationPreferences.ts';
const today='2026-11-19';
const slice=data=>buildMapSlice(data,'bank',today,today,null);
test('Titov preferences retain their source and mentioning Belov does not transfer them',()=>{
 const before=slice(structuredClone(seed));const belov=communicationPreferences(before,'bank-p0');
 assert.deepEqual(communicationPreferences(before,'bank-p10'),[]);
 const transaction=prepareInteraction(structuredClone(seed),'bank',structuredClone(demo),undefined,today);
 const after=slice(transaction.data);const result=communicationPreferences(after,'bank-p10');
 assert.deepEqual(result.map(p=>[p.label,p.value,p.source.id]),[['Формат','Сравнение на одной странице',transaction.result.interactionId],['Темы','Поддержка',transaction.result.interactionId]]);
 assert.deepEqual(communicationPreferences(after,'bank-p0'),belov);
 assert.deepEqual(communicationPreferences(buildMapSlice(transaction.data,'retail',today,today,null),'bank-p10'),[]);
 assert.deepEqual(communicationPreferences(buildMapSlice(transaction.data,'bank','2026-11-18',today,null),'bank-p10'),[]);
});
test('each latest nonempty confirmed field keeps its own source; blank newer fields do not erase known preferences',()=>{
 const first=prepareInteraction(structuredClone(seed),'bank',structuredClone(demo),undefined,today);
 const second=prepareInteraction(first.data,'bank',{...structuredClone(demo),requestId:'next',evidence:{...demo.evidence,preferences:{channel:'Почта',format:'',topics:[]}}},undefined,today);
 const data=structuredClone(second.data),original=structuredClone(data);const values=communicationPreferences(slice(data),'bank-p10');
 assert.deepEqual(values.map(p=>[p.field,p.value,p.source.id]),[['channel','Почта',second.result.interactionId],['format','Сравнение на одной странице',first.result.interactionId],['topics','Поддержка',first.result.interactionId]]);
 assert.deepEqual(data,original);
});
