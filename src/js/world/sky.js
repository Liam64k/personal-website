// Sky dome with a sun, and clouds built from sorted soft billboards.
import * as THREE from "three";
import { fbm2, rng, smoothstep } from "./noise.js";

export function buildSky(env) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    uniforms: {
      uZenith: env.uZenith,
      uHorizon: env.uHorizon,
      uBelow: env.uBelow,
      uSunDir: env.uSunDir,
      uSunCol: env.uSunCol,
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main(){
        vDir = position;
        vec4 p = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uZenith, uHorizon, uBelow, uSunDir, uSunCol;
      varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        float up = max(d.y, 0.0);
        vec3 col = mix(uHorizon, uZenith, pow(up, 0.5));
        col = mix(col, uBelow, smoothstep(0.02, -0.4, d.y));
        float sd = max(dot(d, uSunDir), 0.0);
        // warm wash around the sun, then halo, then disc
        col += uSunCol * (pow(sd, 5.0) * 0.16 + pow(sd, 48.0) * 0.3 + pow(sd, 1400.0) * 9.0);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), mat);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return mesh;
}

// ── Puff atlas: four soft, ragged cloud blobs on one canvas ─────────────────
function puffAtlas(size = 256) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = size * 2;
  const ctx = cv.getContext("2d");
  const img = ctx.createImageData(size * 2, size * 2);
  for (let tile = 0; tile < 4; tile++) {
    const ox = (tile % 2) * size, oy = Math.floor(tile / 2) * size;
    const seed = tile * 37.7;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = (x + 0.5) / size * 2 - 1, v = (y + 0.5) / size * 2 - 1;
        const d = Math.hypot(u, v * 1.08);
        const n = fbm2(u * 2.1 + seed, v * 2.1 - seed, 5) * 0.5 + 0.5;
        const n2 = fbm2(u * 4.6 - seed, v * 4.6 + seed, 3) * 0.5 + 0.5;
        const body = 1 - d;
        const a = smoothstep(0.02, 0.5, body - 0.52 * (1 - n) - 0.1 * (1 - n2));
        const edge = smoothstep(1.0, 0.82, d); // never touch the tile border
        const i = ((oy + y) * size * 2 + ox + x) * 4;
        const shade = Math.round(255 * Math.min(1, Math.max(0, 0.25 + n * 0.5 + n2 * 0.25)));
        img.data[i] = shade;
        img.data[i + 1] = shade;
        img.data[i + 2] = shade;
        img.data[i + 3] = Math.round(255 * a * edge);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.NoColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.premultiplyAlpha = false;
  return tex;
}

/**
 * Clouds: a sea below the island, cumulus heaps around it, a broken deck the
 * camera sinks through at the start, and a few wisps near the rock.
 */
