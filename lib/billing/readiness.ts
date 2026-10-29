import { configuredBillingOrigin, testUserAllowlist } from '@/lib/billing/test-access';
import { assertDodoProduct, dodoProducts } from '@/lib/billing/dodo';
import type { PaidPlan } from '@/lib/billing/plan-config';

type Result = 'PASS' | 'FAIL';
/** Temporary, authenticated diagnostic. No account, ledger or provider writes. */
export async function testBillingReadiness(uid:string):Promise<Record<string,Result>|null>{
  try { if(!testUserAllowlist().has(uid))return null; } catch { return null; }
  const checks:Record<string,Result>={allowlist:'PASS',testMode:'FAIL',origin:'FAIL',paymentsDisabled:'FAIL',creditsDisabled:'FAIL',api:'FAIL',plus:'FAIL',pro:'FAIL',lifetime:'FAIL'};
  if(process.env.DODO_PAYMENTS_ENVIRONMENT==='test_mode')checks.testMode='PASS';
  try{configuredBillingOrigin();checks.origin='PASS';}catch{/* Keep generic result. */}
  if(process.env.OPENUI_PAYMENTS_ENABLED==='false')checks.paymentsDisabled='PASS';
  if(process.env.OPENUI_CREDITS_ENABLED==='false')checks.creditsDisabled='PASS';
  if(checks.testMode!=='PASS'||checks.origin!=='PASS'||checks.paymentsDisabled!=='PASS'||checks.creditsDisabled!=='PASS')return checks;
  const key=process.env.DODO_PAYMENTS_API_KEY?.trim();if(!key)return checks;
  let products:Record<PaidPlan,string>;try{products=dodoProducts();}catch{return checks;}
  let accepted=false;
  for(const plan of ['plus','pro','lifetime'] as const){
    try{
      const response=await fetch('https://test.dodopayments.com/products/'+encodeURIComponent(products[plan]),{method:'GET',headers:{Authorization:'Bearer '+key},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000)});
      if(!response.ok){await response.body?.cancel();continue;}
      accepted=true;const product:unknown=await response.json();if(!product||typeof product!=='object'||Array.isArray(product))continue;
      const item=product as Record<string,unknown>;if(item.product_id!==products[plan])continue;
      assertDodoProduct(plan,item);checks[plan]='PASS';
    }catch{/* Never return provider diagnostics or secrets. */}
  }
  if(accepted)checks.api='PASS';
  return checks;
}
