// Trees (one great blossom tree and small groves), falling petals, and the
// vines that hang from the island's rim.
import * as THREE from "three";
import { topHeight, rimRadius, pathDistance, makeRockMaterial, smoothNormals, PADS, ISLETS } from "./island.js";
import { noise3, fbm3, rng, GLSL_NOISE } from "./noise.js";
import { STOPS } from "./journey.js";

const GREAT = { x: -3, z: 3 };

const GROVE = [
  [33, -26, 1.0], [38, -19, 0.8], [29, -32, 0.72], [41, -27, 0.6],
  [-40, -4, 0.95], [-44, 5, 0.7], [-36, -12, 0.8],
  [2, -40, 1.0], [11, -42, 0.72], [-7, -36, 0.85], [20, -36, 0.65],
  [34, 31, 0.7], [-16, 4, 0.62], [14, -8, 0.7], [-20, 33, 0.6], [-26, -30, 0.75],
];

function distToSegment(px, pz, a, b) {
  const dx = b[0] - a[0], dz = b[2] - a[2];
  const t = Math.min(1, Math.max(0, ((px - a[0]) * dx + (pz - a[2]) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - (a[0] + dx * t), pz - (a[2] + dz * t));
}

/** Decide where trees stand. The grass uses `shade` to darken under them. */
export function planTrees() {
  const trees = [{ x: GREAT.x, z: GREAT.z, y: topHeight(GREAT.x, GREAT.z), s: 1, great: true }];
  for (const [x, z, s] of GROVE) {
    const r = Math.hypot(x, z);
    if (r > rimRadius(Math.atan2(z, x)) * 0.9) continue;
    if (pathDistance(x, z) < 3) continue;
    if (Object.values(PADS).some((p) => Math.hypot(x - p.x, z - p.z) < p.r + 1.5)) continue;
    // keep the sight line of every camera stop clear
    if (STOPS.slice(1, 5).some((st) => distToSegment(x, z, st.pos, st.target) < 7)) continue;
    trees.push({ x, z, y: topHeight(x, z), s, great: false });
  }
  for (const it of ISLETS) {
    if (!it.trees) continue;
    const top = it.p[1] + 0.25 * it.s * 0.85;
    for (let i = 0; i < it.trees; i++) {
      const a = it.seed + i * 2.4, rad = it.s * 0.32 * (i ? 1 : 0.2);
      trees.push({ x: it.p[0] + Math.cos(a) * rad, z: it.p[2] + Math.sin(a) * rad, y: top, s: 0.8 + (i % 2) * 0.35, great: false, islet: true });
    }
  }
  const shade = trees.filter((t) => !t.islet).map((t) => ({ x: t.x, z: t.z, r: t.great ? 13 : 4.6 * t.s }));
  return { trees, shade };
}

// ── geometry helpers ───────────────────────────────────────────────────────
function taperTube(points, r0, r1, sides = 9, segs = 14, flare = 0) {
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, segs, 1, sides, false);
  const p = geo.attributes.position;
  const c = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    curve.getPointAt(t, c);
    const r = (r0 + (r1 - r0) * t) * (1 + flare * Math.pow(1 - t, 6));
    for (let j = 0; j <= sides; j++) {
      const k = i * (sides + 1) + j;
      const x = p.getX(k) - c.x, y = p.getY(k) - c.y, z = p.getZ(k) - c.z;
      const n = 1 + noise3(c.x * 0.9 + j, c.y * 0.9, c.z * 0.9) * 0.16;
      p.setXYZ(k, c.x + x * r * n, c.y + y * r * n, c.z + z * r * n);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

function mergeInto(list, geo, matrix) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.applyMatrix4(matrix);
  list.pos.push(...g.attributes.position.array);
  list.nrm.push(...g.attributes.normal.array);
}

function lumpGeometry() {
  const g = new THREE.IcosahedronGeometry(1, 4);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const d = 1 + fbm3(x * 1.5 + 4, y * 1.5, z * 1.5 - 2, 3) * 0.42 + noise3(x * 4.2, y * 4.2, z * 4.2) * 0.07;
    p.setXYZ(i, x * d, y * d * 0.82, z * d);
  }
  return smoothNormals(g);
}

// ── foliage material: leafy colour break-up, soft bump, light through leaves ─
function foliageMaterial(env) {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.82, metalness: 0, side: THREE.DoubleSide });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = env.uTime;
    shader.uniforms.uWind = env.uWind;
    shader.uniforms.uSunDirW = env.uSunDir;
    shader.uniforms.uSunColW = env.uSunCol;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;\nuniform float uWind;\nvarying vec3 vWPos;")
      .replace(
        "#include <project_vertex>",
        /* glsl */ `
        vec4 fw = instanceMatrix * vec4(transformed, 1.0);
        float sway = sin(uTime * 1.1 + fw.x * 0.35 + fw.z * 0.27) * 0.11 + sin(uTime * 2.3 + fw.y * 0.8) * 0.04;
        transformed.x += sway * uWind * (0.5 + position.y);
        transformed.z += sway * uWind * 0.6 * (0.5 + position.y);
        vWPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        #include <project_vertex>`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        /* glsl */ `#include <common>
        varying vec3 vWPos;
        uniform vec3 uSunDirW, uSunColW;
        ${GLSL_NOISE}
        vec3 fBump(vec3 viewPos, vec3 n, float h, float scale){
          vec3 sx = dFdx(viewPos), sy = dFdy(viewPos);
          vec3 r1 = cross(sy, n), r2 = cross(n, sx);
          float det = dot(sx, r1);
          vec2 dh = vec2(dFdx(h), dFdy(h)) * scale;
          return normalize(abs(det) * n - sign(det) * (dh.x * r1 + dh.y * r2));
        }`
      )
      .replace(
        "#include <color_fragment>",
        /* glsl */ `#include <color_fragment>
        float fDist = length(vViewPosition);
        float fNear = 1.0 - smoothstep(30.0, 150.0, fDist);
        float fa = iFbm3(vWPos * 0.9);
        float fb = iNoise(vWPos * 3.4);
        float clump = smoothstep(0.3, 0.7, fb);
        // leaves, not balloons: break the silhouette and open gaps into the canopy
        float leaf = iNoise(vWPos * 6.0) * 0.6 + iNoise(vWPos * 14.0) * 0.4;
        float rimward = 1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition)));
        // only cut leaves out up close; further away the pattern would turn to grain
        float cutNear = 1.0 - smoothstep(20.0, 55.0, fDist);
        float cut = mix(0.16, 0.68, smoothstep(0.25, 0.95, rimward)) * cutNear;
        if (leaf < cut) discard;
        float depth = smoothstep(cut, cut + 0.3, leaf);
        diffuseColor.rgb *= (0.5 + fa * 0.6 + (clump - 0.5) * 0.35 * fNear) * mix(1.0, 0.55 + 0.45 * depth, cutNear);
        if (!gl_FrontFacing) diffuseColor.rgb *= 0.55;`
      )
      .replace(
        "#include <normal_fragment_maps>",
        /* glsl */ `#include <normal_fragment_maps>
        float fh = iNoise(vWPos * 2.3) * 0.9 + leaf * 0.7 * cutNear;
        normal = fBump(-vViewPosition, normal, fh, 2.2 * (0.3 + 0.7 * fNear));`
      )
      .replace(
        "#include <emissivemap_fragment>",
        /* glsl */ `#include <emissivemap_fragment>
        // sunlight coming through the canopy when you look toward the sun
        vec3 fView = normalize(vWPos - cameraPosition);
        float through = pow(max(dot(fView, uSunDirW), 0.0), 3.0);
        totalEmissiveRadiance += diffuseColor.rgb * uSunColW * through * 0.55;`
      );
  };
  mat.customProgramCacheKey = () => "isle-foliage";
  return mat;
}

