// Re-extração de objects/items/npcs com remoção de fundo por distância de cor.
// Substitui o método antigo (r<60&&g<60&&b<60) que apagava pixels escuros legítimos.
const {PNG}=require('pngjs');const fs=require('fs');const path=require('path');
const DIR=path.join(__dirname,'../public/assets/sprites/');

// ── Helpers ─────────────────────────────────────────────────────────────────
function loadPNG(file){return PNG.sync.read(fs.readFileSync(file));}
function px(p,x,y){const i=(y*p.width+x)*4;return[p.data[i],p.data[i+1],p.data[i+2],p.data[i+3]];}

// Remove bg by Euclidean color distance; returns keep[] mask (w×h)
function bgMask(src,x0,y0,cw,ch,bgR,bgG,bgB,thresh2){
  const keep=new Uint8Array(cw*ch);
  for(let y=0;y<ch;y++)for(let x=0;x<cw;x++){
    const [r,g,b,a]=px(src,x0+x,y0+y);
    if(a<40){keep[y*cw+x]=0;continue;}
    const d=(r-bgR)**2+(g-bgG)**2+(b-bgB)**2;
    keep[y*cw+x]=d>thresh2?1:0;
  }
  return keep;
}

// Remove speck noise: kill connected components < minPx
function deSpeck(keep,w,h,minPx){
  const lab=new Int32Array(w*h),sz=[0];let cur=0;
  for(let i=0;i<w*h;i++){if(keep[i]&&!lab[i]){cur++;sz.push(0);const s=[i];lab[i]=cur;while(s.length){const q=s.pop();sz[cur]++;const qx=q%w,qy=q/w|0;for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=qx+dx,ny=qy+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;const ni=ny*w+nx;if(keep[ni]&&!lab[ni]){lab[ni]=cur;s.push(ni);}}}}}
  for(let i=0;i<w*h;i++)if(lab[i]&&sz[lab[i]]<minPx)keep[i]=0;
}

function bbox(keep,w,h){let x0=w,y0=h,x1=-1,y1=-1;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(keep[y*w+x]){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}return x1<0?null:[x0,y0,x1,y1];}

// Composite masked region onto OUT×OUT canvas, centered
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

// ── Sheet 1: Objects (22_10_34.png, bg≈[7,9,9]) ─────────────────────────────
// Each object: [slug, centerY, outW, outH]; States at centerX=[60,160,260,360,460]
const SHEET1=path.join(DIR,'ChatGPT Image 12 de jun. de 2026, 22_10_34.png');
const SHEET1_BG=[7,9,9],SHEET1_T2=400,SHEET1_CW=100,SHEET1_CH=80;
const OBJS1=[
  ['caneca',            65,  24, 24],
  ['teclado',          110,  32, 32],
  ['mouse',            155,  32, 32],
  ['monitor',          200,  40, 32],
  ['pilha-papel',      245,  32, 32],
  ['postit',           290,  24, 24],
  ['foto-familia',     335,  32, 32],
  ['cracha',           380,  20, 28],
  ['cafeteira',        425,  32, 40],
  ['porta-saida',      470,  36, 60],
  ['elevador',         515,  32, 56],
  ['impressora',       560,  36, 40],
  ['relogio',          605,  28, 28],
  ['quadro-motivacional',650, 48, 56],
  ['lixeira',          695,  24, 32],
  ['bomba-energia',    740,  28, 36],
  ['chave-inglesa',    785,  28, 16],
  ['pen-drive',        830,  20, 12],
  ['documento',        875,  28, 36],
  ['caixa-arquivos',   920,  36, 32],
  ['planta-empresa',   965,  32, 40],
];
const STATES1=[['idle',60],['use',160],['active',260],['broken',360],['destroyed',460]];

