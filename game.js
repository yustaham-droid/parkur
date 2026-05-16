// ═══════════════════════════════════════════
//  PARKOUR 3D — Full Edition
// ═══════════════════════════════════════════
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
renderer.setSize(window.innerWidth,window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.FogExp2(0x87CEEB,0.007);
const camera = new THREE.PerspectiveCamera(75,window.innerWidth/window.innerHeight,0.1,500);
scene.add(camera);
window.addEventListener('resize',()=>{renderer.setSize(window.innerWidth,window.innerHeight);camera.aspect=window.innerWidth/window.innerHeight;camera.updateProjectionMatrix();});
// Lighting
const ambient=new THREE.AmbientLight(0xffffff,0.72); scene.add(ambient);
const sun=new THREE.DirectionalLight(0xfffbe8,1.2); sun.position.set(60,120,40); sun.castShadow=true;
sun.shadow.mapSize.width=sun.shadow.mapSize.height=2048;
sun.shadow.camera.near=1;sun.shadow.camera.far=400;
sun.shadow.camera.left=sun.shadow.camera.bottom=-100;
sun.shadow.camera.right=sun.shadow.camera.top=100;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0x87CEEB,0x447744,0.3));

// Input
const keys={},jp={};
window.addEventListener('keydown',e=>{if(!keys[e.code])jp[e.code]=true;keys[e.code]=true;if(e.code==='KeyR')respawn();if(e.code==='KeyV')toggleCamera();if(e.code==='Escape')openMarket();});
window.addEventListener('keyup',e=>{keys[e.code]=false;});
function clearJP(){Object.keys(jp).forEach(k=>delete jp[k]);}

// Pointer lock
let locked=false,yaw=0,pitch=0;
document.addEventListener('pointerlockchange',()=>{locked=document.pointerLockElement===canvas;document.getElementById('blocker').classList.toggle('hidden',locked);});
document.addEventListener('mousemove',e=>{if(!locked)return;yaw-=e.movementX*.0022;pitch-=e.movementY*.0022;pitch=Math.max(-Math.PI/2+.05,Math.min(Math.PI/2-.05,pitch));});
canvas.addEventListener('click',()=>{if(!locked)canvas.requestPointerLock();});

// Utils
const lerp=(a,b,t)=>a+(b-a)*t;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

// Audio
let ac2=null;function getAC(){if(!ac2)ac2=new(window.AudioContext||window.webkitAudioContext)();return ac2;}
function beep(f,t='sine',d=.1,v=.15){try{const o=getAC().createOscillator(),g=getAC().createGain();o.connect(g);g.connect(getAC().destination);o.frequency.value=f;o.type=t;g.gain.setValueAtTime(v,getAC().currentTime);g.gain.exponentialRampToValueAtTime(.001,getAC().currentTime+d);o.start();o.stop(getAC().currentTime+d);}catch(e){}}
const sfxJump=()=>beep(340,'sine',.14,.2);const sfxLand=()=>beep(120,'triangle',.1,.25);
const sfxCoin=()=>{beep(880,'sine',.12,.18);setTimeout(()=>beep(1100,'sine',.1,.14),70);};
const sfxCP=()=>{[440,660,880].forEach((f,i)=>setTimeout(()=>beep(f,'sine',.15,.15),i*100));};
const sfxDie=()=>{beep(80,'sawtooth',.4,.28);setTimeout(()=>beep(60,'sawtooth',.3,.22),150);};
const sfxWin=()=>{[440,550,660,880,1100].forEach((f,i)=>setTimeout(()=>beep(f,'sine',.25,.2),i*110));};
const sfxCash=()=>{beep(600,'sine',.2,.22);setTimeout(()=>beep(800,'sine',.18,.18),100);};

// ─── SAVE DATA ───────────────────────────────────────
const SK='pk3d_v4';
let SD={coins:0,best:0,totalDeaths:0,ppUnlocked:false,owned:['default'],equipped:'default'};
try{const s=JSON.parse(localStorage.getItem(SK));if(s)SD={...SD,...s};}catch(e){}
function saveGame(){try{localStorage.setItem(SK,JSON.stringify(SD));}catch(e){}}

// ─── SKINS ───────────────────────────────────────────
const SKINS={
  default:{name:'Varsayılan',ico:'🧢',rarity:'free',price:0,boxable:false,
    skin:0xf5c18a,body:0x1a5fad,legs:0x1a1a2e,shoes:0x2255cc,hat:0x1e1e1e,hatH:.3},
  graffiti:{name:'Graffiti Artist',ico:'🎨',rarity:'common',price:200,boxable:true,
    skin:0xd4a574,body:0x33bb11,legs:0x111111,shoes:0x222222,hat:0x111122,hatH:.25},
  astronaut:{name:'Retro Astronaut',ico:'🚀',rarity:'rare',price:400,boxable:true,
    skin:0xffffff,body:0xeeeeee,legs:0xdddddd,shoes:0xbbbbbb,hat:0xffd700,hatH:.55},
  steampunk:{name:'Steampunk',ico:'⚙️',rarity:'epic',price:600,boxable:true,
    skin:0xd4a574,body:0x7b3d14,legs:0x4a2a0e,shoes:0x3a1f08,hat:0x3a2010,hatH:.45},
  ninja:{name:'Cyber Ninja',ico:'⚔️',rarity:'legendary',price:900,boxable:true,
    skin:0xcc77bb,body:0x1a1a33,legs:0x0e0e22,shoes:0xff1188,hat:0x7722aa,hatH:.35},
  vip:{name:'VIP King 👑',ico:'👑',rarity:'vip',price:0,boxable:false,ppOnly:true,
    skin:0xf5c18a,body:0x8b0000,legs:0x4a0066,shoes:0xffd700,hat:0xffd700,hatH:.55},
};

// ─── 3D CHARACTER BUILDER ─────────────────────────────
function phong(c,e=0){return new THREE.MeshPhongMaterial({color:c,emissive:e,shininess:40});}
function mkBox(w,h,d,mat){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.castShadow=true;return m;}

