// Synthetic configuration only; never loads environment files or connects to a service.
module.exports = {
 OPENUI_PAYMENTS_ENABLED:'true', OPENUI_CREDITS_ENABLED:'true',
 OPENUI_DODO_TEST_UID_ALLOWLIST:'alice,bob', DODO_PAYMENTS_ENVIRONMENT:'test_mode',
 DODO_PAYMENTS_API_KEY:'synthetic-test-key', DODO_PAYMENTS_WEBHOOK_KEY:'whsec_'+Buffer.alloc(32,4).toString('base64'),
 DODO_BUSINESS_ID:'business',DODO_PLUS_PRODUCT_ID:'product-plus',DODO_PRO_PRODUCT_ID:'product-pro',DODO_LIFETIME_PRODUCT_ID:'product-lifetime',
 OPENUI_PUBLIC_ORIGIN:'https://prompt-to-ui-design-hooj.vercel.app',OPENUI_PRO_PERIOD_SPEND_LIMIT_USD:'12',
 OPENUI_PROVIDER_KEYS_SECRET:Buffer.alloc(32,8).toString('base64'),
};
