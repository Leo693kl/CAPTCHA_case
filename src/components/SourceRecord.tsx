import { useEffect, useRef } from 'react';
import type { Interaction, MapSlice } from '../types';
import { Button } from './ui';
import { ObservationDetails } from './MapEvidence';
import { sourcePerson } from '../lib/interactionSource';

export function SourceRecord({ interaction, slice, onBack }: { interaction: Interaction; slice: MapSlice; onBack: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); heading.current?.scrollIntoView({ block: 'nearest' }); }, [interaction.id]);
  const evidence = interaction.evidence;
  const speaker = sourcePerson(slice, interaction.personId);
  return <section className="panel-section" aria-label="Источник наблюдения">
    <h2 ref={heading} tabIndex={-1}>Источник наблюдения</h2><Button onClick={onBack}>Вернуться к месту открытия</Button>
    <p>Собеседник: {speaker?.name ?? 'Имя недоступно'}{speaker && !slice.people.some(person => person.id === interaction.personId) && ' · контакт удалён из активной карты'}</p>
    <p><time>{interaction.date.split('-').reverse().join('.')}</time> · {interaction.ourOwner} · {interaction.ourDepartment}</p><p>Канал касания · {interaction.channel}</p><p>{interaction.summary}</p>
    {evidence && <><ObservationDetails record={interaction} initiallyOpen/>
      {!!evidence.mentionedPersonIds?.length && <p>Упомянуты: {evidence.mentionedPersonIds.map(id => sourcePerson(slice, id)?.name ?? 'Контакт недоступен в этом срезе').join(', ')}</p>}
      </>}
  </section>;
}