function buildChar3D(skinId){
  const s=SKINS[skinId]||SKINS.default;
  const root=new THREE.Group();

  // Head
  const head=mkBox(.9,.9,.9,phong(s.skin));head.position.y=2.25;root.add(head);
  // Eyes
  const eyeL=mkBox(.18,.18,.02,phong(0x111111));eyeL.position.set(-.22,2.28,-.46);root.add(eyeL);
  const eyeR=mkBox(.18,.18,.02,phong(0x111111));eyeR.position.set(.22,2.28,-.46);root.add(eyeR);
  // Hat
  const hat=mkBox(.95,s.hatH,.95,phong(s.hat));hat.position.y=2.7+s.hatH/2;root.add(hat);
  // VIP crown extras
  if(skinId==='vip'){
    const crown=mkBox(1.05,.18,1.05,phong(0xffd700,0x332200));crown.position.y=2.72;root.add(crown);
    // Jewels
    [[-.35,0],[0,0],[.35,0]].forEach(([x])=>{const j=mkBox(.08,.12,.08,phong(0xff2222));j.position.set(x,2.82,-.52);root.add(j);});
  }
  // Torso
  const torso=mkBox(1.1,1.0,.65,phong(s.body));torso.position.y=1.5;root.add(torso);
  // VIP cape
  if(skinId==='vip'){const cape=mkBox(1.05,1.1,.1,phong(0x6600aa));cape.position.set(0,1.45,.38);root.add(cape);}
  // Ninja swords on back
  if(skinId==='ninja'){
    const sw=mkBox(.06,.9,.06,phong(0xcccccc));sw.position.set(.18,1.9,.4);sw.rotation.z=.2;root.add(sw);
    const sw2=mkBox(.06,.9,.06,phong(0xcccccc));sw2.position.set(-.18,1.9,.4);sw2.rotation.z=-.2;root.add(sw2);
  }
  // Arms (with pivot at shoulder)
  const lAG=new THREE.Group();lAG.position.set(-.75,2.0,0);const lAM=mkBox(.38,1.0,.38,phong(s.body));lAM.position.y=-.5;lAG.add(lAM);root.add(lAG);
  const rAG=new THREE.Group();rAG.position.set(.75,2.0,0);const rAM=mkBox(.38,1.0,.38,phong(s.body));rAM.position.y=-.5;rAG.add(rAM);root.add(rAG);
  // Astronaut helmet visor
  if(skinId==='astronaut'){const v=mkBox(.7,.5,.55,phong(0xaaddff,.03));v.position.y=2.3;root.add(v);}
  // Steampunk goggles
  if(skinId==='steampunk'){const g1=mkBox(.2,.2,.05,phong(0xffd700));g1.position.set(-.22,2.35,-.47);root.add(g1);const g2=mkBox(.2,.2,.05,phong(0xffd700));g2.position.set(.22,2.35,-.47);root.add(g2);}
  // Legs (with pivot at hip)
  const lLG=new THREE.Group();lLG.position.set(-.27,1.0,0);const lLM=mkBox(.44,1.0,.44,phong(s.legs));lLM.position.y=-.5;lLG.add(lLM);root.add(lLG);
  const rLG=new THREE.Group();rLG.position.set(.27,1.0,0);const rLM=mkBox(.44,1.0,.44,phong(s.legs));rLM.position.y=-.5;rLG.add(rLM);root.add(rLG);
  // Shoes
  const lSh=mkBox(.5,.22,.55,phong(s.shoes));lSh.position.set(-.27,.11,.06);root.add(lSh);
  const rSh=mkBox(.5,.22,.55,phong(s.shoes));rSh.position.set(.27,.11,.06);root.add(rSh);
  // VIP shield
  if(skinId==='vip'){const shield=mkBox(.5,.65,.08,phong(0xcc8800));shield.position.set(-.65,1.55,-.15);root.add(shield);}

  root.userData={lAG,rAG,lLG,rLG,walkT:0};
  root.castShadow=true;
  return root;
}

function animChar(ch,vx,vz,dt,onGround,jumping){
  if(!ch)return;
  const ud=ch.userData;
  const spd=Math.sqrt(vx*vx+vz*vz);
  if(spd>.3&&onGround)ud.walkT+=dt*spd*1.6;
  const sw=onGround?Math.sin(ud.walkT*Math.PI*2)*.55:0;
  const airAng=jumping?.4:0;
  ud.lLG.rotation.x=sw+airAng;
  ud.rLG.rotation.x=-sw+airAng;
  ud.lAG.rotation.x=-sw*.6-airAng*.4;
  ud.rAG.rotation.x=sw*.6-airAng*.4;
}

// Menu character preview
function setupMenuChar(){
  const mc=document.getElementById('menuChar');
  if(!mc)return;
  const mRenderer=new THREE.WebGLRenderer({canvas:mc,antialias:true,alpha:true});
  mRenderer.setSize(200,340);mRenderer.setClearColor(0,0);
  const mScene=new THREE.Scene();
  const mCam=new THREE.PerspectiveCamera(45,200/340,.1,50);mCam.position.set(0,1.5,5.5);mCam.lookAt(0,1.5,0);
  mScene.add(new THREE.AmbientLight(0xffffff,.8));
  const mSun=new THREE.DirectionalLight(0xfffbe8,1.2);mSun.position.set(3,6,4);mScene.add(mSun);
  let mChar=null;
  function refreshMenuChar(){if(mChar)mScene.remove(mChar);mChar=buildChar3D(SD.equipped);mScene.add(mChar);}
  refreshMenuChar();
  window.refreshMenuChar=refreshMenuChar;
  let t=0;
  function mLoop(){requestAnimationFrame(mLoop);t+=.016;if(mChar){mChar.rotation.y=Math.sin(t*.5)*.3;animChar(mChar,0,0,.016,true,false);}mRenderer.render(mScene,mCam);}
  mLoop();
}
setupMenuChar();

function notif(txt){const a=document.getElementById('notifArea');const el=document.createElement('div');el.className='notif';el.textContent=txt;a.appendChild(el);setTimeout(()=>el.remove(),2300);}
function addCoins(n,label=''){SD.coins+=n;document.getElementById('mCoins').textContent=SD.coins;document.getElementById('hCoins').textContent=SD.coins;if(document.getElementById('mktCoins'))document.getElementById('mktCoins').textContent=SD.coins;if(n>0){notif(`+${n} 🪙${label?` ${label}`:''}`);}saveGame();}

