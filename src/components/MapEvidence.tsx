import { AlertTriangle, ArrowUpRight, Route } from 'lucide-react';
import { Button } from './ui';
import { findMissingRoles } from '../lib/signals';
import { mapSignals } from '../lib/mapSignals';
import { sourcePerson } from '../lib/interactionSource';
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
    <span>{record.evidence?.sourceLabel ?? record.channel}</span><time dateTime={record.date}>{dateLabel(record.date)}</time>
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
    <dl className="map-indicator-values">
      <div>
        <dt>Открываемость</dt>
        <dd>{openRate.percent === null ? 'Нет данных' : `${openRate.percent}%`}</dd>
      </div>
      {personId && <div>
        <dt>Упоминаемость</dt>
        <dd>{metrics.observations.length ? `${metrics.mentions.length} / ${metrics.observations.length}` : 'Нет данных'}</dd>
      </div>}
      <div>
        <dt>Интенсивность</dt>
        <dd>{intensity.previous} → {intensity.current} касаний</dd>
      </div>
      {personId && <div>
        <dt>Теплота по снимкам</dt>
        <dd>{!first || !last ? 'Нет данных' : first === last ? `${last.person.warmth} / 5` : `${first.person.warmth} → ${last.person.warmth} / 5`}</dd>
      </div>}
    </dl>
    <details>
      <summary>Как считаются показатели</summary>
      <p>{personId ? 'Письма и касания по контакту.' : 'Все контакты компании, независимо от фильтров.'} Текущие 30 дней: {period(metrics.start, metrics.end)}.</p>
      <p>Открываемость: доля открытых писем среди писем с известным статусом на дату среза.{openRate.measured>0&&<> Открыто {openRate.opened} из {openRate.measured}.</>}</p>
      <p>Интенсивность: число касаний в предыдущие 30 дней ({period(metrics.previousStart, metrics.previousEnd)}) и в текущем периоде.</p>
      {personId && <p>Упоминаемость: доля подтверждённых наблюдений компании с упоминанием контакта.</p>}
      {first && last && <p>Теплота по снимкам: {first === last ? dateLabel(last.date) : period(first.date, last.date)}.</p>}
    </details>
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
  if (!entries.length) return <p className="muted">Нет подтверждённых наблюдений о поставщиках.</p>;

  return <section className="map-indicators supplier-lines" aria-label="Связи с поставщиками">
    <h3>Связи с поставщиками</h3>
    <p className="map-evidence-note">Подтверждённые наблюдения компании до {dateLabel(slice.asOf)} включительно</p>
    {entries.map(({ record, supplier }) => <details key={record.id}>
      <summary>
        <span className="supplier-line-label">
          {companyName} <Route size={18} strokeWidth={1.75} aria-label="связь с" role="img"/> {supplier.name}
        </span>
        <small className="record-meta"><span>{outcomes[supplier.outcome]}</span><time dateTime={record.date}>{dateLabel(record.date)}</time></small>
      </summary>
      <p><strong>{sourcePerson(slice, record.personId)?.name ?? 'Имя недоступно'}</strong></p>
      <p>{supplier.reason || 'Причина не указана'}</p>
      <blockquote>{record.evidence?.sourceExcerpt}</blockquote>
      <SourceLink record={record} onOpenSource={onOpenSource}/>
    </details>)}
  </section>;
}

