// Porto Azul — traffic. Civilian cars follow the road graph (avenues x streets) in
// right-hand lanes, brake for whoever is ahead, and park along the kerbs and in the
// plaza lots. Any car with nobody driving it can be stolen by the player.

import { AVENUES_X, STREETS_Y, ROAD_HALF, WORLD_W, WORLD_H, CAR_KINDS, CAR_COLORS } from './config.js';

function buildGraph() {
  const nodes = new Map();
  const key = (x, y) => `${x},${y}`;
  const add = (x, y) => { if (!nodes.has(key(x, y))) nodes.set(key(x, y), { x, y, next: [] }); return nodes.get(key(x, y)); };
  const link = (a, b) => { a.next.push(b); b.next.push(a); };
  for (const ax of AVENUES_X) {
    const ys = [70, ...STREETS_Y, WORLD_H - 70];
    let prev = null;
    for (const y of ys) { const n = add(ax, y); if (prev) link(prev, n); prev = n; }
  }
  for (const sy of STREETS_Y) {
    const xs = [640, ...AVENUES_X, WORLD_W - 70];
    let prev = null;
    for (const x of xs) { const n = add(x, sy); if (prev) link(prev, n); prev = n; }
  }
  return [...nodes.values()];
}

function lanePoint(from, to) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  // Right-hand traffic: the lane sits 30 px to the right of the centreline.
  return { x: to.x + (-uy) * 30, y: to.y + ux * 30, ux, uy };
}

export class Traffic {
  constructor(world, rng) {
    this.nodes = buildGraph();
    this.cars = [];
    this.rng = rng;
    // Parked cars in the plaza lots and along the avenue kerbs.
    for (const spot of world.parkingSpots) {
      if (rng.chance(0.72)) this.cars.push(this.makeCar(spot.x, spot.y, spot.angle, 'parked'));
    }
    for (const ax of AVENUES_X) {
      for (let i = 0; i < 7; i++) {
        const y = rng.range(120, WORLD_H - 120);
        if (STREETS_Y.some((sy) => Math.abs(y - sy) < 110)) continue;
        const side = rng.sign();
        this.cars.push(this.makeCar(ax + side * (ROAD_HALF - 17), y, side > 0 ? 0 : Math.PI, 'parked'));
      }
    }
    // Moving traffic.
    for (let i = 0; i < 26; i++) {
      const node = rng.pick(this.nodes);
      const car = this.makeCar(node.x, node.y, 0, 'civ');
      car.from = node;
      car.to = rng.pick(node.next);
      const lp = lanePoint(car.from, car.to);
      car.x = lp.x; car.y = lp.y;
      car.angle = Math.atan2(lp.uy, lp.ux);
      car.cruise = rng.range(120, 205);
      this.cars.push(car);
    }
  }

  makeCar(x, y, angle, driver) {
    const spec = this.rng.pick(CAR_KINDS);
    return {
      x, y, angle, speed: 0, spec,
      color: spec.kind === 'taxi' ? '#ffe95e' : this.rng.pick(CAR_COLORS),
      health: 100, driver, from: null, to: null, cruise: 160,
      honkT: 0, dead: false, smoke: 0,
    };
  }

  spawnParked(x, y, angle, kindName, color) {
    const spec = CAR_KINDS.find((k) => k.kind === kindName) || CAR_KINDS[1];
    const car = { x, y, angle, speed: 0, spec, color, health: 100, driver: 'parked', from: null, to: null, cruise: 160, honkT: 0, dead: false, smoke: 0 };
    this.cars.push(car);
    return car;
  }

  removeCar(car) {
    const i = this.cars.indexOf(car);
    if (i >= 0) this.cars.splice(i, 1);
  }

  update(G, dt) {
    const playerCar = G.player.car;
    for (const car of this.cars) {
      if (car.driver !== 'civ' || car.dead) continue;
      const lp = lanePoint(car.from, car.to);
      const dx = lp.x - car.x, dy = lp.y - car.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 30) {
        const options = car.to.next.filter((n) => n !== car.from);
        const next = options.length ? G.rng.pick(options) : car.from;
        car.from = car.to; car.to = next;
        continue;
      }
      const targetAngle = Math.atan2(dy, dx);
      let turn = targetAngle - car.angle;
      while (turn > Math.PI) turn -= Math.PI * 2;
      while (turn < -Math.PI) turn += Math.PI * 2;
      car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, turn));
      // Brake for anything solid ahead: another car, or the player in any state.
      let want = car.cruise;
      const ahead = (ex, ey) => {
        const ax = ex - car.x, ay = ey - car.y;
        const d = Math.hypot(ax, ay);
        if (d > 84 || d < 1) return false;
        const dot = (ax / d) * Math.cos(car.angle) + (ay / d) * Math.sin(car.angle);
        return dot > 0.72;
      };
      for (const other of this.cars) {
        if (other !== car && ahead(other.x, other.y)) { want = Math.min(want, other.speed * 0.9); break; }
      }
      if (want === car.cruise && playerCar && ahead(playerCar.x, playerCar.y)) want = 0;
      if (want === car.cruise && !playerCar && ahead(G.player.x, G.player.y)) want = 30;
      if (want < car.speed - 20 && car.honkT <= 0) { car.honkT = 2.4; G.audio.blip(340, 0.16, 'square', 0.05); }
      car.honkT -= dt;
      car.speed += Math.max(-320 * dt, Math.min(170 * dt, want - car.speed));
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
    }
    // Wrecked cars fade out and are replaced by fresh traffic elsewhere.
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const car = this.cars[i];
      if (car.dead) {
        car.smoke += dt;
        if (car.smoke > 14 && car !== playerCar) this.cars.splice(i, 1);
      }
    }
  }
}
