import test from 'node:test';
import assert from 'node:assert/strict';
import seed from '../src/data/crm.json' with { type: 'json' };
import demo from '../docs/plans/demo-interview.json' with { type: 'json' };
import { prepareInteraction } from '../src/api/interactionTransaction.ts';
import { buildMapSlice } from '../src/api/mapSlice.ts';
import { crmApi } from '../src/api/crmApi.ts';
import { crmDiff } from '../src/lib/crmDiff.ts';

const today = '2026-11-19';
const fresh = () => structuredClone(seed);
const draft = () => structuredClone(demo);
const transact = (data, input = draft(), change) => prepareInteraction(data, 'bank', input, change, today);
function memoryStorage() {
  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  return storage;
}

test('interview and confirmed role are immutable and atomic, snapshot is dated by confirmation', () => {
  const data = fresh(); const original = structuredClone(data);
  const { data: next, result } = transact(data, draft(), { kind: 'role', personId: 'bank-p0', role: 'influencer' });
  assert.equal(result.ok, true); assert.deepEqual(data, original);
  assert.equal(next.interactions.length, data.interactions.length + 1);
  assert.equal(next.people.find(p => p.id === 'bank-p0').decisionRole, 'influencer');
  assert.equal(next.snapshots.at(-1).date, today);
  const again = transact(next, draft(), { kind: 'role', personId: 'bank-p0', role: 'influencer' });
  assert.deepEqual(again.result, result); assert.equal(again.data, undefined);
});

test('a new draft saves separately; changing a successful request requires a new key', () => {
  const first = transact(fresh());
  assert.equal(transact(first.data, { ...draft(), summary: 'Другой текст' }).result.ok, false);
  const second = transact(first.data, { ...draft(), requestId: 'second' });
  assert.equal(second.data.interactions.length, first.data.interactions.length + 1);
});

test('optional empty arrays and property ordering do not turn retry into a different request', () => {
  const input = draft(); input.evidence.signals = [];
  const first = transact(fresh(), input);
  assert.deepEqual(transact(first.data, draft()).result, first.result);
});

for (const [name, patch] of [
  ['unknown person', { personId: 'missing' }], ['other company', { personId: 'retail-p0' }],
  ['impossible calendar date', { date: '2026-02-30' }], ['future', { date: '2026-11-20' }],
  ['empty author', { ourOwner: ' ' }], ['empty content', { summary: '' }], ['empty request', { requestId: '' }],
  ['cross-company mention', { evidence: { ...demo.evidence, mentionedPersonIds: ['retail-p0'] } }],
  ['empty source', { evidence: { ...demo.evidence, sourceExcerpt: ' ' } }],
  ['approval before request', { evidence: { ...demo.evidence, signals: [{ kind: 'approval', requestedOn: '2026-11-20' }] } }],
  ['opening observed before email', { channel: 'Почта', opened: true, openObservedOn: '2026-11-18' }],
]) test(`rejects ${name} before changing anything`, () => {
  const data = fresh(); const copy = structuredClone(data);
  const result = transact(data, { ...draft(), ...patch }, { kind: 'role', personId: 'bank-p0', role: 'influencer' });
  assert.equal(result.result.ok, false); assert.equal(result.data, undefined); assert.deepEqual(data, copy);
});

test('relation confirmation rejects outside company, fractions and unknown roles', () => {
  const data = fresh(); const relation = data.relations.find(r => r.companyId === 'bank');
  for (const change of [{ kind: 'relation-strength', relationId: relation.id, strength: 2.5 }, { kind: 'relation-strength', relationId: data.relations.find(r => r.companyId === 'retail').id, strength: 4 }, { kind: 'role', personId: 'bank-p0', role: 'unknown' }]) assert.equal(transact(data, draft(), change).result.ok, false);
  const next = transact(data, draft(), { kind: 'relation-strength', relationId: relation.id, strength: 4 });
  assert.equal(next.data.relations.find(r => r.id === relation.id).strength, 4);
  assert.equal(crmDiff(data, next.data, 'bank').length, 2);
});

test('refused storage publishes neither source nor role, retry succeeds', async () => {
  const storage = memoryStorage(); const data = fresh(); let current = data;
  const commit = next => { current = next; };
  localStorage.setItem = () => { throw new Error('quota'); };
  const result = await crmApi.saveInteraction(current, 'bank', draft(), { kind: 'role', personId: 'bank-p0', role: 'influencer' }, today, commit);
  assert.equal(result.ok, false); assert.equal(current, data); assert.equal(storage.size, 0);
  localStorage.setItem = (key, value) => storage.set(key, value);
  assert.equal((await crmApi.saveInteraction(current, 'bank', draft(), undefined, today, commit)).ok, true);
});

test('rapid repeat, two distinct writes, reload and local CRM confirmation retain identity', async () => {
  memoryStorage(); let current = fresh(); const commit = next => { current = next; };
  const save = input => crmApi.saveInteraction(current, 'bank', input, undefined, today, commit);
  const results = await Promise.all([save(draft()), save(draft()), save({ ...draft(), requestId: 'second' })]);
  assert.deepEqual(results[0], results[1]); assert.equal(current.interactions.length, seed.interactions.length + 2);
  assert.deepEqual(await crmApi.load(), current);
  await crmApi.confirmCompany(current, 'bank');
  const reset = await crmApi.reset(); assert.deepEqual(transact(reset).result, results[0]);
  assert.deepEqual(reset.people.filter(p => p.companyId === 'retail'), seed.people.filter(p => p.companyId === 'retail'));
});

