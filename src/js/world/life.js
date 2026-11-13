// Small moving things: birds circling the island and motes of light over the
// grass that turn into fireflies as the sun goes down.
import * as THREE from "three";
import { topHeight, rimRadius } from "./island.js";
import { rng } from "./noise.js";

export function buildLife(env, quality) {
  const group = new THREE.Group();
  const rand = rng(8128);

  // ── birds: two triangles each, flown entirely in the vertex shader ───────
  const flocks = [
    { c: [0, 34, 0], r: 78, n: 9, speed: 0.11 },
    { c: [40, 58, -60], r: 120, n: 7, speed: -0.07 },
    { c: [-70, 20, 50], r: 60, n: 6, speed: 0.13 },
  ];
  const count = flocks.reduce((s, f) => s + f.n, 0);
  const birdGeo = new THREE.InstancedBufferGeometry();
  // body centre, wing tips; x = side (-1, 0, 1), z = along the body
  birdGeo.setAttribute("position", new THREE.Float32BufferAttribute([
    0, 0, 0.45, 0, 0, -0.5, -1, 0, -0.1,
    0, 0, 0.45, 1, 0, -0.1, 0, 0, -0.5,
  ], 3));
  const orbit = new Float32Array(count * 4), about = new Float32Array(count * 4);
  let k = 0;
  for (const f of flocks) {
    for (let i = 0; i < f.n; i++) {
      orbit[k * 4] = f.c[0]; orbit[k * 4 + 1] = f.c[1] + (rand() - 0.5) * 9; orbit[k * 4 + 2] = f.c[2];
      orbit[k * 4 + 3] = f.r + (rand() - 0.5) * 16;
      about[k * 4] = (i / f.n) * 0.9 + rand() * 0.2;  // place in the flock
      about[k * 4 + 1] = f.speed * (0.9 + rand() * 0.2);
      about[k * 4 + 2] = rand() * 6.283;              // flap phase
      about[k * 4 + 3] = 1.1 + rand() * 0.6;          // size
      k++;
    }
  }
  birdGeo.setAttribute("aOrbit", new THREE.InstancedBufferAttribute(orbit, 4));
  birdGeo.setAttribute("aAbout", new THREE.InstancedBufferAttribute(about, 4));
  birdGeo.instanceCount = count;
  const birds = new THREE.Mesh(birdGeo, new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uTime: env.uTime, uAmbCol: env.uAmbCol, uFogCol: env.uFogCol },
    vertexShader: /* glsl */ `
      attribute vec4 aOrbit;
      attribute vec4 aAbout;
      uniform float uTime;
      varying float vDist;
      void main(){
        float a = aAbout.x + uTime * aAbout.y;
        float dir = sign(aAbout.y);
        vec3 centre = aOrbit.xyz + vec3(cos(a) * aOrbit.w, sin(uTime * 0.3 + aAbout.z) * 2.0, sin(a) * aOrbit.w);
        vec3 fwd = vec3(-sin(a), 0.0, cos(a)) * dir;
        vec3 side = vec3(fwd.z, 0.0, -fwd.x);
        float flap = sin(uTime * 7.0 + aAbout.z);
        float glide = smoothstep(-0.2, 0.6, sin(uTime * 0.5 + aAbout.z * 3.0));   // some of the time they just soar
        float lift = abs(position.x) * mix(flap * 0.55, 0.12, glide);
        vec3 p = centre + (side * position.x * 1.25 + fwd * position.z + vec3(0.0, lift, 0.0)) * aAbout.w;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        vDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uAmbCol, uFogCol;
      varying float vDist;
      void main(){
        vec3 col = vec3(0.05, 0.055, 0.07) * (0.6 + uAmbCol);
        col = mix(col, uFogCol, 1.0 - exp(-vDist * vDist * 0.0000035));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  birds.frustumCulled = false;
  group.add(birds);

  // ── motes / fireflies ────────────────────────────────────────────────────
  const N = quality.high ? 340 : 140;
  const pos = new Float32Array(N * 3), seed = new Float32Array(N * 3);
  let n = 0, guard = 0;
  while (n < N && guard++ < N * 20) {
    const th = rand() * Math.PI * 2;
    const rad = Math.sqrt(rand()) * rimRadius(th) * 0.92;
    const x = Math.cos(th) * rad, z = Math.sin(th) * rad;
    pos[n * 3] = x;
    pos[n * 3 + 1] = topHeight(x, z) + 0.5 + Math.pow(rand(), 1.6) * 6.5;
    pos[n * 3 + 2] = z;
    seed[n * 3] = rand() * 6.283;
    seed[n * 3 + 1] = 0.4 + rand();
    seed[n * 3 + 2] = rand();
    n++;
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  moteGeo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 3));
  const uDusk = { value: 0 };
  const uScale = { value: 1 };
  const motes = new THREE.Points(moteGeo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: env.uTime, uDusk, uScale },
    vertexShader: /* glsl */ `
      attribute vec3 aSeed;
      uniform float uTime, uDusk, uScale;
      varying float vGlow;
      void main(){
        vec3 p = position;
        p.x += sin(uTime * 0.35 * aSeed.y + aSeed.x) * 1.4;
        p.y += sin(uTime * 0.5 * aSeed.y + aSeed.x * 2.1) * 0.7;
        p.z += cos(uTime * 0.3 * aSeed.y + aSeed.x * 1.3) * 1.4;
        float blink = 0.5 + 0.5 * sin(uTime * (1.2 + aSeed.z * 2.5) + aSeed.x * 5.0);
        vGlow = mix(0.1, 0.35 + blink * 0.9, uDusk) * step(aSeed.z, 0.35 + uDusk * 0.65);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = uScale * mix(5.0, 15.0, uDusk) * (0.6 + aSeed.z) / max(1.0, -mv.z * 0.045);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uDusk;
      varying float vGlow;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = 1.0 - smoothstep(0.0, 0.5, d);
        vec3 col = mix(vec3(1.0, 0.97, 0.85), vec3(1.0, 0.82, 0.35), uDusk);
        gl_FragColor = vec4(col * a * a * vGlow * (1.0 + uDusk * 2.5), 1.0);
      }`,
  }));
  motes.frustumCulled = false;
  motes.renderOrder = 7;
  group.add(motes);

  return {
    group,
    update(dusk) { uDusk.value = dusk; },
    resize(dpr) { uScale.value = dpr; },
  };
}
