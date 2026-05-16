// ═══════════════════════════════════════════════════════
//  PARKOUR NEXUS 3D  —  game.js
//  Roblox-style 3D blocky character + walking animation
// ═══════════════════════════════════════════════════════

// ── Save ─────────────────────────────────────────────────
const SK = 'parkourNexus3D';
let SD = {bestScore:0,deaths:0,currentLevel:0,levelsCompleted:[],levelStars:[]};
try{const d=JSON.parse(localStorage.getItem(SK));if(d)SD={...SD,...d};}catch(e){}
function saveGame(){try{localStorage.setItem(SK,JSON.stringify(SD));}catch(e){}}

// ── Canvas ────────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
function resize(){canvas.width=window.innerWidth;canvas.height=window.innerHeight;}
resize();
window.addEventListener('resize',resize);

// ── Audio ─────────────────────────────────────────────────
let _ac=null;
const vol=()=>sfxOn?0.18:0;
let sfxOn=true;
function ac(){if(!_ac)_ac=new(window.AudioContext||window.webkitAudioContext)();return _ac;}
function tone(f,t='square',d=.12,v=.15,dt=0){
  try{
    const o=ac().createOscillator(),g=ac().createGain();
    o.connect(g);g.connect(ac().destination);
    o.type=t;o.frequency.value=f;o.detune.value=dt;
    g.gain.setValueAtTime(v,ac().currentTime);
    g.gain.exponentialRampToValueAtTime(.001,ac().currentTime+d);
    o.start();o.stop(ac().currentTime+d);
  }catch(e){}
}
const sfxJump=()=>tone(340,'sine',.15,.22);
const sfxLand=()=>tone(110,'triangle',.1,.28);
const sfxDash=()=>tone(600,'sawtooth',.1,.22,-200);
const sfxWall=()=>tone(430,'sine',.12,.2,100);
const sfxDie=()=>{tone(80,'sawtooth',.4,.3);setTimeout(()=>tone(55,'sawtooth',.3,.28),160);};
const sfxCoin=()=>{tone(900,'sine',.14,.18);setTimeout(()=>tone(1100,'sine',.12,.14),80);};
const sfxCP=()=>{[440,660,880].forEach((f,i)=>setTimeout(()=>tone(f,'sine',.18,.18),i*110));};
const sfxWin=()=>{[440,550,660,880,1100].forEach((f,i)=>setTimeout(()=>tone(f,'sine',.28,.2),i*100));};

// ── Input ─────────────────────────────────────────────────
const keys={}, jp={}, jr={};
window.addEventListener('keydown',e=>{if(!keys[e.code])jp[e.code]=true;keys[e.code]=true;
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();});
window.addEventListener('keyup',e=>{jr[e.code]=true;keys[e.code]=false;});
function clearJP(){Object.keys(jp).forEach(k=>delete jp[k]);Object.keys(jr).forEach(k=>delete jr[k]);}

// ── Math ──────────────────────────────────────────────────
const lerp=(a,b,t)=>a+(b-a)*t;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rand=(a,b)=>a+Math.random()*(b-a);

// ── Camera ────────────────────────────────────────────────
const cam={
  x:0,y:0,tx:0,ty:0,
  sx:0,sy:0,smag:0,sdur:0,
  update(p){
    this.tx=p.x+p.w/2-canvas.width/2;
    this.ty=p.y+p.h/2-canvas.height/2;
    this.x=lerp(this.x,this.tx,.1);
    this.y=lerp(this.y,this.ty,.08);
    if(this.sdur>0){this.smag*=.83;this.sx=(Math.random()-.5)*2*this.smag;this.sy=(Math.random()-.5)*2*this.smag;this.sdur--;}
    else{this.sx=0;this.sy=0;}
  },
  shake(m=8,d=12){this.smag=m;this.sdur=d;},
  on(){ctx.save();ctx.translate(-this.x+this.sx,-this.y+this.sy);},
  off(){ctx.restore();}
};

// ── Particles ─────────────────────────────────────────────
const PFX=[];
let pfxOn=true;
function spawnPFX(x,y,o={}){
  if(!pfxOn)return;
  PFX.push({x,y,vx:o.vx??rand(-3,3),vy:o.vy??rand(-6,-1),
    life:o.life??rand(20,40),ml:o.life??rand(20,40),
    size:o.size??rand(2,5),color:o.color??'#00f5ff',
    grav:o.grav??.2,spin:o.spin??rand(-.12,.12),angle:0});
}
function burst(x,y,n=12,o={}){
  for(let i=0;i<n;i++){const a=Math.PI*2/n*i+rand(-.3,.3),s=rand(o.s0??2,o.s1??7);
    spawnPFX(x,y,{...o,vx:Math.cos(a)*s,vy:Math.sin(a)*s});}
}
function dust(x,y,d=1){
  for(let i=0;i<8;i++)spawnPFX(x,y,{vx:rand(-2.5,0)*d,vy:rand(-3.5,-.5),
    size:rand(3,8),color:`hsl(${rand(15,35)},55%,55%)`,life:rand(14,28),grav:.14});
}
function trail(x,y,c='#00f5ff'){
  spawnPFX(x,y,{vx:rand(-.8,.8),vy:rand(-.8,.8),size:rand(2,4),color:c,life:rand(6,14),grav:0});
}
function updatePFX(){
  for(let i=PFX.length-1;i>=0;i--){
    const p=PFX[i];p.x+=p.vx;p.y+=p.vy;p.vy+=p.grav;p.vx*=.97;p.life--;p.angle+=p.spin;
    if(p.life<=0)PFX.splice(i,1);
  }
}
function drawPFX(){
  PFX.forEach(p=>{
    const t=p.life/p.ml;
    ctx.save();ctx.globalAlpha=t*.85;ctx.fillStyle=p.color;
    ctx.shadowBlur=8;ctx.shadowColor=p.color;
    ctx.translate(p.x,p.y);ctx.rotate(p.angle);
    ctx.fillRect(-p.size/2,-p.size/2,p.size*t,p.size*t);
    ctx.restore();
  });
}

// ══════════════════════════════════════════════════════════
//  3D BOX DRAWING  (pseudo-3D, side-scroll perspective)
// ══════════════════════════════════════════════════════════
const D3 = {
  DEPTH: 10,      // depth in pixels
  AX:  0.82,      // cos(35°)
  AY: -0.42,      // -sin(25°)  — top face lean

  // Draw a 3D box given front-face rect
  box(ctx, x, y, w, h, cFront, cTop, cSide, opts={}) {
    const dep = opts.dep ?? this.DEPTH;
    const ax  = opts.ax  ?? this.AX;
    const ay  = opts.ay  ?? this.AY;
    const dx  = ax * dep;
    const dy  = ay * dep;

    // Side face (right)
    ctx.beginPath();
    ctx.moveTo(x+w,    y);
    ctx.lineTo(x+w+dx, y+dy);
    ctx.lineTo(x+w+dx, y+h+dy);
    ctx.lineTo(x+w,    y+h);
    ctx.closePath();
    ctx.fillStyle = cSide;
    ctx.fill();

    // Top face
    ctx.beginPath();
    ctx.moveTo(x,      y);
    ctx.lineTo(x+dx,   y+dy);
    ctx.lineTo(x+w+dx, y+dy);
    ctx.lineTo(x+w,    y);
    ctx.closePath();
    ctx.fillStyle = cTop;
    ctx.fill();

    // Front face
    ctx.fillStyle = cFront;
    ctx.fillRect(x, y, w, h);

    // Edge highlight
    if(opts.edge!==false){
      ctx.strokeStyle = opts.edgeColor ?? 'rgba(255,255,255,0.18)';
      ctx.lineWidth = opts.edgeW ?? 1;
      ctx.strokeRect(x, y, w, h);
    }
  },

  // Shade helper: darken a hex color
  shade(hex, factor) {
    let r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
    r=Math.floor(r*factor);g=Math.floor(g*factor);b=Math.floor(b*factor);
    return `rgb(${r},${g},${b})`;
  },

  // Draw a rounded box (for character parts)
  rbox(ctx, x, y, w, h, cFront, cTop, cSide, opts={}) {
    const dep = opts.dep ?? 8;
    const dx  = this.AX * dep, dy = this.AY * dep;

    // Side
    ctx.beginPath();
    ctx.moveTo(x+w, y+4); ctx.lineTo(x+w+dx, y+4+dy);
    ctx.lineTo(x+w+dx, y+h-4+dy); ctx.lineTo(x+w, y+h-4);
    ctx.closePath();
    ctx.fillStyle = cSide; ctx.fill();

    // Top
    ctx.beginPath();
    ctx.moveTo(x+4, y); ctx.lineTo(x+4+dx, y+dy);
    ctx.lineTo(x+w-4+dx, y+dy); ctx.lineTo(x+w-4, y);
    ctx.closePath();
    ctx.fillStyle = cTop; ctx.fill();

    // Front (rounded)
    ctx.beginPath();
    const r = opts.r ?? 3;
    ctx.roundRect ? ctx.roundRect(x,y,w,h,r) : ctx.rect(x,y,w,h);
    ctx.fillStyle = cFront; ctx.fill();

    // outline
    if(opts.outline!==false){
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x,y,w,h,r) : ctx.rect(x,y,w,h);
      ctx.stroke();
    }
  }
};