export function buildClouds(env, quality) {
  const rand = rng(909);
  const puffs = []; // {x,y,z,size,rot,tile,shade,alpha,drift}
  const add = (x, y, z, size, shade, alpha, drift = 1, bank = false) =>
    puffs.push({ x, y, z, size, rot: (rand() - 0.5) * 0.9, tile: Math.floor(rand() * 4), shade, alpha, drift, bank });

  const k = quality.cloudScale;

  // cloud sea
  const seaN = Math.round(520 * k);
  for (let i = 0; i < seaN; i++) {
    const th = rand() * Math.PI * 2;
    const rad = 40 + Math.pow(rand(), 0.75) * 900;
    const x = Math.cos(th) * rad, z = Math.sin(th) * rad;
    const lump = fbm2(x * 0.004 + 9, z * 0.004 - 4, 3);
    const y = -92 + lump * 26 + rand() * 12;
    add(x, y, z, 90 + rand() * 120 + rad * 0.08, 0.35 + rand() * 0.5 + lump * 0.3, 0.9, 0.35);
  }

  // cumulus heaps
  const heaps = Math.round(18 * k);
  for (let h = 0; h < heaps; h++) {
    const th = (h / heaps) * Math.PI * 2 + rand() * 0.5;
    const rad = 170 + rand() * 380;
    const cx = Math.cos(th) * rad, cz = Math.sin(th) * rad;
    const cy = -40 + rand() * 110;
    const w = 45 + rand() * 70, tall = 22 + rand() * 40;
    const n = 26 + Math.floor(rand() * 20);
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2, rr = Math.pow(rand(), 0.7) * w;
      const up = Math.pow(rand(), 1.6) * (1 - (rr / w) * 0.7);
      add(
        cx + Math.cos(a) * rr, cy + up * tall, cz + Math.sin(a) * rr * 0.8,
        (26 + rand() * 30) * (1 - up * 0.35), 0.25 + up * 0.75, 0.95
      );
    }
  }

  // high, thin clouds far above the island
  const deckN = Math.round(120 * k);
  for (let i = 0; i < deckN; i++) {
    const th = rand() * Math.PI * 2;
    const rad = 120 + Math.pow(rand(), 0.8) * 620;
    const x = Math.cos(th) * rad, z = Math.sin(th) * rad;
    if (fbm2(x * 0.006, z * 0.006, 2) < -0.05) continue;
    add(x, 170 + rand() * 90, z, 80 + rand() * 90, 0.7 + rand() * 0.3, 0.55, 0.6);
  }

  // a bank the camera flies through on its way down to the summit
  for (let i = 0; i < Math.round(34 * k); i++) {
    add(-8 + (rand() - 0.5) * 70, 38 + (rand() - 0.5) * 22, 110 + (rand() - 0.5) * 34, 26 + rand() * 30, 0.6 + rand() * 0.4, 0.9, 0.1, true);
  }

  // wisps hugging the rock
  for (let i = 0; i < Math.round(14 * k); i++) {
    const th = rand() * Math.PI * 2;
    const rad = 58 + rand() * 34;
    add(Math.cos(th) * rad, -52 + rand() * 26, Math.sin(th) * rad, 20 + rand() * 24, 0.7, 0.38, 0.8);
  }

  const N = puffs.length;
  const A = new Float32Array(N * 4), B = new Float32Array(N * 4);
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  const attrA = new THREE.InstancedBufferAttribute(A, 4).setUsage(THREE.DynamicDrawUsage);
  const attrB = new THREE.InstancedBufferAttribute(B, 4).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute("aA", attrA);
  geo.setAttribute("aB", attrB);
  geo.instanceCount = N;

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uMap: { value: puffAtlas() },
      uLit: env.uCloudLit,
      uShade: env.uCloudShade,
      uHaze: env.uHorizon,
      uSunDir: env.uSunDir,
      uSunCol: env.uSunCol,
    },
    vertexShader: /* glsl */ `
      attribute vec4 aA; // xyz, size
      attribute vec4 aB; // rot, tile, shade, alpha
      varying vec2 vUv;
      varying float vUp;
      varying float vShade;
      varying float vAlpha;
      varying float vDist;
      varying float vSun;
      uniform vec3 uSunDir;
      void main(){
        float c = cos(aB.x), s = sin(aB.x);
        vec2 q = vec2(position.x * c - position.y * s, position.x * s + position.y * c);
        vec4 mv = viewMatrix * vec4(aA.xyz, 1.0);
        vDist = length(mv.xyz);
        mv.xy += q * aA.w;
        gl_Position = projectionMatrix * mv;
        vec2 tile = vec2(mod(aB.y, 2.0), floor(aB.y / 2.0));
        vUv = (position.xy + 0.5 + tile) * 0.5;
        vUp = q.y;
        vShade = aB.z;
        // fade puffs the camera is about to fly through
        vAlpha = aB.w * smoothstep(aA.w * 0.12, aA.w * 0.7, vDist);
        vec3 toCam = normalize(cameraPosition - aA.xyz);
        vSun = max(dot(-toCam, uSunDir), 0.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform vec3 uLit, uShade, uHaze, uSunCol;
      varying vec2 vUv;
      varying float vUp;
      varying float vShade;
      varying float vAlpha;
      varying float vDist;
      varying float vSun;
      void main(){
        vec4 t = texture2D(uMap, vUv);
        float a = t.a * vAlpha;
        if (a < 0.004) discard;
        float lit = clamp(vShade * 0.6 + vUp * 0.75 + (t.r - 0.5) * 0.55 + 0.32, 0.0, 1.0);
        vec3 col = mix(uShade, uLit, lit);
        // thin edges glow when the sun is behind them
        col += uSunCol * pow(vSun, 6.0) * (1.0 - t.a) * 0.55;
        col = mix(col, uHaze, smoothstep(260.0, 950.0, vDist) * 0.7);
        gl_FragColor = vec4(col, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;

  const order = new Uint32Array(N);
  const depth = new Float32Array(N);
  const xs = new Float32Array(N);
  for (let i = 0; i < N; i++) order[i] = i;
  const SPAN = 1000;

  return {
    mesh,
    count: N,
    /** Drift the clouds and re-sort them back to front for this camera. */
    update(time, camera, bank = 0) {
      const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
      for (let i = 0; i < N; i++) {
        const p = puffs[i];
        let x = p.x + time * 0.55 * p.drift;
        x = ((x + SPAN) % (SPAN * 2) + SPAN * 2) % (SPAN * 2) - SPAN;
        xs[i] = x;
        const dx = x - cx, dy = p.y - cy, dz = p.z - cz;
        depth[i] = dx * dx + dy * dy + dz * dz;
      }
      order.sort((a, b) => depth[b] - depth[a]);
      for (let k2 = 0; k2 < N; k2++) {
        const i = order[k2], p = puffs[i], o = k2 * 4;
        A[o] = xs[i]; A[o + 1] = p.y; A[o + 2] = p.z; A[o + 3] = p.size;
        B[o] = p.rot; B[o + 1] = p.tile; B[o + 2] = p.shade; B[o + 3] = p.bank ? p.alpha * bank : p.alpha;
      }
      attrA.needsUpdate = true;
      attrB.needsUpdate = true;
    },
  };
}
