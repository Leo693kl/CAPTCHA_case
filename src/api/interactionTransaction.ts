import { roles, type CRMData, type EvidenceChange, type InteractionDraft, type SaveResult } from '../types.ts';

export function calendarDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const score = (value: number) => Number.isInteger(value) && value >= 1 && value <= 5;
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.length ? value.map(canonical) : undefined;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]).filter(([, item]) => item !== undefined));
  return value;
}
export type InteractionTransaction = { result: SaveResult; data?: CRMData };

/** Pure preparation. The caller commits this whole object with one setItem. */
export function prepareInteraction(data: CRMData, companyId: string, draft: InteractionDraft, change: EvidenceChange | undefined, today: string): InteractionTransaction {
  const fail = (error: string): InteractionTransaction => ({ result: { ok: false, error } });
  if (!data.companies.some(company => company.id === companyId)) return fail('Клиент не найден.');
  if (!nonempty(draft.requestId)) return fail('Нет ключа сохранения. Повторите подтверждение.');
  const payload = JSON.stringify(canonical({ draft, change }));
  const previous = data.interactionRequests?.find(request => request.companyId === companyId && request.requestId === draft.requestId);
  if (previous) return previous.payload === payload
    ? { result: { ok: true, interactionId: previous.interactionId } }
    : fail('Содержимое запроса изменилось. Создайте новый ключ сохранения.');
  const people = new Map(data.people.filter(person => person.companyId === companyId).map(person => [person.id, person]));
  if (!people.has(draft.personId)) return fail('Выберите контакт текущего клиента.');
  if (!calendarDate(today) || !calendarDate(draft.date) || draft.date > today) return fail('Укажите существующую календарную дату не позже сегодня.');
  if (![draft.channel, draft.ourOwner, draft.ourDepartment, draft.summary, draft.sentiment].every(nonempty)) return fail('Заполните канал, автора, подразделение, содержание и тональность.');
  if (draft.opened !== undefined && (typeof draft.opened !== 'boolean' || draft.channel !== 'Почта' || !draft.openObservedOn)) return fail('Статус открытия требует письма и даты измерения.');
  if (draft.openObservedOn !== undefined && (typeof draft.opened !== 'boolean' || draft.channel !== 'Почта' || !calendarDate(draft.openObservedOn) || draft.openObservedOn < draft.date || draft.openObservedOn > today)) return fail('Проверьте дату измерения открытия письма.');
  if (draft.participantIds?.some(id => !people.has(id))) return fail('Участник встречи не принадлежит текущему клиенту.');
  const evidence = draft.evidence;
  if (change && !evidence) return fail('Для изменения роли или связи нужен источник наблюдения.');
  if (evidence) {
    if (!['interview', 'feedback'].includes(evidence.kind) || !nonempty(evidence.sourceLabel) || !nonempty(evidence.sourceExcerpt)) return fail('Укажите тип, название и исходный фрагмент источника.');
    if (evidence.mentionedPersonIds?.some(id => !people.has(id))) return fail('Упомянутый контакт не принадлежит текущему клиенту.');
    const competitor = evidence.competitor;
    if (competitor && (!nonempty(competitor.name) || !['current', 'previous', 'unknown'].includes(competitor.outcome))) return fail('Проверьте название и статус поставщика.');
    for (const signal of evidence.signals ?? []) {
      if (signal.kind === 'approval') {
        if (!calendarDate(signal.requestedOn) || signal.requestedOn > draft.date) return fail('Дата запроса согласования должна быть не позже события.');
      } else if (signal.kind === 'relation') {
        const relation = data.relations.find(item => item.id === signal.relationId && item.companyId === companyId);
        if (!relation || !people.has(relation.from) || !people.has(relation.to)) return fail('Связь источника не найдена у клиента.');
      } else if (!['initiative', 'resumption'].includes(signal.kind)) return fail('Неизвестный тип наблюдения.');
    }
  }
  if (change?.kind === 'role' && (!people.has(change.personId) || !Object.hasOwn(roles, change.role))) return fail('Проверьте контакт и новую роль.');
  if (change?.kind === 'relation-strength') {
    const relation = data.relations.find(item => item.id === change.relationId && item.companyId === companyId);
    if (!relation || !people.has(relation.from) || !people.has(relation.to) || !score(change.strength)) return fail('Выберите связь клиента и целую силу от 1 до 5.');
  } else if (change && change.kind !== 'role') return fail('Неизвестное изменение наблюдения.');
  const interactionId = crypto.randomUUID();
  // Explicit fields prevent untrusted input from replacing generated IDs or metadata.
  const interaction = { id: interactionId, personId: draft.personId, date: draft.date, channel: draft.channel, ourOwner: draft.ourOwner, ourDepartment: draft.ourDepartment, summary: draft.summary, ...(draft.participantIds ? {participantIds:[...new Set(draft.participantIds)]} : {}), sentiment: draft.sentiment, ...(draft.opened === undefined ? {} : { opened: draft.opened }), ...(draft.openObservedOn ? { openObservedOn: draft.openObservedOn } : {}), ...(evidence ? { evidence: { ...structuredClone(evidence), ...(evidence.mentionedPersonIds ? { mentionedPersonIds: [...new Set(evidence.mentionedPersonIds)] } : {}) } } : {}) };
  const updatedPeople = data.people.map(person => change?.kind === 'role' && person.id === change.personId ? { ...person, decisionRole: change.role } : person);
  const changedPerson = change?.kind === 'role' ? updatedPeople.find(person => person.id === change.personId) : undefined;
  const subjectType = change?.kind === 'role' ? 'person' as const : 'relation' as const;
  const subjectId = change?.kind === 'role' ? change.personId : change?.relationId;
  const field = change?.kind === 'role' ? 'role' as const : 'strength' as const;
  const before = change?.kind === 'role' ? people.get(change.personId)?.decisionRole : data.relations.find(r => r.id === subjectId)?.strength;
  const after = change?.kind === 'role' ? change.role : change?.strength;
  const changed = change && subjectId && before !== undefined && after !== undefined && before !== after;
  const ratingBases = changed ? [...(data.ratingBases ?? []).filter(b => !(b.subjectType === subjectType && b.subjectId === subjectId && b.field === field)), {id:crypto.randomUUID(),subjectType,subjectId,field,value:after,authorId:draft.ourOwner,date:today,rationale:'',sourceIds:[interactionId]}] : data.ratingBases;
  const ratingChanges = changed ? [...(data.ratingChanges ?? []), {id:crypto.randomUUID(),subjectType,subjectId,field,before,after,authorId:draft.ourOwner,date:today}] : data.ratingChanges;
  const next: CRMData = {
    ...data,
    ...(ratingBases ? {ratingBases} : {}),
    ...(ratingChanges ? {ratingChanges} : {}),
    ...(change?.kind === 'role' && change.role === 'decision_maker' ? {candidateResolutions:[...(data.candidateResolutions??[]).filter(x=>x.personId!==change.personId),{personId:change.personId,status:'confirmed' as const}]} : {}),
    people: updatedPeople,
    relations: data.relations.map(relation => change?.kind === 'relation-strength' && relation.id === change.relationId ? { ...relation, strength: change.strength } : relation),
    interactions: [...data.interactions, interaction],
    snapshots: changedPerson ? [...data.snapshots, { personId: changedPerson.id, date: today, person: structuredClone(changedPerson) }] : data.snapshots,
    interactionRequests: [...(data.interactionRequests ?? []), { companyId, requestId: draft.requestId, interactionId, payload }],
  };
  return { result: { ok: true, interactionId }, data: next };
}
