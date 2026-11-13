// The five stops on the island: summit cairn, forge-tower workshop, lab screens,
// beacon towers and the landing jetty.
import * as THREE from "three";
import { topHeight, makeRockMaterial, smoothNormals, PADS, SUMMIT } from "./island.js";
import { noise3, rng } from "./noise.js";

const rand = rng(5150);

function glowTexture() {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 128;
  const ctx = cv.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.18, "rgba(255,255,255,0.55)");
  g.addColorStop(0.45, "rgba(255,255,255,0.14)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function roughen(geo, amount, freq, seed = 0) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = noise3(x * freq + seed, y * freq, z * freq - seed) * amount;
    const l = Math.hypot(x, z) || 1;
    p.setXYZ(i, x + (x / l) * n, y, z + (z / l) * n);
  }
  geo.computeVertexNormals();
  return geo;
}

function shadowed(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// ── Summit: a cairn and a pennant ──────────────────────────────────────────
function buildSummit(stone, env) {
  let best = { x: SUMMIT.x, z: SUMMIT.z, h: -1e9 };
  for (let dx = -6; dx <= 6; dx += 0.5) {
    for (let dz = -6; dz <= 6; dz += 0.5) {
      const h = topHeight(SUMMIT.x + dx, SUMMIT.z + dz);
      if (h > best.h) best = { x: SUMMIT.x + dx, z: SUMMIT.z + dz, h };
    }
  }
  const g = new THREE.Group();
  g.position.set(best.x, best.h - 0.15, best.z);

  let y = 0;
  const sizes = [1.05, 0.9, 0.74, 0.6, 0.46, 0.32];
  sizes.forEach((s, i) => {
    const geo = smoothNormals(roughen(new THREE.IcosahedronGeometry(1, 2), 0.22, 1.4, i * 3.1));
    const m = shadowed(new THREE.Mesh(geo, stone));
    m.scale.set(s * 1.25, s * 0.52, s * 1.1);
    y += s * 0.42;
    m.position.set((rand() - 0.5) * 0.18, y, (rand() - 0.5) * 0.18);
    m.rotation.y = rand() * 6.28;
    y += s * 0.4;
    g.add(m);
  });

  const pole = shadowed(new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.05, 4.4, 6),
    new THREE.MeshStandardMaterial({ color: 0xd9d2c4, roughness: 0.6 })
  ));
  pole.position.set(0.9, 2.2, -0.3);
  g.add(pole);

  const flagGeo = new THREE.PlaneGeometry(1.5, 0.8, 14, 4);
  flagGeo.translate(0.75, 0, 0);
  const flag = new THREE.Mesh(flagGeo, new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uTime: env.uTime, uSunCol: env.uSunCol, uAmbCol: env.uAmbCol },
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying float vShade;
      varying vec2 vUv;
      void main(){
        vec3 p = position;
        float w = p.x / 1.5;
        float wave = sin(p.x * 4.2 - uTime * 5.0) * 0.16 + sin(p.x * 2.1 - uTime * 3.1 + p.y * 3.0) * 0.1;
        p.z += wave * w;
        p.y += sin(p.x * 3.0 - uTime * 4.0) * 0.05 * w - w * w * 0.12;
        p.y *= 1.0 - w * 0.75; // taper to a pennant
        vShade = 0.75 + wave * 1.4 * w;
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunCol, uAmbCol;
      varying float vShade;
      varying vec2 vUv;
      void main(){
        vec3 base = vec3(0.93, 0.19, 0.08);
        vec3 col = base * (uAmbCol * 0.8 + uSunCol * 0.55) * vShade;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  flag.position.set(0.9, 4.0, -0.3);
  flag.rotation.y = -0.5;
  g.add(flag);

  return { group: g, focus: new THREE.Vector3(best.x, best.h + 2, best.z) };
}

// ── Workshop: a round stone forge-tower with a copper roof and a wind rotor ─
function lathe(profile, seg = 56) {
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg);
}

function archShape(w, h) {
  const s = new THREE.Shape();
  const r = w / 2;
  s.moveTo(-r, 0);
  s.lineTo(-r, h - r);
  s.absarc(0, h - r, r, Math.PI, 0, true);
  s.lineTo(r, 0);
  s.closePath();
  return s;
}

