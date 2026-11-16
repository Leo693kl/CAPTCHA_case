import { departments, type Interaction, type Person } from '../types.ts';

export interface CoverageComponent { label:string; numerator:number; denominator:number; points:number; explanation:string }
export interface CoverageResult { score:number; components:CoverageComponent[] }
const DAY=86400000;
export function lastInteraction(personId:string, interactions:Interaction[], now:Date):Interaction|undefined {
 const today=Date.UTC(now.getFullYear(),now.getMonth(),now.getDate());
 return interactions.filter(i=>i.personId===personId && Number.isFinite(Date.parse(i.date)) && Date.parse(i.date)<=today).sort((a,b)=>b.date.localeCompare(a.date))[0];
}
export function calculateCoverage(people:Person[], interactions:Interaction[], now:Date=new Date()):CoverageResult {
 const today=Date.UTC(now.getFullYear(),now.getMonth(),now.getDate());
 const decisionMakers=people.filter(p=>p.decisionRole==='decision_maker');
 const covered=departments.filter(d=>people.some(p=>p.department===d)).length;
 const connected=decisionMakers.filter(p=>lastInteraction(p.id,interactions,now)).length;
 const fresh=people.filter(p=>{const last=lastInteraction(p.id,interactions,now); return last && (today-Date.parse(last.date))/DAY<=365}).length;
 const warm=people.filter(p=>p.warmth>=4).length;
 const component=(label:string,numerator:number,denominator:number,explanation:string):CoverageComponent=>({label,numerator,denominator,points:denominator ? 25*numerator/denominator : 0,explanation});
 const components=[component('Подразделения',covered,departments.length,'Подразделения с хотя бы одним контактом'),component('Контакт с ЛПР',connected,decisionMakers.length,'ЛПР хотя бы с одним взаимодействием'),component('Свежесть',fresh,people.length,'Контакты с взаимодействием за последние 365 дней'),component('Тёплые отношения',warm,people.length,'Контакты с теплотой 4–5 из 5')];
 return {score:Math.round(components.reduce((sum,c)=>sum+c.points,0)),components};
}
