import { useState } from 'react';
import { ArrowDown, Copy } from 'lucide-react';
import { Button, Card, Select } from './ui';
import type { Person } from '../types';
import type { WarmPath } from '../lib/warmPath';

export function PathControls({ people, target, onTarget, path, onShowMap }: {
  people: Person[];
  target: string;
  onTarget: (value: string) => void;
  path: WarmPath | null;
  onShowMap: () => void;
}) {
  const [copied, setCopied] = useState('');
  const contacts = new Map(people.map(person => [person.id, person]));
  const start = path ? contacts.get(path.start) : undefined;

  const copyPlan = async () => {
    if (!path || !start) return;
    const steps = path.steps.map(step =>
      `${contacts.get(step.from)?.name} → ${contacts.get(step.to)?.name}: сила связи ${step.relation.strength}/5, стоимость ${step.cost}${step.penalty ? `, штраф за холодный контакт ${step.penalty}` : ''}.`
    );
    try {
      await navigator.clipboard.writeText([`Начните с ${start.name} — владелец: ${start.owner}.`, ...steps].join('\n'));
      setCopied('План скопирован');
    } catch {
      setCopied('Не удалось скопировать план');
    }
  };

  const changeTarget = (id: string) => {
    setCopied('');
    onTarget(id);
  };

  return <div className="path-controls advanced-path">
    <div className="path-header">
      <label htmlFor="path-target">К кому хотите выйти</label>
      <Select id="path-target" disabled={people.length === 0} value={target} onChange={event => changeTarget(event.target.value)}>
        <option value="">Выберите цель</option>
        {people.map(person => <option key={person.id} value={person.id}>{person.name} · {person.department}</option>)}
      </Select>
      {target && <Button variant="ghost" onClick={() => changeTarget('')}>Очистить</Button>}
    </div>

    {path && start ? <Card className="path-result">
      <div className="path-card-title">{path.steps.length ? 'План знакомства' : 'Уже есть тёплый контакт'}</div>
      <p>Начните с {start.name}. Владелец контакта — {start.owner}.</p>
      {path.steps.length > 0 && <p>Общая стоимость маршрута — {path.cost}.</p>}
      {[path.start, ...path.steps.map(step => step.to)].map((id, index) => {
        const person = contacts.get(id);
        const step = path.steps[index - 1];
        return <div className="path-person" key={id}>
          {step && <ArrowDown size={16} strokeWidth={1.75} aria-hidden="true"/>}
          <div>
            <span className="mini-avatar" aria-hidden="true">{person?.name.split(' ').map(word => word[0]).slice(0, 2).join('')}</span>
            <span><b>{person?.name ?? id}</b><small>
              {step ? `Сила связи ${step.relation.strength}/5${step.penalty ? ` · штраф ${step.penalty}` : ''}` : 'Тёплый контакт · точка входа'}
            </small></span>
          </div>
        </div>;
      })}
      <div className="path-actions">
        <Button variant="primary" onClick={onShowMap}>Показать маршрут на карте</Button>
        <Button onClick={() => void copyPlan()}><Copy size={16} strokeWidth={1.75} aria-hidden="true"/> Копировать план</Button>
      </div>
      {copied && <span role="status" className="copy-status">{copied}</span>}
    </Card> : target && <p className="path-empty">Маршрут не найден. Нужен связанный тёплый контакт с назначенным владельцем.</p>}

    <details className="path-rules">
      <summary>Как строится маршрут</summary>
      <p className="path-note">Старт — контакт с теплотой 4–5 и назначенным владельцем. Стоимость шага равна 6 минус сила связи. Если теплота одного из участников ниже 4, добавляется штраф: 4 минус минимальная теплота. Связи рассматриваются в обе стороны.</p>
    </details>
  </div>;
}
