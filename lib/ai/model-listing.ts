import type { ProviderKey } from '@/lib/ai/provider-registry';
import { geminiConfiguration, geminiConfigurationError } from '@/lib/ai/gemini';
import { FIXED_AI_PROVIDER, FIXED_AI_MODEL, FIXED_AI_LABEL } from '@/lib/ai/fixed-model';
export interface AvailableModel { id:string;name:string;provider:ProviderKey;rawId:string;contextLength?:number;supportsVision?:boolean; }
export function getEnabledProviders():ProviderKey[]{ return geminiConfigurationError() ? [] : [FIXED_AI_PROVIDER]; }
export async function fetchAllModels():Promise<AvailableModel[]> {
 geminiConfiguration();
 return [{ id:FIXED_AI_MODEL,name:FIXED_AI_LABEL,provider:FIXED_AI_PROVIDER,rawId:FIXED_AI_MODEL,supportsVision:true }];
}