// ══════════════════════════════════════════════════════════
//  ROBLOX-STYLE 3D PLAYER
// ══════════════════════════════════════════════════════════
class Player {
  constructor(x,y){
    this.x=x;this.y=y;this.w=30;this.h=48;
    this.vx=0;this.vy=0;
    this.onGround=false;this.onWall=0;
    this.jumpsLeft=2;this.dashLeft=1;
    this.dashing=false;this.dashTimer=0;
    this.wallSlide=false;this.wjLock=0;
    this.crouching=false;
    this.health=100;this.maxHp=100;
    this.dead=false;this.inv=0;
    this.facing=1;
    this.score=0;this.combo=0;this.comboT=0;
    this.cpX=x;this.cpY=y;
    this.deaths=0;this.dist=0;
    this.dashCD=0;this.dashCDmax=60;
    this.coyote=0;this.jbuf=0;
    this.startTime=Date.now();

    // ── Walk animation state ─────────────────────────────
    this.walkCycle=0;      // 0..2π, drives all limb swing
    this.walkSpeed=0;      // how fast cycle advances (= |vx|)
    this.bobY=0;           // vertical bob offset
    this.landSquish=0;     // squish on landing (0..1)
    this.headBob=0;        // head tilt
    this.armSwing=0;       // arm swing angle
    this.legSwing=0;       // leg swing angle (mirrored for each leg)

    // character skin colours (Roblox-ish)
    this.clrSkin   = '#f5c18a';
    this.clrHoodie = '#1a5fad';
    this.clrPants  = '#1a1a2e';
    this.clrShoes  = '#2255cc';
    this.clrHat    = '#1e1e1e';
    this.clrAccent = '#ffffff';
  }

  get cx(){return this.x+this.w/2;}
  get cy(){return this.y+this.h/2;}
  get bottom(){return this.y+this.h;}
  get right(){return this.x+this.w;}

  // ── Physics helpers ───────────────────────────────────
  _ov(r){return this.x<r.x+r.w&&this.right>r.x&&this.y<r.y+r.h&&this.bottom>r.y;}

  _colX(plats){
    this.onWall=0;
    plats.forEach(p=>{if(!p.solid)return;
      if(this.y<p.y+p.h&&this.bottom>p.y){
        if(this.x<p.x+p.w&&this.right>p.x){
          if(this.vx>0&&this.x<p.x){this.x=p.x-this.w;this.vx=0;this.onWall=1;}
          else if(this.vx<0&&this.right>p.x+p.w){this.x=p.x+p.w;this.vx=0;this.onWall=-1;}
        }
      }
    });
  }

  _colY(plats){
    this.onGround=false;
    plats.forEach(p=>{
      if(this.x<p.x+p.w&&this.right>p.x){
        if(p.oneWay){
          if(this.vy>=0&&this.y<p.y&&this.bottom>p.y&&this.bottom<p.y+p.h+this.vy+6){
            if(!keys['KeyS']&&!keys['ArrowDown']){this.y=p.y-this.h;this.vy=0;this.onGround=true;}
          }
        } else if(p.solid){
          if(this.y<p.y+p.h&&this.bottom>p.y){
            if(this.vy>0&&this.y<p.y){this.y=p.y-this.h;this.vy=0;this.onGround=true;}
            else if(this.vy<0&&this.bottom>p.y+p.h){this.y=p.y+p.h;this.vy=0;}
          }
        }
      }
    });
    // ride moving platforms
    plats.forEach(p=>{
      if(!p.moving)return;
      if(this.onGround&&p._ly!==undefined&&Math.abs(this.bottom-p.y)<4){
        this.x+=p.vx||0;this.y+=p.vy||0;
      }
    });
  }

  setCP(x,y){this.cpX=x;this.cpY=y;sfxCP();showNotif('KONTROL NOKTASI ✓');
    burst(x,y,12,{color:'#ffd700',s0:2,s1:6});}

  addScore(pts,lbl){
    this.score+=pts;if(this.score>SD.bestScore)SD.bestScore=this.score;
    this.combo++;this.comboT=120;showNotif(`+${pts} ${lbl||''}`);
  }

  respawn(){
    this.x=this.cpX;this.y=this.cpY-this.h;
    this.vx=0;this.vy=0;this.health=this.maxHp;
    this.dead=false;this.inv=60;
    this.dashing=false;this.dashTimer=0;this.jumpsLeft=2;this.dashLeft=1;
    this.deaths++;SD.deaths++;
    cam.shake(14,22);burst(this.cx,this.cy,18,{color:'#ff006e',s0:3,s1:9});
  }

