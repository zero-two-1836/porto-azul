// Porto Azul — keyboard and mouse state. One shared object the rest of the game polls;
// also collects one-shot key presses (E to interact, P to pause) so menus feel responsive.

export class Input {
  constructor(canvas) {
    this.down = new Set();
    this.pressed = new Set();
    this.mouse = { x: 0, y: 0, down: false, clicked: false };
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => { this.down.clear(); this.mouse.down = false; });
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
      this.mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouse.down = true; this.mouse.clicked = true; }
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouse.down = false; });
  }

  held(...codes) { return codes.some((c) => this.down.has(c)); }
  tapped(...codes) { return codes.some((c) => this.pressed.has(c)); }

  // Movement axes in screen space, from WASD or the arrow keys.
  axes() {
    const x = (this.held('KeyD', 'ArrowRight') ? 1 : 0) - (this.held('KeyA', 'ArrowLeft') ? 1 : 0);
    const y = (this.held('KeyS', 'ArrowDown') ? 1 : 0) - (this.held('KeyW', 'ArrowUp') ? 1 : 0);
    return { x, y };
  }

  // Called at the end of every frame so a press counts exactly once.
  endFrame() {
    this.pressed.clear();
    this.mouse.clicked = false;
  }
}
