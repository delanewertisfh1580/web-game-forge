/**
 * Particles module — particle emitter factories for 2D and 3D.
 */

/**
 * Simple particle emitter config helper for 2D.
 */
export function createParticleEmitter2D(renderer, config = {}) {
  const containerId = renderer.createParticleContainer(config.capacity ?? 500, config);
  let elapsed = 0;
  const emitRate = config.emitRate ?? 50; // particles per second
  let accumulator = 0;

  return {
    containerId,
    update(dt) {
      accumulator += dt;
      const toEmit = Math.floor(accumulator * emitRate);
      accumulator -= toEmit / emitRate;

      for (let i = 0; i < toEmit; i++) {
        renderer.spawnParticle(containerId, {
          x: config.x ?? 400,
          y: config.y ?? 300,
          vx: (config.vx ?? 0) + (Math.random() - 0.5) * (config.vxSpread ?? 100),
          vy: (config.vy ?? -80) + (Math.random() - 0.5) * (config.vySpread ?? 40),
          life: config.life ?? 2,
          gravity: config.gravity ?? 50,
          radius: config.radius ?? 3,
          color: config.color ?? 0xffaa44,
          fadeOut: config.fadeOut !== false,
          scaleStart: config.scaleStart ?? 1,
          scaleEnd: config.scaleEnd ?? 0.2,
        });
      }

      renderer.updateParticles(containerId, dt);
    },
    destroy() {
      renderer.removeParticleContainer(containerId);
    },
  };
}

/**
 * Simple particle emitter config helper for 3D.
 */
export function createParticleEmitter3D(renderer, config = {}) {
  const systemId = renderer.createParticleSystem({
    capacity: config.capacity ?? 1000,
    gravity: config.gravity ?? -2,
    life: config.life ?? 2,
    size: config.size ?? 0.05,
    ...config,
  });

  let accumulator = 0;
  const emitRate = config.emitRate ?? 30;

  return {
    systemId,
    update(dt) {
      accumulator += dt;
      const toEmit = Math.floor(accumulator * emitRate);
      accumulator -= toEmit / emitRate;

      if (toEmit > 0) {
        renderer.emitParticles(systemId, toEmit, {
          x: config.x ?? 0,
          y: config.y ?? 0,
          z: config.z ?? 0,
          spread: config.spread ?? 0.5,
          vx: config.vx ?? 0,
          vy: config.vy ?? 1,
          vz: config.vz ?? 0,
          velocitySpread: config.velocitySpread ?? 1,
          life: config.life ?? 2,
          color: config.color ?? [1, 0.7, 0.3],
          size: config.size ?? 0.05,
        });
      }

      renderer.updateParticles(systemId, dt);
    },
    destroy() {
      renderer.removeParticleSystem(systemId);
    },
  };
}
