// Porto Azul — pedestrians. People stroll the sidewalks, the boardwalk and the beach,
// wander between waypoints on those paths, run from danger, and fall when hit or shot.

import { AVENUES_X, STREETS_Y, ROAD_HALF, BOARDWALK_END, WORLD_H, PED_SHIRTS, PED_PANTS } from './config.js';
import { collideCircle } from './world.js';

function sidewalkPoints(rng) {
  const pts = [];
  for (const ax of AVENUES_X) for (const off of [-1, 1]) pts.push({ axis: 'v', at: ax + off * (ROAD_HALF + 16) });
  for (const sy of STREETS_Y) for (const off of [-1, 1]) pts.push({ axis: 'h', at: sy + off * (ROAD_HALF + 16) });
  pts.push({ axis: 'v', at: BOARDWALK_END - 40 });
  return pts;
}

export class Pedestrians {
  constructor(world, rng) {
    this.peds = [];
    this.lines = sidewalkPoints(rng);
    for (let i = 0; i < 64; i++) this.peds.push(this.spawn(rng));
  }

  spawn(rng, atX, atY) {
    const line = rng.pick(this.lines);
    const along = rng.range(90, WORLD_H - 90);
    const ped = {
      x: atX ?? (line.axis === 'v' ? line.at : rng.range(600, 3700)),
      y: atY ?? (line.axis === 'v' ? along : line.at),
      tx: 0, ty: 0, angle: rng.range(0, Math.PI * 2),
      speed: rng.range(38, 62), walk: rng.range(0, 6),
      shirt: rng.pick(PED_SHIRTS), pants: rng.pick(PED_PANTS),
      state: 'walk', stateT: 0, line,
    };
    this.retarget(rng, ped);
    return ped;
  }

  retarget(rng, ped) {
    // Walk up or down the same sidewalk line; sometimes cross to a beach stroll.
    const dist = rng.range(120, 520) * rng.sign();
    if (ped.line.axis === 'v') { ped.tx = ped.line.at; ped.ty = Math.max(50, Math.min(WORLD_H - 50, ped.y + dist)); }
    else { ped.ty = ped.line.at; ped.tx = Math.max(600, Math.min(3760, ped.x + dist)); }
  }

  update(G, dt) {
    for (const ped of this.peds) {
      if (ped.state === 'down') {
        ped.stateT -= dt;
        if (ped.stateT <= 0) { ped.state = 'walk'; this.retarget(G.rng, ped); }
        continue;
      }
      let tx = ped.tx, ty = ped.ty, speed = ped.speed;
      const danger = G.danger;
      if (danger && G.time - danger.t < 2.2) {
        const d = Math.hypot(ped.x - danger.x, ped.y - danger.y);
        if (d < 300) {
          ped.state = 'flee';
          tx = ped.x + (ped.x - danger.x) * 2;
          ty = ped.y + (ped.y - danger.y) * 2;
          speed = 175;
        }
      } else if (ped.state === 'flee') ped.state = 'walk';
      const dx = tx - ped.x, dy = ty - ped.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 8) { this.retarget(G.rng, ped); continue; }
      ped.angle = Math.atan2(dy, dx);
      ped.walk += dt * (speed / 14);
      const nx = ped.x + Math.cos(ped.angle) * speed * dt;
      const ny = ped.y + Math.sin(ped.angle) * speed * dt;
      const fixed = collideCircle(G.world, nx, ny, 11);
      ped.x = fixed.x; ped.y = fixed.y;
    }
    // Keep the streets lively: top the crowd back up away from the player's view.
    if (this.peds.length < 64 && G.rng.chance(0.02)) {
      const ped = this.spawn(G.rng);
      if (Math.hypot(ped.x - G.player.x, ped.y - G.player.y) > 700) this.peds.push(ped);
    }
  }

  knockDown(ped) {
    ped.state = 'down';
    ped.stateT = 7;
  }
}
