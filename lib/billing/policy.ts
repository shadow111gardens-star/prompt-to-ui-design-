import { paymentsEnabled } from '@/lib/billing/feature-flags';
import { createHash } from 'node:crypto';
import { FIXED_AI_MODEL } from '@/lib/ai/fixed-model';
import { AI_PRICING, PRICING_REVIEW, type TokenCounts } from '@/lib/ai/usage-pricing';
import { parseChatPlan } from '@/lib/project-chat';
import { cleanStreamingHtml } from '@/lib/stream-utils';

export class CreditError extends Error { constructor(message:string, public status=402) { super(message); } }
export const creditsEnabled=()=>paymentsEnabled()&&(process.env.NODE_ENV==='production'||process.env.OPENUI_CREDITS_ENABLED==='true');
const million=BigInt(1_000_000),zero=BigInt(0);
// Provider maxima, not application token caps. No maxOutputTokens is sent.
// https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite
export const MODEL_MAXIMUM={input:1_048_576,output:65_536};
export function rateSchedule(){
 if(Date.now()>Date.parse(PRICING_REVIEW.validUntil+'T23:59:59Z'))throw new CreditError('AI rate configuration needs review. Please contact support.',503);
 return AI_PRICING['google/'+FIXED_AI_MODEL as keyof typeof AI_PRICING];
}
function tokenCost(tokens:number,rate:number){return (BigInt(tokens)*BigInt(Math.round(rate*1e6))+million-BigInt(1))/million;}
export function maximumCallCost(){const r=rateSchedule();return tokenCost(MODEL_MAXIMUM.input,r.input)+tokenCost(MODEL_MAXIMUM.output,r.output);}
export function observedCost(usage:TokenCounts):{micros:bigint|null;exact:boolean}{
 if(usage.inputTokens===null||usage.outputTokens===null)return {micros:null,exact:false};
 const r=rateSchedule(),cached=usage.cachedInputTokens??0;
 if(cached>usage.inputTokens)return {micros:null,exact:false};
 return {micros:tokenCost(usage.inputTokens-cached,r.input)+tokenCost(cached,r.cachedInput)+tokenCost(usage.outputTokens,r.output),exact:usage.cachedInputTokens!==null};
}
export function canonicalHTML(html:string){return cleanStreamingHtml(html).replace(/\sdata-openui-element=(?:"[^"]*"|'[^']*')/g,'').trim();}
export function htmlDigest(html:string){return createHash('sha256').update(canonicalHTML(html)).digest('hex');}
export function validScreen(html:string){const text=canonicalHTML(html);return text.length>=20&&/<(?:main|section|article|div|form|body)\b/i.test(text)&&/<\/(?:main|section|article|div|form|body)>/i.test(text)&&!text.startsWith('{');}
export type Candidate={key:string;html:string};
export function candidateScreens(text:string,chat:boolean):Candidate[]{
 if(!chat)return validScreen(text)?[{key:'screen',html:cleanStreamingHtml(text)}]:[];
 const plan=parseChatPlan(text),screens=new Map<string,string>();let create=0;
 for(const action of plan.actions){if(action.type==='create')screens.set('create-'+create++,action.html);if(action.type==='redesign')screens.set('redesign-'+action.screenId,action.html);}
 return [...screens].filter(([,html])=>validScreen(html)).map(([key,html])=>({key,html}));
}
export type BillingCall={id:string;provider:string;model:string|null;status:string;usage:TokenCounts;sent:boolean|null};
export function reconciledCost(calls:BillingCall[],reserved:bigint){
 let amount=zero,known=calls.length>0;for(const call of calls){if(call.sent===false)continue;const cost=call.provider==='google'&&call.model===FIXED_AI_MODEL?observedCost(call.usage):{micros:null,exact:false};if(cost.micros===null){known=false;continue;}amount+=cost.micros;}
 // A partial/absent usage response must never release the unknown cost reserve.
 return {spent:known?amount:zero,held:known?zero:reserved,known};
}
