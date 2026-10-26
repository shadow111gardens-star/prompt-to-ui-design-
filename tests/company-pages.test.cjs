const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
function load(file){const filename=path.resolve(file),mod=new Module(filename,module);mod.paths=Module._nodeModulePaths(path.dirname(filename));mod.require=request=>request.startsWith('@/')?load(request.slice(2)+'.ts'):Module.prototype.require.call(mod,request);mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);return mod.exports;}

test('Careers is absent from site routes and company footer',()=>{
 const {sitePages,footerGroups}=load('lib/site-pages.ts');assert.equal(Object.hasOwn(sitePages,'careers'),false);assert.deepEqual(footerGroups.find(group=>group.title==='Company').items,['About','Blog','Contact']);
});

test('each original guide has a real local cover, full article content, unique section anchors and a calculated reading time',()=>{
 const {blogArticles,articleReadingMinutes}=load('lib/blog-content.ts');assert.equal(Object.keys(blogArticles).length,5);
 for(const article of Object.values(blogArticles)){
  assert.ok(fs.existsSync(path.join('public',article.cover.src)));assert.ok(article.cover.alt.length>15);assert.ok(article.sections.length>=5);assert.ok(articleReadingMinutes(article)>=2);
  const words=article.sections.flatMap(section=>[section.text,...(section.paragraphs||[]),...(section.bullets||[]),section.example||'']).join(' ').split(/\s+/).length;assert.ok(words>400,article.title);
  const anchors=article.sections.map(section=>section.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''));assert.equal(new Set(anchors).size,anchors.length);
 }
});

test('contact draft uses the fixed recipient and preserves name, reply email and encoded message without adding headers',()=>{
 const {createContactEmail,CONTACT_EMAIL}=load('lib/contact-email.ts');const input={name:'Abhay Solanki',email:'reader@example.com',subject:'Product question',message:'Help with layout & export?\nKeep # colors and + symbols.'};
 const uri=new URL(createContactEmail(input));assert.equal(uri.protocol,'mailto:');assert.equal(uri.pathname,CONTACT_EMAIL);assert.equal(uri.searchParams.get('subject'),'OpenUI: Product question — Abhay Solanki');assert.equal(uri.searchParams.get('body'),`Name: ${input.name}\nReply email: ${input.email}\n\n${input.message}`);assert.equal(uri.searchParams.has('cc'),false);assert.equal(uri.searchParams.has('bcc'),false);
 for(const patch of [{name:''},{name:'Name\r\nBcc: injected@example.com'},{email:'not-an-email'},{message:'tiny'},{message:'x'.repeat(2001)},{subject:'Arbitrary header'}])assert.throws(()=>createContactEmail({...input,...patch}));
});