// ═══════════════════════════════════════════
//  WORLD BUILDER + LEVELS
// ═══════════════════════════════════════════
let platforms=[],coins=[],checkpoints=[],goal=null,movingPlatforms=[],objects=[];
const COLS=[0xff3333,0x33cc33,0x3366ff,0xff8800,0xff33cc,0x00ccff,0xffcc00,0x99ff00,0xff6699,0xaa44ff,0x00ffcc,0xff4400,0x4488ff,0xffaa33,0x33ff99];
let colIdx=0;function nxtCol(){return COLS[colIdx++%COLS.length];}
function facesMat(c,e=0){return new THREE.MeshPhongMaterial({color:c,emissive:e,shininess:40,specular:0x111111});}
function addPlat(x,y,z,w,h,d,col,opts={}){
  col=col??nxtCol();
  const geo=new THREE.BoxGeometry(w,h,d);
  const mesh=new THREE.Mesh(geo,facesMat(col,opts.emissive||0));
  mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;scene.add(mesh);
  mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo),new THREE.LineBasicMaterial({color:0x000000,transparent:true,opacity:.22})));
  const obj={mesh,x,y,z,w,h,d,type:opts.type||'solid',moving:opts.moving||false};
  if(opts.moving){const sp=new THREE.Vector3(x,y,z),ep=new THREE.Vector3(opts.ex??x,opts.ey??y,opts.ez??z);movingPlatforms.push({obj,sp,ep,t:0,dir:1,spd:opts.mspd||1.2});}
  platforms.push(obj);objects.push(obj);return obj;
}
function addCoin3D(x,y,z,val=50){
  const geo=new THREE.TorusGeometry(.35,.1,8,18);
  const mat=facesMat(val>=100?0xff44ff:0xffdd00,val>=100?0x440044:0x443300);
  const mesh=new THREE.Mesh(geo,mat);mesh.position.set(x,y,z);mesh.castShadow=true;scene.add(mesh);
  coins.push({mesh,x,y,z,r:.8,val,collected:false});
}
function addCP(x,y,z){
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(.6,.6,3.5,10),facesMat(0x00ffff,0x004444));
  mesh.position.set(x,y+1.75,z);scene.add(mesh);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(1.2,.12,8,24),facesMat(0x00ffff,0x004488));ring.rotation.x=Math.PI/2;mesh.add(ring);
  checkpoints.push({mesh,x,y,z,r:1.8,activated:false});
}
function addGoal3D(x,y,z){
  const mesh=new THREE.Mesh(new THREE.TorusGeometry(2.2,.25,10,32),facesMat(0x00ff44,0x004411));
  mesh.position.set(x,y+2.2,z);scene.add(mesh);
  const r2=new THREE.Mesh(new THREE.TorusGeometry(1.4,.15,8,24),facesMat(0xffff00,0x333300));mesh.add(r2);
  goal={mesh,x,y,z,r:3};
}
function clearWorld(){
  platforms.forEach(p=>{if(p.mesh)scene.remove(p.mesh);});
  coins.forEach(c=>{if(c.mesh)scene.remove(c.mesh);});
  checkpoints.forEach(c=>{if(c.mesh)scene.remove(c.mesh);});
  if(goal&&goal.mesh)scene.remove(goal.mesh);
  if(charModel)scene.remove(charModel);
  platforms=[];coins=[];checkpoints=[];goal=null;movingPlatforms=[];objects=[];colIdx=0;charModel=null;
}

// ─── LEVELS ─────────────────────────────────────────
const LEVEL_META=[
  {name:'Başlangıç Yolu',sky:0x87CEEB,fog:0x87CEEB},
  {name:'Gökyüzü Köprüleri',sky:0x4466cc,fog:0x4466cc},
  {name:'Lav Labirenti',sky:0x331100,fog:0x220800},
  {name:'Buz Dağı',sky:0x99ccff,fog:0xaaddff},
];

function buildLevel(id){
  const lv=id%4;
  if(lv===0)buildLv0();
  else if(lv===1)buildLv1();
  else if(lv===2)buildLv2();
  else buildLv3();
  const meta=LEVEL_META[lv];
  scene.background=new THREE.Color(meta.sky);
  scene.fog.color.set(meta.fog);
  document.getElementById('hLvName').textContent=`SEVİYE ${id+1}: ${meta.name}`;
}

function buildLv0(){
  addPlat(0,0,0,12,1,12,0x4488ff);
  const steps=[[0,0,10,3,1,3],[3,0,16,3,1,3],[-2,1,22,3,1,3],[1,2,28,3,1,3],[4,2,34,3,1,3],[0,3,40,3,1,3],[-3,3,46,3,1,3],[0,4,52,4,1,4]];
  steps.forEach(([x,y,z,w,h,d])=>addPlat(x,y,z,w,h,d));
  [[0,2,10],[3,2,16],[-2,3,22],[1,4,28]].forEach(([x,y,z])=>addCoin3D(x,y,z));
  addPlat(0,5,62,4,1,4,0xff4400,{moving:true,ex:6,ez:62,mspd:1.5});
  addCP(0,5,74);addPlat(0,5,76,8,1,8,0x44ff44);
  for(let i=0;i<6;i++)addPlat(i*3-4,5+i,88+i*4,3,1,4,0xff8800);
  addPlat(0,11,116,6,1,6,0xff0088);
  [[0,13,116],[3,13,116],[-3,13,116]].forEach(([x,y,z])=>addCoin3D(x,y,z,100));
  addCP(0,12,128);addPlat(0,12,130,10,1,10,0x8844ff);
  addPlat(0,12,142,1.8,1,6,0xff0000);addPlat(4,12,150,1.8,1,6,0xff0000);addPlat(-2,12,158,1.8,1,6,0xff0000);
  addPlat(0,12,168,8,1,8,0x00ccff);addGoal3D(0,12,168);
}

