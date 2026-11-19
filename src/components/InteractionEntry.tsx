import { useRef, useState } from 'react';
import type { InteractionDraft, MapSlice, SaveInteraction } from '../types';
import demo from '../../docs/plans/demo-interview.json';
import { Button, Card, Input, Select } from './ui';

/** Manual integration path; B can reuse the SaveInteraction callback for extraction. */
export function InteractionEntry({ slice, today, onSaveInteraction, onOpenSource }: { slice: MapSlice; today: string; onSaveInteraction: SaveInteraction; onOpenSource: (id: string) => void }) {
  const initial = (): InteractionDraft => ({ requestId: crypto.randomUUID(), personId: slice.selectedPersonId ?? slice.people[0]?.id ?? '', date: today, channel: 'Встреча', ourOwner: '', ourDepartment: 'Продажи', summary: '', sentiment: 'Нейтральная', evidence: { kind: 'interview', sourceLabel: '', sourceExcerpt: '' } });
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const update = (patch: Partial<InteractionDraft>) => { setDraft(value => ({ ...value, ...patch, requestId: crypto.randomUUID() })); setSaved(null); setError(''); };
  const evidence = draft.evidence!;
  return <Card className="input-card" data-tour="observation-entry"><h2>Добавить наблюдение</h2><p>Ручной ввод источника. Компания и контакт взяты из карты. Значения проверяет человек; автоматического разбора в этой форме нет.</p>
    <form onSubmit={async event => {
      event.preventDefault(); if (pending.current || slice.historical) return;
      pending.current = true; setBusy(true); setError('');
      try { const result = await onSaveInteraction(slice.companyId, draft); if (result.ok) setSaved(result.interactionId); else setError(result.error); }
      catch { setError('Не удалось сохранить запись. Введённый текст сохранён в форме.'); }
      finally { pending.current = false; setBusy(false); }
    }}><fieldset disabled={busy || slice.historical} className="proposal-fields">
      <legend>Интервью или обратная связь</legend>
      <label>Собеседник<Select required value={draft.personId} onChange={event => update({ personId: event.target.value })}>{slice.people.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</Select></label>
      <label>Дата<Input required type="date" max={today} value={draft.date} onChange={event => update({ date: event.target.value })}/></label>
      <label>Наш сотрудник<Input required value={draft.ourOwner} onChange={event => update({ ourOwner: event.target.value })}/></label>
      <label>Наше подразделение<Input required value={draft.ourDepartment} onChange={event => update({ ourDepartment: event.target.value })}/></label>
      <label>Тип источника<Select value={evidence.kind} onChange={event => update({ evidence: { ...evidence, kind: event.target.value as 'interview' | 'feedback' } })}><option value="interview">Интервью</option><option value="feedback">Обратная связь</option></Select></label>
      <label>Название источника<Input required value={evidence.sourceLabel} onChange={event => update({ evidence: { ...evidence, sourceLabel: event.target.value } })}/></label>
      <label>Исходный фрагмент<textarea required rows={4} value={evidence.sourceExcerpt} onChange={event => update({ evidence: { ...evidence, sourceExcerpt: event.target.value } })}/></label>
      <label>Содержание<textarea required rows={3} value={draft.summary} onChange={event => update({ summary: event.target.value })}/></label>
      <label>Упоминание<Select value={evidence.mentionedPersonIds?.[0] ?? ''} onChange={event => update({ evidence: { ...evidence, mentionedPersonIds: event.target.value ? [event.target.value] : [] } })}><option value="">Нет упоминания</option>{slice.people.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</Select></label>
      <label>Предпочитаемый формат<Input value={evidence.preferences?.format ?? ''} onChange={event => update({ evidence: { ...evidence, preferences: { ...evidence.preferences, format: event.target.value } } })}/></label>
      <label>Прежний поставщик<Input value={evidence.competitor?.name ?? ''} onChange={event => update({ evidence: { ...evidence, competitor: event.target.value ? { ...evidence.competitor, name: event.target.value, outcome: 'previous' } : undefined } })}/></label>
      {evidence.competitor && <label>Причина смены поставщика<Input value={evidence.competitor.reason ?? ''} onChange={event => update({ evidence: { ...evidence, competitor: { ...evidence.competitor!, reason: event.target.value } } })}/></label>}
    </fieldset>
    <div className="form-actions">{slice.companyId === 'bank' && <Button type="button" disabled={busy || slice.historical} onClick={() => { setDraft({ ...structuredClone(demo) as InteractionDraft, requestId: crypto.randomUUID() }); setSaved(null); setError(''); }}>Пример интервью Титова</Button>}<Button variant="primary" type="submit" disabled={busy || slice.historical || !!saved}>{busy ? 'Сохраняем…' : saved ? 'Запись сохранена' : 'Сохранить наблюдение'}</Button></div></form>
    {slice.historical && <p>В историческом срезе ввод закрыт. Вернитесь к текущей карте.</p>}
    {error && <p className="proposal-error" role="alert">{error}</p>}
    {saved && <div role="status"><p>Наблюдение сохранено в рабочей копии. История и давность касания обновлены.</p><Button onClick={() => onOpenSource(saved)}>Открыть на карте</Button><Button onClick={() => { setDraft(initial()); setSaved(null); }}>Новое наблюдение</Button></div>}
  </Card>;
}
