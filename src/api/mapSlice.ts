import type { CRMData, MapSlice } from '../types.ts';
import { peopleAtDate } from '../lib/history.ts';

/** Company/date boundary shared by graph, evidence and brief. Filters are visual. */
export function buildMapSlice(data: CRMData, companyId: string, asOf: string, today: string, selectedPersonId: string | null): MapSlice {
  const snapshots = data.snapshots.filter(snapshot => snapshot.person.companyId === companyId && snapshot.date <= asOf);
  const historical = asOf < today;
  const people = historical ? peopleAtDate(snapshots, companyId, asOf) : data.people.filter(person => person.companyId === companyId);
  const ids = new Set(people.map(person => person.id));
  const companyIds = new Set([...data.people.filter(person => person.companyId === companyId).map(person => person.id), ...snapshots.map(snapshot => snapshot.personId)]);
  return {
    companyId, asOf, historical, selectedPersonId: selectedPersonId && ids.has(selectedPersonId) ? selectedPersonId : null,
    people, snapshots,
    relations: data.relations.filter(relation => relation.companyId === companyId && ids.has(relation.from) && ids.has(relation.to)),
    interactions: data.interactions.filter(interaction => companyIds.has(interaction.personId) && interaction.date <= asOf).map(interaction => {
      if (!interaction.openObservedOn || interaction.openObservedOn > asOf) {
        const { opened: _opened, openObservedOn: _observed, ...visible } = interaction;
        return visible;
      }
      return interaction;
    }),
  };
}
