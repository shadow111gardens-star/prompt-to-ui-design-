const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
function loader(mocks={}){const cache=new Map();return function load(file){const name=path.resolve(file);if(cache.has(name))return cache.get(name).exports;const mod=new Module(name,module);cache.set(name,mod);mod.paths=Module._nodeModulePaths(path.dirname(name));mod.require=request=>Object.hasOwn(mocks,request)?mocks[request]:request.startsWith('@/')?load([request.slice(2)+'.ts',request.slice(2)+'.tsx',request.slice(2)+'/index.ts'].find(file=>fs.existsSync(file))):Module.prototype.require.call(mod,request);mod._compile(ts.transpileModule(fs.readFileSync(name,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,name);return mod.exports;};}

const config=loader()('lib/billing/plan-config.ts');
test('central Plus policy uses 300 credits, exactly 15 per success, 20 generations and a separate seven-dollar budget',()=>{
 const p=config.PLAN_CONFIG.plus;assert.equal(p.priceCents,900);assert.equal(p.allocation,300);assert.equal(p.creditsPerGeneration,15);assert.equal(p.generationLimit,20);assert.equal(p.allocation/p.creditsPerGeneration,p.generationLimit);assert.equal(config.periodSpendLimitMicroUsd('plus'),7000000);assert.equal(p.periodSource,'verified_subscription');
});
test('central Pro policy uses 1,700 credits, 15 per success and 50 generations with an independent required budget',t=>{
 const p=config.PLAN_CONFIG.pro;assert.equal(p.priceCents,2500);assert.equal(p.allocation,1700);assert.equal(p.creditsPerGeneration,15);assert.equal(p.generationLimit,50);assert.equal(p.allocation-p.generationLimit*p.creditsPerGeneration,950);
 const before=process.env.OPENUI_PRO_PERIOD_SPEND_LIMIT_USD;t.after(()=>{if(before===undefined)delete process.env.OPENUI_PRO_PERIOD_SPEND_LIMIT_USD;else process.env.OPENUI_PRO_PERIOD_SPEND_LIMIT_USD=before;});delete process.env.OPENUI_PRO_PERIOD_SPEND_LIMIT_USD;assert.throws(()=>config.periodSpendLimitMicroUsd('pro'),/OPENUI_PRO_PERIOD_SPEND_LIMIT_USD/);process.env.OPENUI_PRO_PERIOD_SPEND_LIMIT_USD='12.50';assert.equal(config.periodSpendLimitMicroUsd('pro'),12500000);assert.equal(config.periodSpendLimitMicroUsd('plus'),7000000);
});
test('USD limits use exact integer microdollars and reject missing, zero, negative, invalid and unsafe values',()=>{
 assert.equal(config.proSpendLimitMicroUsd('0.000001'),1);assert.equal(config.proSpendLimitMicroUsd('25.123456'),25123456);
 for(const value of ['', '0','-1','NaN','Infinity','1e2','1.0000001','1.2.3','9007199254740992'])assert.throws(()=>config.proSpendLimitMicroUsd(value));
});
test('Lifetime policy is one-time Gateway BYOK and never inherits platform credits or budgets',()=>{
 const p=config.PLAN_CONFIG.lifetime;assert.equal(p.priceCents,3900);assert.equal(p.cadence,'once');assert.equal(p.funding,'gateway_byok');assert.equal(p.allocation,undefined);assert.equal(p.spendLimitMicroUsd,undefined);assert.equal(config.isMonthlyPlan('lifetime'),false);assert.equal(config.isMonthlyPlan('local'),false);assert.equal(config.isMonthlyPlan('plus'),true);
});