function patinaTexture() {
  const cv = document.createElement("canvas");
  cv.width = 512; cv.height = 256;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#4aa893";
  ctx.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 420; i++) {
    const x = rand() * 512, w = 1 + rand() * 5, top = rand() * 120;
    const g = ctx.createLinearGradient(0, top, 0, 256);
    const dark = rand() < 0.45;
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, dark ? `rgba(30,70,62,${0.25 + rand() * 0.35})` : `rgba(150,225,200,${0.15 + rand() * 0.3})`);
    ctx.fillStyle = g;
    ctx.fillRect(x, top, w, 256 - top);
  }
  // seams between copper sheets
  ctx.fillStyle = "rgba(20,50,45,0.55)";
  for (let i = 0; i < 16; i++) ctx.fillRect(i * 32, 0, 2, 256);
  for (let j = 0; j < 4; j++) ctx.fillRect(0, j * 64 + 20, 512, 2);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(3, 1);
  t.anisotropy = 4;
  return t;
}

function signTexture(text) {
  const cv = document.createElement("canvas");
  cv.width = 512; cv.height = 128;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#2a1c12";
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = "#c98a4a";
  ctx.lineWidth = 5;
  ctx.strokeRect(8, 8, 496, 112);
  ctx.fillStyle = "#f4e3c4";
  ctx.font = '600 58px "Fraunces", Georgia, serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 68);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function buildWorkshop(stone, glowTex) {
  const pad = PADS.workshop;
  const g = new THREE.Group();
  g.position.set(pad.x, topHeight(pad.x, pad.z) - 0.1, pad.z);
  g.rotation.y = 0.76; // the door faces the camera stop

  const timber = new THREE.MeshStandardMaterial({ color: 0x33221a, roughness: 0.85 });
  const plaster = new THREE.MeshStandardMaterial({ color: 0xe6dcc6, roughness: 0.92 });
  const copper = new THREE.MeshStandardMaterial({ color: 0xc27a45, roughness: 0.32, metalness: 1 });
  const patina = new THREE.MeshStandardMaterial({
    map: patinaTexture(), roughness: 0.5, metalness: 0.55, side: THREE.DoubleSide,
  });
  const glass = new THREE.MeshBasicMaterial({ color: 0xffc27a });
  const fire = new THREE.MeshBasicMaterial({ color: 0xff7a2a });

  const add = (geo, mat, y = 0) => {
    const m = shadowed(new THREE.Mesh(geo, mat));
    m.position.y = y;
    g.add(m);
    return m;
  };

  // masonry drum on a plinth
  add(roughen(lathe([[0, 0], [3.9, 0], [3.9, 0.45], [3.5, 0.75]], 40), 0.06, 1.4), stone);
  add(roughen(new THREE.CylinderGeometry(3.02, 3.42, 5.0, 56, 18, true), 0.07, 1.1, 4), stone, 3.2);
  add(lathe([[3.0, 5.6], [3.42, 5.78], [3.42, 6.1], [3.2, 6.25]]), timber);

  // timber-framed upper room
  add(new THREE.CylinderGeometry(3.3, 3.22, 2.45, 56, 1, true), plaster, 7.45);
  const POSTS = 12;
  for (let i = 0; i < POSTS; i++) {
    const a = (i / POSTS) * Math.PI * 2;
    const post = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.5, 0.16), timber));
    post.position.set(Math.sin(a) * 3.3, 7.45, Math.cos(a) * 3.3);
    post.rotation.y = a;
    g.add(post);
  }
  add(lathe([[3.24, 8.55], [3.46, 8.62], [3.46, 8.85], [3.24, 8.92]]), timber);

  // lit windows between the posts
  const paneGeo = new THREE.ShapeGeometry(archShape(0.86, 1.5), 10);
  const frameGeo = new THREE.ShapeGeometry(archShape(1.08, 1.7), 10);
  for (let i = 0; i < POSTS; i += 2) {
    const a = ((i + 0.5) / POSTS) * Math.PI * 2;
    for (const [geo, mat, r, y] of [[frameGeo, timber, 3.31, 6.55], [paneGeo, glass, 3.33, 6.65]]) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(Math.sin(a) * r, y, Math.cos(a) * r);
      m.rotation.y = a;
      g.add(m);
    }
  }

  // witch-hat roof in green copper, with a wide flared eave
  add(lathe([
    [4.75, 8.5], [4.5, 8.62], [3.85, 9.05], [3.0, 9.9], [2.15, 11.0],
    [1.4, 12.3], [0.8, 13.6], [0.36, 14.8], [0.12, 15.7], [0, 15.9],
  ], 64), patina);
  add(new THREE.SphereGeometry(0.3, 20, 14), copper, 16.0);

  // door, steps and a hanging sign
  const door = new THREE.Mesh(new THREE.ShapeGeometry(archShape(1.5, 2.7), 12), timber);
  door.position.set(0, 0.72, 3.36);
  g.add(door);
  const doorGlow = new THREE.Mesh(new THREE.ShapeGeometry(archShape(0.5, 0.7), 8), glass);
  doorGlow.position.set(0, 2.3, 3.39);
  g.add(doorGlow);
  for (let i = 0; i < 3; i++) {
    const st = shadowed(new THREE.Mesh(roughen(new THREE.BoxGeometry(2.6 - i * 0.3, 0.24, 0.8, 5, 1, 2), 0.04, 2.2, i), stone));
    st.position.set(0, 0.12 + i * 0.22, 4.9 - i * 0.62);
    g.add(st);
  }
  const arm = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.9), timber));
  arm.position.set(1.9, 4.1, 3.75);
  g.add(arm);
  const sign = shadowed(new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 0.66, 0.08),
    [timber, timber, timber, timber,
      new THREE.MeshStandardMaterial({ map: signTexture("Heating Media"), roughness: 0.8 }), timber]
  ));
  sign.position.set(1.9, 3.6, 4.55);
  g.add(sign);

  // the forge mouth: a round grate with fire behind it
  const mouthA = -1.05;
  const mouth = new THREE.Group();
  mouth.position.set(Math.sin(mouthA) * 3.33, 2.2, Math.cos(mouthA) * 3.33);
  mouth.rotation.y = mouthA;
  mouth.add(new THREE.Mesh(new THREE.CircleGeometry(0.85, 28), fire));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.13, 10, 32), copper);
  mouth.add(rim);
  for (let i = -2; i <= 2; i++) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.75, 6), timber);
    bar.position.set(i * 0.3, 0, 0.05);
    mouth.add(bar);
  }
  const mouthGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: 0xff8a3a, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, opacity: 0.55,
  }));
  mouthGlow.scale.set(5, 5, 1);
  mouthGlow.position.z = 0.4;
  mouth.add(mouthGlow);
  g.add(mouth);

  // copper flue: out of the wall, round the drum and up past the eave
  const fluePts = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const a = mouthA - 0.5 - t * 1.25;
    const r = 3.55 + Math.sin(Math.min(1, t * 2.4) * Math.PI * 0.5) * 1.75;
    fluePts.push(new THREE.Vector3(Math.sin(a) * r, 3.3 + Math.pow(t, 1.5) * 8.6, Math.cos(a) * r));
  }
  const flueCurve = new THREE.CatmullRomCurve3(fluePts);
  g.add(shadowed(new THREE.Mesh(new THREE.TubeGeometry(flueCurve, 60, 0.26, 12), copper)));
  const flueTop = fluePts[fluePts.length - 1];
  const cowl = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.3, 0.5, 14), copper));
  cowl.position.copy(flueTop);
  g.add(cowl);
  for (const t of [0.22, 0.5, 0.78]) {
    const p = flueCurve.getPointAt(t);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 8, 18), timber);
    band.position.copy(p);
    band.lookAt(p.clone().add(flueCurve.getTangentAt(t)));
    g.add(band);
  }

  // wind rotor on the spire
  const rotor = new THREE.Group();
  rotor.position.set(0, 14.9, 0.55);
  const sail = new THREE.MeshStandardMaterial({ color: 0xf2e8d5, roughness: 0.9, side: THREE.DoubleSide });
  for (let i = 0; i < 5; i++) {
    const blade = new THREE.Group();
    blade.rotation.z = (i / 5) * Math.PI * 2;
    const spar = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.1, 0.08), timber));
    spar.position.y = 1.55;
    blade.add(spar);
    const cloth = shadowed(new THREE.Mesh(new THREE.PlaneGeometry(0.62, 2.2), sail));
    cloth.position.set(0.34, 1.95, 0);
    cloth.rotation.y = 0.32;
    blade.add(cloth);
    rotor.add(blade);
  }
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), copper);
  rotor.add(hub);
  g.add(rotor);

  // heavy bag on a timber frame: the training business
  const frame = new THREE.Group();
  frame.position.set(6.4, 0.1, 2.2);
  frame.rotation.y = -0.35;
  for (const x of [-1.15, 1.15]) {
    const post = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 3.4, 8), timber));
    post.position.set(x, 1.7, 0);
    frame.add(post);
  }
  const beam = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.9, 8), timber));
  beam.rotation.z = Math.PI / 2;
  beam.position.y = 3.35;
  frame.add(beam);
  const swing = new THREE.Group();
  swing.position.y = 3.25;
  const chain = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.7, 5),
    new THREE.MeshStandardMaterial({ color: 0x8a8a8a, metalness: 1, roughness: 0.35 })
  );
  chain.position.y = -0.35;
  swing.add(chain);
  const bag = shadowed(new THREE.Mesh(
    new THREE.CapsuleGeometry(0.36, 1.05, 8, 18),
    new THREE.MeshStandardMaterial({ color: 0x6a1c12, roughness: 0.42 })
  ));
  bag.position.y = -1.55;
  swing.add(bag);
  frame.add(swing);
  g.add(frame);

  // steam from the flue, embers from the forge mouth
  const steam = [];
  for (let i = 0; i < 14; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xf2efe9, transparent: true, depthWrite: false, opacity: 0,
    }));
    s.userData.t = i / 14;
    g.add(s);
    steam.push(s);
  }
  const embers = [];
  for (let i = 0; i < 16; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xffa040, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, opacity: 0,
    }));
    s.userData.t = rand();
    s.userData.k = rand() * 6.28;
    g.add(s);
    embers.push(s);
  }
  const mouthPos = mouth.position.clone();
  const mouthOut = new THREE.Vector3(Math.sin(mouthA), 0, Math.cos(mouthA));
  const emberOff = new THREE.Vector3();

  return {
    group: g,
    update(time, dusk) {
      glass.color.setRGB(1.0, 0.74, 0.44).multiplyScalar(0.75 + dusk * 2.4);
      const flick = 0.85 + 0.15 * Math.sin(time * 9) * Math.sin(time * 4.3);
      fire.color.setRGB(1.0, 0.42, 0.12).multiplyScalar((1.7 + dusk * 1.6) * flick);
      mouthGlow.material.opacity = (0.3 + dusk * 0.4) * flick;
      rotor.rotation.z = time * 0.9;
      swing.rotation.z = Math.sin(time * 1.3) * 0.07;
      swing.rotation.x = Math.sin(time * 0.9 + 1) * 0.04;
      for (const s of steam) {
        const t = (s.userData.t + time * 0.06) % 1;
        s.position.set(
          flueTop.x + t * t * 4.2 + Math.sin(time * 0.6 + s.userData.t * 20) * 0.3 * t,
          flueTop.y + 0.4 + t * 8,
          flueTop.z + Math.sin(s.userData.t * 40) * 0.5 * t
        );
        const size = 0.9 + t * 4.2;
        s.scale.set(size, size, 1);
        s.material.opacity = Math.sin(Math.PI * Math.min(1, t * 1.15)) * 0.4;
      }
      for (const s of embers) {
        const t = (s.userData.t + time * 0.22) % 1;
        const k = s.userData.k;
        s.position.copy(mouthPos)
          .addScaledVector(mouthOut, 0.3 + t * 1.6)
          .add(emberOff.set(Math.sin(k + t * 5) * 0.35, t * 2.6 - 0.2, Math.cos(k * 1.7 + t * 4) * 0.35));
        const size = 0.16 * (1 - t) + 0.05;
        s.scale.set(size, size, 1);
        s.material.opacity = (1 - t) * 0.9;
      }
    },
  };
}

