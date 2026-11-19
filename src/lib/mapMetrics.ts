import type { Interaction, MapSlice, PersonSnapshot, Relation } from '../types.ts';

const DAY_MS = 86_400_000;
export const METRIC_DAYS = 30;

export function shiftDay(date: string, days: number): string {
  return new Date(Date.parse(date) + days * DAY_MS).toISOString().slice(0, 10);
}

export function inPeriod(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

export function sliceInteractions(slice: MapSlice): Interaction[] {
  const ids = new Set(slice.people.filter(person => person.companyId === slice.companyId).map(person => person.id));
  return slice.interactions.filter(record => ids.has(record.personId) && record.date <= slice.asOf);
}

export function latestFirst(a: Interaction, b: Interaction): number {
  return b.date.localeCompare(a.date) || a.id.localeCompare(b.id);
}

export function mapMetrics(slice: MapSlice, personId?: string) {
  const start = shiftDay(slice.asOf, 1 - METRIC_DAYS);
  const previousStart = shiftDay(start, -METRIC_DAYS);
  const previousEnd = shiftDay(start, -1);
  const history = sliceInteractions(slice);
  const scoped = personId === undefined ? history : history.filter(record => record.personId === personId);
  const current = scoped.filter(record => record.date >= start);
  const previous = scoped.filter(record => inPeriod(record.date, previousStart, previousEnd));
  const measured = current.filter(record =>
    record.channel.trim().toLocaleLowerCase('ru') === 'почта' &&
    typeof record.opened === 'boolean' &&
    record.openObservedOn !== undefined && inPeriod(record.openObservedOn, record.date, slice.asOf));
  const opened = measured.filter(record => record.opened);
  // Mentions can come from any contact at the company.
  const observations = history.filter(record => record.date >= start && record.evidence);
  const mentions = personId === undefined ? [] : observations.filter(record =>
    record.evidence?.mentionedPersonIds?.includes(personId));
  const channels = [...new Set([...current, ...previous].map(record => record.channel))]
    .sort((a, b) => a.localeCompare(b, 'ru'));

  return {
    start, end: slice.asOf, previousStart, previousEnd,
    openRate: {
      opened: opened.length,
      measured: measured.length,
      percent: measured.length ? Math.round(100 * opened.length / measured.length) : null,
    },
    observations, mentions,
    intensity: {
      current: current.length,
      previous: previous.length,
      channels: channels.map(channel => ({
        channel,
        current: current.filter(record => record.channel === channel).length,
        previous: previous.filter(record => record.channel === channel).length,
      })),
    },
  };
}

export function warmthHistory(slice: MapSlice, personId: string): PersonSnapshot[] {
  const snapshots = new Map<string, PersonSnapshot>();
  for (const snapshot of slice.snapshots) {
    if (snapshot.personId === personId && snapshot.person.companyId === slice.companyId &&
        snapshot.date <= slice.asOf) snapshots.set(snapshot.date, snapshot);
  }
  return [...snapshots.values()].filter(snapshot => !snapshot.deleted)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function supplierEvidence(slice: MapSlice) {
  return sliceInteractions(slice).sort(latestFirst).flatMap(record => {
    const supplier = record.evidence?.competitor;
    return supplier ? [{ record, supplier }] : [];
  });
}

export function relationEvidence(slice: MapSlice, relation: Relation) {
  const ids = new Set(slice.relations.filter(candidate => candidate.companyId === slice.companyId &&
    ((candidate.from === relation.from && candidate.to === relation.to) ||
     (candidate.to === relation.from && candidate.from === relation.to))).map(candidate => candidate.id));
  const records = relation.companyId === slice.companyId
    ? sliceInteractions(slice).filter(record => record.evidence?.signals?.some(signal =>
      signal.kind === 'relation' && ids.has(signal.relationId))).sort(latestFirst)
    : [];
  const unique = [...new Map(records.map(record => [record.id, record])).values()];
  return { records: unique, strength: unique.length >= 2 ? Math.min(5, unique.length + 1) : null };
}
