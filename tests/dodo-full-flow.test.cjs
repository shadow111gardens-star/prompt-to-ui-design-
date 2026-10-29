Object.assign(process.env,require('./helpers/test-billing-env.cjs'));
// Application integration with synthetic auth, provider HTTP and transactional DB.
// No real Firebase login, Dodo checkout or PostgreSQL connection is performed.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const ts = require('typescript'), { createHmac } = require('node:crypto');
const { billingDB } = require('./helpers/billing-db.cjs');
function loader(mocks) {
  const cache = new Map();
  return function load(file) {
    const name = path.resolve(file); if (cache.has(name)) return cache.get(name).exports;
    const mod = new Module(name, module); cache.set(name, mod); mod.paths = Module._nodeModulePaths(path.dirname(name));
    mod.require = request => Object.hasOwn(mocks, request) ? mocks[request] : request.startsWith('@/')
      ? load([request.slice(2)+'.ts',request.slice(2)+'.tsx',request.slice(2)+'/index.ts'].find(fs.existsSync))
      : Module.prototype.require.call(mod, request);
    mod._compile(ts.transpileModule(fs.readFileSync(name,'utf8'), { compilerOptions: { module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true } }).outputText, name);
    return mod.exports;
  };
}
function request(uid, endpoint, body) {
  return new Request('https://prompt-to-ui-design-hooj.vercel.app'+endpoint, { method:body===undefined?'GET':'POST', headers:{origin:'https://prompt-to-ui-design-hooj.vercel.app','content-type':'application/json',...(uid?{'x-synthetic-uid':uid}:{})},body:body===undefined?undefined:JSON.stringify(body) });
}
async function fixture(t, plan='plus') {
  const values={OPENUI_PAYMENTS_ENABLED:'true',OPENUI_CREDITS_ENABLED:'true',DODO_PAYMENTS_API_KEY:'synthetic-test-key',DODO_PAYMENTS_ENVIRONMENT:'test_mode',DODO_PAYMENTS_WEBHOOK_KEY:'whsec_'+Buffer.alloc(32,3).toString('base64'),DODO_BUSINESS_ID:'synthetic-business',DODO_PLUS_PRODUCT_ID:'product-plus',DODO_PRO_PRODUCT_ID:'product-pro',DODO_LIFETIME_PRODUCT_ID:'product-lifetime',OPENUI_PUBLIC_ORIGIN:'https://prompt-to-ui-design-hooj.vercel.app',OPENUI_PRO_PERIOD_SPEND_LIMIT_USD:'12',OPENUI_PROVIDER_KEYS_SECRET:Buffer.alloc(32,9).toString('base64')};
  const previous=Object.fromEntries(Object.keys(values).map(k=>[k,process.env[k]])),fetch=global.fetch;
  Object.assign(process.env, values); t.after(()=>{global.fetch=fetch;for(const [k,v] of Object.entries(previous)){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
  const {db,seed}=billingDB();await seed();await seed('bob');Object.assign(db.state.creditAccount[0],{plan:'local',status:'inactive',balance:0,currentPeriodId:null});
  const load=loader({'@/lib/db':{prisma:db},'@/lib/ai/personal-provider-auth':{personalProviderIdentity:async req=>{const uid=req.headers.get('x-synthetic-uid');if(!['alice','bob'].includes(uid))throw Error('Unauthenticated');return {sub:uid,email:uid+'@example.test',plan:'local'};}}});
  const subscription={subscription_id:'sub-alice',customer:{customer_id:'cus-alice'},product_id:'product-'+plan,status:'active',quantity:1,payment_frequency_count:1,payment_frequency_interval:'Month',previous_billing_date:new Date(Date.now()-86400000).toISOString(),next_billing_date:new Date(Date.now()+29*86400000).toISOString()};
  const calls=[];
  global.fetch=async(url,options={})=>{
    const target=new URL(String(url));assert.equal(target.origin,'https://test.dodopayments.com');calls.push({path:target.pathname,body:options.body?JSON.parse(options.body):null});
    if(target.pathname.startsWith('/products/')){const kind=target.pathname.split('product-')[1];return Response.json({price:{currency:'USD',price:{plus:900,pro:2500,lifetime:3900}[kind],type:kind==='lifetime'?'one_time_price':'recurring_price',payment_frequency_count:1,payment_frequency_interval:'Month'}});}
    if(target.pathname==='/checkouts')return Response.json({checkout_url:'https://synthetic-checkout.test/session'});
    if(target.pathname==='/payments/payment')return Response.json(plan==='lifetime'?{status:'succeeded',currency:'USD',total_amount:3900,tax:0,discounts:[],customer:{customer_id:'cus-alice'},product_cart:[{product_id:'product-lifetime',quantity:1}]}:{status:'succeeded',subscription_id:'sub-alice',customer:{customer_id:'cus-alice'}});
    if(target.pathname==='/subscriptions/sub-alice')return Response.json(subscription);
    if(target.pathname==='/payments/proof-payment')return Response.json({payment_id:'proof-payment',status:'succeeded',currency:'USD',tax:0,discounts:[],customer:{customer_id:'cus-alice'},total_amount:plan==='pro'?2500:900,charge_type:'renewal',service_periods:[{subscription_id:'sub-alice',proration_factor:'1',starts_at:subscription.previous_billing_date,ends_at:subscription.next_billing_date}]});
    if(target.pathname==='/payments')return Response.json({items:[{payment_id:'proof-payment',status:'succeeded',currency:'USD',total_amount:plan==='pro'?2500:900,charge_type:'renewal',service_periods:[{subscription_id:'sub-alice',proration_factor:'1',starts_at:subscription.previous_billing_date,ends_at:subscription.next_billing_date}]}]});
    if(target.pathname.includes('/customer-portal/session'))return Response.json({link:'https://synthetic-portal.test/'+target.pathname.split('/')[2]});
    throw Error('Unexpected synthetic provider operation');
  };
  async function deliver(id, type='payment.succeeded', valid=true) {
    const raw=JSON.stringify({business_id:'synthetic-business',type,timestamp:new Date().toISOString(),data:{payment_id:'payment',subscription_id:'sub-alice',metadata:{firebase_uid:'bob'}}});
    const timestamp=String(Math.floor(Date.now()/1000));const signature=createHmac('sha256',Buffer.alloc(32,3)).update(id+'.'+timestamp+'.'+raw).digest('base64');
    return load('app/api/billing/dodo-webhook/route.ts').POST(new Request('https://prompt-to-ui-design-hooj.vercel.app/api/billing/dodo-webhook',{method:'POST',headers:{'webhook-id':id,'webhook-timestamp':timestamp,'webhook-signature':'v1,'+(valid?signature:'invalid')},body:raw}));
  }
  return {db,load,calls,subscription,deliver};
}
const html=i=>'<main><h1>Accepted screen '+i+'</h1><button>Continue</button></main>';
const usage={id:'synthetic-call',provider:'google',model:'gemini-3.5-flash-lite',sent:true,status:'completed',usage:{inputTokens:100,outputTokens:50,totalTokens:150,cachedInputTokens:0,reasoningTokens:0,cacheWriteTokens:0}};

test('synthetic authenticated checkout -> signed payment -> four accepted screens -> rollover renewal -> cancellation',async t=>{
  t.mock.timers.enable({apis:['Date'],now:Date.now()});
  const f=await fixture(t),checkout=f.load('app/api/billing/checkout/route.ts');
  assert.equal((await checkout.POST(request(null,'/api/billing/checkout',{plan:'plus'}))).status,401);
  const opened=await checkout.POST(request('alice','/api/billing/checkout',{plan:'plus'}));assert.equal(opened.status,200);
  assert.equal(f.db.state.creditAccount[0].balance,0,'redirect/checkout cannot grant credits');
  const cart=f.calls.find(c=>c.path==='/checkouts').body;assert.deepEqual(cart.product_cart,[{product_id:'product-plus',quantity:1}]);assert.equal(cart.customer.customer_id,'cus-alice');assert.equal(cart.feature_flags.allow_currency_selection,false);
  assert.equal((await f.deliver('invalid-signature','payment.succeeded',false)).status,401);assert.equal(f.db.state.creditAccount[0].balance,0);
  assert.equal((await f.deliver('payment')).status,200);assert.equal((await f.deliver('payment')).status,200);assert.equal((await f.deliver('same-period','subscription.active')).status,200);assert.equal(f.db.state.creditAccount[0].balance,300);
  const store=f.load('lib/billing/store.ts'),{run}=await store.reserveRun({sub:'alice',plan:'plus'},{requestId:'four-screens',fingerprint:'fp',projectId:'project-alice',workflowId:'one-workflow',route:'/api/generate/redesign',chat:true,screen:true});
  await store.reserveProviderCall('alice',run.id);await store.finishRun('alice',run.id,[0,1,2,3].map(i=>({key:String(i),html:html(i)})),[usage],false);
  const shapes={shapes:{entities:Object.fromEntries([0,1,2,3].map(i=>['screen-'+i,{type:'generatedui',uiSpecData:html(i),isGenerating:false}]))}};
  const autosave=f.load('app/api/autosave/route.ts');const saved=await autosave.POST(request('alice','/api/autosave',{projectId:'project-alice',shapesData:shapes}));assert.equal(saved.status,200);assert.equal((await saved.json()).credits.charged,60);
  assert.equal((await(await autosave.POST(request('alice','/api/autosave',{projectId:'project-alice',shapesData:shapes}))).json()).credits.charged,0);
  assert.equal((await autosave.POST(request('bob','/api/autosave',{projectId:'project-alice',shapesData:shapes}))).status,404);
  const account=await(await f.load('app/api/ai-credits/route.ts').GET(request('alice','/api/ai-credits'))).json();assert.equal(account.creditsRemaining,240);assert.equal(account.successfulScreens,4);assert.equal(account.creditsUsed,60);
  const bob=await(await f.load('app/api/ai-credits/route.ts').GET(request('bob','/api/ai-credits?uid=alice'))).json();assert.equal(bob.creditsRemaining,300);assert.equal(bob.successfulScreens,0);
  const portal=await f.load('app/api/billing/portal/route.ts').POST(request('bob','/api/billing/portal',{customerId:'cus-alice'}));assert.equal((await portal.json()).url,'https://synthetic-portal.test/cus-bob');
  t.mock.timers.tick(30*86400000);f.subscription.previous_billing_date=f.subscription.next_billing_date;f.subscription.next_billing_date=new Date(Date.parse(f.subscription.previous_billing_date)+30*86400000).toISOString();
  assert.equal((await f.deliver('renewal','subscription.renewed')).status,200);assert.equal((await f.deliver('renewal','subscription.renewed')).status,200);
  const renewed=await store.publicUsage('alice');assert.equal(renewed.creditsRemaining,540);assert.equal(renewed.successfulScreens,0);assert.equal(renewed.creditsUsed,0);
  f.subscription.status='cancelled';assert.equal((await f.deliver('cancel','subscription.cancelled')).status,200);
  await assert.rejects(store.reserveRun({sub:'alice'},{requestId:'after-cancel',fingerprint:'fp2',projectId:'project-alice',workflowId:'blocked',route:'/api/generate',chat:false,screen:true}),/active Plus or Pro/);
  assert.equal(f.db.state.creditAccount[0].balance,540);
});

test('synthetic paid Lifetime entitlement -> encrypted key API -> own funding, without platform deductions',async t=>{
  const f=await fixture(t,'lifetime');assert.equal((await f.deliver('lifetime-payment')).status,200);
  const gateway=f.load('app/api/ai-gateway-key/route.ts'),key='synthetic-own-gateway-key';
  const put=new Request('https://prompt-to-ui-design-hooj.vercel.app/api/ai-gateway-key',{method:'PUT',headers:{origin:'https://prompt-to-ui-design-hooj.vercel.app','x-synthetic-uid':'alice','content-type':'application/json'},body:JSON.stringify({key})});
  const result=await gateway.PUT(put);assert.equal(result.status,200);assert.doesNotMatch(await result.text(),new RegExp(key));assert.ok(f.db.state.creditAccount[0].gatewayKey);assert.ok(!f.db.state.creditAccount[0].gatewayKey.includes(key));
  const store=f.load('lib/billing/store.ts'),{run,gatewayKey}=await store.reserveRun({sub:'alice'},{requestId:'own-funded',fingerprint:'own',projectId:'project-alice',workflowId:'own',route:'/api/generate',chat:false,screen:true});
  assert.equal(gatewayKey,key);await store.reserveProviderCall('alice',run.id);await store.finishRun('alice',run.id,[{key:'screen',html:html(0)}],[],false);
  assert.equal((await store.persistBilledCanvas('alice','project-alice',{shapes:{entities:{own:{type:'generatedui',uiSpecData:html(0),isGenerating:false}}}},{})).charged,0);
  assert.equal(f.db.state.creditAccount[0].balance,0);assert.equal(f.db.state.generationRun[0].funding,'gateway_byok');assert.equal(f.db.state.generationRun[0].reservedCostMicros,BigInt(0));
  assert.equal(f.db.state.creditEntry.filter(e=>e.type==='deduction').length,0);
});
