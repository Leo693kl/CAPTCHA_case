import type { CRMData } from '../types.ts';
import { calendarDate } from './interactionTransaction.ts';

type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string';
const strings = (value: unknown) => Array.isArray(value) && value.every(text);
const fields = (value: RecordValue, names: string[]) => names.every(name => text(value[name]));
const oneOf = (value: unknown, options: string[]) => text(value) && options.includes(value);
const score = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5;
const date = (value: unknown) => text(value) && calendarDate(value);
const optional = (value: unknown, valid: (value: unknown) => boolean) => value === undefined || valid(value);
function person(value: unknown): boolean {
 return record(value) && fields(value,['id','companyId','name','department','title','owner']) &&
  oneOf(value.decisionRole,['decision_maker','influencer','evaluator','user','blocker']) &&
  oneOf(value.stance,['champion','supporter','neutral','skeptic']) && score(value.influence) && score(value.warmth) && strings(value.interests) && typeof value.consentMarketing === 'boolean';
}
function evidence(value: unknown): boolean {
 if (!record(value) || !oneOf(value.kind,['interview','feedback']) || !fields(value,['sourceLabel','sourceExcerpt'])) return false;
 return optional(value.mentionedPersonIds,strings) && optional(value.preferences,p => record(p) && optional(p.channel,text) && optional(p.format,text) && optional(p.topics,strings)) &&
  optional(value.competitor,c => record(c) && text(c.name) && oneOf(c.outcome,['current','previous','unknown']) && optional(c.reason,text)) &&
  optional(value.signals,s => Array.isArray(s) && s.every(signal => record(signal) && (
   oneOf(signal.kind,['initiative','resumption']) || signal.kind === 'approval' && date(signal.requestedOn) || signal.kind === 'relation' && text(signal.relationId))));
}
/** Validate unknown persisted input before migration or delivery to UI code. */
export function isCRMData(value: unknown): value is CRMData {
 if (!record(value)) return false;
 return Array.isArray(value.companies) && value.companies.length > 0 && value.companies.every(c => record(c) && fields(c,['id','name','industry','initiative','description'])) &&
  Array.isArray(value.people) && value.people.every(person) &&
  Array.isArray(value.relations) && value.relations.every(r => record(r) && fields(r,['id','companyId','from','to']) && oneOf(r.type,['reports_to','works_with','informal']) && score(r.strength)) &&
  Array.isArray(value.interactions) && value.interactions.every(i => record(i) && fields(i,['id','personId','channel','ourOwner','ourDepartment','summary','sentiment']) && date(i.date) && optional(i.participantIds,strings) && optional(i.opened,o => typeof o === 'boolean') && optional(i.openObservedOn,date) && optional(i.evidence,evidence)) &&
  optional(value.snapshots,s => Array.isArray(s) && s.every(snapshot => record(snapshot) && text(snapshot.personId) && date(snapshot.date) && person(snapshot.person) && optional(snapshot.deleted,d => typeof d === 'boolean'))) &&
  optional(value.candidateResolutions,c => Array.isArray(c) && c.every(x => record(x) && text(x.personId) && oneOf(x.status,['rejected','confirmed']))) &&
  optional(value.ratingBases,b => Array.isArray(b) && b.every(x => record(x) && fields(x,['id','subjectId','authorId','rationale']) && oneOf(x.subjectType,['person','relation']) && oneOf(x.field,['influence','stance','warmth','role','strength','type']) && (text(x.value) || score(x.value)) && date(x.date) && text(x.rationale) && x.rationale.length <= 300 && strings(x.sourceIds))) &&
  optional(value.ratingChanges,c => Array.isArray(c) && c.every(x => record(x) && fields(x,['id','subjectId','authorId']) && oneOf(x.subjectType,['person','relation']) && oneOf(x.field,['influence','stance','warmth','role','strength','type']) && (text(x.before) || score(x.before)) && (text(x.after) || score(x.after)) && date(x.date))) &&
  optional(value.interactionRequests,r => Array.isArray(r) && r.every(receipt => record(receipt) && fields(receipt,['companyId','requestId','interactionId','payload'])));
}
