// Boot: build the world, then let native scroll conduct it.
import * as THREE from "three";
import { createPage } from "./page.js";
import { createEnv, applyLight, cameraAt, STOPS } from "./world/journey.js";
import { buildSky, buildClouds } from "./world/sky.js";
import { buildIsland } from "./world/island.js";
import { buildLandmarks } from "./world/landmarks.js";
import { buildWater } from "./world/water.js";
import { planTrees, buildFlora } from "./world/flora.js";
import { buildLife } from "./world/life.js";
import { createPost, skyEnvironment } from "./world/post.js";

const page = createPage();
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
// a frame, or 60 ms if the tab is in the background and frames are paused
const nextFrame = () =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, 60);
    requestAnimationFrame(() => {
      clearTimeout(timer);
      resolve();
    });
  });

let dead = false;

function fallback(reason) {
  if (dead) return;
  dead = true; // stops the frame loop, so it cannot fight the plain page
  console.warn("3D world unavailable:", reason);
  document.documentElement.classList.add("no-webgl");
  page.measure();
  page.start();
  // without the world, every chapter simply shows as it scrolls into view
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => e.target.classList.toggle("is-active", e.isIntersecting)),
    { threshold: 0.25 }
  );
  page.chapters.forEach((c) => io.observe(c));
}

