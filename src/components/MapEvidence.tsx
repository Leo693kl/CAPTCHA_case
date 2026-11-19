import { AlertTriangle, ArrowUpRight, Route } from 'lucide-react';
import { Button } from './ui';
import { findMissingRoles } from '../lib/signals';
import { mapSignals } from '../lib/mapSignals';
import { mapMetrics, relationEvidence, supplierEvidence, warmthHistory } from '../lib/mapMetrics';
import type { EvidenceChange, Interaction, MapSlice, Relation } from '../types';
import '../styles/map-evidence.css';

type OpenSource = (interactionId: string) => void;
type OpenPerson = (personId: string) => void;
type SourceProps = { slice: MapSlice; onOpenSource: OpenSource };
type StrengthChange = Extract<EvidenceChange, { kind: 'relation-strength' }>;

const dateLabel = (date: string) => date.split('-').reverse().join('.');
const period = (start: string, end: string) => `${dateLabel(start)} — ${dateLabel(end)}`;

function SourceLink({ record, onOpenSource }: { record: Interaction; onOpenSource: OpenSource }) {
  return <Button variant="ghost" className="map-source-link" onClick={() => onOpenSource(record.id)}>
    <ArrowUpRight size={16} strokeWidth={1.75} aria-hidden="true"/>
    <span>{record.evidence?.sourceLabel ?? record.channel} · {dateLabel(record.date)}</span>
  </Button>;
}

export function MapIndicators({ slice, personId, onOpenSource }: SourceProps & { personId?: string }) {
  const metrics = mapMetrics(slice, personId);
  const { openRate, intensity } = metrics;
  const snapshots = personId === undefined ? [] : warmthHistory(slice, personId);
  const first = snapshots[0];
  const last = snapshots.at(-1);

  return <section className="map-indicators" aria-label={personId ? 'Показатели контакта' : 'Показатели компании'}>
    <h3>Показатели {personId ? 'контакта' : 'компании'}</h3>
    <p className="map-evidence-note">
      {personId ? 'Упоминания по всей компании. Письма и касания по контакту.' : 'По всей компании при любых фильтрах людей.'}
      {' '}30 дней · {period(metrics.start, metrics.end)}
    </p>
    <dl className="map-indicator-values">
      <div>
        <dt>Открываемость</dt>
        <dd>{openRate.percent === null ? 'Нет данных' : `${openRate.percent}% · ${openRate.opened} / ${openRate.measured}`}</dd>
        <small>Открытые из писем со статусом на дату среза</small>
      </div>
      {personId && <div>
        <dt>Упоминаемость</dt>
        <dd>{metrics.observations.length ? `${metrics.mentions.length} / ${metrics.observations.length}` : 'Нет данных'}</dd>
        <small>Наблюдения с упоминанием из всех подтверждённых</small>
      </div>}
      <div>
        <dt>Интенсивность</dt>
        <dd>{intensity.previous} → {intensity.current} касаний</dd>
        <small>Предыдущее окно · {period(metrics.previousStart, metrics.previousEnd)}</small>
      </div>
      {personId && <div>
        <dt>Теплота по снимкам</dt>
        <dd>{!first || !last ? 'Нет данных' : first === last ? `${last.person.warmth} / 5` : `${first.person.warmth} → ${last.person.warmth} / 5`}</dd>
        {first && last && <small>{first === last ? `Один снимок · ${dateLabel(last.date)}` : period(first.date, last.date)}</small>}
      </div>}
    </dl>
    {metrics.mentions.length > 0 && <details>
      <summary>Записи с упоминанием</summary>
      <ul>{metrics.mentions.map(record => <li key={record.id}><SourceLink record={record} onOpenSource={onOpenSource}/></li>)}</ul>
    </details>}
    {intensity.channels.length > 0 && <details>
      <summary>Касания по каналам</summary>
      <table>
        <thead><tr><th scope="col">Канал</th><th scope="col">До</th><th scope="col">В периоде</th></tr></thead>
        <tbody>{intensity.channels.map(row => <tr key={row.channel}><th scope="row">{row.channel}</th><td>{row.previous}</td><td>{row.current}</td></tr>)}</tbody>
      </table>
    </details>}
  </section>;
}