// ── Airship moored at the landing ──────────────────────────────────────────
function envelopeTexture() {
  const cv = document.createElement("canvas");
  cv.width = 512; cv.height = 64;
  const ctx = cv.getContext("2d");
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 ? "#f3ead8" : "#d8452a";
    ctx.fillRect(i * 32, 0, 32, 64);
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(i * 32, 0, 1.5, 64);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function buildAirship(anchor, glowTex) {
  const g = new THREE.Group();
  const timber = new THREE.MeshStandardMaterial({ color: 0x4a3222, roughness: 0.8 });
  const profile = [];
  for (let i = 0; i <= 28; i++) {
    const t = i / 28;
    profile.push([Math.pow(Math.sin(Math.PI * t), 0.72) * 2.5 * (1 - t * 0.12), (t - 0.5) * 11]);
  }
  const hull = shadowed(new THREE.Mesh(lathe(profile, 48), new THREE.MeshStandardMaterial({
    map: envelopeTexture(), roughness: 0.62,
  })));
  hull.rotation.z = Math.PI / 2;
  g.add(hull);

  for (const [ry, rz] of [[0, 0], [0, Math.PI / 2], [0, -Math.PI / 2]]) {
    const fin = shadowed(new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.7, 0.08), new THREE.MeshStandardMaterial({ color: 0xd8452a, roughness: 0.7 })));
    fin.geometry.translate(0, 0.85, 0);
    const holder = new THREE.Group();
    holder.position.x = -4.6;
    holder.rotation.x = rz;
    holder.rotation.y = ry;
    fin.position.y = 0.9;
    holder.add(fin);
    g.add(holder);
  }

  const gondola = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 2.0, 6, 14), timber));
  gondola.rotation.z = Math.PI / 2;
  gondola.position.y = -3.25;
  g.add(gondola);
  for (const x of [-1.1, 1.1]) {
    for (const z of [-0.35, 0.35]) {
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.4, 4), timber);
      rope.position.set(x, -2.45, z);
      g.add(rope);
    }
  }
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffc98a });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), lampMat);
  lamp.position.set(1.5, -3.75, 0);
  g.add(lamp);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: 0xffb060, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, opacity: 0.5,
  }));
  glow.position.copy(lamp.position);
  g.add(glow);

  const home = anchor.clone().add(new THREE.Vector3(0, 8.5, 0));
  g.position.copy(home);

  // mooring line from the gondola down to the jetty
  const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0x2b2018 }));
  line.frustumCulled = false;

  return {
    group: g,
    line,
    update(time, dusk) {
      g.position.set(
        home.x + Math.sin(time * 0.21) * 0.7,
        home.y + Math.sin(time * 0.4) * 0.5,
        home.z + Math.cos(time * 0.17) * 0.7
      );
      g.rotation.z = Math.sin(time * 0.33) * 0.025;
      const p = lineGeo.attributes.position;
      p.setXYZ(0, g.position.x, g.position.y - 3.8, g.position.z);
      p.setXYZ(1, anchor.x, anchor.y - 0.4, anchor.z);
      p.needsUpdate = true;
      lampMat.color.setRGB(1, 0.76, 0.46).multiplyScalar(0.8 + dusk * 2.6);
      const s = 1.4 + dusk * 4.5;
      glow.scale.set(s, s, 1);
      glow.material.opacity = 0.25 + dusk * 0.5;
    },
  };
}

