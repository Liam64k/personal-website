// The five stops on the island: summit cairn, workshop cabin, lab screens,
// beacon towers and the landing jetty.
import * as THREE from "three";
import { topHeight, makeRockMaterial, PADS, SUMMIT } from "./island.js";
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

function plankTexture() {
  const cv = document.createElement("canvas");
  cv.width = 256; cv.height = 256;
  const ctx = cv.getContext("2d");
  for (let row = 0; row < 8; row++) {
    const l = 30 + rand() * 12;
    ctx.fillStyle = `hsl(${24 + rand() * 8}, ${32 + rand() * 12}%, ${l}%)`;
    ctx.fillRect(0, row * 32, 256, 32);
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = `rgba(0,0,0,${0.03 + rand() * 0.06})`;
      ctx.fillRect(rand() * 256, row * 32 + rand() * 32, 20 + rand() * 90, 1);
    }
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, row * 32, 256, 2);
    const seam = rand() * 256;
    ctx.fillRect(seam, row * 32, 2, 32);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
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
    const geo = roughen(new THREE.IcosahedronGeometry(1, 2), 0.22, 1.4, i * 3.1);
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

// ── Workshop: cabin, chimney smoke, heavy bag ──────────────────────────────
function prism(w, h, d) {
  // triangular gable prism, ridge along x
  const hw = w / 2, hd = d / 2;
  const v = [
    -hw, 0, -hd, -hw, 0, hd, -hw, h, 0,
    hw, 0, hd, hw, 0, -hd, hw, h, 0,
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1, 0, 0, 1, 0, 0.5, 1], 2));
  geo.computeVertexNormals();
  return geo;
}