function buildLv1(){
  addPlat(0,0,0,10,1,10,0x2255aa);
  const path=[[0,0,14,4,1,4],[6,2,22,4,1,4],[-4,4,30,4,1,4],[2,6,40,4,1,4],[8,8,50,3,1,3],[-6,10,58,3,1,3],[0,12,68,5,1,5]];
  path.forEach(([x,y,z,w,h,d])=>addPlat(x,y,z,w,h,d));path.forEach(([x,y,z])=>addCoin3D(x,y+2,z));
  addPlat(-4,14,80,3,1,3,0xff6600,{moving:true,ex:4,ez:80,mspd:1.8});
  addPlat(0,16,92,3,1,3,0xff6600,{moving:true,ey:20,ez:92,mspd:1.2});
  addCP(0,20,104);addPlat(0,20,106,8,1,8,0x8800ff);
  [[-8,20,118],[0,22,126],[8,24,134],[-4,26,142],[0,28,150]].forEach(([x,y,z])=>{addPlat(x,y,z,3,1,3);addCoin3D(x,y+2,z);});
  addPlat(0,30,162,8,1,8,0x00ff88);addCP(0,30,162);
  for(let i=0;i<8;i++)addPlat(i%2===0?-3:3,30+i*.5,174+i*5,2,1,3,COLS[(i*3)%COLS.length]);
  addPlat(0,34,220,8,1,8,0xffff00);addGoal3D(0,34,220);
}

function buildLv2(){
  addPlat(0,0,0,10,1,10,0x883300);
  addPlat(0,-3,80,200,1,200,0xff2200,{type:'lava'});
  const isl=[[0,0,14,4,1,5],[6,0,22,3,1,4],[-5,0,30,4,1,4],[2,0,40,3,1,5],[-3,0,50,4,1,4],[5,0,60,3,1,3],[0,0,70,4,1,4],[0,0,82,5,1,5]];
  isl.forEach(([x,y,z,w,h,d])=>addPlat(x,y,z,w,h,d,0x996633));
  addPlat(0,0,92,3,1,3,0xff6600,{moving:true,ex:8,ez:92,mspd:2});
  addPlat(4,0,104,3,1,3,0xff6600,{moving:true,ex:-4,ez:104,mspd:2.2});
  addCP(0,0,116);addPlat(0,0,118,8,1,8,0x663300);
  for(let i=0;i<10;i++){addPlat(i%2===0?-4:4,0,130+i*7,2,1,3,0x884422);addCoin3D(i%2===0?-4:4,2,130+i*7);}
  addPlat(0,0,202,8,1,8,0x996633);addCP(0,0,202);
  for(let i=0;i<4;i++)addPlat(i%2===0?-5:5,0,214+i*8,3,1,3,0x00ff88,{type:'bounce'});
  addPlat(0,3,248,8,1,8,0xffaa00);addGoal3D(0,3,248);
}

function buildLv3(){
  addPlat(0,0,0,10,1,10,0x88bbff);
  [[4,1,12,3,1,4],[-4,2,22,3,1,4],[6,3,32,3,1,4],[-6,4,42,3,1,4],[4,5,52,3,1,4],[0,6,62,5,1,5]].forEach(([px,py,pz,w,h,d])=>{addPlat(px,py,pz,w,h,d,0x88ccff);addCoin3D(px,py+2,pz);});
  addPlat(0,7,76,3,1,3,0xaaeeff,{moving:true,ex:6,ey:7,ez:76,mspd:1.4});
  addPlat(3,9,88,3,1,3,0xaaeeff,{moving:true,ex:-3,ey:9,ez:88,mspd:1.6});
  addCP(0,10,100);addPlat(0,10,102,8,1,8,0x6699ff);
  for(let i=0;i<6;i++)addPlat((i%2===0?-4:4)+i*.5,10+i,114+i*7,1.5,1,4,0xaaddff);
  addPlat(0,16,158,8,1,8,0x4466ff);addCP(0,16,158);
  [[-5,16,170],[2,18,178],[-3,20,186],[4,22,194],[0,24,202]].forEach(([px,py,pz])=>{addPlat(px,py,pz,2,1,2,0x99ddff);addCoin3D(px,py+2,pz,75);});
  addPlat(0,26,214,8,1,8,0xffffff);addGoal3D(0,26,214);
}

// PP Challenge Level
function buildPPLevel(){
  scene.background=new THREE.Color(0x110022);scene.fog.color.set(0x110022);
  addPlat(0,0,0,8,1,8,0x4400aa);
  const path=[[0,0,12,2.5,1,3],[4,1,20,2.5,1,3],[-3,2,28,2,1,3],[2,3,36,2,1,3],[0,4,44,2.5,1,2.5]];
  path.forEach(([x,y,z,w,h,d])=>addPlat(x,y,z,w,h,d));
  addPlat(-4,5,52,2,1,3,0xff6600,{moving:true,ex:4,ez:52,mspd:2.2});
  addPlat(0,6,62,2,1,3,0xff6600,{moving:true,ey:9,ez:62,mspd:1.8});
  addPlat(0,9,72,2,1,2,0xff0088);
  addPlat(4,10,80,2,1,2,0xff0088);
  addPlat(-2,11,88,2,1,2,0xff0088);
  addPlat(0,12,96,6,1,6,0xffd700);
  addGoal3D(0,12,96);
  document.getElementById('hLvName').textContent='⚡ PARKOUR PLUS GÖREVİ (60s)';
}

// ═══════════════════════════════════════════
//  PLAYER + PHYSICS + CAMERA
// ═══════════════════════════════════════════
const PW=.38,PH=1.8,PD=.38,GRAV=-22,JMPV=9.5,WLK=5.5,SPR=9.5,MAXF=-28;
const player={pos:new THREE.Vector3(0,4,0),vel:new THREE.Vector3(0,0,0),onGround:false,jumpsLeft:2,health:100,maxHp:100,dead:false,invT:0,cpPos:new THREE.Vector3(0,4,0),score:0,deaths:0,standOn:null,prevPP:null,wallRunT:0,wallRunActive:false,trailT:0,_respawning:false};
let bobT=0,bobY=0,bobX=0,landT=0;
let thirdPerson=false,charModel=null,isPPChallenge=false,ppTimer=0;
let currentLevel=0,gameStartTime=Date.now();

function pAABB(){return{minX:player.pos.x-PW,maxX:player.pos.x+PW,minY:player.pos.y,maxY:player.pos.y+PH,minZ:player.pos.z-PD,maxZ:player.pos.z+PD};}
function oAABB(p){return{minX:p.x-p.w/2,maxX:p.x+p.w/2,minY:p.y-p.h/2,maxY:p.y+p.h/2,minZ:p.z-p.d/2,maxZ:p.z+p.d/2};}
function ovlp(a,b){return a.maxX>b.minX&&a.minX<b.maxX&&a.maxY>b.minY&&a.minY<b.maxY&&a.maxZ>b.minZ&&a.minZ<b.maxZ;}

