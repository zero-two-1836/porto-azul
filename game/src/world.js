// Porto Azul — city generation. Builds the fictional city once per run from a seed:
// a beach and boardwalk on the west edge, a grid of avenues and streets, blocks of
// named buildings, parks, a plaza, the Puerto Sur docks, and every landmark the
// missions use (club, hotel, garage, hospital, police station, safehouse, marina).

import {
  WORLD_W, WORLD_H, SEA_W, SAND_END, BOARDWALK_END,
  AVENUES_X, STREETS_Y, ROAD_HALF, SHOP_NAMES, PALETTE,
} from './config.js';

const ROOF_COLORS = ['#e2725b', '#d95f4b', '#c95d63', '#e8a87c', '#8ecae6', '#f4f1de', '#f2cc8f', '#81b29a'];
const WALL_COLORS = ['#fdf0d5', '#ffe8d6', '#e0fbfc', '#fde2e4', '#e2ece9', '#fff1d6', '#dfe7fd', '#f8edeb'];

function blockIntervals() {
  const xs = [];
  let prev = BOARDWALK_END;
  for (const ax of AVENUES_X) { xs.push([prev, ax - ROAD_HALF]); prev = ax + ROAD_HALF; }
  xs.push([prev, WORLD_W]);
  const ys = [];
  prev = 0;
  for (const sy of STREETS_Y) { ys.push([prev, sy - ROAD_HALF]); prev = sy + ROAD_HALF; }
  ys.push([prev, WORLD_H]);
  return { xs, ys };
}

