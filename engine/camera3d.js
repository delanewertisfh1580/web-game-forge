/**
 * camera3d.js — 3D orbit/follow camera for Three.js.
 * @module camera3d
 */

/**
 * Create a 3D camera controller.
 * @param {object} camera - THREE.PerspectiveCamera
 * @param {HTMLElement} domElement
 * @returns {Camera3D}
 */
export function createCamera3D(camera, domElement) {
  let isDragging = false;
  let prevMouse = { x: 0, y: 0 };
  let spherical = { theta: 0, phi: Math.PI / 4, radius: 10 };
  let target = { x: 0, y: 0, z: 0 };
  let followTarget = null;
  let shakeDuration = 0;
  let shakeIntensity = 0;
  let shakeOffset = { x: 0, y: 0, z: 0 };
  const minRadius = 2;
  const maxRadius = 50;
  const listeners = [];

  function addListener(el, type, fn) {
    el.addEventListener(type, fn);
    listeners.push({ el, type, fn });
  }

  function updatePosition() {
    const x = target.x + spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);
    const y = target.y + spherical.radius * Math.cos(spherical.phi);
    const z = target.z + spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
    camera.position.set(x + shakeOffset.x, y + shakeOffset.y, z + shakeOffset.z);
    camera.lookAt(target.x, target.y, target.z);
  }

  // Mouse controls
  addListener(domElement, 'pointerdown', (e) => {
    if (e.button === 0 || e.button === 2) {
      isDragging = true;
      prevMouse = { x: e.clientX, y: e.clientY };
    }
  });
  addListener(window, 'pointerup', () => { isDragging = false; });
  addListener(window, 'pointermove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - prevMouse.x;
    const dy = e.clientY - prevMouse.y;
    spherical.theta -= dx * 0.005;
    spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi + dy * 0.005));
    prevMouse = { x: e.clientX, y: e.clientY };
    updatePosition();
  });
  addListener(domElement, 'wheel', (e) => {
    e.preventDefault();
    spherical.radius = Math.max(minRadius, Math.min(maxRadius, spherical.radius + e.deltaY * 0.01));
    updatePosition();
  });

  updatePosition();

  return {
    /** Set orbit target */
    setTarget(x, y, z) {
      target = { x, y, z };
      updatePosition();
    },

    /**
     * Orbit mode.
     * @param {object} [opts]
     * @param {{x:number,y:number,z:number}} [opts.target]
     * @param {number} [opts.minR=2]
     * @param {number} [opts.maxR=50]
     */
    orbit(opts = {}) {
      if (opts.target) target = { ...opts.target };
      if (opts.minR !== undefined) minRadius = opts.minR;
      if (opts.maxR !== undefined) maxRadius = opts.maxR;
      followTarget = null;
      updatePosition();
    },

    /**
     * Follow a Three.js Object3D.
     * @param {object} obj - THREE.Object3D
     * @param {object} [opts]
     */
    follow(obj, opts = {}) {
      followTarget = obj;
    },

    /**
     * Screen shake.
     * @param {number} duration
     * @param {number} intensity
     */
    shake(duration = 0.3, intensity = 0.2) {
      shakeDuration = duration;
      shakeIntensity = intensity;
    },

    /**
     * Update (call each frame).
     * @param {number} dt
     */
    update(dt) {
      if (followTarget) {
        target.x = followTarget.position.x;
        target.y = followTarget.position.y;
        target.z = followTarget.position.z;
      }

      // Shake
      if (shakeDuration > 0) {
        shakeDuration -= dt;
        shakeOffset.x = (Math.random() - 0.5) * 2 * shakeIntensity;
        shakeOffset.y = (Math.random() - 0.5) * 2 * shakeIntensity;
        shakeOffset.z = (Math.random() - 0.5) * 2 * shakeIntensity;
      } else {
        shakeOffset.x = 0; shakeOffset.y = 0; shakeOffset.z = 0;
      }

      updatePosition();
    },

    /** Get current camera */
    get threeCamera() { return camera; },

    destroy() {
      for (const { el, type, fn } of listeners) {
        el.removeEventListener(type, fn);
      }
      listeners.length = 0;
    },
  };
}
