import { CircleHelp, Route, Star } from 'lucide-react';
import { lensOptions, type Lens } from '../lib/lenses';
import { relationTypes, roles, type MapSlice, type Relation } from '../types';
import '../styles/map-evidence.css';

export function MapLegend({ lens }: { lens: Lens }) {
  const { label, rings } = lensOptions[lens];

  return <details open className="map-legend map-legend-c" data-tour="legend">
    <summary>Легенда карты</summary>
    <div><ul className="map-legend-items">
      <li><i className="legend-size" aria-hidden="true"/>Размер — влияние 1–5</li>
      <li><i className="legend-heat" aria-hidden="true"/>Заливка — теплота 1–5</li>
      <li><i className="legend-stance" aria-hidden="true"/>Обводка — позиция</li>
      <li><i className="map-legend-edge is-strong" aria-hidden="true"/>Толщина — сила связи</li>
      <li><i className="map-legend-edge is-informal" aria-hidden="true"/>Пунктир — неформальная</li>
      <li><i className="map-legend-edge is-active" aria-hidden="true"/>Красный контур и подпись — выбор</li>
    </ul><details className="legend-more"><summary>Линзы и другие обозначения</summary>
      <p><strong>{label} · кольца от центра</strong><br/>{rings.join(' → ')}</p>
      <ul className="map-legend-items"><li><Star size={16} strokeWidth={1.75} aria-hidden="true"/>Звезда — ЛПР</li><li><CircleHelp size={16} strokeWidth={1.75} aria-hidden="true"/>Вопрос — роль предстоит найти</li><li><b className="legend-conflict" aria-hidden="true">!</b>Пересечение команд</li><li><i className="map-legend-edge is-highlight" aria-hidden="true"/>Зелёный пунктир — маршрут</li><li><Route size={16} strokeWidth={1.75} aria-hidden="true"/>Линия поставщика — наблюдение</li></ul>
      <p>Сплошная линия — подчинение или рабочая связь. Щёлкните по ребру для деталей. Стрелок между людьми нет.</p>
    </details></div>
  </details>;
}

export function MapSelectionLabel({ slice, relation }: { slice: MapSlice; relation?: Relation }) {
  if (relation) {
    const from = slice.people.find(person => person.id === relation.from);
    const to = slice.people.find(person => person.id === relation.to);
    if (!from || !to) return null;
    return <p className="map-selection-label">{from.name} — {to.name} · {relationTypes[relation.type]} · {relation.strength} / 5</p>;
  }
  const person = slice.people.find(item => item.id === slice.selectedPersonId);
  return person ? <p className="map-selection-label">{person.name} · {roles[person.decisionRole]}</p> : null;
}