export function generateWorld(rng) {
  const world = {
    buildings: [], palms: [], umbrellas: [], benches: [], crates: [],
    foodStands: [], parkingSpots: [], parks: [], docks: [],
    landmarks: {}, colliders: [],
  };
  const { xs, ys } = blockIntervals();
  let shopIdx = 0;

  // Landmark plots are reserved first: no random lot may cover a story building or its door.
  const reserved = [
    { x: 592, y: 82, w: 166, h: 140 },   // Casa Lucía (safehouse)
    { x: 1732, y: 632, w: 216, h: 168 }, // Club Nébula
    { x: 2952, y: 612, w: 226, h: 188 }, // Hotel Corallo
    { x: 1132, y: 2300, w: 236, h: 158 },// Taller del Puerto (garage)
    { x: 2372, y: 1232, w: 216, h: 158 },// Hospital San Marisol
    { x: 952, y: 1232, w: 206, h: 158 }, // Comisaría Azul
  ];
  const hitsReserved = (x, y, w, h) => reserved.some((r) => x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y);

  const addBuilding = (x, y, w, h, opts = {}) => {
    const b = {
      x, y, w, h,
      wall: opts.wall ?? rng.pick(WALL_COLORS),
      roof: opts.roof ?? rng.pick(ROOF_COLORS),
      name: opts.name ?? null,
      floors: opts.floors ?? rng.int(2, 6),
      neon: opts.neon ?? rng.pick(['#ff5964', '#38e1ff', '#ffe95e', '#ff8fa3', '#7dffb0']),
      landmark: opts.landmark ?? null,
    };
    world.buildings.push(b);
    world.colliders.push({ x, y, w, h });
    return b;
  };

  // City blocks: most hold 1-4 buildings; a few are parks, one is the market plaza,
  // and the whole southern row is the Puerto Sur docks (warehouses and crates).
  ys.forEach(([y0, y1], j) => {
    xs.forEach(([x0, x1], i) => {
      const bw = x1 - x0, bh = y1 - y0;
      if (bw < 120 || bh < 120) return;
      const isDocks = j === ys.length - 1;
      const roll = rng.next();
      if (isDocks) {
        if (hitsReserved(x0, y0, bw, bh)) return; // the garage's own block stays clear
        const w = addBuilding(x0 + 30, y0 + 26, bw - 60, bh - 52, {
          wall: '#b08968', roof: '#7f5539', floors: 1,
          name: rng.chance(0.5) ? 'Almacén Puerto Sur' : null,
        });
        w.warehouse = true;
        for (let c = 0; c < 4; c++) {
          world.crates.push({ x: rng.range(x0 + 20, x1 - 40), y: rng.range(y0 + 16, y1 - 30), s: rng.range(16, 26) });
        }
        world.docks.push({ x: x0, y: y0, w: bw, h: bh });
        return;
      }
      if (roll < 0.14 && !hitsReserved(x0, y0, bw, bh)) { // park block
        world.parks.push({ x: x0, y: y0, w: bw, h: bh });
        for (let t = 0; t < 9; t++) world.palms.push({ x: rng.range(x0 + 30, x1 - 30), y: rng.range(y0 + 30, y1 - 30), s: rng.range(0.85, 1.25) });
        for (let b = 0; b < 3; b++) world.benches.push({ x: rng.range(x0 + 30, x1 - 40), y: rng.range(y0 + 24, y1 - 24) });
        return;
      }
      if (roll < 0.2 && !hitsReserved(x0, y0, bw, bh)) { // plaza / parking block: open ground with palms and parked cars
        world.parks.push({ x: x0, y: y0, w: bw, h: bh, plaza: true });
        for (let t = 0; t < 4; t++) world.palms.push({ x: rng.range(x0 + 26, x1 - 26), y: rng.range(y0 + 26, y1 - 26), s: 1 });
        for (let px = x0 + 44; px < x1 - 40; px += 52) world.parkingSpots.push({ x: px, y: y0 + 40, angle: Math.PI / 2 });
        return;
      }
      // Building block: split into a grid of lots, tight enough that blocks feel built-up.
      const cols = bw > 430 ? 3 : bw > 300 ? 2 : 1;
      const rows = bh > 430 ? 3 : bh > 300 ? 2 : 1;
      for (let cx = 0; cx < cols; cx++) {
        for (let cy = 0; cy < rows; cy++) {
          const lx = x0 + 18 + (bw - 36) * (cx / cols);
          const ly = y0 + 18 + (bh - 36) * (cy / rows);
          const lw = (bw - 36) / cols - 10;
          const lh = (bh - 36) / rows - 10;
          if (lw < 70 || lh < 70) continue;
          if (hitsReserved(lx, ly, lw, lh)) continue;
          const named = rng.chance(0.55);
          addBuilding(lx, ly, lw, lh, { name: named ? SHOP_NAMES[shopIdx++ % SHOP_NAMES.length] : null });
        }
      }
      // Street palms along the block's west edge.
      for (let py = y0 + 40; py < y1 - 20; py += 92) {
        world.palms.push({ x: x0 + 12, y: py, s: rng.range(0.8, 1.1) });
      }
    });
  });

  // The beach: umbrellas, a lifeguard stand, palms along the boardwalk.
  for (let i = 0; i < 26; i++) {
    world.umbrellas.push({ x: rng.range(SEA_W + 26, SAND_END - 20), y: rng.range(80, WORLD_H - 120), c: rng.pick(['#ff5964', '#38b6ff', '#ffe95e', '#ff8fa3']) });
  }
  for (let py = 60; py < WORLD_H - 40; py += 130) {
    world.palms.push({ x: BOARDWALK_END - 22, y: py, s: rng.range(0.9, 1.3) });
  }

  // Landmarks (fixed spots the story uses). Each is also a collider building.
  const L = world.landmarks;
  L.safehouse = addBuilding(600, 90, 150, 110, { name: 'Casa Lucía', wall: '#ffe8d6', roof: '#e2725b', landmark: 'safehouse' });
  L.safehouse.door = { x: 675, y: 216 };
  L.club = addBuilding(1740, 640, 200, 130, { name: 'Club Nébula', wall: '#2b2d5c', roof: '#1c1e40', neon: '#ff4ecd', landmark: 'club' });
  L.club.door = { x: 1840, y: 786 };
  L.hotel = addBuilding(2960, 620, 210, 150, { name: 'Hotel Corallo', wall: '#fdf0d5', roof: '#d95f4b', floors: 7, landmark: 'hotel' });
  L.hotel.door = { x: 3065, y: 786 };
  L.garage = addBuilding(1140, 2330, 220, 120, { name: 'Taller del Puerto', wall: '#b08968', roof: '#7f5539', floors: 1, landmark: 'garage' });
  L.garage.door = { x: 1250, y: 2314 };
  L.hospital = addBuilding(2380, 1240, 200, 120, { name: 'Hospital San Marisol', wall: '#ffffff', roof: '#c95d63', landmark: 'hospital' });
  L.hospital.door = { x: 2480, y: 1376 };
  L.station = addBuilding(960, 1240, 190, 120, { name: 'Comisaría Azul', wall: '#dfe7fd', roof: '#274156', landmark: 'station' });
  L.station.door = { x: 1055, y: 1376 };
  L.lifeguard = { x: 430, y: 900, door: { x: 430, y: 940 } };
  L.marina = { x: 470, y: 2100, door: { x: 500, y: 2100 } };
  L.ferry = { x: 240, y: 2100, door: { x: 300, y: 2100 } };

  // Food stands on the boardwalk and in the market: they heal, for a price.
  world.foodStands = [
    { x: 520, y: 640, name: 'Arepas Sol' }, { x: 520, y: 1560, name: 'Jugos Lía' },
    { x: 1300, y: 1000, name: 'Tacos El Faro' }, { x: 2600, y: 1640, name: 'Dulces Marisol' },
    { x: 3300, y: 480, name: 'Café Brisa' },
  ];
  for (const f of world.foodStands) world.colliders.push({ x: f.x - 16, y: f.y - 12, w: 32, h: 24 });

  world.pier = { x: 150, y: 2056, w: 410, h: 88 }; // wooden pier over the water at the marina
  return world;
}

