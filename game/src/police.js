// Porto Azul — the Policía Azul. Wanted stars rise when crimes are witnessed (or
// reported a few seconds later), cop cars pour in from the station and the map edges,
// chase and ram the player, shoot at three stars and up, and hold the player still to
// fill the bust meter. Break line of sight long enough and the heat cools, star by star.

import { WORLD_W, WORLD_H, CAR_KINDS } from './config.js';
import { lineOfSight, collideCircle } from './world.js';

const COP_SPEC = CAR_KINDS[1]; // sedan shape, police paint
const WANTED_COPS = [0, 2, 3, 4, 6, 8];
const CRIME_STARS = { steal: 1, hitPed: 2, hitCop: 1, shoot: 1, shotPed: 2, copDown: 2, punch: 1, mission: 0 };

export class Police {
  constructor() {
    this.cops = [];
    this.hideTimer = 0;      // time since any cop last saw the player
    this.reportTimer = -1;   // a phoned-in crime lands when this runs out
    this.reportStars = 0;
    this.bust = 0;           // 0..1 bust meter
    this.shotCd = 0;
  }

  commitCrime(G, kind, x, y) {
    const stars = CRIME_STARS[kind] ?? 1;
    if (stars <= 0) return;
    const witnessed = this.cops.some((c) => Math.hypot(c.x - x, c.y - y) < 460)
      || G.peds.peds.some((p) => p.state !== 'down' && Math.hypot(p.x - x, p.y - y) < 250 && lineOfSight(G.world, p.x, p.y, x, y));
    if (witnessed) {
      this.raiseWanted(G, stars);
    } else if (this.reportTimer < 0) {
      this.reportTimer = 5;
      this.reportStars = stars;
    }
  }

  raiseWanted(G, stars) {
    const before = G.wanted;
    G.wanted = Math.min(5, G.wanted + stars);
    if (G.wanted > before) G.hud.toast(`Wanted level ${G.wanted} — la Policía Azul viene`);
  }

  setWanted(G, stars) { G.wanted = Math.max(0, Math.min(5, stars)); }

  spawnCop(G) {
    const station = G.world.landmarks.station.door;
    const fromStation = this.cops.length < 2;
    const x = fromStation ? station.x : (G.rng.chance(0.5) ? G.player.x - 900 : G.player.x + 900);
    const y = fromStation ? station.y + 60 : Math.max(80, Math.min(WORLD_H - 80, G.player.y + G.rng.range(-500, 500)));
    const cop = {
      x: Math.max(60, Math.min(WORLD_W - 60, x)), y, angle: 0, speed: 0,
      spec: COP_SPEC, color: '#274156', health: 100, driver: 'cop',
      from: null, to: null, cruise: 430, honkT: 0, dead: false, smoke: 0, cop: true,
    };
    this.cops.push(cop);
    G.traffic.cars.push(cop);
    return cop;
  }

  update(G, dt) {
    // Phoned-in crimes land a few seconds after the act.
    if (this.reportTimer > 0) {
      this.reportTimer -= dt;
      if (this.reportTimer <= 0) { this.raiseWanted(G, this.reportStars); this.reportStars = 0; }
    }
    // Keep the fleet at the size the wanted level calls for.
    const want = WANTED_COPS[G.wanted] || 0;
    if (this.cops.length < want) this.spawnCop(G);
    if (G.wanted === 0) {
      for (const cop of this.cops) G.traffic.removeCar(cop);
      this.cops = [];
      this.bust = 0;
    }

    const px = G.player.car ? G.player.car.x : G.player.x;
    const py = G.player.car ? G.player.car.y : G.player.y;
    let anySee = false;
    let holders = 0;

    for (const cop of this.cops) {
      if (cop.dead) continue;
      const dx = px - cop.x, dy = py - cop.y;
      const dist = Math.hypot(dx, dy);
      const sees = dist < 560 && lineOfSight(G.world, cop.x, cop.y, px, py);
      if (sees) anySee = true;
      // Pursuit steering: aim at the player, lead a fast car a little.
      const lead = G.player.car ? Math.min(0.55, dist / 900) : 0;
      const tx = px + (G.player.car ? Math.cos(G.player.car.angle) * G.player.car.speed * lead : 0);
      const ty = py + (G.player.car ? Math.sin(G.player.car.angle) * G.player.car.speed * lead : 0);
      const targetAngle = Math.atan2(ty - cop.y, tx - cop.x);
      let turn = targetAngle - cop.angle;
      while (turn > Math.PI) turn -= Math.PI * 2;
      while (turn < -Math.PI) turn += Math.PI * 2;
      cop.angle += Math.max(-2.8 * dt, Math.min(2.8 * dt, turn));
      const top = G.wanted >= 4 ? 480 : 435;
      let want2 = dist > 46 ? top : 0;
      cop.speed += Math.max(-420 * dt, Math.min(300 * dt, want2 - cop.speed));
      let nx = cop.x + Math.cos(cop.angle) * cop.speed * dt;
      let ny = cop.y + Math.sin(cop.angle) * cop.speed * dt;
      const fixed = collideCircle(G.world, nx, ny, 20);
      if (Math.abs(fixed.x - nx) > 0.5 || Math.abs(fixed.y - ny) > 0.5) cop.speed *= 0.55;
      cop.x = fixed.x; cop.y = fixed.y;
      // Holding range: a cop close to a slow player builds the bust.
      const playerSpeed = G.player.car ? Math.abs(G.player.car.speed) : G.player.speedNow;
      if (dist < 120 && playerSpeed < 42) holders++;
      // Shooting: three stars and up, on foot, in range and in sight.
      if (G.wanted >= 3 && !G.player.car && dist < 380 && sees && this.shotCd <= 0) {
        this.shotCd = 0.55;
        G.player.damage(G, 5, cop.x, cop.y);
        G.addTracer(cop.x, cop.y, G.player.x, G.player.y, '#ffd23e');
        G.audio.shot();
      }
    }
    this.shotCd -= dt;

    // Bust meter and wanted decay.
    if (holders > 0 && G.wanted > 0) {
      this.bust = Math.min(1, this.bust + dt / 2.6);
      if (this.bust >= 1) { G.onBusted(); this.bust = 0; }
    } else {
      this.bust = Math.max(0, this.bust - dt / 1.4);
    }
    if (anySee) this.hideTimer = 0;
    else if (G.wanted > 0) {
      this.hideTimer += dt;
      const need = 7 + G.wanted * 1.5;
      if (this.hideTimer > need) {
        this.hideTimer = 0;
        G.wanted -= 1;
        if (G.wanted === 0) G.hud.toast('You lost the police. Lay low.');
        else G.hud.toast(`Heat cooling — ${G.wanted} star${G.wanted > 1 ? 's' : ''} left`);
      }
    }
    // Sirens sound while any live cop is near.
    const near = this.cops.some((c) => !c.dead && Math.hypot(c.x - px, c.y - py) < 620);
    G.audio.setSiren(near && G.wanted > 0, Math.sin(G.time * 6) * 0.5 + 0.5);
  }
}
