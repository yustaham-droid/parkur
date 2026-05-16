// ═══════════════════════════════════════════════
//  PARKOUR 3D — First-Person Three.js Game
// ═══════════════════════════════════════════════
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.FogExp2(0x87CEEB, 0.007);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

// ── Lighting (Roblox-style bright) ───────────────
const ambient = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xfffbe8, 1.2);
sun.position.set(60, 120, 40);
sun.castShadow = true;
sun.shadow.mapSize.width = sun.shadow.mapSize.height = 2048;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 400;
sun.shadow.camera.left = sun.shadow.camera.bottom = -100;
sun.shadow.camera.right = sun.shadow.camera.top = 100;
scene.add(sun);
const fill = new THREE.DirectionalLight(0x9999ff, 0.3);
fill.position.set(-40, 10, -40);
scene.add(fill);

// ── Input ─────────────────────────────────────────
const keys = {};
const jp = {};
window.addEventListener('keydown', e => { if (!keys[e.code]) jp[e.code] = true; keys[e.code] = true; });
window.addEventListener('keyup',   e => { keys[e.code] = false; });
function clearJP() { Object.keys(jp).forEach(k => delete jp[k]); }

// ── Pointer Lock ──────────────────────────────────
let locked = false, yaw = 0, pitch = 0;
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  document.getElementById('blocker').classList.toggle('hidden', locked);
});
document.addEventListener('mousemove', e => {
  if (!locked) return;
  yaw   -= e.movementX * 0.0022;
  pitch -= e.movementY * 0.0022;
  pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, pitch));
});
document.getElementById('btnStart').onclick = () => canvas.requestPointerLock();
canvas.addEventListener('click', () => { if (!locked) canvas.requestPointerLock(); });

// ── Maths ─────────────────────────────────────────
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ── Audio ─────────────────────────────────────────
let ac2 = null;
function getAC() { if (!ac2) ac2 = new (window.AudioContext || window.webkitAudioContext)(); return ac2; }
function beep(f, t = 'sine', d = .1, v = .15) {
  try { const o = getAC().createOscillator(), g = getAC().createGain();
    o.connect(g); g.connect(getAC().destination);
    o.frequency.value = f; o.type = t;
    g.gain.setValueAtTime(v, getAC().currentTime);
    g.gain.exponentialRampToValueAtTime(.001, getAC().currentTime + d);
    o.start(); o.stop(getAC().currentTime + d); } catch(e) {}
}
const sfxJump   = () => beep(340, 'sine', .14, .2);
const sfxLand   = () => beep(120, 'triangle', .1, .25);
const sfxCoin   = () => { beep(880, 'sine', .12, .18); setTimeout(() => beep(1100, 'sine', .1, .14), 70); };
const sfxCP     = () => { [440, 660, 880].forEach((f, i) => setTimeout(() => beep(f, 'sine', .15, .15), i * 100)); };
const sfxDie    = () => { beep(80, 'sawtooth', .4, .28); setTimeout(() => beep(60, 'sawtooth', .3, .22), 150); };
const sfxWin    = () => { [440, 550, 660, 880, 1100].forEach((f, i) => setTimeout(() => beep(f, 'sine', .25, .2), i * 110)); };

// ── Game State ────────────────────────────────────
let currentLevel = 0, score = 0, deaths = 0;
let gameStartTime = Date.now();
const SAVE_KEY = 'pk3d_save';
let saveData = { best: 0, deaths: 0, unlocked: 0 };
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s) saveData = { ...saveData, ...s }; } catch(e) {}
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(saveData)); } catch(e) {} }

// ── Notifications ─────────────────────────────────
function notif(txt) {
  const a = document.getElementById('notifArea');
  const el = document.createElement('div'); el.className = 'notif'; el.textContent = txt;
  a.appendChild(el); setTimeout(() => el.remove(), 2300);
}

