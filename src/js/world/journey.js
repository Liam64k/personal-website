// The flight: six camera stops and six light states, one per chapter.
// A day passes as you scroll — morning at the top, sunset at the landing.
import * as THREE from "three";
import { topHeight, rimRadius } from "./island.js";

const C = (hex) => new THREE.Color(hex);

export const STOPS = [
  { id: "hero", pos: [26, 36, 198], target: [0, -13, 0], fov: 38, shift: 0.12, lift: 0 },
  { id: "summit", pos: [-45, 33, 15], target: [-13, 24.5, -17], fov: 40, shift: 0.14, lift: 15 },
  { id: "workshop", pos: [49, 12, 17], target: [25, 9.4, -9], fov: 40, shift: -0.15, lift: 9, narrow: [57, 21, 2] },
  { id: "lab", pos: [15, 12, 60], target: [11, 6.4, 26], fov: 42, shift: 0.25, lift: 7 },
  { id: "towers", pos: [-8, 8.6, 42], target: [-30, 16, 18], fov: 42, shift: -0.15, lift: 12 },
  { id: "landing", pos: [106, 22, 82], target: [8, 5, -2], fov: 36, shift: 0.12, lift: 0 },
];

const LIGHT = [
  { // hero — morning
    elev: 38, az: 62, sun: C("#fff0d6"), sunPower: 3.0,
    hemiSky: C("#bfd9ff"), hemiGround: C("#70805c"), hemiPower: 1.2,
    zenith: C("#1552bd"), horizon: C("#8fc2f0"), below: C("#cfe4f7"),
    cloudLit: C("#ffffff"), cloudShade: C("#7f9fd0"),
    fog: C("#b3d0ec"), fogDen: 0.0011, exposure: 1.0, dusk: 0,
  },
  { // summit
    elev: 48, az: 82, sun: C("#fff4e2"), sunPower: 3.2,
    hemiSky: C("#bfd9ff"), hemiGround: C("#70805c"), hemiPower: 1.2,
    zenith: C("#1450bc"), horizon: C("#8cc0ef"), below: C("#cfe4f7"),
    cloudLit: C("#ffffff"), cloudShade: C("#7f9fd0"),
    fog: C("#b3d0ec"), fogDen: 0.0011, exposure: 1.0, dusk: 0,
  },
  { // workshop — noon
    elev: 56, az: 104, sun: C("#fff6e8"), sunPower: 3.3,
    hemiSky: C("#c2dbff"), hemiGround: C("#74825e"), hemiPower: 1.2,
    zenith: C("#1552be"), horizon: C("#90c3f0"), below: C("#d2e5f7"),
    cloudLit: C("#ffffff"), cloudShade: C("#82a1d0"),
    fog: C("#b6d2ec"), fogDen: 0.0011, exposure: 1.0, dusk: 0.03,
  },
  { // lab — afternoon
    elev: 40, az: 160, sun: C("#ffe9c6"), sunPower: 3.1,
    hemiSky: C("#bcd2f6"), hemiGround: C("#76795a"), hemiPower: 1.1,
    zenith: C("#2459b4"), horizon: C("#bcd3e8"), below: C("#e3e6ea"),
    cloudLit: C("#fff8ec"), cloudShade: C("#8d9fc0"),
    fog: C("#c0d0e0"), fogDen: 0.0012, exposure: 1.0, dusk: 0.15,
  },
  { // towers — golden hour
    elev: 13, az: 214, sun: C("#ffae6a"), sunPower: 2.9,
    hemiSky: C("#a9b5e8"), hemiGround: C("#7c6c5a"), hemiPower: 1.15,
    zenith: C("#2e4b9a"), horizon: C("#f3c69a"), below: C("#e8c6b4"),
    cloudLit: C("#ffe0bd"), cloudShade: C("#7c82ad"),
    fog: C("#dfbfa8"), fogDen: 0.0013, exposure: 1.05, dusk: 0.6,
  },
  { // landing — sunset
    elev: 5.5, az: 222, sun: C("#ff8748"), sunPower: 2.6,
    hemiSky: C("#a3addf"), hemiGround: C("#7d665c"), hemiPower: 1.35,
    zenith: C("#273f8c"), horizon: C("#ffb07a"), below: C("#e7b7a6"),
    cloudLit: C("#ffc9a0"), cloudShade: C("#6f73a6"),
    fog: C("#e2ad94"), fogDen: 0.0014, exposure: 1.2, dusk: 1,
  },
];

const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;

