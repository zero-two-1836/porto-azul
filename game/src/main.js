// Porto Azul — the conductor. Builds the game state, runs the loop, owns the mode
// machine (title / play / pause / busted-or-downed), the E-key interactions (talk,
// steal, buy, heal, repair, save), the camera, particles and tracers, and the
// ?shot= staging hook the screenshots are taken through.

import { VIEW_W, VIEW_H, WORLD_W, WORLD_H, DAY_LENGTH } from './config.js';
import { makeRng, seedFromString } from './random.js';
import { Input } from './input.js';
import { generateWorld } from './world.js';
import { GameAudio } from './audio.js';
import { Traffic } from './traffic.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { Player } from './player.js';
import { Missions } from './missions.js';
import { Hud } from './hud.js';
import { drawScene, daylightAt } from './render.js';
import { saveGame, loadSave } from './save.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') ?? 20261122) || 20261122;
const shotName = params.get('shot');

const rng = makeRng(seed);
const world = generateWorld(rng);

const G = {
  mode: 'title',
  time: 0,
  dayTime: 0.42,
  daylight: 1,
  playSeconds: 0,
  rng,
  world,
  input: new Input(canvas),
  audio: new GameAudio(),
  hud: new Hud(),
  player: new Player(world.landmarks.safehouse.door.x, world.landmarks.safehouse.door.y + 36),
  traffic: null, peds: null, police: new Police(), missions: new Missions(),
  cash: 150,
  wanted: 0,
  camera: { x: 0, y: 0 },
  particles: [], tracers: [],
  danger: null,
  promptText: '',
  frames: 0,
};
G.traffic = new Traffic(world, rng);
G.peds = new Pedestrians(world, rng);
window.__game = G;

G.screenToWorld = (sx, sy) => ({ x: sx + G.camera.x, y: sy + G.camera.y });
G.addSparks = (x, y, n) => {
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, Math.PI * 2), s = rng.range(30, 170);
    G.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30, life: rng.range(0.2, 0.5), maxLife: 0.5, color: rng.pick(['#ffd23e', '#ff9a3e', '#fff3b0']), size: rng.range(2, 4), grav: 300 });
  }
};
G.addSmoke = (x, y, n) => {
  for (let i = 0; i < n; i++) {
    G.particles.push({ x: x + rng.range(-8, 8), y: y + rng.range(-8, 8), vx: rng.range(-12, 12), vy: rng.range(-46, -22), life: rng.range(0.7, 1.4), maxLife: 1.4, color: '#3a3f46', size: rng.range(6, 13), grav: -30 });
  }
};
G.addMuzzle = (x, y) => {
  for (let i = 0; i < 3; i++) {
    G.particles.push({ x, y, vx: rng.range(-26, 26), vy: rng.range(-26, 26), life: 0.09, maxLife: 0.09, color: '#ffe95e', size: 5, grav: 0 });
  }
};
G.addTracer = (x0, y0, x1, y1, color) => {
  G.tracers.push({ x0, y0, x1, y1, color, life: 0.09, maxLife: 0.09 });
};

G.onBusted = () => {
  if (G.mode !== 'play') return;
  G.mode = 'end';
  G.endKind = 'busted';
  document.getElementById('end-title').textContent = 'BUSTED';
  document.getElementById('end-sub').textContent =
    'La Policía Azul held you still and made it stick. Bail and fines: $150. Your ride, if you had one, is in the impound lot.';
  showEnd();
  G.audio.jingle(false);
};
G.onDowned = () => {
  if (G.mode !== 'play') return;
  G.mode = 'end';
  G.endKind = 'down';
  document.getElementById('end-title').textContent = 'FLATLINED';
  document.getElementById('end-sub').textContent =
    'You wake up under the fluorescent lights of Hospital San Marisol. The bill: $100. Porto Azul kept spinning without you.';
  showEnd();
  G.audio.jingle(false);
};

// --- mode / screens ----------------------------------------------------------

const titleScreen = document.getElementById('title-screen');
const pauseScreen = document.getElementById('pause-screen');
const endScreen = document.getElementById('end-screen');

function setMode(mode) {
  G.mode = mode;
  titleScreen.classList.toggle('hidden', mode !== 'title');
  pauseScreen.classList.toggle('hidden', mode !== 'pause');
  endScreen.classList.toggle('hidden', mode !== 'end');
  G.hud.els.hud.classList.toggle('hidden', mode !== 'play');
}
function showEnd() {
  titleScreen.classList.add('hidden');
  pauseScreen.classList.add('hidden');
  endScreen.classList.remove('hidden');
  G.hud.els.hud.classList.add('hidden');
}

