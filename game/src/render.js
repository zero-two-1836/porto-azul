// Porto Azul — rendering. Draws the city (sea, sand, boardwalk, roads, blocks,
// buildings with neon signs, palms, the pier), every entity, the objective beacon,
// particles and tracers, and the day-night grade with headlights and sign glow.

import {
  VIEW_W, VIEW_H, WORLD_W, WORLD_H, SEA_W, SAND_END, BOARDWALK_END,
  AVENUES_X, STREETS_Y, ROAD_HALF, PALETTE,
} from './config.js';

export function daylightAt(dayTime) {
  const d = Math.cos((dayTime - 0.54) * Math.PI * 2);
  return Math.max(0, Math.min(1, d * 1.45 + 0.28));
}

function inView(cam, x, y, pad = 80) {
  return x > cam.x - pad && x < cam.x + VIEW_W + pad && y > cam.y - pad && y < cam.y + VIEW_H + pad;
}

function blockRects() {
  const xs = [];
  let prev = BOARDWALK_END;
  for (const ax of AVENUES_X) { xs.push([prev, ax - ROAD_HALF]); prev = ax + ROAD_HALF; }
  xs.push([prev, WORLD_W]);
  const ys = [];
  prev = 0;
  for (const sy of STREETS_Y) { ys.push([prev, sy - ROAD_HALF]); prev = sy + ROAD_HALF; }
  ys.push([prev, WORLD_H]);
  const out = [];
  for (const [y0, y1] of ys) for (const [x0, x1] of xs) out.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
  return out;
}
const BLOCKS = blockRects();

export function drawScene(ctx, G) {
  const cam = G.camera;
  const world = G.world;
  const daylight = G.daylight;
  ctx.fillStyle = PALETTE.waterDeep;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.save();
  ctx.translate(-cam.x, -cam.y);

  drawGround(ctx, G, cam);
  drawProps(ctx, G, cam);
  drawBuildings(ctx, G, cam);
  drawBeacon(ctx, G);
  for (const ped of G.peds.peds) if (inView(cam, ped.x, ped.y, 40)) drawPed(ctx, G, ped);
  drawMarina(ctx, G);
  for (const car of G.traffic.cars) if (inView(cam, car.x, car.y, 90)) drawCar(ctx, G, car);
  for (const cop of G.police.cops) if (!G.traffic.cars.includes(cop) && inView(cam, cop.x, cop.y, 90)) drawCar(ctx, G, cop);
  if (!G.player.car) drawPlayer(ctx, G);
  drawParticles(ctx, G);
  ctx.restore();

  drawGrade(ctx, G, cam, daylight);
}