// --- geography queries -------------------------------------------------------

export function isWater(x, y, world) {
  if (x >= SEA_W) return false;
  const p = world.pier;
  if (x > p.x && x < p.x + p.w && y > p.y && y < p.y + p.h) return false;
  return true;
}

export function isSand(x) { return x >= SEA_W && x < SAND_END; }

export function roadInfoAt(x, y) {
  for (const ax of AVENUES_X) if (Math.abs(x - ax) <= ROAD_HALF) return { type: 'avenue', at: ax };
  for (const sy of STREETS_Y) if (Math.abs(y - sy) <= ROAD_HALF) return { type: 'street', at: sy };
  if (x >= BOARDWALK_END - 8 && x < BOARDWALK_END + 26) return { type: 'boardwalk' };
  return null;
}

export function districtAt(x, y) {
  if (x < SEA_W) return 'Mar de Marisol';
  if (x < BOARDWALK_END) return 'Playa Serena';
  if (y >= 2050) return 'Puerto Sur';
  if (y >= 1380) return x < 2480 ? 'Barrio Mercado' : 'Puerto Sur';
  if (x >= 2480) return 'Altos del Faro';
  if (x < 1200) return 'Playa Serena';
  return 'Centro Azul';
}

// Push a circle (entity) out of every building AABB and keep it out of the sea
// (unless it is on the pier). Returns the corrected position.
export function collideCircle(world, x, y, r) {
  for (const c of world.colliders) {
    const nx = Math.max(c.x, Math.min(x, c.x + c.w));
    const ny = Math.max(c.y, Math.min(y, c.y + c.h));
    const dx = x - nx, dy = y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * r; y = ny + (dy / d) * r;
      } else {
        // Centre inside the box: push out along the smallest exit.
        const left = x - c.x, right = c.x + c.w - x, top = y - c.y, bot = c.y + c.h - y;
        const m = Math.min(left, right, top, bot);
        if (m === left) x = c.x - r; else if (m === right) x = c.x + c.w + r;
        else if (m === top) y = c.y - r; else y = c.y + c.h + r;
      }
    }
  }
  if (isWater(x, y, world) && x < SEA_W) x = SEA_W + r;
  x = Math.max(r, Math.min(WORLD_W - r, x));
  y = Math.max(r, Math.min(WORLD_H - r, y));
  return { x, y };
}

// Would a circle at (x, y) overlap a building? Used for spawn checks and line of sight.
export function circleHitsBuilding(world, x, y, r) {
  for (const c of world.colliders) {
    const nx = Math.max(c.x, Math.min(x, c.x + c.w));
    const ny = Math.max(c.y, Math.min(y, c.y + c.h));
    const dx = x - nx, dy = y - ny;
    if (dx * dx + dy * dy < r * r) return true;
  }
  return false;
}

export function lineOfSight(world, x0, y0, x1, y1) {
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 24);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (circleHitsBuilding(world, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 6)) return false;
  }
  return true;
}

export { PALETTE };
