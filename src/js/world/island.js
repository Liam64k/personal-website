// The island: one shared height function, a closed rock mesh shaded by slope and
// height, GPU grass, scattered stones and a few drifting islets.
import * as THREE from "three";
import {
  noise2, noise3, fbm2, ridged2, ridged3, smoothstep, rng, GLSL_NOISE,
} from "./noise.js";

export const R = 60;
const RIM_Y = -1.5;

export function rimRadius(th) {
  const c = Math.cos(th), s = Math.sin(th);
  return R * (0.86
    + 0.11 * noise2(c * 1.4 + 3.1, s * 1.4 - 7.7)
    + 0.035 * noise2(c * 4.2 + 1.3, s * 4.2 + 8.8));
}

// ── Where things stand ─────────────────────────────────────────────────────
export const SUMMIT = { x: -14, z: -16 };

const landingAngle = Math.atan2(21, 44);
const landingR = rimRadius(landingAngle) - 7;

const pondAngle = THREE.MathUtils.degToRad(50);
const pondR = rimRadius(pondAngle) - 10;

export const PADS = {
  pond: {
    x: Math.cos(pondAngle) * pondR, z: Math.sin(pondAngle) * pondR,
    h: 1.1, r: 6.5, angle: pondAngle,
  },
  workshop: { x: 24, z: -10, h: 4.2, r: 10 },
  lab: { x: 10, z: 26, h: 3.4, r: 12 },
  towers: { x: -30, z: 18, h: 7.2, r: 8.5 },
  landing: {
    x: Math.cos(landingAngle) * landingR,
    z: Math.sin(landingAngle) * landingR,
    h: 2.4, r: 7, angle: landingAngle,
  },
};
const PAD_LIST = Object.values(PADS);

// A worn footpath that links the stops.
export const PATH = [
  [PADS.landing.x, PADS.landing.z],
  [31, 5],
  [23, -3],
  [13, 9],
  [10, 19],
  [-8, 23],
  [-25, 19],
];

export function pathDistance(x, z) {
  let best = 1e9;
  for (let i = 0; i < PATH.length - 1; i++) {
    const ax = PATH[i][0], az = PATH[i][1];
    const bx = PATH[i + 1][0], bz = PATH[i + 1][1];
    const dx = bx - ax, dz = bz - az;
    const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
    if (d < best) best = d;
  }
  return best;
}

/** Height of the island's top surface at (x, z). Everything samples this. */
export function topHeight(x, z) {
  const r = Math.hypot(x, z);
  const rr = rimRadius(Math.atan2(z, x));
  const s = r / rr;

  let h = 3.4 + fbm2(x * 0.03 + 4.2, z * 0.03 - 1.7, 4) * 5.5 + noise2(x * 0.13, z * 0.13) * 0.55;

  const ds = Math.hypot(x - SUMMIT.x, z - SUMMIT.z);
  const peak = Math.exp(-(ds * ds) / (2 * 9.5 * 9.5));
  h += peak * (19 + ridged2(x * 0.07 + 2, z * 0.07 + 5, 3) * 7);

  for (const p of PAD_LIST) {
    const d = Math.hypot(x - p.x, z - p.z);
    const w = 1 - smoothstep(p.r * 0.55, p.r, d);
    h += (p.h - h) * w;
  }

  const e = smoothstep(0.8, 1.0, s);
  return h * (1 - e * e) + RIM_Y * e * e;
}

function slopeUp(x, z) {
  const e = 0.6;
  const dx = topHeight(x + e, z) - topHeight(x - e, z);
  const dz = topHeight(x, z + e) - topHeight(x, z - e);
  return (2 * e) / Math.hypot(dx, 2 * e, dz); // y of the unit normal
}

// ── Rock material ──────────────────────────────────────────────────────────
const pathUniform = { value: PATH.map(([x, z]) => new THREE.Vector2(x, z)) };
const padUniform = {
  value: [PADS.workshop, PADS.lab, PADS.towers, PADS.landing, PADS.pond].map(
    (p) => new THREE.Vector3(p.x, p.z, p.r * 0.62)
  ),
};

/**
 * Standard material whose colour and bump come from world position:
 * grass and soil on flat tops, layered rock on steep faces and below.
 */
