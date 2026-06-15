// Re-extração robusta dos inimigos da Fase 1 (sheet "INIMIGOS COMUNS").
// Mesma técnica do player: bandas por inkprofile, personagens por picos de
// densidade, bg por distância de cor, escala uniforme por inimigo + pés.
const {PNG}=require('pngjs');const fs=require('fs');
const SRC='public/assets/sprites/ChatGPT Image 12 de jun. de 2026, 22_07_15.png';
const DIR='public/assets/sprites/';
const p=PNG.sync.read(fs.readFileSync(SRC));const W=p.width,H=p.height;
const BG=[14,15,15],D2=15*15;
function ink(x,y){const i=(y*W+x)*4;if(p.data[i+3]<=40)return false;const dr=p.data[i]-BG[0],dg=p.data[i+1]-BG[1],db=p.data[i+2]-BG[2];return dr*dr+dg*dg+db*db>D2;}
function prof(y0,y1){const yM=y0+((y1-y0)*0.3|0);const c=new Float64Array(W);for(let x=0;x<W;x++){let n=0;for(let y=yM;y<=y1;y++)if(ink(x,y))n++;c[x]=n;}return c;}
function chs(y0,y1){const a=new Int32Array(W);for(let x=0;x<W;x++){let mn=-1,mx=-1;for(let y=y0;y<=y1;y++)if(ink(x,y)){if(mn<0)mn=y;mx=y;}a[x]=mx<0?0:mx-mn+1;}return a;}
function sm(a,w){const o=new Float64Array(a.length),h=w>>1;for(let i=0;i<a.length;i++){let s=0,n=0;for(let j=-h;j<=h;j++){const k=i+j;if(k>=0&&k<a.length){s+=a[k];n++;}}o[i]=s/n;}return o;}
function peaks(col,N,md,ch,mh){const s=sm(col,7),c=[];for(let i=2;i<W-2;i++){if(ch[i]<mh)continue;if(s[i]>0&&s[i]>=s[i-1]&&s[i]>=s[i+1]&&s[i]>s[i-2]&&s[i]>s[i+2])c.push([i,s[i]]);}c.sort((a,b)=>b[1]-a[1]);const r=[];for(const[x]of c){if(r.every(q=>Math.abs(q-x)>=md))r.push(x);if(r.length>=N)break;}r.sort((a,b)=>a-b);return r;}
function cleanMask(x0,x1,y0,y1,minComp){const w=x1-x0+1,h=y1-y0+1,m=new Uint8Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++)m[y*w+x]=ink(x0+x,y0+y)?1:0;const lab=new Int32Array(w*h),sz=[0];let cur=0;for(let i=0;i<w*h;i++){if(m[i]&&!lab[i]){cur++;sz.push(0);const st=[i];lab[i]=cur;while(st.length){const q=st.pop();sz[cur]++;const qx=q%w,qy=q/w|0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=qx+dx,ny=qy+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;const ni=ny*w+nx;if(m[ni]&&!lab[ni]){lab[ni]=cur;st.push(ni);}}}}}const keep=new Uint8Array(w*h);for(let i=0;i<w*h;i++)if(lab[i]&&sz[lab[i]]>=minComp)keep[i]=1;return{keep,w,h};}
function bbox(keep,w,h){let mnx=w,mny=h,mxx=-1,mxy=-1;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(keep[y*w+x]){if(x<mnx)mnx=x;if(x>mxx)mxx=x;if(y<mny)mny=y;if(y>mxy)mxy=y;}return mxx<0?null:[mnx,mny,mxx,mxy];}

