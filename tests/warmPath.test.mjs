import test from 'node:test';
import assert from 'node:assert/strict';
import { findWarmPath } from '../src/lib/warmPath.ts';
const p=(id,warmth,owner='')=>({id,companyId:'x',name:id,owner,warmth,department:'ИТ',title:'',decisionRole:'user',stance:'neutral',influence:3,interests:[],consentMarketing:false});
const edge=(id,from,to,strength)=>({id,companyId:'x',from,to,strength,type:'works_with'});
test('Dijkstra chooses lowest weighted path and penalizes cold endpoints',()=>{const people=[p('a',5,'Анна'),p('b',3),p('c',5),p('goal',2)];const relations=[edge('ab','a','b',4),edge('bg','b','goal',5),edge('ac','a','c',4),edge('cg','c','goal',5)];const route=findWarmPath(people,relations,'goal');assert.deepEqual(route.steps.map(s=>s.relation.id),['ac','cg']);assert.equal(route.cost,5);assert.equal(route.steps[1].penalty,2);});
test('starts from the best warm owned contact and handles direct contact',()=>{const people=[p('a',4,'Оля'),p('b',5,'Игорь'),p('goal',3)];const relations=[edge('ag','a','goal',1),edge('bg','goal','b',5)];assert.equal(findWarmPath(people,relations,'goal').start,'b');assert.equal(findWarmPath(people,relations,'a').cost,0);});
test('returns no path for disconnected targets or no eligible start',()=>{assert.equal(findWarmPath([p('a',5,'Оля'),p('b',2)],[],'b'),null);assert.equal(findWarmPath([p('a',5)],[],'a'),null);assert.equal(findWarmPath([p('a',5,'Оля')],[],'missing'),null);});

