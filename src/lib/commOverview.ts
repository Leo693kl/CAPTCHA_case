import type { Interaction, Person } from '../types.ts';

export interface CommunicationOptions { start?:string; end?:string; channels?:readonly string[]; asOf?:string }
export function communicationOverview(people:readonly Person[], interactions:readonly Interaction[], companyId:string, options:CommunicationOptions={}) {
 const contacts=people.filter(p=>p.companyId===companyId);
 const ids=new Set(contacts.map(p=>p.id));
 const end=options.end??options.asOf;
 const records=interactions.filter(r=>ids.has(r.personId)&&(!options.start||r.date>=options.start)&&(!end||r.date<=end)&&(!options.channels?.length||options.channels.includes(r.channel)));
 const counts=new Map(contacts.map(p=>[p.id,0]));
 const channelCounts=new Map<string,number>();
 for(const r of records){
  channelCounts.set(r.channel,(channelCounts.get(r.channel)??0)+1);
  for(const id of new Set([r.personId,...(r.participantIds??[])]))if(ids.has(id))counts.set(id,(counts.get(id)??0)+1);
 }
 const channels=[...channelCounts].map(([channel,count])=>({channel,count})).sort((a,b)=>b.count-a.count||a.channel.localeCompare(b.channel,'ru'));
 const anchor=options.asOf??options.end??new Date().toISOString().slice(0,10);
 const [year,month]=anchor.split('-').map(Number);
 const months=Array.from({length:12},(_,i)=>{const d=new Date(Date.UTC(year,month-12+i,1));const key=`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;return {month:key,count:records.filter(r=>r.date.slice(0,7)===key).length};});
 const ranked=contacts.map(person=>({person,count:counts.get(person.id)??0}));
 const active=ranked.filter(x=>x.count>0);
 return {activityCount:records.length,activeCount:active.length,totalContacts:contacts.length,withoutActivity:ranked.filter(x=>x.count===0).map(x=>x.person),channels,months,top:active.sort((a,b)=>b.count-a.count||a.person.name.localeCompare(b.person.name,'ru')).slice(0,5)};
}