export function buildFlora(env, plan, quality) {
  const group = new THREE.Group();
  const rand = rng(31337);
  const wood = { pos: [], nrm: [] };
  const blobs = []; // {p:Vector3, s:Vector3, color:Color}
  const m = new THREE.Matrix4();
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  const greens = ["#3f7a26", "#2f6a22", "#57882a", "#3a7230", "#6a8f2c"].map((c) => new THREE.Color(c));
  const gold = new THREE.Color("#c29a2a");
  const blossom = ["#ff9fc0", "#ffb7cf", "#ff86ad", "#ffd0de"].map((c) => new THREE.Color(c));

  for (const t of plan.trees) {
    const base = V(t.x, t.y - 0.25, t.z);
    m.makeTranslation(base.x, base.y, base.z);
    if (t.great) {
      // a leaning old trunk, flared roots, five boughs
      const top = V(1.4, 11.5, -0.8);
      mergeInto(wood, taperTube([V(0, 0, 0), V(0.5, 3.2, 0.3), V(0.3, 7, -0.5), top], 1.75, 0.8, 12, 22, 0.9), m);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + 0.3, len = 3.2 + rand() * 2.4;
        mergeInto(wood, taperTube(
          [V(Math.cos(a) * 0.9, 1.1, Math.sin(a) * 0.9), V(Math.cos(a) * len * 0.55, 0.35, Math.sin(a) * len * 0.55), V(Math.cos(a) * len, -0.5, Math.sin(a) * len)],
          0.5, 0.12, 7, 8), m);
      }
      const boughs = [[5.6, 4.2, 1.5], [-5.2, 4.8, 2.6], [1.8, 5.4, -5.6], [-3.4, 5.9, -4.2], [3.6, 6.6, 4.8], [-0.6, 7.4, 0.5]];
      for (const [bx, by, bz] of boughs) {
        const end = V(top.x + bx, top.y + by - 2.4, top.z + bz);
        const from = V(0.4 + bx * 0.05, 7.4 + rand() * 2.4, -0.4 + bz * 0.05);
        const mid = from.clone().lerp(end, 0.55).add(V(0, 1.1, 0));
        mergeInto(wood, taperTube([from, mid, end], 0.6, 0.16, 8, 10), m);
        const n = 8 + Math.floor(rand() * 4);
        for (let k = 0; k < n; k++) {
          const s = 1.7 + rand() * 1.9;
          blobs.push({
            p: V(base.x + end.x + (rand() - 0.5) * 4.4, base.y + end.y + (rand() - 0.3) * 2.6, base.z + end.z + (rand() - 0.5) * 4.4),
            s: V(s, s * (0.72 + rand() * 0.2), s),
            color: blossom[Math.floor(rand() * blossom.length)],
          });
        }
      }
      continue;
    }

    const s = t.s;
    const h = (4.2 + rand() * 2.2) * s;
    const lean = V((rand() - 0.5) * 1.4 * s, h, (rand() - 0.5) * 1.4 * s);
    mergeInto(wood, taperTube([V(0, 0, 0), V(lean.x * 0.3, h * 0.5, lean.z * 0.2), lean], 0.42 * s, 0.16 * s, 8, 10, 0.7), m);
    const tint = rand() < 0.14 ? gold : greens[Math.floor(rand() * greens.length)];
    const n = 8 + Math.floor(rand() * 4);
    for (let k = 0; k < n; k++) {
      const a = rand() * Math.PI * 2, rr = (k ? 0.9 + rand() * 1.5 : 0) * s;
      const bs = (1.05 + rand() * 0.85) * s;
      const end = V(lean.x + Math.cos(a) * rr, h + (k ? (rand() - 0.35) * 1.5 * s : 0.9 * s), lean.z + Math.sin(a) * rr);
      if (k && k < 4) mergeInto(wood, taperTube([V(lean.x * 0.6, h * 0.72, lean.z * 0.6), end.clone().multiplyScalar(0.8).add(V(0, h * 0.14, 0)), end], 0.13 * s, 0.05 * s, 6, 5), m);
      blobs.push({
        p: V(base.x + end.x, base.y + end.y, base.z + end.z),
        s: V(bs, bs * (0.75 + rand() * 0.2), bs),
        color: tint.clone().offsetHSL((rand() - 0.5) * 0.03, 0, (rand() - 0.5) * 0.08),
      });
    }
  }

  // one mesh for all wood
  const woodGeo = new THREE.BufferGeometry();
  woodGeo.setAttribute("position", new THREE.Float32BufferAttribute(wood.pos, 3));
  woodGeo.setAttribute("normal", new THREE.Float32BufferAttribute(wood.nrm, 3));
  const bark = makeRockMaterial({ ground: 0, topMask: 0, tint: new THREE.Color(0.62, 0.43, 0.3) });
  const woodMesh = new THREE.Mesh(woodGeo, bark);
  woodMesh.castShadow = true;
  woodMesh.receiveShadow = true;
  group.add(woodMesh);

  // one instanced mesh for all foliage
  const canopy = new THREE.InstancedMesh(lumpGeometry(), foliageMaterial(env), blobs.length);
  const q = new THREE.Quaternion(), e = new THREE.Euler();
  blobs.forEach((b, i) => {
    e.set(rand() * 0.5, rand() * 6.283, rand() * 0.5);
    m.compose(b.p, q.setFromEuler(e), b.s);
    canopy.setMatrixAt(i, m);
    canopy.setColorAt(i, b.color);
  });
  canopy.castShadow = true;
  canopy.receiveShadow = true;
  canopy.frustumCulled = false;
  group.add(canopy);

  // ── petals drifting down from the great tree ─────────────────────────────
  const great = plan.trees[0];
  const PN = quality.high ? 420 : 180;
  const pp = new Float32Array(PN * 3), ps = new Float32Array(PN * 3);
  for (let i = 0; i < PN; i++) {
    const a = rand() * Math.PI * 2, rr = Math.sqrt(rand()) * 16;
    pp[i * 3] = great.x + Math.cos(a) * rr;
    pp[i * 3 + 1] = rand();
    pp[i * 3 + 2] = great.z + Math.sin(a) * rr;
    ps[i * 3] = rand() * 6.283;
    ps[i * 3 + 1] = 0.5 + rand() * 0.8;
    ps[i * 3 + 2] = rand();
  }
  const petalGeo = new THREE.BufferGeometry();
  petalGeo.setAttribute("position", new THREE.BufferAttribute(pp, 3));
  petalGeo.setAttribute("aSeed", new THREE.BufferAttribute(ps, 3));
  const petals = new THREE.Points(petalGeo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: env.uTime, uBase: { value: great.y + 1 }, uSunCol: env.uSunCol, uAmbCol: env.uAmbCol, uScale: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute vec3 aSeed;
      uniform float uTime, uBase, uScale;
      varying float vFade;
      varying float vSpin;
      void main(){
        float t = fract(position.y + uTime * 0.035 * aSeed.y);
        vec3 p = position;
        p.y = uBase + (1.0 - t) * 20.0;
        p.x += sin(uTime * 0.6 + aSeed.x) * 1.6 + t * 7.0;
        p.z += cos(uTime * 0.5 + aSeed.x * 1.7) * 1.6 + t * 2.5;
        vFade = smoothstep(0.0, 0.08, t) * (1.0 - smoothstep(0.86, 1.0, t));
        vSpin = aSeed.x + uTime * (1.5 + aSeed.z * 2.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = uScale * (9.0 + aSeed.z * 8.0) / max(1.0, -mv.z * 0.06);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunCol, uAmbCol;
      varying float vFade;
      varying float vSpin;
      void main(){
        vec2 q = gl_PointCoord - 0.5;
        float c = cos(vSpin), s = sin(vSpin);
        q = vec2(q.x * c - q.y * s, q.x * s + q.y * c);
        q.y *= 1.0 + abs(sin(vSpin * 0.7)) * 2.2;       // tumble: the petal thins to an edge
        float a = 1.0 - smoothstep(0.36, 0.5, length(q * vec2(1.0, 1.25)));
        if (a < 0.02) discard;
        vec3 col = vec3(1.0, 0.72, 0.82) * (uAmbCol * 1.25 + uSunCol * 0.7);
        gl_FragColor = vec4(col, a * vFade);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  petals.frustumCulled = false;
  petals.renderOrder = 6;
  group.add(petals);

  // ── vines hanging from the rim ───────────────────────────────────────────
  const VN = quality.high ? 170 : 90;
  const vineGeo = new THREE.CylinderGeometry(0.07, 0.012, 1, 5, 6);
  vineGeo.translate(0, -0.5, 0);
  {
    const p = vineGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      p.setX(i, p.getX(i) + Math.sin(y * 9) * 0.02 * -y * 4);
      p.setZ(i, p.getZ(i) + Math.cos(y * 7) * 0.02 * -y * 4);
    }
    vineGeo.computeVertexNormals();
  }
  const vines = new THREE.InstancedMesh(vineGeo, new THREE.MeshStandardMaterial({ color: 0x2c4a1c, roughness: 0.9 }), VN);
  const vs = new THREE.Vector3(), vp = new THREE.Vector3();
  for (let i = 0; i < VN; i++) {
    const th = rand() * Math.PI * 2;
    const rr = rimRadius(th) * (0.93 + rand() * 0.07);
    const len = 4 + Math.pow(rand(), 2) * 22;
    vp.set(Math.cos(th) * rr, -1.2 - rand() * 2.5, Math.sin(th) * rr);
    e.set((rand() - 0.5) * 0.18, rand() * 6.283, (rand() - 0.5) * 0.18);
    vs.set(1 + rand() * 1.6, len, 1 + rand() * 1.6);
    m.compose(vp, q.setFromEuler(e), vs);
    vines.setMatrixAt(i, m);
  }
  vines.castShadow = true;
  group.add(vines);

  return {
    group,
    resize(dpr) { petals.material.uniforms.uScale.value = dpr; },
  };
}
