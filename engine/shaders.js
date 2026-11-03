/**
 * Built-in shaders for 3D scenes.
 * Each shader exports { vertexShader, fragmentShader, uniforms }.
 */

export const SHADERS = {
  /**
   * Wave shader — displaces vertices with a sine wave.
   */
  wave: {
    vertexShader: /* glsl */`
      uniform float uTime;
      uniform float uAmplitude;
      uniform float uFrequency;
      varying vec2 vUv;
      varying float vElevation;

      void main() {
        vUv = uv;
        vec3 pos = position;
        float wave = sin(pos.x * uFrequency + uTime) * uAmplitude;
        wave += sin(pos.y * uFrequency * 0.8 + uTime * 1.3) * uAmplitude * 0.5;
        pos.z += wave;
        vElevation = wave;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      varying vec2 vUv;
      varying float vElevation;

      void main() {
        float mixVal = (vElevation + 0.5) * 0.5;
        vec3 color = mix(uColor1, uColor2, clamp(mixVal, 0.0, 1.0));
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    uniforms: {
      uTime: { value: 0 },
      uAmplitude: { value: 0.3 },
      uFrequency: { value: 4.0 },
      uColor1: { value: [0.1, 0.3, 0.8] },
      uColor2: { value: [0.9, 0.2, 0.5] },
    },
  },

  /**
   * Dissolve shader — dissolves based on a noise-like pattern and threshold.
   */
  dissolve: {
    vertexShader: /* glsl */`
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPosition;

      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uThreshold;
      uniform float uEdgeWidth;
      uniform vec3 uEdgeColor;
      uniform vec3 uBaseColor;
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPosition;

      // Simple pseudo-noise
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      void main() {
        float n = noise(vUv * 8.0 + uTime * 0.1);
        n += noise(vUv * 16.0) * 0.5;
        n /= 1.5;

        if (n < uThreshold) {
          discard;
        }

        float edgeDist = n - uThreshold;
        float edge = 1.0 - smoothstep(0.0, uEdgeWidth, edgeDist);

        vec3 color = mix(uBaseColor, uEdgeColor, edge);

        // Simple lighting
        vec3 lightDir = normalize(vec3(0.5, 1.0, 0.8));
        float diff = max(dot(vNormal, lightDir), 0.0);
        color *= 0.4 + 0.6 * diff;

        gl_FragColor = vec4(color, 1.0);
      }
    `,
    uniforms: {
      uThreshold: { value: 0.3 },
      uEdgeWidth: { value: 0.1 },
      uEdgeColor: { value: [1.0, 0.5, 0.0] },
      uBaseColor: { value: [0.2, 0.6, 1.0] },
      uTime: { value: 0 },
    },
  },
};

/**
 * Factory to create Three.js ShaderMaterial from a shader name or config.
 */
export function createShaderMaterial(nameOrConfig, THREE) {
  let shaderDef;
  if (typeof nameOrConfig === 'string') {
    shaderDef = SHADERS[nameOrConfig];
    if (!shaderDef) throw new Error(`[Shaders] Unknown shader: ${nameOrConfig}`);
  } else {
    shaderDef = nameOrConfig;
  }

  const uniforms = {};
  for (const [key, val] of Object.entries(shaderDef.uniforms)) {
    uniforms[key] = { value: Array.isArray(val.value) ? new THREE.Vector3(...val.value) : val.value };
  }

  return new THREE.ShaderMaterial({
    vertexShader: shaderDef.vertexShader,
    fragmentShader: shaderDef.fragmentShader,
    uniforms,
    transparent: nameOrConfig === 'dissolve',
    side: THREE.DoubleSide,
  });
}
