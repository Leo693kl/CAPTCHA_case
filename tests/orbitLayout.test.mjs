import test from 'node:test';
import assert from 'node:assert/strict';
import { orbitLayout, planOrbit } from '../src/lib/orbitLayout.ts';
const box=(p,ghost)=>ghost?{l:p.x-90,r:p.x+90,t:p.y-65,b:p.y+75}:{l:p.x-60,r:p.x+60,t:p.y-60,b:p.y+88};
const overlaps=(a,b)=>a.l<b.r&&a.r>b.l&&a.t<b.b&&a.b>b.t;
test('places labels and ghost cards without overlap, including a crowded ring',()=>{const people=['ИТ','ИБ','Закупки','Финансы','Бизнес','Прочее'].flatMap((department,d)=>Array.from({length:7},(_,i)=>({id:`${d}-${i}`,department,ring:i<5?0:i-4,ghost:i===6})));const positions=orbitLayout(people,p=>p.ring);const occupied=[{l:-110,r:110,t:-110,b:110}];for(const person of people){assert.ok(positions[person.id]);const rect=box(positions[person.id],person.ghost);assert.equal(occupied.some(other=>overlaps(rect,other)),false,person.id);occupied.push(rect);}assert.deepEqual(positions,orbitLayout(people,p=>p.ring));});

test('keeps each contact inside its own influence band',()=>{const people=['ИТ','ИБ','Закупки','Финансы','Бизнес','Прочее'].flatMap((department,d)=>Array.from({length:8},(_,i)=>({id:`${d}-${i}`,department,ring:i<6?0:i-5,ghost:i===7})));const plan=planOrbit(people,p=>p.ring);for(const p of people){const xy=plan.positions[p.id];const radius=Math.hypot(xy.x,xy.y);assert.ok(Math.abs(radius-plan.radii[p.ring])<plan.gap/2,`${p.id} moved outside its band`);}});
