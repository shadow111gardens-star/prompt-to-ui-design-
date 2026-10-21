export type AccountPlan='local'|'plus'|'pro'|'lifetime';
// Only signed Firebase custom claims may grant a paid entitlement.
export function accountPlan(value:unknown):AccountPlan{return value==='plus'||value==='pro'||value==='lifetime'?value:'local';}
export const planLabels:Record<AccountPlan,string>={local:'LOCAL',plus:'Plus',pro:'Pro',lifetime:'Lifetime'};
