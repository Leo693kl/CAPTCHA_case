export type Role = 'decision_maker'|'influencer'|'evaluator'|'user'|'blocker';
export type Stance = 'champion'|'supporter'|'neutral'|'skeptic';
export type RelationType = 'reports_to'|'works_with'|'informal';
export interface Company { id:string; name:string; industry:string; initiative:string; description:string }
export interface Person { id:string; companyId:string; name:string; department:string; title:string; decisionRole:Role; stance:Stance; influence:number; warmth:number; owner:string; interests:string[]; consentMarketing:boolean }
export interface Relation { id:string; companyId:string; from:string; to:string; type:RelationType; strength:number }
export interface Interaction { id:string; personId:string; date:string; channel:string; ourOwner:string; ourDepartment:string; summary:string; sentiment:string }
export interface PersonSnapshot { personId:string; date:string; person:Person; deleted?:boolean }
export interface CRMData { companies:Company[]; people:Person[]; relations:Relation[]; interactions:Interaction[]; snapshots:PersonSnapshot[] }
export const departments=['ИТ','ИБ','Закупки','Финансы','Бизнес','Прочее'];
export const roles:Record<Role,string>={decision_maker:'ЛПР',influencer:'Влияющий',evaluator:'Эксперт',user:'Пользователь',blocker:'Блокирующий'};
export const stances:Record<Stance,string>={champion:'Лидер поддержки',supporter:'Сторонник',neutral:'Нейтрален',skeptic:'Скептик'};
export const relationTypes:Record<RelationType,string>={reports_to:'Подчинение',works_with:'Рабочая связь',informal:'Неформальная связь'};