  update(plats,hazards,coins,cps,lw,lh){
    if(this.dead)return;
    if(this.inv>0)this.inv--;
    if(this.coyote>0)this.coyote--;
    if(this.jbuf>0)this.jbuf--;
    if(this.dashCD>0)this.dashCD--;
    if(this.wjLock>0)this.wjLock--;
    if(this.comboT>0){this.comboT--;if(this.comboT===0)this.combo=0;}
    if(this.landSquish>0)this.landSquish=lerp(this.landSquish,0,.18);

    const L=keys['KeyA']||keys['ArrowLeft'];
    const R=keys['KeyD']||keys['ArrowRight'];
    const J=jp['Space']||jp['KeyW']||jp['ArrowUp'];
    const S=keys['KeyS']||keys['ArrowDown'];
    const SH=keys['ShiftLeft']||keys['ShiftRight'];
    const DSH=jp['ShiftLeft']||jp['ShiftRight'];

    this.crouching=S&&this.onGround;
    if(!this.crouching)this.h=48; else{this.y+=this.h-30;this.h=30;}

    const maxSpd=(SH?9:5.5)*(this.crouching?.5:1);
    const acc=this.onGround?1.3:.5;
    const fric=this.onGround?.78:.95;

    if(!this.dashing){
      if(L){this.vx-=acc;this.facing=-1;}
      if(R){this.vx+=acc;this.facing=1;}
      if(!L&&!R)this.vx*=fric;
      this.vx=clamp(this.vx,-maxSpd,maxSpd);
    }

    // Dash
    if(DSH&&this.dashLeft>0&&this.dashCD===0&&!this.crouching){
      const dd=L?-1:R?1:this.facing;
      this.vx=dd*17;this.vy=-2;this.dashing=true;this.dashTimer=11;
      this.dashLeft--;this.dashCD=this.dashCDmax;
      sfxDash();burst(this.cx,this.cy,10,{color:'#00f5ff',s0:2,s1:6});
    }
    if(this.dashing){this.dashTimer--;trail(this.cx,this.cy,'#00f5ff');if(this.dashTimer<=0)this.dashing=false;}

    // Gravity
    if(!this.dashing){
      if(this.wallSlide){this.vy=Math.min(this.vy+.35,1.8);}
      else{
        const gs=(keys['Space']||keys['KeyW']||keys['ArrowUp'])&&this.vy<0?.5:1;
        this.vy+=.68*gs;
        if(S&&this.vy>0&&!this.onGround)this.vy+=.55;
      }
      this.vy=Math.min(this.vy,22);
    }

    if(J)this.jbuf=11;

    // Jump logic
    if(this.jbuf>0){
      if(this.onWall!==0&&this.wjLock===0&&!this.onGround){
        this.vx=-this.onWall*9.5;this.vy=-14;this.jumpsLeft=1;this.jbuf=0;this.wjLock=18;
        sfxWall();burst(this.cx,this.cy,8,{color:'#7fff00',s0:2,s1:5});cam.shake(4,8);
      } else if((this.onGround||this.coyote>0)&&this.vy>=0){
        this.vy=-15.5;this.jumpsLeft=1;this.coyote=0;this.jbuf=0;
        sfxJump();dust(this.cx,this.bottom,-this.facing);cam.shake(2,5);
      } else if(this.jumpsLeft>0&&!this.onGround&&this.coyote===0){
        this.vy=-13.5;this.jumpsLeft--;this.jbuf=0;
        sfxJump();burst(this.cx,this.cy+this.h/2,10,{color:'#00f5ff',s0:1,s1:4,vy:-2});cam.shake(2,4);
      }
    }

    this.x+=this.vx;this._colX(plats);
    this.y+=this.vy;
    const wasG=this.onGround;this._colY(plats);

    if(!wasG&&this.onGround){
      sfxLand();this.landSquish=1;
      if(Math.abs(this.vy)>9){cam.shake(6,10);dust(this.cx,this.bottom,this.facing);}
      this.jumpsLeft=2;this.dashLeft=1;
    }
    if(wasG&&!this.onGround&&this.vy>=0)this.coyote=8;
    this.wallSlide=!this.onGround&&this.vy>0&&this.onWall!==0;

    // Hazards
    if(this.inv===0)hazards.forEach(h=>{if(this._ov(h))this.takeDmg(h.damage||25);});

    // Pit
    if(this.y>lh+300)this.die();
    if(this.x<-60){this.x=-60;this.vx=0;}

    // Coins
    for(let i=coins.length-1;i>=0;i--){
      const c=coins[i];
      if(!c.collected&&this._ov(c)){c.collected=true;sfxCoin();this.addScore(c.value||50,'KOİN');burst(c.x+c.w/2,c.y+c.h/2,10,{color:'#ffd700',s0:2,s1:5});}
    }

    // Checkpoints
    cps.forEach(cp=>{if(!cp.activated&&this._ov(cp)){cp.activated=true;this.setCP(cp.x,cp.y);}});

    this.dist=Math.max(this.dist,Math.floor(this.x/60));

    // ── Walk animation update ──────────────────────────────
    this._updateAnim();
  }

  takeDmg(amt){
    if(this.inv>0)return;
    this.health-=amt;this.inv=60;
    cam.shake(10,15);burst(this.cx,this.cy,12,{color:'#ff006e',s0:2,s1:6});
    if(this.health<=0)this.die();
  }

  die(){if(this.dead)return;this.dead=true;sfxDie();cam.shake(20,30);burst(this.cx,this.cy,24,{color:'#ff006e',s0:4,s1:12,glow:true});}

  _updateAnim(){
    // walkCycle advances proportional to horizontal speed
    const speed=Math.abs(this.vx);
    this.walkSpeed=speed;

    if(this.onGround&&speed>0.3){
      this.walkCycle+=speed*0.065;           // how fast cycle goes
    } else if(!this.onGround){
      this.walkCycle+=0.04;                  // idle cycle in air
    } else {
      // idle: gently sway
      this.walkCycle+=0.02;
    }

    // limb angles driven by sine wave
    const swing = this.onGround ? Math.sin(this.walkCycle) : 0;
    const airSwing = !this.onGround ? Math.sin(this.walkCycle)*0.4 : 0;

    this.legSwing  = this.onGround ? swing : airSwing;
    this.armSwing  = this.onGround ? -swing * 0.7 : airSwing;

    // vertical body bob while running
    this.bobY = this.onGround && speed>0.3 ? Math.abs(Math.sin(this.walkCycle))*3 : 0;

    // head tilt based on direction change
    this.headBob = this.onGround ? Math.sin(this.walkCycle*0.5)*1.5 : 0;
  }

  // ── DRAW ROBLOX 3D CHARACTER ──────────────────────────────
  draw(ctx){
    if(this.dead)return;
    ctx.save();

    // flash when invincible
    if(this.inv>0&&Math.floor(this.inv/4)%2===0){ctx.globalAlpha=0.35;}

    // pivot at bottom-center of physics box
    const px=this.x+this.w/2;
    const py=this.bottom;

    ctx.translate(px, py);
    ctx.scale(this.facing, 1);   // flip when facing left

    // squish/stretch on landing
    const sy = this.landSquish>0 ? 1-this.landSquish*0.2 : 1;
    const sx2= this.landSquish>0 ? 1+this.landSquish*0.15 : 1;
    ctx.scale(sx2, sy);

    // bob offset
    const bob = this.bobY;

    // === Character proportions (centered on x=0, feet at y=0) ===
    // Part heights: shoes=7, legs=18, torso=22, head=20, hat=9
    const FOOT_Y  =  0;
    const LEG_Y   = -7;     // top of shoes
    const TORSO_Y = -7-18;  // top of legs
    const HEAD_Y  = -7-18-22;
    const HAT_Y   = -7-18-22-18; // top of head (head h=18, then hat)

    const cF=this.clrHoodie, cT=this._lighten(cF,.3), cS=this._darken(cF,.25);
    const pF=this.clrPants,  pT=this._lighten(pF,.3), pS=this._darken(pF,.25);
    const skF=this.clrSkin,  skT=this._lighten(skF,.25),skS=this._darken(skF,.2);
    const shF=this.clrShoes, shT=this._lighten(shF,.3), shS=this._darken(shF,.2);
    const hF=this.clrHat,    hT=this._lighten(hF,.2),   hS=this._darken(hF,.15);

    const dep=9;

    // ── LEGS (two separate blocks, animated) ─────────────
    // Right leg (forward when swing>0)
    this._drawLimb(ctx,
      6, LEG_Y-bob, 11, 18,        // x,y,w,h relative to pivot
      pF,pT,pS, dep,
      -this.legSwing*18,            // rotation angle (degrees)
      6, 0                          // rotation pivot x,y (bottom of limb)
    );
    // Left leg (backward when swing>0)
    this._drawLimb(ctx,
      -17, LEG_Y-bob, 11, 18,
      pF,pT,pS, dep,
      this.legSwing*18,
      -17+5.5, 0
    );

    // ── SHOES ────────────────────────────────────────────
    this._drawLimb(ctx, 4, FOOT_Y-7-bob, 13, 7, shF,shT,shS, dep,
      -this.legSwing*18, 10, 0);
    this._drawLimb(ctx,-17, FOOT_Y-7-bob, 13, 7, shF,shT,shS, dep,
      this.legSwing*18, -17+6, 0);

    // ── TORSO (hoodie) ───────────────────────────────────
    D3.rbox(ctx, -14, TORSO_Y-bob, 28, 22, cF,cT,cS, {dep,r:4});

    // Hoodie pocket detail
    ctx.fillStyle='rgba(0,0,0,0.18)';
    ctx.fillRect(-7, TORSO_Y-bob+14, 14, 6);
    // "R" logo
    ctx.fillStyle='rgba(255,255,255,0.5)';
    ctx.font='bold 8px Orbitron,sans-serif';
    ctx.textAlign='center';
    ctx.fillText('R', 0, TORSO_Y-bob+10);

    // ── ARMS ─────────────────────────────────────────────
    // Right arm
    this._drawLimb(ctx,
      14, TORSO_Y-bob, 9, 18,
      cF,cT,cS, dep,
      this.armSwing*28, 14+4, 0
    );
    // Left arm
    this._drawLimb(ctx,
      -23, TORSO_Y-bob, 9, 18,
      cF,cT,cS, dep,
      -this.armSwing*28, -23+4, 0
    );

    // ── HANDS (skin) ─────────────────────────────────────
    this._drawLimb(ctx, 15, TORSO_Y-bob+14, 7, 6, skF,skT,skS, dep*0.5,
      this.armSwing*28, 18, 0);
    this._drawLimb(ctx,-22, TORSO_Y-bob+14, 7, 6, skF,skT,skS, dep*0.5,
      -this.armSwing*28, -22+3, 0);

    // ── NECK ─────────────────────────────────────────────
    D3.rbox(ctx, -4, HEAD_Y-bob+2, 8, 6, skF,skT,skS, {dep:5,r:2});

    // ── HEAD ─────────────────────────────────────────────
    const headTilt = this.headBob;
    ctx.save();
    ctx.translate(0, HEAD_Y-bob+2);
    ctx.rotate(headTilt*Math.PI/180);
    D3.rbox(ctx, -10, -18, 20, 18, skF,skT,skS, {dep:9,r:5});

    // Face details
    // Glasses
    ctx.fillStyle='rgba(0,0,0,0.15)';
    ctx.fillRect(-9, -14, 8, 5);
    ctx.fillRect(1,  -14, 8, 5);
    ctx.strokeStyle='rgba(0,0,0,0.4)';ctx.lineWidth=1;
    ctx.strokeRect(-9,-14,8,5);ctx.strokeRect(1,-14,8,5);
    ctx.beginPath();ctx.moveTo(-1,-12);ctx.lineTo(1,-12);ctx.stroke();
    // Eyes
    ctx.fillStyle='#1a1a2a';
    ctx.fillRect(-7,-12,3,3);ctx.fillRect(3,-12,3,3);
    // Eye shine
    ctx.fillStyle='rgba(255,255,255,0.7)';
    ctx.fillRect(-6.5,-12,1.5,1.5);ctx.fillRect(3.5,-12,1.5,1.5);
    // Smile
    ctx.strokeStyle='rgba(0,0,0,0.3)';ctx.lineWidth=1;
    ctx.beginPath();ctx.arc(0,-8,3,0,Math.PI);ctx.stroke();
    ctx.restore();

    // ── HAT (beanie) ─────────────────────────────────────
    ctx.save();
    ctx.translate(0, HEAD_Y-bob+2);
    ctx.rotate(headTilt*Math.PI/180);
    D3.rbox(ctx, -11, -26, 22, 10, hF,hT,hS, {dep:7,r:4});
    // Skull logo on hat
    ctx.fillStyle='rgba(255,255,255,0.4)';
    ctx.font='bold 7px sans-serif';
    ctx.textAlign='center';
    ctx.fillText('☠', 0, -19);
    // Hat brim fold line
    ctx.strokeStyle='rgba(255,255,255,0.12)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(-11,-18);ctx.lineTo(11,-18);ctx.stroke();
    ctx.restore();

    // ── Backpack ─────────────────────────────────────────
    // (visible when facing right; drawn behind torso — order handled by ctx layers)
    this._drawBackpack(ctx, TORSO_Y-bob);

    // ── Glow outline when dashing ─────────────────────────
    if(this.dashing){
      ctx.globalAlpha=0.4;
      ctx.shadowBlur=20;ctx.shadowColor='#00f5ff';
      ctx.strokeStyle='#00f5ff';ctx.lineWidth=2;
      ctx.strokeRect(-16,HEAD_Y-bob-28,32,55);
    }

    ctx.restore();
  }