/** Shared uniforms: every shader in the world reads its light from these. */
export function createEnv() {
  return {
    uTime: { value: 0 },
    uWind: { value: 1 },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunCol: { value: new THREE.Color() },
    uAmbCol: { value: new THREE.Color() },
    uFogCol: { value: new THREE.Color() },
    uFogDen: { value: 0.001 },
    uZenith: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uBelow: { value: new THREE.Color() },
    uCloudLit: { value: new THREE.Color() },
    uCloudShade: { value: new THREE.Color() },
    dusk: 0,
    exposure: 1,
  };
}

const tmpA = new THREE.Color();

/** Blend the two neighbouring light states into the env, lights and fog. */
export function applyLight(c, env, sun, hemi, scene) {
  const i = Math.min(LIGHT.length - 2, Math.max(0, Math.floor(c)));
  const t = smoother(Math.min(1, Math.max(0, c - i)));
  const a = LIGHT[i], b = LIGHT[i + 1];

  const elev = THREE.MathUtils.degToRad(lerp(a.elev, b.elev, t));
  const az = THREE.MathUtils.degToRad(lerp(a.az, b.az, t));
  env.uSunDir.value.set(Math.cos(elev) * Math.cos(az), Math.sin(elev), Math.cos(elev) * Math.sin(az));

  const power = lerp(a.sunPower, b.sunPower, t);
  sun.color.copy(a.sun).lerp(b.sun, t);
  sun.intensity = power;
  sun.position.copy(env.uSunDir.value).multiplyScalar(170);
  env.uSunCol.value.copy(sun.color).multiplyScalar(power / Math.PI);

  const hp = lerp(a.hemiPower, b.hemiPower, t);
  hemi.color.copy(a.hemiSky).lerp(b.hemiSky, t);
  hemi.groundColor.copy(a.hemiGround).lerp(b.hemiGround, t);
  hemi.intensity = hp * 0.72; // the sky reflection map supplies the rest
  env.uAmbCol.value.copy(hemi.color).multiplyScalar(hp / Math.PI);

  env.uZenith.value.copy(a.zenith).lerp(b.zenith, t);
  env.uHorizon.value.copy(a.horizon).lerp(b.horizon, t);
  env.uBelow.value.copy(a.below).lerp(b.below, t);
  env.uCloudLit.value.copy(a.cloudLit).lerp(b.cloudLit, t);
  env.uCloudShade.value.copy(a.cloudShade).lerp(b.cloudShade, t);

  tmpA.copy(a.fog).lerp(b.fog, t);
  env.uFogCol.value.copy(tmpA);
  env.uFogDen.value = lerp(a.fogDen, b.fogDen, t);
  scene.fog.color.copy(tmpA);
  scene.fog.density = env.uFogDen.value;

  env.dusk = lerp(a.dusk, b.dusk, t);
  env.exposure = lerp(a.exposure, b.exposure, t);
}

const P = new THREE.Vector3(), T = new THREE.Vector3();
const P2 = new THREE.Vector3(), T2 = new THREE.Vector3();

/**
 * Camera state at fractional chapter c. `narrow` pulls the camera back and
 * widens the lens for tall phone screens.
 */
export function cameraAt(c, narrow, out) {
  const i = Math.min(STOPS.length - 2, Math.max(0, Math.floor(c)));
  const t = smoother(Math.min(1, Math.max(0, c - i)));
  const a = STOPS[i], b = STOPS[i + 1];

  P.fromArray(a.pos); T.fromArray(a.target);
  P2.fromArray(b.pos); T2.fromArray(b.target);
  if (narrow) {
    // phones: a stop can name its own camera position, otherwise just step back
    if (a.narrow) P.fromArray(a.narrow);
    else if (i > 0) P.sub(T).multiplyScalar(1.5).add(T);
    if (b.narrow) P2.fromArray(b.narrow);
    else P2.sub(T2).multiplyScalar(1.5).add(T2);
  }
  out.pos.copy(P).lerp(P2, t);
  out.target.copy(T).lerp(T2, t);
  out.pos.y += Math.sin(Math.PI * t) * b.lift;

  // never dip into the ground while crossing the island
  const r = Math.hypot(out.pos.x, out.pos.z);
  if (r < rimRadius(Math.atan2(out.pos.z, out.pos.x)) * 0.98) {
    const floor = topHeight(out.pos.x, out.pos.z) + 3;
    if (out.pos.y < floor) out.pos.y = floor;
  }

  out.fov = lerp(a.fov, b.fov, t) + (narrow ? 12 : 0);
  out.shift = narrow ? 0 : lerp(a.shift, b.shift, t);
  out.rise = narrow ? 0.2 : 0;
  return out;
}
