// collect every main trail with a path (trails-data + osm + board + region bundles + board-line-routes) -> work/main_trails.json
const vm=require('vm'),fs=require('fs'),path=require('path');
const R=process.argv[2],OUT=process.argv[3];
const out=new Map();
function add(id,p){ if(!p||p.length<2) return; if(!out.has(id)) out.set(id,p.map(x=>[+x[0],+x[1]])); }
const ctx={window:{},console,document:undefined};ctx.window=ctx;vm.createContext(ctx);
for(const f of ['trails-data.js','osm-trails-data.js','board-trails-data.js']){
  try{vm.runInContext(fs.readFileSync(path.join(R,f),'utf8'),ctx,{filename:f});}catch(e){console.error(f,e.message)}
}
let tr; try{tr=vm.runInContext('typeof trails!=="undefined"?trails:null',ctx);}catch(e){}
console.error('trails global',tr&&tr.length);
for(const t of tr||[]) add(t.id,t.path);
for(const f of fs.readdirSync(path.join(R,'data/regions')).filter(f=>f.endsWith('-trails.js'))){
  const c2={console};c2.window=c2;vm.createContext(c2);
  try{vm.runInContext(fs.readFileSync(path.join(R,'data/regions',f),'utf8'),c2);}catch(e){console.error(f,e.message)}
  for(const k of Object.keys(c2)){const v=c2[k]; if(Array.isArray(v)) for(const t of v) if(t&&t.id&&t.path) add(t.id,t.path);}
  try{const v=vm.runInContext('typeof trails!=="undefined"?trails:[]',c2); for(const t of v) add(t.id,t.path);}catch(e){}
}
const g=JSON.parse(fs.readFileSync(path.join(R,'data/board-line-routes.geojson')));
for(const f of g.features){const c=f.geometry.type==='MultiLineString'?f.geometry.coordinates.flat():f.geometry.coordinates; add('blr:'+f.properties.trail_id,c.map(x=>[x[1],x[0]]));}
const arr=[...out].map(([id,p])=>({id,path:p}));
fs.writeFileSync(OUT,JSON.stringify(arr));console.error('total',arr.length);
