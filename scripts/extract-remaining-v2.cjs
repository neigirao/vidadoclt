// Re-extração dos inimigos fase 2+ (sheet 22_10_45.png, bg≈[4,6,8]) + Boss Gerente (22_09_24.png, bg=[28,29,28])
// Usa distância de cor para remover fundo, preservando pixels escuros legítimos.
const {PNG}=require('pngjs');const fs=require('fs');const path=require('path');
const DIR=path.join(__dirname,'../public/assets/sprites/');

function loadPNG(file){return PNG.sync.read(fs.readFileSync(file));}
function px(p,x,y){const i=(y*p.width+x)*4;return[p.data[i],p.data[i+1],p.data[i+2],p.data[i+3]];}

// Color-distance BG mask
function bgMask(src,x0,y0,cw,ch,bgR,bgG,bgB,thresh2){
  const keep=new Uint8Array(cw*ch);
  for(let y=0;y<ch;y++)for(let x=0;x<cw;x++){
    const[r,g,b,a]=px(src,x0+x,y0+y);
    if(a<40){keep[y*cw+x]=0;continue;}
    keep[y*cw+x]=((r-bgR)**2+(g-bgG)**2+(b-bgB)**2)>thresh2?1:0;
  }
  return keep;
}

// Flood-fill BG from borders (for gerente where bg≈[28,29,28] but char can have darker pixels)
function floodMask(src,x0,y0,cw,ch,darkThresh){
  const bg=new Uint8Array(cw*ch);
  function isDark(lx,ly){const[r,g,b,a]=px(src,x0+lx,y0+ly);if(a<40)return true;return Math.max(r,g,b)<darkThresh;}
  const st=[];
  const push=(x,y)=>{const i=y*cw+x;if(!bg[i]&&isDark(x,y)){bg[i]=1;st.push(i);}};
  for(let x=0;x<cw;x++){push(x,0);push(x,ch-1);}
  for(let y=0;y<ch;y++){push(0,y);push(cw-1,y);}
  while(st.length){const q=st.pop();const qx=q%cw,qy=q/cw|0;
    for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=qx+dx,ny=qy+dy;
      if(nx<0||ny<0||nx>=cw||ny>=ch)continue;const ni=ny*cw+nx;
      if(!bg[ni]&&isDark(nx,ny)){bg[ni]=1;st.push(ni);}}}
  const keep=new Uint8Array(cw*ch);for(let i=0;i<cw*ch;i++)keep[i]=bg[i]?0:1;
  return keep;
}

function deSpeck(keep,w,h,minPx){
  const lab=new Int32Array(w*h),sz=[0];let cur=0;
  for(let i=0;i<w*h;i++){if(keep[i]&&!lab[i]){cur++;sz.push(0);const s=[i];lab[i]=cur;while(s.length){const q=s.pop();sz[cur]++;const qx=q%w,qy=q/w|0;for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=qx+dx,ny=qy+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;const ni=ny*w+nx;if(keep[ni]&&!lab[ni]){lab[ni]=cur;s.push(ni);}}}}}
  for(let i=0;i<w*h;i++)if(lab[i]&&sz[lab[i]]<minPx)keep[i]=0;
}

function bbox(keep,w,h){let x0=w,y0=h,x1=-1,y1=-1;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(keep[y*w+x]){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}return x1<0?null:[x0,y0,x1,y1];}

function writeFrame(src,sx0,sy0,cw,ch,keep,outW,outH,outFile){
  const bb=bbox(keep,cw,ch);
  const out=new PNG({width:outW,height:outH});for(let i=0;i<outW*outH*4;i++)out.data[i]=0;
  if(!bb){fs.writeFileSync(outFile,PNG.sync.write(out));return 0;}
  const[bx0,by0,bx1,by1]=bb;const bw=bx1-bx0+1,bh=by1-by0+1;
  const sc=Math.min(outW/bw,outH/bh,1);
  const sw=Math.max(1,Math.round(bw*sc)),sh=Math.max(1,Math.round(bh*sc));
  const offX=Math.floor((outW-sw)/2),offY=Math.floor((outH-sh)/2);
  for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){
    const lx=bx0+Math.min(bw-1,(x/sc)|0),ly=by0+Math.min(bh-1,(y/sc)|0);
    if(!keep[ly*cw+lx])continue;
    const si=((sy0+ly)*src.width+(sx0+lx))*4,di=((offY+y)*outW+(offX+x))*4;
    out.data[di]=src.data[si];out.data[di+1]=src.data[si+1];out.data[di+2]=src.data[si+2];out.data[di+3]=255;
  }
  fs.writeFileSync(outFile,PNG.sync.write(out));
  let n=0;for(let i=3;i<out.data.length;i+=4)if(out.data[i]>0)n++;
  return n;
}

