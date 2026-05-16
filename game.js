
// ============================================================
// PARKOUR NEXUS — game.js
// ============================================================

// ── Settings ────────────────────────────────────────────────
const settings = {
  music: true, sfx: true, particles: true, shake: true,
  quality: 'medium', volume: 0.7
};

// ── Save/Load ────────────────────────────────────────────────
const SAVE_KEY = 'parkourNexusSave';
let saveData = { bestScore: 0, deaths: 0, currentLevel: 0, levelsCompleted: [], levelStars: [] };
function loadSave() {
  try { const d = JSON.parse(localStorage.getItem(SAVE_KEY)); if (d) saveData = { ...saveData, ...d }; } catch(e) {}
}
function writeSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(saveData)); } catch(e) {}
}
loadSave();

// ── Canvas Setup ─────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', () => { resizeCanvas(); if (currentLevel) currentLevel.init(); });

// ── Audio Engine ─────────────────────────────────────────────
const AC = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
function getAC() { if (!audioCtx) audioCtx = new AC(); return audioCtx; }

function playTone(freq, type = 'square', duration = 0.12, vol = 0.15, detune = 0) {
  if (!settings.sfx) return;
  try {
    const ac = getAC();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain); gain.connect(ac.destination);
    osc.type = type; osc.frequency.value = freq; osc.detune.value = detune;
    gain.gain.setValueAtTime(vol * settings.volume, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
    osc.start(); osc.stop(ac.currentTime + duration);
  } catch(e) {}
}
function sfxJump()      { playTone(320,'sine',0.15,0.2); }
function sfxLand()      { playTone(120,'triangle',0.1,0.3); }
function sfxDash()      { playTone(600,'sawtooth',0.1,0.25,-200); }
function sfxWallJump()  { playTone(420,'sine',0.12,0.2,100); }
function sfxDeath()     { playTone(80,'sawtooth',0.4,0.35); setTimeout(()=>playTone(60,'sawtooth',0.3,0.3),150); }
function sfxCoin()      { playTone(880,'sine',0.15,0.2); setTimeout(()=>playTone(1100,'sine',0.12,0.15),80); }
function sfxCheckpoint(){ playTone(440,'sine',0.1,0.2); setTimeout(()=>playTone(660,'sine',0.15,0.2),100); setTimeout(()=>playTone(880,'sine',0.2,0.2),200); }
function sfxComplete()  { [440,550,660,880].forEach((f,i)=>setTimeout(()=>playTone(f,'sine',0.3,0.25),i*120)); }

// ── Input ────────────────────────────────────────────────────
const keys = {};
let justPressed = {};
let justReleased = {};
window.addEventListener('keydown', e => {
  if (!keys[e.code]) justPressed[e.code] = true;
  keys[e.code] = true;
  if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', e => {
  justReleased[e.code] = true;
  keys[e.code] = false;
});
function clearJust() { justPressed = {}; justReleased = {}; }

// ── Math Helpers ─────────────────────────────────────────────
const lerp = (a,b,t) => a + (b-a)*t;
const clamp = (v,min,max) => Math.max(min,Math.min(max,v));
const rand = (a,b) => a + Math.random()*(b-a);
const randInt = (a,b) => Math.floor(rand(a,b+1));

// ── Camera ────────────────────────────────────────────────────
const camera = {
  x: 0, y: 0, targetX: 0, targetY: 0,
  shakeX: 0, shakeY: 0, shakeMag: 0, shakeDuration: 0,
  zoom: 1, targetZoom: 1,
  update(player, W, H) {
    this.targetX = player.x + player.w/2 - W/2;
    this.targetY = player.y + player.h/2 - H/2;
    this.x = lerp(this.x, this.targetX, 0.1);
    this.y = lerp(this.y, this.targetY, 0.08);
    this.zoom = lerp(this.zoom, this.targetZoom, 0.05);
    if (this.shakeDuration > 0 && settings.shake) {
      this.shakeMag *= 0.85;
      this.shakeX = (Math.random()-0.5)*2*this.shakeMag;
      this.shakeY = (Math.random()-0.5)*2*this.shakeMag;
      this.shakeDuration--;
    } else { this.shakeX = 0; this.shakeY = 0; }
  },
  shake(mag = 8, dur = 12) { this.shakeMag = mag; this.shakeDuration = dur; },
  begin(ctx) {
    ctx.save();
    ctx.translate(canvas.width/2, canvas.height/2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-canvas.width/2, -canvas.height/2);
    ctx.translate(-this.x + this.shakeX, -this.y + this.shakeY);
  },
  end(ctx) { ctx.restore(); },
  toWorld(sx, sy) {
    return { x: (sx/this.zoom) + this.x - canvas.width/2*(1-1/this.zoom), y: (sy/this.zoom) + this.y - canvas.height/2*(1-1/this.zoom) };
  }
};

// ── Particle System ───────────────────────────────────────────
const particles = [];
function spawnParticle(x,y,opts={}) {
  if (!settings.particles) return;
  particles.push({
    x, y,
    vx: opts.vx ?? rand(-3,3),
    vy: opts.vy ?? rand(-6,-1),
    life: opts.life ?? rand(20,40),
    maxLife: opts.life ?? rand(20,40),
    size: opts.size ?? rand(2,6),
    color: opts.color ?? '#00f5ff',
    gravity: opts.gravity ?? 0.2,
    spin: opts.spin ?? rand(-0.15,0.15),
    angle: 0, glow: opts.glow ?? false
  });
}
function spawnBurst(x,y,count=12,opts={}) {
  for (let i=0;i<count;i++) {
    const angle = (Math.PI*2/count)*i + rand(-0.3,0.3);
    const speed = rand(opts.speedMin??2, opts.speedMax??7);
    spawnParticle(x, y, {
      ...opts, vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed
    });
  }
}
function spawnDust(x,y,dir=1) {
  for (let i=0;i<6;i++) spawnParticle(x,y,{
    vx:rand(-2,0)*dir, vy:rand(-3,-0.5), size:rand(3,7),
    color:`hsl(${rand(20,40)},60%,60%)`, life:rand(15,30), gravity:0.15
  });
}
function spawnTrail(x,y,color='#00f5ff') {
  spawnParticle(x,y,{vx:rand(-1,1),vy:rand(-1,1),size:rand(2,5),color,life:rand(8,16),gravity:0});
}
function updateParticles() {
  for (let i=particles.length-1;i>=0;i--) {
    const p=particles[i];
    p.x+=p.vx; p.y+=p.vy; p.vy+=p.gravity;
    p.vx*=0.97; p.life--;
    p.angle+=p.spin;
    if (p.life<=0) particles.splice(i,1);
  }
}
function drawParticles(ctx) {
  particles.forEach(p => {
    const t = p.life/p.maxLife;
    ctx.save();
    ctx.globalAlpha = t*0.9;
    if (p.glow) { ctx.shadowBlur = 12; ctx.shadowColor = p.color; }
    ctx.fillStyle = p.color;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillRect(-p.size/2, -p.size/2, p.size*t, p.size*t);
    ctx.restore();
  });
}

// ── Player ────────────────────────────────────────────────────
class Player {
  constructor(x, y) {
    this.x = x; this.y = y; this.w = 28; this.h = 42;
    this.vx = 0; this.vy = 0;
    this.onGround = false; this.onWall = 0; // -1 left, 1 right
    this.jumpsLeft = 2; this.dashLeft = 1;
    this.dashing = false; this.dashTimer = 0;
    this.wallSliding = false; this.wallJumpLock = 0;
    this.crouching = false;
    this.health = 100; this.maxHealth = 100;
    this.dead = false; this.invincible = 0;
    this.facing = 1;
    this.animFrame = 0; this.animTimer = 0;
    this.animState = 'idle'; // idle, run, jump, fall, crouch, dash, walljump
    this.sprintTimer = 0;
    this.trailTimer = 0;
    this.coyoteTime = 0; // frames after leaving ground where jump still works
    this.jumpBuffer = 0; // frames after pressing jump before landing
    this.score = 0;
    this.combo = 0; this.comboTimer = 0;
    this.checkpointX = x; this.checkpointY = y;
    this.deaths = 0;
    this.startTime = Date.now();
    this.distanceTravelled = 0;
    // dash cooldown
    this.dashCooldownTimer = 0; this.dashCooldownMax = 60;
    this.wallJumpCooldownTimer = 0;
  }

  get cx() { return this.x + this.w/2; }
  get cy() { return this.y + this.h/2; }
  get bottom() { return this.y + this.h; }
  get right() { return this.x + this.w; }

