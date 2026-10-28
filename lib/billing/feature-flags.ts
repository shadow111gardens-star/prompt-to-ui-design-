// Temporarily disabled for testing. Explicit server opt-in restores billing.
export const paymentsEnabled = () => process.env.OPENUI_PAYMENTS_ENABLED === 'true';