function toggleCamera(){thirdPerson=!thirdPerson;document.getElementById('camBadge').textContent=thirdPerson?'📷 3P':'📷 1P';}

function updateChar3D(){
  if(!charModel)return;
  const spd=Math.sqrt(player.vel.x**2+player.vel.z**2);
  // Position
  charModel.position.set(player.pos.x,player.pos.y,player.pos.z);
  charModel.rotation.y=yaw+Math.PI; // face forward
  charModel.visible=thirdPerson;
  animChar(charModel,player.vel.x,player.vel.z,.016,player.onGround,!player.onGround);
}

function physics(dt){
  if(player.dead)return;
  if(player.invT>0)player.invT-=dt;
  if(isPPChallenge){ppTimer-=dt;if(ppTimer<=0&&!player.dead){player.dead=true;sfxDie();setTimeout(()=>showDeath('Süre doldu! ⏰'),400);return;}document.getElementById('hLvName').textContent=`⚡ PP GÖREVİ — ${Math.ceil(ppTimer)}s`;}

  const F=keys['KeyW'],B=keys['KeyS'],L=keys['KeyA'],R=keys['KeyD'];
  const sprint=(keys['ShiftLeft']||keys['ShiftRight']);
  const pp=SD.ppUnlocked;
  const spd=sprint?(pp?SPR*1.5:SPR):(pp?WLK*1.3:WLK);
  const maxJ=pp?3:2;

  const fwd=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));
  const rgt=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
  const mv=new THREE.Vector3();
  if(F)mv.addScaledVector(fwd,1);if(B)mv.addScaledVector(fwd,-1);
  if(L)mv.addScaledVector(rgt,-1);if(R)mv.addScaledVector(rgt,1);
  if(mv.lengthSq()>0)mv.normalize();

  if(player.onGround){player.vel.x=mv.x*spd*.9+player.vel.x*.1;player.vel.z=mv.z*spd*.9+player.vel.z*.1;}
  else{player.vel.x+=mv.x*spd*dt*4;player.vel.z+=mv.z*spd*dt*4;const h=Math.sqrt(player.vel.x**2+player.vel.z**2);if(h>spd*1.6){player.vel.x*=spd*1.6/h;player.vel.z*=spd*1.6/h;}}

  if(jp['Space']&&player.jumpsLeft>0){const first=player.jumpsLeft===maxJ;player.vel.y=JMPV*(first?1:.85);player.onGround=false;player.jumpsLeft--;sfxJump();if(player.jumpsLeft===0&&maxJ===3)notif('⚡ ÜÇLÜ ZIPL!');else if(player.jumpsLeft===0)notif('↑↑ ÇİFT ZIPL!');}

  // Wall run (PP)
  if(pp&&!player.onGround&&F&&player.wallRunT>0){
    const wc=objects.some(p=>{const pb=oAABB(p);return(Math.abs(player.pos.x-pb.minX)<.7||Math.abs(player.pos.x-pb.maxX)<.7||Math.abs(player.pos.z-pb.minZ)<.7||Math.abs(player.pos.z-pb.maxZ)<.7)&&player.pos.y<pb.maxY&&player.pos.y+PH>pb.minY;});
    if(wc){player.wallRunActive=true;player.wallRunT-=dt;if(player.vel.y<-.5)player.vel.y=-.5;player.jumpsLeft=Math.max(player.jumpsLeft,1);}else player.wallRunActive=false;
  }else{player.wallRunActive=false;if(player.onGround)player.wallRunT=2;}

  player.vel.y+=GRAV*dt;player.vel.y=Math.max(player.vel.y,MAXF);

  // Moving platform carry
  if(player.standOn&&player.standOn.moving){
    const mp=movingPlatforms.find(m=>m.obj===player.standOn);
    if(mp&&player.prevPP){player.pos.x+=mp.obj.x-player.prevPP.x;player.pos.z+=mp.obj.z-player.prevPP.z;}
    if(mp)player.prevPP=new THREE.Vector3(mp.obj.x,mp.obj.y,mp.obj.z);
  }else player.prevPP=null;
  player.standOn=null;

  const wasGnd=player.onGround;player.onGround=false;
  const maxJ2=pp?3:2;
  // Y
  player.pos.y+=player.vel.y*dt;
  for(const p of objects){if(!ovlp(pAABB(),oAABB(p)))continue;const pb=oAABB(p);
    if(player.vel.y<=0&&player.pos.y>=pb.maxY-.28){player.pos.y=pb.maxY;player.vel.y=0;player.onGround=true;player.jumpsLeft=maxJ2;player.wallRunT=2;player.standOn=p;
      if(p.type==='bounce'){player.vel.y=JMPV*1.45;player.onGround=false;sfxJump();notif('🟢 BOUNCE!');}
    }else if(player.vel.y>0&&player.pos.y+PH<=pb.minY+.35){player.pos.y=pb.minY-PH;player.vel.y=0;}}
  if(!wasGnd&&player.onGround){sfxLand();landT=1;}
  // X
  player.pos.x+=player.vel.x*dt;
  for(const p of objects){if(!ovlp(pAABB(),oAABB(p)))continue;const pb=oAABB(p);player.pos.x=player.vel.x>0?pb.minX-PW-.01:pb.maxX+PW+.01;player.vel.x=0;}
  // Z
  player.pos.z+=player.vel.z*dt;
  for(const p of objects){if(!ovlp(pAABB(),oAABB(p)))continue;const pb=oAABB(p);player.pos.z=player.vel.z>0?pb.minZ-PD-.01:pb.maxZ+PD+.01;player.vel.z=0;}

  // Fall
  if(player.pos.y<-15&&!player.dead){player.dead=true;sfxDie();setTimeout(()=>showDeath('Düştün! 😱'),500);return;}

  // Lava
  for(const p of objects){if(p.type!=='lava')continue;if(ovlp(pAABB(),oAABB(p))&&player.invT<=0){player.health-=30;player.invT=1.2;if(player.health<=0&&!player.dead){player.dead=true;sfxDie();setTimeout(()=>showDeath('Lav seni yaktı! 🔥'),400);}}}

  // Coins
  for(const c of coins){if(c.collected)continue;const dx=player.pos.x-c.x,dy=player.pos.y+.9-c.y,dz=player.pos.z-c.z;if(Math.sqrt(dx*dx+dy*dy+dz*dz)<c.r){c.collected=true;scene.remove(c.mesh);player.score+=c.val;if(player.score>SD.best)SD.best=player.score;addCoins(Math.round(c.val*.5),' KOİN');sfxCoin();}}

  // Checkpoints
  for(const cp of checkpoints){if(cp.activated)continue;const dx=player.pos.x-cp.x,dz=player.pos.z-cp.z;if(Math.sqrt(dx*dx+dz*dz)<cp.r){cp.activated=true;player.cpPos.copy(player.pos);sfxCP();notif('✓ KONTROL NOKTASI');}}

  // Goal
  if(goal){const dx=player.pos.x-goal.x,dy=(player.pos.y+.9)-(goal.y+2.2),dz=player.pos.z-goal.z;if(Math.sqrt(dx*dx+dy*dy+dz*dz)<goal.r){if(isPPChallenge)winPPChallenge();else showWin();}}

  // Rainbow trail (PP)
  if(SD.ppUnlocked){player.trailT-=dt;if(player.trailT<=0){player.trailT=.05;const hue=(Date.now()*.5)%360;const tm=new THREE.Mesh(new THREE.SphereGeometry(.1,4,4),new THREE.MeshBasicMaterial({color:new THREE.Color(`hsl(${hue},100%,60%)`),transparent:true,opacity:.7}));tm.position.copy(camera.position);scene.add(tm);setTimeout(()=>scene.remove(tm),400);}}

  // Camera
  const hspd=Math.sqrt(player.vel.x**2+player.vel.z**2);
  const moving=hspd>.3&&player.onGround;
  if(moving)bobT+=dt*hspd*.6;
  bobY=moving?Math.sin(bobT*Math.PI*2)*.042:lerp(bobY,0,.15);
  bobX=moving?Math.sin(bobT*Math.PI)*.018:lerp(bobX,0,.15);
  if(landT>0)landT-=dt*4;
  const lsq=Math.max(0,landT)*-.06;

  if(thirdPerson){
    camera.position.set(player.pos.x+Math.sin(yaw)*4.5,player.pos.y+2.8,player.pos.z+Math.cos(yaw)*4.5);
    camera.lookAt(player.pos.x,player.pos.y+1,player.pos.z);
  }else{
    camera.position.set(player.pos.x,player.pos.y+1.65+bobY+lsq,player.pos.z);
    camera.rotation.order='YXZ';camera.rotation.y=yaw;camera.rotation.x=pitch;camera.rotation.z=bobX;
  }
  const tFov=(keys['ShiftLeft']||keys['ShiftRight'])&&moving?(SD.ppUnlocked?92:88):75;
  camera.fov=lerp(camera.fov,tFov,.08);camera.updateProjectionMatrix();

  // Update HUD coins
  document.getElementById('hCoins').textContent=SD.coins;
}

