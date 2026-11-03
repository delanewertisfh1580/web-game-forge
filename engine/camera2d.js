/**
 * camera2d.js — 2D camera with follow, clamp, shake, zoom.
 * @module camera2d
 */

/**
 * Create a 2D camera.
 * @param {object} [options]
 * @returns {Camera2D}
 */
export function createCamera2D(options = {}) {
  const cam = {
    x: options.x ?? 0,
    y: options.y ?? 0,
    zoom: options.zoom ?? 1,
    targetX: options.x ?? 0,
    targetY: options.y ?? 0,
    lerp: options.lerp ?? 0.1,
    deadzone: options.deadzone ?? 0,
    followTarget: null,
    bounds: null, // { x, y, w, h }
    shakeDuration: 0,
    shakeIntensity: 0,
    shakeOffsetX: 0,
    shakeOffsetY: 0,
    _zoomTween: null,
  };

  return {
    /** Current camera position */
    get x() { return cam.x + cam.shakeOffsetX; },
    get y() { return cam.y + cam.shakeOffsetY; },
    get zoom() { return cam.zoom; },

    /** Set position directly */
    setPosition(x, y) {
      cam.x = x; cam.y = y;
      cam.targetX = x; cam.targetY = y;
    },

    /**
     * Follow a target object with {x, y}.
     * @param {object} target - { x, y }
     * @param {object} [opts]
     * @param {number} [opts.lerp=0.1]
     * @param {number} [opts.deadzone=0]
     */
    follow(target, opts = {}) {
      cam.followTarget = target;
      if (opts.lerp !== undefined) cam.lerp = opts.lerp;
      if (opts.deadzone !== undefined) cam.deadzone = opts.deadzone;
    },

    /**
     * Clamp camera to bounds.
     * @param {{x:number,y:number,w:number,h:number}} bounds
     */
    clamp(bounds) {
      cam.bounds = bounds;
    },

    /**
     * Screen shake.
     * @param {number} duration - seconds
     * @param {number} intensity - pixels
     */
    shake(duration = 0.3, intensity = 5) {
      cam.shakeDuration = duration;
      cam.shakeIntensity = intensity;
    },

    /**
     * Zoom to a scale.
     * @param {number} scale
     * @param {number} [duration=0.3]
     */
    zoomTo(scale, duration = 0.3) {
      cam._zoomTarget = scale;
      cam._zoomDuration = duration;
      cam._zoomElapsed = 0;
      cam._zoomStart = cam.zoom;
    },

    /**
     * Update camera (call each frame).
     * @param {number} dt - delta time in seconds
     * @param {number} [viewWidth] - viewport width for clamping
     * @param {number} [viewHeight] - viewport height for clamping
     */
    update(dt, viewWidth = 800, viewHeight = 600) {
      // Follow target
      if (cam.followTarget) {
        const tx = cam.followTarget.x;
        const ty = cam.followTarget.y;
        const dx = tx - cam.targetX;
        const dy = ty - cam.targetY;

        if (Math.abs(dx) > cam.deadzone || Math.abs(dy) > cam.deadzone) {
          cam.targetX += dx * cam.lerp;
          cam.targetY += dy * cam.lerp;
        }
      }

      // Smooth move
      cam.x += (cam.targetX - cam.x) * Math.min(cam.lerp * 2, 1);
      cam.y += (cam.targetY - cam.y) * Math.min(cam.lerp * 2, 1);

      // Clamp
      if (cam.bounds) {
        const hw = viewWidth / 2 / cam.zoom;
        const hh = viewHeight / 2 / cam.zoom;
        cam.x = Math.max(cam.bounds.x + hw, Math.min(cam.bounds.x + cam.bounds.w - hw, cam.x));
        cam.y = Math.max(cam.bounds.y + hh, Math.min(cam.bounds.y + cam.bounds.h - hh, cam.y));
        cam.targetX = cam.x;
        cam.targetY = cam.y;
      }

      // Shake
      if (cam.shakeDuration > 0) {
        cam.shakeDuration -= dt;
        cam.shakeOffsetX = (Math.random() - 0.5) * 2 * cam.shakeIntensity;
        cam.shakeOffsetY = (Math.random() - 0.5) * 2 * cam.shakeIntensity;
      } else {
        cam.shakeOffsetX = 0;
        cam.shakeOffsetY = 0;
      }

      // Zoom tween
      if (cam._zoomTarget !== undefined) {
        cam._zoomElapsed += dt;
        const t = Math.min(cam._zoomElapsed / cam._zoomDuration, 1);
        cam.zoom = cam._zoomStart + (cam._zoomTarget - cam._zoomStart) * t;
        if (t >= 1) delete cam._zoomTarget;
      }
    },

    /** Apply camera transform to a PixiJS container */
    applyTo(container) {
      if (!container) return;
      container.x = -cam.x + cam.shakeOffsetX;
      container.y = -cam.y + cam.shakeOffsetY;
      container.scale.set(cam.zoom);
    },

    /** Stop following */
    stopFollow() {
      cam.followTarget = null;
    },

    /** Reset camera */
    reset() {
      cam.x = 0; cam.y = 0;
      cam.targetX = 0; cam.targetY = 0;
      cam.zoom = 1;
      cam.followTarget = null;
      cam.bounds = null;
      cam.shakeDuration = 0;
    },

    destroy() {
      this.reset();
    },
  };
}
