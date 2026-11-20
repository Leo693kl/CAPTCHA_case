import { memo, useState, useEffect, useMemo, useRef, useCallback, type CSSProperties } from 'react';
import { ReactFlow, ViewportPortal, useReactFlow, useUpdateNodeInternals, useViewport, type Node, type Edge, type NodeProps, Handle, Position, BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { create } from 'zustand';
import { Star, Plus, Minus, Maximize2, Minimize2, Scan, PanelLeftClose, PanelLeftOpen, AlertTriangle, Building2 } from 'lucide-react';
import { Badge, Button, IconButton, Input, Select, SegmentedControl, Skeleton } from './components/ui';
import { CoveragePopover, FilterPanel, PersonDetails, Confirmation, NoResults, NoContacts, emptyFilter } from './components/MapSurroundings';
import { MapIndicators, SupplierLines, MapEvidenceSignals, RelationStrengthEvidence } from './components/MapEvidence';
import { MapLegend, MapSelectionLabel } from './components/MapLegend';
import { ContactOverview } from './components/ContactOverview';
import { SourceRecord } from './components/SourceRecord';
import { buildMapSlice } from './api/mapSlice';
import { interactionSource } from './lib/interactionSource';
import { crmApi } from './api/crmApi';
import { planOrbit } from './lib/orbitLayout';
import { calculateCoverage } from './lib/coverage';
import { lensOptions, lensRing, type Lens } from './lib/lenses';
import { dateKey, historyChanges } from './lib/history';
import { findWarmPath } from './lib/warmPath';
import { getHoverNeighborhood } from './lib/hoverHighlight';
import { TimeControls } from './components/TimeControls';
import { PathControls } from './components/PathControls';
import { Incoming } from './components/Incoming';
import { Integration } from './components/Integration';
import { MeetingBrief } from './components/MeetingBrief';
import { DemoTour } from './components/DemoTour';
import { Shortcuts } from './components/Shortcuts';
import { LoadingSkeleton } from './components/LoadingSkeleton';
import type { Proposal } from './lib/llmExtractor';
import { contactConflicts, findDependencies, findMissingRoles, type MissingRole } from './lib/signals';
import { departments, roles, stances, relationTypes, type CRMData, type Person, type Relation, type Role, type Stance, type RelationType, type SaveInteraction, type EvidenceChange } from './types';
import './style.css';
import './styles/map.css';
import './styles/surroundings.css';
import './styles/advanced.css';
import './styles/motion.css';
import './styles/workbench.css';
import './styles/redesign.css';

type Store={data:CRMData|null; setData:(data:CRMData)=>void};
const useStore=create<Store>(set=>({data:null,setData:data=>set({data})}));
const colors=['var(--heat-1)','var(--heat-2)','var(--heat-3)','var(--heat-4)','var(--heat-5)'];
const uid=()=>crypto.randomUUID();
type PersonNode=Node<{person:Person; color:string; category:string; conflict:string[]; dim:boolean; selected:boolean; onPath:boolean; isTarget:boolean; entranceDelay:number; onSelect:(id:string)=>void; onHover:(id:string|null)=>void},'person'>;
const PersonNodeView=memo(function PersonNodeView({data,id}:NodeProps<PersonNode>){
 const p=data.person; const size=16+p.influence*8; const updateNodeInternals=useUpdateNodeInternals();
 useEffect(()=>{updateNodeInternals(id)},[id,size,updateNodeInternals]); const initials=p.name.split(' ').map(x=>x[0]).join('');
 return <div className={'person-wrap '+(data.dim?'dim ':'')+(data.selected?'selected ':'')+(p.decisionRole==='decision_maker'?'decision-maker ':'')+(p.decisionRole==='blocker'?'blocker ':'')+(data.onPath?'on-path ':'')+(data.isTarget?'path-target':'')} style={{'--entrance-delay':`${data.entranceDelay}ms`,'--contact-size':`${size}px`} as CSSProperties} onMouseEnter={()=>data.onHover(p.id)} onMouseLeave={()=>data.onHover(null)}>
 <Handle type="target" position={Position.Left}/><button aria-label={`${p.name}, ${roles[p.decisionRole]}, ${stances[p.stance]}, влияние ${p.influence} из 5, ${data.category}${data.conflict.length ? ', конфликт касаний' : ''}`} onFocus={()=>data.onHover(p.id)} onBlur={()=>data.onHover(null)} onClick={()=>data.onSelect(p.id)} aria-pressed={data.selected} className="person-hit nodrag nopan"><span className={'person-bubble stance-'+p.stance} style={{width:size,height:size,background:data.color,color:`var(--on-heat-${p.warmth})`}}><span>{p.influence===1?initials[0]:initials}</span>{p.decisionRole==='decision_maker'&&<Star className="node-star" size={16} strokeWidth={1.75} aria-hidden="true"/>}{data.conflict.length>0&&<span className="conflict-marker" title={`Конфликт касаний: ${data.conflict.join(', ')}`} aria-hidden="true">!</span>}</span></button><div className="node-name"><b>{p.name}</b><span>{p.title}</span></div><Handle type="source" position={Position.Right}/></div>
},(prev,next)=>{const a=prev.data,b=next.data;return a.person===b.person&&a.color===b.color&&a.category===b.category&&a.dim===b.dim&&a.selected===b.selected&&a.onPath===b.onPath&&a.isTarget===b.isTarget&&a.entranceDelay===b.entranceDelay&&a.onSelect===b.onSelect&&a.onHover===b.onHover&&a.conflict.join('|')===b.conflict.join('|')});
type GhostNode=Node<{role:MissingRole; onFind:(id:string)=>void},'ghost'>;
function GhostNodeView({data}:NodeProps<GhostNode>){return <div className="ghost-node"><button className="ghost-icon nodrag nopan" aria-label={`Найти точку входа: ${data.role.label}`} onClick={()=>data.onFind(data.role.id)}>?</button><strong>Не найден: {data.role.label}</strong></div>}
const nodeTypes={person:PersonNodeView,ghost:GhostNodeView};
function RelationEdge(props:EdgeProps){const [path]=getBezierPath(props); return <BaseEdge path={path} style={props.style} interactionWidth={24}/>}
const edgeTypes={relation:RelationEdge};
function Radar({people,radii,radarExtent,labels}:{people:Person[];radii:number[];radarExtent:number;labels:string[]}){
 const outer=radii[radii.length-1]+80; const point=(angle:number,r:number)=>({x:Math.cos(angle)*r,y:Math.sin(angle)*r});
 return <svg className="radar" viewBox={`${-radarExtent} ${-radarExtent} ${radarExtent*2} ${radarExtent*2}`} aria-hidden="true"><defs><pattern id="empty-hatch" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="12" stroke="var(--text-1)" strokeOpacity=".06" strokeWidth="1"/></pattern><linearGradient id="relation-gradient"><stop stopColor="var(--map-line)"/><stop offset="1" stopColor="var(--map-line)"/></linearGradient></defs>
 {departments.map((dep,i)=>{const a=(-120+i*60)*Math.PI/180, b=a+Math.PI/3, mid=(a+b)/2; const start=point(a,outer),end=point(b,outer);const empty=!people.some(p=>p.department===dep);const wedge=`M 0 0 L ${start.x} ${start.y} A ${outer} ${outer} 0 0 1 ${end.x} ${end.y} Z`;return <g key={dep}><path d={wedge} fill={i%2?'var(--bg-0)':'var(--bg-1)'} fillOpacity=".25"/><path d={wedge} fill={empty?'url(#empty-hatch)':'none'} stroke={empty?'var(--border-strong)':'none'} strokeDasharray={empty?'4 4':undefined}/><line x1="0" y1="0" x2={start.x} y2={start.y} stroke="var(--border)" strokeOpacity=".6"/><text className="sector-label" x={Math.cos(mid)*(outer+24)} y={Math.sin(mid)*(outer+24)} textAnchor="middle">{dep}</text>{empty&&<text className="empty-sector-label" x={Math.cos(mid)*outer*.68} y={Math.sin(mid)*outer*.68} textAnchor="middle">Нет контактов</text>}</g>})}
 {radii.map((r,i)=><g key={r}><circle className={i===radii.length-1?"radar-ring radar-ring-outer":"radar-ring"} r={r} fill="none"/><text className="ring-label" x={-r} y={-8} textAnchor="middle">{labels[i]==='ЛПР'?'ЛПР':labels[i].toLocaleLowerCase('ru-RU')}</text></g>)}</svg>
}
function MapReadingScale(){const {zoom}=useViewport();useEffect(()=>{document.querySelector<HTMLElement>('.map-area')?.style.setProperty('--map-zoom',String(zoom))},[zoom]);return null;}
function MapControls({expanded,onToggleExpanded}:{expanded:boolean;onToggleExpanded:()=>void}){
 const {zoomIn,zoomOut,fitView}=useReactFlow();
 const ExpandIcon=expanded?Minimize2:Maximize2;
 return <div className="map-controls" aria-label="Управление графом">
  <IconButton aria-label="Увеличить" title="Увеличить" onClick={()=>void zoomIn()}><Plus size={18} strokeWidth={1.75}/></IconButton>
  <IconButton aria-label="Уменьшить" title="Уменьшить" onClick={()=>void zoomOut()}><Minus size={18} strokeWidth={1.75}/></IconButton>
  <IconButton aria-label="Вписать граф" title="Вписать граф" onClick={()=>void fitView({padding:.2})}><Scan size={18} strokeWidth={1.75}/></IconButton>
  <IconButton id="expand-graph" aria-label="Большой граф" aria-pressed={expanded} title={expanded?'Вернуть обычный вид (Esc)':'Большой граф'} onClick={onToggleExpanded}><ExpandIcon size={18} strokeWidth={1.75}/></IconButton>
 </div>;
}
function MapViewport({positions,fitKey,radarExtent,centerId}:{positions:Record<string,{x:number;y:number}>;fitKey:string;radarExtent:number;centerId:string|null}){
 const {setViewport}=useReactFlow();const fitted=useRef(false);const lastSize=useRef('');const bounds=Object.values(positions);const maxX=Math.max(radarExtent,...bounds.map(p=>Math.abs(p.x)+120));const maxY=Math.max(radarExtent,...bounds.map(p=>Math.abs(p.y)+160));
 useEffect(()=>{
  const area=document.querySelector<HTMLElement>('.map-area');if(!area)return;
  const fit=(animate:boolean)=>{
   const width=area.clientWidth,height=area.clientHeight;if(!width||!height)return;
   lastSize.current=`${width}x${height}`;
   const zoom=Math.max(.05,Math.min(.65,(width-48)/(2*maxX),(height-48)/(2*maxY)));
   const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
   void setViewport({x:width/2,y:height/2,zoom},{duration:animate&&!reduced?350:0});
   fitted.current=true;
  };
  fit(fitted.current);
  const observer=new ResizeObserver(()=>{if(`${area.clientWidth}x${area.clientHeight}`!==lastSize.current)fit(false)});
  observer.observe(area);return()=>observer.disconnect();
 },[fitKey,maxX,maxY,radarExtent,setViewport,centerId,positions]);return null;
}
function useAnimatedNodes(nodes:Node[]):Node[]{
 const current=useRef(new Map<string,{x:number;y:number}>());const [positions,setPositions]=useState<Record<string,{x:number;y:number}>>({});
 const signature=nodes.map(node=>`${node.id}:${node.position.x.toFixed(2)}:${node.position.y.toFixed(2)}`).join('|');
 useEffect(()=>{const start=new Map(nodes.map(node=>[node.id,current.current.get(node.id)??node.position]));const target=new Map(nodes.map(node=>[node.id,node.position]));let frame=0;const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;const started=performance.now();const tick=(now:number)=>{const t=reduced?1:Math.min(1,(now-started)/350);const eased=1-Math.pow(1-t,3);const next:Record<string,{x:number;y:number}>={};for(const [id,end] of target){const from=start.get(id)??end;next[id]={x:from.x+(end.x-from.x)*eased,y:from.y+(end.y-from.y)*eased}}current.current=new Map(Object.entries(next));setPositions(next);if(t<1)frame=requestAnimationFrame(tick)};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame)},[signature]);
 return nodes.map(node=>({...node,position:positions[node.id]??node.position}));
}
function usePresenceNodes(nodes:Node[]):Node[]{
 const previous=useRef<Node[]>([]); const [exiting,setExiting]=useState<Node[]>([]); const ids=nodes.map(node=>node.id).sort().join('|');
 const present=new Set(nodes.map(node=>node.id));
 const removed=previous.current.filter(node=>!present.has(node.id)).map(node=>({...node,selectable:false,draggable:false,style:{...node.style,opacity:0,pointerEvents:'none' as const,transition:'opacity .3s ease'}}));
 useEffect(()=>{previous.current=nodes;setExiting(removed);if(!removed.length)return;const timer=setTimeout(()=>setExiting([]),320);return()=>clearTimeout(timer);},[ids]);
 const retained=new Map([...exiting,...removed].filter(node=>!present.has(node.id)).map(node=>[node.id,node]));return [...nodes,...retained.values()];
}
function App(){const {data,setData}=useStore(); const [companyId,setCompany]=useState(()=>{const id=new URLSearchParams(location.search).get('company');return id&&['bank','retail','industry'].includes(id)?id:'bank'}); const [view,setView]=useState<'map'|'incoming'|'integration'>('map'); const [tourStep,setTourStep]=useState<number|null>(null); const [shortcutsOpen,setShortcutsOpen]=useState(false); const returnFocus=useRef<HTMLElement|null>(null); const tourBefore=useRef<{view:'map'|'incoming'|'integration';lens:Lens;expanded:boolean;sidebarPreference:boolean|null}|null>(null); const panelCloseRef=useRef<HTMLButtonElement>(null); const mapRef=useRef<HTMLDivElement>(null); const panelOpener=useRef<HTMLElement|null>(null); const [briefOpen,setBriefOpen]=useState(false); const [historyDate,setHistoryDate]=useState<string|null>(null); const [pathTarget,setPathTarget]=useState(''); const [ghostId,setGhostId]=useState<string|null>(null); const [lens,setLens]=useState<Lens>('decisions'); const [showCoverage,setShowCoverage]=useState(false); const [selected,setSelected]=useState<string|null>(null); const [relationId,setRelation]=useState<string|null>(null); const [editing,setEditing]=useState(false); const [relationEditing,setRelationEditing]=useState(false); const [filter,setFilter]=useState({search:'',department:'',role:'',stance:'',owner:'',recent:''}); const [busy,setBusy]=useState(false); const [modal,setModal]=useState<'delete'|'reset'|'relation'|null>(null); const [toast,setToast]=useState(''); const [centerId,setCenterId]=useState<string|null>(null); const [switching,setSwitching]=useState(false); const [pendingCount,setPendingCount]=useState(0); useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),4000);return()=>clearTimeout(timer)},[toast]);
 const [storageNotice,setStorageNotice]=useState('');
 const [writeError,setWriteError]=useState('');const persisting=useRef(false);
 useEffect(()=>{crmApi.load(setStorageNotice).then(setData)},[setData]);
 const [desktop,setDesktop]=useState(()=>window.matchMedia('(min-width: 901px)').matches);
 const [sidebarPreference,setSidebarPreference]=useState<boolean|null>(null);
 const [graphExpanded,setGraphExpanded]=useState(false);
 const sidebarOpen=sidebarPreference??desktop;
 useEffect(()=>{
  const media=window.matchMedia('(min-width: 901px)');
  const update=(event:MediaQueryListEvent)=>setDesktop(event.matches);
  media.addEventListener('change',update);
  return()=>media.removeEventListener('change',update);
 },[]);
 const toggleSidebar=(open:boolean)=>{
  setSidebarPreference(open);
  requestAnimationFrame(()=>document.getElementById(open?'collapse-map-sidebar':'open-map-sidebar')?.focus());
 };
 const [demoMode,setDemoMode]=useState(()=>new URLSearchParams(location.search).get('demo')==='2026-11-19');
 const [entryVersion,setEntryVersion]=useState(0);
 const [entryPerson,setEntryPerson]=useState<string|null>(null);
 const [entryChange,setEntryChange]=useState<EvidenceChange|undefined>();
 const [sourceId,setSourceId]=useState<string|null>(null);
 const sourceReturn=useRef<{selected:string|null;relationId:string|null;briefOpen:boolean;view:typeof view;centerId:string|null;opener:HTMLElement|null}|null>(null);
 const today=demoMode?'2026-11-19':dateKey(new Date()); const activeDate=historyDate??today; const historical=activeDate<today; const asOf=useMemo(()=>new Date(`${activeDate}T12:00:00`),[activeDate]);
 const slice=useMemo(()=>data?buildMapSlice(data,companyId,activeDate,today,selected):null,[data,companyId,activeDate,today,selected]);
 useEffect(()=>{if(data&&!data.companies.some(item=>item.id===companyId))setCompany(data.companies[0].id)},[data,companyId]);
 const livePeople=useMemo(()=>data?.people.filter(p=>p.companyId===companyId)??[],[data,companyId]);
 const people=useMemo(()=>[...(slice?.people??[])],[slice]);
 const peopleIds=useMemo(()=>new Set(people.map(p=>p.id)),[people]); const relations=useMemo(()=>[...(slice?.relations??[])],[slice]);
 const company=data?.companies.find(c=>c.id===companyId); const person=people.find(p=>p.id===selected); const relation=relations.find(r=>r.id===relationId);
 const interactions=useMemo(()=>[...(slice?.interactions??[])],[slice]); const now=asOf; const getRing=(p:Person)=>lensRing(p,lens,interactions,now); const missing=useMemo(()=>findMissingRoles(people),[people]); const dependencies=useMemo(()=>findDependencies(people,relations),[people,relations]); const conflicts=useMemo(()=>contactConflicts(interactions,now),[interactions,now]); const orbit=useMemo(()=>{const items=[...people.map(p=>({id:p.id,department:p.department,ring:lensRing(p,lens,interactions,now),ghost:false})),...missing.map(role=>({id:'ghost-'+role.id,department:role.department,ring:0,ghost:true}))];return planOrbit(items,item=>item.ring)},[people,lens,interactions,now,missing]); const positions=orbit.positions;const radarExtent=orbit.extent; const ghost=missing.find(role=>role.id===ghostId); const coverage=useMemo(()=>calculateCoverage(people,interactions,now),[people,interactions,now]);
 const context=useRef({companyId,historical,today});context.current={companyId,historical,today};
 const onSaveInteraction=useCallback<SaveInteraction>(async(id,draft,change)=>{
  const current=useStore.getState().data;const scope=context.current;
  if(!current||scope.companyId!==id)return {ok:false,error:'Клиент изменился. Откройте форму нужного клиента.'};
  if(scope.historical)return {ok:false,error:'Вернитесь к текущей карте для сохранения.'};
  return crmApi.saveInteraction(current,id,draft,change,scope.today,setData);
 },[setData]);
 const openSource=(interactionId:string)=>{
  if(context.current.companyId!==companyId)return;
  const record=slice&&interactionSource(slice,interactionId);
  if(!record){setToast('Источник недоступен в выбранной компании или на эту дату.');return}
  sourceReturn.current={selected,relationId,briefOpen,view,centerId,opener:document.activeElement instanceof HTMLElement?document.activeElement:null};
  const activePerson=peopleIds.has(record.personId)?record.personId:null;
  setSourceId(interactionId);setSelected(activePerson);setCenterId(activePerson);setRelation(null);setGhostId(null);setEditing(false);setRelationEditing(false);setBriefOpen(false);setView('map');
 };
 const returnFromSource=()=>{const previous=sourceReturn.current;setSourceId(null);if(previous){setSelected(previous.selected);setRelation(previous.relationId);setBriefOpen(previous.briefOpen);setView(previous.view);setCenterId(previous.centerId);requestAnimationFrame(()=>previous.opener?.isConnected&&previous.opener.focus())}};
 const openEntry=()=>{setEntryChange(undefined);setEntryPerson(selected);setEntryVersion(value=>value+1);setView('incoming');setSourceId(null);};
 useEffect(()=>{
  if(view!=='incoming')return;
  const workspace=document.getElementById('incoming-workspace');
  workspace?.scrollIntoView({block:'start'});
  workspace?.querySelector<HTMLSelectElement>('[aria-label="Новое наблюдение"] select')?.focus({preventScroll:true});
 },[view,companyId,entryVersion]);
 const openStrengthEntry=(change:Extract<EvidenceChange,{kind:'relation-strength'}>)=>{
  const edge=slice?.relations.find(item=>item.id===change.relationId);
  if(historical||!edge)return;
  setEntryChange(change);setEntryPerson(edge.from);setEntryVersion(value=>value+1);setView('incoming');setSourceId(null);
 };
 const path=useMemo(()=>pathTarget?findWarmPath(people,relations,pathTarget):null,[people,relations,pathTarget]); const pathNodes=new Set(path?[path.start,...path.steps.map(step=>step.to)]:[]);const pathEdges=new Set(path?.steps.map(step=>step.relation.id)??[]);
 const snapshots=data?.snapshots??[]; const history=useMemo(()=>historyChanges(snapshots,data?.interactions??[],companyId,activeDate),[snapshots,data,companyId,activeDate]); const allHistory=useMemo(()=>historyChanges(snapshots,data?.interactions??[],companyId,today),[snapshots,data,companyId,today]); const firstDate=snapshots.filter(s=>s.person.companyId===companyId&&s.date<=today).reduce((first,s)=>s.date<first?s.date:first,today);

 const last=(id:string)=>interactions.filter(i=>i.personId===id).sort((a,b)=>b.date.localeCompare(a.date))[0]?.date;
 const matches=(p:Person)=>{const d=last(p.id); const age=d?(Date.parse(activeDate)-Date.parse(d))/86400000:Infinity; return p.name.toLowerCase().includes(filter.search.toLowerCase())&&(!filter.department||p.department===filter.department)&&(!filter.role||p.decisionRole===filter.role)&&(!filter.stance||p.stance===filter.stance)&&(!filter.owner||p.owner===filter.owner)&&(!filter.recent||(filter.recent==='90'?age<=90:filter.recent==='365'?age<=365:age>365));};
 const highlightNeighbors=useCallback((id:string|null)=>{
  const map=mapRef.current;if(!map)return;
  const active=Boolean(id&&!path);const {nodes:nodeIds,edges:edgeIds}=getHoverNeighborhood(active?id:null,relations);
  map.querySelectorAll<HTMLElement>('.react-flow__node').forEach(node=>node.classList.toggle('hover-connected',active&&nodeIds.has(node.dataset.id??'')));
  map.querySelectorAll<HTMLElement>('.react-flow__edge').forEach(edge=>edge.classList.toggle('hover-connected',active&&edgeIds.has(edge.dataset.id??'')));
  map.classList.toggle('hover-active',active);
 },[relations,path]);
 useEffect(()=>{highlightNeighbors(null)},[highlightNeighbors]);
 const filterSignature=JSON.stringify(filter); const previousFilter=useRef(filterSignature);
 useEffect(()=>{if(previousFilter.current===filterSignature)return;previousFilter.current=filterSignature;const map=mapRef.current;if(!map)return;const eligible=new Set(people.filter(p=>path?pathNodes.has(p.id):matches(p)).map(p=>p.id));const targets=Array.from(map.querySelectorAll<HTMLElement>('.react-flow__node')).filter(node=>eligible.has(node.dataset.id??'')).flatMap(node=>{const wrap=node.querySelector<HTMLElement>('.person-wrap');return wrap?[wrap]:[]});targets.forEach(node=>node.classList.remove('filter-flash'));const frame=requestAnimationFrame(()=>targets.forEach(node=>node.classList.add('filter-flash')));const timer=setTimeout(()=>targets.forEach(node=>node.classList.remove('filter-flash')),320);return()=>{cancelAnimationFrame(frame);clearTimeout(timer);targets.forEach(node=>node.classList.remove('filter-flash'))}},[filterSignature]);
 const selectPerson=useCallback((id:string)=>{panelOpener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setSourceId(null);setCenterId(id);setSelected(id);setRelation(null);setGhostId(null);setBriefOpen(false);setEditing(false)},[]);
 const orderedForEntrance=[...people].sort((a,b)=>departments.indexOf(a.department)-departments.indexOf(b.department));const entranceOrder=new Map(orderedForEntrance.map((person,index)=>[person.id,Math.min(index*10,400)]));
 const personNodes:PersonNode[]=people.map(p=>({id:p.id,type:'person',initialWidth:100,initialHeight:100,position:{x:positions[p.id].x-50,y:positions[p.id].y-50},data:{person:p,color:colors[p.warmth-1]??colors[0],category:lensOptions[lens].rings[getRing(p)],conflict:conflicts.get(p.id)??[],dim:path?!pathNodes.has(p.id):!matches(p),onPath:pathNodes.has(p.id),isTarget:path?.target===p.id,entranceDelay:entranceOrder.get(p.id)??0,selected:p.id===selected,onSelect:selectPerson,onHover:highlightNeighbors},draggable:false}));
 const ghostNodes:GhostNode[]=missing.map(role=>({id:'ghost-'+role.id,type:'ghost',initialWidth:160,initialHeight:110,position:{x:positions['ghost-'+role.id].x-80,y:positions['ghost-'+role.id].y-55},data:{role,onFind:(id:string)=>{panelOpener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setGhostId(id);setSelected(null);setRelation(null);setEditing(false);setRelationEditing(false)}},draggable:false})); const nodes:Node[]=[...personNodes,...ghostNodes]; const animatedNodes=useAnimatedNodes(nodes); const visibleNodes=usePresenceNodes(animatedNodes);
 const openRelation=(id:string)=>{setCenterId(null);setSourceId(null);panelOpener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setRelation(id);setSelected(null);setGhostId(null);setEditing(false);setRelationEditing(false);setBriefOpen(false)};
 const edges:Edge[]=relations.map(r=>({id:r.id,source:r.from,target:r.to,type:'relation',focusable:true,ariaRole:'button',domAttributes:{onKeyDown:event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();openRelation(r.id)}}},ariaLabel:`Связь: ${people.find(p=>p.id===r.from)?.name??r.from} — ${people.find(p=>p.id===r.to)?.name??r.to}, ${relationTypes[r.type]}`,className:[pathEdges.has(r.id)?'path-highlight':'',!pathEdges.has(r.id)&&(relationId===r.id||selected===r.from||selected===r.to)?'map-edge-active':''].filter(Boolean).join(' '),style:{stroke:pathEdges.has(r.id)?'var(--brand-green)':relationId===r.id?'var(--brand-sky)':'url(#relation-gradient)',strokeWidth:pathEdges.has(r.id)?3:1+(r.strength-1)*.75,strokeDasharray:pathEdges.has(r.id)?'8 6':r.type==='informal'?'4 4':undefined,opacity:path?(pathEdges.has(r.id)?1:.3):.75}}));
 const persist=async(next:CRMData):Promise<boolean>=>{if(!data||persisting.current)return false;persisting.current=true;setWriteError('');try{await crmApi.save(next,data,setData);return true}catch(error){setWriteError(error instanceof Error?error.message:'Не удалось сохранить изменения в браузере. Повторите сохранение.');return false}finally{persisting.current=false}};
 const savePerson=async(p:Person)=>{if(!data)return; if(!await persist({...data,people:data.people.some(x=>x.id===p.id)?data.people.map(x=>x.id===p.id?p:x):[...data.people,p],snapshots:[...data.snapshots,{personId:p.id,date:today,person:structuredClone(p)}]}))return;setToast('Контакт сохранён');setSelected(p.id);setEditing(false)};
 const deletePerson=async()=>{if(!data||!person)return; setModal(null);if(!await persist({...data,people:data.people.filter(p=>p.id!==person.id),relations:data.relations.filter(r=>r.from!==person.id&&r.to!==person.id),snapshots:[...data.snapshots,{personId:person.id,date:today,person:structuredClone(person),deleted:true}]}))return;setToast('Контакт удалён');setSelected(null)};
 const saveRelation=async(r:Relation)=>{if(!data)return; if(!await persist({...data,relations:data.relations.some(x=>x.id===r.id)?data.relations.map(x=>x.id===r.id?r:x):[...data.relations,r]}))return;setToast('Связь сохранена');setRelation(r.id);setRelationEditing(false)};
 const acceptProposal=async(proposal:Proposal):Promise<string|null>=>{
  if(!data||historical)return 'Вернитесь к текущей карте.';
  const companyPeople=data.people.filter(p=>p.companyId===companyId); const normal=(name:string)=>name.trim().toLocaleLowerCase('ru'); const lookup=(name:string)=>companyPeople.filter(p=>normal(p.name)===normal(name));
  if(proposal.kind==='person'){
   if(!proposal.name.trim()||!proposal.title.trim())return 'Укажите имя и должность.';
   if(!departments.includes(proposal.department))return 'Выберите подразделение из списка.';
   if(lookup(proposal.name).length)return 'Контакт с таким именем уже есть у клиента.';
   const newPerson:Person={id:uid(),companyId,name:proposal.name.trim(),department:proposal.department,title:proposal.title.trim(),decisionRole:proposal.role,stance:'neutral',influence:3,warmth:3,owner:proposal.owner.trim(),interests:[],consentMarketing:false};
   return await persist({...data,people:[...data.people,newPerson],snapshots:[...data.snapshots,{personId:newPerson.id,date:today,person:structuredClone(newPerson)}]})?null:'Не удалось сохранить контакт. Повторите подтверждение.';
  }
  if(proposal.kind==='role'){
   const found=lookup(proposal.name);if(found.length!==1)return found.length?'Найдено несколько контактов с таким именем; уточните карточку.':'Контакт не найден у выбранного клиента. Проверьте имя.';
   if(found[0].decisionRole===proposal.role)return 'У контакта уже указана эта роль.';
   const updated={...found[0],decisionRole:proposal.role};return await persist({...data,people:data.people.map(p=>p.id===updated.id?updated:p),snapshots:[...data.snapshots,{personId:updated.id,date:today,person:structuredClone(updated)}]})?null:'Не удалось сохранить роль. Повторите подтверждение.';
  }
  const from=lookup(proposal.from);const to=lookup(proposal.to);if(from.length!==1||to.length!==1)return 'Укажите точные имена двух существующих контактов; сначала примите нового участника.';
  if(from[0].id===to[0].id)return 'Выберите двух разных людей.';
  if(data.relations.some(r=>r.companyId===companyId&&((r.from===from[0].id&&r.to===to[0].id)||(r.from===to[0].id&&r.to===from[0].id))))return 'Между этими людьми связь уже существует; измените её на карте.';
  const relation:Relation={id:uid(),companyId,from:from[0].id,to:to[0].id,type:proposal.relationType,strength:proposal.strength};return await persist({...data,relations:[...data.relations,relation]})?null:'Не удалось сохранить связь. Повторите подтверждение.';
 };
 const changeCompany=(id:string)=>{setWriteError('');setSourceId(null);sourceReturn.current=null;setEntryPerson(null);setEntryChange(undefined);setPendingCount(0);const url=new URL(location.href);url.searchParams.set('company',id);window.history.replaceState(null,'',url);setSwitching(true);window.setTimeout(()=>setSwitching(false),220);setCenterId(null);setCompany(id);setHistoryDate(null);setPathTarget('');setGhostId(null);setSelected(null);setRelation(null);setEditing(false);setRelationEditing(false);setBriefOpen(false);setFilter({search:'',department:'',role:'',stance:'',owner:'',recent:''})};
 const closePanel=()=>{setWriteError('');setCenterId(null);setSourceId(null);sourceReturn.current=null;setSelected(null);setRelation(null);setGhostId(null);setEditing(false);setRelationEditing(false);setBriefOpen(false);requestAnimationFrame(()=>panelOpener.current?.focus())};
 const applyTourStep=(step:number)=>{setView('map');if(step===0)setLens(tourBefore.current?.lens??'decisions');else if(step===1)setLens('marketing');else if(step===4)setLens('risks');setTourStep(step)};
 const startTour=()=>{setSourceId(null);returnFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;tourBefore.current={view,lens,expanded:graphExpanded,sidebarPreference};setGraphExpanded(false);setSidebarPreference(true);setSelected(null);setRelation(null);setGhostId(null);setEditing(false);setRelationEditing(false);setBriefOpen(false);setShortcutsOpen(false);applyTourStep(0)};
 const closeTour=()=>{setTourStep(null);if(tourBefore.current){setView(tourBefore.current.view);setLens(tourBefore.current.lens);setGraphExpanded(tourBefore.current.expanded);setSidebarPreference(tourBefore.current.sidebarPreference)}requestAnimationFrame(()=>{const target=returnFocus.current?.isConnected?returnFocus.current:document.getElementById('demo-button');target?.focus()})};
 const openShortcuts=()=>{returnFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setShortcutsOpen(true)};
 const closeShortcuts=()=>{setShortcutsOpen(false);requestAnimationFrame(()=>returnFocus.current?.focus())};
 useEffect(()=>{if(!sourceId&&view==='map'&&(selected||ghostId||relationId||editing||relationEditing))panelCloseRef.current?.focus()},[view,selected,ghostId,relationId,editing,relationEditing,sourceId]);
 useEffect(()=>{
  const handle=(event:KeyboardEvent)=>{
   if(event.defaultPrevented||tourStep!==null||shortcutsOpen||modal||!data)return;
   const target=event.target;
   const typing=target instanceof HTMLElement&&(target.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(target.tagName));
   if(event.key==='Escape'){
    if(view==='map'&&graphExpanded){
     event.preventDefault();setGraphExpanded(false);
     requestAnimationFrame(()=>document.getElementById('expand-graph')?.focus());
     return;
    }
    if(selected||ghostId||relationId||editing||relationEditing){event.preventDefault();closePanel();return}
    if(showCoverage){event.preventDefault();setShowCoverage(false);return}
   }
   if(typing)return;
   if(event.altKey&&!event.ctrlKey&&!event.metaKey&&['1','2','3'].includes(event.key)){
    event.preventDefault();setView((['map','incoming','integration'] as const)[Number(event.key)-1]);return;
   }
   if(event.altKey||event.ctrlKey||event.metaKey)return;
   if(event.key==='?'||(event.key==='/'&&event.shiftKey)){event.preventDefault();openShortcuts()}
   else if(event.key.toLowerCase()==='d'){event.preventDefault();startTour()}
   else if(event.key==='/'&&view==='map'&&!graphExpanded){
    event.preventDefault();setSidebarPreference(true);
    requestAnimationFrame(()=>document.getElementById('map-search')?.focus());
   }
  };
  window.addEventListener('keydown',handle);
  return()=>window.removeEventListener('keydown',handle);
 },[view,lens,tourStep,shortcutsOpen,modal,data,selected,ghostId,relationId,editing,relationEditing,showCoverage,graphExpanded,sidebarPreference]);
 if(!data||!company||!slice)return <LoadingSkeleton/>;
 const sharedProps={slice,companyId,onSaveInteraction,onOpenSource:openSource,selectedPersonId:selected,initialPersonId:entryPerson,highlightedInteractionId:sourceId,today};
 const timeline=interactions.filter(i=>i.personId===selected).sort((a,b)=>b.date.localeCompare(a.date)); const owners=[...new Set(people.map(p=>p.owner))];
 const companyOverview=<><MapIndicators slice={slice} onOpenSource={openSource}/><details className="panel-disclosure"><summary>Поставщики и источники</summary><SupplierLines slice={slice} companyName={company.name} onOpenSource={openSource}/></details><details className="panel-disclosure"><summary>Сигналы и точки входа</summary><MapEvidenceSignals slice={slice} onOpenPerson={id=>{selectPerson(id);setCenterId(id)}} onOpenSource={openSource}/> {(dependencies.length>0||[...conflicts.keys()].some(id=>peopleIds.has(id)))&&<details className="risk-panel" open><summary>Риски и сигналы <Badge>{dependencies.length+[...conflicts.keys()].filter(id=>peopleIds.has(id)).length}</Badge></summary><div className="risk-list">{dependencies.map(r=><article className="risk-card" key={r.kind+r.name}><AlertTriangle size={20} strokeWidth={1.75} aria-hidden="true"/><div><strong>Риск зависимости</strong><p>{r.kind==='owner'?`Сотрудник ${r.name} ведёт ${r.count} из ${r.total} тёплых контактов`:`Контакт ${r.name} связан с ${r.count} из ${r.total} тёплых контактов`} ({r.percent.toFixed(1).replace('.',',')}%).</p><details><summary>Рекомендации</summary><p>Познакомьте с клиентом других сотрудников и развивайте прямые отношения.</p></details></div></article>)}{[...conflicts].filter(([id])=>peopleIds.has(id)).map(([id,units])=><article className="risk-card high" key={id}><AlertTriangle size={20} strokeWidth={1.75} aria-hidden="true"/><div><strong>Конфликт касаний · {people.find(p=>p.id===id)?.name}</strong><p>За последние 30 дней общались: {units.join(', ')}.</p><details><summary>Рекомендации</summary><p>Согласуйте дальнейшие действия между командами.</p><Button variant="ghost" onClick={()=>{setSelected(id);setGhostId(null);setRelation(null)}}>Открыть контакт</Button></details></div></article>)}</div></details>}
 {missing.length>0&&<details className="missing-panel"><summary>Белые пятна <Badge>{missing.length}</Badge></summary><div>{missing.map(role=><div className="missing-row" key={role.id}><span><strong>{role.label}</strong><small>{role.description}</small></span><Button variant="ghost" onClick={()=>{panelOpener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setGhostId(role.id);setSelected(null);setRelation(null);setEditing(false);setRelationEditing(false)}}>Найти точку входа</Button></div>)}</div></details>}