  _drawBackpack(ctx, torsoY){
    // Backpack only visible on right face (when facing right = scale(1,1))
    const dep=8;
    // drawn behind = at larger x offset showing the side face
    D3.rbox(ctx, 14+dep*D3.AX-2, torsoY+2, 10, 16,
      '#1a3a8a',
      this._lighten('#1a3a8a',.2),
      this._darken('#1a3a8a',.2),
      {dep:5,r:3}
    );
  }

  // Draw a limb block with rotation around given pivot
  _drawLimb(ctx, x, y, w, h, cF, cT, cS, dep, angleDeg, pivotX, pivotY){
    ctx.save();
    ctx.translate(pivotX ?? x+w/2, pivotY ?? y);
    ctx.rotate(angleDeg * Math.PI/180);
    ctx.translate(-(pivotX ?? x+w/2), -(pivotY ?? y));
    D3.rbox(ctx, x, y, w, h, cF, cT, cS, {dep, r:3});
    ctx.restore();
  }

  _lighten(hex, f){
    let r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
    r=Math.min(255,Math.floor(r+(255-r)*f));
    g=Math.min(255,Math.floor(g+(255-g)*f));
    b=Math.min(255,Math.floor(b+(255-b)*f));
    return `rgb(${r},${g},${b})`;
  }
  _darken(hex, f){
    let r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
    r=Math.floor(r*(1-f));g=Math.floor(g*(1-f));b=Math.floor(b*(1-f));
    return `rgb(${r},${g},${b})`;
  }
}

// ══════════════════════════════════════════════════════════
//  3D PLATFORM
// ══════════════════════════════════════════════════════════
class Platform {
  constructor(x,y,w,h,opts={}){
    this.x=x;this.y=y;this.w=w;this.h=h;
    this.solid=opts.solid??true;this.oneWay=opts.oneWay??false;
    this.moving=opts.moving??false;
    this.type=opts.type??'normal';
    this.mx0=x;this.my0=y;this.mx1=opts.mx1??x;this.my1=opts.my1??y;
    this.msp=opts.msp??1.5;this.mt=0;this.mdir=1;this.vx=0;this.vy=0;this._lx=x;this._ly=y;
    this.crumbling=false;this.crumbleT=0;this.crumbleMax=55;this.crumbled=false;
    this.visible=true;this.visT=0;this.visPer=opts.visPer??110;this.visOn=opts.visOn??70;
    this.animT=0;
    // 3D depth
    this.depth = opts.depth ?? 14;
  }

  update(player){
    this._lx=this.x;this._ly=this.y;this.animT++;
    if(this.moving){
      this.mt+=this.mdir*this.msp/100;
      if(this.mt>=1){this.mt=1;this.mdir=-1;}if(this.mt<=0){this.mt=0;this.mdir=1;}
      const t=3*this.mt*this.mt-2*this.mt*this.mt*this.mt;
      const nx=lerp(this.mx0,this.mx1,t),ny=lerp(this.my0,this.my1,t);
      this.vx=nx-this.x;this.vy=ny-this.y;this.x=nx;this.y=ny;
    }
    if(this.type==='disappear'){
      this.visT++;if(this.visT>=this.visPer)this.visT=0;
      this.visible=this.visT<this.visOn;this.solid=this.visible;
    }
    if(this.type==='crumble'&&this.crumbling){
      this.crumbleT++;if(this.crumbleT>=this.crumbleMax){this.crumbled=true;this.solid=false;}
    }
  }

  startCrumble(){if(this.type==='crumble'&&!this.crumbling){this.crumbling=true;this.crumbleT=0;}}
  isStoodOn(p){return Math.abs(p.bottom-this.y)<4&&p.x<this.x+this.w&&p.right>this.x;}

