import { Button } from './ui';
import type { Interaction, RatingBasis, RatingChange, RatingField } from '../types';
import { roles, stances, relationTypes } from '../types';

const labels:Record<RatingField,string>={influence:'Влияние',stance:'Позиция',warmth:'Теплота',role:'Роль в решении',strength:'Сила',type:'Тип'};
const display=(field:RatingField,value:string|number)=> field==='role' ? roles[value as keyof typeof roles] ?? value : field==='stance' ? stances[value as keyof typeof stances] ?? value : field==='type' ? relationTypes[value as keyof typeof relationTypes] ?? value : value;
const dateLabel = (date: string) => date.split('-').reverse().join('.');

export function RatingEvidence({ subjectId, subjectType, fields, bases, changes, records, onOpenSource }:{
  subjectId: string; subjectType: 'person' | 'relation'; fields: Partial<Record<RatingField, string | number>>;
  bases: RatingBasis[]; changes: RatingChange[]; records: readonly Interaction[]; onOpenSource: (id: string) => void;
}) {
  const ratings = (Object.entries(fields) as [RatingField, string | number][]).map(([field, value]) => ({
    field, value,
    basis: bases.find(item => item.subjectId === subjectId && item.subjectType === subjectType && item.field === field && item.value === value),
    history: changes.filter(item => item.subjectId === subjectId && item.subjectType === subjectType && item.field === field),
  }));
  const missing = ratings.filter(({ basis }) => !basis).length;

  return <details className="panel-disclosure rating-evidence">
    <summary>Основания оценок{missing > 0 && <small> · без основания {missing} из {ratings.length}</small>}</summary>
    {ratings.map(({ field, value, basis, history }) => <details key={field}>
      <summary aria-label={`Основание: ${labels[field]}`}>
        {labels[field]} · {display(field, value)}
      </summary>
      {basis ? <>
        <p>{basis.authorId} · {dateLabel(basis.date)}</p>
        <p>{basis.rationale || 'Причина не указана'}</p>
        {basis.sourceIds.map(id => {
          const record = records.find(item => item.id === id);
          return record
            ? <Button variant="ghost" className="source-action" key={id} onClick={() => onOpenSource(id)}>
                {dateLabel(record.date)} · {record.channel} · {record.summary.split('\n')[0]}
              </Button>
            : <p key={id} className="muted">Источник недоступен</p>;
        })}
      </> : <p className="muted">Основание не указано.</p>}
      {history.length > 0 && <>
        <h4>История изменений</h4>
        {history.map(item => <p key={item.id}>
          {display(field, item.before)} → {display(field, item.after)} · {item.authorId} · {dateLabel(item.date)}
        </p>)}
      </>}
    </details>)}
  </details>;
}
