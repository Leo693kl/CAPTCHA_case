import { groupGeometry, planGroups } from './lib/groupLayout';
import './styles/group-layout.css';
import { CommunicationOverview } from './components/CommunicationOverview';
import { findCandidates } from './lib/candidates';
import { RatingEvidence } from './components/RatingEvidence';
import { memo, useState, useEffect, useMemo, useRef, useCallback, type CSSProperties } from 'react';
import { ReactFlow, ViewportPortal, useReactFlow, useUpdateNodeInternals, useViewport, type Node, type Edge, type NodeProps, Handle, Position, BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { create } from 'zustand';
import { Star, Plus, Minus, Maximize2, Minimize2, Scan, PanelLeftClose, PanelLeftOpen, Building2, CalendarDays, Route, MessageSquare, X } from 'lucide-react';
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
import { departments, roles, stances, relationTypes, type CRMData, type Person, type Relation, type Role, type Stance, type RelationType, type SaveInteraction, type EvidenceChange, type Interaction, type RatingField, type RatingBasis, type RatingChange } from './types';
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
const mapTools = {
 history: {label:'История карты', icon:CalendarDays},
 path: {label:'Маршрут знакомства', icon:Route},
 communications: {label:'Коммуникации', icon:MessageSquare},
};
type MapTool = keyof typeof mapTools;
type PersonNode=Node<{person:Person; color:string; category:string; conflict:string[]; candidate:boolean; hypothesisLabel:boolean; dim:boolean; selected:boolean; onPath:boolean; isTarget:boolean; entranceDelay:number; onSelect:(id:string)=>void; onHover:(id:string|null)=>void},'person'>;
const PersonNodeView=memo(function PersonNodeView({data,id}:NodeProps<PersonNode>){
 const p=data.person; const size=16+p.influence*8; const updateNodeInternals=useUpdateNodeInternals();
 useEffect(()=>{updateNodeInternals(id)},[id,size,updateNodeInternals]); const initials=p.name.split(' ').map(x=>x[0]).join('');
 return <div className={'person-wrap '+(data.dim?'dim ':'')+(data.selected?'selected ':'')+(p.decisionRole==='decision_maker'?'decision-maker ':'')+(p.decisionRole==='blocker'?'blocker ':'')+(data.onPath?'on-path ':'')+(data.isTarget?'path-target ':'')+(data.candidate?'candidate':'')} style={{'--entrance-delay':`${data.entranceDelay}ms`,'--contact-size':`${size}px`} as CSSProperties} onMouseEnter={()=>data.onHover(p.id)} onMouseLeave={()=>data.onHover(null)}>
 <Handle type="target" position={Position.Left}/><button aria-label={`${p.name}, ${roles[p.decisionRole]}, ${stances[p.stance]}, влияние ${p.influence} из 5, ${data.category}${data.candidate?', гипотеза':''}${data.conflict.length ? ', конфликт касаний' : ''}`} onFocus={()=>data.onHover(p.id)} onBlur={()=>data.onHover(null)} onClick={()=>data.onSelect(p.id)} aria-pressed={data.selected} className="person-hit nodrag nopan"><span className={'person-bubble stance-'+p.stance} style={{width:size,height:size,background:data.color,color:`var(--on-heat-${p.warmth})`}}><span>{p.influence===1?initials[0]:initials}</span>{p.decisionRole==='decision_maker'&&<Star className="node-star" size={16} strokeWidth={1.75} aria-hidden="true"/>}{data.conflict.length>0&&<span className="conflict-marker" title={`Конфликт касаний: ${data.conflict.join(', ')}`} aria-hidden="true">!</span>}</span></button><div className="node-name"><b>{p.name}</b>{p.title&&<span className="node-specialty">{p.title}</span>}{data.hypothesisLabel&&<small>Гипотеза</small>}</div><Handle type="source" position={Position.Right}/></div>
},(prev,next)=>{const a=prev.data,b=next.data;return a.person===b.person&&a.color===b.color&&a.candidate===b.candidate&&a.hypothesisLabel===b.hypothesisLabel&&a.category===b.category&&a.dim===b.dim&&a.selected===b.selected&&a.onPath===b.onPath&&a.isTarget===b.isTarget&&a.entranceDelay===b.entranceDelay&&a.onSelect===b.onSelect&&a.onHover===b.onHover&&a.conflict.join('|')===b.conflict.join('|')});
type GhostNode=Node<{role:MissingRole; onFind:(id:string)=>void},'ghost'>;
function GhostNodeView({data}:NodeProps<GhostNode>){return <div className="ghost-node"><button className="ghost-icon nodrag nopan" aria-label={`Найти точку входа: ${data.role.label}`} onClick={()=>data.onFind(data.role.id)}>?</button><strong>{data.role.label}</strong></div>}
const nodeTypes={person:PersonNodeView,ghost:GhostNodeView};
function RelationEdge(props:EdgeProps){const [path]=getBezierPath(props); return <BaseEdge path={path} style={props.style} interactionWidth={24}/>}
const edgeTypes={relation:RelationEdge};
function Radar({people,radii,radarExtent,labels}:{people:Person[];radii:number[];radarExtent:number;labels:string[]}){
 const outer=radii[radii.length-1]+80; const point=(angle:number,r:number)=>({x:Math.cos(angle)*r,y:Math.sin(angle)*r});
 return <svg className="radar" viewBox={`${-radarExtent} ${-radarExtent} ${radarExtent*2} ${radarExtent*2}`} aria-hidden="true"><defs><pattern id="empty-hatch" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="12" stroke="var(--text-1)" strokeOpacity=".06" strokeWidth="1"/></pattern><linearGradient id="relation-gradient"><stop stopColor="var(--map-line)"/><stop offset="1" stopColor="var(--map-line)"/></linearGradient></defs>
 {departments.map((dep,i)=>{const a=(-120+i*60)*Math.PI/180, b=a+Math.PI/3, mid=(a+b)/2; const start=point(a,outer),end=point(b,outer);const empty=!people.some(p=>p.department===dep);const wedge=`M 0 0 L ${start.x} ${start.y} A ${outer} ${outer} 0 0 1 ${end.x} ${end.y} Z`;return <g key={dep}><path d={wedge} fill={i%2?'var(--bg-0)':'var(--bg-1)'} fillOpacity=".25"/><path d={wedge} fill={empty?'url(#empty-hatch)':'none'} stroke={empty?'var(--border-strong)':'none'} strokeDasharray={empty?'4 4':undefined}/><line x1="0" y1="0" x2={start.x} y2={start.y} stroke="var(--border)" strokeOpacity=".6"/><text className="sector-label" x={Math.cos(mid)*(outer+24)} y={Math.sin(mid)*(outer+24)} textAnchor="middle">{dep}</text>{empty&&<text className="empty-sector-label" x={Math.cos(mid)*outer*.68} y={Math.sin(mid)*outer*.68} textAnchor="middle">Нет контактов</text>}</g>})}
 {radii.map((r,i)=><g key={r}><circle className={i===radii.length-1?"radar-ring radar-ring-outer":"radar-ring"} r={r} fill="none"/><text className="ring-label" x={-r} y={-8} textAnchor="middle">{labels[i]==='ЛПР'?'ЛПР':labels[i].toLocaleLowerCase('ru-RU')}</text></g>)}</svg>
}
function MapReadingScale(){
 const {zoom}=useViewport();
 useEffect(()=>{
  const area=document.querySelector<HTMLElement>('.map-area');
  if(!area)return;
  area.style.setProperty('--map-zoom',String(zoom));
  const nameWidth=parseFloat(getComputedStyle(area).getPropertyValue('--node-label-width'));
  area.toggleAttribute('data-compact-group-labels',groupGeometry.slotWidth*zoom<nameWidth);
 },[zoom]);
 return null;
}
type GroupBounds = Pick<ReturnType<typeof planGroups>, 'halfWidth' | 'halfHeight'>;
function MapControls({expanded,onToggleExpanded,groupBounds}:{expanded:boolean;onToggleExpanded:()=>void;groupBounds?:GroupBounds}){
 const {zoomIn,zoomOut,fitView,fitBounds}=useReactFlow();
 const fit=()=>groupBounds ? fitBounds({
  x:-groupBounds.halfWidth,y:-groupBounds.halfHeight,width:2*groupBounds.halfWidth,height:2*groupBounds.halfHeight,
 },{padding:.08}) : fitView({padding:.2});
 const ExpandIcon=expanded?Minimize2:Maximize2;
 return <div className="map-controls" aria-label="Управление графом">
  <IconButton aria-label="Увеличить" title="Увеличить" onClick={()=>void zoomIn()}><Plus size={18} strokeWidth={1.75}/></IconButton>
  <IconButton aria-label="Уменьшить" title="Уменьшить" onClick={()=>void zoomOut()}><Minus size={18} strokeWidth={1.75}/></IconButton>
  <IconButton aria-label="Вписать граф" title="Вписать граф" onClick={()=>void fit()}><Scan size={18} strokeWidth={1.75}/></IconButton>
  <IconButton id="expand-graph" aria-label="Большой граф" aria-pressed={expanded} title={expanded?'Вернуть обычный вид (Esc)':'Большой граф'} onClick={onToggleExpanded}><ExpandIcon size={18} strokeWidth={1.75}/></IconButton>
 </div>;
}
function MapViewport({positions,fitKey,radarExtent,groupBounds}:{positions:Record<string,{x:number;y:number}>;fitKey:string;radarExtent:number;groupBounds?:GroupBounds}){
 const {setViewport}=useReactFlow();const fitted=useRef(false);const lastSize=useRef('');const bounds=Object.values(positions);const maxX=groupBounds?.halfWidth??Math.max(radarExtent,...bounds.map(p=>Math.abs(p.x)+120));const maxY=groupBounds?.halfHeight??Math.max(radarExtent,...bounds.map(p=>Math.abs(p.y)+160));
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
 },[fitKey,maxX,maxY,setViewport]);return null;
}
function useAnimatedNodes(nodes:Node[],layout:'orbit'|'group'):Node[]{
 const previousLayout=useRef(layout);
 const current=useRef(new Map<string,{x:number;y:number}>());const [positions,setPositions]=useState<Record<string,{x:number;y:number}>>({});
 const signature=nodes.map(node=>`${node.id}:${node.position.x.toFixed(2)}:${node.position.y.toFixed(2)}`).join('|');
 useEffect(()=>{const start=new Map(nodes.map(node=>[node.id,current.current.get(node.id)??node.position]));const target=new Map(nodes.map(node=>[node.id,node.position]));let frame=0;const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;const started=performance.now();const duration=previousLayout.current===layout?350:300;previousLayout.current=layout;const tick=(now:number)=>{const t=reduced?1:Math.min(1,(now-started)/duration);const eased=1-Math.pow(1-t,3);const next:Record<string,{x:number;y:number}>={};for(const [id,end] of target){const from=start.get(id)??end;next[id]={x:from.x+(end.x-from.x)*eased,y:from.y+(end.y-from.y)*eased}}current.current=new Map(Object.entries(next));setPositions(next);if(t<1)frame=requestAnimationFrame(tick)};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame)},[signature]);
 return nodes.map(node=>({...node,position:positions[node.id]??node.position}));
}
function usePresenceNodes(nodes:Node[]):Node[]{
 const previous=useRef<Node[]>([]); const [exiting,setExiting]=useState<Node[]>([]); const ids=nodes.map(node=>node.id).sort().join('|');
 const present=new Set(nodes.map(node=>node.id));
 const removed=previous.current.filter(node=>!present.has(node.id)).map(node=>({
  ...node,
  selectable:false,
  draggable:false,
  focusable:false,
  domAttributes:{...node.domAttributes,inert:true,'aria-hidden':true},
  style:{...node.style,opacity:0,pointerEvents:'none' as const,transition:'opacity var(--dur-slow) var(--ease)'},
 }));
 useEffect(()=>{previous.current=nodes;setExiting(removed);if(!removed.length)return;const timer=setTimeout(()=>setExiting([]),320);return()=>clearTimeout(timer);},[ids]);
 const retained=new Map([...exiting,...removed].filter(node=>!present.has(node.id)).map(node=>[node.id,node]));return [...nodes,...retained.values()];
}
function App(){const {data,setData}=useStore(); const [companyId,setCompany]=useState(()=>{const id=new URLSearchParams(location.search).get('company');return id&&['bank','retail','industry'].includes(id)?id:'bank'}); const [view,setView]=useState<'map'|'incoming'|'integration'>('map'); const [tourStep,setTourStep]=useState<number|null>(null); const [shortcutsOpen,setShortcutsOpen]=useState(false); const returnFocus=useRef<HTMLElement|null>(null); const tourBefore=useRef<{view:'map'|'incoming'|'integration';lens:Lens;expanded:boolean;sidebarPreference:boolean|null}|null>(null); const panelCloseRef=useRef<HTMLButtonElement>(null); const mapRef=useRef<HTMLDivElement>(null); const panelOpener=useRef<HTMLElement|null>(null); const [briefOpen,setBriefOpen]=useState(false); const [historyDate,setHistoryDate]=useState<string|null>(null); const [pathTarget,setPathTarget]=useState(''); const [ghostId,setGhostId]=useState<string|null>(null); const [lens,setLens]=useState<Lens>('decisions'); const [mapLayout,setMapLayout]=useState<'orbit'|'group'>(()=>{try{return localStorage.getItem('decision-radar-layout')==='group'?'group':'orbit'}catch{return 'orbit'}}); const [showCoverage,setShowCoverage]=useState(false); const [mapTool,setMapTool]=useState<MapTool|null>(null); const [selected,setSelected]=useState<string|null>(null); const [relationId,setRelation]=useState<string|null>(null); const [editing,setEditing]=useState(false); const [relationEditing,setRelationEditing]=useState(false); const [filter,setFilter]=useState(emptyFilter); const [busy,setBusy]=useState(false); const [modal,setModal]=useState<'delete'|'reset'|'relation'|null>(null); const [toast,setToast]=useState(''); const [centerId,setCenterId]=useState<string|null>(null); const [switching,setSwitching]=useState(false); const [pendingCount,setPendingCount]=useState(0); useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),4000);return()=>clearTimeout(timer)},[toast]);
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
 const [confirmCandidate,setConfirmCandidate]=useState(false); const [later,setLater]=useState<string[]>([]);
 const [entryPerson,setEntryPerson]=useState<string|null>(null);
 const [entryChange,setEntryChange]=useState<EvidenceChange|undefined>();
 const [sourceId,setSourceId]=useState<string|null>(null);
 const sourceReturn=useRef<{selected:string|null;relationId:string|null;briefOpen:boolean;view:typeof view;centerId:string|null;opener:HTMLElement|null;panelState?:{disclosures:boolean[];openerIndex:number;scrollTop:number}}|null>(null);
 const today=demoMode?'2026-11-19':dateKey(new Date()); const activeDate=historyDate??today; const historical=activeDate<today; const asOf=useMemo(()=>new Date(`${activeDate}T12:00:00`),[activeDate]);
 const slice=useMemo(()=>data?buildMapSlice(data,companyId,activeDate,today,selected):null,[data,companyId,activeDate,today,selected]);
 useEffect(()=>{if(data&&!data.companies.some(item=>item.id===companyId))setCompany(data.companies[0].id)},[data,companyId]);
 const livePeople=useMemo(()=>data?.people.filter(p=>p.companyId===companyId)??[],[data,companyId]);
 const people=useMemo(()=>[...(slice?.people??[])],[slice]);
 const peopleIds=useMemo(()=>new Set(people.map(p=>p.id)),[people]); const relations=useMemo(()=>[...(slice?.relations??[])],[slice]);
 const company=data?.companies.find(c=>c.id===companyId); const person=people.find(p=>p.id===selected); const relation=relations.find(r=>r.id===relationId);
 const interactions=useMemo(()=>[...(slice?.interactions??[])],[slice]); const now=asOf; const getRing=(p:Person)=>lensRing(p,lens,interactions,now); const missing=useMemo(()=>findMissingRoles(people),[people]); const dependencies=useMemo(()=>findDependencies(people,relations),[people,relations]); const conflicts=useMemo(()=>contactConflicts(interactions,now),[interactions,now]); const orbit=useMemo(()=>{const items=[...people.map(p=>({id:p.id,department:p.department,ring:lensRing(p,lens,interactions,now),ghost:false})),...missing.map(role=>({id:'ghost-'+role.id,department:role.department,ring:0,ghost:true}))];return planOrbit(items,item=>item.ring)},[people,lens,interactions,now,missing]); const groupPlan=useMemo(()=>planGroups(people,missing.map(role=>({id:'ghost-'+role.id,department:role.department})),interactions,activeDate,filter.recent),[people,missing,interactions,activeDate,filter.recent]); const positions=mapLayout==='group'?groupPlan.positions:orbit.positions;const radarExtent=orbit.extent; const groupBounds=mapLayout==='group'?groupPlan:undefined; const ghost=missing.find(role=>role.id===ghostId); const coverage=useMemo(()=>calculateCoverage(people,interactions,now),[people,interactions,now]);
 const candidates=useMemo(()=>findCandidates(people,interactions,data?.candidateResolutions??[]),[people,interactions,data?.candidateResolutions]); const activeCandidates=candidates.filter(candidate=>!later.includes(candidate.personId)); const currentCandidate=activeCandidates.find(candidate=>candidate.personId===selected);
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
  const opener=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const panel=panelCloseRef.current?.parentElement;
  const panelState=panel&&panel.contains(opener)?{
   disclosures:Array.from(panel.querySelectorAll('details'),item=>item.open),
   openerIndex:Array.from(panel.querySelectorAll('button, a, summary')).indexOf(opener!),
   scrollTop:panel.scrollTop,
  }:undefined;
  sourceReturn.current={selected,relationId,briefOpen,view,centerId,opener,panelState};
  const activePerson=peopleIds.has(record.personId)?record.personId:null;
  setSourceId(interactionId);setSelected(activePerson);setCenterId(activePerson);setRelation(null);setGhostId(null);setEditing(false);setRelationEditing(false);setBriefOpen(false);setView('map');
 };
 const returnFromSource=()=>{
  const previous=sourceReturn.current;
  sourceReturn.current=null;
  setSourceId(null);
  if(!previous)return;
  setSelected(previous.selected);setRelation(previous.relationId);setBriefOpen(previous.briefOpen);setView(previous.view);setCenterId(previous.centerId);
  requestAnimationFrame(()=>{
   const panel=panelCloseRef.current?.parentElement;
   const state=previous.panelState;
   if(panel&&state){
    panel.querySelectorAll('details').forEach((item,index)=>{item.open=state.disclosures[index]??item.open});
    panel.scrollTop=state.scrollTop;
    panel.querySelectorAll<HTMLElement>('button, a, summary')[state.openerIndex]?.focus({preventScroll:true});
   }else if(previous.opener?.isConnected)previous.opener.focus();
  });
 };
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
 const snapshots=data?.snapshots??[]; const history=useMemo(()=>historyChanges(snapshots,data?.interactions??[],companyId,activeDate),[snapshots,data,companyId,activeDate]); const firstDate=snapshots.filter(s=>s.person.companyId===companyId&&s.date<=today).reduce((first,s)=>s.date<first?s.date:first,today);

 const last=(id:string)=>interactions.filter(i=>i.personId===id).sort((a,b)=>b.date.localeCompare(a.date))[0]?.date;
 const matches=(p:Person)=>{const d=last(p.id); const age=d?(Date.parse(activeDate)-Date.parse(d))/86400000:Infinity; return (!filter.candidatesOnly || activeCandidates.some(candidate=>candidate.personId===p.id)) && (!filter.missingBasis || ['influence','stance','warmth','role'].some(field=>!(data?.ratingBases??[]).some(b=>b.subjectType==='person'&&b.subjectId===p.id&&b.field===field&&b.value===(field==='role'?p.decisionRole:p[field as 'influence'|'stance'|'warmth'])))) && p.name.toLowerCase().includes(filter.search.toLowerCase())&&(!filter.department||p.department===filter.department)&&(!filter.role||p.decisionRole===filter.role)&&(!filter.stance||p.stance===filter.stance)&&(!filter.owner||p.owner===filter.owner)&&(!filter.recent||(filter.recent==='90'?age<=90:filter.recent==='365'?age<=365:age>365));};
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
 const personNodes:PersonNode[]=people.map(p=>({id:p.id,type:'person',initialWidth:100,initialHeight:100,position:{x:positions[p.id].x-50,y:positions[p.id].y-50},data:{person:p,candidate:activeCandidates.some(candidate=>candidate.personId===p.id),hypothesisLabel:lens==='decisions'&&activeCandidates.some(candidate=>candidate.personId===p.id),color:colors[p.warmth-1]??colors[0],category:lensOptions[lens].rings[getRing(p)],conflict:conflicts.get(p.id)??[],dim:path?!pathNodes.has(p.id):!matches(p),onPath:pathNodes.has(p.id),isTarget:path?.target===p.id,entranceDelay:entranceOrder.get(p.id)??0,selected:p.id===selected,onSelect:selectPerson,onHover:highlightNeighbors},draggable:false}));
 const openMissingRole=(id:string)=>{
  panelOpener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
  setGhostId(id);setSelected(null);setRelation(null);setEditing(false);setRelationEditing(false);
 };
 const ghostNodes:GhostNode[]=missing.map(role=>({id:'ghost-'+role.id,type:'ghost',initialWidth:160,initialHeight:110,position:{x:positions['ghost-'+role.id].x-80,y:positions['ghost-'+role.id].y-55},data:{role,onFind:openMissingRole},draggable:false})); const nodes:Node[]=[...personNodes,...ghostNodes]; const animatedNodes=useAnimatedNodes(nodes,mapLayout); const visibleNodes=usePresenceNodes(animatedNodes);
 const openRelation=(id:string)=>{setCenterId(null);setSourceId(null);panelOpener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setRelation(id);setSelected(null);setGhostId(null);setEditing(false);setRelationEditing(false);setBriefOpen(false)};
 const edges:Edge[]=relations.map(r=>({id:r.id,source:r.from,target:r.to,type:'relation',focusable:true,ariaRole:'button',domAttributes:{onKeyDown:event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();openRelation(r.id)}}},ariaLabel:`Связь: ${people.find(p=>p.id===r.from)?.name??r.from} — ${people.find(p=>p.id===r.to)?.name??r.to}, ${relationTypes[r.type]}`,className:[pathEdges.has(r.id)?'path-highlight':'',!pathEdges.has(r.id)&&(relationId===r.id||selected===r.from||selected===r.to)?'map-edge-active':''].filter(Boolean).join(' '),style:{stroke:pathEdges.has(r.id)?'var(--brand-green)':relationId===r.id?'var(--brand-sky)':mapLayout==='group'?'var(--map-line)':'url(#relation-gradient)',strokeWidth:pathEdges.has(r.id)?3:1+(r.strength-1)*.75,strokeDasharray:pathEdges.has(r.id)?'8 6':r.type==='informal'?'4 4':undefined,opacity:path?(pathEdges.has(r.id)?1:.3):.75}}));
 const persist=async(next:CRMData):Promise<boolean>=>{if(!data||persisting.current)return false;persisting.current=true;setWriteError('');try{await crmApi.saveRatingEvidence(next,data,setData);return true}catch(error){setWriteError(error instanceof Error?error.message:'Не удалось сохранить изменения в браузере. Повторите сохранение.');return false}finally{persisting.current=false}};
 const savePerson=async(p:Person,meta:RatingMeta)=>{if(!data)return; const ratings=recordRatings(data,'person',p.id,person ? {influence:person.influence,stance:person.stance,warmth:person.warmth,role:person.decisionRole} : {},{influence:p.influence,stance:p.stance,warmth:p.warmth,role:p.decisionRole},meta,today); const candidateResolutions=p.decisionRole==='decision_maker'&&person?.decisionRole!=='decision_maker'?[...(data.candidateResolutions??[]).filter(x=>x.personId!==p.id),{personId:p.id,status:'confirmed' as const}]:data.candidateResolutions; if(!await persist({...data,...ratings,candidateResolutions,people:data.people.some(x=>x.id===p.id)?data.people.map(x=>x.id===p.id?p:x):[...data.people,p],snapshots:[...data.snapshots,{personId:p.id,date:today,person:structuredClone(p)}]}))return;setToast('Контакт сохранён');setSelected(p.id);setEditing(false);setConfirmCandidate(false)};
 const rejectCandidate=async(id:string)=>{if(!data||historical)return;if(await persist({...data,candidateResolutions:[...(data.candidateResolutions??[]).filter(x=>x.personId!==id),{personId:id,status:'rejected'}]}))setToast('Гипотеза отклонена');};
 const deletePerson=async()=>{if(!data||!person)return; setModal(null);if(!await persist({...data,people:data.people.filter(p=>p.id!==person.id),relations:data.relations.filter(r=>r.from!==person.id&&r.to!==person.id),snapshots:[...data.snapshots,{personId:person.id,date:today,person:structuredClone(person),deleted:true}]}))return;setToast('Контакт удалён');setSelected(null)};
 const saveRelation=async(r:Relation,meta:RatingMeta)=>{if(!data)return; const ratings=recordRatings(data,'relation',r.id,relation ? {strength:relation.strength,type:relation.type} : {},{strength:r.strength,type:r.type},meta,today); if(!await persist({...data,...ratings,relations:data.relations.some(x=>x.id===r.id)?data.relations.map(x=>x.id===r.id?r:x):[...data.relations,r]}))return;setToast('Связь сохранена');setRelation(r.id);setRelationEditing(false)};
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
   const updated={...found[0],decisionRole:proposal.role};return await persist({...data,...(proposal.role==='decision_maker'?{candidateResolutions:[...(data.candidateResolutions??[]).filter(x=>x.personId!==updated.id),{personId:updated.id,status:'confirmed' as const}]}:{}),people:data.people.map(p=>p.id===updated.id?updated:p),snapshots:[...data.snapshots,{personId:updated.id,date:today,person:structuredClone(updated)}]})?null:'Не удалось сохранить роль. Повторите подтверждение.';
  }
  const from=lookup(proposal.from);const to=lookup(proposal.to);if(from.length!==1||to.length!==1)return 'Укажите точные имена двух существующих контактов; сначала примите нового участника.';
  if(from[0].id===to[0].id)return 'Выберите двух разных людей.';
  if(data.relations.some(r=>r.companyId===companyId&&((r.from===from[0].id&&r.to===to[0].id)||(r.from===to[0].id&&r.to===from[0].id))))return 'Между этими людьми связь уже существует; измените её на карте.';
  const relation:Relation={id:uid(),companyId,from:from[0].id,to:to[0].id,type:proposal.relationType,strength:proposal.strength};return await persist({...data,relations:[...data.relations,relation]})?null:'Не удалось сохранить связь. Повторите подтверждение.';
 };
 const changeCompany=(id:string)=>{setMapTool(null);setWriteError('');setSourceId(null);sourceReturn.current=null;setEntryPerson(null);setEntryChange(undefined);setPendingCount(0);const url=new URL(location.href);url.searchParams.set('company',id);window.history.replaceState(null,'',url);setSwitching(true);window.setTimeout(()=>setSwitching(false),220);setCenterId(null);setCompany(id);setHistoryDate(null);setPathTarget('');setGhostId(null);setSelected(null);setRelation(null);setEditing(false);setRelationEditing(false);setBriefOpen(false);setFilter(emptyFilter)};
 const closeMapTool=()=>{
  setMapTool(null);
  requestAnimationFrame(()=>document.getElementById(`map-tool-${mapTool}`)?.focus());
 };
 const openMapTool=(tool:MapTool)=>{
  setGraphExpanded(false);
  setMapTool(tool);
  requestAnimationFrame(()=>{
   document.getElementById('map-tool-panel')?.scrollTo({top:0});
   document.getElementById('close-map-tool')?.focus();
  });
 };
 const showHistoryDate=(value:string)=>{
  setSourceId(null);sourceReturn.current=null;setHistoryDate(value===today?null:value);
  setBriefOpen(false);setSelected(null);setRelation(null);setGhostId(null);
  setEditing(false);setRelationEditing(false);setPathTarget('');
 };
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
    if(view==='map'&&mapTool){event.preventDefault();closeMapTool();return}
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
 },[view,lens,tourStep,shortcutsOpen,modal,data,selected,ghostId,relationId,editing,relationEditing,showCoverage,graphExpanded,sidebarPreference,mapTool]);
 if(!data||!company||!slice)return <LoadingSkeleton/>;
 const sharedProps={slice,companyId,onSaveInteraction,onOpenSource:openSource,selectedPersonId:selected,initialPersonId:entryPerson,highlightedInteractionId:sourceId,today};
 const timeline=interactions.filter(i=>i.personId===selected).sort((a,b)=>b.date.localeCompare(a.date)); const owners=[...new Set(people.map(p=>p.owner))];
 const companyOverview=<>
  <MapIndicators slice={slice} onOpenSource={openSource}/>
  <details className="panel-disclosure">
   <summary>Кандидаты в ЛПР <small>{activeCandidates.length}</small></summary>
   {activeCandidates.length ? activeCandidates.map(candidate=><Button key={candidate.personId} variant="ghost" className="panel-row" onClick={()=>selectPerson(candidate.personId)}>
    <span>{people.find(p=>p.id===candidate.personId)?.name}</span><small>{candidate.level}</small>
   </Button>) : <p className="muted">Кандидатов нет.</p>}
  </details>
  <details className="panel-disclosure">
   <summary>Поставщики и источники</summary>
   <SupplierLines slice={slice} companyName={company.name} onOpenSource={openSource}/>
  </details>
  <details className="panel-disclosure" open>
   <summary>Сигналы и точки входа</summary>
   <MapEvidenceSignals slice={slice} onOpenPerson={selectPerson} onOpenSource={openSource} onFindRole={openMissingRole}/>
   {dependencies.length>0&&<details className="panel-dependencies">
    <summary>Зависимость от одного человека <small>{dependencies.length}</small></summary>
    <ul>{dependencies.map(r=><li key={r.kind+r.name}>
     <strong>{r.name}</strong>
     <p>{r.count} из {r.total} тёплых контактов</p>
     <p>{r.kind==='owner'?'Владелец контактов':'Связан с контактами'}</p>
    </li>)}</ul>
    <p className="map-evidence-note">Подключите коллег и развивайте прямые отношения с клиентом.</p>
   </details>}
  </details>
 </>;
 return <div className="app redesign-app" data-view={view}><header className="topbar surround-header">
 <div className="app-wordmark">Карта ЛПР <small>Клоднусоурсники</small></div>
 <Select className="header-company" aria-label="Выбрать клиента" value={companyId} onChange={e=>changeCompany(e.target.value)}>{data.companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</Select>
 <nav className="header-nav" aria-label="Разделы приложения"><Button variant="ghost" aria-current={view==='map'?'page':undefined} onClick={()=>setView('map')}>Карта</Button><Button variant="ghost" aria-current={view==='incoming'?'page':undefined} onClick={()=>setView('incoming')}>Входящие {pendingCount>0&&<Badge className="pending-count">{pendingCount}</Badge>}</Button><Button variant="ghost" aria-current={view==='integration'?'page':undefined} onClick={()=>setView('integration')}>CRM</Button></nav>
 <Button variant="ghost" id="demo-button" onClick={startTour}>Демо</Button><Button variant="ghost" aria-label="Горячие клавиши" onClick={openShortcuts}>?</Button><CoveragePopover coverage={coverage} open={showCoverage} onToggle={()=>setShowCoverage(!showCoverage)}/>
 </header>
 {storageNotice&&<p className="success-note" role="status">{storageNotice}</p>}<main hidden={view!=='map'} className="map-main" data-sidebar-open={sidebarOpen} data-graph-expanded={graphExpanded}>
 <aside id="map-sidebar" className="map-sidebar" aria-label="Легенда и фильтры" hidden={!sidebarOpen||graphExpanded}>
  <div className="map-sidebar-toolbar"><Button id="collapse-map-sidebar" variant="ghost" aria-controls="map-sidebar" aria-expanded={true} onClick={()=>toggleSidebar(false)}><PanelLeftClose size={16} strokeWidth={1.75} aria-hidden="true"/>Свернуть</Button></div>
  <MapLegend lens={mapLayout==='orbit'?lens:undefined}/><FilterPanel filter={filter} onChange={setFilter} owners={owners} shown={people.filter(matches).length} total={people.length}/>
 <details className="map-settings"><summary>Настройки</summary><p>Данные для демонстрации</p><Button variant="ghost" onClick={()=>{const enabled=!demoMode;setDemoMode(enabled);setHistoryDate(null);setSourceId(null);setSelected(null);setRelation(null);setEditing(false);setRelationEditing(false);setEntryVersion(value=>value+1);const url=new URL(location.href);if(enabled)url.searchParams.set('demo','2026-11-19');else url.searchParams.delete('demo');window.history.replaceState(null,'',url)}}>{demoMode?'Использовать текущую дату':'Демодата 19.11.2026'}</Button><Button variant="ghost" disabled={busy} onClick={()=>setModal('reset')}>Сбросить к данным CRM</Button></details></aside>
 <section className="workspace" aria-label="Карта связей"><div className="workspace-head"><div className="workspace-heading">
 {!sidebarOpen&&<Button id="open-map-sidebar" variant="ghost" aria-expanded={false} aria-controls="map-sidebar" onClick={()=>toggleSidebar(true)}><PanelLeftOpen size={16} strokeWidth={1.75} aria-hidden="true"/>Легенда и фильтры</Button>}
 <h1>Карта связей <span className="count">{people.length}</span></h1></div><div className="actions"><Button disabled={historical} data-tour="observation-entry" onClick={openEntry}>Добавить наблюдение</Button><Button disabled={historical||people.length<2} title={people.length<2?'Для связи нужны два контакта':historical?'Редактирование доступно на текущей карте':undefined} onClick={()=>{panelOpener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setSourceId(null);setSelected(null);setRelation(null);setGhostId(null);setRelationEditing(true)}}><Plus size={15} strokeWidth={1.75} aria-hidden="true"/>Связь</Button><Button disabled={historical} title={historical?'Редактирование доступно на текущей карте':undefined} onClick={()=>{panelOpener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setSourceId(null);setSelected(null);setRelation(null);setGhostId(null);setEditing(true)}}><Plus size={15} strokeWidth={1.75} aria-hidden="true"/>Контакт</Button></div></div>
 <div className="layout-switch"><SegmentedControl label="Вид карты" value={mapLayout} options={[{value:'orbit',label:'Орбиты'},{value:'group',label:'По подразделениям'}]} onChange={value=>{setMapLayout(value);try{localStorage.setItem('decision-radar-layout',value)}catch{/* Вид остаётся доступен в текущем сеансе. */}}}/></div><div className="lens-bar"><div data-tour="lenses"><SegmentedControl label="Линза карты" value={lens} options={(Object.keys(lensOptions) as Lens[]).map(value=>({value,label:lensOptions[value].label}))} onChange={setLens}/></div></div>
 <div className="map-tool-bar" role="group" aria-label="Инструменты карты">
  {(Object.keys(mapTools) as MapTool[]).map(tool=>{
   const {label,icon:Icon}=mapTools[tool];
   return <Button key={tool} id={`map-tool-${tool}`} variant="ghost" aria-expanded={mapTool===tool&&!graphExpanded}
    aria-controls="map-tool-panel" data-tour={tool==='history'?'history':undefined}
    onClick={()=>mapTool===tool?closeMapTool():openMapTool(tool)}>
    <Icon size={16} strokeWidth={1.75} aria-hidden="true"/>{label}
    {tool==='history'&&historical&&<time dateTime={activeDate}>{activeDate.split('-').reverse().join('.')}</time>}
   </Button>;
  })}
 </div>
 <div className="map-stage">
  <section id="map-tool-panel" className="map-tool-panel" aria-labelledby="map-tool-title" hidden={!mapTool||graphExpanded||tourStep!==null}>
   {mapTool&&<><header className="map-tool-heading">
    <h2 id="map-tool-title">{mapTools[mapTool].label}</h2>
    <IconButton id="close-map-tool" variant="ghost" aria-label={`Закрыть: ${mapTools[mapTool].label}`} onClick={closeMapTool}>
     <X size={20} strokeWidth={1.75} aria-hidden="true"/>
    </IconButton>
   </header>
   {mapTool==='history'&&<TimeControls key={`${companyId}-${today}`} date={activeDate} today={today} min={firstDate} changes={history} onDate={showHistoryDate}/>}
   {mapTool==='path'&&<PathControls people={people} target={pathTarget} onTarget={setPathTarget} path={path} onShowMap={closeMapTool}/>}
   {mapTool==='communications'&&<CommunicationOverview slice={slice} onSelect={id=>{
    setMapTool(null);setFilter(emptyFilter);setPathTarget('');selectPerson(id);
    panelOpener.current=document.getElementById('map-tool-communications');
   }}/>}
   </>}
  </section>
 <div className="map-area" data-layout={mapLayout} ref={mapRef}>{switching&&<div className="switch-skeleton" role="status" aria-label="Загрузка карты клиента"><Skeleton/><Skeleton/><Skeleton/></div>}{people.length===0?<NoContacts/>:people.filter(matches).length===0?<NoResults onReset={()=>setFilter(emptyFilter)}/>:null}<ReactFlow nodes={visibleNodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} minZoom={0.05} maxZoom={1.5} defaultViewport={{x:0,y:0,zoom:.25}} onEdgeClick={(_,edge)=>openRelation(edge.id)} nodesConnectable={false} elementsSelectable={false} proOptions={{hideAttribution:true}}><MapViewport positions={positions} radarExtent={orbit.radii[orbit.radii.length-1]+140} groupBounds={groupBounds} fitKey={`${companyId}-${lens}-${activeDate}-${people.length}-${mapLayout}`}/><MapReadingScale/><MapControls groupBounds={groupBounds} expanded={graphExpanded} onToggleExpanded={()=>{setMapTool(null);setGraphExpanded(value=>!value)}}/><ViewportPortal>{mapLayout==='group'?<div className="group-layer" aria-hidden="true">{groupPlan.zones.map(zone=><div
 key={zone.department} className={`group-zone ${zone.lowCoverage?'low-coverage':''}`}
 style={{left:zone.x,top:zone.y,width:zone.width,height:zone.height,'--group-header':`${zone.header}px`} as CSSProperties}>
 <header className="group-zone-heading"><strong>{zone.department}</strong><time dateTime={activeDate}>{activeDate.split('-').reverse().join('.')}</time></header>
 </div>)}</div>:<div className="orbit-layer" style={{width:radarExtent*2,height:radarExtent*2,left:-radarExtent,top:-radarExtent}}><Radar key={companyId} people={people} radii={orbit.radii} radarExtent={radarExtent} labels={lensOptions[lens].rings}/><div className="decision"><Building2 size={32} strokeWidth={1.75} aria-hidden="true"/><strong>{company.name}</strong><small>{company.initiative}</small></div></div>}</ViewportPortal></ReactFlow><MapSelectionLabel slice={slice} relation={relation}/><div className="map-footer">Прокрутка меняет масштаб</div></div>
 </div></section>
 </main>
 <main id="incoming-workspace" hidden={view==='map'}><div className="feature-company"><label htmlFor="feature-company">Клиент</label><select id="feature-company" value={companyId} onChange={e=>changeCompany(e.target.value)}>{data.companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div><div hidden={view!=='incoming'}><Incoming {...sharedProps} key={`${companyId}-${today}-${entryVersion}`} evidence={{companyId,people:slice.people,relations:slice.relations,saveInteraction:onSaveInteraction,selectedPersonId:entryPerson,asOf:activeDate,disabled:historical,onOpenSaved:openSource,initialChange:entryChange}} people={livePeople} relations={data.relations.filter(r=>r.companyId===companyId)} onAccept={acceptProposal} disabled={historical} onCount={setPendingCount}/></div>{view==='integration'&&<Integration {...sharedProps} key={companyId} data={data} companyId={companyId} companyName={company.name}/>}</main>

 {view==='map'&&<aside className={`panel ${sourceId||person||ghost||editing||relation||relationEditing?'':'panel-empty'}`} aria-label="Карточка контакта"><button ref={panelCloseRef} className="close" aria-label="Закрыть панель" onClick={closePanel}>×</button>{writeError&&<p className="proposal-error" role="alert">{writeError}</p>}{sourceId&&interactionSource(slice,sourceId)?<SourceRecord interaction={interactionSource(slice,sourceId)!} slice={slice} onBack={returnFromSource}/>:editing?<PersonForm key={person?.id??'new'} person={person} confirmCandidate={confirmCandidate} candidateSource={currentCandidate?.reasons.find(r=>r.sourceId)?.sourceId} companyId={companyId} records={interactions.filter(i=>i.personId===person?.id||i.id===currentCandidate?.reasons.find(r=>r.sourceId)?.sourceId)} onSave={savePerson} onCancel={()=>{setConfirmCandidate(false);person?setEditing(false):closePanel()}}/>:relationEditing?<RelationForm key={relation?.id??'new'} relation={relation} people={people} companyId={companyId} records={interactions.filter(i=>i.personId===relation?.from||i.personId===relation?.to)} onSave={saveRelation} onCancel={()=>relation?setRelationEditing(false):closePanel()}/>:ghost?<><div className="eyebrow">Отсутствующая роль</div><h2>{ghost.label}</h2><p>{ghost.description}, на карте отсутствует</p><div className="panel-section"><h3>Кого попросить познакомить</h3>{[...people].sort((a,b)=>b.warmth-a.warmth||b.influence-a.influence).slice(0,3).map(candidate=><button className="entry-candidate" key={candidate.id} onClick={()=>{setGhostId(null);setBriefOpen(false);setSelected(candidate.id)}}><strong>{candidate.name}</strong><span>{candidate.department}, теплота {candidate.warmth}/5, влияние {candidate.influence}/5</span></button>)}{people.length===0&&<p className="muted">Нет контактов для рекомендации.</p>}
 <details className="panel-disclosure"><summary>Как выбраны контакты</summary><p>Сначала тёплые и влиятельные контакты. Связь с нужной ролью ещё предстоит проверить.</p><p>{ghost.id==='ciso'?'Для CISO проверяется должность руководителя ИБ.':ghost.id==='business'?'Для бизнес-заказчика проверяется должность или роль ЛПР в бизнес-подразделении.':'Роль определяется по подразделению.'}</p></details></div></>:person&&briefOpen?<MeetingBrief {...sharedProps} onOpenSource={openSource} person={person} companyName={company.name} initiative={company.initiative} people={people} relations={relations} interactions={interactions} asOf={activeDate} onBack={()=>setBriefOpen(false)}/>:person?<ContactOverview key={person.id} person={person} slice={slice} onOpenSource={openSource} onAdd={openEntry} onSelect={selectPerson} companyIndicators={companyOverview}
 candidateBlock={currentCandidate&&<section className="contact-section candidate-summary">
  <h3>Возможный ЛПР</h3>
  <div className="profile-actions">
   <Button disabled={historical} onClick={()=>{setConfirmCandidate(true);setEditing(true)}}>Подтвердить роль</Button>
   <Button variant="ghost" disabled={historical} onClick={()=>rejectCandidate(person.id)}>Не подходит</Button>
   <Button variant="ghost" onClick={()=>setLater(items=>[...items,person.id])}>Позже</Button>
  </div>
  <details><summary>Основания гипотезы</summary>
   <ul>{currentCandidate.reasons.map((reason,index)=><li key={`${reason.kind}-${reason.sourceId??index}`}>{reason.sourceId?<Button variant="ghost" className="source-action" onClick={()=>openSource(reason.sourceId!)}>{reason.label}</Button>:reason.label}</li>)}</ul>
   <p className="map-evidence-note">Уровень гипотезы: {currentCandidate.level}. Уточните полномочия перед подтверждением.</p>
  </details>
 </section>}
 ratings={<RatingEvidence subjectType="person" subjectId={person.id} fields={{influence:person.influence,stance:person.stance,warmth:person.warmth,role:person.decisionRole}} bases={data.ratingBases??[]} changes={data.ratingChanges??[]} records={slice.interactions} onOpenSource={openSource}/>}>
<PersonDetails {...sharedProps} mapEvidence={{slice,onOpenSource:openSource,sourceInteractionId:sourceId??undefined}} person={person} people={people} relations={relations} timeline={timeline} asOf={asOf} conflicts={conflicts.get(person.id)??[]} historical={historical} onEdit={()=>setEditing(true)} onBrief={()=>setBriefOpen(true)} onPath={()=>{setPathTarget(person.id);closePanel();openMapTool('path')}} onSelect={id=>{setSourceId(null);setSelected(id);setCenterId(id)}} onDelete={()=>setModal('delete')}/></ContactOverview>:relation?<><div className="eyebrow">Связь контактов</div><h2 className="relation-title">{people.find(p=>p.id===relation.from)?.name} ↔ {people.find(p=>p.id===relation.to)?.name}</h2><div className="panel-section"><div className="detail"><span>Тип</span><strong>{relationTypes[relation.type]}</strong></div><div className="detail"><span>Сила</span><strong>{relation.strength} / 5</strong></div></div><div className="profile-actions"><button disabled={historical} onClick={()=>setRelationEditing(true)}>✎ Редактировать</button><button className="danger" disabled={historical} onClick={()=>setModal('relation')}>Удалить</button></div><RatingEvidence subjectType="relation" subjectId={relation.id} fields={{strength:relation.strength,type:relation.type}} bases={data.ratingBases??[]} changes={data.ratingChanges??[]} records={slice.interactions} onOpenSource={openSource}/><RelationStrengthEvidence slice={slice} relation={relation} onOpenSource={openSource} onConfirmStrength={openStrengthEntry}/></>:<><div className="company-heading"><Building2 size={24} strokeWidth={1.75} aria-hidden="true"/><h2>{company.name}</h2></div>{companyOverview}</>}</aside>}
 {modal&&<Confirmation title={modal==='delete'?'Удалить контакт?':modal==='relation'?'Удалить связь?':'Сбросить изменения?'} description={modal==='delete'?'Контакт и его связи будут удалены.':modal==='relation'?'Связь между контактами будет удалена.':'Изменения будут заменены данными CRM.'} onClose={()=>setModal(null)} onConfirm={async()=>{if(modal==='delete'){deletePerson();return}if(modal==='relation'&&relation){if(!await persist({...data,relations:data.relations.filter(r=>r.id!==relation.id)}))return;setRelation(null);setModal(null);setToast('Связь удалена');return}setModal(null);setBusy(true);void crmApi.reset(data).then(next=>{setSourceId(null);sourceReturn.current=null;setData(next);setHistoryDate(null);setPathTarget('');setGhostId(null);setSelected(null);setRelation(null);setToast('Данные CRM восстановлены')}).catch(()=>setToast('Не удалось восстановить данные CRM.')).finally(()=>setBusy(false))}}/>}{toast&&<div className="app-toast" role="status">{toast}</div>}
 {tourStep!==null&&<DemoTour step={tourStep} onStep={applyTourStep} onClose={closeTour}/>}
 {shortcutsOpen&&<Shortcuts onClose={closeShortcuts}/>}
 </div>
}
function PersonForm({person,companyId,records,onSave,onCancel,confirmCandidate,candidateSource}:{person?:Person;confirmCandidate:boolean;candidateSource?:string;companyId:string;records:Interaction[];onSave:(p:Person,meta:RatingMeta)=>void;onCancel:()=>void}){const [meta,setMeta]=useState<RatingMeta>({authorId:'',rationale:'',sourceIds:candidateSource?[candidateSource]:[]});const [p,set]=useState<Person>(person?(confirmCandidate?{...person,decisionRole:'decision_maker'}:person):{id:uid(),companyId,name:'',department:'ИТ',title:'',decisionRole:'evaluator',stance:'neutral',influence:3,warmth:3,owner:'',interests:[],consentMarketing:false});return <form onSubmit={e=>{e.preventDefault();onSave(p,meta)}}><h2>{person?'Изменить контакт':'Новый контакт'}</h2><label>Имя и фамилия<Input required value={p.name} onChange={e=>set({...p,name:e.target.value})}/></label><label>Должность<Input required value={p.title} onChange={e=>set({...p,title:e.target.value})}/></label><label>Подразделение<Select value={p.department} onChange={e=>set({...p,department:e.target.value})}>{departments.map(x=><option key={x}>{x}</option>)}</Select></label><label>Роль<Select value={p.decisionRole} onChange={e=>set({...p,decisionRole:e.target.value as Role})}>{Object.entries(roles).map(([v,l])=><option key={v} value={v}>{l}</option>)}</Select></label><label>Позиция<Select value={p.stance} onChange={e=>set({...p,stance:e.target.value as Stance})}>{Object.entries(stances).map(([v,l])=><option key={v} value={v}>{l}</option>)}</Select></label><label>Влияние: {p.influence} / 5<Input type="range" min="1" max="5" value={p.influence} onChange={e=>set({...p,influence:Number(e.target.value)})}/></label><label>Теплота: {p.warmth} / 5<Input type="range" min="1" max="5" value={p.warmth} onChange={e=>set({...p,warmth:Number(e.target.value)})}/></label><label>Владелец контакта<Input required value={p.owner} onChange={e=>set({...p,owner:e.target.value})}/></label>{(!person || p.decisionRole!==person.decisionRole || p.stance!==person.stance || p.influence!==person.influence || p.warmth!==person.warmth)&&<RatingMetaForm meta={meta} onChange={setMeta} records={records}/>}<div className="form-actions"><Button type="button" onClick={onCancel}>Отмена</Button><Button type="submit" variant="primary">Сохранить</Button></div></form>}
function RelationForm({relation,people,companyId,records,onSave,onCancel}:{relation?:Relation;people:Person[];companyId:string;records:Interaction[];onSave:(r:Relation,meta:RatingMeta)=>void;onCancel:()=>void}){const [meta,setMeta]=useState<RatingMeta>({authorId:'',rationale:'',sourceIds:[]});const [r,set]=useState<Relation>(relation??{id:uid(),companyId,from:people[0]?.id??'',to:people[1]?.id??'',type:'works_with',strength:3});return <form onSubmit={e=>{e.preventDefault();if(r.from!==r.to)onSave(r,meta)}}><h2>{relation?'Изменить связь':'Новая связь'}</h2>{(['from','to'] as const).map((key,i)=><label key={key}>{i?'Второй контакт':'Первый контакт'}<select required value={r[key]} onChange={e=>set({...r,[key]:e.target.value})}>{people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>)}{r.from===r.to&&<p className="error">Выберите разных людей</p>}<label>Тип связи<select value={r.type} onChange={e=>set({...r,type:e.target.value as RelationType})}>{Object.entries(relationTypes).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label>Сила связи: {r.strength} / 5<input type="range" min="1" max="5" value={r.strength} onChange={e=>set({...r,strength:Number(e.target.value)})}/></label>{(!relation || r.type!==relation.type || r.strength!==relation.strength)&&<RatingMetaForm meta={meta} onChange={setMeta} records={records}/>}<div className="form-actions"><button type="button" onClick={onCancel}>Отмена</button><button className="primary" disabled={r.from===r.to}>Сохранить</button></div></form>}
export default App;







type RatingMeta={authorId:string;rationale:string;sourceIds:string[]};
function RatingMetaForm({meta,onChange,records}:{meta:RatingMeta;onChange:(m:RatingMeta)=>void;records:Interaction[]}){return <fieldset><legend>Основание изменённых оценок</legend><label>Автор<Input required value={meta.authorId} onChange={e=>onChange({...meta,authorId:e.target.value})}/></label><label>Почему<Input maxLength={300} value={meta.rationale} onChange={e=>onChange({...meta,rationale:e.target.value})}/></label><label>Источник<Select value={meta.sourceIds[0]??''} onChange={e=>onChange({...meta,sourceIds:e.target.value?[e.target.value]:[]})}><option value="">Без источника</option>{[...records].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,10).map(r=><option key={r.id} value={r.id}>{r.date.split('-').reverse().join('.')} — {r.summary.split('\n')[0]}</option>)}</Select></label></fieldset>}
function recordRatings(data:CRMData,subjectType:'person'|'relation',subjectId:string,before:Partial<Record<RatingField,string|number>>,after:Partial<Record<RatingField,string|number>>,meta:RatingMeta,date:string):{ratingBases:RatingBasis[];ratingChanges:RatingChange[]}{let ratingBases=[...(data.ratingBases??[])];const ratingChanges=[...(data.ratingChanges??[])];for(const [key,value] of Object.entries(after)){const field=key as RatingField;const old=before[field];if(old===value)continue;ratingBases=ratingBases.filter(b=>!(b.subjectType===subjectType&&b.subjectId===subjectId&&b.field===field));ratingBases.push({id:uid(),subjectType,subjectId,field,value,authorId:meta.authorId.trim(),date,rationale:meta.rationale.trim(),sourceIds:meta.sourceIds});if(old!==undefined)ratingChanges.push({id:uid(),subjectType,subjectId,field,before:old,after:value,authorId:meta.authorId.trim(),date});}return {ratingBases,ratingChanges}}
