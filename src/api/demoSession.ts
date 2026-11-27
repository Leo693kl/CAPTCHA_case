import seed from '../data/crm.json' with { type:'json' };
import sample from '../../docs/plans/demo-interview.json' with { type:'json' };
import type { CRMData, EvidenceChange, InteractionDraft } from '../types';
import { prepareInteraction } from './interactionTransaction.ts';

export const demoDate = '2026-11-19';
export const demoCompany = 'bank';
export const demoCandidate = 'bank-p6';
export const demoInterview: InteractionDraft = {
 ...sample,
 evidence: { ...sample.evidence, kind:'interview', competitor:{ ...sample.evidence.competitor, outcome:'previous' } },
};

export type DemoScenario = 'contact' | 'observation' | 'hypothesis';

export function createDemoSession(scenario: DemoScenario) {
 const baseline = structuredClone(seed) as CRMData;
 let current = baseline;
 return {
  scenario,
  baseline,
  initialContact: scenario === 'observation' ? demoInterview.personId : scenario === 'hypothesis' ? demoCandidate : null,
  get data() { return current; },
  commit(next: CRMData) { current = next; },
  saveInteraction(companyId: string, draft: InteractionDraft, change: EvidenceChange|undefined, today: string) {
   const transaction = prepareInteraction(current, companyId, draft, change, today);
   if (transaction.data) current = transaction.data;
   return transaction.result;
  },
 };
}

export type DemoSession = ReturnType<typeof createDemoSession>;
