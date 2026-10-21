export const personalProviders=['openai','anthropic','google','xai'] as const;
export type PersonalProvider=typeof personalProviders[number];
export const personalProviderNames:Record<PersonalProvider,string>={openai:'OpenAI',anthropic:'Anthropic Claude',google:'Google Gemini',xai:'xAI Grok'};
export type PersonalModel={id:string;name:string};
export type ProviderRecord={key:string;model:string;models:PersonalModel[];testedAt?:string};
export type PersonalSettings={revision?:number;active?:PersonalProvider;providers:Partial<Record<PersonalProvider,ProviderRecord>>};
export function isPersonalProvider(value:unknown):value is PersonalProvider{return personalProviders.some(provider=>provider===value);}
export function publicSettings(settings:PersonalSettings){return {revision:settings.revision||0,active:settings.active,providers:Object.fromEntries(personalProviders.map(provider=>{const record=settings.providers[provider];return [provider,{configured:!!record,suffix:record?.key.slice(-4),model:record?.model||'',models:record?.models||[],testedAt:record?.testedAt}];}))};}