  respawn() {
    this.x = this.checkpointX; this.y = this.checkpointY - this.h;
    this.vx = 0; this.vy = 0;
    this.health = this.maxHealth;
    this.dead = false; this.invincible = 60;
    this.dashing = false; this.dashTimer = 0;
    this.jumpsLeft = 2; this.dashLeft = 1;
    this.deaths++;
    saveData.deaths++;
    camera.shake(12, 20);
    spawnBurst(this.cx, this.cy, 16, { color:'#ff006e', speedMin:3, speedMax:8 });
  }

  setCheckpoint(x, y) {
    this.checkpointX = x; this.checkpointY = y;
    sfxCheckpoint();
    showNotification('KONTROL NOKTASI ✓');
    spawnBurst(x, y, 12, { color:'#ffd700', speedMin:2, speedMax:6 });
  }

  addScore(pts, label) {
    this.score += pts;
    if (this.score > saveData.bestScore) saveData.bestScore = this.score;
    this.combo++;
    this.comboTimer = 120;
    showNotification(`+${pts} ${label||''}`);
  }

  update(platforms, hazards, coins, checkpoints, levelWidth, levelHeight) {
    if (this.dead) return;

    // timers
    if (this.invincible > 0) this.invincible--;
    if (this.coyoteTime > 0) this.coyoteTime--;
    if (this.jumpBuffer > 0) this.jumpBuffer--;
    if (this.dashCooldownTimer > 0) this.dashCooldownTimer--;
    if (this.wallJumpCooldownTimer > 0) this.wallJumpCooldownTimer--;
    if (this.comboTimer > 0) { this.comboTimer--; if (this.comboTimer===0) this.combo=0; }

    // input flags
    const left  = keys['KeyA'] || keys['ArrowLeft'];
    const right = keys['KeyD'] || keys['ArrowRight'];
    const jump  = justPressed['Space'] || justPressed['KeyW'] || justPressed['ArrowUp'];
    const crouch= keys['KeyS'] || keys['ArrowDown'];
    const sprint= keys['ShiftLeft'] || keys['ShiftRight'];
    const dashKey = justPressed['ShiftLeft'] || justPressed['ShiftRight'];

    // crouch
    this.crouching = crouch && this.onGround;
    const effectiveH = this.crouching ? 24 : 42;
    if (!this.crouching) this.h = 42; else { this.y += this.h - effectiveH; this.h = effectiveH; }

    // movement
    const maxSpeed = (sprint ? 8 : 5) * (this.crouching ? 0.5 : 1);
    const accel = this.onGround ? 1.2 : 0.5;
    const friction = this.onGround ? 0.8 : 0.95;

    if (!this.dashing) {
      if (left)  { this.vx -= accel; this.facing = -1; }
      if (right) { this.vx += accel; this.facing = 1; }
      if (!left && !right) this.vx *= friction;
      this.vx = clamp(this.vx, -maxSpeed, maxSpeed);
    }

    // dash
    if (dashKey && this.dashLeft > 0 && this.dashCooldownTimer === 0 && !this.crouching) {
      // air dash
      const dashDir = left ? -1 : right ? 1 : this.facing;
      this.vx = dashDir * 16;
      this.vy = -2;
      this.dashing = true; this.dashTimer = 12;
      this.dashLeft--;
      this.dashCooldownTimer = this.dashCooldownMax;
      sfxDash();
      spawnBurst(this.cx, this.cy, 10, { color:'#00f5ff', speedMin:2, speedMax:6, vx:-dashDir*3 });
    }
    if (this.dashing) {
      this.dashTimer--;
      spawnTrail(this.cx, this.cy, '#00f5ff');
      if (this.dashTimer <= 0) this.dashing = false;
    }

    // gravity
    if (!this.dashing) {
      if (this.wallSliding) { this.vy = Math.min(this.vy + 0.4, 2); }
      else {
        const gravScale = (keys['Space']||keys['KeyW']||keys['ArrowUp']) && this.vy < 0 ? 0.5 : 1.0;
        this.vy += 0.65 * gravScale;
        if (crouch && this.vy > 0 && !this.onGround) this.vy += 0.5; // fast fall
      }
      this.vy = Math.min(this.vy, 22);
    }

    // jump buffering
    if (jump) this.jumpBuffer = 12;

    // jumping
    if (this.jumpBuffer > 0) {
      // wall jump
      if (this.onWall !== 0 && this.wallJumpCooldownTimer === 0 && !this.onGround) {
        this.vx = -this.onWall * 9;
        this.vy = -13;
        this.jumpsLeft = 1;
        this.jumpBuffer = 0;
        this.wallJumpCooldownTimer = 18;
        sfxWallJump();
        spawnBurst(this.cx, this.cy, 8, { color:'#7fff00', speedMin:2, speedMax:5 });
        camera.shake(4, 8);
      }
      // normal or coyote jump
      else if ((this.onGround || this.coyoteTime > 0) && this.vy >= 0) {
        this.vy = -15;
        this.jumpsLeft = 1;
        this.coyoteTime = 0;
        this.jumpBuffer = 0;
        sfxJump();
        spawnDust(this.cx, this.cy + this.h/2, -this.facing);
        camera.shake(2, 5);
      }
      // double jump
      else if (this.jumpsLeft > 0 && !this.onGround && this.coyoteTime === 0) {
        this.vy = -13;
        this.jumpsLeft--;
        this.jumpBuffer = 0;
        sfxJump();
        spawnBurst(this.cx, this.cy+this.h/2, 10, { color:'#00f5ff', speedMin:1, speedMax:4, vy:-2 });
        camera.shake(2, 4);
      }
    }

    // move & collide
    this.x += this.vx;
    this._collideX(platforms, levelWidth);
    this.y += this.vy;
    const wasOnGround = this.onGround;
    this._collideY(platforms, levelHeight);

    // landing
    if (!wasOnGround && this.onGround) {
      sfxLand();
      if (Math.abs(this.vy) > 10) { camera.shake(6, 10); spawnDust(this.cx, this.bottom, this.facing); }
      this.jumpsLeft = 2;
      this.dashLeft = 1;
    }

    // coyote time
    if (wasOnGround && !this.onGround && this.vy >= 0) this.coyoteTime = 8;

    // wall detection
    this.wallSliding = false;
    if (!this.onGround && this.vy > 0) {
      if (this.onWall !== 0) { this.wallSliding = true; }
    }

    // hazards
    if (this.invincible === 0) {
      hazards.forEach(h => {
        if (this._overlaps(h)) { this.takeDamage(h.damage||25); }
      });
    }

    // death pit
    if (this.y > levelHeight + 200) { this.die(); }
    // left edge
    if (this.x < -50) { this.x = -50; this.vx = 0; }

    // coins
    for (let i = coins.length-1; i >= 0; i--) {
      const c = coins[i];
      if (!c.collected && this._overlaps(c)) {
        c.collected = true;
        sfxCoin();
        this.addScore(c.value||50, 'KOİN');
        spawnBurst(c.x+c.w/2, c.y+c.h/2, 10, { color:'#ffd700', speedMin:2, speedMax:5 });
      }
    }

    // checkpoints
    checkpoints.forEach(cp => {
      if (!cp.activated && this._overlaps(cp)) {
        cp.activated = true;
        this.setCheckpoint(cp.x, cp.y);
      }
    });

    // trail while sprinting or dashing
    this.trailTimer++;
    if (sprint && this.onGround && this.trailTimer%2===0) spawnTrail(this.cx, this.bottom, '#00f5ff44');

    // distance
    this.distanceTravelled = Math.max(this.distanceTravelled, Math.floor(this.x/60));

    // animation
    this._updateAnim();
  }

  takeDamage(amt) {
    if (this.invincible > 0) return;
    this.health -= amt;
    this.invincible = 60;
    camera.shake(10, 15);
    spawnBurst(this.cx, this.cy, 12, { color:'#ff006e', speedMin:2, speedMax:6 });
    if (this.health <= 0) this.die();
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    sfxDeath();
    camera.shake(20, 30);
    spawnBurst(this.cx, this.cy, 24, { color:'#ff006e', speedMin:3, speedMax:10, glow:true });
  }

  _overlaps(r) {
    return this.x < r.x+r.w && this.right > r.x && this.y < r.y+r.h && this.bottom > r.y;
  }

  _collideX(platforms, lw) {
    this.onWall = 0;
    platforms.forEach(p => {
      if (!p.solid) return;
      if (this.y < p.y+p.h && this.bottom > p.y) {
        if (this.x < p.x+p.w && this.right > p.x) {
          if (this.vx > 0 && this.x < p.x) { this.x = p.x - this.w; this.vx = 0; this.onWall = 1; }
          else if (this.vx < 0 && this.right > p.x+p.w) { this.x = p.x+p.w; this.vx = 0; this.onWall = -1; }
        }
      }
    });
  }

