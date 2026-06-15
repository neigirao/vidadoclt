// Re-extração robusta dos 9 chefões (sheet "CHEFÕES"). BG preto puro → flood-fill.
const {PNG}=require('pngjs');const fs=require('fs');
const SRC='public/assets/sprites/ChatGPT Image 12 de jun. de 2026, 22_13_52.png';
const DIR='public/assets/sprites/';
const p=PNG.sync.read(fs.readFileSync(SRC));const W=p.width,H=p.height;
const DARK=30; // bg preto: max canal < DARK
function dark(x,y){const i=(y*W+x)*4;if(p.data[i+3]<=40)return true;return Math.max(p.data[i],p.data[i+1],p.data[i+2])<DARK;}
function ink(x,y){return !dark(x,y);}
function prof(y0,y1){const yM=y0+((y1-y0)*0.3|0);const c=new Float64Array(W);for(let x=0;x<W;x++){let n=0;for(let y=yM;y<=y1;y++)if(ink(x,y))n++;c[x]=n;}return c;}
function chs(y0,y1){const a=new Int32Array(W);for(let x=0;x<W;x++){let mn=-1,mx=-1;for(let y=y0;y<=y1;y++)if(ink(x,y)){if(mn<0)mn=y;mx=y;}a[x]=mx<0?0:mx-mn+1;}return a;}
function sm(a,w){const o=new Float64Array(a.length),h=w>>1;for(let i=0;i<a.length;i++){let s=0,n=0;for(let j=-h;j<=h;j++){const k=i+j;if(k>=0&&k<a.length){s+=a[k];n++;}}o[i]=s/n;}return o;}
function peaks(col,N,md,ch,mh){const s=sm(col,7),c=[];for(let i=2;i<W-2;i++){if(ch[i]<mh)continue;if(s[i]>0&&s[i]>=s[i-1]&&s[i]>=s[i+1]&&s[i]>s[i-2]&&s[i]>s[i+2])c.push([i,s[i]]);}c.sort((a,b)=>b[1]-a[1]);const r=[];for(const[x]of c){if(r.every(q=>Math.abs(q-x)>=md))r.push(x);if(r.length>=N)break;}r.sort((a,b)=>a-b);return r;}
// flood-fill bg a partir das bordas (top/left/right) numa região
function floodKeep(x0,x1,y0,y1){const w=x1-x0+1,h=y1-y0+1;const bg=new Uint8Array(w*h);const st=[];
  const push=(x,y)=>{const i=y*w+x;if(!bg[i]&&dark(x0+x,y0+y)){bg[i]=1;st.push(i);}};
  for(let x=0;x<w;x++){push(x,0);} for(let y=0;y<h;y++){push(0,y);push(w-1,y);}
  while(st.length){const q=st.pop();const qx=q%w,qy=q/w|0;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=qx+dx,ny=qy+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;const ni=ny*w+nx;if(!bg[ni]&&dark(x0+nx,y0+ny)){bg[ni]=1;st.push(ni);}}}
  // keep = não-bg; depois filtra componentes pequenas
  const keep=new Uint8Array(w*h);for(let i=0;i<w*h;i++)keep[i]=bg[i]?0:1;
  // remover specks: manter componentes >=25
  const lab=new Int32Array(w*h),sz=[0];let cur=0;
  for(let i=0;i<w*h;i++){if(keep[i]&&!lab[i]){cur++;sz.push(0);const s2=[i];lab[i]=cur;while(s2.length){const q=s2.pop();sz[cur]++;const qx=q%w,qy=q/w|0;for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=qx+dx,ny=qy+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;const ni=ny*w+nx;if(keep[ni]&&!lab[ni]){lab[ni]=cur;s2.push(ni);}}}}}
  for(let i=0;i<w*h;i++)if(lab[i]&&sz[lab[i]]<25)keep[i]=0;
  return {keep,w,h};
}
function bbox(keep,w,h){let mnx=w,mny=h,mxx=-1,mxy=-1;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(keep[y*w+x]){if(x<mnx)mnx=x;if(x>mxx)mxx=x;if(y<mny)mny=y;if(y>mxy)mxy=y;}return mxx<0?null:[mnx,mny,mxx,mxy];}

