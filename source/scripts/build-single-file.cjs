// Builds BiblioScope as one self-contained HTML file (../index.html), as published on GitHub Pages.
// Usage (in source/):  npm install  &&  npm run build:single
// The world map (world-atlas) is fetched at run time from a CDN, so the file stays small; everything else is bundled.
const path = require('path');
const fs = require('fs');
const esbuild = require('esbuild');
const pkg = require('../package.json');

const root = path.resolve(__dirname, '..');
const out = process.argv[2] || path.resolve(root, '..', 'index.html');
// package.json uses semver (0.9.92); the app shows 0.992
const shown = pkg.version.replace(/^0\.(\d+)\.(\d+)$/, (_, a, b) => `0.${a}${b}`);

// Minimal topojson.feature (only what the map uses), to avoid bundling topojson-client's extra code
const shimTopo = `
export function feature(topo, o){
  const sc = topo.transform;
  const arcs = topo.arcs.map(a => { let x=0,y=0; return a.map(p => { if(sc){ x+=p[0]; y+=p[1]; return [x*sc.scale[0]+sc.translate[0], y*sc.scale[1]+sc.translate[1]]; } return p; }); });
  const arc = i => (i < 0 ? arcs[~i].slice().reverse() : arcs[i]);
  const ring = ids => { const out=[]; ids.forEach((id,k)=>{ const a=arc(id); out.push(...(k?a.slice(1):a)); }); return out; };
  const geom = g => {
    if(!g) return null;
    if(g.type==="GeometryCollection") return {type:"GeometryCollection", geometries:g.geometries.map(geom)};
    switch(g.type){
      case "Polygon": return {type:"Polygon", coordinates:g.arcs.map(ring)};
      case "MultiPolygon": return {type:"MultiPolygon", coordinates:g.arcs.map(p=>p.map(ring))};
      case "LineString": return {type:"LineString", coordinates:ring(g.arcs)};
      case "MultiLineString": return {type:"MultiLineString", coordinates:g.arcs.map(ring)};
      default: return null;
    }
  };
  if(o.type==="GeometryCollection") return {type:"FeatureCollection", features:o.geometries.map(g=>({type:"Feature", id:g.id, properties:g.properties||{}, geometry:geom(g)}))};
  return {type:"Feature", id:o.id, properties:o.properties||{}, geometry:geom(o)};
}`;
const worldAtRuntime = `const urls=["https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json","https://unpkg.com/world-atlas@2/countries-50m.json","https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"];
let data=null; for(const u of urls){ try{ const r=await fetch(u); if(r.ok){ data=await r.json(); break; } }catch(e){} }
if(!data) throw new Error("world-atlas unavailable"); export default data;`;
const shims = {
  name: 'shims',
  setup(b) {
    b.onResolve({ filter: /^world-atlas\/countries-50m\.json$/ }, () => ({ path: 'world', namespace: 'shim' }));
    b.onResolve({ filter: /^topojson-client$/ }, () => ({ path: 'topo', namespace: 'shim' }));
    b.onLoad({ filter: /.*/, namespace: 'shim' }, a => ({ loader: 'js', contents: a.path === 'world' ? worldAtRuntime : shimTopo }));
  },
};

esbuild.build({
  entryPoints: [path.join(root, 'src', 'main.jsx')], bundle: true, format: 'esm', minify: true, write: false,
  jsx: 'automatic', loader: { '.jsx': 'jsx', '.css': 'css' }, define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [shims], target: 'es2022', outdir: path.join(root, '.single-build'), absWorkingDir: root,
}).then(r => {
  const js = r.outputFiles.filter(f => f.path.endsWith('.js')).map(f => f.text).join('\n').replace(/<\/script/gi, '<\\/script');
  const css = r.outputFiles.filter(f => f.path.endsWith('.css')).map(f => f.text).join('\n');
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>BiblioScope ${shown}</title>
<style>html,body{margin:0;background:#0c0f14}${css}</style>
</head>
<body>
<div id="root"></div>
<script type="module">${js}</script></body></html>`;
  fs.writeFileSync(out, html);
  console.log(`Wrote ${out} (${(html.length / 1024).toFixed(0)} kB), BiblioScope ${shown}`);
}).catch(e => { console.error('Build failed:', e.message); process.exit(1); });
