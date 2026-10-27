import { AsyncLocalStorage } from 'node:async_hooks';
import type { BillingCall } from '@/lib/billing/policy';
export type FundingScope={uid:string;runId:string;gatewayKey?:string;beforeCall:()=>Promise<void>;calls:BillingCall[]};
export const fundingScope=new AsyncLocalStorage<FundingScope>();
export async function beforeFundedCall(){await fundingScope.getStore()?.beforeCall();}
export function billingCallSink(){const scope=fundingScope.getStore();return scope?(call:BillingCall)=>{scope.calls.push(call);}:undefined;}
