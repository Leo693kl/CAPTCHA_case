import test from 'node:test';
import assert from 'node:assert/strict';
import { extractEvidence } from '../src/lib/evidenceExtractor.ts';
import { llmExtractor } from '../src/lib/llmExtractor.ts';
const person=(id,name)=>({id,name});
test('extracts synthetic interview while preserving contact and speaker roles',()=>{
 const result=extractEvidence('С прежним поставщиком «Маяк» расстались из-за долгих ответов поддержки. Пришлите мне сравнение на одной странице. Александр Белов согласует требования к поддержке.',[person('belov','Александр Белов'),person('titov','Михаил Титов')]);
 assert.deepEqual(result.mentionedIds,['belov']); assert.equal(result.competitor,'Маяк'); assert.equal(result.outcome,'previous'); assert.equal(result.reason,'Долгие ответы поддержки'); assert.equal(result.format,'Сравнение на одной странице'); assert.equal(result.topic,'Поддержка');
});
test('leaves empty results and ambiguous names for explicit choice',()=>{
 assert.deepEqual(extractEvidence('Нет предложений',[]).mentionedIds,[]);
 const result=extractEvidence('Александр Белов согласует требования',[person('1','Александр Белов'),person('2','Александр Белов')]);
 assert.deepEqual(result.mentionedIds,[]); assert.deepEqual(result.ambiguousNames,['Александр Белов']);
});
test('unknown role requires explicit selection',async()=>{
 const [result]=await llmExtractor.extract({people:[],text:'Новый участник: Иван; роль: неизвестна'});
 assert.equal(result.roleNeedsConfirmation,true);
});
