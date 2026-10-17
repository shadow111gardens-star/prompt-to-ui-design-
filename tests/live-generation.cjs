const fs = require('node:fs');
const path = require('node:path');
const prompt = 'Design a polished responsive SaaS analytics dashboard named Pulse. Include a sidebar (Overview, Analytics, Customers, Settings), a header with date range and Export button, four KPI cards (Revenue, Active users, Conversion, Churn), a seven-day revenue chart, and a recent-orders table with five rows and status badges. Use realistic sample data, clear hierarchy, accessible contrast and labels. On mobile collapse the sidebar and stack cards. Follow the project design tokens. Use an inline SVG or CSS bar chart with exactly seven labeled daily values, not a placeholder. Give major components unique descriptive IDs. Make the header wrap on narrow screens. Use only the provided token colors including status badges. Return only the generated UI HTML.';
(async () => {
 const base = 'http://127.0.0.1:3000';
 const projects = await (await fetch(base + '/api/projects')).json();
 const projectId = projects[0]?._id;
 if (!projectId) throw new Error('No project available');
 const project = await (await fetch(base + '/api/projects/' + projectId)).json();
 console.log(JSON.stringify({ provider: project.settings?.provider, model: project.settings?.model }));
 const form = new FormData();
 for (const [k,v] of Object.entries({ projectId, prompt, deviceType: 'web', includeDrawing: 'false', selectedImageIds: '[]', variantCount: '1', streamId: 'generation-audit' })) form.set(k,v);
 const start = Date.now();
 let html = '', buffer = '', metadata = null, error = null, status = null;
 try {
  const response = await fetch(base + '/api/generate', {method:'POST', body:form, signal:AbortSignal.timeout(180000)});
  status=response.status;
  if (!response.ok) throw new Error(await response.text());
  const decoder=new TextDecoder();
  for await (const bytes of response.body) {
   buffer+=decoder.decode(bytes,{stream:true});
   let boundary;
   while((boundary=buffer.indexOf('\n\n'))!==-1){const msg=buffer.slice(0,boundary);buffer=buffer.slice(boundary+2);if(!msg.startsWith('data: '))continue;const packet=JSON.parse(msg.slice(6));if(packet.type==='usage')metadata=packet;else if(typeof packet.text==='string')html+=packet.text;}
  }
 } catch(e) { error=e.message; }
 const checks={ nonempty:html.length>0, wrapper:/data-generated-ui/.test(html), brand:/Pulse/i.test(html), fourMetrics:['Revenue','Active users','Conversion','Churn'].every(x=>html.toLowerCase().includes(x.toLowerCase())), table:/<table[\s>]/i.test(html), realChart:/<svg[\s>]|role=["']img["']|aria-label=["'][^"']*(?:chart|revenue)/i.test(html) && !/Chart Visualization|chart placeholder/i.test(html), componentIds:/id=["'][^"']+["']/i.test(html), responsive:/md:|lg:|@media/.test(html), noScripts:!/<script[\s>]/i.test(html), noMarkdown:!/^\s*```/.test(html) };
 const report={prompt,provider:project.settings?.provider,model:project.settings?.model,status,elapsedSeconds:(Date.now()-start)/1000,providerRequestsSubmitted:1,automaticRetries:0,htmlCharacters:html.length,metadata,checks,error};
 fs.mkdirSync('reports',{recursive:true});
 fs.writeFileSync('reports/generation-result.html',html);
 fs.writeFileSync('reports/generation-result.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
})();
