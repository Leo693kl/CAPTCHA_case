import seed from '../data/crm.json' with { type: 'json' };
import type { CRMData, PersonSnapshot } from '../types.ts';
import { dateKey } from '../lib/history.ts';
import { isCRMData } from './crmValidation.ts';
export const key='decision-radar-v1';
export const crmKey='decision-radar-simulated-crm-v1';
export class StorageError extends Error {}
export const conflictMessage='Данные изменились в другой вкладке. Изменения не записаны, черновик сохранён. Обновите карту перед повторным редактированием.';
export type StorageNotice=(message:string)=>void;
const initial=()=>structuredClone(seed) as CRMData;
function migrate(data:CRMData):CRMData{
 if(Array.isArray(data.snapshots))return data;
 const base=initial();const liveIds=new Set(data.people.map(p=>p.id));const seedIds=new Set(base.people.map(p=>p.id));
 const snapshots:PersonSnapshot[]=base.snapshots.filter(s=>liveIds.has(s.personId)||!seedIds.has(s.personId));
 const today=dateKey(new Date());for(const person of data.people)snapshots.push({personId:person.id,date:today,person:structuredClone(person)});
 return {...data,snapshots};
}
function readStored(storageKey:string,onNotice?:StorageNotice,writing=false):CRMData|undefined{
 let raw:string|null;
 try{raw=localStorage.getItem(storageKey)}catch{if(writing)throw new StorageError('Хранилище недоступно. Изменения не записаны.');onNotice?.('Хранилище недоступно. Открыты синтетические данные; сохранение может быть недоступно.');return}
 if(raw===null)return;
 try{const value:unknown=JSON.parse(raw);if(isCRMData(value))return migrate(value)}catch{/* Preserve unreadable input below. */}
 const backup=`${storageKey}:recovery:${Date.now()}-${crypto.randomUUID()}`;
 try{
  localStorage.setItem(backup,raw);
  localStorage.removeItem(storageKey);
  onNotice?.(`Неполная или повреждённая запись ${storageKey} сохранена для восстановления в ${backup}. Открыты рабочие резервные данные.`);
 }catch{
  const message=`Неполная или повреждённая запись оставлена в ${storageKey}: не удалось создать резерв. Открыты рабочие данные; исходная запись не перезаписана.`;
  onNotice?.(message);if(writing)throw new StorageError(message);
 }
}
export function readBaseline(onNotice?:StorageNotice,writing=false):CRMData{return readStored(crmKey,onNotice,writing)??initial()}
export function readCurrent(onNotice?:StorageNotice,writing=false):CRMData{
 const baseline=readBaseline(onNotice,writing);
 return readStored(key,onNotice,writing)??baseline;
}
/** One origin-wide lock covers all read/modify/write paths, including first save. */
export async function storageLock<T>(operation:()=>T):Promise<T>{
 if(typeof navigator!=='undefined'&&navigator.locks){
  // Release the lock normally even on a rejected write (also works in Node's LockManager).
  const outcome=await navigator.locks.request('decision-radar-storage-v1',()=>{
   try{return {ok:true as const,value:operation()}}catch(error){return {ok:false as const,error}}
  });
  if(!outcome.ok)throw outcome.error;
  return outcome.value;
 }
 throw new StorageError('Безопасное сохранение недоступно в этом браузере. Откройте карту через localhost или HTTPS в браузере с Web Locks. Черновик сохранён.');
}
// Key order in a legacy JSON record must not create a spurious conflict.
function canonical(value:unknown):unknown{
 if(Array.isArray(value))return value.map(canonical);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)]));
 return value;
}
export function assertCurrent(expected:CRMData,latest:CRMData):void{
 if(JSON.stringify(canonical(expected))!==JSON.stringify(canonical(latest)))throw new StorageError(conflictMessage);
}
