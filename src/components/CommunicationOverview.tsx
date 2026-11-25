import { useState } from 'react';
import { communicationOverview } from '../lib/commOverview';
import type { MapSlice } from '../types';
import { Button } from './ui';
import '../styles/communication.css';

const dateLabel=(date:string)=>date.split('-').reverse().join('.');
export function CommunicationOverview({slice,onSelect}:{slice:MapSlice;onSelect:(id:string)=>void}) {
 const [period,setPeriod]=useState<'all'|'90'>('all');
 const date=new Date(`${slice.asOf}T00:00:00Z`);date.setUTCDate(date.getUTCDate()-89);
 const start=period==='90'?date.toISOString().slice(0,10):undefined;
 const overview=communicationOverview(slice.people,slice.interactions,slice.companyId,{start,asOf:slice.asOf});
 const description=period==='all'?`всё время до ${dateLabel(slice.asOf)}`:`${dateLabel(start!)} — ${dateLabel(slice.asOf)}`;
 const note=`Период: ${description} · Все каналы · Источник: история взаимодействий`;
 const leading=overview.channels[0];
 const maximum=Math.max(1,...overview.months.map(m=>m.count));
 return <section className="communication-overview" aria-label="Обзор коммуникаций">
  <div className="communication-heading"><div role="group" aria-label="Период коммуникаций"><Button variant={period==='all'?'primary':'ghost'} aria-pressed={period==='all'} onClick={()=>setPeriod('all')}>Всё время</Button><Button variant={period==='90'?'primary':'ghost'} aria-pressed={period==='90'} onClick={()=>setPeriod('90')}>90 дней</Button></div></div>
  <p>Охвачено {overview.activeCount} из {overview.totalContacts} контактов{leading?`. Чаще всего — ${leading.channel.toLocaleLowerCase('ru-RU')}`:''}.</p><small>{note}</small>
  <div className="communication-grid"><section><h3>Каналы · {overview.activityCount} касаний</h3>{overview.channels.length?overview.channels.map(item=><div className="communication-channel" key={item.channel}><span>{item.channel}</span><span>{item.count}</span><div className="communication-track"><i style={{width:`${item.count/overview.activityCount*100}%`}}/></div></div>):<p>Нет взаимодействий за период.</p>}</section>
  <section><h3>Динамика по месяцам</h3><small>Шкала за 12 месяцев</small><div className="communication-months" role="list" aria-label="Количество взаимодействий по месяцам">{overview.months.map(item=><div key={item.month} role="listitem" aria-label={`${item.month}: ${item.count}`}><span>{item.count}</span><i style={{height:`${item.count/maximum*100}%`}}/><small>{item.month.slice(5)}.{item.month.slice(2,4)}</small></div>)}</div></section>
  <section><h3>Топ контактов</h3><small>Основные контакты и участники касаний</small>{overview.top.length?overview.top.map(({person,count})=><Button variant="ghost" className="communication-person" key={person.id} onClick={()=>onSelect(person.id)}>{person.name} · {count}</Button>):<p>Нет активности.</p>}</section>
  <section><h3>Без активности · {overview.withoutActivity.length}</h3>{overview.withoutActivity.length?overview.withoutActivity.map(person=><Button variant="ghost" className="communication-person" key={person.id} onClick={()=>onSelect(person.id)}>{person.name}</Button>):<p>У всех контактов есть активность.</p>}</section></div>
 </section>;
}
