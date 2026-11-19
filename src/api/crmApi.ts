import type { CRMData, InteractionDraft, EvidenceChange, SaveResult } from '../types';
import { prepareInteraction } from './interactionTransaction.ts';
import { StorageError, assertCurrent, key, crmKey, readBaseline, readCurrent, storageLock, type StorageNotice } from './crmStorage.ts';
const delay=()=>new Promise<void>(resolve=>setTimeout(resolve,150+Math.random()*250));
export const crmApi={
 async saveInteraction(data:CRMData,companyId:string,draft:InteractionDraft,change:EvidenceChange|undefined,today:string,onCommit:(next:CRMData)=>void):Promise<SaveResult>{
  try{
   const result=await storageLock(()=>{
    const latest=readCurrent(undefined,true);
    const transaction=prepareInteraction(latest,companyId,draft,change,today);
    if(transaction.data){
     // Plain interviews append to the latest state; confirmed edits require a fresh base.
     if(change)assertCurrent(data,latest);
     localStorage.setItem(key,JSON.stringify(transaction.data));
     onCommit(transaction.data);
    }else if(transaction.result.ok)onCommit(latest);
    return transaction.result;
   });
   await delay();return result;
  }catch(error){return {ok:false,error:error instanceof StorageError?error.message:'Не удалось сохранить запись в браузере. Черновик можно отправить повторно.'};}
 },
 async load(onNotice?:StorageNotice):Promise<CRMData>{await delay();return typeof navigator!=='undefined'&&navigator.locks?storageLock(()=>readCurrent(onNotice)):readCurrent(onNotice)},
 async save(data:CRMData,expected:CRMData,onCommit?:(next:CRMData)=>void):Promise<void>{try{await storageLock(()=>{assertCurrent(expected,readCurrent(undefined,true));localStorage.setItem(key,JSON.stringify(data));onCommit?.(data)});await delay()}catch(error){throw error instanceof StorageError?error:new Error('Не удалось сохранить изменения в браузере. Повторите сохранение.')}},
 async reset(expected?:CRMData):Promise<CRMData>{await delay();return storageLock(()=>{if(expected)assertCurrent(expected,readCurrent(undefined,true));const baseline=readBaseline(undefined,true);localStorage.removeItem(key);return baseline})},
 async loadBaseline(onNotice?:StorageNotice):Promise<CRMData>{await delay();return readBaseline(onNotice)},
 async confirmCompany(data:CRMData,companyId:string):Promise<CRMData>{
  await delay();return storageLock(()=>{assertCurrent(data,readCurrent(undefined,true));const baseline=readBaseline(undefined,true);const ids=new Set([...baseline.people,...data.people,...baseline.snapshots.map(s=>s.person),...data.snapshots.map(s=>s.person)].filter(p=>p.companyId===companyId).map(p=>p.id));
  const next:CRMData={...baseline,people:[...baseline.people.filter(p=>p.companyId!==companyId),...data.people.filter(p=>p.companyId===companyId)],relations:[...baseline.relations.filter(r=>r.companyId!==companyId),...data.relations.filter(r=>r.companyId===companyId)],interactions:[...baseline.interactions.filter(i=>!ids.has(i.personId)),...data.interactions.filter(i=>ids.has(i.personId))],snapshots:[...baseline.snapshots.filter(s=>s.person.companyId!==companyId),...data.snapshots.filter(s=>s.person.companyId===companyId)]};
  next.interactionRequests=[...(baseline.interactionRequests??[]).filter(request=>request.companyId!==companyId),...(data.interactionRequests??[]).filter(request=>request.companyId===companyId)];
  localStorage.setItem(crmKey,JSON.stringify(next));return next;});
 }
};
