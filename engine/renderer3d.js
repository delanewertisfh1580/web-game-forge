/**
 * 3D Renderer — wraps Three.js scene, camera, renderer, and Points-based particles.
 */
import * as THREE from 'three';

export class Renderer3D {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.mountEl = null;
    this.particleSystems = new Map();
  }

  init({ width, height, backgroundColor, mount }) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(backgroundColor ?? 0x1a1a2e);

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.camera.position.z = 5;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);

    this.mountEl = typeof mount === 'string' ? document.querySelector(mount) : mount;
    if (!this.mountEl) throw new Error(`[Renderer3D] Mount element not found: ${mount}`);
    this.mountEl.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.margin = '0 auto';

    return this.renderer;
  }

  resize(width, height) {
    if (!this.camera || !this.renderer) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  addMesh(geometry, material, options = {}) {
    const mesh = new THREE.Mesh(geometry, material);
    if (options.position) mesh.position.copy(options.position);
    if (options.rotation) mesh.rotation.copy(options.rotation);
    if (options.scale) {
      if (typeof options.scale === 'number') mesh.scale.setScalar(options.scale);
      else mesh.scale.copy(options.scale);
    }
    this.scene.add(mesh);
    return mesh;
  }

  addLight(type, options = {}) {
    let light;
    switch (type) {
      case 'ambient':
        light = new THREE.AmbientLight(options.color ?? 0xffffff, options.intensity ?? 0.5);
        break;
      case 'directional':
        light = new THREE.DirectionalLight(options.color ?? 0xffffff, options.intensity ?? 1);
        if (options.position) light.position.copy(options.position);
        break;
      case 'point':
        light = new THREE.PointLight(options.color ?? 0xffffff, options.intensity ?? 1, options.distance ?? 0);
        if (options.position) light.position.copy(options.position);
        break;
      default:
        throw new Error(`[Renderer3D] Unknown light type: ${type}`);
    }
    this.scene.add(light);
    return light;
  }

  createParticleSystem(config = {}) {
    const capacity = config.capacity ?? 1000;
    const positions = new Float32Array(capacity * 3);
    const velocities = new Float32Array(capacity * 3);
    const lifetimes = new Float32Array(capacity);
    const colors = new Float32Array(capacity * 3);
    const sizes = new Float32Array(capacity);

    // Initialize all particles as dead
    lifetimes.fill(0);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = config.material ?? new THREE.PointsMaterial({
      size: config.size ?? 0.05,
      vertexColors: true,
      transparent: true,
      opacity: config.opacity ?? 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const points = new THREE.Points(geometry, material);
    this.scene.add(points);

    const id = `ps_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.particleSystems.set(id, {
      points,
      geometry,
      material,
      positions,
      velocities,
      lifetimes,
      colors,
      sizes,
      capacity,
      config,
      nextIndex: 0,
    });

    return id;
  }

  emitParticles(systemId, count, emitterConfig = {}) {
    const sys = this.particleSystems.get(systemId);
    if (!sys) return;

    const { positions, velocities, lifetimes, colors, sizes, capacity } = sys;
    const color = emitterConfig.color ?? [1, 1, 1];

    for (let i = 0; i < count; i++) {
      const idx = sys.nextIndex % capacity;
      sys.nextIndex++;

      const i3 = idx * 3;

      // Position
      positions[i3] = (emitterConfig.x ?? 0) + (Math.random() - 0.5) * (emitterConfig.spread ?? 0.5);
      positions[i3 + 1] = (emitterConfig.y ?? 0) + (Math.random() - 0.5) * (emitterConfig.spread ?? 0.5);
      positions[i3 + 2] = (emitterConfig.z ?? 0) + (Math.random() - 0.5) * (emitterConfig.spread ?? 0.5);

      // Velocity
      velocities[i3] = (emitterConfig.vx ?? 0) + (Math.random() - 0.5) * (emitterConfig.velocitySpread ?? 1);
      velocities[i3 + 1] = (emitterConfig.vy ?? 0) + (Math.random() - 0.5) * (emitterConfig.velocitySpread ?? 1);
      velocities[i3 + 2] = (emitterConfig.vz ?? 0) + (Math.random() - 0.5) * (emitterConfig.velocitySpread ?? 1);

      // Lifetime
      lifetimes[idx] = emitterConfig.life ?? 2;

      // Color
      colors[i3] = color[0];
      colors[i3 + 1] = color[1];
      colors[i3 + 2] = color[2];

      // Size
      sizes[idx] = emitterConfig.size ?? 0.05;
    }

    sys.geometry.attributes.position.needsUpdate = true;
    sys.geometry.attributes.color.needsUpdate = true;
    sys.geometry.attributes.size.needsUpdate = true;
  }

  updateParticles(systemId, dt) {
    const sys = this.particleSystems.get(systemId);
    if (!sys) return;

    const { positions, velocities, lifetimes, colors, capacity } = sys;
    const gravity = sys.config.gravity ?? 0;

    for (let i = 0; i < capacity; i++) {
      if (lifetimes[i] <= 0) continue;
      lifetimes[i] -= dt;

      const i3 = i * 3;
      velocities[i3 + 1] += gravity * dt;
      positions[i3] += velocities[i3] * dt;
      positions[i3 + 1] += velocities[i3 + 1] * dt;
      positions[i3 + 2] += velocities[i3 + 2] * dt;

      // Fade color based on remaining life
      const t = Math.max(0, lifetimes[i] / (sys.config.life ?? 2));
      colors[i3] *= (0.99 + 0.01 * t);
      colors[i3 + 1] *= (0.99 + 0.01 * t);
      colors[i3 + 2] *= (0.99 + 0.01 * t);
    }

    sys.geometry.attributes.position.needsUpdate = true;
    sys.geometry.attributes.color.needsUpdate = true;
  }

  removeParticleSystem(systemId) {
    const sys = this.particleSystems.get(systemId);
    if (!sys) return;
    this.scene.remove(sys.points);
    sys.geometry.dispose();
    sys.material.dispose();
    this.particleSystems.delete(systemId);
  }

  render() {
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  destroy() {
    for (const id of [...this.particleSystems.keys()]) {
      this.removeParticleSystem(id);
    }
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
      this.renderer = null;
    }
    this.scene = null;
    this.camera = null;
  }
}