test('old localStorage still loads without evidence or receipt metadata', async () => {
  memoryStorage(); const old = fresh(); delete old.snapshots;
  localStorage.setItem('decision-radar-v1', JSON.stringify(old));
  const loaded = await crmApi.load(); assert.equal(loaded.people.length, old.people.length); assert.ok(loaded.snapshots.length);
  assert.equal(loaded.interactionRequests, undefined);
});

test('request keys are scoped by company; absent and impossible companies are rejected', () => {
  const first = transact(fresh());
  const retail = { ...draft(), personId: 'retail-p0', evidence: { ...draft().evidence, mentionedPersonIds: [] } };
  const second = prepareInteraction(first.data, 'retail', retail, undefined, today);
  assert.equal(second.result.ok, true); assert.notEqual(first.result.interactionId, second.result.interactionId);
  assert.equal(prepareInteraction(fresh(), 'missing', draft(), undefined, today).result.ok, false);
});

test('blocked reads fall back to the seed while blocked writes still report an error', async () => {
  memoryStorage(); localStorage.getItem = () => { throw new Error('denied'); };
  assert.deepEqual(await crmApi.load(), seed);
});

test('source of a newly added then deleted person survives CRM preview and confirmation', async () => {
  memoryStorage(); const data = fresh(); const person = { ...data.people[0], id: 'temporary-person', name: 'Новый синтетический контакт' };
  data.people.push(person); data.snapshots.push({ personId: person.id, person, date: today });
  const transaction = transact(data, { ...draft(), personId: person.id });
  const deleted = { ...transaction.data, people: transaction.data.people.filter(p => p.id !== person.id), snapshots: [...transaction.data.snapshots, { personId: person.id, person, date: today, deleted: true }] };
  const preview = crmDiff(fresh(), deleted, 'bank');
  assert.equal(preview.length, 1); assert.ok(preview[0].name.includes(person.name));
  const confirmed = await crmApi.confirmCompany(deleted, 'bank');
  assert.ok(confirmed.interactions.some(i => i.id === transaction.result.interactionId));
  assert.equal(transact(await crmApi.reset(), { ...draft(), personId: person.id }).result.interactionId, transaction.result.interactionId);
});

test('slice hides foreign events, future observations and future measured status', () => {
  const data = transact(fresh()).data;
  const slice = buildMapSlice(data, 'bank', '2026-10-31', today, 'retail-p0');
  assert.equal(slice.selectedPersonId, null); assert.equal(slice.historical, true);
  assert.ok(slice.interactions.every(i => i.personId.startsWith('bank-') && i.date <= '2026-10-31'));
  assert.equal(slice.interactions.find(i => i.id === 'bank-demo-mail-2').opened, undefined);
  assert.ok(!slice.interactions.some(i => i.id === data.interactions.at(-1).id));
  assert.ok(slice.snapshots.every(snapshot => snapshot.date <= slice.asOf));
});

test('demo data has expected 2/3 openings, 1/2 → 2/3 mentions and one → two recent warm decision makers', () => {
  const data = fresh(); const initial = buildMapSlice(data, 'bank', today, today, null);
  const period = list => list.filter(i => i.date >= '2026-10-21');
  const letters = period(initial.interactions).filter(i => i.personId === 'bank-p0' && i.channel === 'Почта' && typeof i.opened === 'boolean');
  assert.equal(letters.length, 3); assert.equal(letters.filter(i => i.opened).length, 2);
  const mentions = slice => { const evidence = period(slice.interactions).filter(i => i.evidence); return [evidence.filter(i => i.evidence.mentionedPersonIds?.includes('bank-p0')).length, evidence.length]; };
  const warm = slice => slice.people.filter(p => p.decisionRole === 'decision_maker' && p.warmth >= 4 && slice.interactions.some(i => i.personId === p.id && (Date.parse(today) - Date.parse(i.date)) / 86400000 <= 90));
  assert.deepEqual(mentions(initial), [1, 2]); assert.equal(warm(initial).length, 1);
  const next = buildMapSlice(transact(data).data, 'bank', today, today, null);
  assert.deepEqual(mentions(next), [2, 3]); assert.equal(warm(next).length, 2);
});

test('CRM diff is one Russian readable interaction and contains no technical receipt', () => {
  const data = fresh(); const next = transact(data).data;
  const entries = crmDiff(data, next, 'bank'); assert.equal(entries.length, 1);
  const text = JSON.stringify(entries); assert.ok(text.includes('Александр Белов')); assert.ok(text.includes('Маяк')); assert.ok(text.includes('Долгие ответы поддержки'));
  for (const value of ['[object Object]', 'requestId', 'payload', 'mentionedPersonIds']) assert.ok(!text.includes(value));
  assert.equal(crmDiff(data, next, 'retail').length, 0);
});