function signTexture(text) {
  const cv = document.createElement("canvas");
  cv.width = 512; cv.height = 96;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#2a1c12";
  ctx.fillRect(0, 0, 512, 96);
  ctx.fillStyle = "#f4e3c4";
  ctx.font = '600 52px "Fraunces", Georgia, serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 50);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function buildWorkshop(stone, glowTex) {
  const pad = PADS.workshop;
  const g = new THREE.Group();
  g.position.set(pad.x, topHeight(pad.x, pad.z) - 0.05, pad.z);
  g.rotation.y = 0.62;

  const planks = plankTexture();
  planks.repeat.set(2.5, 2.2);
  const wood = new THREE.MeshStandardMaterial({ map: planks, roughness: 0.88 });
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x3a2618, roughness: 0.9 });
  const slate = new THREE.MeshStandardMaterial({ color: 0x343b45, roughness: 0.75 });

  const W = 6.4, H = 3.0, D = 4.6;
  const walls = shadowed(new THREE.Mesh(new THREE.BoxGeometry(W, H, D), wood));
  walls.position.y = H / 2 + 0.25;
  g.add(walls);

  for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const post = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.26, H + 0.05, 0.26), darkWood));
    post.position.set(px * (W / 2), H / 2 + 0.25, pz * (D / 2));
    g.add(post);
  }
  const ridge = shadowed(new THREE.Mesh(new THREE.BoxGeometry(W + 1.0, 0.16, 0.34), darkWood));
  ridge.position.set(0, H + 0.25 + 1.9 + 0.14, 0);
  g.add(ridge);
  const step = shadowed(new THREE.Mesh(roughen(new THREE.BoxGeometry(1.9, 0.3, 1.1, 4, 1, 3), 0.05, 2.1), stone));
  step.position.set(-0.3, 0.2, D / 2 + 0.7);
  g.add(step);

  const base = shadowed(new THREE.Mesh(roughen(new THREE.BoxGeometry(W + 0.5, 0.5, D + 0.5, 6, 1, 6), 0.08, 1.2), stone));
  base.position.y = 0.15;
  g.add(base);

  const gable = shadowed(new THREE.Mesh(prism(W, 1.9, D), wood));
  gable.position.y = H + 0.25;
  g.add(gable);

  const slope = Math.atan2(1.9, D / 2);
  const roofLen = Math.hypot(1.9, D / 2) + 0.55;
  for (const side of [-1, 1]) {
    const roof = shadowed(new THREE.Mesh(new THREE.BoxGeometry(W + 0.9, 0.2, roofLen), slate));
    roof.position.set(0, H + 0.25 + 0.95 + 0.06, side * (D / 4 + 0.12));
    roof.rotation.x = side * slope;
    g.add(roof);
  }

  const chimney = shadowed(new THREE.Mesh(roughen(new THREE.BoxGeometry(0.9, 2.6, 0.9, 3, 5, 3), 0.05, 2), stone));
  chimney.position.set(-1.9, H + 1.6, -0.9);
  g.add(chimney);

  const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.1, 0.12), darkWood);
  door.position.set(-0.3, 1.3, D / 2 + 0.03);
  g.add(door);

  const windowMat = new THREE.MeshBasicMaterial({ color: 0xffc27a });
  const windows = [];
  for (const [x, z, ry] of [[1.75, D / 2 + 0.02, 0], [W / 2 + 0.02, 0.3, Math.PI / 2]]) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.35, 1.2, 0.1), darkWood);
    frame.position.set(x, 1.95, z);
    frame.rotation.y = ry;
    g.add(frame);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.95), windowMat);
    pane.position.set(x + (ry ? 0.06 : 0), 1.95, z + (ry ? 0 : 0.06));
    pane.rotation.y = ry;
    g.add(pane);
    windows.push(pane);
    for (const [bw, bh] of [[1.12, 0.06], [0.06, 0.97]]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.05), darkWood);
      bar.position.copy(pane.position);
      bar.rotation.y = ry;
      g.add(bar);
    }
  }

  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(3.3, 0.62),
    new THREE.MeshStandardMaterial({ map: signTexture("Heating Media"), roughness: 0.8 })
  );
  sign.position.set(2.0, 0.78, D / 2 + 1.5);
  sign.rotation.x = -0.3;
  const signPost = shadowed(new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.5, 0.14), darkWood));
  signPost.position.set(2.0, 0.42, D / 2 + 1.4);
  signPost.rotation.x = -0.3;
  g.add(signPost);
  g.add(sign);

  // heavy bag on a timber frame: the training business, and a nod to Muay Thai
  const frame = new THREE.Group();
  frame.position.set(5.6, 0.1, 1.6);
  for (const x of [-1.1, 1.1]) {
    const post = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.2, 0.2), darkWood));
    post.position.set(x, 1.6, 0);
    frame.add(post);
  }
  const beam = shadowed(new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.2, 0.24), darkWood));
  beam.position.y = 3.2;
  frame.add(beam);
  const swing = new THREE.Group();
  swing.position.y = 3.1;
  const chain = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.7, 5),
    new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.8, roughness: 0.4 })
  );
  chain.position.y = -0.35;
  swing.add(chain);
  const bag = shadowed(new THREE.Mesh(
    new THREE.CapsuleGeometry(0.34, 1.0, 6, 14),
    new THREE.MeshStandardMaterial({ color: 0x5c1a12, roughness: 0.55 })
  ));
  bag.position.y = -1.5;
  swing.add(bag);
  frame.add(swing);
  g.add(frame);

  // chimney smoke
  const smoke = [];
  for (let i = 0; i < 12; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xdad6cf, transparent: true, depthWrite: false, opacity: 0,
    }));
    s.userData.t = i / 12;
    g.add(s);
    smoke.push(s);
  }
  const smokeFrom = new THREE.Vector3(-1.9, H + 3.0, -0.9);

  return {
    group: g,
    update(time, dusk) {
      windowMat.color.setRGB(1.0, 0.72, 0.42).multiplyScalar(0.55 + dusk * 2.2);
      swing.rotation.z = Math.sin(time * 1.3) * 0.07;
      swing.rotation.x = Math.sin(time * 0.9 + 1) * 0.04;
      for (const s of smoke) {
        const t = (s.userData.t + time * 0.07) % 1;
        s.position.set(
          smokeFrom.x + t * t * 3.2 + Math.sin(time * 0.6 + s.userData.t * 20) * 0.25 * t,
          smokeFrom.y + t * 6.5,
          smokeFrom.z + Math.sin(s.userData.t * 40) * 0.4 * t
        );
        const size = 0.9 + t * 3.4;
        s.scale.set(size, size, 1);
        s.material.opacity = Math.sin(Math.PI * Math.min(1, t * 1.15)) * 0.42;
      }
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
  group.add(summit.group, workshop.group, lab.group, towers.group, landing.group);

  return {
    group,
    summitFocus: summit.focus,
    screens: lab.screens,
    towers: towers.towers,
    update(time, dt, dusk) {
      workshop.update(time, dusk);
      lab.update(dt, dusk);
      towers.update(time, dt, dusk);
      landing.update(time, dusk);
    },
  };
}