function respawn(){
  if(player._respawning)return;player._respawning=true;setTimeout(()=>player._respawning=false,500);
  player.pos.set(player.cpPos.x,player.cpPos.y+.5,player.cpPos.z);
  player.vel.set(0,0,0);player.health=player.maxHp;player.dead=false;player.invT=1.5;
  player.jumpsLeft=SD.ppUnlocked?3:2;player.wallRunT=2;player.deaths++;
  document.getElementById('deathScreen').classList.add('hidden');
  notif('♻ YENİDEN BAŞLADI');
}

// ═══════════════════════════════════════════
//  GAME STATE + MARKET + BOXES + EVENTS
// ═══════════════════════════════════════════
function loadLevel(id){
  clearWorld();currentLevel=id;
  player.score=0;player.health=player.maxHp;player.dead=false;player.vel.set(0,0,0);player.jumpsLeft=SD.ppUnlocked?3:2;
  gameStartTime=Date.now();yaw=0;pitch=0;isPPChallenge=false;
  buildLevel(id);
  // Spawn character model
  charModel=buildChar3D(SD.equipped);scene.add(charModel);
  player.pos.set(0,3,0);player.cpPos.set(0,3,0);
  document.getElementById('deathScreen').classList.add('hidden');document.getElementById('winScreen').classList.add('hidden');
  document.getElementById('ppBar').classList.toggle('hidden',!SD.ppUnlocked);
  notif('🏁 SEVİYE '+(id+1)+' BAŞLIYOR!');
}

function loadPPChallenge(){
  clearWorld();isPPChallenge=true;ppTimer=60;
  buildPPLevel();
  charModel=buildChar3D(SD.equipped);scene.add(charModel);
  player.pos.set(0,3,0);player.cpPos.set(0,3,0);
  player.vel.set(0,0,0);player.health=player.maxHp;player.dead=false;player.jumpsLeft=2;
  yaw=0;pitch=0;
  document.getElementById('ppChallenge').classList.add('hidden');
  document.getElementById('deathScreen').classList.add('hidden');
  notif('⚡ PARKOUR PLUS GÖREVİ BAŞLADI! 60s');
  canvas.requestPointerLock();
}

function winPPChallenge(){
  SD.ppUnlocked=true;if(!SD.owned.includes('vip'))SD.owned.push('vip');saveGame();
  sfxWin();document.getElementById('ppWinScreen').classList.remove('hidden');
  if(document.exitPointerLock)document.exitPointerLock();
  document.getElementById('ppBar').classList.remove('hidden');
  document.getElementById('btnPP').classList.add('active');
  document.getElementById('btnPP').textContent='⚡ PARKOUR PLUS ✓';
}

function showDeath(msg='Öldün!'){
  if(!player.dead)return;
  const reward=Math.floor(Math.random()*15)+10;addCoins(reward,'(ölüm ödülü)');
  document.getElementById('dMsg').textContent=msg;document.getElementById('dReward').textContent=reward;
  document.getElementById('deathScreen').classList.remove('hidden');
  if(document.exitPointerLock)document.exitPointerLock();
}

