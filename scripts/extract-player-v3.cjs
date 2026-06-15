const {PNG}=require('pngjs');const fs=require('fs');
const SRC='public/assets/sprites/ChatGPT Image 12 de jun. de 2026, 22_07_12.png';
const DIR='public/assets/sprites/';
const p=PNG.sync.read(fs.readFileSync(SRC));const W=p.width,H=p.height;const T=60;
function ink(x,y){const i=(y*W+x)*4;return !(p.data[i]<T&&p.data[i+1]<T&&p.data[i+2]<T)&&p.data[i+3]>40;}
function prof(y0,y1){const yMid=y0+Math.floor((y1-y0)*0.35);const col=new Float64Array(W);for(let x=0;x<W;x++){let c=0;for(let y=yMid;y<=y1;y++)if(ink(x,y))c++;col[x]=c;}return col;}
function colHeights(y0,y1){const ch=new Int32Array(W);for(let x=0;x<W;x++){let mn=-1,mx=-1;for(let y=y0;y<=y1;y++)if(ink(x,y)){if(mn<0)mn=y;mx=y;}ch[x]=mx<0?0:mx-mn+1;}return ch;}
function smooth(a,w){const o=new Float64Array(a.length);const h=w>>1;for(let i=0;i<a.length;i++){let s=0,n=0;for(let j=-h;j<=h;j++){const k=i+j;if(k>=0&&k<a.length){s+=a[k];n++;}}o[i]=s/n;}return o;}
function topPeaks(col,N,minDist,ch,minH){const s=smooth(col,9);const cand=[];for(let i=2;i<W-2;i++){if(ch[i]<minH)continue;if(s[i]>0&&s[i]>=s[i-1]&&s[i]>=s[i+1]&&s[i]>s[i-2]&&s[i]>s[i+2])cand.push([i,s[i]]);}cand.sort((a,b)=>b[1]-a[1]);const pk=[];for(const [x] of cand){if(pk.every(q=>Math.abs(q-x)>=minDist))pk.push(x);if(pk.length>=N)break;}pk.sort((a,b)=>a-b);return pk;}
function bbox(x0,x1,y0,y1){let mnx=x1,mny=y1,mxx=x0,mxy=y0,f=false;for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)if(ink(x,y)){f=true;if(x<mnx)mnx=x;if(x>mxx)mxx=x;if(y<mny)mny=y;if(y>mxy)mxy=y;}return f?[mnx,mny,mxx,mxy]:null;}
const BANDS=[
 {y0:184,y1:332,N:22,minD:55,secs:[['idle',6],['walk',8],['run',8]]},
 {y0:401,y1:508,N:17,minD:60,secs:[['jump',4],['fall',3],['attack',6],['dash',4]]},
 {y0:589,y1:734,N:9,minD:75,xMax:1210,secs:[['hurt',2],['interact',3],['burnout',4]]},
];
const cells=[];
for(const b of BANDS){
  const col=prof(b.y0,b.y1),ch=colHeights(b.y0,b.y1);
  if(b.xMax)for(let x=b.xMax;x<W;x++){col[x]=0;ch[x]=0;}
  const peaks=topPeaks(col,b.N,b.minD,ch,70);
  const names=[];for(const [nm,n] of b.secs)for(let i=0;i<n;i++)names.push(`player-${nm}${i}`);
  peaks.forEach((px,i)=>{const lo=i===0?Math.max(0,px-b.minD):Math.round((peaks[i-1]+px)/2);const hi=i===peaks.length-1?Math.min((b.xMax||W)-1,px+b.minD):Math.round((px+peaks[i+1])/2)-1;const bb=bbox(lo,hi,b.y0,b.y1);cells.push({name:names[i],bb});});
}
// escala uniforme: usar altura máxima dos WALK como referência, garantir que nada estoure 64
const OUT_W=48,OUT_H=64,MARGIN=2;
const walkH=cells.filter(c=>c.name.startsWith('player-walk')&&c.bb).map(c=>c.bb[3]-c.bb[1]+1);
const maxAllH=Math.max(...cells.filter(c=>c.bb).map(c=>c.bb[3]-c.bb[1]+1));
const refH=Math.max(...walkH);
let scale=(OUT_H-MARGIN)/refH;
if(maxAllH*scale>OUT_H) scale=(OUT_H)/maxAllH; // nunca estoura
console.log('refH(walk)='+refH+' maxAllH='+maxAllH+' scale='+scale.toFixed(3));
let written=0;
for(const c of cells){
  if(!c.bb){console.warn('sem bbox:',c.name);continue;}
  const [mnx,mny,mxx,mxy]=c.bb;const cw=mxx-mnx+1,chh=mxy-mny+1;
  const sw=Math.max(1,Math.round(cw*scale)),sh=Math.max(1,Math.round(chh*scale));
  const out=new PNG({width:OUT_W,height:OUT_H});
  for(let i=0;i<OUT_W*OUT_H;i++){out.data[i*4+3]=0;}
  const ox=Math.floor((OUT_W-sw)/2), oy=OUT_H-MARGIN-sh; // bottom-align (pés)
  for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){
    const srcx=mnx+Math.min(cw-1,Math.floor(x/scale)),srcy=mny+Math.min(chh-1,Math.floor(y/scale));
    if(!ink(srcx,srcy))continue;
    const dx=ox+x,dy=oy+y;if(dx<0||dy<0||dx>=OUT_W||dy>=OUT_H)continue;
    const si=(srcy*W+srcx)*4,di=(dy*OUT_W+dx)*4;
    out.data[di]=p.data[si];out.data[di+1]=p.data[si+1];out.data[di+2]=p.data[si+2];out.data[di+3]=255;
  }
  fs.writeFileSync(DIR+c.name+'.png',PNG.sync.write(out));written++;
}
// aliases que o jogo referencia
const cp=(a,b)=>{try{fs.copyFileSync(DIR+a,DIR+b)}catch(e){}};
cp('player-walk0.png','player.png'); cp('player-idle1.png','player-idle.png');
cp('player-jump1.png','player-jump.png'); cp('player-fall0.png','player-fall.png');
cp('player-attack2.png','player-attack.png'); cp('player-dash0.png','player-dash.png');
console.log('frames escritos:',written);
