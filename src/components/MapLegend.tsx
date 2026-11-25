import { CircleHelp, Route, Star } from 'lucide-react';
import { lensOptions, type Lens } from '../lib/lenses';
import { type MapSlice, type Relation } from '../types';
import '../styles/map-evidence.css';

export function MapLegend({ lens }: { lens?: Lens }) {
  return <details open className="map-legend map-legend-c" data-tour="legend">
    <summary>Легенда карты</summary>
    <div><ul className="map-legend-items">
      <li><i className="legend-size" aria-hidden="true"/>Размер — влияние 1–5</li>
      <li><i className="legend-heat" aria-hidden="true"/>Заливка — теплота 1–5</li>
      <li><i className="legend-stance" aria-hidden="true"/>Обводка — позиция</li>
      <li><i className="map-legend-edge is-strong" aria-hidden="true"/>Толщина — сила связи</li>
      <li><i className="map-legend-edge is-informal" aria-hidden="true"/>Пунктир — неформальная связь</li>
      <li><i className="legend-selected" aria-hidden="true"/>Контур и имя — выбор</li>
    </ul>{lens && <details className="legend-more">
      <summary>Кольца от центра</summary>
      <ol>{lensOptions[lens].rings.map(ring => <li key={ring}>{ring === 'ЛПР' ? ring : ring.toLocaleLowerCase('ru-RU')}</li>)}</ol>
    </details>}<details className="legend-more"><summary>Другие обозначения</summary>
      <ul className="map-legend-items">
        <li><Star size={16} strokeWidth={1.75} aria-hidden="true"/>Звезда — ЛПР</li>
        <li><i className="legend-candidate" aria-hidden="true"/>Пунктир вокруг узла — кандидат в ЛПР</li>
        <li><CircleHelp size={16} strokeWidth={1.75} aria-hidden="true"/>Вопрос — отсутствующая роль</li>
        <li><b className="legend-conflict" aria-hidden="true">!</b>Пересечение команд</li>
        <li><i className="map-legend-edge" aria-hidden="true"/>Сплошная — подчинение или рабочая связь</li>
        <li><i className="map-legend-edge is-highlight" aria-hidden="true"/>Зелёный пунктир — маршрут</li>
        {!lens && <li><i className="legend-low-coverage" aria-hidden="true"/>Сиреневая зона — охват ниже половины</li>}
        <li><Route size={16} strokeWidth={1.75} aria-hidden="true"/>Поставщик — из наблюдения</li>
      </ul>
    </details></div>
  </details>;
}

export function MapSelectionLabel({ slice, relation }: { slice: MapSlice; relation?: Relation }) {
  if (relation) {
    const from = slice.people.find(person => person.id === relation.from);
    const to = slice.people.find(person => person.id === relation.to);
    if (!from || !to) return null;
    return <p className="map-selection-label">{from.name} ↔ {to.name}</p>;
  }
  const person = slice.people.find(item => item.id === slice.selectedPersonId);
  return person ? <p className="map-selection-label">{person.name}</p> : null;
}