const BOSSES=['coordenador','cacador-metas','product-owner','arquiteto','rh-predador','guardiao-ordem','diretor','vice-presidente','ceo'];
const SECS=[['idle',2],['walk',2],['attack',2],['special',2],['hurt',1],['death',2]]; // 11
const N=11, OUT=64, MARGIN=2;
const Y_TOP=84, Y_BOT=935, ROWS=9; const rowH=(Y_BOT-Y_TOP)/ROWS;
const groups=[];
BOSSES.forEach((name,bi)=>{
  const y0=Math.round(Y_TOP+bi*rowH)+6, y1=Math.round(Y_TOP+(bi+1)*rowH)-2;
  const col=prof(y0,y1),ch=chs(y0,y1);
  const pk=peaks(col,N,62,ch,35);
  const names=[];for(const[nm,n]of SECS)for(let i=0;i<n;i++)names.push(`boss-${name}-${nm}${i}`);
  const cells=[];
  pk.forEach((px,i)=>{const lo=i===0?Math.max(0,px-62):Math.round((pk[i-1]+px)/2);const hi=i===pk.length-1?Math.min(W-1,px+62):Math.round((px+pk[i+1])/2)-1;const {keep,w,h}=floodKeep(lo,hi,y0,y1);const bb=bbox(keep,w,h);cells.push({name:names[i]||name+'-x'+i,ox0:lo,oy0:y0,keep,w,h,bb});});
  console.log(name+': '+pk.length+'/'+N);
  groups.push({name,cells});
});
// montage
const cols=11,cw=OUT+4,chh=OUT+4,MW=cols*cw+4,MH=BOSSES.length*chh+4;const out=new PNG({width:MW,height:MH});
for(let i=0;i<MW*MH;i++){const k=i*4;out.data[k]=20;out.data[k+1]=60;out.data[k+2]=90;out.data[k+3]=255;}
groups.forEach((g,r)=>g.cells.forEach((c,ci)=>{if(!c.bb)return;const[mnx,mny,mxx,mxy]=c.bb;const bw=mxx-mnx+1,bh=mxy-mny+1;const sc=Math.min(OUT/bw,OUT/bh,1);const sw=Math.round(bw*sc),sh=Math.round(bh*sc);const ox=4+ci*cw+((OUT-sw)>>1),oy=4+r*chh+((OUT-sh)>>1);for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){const lx=mnx+Math.min(bw-1,(x/sc)|0),ly=mny+Math.min(bh-1,(y/sc)|0);if(!c.keep[ly*c.w+lx])continue;const si=((c.oy0+ly)*W+(c.ox0+lx))*4,dx=ox+x,dy=oy+y;if(dx<0||dy<0||dx>=MW||dy>=MH)continue;const di=(dy*MW+dx)*4;out.data[di]=p.data[si];out.data[di+1]=p.data[si+1];out.data[di+2]=p.data[si+2];out.data[di+3]=255;}}));
fs.writeFileSync('/tmp/boss_check.png',PNG.sync.write(out));console.log('montage ok');
if(process.argv[2]==='write'){let n=0;for(const g of groups){const hs=g.cells.filter(c=>c.bb).map(c=>c.bb[3]-c.bb[1]+1);const refH=Math.max(...hs);let scale=Math.min((OUT-MARGIN)/refH,1);for(const c of g.cells){if(!c.bb)continue;const[mnx,mny,mxx,mxy]=c.bb;const bw=mxx-mnx+1,bh=mxy-mny+1;const sw=Math.max(1,Math.round(bw*scale)),sh=Math.max(1,Math.round(bh*scale));const o=new PNG({width:OUT,height:OUT});for(let i=0;i<OUT*OUT;i++)o.data[i*4+3]=0;const ox=(OUT-sw)>>1,oy=OUT-MARGIN-sh;for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){const lx=mnx+Math.min(bw-1,(x/scale)|0),ly=mny+Math.min(bh-1,(y/scale)|0);if(!c.keep[ly*c.w+lx])continue;const si=((c.oy0+ly)*W+(c.ox0+lx))*4,dx=ox+x,dy=oy+y;if(dx<0||dy<0||dx>=OUT||dy>=OUT)continue;const di=(dy*OUT+dx)*4;o.data[di]=p.data[si];o.data[di+1]=p.data[si+1];o.data[di+2]=p.data[si+2];o.data[di+3]=255;}fs.writeFileSync(DIR+c.name+'.png',PNG.sync.write(o));n++;}try{fs.copyFileSync(DIR+'boss-'+g.name+'-idle0.png',DIR+'boss-'+g.name+'.png')}catch(e){}}console.log('escritos:',n);}
