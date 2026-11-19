export type Role = 'decision_maker'|'influencer'|'evaluator'|'user'|'blocker';
export type Stance = 'champion'|'supporter'|'neutral'|'skeptic';
export type RelationType = 'reports_to'|'works_with'|'informal';
export interface Company { id:string; name:string; industry:string; initiative:string; description:string }
export interface Person { id:string; companyId:string; name:string; department:string; title:string; decisionRole:Role; stance:Stance; influence:number; warmth:number; owner:string; interests:string[]; consentMarketing:boolean }
export interface Relation { id:string; companyId:string; from:string; to:string; type:RelationType; strength:number }
export type EvidenceSignal =
  | { kind: 'initiative' | 'resumption' }
  | { kind: 'approval'; requestedOn: string }
  | { kind: 'relation'; relationId: string };

export interface InteractionEvidence {
  kind: 'interview' | 'feedback';
  sourceLabel: string;
  sourceExcerpt: string;
  mentionedPersonIds?: string[];
  preferences?: { channel?: string; format?: string; topics?: string[] };
  competitor?: { name: string; outcome: 'current' | 'previous' | 'unknown'; reason?: string };
  signals?: EvidenceSignal[];
}

export interface Interaction {
  id: string;
  personId: string;
  date: string;
  channel: string;
  ourOwner: string;
  ourDepartment: string;
  summary: string;
  sentiment: string;
  opened?: boolean;
  openObservedOn?: string;
  evidence?: InteractionEvidence;
}

export type EvidenceChange =
  | { kind: 'role'; personId: string; role: Role }
  | { kind: 'relation-strength'; relationId: string; strength: number };

export type InteractionDraft = Omit<Interaction, 'id'> & { requestId: string };
export type SaveResult =
  | { ok: true; interactionId: string }
  | { ok: false; error: string };
export type SaveInteraction = (
  companyId: string,
  draft: InteractionDraft,
  change?: EvidenceChange,
) => Promise<SaveResult>;

export interface MapSlice {
  companyId: string;
  asOf: string;
  historical: boolean;
  selectedPersonId: string | null;
  people: readonly Person[];
  relations: readonly Relation[];
  interactions: readonly Interaction[];
  snapshots: readonly PersonSnapshot[];
}

export interface PersonSnapshot { personId:string; date:string; person:Person; deleted?:boolean }
// Optional metadata keeps old localStorage readable; never shown as CRM fields.
export interface InteractionRequest { companyId:string; requestId:string; interactionId:string; payload:string }
export interface CRMData { companies:Company[]; people:Person[]; relations:Relation[]; interactions:Interaction[]; snapshots:PersonSnapshot[]; interactionRequests?:InteractionRequest[] }
export const departments=['ИТ','ИБ','Закупки','Финансы','Бизнес','Прочее'];
export const roles:Record<Role,string>={decision_maker:'ЛПР',influencer:'Влияющий',evaluator:'Эксперт',user:'Пользователь',blocker:'Блокирующий'};
export const stances:Record<Stance,string>={champion:'Лидер поддержки',supporter:'Сторонник',neutral:'Нейтрален',skeptic:'Скептик'};
export const relationTypes:Record<RelationType,string>={reports_to:'Подчинение',works_with:'Рабочая связь',informal:'Неформальная связь'};
