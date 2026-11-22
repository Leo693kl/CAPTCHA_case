import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mapMetrics, relationEvidence, supplierEvidence, warmthHistory } from '../src/lib/mapMetrics.ts';
import { mapSignals } from '../src/lib/mapSignals.ts';
import seed from '../src/data/crm.json' with { type: 'json' };
import { buildMapSlice } from '../src/api/mapSlice.ts';
import { prepareInteraction } from '../src/api/interactionTransaction.ts';

const today = '2026-11-19';
const interview = JSON.parse(readFileSync(new URL('../docs/plans/demo-interview.json', import.meta.url)));
const person = (id, name, decisionRole = 'decision_maker', warmth = 4, companyId = 'bank') =>
  ({ id, name, companyId, department: 'ИТ', decisionRole, warmth });
const belov = person('bank-p0', 'Александр Белов');
const titov = person('bank-p10', 'Михаил Титов');
const sokolova = person('sokolova', 'Мария Соколова', 'evaluator', 5);
const gromova = person('gromova', 'Елена Громова', 'decision_maker', 5);
const outsider = person('else', belov.name, 'decision_maker', 5, 'retail');
const record = (id, personId, date, fields = {}) =>
  ({ id, personId, date, channel: 'Встреча', ourDepartment: 'Продажи', ...fields });
const evidence = (overrides = {}) =>
  ({ kind: 'feedback', sourceLabel: 'Синтетический отзыв', sourceExcerpt: 'Фрагмент отзыва', ...overrides });
const mail = (id, personId, date, opened, openObservedOn) =>
  record(id, personId, date, { channel: 'Почта', opened, openObservedOn });
const savedInterview = { ...interview, id: 'titov-interview' };

function bank(overrides = {}) {
  return {
    companyId: 'bank', asOf: today, historical: false, selectedPersonId: belov.id,
    people: [belov, titov, sokolova, gromova, outsider],
    relations: [],
    snapshots: [
      { personId: sokolova.id, date: '2026-08-25', person: sokolova },
      { personId: belov.id, date: '2026-08-25', person: belov },
      { personId: sokolova.id, date: '2026-03-28', person: { ...sokolova, warmth: 4 } },
      { personId: sokolova.id, date: '2026-11-20', person: { ...sokolova, warmth: 3 } },
    ],
    interactions: [
      mail('open-1', belov.id, '2026-10-21', true, '2026-11-19'),
      mail('open-2', belov.id, '2026-11-03', true, '2026-11-04'),
      mail('closed', belov.id, '2026-11-07', false, '2026-11-08'),
      mail('unknown', belov.id, '2026-11-07'),
      mail('future-status', belov.id, '2026-11-08', true, '2026-11-20'),
      mail('undated-status', belov.id, '2026-11-08', true),
      mail('unopened-contact', sokolova.id, '2026-11-08', false, '2026-11-10'),
      mail('old', belov.id, '2026-10-20', true, '2026-11-19'),
      record('outside', outsider.id, '2026-11-19', { evidence: evidence() }),
      record('old-gromova', gromova.id, '2026-08-20'),
      record('old-titov', titov.id, '2026-06-19'),
      record('observation-1', belov.id, '2026-11-02', {
        evidence: evidence({ mentionedPersonIds: [belov.id, belov.id, titov.id] }),
      }),
      record('observation-2', sokolova.id, '2026-11-04', {
        evidence: evidence(), ourDepartment: 'Проектный офис',
      }),
    ],
    ...overrides,
  };
}

test('opening rates distinguish 67%, 0/1 and missing measurements at the selected date', () => {
  const slice = bank();
  assert.deepEqual(mapMetrics(slice, belov.id).openRate, { opened: 2, measured: 3, percent: 67 });
  assert.deepEqual(mapMetrics(slice, sokolova.id).openRate, { opened: 0, measured: 1, percent: 0 });
  assert.deepEqual(mapMetrics(slice, titov.id).openRate, { opened: 0, measured: 0, percent: null });
  assert.deepEqual(mapMetrics({ ...slice, asOf: '2026-11-18' }, belov.id).openRate,
    { opened: 1, measured: 2, percent: 50 });
});

test('mentions count distinct records across the company and interview leaves opening rate intact', () => {
  const slice = bank();
  const before = mapMetrics(slice, belov.id);
  const after = mapMetrics({ ...slice, interactions: [...slice.interactions, savedInterview] }, belov.id);
  assert.deepEqual([before.mentions.length, before.observations.length], [1, 2]);
  assert.deepEqual([after.mentions.length, after.observations.length], [2, 3]);
  assert.deepEqual(after.openRate, before.openRate);
  assert.deepEqual(after.mentions.map(record => record.id), ['observation-1', 'titov-interview']);
});

test('intensity compares adjacent 30-day windows and uses visible company membership, not selected person', () => {
  const slice = bank();
  const metrics = mapMetrics(slice);
  assert.deepEqual([metrics.previousStart, metrics.previousEnd, metrics.start, metrics.end],
    ['2026-09-21', '2026-10-20', '2026-10-21', today]);
  assert.deepEqual(metrics.intensity, {
    current: 9, previous: 1,
    channels: [
      { channel: 'Встреча', current: 2, previous: 0 },
      { channel: 'Почта', current: 7, previous: 1 },
    ],
  });
  assert.deepEqual(mapMetrics({ ...slice, selectedPersonId: titov.id }).intensity, metrics.intensity);
});

