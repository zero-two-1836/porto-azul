// Porto Azul — screenshot staging. The ?shot=<name> scenes the maker's shots.json
// points at: each one arranges a real, playable moment of the game (never a mock-up)
// and lets the live simulation run, so the capture shows the game as it truly looks.

function givePlayerCar(G, x, y, angle, kindName, color, speed) {
  const car = G.traffic.makeCar(x, y, angle, 'player');
  car.spec = kindName === 'sport'
    ? { kind: 'sport', w: 36, l: 70, top: 520, accel: 360 }
    : { kind: 'sedan', w: 36, l: 72, top: 380, accel: 260 };
  car.color = color;
  car.speed = speed;
  car.driver = 'player';
  G.traffic.cars.push(car);
  G.player.car = car;
  G.player.x = x; G.player.y = y; G.player.angle = angle;
  return car;
}

function placeCivCar(G, car, x, y, angle, speed) {
  car.x = x; car.y = y; car.angle = angle; car.speed = speed;
  car.driver = 'civ';
  // Point its route at the nearest graph node so it keeps driving plausibly.
  let best = null, bd = 1e12;
  for (const n of G.traffic.nodes) {
    const d = Math.hypot(n.x - x, n.y - y);
    if (d < bd) { bd = d; best = n; }
  }
  car.to = best;
  car.from = best.next[0] ?? best;
}

export function stageShot(G, name) {
  const P = G.player;
  if (name === 'cover') {
    G.dayTime = 0.71; // golden hour over Altos del Faro
    // Mid-block on the avenue, lanes separated, traffic spaced so nothing piles up:
    // the player cruises south with the flow while a car comes the other way.
    givePlayerCar(G, 2830, 300, Math.PI / 2, 'sport', '#ff7b3e', 235);
    G.__cruise = true;
    const civs = G.traffic.cars.filter((c) => c.driver === 'civ');
    if (civs[0]) placeCivCar(G, civs[0], 2830, 565, Math.PI / 2, 150);
    if (civs[1]) placeCivCar(G, civs[1], 2770, 720, -Math.PI / 2, 150);
    if (civs[2]) placeCivCar(G, civs[2], 2830, 110, Math.PI / 2, 205);
    if (civs[3]) placeCivCar(G, civs[3], 2770, 240, -Math.PI / 2, 170);
  } else if (name === 'mission') {
    G.dayTime = 0.44;
    P.x = 1752; P.y = 806; P.angle = 0.5;
    G.missions.startStory(G);
    G.missions.completeStage(G); // package in hand — now deliver it to the club
    G.hud.toast('Package collected — take it to Club Nébula');
  } else if (name === 'chase') {
    G.dayTime = 0.93; // night pursuit down the east avenue, cops in a V behind the player
    givePlayerCar(G, 3470, 700, Math.PI / 2, 'sedan', '#c0c6ce', 380);
    G.__cruise = true;
    G.__holdBust = true;
    G.police.setWanted(G, 4);
    const spots = [[3470, 300, Math.PI / 2, 190], [3410, 225, Math.PI / 2 + 0.12, 190], [3532, 365, Math.PI / 2 - 0.18, 200]];
    for (const [x, y, a, s] of spots) {
      const cop = G.police.spawnCop(G);
      cop.x = x; cop.y = y; cop.angle = a; cop.speed = s;
    }
    G.police.bust = 0.35;
  } else if (name === 'beach') {
    G.dayTime = 0.4; // bright morning on Playa Serena
    P.x = 428; P.y = 852; P.angle = -0.7;
    const near = G.peds.peds.slice(0, 7);
    const spots = [[392, 800], [452, 905], [505, 845], [368, 905], [520, 960], [410, 985], [478, 790]];
    near.forEach((ped, i) => {
      ped.x = spots[i][0]; ped.y = spots[i][1];
      ped.tx = spots[i][0]; ped.ty = spots[i][1] + 30;
      ped.state = 'walk';
    });
  }
  G.camera.x = Math.max(0, Math.min(3840 - 1280, G.player.x - 640));
  G.camera.y = Math.max(0, Math.min(2560 - 800, G.player.y - 400));
}
