const fs=require('fs');
(async()=>{
const base='http://127.0.0.1:3000';const projectId='cmvakps5q0001vsuyhcxbneun';const p=await(await fetch(base+'/api/projects/'+projectId)).json();fs.writeFileSync('reports/canvas-before-screen-layout.json',JSON.stringify({sketchesData:p.sketchesData,viewportData:p.viewportData},null,2));
const data=p.sketchesData;const entities=data.shapes.entities;const fragments=JSON.parse(fs.readFileSync('reports/fittrack-canvas-screens.json','utf8'));const old=Object.values(entities).filter(s=>!String(s.id).startsWith('fittrack-canvas-'));const y=Math.max(100,...old.map(s=>s.y+s.h))+150;
for(const [i,item]of fragments.entries()){const id='fittrack-canvas-'+item.screen;entities[id]={id,type:'generatedui',x:100+i*425,y,w:375,h:980,uiSpecData:item.html,sourceFrameId:'fittrack-source-'+item.screen,screenName:'FitTrack · '+({home:'Home Dashboard',workout:'Workout',profile:'Profile'})[item.screen],isGenerating:false,stroke:'transparent',strokeWidth:0,fill:null};if(!data.shapes.ids.includes(id))data.shapes.ids.push(id);}
data.selected={};const viewportData={scale:0.45,translate:{x:30,y:80-y*0.45}};
const r=await fetch(base+'/api/autosave',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId,shapesData:data,viewportData})});if(!r.ok)throw new Error(await r.text());console.log(JSON.stringify({saved:true,screenCount:3,viewportWidth:375,y,preservedPreviousShapes:old.length}));
})();