  _collideY(platforms, lh) {
    this.onGround = false;
    platforms.forEach(p => {
      if (this.x < p.x+p.w && this.right > p.x) {
        if (p.oneWay) {
          if (this.vy >= 0 && this.y < p.y && this.bottom > p.y && this.bottom < p.y+p.h+this.vy+5) {
            if (!keys['KeyS'] && !keys['ArrowDown']) { this.y = p.y - this.h; this.vy = 0; this.onGround = true; }
          }
        } else if (p.solid) {
          if (this.y < p.y+p.h && this.bottom > p.y) {
            if (this.vy > 0 && this.y < p.y) { this.y = p.y - this.h; this.vy = 0; this.onGround = true; }
            else if (this.vy < 0 && this.bottom > p.y+p.h) { this.y = p.y+p.h; this.vy = 0; }
          }
        }
      }
    });
    // moving platforms
    platforms.forEach(p => {
      if (!p.moving) return;
      if (this.onGround && p._lastY !== undefined && this.bottom <= p.y+2 && this.bottom >= p.y-2) {
        this.x += p.vx||0;
        this.y += p.vy||0;
      }
    });
  }

  _updateAnim() {
    if (this.dashing) this.animState='dash';
    else if (!this.onGround && this.wallSliding) this.animState='walljump';
    else if (!this.onGround && this.vy < 0) this.animState='jump';
    else if (!this.onGround && this.vy > 0) this.animState='fall';
    else if (this.crouching) this.animState='crouch';
    else if (Math.abs(this.vx) > 0.5) this.animState='run';
    else this.animState='idle';
    this.animTimer++;
    if (this.animTimer > 6) { this.animTimer = 0; this.animFrame = (this.animFrame+1)%4; }
  }

  draw(ctx) {
    if (this.dead) return;
    ctx.save();
    const flash = this.invincible > 0 && Math.floor(this.invincible/4)%2===0;
    if (flash) ctx.globalAlpha = 0.4;

    const px = this.x, py = this.y, pw = this.w, ph = this.h;
    const cx = px + pw/2, cy = py + ph/2;
    ctx.translate(cx, cy);
    ctx.scale(this.facing, 1);

    // glow
    ctx.shadowBlur = 16; ctx.shadowColor = '#00f5ff';

    // body
    const bodyGrad = ctx.createLinearGradient(-pw/2, -ph/2, pw/2, ph/2);
    bodyGrad.addColorStop(0, '#1a3a6e');
    bodyGrad.addColorStop(1, '#0d1f3c');
    ctx.fillStyle = bodyGrad;
    this._roundRect(ctx, -pw/2, -ph/2, pw, ph, 5);
    ctx.fill();

    // suit lines
    ctx.strokeStyle = '#00f5ff';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-pw/2+5, -ph/2+8); ctx.lineTo(pw/2-5, -ph/2+8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-pw/2+5, ph/2-10); ctx.lineTo(pw/2-5, ph/2-10); ctx.stroke();

    // visor
    ctx.fillStyle = '#00f5ff';
    ctx.shadowBlur = 20;
    ctx.fillRect(-pw/2+4, -ph/2+3, pw-8, 10);

    // legs animation
    if (this.animState === 'run') {
      const legSwing = Math.sin(this.animFrame/4*Math.PI*2)*8;
      ctx.fillStyle = '#0d3d6e';
      ctx.fillRect(-pw/2+2, ph/2-8, pw/2-3, 8);
      ctx.fillRect(2, ph/2-8-legSwing, pw/2-3, 8+legSwing);
    }

    // dash effect
    if (this.dashing) {
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#00f5ff';
      this._roundRect(ctx, -pw/2-10, -ph/2, pw, ph, 5); ctx.fill();
    }

    ctx.restore();
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.lineTo(x+w-r, y); ctx.arcTo(x+w,y,x+w,y+r,r);
    ctx.lineTo(x+w, y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
    ctx.lineTo(x+r, y+h); ctx.arcTo(x,y+h,x,y+h-r,r);
    ctx.lineTo(x, y+r); ctx.arcTo(x,y,x+r,y,r);
    ctx.closePath();
  }
}

// ── Platform ───────────────────────────────────────────────
class Platform {
  constructor(x,y,w,h,opts={}) {
    this.x=x; this.y=y; this.w=w; this.h=h;
    this.solid  = opts.solid  ?? true;
    this.oneWay = opts.oneWay ?? false;
    this.moving = opts.moving ?? false;
    this.type   = opts.type   ?? 'normal'; // normal, ice, lava, bounce, crumble, disappear
    this.color  = opts.color  ?? null;
    // moving platform props
    this.mx0=x; this.my0=y; this.mx1=opts.mx1??x; this.my1=opts.my1??y;
    this.mspeed= opts.mspeed??1.5; this.mt=0; this.mdir=1;
    this.vx=0; this.vy=0; this._lastX=x; this._lastY=y;
    // crumble
    this.crumbleTimer=0; this.crumbleMax=60; this.crumbled=false;
    // disappear
    this.visible=true; this.visTimer=0; this.visPeriod=opts.visPeriod??120;
    this.visOnTime=opts.visOnTime??80;
  }

  update(player) {
    this._lastX=this.x; this._lastY=this.y;

    if (this.moving) {
      this.mt += this.mdir * this.mspeed / 100;
      if (this.mt>=1){this.mt=1;this.mdir=-1;}
      if (this.mt<=0){this.mt=0;this.mdir=1;}
      const t = 3*this.mt*this.mt - 2*this.mt*this.mt*this.mt;
      const nx=lerp(this.mx0,this.mx1,t), ny=lerp(this.my0,this.my1,t);
      this.vx=nx-this.x; this.vy=ny-this.y;
      this.x=nx; this.y=ny;
    }

    if (this.type==='disappear') {
      this.visTimer++;
      if (this.visTimer>=this.visPeriod) this.visTimer=0;
      this.visible = this.visTimer < this.visOnTime;
      this.solid = this.visible;
    }

    if (this.type==='crumble' && this.crumbling) {
      this.crumbleTimer++;
      if (this.crumbleTimer>=this.crumbleMax) { this.crumbled=true; this.solid=false; }
    }
  }

  startCrumble() {
    if (this.type==='crumble' && !this.crumbling) { this.crumbling=true; this.crumbleTimer=0; }
  }

  isStoodOn(player) {
    return Math.abs(player.bottom - this.y) < 4 && player.x < this.x+this.w && player.right > this.x;
  }

  draw(ctx) {
    if (!this.visible) {
      // blinking ghost
      ctx.save(); ctx.globalAlpha=0.2;
      ctx.strokeStyle='#00f5ff'; ctx.lineWidth=1; ctx.setLineDash([4,4]);
      ctx.strokeRect(this.x,this.y,this.w,this.h);
      ctx.restore(); return;
    }
    ctx.save();
    let c1,c2,stroke;
    if (this.crumbling) {
      const t=this.crumbleTimer/this.crumbleMax;
      ctx.globalAlpha=1-t*0.8;
      ctx.translate(rand(-t*2,t*2),rand(-t*2,t*2));
    }
    switch(this.type) {
      case 'lava':    c1='#ff4400';c2='#ff0000';stroke='#ff6600';break;
      case 'ice':     c1='#aaddff';c2='#88ccff';stroke='#cceeFF';break;
      case 'bounce':  c1='#88ff00';c2='#44cc00';stroke='#aaff44';break;
      case 'crumble': c1='#996633';c2='#663300';stroke='#cc9955';break;
      default:
        if (this.oneWay){c1='#1a4a2e';c2='#0d2a1a';stroke='#2ecc71';}
        else {c1=this.color||'#1a2a4e';c2='#0d1a3c';stroke='#00f5ff';}
    }
    const g=ctx.createLinearGradient(this.x,this.y,this.x,this.y+this.h);
    g.addColorStop(0,c1); g.addColorStop(1,c2);
    ctx.fillStyle=g;
    ctx.beginPath();
    ctx.roundRect?ctx.roundRect(this.x,this.y,this.w,this.h,3):ctx.rect(this.x,this.y,this.w,this.h);
    ctx.fill();
    // top highlight
    ctx.strokeStyle=stroke; ctx.lineWidth=this.oneWay?2:1;
    ctx.shadowBlur=this.oneWay?8:4; ctx.shadowColor=stroke;
    ctx.beginPath(); ctx.moveTo(this.x,this.y); ctx.lineTo(this.x+this.w,this.y); ctx.stroke();
    // moving indicator
    if(this.moving){
      ctx.strokeStyle='rgba(0,245,255,0.3)'; ctx.lineWidth=1; ctx.setLineDash([4,6]);
      ctx.strokeRect(this.x,this.y,this.w,this.h); ctx.setLineDash([]);
    }
    ctx.restore();
  }
}

