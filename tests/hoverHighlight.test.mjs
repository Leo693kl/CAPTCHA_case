import test from 'node:test';
import assert from 'node:assert/strict';
import { getHoverNeighborhood } from '../src/lib/hoverHighlight.ts';
const relation=(id,from,to)=>({id,from,to,companyId:'x',type:'works_with',strength:3});
test('highlights a contact and both incoming and outgoing neighbors only',()=>{const edges=[relation('ab','a','b'),relation('ca','c','a'),relation('cd','c','d')];const result=getHoverNeighborhood('a',edges);assert.deepEqual([...result.nodes].sort(),['a','b','c']);assert.deepEqual([...result.edges].sort(),['ab','ca']);});
test('clearing hover removes every highlight, and an isolated contact remains visible',()=>{const edges=[relation('ab','a','b')];const clear=getHoverNeighborhood(null,edges);assert.equal(clear.nodes.size,0);assert.equal(clear.edges.size,0);const isolated=getHoverNeighborhood('z',edges);assert.deepEqual([...isolated.nodes],['z']);assert.equal(isolated.edges.size,0);});
