import type { Relation } from '../types.ts';
export function getHoverNeighborhood(id:string|null,relations:Relation[]):{nodes:Set<string>;edges:Set<string>}{
 const nodes=new Set<string>();const edges=new Set<string>();
 if(!id)return {nodes,edges};
 nodes.add(id);
 for(const relation of relations){if(relation.from===id||relation.to===id){nodes.add(relation.from);nodes.add(relation.to);edges.add(relation.id)}}
 return {nodes,edges};
}