// ══════════════════════════════════════════════════
//  WORLD BUILDER
// ══════════════════════════════════════════════════
let platforms = [], coins = [], checkpoints = [], goal = null;
let movingPlatforms = [];
const objects = []; // all collidable AABBs

// Roblox color palette
const COLORS = [
  0xff3333, 0x33cc33, 0x3366ff, 0xff8800, 0xff33cc,
  0x00ccff, 0xffcc00, 0x99ff00, 0xff6699, 0xaa44ff,
  0x00ffcc, 0xff4400, 0x4488ff, 0xffaa33, 0x33ff99
];
let colorIdx = 0;
function nextColor() { return COLORS[colorIdx++ % COLORS.length]; }

function makeMat(color, emissive = 0x000000) {
  return new THREE.MeshPhongMaterial({ color, emissive, shininess: 40, specular: 0x111111 });
}

function addPlatform(x, y, z, w, h, d, color, opts = {}) {
  color = color ?? nextColor();
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = makeMat(color, opts.emissive || 0);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = mesh.receiveShadow = true;
  scene.add(mesh);

  // Edge lines (Roblox block look)
  const edges = new THREE.EdgesGeometry(geo);
  const lineMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 });
  mesh.add(new THREE.LineSegments(edges, lineMat));

  const obj = { mesh, x, y, z, w, h, d, type: opts.type || 'solid', moving: opts.moving || false, vx: 0, vz: 0 };

  if (opts.moving) {
    const startPos = new THREE.Vector3(x, y, z);
    const endPos   = new THREE.Vector3(opts.ex ?? x, opts.ey ?? y, opts.ez ?? z);
    movingPlatforms.push({ obj, startPos, endPos, t: 0, dir: 1, speed: opts.mspeed || 1.2 });
  }

  platforms.push(obj);
  objects.push(obj);
  return obj;
}

function addCoin(x, y, z, value = 50) {
  const geo = new THREE.TorusGeometry(0.35, 0.1, 8, 18);
  const mat = makeMat(value >= 100 ? 0xff44ff : 0xffdd00, value >= 100 ? 0x440044 : 0x443300);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  scene.add(mesh);
  coins.push({ mesh, x, y, z, r: 0.7, value, collected: false });
}

function addCheckpoint(x, y, z) {
  const geo = new THREE.CylinderGeometry(0.6, 0.6, 3.5, 10);
  const mat = makeMat(0x00ffff, 0x004444);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y + 1.75, z);
  scene.add(mesh);
  // Glow ring
  const rGeo = new THREE.TorusGeometry(1.2, 0.12, 8, 24);
  const rMat = makeMat(0x00ffff, 0x004488);
  const ring = new THREE.Mesh(rGeo, rMat);
  ring.rotation.x = Math.PI / 2;
  mesh.add(ring);
  checkpoints.push({ mesh, x, y, z, r: 1.5, activated: false });
}

function addGoal(x, y, z) {
  const geo = new THREE.TorusGeometry(2.2, 0.25, 10, 32);
  const mat = makeMat(0x00ff44, 0x004411);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y + 2.2, z);
  scene.add(mesh);
  // Spinning inner ring
  const geo2 = new THREE.TorusGeometry(1.4, 0.15, 8, 24);
  const mat2 = makeMat(0xffff00, 0x333300);
  const ring2 = new THREE.Mesh(geo2, mat2);
  mesh.add(ring2);
  goal = { mesh, x, y, z, r: 2.5 };
}

function clearWorld() {
  // Remove tracked world objects safely
  platforms.forEach(p => { if (p.mesh) scene.remove(p.mesh); });
  coins.forEach(c => { if (c.mesh) scene.remove(c.mesh); });
  checkpoints.forEach(c => { if (c.mesh) scene.remove(c.mesh); });
  if (goal && goal.mesh) scene.remove(goal.mesh);
  platforms = []; coins = []; checkpoints = []; goal = null;
  movingPlatforms = []; objects.length = 0; colorIdx = 0;
}

