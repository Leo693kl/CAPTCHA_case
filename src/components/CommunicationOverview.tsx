import { useState } from 'react';
import { communicationOverview } from '../lib/commOverview';
import type { MapSlice } from '../types';
import { Button } from './ui';
import '../styles/communication.css';

const dateLabel = (date: string) => date.split('-').reverse().join('.');
const shortMonths = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const fullMonth = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export function CommunicationOverview({ slice, onSelect }: { slice: MapSlice; onSelect: (id: string) => void }) {
  const [period, setPeriod] = useState<'all' | '90'>('all');
  const startDate = new Date(`${slice.asOf}T00:00:00Z`);
  startDate.setUTCDate(startDate.getUTCDate() - 89);
  const start = period === '90' ? startDate.toISOString().slice(0, 10) : undefined;
  const overview = communicationOverview(slice.people, slice.interactions, slice.companyId, { start, asOf: slice.asOf });
  const months = start ? overview.months.filter(item => item.month >= start.slice(0, 7)) : overview.months;
  const maximum = Math.max(1, ...months.map(item => item.count));

  return <section className="communication-overview" aria-label="Обзор коммуникаций">
    <div className="communication-heading">
      <div role="group" aria-label="Период коммуникаций">
        <Button variant={period === 'all' ? 'primary' : 'ghost'} aria-pressed={period === 'all'} onClick={() => setPeriod('all')}>Всё время</Button>
        <Button variant={period === '90' ? 'primary' : 'ghost'} aria-pressed={period === '90'} onClick={() => setPeriod('90')}>90 дней</Button>
      </div>
      <p className="communication-dates">{start
        ? <><time dateTime={start}>{dateLabel(start)}</time><span aria-hidden="true">—</span><time dateTime={slice.asOf}>{dateLabel(slice.asOf)}</time></>
        : <>По <time dateTime={slice.asOf}>{dateLabel(slice.asOf)}</time></>}
      </p>
    </div>

    <div className="communication-grid">
      <section>
        <h3>Каналы</h3>
        {overview.channels.length ? <ul className="communication-channels">
          {overview.channels.map(({ channel, count }) => <li key={channel}>
            <span>{channel}</span><strong>{count}</strong>
            <div className="communication-track" aria-hidden="true"><i style={{ width: `${count / overview.activityCount * 100}%` }}/></div>
          </li>)}
        </ul> : <p className="muted">За этот период касаний нет.</p>}
      </section>
      <section className="communication-trend">
        <h3>Динамика по месяцам</h3>
        <div className="communication-chart-scroll" tabIndex={0} role="group" aria-label="Диаграмма касаний по месяцам">
          <ol className="communication-months" style={{ gridTemplateColumns: `repeat(${months.length}, minmax(var(--chart-month-width), 1fr))` }}>
            {months.map(({ month, count }, index) => {
              const date = new Date(`${month}-01T00:00:00Z`);
              const year = month.slice(0, 4);
              return <li key={month} aria-label={`${fullMonth.format(date)}: ${count}`}>
                <div className="communication-month-plot" aria-hidden="true">
                  <div className="communication-month-bar" style={{ height: `${count / maximum * 100}%` }}><span>{count}</span></div>
                </div>
                <time dateTime={month} aria-hidden="true">{shortMonths[date.getUTCMonth()]}
                  {months[index - 1]?.month.slice(0, 4) !== year && <small>{year}</small>}
                </time>
              </li>;
            })}
          </ol>
        </div>
      </section>
      <section>
        <h3>Чаще всего общались</h3>
        {overview.top.length ? overview.top.map(({ person, count }) => <Button variant="ghost" className="communication-person" key={person.id} onClick={() => onSelect(person.id)}>
          <span>{person.name}</span><strong aria-label={`Касаний: ${count}`}>{count}</strong>
        </Button>) : <p className="muted">За этот период касаний нет.</p>}
      </section>
      <section>
        <h3>С кем не общались</h3>
        {overview.withoutActivity.length ? overview.withoutActivity.map(person => <Button variant="ghost" className="communication-person" key={person.id} onClick={() => onSelect(person.id)}>{person.name}</Button>)
          : <p className="muted">{overview.totalContacts ? 'Здесь никого нет.' : 'У компании пока нет контактов.'}</p>}
      </section>
    </div>
    <details className="communication-source">
      <summary>Как считаются касания</summary>
      <p>Источник — история взаимодействий. В списках людей учтены и основные контакты, и участники. График за всё время показывает последние 12 месяцев.</p>
    </details>
  </section>;
}
