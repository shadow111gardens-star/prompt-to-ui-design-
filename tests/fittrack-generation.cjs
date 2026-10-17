const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
require('dotenv').config({path: '.env.local', quiet: true});
const { generateText } = require('ai');
const filename = path.resolve('lib/ai/provider-registry.ts');
const registry = new Module(filename, module);
registry.filename = filename;
registry.paths = Module._nodeModulePaths(path.dirname(filename));
registry._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'), {
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText,filename);
const system = `You are a senior mobile product designer. Return a complete runnable HTML fragment with scoped CSS, root id="fittrack-app", and exactly three complete screen sections data-screen="home", data-screen="workout", data-screen="profile". Show all three screens side-by-side as compact mobile designs on desktop, stacking at narrow widths. No libraries, no Tailwind, no external assets, no markdown or explanations. Use premium typography, polished Lucide-style icons, and meaningful inline vector workout illustrations because this text-only call cannot generate photographs. Use a real seven-day chart with visible data marks, an activity progress ring and realistic values. Keep each screen dense but breathable, around 390px wide and 850-1000px tall; no fixed positioning or viewport-height units. Use the exact supplied dark palette and lime accent, never the project's unrelated default theme. Use shared CSS for all screens. Every bottom nav must link to the corresponding screen via data-target="home|workout|profile"; Start Workout and Start Session must have data-target="workout". Include a labeled session status area. No inline handlers or scripts. All content must fit at 320px. No broken images or placeholders. Decorative icons may use CSS or inline SVG. Include accessible labels and unique IDs. Finish all three screens before stopping.`;
(async()=>{
 const projects = await (await fetch('http://127.0.0.1:3000/api/projects')).json();
 if(!projects[0]?._id) throw new Error('No selected project');
 const project=await (await fetch('http://127.0.0.1:3000/api/projects/'+projects[0]._id)).json();
 const {provider,model:modelId}=project.settings;
 const prompt=fs.readFileSync('reports/fittrack-prompt.txt','utf8');
 console.log(JSON.stringify({provider,model:modelId,submittedCalls:1}));
 const started=Date.now();
 const result=await generateText({model:registry.exports.getLanguageModel(provider,modelId),system,prompt,maxRetries:0,abortSignal:AbortSignal.timeout(180000)});
 const html=result.text.replace(/^\s*```(?:html)?\s*/i,'').replace(/\s*```\s*$/,'');
 fs.writeFileSync('reports/fittrack-generated.html',html);
 const report={prompt,system,provider,model:modelId,apiCalls:1,automaticRetries:0,elapsedSeconds:(Date.now()-started)/1000,usage:result.totalUsage,finishReason:result.finishReason,htmlCharacters:html.length,testPath:'Project provider registry and AI SDK; direct single call with user theme, not the generation HTTP route',checks:{home:/data-screen=["']home["']/.test(html),workout:/data-screen=["']workout["']/.test(html),profile:/data-screen=["']profile["']/.test(html),lime:/#c6ff4d/i.test(html),noExternalAssets:!/(?:src|href)=["']https?:/i.test(html),noScripts:!/<script[\s>]/i.test(html)}};
 fs.writeFileSync('reports/fittrack-result.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({...report,prompt:undefined,system:undefined},null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
