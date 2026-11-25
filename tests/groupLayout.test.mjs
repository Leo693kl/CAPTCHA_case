import test from 'node:test';
import assert from 'node:assert/strict';
import { planGroups, groupGeometry } from '../src/lib/groupLayout.ts';
const person=(i,department='ИТ')=>({id:`p${i}`,companyId:'a',name:`Контакт ${i}`,department,title:'',decisionRole:'user',stance:'neutral',influence:i%5+1,warmth:1,owner:'',interests:[],consentMarketing:false});
function verify(plan,people,ghosts){const entries=[...people.map(p=>({id:p.id,department:p.department,rx:60,top:60,bottom:88})),...ghosts.map(p=>({...p,rx:90,top:65,bottom:75}))];for(const [i,a] of entries.entries()){const p=plan.positions[a.id];assert.ok(p,a.id);const z=plan.zones.find(z=>z.department===a.department);assert.ok(p.x-a.rx>=z.x&&p.x+a.rx<=z.x+z.width&&p.y-a.top>=z.y+groupGeometry.header&&p.y+a.bottom<=z.y+z.height);for(const b of entries.slice(i+1)){const q=plan.positions[b.id];assert.ok(p.x+a.rx<=q.x-b.rx||q.x+b.rx<=p.x-a.rx||p.y+a.bottom<=q.y-b.top||q.y+b.bottom<=p.y-a.top,`${a.id} and ${b.id}`)}}for(const [i,a] of plan.zones.entries())for(const b of plan.zones.slice(i+1))assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y)}
test('one contact, empty departments and a ghost fit without overlap',()=>{const people=[person(1)],ghosts=[{id:'g',department:'ИТ'}];const plan=planGroups(people,ghosts,[],'2026-11-25');verify(plan,people,ghosts);assert.ok(plan.zones.find(z=>z.department==='ИБ').lowCoverage)});
test('forty contacts and long department names fit without overlaps',()=>{const people=Array.from({length:40},(_,i)=>person(i,i<30?'Очень длинное название подразделения клиентской компании':'ИТ'));const ghosts=[{id:'g',department:'ИТ'}];verify(planGroups(people,ghosts,[],'2026-11-25'),people,ghosts)});
test('contacts are ordered by influence and counts reflect period and explicit participants',()=>{const people=[person(0),person(4),person(2)];const interactions=[{id:'x',personId:'p0',date:'2026-11-20',participantIds:['p2']},{id:'old',personId:'p4',date:'2024-01-01'}];const plan=planGroups(people,[],interactions,'2026-11-25','90');const z=plan.zones.find(z=>z.department==='ИТ');assert.equal(z.count,3);assert.equal(z.active,2);assert.equal(z.lowCoverage,false);assert.ok(plan.positions.p4.x<plan.positions.p2.x);assert.ok(plan.positions.p2.x<plan.positions.p0.x);const old=planGroups(people,[],interactions,'2026-11-25','old').zones.find(z=>z.department==='ИТ');assert.equal(old.active,1);assert.equal(old.lowCoverage,true)});

test('a department with 50 contacts grows in both directions and retains space from neighbours',()=>{
 const sample=Array.from({length:50},(_,i)=>person(i));
 const crowded=planGroups(sample,[],[],'2026-11-25');
 const initial=planGroups(sample.slice(0,5),[],[],'2026-11-25');
 const zone=crowded.zones.find(z=>z.department==='ИТ');
 const small=initial.zones.find(z=>z.department==='ИТ');
 const next=crowded.zones.find(z=>z.department==='ИБ');
 verify(crowded,sample,[]);
 assert.ok(zone.width>small.width&&zone.height>small.height);
 assert.equal(next.x-zone.x-zone.width,groupGeometry.zoneGap);
 assert.equal(new Set(sample.map(p=>crowded.positions[p.id].x)).size,8);
 assert.ok(crowded.halfWidth>=next.x+next.width);
});