async function boot() {
  const canvas = document.getElementById("world");
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  } catch (err) {
    fallback(err);
    return;
  }

  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 560;
  const high = !coarse && !small;
  const quality = {
    high,
    grass: high ? 120000 : 42000,
    cloudScale: high ? 1 : 0.62,
    dprCap: high ? 1.75 : 1.5,
    shadow: high ? 2048 : 1024,
  };
  let dpr = Math.min(window.devicePixelRatio || 1, quality.dprCap);

  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xb3d0ec, 0.0011);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 3000);
  const env = createEnv();

  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(quality.shadow, quality.shadow);
  const sc = sun.shadow.camera;
  sc.left = -88; sc.right = 88; sc.top = 88; sc.bottom = -88; sc.near = 30; sc.far = 340;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.7;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x777777, 1);
  scene.add(hemi);

  // ── build, yielding between steps so the loader can paint ────────────────
  page.setLoader(0.12, "Mixing the sky");
  await nextFrame();
  const sky = buildSky(env);
  scene.add(sky);
  applyLight(1.6, env, sun, hemi, scene);
  scene.environment = skyEnvironment(renderer, sky);
  scene.environmentIntensity = 0.5;
  const clouds = buildClouds(env, quality);
  scene.add(clouds.mesh);

  page.setLoader(0.38, "Raising the rock");
  await nextFrame();
  const plan = planTrees();
  const island = buildIsland(env, quality, plan.shade);
  scene.add(island.group);
  scene.add(buildWater(env).group);
  const flora = buildFlora(env, plan, quality);
  scene.add(flora.group);
  const life = buildLife(env, quality);
  scene.add(life.group);

  page.setLoader(0.7, "Lighting the beacons");
  await Promise.race([document.fonts?.ready ?? Promise.resolve(), new Promise((r) => setTimeout(r, 1500))]);
  await nextFrame();
  const marks = buildLandmarks(env, { projects: page.projects, socials: page.socials });
  scene.add(marks.group);

  let post = null;
  const params = new URLSearchParams(location.search);
  if (!params.has("nopost")) {
    try {
      const samples = params.has("msaa") ? Number(params.get("msaa")) : quality.high ? 4 : 2;
      post = createPost(renderer, { samples, rays: quality.high });
    } catch (err) {
      console.warn("Finishing pass unavailable:", err);
    }
  }

  // ── sizing ───────────────────────────────────────────────────────────────
  let W = 1, H = 1, narrow = false;
  function resize() {
    // phones fire resize whenever the address bar slides; that is not worth
    // rebuilding every render buffer for
    if (coarse && window.innerWidth === W && Math.abs(window.innerHeight - H) < 140) return;
    W = window.innerWidth; H = window.innerHeight;
    narrow = W / H < 0.85;
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    if (post) post.setSize(W, H, dpr);
    flora.resize(dpr);
    life.resize(dpr);
    camera.aspect = W / H;
    page.measure();
  }
  window.addEventListener("resize", resize);
  resize();

  // ── pointer: parallax, hover and click on towers and screens ─────────────
  const pointer = new THREE.Vector2(0, 0);
  const ndc = new THREE.Vector2(0, 0);
  let pointerLive = false;
  let overUi = false; // pointer is on text or a photo, so the 3D world should not react
  window.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    ndc.set((e.clientX / W) * 2 - 1, -(e.clientY / H) * 2 + 1);
    pointerLive = true;
    overUi = !!e.target.closest?.(".panel, .print, .topbar, .beacon, dialog");
  });
  document.addEventListener("pointerleave", () => (pointerLive = false));

  const ray = new THREE.Raycaster();
  const towerProxies = marks.towers.map((t) => t.proxy);
  const screenProxies = marks.screens.flatMap((s) => s.proxies);
  let hotTower = -1, hotScreen = -1, domTower = -1, domScreen = -1;

  page.beacons.forEach((el, i) => {
    el.addEventListener("pointerenter", () => (domTower = i));
    el.addEventListener("pointerleave", () => (domTower = -1));
  });
  page.signalLinks.forEach((el, i) => {
    el.addEventListener("pointerenter", () => (domTower = i));
    el.addEventListener("pointerleave", () => (domTower = -1));
    el.addEventListener("focus", () => (domTower = i));
    el.addEventListener("blur", () => (domTower = -1));
  });
  page.projectLinks.forEach((el, i) => {
    el.addEventListener("pointerenter", () => (domScreen = i));
    el.addEventListener("pointerleave", () => (domScreen = -1));
    el.addEventListener("focus", () => (domScreen = i));
    el.addEventListener("blur", () => (domScreen = -1));
  });

  window.addEventListener("click", (e) => {
    if (e.target.closest("a, button, dialog, .panel, .print, .topbar")) return;
    if (window.getSelection()?.toString()) return;
    if (hotTower >= 0) {
      const s = page.socials[hotTower];
      if (s.external) window.open(s.href, "_blank", "noopener"); else window.location.href = s.href;
    } else if (hotScreen >= 0) {
      window.open(page.projects[hotScreen].href, "_blank", "noopener");
    }
  });

  // ── frame loop ───────────────────────────────────────────────────────────
  const clock = new THREE.Clock();
  const cam = { pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 40, shift: 0, rise: 0 };
  const right = new THREE.Vector3(), up = new THREE.Vector3(), tip = new THREE.Vector3();
  let smooth = page.progress();
  let time = 0, slow = 0, frames = 0;

  function frame() {
    if (dead) return;
    requestAnimationFrame(frame);
    if (document.hidden) return;
    step(clock.getDelta());
  }

  function step(raw) {
    const dt = Math.min(raw, 1 / 30);
    const still = reduceMotion.matches;
    if (!still) time += dt;

    const target = page.progress();
    if (still) smooth = Math.round(target);
    else smooth += (target - smooth) * (1 - Math.exp(-4.4 * Math.min(raw, 0.25)));
    if (Math.abs(target - smooth) < 0.0004) smooth = target;
    page.update(target);

    env.uTime.value = time;
    env.uWind.value = still ? 0 : 1;
    applyLight(smooth, env, sun, hemi, scene);
    renderer.toneMappingExposure = env.exposure;

    // camera
    cameraAt(smooth, narrow, cam);
    pointer.lerp(pointerLive && !still ? ndc : pointer.set(pointer.x * 0.96, pointer.y * 0.96), 0.05);
    camera.position.copy(cam.pos);
    camera.fov = cam.fov;
    camera.lookAt(cam.target);
    camera.updateMatrixWorld();
    right.setFromMatrixColumn(camera.matrixWorld, 0);
    up.setFromMatrixColumn(camera.matrixWorld, 1);
    const reach = 0.012 * cam.pos.distanceTo(cam.target) + 0.4;
    const bob = still ? 0 : Math.sin(time * 0.35) * 0.3;
    camera.position.addScaledVector(right, pointer.x * reach).addScaledVector(up, pointer.y * reach * 0.6 + bob);
    camera.lookAt(cam.target);
    camera.setViewOffset(W, H, -cam.shift * W, cam.rise * H, W, H);
    camera.updateMatrixWorld();

    // passing through the cloud bank between the sky and the summit
    const bank = Math.max(0, 1 - Math.abs(smooth - 0.45) / 0.3);
    page.setWhiteout(Math.max(0, 1 - Math.abs(smooth - 0.45) / 0.14) * 0.3);

    // hover
    let tower = domTower, screen = domScreen;
    const nearTowers = Math.abs(smooth - 4) < 0.3, nearLab = Math.abs(smooth - 3) < 0.3;
    if (pointerLive && !overUi && (nearTowers || nearLab)) {
      ray.setFromCamera(ndc, camera);
      if (nearTowers && tower < 0) {
        const hit = ray.intersectObjects(towerProxies, false)[0];
        if (hit) tower = hit.object.userData.index;
      }
      if (nearLab && screen < 0) {
        const hit = ray.intersectObjects(screenProxies, false)[0];
        if (hit) screen = hit.object.userData.index;
      }
    }
    if (tower !== hotTower || screen !== hotScreen) {
      hotTower = tower; hotScreen = screen;
      marks.towers.forEach((t, i) => (t.target = i === tower ? 1 : 0));
      marks.screens.forEach((s, i) => (s.target = i === screen ? 1 : 0));
      page.signalLinks.forEach((el, i) => el.classList.toggle("is-lit", i === tower));
      page.beacons.forEach((el, i) => el.classList.toggle("is-lit", i === tower));
      page.projectLinks.forEach((el, i) => el.classList.toggle("is-lit", i === screen));
      document.body.style.cursor = tower >= 0 || screen >= 0 ? "pointer" : "";
    }

    // world
    island.update(time);
    marks.update(time, dt, env.dusk);
    life.update(env.dusk);
    scene.environmentIntensity = 0.5 - env.dusk * 0.22;
    clouds.update(still ? 0 : time, camera, Math.min(1, bank * 1.6));

    // labels riding the tower tips
    const vis = Math.min(1, Math.max(0, 1 - Math.abs(smooth - 4) * 3.2));
    marks.towers.forEach((t, i) => {
      const el = page.beacons[i];
      tip.copy(t.tip).project(camera);
      const on = vis > 0.02 && tip.z < 1;
      el.style.visibility = on ? "visible" : "hidden";
      if (!on) return;
      el.style.opacity = vis.toFixed(3);
      const x = (tip.x * 0.5 + 0.5) * W, y = (-tip.y * 0.5 + 0.5) * H;
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -190%)`;
    });

    if (post) post.render(scene, camera, env);
    else renderer.render(scene, camera);

    // if frames run long, trade resolution for smoothness
    // (frames longer than 100 ms are a throttled tab, not a slow GPU)
    if (raw < 0.1) slow += (raw * 1000 - slow) * 0.05;
    if (++frames > 120 && slow > 42 && dpr > 1) {
      slow = 16;
      dpr = Math.max(1, dpr - 0.25);
      resize();
      frames = 0;
    }
  }

  page.setLoader(0.92, "Clearing the clouds");
  await nextFrame();
  applyLight(smooth, env, sun, hemi, scene);
  cameraAt(smooth, narrow, cam);
  camera.position.copy(cam.pos);
  camera.lookAt(cam.target);
  frame();
  page.setLoader(1);
  await nextFrame();
  if (dead) return;
  document.documentElement.classList.remove("no-webgl");
  page.start();

  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    fallback("context lost");
  });

  // test helpers, only with ?debug in the address
  if (params.has("debug")) window.__isle = {
    camera, scene, renderer, STOPS,
    go(i) {
      window.scrollTo({ top: page.chapters[i].offsetTop + 2, behavior: "instant" });
      smooth = page.progress();
    },
    tick(n = 1) { for (let i = 0; i < n; i++) step(1 / 30); },
    at(c) {
      const i = Math.min(page.chapters.length - 1, Math.floor(c));
      const el = page.chapters[i];
      const local = c - i > 0 ? 0.42 + 0.58 * (c - i) : 0;
      window.scrollTo({ top: el.offsetTop + local * el.offsetHeight + 2, behavior: "instant" });
      smooth = page.progress();
    },
  };
}

boot().catch(fallback);