// ── Lab: seven standing screens ────────────────────────────────────────────
function screenTexture(project, index) {
  const cv = document.createElement("canvas");
  cv.width = 384; cv.height = 600;
  const ctx = cv.getContext("2d");
  const hue = project.hue;
  const bg = ctx.createLinearGradient(0, 0, 0, 600);
  bg.addColorStop(0, `hsl(${hue}, 55%, 9%)`);
  bg.addColorStop(1, `hsl(${hue + 25}, 60%, 17%)`);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 384, 600);

  // a small generated figure per project, so no two screens match
  const r = rng(index * 97 + 13);
  ctx.strokeStyle = `hsla(${hue}, 90%, 72%, 0.9)`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 9; i++) {
    const x = 60 + r() * 264, y = 90 + r() * 230;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    ctx.fillStyle = `hsla(${hue + r() * 40}, 90%, 75%, 0.95)`;
    ctx.fillRect(x - 4, y - 4, 8, 8);
  }
  ctx.stroke();

  ctx.fillStyle = "#f3f6fb";
  ctx.textAlign = "left";
  let size = 62;
  ctx.font = `600 ${size}px "Fraunces", Georgia, serif`;
  const words = project.screen.split(" ");
  while (Math.max(...words.map((w) => ctx.measureText(w).width)) > 320 && size > 30) {
    size -= 4;
    ctx.font = `600 ${size}px "Fraunces", Georgia, serif`;
  }
  let y = 430 - (words.length - 1) * size * 0.5;
  for (const w of words) {
    ctx.fillText(w, 32, y);
    y += size * 1.02;
  }
  ctx.fillStyle = `hsla(${hue}, 80%, 80%, 0.95)`;
  ctx.font = '500 26px "Hanken Grotesk", Arial, sans-serif';
  ctx.fillText(project.kind, 34, 548);

  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function buildLab(projects) {
  const pad = PADS.lab;
  const g = new THREE.Group();
  const slabMat = new THREE.MeshStandardMaterial({ color: 0x16181d, roughness: 0.35, metalness: 0.55 });
  const screens = [];
  const n = projects.length;
  projects.forEach((project, i) => {
    const a = THREE.MathUtils.degToRad(196 + (i / (n - 1)) * 148);
    const x = pad.x + Math.cos(a) * 8.2, z = pad.z + Math.sin(a) * 6.4;
    const y = topHeight(x, z);
    const holder = new THREE.Group();
    holder.position.set(x, y - 0.2, z);
    holder.lookAt(pad.x, y - 0.2, pad.z + 14);
    const tall = 4.3 + (i % 2) * 0.5;
    const slab = shadowed(new THREE.Mesh(new THREE.BoxGeometry(2.5, tall, 0.4), slabMat));
    slab.position.y = tall / 2;
    holder.add(slab);
    const mat = new THREE.MeshBasicMaterial({ map: screenTexture(project, i) });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3.44), mat);
    face.position.set(0, tall - 1.95, 0.205);
    holder.add(face);
    g.add(holder);
    slab.userData.index = i;
    face.userData.index = i;
    screens.push({ holder, mat, proxies: [slab, face], glow: 0, target: 0 });
  });
  return {
    group: g,
    screens,
    update(dt, dusk) {
      for (const s of screens) {
        s.glow += (s.target - s.glow) * Math.min(1, dt * 8);
        const v = 0.62 + dusk * 0.25 + s.glow * 0.75;
        s.mat.color.setScalar(v);
        s.holder.scale.setScalar(1 + s.glow * 0.035);
      }
    },
  };
}

