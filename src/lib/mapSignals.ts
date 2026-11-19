import type { MapSlice } from '../types.ts';
import { inPeriod, latestFirst, shiftDay, sliceInteractions } from './mapMetrics.ts';

export function mapSignals(slice: MapSlice) {
  const history = sliceInteractions(slice).sort(latestFirst);
  const people = slice.people.filter(person => person.companyId === slice.companyId);
  const recentStart = shiftDay(slice.asOf, -29);
  const warmStart = shiftDay(slice.asOf, -90);
  const staleStart = shiftDay(slice.asOf, -365);
  const contacts = people.map(person => {
    const records = history.filter(record => record.personId === person.id);
    const recent = records.filter(record => inPeriod(record.date, recentStart, slice.asOf) &&
      record.ourDepartment.trim());
    const departments = [...new Set(recent.map(record => record.ourDepartment.trim()))].sort();
    return { person, last: records[0], recent, departments };
  });
  const makers = contacts.filter(({ person }) => person.decisionRole === 'decision_maker');
  const warm = makers.filter(({ person, last }) => person.warmth >= 4 && last && last.date >= warmStart);
  const groups = new Map<string, typeof people>();
  const normalize = (value: string) => value.trim().replace(/\s+/gu, ' ').toLocaleLowerCase('ru').replace(/ё/gu, 'е');
  for (const person of people) {
    const name = normalize(person.name);
    const department = normalize(person.department);
    if (!name || !department) continue;
    const key = JSON.stringify([name, department]);
    const group = groups.get(key) ?? [];
    group.push(person);
    groups.set(key, group);
  }

  return {
    makers: makers.length,
    warm,
    stale: contacts.filter(({ last }) => !last || last.date < staleStart),
    conflicts: contacts.filter(({ departments }) => departments.length >= 2),
    duplicates: [...groups.values()].filter(group => group.length >= 2),
  };
}
