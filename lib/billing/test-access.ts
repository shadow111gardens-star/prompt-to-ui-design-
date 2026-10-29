import { CreditError } from '@/lib/billing/policy';

const productionOrigin = 'https://prompt-to-ui-design-hooj.vercel.app';
/** Trust only the deployment's explicit configuration, never Host or request URL. */
export function configuredBillingOrigin(): string {
  const raw=process.env.OPENUI_PUBLIC_ORIGIN;
  if(!raw||!/^https:\/\/[a-z0-9.-]+(?::[0-9]+)?$/.test(raw)||raw.includes('*'))throw new CreditError('Test billing origin is invalid.',503);
  let parsed:URL;try{parsed=new URL(raw);}catch{throw new CreditError('Test billing origin is invalid.',503);}
  if(parsed.origin!==raw||parsed.username||parsed.password||parsed.pathname!=='/'||parsed.search||parsed.hash||parsed.hostname.length>253||parsed.hostname.split('.').some(label=>!label||label.length>63||!/^([a-z0-9]|[a-z0-9][a-z0-9-]*[a-z0-9])$/.test(label)))throw new CreditError('Test billing origin is invalid.',503);
  const environment=process.env.VERCEL_ENV || (process.env.NODE_ENV==='production'?'production':'development');
  if((environment==='production'&&raw!==productionOrigin)||(environment==='preview'&&raw===productionOrigin)||(environment&&environment!=='production'&&environment!=='preview'&&environment!=='development'))throw new CreditError('Test billing origin does not match the deployment environment.',503);
  return raw;
}
export function assertBillingRequestOrigin(request:Request):void {
  if(request.headers.get('origin')!==configuredBillingOrigin())throw new CreditError('Invalid request origin.',403);
}

/** Server-only rollout guard. Never serialize the configuration or UID list. */
export function testUserAllowlist(): ReadonlySet<string> {
  if (process.env.DODO_PAYMENTS_ENVIRONMENT !== 'test_mode') throw new CreditError('Test billing access is not configured.', 503);
  const raw = process.env.OPENUI_DODO_TEST_UID_ALLOWLIST;
  const entries = raw?.split(',').map(value => value.trim());
  if (!raw || raw.length > 16384 || !entries?.length || entries.length > 100 ||
      entries.some(uid => !uid || uid.length > 128 || /[\s\x00-\x1f\x7f,*]/.test(uid))) throw new CreditError('Test billing access is not configured.', 503);
  return new Set(entries);
}
export function assertTestBillingConfigured(): ReadonlySet<string> {
  if (process.env.DODO_PAYMENTS_ENVIRONMENT !== 'test_mode' ||
      process.env.OPENUI_PAYMENTS_ENABLED !== 'true' || process.env.OPENUI_CREDITS_ENABLED !== 'true') {
    throw new CreditError('Test billing is not enabled on this server.', 503);
  }
  const required = ['DODO_PAYMENTS_API_KEY', 'DODO_PAYMENTS_WEBHOOK_KEY', 'DODO_BUSINESS_ID',
    'DODO_PLUS_PRODUCT_ID', 'DODO_PRO_PRODUCT_ID', 'DODO_LIFETIME_PRODUCT_ID', 'OPENUI_PROVIDER_KEYS_SECRET'];
  if (required.some(name => !process.env[name]?.trim())) throw new CreditError('Test billing configuration is incomplete.', 503);
  configuredBillingOrigin();
  if (!/^[A-Za-z0-9+/]{43}=$/.test(process.env.OPENUI_PROVIDER_KEYS_SECRET || '') ||
      !/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(process.env.OPENUI_PRO_PERIOD_SPEND_LIMIT_USD || '') ||
      Number(process.env.OPENUI_PRO_PERIOD_SPEND_LIMIT_USD) <= 0) throw new CreditError('Test billing configuration is invalid.', 503);
  const products = required.filter(name => name.endsWith('_PRODUCT_ID')).map(name => process.env[name]);
  if (new Set(products).size !== 3) throw new CreditError('Test billing configuration is invalid.', 503);
  return testUserAllowlist();
}

/** Call only with a verified Firebase subject or a server-bound billing owner. */
export function assertTestBillingUser(uid: string): void {
  if (!assertTestBillingConfigured().has(uid)) throw new CreditError('Test billing is not available for this account.', 403);
}

export function canUseTestBilling(uid: string): boolean {
  try { assertTestBillingUser(uid); return true; } catch { return false; }
}