// ── Towers: four beacons, one per social ───────────────────────────────────
function buildTowers(socials, stone, glowTex) {
  const pad = PADS.towers;
  const g = new THREE.Group();
  const towers = [];
  const perp = new THREE.Vector2(0.74, -0.67);
  const heights = [10.5, 13.5, 11.8, 9.4];
  const along = [-5.6, -1.9, 1.9, 5.6];
  const depth = [0.6, -0.8, 0.5, -0.3];

  socials.forEach((social, i) => {
    const x = pad.x + perp.x * along[i] - perp.y * depth[i];
    const z = pad.z + perp.y * along[i] + perp.x * depth[i];
    const y = topHeight(x, z) - 0.3;
    const h = heights[i];
    const holder = new THREE.Group();
    holder.position.set(x, y, z);

    const shaft = shadowed(new THREE.Mesh(
      roughen(new THREE.CylinderGeometry(0.38, 0.85, h, 12, 14), 0.09, 1.1, i * 7),
      stone
    ));
    shaft.position.y = h / 2;
    holder.add(shaft);
    const collar = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.5, 0.35, 12), stone));
    collar.position.y = h + 0.1;
    holder.add(collar);

    const color = new THREE.Color(social.color);
    const orbMat = new THREE.MeshBasicMaterial({ color: color.clone() });
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 14), orbMat);
    orb.position.y = h + 0.85;
    holder.add(orb);

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, opacity: 0.6,
    }));
    glow.position.y = h + 0.85;
    holder.add(glow);

    const beamGeo = new THREE.CylinderGeometry(0.05, 0.3, 70, 10, 1, true);
    beamGeo.translate(0, 35, 0);
    const beamMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uColor: { value: color }, uPower: { value: 0.3 } },
      vertexShader: /* glsl */ `
        varying float vH;
        void main(){ vH = position.y / 70.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uPower; varying float vH;
        void main(){
          float a = pow(1.0 - vH, 2.2) * uPower;
          gl_FragColor = vec4(uColor * a, a);
        }`,
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = h + 0.85;
    holder.add(beam);

    const proxy = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 1.5, h + 3, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    proxy.position.y = (h + 3) / 2;
    proxy.userData.index = i;
    holder.add(proxy);

    g.add(holder);
    towers.push({
      proxy, orb, orbMat, glow, beamMat, color, hover: 0, target: 0, phase: i * 1.7,
      tip: new THREE.Vector3(x, y + h + 0.85, z),
    });
  });

  return {
    group: g,
    towers,
    update(time, dt, dusk) {
      for (const t of towers) {
        t.hover += (t.target - t.hover) * Math.min(1, dt * 7);
        const breathe = 0.5 + 0.5 * Math.sin(time * 1.4 + t.phase);
        const pulse = t.hover * (0.6 + 0.4 * Math.sin(time * 9));
        const power = 0.9 + dusk * 1.6 + breathe * 0.25 + pulse * 2.2;
        t.orbMat.color.copy(t.color).multiplyScalar(power);
        t.orb.scale.setScalar(1 + pulse * 0.45);
        const gs = 3.2 + dusk * 5 + breathe * 0.7 + pulse * 5;
        t.glow.scale.set(gs, gs, 1);
        t.glow.material.opacity = 0.35 + dusk * 0.4 + pulse * 0.3;
        t.beamMat.uniforms.uPower.value = 0.1 + dusk * 0.5 + pulse * 0.6;
      }
    },
  };
}

