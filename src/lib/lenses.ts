import type { Interaction, Person } from '../types';
import { lastInteraction } from './coverage';
export type Lens='decisions'|'coverage'|'risks'|'marketing'|'technology'|'projects';
export const lensOptions:Record<Lens,{label:string; rings:string[]; description:string}>={
 decisions:{label:'Решения',rings:['ЛПР','ВЛИЯЮЩИЕ И БЛОКЕРЫ','ЭКСПЕРТЫ','ПОЛЬЗОВАТЕЛИ'],description:'Роль в решении · цвет — теплота отношений'},
 coverage:{label:'Охват',rings:['ДО 90 ДНЕЙ','ДО ГОДА','БОЛЕЕ ГОДА','НЕТ ИСТОРИИ'],description:'Давность последнего взаимодействия · ближе — свежее'},
 risks:{label:'Риски',rings:['СКЕПТИК ИЛИ БЛОКЕР','НЕТ КОНТАКТА > ГОДА','СЛАБЫЕ ОТНОШЕНИЯ','ОСТАЛЬНЫЕ'],description:'Приоритет риска: позиция, давность, теплота'},
 marketing:{label:'Маркетинг',rings:['СОГЛАСИЕ И ИНТЕРЕСЫ','ТОЛЬКО СОГЛАСИЕ','ТОЛЬКО ИНТЕРЕСЫ','НЕТ ДАННЫХ'],description:'Согласие на маркетинг и заполненные интересы'},
 technology:{label:'Технологии',rings:['ИТ ИЛИ ИБ','ТЕХНИЧЕСКИЙ ИНТЕРЕС','ЭКСПЕРТЫ','ОСТАЛЬНЫЕ'],description:'Подразделение, интересы и экспертная роль'},
 projects:{label:'Проекты',rings:['ПРОЕКТНЫЙ ОФИС','АРХИТЕКТУРА','ПРОЧИЕ КОНТАКТЫ','НЕТ ИСТОРИИ'],description:'Участие наших команд в истории взаимодействий'}
};
export function lensRing(p:Person,lens:Lens,interactions:Interaction[],now:Date):number {
 const history=interactions.filter(i=>i.personId===p.id); const last=lastInteraction(p.id,history,now); const today=Date.UTC(now.getFullYear(),now.getMonth(),now.getDate()); const age=last?(today-Date.parse(last.date))/86400000:Infinity;
 switch(lens){
 case 'decisions': return p.decisionRole==='decision_maker'?0:p.decisionRole==='influencer'||p.decisionRole==='blocker'?1:p.decisionRole==='evaluator'?2:3;
 case 'coverage': return age<=90?0:age<=365?1:last?2:3;
 case 'risks': return p.stance==='skeptic'||p.decisionRole==='blocker'?0:age>365?1:p.warmth<3?2:3;
 case 'marketing': return p.consentMarketing?(p.interests.length?0:1):(p.interests.length?2:3);
 case 'technology': return p.department==='ИТ'||p.department==='ИБ'?0:p.interests.some(i=>/технолог|цифров|инфраструктур|облач|данных|безопасност/i.test(i))?1:p.decisionRole==='evaluator'?2:3;
 case 'projects': return history.some(i=>i.ourDepartment==='Проектный офис')?0:history.some(i=>i.ourDepartment==='Архитектура')?1:history.length?2:3;
 }
}
export function lensColor(p:Person,lens:Lens,ring:number):string {
 if(lens==='decisions')return ['#496977','#527b7b','#6c887b','#a79565','#daa65f'][p.warmth-1]??'#496977';
 return (lens==='risks'?['#c48755','#a99467','#718c80','#518b81']:['#518b81','#718c80','#a99467','#806b55'])[ring];
}
