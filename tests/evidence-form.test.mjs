import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createElement, act } from 'react';
import { create } from 'react-test-renderer';
import { unlink } from 'node:fs/promises';

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
async function setup(saveInteraction){
 let view; await act(async()=>{view=create(createElement(EvidenceForm,{companyId:'bank',people,relations,selectedPersonId:'titov',asOf:'2026-11-19',saveInteraction,onOpenSaved:()=>{}}))});
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

