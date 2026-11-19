import type { Person, RelationType, Role } from '../types.ts';
export type Proposal =
 | { id:string; kind:'person'; source:string; name:string; department:string; title:string; role:Role; roleNeedsConfirmation?:boolean; owner:string }
 | { id:string; kind:'role'; source:string; name:string; role:Role; roleNeedsConfirmation?:boolean }
 | { id:string; kind:'relation'; source:string; from:string; to:string; relationType:RelationType; strength:number };
export interface ExtractionRequest { text:string; people:Person[] }
export interface LlmExtractor { extract(request:ExtractionRequest):Promise<Proposal[]> }
const knownRole=(text:string)=>/лпр|принимает решение|решение принимает|лицо принимающее решение|блокир|блокер|влияющ|влияет|пользовател|эксперт/i.test(text);
const roleOf=(text:string):Role=>/лпр|принимает решение|решение принимает|лицо принимающее решение/i.test(text)?'decision_maker':/блокир|блокер/i.test(text)?'blocker':/влияющ|влияет/i.test(text)?'influencer':/пользовател/i.test(text)?'user':'evaluator';
const relationOf=(text:string):RelationType=>/неформальн/i.test(text)?'informal':/подчин/i.test(text)?'reports_to':'works_with';
const value=(line:string,key:string)=>new RegExp(`(?:^|;)\\s*(?:${key})\\s*:\\s*([^;]+)`,'i').exec(line)?.[1].trim()??'';
/** Replace this adapter with an API-backed implementation returning the same typed proposals. */
export const llmExtractor:LlmExtractor={async extract({text,people}){
 const result:Proposal[]=[]; const lines=text.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
 for(const [index,line] of lines.entries()){
  const id=`proposal-${index}`;
  const personName=value(line,'новый участник|новый контакт');
  if(personName){result.push({id,kind:'person',source:line,name:personName,department:value(line,'подразделение')||'Прочее',title:value(line,'должность')||'Не указана',role:roleOf(value(line,'роль')),roleNeedsConfirmation:!knownRole(value(line,'роль')),owner:value(line,'владелец')});continue;}
  const roleName=value(line,'смена роли|роль участника');
  if(roleName){result.push({id,kind:'role',source:line,name:roleName,role:roleOf(value(line,'новая роль|роль')),roleNeedsConfirmation:!knownRole(value(line,'новая роль|роль'))});continue;}
  const rel=value(line,'новая связь|связь');
  if(rel){const parts=rel.split(/\s+(?:—|–|--|и)\s+/i).map(x=>x.trim());if(parts.length===2){const strength=Number(value(line,'сила'));result.push({id,kind:'relation',source:line,from:parts[0],to:parts[1],relationType:relationOf(value(line,'тип')),strength:Number.isInteger(strength)&&strength>=1&&strength<=5?strength:3});}continue;}
  const named=people.filter(p=>line.toLocaleLowerCase('ru').includes(p.name.toLocaleLowerCase('ru')));
  if(named.length===1&&/назначен|теперь|смена роли/i.test(line)&&/лпр|влияющ|эксперт|пользовател|блокир/i.test(line))result.push({id,kind:'role',source:line,name:named[0].name,role:roleOf(line)});
  else if(named.length===2&&/связан|работают вместе|взаимодействуют/i.test(line))result.push({id,kind:'relation',source:line,from:named[0].name,to:named[1].name,relationType:relationOf(line),strength:3});
 }
 return result;
}};
