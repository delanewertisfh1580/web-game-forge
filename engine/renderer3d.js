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
    const maxLifetimes = new Float32Array(capacity);
    const colors = new Float32Array(capacity * 3);
    const sizes = new Float32Array(capacity);
    const alphas = new Float32Array(capacity);

    // Initialize all particles as dead
    lifetimes.fill(0);
    alphas.fill(0);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));

    // Fix #10: Use ShaderMaterial so per-particle size and alpha work
    const material = config.material ?? new THREE.ShaderMaterial({
      vertexShader: `
        attribute float aSize;
        attribute float aAlpha;
        attribute vec3 aColor;
        varying float vAlpha;
        varying vec3 vColor;
        void main() {
          vAlpha = aAlpha;
          vColor = aColor;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        varying vec3 vColor;
        void main() {
          // Circular point with soft edge
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          float alpha = vAlpha * smoothstep(0.5, 0.2, d);
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
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
      maxLifetimes,
      colors,
      sizes,
      alphas,
      capacity,
      config,
      nextIndex: 0,
    });

    return id;
  }

  emitParticles(systemId, count, emitterConfig = {}) {
    const sys = this.particleSystems.get(systemId);
    if (!sys) return;

    const { positions, velocities, lifetimes, maxLifetimes, colors, sizes, alphas, capacity } = sys;
    const color = emitterConfig.color ?? [1, 1, 1];
    const life = emitterConfig.life ?? 2;

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
      lifetimes[idx] = life;
      maxLifetimes[idx] = life;

      // Color
      colors[i3] = color[0];
      colors[i3 + 1] = color[1];
      colors[i3 + 2] = color[2];

      // Size
      sizes[idx] = emitterConfig.size ?? 0.05;

      // Alpha (full at birth)
      alphas[idx] = emitterConfig.opacity ?? 1.0;
    }

    sys.geometry.attributes.position.needsUpdate = true;
    sys.geometry.attributes.aColor.needsUpdate = true;
    sys.geometry.attributes.aSize.needsUpdate = true;
    sys.geometry.attributes.aAlpha.needsUpdate = true;
  }

  updateParticles(systemId, dt) {
    const sys = this.particleSystems.get(systemId);
    if (!sys) return;

    const { positions, velocities, lifetimes, maxLifetimes, colors, alphas, capacity } = sys;
    const gravity = sys.config.gravity ?? 0;

    for (let i = 0; i < capacity; i++) {
      if (lifetimes[i] <= 0) {
        alphas[i] = 0;
        continue;
      }
      lifetimes[i] -= dt;

      const i3 = i * 3;
      velocities[i3 + 1] += gravity * dt;
      positions[i3] += velocities[i3] * dt;
      positions[i3 + 1] += velocities[i3 + 1] * dt;
      positions[i3 + 2] += velocities[i3 + 2] * dt;

      // Fade alpha based on remaining life
      const t = maxLifetimes[i] > 0 ? Math.max(0, lifetimes[i] / maxLifetimes[i]) : 0;
      alphas[i] = t;
    }

    sys.geometry.attributes.position.needsUpdate = true;
    sys.geometry.attributes.aColor.needsUpdate = true;
    sys.geometry.attributes.aAlpha.needsUpdate = true;
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