function showWin(){
  const t=Math.floor((Date.now()-gameStartTime)/1000);
  const reward=50+Math.floor(player.score/10);addCoins(reward,'(seviye tamamlandı)');
  const ts=`${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`;
  document.getElementById('winScreen').classList.remove('hidden');
  document.getElementById('wReward').textContent=reward;
  document.getElementById('wStats').innerHTML=`<div><span>SKOR</span><span>${player.score}</span></div><div><span>SÜRE</span><span>${ts}</span></div><div><span>ÖLÜM</span><span>${player.deaths}</span></div><div><span>EN İYİ</span><span>${SD.best}</span></div>`;
  sfxWin();if(document.exitPointerLock)document.exitPointerLock();
}

function updateHUD(){
  document.getElementById('hCoins').textContent=SD.coins;
  const hp=clamp(player.health,0,player.maxHp);
  document.getElementById('hHp').style.width=(hp/player.maxHp*100)+'%';document.getElementById('hHpNum').textContent=Math.ceil(hp);
  if(goal){const d=Math.sqrt((player.pos.x-goal.x)**2+(player.pos.z-goal.z)**2);document.getElementById('hPbar').style.width=clamp(100-d/220*100,0,100)+'%';}
  document.getElementById('aJump').className='abil'+(player.jumpsLeft===0?' cd':'');
  const wa=document.getElementById('aWall');if(SD.ppUnlocked){wa.classList.remove('hidden');wa.className='abil pp-abil'+(player.wallRunActive?'':player.wallRunT<.1?' cd':'');}else wa.classList.add('hidden');
}

// ─── MARKET ─────────────────────────────────────────
function openMarket(){
  if(document.exitPointerLock)document.exitPointerLock();
  document.getElementById('marketScreen').classList.remove('hidden');
  document.getElementById('mktCoins').textContent=SD.coins;
  renderMarketTab('chars');
}
function closeMarket(){document.getElementById('marketScreen').classList.add('hidden');}

document.querySelectorAll('.mtab').forEach(btn=>{btn.addEventListener('click',()=>{document.querySelectorAll('.mtab').forEach(b=>b.classList.remove('active'));btn.classList.add('active');renderMarketTab(btn.dataset.tab);});});

function renderMarketTab(tab){
  const c=document.getElementById('mktContent');
  if(tab==='chars'){
    const cards=Object.entries(SKINS).map(([id,s])=>{
      const owned=SD.owned.includes(id)||id==='default';const eq=SD.equipped===id;
      const ppOnly=s.ppOnly&&!SD.ppUnlocked;
      let action='';
      if(eq)action=`<button class="char-action equipped-btn" disabled>✓ SEÇİLİ</button>`;
      else if(owned)action=`<button class="char-action equip-btn" onclick="equipSkin('${id}')">GİY</button>`;
      else if(ppOnly)action=`<button class="char-action" disabled>⚡ PP GEREKLİ</button>`;
      else action=`<button class="char-action" onclick="buySkin('${id}')" ${SD.coins<s.price?'disabled style="opacity:.4"':''}>🪙 ${s.price}</button>`;
      return `<div class="char-card${owned?' owned':''}${eq?' equipped':''}${s.ppOnly?' vip-only':''}">
        <span class="char-icon">${s.ico}</span>
        <div class="char-name">${s.name}</div>
        <span class="char-rarity r-${s.rarity}">${s.rarity.toUpperCase()}</span>
        ${action}</div>`;
    }).join('');
    c.innerHTML=`<div class="char-grid">${cards}</div>`;
  }else if(tab==='boxes'){
    c.innerHTML=`<div class="box-grid">
      <div class="box-card"><span class="box-ico">📦</span><div class="box-name">NORMAL KUTU</div><div class="box-desc">Common veya Rare karakter<br>60%/30%/10%</div><button class="char-action" onclick="openBox('normal')" ${SD.coins<100?'disabled style="opacity:.4"':''}>🪙 100</button></div>
      <div class="box-card"><span class="box-ico">🎁</span><div class="box-name">EPİK KUTU</div><div class="box-desc">Rare, Epic veya Legendary<br>40%/40%/20%</div><button class="char-action" onclick="openBox('epic')" ${SD.coins<300?'disabled style="opacity:.4"':''}>🪙 300</button></div>
    </div><p style="text-align:center;font-size:.7rem;color:rgba(255,255,255,.3);font-family:Rajdhani,sans-serif;margin-top:16px">VIP King sadece Parkour Plus görevinden kazanılır!</p>`;
  }else{
    const invCards=SD.owned.map(id=>{const s=SKINS[id];if(!s)return'';const eq=SD.equipped===id;return`<div class="inv-card${eq?' equip-active':''}"><span style="font-size:2rem">${s.ico}</span><div style="font-size:.62rem;margin-top:4px">${s.name}</div><button class="char-action equip-btn" style="margin-top:6px" onclick="equipSkin('${id}')">${eq?'✓ SEÇİLİ':'GİY'}</button></div>`;}).join('');
    c.innerHTML=`<div class="inv-grid">${invCards}</div><p style="text-align:center;font-size:.7rem;color:rgba(255,255,255,.3);font-family:Rajdhani,sans-serif;margin-top:14px">Toplam: ${SD.owned.length} karakter</p>`;
  }
}

window.equipSkin=function(id){SD.equipped=id;saveGame();notif(`👗 ${SKINS[id].name} giyildi!`);if(window.refreshMenuChar)refreshMenuChar();if(charModel){scene.remove(charModel);charModel=buildChar3D(id);scene.add(charModel);}renderMarketTab(document.querySelector('.mtab.active').dataset.tab);};
window.buySkin=function(id){const s=SKINS[id];if(SD.coins<s.price||SD.owned.includes(id))return;SD.coins-=s.price;SD.owned.push(id);document.getElementById('mktCoins').textContent=SD.coins;saveGame();sfxCash();notif(`✓ ${s.name} satın alındı!`);renderMarketTab('chars');};

