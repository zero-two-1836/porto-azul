// Porto Azul — missions. Marina Vélez, who runs Club Nébula, offers a five-job story
// chain (marked ◆ at the club door): a package run, a borrowed sports car, a police
// escape, a four-corner cash dash and a final ferry run under heavy heat. Between
// story jobs, food stands offer repeatable courier work (marked $). Rewards pay cash;
// timers and a stolen target car can fail a job, which can then be retried.

export class Missions {
  constructor() {
    this.index = 0;
    this.storyDone = false;
    this.courierDone = 0;
    this.active = null;   // { def, stageIdx, timer, targetCar }
    this.courier = null;  // { stage, x, y, reward }
    this.courierStand = 0;
  }

  defs(G) {
    const L = G.world.landmarks;
    return [
      {
        id: 'primera-carrera', title: 'Primera Carrera', reward: 250,
        intro: 'Marina: "A package waits at the lifeguard stand on Playa Serena. Bring it to my club."',
        stages: [
          { type: 'goto', label: 'Pick up the package at the lifeguard stand', x: L.lifeguard.door.x, y: L.lifeguard.door.y, r: 55 },
          { type: 'goto', label: 'Deliver the package to Club Nébula', x: L.club.door.x, y: L.club.door.y, r: 60 },
        ],
      },
      {
        id: 'rueda-prestada', title: 'Rueda Prestada', reward: 600,
        intro: 'Marina: "A coral sports car sits outside Hotel Corallo. Borrow it. The Taller del Puerto is expecting it."',
        stages: [
          { type: 'steal', label: 'Steal the coral sports car at Hotel Corallo' },
          { type: 'deliver', label: 'Deliver the car to Taller del Puerto', x: L.garage.door.x, y: L.garage.door.y, r: 70 },
        ],
      },
      {
        id: 'sirenas', title: 'Sirenas', reward: 900,
        intro: 'Marina: "Collect a case from the marina pier. When the sirens start — and they will — lose them, then come home."',
        stages: [
          { type: 'goto', label: 'Collect the case at the marina pier', x: L.marina.door.x, y: L.marina.door.y, r: 60, arm: 3 },
          { type: 'escape', label: 'Lose the Policía Azul' },
          { type: 'goto', label: 'Reach Casa Lucía, your safehouse', x: L.safehouse.door.x, y: L.safehouse.door.y, r: 65 },
        ],
      },
      {
        id: 'cuatro-esquinas', title: 'Cuatro Esquinas', reward: 1200, timer: 215,
        intro: 'Marina: "Four drops, four corners of my city, one clock. Drive like the tide is coming in."',
        stages: [
          { type: 'goto', label: 'Drop 1 — the lifeguard stand', x: L.lifeguard.door.x, y: L.lifeguard.door.y, r: 60 },
          { type: 'goto', label: 'Drop 2 — Hospital San Marisol', x: L.hospital.door.x, y: L.hospital.door.y, r: 65 },
          { type: 'goto', label: 'Drop 3 — Club Nébula', x: L.club.door.x, y: L.club.door.y, r: 60 },
          { type: 'goto', label: 'Drop 4 — the marina pier', x: L.marina.door.x, y: L.marina.door.y, r: 60 },
        ],
      },
      {
        id: 'la-ultima-ola', title: 'La Última Ola', reward: 2500, timer: 165,
        intro: 'Marina: "Tonight I leave Porto Azul. Get me to the Puerto Sur ferry — every patrol in the city will try to stop us."',
        stages: [
          { type: 'goto', label: 'Pick up Marina at Club Nébula', x: L.club.door.x, y: L.club.door.y, r: 60, arm: 4 },
          { type: 'goto', label: 'Drive Marina to the ferry pier, Puerto Sur', x: 330, y: 2100, r: 75 },
        ],
      },
    ];
  }

  offerPoint(G) {
    if (this.active || this.storyDone) return null;
    const d = G.world.landmarks.club.door;
    return { x: d.x, y: d.y, kind: 'story', label: 'Talk to Marina (E)' };
  }

  courierPoint(G) {
    if (this.active || this.courier || this.index < 1) return null;
    const stand = G.world.foodStands[this.courierStand % G.world.foodStands.length];
    return { x: stand.x, y: stand.y, kind: 'courier', label: `Courier job at ${stand.name} (E)` };
  }

  currentObjective(G) {
    if (this.active) {
      const stage = this.active.def.stages[this.active.stageIdx];
      const o = { ...stage, title: this.active.def.title, kind: 'stage' };
      if (stage.type === 'steal' && this.active.targetCar) { o.x = this.active.targetCar.x; o.y = this.active.targetCar.y; }
      if (stage.type === 'escape') { o.x = null; o.label = stage.label; }
      if (this.active.def.timer) o.timer = this.active.timer;
      return o;
    }
    if (this.courier) {
      return {
        title: 'Reparto Exprés', kind: 'courier', x: this.courier.x, y: this.courier.y,
        label: this.courier.stage === 'pickup' ? 'Pick up the delivery' : 'Drop off the delivery',
      };
    }
    const offer = this.offerPoint(G);
    if (offer) return { title: 'Marina Vélez', kind: 'offer', x: offer.x, y: offer.y, label: 'New job at Club Nébula' };
    const cp = this.courierPoint(G);
    if (cp) return { title: 'Reparto Exprés', kind: 'courierOffer', x: cp.x, y: cp.y, label: 'Courier work available' };
    return null;
  }

