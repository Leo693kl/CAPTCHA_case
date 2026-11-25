import { useState } from 'react';
import { Copy } from 'lucide-react';
import { Button, Card } from './ui';
import { roles, stances, relationTypes, type Person, type Relation, type Interaction } from '../types';
const date=(s:string)=>s.split('-').reverse().join('.');
export function MeetingBrief({person,people,relations,interactions,companyName,initiative,asOf,onBack,onOpenSource}:{onOpenSource?:(interactionId:string)=>void;person:Person;companyName:string;initiative:string;people:Person[];relations:Relation[];interactions:Interaction[];asOf:string;onBack:()=>void}){
 const [copied,setCopied]=useState('');const history=interactions.filter(i=>i.personId===person.id).sort((a,b)=>b.date.localeCompare(a.date));const related=relations.filter(r=>r.from===person.id||r.to===person.id);const names=new Map(people.map(p=>[p.id,p.name]));
 const evidence=history.find(i=>i.evidence?.preferences?.topics?.some(t=>/поддержк/i.test(t))||i.evidence?.competitor?.reason?.toLocaleLowerCase('ru').includes('поддержк'));
 const next=evidence?'Уточнить приемлемый срок реакции поддержки и подготовить сравнение на одной странице.':null;
 const text=`Бриф на ${date(asOf)}\n${person.name} — ${person.title}, ${person.department}; ${companyName}.\nРоль: ${roles[person.decisionRole]}, позиция: ${stances[person.stance]}, влияние ${person.influence}/5, теплота ${person.warmth}/5.\nИнтересы: ${person.interests.join(', ')||'не указаны'}. Согласие на маркетинг: ${person.consentMarketing?'да':'нет'}.\nСвязи: ${related.map(r=>`${names.get(r.from===person.id?r.to:r.from)??'Неизвестный контакт'} (${relationTypes[r.type]}, ${r.strength}/5)`).join('; ')||'не указаны'}.\nПоследние касания:\n${history.slice(0,3).map(i=>`${date(i.date)} — ${i.channel}: ${i.summary}`).join('\n')||'Нет данных'}\nИстория не подтверждает, какие темы точно не обсуждались.\n${next??'Рекомендуется уточнить роль и участников решения'}${person.interests.length?`, обсудить ${person.interests.join(', ')}`:''}.`;
 return <div className="meeting-brief advanced-brief">
  <h2>Бриф на встречу</h2>
  <p className="record-meta"><span>{companyName}</span><time dateTime={asOf}>{date(asOf)}</time></p>
  <Button variant="ghost" onClick={onBack}>← К карточке контакта</Button>
  <Card className="brief-card">
   <h3>{person.name}</h3>
   <p>{person.title}, {person.department}</p>
   <p className="record-meta"><strong>{roles[person.decisionRole]}</strong><span>{stances[person.stance]}</span></p><p>Влияние {person.influence}/5, теплота {person.warmth}/5</p>
   <p>Владелец: {person.owner||'не указан'}</p><p>Согласие на маркетинг: {person.consentMarketing?'да':'нет'}</p>
   {related.length>0&&<details><summary>Связанные контакты</summary><ul>{related.map(r=><li key={r.id}>{names.get(r.from===person.id?r.to:r.from)??'Неизвестный контакт'} — {relationTypes[r.type]}, сила {r.strength}/5</li>)}</ul></details>}
  </Card>
  <Card className="brief-card">
   <h3>Что обсудить</h3>
   {initiative&&<p>{initiative}</p>}
   <p>{next||'Уточнить роль и участников принятия решения.'}</p>
   <p>{person.interests.length?`Уточнить приоритеты: ${person.interests.join(', ')}.`:'Уточнить интересы контакта.'}</p>
   {next&&evidence&&<>
    {onOpenSource&&<Button variant="ghost" className="source-action" onClick={()=>onOpenSource(evidence.id)}>Открыть источник от {date(evidence.date)}</Button>}
    <details><summary>Фрагмент источника</summary><blockquote>{evidence.evidence?.sourceExcerpt}</blockquote></details>
   </>}
  </Card>
  <Card className="brief-card">
   <details><summary>Последние касания</summary>
    {history.length?history.slice(0,3).map(i=><article className="brief-item" key={i.id}><strong className="record-meta"><time dateTime={i.date}>{date(i.date)}</time><span>{i.channel}</span></strong><p>{i.summary}</p><small>{i.ourOwner}, {i.ourDepartment}</small></article>):<p>Касаний пока нет.</p>}
    <p className="map-evidence-note">По истории нельзя определить, какие темы ещё предстоит обсудить.</p>
   </details>
  </Card>
  <Button onClick={()=>{void navigator.clipboard.writeText(text).then(()=>setCopied('Бриф скопирован')).catch(()=>setCopied('Не удалось скопировать бриф'))}}><Copy size={16} strokeWidth={1.75}/> Копировать</Button><span role="status" className="copy-status">{copied}</span>
 </div>
}