// ─── LOOT BOXES ──────────────────────────────────────
const BOX_POOLS={
  normal:[{id:'graffiti',w:60},{id:'astronaut',w:30},{id:'steampunk',w:10}],
  epic:[{id:'astronaut',w:40},{id:'steampunk',w:40},{id:'ninja',w:20}],
};
window.openBox=function(type){
  const cost=type==='normal'?100:300;if(SD.coins<cost)return;
  SD.coins-=cost;document.getElementById('mktCoins').textContent=SD.coins;saveGame();
  closeMarket();
  const boxEl=document.getElementById('boxOpenScreen');boxEl.classList.remove('hidden');
  const animEl=document.getElementById('boxAnim');animEl.className='box-anim';animEl.textContent='📦';
  document.getElementById('boxResult').classList.add('hidden');document.getElementById('bBoxClose').classList.add('hidden');
  setTimeout(()=>{animEl.classList.add('opening');},200);
  setTimeout(()=>{
    // Roll
    const pool=BOX_POOLS[type];let roll=Math.random()*100,chosen=pool[pool.length-1].id;
    for(const e of pool){roll-=e.w;if(roll<=0){chosen=e.id;break;}}
    const s=SKINS[chosen];const alreadyOwned=SD.owned.includes(chosen);
    if(!alreadyOwned){SD.owned.push(chosen);saveGame();sfxWin();}else{const refund=Math.floor(cost*.3);SD.coins+=refund;saveGame();sfxCash();}
    animEl.style.display='none';
    document.getElementById('boxResultChar').textContent=s.ico;
    document.getElementById('boxResultName').textContent=s.name;
    document.getElementById('boxResultRarity').innerHTML=`<span class="char-rarity r-${s.rarity}">${s.rarity.toUpperCase()}</span>`;
    document.getElementById('boxResultStatus').textContent=alreadyOwned?`Zaten sahipsin — 🪙 ${Math.floor(cost*.3)} iade edildi`:'🎉 YENİ KARAKTER!';
    document.getElementById('boxResultStatus').style.color=alreadyOwned?'rgba(255,255,255,.4)':'#7fff00';
    document.getElementById('boxResult').classList.remove('hidden');document.getElementById('bBoxClose').classList.remove('hidden');
  },1400);
};
document.getElementById('bBoxClose').onclick=()=>{document.getElementById('boxOpenScreen').classList.add('hidden');openMarket();};

// ─── EVENTS ──────────────────────────────────────────
document.getElementById('btnPlay').onclick=()=>{loadLevel(0);canvas.requestPointerLock();};
document.getElementById('btnMarket').onclick=openMarket;
document.getElementById('hudMarket').onclick=()=>{if(locked&&document.exitPointerLock)document.exitPointerLock();openMarket();};
document.getElementById('closeMarket').onclick=closeMarket;
document.getElementById('btnPP').onclick=()=>{if(SD.ppUnlocked)notif('⚡ PP zaten aktif! VIP King giy →');else document.getElementById('ppChallenge').classList.remove('hidden');};
document.getElementById('bStartPP').onclick=loadPPChallenge;
document.getElementById('bCancelPP').onclick=()=>document.getElementById('ppChallenge').classList.add('hidden');
document.getElementById('bPPWinOK').onclick=()=>{document.getElementById('ppWinScreen').classList.add('hidden');document.getElementById('blocker').classList.remove('hidden');if(window.refreshMenuChar)refreshMenuChar();};
document.getElementById('bRespawn').onclick=()=>{respawn();canvas.requestPointerLock();};
document.getElementById('bMenu').onclick=()=>{document.getElementById('deathScreen').classList.add('hidden');document.getElementById('blocker').classList.remove('hidden');if(document.exitPointerLock)document.exitPointerLock();};
document.getElementById('bNext').onclick=()=>{document.getElementById('winScreen').classList.add('hidden');loadLevel((currentLevel+1)%4);canvas.requestPointerLock();};
document.getElementById('bReplay').onclick=()=>{document.getElementById('winScreen').classList.add('hidden');loadLevel(currentLevel);canvas.requestPointerLock();};
document.getElementById('bMenuW').onclick=()=>{document.getElementById('winScreen').classList.add('hidden');document.getElementById('blocker').classList.remove('hidden');if(document.exitPointerLock)document.exitPointerLock();};
document.getElementById('camBadge').onclick=toggleCamera;
// PP status on load
if(SD.ppUnlocked){document.getElementById('btnPP').classList.add('active');document.getElementById('btnPP').textContent='⚡ PARKOUR PLUS ✓';}

// ─── GAME LOOP ───────────────────────────────────────
let lastT=0;
function animate(ts){
  requestAnimationFrame(animate);const dt=Math.min((ts-lastT)/1000,.05);lastT=ts;
  // Moving platforms
  movingPlatforms.forEach(mp=>{mp.t+=mp.dir*mp.spd*dt;if(mp.t>=1){mp.t=1;mp.dir=-1;}if(mp.t<=0){mp.t=0;mp.dir=1;}const t2=3*mp.t*mp.t-2*mp.t*mp.t*mp.t;mp.obj.x=mp.sp.x+(mp.ep.x-mp.sp.x)*t2;mp.obj.y=mp.sp.y+(mp.ep.y-mp.sp.y)*t2;mp.obj.z=mp.sp.z+(mp.ep.z-mp.sp.z)*t2;mp.obj.mesh.position.set(mp.obj.x,mp.obj.y,mp.obj.z);});
  // Coins animate
  coins.forEach(c=>{if(!c.collected){c.mesh.rotation.y+=dt*1.8;c.mesh.position.y=c.y+Math.sin(ts*.002+c.x)*.22;}});
  // Checkpoints
  checkpoints.forEach(cp=>{cp.mesh.rotation.y+=dt*1.2;if(cp.activated){cp.mesh.material.color.setHex(0xffd700);cp.mesh.material.emissive.setHex(0x443300);}});
  // Goal
  if(goal){goal.mesh.rotation.z+=dt*1.5;if(goal.mesh.children[0])goal.mesh.children[0].rotation.x+=dt*2;goal.mesh.scale.setScalar(1+Math.sin(ts*.003)*.08);}
  // Physics + char
  if(locked&&!player.dead){physics(dt);}
  updateChar3D();
  updateHUD();clearJP();
  renderer.render(scene,camera);
}
// Init coins UI
document.getElementById('mCoins').textContent=SD.coins;document.getElementById('hCoins').textContent=SD.coins;
animate(0);