// ══════════════════════════════════════════════════
//  PLAYER PHYSICS (First-Person)
// ══════════════════════════════════════════════════
const PW = 0.4, PH = 1.85, PD = 0.4;  // player half-extents
const GRAVITY = -22;
const JUMP_V  = 9.5;
const WALK_SP = 5.5;
const SPRINT_SP = 9.5;
const MAX_FALL = -28;

const player = {
  pos: new THREE.Vector3(0, 4, 0),
  vel: new THREE.Vector3(0, 0, 0),
  onGround: false,
  jumpsLeft: 2,
  health: 100, maxHp: 100,
  dead: false, invTimer: 0,
  cpPos: new THREE.Vector3(0, 4, 0),
  score: 0, deaths: 0,
  startTime: Date.now(),
  standingOn: null,   // reference to platform being stood on
  prevPlatPos: null,  // for moving platform carry
};

// Walking camera bob
let bobT = 0, bobY = 0, bobX = 0;
let lastOnGround = false;
let landTimer = 0; // camera land squish

function playerAABB() {
  return {
    minX: player.pos.x - PW, maxX: player.pos.x + PW,
    minY: player.pos.y,       maxY: player.pos.y + PH,
    minZ: player.pos.z - PD, maxZ: player.pos.z + PD,
  };
}

function platAABB(p) {
  return {
    minX: p.x - p.w/2, maxX: p.x + p.w/2,
    minY: p.y - p.h/2, maxY: p.y + p.h/2,
    minZ: p.z - p.d/2, maxZ: p.z + p.d/2,
  };
}

function overlapAABB(a, b) {
  return a.maxX > b.minX && a.minX < b.maxX &&
         a.maxY > b.minY && a.minY < b.maxY &&
         a.maxZ > b.minZ && a.minZ < b.maxZ;
}

