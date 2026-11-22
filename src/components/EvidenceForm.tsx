import { useRef, useState } from 'react';
import { Button, Input, Select } from './ui';
import { extractEvidence } from '../lib/evidenceExtractor';
import { roles, relationTypes, type EvidenceChange, type EvidenceSignal, type InteractionDraft, type Person, type Relation, type Role, type SaveInteraction } from '../types';

export interface EvidenceFormProps {
 companyId: string; people: readonly Person[]; relations?: readonly Relation[]; saveInteraction: SaveInteraction;
 selectedPersonId?: string | null; asOf: string; disabled?: boolean;
 onOpenSaved: (interactionId: string) => void;
 initialChange?: EvidenceChange;
}
const newRequestId = () => crypto.randomUUID();
export function EvidenceForm({companyId, people, relations = [], saveInteraction, selectedPersonId, asOf, disabled, onOpenSaved, initialChange}: EvidenceFormProps) {
 const requestId = useRef(newRequestId());
 const [personId,setPersonId]=useState(selectedPersonId ?? ''); const [date,setDate]=useState(asOf);
 const [kind,setKind]=useState<'interview'|'feedback'>('interview'); const [source,setSource]=useState('');
 const [excerpt,setExcerpt]=useState(''); const [owner,setOwner]=useState(''); const [department,setDepartment]=useState('');
 const [summary,setSummary]=useState(''); const [channel,setChannel]=useState('Встреча'); const [sentiment,setSentiment]=useState('Нейтральная');
 const [mentioned,setMentioned]=useState<string[]>([]); const [format,setFormat]=useState(''); const [topic,setTopic]=useState('');
 const [preferredChannel,setPreferredChannel]=useState('');
 const [initiative,setInitiative]=useState(false); const [resumption,setResumption]=useState(false);
 const [approval,setApproval]=useState(false); const [requestedOn,setRequestedOn]=useState('');
 const [competitor,setCompetitor]=useState(''); const [reason,setReason]=useState(''); const [outcome,setOutcome]=useState<'previous'|'current'|'unknown'>('unknown');
 const [ambiguous,setAmbiguous]=useState<string[]>([]); const [reviewed,setReviewed]=useState(false); const [saving,setSaving]=useState(false);
 const [error,setError]=useState(''); const [saved,setSaved]=useState('');
 const inFlight=useRef(false);
 const [changeKind,setChangeKind]=useState<'none'|'role'|'relation-strength'>(initialChange?.kind ?? 'none');
 const [changePersonId,setChangePersonId]=useState(initialChange?.kind==='role'?initialChange.personId:''); const [newRole,setNewRole]=useState<Role|''>(initialChange?.kind==='role'?initialChange.role:'');
 const [changeRelationId,setChangeRelationId]=useState(initialChange?.kind==='relation-strength'?initialChange.relationId:''); const [newStrength,setNewStrength]=useState(initialChange?.kind==='relation-strength'?String(initialChange.strength):'');
 const [confirmed,setConfirmed]=useState(false);
 const companyPeople=people.filter(p=>p.companyId===companyId);
 const companyRelations=relations.filter(r=>r.companyId===companyId && companyPeople.some(p=>p.id===r.from) && companyPeople.some(p=>p.id===r.to));
 const changePerson=companyPeople.find(p=>p.id===changePersonId);
 const changeRelation=companyRelations.find(r=>r.id===changeRelationId);
 const name=(id:string)=>companyPeople.find(p=>p.id===id)?.name ?? 'Неизвестный контакт';
 const change: EvidenceChange | undefined = changeKind==='role' && changePerson && newRole && newRole!==changePerson.decisionRole
   ? {kind:'role',personId:changePerson.id,role:newRole}
   : changeKind==='relation-strength' && changeRelation && /^[1-5]$/.test(newStrength) && Number(newStrength)!==changeRelation.strength
   ? {kind:'relation-strength',relationId:changeRelation.id,strength:Number(newStrength)} : undefined;
 const rejectChange=()=>{setChangeKind('none');setConfirmed(false)};
 const analyze=()=>{const found=extractEvidence(excerpt,people);setMentioned(found.mentionedIds);setAmbiguous(found.ambiguousNames);setFormat(found.format);setTopic(found.topic);setCompetitor(found.competitor);setReason(found.reason);setOutcome(found.outcome);setReviewed(true);setError('')};
 const save=async()=>{
  if (inFlight.current) return;
  if (changeKind!=='none' && (!change || !confirmed)) {setError('Подтвердите выбранное изменение или отклоните его.');return}
  if (!personId || !date || !source.trim() || !excerpt.trim() || !owner.trim() || !department.trim() || !summary.trim()) {setError('Заполните контакт, дату, источник, фрагмент, автора, подразделение и краткое содержание.');return}
  if (ambiguous.some(name=>!mentioned.some(id=>people.some(p=>p.id===id&&p.name===name)))) {setError('Выберите контакт для каждого неоднозначного имени.');return}
  if (approval && (!requestedOn || requestedOn>date)) {setError('Укажите дату запроса не позже даты касания.');return}
  const signals: EvidenceSignal[]=[...(initiative?[{kind:'initiative' as const}]:[]),...(resumption?[{kind:'resumption' as const}]:[]),...(approval?[{kind:'approval' as const,requestedOn}]:[])];
  const draft: InteractionDraft={requestId:requestId.current,personId,date,channel,ourOwner:owner.trim(),ourDepartment:department.trim(),summary:summary.trim(),sentiment,evidence:{kind,sourceLabel:source.trim(),sourceExcerpt:excerpt.trim(),mentionedPersonIds:mentioned,preferences:{...(preferredChannel.trim()?{channel:preferredChannel.trim()}:{}),...(format.trim()?{format:format.trim()}:{}),...(topic.trim()?{topics:topic.split(',').map(t=>t.trim()).filter(Boolean)}:{})},...(signals.length?{signals}:{}),...(competitor.trim()?{competitor:{name:competitor.trim(),outcome,...(reason.trim()?{reason:reason.trim()}:{})}}:{})}};
  inFlight.current=true;setSaving(true);setError('');try {const result=await saveInteraction(companyId,draft,confirmed?change:undefined);if(result.ok)setSaved(result.interactionId);else setError(result.error)} catch {setError('Не удалось сохранить запись. Черновик сохранён в форме.')} finally {inFlight.current=false;setSaving(false)}
 };
 return <section className="input-card" aria-label="Новое наблюдение"><h2>Интервью или обратная связь</h2>
 {saved ? <><p role="status">Запись сохранена.</p><Button onClick={()=>onOpenSaved(saved)}>Открыть на карте</Button></> : <>
 <fieldset disabled={saving} aria-label="Черновик наблюдения">
 <div className="proposal-fields">
 <label>Контакт<Select value={personId} onChange={e=>setPersonId(e.target.value)}><option value="">Выберите контакт</option>{people.map(p=><option key={p.id} value={p.id}>{p.name} · {p.department} · {p.title}</option>)}</Select></label>
 <label>Дата<Input type="date" value={date} max={asOf} onChange={e=>setDate(e.target.value)}/></label>
 <label>Вид<Select value={kind} onChange={e=>setKind(e.target.value as 'interview'|'feedback')}><option value="interview">Интервью</option><option value="feedback">Обратная связь</option></Select></label>
 <label>Источник<Input value={source} onChange={e=>setSource(e.target.value)}/></label><label>Канал касания<Input value={channel} onChange={e=>setChannel(e.target.value)}/></label>
 <label>Автор со стороны КРОК<Input value={owner} onChange={e=>setOwner(e.target.value)}/></label><label>Подразделение КРОК<Input value={department} onChange={e=>setDepartment(e.target.value)}/></label>
 <label>Краткое содержание<Input value={summary} onChange={e=>setSummary(e.target.value)}/></label><label>Оценка<Input value={sentiment} onChange={e=>setSentiment(e.target.value)}/></label>
 </div><label htmlFor="evidence-excerpt">Исходный фрагмент</label><textarea id="evidence-excerpt" rows={5} value={excerpt} onChange={e=>{setExcerpt(e.target.value);setReviewed(false);setConfirmed(false)}}/>
 <Button disabled={!excerpt.trim()||disabled} onClick={analyze}>Разобрать и проверить</Button>
 {reviewed&&<div><p>Проверьте предложения: пустой разбор не мешает сохранить запись. Упоминания относятся к названным людям, предпочтения — к собеседнику.</p>
 {ambiguous.length>0&&<p role="status">Неоднозначные имена: {ambiguous.join(', ')}. Выберите нужную карточку.</p>}
 <fieldset><legend>Упомянутые контакты</legend>{people.map(p=><label key={p.id}><input type="checkbox" checked={mentioned.includes(p.id)} onChange={e=>setMentioned(old=>e.target.checked?[...old,p.id]:old.filter(id=>id!==p.id))}/> {p.name} · {p.department} · {p.title}</label>)}</fieldset>
 <div className="proposal-fields"><label>Предпочтительный канал связи<Input value={preferredChannel} onChange={e=>setPreferredChannel(e.target.value)}/></label><label>Предпочтительный формат<Input value={format} onChange={e=>setFormat(e.target.value)}/></label><label>Темы через запятую<Input value={topic} onChange={e=>setTopic(e.target.value)}/></label><label>Поставщик<Input value={competitor} onChange={e=>setCompetitor(e.target.value)}/></label><label>Статус поставщика<Select value={outcome} onChange={e=>setOutcome(e.target.value as 'previous'|'current'|'unknown')}><option value="unknown">Неизвестен</option><option value="previous">Прежний</option><option value="current">Текущий</option></Select></label><label>Причина со слов контакта<Input value={reason} onChange={e=>setReason(e.target.value)}/></label></div>
 <fieldset><legend>Подтверждённые сигналы из источника (необязательно)</legend>
 <label>Контакт предложил следующий шаг<input type="checkbox" checked={initiative} onChange={e=>setInitiative(e.target.checked)}/></label>
 <label>Контакт вернулся к обсуждению<input type="checkbox" checked={resumption} onChange={e=>setResumption(e.target.checked)}/></label>
 <label>Согласование состоялось<input type="checkbox" checked={approval} onChange={e=>setApproval(e.target.checked)}/></label>
 {approval&&<label>Дата запроса согласования<Input type="date" value={requestedOn} max={date} onChange={e=>setRequestedOn(e.target.value)}/></label>}
 <p>Дата касания — дата состоявшегося согласования. Срок считается в календарных днях от даты запроса.</p>
 </fieldset>
 <fieldset><legend>Необязательное изменение карты</legend>
 <p>Можно подтвердить одну правку вместе с записью. Отклонение не помешает сохранить интервью.</p>
 <label>Тип изменения<Select value={changeKind} onChange={e=>{setChangeKind(e.target.value as 'none'|'role'|'relation-strength');setConfirmed(false)}}><option value="none">Без изменения</option><option value="role">Роль контакта</option><option value="relation-strength">Сила связи</option></Select></label>
 {changeKind==='role'&&<div className="proposal-fields"><label>Контакт для изменения роли<Select value={changePersonId} onChange={e=>{setChangePersonId(e.target.value);setConfirmed(false)}}><option value="">Выберите контакт</option>{companyPeople.map(p=><option key={p.id} value={p.id}>{p.name} · {p.department} · {p.title}</option>)}</Select></label><label>Новая роль<Select value={newRole} onChange={e=>{setNewRole(e.target.value as Role|'');setConfirmed(false)}}><option value="">Выберите роль</option>{Object.entries(roles).map(([value,label])=><option key={value} value={value}>{label}</option>)}</Select></label></div>}
 {changeKind==='relation-strength'&&<div className="proposal-fields"><label>Связь<Select value={changeRelationId} onChange={e=>{setChangeRelationId(e.target.value);setConfirmed(false)}}><option value="">Выберите связь</option>{companyRelations.map(r=><option key={r.id} value={r.id}>{name(r.from)} ↔ {name(r.to)} · {relationTypes[r.type]}</option>)}</Select></label><label>Новая сила<Select value={newStrength} onChange={e=>{setNewStrength(e.target.value);setConfirmed(false)}}><option value="">Выберите силу</option>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n}/5</option>)}</Select></label></div>}
 {changeKind!=='none'&&<>{change && <p role="status">{change.kind==='role' && changePerson ? `Роль: ${changePerson.name} · ${changePerson.department} — ${roles[changePerson.decisionRole]} → ${roles[change.role]}.` : change.kind==='relation-strength' && changeRelation ? `Сила связи: ${name(changeRelation.from)} ↔ ${name(changeRelation.to)} · ${relationTypes[changeRelation.type]} — ${changeRelation.strength}/5 → ${change.strength}/5.` : ''}</p>}
 {!change&&<p>Выберите существующий контакт или связь и новое значение, отличное от текущего.</p>}
 <label><input type="checkbox" checked={confirmed} disabled={!change} onChange={e=>setConfirmed(e.target.checked)}/> Подтверждаю эту правку вместе с интервью</label>
 <Button onClick={rejectChange}>Отклонить правку</Button></>}
 </fieldset>
 <Button variant="primary" disabled={disabled||saving} onClick={()=>void save()}>{saving?'Сохраняем…':'Сохранить'}</Button></div>}
 {error&&<p role="alert" className="proposal-error">{error}</p>}</fieldset></>}
 </section>
}
