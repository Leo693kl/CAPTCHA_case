import { departments, type Interaction, type Person } from '../types.ts';

export type GroupGhost = { id:string; department:string };
export type GroupZone = { department:string; x:number; y:number; width:number; height:number; count:number; active:number; lowCoverage:boolean };
export type GroupPlan = { positions:Record<string,{x:number;y:number}>; zones:GroupZone[]; extent:number };
// Slots include the visible label and the larger ghost cards.
export const groupGeometry = { slotWidth:200, slotHeight:180, padding:30, header:125, columns:3, zoneGap:60, zoneColumns:3 } as const;
export function planGroups(people:readonly Person[], ghosts:readonly GroupGhost[], interactions:readonly Interaction[], asOf:string, period:string=''):GroupPlan {
 const g=groupGeometry;const known=[...new Set([...departments,...people.map(p=>p.department),...ghosts.map(p=>p.department)])];
 const activeIds=new Set<string>();const end=Date.parse(asOf+'T00:00:00Z');
 for(const record of interactions){const age=(end-Date.parse(record.date+'T00:00:00Z'))/86400000;if(age<0||!Number.isFinite(age))continue;if(period==='90'&&age>90||period==='365'&&age>365||period==='old'&&age<=365)continue;activeIds.add(record.personId);for(const id of record.participantIds??[])activeIds.add(id)}
 const groups=known.map(department=>{const persons=people.filter(p=>p.department===department).sort((a,b)=>b.influence-a.influence||a.name.localeCompare(b.name,'ru'));const missing=ghosts.filter(p=>p.department===department);const entries=[...persons.map(p=>({id:p.id,ghost:false})),...missing.map(p=>({id:p.id,ghost:true}))];const cols=Math.min(g.columns,Math.max(1,entries.length));const rows=Math.max(1,Math.ceil(entries.length/cols));const count=persons.length,active=persons.filter(p=>activeIds.has(p.id)).length;const width=cols*g.slotWidth+g.padding*2;const header=g.header+Math.max(0,Math.ceil(department.length/Math.max(8,Math.floor((width-2*g.padding)/12)))-1)*24;return {department,entries,cols,width,header,height:rows*g.slotHeight+header+g.padding,count,active,lowCoverage:count===0||active/count<0.5};});
 const colWidths=Array.from({length:g.zoneColumns},(_,col)=>Math.max(0,...groups.filter((_,i)=>i%g.zoneColumns===col).map(z=>z.width)));
 const rows=Math.ceil(groups.length/g.zoneColumns);const rowHeights=Array.from({length:rows},(_,row)=>Math.max(...groups.slice(row*g.zoneColumns,(row+1)*g.zoneColumns).map(z=>z.height)));
 const width=colWidths.reduce((a,b)=>a+b,0)+g.zoneGap*(g.zoneColumns-1);const height=rowHeights.reduce((a,b)=>a+b,0)+g.zoneGap*Math.max(0,rows-1);
 const positions:GroupPlan['positions']={};const zones:GroupZone[]=[];
 groups.forEach((zone,index)=>{const col=index%g.zoneColumns,row=Math.floor(index/g.zoneColumns);const x=-width/2+colWidths.slice(0,col).reduce((a,b)=>a+b,0)+g.zoneGap*col;const y=-height/2+rowHeights.slice(0,row).reduce((a,b)=>a+b,0)+g.zoneGap*row;zones.push({department:zone.department,x,y,width:zone.width,height:zone.height,count:zone.count,active:zone.active,lowCoverage:zone.lowCoverage});zone.entries.forEach((entry,i)=>{positions[entry.id]={x:x+g.padding+(i%zone.cols)*g.slotWidth+g.slotWidth/2,y:y+zone.header+Math.floor(i/zone.cols)*g.slotHeight+g.slotHeight/2}})});
 return {positions,zones,extent:Math.max(width,height)/2+100};
}