// ── Hazard ────────────────────────────────────────────────────
class Hazard {
  constructor(x,y,w,h,opts={}) {
    this.x=x;this.y=y;this.w=w;this.h=h;
    this.type=opts.type??'spike';
    this.damage=opts.damage??25;
    this.moving=opts.moving??false;
    this.mx0=x;this.mx1=opts.mx1??x;
    this.my0=y;this.my1=opts.my1??y;
    this.mspeed=opts.mspeed??1;this.mt=0;this.mdir=1;
    this.animTimer=0;
  }
  update(){
    this.animTimer++;
    if(this.moving){
      this.mt+=this.mdir*this.mspeed/100;
      if(this.mt>=1){this.mt=1;this.mdir=-1;}
      if(this.mt<=0){this.mt=0;this.mdir=1;}
      const t=3*this.mt*this.mt-2*this.mt*this.mt*this.mt;
      this.x=lerp(this.mx0,this.mx1,t);
      this.y=lerp(this.my0,this.my1,t);
    }
  }
  draw(ctx){
    ctx.save();
    switch(this.type){
      case 'spike': this._drawSpikes(ctx); break;
      case 'laser': this._drawLaser(ctx); break;
      case 'saw':   this._drawSaw(ctx);   break;
      default:      this._drawSpikes(ctx);
    }
    ctx.restore();
  }
  _drawSpikes(ctx){
    const n=Math.max(1,Math.floor(this.w/16));
    const sw=this.w/n;
    for(let i=0;i<n;i++){
      const sx=this.x+i*sw;
      ctx.beginPath();
      ctx.moveTo(sx,this.y+this.h);
      ctx.lineTo(sx+sw/2,this.y);
      ctx.lineTo(sx+sw,this.y+this.h);
      ctx.closePath();
      const g=ctx.createLinearGradient(sx,this.y,sx,this.y+this.h);
      g.addColorStop(0,'#ff4466');g.addColorStop(1,'#660022');
      ctx.fillStyle=g;
      ctx.shadowBlur=8;ctx.shadowColor='#ff0044';
      ctx.fill();
    }
  }
  _drawLaser(ctx){
    const pulse=Math.sin(this.animTimer*0.15)*0.4+0.6;
    ctx.fillStyle=`rgba(255,0,100,${pulse})`;
    ctx.shadowBlur=20;ctx.shadowColor='#ff006e';
    ctx.fillRect(this.x,this.y,this.w,this.h);
    ctx.fillStyle=`rgba(255,180,200,${pulse*0.5})`;
    ctx.fillRect(this.x+1,this.y+1,this.w-2,this.h-2);
  }
  _drawSaw(ctx){
    const cx=this.x+this.w/2,cy=this.y+this.h/2,r=this.w/2;
    const angle=this.animTimer*0.08;
    ctx.translate(cx,cy); ctx.rotate(angle);
    ctx.beginPath();
    const teeth=12;
    for(let i=0;i<teeth;i++){
      const a=(Math.PI*2/teeth)*i;
      const b=(Math.PI*2/teeth)*(i+0.5);
      ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);
      ctx.lineTo(Math.cos(b)*(r*0.6),Math.sin(b)*(r*0.6));
    }
    ctx.closePath();
    ctx.fillStyle='#cc0033'; ctx.shadowBlur=10; ctx.shadowColor='#ff0044'; ctx.fill();
    ctx.strokeStyle='#ff4466'; ctx.lineWidth=1.5; ctx.stroke();
  }
}

// ── Coin ───────────────────────────────────────────────────────
class Coin {
  constructor(x,y,opts={}){
    this.x=x;this.y=y;this.w=20;this.h=20;
    this.value=opts.value??50;
    this.collected=false;
    this.baseY=y;
    this.animTimer=Math.random()*Math.PI*2;
    this.color=this.value>=200?'#ff006e':this.value>=100?'#00f5ff':'#ffd700';
  }
  update(){ this.animTimer+=0.06; this.y=this.baseY+Math.sin(this.animTimer)*5; }
  draw(ctx){
    if(this.collected)return;
    ctx.save();
    const cx=this.x+this.w/2, cy=this.y+this.h/2;
    const r=this.w/2;
    const pulse=Math.sin(this.animTimer*2)*0.3+0.7;
    ctx.shadowBlur=16; ctx.shadowColor=this.color;
    const g=ctx.createRadialGradient(cx-r*0.3,cy-r*0.3,0,cx,cy,r);
    g.addColorStop(0,'rgba(255,255,255,0.9)');
    g.addColorStop(0.3,this.color);
    g.addColorStop(1,'rgba(0,0,0,0.4)');
    ctx.fillStyle=g;
    ctx.beginPath();
    ctx.arc(cx,cy,r*pulse,0,Math.PI*2);
    ctx.fill();
    // star on high-value
    if(this.value>=100){
      ctx.fillStyle='rgba(255,255,255,0.8)';
      ctx.font=`${r*1.2}px sans-serif`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('★',cx,cy);
    }
    ctx.restore();
  }
}

