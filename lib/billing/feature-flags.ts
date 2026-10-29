// Rollouts require an explicit opt-in; absence must never enable checkout.
export const paymentsEnabled = () => process.env.OPENUI_PAYMENTS_ENABLED === 'true';