const ENEMIES=[
 {prefix:'enemy-estagiario',y0:146,y1:247},
 {prefix:'enemy-analista',  y0:330,y1:432},
 {prefix:'enemy-facilitador',y0:518,y1:617},
 {prefix:'enemy-scrum',     y0:692,y1:789},
 {prefix:'enemy-coordenador',y0:866,y1:962},
];
const SECS=[['idle',4],['walk',4],['attack',3],['hurt',1],['death',3]]; // 15
const N=15, OUT_W=32,OUT_H=48,MARGIN=1;
const allCells=[];
for(const e of ENEMIES){
  const col=prof(e.y0,e.y1),ch=chs(e.y0,e.y1);
  const pk=peaks(col,N,48,ch,40);
  const names=[];for(const[nm,n]of SECS)for(let i=0;i<n;i++)names.push(`${e.prefix}-${nm}${i}`);
  const cells=[];
  pk.forEach((px,i)=>{const lo=i===0?Math.max(0,px-48):Math.round((pk[i-1]+px)/2);const hi=i===pk.length-1?Math.min(W-1,px+48):Math.round((px+pk[i+1])/2)-1;const {keep,w,h}=cleanMask(lo,hi,e.y0,e.y1,18);const bb=bbox(keep,w,h);cells.push({name:names[i]||`${e.prefix}-x${i}`,ox0:lo,oy0:e.y0,keep,w,h,bb});});
  console.log(e.prefix+': '+pk.length+'/'+N+' picos');
  allCells.push({enemy:e,cells});
}
// montagem de verificação
const cols=15,rows=ENEMIES.length,cw=OUT_W*2+4,chh=OUT_H*2+4;
const MW=cols*cw+4,MH=rows*chh+4;const out=new PNG({width:MW,height:MH});
for(let i=0;i<MW*MH;i++){const k=i*4;out.data[k]=20;out.data[k+1]=80;out.data[k+2]=20;out.data[k+3]=255;}
allCells.forEach((grp,r)=>{grp.cells.forEach((c,ci)=>{if(!c.bb)return;const[mnx,mny,mxx,mxy]=c.bb;const bw=mxx-mnx+1,bh=mxy-mny+1;const sc=Math.min((OUT_W*2)/bw,(OUT_H*2)/bh,2);const sw=Math.round(bw*sc),sh=Math.round(bh*sc);const ox=4+ci*cw+((OUT_W*2-sw)>>1),oy=4+r*chh+((OUT_H*2-sh)>>1);for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){const lx=mnx+Math.min(bw-1,(x/sc)|0),ly=mny+Math.min(bh-1,(y/sc)|0);if(!c.keep[ly*c.w+lx])continue;const si=((c.oy0+ly)*W+(c.ox0+lx))*4,dx=ox+x,dy=oy+y;if(dx<0||dy<0||dx>=MW||dy>=MH)continue;const di=(dy*MW+dx)*4;out.data[di]=p.data[si];out.data[di+1]=p.data[si+1];out.data[di+2]=p.data[si+2];out.data[di+3]=255;}});});
fs.writeFileSync('/tmp/enemy_check.png',PNG.sync.write(out));
console.log('montage /tmp/enemy_check.png');
// exportar para escrita se VERIFICADO (segunda passada via flag)
if(process.argv[2]==='write'){
  let n=0;
  for(const grp of allCells){
    const heights=grp.cells.filter(c=>c.bb).map(c=>c.bb[3]-c.bb[1]+1);
    const refH=Math.max(...heights);let scale=(OUT_H-MARGIN)/refH;
    for(const c of grp.cells){if(!c.bb)continue;const[mnx,mny,mxx,mxy]=c.bb;const bw=mxx-mnx+1,bh=mxy-mny+1;const sw=Math.max(1,Math.round(bw*scale)),sh=Math.max(1,Math.round(bh*scale));const o=new PNG({width:OUT_W,height:OUT_H});for(let i=0;i<OUT_W*OUT_H;i++)o.data[i*4+3]=0;const ox=(OUT_W-sw)>>1,oy=OUT_H-MARGIN-sh;for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){const lx=mnx+Math.min(bw-1,(x/scale)|0),ly=mny+Math.min(bh-1,(y/scale)|0);if(!c.keep[ly*c.w+lx])continue;const si=((c.oy0+ly)*W+(c.ox0+lx))*4,dx=ox+x,dy=oy+y;if(dx<0||dy<0||dx>=OUT_W||dy>=OUT_H)continue;const di=(dy*OUT_W+dx)*4;o.data[di]=p.data[si];o.data[di+1]=p.data[si+1];o.data[di+2]=p.data[si+2];o.data[di+3]=255;}fs.writeFileSync(DIR+c.name+'.png',PNG.sync.write(o));n++;}
    // alias prefix.png = idle0
    try{fs.copyFileSync(DIR+grp.enemy.prefix+'-idle0.png',DIR+grp.enemy.prefix+'.png')}catch(e){}
  }
  console.log('frames escritos:',n);
}
