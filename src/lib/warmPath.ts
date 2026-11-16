import type { Person, Relation } from '../types.ts';
export interface PathStep { from:string; to:string; relation:Relation; cost:number; penalty:number }
export interface WarmPath { start:string; target:string; cost:number; steps:PathStep[] }
/** The CRM knows contact warmth, not relationship warmth: a cold endpoint adds 4 - warmth. */
export function findWarmPath(people:Person[],relations:Relation[],target:string):WarmPath|null {
 const byId=new Map(people.map(p=>[p.id,p])); if(!byId.has(target))return null;
 const starts=people.filter(p=>p.warmth>=4&&p.owner.trim()); if(!starts.length)return null;
 const distances=new Map<string,number>(); const previous=new Map<string,PathStep>(); const pending=new Set(people.map(p=>p.id));
 for(const p of starts)distances.set(p.id,0);
 while(pending.size){let current:string|undefined;let best=Infinity;for(const id of pending){const cost=distances.get(id)??Infinity;if(cost<best){current=id;best=cost;}}if(current===undefined)break;pending.delete(current);if(current===target)break;
  for(const relation of relations){const next=relation.from===current?relation.to:relation.to===current?relation.from:undefined;if(!next||!pending.has(next))continue;const a=byId.get(current);const b=byId.get(next);if(!a||!b||relation.strength<1||relation.strength>5)continue;const penalty=Math.max(0,4-Math.min(a.warmth,b.warmth));const cost=6-relation.strength+penalty;const candidate=best+cost;if(candidate<(distances.get(next)??Infinity)){distances.set(next,candidate);previous.set(next,{from:current,to:next,relation,cost,penalty});}}
 }
 if(!distances.has(target))return null;const steps:PathStep[]=[];let cursor=target;while(previous.has(cursor)){const step=previous.get(cursor)!;steps.unshift(step);cursor=step.from;}return {start:cursor,target,cost:distances.get(target)!,steps};
}