function resolvePhysics(dt) {
  if (player.dead) return;
  if (player.invTimer > 0) player.invTimer -= dt;

  const L = keys['KeyA'], R = keys['KeyD'], F = keys['KeyW'], B = keys['KeyS'];
  const sprint = keys['ShiftLeft'] || keys['ShiftRight'];
  const spd = sprint ? SPRINT_SP : WALK_SP;

  // Move direction based on yaw
  const fwd  = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const move  = new THREE.Vector3();
  if (F) move.addScaledVector(fwd, 1);
  if (B) move.addScaledVector(fwd, -1);
  if (L) move.addScaledVector(right, -1);
  if (R) move.addScaledVector(right, 1);
  if (move.lengthSq() > 0) move.normalize();

  const accel = player.onGround ? 18 : 7;
  const fric  = player.onGround ? 0.12 : 0.02;

  player.vel.x += (move.x * spd - player.vel.x) * Math.min(accel * dt, 1) + player.vel.x * -fric;
  player.vel.z += (move.z * spd - player.vel.z) * Math.min(accel * dt, 1) + player.vel.z * -fric;

  // Simplify: direct set horizontal when grounded
  if (player.onGround) {
    player.vel.x = move.x * spd * 0.9 + player.vel.x * 0.1;
    player.vel.z = move.z * spd * 0.9 + player.vel.z * 0.1;
  } else {
    player.vel.x += move.x * spd * dt * 4;
    player.vel.z += move.z * spd * dt * 4;
    const hspd = Math.sqrt(player.vel.x**2 + player.vel.z**2);
    if (hspd > spd * 1.5) { player.vel.x *= spd * 1.5 / hspd; player.vel.z *= spd * 1.5 / hspd; }
  }

  // Jump
  if (jp['Space']) {
    if (player.jumpsLeft > 0) {
      player.vel.y = JUMP_V + (player.jumpsLeft === 2 ? 0 : -1.5);
      player.onGround = false;
      player.jumpsLeft--;
      sfxJump();
      if (player.jumpsLeft === 0) notif('ÇİFT ZIPL!');
    }
  }

  // Gravity
  player.vel.y += GRAVITY * dt;
  player.vel.y = Math.max(player.vel.y, MAX_FALL);

  // Carry moving platform
  if (player.standingOn && player.standingOn.moving) {
    const mp = movingPlatforms.find(m => m.obj === player.standingOn);
    if (mp && player.prevPlatPos) {
      player.pos.x += mp.obj.x - player.prevPlatPos.x;
      player.pos.z += mp.obj.z - player.prevPlatPos.z;
    }
    if (mp) player.prevPlatPos = new THREE.Vector3(mp.obj.x, mp.obj.y, mp.obj.z);
  } else { player.prevPlatPos = null; }
  player.standingOn = null;

  // Move Y then resolve
  player.pos.y += player.vel.y * dt;
  const wasOnGround = player.onGround;
  player.onGround = false;

  for (const p of objects) {
    if (!overlapAABB(playerAABB(), platAABB(p))) continue;
    const pb = platAABB(p);
    if (player.vel.y <= 0 && player.pos.y >= pb.maxY - 0.15) {
      // Land on top
      player.pos.y = pb.maxY;
      player.vel.y = 0;
      player.onGround = true;
      player.jumpsLeft = 2;
      player.standingOn = p;
      // Bounce
      if (p.type === 'bounce') { player.vel.y = JUMP_V * 1.4; player.onGround = false; sfxJump(); }
    } else if (player.vel.y > 0 && player.pos.y + PH <= pb.minY + 0.3) {
      player.pos.y = pb.minY - PH;
      player.vel.y = 0;
    }
  }

  if (!wasOnGround && player.onGround) { sfxLand(); landTimer = 1; }
  if (wasOnGround && !player.onGround) { /* coyote could go here */ }

  // Move X then resolve
  player.pos.x += player.vel.x * dt;
  for (const p of objects) {
    const pb = platAABB(p);
    const pl = playerAABB();
    if (!overlapAABB(pl, pb)) continue;
    if (player.vel.x > 0) { player.pos.x = pb.minX - PW - 0.01; }
    else { player.pos.x = pb.maxX + PW + 0.01; }
    player.vel.x = 0;
  }

  // Move Z then resolve
  player.pos.z += player.vel.z * dt;
  for (const p of objects) {
    const pb = platAABB(p);
    const pl = playerAABB();
    if (!overlapAABB(pl, pb)) continue;
    if (player.vel.z > 0) { player.pos.z = pb.minZ - PD - 0.01; }
    else { player.pos.z = pb.maxZ + PD + 0.01; }
    player.vel.z = 0;
  }

  // Fall death
  if (player.pos.y < -15) {
    if (!player.dead) { player.dead = true; sfxDie(); setTimeout(showDeath, 600); }
    return;
  }

  // Hazard damage (lava type)
  for (const p of objects) {
    if (p.type !== 'lava') continue;
    if (overlapAABB(playerAABB(), platAABB(p)) && player.invTimer <= 0) {
      player.health -= 30; player.invTimer = 1.2;
      if (player.health <= 0) { player.dead = true; sfxDie(); setTimeout(showDeath, 600); }
    }
  }

  // Coin collection
  for (const c of coins) {
    if (c.collected) continue;
    const dx = player.pos.x - c.x, dy = player.pos.y + 1 - c.y, dz = player.pos.z - c.z;
    if (Math.sqrt(dx*dx + dy*dy + dz*dz) < c.r) {
      c.collected = true; scene.remove(c.mesh);
      player.score += c.value; if (player.score > saveData.best) saveData.best = player.score;
      sfxCoin(); notif(`+${c.value} KOİN 🪙`);
    }
  }

  // Checkpoint
  for (const cp of checkpoints) {
    if (cp.activated) continue;
    const dx = player.pos.x - cp.x, dz = player.pos.z - cp.z;
    if (Math.sqrt(dx*dx + dz*dz) < cp.r) {
      cp.activated = true;
      player.cpPos.copy(player.pos);
      sfxCP(); notif('✓ KONTROL NOKTASI');
    }
  }

  // Goal
  if (goal) {
    const dx = player.pos.x - goal.x, dz = player.pos.z - goal.z;
    const dy = (player.pos.y + 1) - (goal.y + 2.2);
    if (Math.sqrt(dx*dx + dy*dy + dz*dz) < goal.r) {
      sfxWin(); showWin();
    }
  }

  // ── Camera update ─────────────────────────────────
  const hspd2 = Math.sqrt(player.vel.x**2 + player.vel.z**2);
  const isMoving = hspd2 > 0.3 && player.onGround;
  if (isMoving) { bobT += dt * hspd2 * 0.6; }
  bobY = isMoving ? Math.sin(bobT * Math.PI * 2) * 0.042 : lerp(bobY, 0, 0.15);
  bobX = isMoving ? Math.sin(bobT * Math.PI) * 0.018 : lerp(bobX, 0, 0.15);
  if (landTimer > 0) { landTimer -= dt * 4; }
  const landSquish = Math.max(0, landTimer) * -0.06;

  camera.position.set(player.pos.x, player.pos.y + 1.65 + bobY + landSquish, player.pos.z);
  camera.rotation.order = 'YXZ';
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;
  camera.rotation.z = bobX;

  // FOV sprint effect
  const targetFOV = (keys['ShiftLeft'] || keys['ShiftRight']) && isMoving ? 88 : 75;
  camera.fov = lerp(camera.fov, targetFOV, 0.08);
  camera.updateProjectionMatrix();
}

