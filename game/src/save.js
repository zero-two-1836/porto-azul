// Porto Azul — local saving. The whole game state that matters (cash, story progress,
// position, health) goes to localStorage; Continue on the title screen picks it up.

import { SAVE_KEY } from './config.js';

export function saveGame(G) {
  try {
    const data = {
      cash: G.cash,
      missionIndex: G.missions.index,
      storyDone: G.missions.storyDone,
      courierDone: G.missions.courierDone,
      x: Math.round(G.player.x), y: Math.round(G.player.y),
      health: Math.round(G.player.health),
      playSeconds: Math.round(G.playSeconds),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number' || typeof data.x !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* private mode */ }
}
