import type { Interaction, Person, Relation } from '../types.ts';
export interface DependencyRisk { kind:'owner'|'contact'; name:string; count:number; total:number; percent:number }
export interface MissingRole { id:string; label:string; department:string; description:string }
export const expectedRoles:MissingRole[]=[
 {id:'ciso',label:'CISO',department:'ИБ',description:'Руководитель информационной безопасности'},
 {id:'procurement',label:'Закупки',department:'Закупки',description:'Представитель закупок'},
 {id:'finance',label:'Финансы',department:'Финансы',description:'Представитель финансов'},
 {id:'business',label:'Бизнес-заказчик',department:'Бизнес',description:'ЛПР со стороны бизнеса'}
];
export function findMissingRoles(people:Person[]):MissingRole[]{
 return expectedRoles.filter(role=>!people.some(p=>{
  if(role.id==='ciso')return /\bciso\b|директор.{0,30}(иб|безопасност)|руководител.{0,30}(иб|информационной безопасности)/i.test(p.title);
  if(role.id==='business')return p.department==='Бизнес'&&(p.decisionRole==='decision_maker'||/бизнес.заказчик/i.test(p.title));
  return p.department===role.department;
 }));
}
export function findDependencies(people:Person[],relations:Relation[]):DependencyRisk[]{
 const warm=people.filter(p=>p.warmth>=4); if(!warm.length)return [];
 const names=new Set(people.map(p=>p.id)); const risks:DependencyRisk[]=[];
 const owners=new Map<string,number>(); for(const person of warm){const owner=person.owner.trim();if(owner)owners.set(owner,(owners.get(owner)??0)+1);}
 for(const [name,count] of owners)if(count/warm.length>.6)risks.push({kind:'owner',name,count,total:warm.length,percent:count/warm.length*100});
 const valid=relations.filter(r=>names.has(r.from)&&names.has(r.to)&&r.from!==r.to);
 for(const person of people){const neighbors=new Set(valid.flatMap(r=>r.from===person.id?[r.to]:r.to===person.id?[r.from]:[]));const count=warm.filter(p=>neighbors.has(p.id)).length;if(count/warm.length>.6)risks.push({kind:'contact',name:person.name,count,total:warm.length,percent:count/warm.length*100});}
 return risks;
}
export function contactConflicts(interactions:Interaction[],now:Date=new Date()):Map<string,string[]>{
 const today=Date.UTC(now.getFullYear(),now.getMonth(),now.getDate()); const grouped=new Map<string,Set<string>>();
 for(const interaction of interactions){const when=Date.parse(interaction.date);const age=(today-when)/86400000;const department=interaction.ourDepartment.trim();if(Number.isFinite(when)&&age>=0&&age<30&&department){if(!grouped.has(interaction.personId))grouped.set(interaction.personId,new Set());grouped.get(interaction.personId)?.add(department);}}
 return new Map([...grouped].filter(([,units])=>units.size>=2).map(([id,units])=>[id,[...units].sort()]));
}