function respawn() {
  player.pos.copy(player.cpPos);
  player.vel.set(0, 0, 0);
  player.health = player.maxHp;
  player.dead = false; player.invTimer = 1;
  player.jumpsLeft = 2;
  player.deaths++; deaths++;
  document.getElementById('deathScreen').classList.add('hidden');
  notif('♻ YENİDEN BAŞLADI');
}

// ══════════════════════════════════════════════════
//  LEVEL DEFINITIONS (3D Roblox Obby style)
// ══════════════════════════════════════════════════
const LEVELS = [
  {
    name: 'Başlangıç Koşusu', sky: 0x87CEEB, fog: 0x87CEEB,
    build() {
      // Large start
      addPlatform(0, 0, 0, 12, 1, 12, 0x4488ff);
      player.pos.set(0, 3, 0); player.cpPos.set(0, 3, 0);
      // Stepping stones
      const steps = [
        [0,0,10,3,1,3],[3,0,16,3,1,3],[-2,1,22,3,1,3],[1,2,28,3,1,3],
        [4,2,34,3,1,3],[0,3,40,3,1,3],[-3,3,46,3,1,3],[0,4,52,4,1,4],
      ];
      steps.forEach(([x,y,z,w,h,d]) => addPlatform(x,y,z,w,h,d));
      // Coins
      [[0,2,10],[3,2,16],[-2,3,22],[1,4,28]].forEach(([x,y,z]) => addCoin(x,y,z));
      // Moving platform
      addPlatform(0,5,62,4,1,4,0xff4400,{moving:true,ex:6,ez:62,mspeed:1.5});
      addCheckpoint(0,5,74);
      addPlatform(0,5,76,8,1,8,0x44ff44);
      // Second section - stairs going up
      for (let i = 0; i < 6; i++) addPlatform(i*3-4,5+i,88+i*4,3,1,4,0xff8800);
      addPlatform(0,11,116,6,1,6,0xff0088);
      [[0,13,116],[3,13,116],[-3,13,116]].forEach(([x,y,z]) => addCoin(x,y,z,100));
      addCheckpoint(0,12,128);
      addPlatform(0,12,130,10,1,10,0x8844ff);
      // Tricky thin beams
      addPlatform(0,12,142,1,1,8,0xff0000);
      addPlatform(4,12,150,1,1,8,0xff0000);
      addPlatform(-2,12,158,1,1,8,0xff0000);
      addPlatform(0,12,168,8,1,8,0x00ccff);
      addGoal(0,12,168);
    }
  },
  {
    name: 'Gökyüzü Köprüleri', sky: 0x4466cc, fog: 0x4466cc,
    build() {
      addPlatform(0,0,0,10,1,10,0x2255aa);
      player.pos.set(0,3,0); player.cpPos.set(0,3,0);
      // High altitude platforms
      const path = [
        [0,0,14,4,1,4],[6,2,22,4,1,4],[-4,4,30,4,1,4],[2,6,40,4,1,4],
        [8,8,50,3,1,3],[-6,10,58,3,1,3],[0,12,68,5,1,5],
      ];
      path.forEach(([x,y,z,w,h,d]) => addPlatform(x,y,z,w,h,d));
      path.forEach(([x,y,z]) => addCoin(x,y+2,z));
      // Moving platforms over big gaps
      addPlatform(-4,14,80,3,1,3,0xff6600,{moving:true,ex:4,ez:80,mspeed:1.8});
      addPlatform(0,16,92,3,1,3,0xff6600,{moving:true,ey:20,ez:92,mspeed:1.2});
      addCheckpoint(0,20,104);
      addPlatform(0,20,106,8,1,8,0x8800ff);
      // Floating islands with gaps
      [[-8,20,118],[0,22,126],[8,24,134],[-4,26,142],[0,28,150]].forEach(([x,y,z]) => {
        addPlatform(x,y,z,3,1,3); addCoin(x,y+2,z);
      });
      addPlatform(0,30,162,8,1,8,0x00ff88);
      addCheckpoint(0,30,162);
      [[0,32,162],[3,32,162],[-3,32,162]].forEach(([x,y,z]) => addCoin(x,y,z,100));
      // Final rush
      for (let i=0;i<8;i++) addPlatform(i%2===0?-3:3,30+i*0.5,174+i*5,2,1,3,COLORS[(i*3)%COLORS.length]);
      addPlatform(0,34,220,8,1,8,0xffff00);
      addGoal(0,34,220);
    }
  },
  {
    name: 'Lav Labirenti', sky: 0x331100, fog: 0x220800,
    build() {
      addPlatform(0,0,0,10,1,10,0x883300);
      player.pos.set(0,3,0); player.cpPos.set(0,3,0);
      // Lava floor
      addPlatform(0,-3,80,200,1,200,0xff2200,{type:'lava'});
      // Safe islands
      const islands = [
        [0,0,14,4,1,5],[6,0,22,3,1,4],[-5,0,30,4,1,4],[2,0,40,3,1,5],
        [-3,0,50,4,1,4],[5,0,60,3,1,3],[0,0,70,4,1,4],[0,0,82,5,1,5],
      ];
      islands.forEach(([x,y,z,w,h,d]) => addPlatform(x,y,z,w,h,d,0x996633));
      // Moving platforms over lava
      addPlatform(0,0,92,3,1,3,0xff6600,{moving:true,ex:8,ez:92,mspeed:2});
      addPlatform(4,0,104,3,1,3,0xff6600,{moving:true,ex:-4,ez:104,mspeed:2.2});
      addCheckpoint(0,0,116);
      addPlatform(0,0,118,8,1,8,0x663300);
      // Crumble zone (thin platforms, harder)
      for (let i=0;i<10;i++) {
        addPlatform(i%2===0?-4:4,0,130+i*7,2,1,3,0x884422);
        addCoin(i%2===0?-4:4,2,130+i*7);
      }
      addPlatform(0,0,202,8,1,8,0x996633);
      addCheckpoint(0,0,202);
      [[0,2,202],[3,2,202],[-3,2,202]].forEach(([x,y,z]) => addCoin(x,y,z,100));
      // Bounce platforms
      for(let i=0;i<4;i++) addPlatform(i%2===0?-5:5,0,214+i*8,3,1,3,0x00ff88,{type:'bounce'});
      addPlatform(0,3,248,8,1,8,0xffaa00);
      addGoal(0,3,248);
    }
  },
  {
    name: 'Buz Dağı', sky: 0x99ccff, fog: 0xaaddff,
    build() {
      addPlatform(0,0,0,10,1,10,0x88bbff);
      player.pos.set(0,3,0); player.cpPos.set(0,3,0);
      // Zigzag ice climb
      [[4,1,12,3,1,4],[-4,2,22,3,1,4],[6,3,32,3,1,4],[-6,4,42,3,1,4],
       [4,5,52,3,1,4],[0,6,62,5,1,5]].forEach(([px,py,pz,w,h,d]) => {
        addPlatform(px,py,pz,w,h,d,0x88ccff); addCoin(px,py+2,pz);
      });
      // Moving ice blocks
      addPlatform(0,7,76,3,1,3,0xaaeeff,{moving:true,ex:6,ey:7,ez:76,mspeed:1.4});
      addPlatform(3,9,88,3,1,3,0xaaeeff,{moving:true,ex:-3,ey:9,ez:88,mspeed:1.6});
      addCheckpoint(0,10,100);
      addPlatform(0,10,102,8,1,8,0x6699ff);
      // Thin ice beams
      for(let i=0;i<6;i++) addPlatform((i%2===0?-4:4)+i*0.5,10+i,114+i*7,1.2,1,4,0xaaddff);
      addPlatform(0,16,158,8,1,8,0x4466ff);
      addCheckpoint(0,16,158);
      // Vertical ice pillars to jump between
      [[-5,16,170],[2,18,178],[-3,20,186],[4,22,194],[0,24,202]].forEach(([px,py,pz]) => {
        addPlatform(px,py,pz,2,1,2,0x99ddff); addCoin(px,py+2,pz,75);
      });
      addPlatform(0,26,214,8,1,8,0xffffff);
      addGoal(0,26,214);
    }
  },
];

