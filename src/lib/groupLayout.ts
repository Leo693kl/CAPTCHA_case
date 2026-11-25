import { departments, type Interaction, type Person } from '../types.ts';

export type GroupGhost = { id: string; department: string };
export type GroupZone = {
  department: string; x: number; y: number; width: number; height: number; header: number;
  count: number; active: number; lowCoverage: boolean;
};
export type GroupPlan = {
  positions: Record<string, { x: number; y: number }>;
  zones: GroupZone[];
  halfWidth: number;
  halfHeight: number;
};

export const groupGeometry = {
  slotWidth: 216, slotHeight: 192, padding: 44, header: 212,
  minColumns: 3, zoneGap: 132, zoneColumns: 3,
} as const;

export function planGroups(people: readonly Person[], ghosts: readonly GroupGhost[], interactions: readonly Interaction[], asOf: string, period = ''): GroupPlan {
  const g = groupGeometry;
  const known = [...new Set([...departments, ...people.map(p => p.department), ...ghosts.map(p => p.department)])];
  const activeIds = new Set<string>();
  const end = Date.parse(`${asOf}T00:00:00Z`);
  for (const record of interactions) {
    const age = (end - Date.parse(`${record.date}T00:00:00Z`)) / 86400000;
    if (age < 0 || !Number.isFinite(age)) continue;
    if ((period === '90' && age > 90) || (period === '365' && age > 365) || (period === 'old' && age <= 365)) continue;
    activeIds.add(record.personId);
    for (const id of record.participantIds ?? []) activeIds.add(id);
  }

  const groups = known.map(department => {
    const persons = people.filter(p => p.department === department)
      .sort((a, b) => b.influence - a.influence || a.name.localeCompare(b.name, 'ru'));
    const entries = [...persons, ...ghosts.filter(p => p.department === department)];
    const columns = Math.max(g.minColumns, Math.ceil(Math.sqrt(entries.length)));
    const rows = Math.max(1, Math.ceil(entries.length / columns));
    const width = columns * g.slotWidth + 2 * g.padding;
    const header = g.header + Math.max(0, Math.ceil(department.length / 28) - 1) * 56;
    const count = persons.length;
    const active = persons.filter(p => activeIds.has(p.id)).length;
    return { department, entries, columns, width, header, height: rows * g.slotHeight + header + g.padding,
      count, active, lowCoverage: count === 0 || active / count < 0.5 };
  });

  const columnWidths = Array.from({ length: g.zoneColumns }, (_, col) =>
    Math.max(...groups.filter((_, i) => i % g.zoneColumns === col).map(zone => zone.width)));
  const rowCount = Math.ceil(groups.length / g.zoneColumns);
  const rowHeights = Array.from({ length: rowCount }, (_, row) =>
    Math.max(...groups.slice(row * g.zoneColumns, (row + 1) * g.zoneColumns).map(zone => zone.height)));
  const width = columnWidths.reduce((sum, w) => sum + w, 0) + g.zoneGap * (g.zoneColumns - 1);
  const height = rowHeights.reduce((sum, h) => sum + h, 0) + g.zoneGap * (rowCount - 1);

  const positions: GroupPlan['positions'] = {};
  const zones = groups.map(({ entries, columns, ...zone }, index) => {
    const col = index % g.zoneColumns;
    const row = Math.floor(index / g.zoneColumns);
    const x = -width / 2 + columnWidths.slice(0, col).reduce((sum, w) => sum + w, 0) + g.zoneGap * col;
    const y = -height / 2 + rowHeights.slice(0, row).reduce((sum, h) => sum + h, 0) + g.zoneGap * row;
    entries.forEach(({ id }, i) => {
      positions[id] = {
        x: x + g.padding + (i % columns + 0.5) * g.slotWidth,
        y: y + zone.header + (Math.floor(i / columns) + 0.5) * g.slotHeight,
      };
    });
    return { ...zone, x, y };
  });

  return { positions, zones, halfWidth: width / 2, halfHeight: height / 2 };
}
