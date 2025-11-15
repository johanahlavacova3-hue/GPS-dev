const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const input = document.getElementById('coords-input');
const currentCoordsEl = document.getElementById('current-coords');
const statusEl = document.getElementById('status');
const wheel = document.getElementById('wheel');

// Startovní souřadnice pro kolečko
const DEFAULT_LAT = 50.0561814;
const DEFAULT_LON = 13.2822869;
let lat = DEFAULT_LAT;
let lon = DEFAULT_LON;
let baseLat = DEFAULT_LAT;
let baseLon = DEFAULT_LON;
let wheelRotation = 0;

// Perlin noise class - Zůstává beze změny
class Perlin {
  constructor() {
    this.p = new Array(512);
    this.permutation = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,
      190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,
      175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,
      54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,
      52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,
      119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,
      246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,
      84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
    for (let i = 0; i < 256; i++) this.p[i] = this.p[i + 256] = this.permutation[i];
  }

  noise(x, y) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    const u = this.fade(x);
    const v = this.fade(y);
    const a = this.p[X] + Y;
    const b = this.p[X + 1] + Y;
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

// Funkce pro generování rozmanitějšího obrazu
function generateGrainyImage(lat, lon) {
  const imgData = ctx.createImageData(canvas.width, canvas.height);
  const data = imgData.data;

  // --- RADIKÁLNĚ UPRAVENÁ MATEMATIKA pro CHAOS ---
  // Převedeme souřadnice na desetitisíce a zbytek pro radikální rozdělení vlivu
  const lat10k = lat * 10000;
  const lon10k = lon * 10000;

  // Použijeme MODULO a TANGENS pro radikální změnu SEEDU
  // Tangens má asymptoty, což způsobí obrovské skoky ve výstupu při malém posunu vstupu.
  const chaotic_seed_lat = Math.tan(lat10k % 100) * 10000; 
  const chaotic_seed_lon = Math.tan(lon10k % 100) * 10000;
  
  // Semínko kombinující obě chaotické hodnoty
  const final_seed = (chaotic_seed_lat * 1234) + (chaotic_seed_lon * 5678);

  // OFSETY: Exponenciální posun pro texturu
  // Math.pow zajistí, že desáté desetinné místo má exponenciální vliv
  const exp_lat = Math.pow(lat10k, 2) * 0.00001; 
  const exp_lon = Math.pow(lon10k, 2) * 0.00001; 

  const offset_x_base = (exp_lat - exp_lon) * 100;
  const offset_y_base = (exp_lat + exp_lon) * 100;

  // MĚŘÍTKO: Různé měřítko pro osy (deformace)
  const scale_base = 0.003; // ještě menší hodnota pro větší "zoom"
  const scale_mod_x = 1 + (Math.sin(final_seed * 0.0001) * 0.8);
  const scale_mod_y = 1 + (Math.cos(final_seed * 0.0001) * 0.8);
  
  const scaleX = scale_base * scale_mod_x;
  const scaleY = scale_base * scale_mod_y;

  // Vlastnosti zrnitosti a barvy
  const color_cycle = Math.sin(final_seed * 0.000005) * 100; // Velmi pomalý cyklus barev
  const grain_intensity = 0.8 + (Math.sin(lon * 5) * 0.5); // Intenzita je nyní vyšší a dynamická

  // --- Konec upravené matematiky ---

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4;

      // Dynamický vstup pro Perlinův šum
      const nx = x * scaleX + offset_x_base + final_seed;
      const ny = y * scaleY + offset_y_base + final_seed * 1.5;

      // Více oktáv pro komplexnější, organickou texturu
      let n = 0;
      let amplitude = 1;
      let frequency = 1;
      
      for (let oct = 0; oct < 6; oct++) { // Zvýšeno na 6 oktáv
        n += perlin.noise(nx * frequency, ny * frequency) * amplitude;
        amplitude *= 0.4; // Rychlejší útlum
        frequency *= 2.5; // Rychlejší růst frekvence
      }

      n = (n + 1) / 2; // Normalizace 0..1

      // Grainy effect
      const grain = (Math.random() - 0.5) * grain_intensity * 255;
      const base_value = n * 255;
      
      // Dynamické barvy s chaotickým posunem
      // Používáme Math.tan(x/y) pro chaotické mapování pixelů na barvy
      const r_chaos = Math.sin(x / 50 + color_cycle) * 70;
      const g_chaos = Math.cos(y / 50 + color_cycle) * 70;
      const b_chaos = Math.tan((x * y) * 0.000001) * 70;


      const r = Math.floor(Math.max(0, Math.min(255, base_value + grain + r_chaos)));
      const g = Math.floor(Math.max(0, Math.min(255, base_value + grain * 0.8 + g_chaos)));
      const b = Math.floor(Math.max(0, Math.min(255, base_value + grain * 1.2 + b_chaos)));


      data[i] = r;        // Červená
      data[i+1] = g;      // Zelená
      data[i+2] = b;      // Modrá
      data[i+3] = 255;    // Alfa (plná neprůhlednost)
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

// Ostatní funkce (parseCoords, updateCoords, obsluha kolečka) zůstávají stejné pro interakci

function parseCoords(str) {
  const match = str.match(/([\d.]+)N?,\s*([\d.]+)E?/i);
  if (match) {
    return { lat: parseFloat(match[1]), lon: parseFloat(match[2]) };
  }
  return null;
}

function updateCoords() {
  currentCoordsEl.textContent = `${lat.toFixed(7)}N, ${lon.toFixed(7)}E`;
  generateGrainyImage(lat, lon);
  wheel.style.transform = `rotate(${wheelRotation * (180 / Math.PI)}deg)`;
}

input.addEventListener('input', () => {
  const parsed = parseCoords(input.value);
  if (parsed) {
    baseLat = parsed.lat;
    baseLon = parsed.lon;
    lat = baseLat; // Reset lat/lon k novým bázovým souřadnicím
    lon = baseLon;
    wheelRotation = 0;
    updateCoords();
    statusEl.textContent = "Souřadnice načteny a resetovány";
  } else {
    statusEl.textContent = "Neplatný formát (použij: 50.123N, 13.456E)";
  }
});

// Wheel rotation
let isDragging = false;
let startAngle = 0;
let startRotation = 0;

wheel.addEventListener('mousedown', (e) => {
  e.preventDefault();
  isDragging = true;
  const rect = wheel.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
  startRotation = wheelRotation;
  document.body.style.userSelect = 'none'; // Zabrání výběru textu při tažení
});

document.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  const rect = wheel.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
  const delta = angle - startAngle;
  wheelRotation = startRotation + delta;

  // 1 plná rotace = 360° = 20 metrů (10m nahoru/dolu)
  const meters = (wheelRotation / (Math.PI * 2)) * 20;
  // Přibližný přepočet metrů na stupně (v Česku, šířka 50°)
  const LAT_DEGREE_METER = 111132; // ~metrů na 1° Lat
  const LON_DEGREE_METER = 111132 * Math.cos(baseLat * (Math.PI / 180)); // ~metrů na 1° Lon (závisí na Lat)
  
  // Rozdělíme posun na Lat a Lon (např. 80% Lat, 20% Lon)
  const latDelta = (meters * 0.8) / LAT_DEGREE_METER; 
  const lonDelta = (meters * 0.2) / LON_DEGREE_METER;

  lat = parseFloat((baseLat + latDelta).toFixed(7));
  lon = parseFloat((baseLon + lonDelta).toFixed(7));
  
  updateCoords();
  statusEl.textContent = `Posun: ±${(meters).toFixed(2)} m (Lat: ${latDelta.toFixed(7)}, Lon: ${lonDelta.toFixed(7)})`;
});

document.addEventListener('mouseup', () => {
  isDragging = false;
  document.body.style.userSelect = '';
});

// Inicializace po načtení DOM
document.addEventListener('DOMContentLoaded', () => {
    updateCoords();
});
