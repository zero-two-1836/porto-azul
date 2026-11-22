// Porto Azul — the player: walking and sprinting on foot, stealing and driving cars,
// punching and shooting with mouse aim, taking damage, and the bust/down outcomes.

import { collideCircle, circleHitsBuilding, isSand } from './world.js';
import { SEA_W } from './config.js';

export class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.angle = -Math.PI / 2;
    this.speedNow = 0;
    this.health = 100;
    this.car = null;
    this.walkPhase = 0;
    this.punchCd = 0;
    this.shootCd = 0;
    this.mag = 12;
    this.reloadT = 0;
    this.lastHurtT = -99;
    this.crashCrimeCd = 0;
  }

  damage(G, amount, fromX, fromY) {
    if (G.mode !== 'play') return;
    this.health -= amount;
    this.lastHurtT = G.time;
    G.hud.hurtFlash = 1;
    G.audio.hurt();
    if (this.health <= 0) {
      this.health = 0;
      G.onDowned();
    }
  }

  // --- cars ------------------------------------------------------------------

  nearestCar(G, maxDist) {
    let best = null, bestD = maxDist;
    for (const car of G.traffic.cars) {
      if (car.dead) continue;
      const d = Math.hypot(car.x - this.x, car.y - this.y);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  enterCar(G, car) {
    if (car.driver === 'civ') {
      // Yank the driver out: they land beside the car and run.
      const ped = G.peds.spawn(G.rng, car.x + 30, car.y + 10);
      ped.state = 'flee';
      G.peds.peds.push(ped);
      car.speed = 0;
    }
    if (car.cop) {
      const i = G.police.cops.indexOf(car);
      if (i >= 0) G.police.cops.splice(i, 1);
      car.cop = false;
      G.police.raiseWanted(G, 1);
    }
    G.police.commitCrime(G, 'steal', car.x, car.y);
    car.driver = 'player';
    this.car = car;
    G.audio.blip(520, 0.08, 'square', 0.1);
  }

  exitCar(G) {
    const car = this.car;
    if (!car) return;
    car.driver = car.driver === 'player' ? 'parked' : car.driver;
    car.speed = 0;
    this.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
    this.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
    const fixed = collideCircle(G.world, this.x, this.y, 13);
    this.x = fixed.x; this.y = fixed.y;
    this.car = null;
    G.audio.setEngine(false, 0);
  }

  driveUpdate(G, dt) {
    const car = this.car;
    const input = G.input;
    const spec = car.spec;
    const surface = isSand(car.x) ? 0.55 : 1;
    const fwd = input.held('KeyW', 'ArrowUp');
    const back = input.held('KeyS', 'ArrowDown');
    const hand = input.held('ShiftLeft', 'ShiftRight');
    if (fwd) car.speed += spec.accel * surface * dt;
    else if (back) car.speed -= (car.speed > 10 ? 380 : 150) * dt;
    else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 46 * dt);
    if (hand) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 260 * dt);
    const top = spec.top * surface;
    car.speed = Math.max(-150, Math.min(top, car.speed));
    const steer = (input.held('KeyA', 'ArrowLeft') ? -1 : 0) + (input.held('KeyD', 'ArrowRight') ? 1 : 0);
    if (steer !== 0 && Math.abs(car.speed) > 4) {
      const rate = (hand ? 2.5 : 1.85) * Math.min(1, Math.abs(car.speed) / 150);
      car.angle += steer * rate * dt * Math.sign(car.speed);
    }
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const fixed = collideCircle(G.world, nx, ny, 22);
    if (Math.abs(fixed.x - nx) > 0.6 || Math.abs(fixed.y - ny) > 0.6) {
      const impact = Math.abs(car.speed);
      if (impact > 130) { this.hurtCar(G, car, (impact - 110) / 22); G.audio.crash(); G.addSparks(car.x, car.y, 10); }
      car.speed *= -0.22;
    }
    car.x = fixed.x; car.y = fixed.y;
    this.x = car.x; this.y = car.y;
    this.angle = car.angle;
    this.speedNow = Math.abs(car.speed);
    // Running over pedestrians and clipping other cars.
    for (const ped of G.peds.peds) {
      if (ped.state === 'down') continue;
      if (Math.hypot(ped.x - car.x, ped.y - car.y) < 26 && Math.abs(car.speed) > 30) {
        G.peds.knockDown(ped);
        G.police.commitCrime(G, 'hitPed', ped.x, ped.y);
        G.audio.crash();
        this.hurtCar(G, car, 3);
      }
    }
    for (const other of G.traffic.cars) {
      if (other === car) continue;
      const d = Math.hypot(other.x - car.x, other.y - car.y);
      if (d < 40 && d > 0.01) {
        const push = (40 - d) / 2;
        const ux = (car.x - other.x) / d, uy = (car.y - other.y) / d;
        car.x += ux * push; car.y += uy * push;
        other.x -= ux * push; other.y -= uy * push;
        if (Math.abs(car.speed) > 60) {
          this.hurtCar(G, car, 4); this.hurtCar(G, other, 6);
          G.addSparks((car.x + other.x) / 2, (car.y + other.y) / 2, 8);
          G.audio.crash();
          if (other.cop && this.crashCrimeCd <= 0) {
            this.crashCrimeCd = 2;
            G.police.commitCrime(G, 'hitCop', car.x, car.y);
          }
          car.speed *= 0.45;
        }
      }
    }
    this.crashCrimeCd -= dt;
    G.audio.setEngine(true, Math.abs(car.speed) / spec.top);
  }

  hurtCar(G, car, amount) {
    car.health -= amount;
    if (car.health <= 0 && !car.dead) {
      car.dead = true;
      car.health = 0;
      G.addSmoke(car.x, car.y, 16);
      if (car.cop) G.police.commitCrime(G, 'copDown', car.x, car.y);
      if (this.car === car) G.hud.toast('Engine dead — get out and find another ride');
    }
  }

  // --- on foot ---------------------------------------------------------------

  footUpdate(G, dt) {
    const input = G.input;
    const ax = input.axes();
    const sprint = input.held('ShiftLeft', 'ShiftRight');
    const speed = sprint ? 262 : 168;
    if (ax.x !== 0 || ax.y !== 0) {
      const len = Math.hypot(ax.x, ax.y);
      const vx = (ax.x / len) * speed, vy = (ax.y / len) * speed;
      const fixed = collideCircle(G.world, this.x + vx * dt, this.y + vy * dt, 13);
      this.x = fixed.x; this.y = fixed.y;
      this.speedNow = speed;
      this.walkPhase += dt * (sprint ? 13 : 10);
      if (!input.mouse.down) this.angle = Math.atan2(vy, vx);
    } else {
      this.speedNow = 0;
    }
    // Face the mouse while shooting or aiming.
    if (input.mouse.down || this.shootCd > 0.12) {
      const mw = G.screenToWorld(input.mouse.x, input.mouse.y);
      this.angle = Math.atan2(mw.y - this.y, mw.x - this.x);
    }
    this.punchCd -= dt;
    this.shootCd -= dt;
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) this.mag = 12;
    }
    if (input.mouse.clicked) this.attack(G);
    // Slow health regen up to half after a quiet spell.
    if (G.time - this.lastHurtT > 10 && this.health > 0 && this.health < 50) {
      this.health = Math.min(50, this.health + 2.2 * dt);
    }
  }

  attack(G) {
    if (this.car || G.mode !== 'play') return;
    // Punch first if somebody is close enough to hit.
    for (const ped of G.peds.peds) {
      if (ped.state !== 'down' && Math.hypot(ped.x - this.x, ped.y - this.y) < 42) {
        G.peds.knockDown(ped);
        G.police.commitCrime(G, 'punch', ped.x, ped.y);
        G.audio.punch();
        this.punchCd = 0.3;
        return;
      }
    }
    if (this.reloadT > 0) return;
    if (this.mag <= 0) { this.reloadT = 1.15; G.audio.blip(220, 0.06, 'square', 0.08); return; }
    this.mag--;
    this.shootCd = 0.22;
    G.audio.shot();
    G.danger = { x: this.x, y: this.y, t: G.time };
    G.addMuzzle(this.x + Math.cos(this.angle) * 20, this.y + Math.sin(this.angle) * 20);
    const step = 9;
    const range = 660;
    let hx = this.x + Math.cos(this.angle) * range;
    let hy = this.y + Math.sin(this.angle) * range;
    for (let d = step; d < range; d += step) {
      const x = this.x + Math.cos(this.angle) * d;
      const y = this.y + Math.sin(this.angle) * d;
      if (circleHitsBuilding(G.world, x, y, 4)) { hx = x; hy = y; break; }
      let hit = false;
      for (const ped of G.peds.peds) {
        if (ped.state !== 'down' && Math.hypot(ped.x - x, ped.y - y) < 15) {
          G.peds.knockDown(ped);
          G.police.commitCrime(G, 'shotPed', ped.x, ped.y);
          hx = ped.x; hy = ped.y; hit = true; break;
        }
      }
      if (hit) break;
      for (const car of G.traffic.cars) {
        if (Math.hypot(car.x - x, car.y - y) < car.spec.l / 2.4) {
          this.hurtCar(G, car, 13);
          G.addSparks(x, y, 5);
          if (car.cop) G.police.commitCrime(G, 'shoot', x, y);
          hx = x; hy = y; hit = true; break;
        }
      }
      if (hit) break;
    }
    G.addTracer(this.x + Math.cos(this.angle) * 22, this.y + Math.sin(this.angle) * 22, hx, hy, '#ffe95e');
  }
}
