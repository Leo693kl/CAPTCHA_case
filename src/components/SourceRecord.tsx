import { useEffect, useRef } from 'react';
import type { Interaction, MapSlice } from '../types';
import { Button } from './ui';

export function SourceRecord({ interaction, slice, onBack }: { interaction: Interaction; slice: MapSlice; onBack: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); heading.current?.scrollIntoView({ block: 'nearest' }); }, [interaction.id]);
  const evidence = interaction.evidence;
  return <section className="panel-section" aria-label="Источник наблюдения">
    <h2 ref={heading} tabIndex={-1}>Источник наблюдения</h2><Button onClick={onBack}>Вернуться к месту открытия</Button>
    <p><time>{interaction.date.split('-').reverse().join('.')}</time> · {interaction.ourOwner} · {interaction.ourDepartment}</p><p>{interaction.summary}</p>
    {evidence && <><h3>{evidence.sourceLabel}</h3><blockquote className="proposal-source">{evidence.sourceExcerpt}</blockquote>
      {!!evidence.mentionedPersonIds?.length && <p>Упомянуты: {evidence.mentionedPersonIds.map(id => slice.people.find(person => person.id === id)?.name ?? 'Контакт недоступен в этом срезе').join(', ')}</p>}
      {evidence.preferences && <p>Предпочтения собеседника: {[evidence.preferences.channel, evidence.preferences.format, ...(evidence.preferences.topics ?? [])].filter(Boolean).join('; ') || 'не указаны'}</p>}
      {evidence.competitor && <p>Поставщик: {evidence.competitor.name} ({evidence.competitor.outcome === 'previous' ? 'прежний' : evidence.competitor.outcome === 'current' ? 'текущий' : 'статус неизвестен'}). Со слов контакта: {evidence.competitor.reason || 'Причина не указана'}</p>}</>}
  </section>;
}