// ── Sheet: Phase 2+ enemies (22_10_45.png, bg=[4,6,8]) ──────────────────────
const ESHEET=path.join(DIR,'ChatGPT Image 12 de jun. de 2026, 22_10_45.png');
const EBG=[4,6,8],ET2=400,ECW=80,ECH=100;
const ENEMIES=[
  {prefix:'enemy-senior',      cy:250},
  {prefix:'enemy-telemarketer',cy:340},
  {prefix:'enemy-impressora',  cy:385},
  {prefix:'enemy-guardiao-cafe',cy:430},
  {prefix:'enemy-cabo',        cy:475},
  {prefix:'enemy-evangelista', cy:520},
  {prefix:'enemy-seguranca',   cy:565},
  {prefix:'enemy-ti-suporte',  cy:610},
  {prefix:'enemy-coletor',     cy:655},
  {prefix:'enemy-noticeboard', cy:700},
  {prefix:'enemy-drone',       cy:745},
  {prefix:'enemy-carimbador',  cy:790},
  {prefix:'enemy-planilha',    cy:835},
  {prefix:'enemy-arquivo',     cy:880},
  {prefix:'enemy-bateria',     cy:925},
  {prefix:'enemy-reuniao',     cy:970},
];
const EANIMS=[
  {name:'idle',   xs:[60,100,140,180]},
  {name:'walk',   xs:[240,280,320,360]},
  {name:'attack', xs:[430,470,510]},
  {name:'hurt',   xs:[580]},
  {name:'death',  xs:[650,690,730]},
];

function extractEnemy(src,cx,cy,cw,ch,bg,t2,outW,outH,outFile){
  const x0=Math.max(0,Math.min(Math.round(cx-cw/2),src.width-cw));
  const y0=Math.max(0,Math.min(Math.round(cy-ch/2),src.height-ch));
  const keep=bgMask(src,x0,y0,cw,ch,...bg,t2);
  deSpeck(keep,cw,ch,8);
  const n=writeFrame(src,x0,y0,cw,ch,keep,outW,outH,outFile);
  const pct=(n/outW/outH*100).toFixed(0);
  console.log(` ${n<outW*outH*0.05?'⚠':'✓'} ${path.basename(outFile)} (${n}px ${pct}%)`);
  return n;
}

console.log('\n── Phase 2+ Enemies ─────────────────────────────────────────');
const es=loadPNG(ESHEET);
let total=0,ok=0;
for(const e of ENEMIES){
  let idle0=null;
  for(const anim of EANIMS)
    for(let i=0;i<anim.xs.length;i++){
      const f=path.join(DIR,`${e.prefix}-${anim.name}${i}.png`);
      const n=extractEnemy(es,anim.xs[i],e.cy,ECW,ECH,EBG,ET2,32,48,f);
      total++;if(n>0)ok++;
      if(anim.name==='idle'&&i===0)idle0=f;
    }
  if(idle0)try{fs.copyFileSync(idle0,path.join(DIR,`${e.prefix}.png`));console.log(` alias ${e.prefix}.png`);}catch(e){}
}

// ── Boss Gerente (22_09_24.png, bg=[28,29,28], flood-fill) ───────────────────
// bg is medium-dark gray; use flood-fill from borders (darkThresh=45)
const GSHEET=path.join(DIR,'ChatGPT Image 12 de jun. de 2026, 22_09_24.png');
const GCW=90,GCH=130,GOUTW=44,GOUTH=56;
function bossX(i){return 60+i*85;}
const GANIMS=[
  {name:'idle',           cy:100, xs:[bossX(0),bossX(1)]},
  {name:'walk',           cy:100, xs:[bossX(2),bossX(3),bossX(4),bossX(5)]},
  {name:'run',            cy:100, xs:[bossX(6),bossX(7),bossX(8),bossX(9)]},
  {name:'run-charge',     cy:100, xs:[bossX(10),bossX(11),bossX(12)]},
  {name:'attack-deadline',cy:270, xs:[bossX(0),bossX(1),bossX(2),bossX(3)]},
  {name:'attack-escopo',  cy:270, xs:[bossX(4),bossX(5),bossX(6),bossX(7)]},
  {name:'attack-sprint',  cy:270, xs:[bossX(8),bossX(9),bossX(10)]},
  {name:'hurt',           cy:430, xs:[bossX(0),bossX(1),bossX(2)]},
  {name:'death',          cy:430, xs:[bossX(3),bossX(4),bossX(5)]},
];

console.log('\n── Boss Gerente ─────────────────────────────────────────────');
const gs=loadPNG(GSHEET);
let idle0g=null;
for(const anim of GANIMS){
  for(let i=0;i<anim.xs.length;i++){
    const cx=anim.xs[i],cy=anim.cy;
    const x0=Math.max(0,Math.min(Math.round(cx-GCW/2),gs.width-GCW));
    const y0=Math.max(0,Math.min(Math.round(cy-GCH/2),gs.height-GCH));
    const keep=floodMask(gs,x0,y0,GCW,GCH,45);
    deSpeck(keep,GCW,GCH,8);
    const outFile=path.join(DIR,`enemy-gerente-${anim.name}${i}.png`);
    const n=writeFrame(gs,x0,y0,GCW,GCH,keep,GOUTW,GOUTH,outFile);
    const pct=(n/GOUTW/GOUTH*100).toFixed(0);
    console.log(` ${n<GOUTW*GOUTH*0.05?'⚠':'✓'} ${path.basename(outFile)} (${n}px ${pct}%)`);
    total++;if(n>0)ok++;
    if(anim.name==='idle'&&i===0)idle0g=outFile;
  }
}
const gerenteSuffixes=['idle','walk','attack'];
gerenteSuffixes.forEach(s=>{
  const src=path.join(DIR,`enemy-gerente-${s}0.png`);
  const dst=path.join(DIR,`enemy-gerente-${s}.png`);
  try{fs.copyFileSync(src,dst);console.log(` alias enemy-gerente-${s}.png`);}catch(e){}
});
if(idle0g)try{fs.copyFileSync(idle0g,path.join(DIR,'enemy-gerente.png'));console.log(' alias enemy-gerente.png');}catch(e){}

console.log(`\n── Done: ${ok}/${total} frames with content ─────────────`);
