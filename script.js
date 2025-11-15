// --- CANVAS & ELEMENTS ---
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const coordsEl = document.getElementById('coords');
const statusEl = document.getElementById('status');
const input = document.getElementById('coords-input');

// --- DEFAULT COORDS ---
let lat = 50.0561814;
let lon = 13.2822869;

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
    return this.lerp(v, this.lerp(u, this.grad(this.p[a], x, y), this.grad(this.p[b], x - 1, y)),
                    this.lerp(u, this.grad(this.p[a + 1], x, y - 1), this.grad(this.p[b + 1], x - 1, y - 1)));
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

// --- GPS TO SEED ---
function gpsToSeed(lat, lon) {
  const str = `${lat.toFixed(8)}${lon.toFixed(8)}`.replace(/\./g, '');
  let seed = 0;
  for (let c of str) seed = (seed * 31 + c.charCodeAt(0)) & 0xFFFFFFFF;
  return seed;
}

// --- GENERATE ART ---
function generateArt(lat, lon) {
  const seed = gpsToSeed(lat, lon);
  Math.random = function() {
    seed = (seed * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (seed & 0xFFFFFFF) / 0xFFFFFFF;
  };

  const T = {
    scale: 0.0012 + (lat % 1) * 0.002,
    octaves: 4 + Math.floor(Math.abs(lon % 1) * 4),
    rotation: (lat * 13.33) % 360,
    warp: Math.abs(Math.sin(seed * 0.00001)) * 1.5,
    grain: 0.7 + (lon % 1) * 0.3,
    vignette: 0.6 + (lat % 1) * 0.4,
    glitch: Math.floor(seed % 100) > 90,
    shape: seed % 5
  };

  const imgData = ctx.createImageData(canvas.width, canvas.height);
  const data = imgData.data;
  const w = canvas.width, h = canvas.height;
  const cx = w / 2, cy = h / 2;
  const rad = Math.min(w, h) * 0.4;

  const rot = T.rotation * Math.PI / 180;
  const cosR = Math.cos(rot), sinR = Math.sin(rot);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let fx = x - cx, fy = y - cy;

      // Rotation
      const rx = fx * cosR - fy * sinR;
      const ry = fx * sinR + fy * cosR;

      // Warping
      const wx = Math.sin(fy * 0.01) * T.warp * 30;
      const wy = Math.cos(fx * 0.01) * T.warp * 30;
      const nx = (rx + wx) * T.scale;
      const ny = (ry + wy) * T.scale;

      // Perlin
      let n = 0, amp = 1, freq = 1;
      for (let o = 0; o < T.octaves; o++) {
        n += perlin.noise(nx * freq + seed, ny * freq) * amp;
        amp *= 0.5; freq *= 2;
      }
      n = (n + T.octaves) / (T.octaves * 2);

      // Shape modes
      const dist = Math.sqrt(fx*fx + fy*fy) / rad;
      if (T.shape === 0) n *= (1 - dist * 0.8); // Organic
      else if (T.shape === 1) n = Math.abs(n - 0.5) < 0.03 ? 1 : 0; // Lines
      else if (T.shape === 2) n = Math.sin((rx + ry) * 0.02) * 0.5 + 0.5;
      else if (T.shape === 3) n = n > 0.6 ? 1 : 0.1; // Blocks
      else n = (n + Math.sin(dist * 10)) * 0.5;

      // Vignette
      n *= (1 - dist * T.vignette);

      // Posterize
      n = Math.floor(n * 6) / 6;

      // Grain
      n += (Math.random() - 0.5) * T.grain * 0.3;
      n = Math.max(0, Math.min(1, n));

      // Glitch
      if (T.glitch && Math.random() > 0.99) n = Math.random();

      const v = Math.floor(n * 255);
      data[i] = v; data[i+1] = v; data[i+2] = v; data[i+3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Update UI
  coordsEl.textContent = `${lat.toFixed(7)}N, ${lon.toFixed(7)}E`;
  statusEl.textContent = `SHAPE:${T.shape} | OCT:${T.octaves} | GLITCH:${T.glitch ? 'ON' : 'OFF'}`;
}

// --- INPUT PARSER ---
function parseCoords(str) {
  const match = str.match(/([\d.]+)\s*N?,?\s*([\d.]+)\s*E?/i);
  if (match) return { lat: parseFloat(match[1]), lon: parseFloat(match[2]) };
  return null;
}

// --- EVENT ---
input.addEventListener('input', () => {
  const parsed = parseCoords(input.value);
  if (parsed) {
    lat = parsed.lat;
    lon = parsed.lon;
    generateArt(lat, lon);
    input.style.borderColor = '#0f0';
  } else {
    input.style.borderColor = '#f00';
  }
});

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
  generateArt(lat, lon);
  input.value = `${lat}N, ${lon}E`;
});
