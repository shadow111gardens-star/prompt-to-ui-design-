const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function nodes(tree){if(!tree||typeof tree!=='object')return[];return[tree,...[tree.props?.children].flat(Infinity).flatMap(nodes)];}
function harness(file,auth,helpers={}){
 const slots=[],effects=[];let cursor=0;const hooks={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return[slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v];},useRef(value){const i=cursor++;return slots[i]??={current:value};},useEffect:fn=>effects.push(fn)};
 const filename=path.resolve(file),mod=new Module(filename,module);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));
 mod.require=function(request){if(request==='react')return hooks;if(request==='@/components/auth/provider')return{useAuth:()=>auth};if(request==='@/lib/firebase/email-verification')return helpers;if(request==='@/lib/firebase/errors')return{authErrorMessage:e=>e.message};if(request==='next/navigation')return{useRouter:()=>({replace:helpers.redirect}),usePathname:()=>'/dashboard/workspace',useSearchParams:()=>new URLSearchParams()};if(request==='next/image'||request==='next/link'||request==='@/components/navbar/theme-toggle')return{__esModule:true,default:()=>null};return Module.prototype.require.call(this,request);};
 mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,filename);
 return{render(){cursor=0;return mod.exports.default({children:'protected-content'});},mount(){return effects.splice(0).map(fn=>fn());}};
}
test('verification page renders email, cooldown, resend failure and reload confirmation before session/redirect',async t=>{
 const previous=global.window;let target;global.window={location:{search:'',replace:v=>target=v}};t.after(()=>global.window=previous);
 let wait=60,confirmed=false,sends=0;const calls=[];
 const auth={ready:true,user:{uid:'user',email:'person@example.test'},requiresVerification:true,establish:async()=>calls.push('session'),logout:async()=>calls.push('logout')};
 const h=harness('components/auth/verify-email.tsx',auth,{verificationWait:()=>wait,sendVerification:async()=>{sends++;throw Error('Email service unavailable');},refreshVerifiedUser:async()=>{calls.push('reload');return confirmed;}});
 h.render();const cleanup=h.mount();t.after(()=>cleanup.forEach(fn=>fn?.()));
 let tree=h.render();assert.ok(nodes(tree).some(n=>n.props?.children==='person@example.test'));assert.equal(nodes(tree).find(n=>n.type==='button'&&String(n.props.children).startsWith('Resend')).props.disabled,true);
 const check=()=>nodes(h.render()).find(n=>n.type==='button'&&n.props.children==="I've verified my email");check().props.onClick();assert.ok(nodes(h.render()).some(n=>n.props?.children==='Checking...'));await flush();assert.equal(target,undefined);assert.ok(nodes(h.render()).some(n=>n.props?.role==='status'&&n.props.children.includes('not verified yet')));
 wait=0;check().props.onClick();await flush();nodes(h.render()).find(n=>n.type==='button'&&n.props.children==='Resend verification email').props.onClick();await flush();assert.equal(sends,1);assert.ok(nodes(h.render()).some(n=>n.props?.role==='alert'&&n.props.children==='Email service unavailable'));
 confirmed=true;check().props.onClick();await flush();assert.equal(calls.at(-1),'session');assert.equal(target,'/dashboard/workspace');
});
test('client protected layout never renders workspace for pending password users',()=>{
 let target;const h=harness('components/auth/protected.tsx',{ready:true,user:{uid:'pending'},requiresVerification:true},{redirect:v=>target=v});const tree=h.render();h.mount();assert.notEqual(tree,'protected-content');assert.equal(target,'/verify-email');
 const verified=harness('components/auth/protected.tsx',{ready:true,user:{uid:'verified'},requiresVerification:false});assert.equal(verified.render(),'protected-content');
});
