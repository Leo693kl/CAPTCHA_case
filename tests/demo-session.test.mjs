import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoSession, demoCandidate, demoCompany, demoDate, demoInterview } from '../src/api/demoSession.ts';
import { buildMapSlice } from '../src/api/mapSlice.ts';
import { crmDiff } from '../src/lib/crmDiff.ts';
import { mapSignals } from '../src/lib/mapSignals.ts';

test('practice interview is idempotent and only changes its own signal and CRM preview',()=>{
 const session=createDemoSession('observation');
 const warmCount=data=>mapSignals(buildMapSlice(data,demoCompany,demoDate,demoDate,null)).warm.length;
 assert.equal(warmCount(session.data),1);
 const save=()=>session.saveInteraction(demoCompany,demoInterview,undefined,demoDate);
 const first=save();
 assert.equal(first.ok,true);
 assert.deepEqual(save(),first);
 assert.equal(warmCount(session.data),2);
 const diff=crmDiff(session.baseline,session.data,demoCompany);
 assert.equal(diff.length,1);
 assert.equal(diff[0].entity,'Взаимодействие');
 assert.equal(diff[0].action,'Добавить');
 assert.equal(diff[0].id,first.interactionId);
 const restarted=createDemoSession('observation');
 assert.equal(warmCount(restarted.data),1);
 assert.deepEqual(crmDiff(session.baseline,restarted.data,demoCompany),[]);
});

test('practice candidate commits leave the baseline and new scenario untouched',()=>{
 const session=createDemoSession('hypothesis');
 const person=data=>data.people.find(item=>item.id===demoCandidate);
 const resolution={personId:demoCandidate,status:'confirmed'};
 session.commit({
  ...session.data,
  people: session.data.people.map(item=>item.id===demoCandidate?{...item,decisionRole:'decision_maker'}:item),
  candidateResolutions:[resolution],
 });
 assert.equal(person(session.data).decisionRole,'decision_maker');
 assert.deepEqual(session.data.candidateResolutions,[resolution]);
 assert.equal(person(session.baseline).decisionRole,'influencer');
 const restarted=createDemoSession('hypothesis');
 assert.equal(person(restarted.data).decisionRole,'influencer');
 assert.equal(restarted.data.candidateResolutions?.some(item=>item.personId===demoCandidate)??false,false);
});