export function MapEvidenceSignals({ slice, onOpenPerson, onOpenSource, onFindRole }: SourceProps & { onOpenPerson: OpenPerson; onFindRole: (id: string) => void }) {
  const { makers, warm, stale, conflicts, duplicates } = mapSignals(slice);
  const missing = findMissingRoles(slice.people.filter(person => person.companyId === slice.companyId));
  const onlyWarm = warm.length === 1 ? warm[0] : undefined;

  return <div className="map-signals">
    {onlyWarm && <div className="map-warm-risk">
      <h4><AlertTriangle size={18} strokeWidth={1.75} aria-hidden="true"/> Риск зависимости от одного ЛПР</h4>
      <Button variant="ghost" onClick={() => onOpenPerson(onlyWarm.person.id)}>{onlyWarm.person.name}</Button>
      <SourceLink record={onlyWarm.last} onOpenSource={onOpenSource}/>
    </div>}
    <details>
      <summary>Тёплые ЛПР <small>{warm.length} из {makers}</small></summary>
      <ul>{warm.map(({ person, last }) => <li key={person.id}>
        <Button variant="ghost" onClick={() => onOpenPerson(person.id)}>{person.name}</Button>
        <SourceLink record={last} onOpenSource={onOpenSource}/>
      </li>)}</ul>
      <p className="map-evidence-note">Теплота 4–5 из 5 и прямое касание за последние 90 дней на {dateLabel(slice.asOf)}.</p>
    </details>
    <details>
      <summary>Давние контакты или без касаний <small>{stale.length}</small></summary>
      <ul>{stale.map(({ person, last }) => <li key={person.id}>
        <Button variant="ghost" onClick={() => onOpenPerson(person.id)}>{person.name}</Button>
        {!last && <small>Нет касаний</small>}
        {last && <SourceLink record={last} onOpenSource={onOpenSource}/>}
      </li>)}</ul>
      <p className="map-evidence-note">Последнее касание более года назад или история отсутствует.</p>
    </details>
    <details>
      <summary>Пересечения команд <small>{conflicts.length}</small></summary>
      {conflicts.map(({ person, departments, recent }) => <div className="map-conflict" key={person.id}>
        <Button variant="ghost" onClick={() => onOpenPerson(person.id)}>{person.name}</Button>
        <p>{departments.join(', ')}</p>
        <ul>{recent.map(record => <li key={record.id}>
          <span>{record.ourDepartment}</span><SourceLink record={record} onOpenSource={onOpenSource}/>
        </li>)}</ul>
      </div>)}
      <p className="map-evidence-note">Две или больше команд общались с одним контактом за 30 дней. Согласуйте дальнейшие действия между командами.</p>
    </details>
    <details>
      <summary>Отсутствующие роли <small>{missing.length}</small></summary>
      <ul>{missing.map(role => <li key={role.id} className="missing-row">
        <strong>{role.label}</strong><Button variant="ghost" onClick={() => onFindRole(role.id)}>Найти точку входа</Button>
      </li>)}</ul>
    </details>
    <details>
      <summary>Кандидаты в дубли <small>{duplicates.length}</small></summary>
      {duplicates.map(group => <ul key={group[0].id}>{group.map(person => <li key={person.id}>
        <Button variant="ghost" onClick={() => onOpenPerson(person.id)}>{person.name}</Button>
        <span>{person.title}, {person.department}</span>
      </li>)}</ul>)}
      <p className="map-evidence-note">Совпали имя и подразделение. Сверьте карточки контактов.</p>
    </details>
  </div>;
}

export function RelationStrengthEvidence({ slice, relation, onOpenSource, onConfirmStrength }: SourceProps & {
  relation: Relation;
  onConfirmStrength: (change: StrengthChange) => void;
}) {
  const proposal = relationEvidence(slice, relation);
  return <section className="map-indicators" aria-label="Свидетельства о паре">
    <h3>Сила связи по свидетельствам</h3>
    <p>Текущая оценка: {relation.strength} / 5</p>
    <p>{proposal.strength === null ? 'Для предложения нужны две подтверждённые записи о паре.' : `Предложение: ${proposal.strength} / 5`}</p>
    <p className="map-evidence-note">До {dateLabel(slice.asOf)} включительно. Вес равен числу разных записей о паре плюс один, максимум 5.</p>
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
    <summary>{evidence.sourceLabel}</summary>
    <blockquote>{evidence.sourceExcerpt}</blockquote>
    {preferences?.channel && <p>Канал связи: {preferences.channel}</p>}
    {preferences?.format && <p>Формат: {preferences.format}</p>}
    {!!preferences?.topics?.length && <p>Темы: {preferences.topics.join(', ')}</p>}
    {competitor && <p>{outcomes[competitor.outcome]}: {competitor.name}{competitor.reason && <>. {competitor.reason}</>}</p>}
    {evidence.signals?.some(signal => signal.kind === 'initiative') && <p>Контакт предложил следующий шаг</p>}
    {evidence.signals?.some(signal => signal.kind === 'resumption') && <p>Контакт вернулся к обсуждению</p>}
    {[...new Set(evidence.signals?.flatMap(signal => signal.kind === 'approval' ? [signal.requestedOn] : []))].map(date => {
      const days = (Date.parse(record.date) - Date.parse(date)) / 86_400_000;
      return Number.isFinite(days) && days >= 0
        ? <p key={date}>Согласование: {days} дн. <small>({period(date, record.date)})</small></p>
        : null;
    })}
  </details>;
}