export function makeRockMaterial({ ground = 1, topMask = 1, baseY = 0 } = {}) {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.94, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uPath = pathUniform;
    shader.uniforms.uPads = padUniform;
    shader.uniforms.uGround = { value: ground };
    shader.uniforms.uTopMask = { value: topMask };
    shader.uniforms.uBaseY = { value: baseY };

    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNorm;")
      .replace(
        "#include <project_vertex>",
        /* glsl */ `
        vec4 iw = vec4(transformed, 1.0);
        vec3 inrm = objectNormal;
        #ifdef USE_INSTANCING
          iw = instanceMatrix * iw;
          inrm = mat3(instanceMatrix) * inrm;
        #endif
        vWPos = (modelMatrix * iw).xyz;
        vWNorm = normalize(mat3(modelMatrix) * inrm);
        #include <project_vertex>`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        /* glsl */ `#include <common>
        varying vec3 vWPos;
        varying vec3 vWNorm;
        uniform vec2 uPath[${PATH.length}];
        uniform vec3 uPads[5];
        uniform float uGround;
        uniform float uTopMask;
        uniform float uBaseY;
        ${GLSL_NOISE}
        float iPathDist(vec2 p){
          float best = 1e9;
          for (int i = 0; i < ${PATH.length - 1}; i++){
            vec2 a = uPath[i], b = uPath[i + 1];
            vec2 ab = b - a;
            float t = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
            best = min(best, distance(p, a + ab * t));
          }
          return best;
        }
        vec3 iBump(vec3 viewPos, vec3 n, float h, float scale){
          vec3 sx = dFdx(viewPos), sy = dFdy(viewPos);
          vec3 r1 = cross(sy, n), r2 = cross(n, sx);
          float det = dot(sx, r1);
          vec2 dh = vec2(dFdx(h), dFdy(h)) * scale;
          vec3 grad = sign(det) * (dh.x * r1 + dh.y * r2);
          return normalize(abs(det) * n - grad);
        }`
      )
      .replace(
        "#include <color_fragment>",
        /* glsl */ `#include <color_fragment>
        vec3 iwn = normalize(vWNorm);
        float in1 = iFbm(vWPos * 0.07);
        float in2 = iFbm(vWPos * 0.33 + 7.0);
        float in3 = iNoise(vWPos * 2.6);
        float in4 = iNoise(vWPos * 9.0);

        // layered rock
        float strata = sin(vWPos.y * 0.62 + in1 * 7.0) * 0.5 + 0.5;
        vec3 rock = mix(vec3(0.20, 0.175, 0.15), vec3(0.47, 0.42, 0.35), in2);
        rock = mix(rock, vec3(0.60, 0.55, 0.46), strata * 0.38);
        rock *= 0.72 + 0.4 * in3 + 0.16 * in4;
        float crack = smoothstep(0.42, 0.5, abs(iNoise(vWPos * 0.9 + 3.0) - 0.5) * 2.0);
        rock *= mix(0.74, 1.0, crack);
        float under = smoothstep(1.0, -42.0, vWPos.y - uBaseY);
        rock *= mix(1.0, 0.5, under);
        rock = mix(rock, rock * vec3(0.82, 0.92, 1.1), under);
        float moss = smoothstep(0.3, 0.7, iwn.y) * smoothstep(0.45, 0.7, in2) * (1.0 - under);
        rock = mix(rock, vec3(0.13, 0.20, 0.05) * (0.7 + 0.6 * in3), moss * 0.7);

        // soil, turf, worn path and cleared pads
        vec3 soil = mix(vec3(0.16, 0.115, 0.07), vec3(0.27, 0.21, 0.13), in3);
        vec3 turf = mix(vec3(0.085, 0.17, 0.035), vec3(0.19, 0.30, 0.07), in1);
        turf *= 0.8 + 0.4 * in3;
        float flatness = smoothstep(0.6, 0.84, iwn.y);
        vec3 groundCol = mix(soil, turf, smoothstep(0.25, 0.6, flatness * 0.7 + in2 * 0.45));
        float wob = (in3 - 0.5) * 1.1;
        float worn = 1.0 - smoothstep(0.75, 1.7, iPathDist(vWPos.xz) + wob);
        for (int i = 0; i < 5; i++){
          float pd = distance(vWPos.xz, uPads[i].xy);
          worn = max(worn, 1.0 - smoothstep(uPads[i].z * 0.82, uPads[i].z * 1.08, pd + wob * 1.6));
        }
        vec3 dirt = mix(vec3(0.30, 0.235, 0.16), vec3(0.42, 0.35, 0.25), in3) * (0.85 + 0.3 * in4);
        groundCol = mix(groundCol, dirt, worn * uTopMask);

        float topBand = mix(1.0, smoothstep(-2.6, -0.4, vWPos.y), uTopMask);
        float iGround = flatness * topBand * uGround;
        diffuseColor.rgb = mix(rock, groundCol, iGround);`
      )
      .replace(
        "#include <normal_fragment_maps>",
        /* glsl */ `#include <normal_fragment_maps>
        float ih = (1.0 - abs(iFbm(vWPos * 0.42) * 2.0 - 1.0)) * 1.25
          + (1.0 - abs(iNoise(vWPos * 1.7) * 2.0 - 1.0)) * 0.4
          + iNoise(vWPos * 3.4) * 0.26 + iNoise(vWPos * 11.0) * 0.08;
        ih -= (1.0 - crack) * 0.22;
        normal = iBump(-vViewPosition, normal, ih, mix(2.4, 0.5, iGround));`
      );
  };
  mat.customProgramCacheKey = () => "isle-rock";
  return mat;
}

