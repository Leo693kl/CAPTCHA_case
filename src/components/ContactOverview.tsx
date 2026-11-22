import type { ReactNode } from 'react';
import { ArrowUpRight, CalendarDays, ChevronRight, Plus } from 'lucide-react';
import { Button } from './ui';
import { communicationPreferences } from '../lib/communicationPreferences';
import { warmthHistory } from '../lib/mapMetrics';
import { roles, stances, relationTypes, type MapSlice, type Person } from '../types';

const dateLabel=(date:string)=>date.split('-').reverse().join('.');
export function ContactOverview({person,slice,onOpenSource,onAdd,onSelect,companyIndicators,children}:{
 person:Person;slice:MapSlice;onOpenSource:(id:string)=>void;onAdd:()=>void;onSelect:(id:string)=>void;companyIndicators:ReactNode;children:ReactNode;
}){
 const history=slice.interactions.filter(record=>record.personId===person.id).slice().reverse().sort((a,b)=>b.date.localeCompare(a.date));
 const last=history[0],observation=history.find(record=>record.evidence);
 const preferences=communicationPreferences(slice,person.id);
 const sources=[...new Map(preferences.map(preference=>[preference.source.id,preference.source])).values()];
 const snapshots=warmthHistory(slice,person.id);const first=snapshots[0],latest=snapshots.at(-1);
 const links=slice.relations.filter(edge=>edge.from===person.id||edge.to===person.id).flatMap(edge=>{
  const other=slice.people.find(item=>item.id===(edge.from===person.id?edge.to:edge.from));return other?[{edge,other}]:[];
 });
 const linked=(items:typeof links)=>items.map(({edge,other})=><Button key={edge.id} variant="ghost" className="contact-related-row" onClick={()=>onSelect(other.id)}><span><strong>{other.name}</strong><small>{relationTypes[edge.type]} · {edge.strength}/5</small></span><ChevronRight size={16} strokeWidth={1.75} aria-hidden="true"/></Button>);
 return <div className="contact-overview">
  <header className="contact-heading"><h2>{person.name}</h2><p><strong>{roles[person.decisionRole]}</strong><span aria-hidden="true"> · </span>{person.department}</p><small>{person.title}</small></header>
  <section className="contact-section last-touch" aria-label="Последнее касание"><h3>Последнее касание</h3>{last?<p><CalendarDays size={17} strokeWidth={1.75} aria-hidden="true"/><time dateTime={last.date}>{dateLabel(last.date)}</time><span>· {last.channel}</span></p>:<p className="muted">Касаний пока нет</p>}</section>
  <section className="contact-section communication" aria-label="Как общаться"><h3>Как общаться</h3>
   <dl><div><dt>Теплота отношений</dt><dd className="warmth-value"><span className="warmth-dots" aria-hidden="true">{[1,2,3,4,5].map(value=><i className={value<=person.warmth?'filled':''} key={value}/>)}</span>{person.warmth}/5</dd></div><div><dt>Позиция</dt><dd>{stances[person.stance]}</dd></div></dl>
   {first&&latest&&first!==latest&&<p className="warmth-change">Теплота {first.person.warmth} → {latest.person.warmth} / 5 <small>{dateLabel(first.date)} — {dateLabel(latest.date)}</small></p>}
   {preferences.length>0?<><dl className="communication-preferences">{preferences.map(item=><div key={item.field}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>{sources.map(source=><Button variant="ghost" className="preference-source" key={source.id} onClick={()=>onOpenSource(source.id)}><ArrowUpRight size={14} strokeWidth={1.75} aria-hidden="true"/>Источник предпочтений · {dateLabel(source.date)}</Button>)}</>:<p className="muted">Предпочтения ещё не подтверждены. Уточните их при следующем касании.</p>}
  </section>
  <section className="contact-section contact-observation" aria-label="Последнее наблюдение"><h3>{observation?.evidence?.kind==='feedback'?'Обратная связь':'Интервью'}</h3>{observation?<><blockquote>{observation.evidence!.sourceExcerpt}</blockquote><Button variant="ghost" className="source-action" onClick={()=>onOpenSource(observation.id)}>Открыть источник<ArrowUpRight size={15} strokeWidth={1.75} aria-hidden="true"/></Button></>:<p className="muted">Подтверждённых наблюдений пока нет.</p>}</section>
  <Button className="contact-add" variant="primary" disabled={slice.historical} onClick={onAdd}><Plus size={18} strokeWidth={1.75} aria-hidden="true"/>Добавить наблюдение</Button>
  <section className="contact-section contact-related"><h3>Связанные контакты <small>{links.length}</small></h3>{linked(links.slice(0,3))}{links.length>3&&<details><summary>Все связанные контакты</summary>{linked(links.slice(3))}</details>}{!links.length&&<p className="muted">Связей пока нет.</p>}</section>
  {companyIndicators}
  <details className="full-contact"><summary>Полная карточка, история и действия</summary>{children}</details>
 </div>;
}
