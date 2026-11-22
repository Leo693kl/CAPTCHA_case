import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createElement, act } from 'react';
import { create } from 'react-test-renderer';
import { unlink } from 'node:fs/promises';
import { crmApi } from '../src/api/crmApi.ts';

// Bundle TSX for Node while sharing the installed React instance with the renderer.
const bundle = new URL('./.evidence-form-test-bundle.mjs', import.meta.url);
await build({entryPoints:['src/components/EvidenceForm.tsx'],bundle:true,platform:'node',format:'esm',outfile:bundle.pathname.replace(/^\/(\w:)/,'$1'),external:['react','react/jsx-runtime'],loader:{'.css':'empty'},jsx:'automatic',logLevel:'silent'});
const { EvidenceForm } = await import(bundle.href);
after(async()=>{await unlink(bundle)});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const p=(id,name,decisionRole='user')=>({id,name,companyId:'bank',department:'ИТ',title:'Директор',decisionRole,stance:'neutral',influence:3,warmth:3,owner:'Ирина',interests:[],consentMarketing:false});
const people=[p('titov','Михаил Титов'),p('belov','Александр Белов','decision_maker')];
const relations=[{id:'r1',companyId:'bank',from:'titov',to:'belov',type:'works_with',strength:3}];
const findLabel=(root,text)=>root.findAllByType('label').find(label=>label.children[0]===text);
const change=async(root,label,value)=>{const el=findLabel(root,label); assert.ok(el,`Нет поля ${label}`);const field=el.findAll(node=>node.type==='input'||node.type==='select')[0];await act(async()=>field.props.onChange({target:{value,checked:value}}));};
const click=async(root,text)=>{const button=root.findAllByType('button').find(b=>b.children.includes(text));assert.ok(button,`Нет кнопки ${text}`);await act(async()=>{await button.props.onClick()})};
async function setup(saveInteraction, overrides={}){
 let view; await act(async()=>{view=create(createElement(EvidenceForm,{companyId:'bank',people,relations,selectedPersonId:'titov',asOf:'2026-11-19',saveInteraction,onOpenSaved:()=>{},...overrides}))});
 const root=view.root;
 for(const [label,value] of [['Источник','Интервью'],['Автор со стороны КРОК','Ирина'],['Подразделение КРОК','Проекты'],['Краткое содержание','Белов согласует поддержку']]) await change(root,label,value);
 const excerpt=root.findByType('textarea');await act(async()=>excerpt.props.onChange({target:{value:'Александр Белов согласует поддержку.'}}));await click(root,'Разобрать и проверить');return {view,root};
}
test('confirmed role change is saved atomically with interview',async()=>{
 const calls=[];const {view,root}=await setup(async(...args)=>{calls.push(args);return {ok:true,interactionId:'saved'}});
 await change(root,'Тип изменения','role');await change(root,'Контакт для изменения роли','belov');await change(root,'Новая роль','influencer');
 assert.match(JSON.stringify(view.toJSON()),/ЛПР → Влияющий/);
 const checkbox=root.findAllByType('input').find(i=>i.props.type==='checkbox' && i.parent.children.includes(' Подтверждаю эту правку вместе с интервью'));
 await act(async()=>checkbox.props.onChange({target:{checked:true}})); await click(root,'Сохранить');
 assert.equal(calls.length,1);assert.equal(calls[0][0],'bank');assert.equal(calls[0][1].personId,'titov');assert.equal(calls[0][1].evidence.sourceExcerpt,'Александр Белов согласует поддержку.');assert.deepEqual(calls[0][2],{kind:'role',personId:'belov',role:'influencer'});assert.ok(root.findAllByType('button').some(b=>b.children.includes('Открыть на карте')));await act(async()=>view.unmount());
});
test('rejecting relation change saves interview without change',async()=>{
 const calls=[];const {view,root}=await setup(async(...args)=>{calls.push(args);return {ok:true,interactionId:'saved'}});
 await change(root,'Тип изменения','relation-strength');await change(root,'Связь','r1');await change(root,'Новая сила','5');assert.match(JSON.stringify(view.toJSON()),/3\/5 → 5\/5/);
 await click(root,'Отклонить правку');await click(root,'Сохранить');assert.equal(calls.length,1);assert.equal(calls[0][2],undefined);assert.equal(calls[0][1].personId,'titov');await act(async()=>view.unmount());
});
test('failed save preserves draft, confirmation and request ID for retry',async()=>{
 const calls=[];const {view,root}=await setup(async(...args)=>{calls.push(args);return calls.length===1?{ok:false,error:'Ошибка CRM'}:{ok:true,interactionId:'saved'}});
 await change(root,'Тип изменения','relation-strength');await change(root,'Связь','r1');await change(root,'Новая сила','5');
 const checkbox=root.findAllByType('input').find(i=>i.props.type==='checkbox' && i.parent.children.includes(' Подтверждаю эту правку вместе с интервью'));await act(async()=>checkbox.props.onChange({target:{checked:true}}));
 await click(root,'Сохранить');assert.match(JSON.stringify(view.toJSON()),/Ошибка CRM/);assert.equal(root.findByType('textarea').props.value,'Александр Белов согласует поддержку.');assert.equal(checkbox.props.checked,true);
 await click(root,'Сохранить');assert.equal(calls.length,2);assert.deepEqual(calls[0],calls[1]);assert.deepEqual(calls[1][2],{kind:'relation-strength',relationId:'r1',strength:5});await act(async()=>view.unmount());
});

