[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/zero-two-1836/porto-azul/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/zero-two-1836/porto-azul/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Porto Azul

Porto Azul is a top-down 2D open-world crime game set in the fictional city of Porto Azul, in the state of Marisol. The world is 3840×2560, shown on a 1280×800 canvas: a beach and boardwalk along the west shore, a drivable grid of avenues and streets, and the Puerto Sur docks in the south. Everything is drawn and composed by the game's own code — no assets from any commercial game.

## The city

- **On foot and behind the wheel** — walk the streets or drive, with per-kind car physics (top speed, acceleration, grip and health differ by vehicle kind).
- **Live traffic** — cars follow a road graph through the avenue grid, and pedestrians stroll the sidewalks and flee when danger breaks out near them.
- **Stealable cars** — pull up to a parked or slow car and take it; its driver may not thank you.
- **Five-star wanted system** — crimes witnessed by pedestrians get phoned in to the Policía Azul. The pursuit fleet grows with your stars, a bust meter fills while officers hold you in reach, and your wanted level decays once you break line of sight and stay out of trouble.
- **Mouse-aim combat** — punch whoever is close enough to hit, or fire your pistol toward the cursor.
- **Work** — a five-job story chain for Marina Vélez of Club Nébula, plus repeatable courier jobs once the story is done.
- **Services** — rest and save at the Casa Lucía safehouse, repair your ride at the Taller del Puerto garage, recover at the hospital, and eat at food stands to restore health.
- **Day and night** — a full day-night cycle rolls over the city, with lit windows after dark and headlight cones on cars at night.
- **HUD and sound** — a minimap with your position and objectives, cash/health/wanted readouts, and fully synthesized WebAudio sound (no audio files). Progress saves to localStorage.

## How to play

Open `game/index.html` in a desktop browser — the game is plain static files and runs offline. Or serve the repo root with `node serve.ts` and open http://localhost:8080.

To produce the submission dossier instead, run `node main.ts` (Node 22, standard library only). Outside the grader's container, point it at a local folder: `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts`. It copies `game/` and `screenshots/` to the output and writes `dossier.json`.

## Controls

- **WASD / arrow keys** — move on foot; in a car, W/S accelerate and reverse, A/D steer
- **Shift** — sprint on foot; handbrake in a car
- **E** — interact: enter/exit cars, take jobs, use the garage, food stands and the safehouse
- **Mouse** — aim; **left click** — attack (punch up close, otherwise shoot)
- **P / Esc** — pause · **M** — mute · **Enter** — start from the title screen

## Layout

- `main.ts` — dossier entry point: packages the game and writes `dossier.json`
- `game/` — the game itself: `index.html`, `style.css`, and ES modules under `src/` (world, traffic, pedestrians, police, player, missions, HUD, render, audio, save)
- `screenshots/` — captures from the running game
- `serve.ts` — tiny local static server for playing from the repo root
- `vendor/` — the vendored make.fun library used by the dossier builder
