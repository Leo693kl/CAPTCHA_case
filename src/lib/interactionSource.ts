import type { MapSlice, Person } from '../types.ts';

/** A source may outlive its contact. Snapshots supply identity, never graph nodes. */
export function sourcePerson(slice: MapSlice, personId: string): Person | undefined {
  const active = slice.people.find(person => person.id === personId && person.companyId === slice.companyId);
  if (active) return active;
  return slice.snapshots
    .filter(snapshot => snapshot.personId === personId && snapshot.person.companyId === slice.companyId && snapshot.date <= slice.asOf)
    .reduce<(typeof slice.snapshots)[number] | undefined>((latest, snapshot) =>
      !latest || latest.date <= snapshot.date ? snapshot : latest, undefined)?.person;
}

export function interactionSource(slice: MapSlice, interactionId: string) {
  // buildMapSlice already establishes company membership, including deleted authors.
  // Missing identity in this date's snapshots must not hide a known source.
  return slice.interactions.find(record => record.id === interactionId && record.date <= slice.asOf);
}