  interact(G) {
    const offer = this.offerPoint(G);
    if (offer && Math.hypot(G.player.x - offer.x, G.player.y - offer.y) < 70 && !G.player.car) {
      this.startStory(G);
      return true;
    }
    const cp = this.courierPoint(G);
    if (cp && Math.hypot(G.player.x - cp.x, G.player.y - cp.y) < 60 && !G.player.car) {
      this.startCourier(G);
      return true;
    }
    return false;
  }

  startStory(G) {
    const def = this.defs(G)[this.index];
    this.active = { def, stageIdx: 0, timer: def.timer ?? 0, targetCar: null };
    if (def.id === 'rueda-prestada') {
      this.active.targetCar = G.traffic.spawnParked(3030, 462, 0, 'sport', '#ff7b3e');
    }
    G.hud.banner(def.title, 'A new job from Marina Vélez');
    G.hud.toast(def.intro);
    G.audio.jingle(true);
  }

  startCourier(G) {
    const spots = [
      G.world.landmarks.hotel.door, G.world.landmarks.hospital.door,
      G.world.landmarks.garage.door, G.world.landmarks.marina.door,
      G.world.landmarks.lifeguard.door, G.world.landmarks.club.door,
    ];
    const stand = G.world.foodStands[this.courierStand % G.world.foodStands.length];
    const drop = spots[G.rng.int(0, spots.length - 1)];
    this.courier = { stage: 'pickup', x: stand.x, y: stand.y, dropX: drop.x, dropY: drop.y, reward: 0 };
    this.courier.reward = 90 + Math.round(Math.hypot(drop.x - stand.x, drop.y - stand.y) / 14);
    G.hud.toast(`Reparto Exprés: pick up at ${stand.name}, deliver across town — $${this.courier.reward}`);
    G.audio.blip(760, 0.1, 'square', 0.12);
  }

  fail(G, why) {
    G.hud.banner('JOB FAILED', why);
    G.audio.jingle(false);
    if (this.active?.targetCar && this.active.targetCar.driver === 'parked') G.traffic.removeCar(this.active.targetCar);
    this.active = null;
    this.courier = null;
  }

  completeStage(G) {
    const a = this.active;
    const stage = a.def.stages[a.stageIdx];
    if (stage.arm) {
      G.police.setWanted(G, stage.arm);
      G.hud.toast('Sirens! The Policía Azul are on you');
    }
    G.audio.cash();
    a.stageIdx++;
    if (a.stageIdx >= a.def.stages.length) {
      G.cash += a.def.reward;
      G.hud.banner('JOB DONE', `${a.def.title} — +$${a.def.reward}`);
      G.audio.jingle(true);
      this.active = null;
      this.index++;
      if (this.index >= this.defs(G).length) {
        this.storyDone = true;
        setTimeout(() => G.hud.banner('PORTO AZUL IS YOURS', 'Marina is gone, but the city — and the courier work — remain.'), 2600);
      }
    }
  }

  update(G, dt) {
    if (this.active) {
      const a = this.active;
      if (a.def.timer) {
        a.timer -= dt;
        if (a.timer <= 0) { this.fail(G, 'Out of time. Marina is not pleased.'); return; }
      }
      if (a.targetCar && a.targetCar.dead) { this.fail(G, 'The coral sports car is wrecked.'); return; }
      const stage = a.def.stages[a.stageIdx];
      const px = G.player.x, py = G.player.y;
      if (stage.type === 'goto') {
        if (Math.hypot(px - stage.x, py - stage.y) < stage.r) this.completeStage(G);
      } else if (stage.type === 'steal') {
        if (a.targetCar && G.player.car === a.targetCar) this.completeStage(G);
      } else if (stage.type === 'deliver') {
        if (G.player.car === a.targetCar && Math.hypot(px - stage.x, py - stage.y) < stage.r) {
          G.traffic.removeCar(a.targetCar);
          G.player.car = null;
          G.player.x = stage.x; G.player.y = stage.y + 40;
          this.completeStage(G);
        }
      } else if (stage.type === 'escape') {
        if (G.wanted === 0) this.completeStage(G);
      }
      return;
    }
    if (this.courier) {
      const c = this.courier;
      if (Math.hypot(G.player.x - c.x, G.player.y - c.y) < 60) {
        if (c.stage === 'pickup') {
          c.stage = 'deliver'; c.x = c.dropX; c.y = c.dropY;
          G.audio.cash();
          G.hud.toast('Package on board — deliver it across town');
        } else {
          G.cash += c.reward;
          this.courierDone++;
          this.courierStand++;
          G.hud.banner('DELIVERED', `Reparto Exprés — +$${c.reward}`);
          G.audio.jingle(true);
          this.courier = null;
        }
      }
    }
  }
}
