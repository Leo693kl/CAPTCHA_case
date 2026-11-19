import { CircleHelp, Route, Star } from 'lucide-react';
import { lensOptions, type Lens } from '../lib/lenses';
import { relationTypes, roles, type MapSlice, type Relation } from '../types';
import '../styles/map-evidence.css';

export function MapLegend({ lens }: { lens: Lens }) {
  const { label, rings } = lensOptions[lens];

  return <details className="map-legend map-legend-c" data-tour="legend">
    <summary>Легенда карты</summary>
    <div>
      <p><strong>{label} · кольца от центра</strong><br/>{rings.join(' → ')}</p>
      <ul className="map-legend-items">
        <li><i className="legend-size" aria-hidden="true"/>Размер · влияние от 1 до 5</li>
        <li><i className="legend-heat" aria-hidden="true"/>Заливка · теплота от 1 до 5</li>
        <li><i className="legend-stance" aria-hidden="true"/>Обводка · позиция контакта</li>
        <li><Star size={16} strokeWidth={1.75} aria-hidden="true"/>Звезда · ЛПР</li>
        <li><CircleHelp size={16} strokeWidth={1.75} aria-hidden="true"/>Вопрос · роль предстоит найти</li>
        <li><b className="legend-conflict" aria-hidden="true">!</b>Восклицательный знак · пересечение команд</li>
        <li><i className="map-legend-edge" aria-hidden="true"/>Сплошная · подчинение или рабочая связь</li>
        <li><i className="map-legend-edge is-informal" aria-hidden="true"/>Пунктир · неформальная связь</li>
        <li><i className="map-legend-edge is-strong" aria-hidden="true"/>Толщина · сила связи от 1 до 5</li>
        <li><i className="map-legend-edge is-highlight" aria-hidden="true"/>Зелёный пунктир · маршрут знакомства</li>
        <li><i className="map-legend-edge is-active" aria-hidden="true"/>Голубая линия · выбранная связь или фокус</li>
        <li><Route size={16} strokeWidth={1.75} aria-hidden="true"/>Линия рядом с графом · наблюдение о поставщике</li>
      </ul>
      <p>Щёлкните по ребру, чтобы узнать тип связи. Линии людей показаны без стрелок.</p>
    </div>
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
