// Public product units/prices only; no provider budgets or credentials.
export const SCREEN_CREDIT_COST=15;
export const PUBLIC_PLANS={
 plus:{name:'Plus',priceCents:900,cadence:'month',funding:'platform',allocation:300,creditsPerGeneration:SCREEN_CREDIT_COST,generationLimit:20},
 pro:{name:'Pro',priceCents:2500,cadence:'month',funding:'platform',allocation:1700,creditsPerGeneration:SCREEN_CREDIT_COST,generationLimit:50},
 lifetime:{name:'Lifetime',priceCents:3900,cadence:'once',funding:'gateway_byok'},
} as const;
export const CREDIT_ROLLOVER_POLICY='retain_in_account' as const;
