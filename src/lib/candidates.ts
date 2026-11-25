import type { Interaction, Person } from '../types.ts';

export const candidateRules = { title:1, directive:2, meeting:1, reference:1, medium:2, high:3 } as const;
export type CandidateReason = { kind:'title'|'directive'|'meeting'|'reference'; label:string; sourceId?:string };
export type Candidate = { personId:string; level:'низкий'|'средний'|'высокий'; reasons:CandidateReason[] };
const leadership = /директор|руководител|начальник|заместител|\b(?:cio|ciso|ceo|cto)\b/i;
// A directive is attributed only to the record's contact, never to a mentioned person.
const directive = /(?:поручил|поручила|распорядил(?:ся|ась)|дал поручение|дала поручение|поставил задачу|поставила задачу)/i;
export function findCandidates(people:readonly Person[], records:readonly Interaction[], resolved:readonly {personId:string}[]=[]):Candidate[] {
 const excluded=new Set(resolved.map(x=>x.personId));
 const result:Candidate[]=[];
 for(const person of people){
  if(person.decisionRole==='decision_maker'||excluded.has(person.id))continue;
  const sameCompany=new Set(people.filter(p=>p.companyId===person.companyId).map(p=>p.id));
  const makers=new Set(people.filter(p=>p.companyId===person.companyId&&p.decisionRole==='decision_maker').map(p=>p.id));
  const relevant=records.filter(r=>sameCompany.has(r.personId));
  const reasons:CandidateReason[]=[];let score=0;
  if(leadership.test(person.title)){score+=candidateRules.title;reasons.push({kind:'title',label:`Должность: ${person.title}`});}
  const directives=relevant.filter(r=>r.personId===person.id&&directive.test(`${r.summary} ${r.evidence?.sourceExcerpt??''}`));
  if(directives.length){score+=candidateRules.directive;directives.forEach(r=>reasons.push({kind:'directive',label:'В записи есть поручение',sourceId:r.id}));}
  const meetings=relevant.filter(r=>/встреч|совещан|meeting/i.test(r.channel)&&r.participantIds?.includes(person.id)&&r.participantIds.some(id=>makers.has(id)));
  if(meetings.length){score+=candidateRules.meeting;meetings.forEach(r=>reasons.push({kind:'meeting',label:'Участие во встрече вместе с ЛПР',sourceId:r.id}));}
  const references=relevant.filter(r=>r.personId!==person.id&&r.evidence?.mentionedPersonIds?.includes(person.id));
  if(references.length){score+=candidateRules.reference;references.forEach(r=>reasons.push({kind:'reference',label:'Другой контакт упомянул человека',sourceId:r.id}));}
  if(score)result.push({personId:person.id,level:score>=candidateRules.high?'высокий':score>=candidateRules.medium?'средний':'низкий',reasons});
 }
 const order={высокий:0,средний:1,низкий:2};return result.sort((a,b)=>order[a.level]-order[b.level]);
}
