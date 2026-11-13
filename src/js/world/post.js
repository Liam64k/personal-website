// Finishing pass: the world renders into a multisampled HDR buffer, then one
// chain adds bloom, sun shafts, a film-style tone curve and a soft vignette.
import * as THREE from "three";

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

function pass(fragmentShader, uniforms) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader, uniforms,
    depthTest: false, depthWrite: false, toneMapped: false,
  });
}

export function createPost(renderer, { samples = 4, rays = true } = {}) {
  const hdr = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
  const scene = new THREE.WebGLRenderTarget(2, 2, { ...hdr, depthBuffer: true, samples });
  const a = new THREE.WebGLRenderTarget(2, 2, hdr);
  const b = new THREE.WebGLRenderTarget(2, 2, hdr);
  const c = new THREE.WebGLRenderTarget(2, 2, hdr);
  const d = new THREE.WebGLRenderTarget(2, 2, hdr);
  const shafts = new THREE.WebGLRenderTarget(2, 2, hdr);

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  const quadScene = new THREE.Scene();
  quadScene.add(quad);
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // keep only what is brighter than paper white, with a soft knee
  const bright = pass(/* glsl */ `
    uniform sampler2D tMap; uniform float uThreshold; varying vec2 vUv;
    void main(){
      vec3 col = texture2D(tMap, vUv).rgb;
      float l = max(col.r, max(col.g, col.b));
      float k = smoothstep(uThreshold, uThreshold + 1.4, l);
      gl_FragColor = vec4(min(col, vec3(12.0)) * k, 1.0);
    }`, { tMap: { value: null }, uThreshold: { value: 1.45 } });

  const blur = pass(/* glsl */ `
    uniform sampler2D tMap; uniform vec2 uDir; varying vec2 vUv;
    void main(){
      vec3 s = texture2D(tMap, vUv).rgb * 0.227;
      s += (texture2D(tMap, vUv + uDir * 1.385).rgb + texture2D(tMap, vUv - uDir * 1.385).rgb) * 0.316;
      s += (texture2D(tMap, vUv + uDir * 3.231).rgb + texture2D(tMap, vUv - uDir * 3.231).rgb) * 0.070;
      gl_FragColor = vec4(s, 1.0);
    }`, { tMap: { value: null }, uDir: { value: new THREE.Vector2() } });

  // smear the bright buffer away from the sun to make shafts
  const ray = pass(/* glsl */ `
    uniform sampler2D tMap; uniform vec2 uSun; varying vec2 vUv;
    void main(){
      vec2 step = (uSun - vUv) / 28.0 * 0.82;
      vec2 p = vUv; vec3 s = vec3(0.0); float w = 1.0;
      for (int i = 0; i < 28; i++){
        s += texture2D(tMap, p).rgb * w;
        p += step; w *= 0.955;
      }
      gl_FragColor = vec4(s / 14.0, 1.0);
    }`, { tMap: { value: null }, uSun: { value: new THREE.Vector2(0.5, 0.5) } });

  const final = pass(/* glsl */ `
    uniform sampler2D tScene, tBloomA, tBloomB, tRays;
    uniform float uExposure, uBloom, uRays, uTime;
    varying vec2 vUv;
    vec3 film(vec3 x){
      x *= 0.62;
      return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
    }
    void main(){
      vec3 col = texture2D(tScene, vUv).rgb;
      vec3 bloom = texture2D(tBloomA, vUv).rgb * 0.55 + texture2D(tBloomB, vUv).rgb * 0.75;
      col += bloom * uBloom;
      col += texture2D(tRays, vUv).rgb * uRays;
      col *= uExposure;
      vec2 q = vUv - 0.5;
      col *= 1.0 - dot(q, q) * 0.36;                      // vignette
      col = film(col);
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, 1.2);
      col = mix(col, col * col * (3.0 - 2.0 * col), 0.35);   // a gentle contrast curve                       // a little more colour
      col = pow(col, vec3(1.0 / 2.2));
      // one bit of noise below the last visible step keeps the sky from banding
      float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
      gl_FragColor = vec4(col + (n - 0.5) / 255.0, 1.0);
    }`, {
    tScene: { value: scene.texture }, tBloomA: { value: b.texture }, tBloomB: { value: d.texture },
    tRays: { value: shafts.texture },
    uExposure: { value: 1 }, uBloom: { value: 0.42 }, uRays: { value: 0 }, uTime: { value: 0 },
  });

  const size = new THREE.Vector2();
  const sunWorld = new THREE.Vector3();

  function draw(material, target) {
    quad.material = material;
    renderer.setRenderTarget(target);
    renderer.render(quadScene, quadCam);
  }

  return {
    setSize(w, h, dpr) {
      const W = Math.max(2, Math.round(w * dpr)), H = Math.max(2, Math.round(h * dpr));
      scene.setSize(W, H);
      const hw = Math.max(2, W >> 1), hh = Math.max(2, H >> 1);
      a.setSize(hw, hh); b.setSize(hw, hh);
      const qw = Math.max(2, W >> 3), qh = Math.max(2, H >> 3);
      c.setSize(qw, qh); d.setSize(qw, qh);
      shafts.setSize(Math.max(2, W >> 2), Math.max(2, H >> 2));
      size.set(hw, hh);
    },
    render(world, camera, env) {
      renderer.setRenderTarget(scene);
      renderer.render(world, camera);

      // bloom: a tight glow at half size and a wide one at an eighth
      bright.uniforms.tMap.value = scene.texture;
      draw(bright, a);
      blur.uniforms.tMap.value = a.texture; blur.uniforms.uDir.value.set(1 / a.width, 0); draw(blur, b);
      blur.uniforms.tMap.value = b.texture; blur.uniforms.uDir.value.set(0, 1 / a.height); draw(blur, a);
      blur.uniforms.tMap.value = a.texture; blur.uniforms.uDir.value.set(1.6 / a.width, 0); draw(blur, b);
      blur.uniforms.tMap.value = b.texture; blur.uniforms.uDir.value.set(1 / c.width, 0); draw(blur, c);
      blur.uniforms.tMap.value = c.texture; blur.uniforms.uDir.value.set(0, 1 / c.height); draw(blur, d);
      blur.uniforms.tMap.value = d.texture; blur.uniforms.uDir.value.set(1.5 / c.width, 0); draw(blur, c);
      blur.uniforms.tMap.value = c.texture; blur.uniforms.uDir.value.set(0, 1.5 / c.height); draw(blur, d);

      // shafts, only while the sun is in or near the frame
      let rayPower = 0;
      if (rays) {
        sunWorld.copy(env.uSunDir.value).multiplyScalar(2000).add(camera.position).project(camera);
        const off = Math.hypot(sunWorld.x, sunWorld.y);
        if (sunWorld.z < 1 && off < 1.7) {
          rayPower = (1 - Math.min(1, Math.max(0, (off - 0.9) / 0.8))) * (0.35 + env.dusk * 0.65);
          ray.uniforms.tMap.value = d.texture;
          ray.uniforms.uSun.value.set(sunWorld.x * 0.5 + 0.5, sunWorld.y * 0.5 + 0.5);
          draw(ray, shafts);
        }
      }

      final.uniforms.uExposure.value = env.exposure;
      final.uniforms.uRays.value = rayPower * 0.9;
      draw(final, null);
    },
  };
}

/** A blurred copy of the sky for reflections and soft fill on every surface. */
export function skyEnvironment(renderer, skyMesh) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const s = new THREE.Scene();
  const parent = skyMesh.parent;
  s.add(skyMesh);
  const tex = pmrem.fromScene(s, 0.04).texture;
  if (parent) parent.add(skyMesh);
  pmrem.dispose();
  return tex;
}