function drawGround(ctx, G, cam) {
  const t = G.time;
  // Sea with slow foam lines.
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(0, 0, SEA_W, WORLD_H);
  ctx.strokeStyle = 'rgba(191,239,255,0.5)';
  ctx.lineWidth = 2;
  for (let y = 30; y < WORLD_H; y += 74) {
    ctx.beginPath();
    for (let x = 8; x < SEA_W - 8; x += 22) {
      const yy = y + Math.sin(t * 1.3 + x * 0.05 + y) * 3;
      if (x === 8) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  // Sand and the wet band at the waterline.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(SEA_W, 0, SAND_END - SEA_W, WORLD_H);
  ctx.fillStyle = PALETTE.sandWet;
  ctx.fillRect(SEA_W, 0, 16, WORLD_H);
  // Boardwalk planks.
  ctx.fillStyle = PALETTE.boardwalk;
  ctx.fillRect(SAND_END, 0, BOARDWALK_END - SAND_END, WORLD_H);
  ctx.strokeStyle = PALETTE.boardwalkDark;
  ctx.lineWidth = 1;
  const yStart = Math.max(0, Math.floor(cam.y / 18) * 18);
  for (let y = yStart; y < Math.min(WORLD_H, cam.y + VIEW_H + 18); y += 18) {
    ctx.beginPath(); ctx.moveTo(SAND_END, y); ctx.lineTo(BOARDWALK_END, y); ctx.stroke();
  }
  // Land base, block pavements, parks and plazas.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(BOARDWALK_END, 0, WORLD_W - BOARDWALK_END, WORLD_H);
  for (const b of BLOCKS) {
    ctx.fillStyle = PALETTE.sidewalk;
    ctx.fillRect(b.x, b.y, b.w, b.h);
  }
  for (const p of G.world.parks) {
    ctx.fillStyle = p.plaza ? PALETTE.plaza : PALETTE.grassDark;
    ctx.fillRect(p.x + 4, p.y + 4, p.w - 8, p.h - 8);
  }
  // Roads: avenues then streets, with centre dashes and crosswalks.
  ctx.fillStyle = PALETTE.asphalt;
  for (const ax of AVENUES_X) ctx.fillRect(ax - ROAD_HALF, 0, ROAD_HALF * 2, WORLD_H);
  for (const sy of STREETS_Y) ctx.fillRect(BOARDWALK_END, sy - ROAD_HALF, WORLD_W - BOARDWALK_END, ROAD_HALF * 2);
  ctx.fillStyle = PALETTE.asphaltLine;
  for (const ax of AVENUES_X) for (let y = 8; y < WORLD_H; y += 44) {
    if (STREETS_Y.some((sy) => Math.abs(y - sy) < 84)) continue;
    ctx.fillRect(ax - 3, y, 6, 24);
  }
  for (const sy of STREETS_Y) for (let x = BOARDWALK_END + 8; x < WORLD_W; x += 44) {
    if (AVENUES_X.some((ax) => Math.abs(x - ax) < 84)) continue;
    ctx.fillRect(x, sy - 3, 24, 6);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  for (const ax of AVENUES_X) for (const sy of STREETS_Y) {
    for (let s = -52; s <= 52; s += 16) {
      ctx.fillRect(ax + s - 4, sy - ROAD_HALF + 6, 8, 12);
      ctx.fillRect(ax + s - 4, sy + ROAD_HALF - 18, 8, 12);
    }
  }
  // The marina pier over the water.
  const pier = G.world.pier;
  ctx.fillStyle = PALETTE.boardwalk;
  ctx.fillRect(pier.x, pier.y, pier.w, pier.h);
  ctx.strokeStyle = PALETTE.boardwalkDark;
  for (let x = pier.x + 8; x < pier.x + pier.w; x += 26) {
    ctx.beginPath(); ctx.moveTo(x, pier.y); ctx.lineTo(x, pier.y + pier.h); ctx.stroke();
  }
}

function drawProps(ctx, G, cam) {
  const world = G.world;
  for (const u of world.umbrellas) {
    if (!inView(cam, u.x, u.y, 30)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.ellipse(u.x + 4, u.y + 6, 17, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = u.c;
    ctx.beginPath(); ctx.arc(u.x, u.y, 16, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(u.x, u.y, 5, 0, Math.PI * 2); ctx.fill();
  }
  for (const c of world.crates) {
    if (!inView(cam, c.x, c.y, 30)) continue;
    ctx.fillStyle = '#8a5a2e';
    ctx.fillRect(c.x, c.y, c.s, c.s);
    ctx.strokeStyle = '#6e4522';
    ctx.strokeRect(c.x + 1, c.y + 1, c.s - 2, c.s - 2);
  }
  for (const b of world.benches) {
    if (!inView(cam, b.x, b.y, 20)) continue;
    ctx.fillStyle = '#7a4a21';
    ctx.fillRect(b.x, b.y, 22, 7);
  }
  // Lifeguard tower.
  const lg = world.landmarks.lifeguard;
  ctx.fillStyle = '#e2725b';
  ctx.fillRect(lg.x - 16, lg.y - 30, 32, 24);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(lg.x - 12, lg.y - 26, 24, 10);
  ctx.strokeStyle = '#8a5a2e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(lg.x - 14, lg.y - 6); ctx.lineTo(lg.x - 8, lg.y + 16);
  ctx.moveTo(lg.x + 14, lg.y - 6); ctx.lineTo(lg.x + 8, lg.y + 16);
  ctx.stroke();
  // Food stands: striped awning and a name board.
  ctx.textAlign = 'center';
  for (const f of world.foodStands) {
    if (!inView(cam, f.x, f.y, 40)) continue;
    ctx.fillStyle = '#fdf0d5';
    ctx.fillRect(f.x - 17, f.y - 10, 34, 22);
    for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? '#ffffff' : '#ff5964'; ctx.fillRect(f.x - 19 + i * 10, f.y - 16, 10, 7); }
    ctx.fillStyle = '#274156';
    ctx.font = 'bold 8px "Trebuchet MS", sans-serif';
    ctx.fillText(f.name.toUpperCase(), f.x, f.y + 22);
  }
  // Palms: curved trunk and a burst of fronds.
  for (const p of world.palms) {
    if (!inView(cam, p.x, p.y, 46)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.ellipse(p.x + 6, p.y + 8, 15 * p.s, 6 * p.s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8a5a2e';
    ctx.lineWidth = 4 * p.s;
    ctx.beginPath(); ctx.moveTo(p.x, p.y + 8); ctx.quadraticCurveTo(p.x + 3, p.y, p.x + 1, p.y - 8); ctx.stroke();
    ctx.strokeStyle = '#2e8b47';
    ctx.lineWidth = 3 * p.s;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + p.x * 0.01;
      ctx.beginPath();
      ctx.moveTo(p.x + 1, p.y - 8);
      ctx.quadraticCurveTo(p.x + 1 + Math.cos(a) * 13 * p.s, p.y - 12 + Math.sin(a) * 5 * p.s, p.x + 1 + Math.cos(a) * 20 * p.s, p.y - 6 + Math.sin(a) * 10 * p.s);
      ctx.stroke();
    }
  }
}

// Darken a #rrggbb colour by f (0..1). Used for parapets and roof edges.
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 255) * f)));
  const g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 255) * f)));
  const b = Math.max(0, Math.min(255, Math.round((n & 255) * f)));
  return `rgb(${r},${g},${b})`;
}