// ── Checkpoint ────────────────────────────────────────────────
class Checkpoint {
  constructor(x,y){
    this.x=x;this.y=y;this.w=24;this.h=60;
    this.activated=false;
    this.animTimer=0;
  }
  update(){ this.animTimer++; }
  draw(ctx){
    ctx.save();
    const cx=this.x+this.w/2;
    const color=this.activated?'#ffd700':'#00f5ff';
    // pole
    ctx.fillStyle='#555'; ctx.fillRect(cx-2,this.y,4,this.h);
    // flag
    ctx.shadowBlur=12; ctx.shadowColor=color;
    ctx.fillStyle=color;
    const wave=Math.sin(this.animTimer*0.1)*5;
    ctx.beginPath();
    ctx.moveTo(cx,this.y);
    ctx.lineTo(cx+22+wave,this.y+10);
    ctx.lineTo(cx+20+wave,this.y+24);
    ctx.lineTo(cx,this.y+20);
    ctx.closePath(); ctx.fill();
    if(this.activated){
      ctx.globalAlpha=Math.sin(this.animTimer*0.1)*0.3+0.1;
      ctx.fillStyle=color;
      ctx.beginPath();
      ctx.arc(cx,this.y+this.h/2,(this.animTimer%60)*1.5,0,Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// ── GoalFlag ────────────────────────────────────────────────────
class GoalFlag {
  constructor(x,y){ this.x=x;this.y=y;this.w=30;this.h=80;this.animTimer=0;this.reached=false; }
  update(player){
    this.animTimer++;
    if(!this.reached && player.x < this.x+this.w+20 && player.right > this.x && player.y < this.y+this.h && player.bottom > this.y) {
      this.reached=true;
    }
  }
  draw(ctx){
    ctx.save();
    const cx=this.x+this.w/2;
    const c=this.reached?'#7fff00':'#ffd700';
    const pulse=Math.sin(this.animTimer*0.1)*8;
    ctx.shadowBlur=20;ctx.shadowColor=c;
    ctx.fillStyle='#888'; ctx.fillRect(cx-3,this.y,6,this.h);
    const wave=Math.sin(this.animTimer*0.08)*8;
    ctx.fillStyle=c;
    ctx.beginPath();
    ctx.moveTo(cx,this.y); ctx.lineTo(cx+30+wave,this.y+14);
    ctx.lineTo(cx+28+wave,this.y+32); ctx.lineTo(cx,this.y+28);
    ctx.closePath(); ctx.fill();
    // glow ring
    ctx.globalAlpha=0.15+Math.sin(this.animTimer*0.08)*0.1;
    ctx.fillStyle=c;
    ctx.beginPath(); ctx.arc(cx,this.y+this.h/2,30+pulse,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

// ── Background Layer ──────────────────────────────────────────
class BackgroundLayer {
  constructor(opts={}){
    this.type=opts.type??'city';
    this.parallax=opts.parallax??0.3;
    this.stars=[];
    this.buildings=[];
    this.clouds=[];
    if(this.type==='stars') this._initStars();
    if(this.type==='city')  this._initCity();
    if(this.type==='clouds') this._initClouds();
  }
  _initStars(){
    for(let i=0;i<200;i++) this.stars.push({
      x:Math.random()*5000,y:Math.random()*800,
      r:Math.random()*2+0.5,
      blink:Math.random()*Math.PI*2
    });
  }
  _initCity(){
    for(let i=0;i<40;i++){
      const h=rand(80,280), w=rand(40,120);
      this.buildings.push({
        x:i*130+rand(-20,20),y:600-h,w,h,
        color:`hsl(${randInt(200,240)},${randInt(15,35)}%,${randInt(8,18)}%)`,
        windows:[]
      });
      const b=this.buildings[this.buildings.length-1];
      for(let wy=b.y+10;wy<600-10;wy+=18)
        for(let wx=b.x+5;wx<b.x+b.w-5;wx+=14)
          b.windows.push({x:wx,y:wy,on:Math.random()>0.4});
    }
  }
  _initClouds(){
    for(let i=0;i<15;i++) this.clouds.push({
      x:Math.random()*4000,y:rand(50,300),
      w:rand(120,300),h:rand(40,80),
      speed:rand(0.1,0.4),alpha:rand(0.05,0.15)
    });
  }
  draw(ctx,camX,camY,t){
    ctx.save();
    const ox=camX*this.parallax;
    if(this.type==='stars'){
      this.stars.forEach(s=>{
        s.blink+=0.02;
        const a=0.4+Math.sin(s.blink)*0.4;
        ctx.globalAlpha=a;
        ctx.fillStyle='#ffffff';
        ctx.beginPath();
        ctx.arc(s.x-ox%5000,s.y,s.r,0,Math.PI*2);
        ctx.fill();
      });
    }
    if(this.type==='city'){
      this.buildings.forEach(b=>{
        ctx.globalAlpha=0.7;
        ctx.fillStyle=b.color;
        ctx.fillRect(b.x-(ox*0.5),b.y,b.w,b.h+200);
        // neon top
        ctx.globalAlpha=0.5;
        ctx.fillStyle=`hsl(${200+Math.sin(t*0.001)*40},100%,60%)`;
        ctx.shadowBlur=10;ctx.shadowColor='cyan';
        ctx.fillRect(b.x-(ox*0.5),b.y,b.w,2);
        ctx.shadowBlur=0;
        // windows
        b.windows.forEach(w=>{
          if(!w.on)return;
          ctx.globalAlpha=0.25+Math.sin(t*0.003+w.x)*0.15;
          ctx.fillStyle=`hsl(${rand(40,60)},80%,80%)`;
          ctx.fillRect(w.x-(ox*0.5),w.y,8,10);
        });
      });
    }
    if(this.type==='clouds'){
      this.clouds.forEach(c=>{
        c.x-=c.speed;
        if(c.x+c.w<0)c.x=4000+c.w;
        ctx.globalAlpha=c.alpha;
        ctx.fillStyle='#aaddff';
        ctx.beginPath();
        ctx.ellipse(c.x-(ox*0.2),c.y,c.w,c.h,0,0,Math.PI*2);
        ctx.fill();
      });
    }
    ctx.globalAlpha=1;
    ctx.restore();
  }
}

// ── Level Definitions ─────────────────────────────────────────
function buildLevel(id) {
  const lvls = [
    lv_tutorial, lv_skyCity, lv_iceWorld, lv_lavaRun,
    lv_matrix, lv_neonNight, lv_gravity, lv_boss
  ];
  return lvls[id % lvls.length]();
}

function makeLevel(opts) {
  return {
    name: opts.name,
    theme: opts.theme??'cyber',
    width: opts.width??6000,
    height: opts.height??1200,
    bgColor1: opts.bgColor1??'#050811',
    bgColor2: opts.bgColor2??'#0a1628',
    bgLayers: opts.bgLayers??[],
    platforms: opts.platforms??[],
    hazards: opts.hazards??[],
    coins: opts.coins??[],
    checkpoints: opts.checkpoints??[],
    spawnX: opts.spawnX??100,
    spawnY: opts.spawnY??400,
    goalX: opts.goalX??5800,
    goalY: opts.goalY??300,
    gravity: opts.gravity??1.0,
    difficulty: opts.difficulty??'medium',
    par: opts.par??90,
  };
}

function lv_tutorial(){
  const p=[], h=[], c=[], cp=[];
  // ground
  for(let x=0;x<5200;x+=200) p.push(new Platform(x,680,220,40));
  // gaps with platforms
  p.push(new Platform(300,580,140,20,{oneWay:true}));
  p.push(new Platform(550,500,120,20,{oneWay:true}));
  p.push(new Platform(800,420,160,20,{oneWay:true}));
  p.push(new Platform(1100,380,200,30));
  p.push(new Platform(1380,320,100,20,{oneWay:true}));
  // moving platform
  p.push(new Platform(1600,400,120,20,{moving:true,mx1:1800,my1:400,mspeed:1.5}));
  p.push(new Platform(1900,500,180,30));
  p.push(new Platform(2200,440,120,20,{oneWay:true}));
  // coin trail
  for(let x=350;x<1000;x+=120) c.push(new Coin(x,460));
  c.push(new Coin(1150,330,{value:100}));
  // spike hazards
  h.push(new Hazard(450,668,80,12));
  h.push(new Hazard(720,668,80,12));
  // checkpoints
  cp.push(new Checkpoint(1100,320));
  cp.push(new Checkpoint(2000,440));
  // more platforms to goal
  p.push(new Platform(2500,360,180,30));
  p.push(new Platform(2800,300,140,20));
  p.push(new Platform(3100,260,120,20,{moving:true,mx1:3300,my1:260,mspeed:2}));
  for(let x=3400;x<4600;x+=220) p.push(new Platform(x,300,200,30));
  h.push(new Hazard(3600,288,60,12));
  h.push(new Hazard(4000,288,80,12));
  for(let x=3500;x<4500;x+=150) c.push(new Coin(x,250));
  cp.push(new Checkpoint(3800,240));
  return makeLevel({
    name:'Başlangıç Yolu',bgColor1:'#050811',bgColor2:'#081428',
    bgLayers:[new BackgroundLayer({type:'stars',parallax:0.2}),new BackgroundLayer({type:'city',parallax:0.4})],
    platforms:p,hazards:h,coins:c,checkpoints:cp,
    spawnX:60,spawnY:600,goalX:4600,goalY:240,difficulty:'easy',par:60,
  });
}

function lv_skyCity(){
  const p=[], h=[], c=[], cp=[];
  const groundY=750;
  // tall towers
  const towers=[200,600,1100,1600,2200,2800,3400,4000,4600];
  towers.forEach((tx,i)=>{
    const tw=rand(80,160), th=rand(200,400);
    p.push(new Platform(tx,groundY-th,tw,th+100,{color:`hsl(${200+i*10},30%,12%)`}));
    // platform ledges on towers
    for(let y=groundY-th+30;y<groundY-30;y+=80) {
      if(Math.random()>0.4) p.push(new Platform(tx-40,y,tw+80,16,{oneWay:true}));
    }
  });
  // floating island bridges
  for(let x=400;x<4800;x+=300){
    const y=rand(350,580);
    p.push(new Platform(x,y,rand(60,140),14,{oneWay:true}));
    if(Math.random()>0.5) c.push(new Coin(x+30,y-30));
  }
  // moving sky platforms
  for(let i=0;i<8;i++){
    const bx=500+i*550, by=rand(280,450);
    p.push(new Platform(bx,by,100,14,{moving:true,mx1:bx+120,my1:by,mspeed:1.2+i*0.2}));
  }
  // lasers
  for(let x=800;x<4500;x+=700) h.push(new Hazard(x,rand(400,600),10,180,{type:'laser',damage:30}));
  // checkpoints
  cp.push(new Checkpoint(1600,groundY-360));
  cp.push(new Checkpoint(3200,300));
  for(let x=500;x<4800;x+=250) c.push(new Coin(x,rand(300,600),{value:Math.random()>0.8?100:50}));
  return makeLevel({
    name:'Gökdelenler Üstü',bgColor1:'#020510',bgColor2:'#050f25',
    bgLayers:[new BackgroundLayer({type:'stars',parallax:0.15}),new BackgroundLayer({type:'city',parallax:0.3})],
    platforms:p,hazards:h,coins:c,checkpoints:cp,
    spawnX:80,spawnY:500,goalX:4800,goalY:280,difficulty:'medium',par:90,
  });
}

function lv_iceWorld(){
  const p=[], h=[], c=[], cp=[];
  for(let x=0;x<5500;x+=180) {
    const y=rand(580,660);
    p.push(new Platform(x,y,200,30,{type:'ice'}));
    if(Math.random()>0.7) h.push(new Hazard(x+rand(10,160),y-12,rand(32,80),12));
  }
  for(let i=0;i<12;i++){
    const bx=200+i*420, by=rand(350,530);
    p.push(new Platform(bx,by,rand(80,160),18,{type:'ice',moving:i%2===0,mx1:bx+(i%2===0?150:0),my1:by,mspeed:1}));
    c.push(new Coin(bx+40,by-30,{value:75}));
  }
  // icicle hazards (falling)
  for(let x=200;x<5000;x+=250) h.push(new Hazard(x,0,14,rand(40,120),{type:'spike',damage:35}));
  cp.push(new Checkpoint(1800,440));
  cp.push(new Checkpoint(3600,380));
  for(let x=300;x<5000;x+=200) c.push(new Coin(x,rand(300,550)));
  return makeLevel({
    name:'Buz Zirvesi',bgColor1:'#030d1f',bgColor2:'#061a38',
    bgLayers:[new BackgroundLayer({type:'stars',parallax:0.2}),new BackgroundLayer({type:'clouds',parallax:0.1})],
    platforms:p,hazards:h,coins:c,checkpoints:cp,
    spawnX:60,spawnY:520,goalX:5300,goalY:320,difficulty:'medium',par:100,
  });
}

function lv_lavaRun(){
  const p=[], h=[], c=[], cp=[];
  // lava floor always scrolling
  h.push(new Hazard(0,820,6000,60,{type:'lava',damage:50}));
  // crumble platforms
  for(let i=0;i<24;i++){
    const bx=100+i*220, by=rand(560,720);
    p.push(new Platform(bx,by,rand(80,160),20,{type:'crumble'}));
    if(Math.random()>0.6) c.push(new Coin(bx+30,by-30,{value:100}));
  }
  // safe islands
  p.push(new Platform(0,700,100,200,{solid:true}));
  p.push(new Platform(1200,620,160,40));
  p.push(new Platform(2400,560,160,40));
  p.push(new Platform(3600,500,160,40));
  p.push(new Platform(4800,460,160,40));
  // spikes above
  for(let x=300;x<5000;x+=400) h.push(new Hazard(x,rand(300,480),rand(48,96),12,{type:'spike',damage:30}));
  // saws
  for(let x=500;x<5000;x+=600) h.push(new Hazard(x,rand(580,700),40,40,{type:'saw',damage:40,moving:true,mx1:x+200,my1:rand(580,700),mspeed:1.5}));
  // disappear platforms
  for(let i=0;i<10;i++){
    const bx=800+i*400, by=rand(480,620);
    p.push(new Platform(bx,by,100,16,{type:'disappear',visPeriod:100,visOnTime:60}));
  }
  cp.push(new Checkpoint(1300,560));
  cp.push(new Checkpoint(3700,440));
  return makeLevel({
    name:'Lav Koşusu',bgColor1:'#0f0300',bgColor2:'#200800',
    bgLayers:[new BackgroundLayer({type:'stars',parallax:0.2})],
    platforms:p,hazards:h,coins:c,checkpoints:cp,
    spawnX:20,spawnY:640,goalX:5200,goalY:380,difficulty:'hard',par:75,
  });
}

function lv_matrix(){
  const p=[], h=[], c=[], cp=[];
  // grid-like structure
  for(let col=0;col<28;col++) {
    const bx=col*200;
    for(let row=0;row<5;row++){
      if(Math.random()>0.35){
        const by=200+row*120;
        p.push(new Platform(bx,by,160,16,{oneWay:row>0,color:'#003300'}));
        if(Math.random()>0.5) c.push(new Coin(bx+60,by-30,{value:75}));
      }
    }
    if(col%4===0) h.push(new Hazard(bx+60,rand(200,750),14,rand(60,200),{type:'laser',damage:35}));
  }
  // ground
  for(let x=0;x<5600;x+=200) p.push(new Platform(x,790,220,80,{color:'#002200'}));
  // moving platforms
  for(let i=0;i<12;i++){
    const bx=300+i*450, by=rand(250,600);
    p.push(new Platform(bx,by,100,14,{moving:true,mx1:bx,my1:by+(i%2?150:-150),mspeed:1.2,color:'#002800'}));
  }
  cp.push(new Checkpoint(2000,580));
  cp.push(new Checkpoint(4000,360));
  return makeLevel({
    name:'Matrix Labirenti',bgColor1:'#000a00',bgColor2:'#001400',
    bgLayers:[new BackgroundLayer({type:'stars',parallax:0.2})],
    platforms:p,hazards:h,coins:c,checkpoints:cp,
    spawnX:60,spawnY:700,goalX:5500,goalY:240,difficulty:'hard',par:100,
  });
}

function lv_neonNight(){
  const p=[], h=[], c=[], cp=[];
  const colors=['#ff006e','#00f5ff','#7fff00','#ffd700','#d400ff'];
  for(let i=0;i<35;i++){
    const bx=100+i*160, by=rand(200,680);
    const col=colors[i%colors.length];
    p.push(new Platform(bx,by,rand(60,140),16,{oneWay:i%4!==0,color:col.replace(')',',0.3)').replace('rgb','rgba')||col}));
    c.push(new Coin(bx+20,by-35,{value:i%5===0?200:50}));
  }
  for(let x=0;x<5600;x+=200) p.push(new Platform(x,780,220,80));
  for(let i=0;i<14;i++){
    const bx=250+i*380;
    h.push(new Hazard(bx,rand(350,700),50,50,{type:'saw',damage:35,moving:true,mx1:bx+200,my1:rand(350,700),mspeed:2}));
  }
  // bounce pads
  const bounceIdxs=[3,8,14,20,27];
  bounceIdxs.forEach(i=>{ if(p[i]) p[i].type='bounce'; });
  cp.push(new Checkpoint(1700,500));
  cp.push(new Checkpoint(3500,300));
  return makeLevel({
    name:'Neon Gece',bgColor1:'#050010',bgColor2:'#0a0020',
    bgLayers:[new BackgroundLayer({type:'stars',parallax:0.2}),new BackgroundLayer({type:'city',parallax:0.35})],
    platforms:p,hazards:h,coins:c,checkpoints:cp,
    spawnX:60,spawnY:700,goalX:5500,goalY:200,difficulty:'hard',par:80,
  });
}

function lv_gravity(){
  const p=[], h=[], c=[], cp=[];
  // inverted sections concept — ceiling platforms
  for(let x=0;x<5500;x+=200){
    p.push(new Platform(x,rand(600,720),rand(100,220),20));
    if(x>500) p.push(new Platform(x+60,rand(80,200),rand(80,160),16,{oneWay:true}));
  }
  // disappearing gauntlet
  for(let i=0;i<18;i++){
    const bx=300+i*300, by=rand(350,580);
    p.push(new Platform(bx,by,90,14,{type:'disappear',visPeriod:80+i*5,visOnTime:50}));
    c.push(new Coin(bx+30,by-30,{value:150}));
  }
  // crumble section
  for(let i=0;i<10;i++){
    const bx=3000+i*240, by=rand(400,600);
    p.push(new Platform(bx,by,140,18,{type:'crumble'}));
  }
  for(let x=200;x<5400;x+=350) h.push(new Hazard(x,740,rand(60,120),20));
  cp.push(new Checkpoint(1800,560));
  cp.push(new Checkpoint(3500,420));
  for(let x=200;x<5400;x+=180) c.push(new Coin(x,rand(250,650),{value:Math.random()>0.85?200:50}));
  return makeLevel({
    name:'Yerçekimi Kaos',bgColor1:'#030411',bgColor2:'#06082a',
    bgLayers:[new BackgroundLayer({type:'stars',parallax:0.25})],
    platforms:p,hazards:h,coins:c,checkpoints:cp,
    spawnX:60,spawnY:600,goalX:5400,goalY:280,difficulty:'extreme',par:120,
  });
}

function lv_boss(){
  const p=[], h=[], c=[], cp=[];
  // arena layout
  p.push(new Platform(0,700,6000,80));
  p.push(new Platform(0,0,20,700));
  p.push(new Platform(5980,0,20,700));
  // platforms
  for(let i=0;i<16;i++){
    const bx=200+i*360, by=rand(350,600);
    p.push(new Platform(bx,by,rand(80,160),16,{type:['normal','crumble','disappear','bounce'][i%4]}));
    c.push(new Coin(bx+40,by-35,{value:200}));
  }
  // moving hazard gauntlet
  for(let i=0;i<20;i++){
    const bx=150+i*280;
    h.push(new Hazard(bx,rand(500,680),50,50,{type:'saw',damage:40,moving:true,mx1:bx+180,my1:rand(450,680),mspeed:2+i*0.1}));
  }
  for(let x=100;x<5900;x+=300) h.push(new Hazard(x,680,20,20,{type:'spike',damage:25}));
  cp.push(new Checkpoint(1500,620));
  cp.push(new Checkpoint(3000,560));
  cp.push(new Checkpoint(4500,500));
  return makeLevel({
    name:'Son Savaş',bgColor1:'#0f0008',bgColor2:'#1a000f',
    bgLayers:[new BackgroundLayer({type:'stars',parallax:0.2})],
    platforms:p,hazards:h,coins:c,checkpoints:cp,
    spawnX:80,spawnY:620,goalX:5800,goalY:580,difficulty:'extreme',par:150,
  });
}

// ── Game State ────────────────────────────────────────────────
let gameState = 'menu'; // menu, playing, paused, dead, complete
let currentLevelId = 0;
let currentLevel = null;
let player = null;
let goal = null;
let frameCount = 0;
let gameStartTime = 0;

function getElapsedTime() {
  const s = Math.floor((Date.now()-gameStartTime)/1000);
  return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
}

// ── Start a Level ─────────────────────────────────────────────
function startLevel(id) {
  currentLevelId = id;
  const lvDef = buildLevel(id);
  currentLevel = lvDef;
  player = new Player(lvDef.spawnX, lvDef.spawnY);
  goal = new GoalFlag(lvDef.goalX, lvDef.goalY);
  particles.length = 0;
  camera.x = player.x - canvas.width/2;
  camera.y = player.y - canvas.height/2;
  camera.targetX = camera.x; camera.targetY = camera.y;
  gameStartTime = Date.now();
  showScreen('gameScreen');
  gameState = 'playing';
  if (id > saveData.currentLevel) saveData.currentLevel = id;
  writeSave();
}

// ── Main Game Loop ────────────────────────────────────────────
function gameLoop(ts) {
  requestAnimationFrame(gameLoop);
  frameCount++;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (gameState === 'menu') { drawMenuBg(ts); clearJust(); return; }
  if (gameState !== 'playing' && gameState !== 'paused') { clearJust(); return; }

  const lv = currentLevel;

  // Update
  if (gameState === 'playing') {
    // moving platforms & hazards
    lv.platforms.forEach(p => {
      p.update(player);
      if (p.type==='crumble' && p.isStoodOn(player)) p.startCrumble();
      if (p.type==='bounce' && p.isStoodOn(player) && player.vy>=0) {
        player.vy = -20; player.onGround=false;
        spawnBurst(player.cx,player.bottom,10,{color:'#7fff00',speedMin:2,speedMax:6});
        camera.shake(5,8);
      }
      if (p.type==='ice' && p.isStoodOn(player)) { player.vx *= 1.02; }
    });
    lv.hazards.forEach(h => h.update());
    lv.coins.forEach(c => c.update());
    lv.checkpoints.forEach(cp => cp.update());
    goal.update(player);

    player.update(lv.platforms, lv.hazards, lv.coins, lv.checkpoints, lv.width, lv.height);

    updateParticles();
    camera.update(player, canvas.width, canvas.height);

    // Clamp camera
    camera.x = clamp(camera.x, -50, lv.width - canvas.width + 50);
    camera.y = clamp(camera.y, -100, lv.height - canvas.height + 200);

    // death check
    if (player.dead) {
      gameState = 'dead';
      setTimeout(showDeathScreen, 600);
    }
    // goal check
    if (goal.reached) {
      gameState = 'complete';
      setTimeout(showCompleteScreen, 500);
      sfxComplete();
      spawnBurst(goal.x+15, goal.y+40, 30, {color:'#7fff00',speedMin:4,speedMax:12,glow:true});
    }

    // pause
    if (justPressed['Escape'] || justPressed['KeyP']) togglePause();
    if (justPressed['KeyR']) { respawnPlayer(); }

    updateHUD();
  }

  // Draw
  drawBackground(lv, ts);
  camera.begin(ctx);

  // Grid lines (subtle)
  drawGrid(lv);

  lv.platforms.forEach(p => p.draw(ctx));
  lv.checkpoints.forEach(cp => cp.draw(ctx));
  goal.draw(ctx);
  lv.hazards.forEach(h => h.draw(ctx));
  lv.coins.forEach(c => c.draw(ctx));
  drawParticles(ctx);
  player.draw(ctx);

  // distance marker
  drawDistanceMarkers(lv);

  camera.end(ctx);
  clearJust();
}

function drawBackground(lv, ts) {
  const g = ctx.createLinearGradient(0,0,0,canvas.height);
  g.addColorStop(0, lv.bgColor1);
  g.addColorStop(1, lv.bgColor2);
  ctx.fillStyle = g;
  ctx.fillRect(0,0,canvas.width,canvas.height);
  lv.bgLayers.forEach(l => l.draw(ctx, camera.x, camera.y, ts));
}

function drawGrid(lv) {
  ctx.save();
  ctx.strokeStyle='rgba(0,245,255,0.03)';
  ctx.lineWidth=1;
  const gs=80;
  const startX=Math.floor(camera.x/gs)*gs;
  const startY=Math.floor(camera.y/gs)*gs;
  for(let x=startX;x<camera.x+canvas.width+gs;x+=gs){
    ctx.beginPath();ctx.moveTo(x,camera.y);ctx.lineTo(x,camera.y+canvas.height);ctx.stroke();
  }
  for(let y=startY;y<camera.y+canvas.height+gs;y+=gs){
    ctx.beginPath();ctx.moveTo(camera.x,y);ctx.lineTo(camera.x+canvas.width,y);ctx.stroke();
  }
  ctx.restore();
}

function drawDistanceMarkers(lv) {
  ctx.save();
  ctx.fillStyle='rgba(0,245,255,0.08)';
  ctx.font='12px Orbitron,monospace';
  ctx.textAlign='center';
  for(let x=0;x<lv.width;x+=600) {
    ctx.fillText(`${Math.floor(x/60)}m`,x,lv.height-10);
  }
  ctx.restore();
}

// ── HUD Update ────────────────────────────────────────────────
function updateHUD() {
  if(!player) return;
  document.getElementById('hudScore').textContent = player.score;
  document.getElementById('hudBest').textContent = saveData.bestScore;
  document.getElementById('hudLevel').textContent = currentLevelId+1;
  document.getElementById('hudDeaths').textContent = player.deaths;
  document.getElementById('hudTime').textContent = getElapsedTime();

  // progress
  const pct = clamp(Math.round((player.x/currentLevel.goalX)*100),0,100);
  document.getElementById('progressBar').style.width = pct+'%';
  document.getElementById('progressLabel').textContent = pct+'%';

  // health
  const hp = clamp(player.health,0,player.maxHealth);
  document.getElementById('healthBar').style.width = (hp/player.maxHealth*100)+'%';
  document.getElementById('healthValue').textContent = Math.ceil(hp);

  // abilities
  const djEl = document.getElementById('abilityDoubleJump');
  const daEl = document.getElementById('abilityDash');
  djEl.classList.toggle('on-cooldown', player.jumpsLeft===0);
  daEl.classList.toggle('on-cooldown', player.dashLeft===0 && player.dashCooldownTimer>0);
  document.getElementById('cdDash').textContent = player.dashCooldownTimer>0 ? Math.ceil(player.dashCooldownTimer/60*2)+'s' : '';

  // combo
  const comboDiv = document.getElementById('comboDisplay');
  if(player.combo>1) {
    comboDiv.classList.remove('hidden');
    document.getElementById('comboText').textContent = `COMBO x${player.combo}`;
    const pct = player.comboTimer/120*100;
    document.getElementById('comboBar').style.width = pct+'%';
  } else comboDiv.classList.add('hidden');
}

// ── Notifications ─────────────────────────────────────────────
function showNotification(text) {
  const area = document.getElementById('notificationArea');
  const el = document.createElement('div');
  el.className = 'notification';
  el.textContent = text;
  area.appendChild(el);
  setTimeout(()=>el.remove(), 2200);
}

// ── Screen Management ─────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function togglePause() {
  if(gameState==='playing') {
    gameState='paused';
    document.getElementById('pauseMenu').classList.remove('hidden');
  } else if(gameState==='paused') {
    gameState='playing';
    document.getElementById('pauseMenu').classList.add('hidden');
  }
}

function showDeathScreen() {
  const el = document.getElementById('deathScreen');
  el.classList.remove('hidden');
  document.getElementById('deathScore').textContent = player.score;
  document.getElementById('deathDistance').textContent = player.distanceTravelled+'m';
  document.getElementById('deathTime').textContent = getElapsedTime();
}

function showCompleteScreen() {
  const elapsed = Math.floor((Date.now()-gameStartTime)/1000);
  const deaths = player.deaths;
  const par = currentLevel.par;
  let stars = 1;
  if(elapsed<=par && deaths===0) stars=3;
  else if(elapsed<=par*1.5 && deaths<=2) stars=2;
  document.getElementById('completScore').textContent = player.score;
  document.getElementById('completeTime').textContent = getElapsedTime();
  document.getElementById('completeDeaths').textContent = deaths;
  const starStr = '⭐'.repeat(stars) + '☆'.repeat(3-stars);
  document.getElementById('completeStarCount').textContent = starStr;
  document.getElementById('completeStars').textContent = '⭐'.repeat(stars);
  // save
  if(!saveData.levelsCompleted.includes(currentLevelId)) saveData.levelsCompleted.push(currentLevelId);
  if(!saveData.levelStars[currentLevelId] || saveData.levelStars[currentLevelId]<stars) saveData.levelStars[currentLevelId]=stars;
  writeSave();
  document.getElementById('levelComplete').classList.remove('hidden');
}

function respawnPlayer() {
  if(player) {
    player.respawn();
    gameState='playing';
    document.getElementById('deathScreen').classList.add('hidden');
  }
}

function returnToMenu() {
  gameState='menu';
  showScreen('menuScreen');
  document.getElementById('pauseMenu').classList.add('hidden');
  document.getElementById('deathScreen').classList.add('hidden');
  document.getElementById('levelComplete').classList.add('hidden');
  updateMenuStats();
}

function updateMenuStats() {
  document.getElementById('menuBestScore').textContent = saveData.bestScore;
  document.getElementById('menuDeaths').textContent = saveData.deaths;
  document.getElementById('menuLevel').textContent = (saveData.currentLevel||0)+1;
}

// ── Menu BG Animation ─────────────────────────────────────────
const bgStars=[];
for(let i=0;i<120;i++) bgStars.push({x:Math.random()*3000,y:Math.random()*900,r:Math.random()*2+0.3,speed:Math.random()*0.5+0.1,blink:Math.random()*Math.PI*2});

function drawMenuBg(ts) {
  const bc=document.getElementById('bgCanvas');
  const bctx=bc.getContext('2d');
  bc.width=window.innerWidth; bc.height=window.innerHeight;
  const g=bctx.createLinearGradient(0,0,0,bc.height);
  g.addColorStop(0,'#050811'); g.addColorStop(1,'#0a1628');
  bctx.fillStyle=g; bctx.fillRect(0,0,bc.width,bc.height);
  bgStars.forEach(s=>{
    s.blink+=0.015; s.x-=s.speed;
    if(s.x<0) s.x=bc.width;
    const a=0.3+Math.sin(s.blink)*0.5;
    bctx.globalAlpha=a;
    bctx.fillStyle='#aaddff';
    bctx.beginPath(); bctx.arc(s.x,s.y,s.r,0,Math.PI*2); bctx.fill();
  });
  bctx.globalAlpha=1;
  // neon grid lines
  bctx.strokeStyle='rgba(0,245,255,0.04)'; bctx.lineWidth=1;
  for(let x=0;x<bc.width;x+=60){bctx.beginPath();bctx.moveTo(x,0);bctx.lineTo(x,bc.height);bctx.stroke();}
  for(let y=0;y<bc.height;y+=60){bctx.beginPath();bctx.moveTo(0,y);bctx.lineTo(bc.width,y);bctx.stroke();}
}

// ── Level Select Screen ───────────────────────────────────────
const LEVEL_META = [
  { name:'Başlangıç Yolu',   difficulty:'easy',    emoji:'🌆' },
  { name:'Gökdelenler Üstü', difficulty:'medium',  emoji:'🏙️' },
  { name:'Buz Zirvesi',      difficulty:'medium',  emoji:'❄️' },
  { name:'Lav Koşusu',       difficulty:'hard',    emoji:'🌋' },
  { name:'Matrix Labirenti', difficulty:'hard',    emoji:'💻' },
  { name:'Neon Gece',        difficulty:'hard',    emoji:'🌃' },
  { name:'Yerçekimi Kaos',   difficulty:'extreme', emoji:'🌀' },
  { name:'Son Savaş',        difficulty:'extreme', emoji:'💀' },
];

function buildLevelGrid() {
  const grid = document.getElementById('levelGrid');
  grid.innerHTML='';
  LEVEL_META.forEach((meta, i) => {
    const unlocked = i===0 || saveData.levelsCompleted.includes(i-1) || saveData.currentLevel >= i;
    const completed = saveData.levelsCompleted.includes(i);
    const stars = saveData.levelStars[i] || 0;
    const card = document.createElement('div');
    card.className = 'level-card' + (completed?' completed':'') + (!unlocked?' locked':'');
    card.innerHTML = `
      <div class="level-number">${meta.emoji}</div>
      <div style="font-family:Orbitron,monospace;font-size:1.5rem;color:var(--neon)">${i+1}</div>
      <div class="level-name">${meta.name}</div>
      <div class="level-stars">${'⭐'.repeat(stars)}${'☆'.repeat(3-stars)}</div>
      <div class="level-difficulty diff-${meta.difficulty}">${meta.difficulty.toUpperCase()}</div>
    `;
    if(unlocked) card.addEventListener('click',()=>startLevel(i));
    grid.appendChild(card);
  });
}

// ── Toggle Helpers ────────────────────────────────────────────
function setupToggle(id, key) {
  const el = document.getElementById(id);
  el.addEventListener('click', () => {
    const on = el.dataset.state !== 'on';
    el.dataset.state = on ? 'on' : 'off';
    settings[key] = on;
  });
}

// ── Event Listeners ───────────────────────────────────────────
document.getElementById('btnPlay').addEventListener('click', () => {
  startLevel(saveData.currentLevel||0);
});
document.getElementById('btnLevels').addEventListener('click', () => {
  buildLevelGrid();
  showScreen('levelScreen');
});
document.getElementById('btnControls').addEventListener('click', () => showScreen('controlsScreen'));
document.getElementById('btnSettings').addEventListener('click', () => showScreen('settingsScreen'));

document.getElementById('btnBackFromLevels').addEventListener('click', () => showScreen('menuScreen'));
document.getElementById('btnBackFromControls').addEventListener('click', () => showScreen('menuScreen'));
document.getElementById('btnBackFromSettings').addEventListener('click', () => showScreen('menuScreen'));

document.getElementById('btnPause').addEventListener('click', togglePause);
document.getElementById('btnResume').addEventListener('click', togglePause);
document.getElementById('btnRestart').addEventListener('click', () => {
  document.getElementById('pauseMenu').classList.add('hidden');
  startLevel(currentLevelId);
});
document.getElementById('btnMenuFromGame').addEventListener('click', returnToMenu);
document.getElementById('btnRespawn').addEventListener('click', respawnPlayer);
document.getElementById('btnMenuFromDeath').addEventListener('click', returnToMenu);
document.getElementById('btnNextLevel').addEventListener('click', () => {
  document.getElementById('levelComplete').classList.add('hidden');
  startLevel((currentLevelId+1) % LEVEL_META.length);
});
document.getElementById('btnReplayLevel').addEventListener('click', () => {
  document.getElementById('levelComplete').classList.add('hidden');
  startLevel(currentLevelId);
});
document.getElementById('btnMenuFromComplete').addEventListener('click', returnToMenu);

setupToggle('toggleMusic',    'music');
setupToggle('toggleSfx',     'sfx');
setupToggle('toggleParticles','particles');
setupToggle('toggleShake',   'shake');

document.getElementById('volumeSlider').addEventListener('input', e => {
  settings.volume = e.target.value/100;
});
document.getElementById('qualitySelect').addEventListener('change', e => {
  settings.quality = e.target.value;
});

// Touch / mobile controls (basic)
let touchStartX=0, touchStartY=0;
canvas.addEventListener('touchstart', e=>{
  const t=e.touches[0];
  touchStartX=t.clientX; touchStartY=t.clientY;
  // tap right side = jump, tap left = left, tap right = right
},{ passive:true });
canvas.addEventListener('touchmove', e=>{
  e.preventDefault();
  const t=e.touches[0];
  const dx=t.clientX-touchStartX, dy=t.clientY-touchStartY;
  keys['KeyA']= dx < -20;
  keys['KeyD']= dx > 20;
  if(dy < -30){ justPressed['Space']=true; }
},{passive:false});
canvas.addEventListener('touchend', ()=>{
  keys['KeyA']=false; keys['KeyD']=false;
},{ passive:true });

// ── Init ──────────────────────────────────────────────────────
updateMenuStats();
requestAnimationFrame(gameLoop);