test('form uses the real A transaction and opens the same source after a durable retry',async()=>{
 const storage=new Map();
 globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)};
 let current={companies:[{id:'bank',name:'Банк',industry:'Демо',initiative:'Поддержка',description:'Синтетика'}],people:structuredClone(people),relations:structuredClone(relations),interactions:[],snapshots:[]};
 localStorage.setItem('decision-radar-v1',JSON.stringify(current));
 let completion;const calls=[];const opened=[];
 const saveInteraction=(...args)=>{calls.push(args);completion=crmApi.saveInteraction(current,...args,'2026-11-19',next=>{current=next});return completion};
 const {view,root}=await setup(saveInteraction);
 await change(root,'Тип изменения','role');await change(root,'Контакт для изменения роли','belov');await change(root,'Новая роль','influencer');
 const checkbox=root.findAllByType('input').find(i=>i.props.type==='checkbox'&&i.parent.children.includes(' Подтверждаю эту правку вместе с интервью'));
 await act(async()=>checkbox.props.onChange({target:{checked:true}}));
 await click(root,'Сохранить');await act(async()=>{await completion});
 assert.equal(current.interactions.length,1);assert.equal(current.people.find(p=>p.id==='belov').decisionRole,'influencer');
 const id=current.interactions[0].id;
 current=await crmApi.load();
 const retry=await crmApi.saveInteraction(current,...calls[0],'2026-11-19',next=>{current=next});
 assert.deepEqual(retry,{ok:true,interactionId:id});assert.equal(current.interactions.length,1);
 await act(async()=>view.update(createElement(EvidenceForm,{companyId:'bank',people:current.people,relations,selectedPersonId:'titov',asOf:'2026-11-19',saveInteraction,onOpenSaved:id=>opened.push(id)})));
 await click(root,'Открыть на карте');await click(root,'Открыть на карте');
 assert.deepEqual(opened,[id,id]);await act(async()=>view.unmount());
});

test('map strength handoff preselects the pair and still requires explicit confirmation',async()=>{
 const calls=[];
 const {view,root}=await setup(async(...args)=>{calls.push(args);return {ok:true,interactionId:'strength-source'}},{initialChange:{kind:'relation-strength',relationId:'r1',strength:5}});
 assert.equal(findLabel(root,'Связь').findByType('select').props.value,'r1');
 assert.equal(findLabel(root,'Новая сила').findByType('select').props.value,'5');
 await click(root,'Сохранить');assert.equal(calls.length,0);assert.match(JSON.stringify(view.toJSON()),/Подтвердите выбранное изменение/);
 const checkbox=root.findAllByType('input').find(i=>i.props.type==='checkbox'&&i.parent.children.includes(' Подтверждаю эту правку вместе с интервью'));
 await act(async()=>checkbox.props.onChange({target:{checked:true}}));await click(root,'Сохранить');
 assert.deepEqual(calls[0][2],{kind:'relation-strength',relationId:'r1',strength:5});
 assert.equal(calls[0][1].evidence.signals,undefined); // A confirmation is not another independent witness.
 await act(async()=>view.unmount());
});

test('preferred channel and explicit signals survive a real save and reload independently of touch channel',async()=>{
 const storage=new Map();globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)};
 let current={companies:[{id:'bank',name:'Банк',industry:'Демо',initiative:'Поддержка',description:'Синтетика'}],people:structuredClone(people),relations:structuredClone(relations),interactions:[],snapshots:[]};
 localStorage.setItem('decision-radar-v1',JSON.stringify(current));
 let completion;
 const {view,root}=await setup((...args)=>{completion=crmApi.saveInteraction(current,...args,'2026-11-19',next=>{current=next});return completion});
 await change(root,'Дата','2026-11-04');await change(root,'Канал касания','Встреча');await change(root,'Предпочтительный канал связи','Почта');
 await change(root,'Контакт предложил следующий шаг',true);await change(root,'Контакт вернулся к обсуждению',true);await change(root,'Согласование состоялось',true);await change(root,'Дата запроса согласования','2026-11-01');
 await click(root,'Сохранить');await act(async()=>{await completion});
 const reloaded=await crmApi.load();assert.equal(reloaded.interactions.length,1);
 const record=reloaded.interactions[0];assert.equal(record.channel,'Встреча');assert.equal(record.evidence.preferences.channel,'Почта');
 assert.deepEqual(record.evidence.signals,[{kind:'initiative'},{kind:'resumption'},{kind:'approval',requestedOn:'2026-11-01'}]);
 await act(async()=>view.unmount());
});

test('approval needs a request date no later than the touch and invalid input preserves the draft',async()=>{
 const calls=[];const {view,root}=await setup(async(...args)=>{calls.push(args);return {ok:true,interactionId:'saved'}});
 await change(root,'Дата','2026-11-04');await change(root,'Согласование состоялось',true);
 await click(root,'Сохранить');assert.equal(calls.length,0);assert.match(JSON.stringify(view.toJSON()),/дату запроса не позже/);
 await change(root,'Дата запроса согласования','2026-11-05');await click(root,'Сохранить');assert.equal(calls.length,0);
 assert.equal(findLabel(root,'Дата запроса согласования').findByType('input').props.value,'2026-11-05');
 await change(root,'Дата запроса согласования','2026-11-04');await click(root,'Сохранить');assert.equal(calls.length,1);
 assert.deepEqual(calls[0][1].evidence.signals,[{kind:'approval',requestedOn:'2026-11-04'}]);
 await act(async()=>view.unmount());
});