function loadLevel(id) {
  clearWorld();
  currentLevel = id;
  score = 0; deaths = 0;
  player.score = 0; player.health = player.maxHp; player.dead = false;
  player.vel.set(0,0,0); player.jumpsLeft = 2;
  gameStartTime = Date.now();
  yaw = 0; pitch = 0;

  const lv = LEVELS[id % LEVELS.length];
  scene.background = new THREE.Color(lv.sky);
  if (scene.fog) { scene.fog.color.set(lv.fog); }
  lv.build();

  document.getElementById('hLvName').textContent = `SEVİYE ${id+1}: ${lv.name}`;
  document.getElementById('deathScreen').classList.add('hidden');
  document.getElementById('winScreen').classList.add('hidden');
  notif(`🏁 ${lv.name} BAŞLIYOR!`);
}

// ══════════════════════════════════════════════════
//  UI FUNCTIONS
// ══════════════════════════════════════════════════
function showDeath() {
  if (!player.dead) return;
  saveData.deaths++; save();
  document.getElementById('deathScreen').classList.remove('hidden');
  document.getElementById('dMsg').textContent = player.pos.y < -14 ? 'Düşüp öldün! 😱' : 'Lav seni yaktı! 🔥';
  document.getElementById('blocker').classList.add('hidden');
  if (document.exitPointerLock) document.exitPointerLock();
}