// ── Sheet 2: Objects2 (13_11_00.png, bg≈[9,13,14]) ──────────────────────────
const SHEET2=path.join(DIR,'ChatGPT Image 13 de jun. de 2026, 13_11_00.png');
const SHEET2_BG=[9,13,14],SHEET2_T2=400,SHEET2_CW=100,SHEET2_CH=120;
const OBJS2=[
  ['bebedouro',  70, 32, 48, [['idle',60],['uso',110],['vazio',160],['quebrado',210],['destruido',260]]],
  ['cafe-machine',70, 32, 40, [['idle',360],['preparando',410],['pronto',460],['sem-cafe',510],['quebrada',560]]],
  ['impressora2',160, 36, 40, [['idle',60],['imprimindo',115],['atascada',170],['sem-papel',225],['quebrada',280]]],
  ['porta-saida2',160,32, 56, [['fechada',380],['aberta',430],['bloqueada',480],['alarme',530],['manutencao',580],['cadeado',630]]],
  ['elevador2',  275, 32, 56, [['idle',60],['abrindo',110],['aberto',160],['subindo',210],['descendo',260]]],
  ['monitor2',   275, 44, 32, [['idle',380],['ativo',440],['luz',500],['desligado',560],['tela-azul',620],['desconectado',680]]],
  ['mesa',       370, 64, 40, [['idle',70],['ocupada',150],['baguncada',230],['muito-baguncada',310],['destruida',390]]],
  ['quadro-branco',370,48, 40, [['idle',510],['escrevendo',570],['cheio',630],['apagando',690],['destruido',750]]],
  ['lixeira2',   455, 24, 32, [['idle',60],['com-papel',100],['cheia',140],['transbordando',180],['destruida',220]]],
  ['arquivo',    455, 36, 44, [['idle',320],['aberto',375],['vazio',430],['baguncado',485],['destruido',540]]],
  ['ficheiro',   540, 28, 36, [['idle',420],['digitando',470],['acesso',520],['bloqueado',570],['destruido',620]]],
];

// ── Sheet 3: Items (13_08_31.png, bg≈[11,13,14]) ────────────────────────────
const SHEET3=path.join(DIR,'ChatGPT Image 13 de jun. de 2026, 13_08_31.png');
const SHEET3_BG=[11,13,14],SHEET3_T2=400,SHEET3_CW=80,SHEET3_CH=80;
const ITEMS=[
  ['vr-coin',    55,  40, 40, ['idle','active','used','broken']],
  ['coffee-cup', 160, 32, 40, ['idle','active','empty','broken']],
  ['postit',     265, 32, 32, ['idle','active','expired','torn']],
  ['convite',    370, 40, 28, ['idle','accepted','expired','rejected']],
  ['email',      475, 36, 28, ['idle','unread','read','deleted']],
  ['cafe',       580, 36, 36, ['idle','hot','cold','empty']],
];
const ITEM_STATE_X=[[80,140,200],[310,370,430],[540,600,660],[760,820,880]];

// ── Sheet 4: NPCs (13_12_55.png, bg≈[8,12,12]) ──────────────────────────────
const SHEET4=path.join(DIR,'ChatGPT Image 13 de jun. de 2026, 13_12_55.png');
const SHEET4_BG=[8,12,12],SHEET4_T2=400,SHEET4_CW=80,SHEET4_CH=110;
const NPCS=[{prefix:'npc-faxineiro',cy:75},{prefix:'npc-analista-linkedin',cy:335},{prefix:'npc-veterano',cy:595}];
const NPC_ANIMS=[
  {name:'idle',    xs:[60,110,160]},
  {name:'walk',    xs:[250,300,350,400]},
  {name:'attack',  xs:[490,540,590]},
  {name:'special', xs:[680,730,780]},
  {name:'hurt',    xs:[870,920]},
  {name:'death',   xs:[1010,1060,1110]},
];

// ── Run all sheets ────────────────────────────────────────────────────────────
let total=0,written=0;

function extractOne(src,cx,cy,cw,ch,bg,t2,outW,outH,outFile){
  const x0=Math.max(0,Math.min(cx-Math.floor(cw/2),src.width-cw));
  const y0=Math.max(0,Math.min(cy-Math.floor(ch/2),src.height-ch));
  const keep=bgMask(src,x0,y0,cw,ch,...bg,t2);
  deSpeck(keep,cw,ch,8);
  const n=writeFrame(src,x0,y0,cw,ch,keep,outW,outH,outFile);
  total++;if(n>0)written++;
  const pct=(n/outW/outH*100).toFixed(0);
  const tag=n<outW*outH*0.05?'⚠':'✓';
  console.log(` ${tag} ${path.basename(outFile)} (${n}px ${pct}%)`);
}

