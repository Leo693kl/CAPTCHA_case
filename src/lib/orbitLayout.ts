import { departments } from '../types.ts';
export const radii=[260,420,580,740];
type OrbitItem={id:string;department:string;ghost?:boolean};
type Box={left:number;right:number;top:number;bottom:number};
export interface OrbitPlan { positions:Record<string,{x:number;y:number}>; radii:number[]; extent:number; gap:number }
function bounds(x:number,y:number,ghost:boolean):Box{return ghost?{left:x-90,right:x+90,top:y-65,bottom:y+75}:{left:x-60,right:x+60,top:y-60,bottom:y+88};}
function overlaps(a:Box,b:Box):boolean{return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;}
function tryLayout<T extends OrbitItem>(people:T[],getRing:(person:T)=>number,base:number,gap:number):OrbitPlan|null{
 const result:Record<string,{x:number;y:number}>={};const occupied:Box[]=[{left:-110,right:110,top:-110,bottom:110}];const rings=[0,1,2,3].map(i=>base+i*gap);
 const angles=[0,-24,24,-12,12,-18,18,-6,6,-27,27,-21,21,-15,15,-9,9,-3,3];
 for(const [sector,department] of departments.entries())for(let ring=0;ring<4;ring++){
  const group=people.filter(person=>person.department===department&&getRing(person)===ring);
  for(const [index,person] of group.entries()){
   let position:{x:number;y:number}|undefined;
   const tracks=Math.floor((gap/2-12)/35)*2+1;
   for(let track=0;track<tracks&&!position;track++){
    const offset=track===0?0:Math.ceil(track/2)*35*(track%2?1:-1);const radius=rings[ring]+offset;if(radius<160)continue;
    for(let a=0;a<angles.length;a++){
     const angle=(-90+sector*60+angles[(index+a)%angles.length])*Math.PI/180;const candidate={x:Math.cos(angle)*radius,y:Math.sin(angle)*radius};
     if(occupied.every(other=>!overlaps(bounds(candidate.x,candidate.y,!!person.ghost),other))){position=candidate;break;}
    }
   }
   if(!position)return null;result[person.id]=position;occupied.push(bounds(position.x,position.y,!!person.ghost));
  }
 }
 return {positions:result,radii:rings,extent:rings[3]+gap/2+170,gap};
}
export function planOrbit<T extends OrbitItem>(people:T[],getRing:(person:T)=>number):OrbitPlan{
 // Increase the orbit radius and spacing only when the current lens needs room.
 for(let scale=0;scale<20;scale++){
  const candidates:{base:number;gap:number;outer:number}[]=[];
  for(let base=260+scale*400;base<=620+scale*400;base+=60)for(let gap=160;gap<=440+scale*80;gap+=40)candidates.push({base,gap,outer:base+3.5*gap});
  candidates.sort((a,b)=>a.outer-b.outer||a.base-b.base);
  for(const {base,gap} of candidates){const plan=tryLayout(people,getRing,base,gap);if(plan)return plan;}
 }
 throw new Error('Не удалось разместить контакты на карте');
}
export function orbitLayout<T extends OrbitItem>(people:T[],getRing:(person:T)=>number):Record<string,{x:number;y:number}>{return planOrbit(people,getRing).positions;}