test('warmth includes the dated 4 → 5 transition, a single snapshot, and no future snapshots', () => {
  const slice = bank();
  assert.deepEqual(warmthHistory(slice, sokolova.id).map(item => [item.date, item.person.warmth]),
    [['2026-03-28', 4], ['2026-08-25', 5]]);
  assert.equal(warmthHistory(slice, belov.id).length, 1);
  assert.deepEqual(warmthHistory({ ...slice, asOf: '2026-08-24' }, sokolova.id).map(item => item.person.warmth), [4]);
});

test('the single warm decision maker changes from Belov to two after Titov’s direct contact', () => {
  const slice = bank();
  assert.deepEqual(mapSignals(slice).warm.map(({ person }) => person.id), [belov.id]);
  const after = { ...slice, interactions: [...slice.interactions, savedInterview] };
  assert.deepEqual(mapSignals(after).warm.map(({ person }) => person.id), [belov.id, titov.id]);
  assert.deepEqual(mapSignals({ ...after, asOf: '2026-11-18' }).warm.map(({ person }) => person.id), [belov.id, gromova.id]);
});

test('supplier evidence follows company and date and points to the interview record', () => {
  const slice = bank({ interactions: [savedInterview] });
  assert.equal(supplierEvidence(slice)[0].supplier.name, 'Маяк');
  assert.equal(supplierEvidence(slice)[0].record.id, 'titov-interview');
  assert.deepEqual(supplierEvidence({ ...slice, asOf: '2026-11-18' }), []);
  assert.deepEqual(supplierEvidence({ ...slice, companyId: 'retail' }), []);
});

test('a strength proposal uses separate confirmed records about the same pair and leaves the edge unchanged', () => {
  const pair = { id: 'pair', companyId: 'bank', from: belov.id, to: titov.id, strength: 1 };
  const reverse = { ...pair, id: 'reverse', from: titov.id, to: belov.id };
  const other = { ...pair, id: 'other', to: sokolova.id };
  const about = relationId => evidence({ signals: [{ kind: 'relation', relationId }, { kind: 'relation', relationId }] });
  const first = record('first', belov.id, '2026-11-01', { evidence: about(pair.id) });
  const second = record('second', titov.id, '2026-11-04', { evidence: about(reverse.id) });
  const otherRecord = record('unrelated', sokolova.id, '2026-11-05', { evidence: about(other.id) });
  const slice = bank({ relations: [pair, reverse, other], interactions: [first, first, second, otherRecord] });
  assert.deepEqual(relationEvidence(slice, pair), { strength: 3, records: [second, first] });
  assert.equal(relationEvidence({ ...slice, asOf: '2026-11-03' }, pair).strength, null);
  assert.equal(pair.strength, 1);
});

test('signal details keep teams, evidence and possible duplicates within the company', () => {
  const slice = bank();
  const duplicate = { ...belov, id: 'duplicate', name: '  АЛЕКСАНДР   БЕЛОВ ' };
  const contact = record('new-team', belov.id, today, { ourDepartment: 'Проектный офис' });
  const result = mapSignals({ ...slice, people: [...slice.people, duplicate], interactions: [...slice.interactions, contact] });
  assert.deepEqual(result.duplicates.map(group => group.map(person => person.id)), [[belov.id, duplicate.id]]);
  assert.deepEqual(result.conflicts[0].departments, ['Продажи', 'Проектный офис']);
  assert.equal(result.conflicts[0].recent[0].id, contact.id);
  assert.deepEqual(result.stale.map(({ person }) => person.id), [duplicate.id]);
});

test('real A+B+C data retains demo numbers and strength confirmation does not manufacture evidence',()=>{
 const data=structuredClone(seed);const before=buildMapSlice(data,'bank',today,today,'bank-p0');
 const metrics=mapMetrics(before,'bank-p0');
 assert.deepEqual(metrics.openRate,{opened:2,measured:3,percent:67});assert.deepEqual([metrics.mentions.length,metrics.observations.length],[1,2]);
 assert.equal(mapSignals(before).warm.length,1);
 const saved=prepareInteraction(data,'bank',interview,undefined,today);
 const after=buildMapSlice(saved.data,'bank',today,today,'bank-p0');
 assert.deepEqual([mapMetrics(after,'bank-p0').mentions.length,mapMetrics(after,'bank-p0').observations.length],[2,3]);
 assert.equal(mapMetrics(after,'bank-p0').openRate.percent,67);assert.equal(mapSignals(after).warm.length,2);
 const pair=before.relations.find(r=>r.id==='bank-r1');assert.equal(relationEvidence(before,pair).strength,3);
 const confirmed=prepareInteraction(data,'bank',{...interview,requestId:'confirm-pair'}, {kind:'relation-strength',relationId:pair.id,strength:3},today);
 const confirmedSlice=buildMapSlice(confirmed.data,'bank',today,today,null);
 assert.equal(confirmedSlice.relations.find(r=>r.id===pair.id).strength,3);assert.equal(relationEvidence(confirmedSlice,pair).records.length,2);
});

test('company observations survive deletion of their author through A snapshots',()=>{
 const data=structuredClone(seed);data.people=data.people.filter(p=>p.id!=='bank-p2');
 const slice=buildMapSlice(data,'bank',today,today,null);
 assert.equal(mapMetrics(slice).observations.length,2);
 assert.deepEqual(mapMetrics(slice,'bank-p0').openRate,{opened:2,measured:3,percent:67});
 assert.ok(!slice.people.some(p=>p.id==='bank-p2'));
});