function showWin() {
  const elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
  const mins = Math.floor(elapsed / 60), secs = elapsed % 60;
  const timeStr = `${mins}:${String(secs).padStart(2,'0')}`;
  if (saveData.unlocked <= currentLevel) { saveData.unlocked = currentLevel + 1; save(); }
  document.getElementById('winScreen').classList.remove('hidden');
  document.getElementById('wStats').innerHTML = `
    <div><span>SKOR</span><span>${player.score}</span></div>
    <div><span>SÜRE</span><span>${timeStr}</span></div>
    <div><span>ÖLÜMLER</span><span>${player.deaths}</span></div>
    <div><span>EN İYİ</span><span>${saveData.best}</span></div>`;
  if (document.exitPointerLock) document.exitPointerLock();
}

function updateHUD() {
  document.getElementById('hScore').textContent = player.score;
  document.getElementById('hDeaths').textContent = player.deaths;
  const hp = clamp(player.health, 0, player.maxHp);
  document.getElementById('hHp').style.width = (hp / player.maxHp * 100) + '%';
  document.getElementById('hHpNum').textContent = Math.ceil(hp);
  // Progress
  if (goal) {
    const dist = Math.sqrt((player.pos.x-goal.x)**2 + (player.pos.z-goal.z)**2);
    const startDist = 200; // approx
    const pct = clamp(100 - (dist / startDist * 100), 0, 100);
    document.getElementById('hPbar').style.width = pct + '%';
  }
  // Ability indicators
  document.getElementById('aJump').className = 'abil' + (player.jumpsLeft === 0 ? ' cd' : '');
}