console.log('\n── Sheet 1: Objects ─────────────────────────────────────────');
const s1=loadPNG(SHEET1);
for(const[slug,cy,ow,oh]of OBJS1)
  for(const[state,cx]of STATES1)
    extractOne(s1,cx,cy,SHEET1_CW,SHEET1_CH,SHEET1_BG,SHEET1_T2,ow,oh,path.join(DIR,`obj-${slug}-${state}.png`));

// Aliases from sheet1
const al1=[
  ['obj-impressora.png','obj-impressora-idle.png'],
  ['obj-porta-reuniao.png','obj-porta-saida-idle.png'],
  ['obj-elevador.png','obj-elevador-idle.png'],
  ['obj-cafe-machine.png','obj-cafeteira-idle.png'],
];
al1.forEach(([dst,src])=>{try{fs.copyFileSync(path.join(DIR,src),path.join(DIR,dst));console.log(' alias',dst);}catch(e){}});

console.log('\n── Sheet 2: Objects2 ────────────────────────────────────────');
const s2=loadPNG(SHEET2);
// sheet2 has compound slugs — map the "2" variants back to canonical names
const slug2canon={impressora2:'impressora',elevador2:'elevador','porta-saida2':'porta-saida',lixeira2:'lixeira',monitor2:'monitor'};
for(const[rawSlug,cy,ow,oh,states]of OBJS2){
  const slug=slug2canon[rawSlug]||rawSlug;
  for(const[state,cx]of states)
    extractOne(s2,cx,cy,SHEET2_CW,SHEET2_CH,SHEET2_BG,SHEET2_T2,ow,oh,path.join(DIR,`obj-${slug}-${state}.png`));
}
// Aliases from sheet2
const al2=[
  ['obj-bebedouro.png','obj-bebedouro-idle.png'],
  ['obj-cafe-machine.png','obj-cafe-machine-idle.png'],
  ['obj-impressora.png','obj-impressora-idle.png'],
  ['obj-porta-reuniao.png','obj-porta-saida-fechada.png'],
  ['obj-elevador.png','obj-elevador-idle.png'],
];
al2.forEach(([dst,src])=>{try{fs.copyFileSync(path.join(DIR,src),path.join(DIR,dst));console.log(' alias',dst);}catch(e){}});

console.log('\n── Sheet 3: Items ────────────────────────────────────────────');
const s3=loadPNG(SHEET3);
for(const[slug,cy,ow,oh,stateNames]of ITEMS){
  for(let si=0;si<4;si++){
    const sn=stateNames[si];
    for(let fi=0;fi<3;fi++)
      extractOne(s3,ITEM_STATE_X[si][fi],cy,SHEET3_CW,SHEET3_CH,SHEET3_BG,SHEET3_T2,ow,oh,path.join(DIR,`item-${slug}-${sn}${fi}.png`));
  }
  try{fs.copyFileSync(path.join(DIR,`item-${slug}-idle0.png`),path.join(DIR,`item-${slug}.png`));console.log(' alias item-'+slug+'.png');}catch(e){}
}
// Extra item aliases
try{fs.copyFileSync(path.join(DIR,'item-vr-coin-idle0.png'),path.join(DIR,'item-vr.png'));console.log(' alias item-vr.png');}catch(e){}
try{fs.copyFileSync(path.join(DIR,'item-cafe-idle0.png'),path.join(DIR,'item-inkproj.png'));console.log(' alias item-inkproj.png');}catch(e){}

console.log('\n── Sheet 4: NPCs ────────────────────────────────────────────');
const s4=loadPNG(SHEET4);
for(const npc of NPCS){
  let idle0=null;
  for(const anim of NPC_ANIMS){
    for(let i=0;i<anim.xs.length;i++){
      const outFile=path.join(DIR,`${npc.prefix}-${anim.name}${i}.png`);
      extractOne(s4,anim.xs[i],npc.cy,SHEET4_CW,SHEET4_CH,SHEET4_BG,SHEET4_T2,32,48,outFile);
      if(anim.name==='idle'&&i===0)idle0=outFile;
    }
  }
  if(idle0)try{fs.copyFileSync(idle0,path.join(DIR,`${npc.prefix}.png`));console.log(' alias',npc.prefix+'.png');}catch(e){}
}

console.log(`\n── Done: ${written}/${total} frames with content ─────────────`);