// ── Island mesh ────────────────────────────────────────────────────────────
function orient(geo, wantUp, probeIndex) {
  geo.computeVertexNormals();
  const ny = geo.attributes.normal.getY(probeIndex);
  if ((ny > 0) !== wantUp) {
    const idx = geo.index.array;
    for (let i = 0; i < idx.length; i += 3) {
      const t = idx[i + 1];
      idx[i + 1] = idx[i + 2];
      idx[i + 2] = t;
    }
    geo.index.needsUpdate = true;
    geo.computeVertexNormals();
  }
}

function gridIndex(rows, cols) {
  const idx = new Uint32Array(rows * cols * 6);
  let k = 0;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const j1 = (j + 1) % cols;
      const a = i * cols + j, b = i * cols + j1;
      const c = (i + 1) * cols + j, d = (i + 1) * cols + j1;
      idx[k++] = a; idx[k++] = c; idx[k++] = b;
      idx[k++] = b; idx[k++] = c; idx[k++] = d;
    }
  }
  return idx;
}

function buildTop(NR, NS) {
  const pos = new Float32Array((NR + 1) * NS * 3);
  let k = 0;
  for (let i = 0; i <= NR; i++) {
    const s = i / NR;
    for (let j = 0; j < NS; j++) {
      const th = (j / NS) * Math.PI * 2;
      const rad = s * rimRadius(th);
      const x = Math.cos(th) * rad, z = Math.sin(th) * rad;
      pos[k++] = x;
      pos[k++] = topHeight(x, z);
      pos[k++] = z;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setIndex(new THREE.BufferAttribute(gridIndex(NR, NS), 1));
  orient(geo, true, Math.floor(NR / 2) * NS);
  return geo;
}

function buildUnderside(NV, NS) {
  const pos = new Float32Array((NV + 1) * NS * 3);
  let k = 0;
  for (let i = 0; i <= NV; i++) {
    const v = i / NV;
    for (let j = 0; j < NS; j++) {
      const th = (j / NS) * Math.PI * 2;
      const c = Math.cos(th), s = Math.sin(th);
      const rr = rimRadius(th);
      const depth = 44 + 15 * noise2(c * 1.1 + 11, s * 1.1 + 4);
      const pr = rr * Math.pow(1 - Math.pow(v, 1.55), 0.8);
      let y = RIM_Y - depth * Math.pow(v, 0.9);
      const bx = c * pr, bz = s * pr;

      // hanging lobes: stretch the lower rock downwards in ridged streaks
      const lobe = Math.pow(ridged2(bx * 0.06 + 3, bz * 0.06 - 2, 3), 2.2);
      y -= lobe * 20 * smoothstep(0.25, 0.9, v);

      // craggy relief along an outward-and-down direction
      const nx = c * (1 - v * 0.55), ny = -(0.25 + v * 0.9), nz = s * (1 - v * 0.55);
      const nl = Math.hypot(nx, ny, nz);
      let d = (ridged3(bx * 0.045, y * 0.06, bz * 0.045, 4) - 0.42) * 10;
      d += noise3(bx * 0.15, y * 0.15, bz * 0.15) * 2.2;
      d += noise3(bx * 0.45, y * 0.45, bz * 0.45) * 0.6;
      d *= smoothstep(0, 0.07, v) * (1 - smoothstep(0.92, 1, v));

      pos[k++] = bx + (nx / nl) * d;
      pos[k++] = y + (ny / nl) * d;
      pos[k++] = bz + (nz / nl) * d;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setIndex(new THREE.BufferAttribute(gridIndex(NV, NS), 1));
  orient(geo, false, Math.floor(NV * 0.9) * NS);
  return geo;
}

// ── Grass ──────────────────────────────────────────────────────────────────
function bladeGeometry() {
  const SEG = 3;
  const pos = [], idx = [];
  for (let i = 0; i < SEG; i++) {
    const t = i / SEG, w = 0.5 * (1 - t * 0.8);
    pos.push(-w, t, 0, w, t, 0);
  }
  pos.push(0, 1, 0);
  for (let i = 0; i < SEG - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const a = (SEG - 1) * 2;
  idx.push(a, a + 1, a + 2);
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

function isClear(x, z) {
  if (pathDistance(x, z) < 1.25) return false;
  for (const p of PAD_LIST) {
    if (Math.hypot(x - p.x, z - p.z) < p.r * 0.6) return false;
  }
  return true;
}

function buildGrass(count, env) {
  const rand = rng(77);
  const offs = new Float32Array(count * 3);
  const par = new Float32Array(count * 4);
  let n = 0, guard = 0;
  while (n < count && guard++ < count * 12) {
    const th = rand() * Math.PI * 2;
    const rr = rimRadius(th);
    const rad = Math.sqrt(rand()) * rr * 0.965;
    const x = Math.cos(th) * rad, z = Math.sin(th) * rad;
    const up = slopeUp(x, z);
    if (up < 0.8 + rand() * 0.12) continue;
    if (!isClear(x, z)) continue;
    // thin out in patches so the turf breathes
    const patch = fbm2(x * 0.09 + 31, z * 0.09 + 17, 2);
    if (patch < -0.28 && rand() > 0.25) continue;
    offs[n * 3] = x;
    offs[n * 3 + 1] = topHeight(x, z) - 0.03;
    offs[n * 3 + 2] = z;
    par[n * 4] = (0.55 + rand() * 0.75) * (1 + Math.max(0, patch) * 0.9); // height
    par[n * 4 + 1] = rand() * 6.283; // phase
    par[n * 4 + 2] = Math.min(1, Math.max(0, 0.45 + fbm2(x * 0.045 - 8, z * 0.045 + 22, 2) * 1.1 + (rand() - 0.5) * 0.45)); // dry-to-lush tint
    par[n * 4 + 3] = rand() * 6.283; // facing
    n++;
  }
  const geo = bladeGeometry();
  geo.instanceCount = n;
  geo.setAttribute("aOffset", new THREE.InstancedBufferAttribute(offs.subarray(0, n * 3), 3));
  geo.setAttribute("aParams", new THREE.InstancedBufferAttribute(par.subarray(0, n * 4), 4));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 10, 0), R * 1.3);

  const mat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      uTime: env.uTime,
      uWind: env.uWind,
      uSunCol: env.uSunCol,
      uAmbCol: env.uAmbCol,
      uSunDir: env.uSunDir,
      uFogCol: env.uFogCol,
      uFogDen: env.uFogDen,
    },
    vertexShader: /* glsl */ `
      attribute vec3 aOffset;
      attribute vec4 aParams;
      uniform float uTime, uWind;
      varying float vT;
      varying float vTint;
      varying float vFlower;
      varying float vDist;
      varying vec3 vN;
      void main(){
        float t = position.y;
        float h = aParams.x;
        float ca = cos(aParams.w), sa = sin(aParams.w);
        float gust = sin(uTime * 1.5 + aOffset.x * 0.19 + aOffset.z * 0.15 + aParams.y) * 0.6
                   + sin(uTime * 0.6 + aOffset.x * 0.045 - aOffset.z * 0.03) * 0.7;
        float bend = (0.22 + fract(aParams.y) * 0.25 + gust * uWind * 0.35) * t * t * h;
        vec3 p = vec3(position.x * 0.075 * (0.75 + h * 0.4), t * h - bend * bend * 0.3, bend);
        vec3 q = vec3(p.x * ca - p.z * sa, p.y, p.x * sa + p.z * ca);
        q.x += gust * uWind * t * t * h * 0.55;
        vec4 mv = viewMatrix * vec4(aOffset + q, 1.0);
        vT = t;
        vTint = aParams.z;
        vFlower = step(6.2, aParams.y);
        vDist = -mv.z;
        vN = normalize(vec3(-sa, 0.9, ca));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunCol, uAmbCol, uSunDir, uFogCol;
      uniform float uFogDen;
      varying float vT;
      varying float vTint;
      varying float vFlower;
      varying float vDist;
      varying vec3 vN;
      void main(){
        vec3 root = vec3(0.045, 0.10, 0.02);
        vec3 tip = mix(vec3(0.17, 0.34, 0.07), vec3(0.40, 0.45, 0.13), smoothstep(0.25, 0.95, vTint));
        vec3 col = mix(root, tip, pow(vT, 0.8));
        float flower = vFlower * smoothstep(0.78, 0.9, vT);
        col = mix(col, vec3(0.95, 0.9, 0.72), flower);
        float lam = 0.5 + 0.5 * clamp(dot(normalize(vN), uSunDir), 0.0, 1.0);
        float sheen = pow(vT, 3.0) * 0.35 * max(uSunDir.y, 0.0);
        vec3 lit = col * (uAmbCol * 0.9 + uSunCol * (lam * 0.75 + sheen));
        lit *= mix(0.5, 1.0, vT);
        float f = 1.0 - exp(-uFogDen * uFogDen * vDist * vDist);
        gl_FragColor = vec4(mix(lit, uFogCol, f), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}

// ── Stones and islets ──────────────────────────────────────────────────────
function lumpGeometry(detail, seed, flatTop) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const d = 1 + (ridged3(x * 1.3 + seed, y * 1.3, z * 1.3 - seed, 3) - 0.5) * 0.55
      + noise3(x * 3.1 + seed, y * 3.1, z * 3.1) * 0.12;
    x *= d; y *= d; z *= d;
    if (flatTop) {
      if (y > 0.18) y = 0.18 + (y - 0.18) * 0.12 + noise2(x * 2 + seed, z * 2) * 0.05;
      else y *= 1.7;
    }
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

function buildStones(count) {
  const rand = rng(404);
  const geo = lumpGeometry(2, 3.3, false);
  geo.scale(1, 0.62, 1);
  geo.translate(0, 0.22, 0);
  const mesh = new THREE.InstancedMesh(geo, makeRockMaterial({ ground: 0, topMask: 0 }), count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const sc = new THREE.Vector3(), ps = new THREE.Vector3();
  let n = 0, guard = 0;
  while (n < count && guard++ < count * 30) {
    const th = rand() * Math.PI * 2;
    const rad = Math.sqrt(rand()) * rimRadius(th) * 0.93;
    const x = Math.cos(th) * rad, z = Math.sin(th) * rad;
    if (!isClear(x, z)) continue;
    const big = rand() < 0.12;
    const s = big ? 1.1 + rand() * 1.5 : 0.22 + rand() * 0.55;
    ps.set(x, topHeight(x, z) - s * 0.12, z);
    e.set(rand() * 0.5, rand() * 6.283, rand() * 0.5);
    q.setFromEuler(e);
    sc.set(s * (0.8 + rand() * 0.5), s * (0.7 + rand() * 0.5), s * (0.8 + rand() * 0.5));
    m.compose(ps, q, sc);
    mesh.setMatrixAt(n++, m);
  }
  mesh.count = n;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function buildIslets() {
  const group = new THREE.Group();
  const spots = [
    { p: [78, 14, -38], s: 9, seed: 1.7 },
    { p: [-86, -6, 22], s: 12, seed: 5.2 },
    { p: [-58, 30, -64], s: 6.5, seed: 9.1 },
    { p: [52, -20, 74], s: 7.5, seed: 12.6 },
    { p: [18, 38, -92], s: 5, seed: 15.4 },
    { p: [96, 4, 40], s: 4, seed: 21.9 },
  ];
  for (const it of spots) {
    const mesh = new THREE.Mesh(
      lumpGeometry(5, it.seed, true),
      makeRockMaterial({ ground: 1, topMask: 0, baseY: it.p[1] + 30 })
    );
    mesh.position.set(...it.p);
    mesh.scale.set(it.s, it.s * 0.85, it.s);
    mesh.rotation.y = it.seed;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.bob = { y: it.p[1], phase: it.seed, amp: 0.5 + it.s * 0.05 };
    group.add(mesh);
  }
  return group;
}

// ── Assemble ───────────────────────────────────────────────────────────────
export function buildIsland(env, quality) {
  const group = new THREE.Group();
  const rock = makeRockMaterial();

  const top = new THREE.Mesh(buildTop(quality.high ? 120 : 84, quality.high ? 400 : 280), rock);
  const under = new THREE.Mesh(buildUnderside(quality.high ? 150 : 100, quality.high ? 400 : 280), rock);
  for (const m of [top, under]) {
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }

  const grass = buildGrass(quality.grass, env);
  group.add(grass);
  group.add(buildStones(quality.high ? 520 : 260));

  const islets = buildIslets();
  group.add(islets);

  return {
    group,
    update(time) {
      for (const m of islets.children) {
        const b = m.userData.bob;
        m.position.y = b.y + Math.sin(time * 0.25 + b.phase) * b.amp;
        m.rotation.y = b.phase + time * 0.012;
      }
    },
  };
}