  draw(ctx){
    if(!this.visible){
      ctx.save();ctx.globalAlpha=0.18;ctx.strokeStyle='#00f5ff';ctx.lineWidth=1;ctx.setLineDash([4,4]);
      ctx.strokeRect(this.x,this.y,this.w,this.h);ctx.restore();return;
    }

    ctx.save();
    if(this.crumbling){
      const t=this.crumbleT/this.crumbleMax;
      ctx.globalAlpha=1-t*.85;
      ctx.translate((Math.random()-.5)*t*2.5,(Math.random()-.5)*t*2.5);
    }

    // Pick colours by type
    let cF,cT,cS,glowColor=null;
    switch(this.type){
      case 'lava':   cF='#cc2200';cT='#ff4400';cS='#881100';glowColor='#ff3300';break;
      case 'ice':    cF='#88ccee';cT='#bbddff';cS='#5599bb';glowColor='#aaddff';break;
      case 'bounce': cF='#228800';cT='#44ff00';cS='#115500';glowColor='#7fff00';break;
      case 'crumble':cF='#7a5533';cT='#aa7755';cS='#553322';break;
      default:
        if(this.oneWay){cF='#0d3320';cT='#1a6640';cS='#082210';glowColor='#2ecc71';}
        else{cF='#0e1c3d';cT='#1a3060';cS='#080e24';glowColor='#00f5ff';}
    }

    // Lava pulse
    if(this.type==='lava'){
      const p=Math.sin(this.animT*.12)*.15;
      ctx.globalAlpha=(ctx.globalAlpha||1)-(ctx.globalAlpha||1)*p;
    }

    // Glow shadow on special types
    if(glowColor){ctx.shadowBlur=8;ctx.shadowColor=glowColor;}

    D3.box(ctx,this.x,this.y,this.w,this.h,cF,cT,cS,{dep:this.depth,edge:true,edgeColor:'rgba(255,255,255,0.12)'});

    // Top surface texture
    if(this.oneWay){
      ctx.shadowBlur=12;ctx.shadowColor='#2ecc71';
      ctx.strokeStyle='#2ecc71';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(this.x,this.y);ctx.lineTo(this.x+this.w,this.y);ctx.stroke();
    }

    // Moving platform indicator dots
    if(this.moving){
      ctx.fillStyle='rgba(0,245,255,0.5)';
      for(let i=0;i<3;i++){
        const ox=(this.animT*1.5+i*8)%(this.w+16)-8;
        ctx.beginPath();ctx.arc(this.x+ox,this.y+3,2,0,Math.PI*2);ctx.fill();
      }
    }

    // Ice shine overlay
    if(this.type==='ice'){
      ctx.globalAlpha=0.2;ctx.fillStyle='rgba(255,255,255,0.8)';
      ctx.fillRect(this.x+2,this.y+2,this.w-4,4);
    }

    ctx.restore();
  }
}

// ── Hazard ────────────────────────────────────────────────
class Hazard {
  constructor(x,y,w,h,opts={}){
    this.x=x;this.y=y;this.w=w;this.h=h;
    this.type=opts.type??'spike';this.damage=opts.damage??25;
    this.moving=opts.moving??false;
    this.mx0=x;this.mx1=opts.mx1??x;this.my0=y;this.my1=opts.my1??y;
    this.msp=opts.msp??1;this.mt=0;this.mdir=1;this.animT=0;
  }
  update(){
    this.animT++;
    if(this.moving){
      this.mt+=this.mdir*this.msp/100;
      if(this.mt>=1){this.mt=1;this.mdir=-1;}if(this.mt<=0){this.mt=0;this.mdir=1;}
      const t=3*this.mt*this.mt-2*this.mt*this.mt*this.mt;
      this.x=lerp(this.mx0,this.mx1,t);this.y=lerp(this.my0,this.my1,t);
    }
  }
  draw(ctx){
    ctx.save();
    if(this.type==='spike')this._spike(ctx);
    else if(this.type==='laser')this._laser(ctx);
    else if(this.type==='saw')this._saw(ctx);
    ctx.restore();
  }
  _spike(ctx){
    const n=Math.max(1,Math.floor(this.w/18)),sw=this.w/n;
    ctx.shadowBlur=8;ctx.shadowColor='#ff0044';
    for(let i=0;i<n;i++){
      const sx=this.x+i*sw;
      ctx.beginPath();ctx.moveTo(sx,this.y+this.h);ctx.lineTo(sx+sw/2,this.y);ctx.lineTo(sx+sw,this.y+this.h);ctx.closePath();
      const g=ctx.createLinearGradient(sx,this.y,sx,this.y+this.h);
      g.addColorStop(0,'#ff5577');g.addColorStop(1,'#440011');ctx.fillStyle=g;ctx.fill();
      // 3D side on spike
      ctx.fillStyle='#660022';
      ctx.beginPath();ctx.moveTo(sx+sw,this.y+this.h);ctx.lineTo(sx+sw+4,this.y+this.h-2);ctx.lineTo(sx+sw/2+4,this.y+2);ctx.lineTo(sx+sw/2,this.y);ctx.closePath();ctx.fill();
    }
  }
  _laser(ctx){
    const p=Math.sin(this.animT*.14)*.4+.6;
    ctx.shadowBlur=18;ctx.shadowColor='#ff006e';
    ctx.fillStyle=`rgba(255,0,100,${p})`;ctx.fillRect(this.x,this.y,this.w,this.h);
    ctx.fillStyle=`rgba(255,200,220,${p*.5})`;ctx.fillRect(this.x+1,this.y+1,this.w-2,this.h-2);
  }
  _saw(ctx){
    const cx=this.x+this.w/2,cy=this.y+this.h/2,r=this.w/2,ang=this.animT*.09;
    ctx.translate(cx,cy);ctx.rotate(ang);
    ctx.shadowBlur=12;ctx.shadowColor='#ff0044';
    ctx.beginPath();
    const teeth=12;
    for(let i=0;i<teeth;i++){
      const a=Math.PI*2/teeth*i,b=Math.PI*2/teeth*(i+.5);
      ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);ctx.lineTo(Math.cos(b)*(r*.6),Math.sin(b)*(r*.6));
    }
    ctx.closePath();ctx.fillStyle='#cc0033';ctx.fill();
    ctx.strokeStyle='#ff4466';ctx.lineWidth=1.5;ctx.stroke();
  }
}

