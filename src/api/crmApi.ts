import seed from '../data/crm.json' with { type: 'json' };
import type { CRMData, PersonSnapshot, InteractionDraft, EvidenceChange, SaveResult } from '../types';
import { prepareInteraction } from './interactionTransaction.ts';
import { dateKey } from '../lib/history.ts';
const key='decision-radar-v1';
const crmKey='decision-radar-simulated-crm-v1';
const delay=()=>new Promise<void>(resolve=>setTimeout(resolve,150+Math.random()*250));
function migrate(data:CRMData):CRMData{
 if(Array.isArray(data.snapshots))return data;
 const initial=structuredClone(seed) as CRMData;const liveIds=new Set(data.people.map(p=>p.id));const seedIds=new Set(initial.people.map(p=>p.id));
 const snapshots:PersonSnapshot[]=initial.snapshots.filter(s=>liveIds.has(s.personId)||!seedIds.has(s.personId));
 const today=dateKey(new Date());for(const person of data.people)snapshots.push({personId:person.id,date:today,person:structuredClone(person)});
 return {...data,snapshots};
}
function readBaseline():CRMData{try{const saved=localStorage.getItem(crmKey);return saved?migrate(JSON.parse(saved) as CRMData):structuredClone(seed) as CRMData;}catch{return structuredClone(seed) as CRMData;}}
export const crmApi={
 async saveInteraction(data:CRMData,companyId:string,draft:InteractionDraft,change:EvidenceChange|undefined,today:string,onCommit:(next:CRMData)=>void):Promise<SaveResult>{
  try{
   const transaction=prepareInteraction(data,companyId,draft,change,today);
   if(transaction.data){
    // No await between preparation, durable write and publication.
    localStorage.setItem(key,JSON.stringify(transaction.data));
    onCommit(transaction.data);
   }
   await delay();return transaction.result;
  }catch{return {ok:false,error:'Не удалось сохранить запись в браузере. Черновик можно отправить повторно.'};}
 },
 async load():Promise<CRMData>{await delay();try{const saved=localStorage.getItem(key);return saved?migrate(JSON.parse(saved) as CRMData):readBaseline();}catch{return readBaseline();}},
 save(data:CRMData):Promise<void>{localStorage.setItem(key,JSON.stringify(data));return delay();},
 async reset():Promise<CRMData>{await delay();localStorage.removeItem(key);return readBaseline();},
 async loadBaseline():Promise<CRMData>{await delay();return readBaseline();},
 async confirmCompany(data:CRMData,companyId:string):Promise<CRMData>{
  await delay();const baseline=readBaseline();const ids=new Set([...baseline.people,...data.people,...baseline.snapshots.map(s=>s.person),...data.snapshots.map(s=>s.person)].filter(p=>p.companyId===companyId).map(p=>p.id));
  const next:CRMData={...baseline,people:[...baseline.people.filter(p=>p.companyId!==companyId),...data.people.filter(p=>p.companyId===companyId)],relations:[...baseline.relations.filter(r=>r.companyId!==companyId),...data.relations.filter(r=>r.companyId===companyId)],interactions:[...baseline.interactions.filter(i=>!ids.has(i.personId)),...data.interactions.filter(i=>ids.has(i.personId))],snapshots:[...baseline.snapshots.filter(s=>s.person.companyId!==companyId),...data.snapshots.filter(s=>s.person.companyId===companyId)]};
  next.interactionRequests=[...(baseline.interactionRequests??[]).filter(request=>request.companyId!==companyId),...(data.interactionRequests??[]).filter(request=>request.companyId===companyId)];
  localStorage.setItem(crmKey,JSON.stringify(next));return next;
 }
};