const outcomes = { current: 'Текущий поставщик', previous: 'Прежний поставщик', unknown: 'Статус не указан' };

export function SupplierLines({ slice, companyName, onOpenSource }: SourceProps & { companyName: string }) {
  const entries = supplierEvidence(slice);
  if (!entries.length) return null;

  return <section className="map-indicators supplier-lines" aria-label="Связи с поставщиками">
    <h3>Связи с поставщиками</h3>
    <p className="map-evidence-note">Подтверждённые наблюдения компании до {dateLabel(slice.asOf)} включительно</p>
    {entries.map(({ record, supplier }) => <details key={record.id}>
      <summary>
        <span className="supplier-line-label">
          {companyName} <Route size={18} strokeWidth={1.75} aria-label="связь с" role="img"/> {supplier.name}
        </span>
        <small>{outcomes[supplier.outcome]} · {dateLabel(record.date)}</small>
      </summary>
      <p>{slice.people.find(person => person.id === record.personId)?.name} · {record.ourOwner} · {record.ourDepartment}</p>
      <p>{supplier.reason || 'Причина не указана'}</p>
      <blockquote>{record.evidence?.sourceExcerpt}</blockquote>
      <SourceLink record={record} onOpenSource={onOpenSource}/>
    </details>)}
  </section>;
}

export function MapEvidenceSignals({ slice, onOpenPerson, onOpenSource }: SourceProps & { onOpenPerson: OpenPerson }) {
  const { makers, warm, stale, conflicts, duplicates } = mapSignals(slice);
  const missing = findMissingRoles(slice.people.filter(person => person.companyId === slice.companyId));
  const onlyWarm = warm.length === 1 ? warm[0] : undefined;

  return <section className="map-indicators" aria-label="Сигналы по компании">
    <h3>Сигналы по компании</h3>
    <p className="map-evidence-note">По всей компании · на {dateLabel(slice.asOf)}</p>
    <p className="map-evidence-note">Тёплый ЛПР · теплота 4–5 из 5 и прямое касание не более 90 дней назад</p>
    <p>Тёплые ЛПР · {warm.length} из {makers}</p>
    {onlyWarm && <div className="map-warm-risk">
      <h4><AlertTriangle size={18} strokeWidth={1.75} aria-hidden="true"/> Риск зависимости от одного ЛПР</h4>
      <Button variant="ghost" onClick={() => onOpenPerson(onlyWarm.person.id)}>{onlyWarm.person.name}</Button>
      <p>Теплота {onlyWarm.person.warmth} / 5 · последнее касание {dateLabel(onlyWarm.last.date)}</p>
      <SourceLink record={onlyWarm.last} onOpenSource={onOpenSource}/>
    </div>}
    <details>
      <summary>Давние контакты или без касаний · {stale.length}</summary>
      <p>Последнее касание более года назад или история отсутствует.</p>
      <ul>{stale.map(({ person, last }) => <li key={person.id}>
        <Button variant="ghost" onClick={() => onOpenPerson(person.id)}>{person.name}</Button>
        <span>{last ? dateLabel(last.date) : 'Нет касаний'}</span>
        {last && <SourceLink record={last} onOpenSource={onOpenSource}/>}
      </li>)}</ul>
    </details>
    <details>
      <summary>Пересечения команд · {conflicts.length}</summary>
      <p>Две или больше команд общались с одним контактом в последние 30 дней.</p>
      {conflicts.map(({ person, departments, recent }) => <div className="map-conflict" key={person.id}>
        <Button variant="ghost" onClick={() => onOpenPerson(person.id)}>{person.name}</Button>
        <p>{departments.join(', ')}</p>
        <ul>{recent.map(record => <li key={record.id}>
          <span>{record.ourDepartment}</span><SourceLink record={record} onOpenSource={onOpenSource}/>
        </li>)}</ul>
      </div>)}
    </details>
    <details>
      <summary>Роли, которые предстоит найти · {missing.length}</summary>
      <p>Закупки и финансы определяются по отделу. Для CISO учитывается должность, для бизнес-заказчика — должность или роль ЛПР в бизнес-подразделении.</p>
      <ul>{missing.map(role => <li key={role.id}>{role.label} · {role.description}</li>)}</ul>
    </details>
    <details>
      <summary>Кандидаты в дубли · {duplicates.length}</summary>
      <p>Совпали имя и подразделение. Сверьте карточки контактов.</p>
      {duplicates.map(group => <ul key={group[0].id}>{group.map(person => <li key={person.id}>
        <Button variant="ghost" onClick={() => onOpenPerson(person.id)}>{person.name}</Button>
        <span>{person.department} · {person.title} · {person.owner}</span>
      </li>)}</ul>)}
    </details>
  </section>;
}