function respawn() {
  const L = world.landmarks;
  if (G.player.car) {
    G.traffic.removeCar(G.player.car);
    G.player.car = null;
  }
  for (const cop of [...G.police.cops]) G.traffic.removeCar(cop);
  G.police.cops = [];
  G.police.bust = 0;
  G.wanted = 0;
  G.player.health = 100;
  if (G.endKind === 'busted') {
    G.cash = Math.max(0, G.cash - 150);
    G.player.x = L.station.door.x; G.player.y = L.station.door.y + 30;
  } else {
    G.cash = Math.max(0, G.cash - 100);
    G.player.x = L.hospital.door.x; G.player.y = L.hospital.door.y + 30;
  }
  G.audio.setEngine(false, 0);
  setMode('play');
}

function startGame(fromSave) {
  G.audio.start();
  if (fromSave) {
    const data = loadSave();
    if (data) {
      G.cash = data.cash;
      G.missions.index = data.missionIndex;
      G.missions.storyDone = data.storyDone;
      G.missions.courierDone = data.courierDone ?? 0;
      G.player.x = data.x; G.player.y = data.y;
      G.player.health = data.health;
      G.playSeconds = data.playSeconds ?? 0;
    }
  } else {
    G.cash = 150;
    G.missions = new Missions();
    G.player.x = world.landmarks.safehouse.door.x;
    G.player.y = world.landmarks.safehouse.door.y + 36;
    G.player.health = 100;
    G.wanted = 0;
    G.playSeconds = 0;
  }
  setMode('play');
  G.hud.toast(fromSave ? 'Welcome back to Porto Azul' : 'Marina Vélez is waiting at Club Nébula — follow the pink ◆');
}

// --- interactions --------------------------------------------------------------

function computePrompt() {
  const P = G.player;
  const L = world.landmarks;
  if (P.car) {
    if (Math.hypot(P.x - L.garage.door.x, P.y - L.garage.door.y) < 85 && P.car.health < 100) return 'E — Repair car at Taller del Puerto ($50)';
    return 'E — Get out';
  }
  const offer = G.missions.offerPoint(G);
  if (offer && Math.hypot(P.x - offer.x, P.y - offer.y) < 70) return offer.label;
  const cp = G.missions.courierPoint(G);
  if (cp && Math.hypot(P.x - cp.x, P.y - cp.y) < 60) return cp.label;
  const near = P.nearestCar(G, 50);
  if (near) return near.driver === 'civ' && Math.abs(near.speed) > 40 ? 'Too fast to grab' : 'E — Steal car';
  for (const f of world.foodStands) {
    if (Math.hypot(P.x - f.x, P.y - f.y) < 55) return `E — Eat at ${f.name} ($25, full health)`;
  }
  if (Math.hypot(P.x - L.safehouse.door.x, P.y - L.safehouse.door.y) < 65) return 'E — Rest & save at Casa Lucía';
  if (Math.hypot(P.x - L.hospital.door.x, P.y - L.hospital.door.y) < 65) return 'E — Treatment at Hospital San Marisol ($40)';
  return '';
}

function interact() {
  const P = G.player;
  const L = world.landmarks;
  if (P.car) {
    if (Math.hypot(P.x - L.garage.door.x, P.y - L.garage.door.y) < 85 && P.car.health < 100) {
      if (G.cash >= 50) { G.cash -= 50; P.car.health = 100; P.car.dead = false; G.hud.toast('Good as new — Taller del Puerto'); G.audio.cash(); }
      else G.hud.toast('Not enough cash to repair');
      return;
    }
    P.exitCar(G);
    return;
  }
  if (G.missions.interact(G)) return;
  const near = P.nearestCar(G, 50);
  if (near && !(near.driver === 'civ' && Math.abs(near.speed) > 40)) { P.enterCar(G, near); return; }
  for (const f of world.foodStands) {
    if (Math.hypot(P.x - f.x, P.y - f.y) < 55) {
      if (G.cash >= 25) { G.cash -= 25; P.health = 100; G.hud.toast(`Ate at ${f.name} — health restored`); G.audio.cash(); }
      else G.hud.toast('Not enough cash to eat');
      return;
    }
  }
  if (Math.hypot(P.x - L.safehouse.door.x, P.y - L.safehouse.door.y) < 65) {
    P.health = Math.min(100, P.health + 40);
    if (saveGame(G)) G.hud.toast('Saved at Casa Lucía. Game stored on this device.');
    else G.hud.toast('Rested at Casa Lucía (saving unavailable here)');
    G.audio.jingle(true);
    return;
  }
  if (Math.hypot(P.x - L.hospital.door.x, P.y - L.hospital.door.y) < 65) {
    if (G.cash >= 40) { G.cash -= 40; P.health = 100; G.hud.toast('Patched up at Hospital San Marisol'); }
    else G.hud.toast('Not enough cash for treatment');
  }
}

