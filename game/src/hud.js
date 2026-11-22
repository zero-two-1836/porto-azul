// Porto Azul — the HUD: cash, clock, wanted stars, health and car bars, weapon and
// speed readouts, the objective panel, toasts and banners, and the minimap with its
// blips (player, objective, police, Marina's club, the safehouse).

import { WORLD_W, WORLD_H, SEA_W, SAND_END, AVENUES_X, STREETS_Y } from './config.js';
import { districtAt } from './world.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.els = {
      hud: $('hud'), cash: $('cash'), clock: $('clock'), stars: $('stars'),
      bustWrap: $('bust-wrap'), bustBar: $('bust-bar'),
      objective: $('objective'), objTitle: $('objective-title'), objText: $('objective-text'), objTimer: $('objective-timer'),
      health: $('health-bar'), car: $('car-bar'), weapon: $('weapon-line'), ammo: $('ammo'),
      speedo: $('speedo'), district: $('district'), toast: $('toast'),
      banner: $('banner'), bannerTitle: $('banner-title'), bannerSub: $('banner-sub'),
      prompt: $('prompt'), minimap: $('minimap'),
    };
    this.toastT = 0;
    this.bannerT = 0;
    this.hurtFlash = 0;
    this.mm = this.els.minimap.getContext('2d');
  }

  toast(text) {
    this.els.toast.textContent = text;
    this.els.toast.classList.remove('hidden');
    this.toastT = 3.6;
  }

  banner(title, sub = '') {
    this.els.bannerTitle.textContent = title;
    this.els.bannerSub.textContent = sub;
    this.els.banner.classList.remove('hidden');
    this.bannerT = 2.6;
  }

  update(G, dt) {
    const e = this.els;
    this.toastT -= dt; if (this.toastT <= 0) e.toast.classList.add('hidden');
    this.bannerT -= dt; if (this.bannerT <= 0) e.banner.classList.add('hidden');
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 1.6);

    e.cash.textContent = `$${G.cash}`;
    const mins = Math.floor(G.dayTime * 24 * 60);
    e.clock.textContent = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    let stars = '';
    for (let i = 0; i < 5; i++) stars += `<span class="${i < G.wanted ? '' : 'off'}">★</span>`;
    e.stars.innerHTML = stars;
    if (G.police.bust > 0.02) {
      e.bustWrap.classList.remove('hidden');
      e.bustBar.style.width = `${Math.round(G.police.bust * 100)}%`;
    } else e.bustWrap.classList.add('hidden');

    e.health.style.width = `${Math.max(0, G.player.health)}%`;
    e.car.style.width = `${G.player.car ? Math.max(0, G.player.car.health) : 0}%`;
    if (G.player.car) {
      e.weapon.textContent = `DRIVING — ${G.player.car.spec.kind.toUpperCase()}`;
      e.speedo.classList.remove('hidden');
      e.speedo.textContent = `${Math.round(Math.abs(G.player.car.speed) * 0.45)} km/h`;
    } else {
      e.weapon.innerHTML = G.player.reloadT > 0 ? 'PISTOL · RELOADING' : `PISTOL · <span id="ammo">${G.player.mag}/12</span>`;
      e.speedo.classList.add('hidden');
    }
    e.district.textContent = districtAt(G.player.x, G.player.y);

    const obj = G.missions.currentObjective(G);
    if (obj && G.mode === 'play') {
      e.objective.classList.remove('hidden');
      e.objTitle.textContent = obj.title ?? '';
      e.objText.textContent = obj.label ?? '';
      if (obj.timer != null) {
        e.objTimer.classList.remove('hidden');
        const t = Math.max(0, obj.timer);
        e.objTimer.textContent = `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
      } else e.objTimer.classList.add('hidden');
    } else e.objective.classList.add('hidden');

    if (G.promptText) {
      e.prompt.textContent = G.promptText;
      e.prompt.classList.remove('hidden');
    } else e.prompt.classList.add('hidden');

    this.drawMinimap(G);
  }

  drawMinimap(G) {
    const ctx = this.mm;
    const W = 220, H = 165;
    const sx = W / WORLD_W, sy = H / WORLD_H;
    ctx.fillStyle = '#1b6f9e';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#f2d492';
    ctx.fillRect(SEA_W * sx, 0, (SAND_END - SEA_W) * sx, H);
    ctx.fillStyle = '#58b368';
    ctx.fillRect(SAND_END * sx, 0, W - SAND_END * sx, H);
    ctx.strokeStyle = '#3c414b';
    ctx.lineWidth = 5;
    for (const ax of AVENUES_X) { ctx.beginPath(); ctx.moveTo(ax * sx, 0); ctx.lineTo(ax * sx, H); ctx.stroke(); }
    for (const sy2 of STREETS_Y) { ctx.beginPath(); ctx.moveTo(0, sy2 * sy); ctx.lineTo(W, sy2 * sy); ctx.stroke(); }
    // Police blips flash blue/red.
    const flash = Math.sin(G.time * 7) > 0;
    for (const cop of G.police.cops) {
      if (cop.dead) continue;
      ctx.fillStyle = flash ? '#ff4040' : '#38b6ff';
      ctx.fillRect(cop.x * sx - 2, cop.y * sy - 2, 4, 4);
    }
    // Objective blip.
    const obj = G.missions.currentObjective(G);
    if (obj && obj.x != null) {
      ctx.fillStyle = obj.kind === 'offer' ? '#ff4ecd' : '#ffd23e';
      const pulse = 3 + Math.sin(G.time * 5) * 1.2;
      ctx.save();
      ctx.translate(obj.x * sx, obj.y * sy);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-pulse, -pulse, pulse * 2, pulse * 2);
      ctx.restore();
    }
    // Safehouse blip.
    const sh = G.world.landmarks.safehouse.door;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(sh.x * sx - 2, sh.y * sy - 2, 4, 4);
    // Player arrow.
    ctx.save();
    ctx.translate(G.player.x * sx, G.player.y * sy);
    ctx.rotate(G.player.angle);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}