// ── Coin ──────────────────────────────────────────────────
class Coin {
  constructor(x,y,opts={}){
    this.x=x;this.y=y;this.w=20;this.h=20;
    this.value=opts.value??50;this.collected=false;
    this.baseY=y;this.t=Math.random()*Math.PI*2;
    this.color=this.value>=200?'#ff006e':this.value>=100?'#00f5ff':'#ffd700';
    this.rotAngle=0;
  }
  update(){this.t+=.06;this.y=this.baseY+Math.sin(this.t)*5;this.rotAngle+=.04;}
  draw(ctx){
    if(this.collected)return;
    ctx.save();
    const cx=this.x+this.w/2,cy=this.y+this.h/2,r=this.w/2;
    // 3D coin: ellipse (rotated)
    ctx.shadowBlur=14;ctx.shadowColor=this.color;
    const scaleX=Math.abs(Math.cos(this.rotAngle));
    ctx.translate(cx,cy);ctx.scale(scaleX,1);
    const g=ctx.createRadialGradient(-r*.3,-r*.3,0,0,0,r);
    g.addColorStop(0,'rgba(255,255,255,.9)');g.addColorStop(.4,this.color);g.addColorStop(1,'rgba(0,0,0,.4)');
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();
    if(this.value>=100){ctx.fillStyle='rgba(255,255,255,.85)';ctx.font=`${r*1.2}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('★',0,0);}
    ctx.restore();
  }
}

// ── Checkpoint ────────────────────────────────────────────
class Checkpoint {
  constructor(x,y){this.x=x;this.y=y;this.w=22;this.h=58;this.activated=false;this.animT=0;}
  update(){this.animT++;}
  draw(ctx){
    ctx.save();
    const cx=this.x+this.w/2;
    const color=this.activated?'#ffd700':'#00f5ff';
    // pole with 3D
    D3.box(ctx,cx-3,this.y,6,this.h,'#666','#888','#444',{dep:3});
    // flag
    ctx.shadowBlur=12;ctx.shadowColor=color;ctx.fillStyle=color;
    const wave=Math.sin(this.animT*.1)*4;
    ctx.beginPath();ctx.moveTo(cx,this.y);ctx.lineTo(cx+20+wave,this.y+10);ctx.lineTo(cx+18+wave,this.y+22);ctx.lineTo(cx,this.y+19);ctx.closePath();ctx.fill();
    if(this.activated){ctx.globalAlpha=Math.sin(this.animT*.1)*.3+.05;ctx.fillStyle=color;ctx.beginPath();ctx.arc(cx,this.y+this.h/2,(this.animT%60)*1.2,0,Math.PI*2);ctx.fill();}
    ctx.restore();
  }
}

// ── GoalFlag ──────────────────────────────────────────────
class GoalFlag {
  constructor(x,y){this.x=x;this.y=y;this.w=28;this.h=76;this.animT=0;this.reached=false;}
  update(p){
    this.animT++;
    if(!this.reached&&p.x<this.x+this.w+20&&p.right>this.x&&p.y<this.y+this.h&&p.bottom>this.y)this.reached=true;
  }
  draw(ctx){
    ctx.save();
    const cx=this.x+this.w/2,c=this.reached?'#7fff00':'#ffd700';
    ctx.shadowBlur=18;ctx.shadowColor=c;
    D3.box(ctx,cx-3,this.y,6,this.h,'#777','#999','#555',{dep:3});
    const wave=Math.sin(this.animT*.09)*8;
    ctx.fillStyle=c;
    ctx.beginPath();ctx.moveTo(cx,this.y);ctx.lineTo(cx+28+wave,this.y+14);ctx.lineTo(cx+26+wave,this.y+30);ctx.lineTo(cx,this.y+27);ctx.closePath();ctx.fill();
    ctx.globalAlpha=.12+Math.sin(this.animT*.08)*.08;
    ctx.fillStyle=c;ctx.beginPath();ctx.arc(cx,this.y+this.h/2,28+Math.sin(this.animT*.06)*8,0,Math.PI*2);ctx.fill();
    ctx.restore();
  }
}

// ══════════════════════════════════════════════════════════
//  LEVELS
// ══════════════════════════════════════════════════════════
const LEVEL_META=[
  {name:'Başlangıç Yolu',   diff:'easy',    emoji:'🌆'},
  {name:'Gökdelenler Üstü', diff:'medium',  emoji:'🏙️'},
  {name:'Buz Zirvesi',      diff:'medium',  emoji:'❄️'},
  {name:'Lav Koşusu',       diff:'hard',    emoji:'🌋'},
  {name:'Matrix Labirenti', diff:'hard',    emoji:'💻'},
  {name:'Neon Gece',        diff:'hard',    emoji:'🌃'},
  {name:'Yerçekimi Kaos',   diff:'extreme', emoji:'🌀'},
  {name:'Son Savaş',        diff:'extreme', emoji:'💀'},
];

function buildLevel(id){
  const fns=[lv0,lv1,lv2,lv3,lv4,lv5,lv6,lv7];
  return fns[id%fns.length]();
}
function mkLv(o){return{name:o.name,width:o.width??6000,height:o.height??1100,
  bg1:o.bg1??'#050811',bg2:o.bg2??'#0a1628',
  platforms:o.platforms??[],hazards:o.hazards??[],
  coins:o.coins??[],cps:o.cps??[],
  spawnX:o.spawnX??80,spawnY:o.spawnY??560,
  goalX:o.goalX??5700,goalY:o.goalY??300,par:o.par??90};}

function lv0(){
  const p=[],h=[],c=[],cp=[];
  for(let x=0;x<5000;x+=200)p.push(new Platform(x,680,220,36));
  [new Platform(300,580,130,18,{oneWay:true}),new Platform(560,500,120,18,{oneWay:true}),
   new Platform(820,420,150,18,{oneWay:true}),new Platform(1100,370,200,28),
   new Platform(1400,310,100,18,{oneWay:true}),
   new Platform(1650,390,120,18,{moving:true,mx1:1870,msp:1.6}),
   new Platform(1920,490,180,28),new Platform(2200,430,120,18,{oneWay:true}),
   new Platform(2500,350,180,28),new Platform(2800,290,140,18),
   new Platform(3100,250,120,18,{moving:true,mx1:3300,msp:2}),
  ].forEach(x=>p.push(x));
  for(let x=350;x<1000;x+=120)c.push(new Coin(x,450));
  c.push(new Coin(1150,320,{value:100}));
  h.push(new Hazard(450,668,80,12));h.push(new Hazard(730,668,80,12));
  cp.push(new Checkpoint(1100,310));cp.push(new Checkpoint(2000,430));cp.push(new Checkpoint(3200,200));
  for(let x=3400;x<4600;x+=220)p.push(new Platform(x,290,200,28));
  h.push(new Hazard(3600,278,60,12));h.push(new Hazard(4000,278,80,12));
  for(let x=3500;x<4600;x+=150)c.push(new Coin(x,240));
  return mkLv({name:'Başlangıç Yolu',platforms:p,hazards:h,coins:c,cps:cp,
    spawnX:60,spawnY:600,goalX:4650,goalY:240,par:60,bg1:'#050811',bg2:'#081428'});
}

function lv1(){
  const p=[],h=[],c=[],cp=[];
  for(let x=0;x<5200;x+=300)p.push(new Platform(x,800,260,50,{depth:20}));
  for(let i=0;i<18;i++){
    const bx=150+i*280,by=rand(300,600);
    p.push(new Platform(bx,by,rand(70,150),18,{oneWay:i%3!==0,depth:12}));
    c.push(new Coin(bx+30,by-32));
    if(i%2===0)p.push(new Platform(bx+80,by+(i%2?100:-100),90,14,{moving:true,mx1:bx+80+140,msp:1.3,depth:10}));
  }
  for(let x=800;x<4800;x+=650)h.push(new Hazard(x,rand(380,620),10,200,{type:'laser',damage:30}));
  cp.push(new Checkpoint(1600,500));cp.push(new Checkpoint(3300,350));
  return mkLv({platforms:p,hazards:h,coins:c,cps:cp,
    spawnX:80,spawnY:700,goalX:4900,goalY:350,par:90,bg1:'#020510',bg2:'#050f25'});
}

function lv2(){
  const p=[],h=[],c=[],cp=[];
  for(let x=0;x<5500;x+=180){const y=rand(580,660);
    p.push(new Platform(x,y,200,28,{type:'ice',depth:12}));
    if(Math.random()>.7)h.push(new Hazard(x+rand(10,160),y-12,rand(32,80),12));}
  for(let i=0;i<12;i++){const bx=200+i*420,by=rand(340,520);
    p.push(new Platform(bx,by,rand(80,160),16,{type:'ice',moving:i%2===0,mx1:bx+(i%2===0?160:0),my1:by,msp:1.1,depth:10}));
    c.push(new Coin(bx+40,by-32,{value:75}));}
  for(let x=200;x<5000;x+=250)h.push(new Hazard(x,0,14,rand(40,120),{type:'spike',damage:35}));
  cp.push(new Checkpoint(1800,430));cp.push(new Checkpoint(3600,370));
  return mkLv({platforms:p,hazards:h,coins:c,cps:cp,
    spawnX:60,spawnY:520,goalX:5300,goalY:300,par:100,bg1:'#030d1f',bg2:'#061a38'});
}

function lv3(){
  const p=[],h=[],c=[],cp=[];
  h.push(new Hazard(0,830,6000,60,{type:'lava',damage:50}));
  p.push(new Platform(0,700,100,200));
  for(let i=0;i<24;i++){const bx=100+i*220,by=rand(560,720);
    p.push(new Platform(bx,by,rand(80,160),18,{type:'crumble',depth:10}));
    if(Math.random()>.6)c.push(new Coin(bx+30,by-30,{value:100}));}
  [1200,2400,3600,4800].forEach(x=>p.push(new Platform(x,620,160,36)));
  for(let x=300;x<5000;x+=400)h.push(new Hazard(x,rand(320,490),rand(48,96),12,{type:'spike',damage:30}));
  for(let x=500;x<5000;x+=600)h.push(new Hazard(x,rand(590,710),42,42,{type:'saw',damage:40,moving:true,mx1:x+200,msp:1.5}));
  for(let i=0;i<10;i++){const bx=800+i*400,by=rand(480,620);
    p.push(new Platform(bx,by,100,14,{type:'disappear',visPer:100,visOn:60,depth:8}));}
  cp.push(new Checkpoint(1300,560));cp.push(new Checkpoint(3700,550));
  return mkLv({platforms:p,hazards:h,coins:c,cps:cp,
    spawnX:20,spawnY:640,goalX:5200,goalY:560,par:75,bg1:'#0f0300',bg2:'#200800'});
}

function lv4(){
  const p=[],h=[],c=[],cp=[];
  for(let col=0;col<28;col++){const bx=col*200;
    for(let row=0;row<5;row++){if(Math.random()>.35){const by=200+row*120;
      p.push(new Platform(bx,by,160,14,{oneWay:row>0,depth:8}));
      if(Math.random()>.5)c.push(new Coin(bx+60,by-30,{value:75}));}}
    if(col%4===0)h.push(new Hazard(bx+60,rand(200,750),12,rand(60,200),{type:'laser',damage:35}));}
  for(let x=0;x<5600;x+=200)p.push(new Platform(x,800,220,60,{depth:18}));
  for(let i=0;i<12;i++){const bx=300+i*450,by=rand(260,620);
    p.push(new Platform(bx,by,100,14,{moving:true,mx1:bx,my1:by+(i%2?160:-160),msp:1.3,depth:8}));}
  cp.push(new Checkpoint(2000,600));cp.push(new Checkpoint(4000,380));
  return mkLv({platforms:p,hazards:h,coins:c,cps:cp,
    spawnX:60,spawnY:700,goalX:5500,goalY:260,par:100,bg1:'#000a00',bg2:'#001400'});
}

function lv5(){const p=[],h=[],c=[],cp=[];
  const cols=['#ff006e','#00f5ff','#7fff00','#ffd700','#d400ff'];
  for(let i=0;i<35;i++){const bx=100+i*160,by=rand(200,680),col=cols[i%cols.length];
    p.push(new Platform(bx,by,rand(60,140),14,{oneWay:i%4!==0,depth:8}));
    c.push(new Coin(bx+20,by-34,{value:i%5===0?200:50}));}
  for(let x=0;x<5600;x+=200)p.push(new Platform(x,790,220,70,{depth:16}));
  for(let i=0;i<14;i++){const bx=250+i*380;
    h.push(new Hazard(bx,rand(360,710),48,48,{type:'saw',damage:35,moving:true,mx1:bx+200,msp:2}));}
  cp.push(new Checkpoint(1700,500));cp.push(new Checkpoint(3500,300));
  return mkLv({platforms:p,hazards:h,coins:c,cps:cp,
    spawnX:60,spawnY:700,goalX:5500,goalY:200,par:80,bg1:'#050010',bg2:'#0a0020'});
}

function lv6(){const p=[],h=[],c=[],cp=[];
  for(let x=0;x<5500;x+=200){p.push(new Platform(x,rand(600,730),rand(100,220),18,{depth:10}));
    if(x>500)p.push(new Platform(x+60,rand(80,200),rand(80,160),14,{oneWay:true,depth:8}));}
  for(let i=0;i<18;i++){const bx=300+i*300,by=rand(340,570);
    p.push(new Platform(bx,by,90,14,{type:'disappear',visPer:80+i*5,visOn:50,depth:6}));
    c.push(new Coin(bx+30,by-30,{value:150}));}
  for(let i=0;i<10;i++){const bx=3000+i*240,by=rand(400,600);
    p.push(new Platform(bx,by,140,16,{type:'crumble',depth:10}));}
  for(let x=200;x<5400;x+=350)h.push(new Hazard(x,740,rand(60,120),18));
  cp.push(new Checkpoint(1800,560));cp.push(new Checkpoint(3500,430));
  return mkLv({platforms:p,hazards:h,coins:c,cps:cp,
    spawnX:60,spawnY:600,goalX:5400,goalY:280,par:120,bg1:'#030411',bg2:'#06082a'});
}

function lv7(){const p=[],h=[],c=[],cp=[];
  p.push(new Platform(0,720,6000,60,{depth:20}));
  p.push(new Platform(0,0,20,720));p.push(new Platform(5980,0,20,720));
  for(let i=0;i<18;i++){const bx=200+i*320,by=rand(360,620);
    p.push(new Platform(bx,by,rand(80,160),16,{type:['normal','crumble','disappear','bounce'][i%4],depth:10}));
    c.push(new Coin(bx+40,by-35,{value:200}));}
  for(let i=0;i<22;i++){const bx=120+i*260;
    h.push(new Hazard(bx,rand(510,700),48,48,{type:'saw',damage:40,moving:true,mx1:bx+180,msp:2+i*.1}));}
  for(let x=100;x<5900;x+=280)h.push(new Hazard(x,700,18,20,{type:'spike',damage:25}));
  cp.push(new Checkpoint(1500,640));cp.push(new Checkpoint(3000,580));cp.push(new Checkpoint(4500,520));
  return mkLv({platforms:p,hazards:h,coins:c,cps:cp,
    spawnX:80,spawnY:640,goalX:5800,goalY:600,par:150,bg1:'#0f0008',bg2:'#1a000f'});
}

// ══════════════════════════════════════════════════════════
//  GAME STATE & LOOP
// ══════════════════════════════════════════════════════════
let gState='menu'; // menu | playing | paused | dead | complete
let lvId=0,lv=null,player=null,goal=null,gStart=0,frame=0;

function elapsed(){const s=Math.floor((Date.now()-gStart)/1000);return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;}

function startLevel(id){
  lvId=id;lv=buildLevel(id);
  player=new Player(lv.spawnX,lv.spawnY);
  goal=new GoalFlag(lv.goalX,lv.goalY);
  PFX.length=0;
  cam.x=player.x-canvas.width/2;cam.y=player.y-canvas.height/2;
  cam.tx=cam.x;cam.ty=cam.y;
  gStart=Date.now();
  if(id>SD.currentLevel)SD.currentLevel=id;saveGame();
  showScreen('gameScreen');gState='playing';
}

// ── Background stars ──────────────────────────────────────
const bgStars=[];
for(let i=0;i<140;i++)bgStars.push({x:Math.random()*4000,y:Math.random()*900,r:Math.random()*1.8+.3,sp:Math.random()*.4+.1,bl:Math.random()*Math.PI*2});

function drawMenuBg(){
  const bc=document.getElementById('bgCanvas');
  const bx=bc.getContext('2d');
  bc.width=window.innerWidth;bc.height=window.innerHeight;
  const g=bx.createLinearGradient(0,0,0,bc.height);
  g.addColorStop(0,'#050811');g.addColorStop(1,'#0a1628');
  bx.fillStyle=g;bx.fillRect(0,0,bc.width,bc.height);
  bgStars.forEach(s=>{s.bl+=.015;s.x-=s.sp;if(s.x<0)s.x=bc.width;
    bx.globalAlpha=.3+Math.sin(s.bl)*.45;bx.fillStyle='#aaddff';
    bx.beginPath();bx.arc(s.x,s.y,s.r,0,Math.PI*2);bx.fill();});
  bx.globalAlpha=1;
  bx.strokeStyle='rgba(0,245,255,.03)';bx.lineWidth=1;
  for(let x=0;x<bc.width;x+=60){bx.beginPath();bx.moveTo(x,0);bx.lineTo(x,bc.height);bx.stroke();}
  for(let y=0;y<bc.height;y+=60){bx.beginPath();bx.moveTo(0,y);bx.lineTo(bc.width,y);bx.stroke();}
}

function drawBG(){
  const g=ctx.createLinearGradient(0,0,0,canvas.height);
  g.addColorStop(0,lv.bg1);g.addColorStop(1,lv.bg2);
  ctx.fillStyle=g;ctx.fillRect(0,0,canvas.width,canvas.height);
  // grid
  ctx.strokeStyle='rgba(0,245,255,.025)';ctx.lineWidth=1;
  const gs=80,sx=Math.floor(cam.x/gs)*gs,sy=Math.floor(cam.y/gs)*gs;
  for(let x=sx;x<cam.x+canvas.width+gs;x+=gs){ctx.beginPath();ctx.moveTo(x-cam.x+cam.sx,0);ctx.lineTo(x-cam.x+cam.sx,canvas.height);ctx.stroke();}
  for(let y=sy;y<cam.y+canvas.height+gs;y+=gs){ctx.beginPath();ctx.moveTo(0,y-cam.y+cam.sy);ctx.lineTo(canvas.width,y-cam.y+cam.sy);ctx.stroke();}
}

function updateHUD(){
  if(!player)return;
  document.getElementById('hScore').textContent=player.score;
  document.getElementById('hBest').textContent=SD.bestScore;
  document.getElementById('hLevel').textContent=lvId+1;
  document.getElementById('hDeaths').textContent=player.deaths;
  document.getElementById('hTime').textContent=elapsed();
  const pct=clamp(Math.round(player.x/lv.goalX*100),0,100);
  document.getElementById('pBar').style.width=pct+'%';
  document.getElementById('pPct').textContent=pct+'%';
  const hp=clamp(player.health,0,player.maxHp);
  document.getElementById('hpBar').style.width=(hp/player.maxHp*100)+'%';
  document.getElementById('hpVal').textContent=Math.ceil(hp);
  document.getElementById('abjump').className='abil'+(player.jumpsLeft===0?' cd':' ready');
  document.getElementById('abdash').className='abil'+(player.dashLeft===0&&player.dashCD>0?' cd':' ready');
  const cw=document.getElementById('comboWrap');
  if(player.combo>1){cw.classList.remove('hidden');
    document.getElementById('comboTxt').textContent=`COMBO x${player.combo}`;
    document.getElementById('cbBar').style.width=(player.comboT/120*100)+'%';
  }else cw.classList.add('hidden');
}

function showNotif(txt){
  const a=document.getElementById('notifArea');
  const el=document.createElement('div');el.className='notif';el.textContent=txt;
  a.appendChild(el);setTimeout(()=>el.remove(),2200);
}

function showScreen(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function showDeathScreen(){
  document.getElementById('deathScreen').classList.remove('hidden');
  document.getElementById('dScore').textContent=player.score;
  document.getElementById('dDist').textContent=player.dist+'m';
  document.getElementById('dTime').textContent=elapsed();
}

function showCompleteScreen(){
  const s=Math.floor((Date.now()-gStart)/1000),deaths=player.deaths,par=lv.par;
  let stars=1;if(s<=par&&deaths===0)stars=3;else if(s<=par*1.5&&deaths<=2)stars=2;
  document.getElementById('cScore').textContent=player.score;
  document.getElementById('cTime').textContent=elapsed();
  document.getElementById('cDeaths').textContent=deaths;
  document.getElementById('cStars').textContent='⭐'.repeat(stars)+'☆'.repeat(3-stars);
  document.getElementById('cStarsEmoji').textContent='⭐'.repeat(stars);
  if(!SD.levelsCompleted.includes(lvId))SD.levelsCompleted.push(lvId);
  if(!SD.levelStars[lvId]||SD.levelStars[lvId]<stars)SD.levelStars[lvId]=stars;
  saveGame();document.getElementById('completeScreen').classList.remove('hidden');
}

function returnMenu(){
  gState='menu';showScreen('menuScreen');
  ['pauseMenu','deathScreen','completeScreen'].forEach(id=>document.getElementById(id).classList.add('hidden'));
  updateMenuStats();
}

function updateMenuStats(){
  document.getElementById('mBest').textContent=SD.bestScore;
  document.getElementById('mDeaths').textContent=SD.deaths;
  document.getElementById('mLevel').textContent=(SD.currentLevel||0)+1;
}

function togglePause(){
  if(gState==='playing'){gState='paused';document.getElementById('pauseMenu').classList.remove('hidden');}
  else if(gState==='paused'){gState='playing';document.getElementById('pauseMenu').classList.add('hidden');}
}

function respawn(){
  if(!player)return;
  player.respawn();gState='playing';
  document.getElementById('deathScreen').classList.add('hidden');
}

// ── MAIN LOOP ─────────────────────────────────────────────
function loop(){
  requestAnimationFrame(loop);frame++;
  ctx.clearRect(0,0,canvas.width,canvas.height);

  if(gState==='menu'){drawMenuBg();clearJP();return;}
  if(gState!=='playing'&&gState!=='paused'){clearJP();return;}

  if(gState==='playing'){
    // Update platforms
    lv.platforms.forEach(p=>{
      p.update(player);
      if(p.type==='crumble'&&p.isStoodOn(player))p.startCrumble();
      if(p.type==='bounce'&&p.isStoodOn(player)&&player.vy>=0){
        player.vy=-21;player.onGround=false;
        burst(player.cx,player.bottom,12,{color:'#7fff00',s0:2,s1:6});cam.shake(5,8);}
      if(p.type==='ice'&&p.isStoodOn(player))player.vx*=1.02;
    });
    lv.hazards.forEach(h=>h.update());
    lv.coins.forEach(c=>c.update());
    lv.cps.forEach(cp=>cp.update());
    goal.update(player);
    player.update(lv.platforms,lv.hazards,lv.coins,lv.cps,lv.width,lv.height);
    updatePFX();
    cam.update(player);
    cam.x=clamp(cam.x,-60,lv.width-canvas.width+60);
    cam.y=clamp(cam.y,-100,lv.height-canvas.height+200);

    if(player.dead){gState='dead';setTimeout(showDeathScreen,650);}
    if(goal.reached){gState='complete';sfxWin();setTimeout(showCompleteScreen,500);
      burst(goal.x+14,goal.y+38,28,{color:'#7fff00',s0:4,s1:13});}
    if(jp['Escape']||jp['KeyP'])togglePause();
    if(jp['KeyR'])respawn();

    updateHUD();
  }

  // Draw
  drawBG();
  cam.on();
  lv.platforms.forEach(p=>p.draw(ctx));
  lv.cps.forEach(cp=>cp.draw(ctx));
  goal.draw(ctx);
  lv.hazards.forEach(h=>h.draw(ctx));
  lv.coins.forEach(c=>c.draw(ctx));
  drawPFX();
  player.draw(ctx);
  cam.off();

  clearJP();
}

// ── LEVEL GRID ────────────────────────────────────────────
function buildLevelGrid(){
  const g=document.getElementById('levelGrid');g.innerHTML='';
  LEVEL_META.forEach((m,i)=>{
    const unlocked=i===0||SD.levelsCompleted.includes(i-1)||SD.currentLevel>=i;
    const done=SD.levelsCompleted.includes(i);
    const stars=SD.levelStars[i]||0;
    const c=document.createElement('div');
    c.className='lcard'+(done?' done':'')+(unlocked?'':' locked');
    c.innerHTML=`<div style="font-size:2rem">${m.emoji}</div>
<div class="lnum">${i+1}</div><div class="lname">${m.name}</div>
<div class="lstars">${'⭐'.repeat(stars)}${'☆'.repeat(3-stars)}</div>
<div class="ldiff d-${m.diff}">${m.diff.toUpperCase()}</div>`;
    if(unlocked)c.addEventListener('click',()=>startLevel(i));
    g.appendChild(c);
  });
}

// ── EVENTS ────────────────────────────────────────────────
document.getElementById('btnPlay').onclick=()=>startLevel(SD.currentLevel||0);
document.getElementById('btnLevels').onclick=()=>{buildLevelGrid();showScreen('levelScreen');};
document.getElementById('btnControls').onclick=()=>showScreen('controlsScreen');
document.getElementById('bkLevels').onclick=()=>showScreen('menuScreen');
document.getElementById('bkControls').onclick=()=>showScreen('menuScreen');
document.getElementById('btnPause').onclick=togglePause;
document.getElementById('bResume').onclick=togglePause;
document.getElementById('bRestart').onclick=()=>{document.getElementById('pauseMenu').classList.add('hidden');startLevel(lvId);};
document.getElementById('bMenuP').onclick=returnMenu;
document.getElementById('bRespawn').onclick=respawn;
document.getElementById('bMenuD').onclick=returnMenu;
document.getElementById('bNext').onclick=()=>{document.getElementById('completeScreen').classList.add('hidden');startLevel((lvId+1)%LEVEL_META.length);};
document.getElementById('bReplay').onclick=()=>{document.getElementById('completeScreen').classList.add('hidden');startLevel(lvId);};
document.getElementById('bMenuC').onclick=returnMenu;

// ── INIT ──────────────────────────────────────────────────
updateMenuStats();
requestAnimationFrame(loop);
