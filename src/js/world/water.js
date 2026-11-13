// A pond near the rim, the stream that leaves it, and the fall off the edge.
import * as THREE from "three";
import { topHeight, rimRadius, PADS } from "./island.js";
import { GLSL_NOISE } from "./noise.js";

export function buildWater(env) {
  const group = new THREE.Group();
  const pond = PADS.pond;
  const dir = new THREE.Vector2(Math.cos(pond.angle), Math.sin(pond.angle));
  const side = new THREE.Vector2(-dir.y, dir.x);
  const level = pond.h + 0.55;

  const uniforms = {
    uTime: env.uTime,
    uSunDir: env.uSunDir,
    uSunCol: env.uSunCol,
    uAmbCol: env.uAmbCol,
    uSky: env.uZenith,
    uHorizon: env.uHorizon,
  };

  const vertexShader = /* glsl */ `
    varying vec2 vUv;
    varying vec3 vW;
    void main(){
      vUv = uv;
      vec4 w = modelMatrix * vec4(position, 1.0);
      vW = w.xyz;
      gl_Position = projectionMatrix * viewMatrix * w;
    }`;

  // still water: sky colour, moving ripples, a sun glint
  const pondMat = new THREE.ShaderMaterial({
    transparent: true,
    uniforms,
    vertexShader,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uSunDir, uSunCol, uAmbCol, uSky, uHorizon;
      varying vec2 vUv;
      varying vec3 vW;
      ${GLSL_NOISE}
      void main(){
        vec2 p = vW.xz;
        float n1 = iNoise(vec3(p * 1.4 + uTime * 0.25, uTime * 0.3));
        float n2 = iNoise(vec3(p * 3.7 - uTime * 0.4, uTime * 0.5));
        vec3 nrm = normalize(vec3((n1 - 0.5) * 0.35 + (n2 - 0.5) * 0.18, 1.0, (n2 - 0.5) * 0.35 + (n1 - 0.5) * 0.18));
        vec3 view = normalize(cameraPosition - vW);
        float fres = pow(1.0 - max(dot(view, nrm), 0.0), 3.0);
        vec3 deep = vec3(0.02, 0.11, 0.12);
        vec3 sky = mix(uHorizon, uSky, 0.55);
        vec3 col = mix(deep, sky, 0.35 + fres * 0.6) * (uAmbCol * 1.6 + uSunCol * 0.5);
        vec3 h = normalize(view + uSunDir);
        col += uSunCol * pow(max(dot(nrm, h), 0.0), 220.0) * 2.5;
        float edge = smoothstep(1.0, 0.86, length(vUv - 0.5) * 2.0);
        gl_FragColor = vec4(col, 0.9 * edge);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const pondMesh = new THREE.Mesh(new THREE.CircleGeometry(6.2, 48), pondMat);
  pondMesh.rotation.x = -Math.PI / 2;
  pondMesh.position.set(pond.x, level, pond.z);
  group.add(pondMesh);

  // moving water: streaks that run along v
  const flowMat = new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    uniforms,
    vertexShader,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uSunCol, uAmbCol, uSky;
      varying vec2 vUv;
      varying vec3 vW;
      ${GLSL_NOISE}
      void main(){
        float fall = smoothstep(0.16, 0.24, vUv.y);       // stream on the ground, then free fall
        float speed = mix(1.1, 3.4, fall);
        float streak = iFbm3(vec3(vUv.x * 7.0, vUv.y * mix(18.0, 9.0, fall) - uTime * speed, 1.3));
        float fine = iNoise(vec3(vUv.x * 26.0, vUv.y * 40.0 - uTime * speed * 2.4, 4.0));
        float across = smoothstep(0.0, 0.34, vUv.x) * smoothstep(1.0, 0.66, vUv.x);
        float body = smoothstep(0.28, 0.7, streak * 0.75 + fine * 0.35);
        float a = across * mix(0.8, 0.25 + body * 0.75, fall);
        a *= 1.0 - smoothstep(0.62, 1.0, vUv.y);           // dissolve into mist
        vec3 water = mix(vec3(0.05, 0.2, 0.22), uSky * 0.6 + 0.15, 0.5);
        vec3 foam = vec3(0.92, 0.96, 1.0);
        vec3 col = mix(water, foam, clamp(fall * (0.35 + body * 0.75) + fine * 0.2, 0.0, 1.0));
        vec3 light = uAmbCol * 1.5 + uSunCol * 0.75;
        light = mix(light, vec3(dot(light, vec3(0.333))), 0.6);   // water stays pale, whatever the sun is doing
        col *= light;
        a *= mix(1.0, 0.55 + 0.45 * streak, fall);
        gl_FragColor = vec4(col, a * 0.92);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });

  // one ribbon: along the ground from the pond to the rim, then over the edge
  const rim = rimRadius(pond.angle);
  const startR = Math.hypot(pond.x, pond.z) + 4.6;
  const GROUND = 10, FALL = 46, ACROSS = 6;
  const rows = GROUND + FALL + 1;
  const pos = new Float32Array(rows * (ACROSS + 1) * 3);
  const uv = new Float32Array(rows * (ACROSS + 1) * 2);
  let lipY = 0;
  for (let i = 0; i < rows; i++) {
    let cx, cy, cz, width;
    if (i <= GROUND) {
      const t = i / GROUND;
      const rad = startR + (rim - 0.6 - startR) * t;
      cx = dir.x * rad; cz = dir.y * rad;
      cy = Math.min(level, topHeight(cx, cz) + 0.22);
      width = 0.9 + t * 0.3;
      lipY = cy;
    } else {
      const t = (i - GROUND) / FALL;
      const out = rim - 0.6 + Math.pow(t, 0.55) * 8.5 + t * 4;
      cx = dir.x * out; cz = dir.y * out;
      cy = lipY - t * 3 - t * t * 66;
      width = 1.2 + t * 2.4;
    }
    for (let j = 0; j <= ACROSS; j++) {
      const a = j / ACROSS - 0.5;
      const k = i * (ACROSS + 1) + j;
      pos[k * 3] = cx + side.x * a * width;
      pos[k * 3 + 1] = cy;
      pos[k * 3 + 2] = cz + side.y * a * width;
      uv[k * 2] = j / ACROSS;
      uv[k * 2 + 1] = i / (rows - 1);
    }
  }
  const idx = [];
  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < ACROSS; j++) {
      const a = i * (ACROSS + 1) + j, b = a + 1, c = a + ACROSS + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const flow = new THREE.Mesh(geo, flowMat);
  flow.renderOrder = 4;
  group.add(flow);

  return { group };
}