// Deterministic per-building hash from its coordinates: rooftop props and
// window skips never change between runs.
function buildingHash(b) { return ((Math.round(b.x) * 31 + Math.round(b.y) * 17) % 100 + 100) % 100; }

function drawBuildings(ctx, G, cam) {
  const night = G.daylight < 0.45;
  ctx.textAlign = 'center';
  for (const b of G.world.buildings) {
    if (!inView(cam, b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h))) continue;
    const h = buildingHash(b);
    // Drop shadow, offset to the south-east so the block reads as raised.
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.fillRect(b.x + 9, b.y + 11, b.w, b.h);
    // Wall band, then a roof set well inside it: the parapet edge between the
    // two stops a block reading as one flat slab.
    ctx.fillStyle = b.wall;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    const rx = b.x + 14, ry = b.y + 14, rw = b.w - 28, rh = b.h - 28;
    ctx.fillStyle = b.roof;
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeStyle = shade(b.roof, 0.62);
    ctx.lineWidth = 2;
    ctx.strokeRect(rx + 1, ry + 1, rw - 2, rh - 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(rx + 3.5, ry + 3.5, rw - 7, rh - 7);
    // Window grid, sparser than before and with gaps: not every cell has a
    // window, so the roof stops looking like a punched dot-grid.
    const cols = Math.max(2, Math.floor(b.w / 34));
    const rows = Math.max(1, Math.min(5, b.floors));
    for (let cx = 0; cx < cols; cx++) for (let cy = 0; cy < rows; cy++) {
      if ((cx * 5 + cy * 7 + h) % 10 < 3) continue; // empty cell, deterministic
      const wx = b.x + 20 + cx * ((b.w - 40) / cols);
      const wy = b.y + 20 + cy * ((b.h - 40) / Math.max(1, rows));
      const lit = night && ((cx * 7 + cy * 13 + b.x) % 3 === 0);
      ctx.fillStyle = lit ? '#ffd76a' : 'rgba(38,64,96,0.55)';
      ctx.fillRect(wx, wy, 7, 5);
    }
    // Rooftop props, placed from the building hash so they never move: AC
    // units, a water tank on some roofs, a skylight on others.
    const innerW = Math.max(1, rw - 40), innerH = Math.max(1, rh - 56);
    const acCount = b.w > 110 && b.h > 110 ? 1 + (h % 3) : b.w > 90 ? 1 : 0;
    for (let k = 0; k < acCount; k++) {
      const ax = rx + 12 + ((h * 13 + k * 47) % innerW);
      const ay = ry + 12 + ((h * 7 + k * 29) % innerH);
      ctx.fillStyle = '#c8cdd2';
      ctx.fillRect(ax, ay, 12, 9);
      ctx.fillStyle = '#8a9096';
      ctx.fillRect(ax, ay, 12, 3);
    }
    if (h % 4 === 0 && b.w > 110 && b.h > 110) {
      ctx.fillStyle = '#7fa8c9';
      ctx.beginPath(); ctx.arc(rx + rw - 24, ry + 24, 8, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#5b7d99';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(rx + rw - 24, ry + 24, 8, 0, Math.PI * 2); ctx.stroke();
    }
    if (h % 5 < 2 && b.w > 130) {
      ctx.fillStyle = 'rgba(191,227,239,0.9)';
      ctx.fillRect(rx + rw / 2 - 9, ry + 10, 18, 12);
      ctx.strokeStyle = 'rgba(90,125,153,0.8)';
      ctx.lineWidth = 1;
      ctx.strokeRect(rx + rw / 2 - 9, ry + 10, 18, 12);
    }
    // Shop sign on the south face.
    if (b.name && b.w > 92) {
      const sy = b.y + b.h - 15;
      ctx.fillStyle = 'rgba(10,14,30,0.85)';
      ctx.fillRect(b.x + 6, sy - 9, b.w - 12, 15);
      ctx.font = 'bold 10px "Trebuchet MS", sans-serif';
      if (night) { ctx.shadowColor = b.neon; ctx.shadowBlur = 9; }
      ctx.fillStyle = b.neon;
      ctx.fillText(b.name.toUpperCase(), b.x + b.w / 2, sy + 2);
      ctx.shadowBlur = 0;
    }
    if (b.landmark === 'hospital') {
      ctx.fillStyle = '#e63946';
      ctx.fillRect(b.x + b.w / 2 - 4, b.y + 14, 8, 22);
      ctx.fillRect(b.x + b.w / 2 - 11, b.y + 21, 22, 8);
    }
  }
}

function drawBeacon(ctx, G) {
  const obj = G.missions.currentObjective(G);
  if (!obj || obj.x == null || G.mode !== 'play') return;
  const color = obj.kind === 'offer' ? '#ff4ecd' : obj.kind.startsWith('courier') ? '#7dffb0' : '#ffd23e';
  const pulse = 0.6 + Math.sin(G.time * 4) * 0.25;
  ctx.fillStyle = color + '2e';
  ctx.fillRect(obj.x - 13, obj.y - 320, 26, 320);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(obj.x, obj.y, 26 + Math.sin(G.time * 4) * 5, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = color;
  ctx.save();
  ctx.translate(obj.x, obj.y - 44 - Math.sin(G.time * 4) * 5);
  ctx.rotate(Math.PI / 4);
  const s = 10 * pulse + 5;
  ctx.fillRect(-s / 2, -s / 2, s, s);
  ctx.restore();
}

function drawMarina(ctx, G) {
  const offer = G.missions.offerPoint(G);
  if (!offer) return;
  // Marina herself: pink dress, dark hair, waiting at her club door.
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath(); ctx.ellipse(offer.x, offer.y + 10, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ff4ecd';
  ctx.beginPath(); ctx.arc(offer.x, offer.y, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2c29b';
  ctx.beginPath(); ctx.arc(offer.x, offer.y - 3, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#241a20';
  ctx.beginPath(); ctx.arc(offer.x, offer.y - 6, 5, Math.PI, Math.PI * 2); ctx.fill();
}

function drawPed(ctx, G, ped) {
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath(); ctx.ellipse(ped.x + 3, ped.y + 7, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
  if (ped.state === 'down') {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    ctx.rotate(ped.angle + Math.PI / 2);
    ctx.fillStyle = ped.shirt;
    ctx.fillRect(-6, -12, 12, 20);
    ctx.fillStyle = '#f2c29b';
    ctx.beginPath(); ctx.arc(0, -15, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  const step = Math.sin(ped.walk * 6) * 4;
  ctx.strokeStyle = ped.pants;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(ped.x, ped.y + 2); ctx.lineTo(ped.x - Math.cos(ped.angle) * 2 + Math.sin(ped.angle) * step, ped.y + 8);
  ctx.moveTo(ped.x, ped.y + 2); ctx.lineTo(ped.x - Math.cos(ped.angle) * 2 - Math.sin(ped.angle) * step, ped.y + 8);
  ctx.stroke();
  ctx.fillStyle = ped.shirt;
  ctx.beginPath(); ctx.arc(ped.x, ped.y, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2c29b';
  ctx.beginPath(); ctx.arc(ped.x + Math.cos(ped.angle) * 3, ped.y + Math.sin(ped.angle) * 3 - 2, 4.6, 0, Math.PI * 2); ctx.fill();
}

export function drawCarShape(ctx, G, car) {
  const { spec } = car;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  roundRect(ctx, -spec.l / 2 + 4, -spec.w / 2 + 5, spec.l, spec.w, 8); ctx.fill();
  ctx.fillStyle = car.dead ? '#555a60' : car.color;
  roundRect(ctx, -spec.l / 2, -spec.w / 2, spec.l, spec.w, 8); ctx.fill();
  // Cabin and glass.
  ctx.fillStyle = 'rgba(16,30,48,0.9)';
  roundRect(ctx, -spec.l * 0.16, -spec.w / 2 + 5, spec.l * 0.34, spec.w - 10, 5); ctx.fill();
  ctx.fillStyle = 'rgba(140,200,240,0.75)';
  roundRect(ctx, spec.l * 0.16, -spec.w / 2 + 6, spec.l * 0.1, spec.w - 12, 3); ctx.fill();
  // Wheels.
  ctx.fillStyle = '#14161a';
  const ww = 9, wh = 5;
  ctx.fillRect(-spec.l / 2 + 6, -spec.w / 2 - 2, ww, wh);
  ctx.fillRect(-spec.l / 2 + 6, spec.w / 2 - 3, ww, wh);
  ctx.fillRect(spec.l / 2 - 15, -spec.w / 2 - 2, ww, wh);
  ctx.fillRect(spec.l / 2 - 15, spec.w / 2 - 3, ww, wh);
  if (spec.kind === 'taxi') {
    ctx.fillStyle = '#10203a';
    ctx.fillRect(-8, -7, 16, 14);
    ctx.fillStyle = '#ffe95e';
    ctx.font = 'bold 8px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 3);
  }
  if (spec.kind === 'sport') {
    ctx.fillStyle = 'rgba(10,10,16,0.85)';
    ctx.fillRect(-spec.l / 2 - 3, -spec.w / 2 + 3, 6, spec.w - 6);
  }
  if (car.cop) {
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, -spec.l * 0.14, -spec.w / 2 + 4, spec.l * 0.3, spec.w - 8, 4); ctx.fill();
    const flash = Math.sin(G.time * 10) > 0;
    ctx.fillStyle = flash ? '#ff4040' : '#3866ff';
    ctx.fillRect(-7, -spec.w / 2 + 2, 6, 5);
    ctx.fillStyle = flash ? '#3866ff' : '#ff4040';
    ctx.fillRect(1, -spec.w / 2 + 2, 6, 5);
    ctx.fillStyle = '#274156';
    ctx.font = 'bold 8px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICÍA', 0, spec.w / 2 - 4);
  }
  if (car.health < 45 && !car.dead) {
    ctx.fillStyle = 'rgba(30,30,30,0.35)';
    ctx.beginPath(); ctx.arc(spec.l / 2 - 4, 0, 8 + Math.sin(G.time * 9) * 2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // Headlights after dark.
  if (G.daylight < 0.4 && !car.dead) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    const grad = ctx.createLinearGradient(spec.l / 2, 0, spec.l / 2 + 130, 0);
    grad.addColorStop(0, 'rgba(255,240,180,0.30)');
    grad.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(spec.l / 2, -spec.w / 2 + 4);
    ctx.lineTo(spec.l / 2 + 130, -spec.w / 2 - 16);
    ctx.lineTo(spec.l / 2 + 130, spec.w / 2 + 16);
    ctx.lineTo(spec.l / 2, spec.w / 2 - 4);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

function drawCar(ctx, G, car) { drawCarShape(ctx, G, car); }

function drawPlayer(ctx, G) {
  const p = G.player;
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath(); ctx.ellipse(p.x + 3, p.y + 8, 10, 4.5, 0, 0, Math.PI * 2); ctx.fill();
  const step = p.speedNow > 4 ? Math.sin(p.walkPhase) * 4.5 : 0;
  ctx.strokeStyle = '#22304a';
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y + 2); ctx.lineTo(p.x - Math.cos(p.angle) * 2 + Math.sin(p.angle) * step, p.y + 9);
  ctx.moveTo(p.x, p.y + 2); ctx.lineTo(p.x - Math.cos(p.angle) * 2 - Math.sin(p.angle) * step, p.y + 9);
  ctx.stroke();
  ctx.fillStyle = '#0e9594';
  ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2c29b';
  ctx.beginPath(); ctx.arc(p.x + Math.cos(p.angle) * 3, p.y + Math.sin(p.angle) * 3 - 2, 5, 0, Math.PI * 2); ctx.fill();
  // Aiming arm.
  if (G.input.mouse.down) {
    ctx.strokeStyle = '#f2c29b';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(p.angle) * 17, p.y + Math.sin(p.angle) * 17);
    ctx.stroke();
  }
}

function drawParticles(ctx, G) {
  for (const fx of G.particles) {
    const a = Math.max(0, fx.life / fx.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = fx.color;
    ctx.fillRect(fx.x - fx.size / 2, fx.y - fx.size / 2, fx.size, fx.size);
  }
  ctx.globalAlpha = 1;
  for (const tr of G.tracers) {
    ctx.globalAlpha = Math.max(0, tr.life / tr.maxLife) * 0.85;
    ctx.strokeStyle = tr.color;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(tr.x0, tr.y0); ctx.lineTo(tr.x1, tr.y1); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawGrade(ctx, G, cam, daylight) {
  const hours = G.dayTime * 24;
  // Sunset warmth near dawn and dusk.
  const warm = Math.max(0, 1 - Math.abs(hours - 18.6) / 1.3) + Math.max(0, 1 - Math.abs(hours - 6.4) / 1.1);
  if (warm > 0.02) {
    ctx.fillStyle = `rgba(255,116,44,${(warm * 0.13).toFixed(3)})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  const dark = (1 - daylight) * 0.44;
  if (dark > 0.01) {
    ctx.fillStyle = `rgba(8,10,52,${dark.toFixed(3)})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  if (G.hud.hurtFlash > 0) {
    const grad = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.36, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.75);
    grad.addColorStop(0, 'rgba(255,30,40,0)');
    grad.addColorStop(1, `rgba(255,30,40,${(G.hud.hurtFlash * 0.4).toFixed(3)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  if (G.police.bust > 0.03 && G.mode === 'play') {
    const flash = Math.sin(G.time * 12) > 0;
    ctx.strokeStyle = flash ? 'rgba(255,60,60,0.5)' : 'rgba(60,110,255,0.5)';
    ctx.lineWidth = 10;
    ctx.strokeRect(0, 0, VIEW_W, VIEW_H);
  }
  void cam;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
