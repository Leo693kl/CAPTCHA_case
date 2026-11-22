import type { Interaction, MapSlice } from '../types.ts';
import { sliceInteractions } from './mapMetrics.ts';

export interface ConfirmedPreference { field: 'channel' | 'format' | 'topics'; label: string; value: string; source: Interaction }
/** Latest non-empty field, with its actual source; mentioning someone does not transfer preferences. */
export function communicationPreferences(slice: MapSlice, personId: string): ConfirmedPreference[] {
 const records=sliceInteractions(slice).filter(record=>record.personId===personId&&record.evidence).reverse().sort((a,b)=>b.date.localeCompare(a.date));
 const fields=[['channel','Канал'],['format','Формат'],['topics','Темы']] as const;
 return fields.flatMap(([field,label])=>{
  for(const source of records){
   const preferences=source.evidence?.preferences;
   const value=field==='topics'?preferences?.topics?.join(', '):preferences?.[field];
   if(value?.trim())return [{field,label,value,source}];
  }
  return [];
 });
}