// ── Event Listeners ───────────────────────────────
document.getElementById('bRespawn').onclick = () => { respawn(); canvas.requestPointerLock(); };
document.getElementById('bMenu').onclick = () => {
  document.getElementById('deathScreen').classList.add('hidden');
  document.getElementById('blocker').classList.remove('hidden');
  if (document.exitPointerLock) document.exitPointerLock();
};
document.getElementById('bNext').onclick = () => {
  loadLevel((currentLevel + 1) % LEVELS.length);
  canvas.requestPointerLock();
};
document.getElementById('bMenuW').onclick = () => {
  document.getElementById('winScreen').classList.add('hidden');
  document.getElementById('blocker').classList.remove('hidden');
};

// ══════════════════════════════════════════════════
//  MAIN GAME LOOP
// ══════════════════════════════════════════════════
let lastTime = 0;
let frame = 0;

function animate(ts) {
  requestAnimationFrame(animate);
  const dt = Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  frame++;

  // Update moving platforms
  movingPlatforms.forEach(mp => {
    mp.t += mp.dir * mp.speed * dt;
    if (mp.t >= 1) { mp.t = 1; mp.dir = -1; }
    if (mp.t <= 0) { mp.t = 0; mp.dir = 1; }
    const t2 = 3*mp.t*mp.t - 2*mp.t*mp.t*mp.t;
    const nx = mp.startPos.x + (mp.endPos.x - mp.startPos.x) * t2;
    const ny = mp.startPos.y + (mp.endPos.y - mp.startPos.y) * t2;
    const nz = mp.startPos.z + (mp.endPos.z - mp.startPos.z) * t2;
    mp.obj.mesh.position.set(nx, ny, nz);
    mp.obj.x = nx; mp.obj.y = ny; mp.obj.z = nz;
  });

  // Animate coins
  coins.forEach(c => {
    if (!c.collected) {
      c.mesh.rotation.y += dt * 1.8;
      c.mesh.position.y = c.y + Math.sin(ts * 0.002 + c.x) * 0.25;
    }
  });

  // Animate checkpoints
  checkpoints.forEach(cp => {
    cp.mesh.rotation.y += dt * 1.2;
    if (cp.activated) {
      cp.mesh.material.color.setHex(0xffd700);
      cp.mesh.material.emissive.setHex(0x443300);
    }
  });

  // Animate goal
  if (goal) {
    goal.mesh.rotation.z += dt * 1.5;
    goal.mesh.children[0].rotation.x += dt * 2;
    const gScale = 1 + Math.sin(ts * 0.003) * 0.08;
    goal.mesh.scale.setScalar(gScale);
  }

  // Player physics
  if (locked && !player.dead) {
    resolvePhysics(dt);
    // R key = respawn
    if (jp['KeyR']) respawn();
  }

  updateHUD();
  clearJP();

  renderer.render(scene, camera);
}

// ── Start ─────────────────────────────────────────
loadLevel(0);
animate(0);
