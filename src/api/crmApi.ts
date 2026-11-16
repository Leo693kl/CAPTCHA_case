import seed from '../data/crm.json';
import type { CRMData, PersonSnapshot } from '../types';
import { dateKey } from '../lib/history';
const key='decision-radar-v1';
const crmKey='decision-radar-simulated-crm-v1';
const delay=()=>new Promise(resolve=>setTimeout(resolve,150+Math.random()*250));
function migrate(data:CRMData):CRMData{
 if(Array.isArray(data.snapshots))return data;
 const initial=structuredClone(seed) as CRMData;const liveIds=new Set(data.people.map(p=>p.id));const seedIds=new Set(initial.people.map(p=>p.id));
 const snapshots:PersonSnapshot[]=initial.snapshots.filter(s=>liveIds.has(s.personId)||!seedIds.has(s.personId));
 const today=dateKey(new Date());for(const person of data.people)snapshots.push({personId:person.id,date:today,person:structuredClone(person)});
 return {...data,snapshots};
}
function readBaseline():CRMData{try{const saved=localStorage.getItem(crmKey);return saved?migrate(JSON.parse(saved) as CRMData):structuredClone(seed) as CRMData;}catch{return structuredClone(seed) as CRMData;}}
export const crmApi={
 async load():Promise<CRMData>{await delay();const saved=localStorage.getItem(key);try{return saved?migrate(JSON.parse(saved) as CRMData):readBaseline();}catch{return readBaseline();}},
 async save(data:CRMData):Promise<void>{localStorage.setItem(key,JSON.stringify(data));await delay();},
 async reset():Promise<CRMData>{await delay();localStorage.removeItem(key);return readBaseline();},
 async loadBaseline():Promise<CRMData>{await delay();return readBaseline();},
 async confirmCompany(data:CRMData,companyId:string):Promise<CRMData>{
  await delay();const baseline=readBaseline();const ids=new Set([...baseline.people,...data.people].filter(p=>p.companyId===companyId).map(p=>p.id));
  const next:CRMData={...baseline,people:[...baseline.people.filter(p=>p.companyId!==companyId),...data.people.filter(p=>p.companyId===companyId)],relations:[...baseline.relations.filter(r=>r.companyId!==companyId),...data.relations.filter(r=>r.companyId===companyId)],interactions:[...baseline.interactions.filter(i=>!ids.has(i.personId)),...data.interactions.filter(i=>ids.has(i.personId))],snapshots:[...baseline.snapshots.filter(s=>s.person.companyId!==companyId),...data.snapshots.filter(s=>s.person.companyId===companyId)]};
  localStorage.setItem(crmKey,JSON.stringify(next));return next;
 }
};
