/**
 * 2D Renderer — wraps PixiJS v8 Application + ParticleContainer.
 */
import * as PIXI from 'pixi.js';

export class Renderer2D {
  constructor() {
    this.app = null;
    this.particleContainers = new Map();
  }

  async init({ width, height, backgroundColor, mount }) {
    this.app = new PIXI.Application();
    await this.app.init({
      width,
      height,
      backgroundColor: backgroundColor ?? 0x1a1a2e,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    const el = typeof mount === 'string' ? document.querySelector(mount) : mount;
    if (!el) throw new Error(`[Renderer2D] Mount element not found: ${mount}`);
    el.appendChild(this.app.canvas);
    this.app.canvas.style.display = 'block';
    this.app.canvas.style.margin = '0 auto';

    return this.app;
  }

  resize(width, height) {
    if (!this.app) return;
    this.app.renderer.resize(width, height);
  }

  addSprite(texture, options = {}) {
    const sprite = new PIXI.Sprite(texture);
    if (options.x !== undefined) sprite.x = options.x;
    if (options.y !== undefined) sprite.y = options.y;
    if (options.anchor !== undefined) sprite.anchor.set(options.anchor);
    if (options.scale !== undefined) {
      if (typeof options.scale === 'number') sprite.scale.set(options.scale);
      else sprite.scale.set(options.scale.x, options.scale.y);
    }
    this.app.stage.addChild(sprite);
    return sprite;
  }

  async loadSpriteSheet(url, options = {}) {
    const texture = await PIXI.Assets.load(url);
    // In PixiJS v8, sprite sheet data is on texture itself (no baseTexture)
    if (options.animations && texture.animations) {
      return { texture, animations: texture.animations };
    }
    return { texture };
  }

  createParticleContainer(capacity = 1000, options = {}) {
    const container = new PIXI.Container();
    container.label = `particles_${Date.now()}`;
    this.app.stage.addChild(container);
    const id = container.label;
    this.particleContainers.set(id, {
      container,
      capacity,
      particles: [],
      options,
    });
    return id;
  }

  spawnParticle(containerId, config) {
    const data = this.particleContainers.get(containerId);
    if (!data) return null;
    if (data.particles.length >= data.capacity) return null;

    const gfx = new PIXI.Graphics();
    const radius = config.radius ?? 3;
    const color = config.color ?? 0xffffff;
    gfx.circle(0, 0, radius);
    gfx.fill(color);

    gfx.x = config.x ?? 0;
    gfx.y = config.y ?? 0;

    const particle = {
      gfx,
      vx: config.vx ?? 0,
      vy: config.vy ?? 0,
      life: config.life ?? 1,
      maxLife: config.life ?? 1,
      gravity: config.gravity ?? 0,
      fadeOut: config.fadeOut !== false,
      scaleStart: config.scaleStart ?? 1,
      scaleEnd: config.scaleEnd ?? 0,
    };

    data.container.addChild(gfx);
    data.particles.push(particle);
    return particle;
  }

  updateParticles(containerId, dt) {
    const data = this.particleContainers.get(containerId);
    if (!data) return;

    for (let i = data.particles.length - 1; i >= 0; i--) {
      const p = data.particles[i];
      p.life -= dt;

      if (p.life <= 0) {
        data.container.removeChild(p.gfx);
        p.gfx.destroy();
        data.particles.splice(i, 1);
        continue;
      }

      p.vy += p.gravity * dt;
      p.gfx.x += p.vx * dt;
      p.gfx.y += p.vy * dt;

      const t = 1 - p.life / p.maxLife;
      const scale = p.scaleStart + (p.scaleEnd - p.scaleStart) * t;
      p.gfx.scale.set(scale);

      if (p.fadeOut) {
        p.gfx.alpha = p.life / p.maxLife;
      }
    }
  }

  removeParticleContainer(containerId) {
    const data = this.particleContainers.get(containerId);
    if (!data) return;
    for (const p of data.particles) {
      data.container.removeChild(p.gfx);
      p.gfx.destroy();
    }
    this.app.stage.removeChild(data.container);
    data.container.destroy();
    this.particleContainers.delete(containerId);
  }

  destroy() {
    for (const id of [...this.particleContainers.keys()]) {
      this.removeParticleContainer(id);
    }
    if (this.app) {
      // PixiJS v8 destroy signature
      try { this.app.destroy(true); } catch { try { this.app.destroy(); } catch {} }
      this.app = null;
    }
  }
}
