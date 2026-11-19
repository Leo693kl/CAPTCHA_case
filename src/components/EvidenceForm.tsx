import { useRef, useState } from 'react';
import { Button, Input, Select } from './ui';
import { extractEvidence } from '../lib/evidenceExtractor';
import type { InteractionDraft, Person, SaveInteraction } from '../types';

export interface EvidenceFormProps {
 companyId: string; people: readonly Person[]; saveInteraction: SaveInteraction;
 selectedPersonId?: string | null; asOf: string; disabled?: boolean;
 onOpenSaved: (interactionId: string) => void;
}
const newRequestId = () => crypto.randomUUID();
export function EvidenceForm({companyId, people, saveInteraction, selectedPersonId, asOf, disabled, onOpenSaved}: EvidenceFormProps) {
 const requestId = useRef(newRequestId());
 const [personId,setPersonId]=useState(selectedPersonId ?? ''); const [date,setDate]=useState(asOf);
 const [kind,setKind]=useState<'interview'|'feedback'>('interview'); const [source,setSource]=useState('');
 const [excerpt,setExcerpt]=useState(''); const [owner,setOwner]=useState(''); const [department,setDepartment]=useState('');
 const [summary,setSummary]=useState(''); const [channel,setChannel]=useState('Встреча'); const [sentiment,setSentiment]=useState('Нейтральная');
 const [mentioned,setMentioned]=useState<string[]>([]); const [format,setFormat]=useState(''); const [topic,setTopic]=useState('');
 const [competitor,setCompetitor]=useState(''); const [reason,setReason]=useState(''); const [outcome,setOutcome]=useState<'previous'|'current'|'unknown'>('unknown');
 const [ambiguous,setAmbiguous]=useState<string[]>([]); const [reviewed,setReviewed]=useState(false); const [saving,setSaving]=useState(false);
 const [error,setError]=useState(''); const [saved,setSaved]=useState('');
 const analyze=()=>{const found=extractEvidence(excerpt,people);setMentioned(found.mentionedIds);setAmbiguous(found.ambiguousNames);setFormat(found.format);setTopic(found.topic);setCompetitor(found.competitor);setReason(found.reason);setOutcome(found.outcome);setReviewed(true);setError('')};
 const save=async()=>{
  if (!personId || !date || !source.trim() || !excerpt.trim() || !owner.trim() || !department.trim() || !summary.trim()) {setError('Заполните контакт, дату, источник, фрагмент, автора, подразделение и краткое содержание.');return}
  if (ambiguous.some(name=>!mentioned.some(id=>people.some(p=>p.id===id&&p.name===name)))) {setError('Выберите контакт для каждого неоднозначного имени.');return}
  const draft: InteractionDraft={requestId:requestId.current,personId,date,channel,ourOwner:owner.trim(),ourDepartment:department.trim(),summary:summary.trim(),sentiment,evidence:{kind,sourceLabel:source.trim(),sourceExcerpt:excerpt.trim(),mentionedPersonIds:mentioned,preferences:{...(format.trim()?{format:format.trim()}:{}),...(topic.trim()?{topics:topic.split(',').map(t=>t.trim()).filter(Boolean)}:{})},...(competitor.trim()?{competitor:{name:competitor.trim(),outcome,...(reason.trim()?{reason:reason.trim()}:{})}}:{})}};
  setSaving(true);setError('');try {const result=await saveInteraction(companyId,draft);if(result.ok)setSaved(result.interactionId);else setError(result.error)} catch {setError('Не удалось сохранить запись. Черновик сохранён в форме.')} finally {setSaving(false)}
 };
 return <section className="input-card" aria-label="Новое наблюдение"><h2>Интервью или обратная связь</h2>
 {saved ? <><p role="status">Запись сохранена.</p><Button onClick={()=>onOpenSaved(saved)}>Открыть на карте</Button></> : <>
 <div className="proposal-fields">
 <label>Контакт<Select value={personId} onChange={e=>setPersonId(e.target.value)}><option value="">Выберите контакт</option>{people.map(p=><option key={p.id} value={p.id}>{p.name} · {p.department} · {p.title}</option>)}</Select></label>
 <label>Дата<Input type="date" value={date} max={asOf} onChange={e=>setDate(e.target.value)}/></label>
 <label>Вид<Select value={kind} onChange={e=>setKind(e.target.value as 'interview'|'feedback')}><option value="interview">Интервью</option><option value="feedback">Обратная связь</option></Select></label>
 <label>Источник<Input value={source} onChange={e=>setSource(e.target.value)}/></label><label>Канал<Input value={channel} onChange={e=>setChannel(e.target.value)}/></label>
 <label>Автор со стороны КРОК<Input value={owner} onChange={e=>setOwner(e.target.value)}/></label><label>Подразделение КРОК<Input value={department} onChange={e=>setDepartment(e.target.value)}/></label>
 <label>Краткое содержание<Input value={summary} onChange={e=>setSummary(e.target.value)}/></label><label>Оценка<Input value={sentiment} onChange={e=>setSentiment(e.target.value)}/></label>
 </div><label htmlFor="evidence-excerpt">Исходный фрагмент</label><textarea id="evidence-excerpt" rows={5} value={excerpt} onChange={e=>{setExcerpt(e.target.value);setReviewed(false)}}/>
 <Button disabled={!excerpt.trim()||disabled} onClick={analyze}>Разобрать и проверить</Button>
 {reviewed&&<div><p>Проверьте предложения: пустой разбор не мешает сохранить запись. Упоминания относятся к названным людям, предпочтения — к собеседнику.</p>
 {ambiguous.length>0&&<p role="status">Неоднозначные имена: {ambiguous.join(', ')}. Выберите нужную карточку.</p>}
 <fieldset><legend>Упомянутые контакты</legend>{people.map(p=><label key={p.id}><input type="checkbox" checked={mentioned.includes(p.id)} onChange={e=>setMentioned(old=>e.target.checked?[...old,p.id]:old.filter(id=>id!==p.id))}/> {p.name} · {p.department} · {p.title}</label>)}</fieldset>
 <div className="proposal-fields"><label>Предпочтительный формат<Input value={format} onChange={e=>setFormat(e.target.value)}/></label><label>Темы через запятую<Input value={topic} onChange={e=>setTopic(e.target.value)}/></label><label>Поставщик<Input value={competitor} onChange={e=>setCompetitor(e.target.value)}/></label><label>Статус поставщика<Select value={outcome} onChange={e=>setOutcome(e.target.value as 'previous'|'current'|'unknown')}><option value="unknown">Неизвестен</option><option value="previous">Прежний</option><option value="current">Текущий</option></Select></label><label>Причина со слов контакта<Input value={reason} onChange={e=>setReason(e.target.value)}/></label></div>
 <Button variant="primary" disabled={disabled||saving} onClick={()=>void save()}>{saving?'Сохраняем…':'Сохранить'}</Button></div>}
 {error&&<p role="alert" className="proposal-error">{error}</p>}</>}
 </section>
}