// --- the loop ------------------------------------------------------------------

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  if (!(dt > 0)) dt = 0.016;
  G.time += dt;
  G.frames++;

  if (G.mode === 'play' || G.mode === 'title') {
    G.dayTime = (G.dayTime + dt / DAY_LENGTH) % 1;
    G.daylight = daylightAt(G.dayTime);
    G.traffic.update(G, dt);
    G.peds.update(G, dt);
  }
  if (G.mode === 'play') {
    G.playSeconds += dt;
    if (G.player.car) G.player.driveUpdate(G, dt);
    else G.player.footUpdate(G, dt);
    // Screenshot staging support: keep a staged cruise (and the bust meter) alive
    // until the capture; these flags are only ever set by the ?shot= scenes.
    if (G.__cruise && G.player.car) G.player.car.speed = Math.max(G.player.car.speed, 215);
    G.police.update(G, dt);
    if (G.__holdBust) G.police.bust = Math.max(G.police.bust, 0.32);
    G.missions.update(G, dt);
    G.promptText = computePrompt();
    if (G.input.tapped('KeyE')) interact();
    if (G.input.tapped('KeyP', 'Escape')) {
      document.getElementById('pause-stats').textContent =
        `Cash $${G.cash} · Jobs done: ${G.missions.index + G.missions.courierDone} · Time in Porto Azul: ${Math.floor(G.playSeconds / 60)} min`;
      setMode('pause');
    }
    if (G.input.tapped('KeyM')) {
      G.audio.setMuted(!G.audio.muted);
      G.hud.toast(G.audio.muted ? 'Sound off' : 'Sound on');
    }
    // Camera follows the player.
    const tx = Math.max(0, Math.min(WORLD_W - VIEW_W, G.player.x - VIEW_W / 2));
    const ty = Math.max(0, Math.min(WORLD_H - VIEW_H, G.player.y - VIEW_H / 2));
    G.camera.x += (tx - G.camera.x) * Math.min(1, dt * 5);
    G.camera.y += (ty - G.camera.y) * Math.min(1, dt * 5);
    G.hud.update(G, dt);
    G.audio.updateMusic(dt, true);
  } else if (G.mode === 'title') {
    // A slow aerial drift over the city behind the title.
    G.camera.x = (Math.sin(G.time * 0.045) * 0.5 + 0.5) * (WORLD_W - VIEW_W);
    G.camera.y = (Math.cos(G.time * 0.03) * 0.5 + 0.5) * (WORLD_H - VIEW_H);
    G.daylight = daylightAt(G.dayTime);
  }
  // Particles and tracers always tick.
  for (let i = G.particles.length - 1; i >= 0; i--) {
    const fx = G.particles[i];
    fx.life -= dt;
    if (fx.life <= 0) { G.particles.splice(i, 1); continue; }
    fx.x += fx.vx * dt; fx.y += fx.vy * dt; fx.vy += (fx.grav ?? 0) * dt;
  }
  for (let i = G.tracers.length - 1; i >= 0; i--) {
    G.tracers[i].life -= dt;
    if (G.tracers[i].life <= 0) G.tracers.splice(i, 1);
  }
  drawScene(ctx, G);
  G.input.endFrame();
  if (shotName && G.frames === 50) window.__shotReady = true;
}

// --- wiring --------------------------------------------------------------------

document.getElementById('btn-new').addEventListener('click', () => startGame(false));
document.getElementById('btn-continue').addEventListener('click', () => startGame(true));
document.getElementById('btn-controls').addEventListener('click', () => {
  document.getElementById('controls-panel').classList.remove('hidden');
  document.getElementById('title-menu').classList.add('hidden');
});
document.getElementById('btn-controls-back').addEventListener('click', () => {
  document.getElementById('controls-panel').classList.add('hidden');
  document.getElementById('title-menu').classList.remove('hidden');
});
document.getElementById('btn-resume').addEventListener('click', () => setMode('play'));
document.getElementById('btn-save').textContent = 'SAVE GAME';
document.getElementById('btn-save').addEventListener('click', () => {
  if (saveGame(G)) G.hud.toast('Game saved');
  setMode('play');
});
document.getElementById('btn-quit-title').addEventListener('click', () => setMode('title'));
document.getElementById('btn-respawn').addEventListener('click', respawn);
window.addEventListener('keydown', (e) => {
  if (G.mode === 'title' && e.code === 'Enter') startGame(!!loadSave());
  else if (G.mode === 'pause' && (e.code === 'KeyP' || e.code === 'Escape')) setMode('play');
  else if (G.mode === 'end' && e.code === 'Enter') respawn();
});

if (!loadSave()) {
  const btn = document.getElementById('btn-continue');
  btn.style.opacity = '0.45';
}

if (shotName) {
  stageShot(G, shotName);
  setMode('play');
} else {
  setMode('title');
}
requestAnimationFrame(frame);
