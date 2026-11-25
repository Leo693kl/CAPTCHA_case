import { useState, type FormEvent } from 'react';
import { Button, Input } from './ui';
import type { HistoryChange } from '../lib/history';

const format = (date: string) => date.split('-').reverse().join('.');

export function TimeControls({ date, today, min, changes, onDate }: {
  date: string;
  today: string;
  min: string;
  changes: HistoryChange[];
  onDate: (date: string) => void;
}) {
  const [draft, setDraft] = useState(date);
  const [expanded, setExpanded] = useState(false);
  const groups = new Map<string, HistoryChange[]>();

  for (const event of expanded ? changes : changes.slice(0, 8)) {
    const group = groups.get(event.date) ?? [];
    group.push(event);
    groups.set(event.date, group);
  }

  const showDate = (value: string) => {
    setDraft(value);
    if (value !== date) onDate(value);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (draft >= min && draft <= today) showDate(draft);
  };

  return <div className="history-controls">
    <p className="history-status" role="status">
      {date === today ? 'Текущая карта' : 'Исторический срез'} <time dateTime={date}>{format(date)}</time>
    </p>
    <form className="history-date-form" onSubmit={submit}>
      <label htmlFor="history-date">Дата среза</label>
      <div className="history-date-actions">
        <Input id="history-date" type="date" value={draft} min={min} max={today} required onChange={event => setDraft(event.target.value)}/>
        <Button type="submit" variant="primary">Показать на карте</Button>
        {date !== today && <Button variant="ghost" onClick={() => showDate(today)}>Вернуться к текущей карте</Button>}
      </div>
    </form>
    <details className="history-help">
      <summary>Что показывает история</summary>
      <p>Контакты и касания показаны на выбранную дату. Связи взяты из текущей CRM. Редактирование доступно на текущей карте.</p>
    </details>
    <section className="history-events" aria-labelledby="history-events-title">
      <h3 id="history-events-title">Изменения до выбранной даты <small>{changes.length}</small></h3>
      {groups.size ? <ol className="history-groups">
        {[...groups].map(([day, events]) => <li key={day}>
          {day < min
            ? <time dateTime={day}>{format(day)}</time>
            : <Button variant="ghost" className="history-event-date" aria-current={day === date ? 'date' : undefined}
                aria-label={`Показать карту на ${format(day)}`} onClick={() => showDate(day)}>
                <time dateTime={day}>{format(day)}</time>
              </Button>}
          <ul>{events.map(event => <li key={event.id}>{event.text}</li>)}</ul>
        </li>)}
      </ol> : <p className="muted">До этой даты изменений нет.</p>}
      {changes.length > 8 && <Button variant="ghost" onClick={() => setExpanded(!expanded)}>
        {expanded ? 'Показать меньше' : `Показать все изменения (${changes.length})`}
      </Button>}
    </section>
  </div>;
}
