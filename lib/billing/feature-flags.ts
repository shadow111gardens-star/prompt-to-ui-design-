// Payments are enabled by default. An explicit false temporarily pauses billing.
export const paymentsEnabled = () => process.env.OPENUI_PAYMENTS_ENABLED !== 'false';