</details></>;
 return <div className="app redesign-app" data-view={view}><header className="topbar surround-header">
 <div className="app-wordmark">Карта ЛПР <small>CRM КРОК</small></div>
 <Select className="header-company" aria-label="Выбрать клиента" value={companyId} onChange={e=>changeCompany(e.target.value)}>{data.companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</Select>
 <nav className="header-nav" aria-label="Разделы приложения"><Button variant="ghost" aria-current={view==='map'?'page':undefined} onClick={()=>setView('map')}>Карта</Button><Button variant="ghost" aria-current={view==='incoming'?'page':undefined} onClick={()=>setView('incoming')}>Входящие {pendingCount>0&&<Badge className="pending-count">{pendingCount}</Badge>}</Button><Button variant="ghost" aria-current={view==='integration'?'page':undefined} onClick={()=>setView('integration')}>CRM</Button></nav>
 <Button variant="ghost" id="demo-button" onClick={startTour}>Демо</Button><Button variant="ghost" aria-label="Горячие клавиши" onClick={openShortcuts}>?</Button><CoveragePopover coverage={coverage} open={showCoverage} onToggle={()=>setShowCoverage(!showCoverage)}/>
 </header>
 {storageNotice&&<p className="success-note" role="status">{storageNotice}</p>}<main hidden={view!=='map'} className="map-main" data-sidebar-open={sidebarOpen} data-graph-expanded={graphExpanded}>
 <aside id="map-sidebar" className="map-sidebar" aria-label="Легенда и фильтры" hidden={!sidebarOpen||graphExpanded}>
  <div className="map-sidebar-toolbar"><Button id="collapse-map-sidebar" variant="ghost" aria-controls="map-sidebar" aria-expanded={true} onClick={()=>toggleSidebar(false)}><PanelLeftClose size={16} strokeWidth={1.75} aria-hidden="true"/>Свернуть</Button></div>
  <MapLegend lens={lens}/><FilterPanel filter={filter} onChange={setFilter} owners={owners} shown={people.filter(matches).length} total={people.length}/>
 <details className="map-settings"><summary>Данные и настройки</summary><p>Синтетические данные · {activeDate.split('-').reverse().join('.')}</p><Button variant="ghost" onClick={()=>{const enabled=!demoMode;setDemoMode(enabled);setHistoryDate(null);setSourceId(null);setSelected(null);setRelation(null);setEditing(false);setRelationEditing(false);setEntryVersion(value=>value+1);const url=new URL(location.href);if(enabled)url.searchParams.set('demo','2026-11-19');else url.searchParams.delete('demo');window.history.replaceState(null,'',url)}}>{demoMode?'Часы браузера':'Демодата 19.11.2026'}</Button><Button variant="ghost" disabled={busy} onClick={()=>setModal('reset')}>Сбросить к данным CRM</Button></details></aside>
 <section className="workspace" aria-label="Карта связей"><div className="workspace-head"><div className="workspace-heading">
 {!sidebarOpen&&<Button id="open-map-sidebar" variant="ghost" aria-expanded={false} aria-controls="map-sidebar" onClick={()=>toggleSidebar(true)}><PanelLeftOpen size={16} strokeWidth={1.75} aria-hidden="true"/>Легенда и фильтры</Button>}
 <h1>Карта связей <span className="count">{people.length}</span></h1></div><div className="actions"><Button disabled={historical} data-tour="observation-entry" onClick={openEntry}>Добавить наблюдение</Button><Button disabled={historical||people.length<2} title={people.length<2?'Для связи нужны два контакта':historical?'Редактирование доступно на текущей карте':undefined} onClick={()=>{panelOpener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setSourceId(null);setSelected(null);setRelation(null);setGhostId(null);setRelationEditing(true)}}><Plus size={15} strokeWidth={1.75} aria-hidden="true"/>Связь</Button><Button disabled={historical} title={historical?'Редактирование доступно на текущей карте':undefined} onClick={()=>{panelOpener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setSourceId(null);setSelected(null);setRelation(null);setGhostId(null);setEditing(true)}}><Plus size={15} strokeWidth={1.75} aria-hidden="true"/>Контакт</Button></div></div>
 <div className="lens-bar"><div data-tour="lenses"><SegmentedControl label="Линза карты" value={lens} options={(Object.keys(lensOptions) as Lens[]).map(value=>({value,label:lensOptions[value].label}))} onChange={setLens}/><p>Что показывает эта линза: {lensOptions[lens].description}</p></div></div>
<div className="orbit-key" aria-label="Легенда колец">{lensOptions[lens].rings.map((label,index)=><div key={label}><b>0{index+1}</b><span>{label==='ЛПР'?'ЛПР':label.toLocaleLowerCase('ru-RU')}</span>{!people.some(p=>getRing(p)===index)&&<small>Нет контактов</small>}</div>)}</div>
<div className="map-area" ref={mapRef}>{switching&&<div className="switch-skeleton" role="status" aria-label="Загрузка карты клиента"><Skeleton/><Skeleton/><Skeleton/></div>}{people.length===0?<NoContacts/>:people.filter(matches).length===0?<NoResults onReset={()=>setFilter(emptyFilter)}/>:null}<ReactFlow nodes={visibleNodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} minZoom={0.05} maxZoom={1.5} defaultViewport={{x:0,y:0,zoom:.25}} onEdgeClick={(_,edge)=>openRelation(edge.id)} nodesConnectable={false} elementsSelectable={false} proOptions={{hideAttribution:true}}><MapViewport positions={positions} radarExtent={orbit.radii[orbit.radii.length-1]+140} centerId={centerId} fitKey={`${companyId}-${lens}-${activeDate}-${people.length}`}/><MapReadingScale/><MapControls expanded={graphExpanded} onToggleExpanded={()=>setGraphExpanded(value=>!value)}/><ViewportPortal><div className="orbit-layer" style={{width:radarExtent*2,height:radarExtent*2,left:-radarExtent,top:-radarExtent}}><Radar key={companyId} people={people} radii={orbit.radii} radarExtent={radarExtent} labels={lensOptions[lens].rings}/><div className="decision"><Building2 size={32} strokeWidth={1.75} aria-hidden="true"/><strong>{company.name}</strong><small>{company.initiative}</small></div></div></ViewportPortal></ReactFlow><MapSelectionLabel slice={slice} relation={relation}/><div className="map-footer">Прокрутка — масштаб &nbsp; / &nbsp; Перетащите карту</div></div>
 <div className="map-drawers"><details id="path-section"><summary>Маршрут знакомства</summary><PathControls people={people} target={pathTarget} onTarget={setPathTarget} path={path}/></details><details id="map-history" open={tourStep===2?true:undefined}><summary>История карты <time>{activeDate.split('-').reverse().join('.')}</time></summary><TimeControls date={activeDate} today={today} min={firstDate} changes={history} events={allHistory} onDate={value=>{setSourceId(null);sourceReturn.current=null;setHistoryDate(value===today?null:value);setBriefOpen(false);setSelected(null);setRelation(null);setGhostId(null);setEditing(false);setRelationEditing(false);setPathTarget('')}}/></details></div></section>
 </main>
 <main id="incoming-workspace" hidden={view==='map'}><div className="feature-company"><label htmlFor="feature-company">Клиент</label><select id="feature-company" value={companyId} onChange={e=>changeCompany(e.target.value)}>{data.companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div><div hidden={view!=='incoming'}><Incoming {...sharedProps} key={`${companyId}-${today}-${entryVersion}`} evidence={{companyId,people:slice.people,relations:slice.relations,saveInteraction:onSaveInteraction,selectedPersonId:entryPerson,asOf:activeDate,disabled:historical,onOpenSaved:openSource,initialChange:entryChange}} people={livePeople} relations={data.relations.filter(r=>r.companyId===companyId)} onAccept={acceptProposal} disabled={historical} onCount={setPendingCount}/></div>{view==='integration'&&<Integration {...sharedProps} key={companyId} data={data} companyId={companyId} companyName={company.name}/>}</main>

 {view==='map'&&<aside className={`panel ${sourceId||person||ghost||editing||relation||relationEditing?'':'panel-empty'}`} aria-label="Карточка контакта"><button ref={panelCloseRef} className="close" aria-label="Закрыть панель" onClick={closePanel}>×</button>{writeError&&<p className="proposal-error" role="alert">{writeError}</p>}{sourceId&&interactionSource(slice,sourceId)?<SourceRecord interaction={interactionSource(slice,sourceId)!} slice={slice} onBack={returnFromSource}/>:editing?<PersonForm key={person?.id??'new'} person={person} companyId={companyId} onSave={savePerson} onCancel={()=>person?setEditing(false):closePanel()}/>:relationEditing?<RelationForm key={relation?.id??'new'} relation={relation} people={people} companyId={companyId} onSave={saveRelation} onCancel={()=>relation?setRelationEditing(false):closePanel()}/>:ghost?<><div className="eyebrow">Белое пятно <span>/</span> Точка входа</div><h2>{ghost.label}</h2><p className="muted">{ghost.description} пока не найден среди контактов клиента. {ghost.id==='ciso'?'Роль определяется по должности руководителя ИБ.':ghost.id==='business'?'Роль определяется по бизнес-подразделению и роли ЛПР.':'Роль определяется по подразделению контакта.'}</p><div className="panel-section"><div className="section-title">С кого начать <span>↗</span></div><p className="muted">Возможные точки входа — контакты с самой высокой теплотой и влиянием. Связь с нужной ролью не подтверждена: попросите представить коллегу.</p>{[...people].sort((a,b)=>b.warmth-a.warmth||b.influence-a.influence).slice(0,3).map(candidate=><button className="entry-candidate" key={candidate.id} onClick={()=>{setGhostId(null);setBriefOpen(false);setSelected(candidate.id)}}><strong>{candidate.name}</strong><span>{candidate.department} · теплота {candidate.warmth}/5 · влияние {candidate.influence}/5</span></button>)}{people.length===0&&<p className="muted">Нет контактов для рекомендации. Добавьте первый контакт клиента.</p>}</div></>:person&&briefOpen?<MeetingBrief {...sharedProps} onOpenSource={openSource} person={person} companyName={company.name} initiative={company.initiative} people={people} relations={relations} interactions={interactions} asOf={activeDate} onBack={()=>setBriefOpen(false)}/>:person?<ContactOverview person={person} slice={slice} onOpenSource={openSource} onAdd={openEntry} onSelect={selectPerson} companyIndicators={companyOverview}><PersonDetails {...sharedProps} mapEvidence={{slice,onOpenSource:openSource,sourceInteractionId:sourceId??undefined}} person={person} people={people} relations={relations} timeline={timeline} asOf={asOf} conflicts={conflicts.get(person.id)??[]} historical={historical} onEdit={()=>setEditing(true)} onBrief={()=>setBriefOpen(true)} onPath={()=>{setPathTarget(person.id);closePanel();requestAnimationFrame(()=>{const section=document.getElementById('path-section') as HTMLDetailsElement|null;if(section)section.open=true;section?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'})})}} onSelect={id=>{setSourceId(null);setSelected(id);setCenterId(id)}} onDelete={()=>setModal('delete')}/></ContactOverview>:relation?<><div className="eyebrow">Связь <span>/</span> CRM</div><h2 className="relation-title">Связь контактов</h2><p className="muted">{people.find(p=>p.id===relation.from)?.name} ↔ {people.find(p=>p.id===relation.to)?.name}</p><div className="panel-section"><div className="detail"><span>Тип</span><strong>{relationTypes[relation.type]}</strong></div><div className="detail"><span>Сила</span><strong>{relation.strength} / 5</strong></div></div><RelationStrengthEvidence slice={slice} relation={relation} onOpenSource={openSource} onConfirmStrength={openStrengthEntry}/><div className="profile-actions"><button disabled={historical} onClick={()=>setRelationEditing(true)}>✎ Редактировать</button><button className="danger" disabled={historical} onClick={()=>setModal('relation')}>Удалить</button></div></>:<><div className="company-heading"><Building2 size={24} strokeWidth={1.75} aria-hidden="true"/><h2>{company.name}</h2><p>Выберите контакт на карте</p><small>Роль, отношения и подтверждённые знания — в одной карточке.</small></div>{companyOverview}</>}</aside>}
 {modal&&<Confirmation title={modal==='delete'?'Удалить контакт?':modal==='relation'?'Удалить связь?':'Сбросить изменения?'} description={modal==='delete'?'Контакт и его связи будут удалены.':modal==='relation'?'Связь между контактами будет удалена.':'Изменения будут заменены данными CRM.'} onClose={()=>setModal(null)} onConfirm={async()=>{if(modal==='delete'){deletePerson();return}if(modal==='relation'&&relation){if(!await persist({...data,relations:data.relations.filter(r=>r.id!==relation.id)}))return;setRelation(null);setModal(null);setToast('Связь удалена');return}setModal(null);setBusy(true);void crmApi.reset(data).then(next=>{setSourceId(null);sourceReturn.current=null;setData(next);setHistoryDate(null);setPathTarget('');setGhostId(null);setSelected(null);setRelation(null);setToast('Данные CRM восстановлены')}).catch(()=>setToast('Не удалось восстановить данные CRM.')).finally(()=>setBusy(false))}}/>}{toast&&<div className="app-toast" role="status">{toast}</div>}
 {tourStep!==null&&<DemoTour step={tourStep} onStep={applyTourStep} onClose={closeTour}/>}
 {shortcutsOpen&&<Shortcuts onClose={closeShortcuts}/>}
 </div>
}
function PersonForm({person,companyId,onSave,onCancel}:{person?:Person;companyId:string;onSave:(p:Person)=>void;onCancel:()=>void}){const [p,set]=useState<Person>(person??{id:uid(),companyId,name:'',department:'ИТ',title:'',decisionRole:'evaluator',stance:'neutral',influence:3,warmth:3,owner:'',interests:[],consentMarketing:false});return <form onSubmit={e=>{e.preventDefault();onSave(p)}}><div className="eyebrow">Контакт <span>/</span> CRM</div><h2>{person?'Изменить контакт':'Новый контакт'}</h2><label>Имя и фамилия<Input required value={p.name} onChange={e=>set({...p,name:e.target.value})}/></label><label>Должность<Input required value={p.title} onChange={e=>set({...p,title:e.target.value})}/></label><label>Подразделение<Select value={p.department} onChange={e=>set({...p,department:e.target.value})}>{departments.map(x=><option key={x}>{x}</option>)}</Select></label><label>Роль<Select value={p.decisionRole} onChange={e=>set({...p,decisionRole:e.target.value as Role})}>{Object.entries(roles).map(([v,l])=><option key={v} value={v}>{l}</option>)}</Select></label><label>Позиция<Select value={p.stance} onChange={e=>set({...p,stance:e.target.value as Stance})}>{Object.entries(stances).map(([v,l])=><option key={v} value={v}>{l}</option>)}</Select></label><label>Влияние: {p.influence} / 5<Input type="range" min="1" max="5" value={p.influence} onChange={e=>set({...p,influence:Number(e.target.value)})}/></label><label>Теплота: {p.warmth} / 5<Input type="range" min="1" max="5" value={p.warmth} onChange={e=>set({...p,warmth:Number(e.target.value)})}/></label><label>Владелец контакта<Input required value={p.owner} onChange={e=>set({...p,owner:e.target.value})}/></label><div className="form-actions"><Button type="button" onClick={onCancel}>Отмена</Button><Button type="submit" variant="primary">Сохранить</Button></div></form>}
function RelationForm({relation,people,companyId,onSave,onCancel}:{relation?:Relation;people:Person[];companyId:string;onSave:(r:Relation)=>void;onCancel:()=>void}){const [r,set]=useState<Relation>(relation??{id:uid(),companyId,from:people[0]?.id??'',to:people[1]?.id??'',type:'works_with',strength:3});return <form onSubmit={e=>{e.preventDefault();if(r.from!==r.to)onSave(r)}}><div className="eyebrow">Связь <span>/</span> CRM</div><h2>{relation?'Изменить связь':'Новая связь'}</h2>{(['from','to'] as const).map((key,i)=><label key={key}>{i?'Второй контакт':'Первый контакт'}<select required value={r[key]} onChange={e=>set({...r,[key]:e.target.value})}>{people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>)}{r.from===r.to&&<p className="error">Выберите разных людей</p>}<label>Тип связи<select value={r.type} onChange={e=>set({...r,type:e.target.value as RelationType})}>{Object.entries(relationTypes).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label>Сила связи: {r.strength} / 5<input type="range" min="1" max="5" value={r.strength} onChange={e=>set({...r,strength:Number(e.target.value)})}/></label><div className="form-actions"><button type="button" onClick={onCancel}>Отмена</button><button className="primary" disabled={r.from===r.to}>Сохранить</button></div></form>}
export default App;