// ── Landing: a stone jetty with two lanterns ───────────────────────────────
function buildLanding(stone, glowTex) {
  const pad = PADS.landing;
  const g = new THREE.Group();
  const dir = new THREE.Vector2(Math.cos(pad.angle), Math.sin(pad.angle));
  const baseY = topHeight(pad.x, pad.z);
  const lanterns = [];

  for (let i = 0; i < 8; i++) {
    const d = 1.5 + i * 2.05;
    const x = pad.x + dir.x * d, z = pad.z + dir.y * d;
    const slab = shadowed(new THREE.Mesh(
      roughen(new THREE.BoxGeometry(2.2, 0.42, 3.2, 5, 1, 6), 0.07, 1.6, i * 2.3),
      stone
    ));
    slab.position.set(x, baseY + 0.1 - i * 0.02, z);
    slab.rotation.y = -pad.angle + (rand() - 0.5) * 0.08;
    slab.rotation.z = (rand() - 0.5) * 0.03;
    g.add(slab);
    if (i === 3 || i === 7) {
      const strut = shadowed(new THREE.Mesh(roughen(new THREE.CylinderGeometry(0.4, 0.2, 5, 8, 4), 0.08, 1.3, i), stone));
      strut.position.set(x, baseY - 2.5, z);
      g.add(strut);
    }
  }

  const end = 1.5 + 7 * 2.05;
  for (const side of [-1, 1]) {
    const x = pad.x + dir.x * end - dir.y * side * 1.25;
    const z = pad.z + dir.y * end + dir.x * side * 1.25;
    const post = shadowed(new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.1, 2.6, 8),
      new THREE.MeshStandardMaterial({ color: 0x2b2b2e, roughness: 0.5, metalness: 0.6 })
    ));
    post.position.set(x, baseY + 1.55, z);
    g.add(post);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffc98a });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 10), mat);
    lamp.position.set(x, baseY + 3.0, z);
    g.add(lamp);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xffb060, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, opacity: 0.5,
    }));
    glow.position.copy(lamp.position);
    g.add(glow);
    lanterns.push({ mat, glow });
  }

  return {
    group: g,
    end: new THREE.Vector3(pad.x + dir.x * end, baseY + 1, pad.z + dir.y * end),
    update(time, dusk) {
      for (const [i, l] of lanterns.entries()) {
        const flick = 0.92 + 0.08 * Math.sin(time * 11 + i * 2.3) * Math.sin(time * 3.7 + i);
        l.mat.color.setRGB(1, 0.75, 0.45).multiplyScalar((0.7 + dusk * 2.6) * flick);
        const s = 1.6 + dusk * 5.5;
        l.glow.scale.set(s, s, 1);
        l.glow.material.opacity = 0.25 + dusk * 0.55;
      }
    },
  };
}

export function buildLandmarks(env, content) {
  const group = new THREE.Group();
  const stone = makeRockMaterial({ ground: 0, topMask: 0 });
  const glowTex = glowTexture();

  const summit = buildSummit(stone, env);
  const workshop = buildWorkshop(stone, glowTex);
  const lab = buildLab(content.projects);
  const towers = buildTowers(content.socials, stone, glowTex);
  const landing = buildLanding(stone, glowTex);
  const airship = buildAirship(landing.end, glowTex);
  airship.group.rotation.y = 0.85;
  group.add(summit.group, workshop.group, lab.group, towers.group, landing.group, airship.group, airship.line);

  return {
    group,
    screens: lab.screens,
    towers: towers.towers,
    update(time, dt, dusk) {
      workshop.update(time, dusk);
      lab.update(dt, dusk);
      towers.update(time, dt, dusk);
      landing.update(time, dusk);
      airship.update(time, dusk);
    },
  };
}
