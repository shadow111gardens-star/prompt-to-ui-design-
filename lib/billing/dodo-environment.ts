import { CreditError } from '@/lib/billing/policy';

export type DodoEnvironment = 'test_mode' | 'live_mode';
type Config = { environment: DodoEnvironment; baseUrl: string; apiKey: string; webhookKey: string; businessId: string; products: { plus: string; pro: string; lifetime: string } };

export function activeDodoEnvironment(): DodoEnvironment {
  const mode = process.env.DODO_PAYMENTS_ENVIRONMENT;
  if (mode !== 'test_mode' && mode !== 'live_mode') throw new CreditError('Dodo payment environment is not configured.', 503);
  return mode;
}

/** Explicit environment is server-resolved (or established by webhook signature). */
export function dodoEnvironmentConfig(environment: DodoEnvironment): Config {
  if (environment !== 'test_mode' && environment !== 'live_mode') throw new CreditError('Invalid Dodo payment environment.', 503);
  const isTest = environment === 'test_mode';
  const prefix = isTest ? 'DODO_TEST_' : 'DODO_LIVE_';
  const read = (suffix: string, legacy: string) => {
    // Generic variables belong to the legacy Test-only deployment. They must
    // not become a second webhook environment when Live is active.
    const value = process.env[prefix + suffix] || (isTest && process.env.DODO_PAYMENTS_ENVIRONMENT === 'test_mode' ? process.env[legacy] : undefined);
    if (!value?.trim()) throw new CreditError('Dodo payment configuration is incomplete.', 503);
    return value.trim();
  };
  const apiKey = read('API_KEY', 'DODO_PAYMENTS_API_KEY');
  const webhookKey = read('WEBHOOK_KEY', 'DODO_PAYMENTS_WEBHOOK_KEY');
  const businessId = read('BUSINESS_ID', 'DODO_BUSINESS_ID');
  const products = { plus: read('PLUS_PRODUCT_ID', 'DODO_PLUS_PRODUCT_ID'), pro: read('PRO_PRODUCT_ID', 'DODO_PRO_PRODUCT_ID'), lifetime: read('LIFETIME_PRODUCT_ID', 'DODO_LIFETIME_PRODUCT_ID') };
  if (new Set(Object.values(products)).size !== 3) throw new CreditError('Dodo product configuration is invalid.', 503);
  return { environment, baseUrl: isTest ? 'https://test.dodopayments.com' : 'https://live.dodopayments.com', apiKey, webhookKey, businessId, products };
}
