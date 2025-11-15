// --- ELEMENTS ---
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const coordsEl = document.getElementById('coords');
const statusEl = document.getElementById('status');
const input = document.getElementById('coords-input');

// --- DEFAULT ---
let currentLat = 50.0561814;
let currentLon = 13.2822869;

// --- PERLIN NOISE ---
class Perlin {
  constructor() {
    this.p = new Array(512);
    this.permutation = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
    for (let i = 0; i < 256; i++) this.p[i] = this.p[i + 256] = this.permutation[i];
  }
  noise(x, y) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    x -= Math.floor(x); y -= Math.floor(y);
    const u = this.fade(x), v = this.fade(y);
    const a = this.p[X] + Y, b = this.p[X + 1] + Y;
    return this.lerp(v,
      this.lerp(u, this.grad(this.p[a], x, y), this.grad(this.p[b], x - 1, y)),
      this.lerp(u, this.grad(this.p[a + 1], x, y - 1), this.grad(this.p[b + 1], x - 1, y - 1))
    );
  }
  fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  lerp(t, a, b) { return a + t * (b - a); }
  grad(hash, x, y) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }
}
const perlin = new Perlin();

// --- GPS → SEED ---
function gpsToSeed(lat, lon) {
  const str = `${lat.toFixed(8)}${lon.toFixed(8)}`.replace(/\./g, '');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) & 0xFFFFFFFF;
  }
  return hash;
}

// --- SEEDOVANÝ RANDOM ---
function createSeededRandom(seed) {
  let s = seed & 0xFFFFFFFF;
  return function() {
    s = (s * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (s & 0xFFFFFFF) / 0xFFFFFFF;
  };
}

// --- HSL → RGB ---
function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) r = g = b = l;
  else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// --- GENEROVÁNÍ ARTU ---
function generateArt(lat, lon) {
  const seed = gpsToSeed(lat, lon);
  const rand = createSeededRandom(seed);

  const T = {
    scale: 0.0008 + (lat % 1) * 0.0012,
    octaves: 5 + Math.floor(Math.abs(lon % 1) * 3),
    height: 0.3 + (Math.abs(Math.sin(seed * 0.00001)) * 0.4),
    lightX: (lat % 1) * 2 - 1,
    lightY: (lon % 1) * 2 - 1,
    lightZ: 1.5,
    grain: 0.7 + (lon % 1) * 0.3,
    contrast: 1.2 + (lat % 1) * 0.8,
    vignette: 0.6 + (lat % 1) * 0.4,
    warp: 0.8 + Math.abs(Math.sin(seed * 0.00002)) * 1.2
  };

  const imgData = ctx.createImageData(canvas.width, canvas.height);
  const data = imgData.data;
  const w = canvas.width, h = canvas.height;
  const cx = w / 2, cy = h / 2;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let fx = (x - cx) / w * 2;
      let fy = (y - cy) / h * 2;

      const wx = Math.sin(fy * 8 + seed * 0.0001) * T.warp * 0.1;
      const wy = Math.cos(fx * 8 + seed * 0.0001) * T.warp * 0.1;
      fx += wx; fy += wy;

      let height = 0, amp = 1, freq = 1;
      for (let o = 0; o < T.octaves; o++) {
        height += perlin.noise(fx * T.scale * freq + seed, fy * T.scale * freq + seed * 0.5) * amp;
        amp *= 0.5;
        freq *= 2;
      }
      height = (height + T.octaves) / (T.octaves * 2);

      const nx = perlin.noise(fx
