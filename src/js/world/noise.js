// Seeded gradient noise for JS (terrain, scatter) and a matching GLSL chunk (shading).

const P = new Uint8Array(512);
{
  let s = 20261112;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = p[i];
    p[i] = p[j];
    p[j] = t;
  }
  for (let i = 0; i < 512; i++) P[i] = p[i & 255];
}

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const mix = (a, b, t) => a + (b - a) * t;

function g2(h, x, y) {
  switch (h & 7) {
    case 0: return x + y;
    case 1: return x - y;
    case 2: return -x + y;
    case 3: return -x - y;
    case 4: return x;
    case 5: return -x;
    case 6: return y;
    default: return -y;
  }
}

function g3(h, x, y, z) {
  switch (h % 12) {
    case 0: return x + y;
    case 1: return -x + y;
    case 2: return x - y;
    case 3: return -x - y;
    case 4: return x + z;
    case 5: return -x + z;
    case 6: return x - z;
    case 7: return -x - z;
    case 8: return y + z;
    case 9: return -y + z;
    case 10: return y - z;
    default: return -y - z;
  }
}

/** 2D gradient noise, roughly -1..1 */
export function noise2(x, y) {
  const X = Math.floor(x), Y = Math.floor(y);
  x -= X; y -= Y;
  const xi = X & 255, yi = Y & 255;
  const u = fade(x), v = fade(y);
  const a = P[xi] + yi, b = P[xi + 1] + yi;
  return mix(
    mix(g2(P[a], x, y), g2(P[b], x - 1, y), u),
    mix(g2(P[a + 1], x, y - 1), g2(P[b + 1], x - 1, y - 1), u),
    v
  );
}

/** 3D gradient noise, roughly -1..1 */
export function noise3(x, y, z) {
  const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
  x -= X; y -= Y; z -= Z;
  const xi = X & 255, yi = Y & 255, zi = Z & 255;
  const u = fade(x), v = fade(y), w = fade(z);
  const A = P[xi] + yi, AA = P[A] + zi, AB = P[A + 1] + zi;
  const B = P[xi + 1] + yi, BA = P[B] + zi, BB = P[B + 1] + zi;
  return mix(
    mix(
      mix(g3(P[AA], x, y, z), g3(P[BA], x - 1, y, z), u),
      mix(g3(P[AB], x, y - 1, z), g3(P[BB], x - 1, y - 1, z), u),
      v
    ),
    mix(
      mix(g3(P[AA + 1], x, y, z - 1), g3(P[BA + 1], x - 1, y, z - 1), u),
      mix(g3(P[AB + 1], x, y - 1, z - 1), g3(P[BB + 1], x - 1, y - 1, z - 1), u),
      v
    ),
    w
  );
}

/** Fractal noise, roughly -1..1 */
export function fbm2(x, y, oct = 4) {
  let a = 0.5, s = 0, n = 0;
  for (let i = 0; i < oct; i++) {
    s += a * noise2(x, y);
    n += a;
    x = x * 2.03 + 19.7;
    y = y * 2.03 - 7.3;
    a *= 0.5;
  }
  return s / n;
}

export function fbm3(x, y, z, oct = 4) {
  let a = 0.5, s = 0, n = 0;
  for (let i = 0; i < oct; i++) {
    s += a * noise3(x, y, z);
    n += a;
    x = x * 2.03 + 19.7;
    y = y * 2.03 - 7.3;
    z = z * 2.03 + 3.1;
    a *= 0.5;
  }
  return s / n;
}

/** Ridged noise, 0..1, sharp crests */
export function ridged2(x, y, oct = 3) {
  let a = 0.5, s = 0, n = 0;
  for (let i = 0; i < oct; i++) {
    const r = 1 - Math.abs(noise2(x, y));
    s += a * r * r;
    n += a;
    x = x * 2.1 + 11.3;
    y = y * 2.1 + 5.9;
    a *= 0.5;
  }
  return s / n;
}

export function ridged3(x, y, z, oct = 3) {
  let a = 0.5, s = 0, n = 0;
  for (let i = 0; i < oct; i++) {
    const r = 1 - Math.abs(noise3(x, y, z));
    s += a * r * r;
    n += a;
    x = x * 2.1 + 11.3;
    y = y * 2.1 + 5.9;
    z = z * 2.1 - 8.2;
    a *= 0.5;
  }
  return s / n;
}

export const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Small deterministic random generator for scatter. */
export function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

/** GLSL value noise + fbm, prefixed so it can sit beside three's own chunks. */
export const GLSL_NOISE = /* glsl */ `
float iHash(vec3 p){
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float iNoise(vec3 p){
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(iHash(i), iHash(i + vec3(1,0,0)), f.x),
        mix(iHash(i + vec3(0,1,0)), iHash(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(iHash(i + vec3(0,0,1)), iHash(i + vec3(1,0,1)), f.x),
        mix(iHash(i + vec3(0,1,1)), iHash(i + vec3(1,1,1)), f.x), f.y),
    f.z);
}
float iFbm(vec3 p){
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 5; i++){
    s += a * iNoise(p);
    p = p * 2.03 + 17.1;
    a *= 0.5;
  }
  return s / 0.96875;
}
float iFbm3(vec3 p){
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 3; i++){
    s += a * iNoise(p);
    p = p * 2.03 + 17.1;
    a *= 0.5;
  }
  return s / 0.875;
}
`;
