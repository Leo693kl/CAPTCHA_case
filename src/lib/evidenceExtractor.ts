import type { Person } from '../types';

export function extractEvidence(text: string, people: readonly Person[]) {
 const lower = text.toLocaleLowerCase('ru');
 const mentioned = people.filter(person => lower.includes(person.name.toLocaleLowerCase('ru')));
 const competitor = /(?:поставщик(?:ом|а|у)?|поставщика)\s*[«"“]([^»"”]+)[»"”]/iu.exec(text)?.[1] ?? '';
 return {
  mentionedIds: mentioned.filter(person => mentioned.filter(other => other.name.toLocaleLowerCase('ru') === person.name.toLocaleLowerCase('ru')).length === 1).map(person => person.id),
  ambiguousNames: [...new Set(mentioned.filter(person => mentioned.filter(other => other.name.toLocaleLowerCase('ru') === person.name.toLocaleLowerCase('ru')).length > 1).map(person => person.name))],
  format: /сравнен[а-яё]* на одной странице/iu.test(text) ? 'Сравнение на одной странице' : '',
  topic: /поддержк/iu.test(text) ? 'Поддержка' : '',
  competitor,
  reason: /долг[а-яё]* ответ[а-яё]* поддержки/iu.test(text) ? 'Долгие ответы поддержки' : '',
  outcome: /прежн|расстал/iu.test(text) ? 'previous' as const : 'unknown' as const,
 };
}