export function RelationStrengthEvidence({ slice, relation, onOpenSource, onConfirmStrength }: SourceProps & {
  relation: Relation;
  onConfirmStrength: (change: StrengthChange) => void;
}) {
  const proposal = relationEvidence(slice, relation);
  return <section className="map-indicators" aria-label="Свидетельства о паре">
    <h3>Сила связи по свидетельствам</h3>
    <p>Текущая оценка · {relation.strength} / 5</p>
    <p>{proposal.strength === null ? 'Для предложения нужны две подтверждённые записи о паре.' : `Предложение · ${proposal.strength} / 5`}</p>
    <p className="map-evidence-note">До {dateLabel(slice.asOf)} включительно · вес равен числу разных записей о паре плюс один, максимум 5.</p>
    <ul>{proposal.records.map(record => <li key={record.id}><SourceLink record={record} onOpenSource={onOpenSource}/></li>)}</ul>
    {proposal.strength !== null && proposal.strength !== relation.strength &&
      <Button disabled={slice.historical} onClick={() => {
        if (proposal.strength !== null && !slice.historical) {
          onConfirmStrength({ kind: 'relation-strength', relationId: relation.id, strength: proposal.strength });
        }
      }}>Подтвердить с новым наблюдением</Button>}
    {slice.historical && <p className="map-evidence-note">Оценка связи взята из текущей CRM. Подтверждение доступно на текущей карте.</p>}
  </section>;
}

export function ObservationDetails({ record, initiallyOpen }: { record: Interaction; initiallyOpen: boolean }) {
  const evidence = record.evidence;
  if (!evidence) return null;
  const { preferences, competitor } = evidence;

  return <details open={initiallyOpen || undefined} className="observation-details">
    <summary>{evidence.kind === 'interview' ? 'Интервью' : 'Обратная связь'} · {evidence.sourceLabel}</summary>
    <blockquote>{evidence.sourceExcerpt}</blockquote>
    {preferences?.channel && <p>Канал связи · {preferences.channel}</p>}
    {preferences?.format && <p>Формат · {preferences.format}</p>}
    {!!preferences?.topics?.length && <p>Темы · {preferences.topics.join(', ')}</p>}
    {competitor && <p>{outcomes[competitor.outcome]} · {competitor.name} · {competitor.reason || 'Причина не указана'}</p>}
    {evidence.signals?.some(signal => signal.kind === 'initiative') && <p>Контакт предложил следующий шаг</p>}
    {evidence.signals?.some(signal => signal.kind === 'resumption') && <p>Контакт вернулся к обсуждению</p>}
    {[...new Set(evidence.signals?.flatMap(signal => signal.kind === 'approval' ? [signal.requestedOn] : []))].map(date => {
      const days = (Date.parse(record.date) - Date.parse(date)) / 86_400_000;
      return Number.isFinite(days) && days >= 0
        ? <p key={date}>Согласование · {days} дн. · {period(date, record.date)}</p>
        : null;
    })}
  </details>;
}
