const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const input = document.getElementById('coords-input');
const currentCoordsEl = document.getElementById('current-coords');
const statusEl = document.getElementById('status');
const wheel = document.getElementById('wheel');

// --- KONSTANTY A ZÁKLADNÍ PROMĚNNÉ ---
const DEFAULT_LAT = 50.0561814;
const DEFAULT_LON = 13.2822869;
let lat = DEFAULT_LAT;
let lon = DEFAULT_LON;
let baseLat = DEFAULT_LAT;
let baseLon = DEFAULT_LON;
let wheelRotation = 0;

// Objekt pro uchování všech 50 dynamicky vypočítaných vlastností
let GENETIC_TRAITS = {};

// --- TŘÍDA PERLIN NOISE (Zůstává nezměněna) ---
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


// --- HLAVNÍ FUNKCE: GENETIKA SOUŘADNIC ---

/**
 * Rozebere GPS souřadnice a vypočítá 50+ chaotických a logických vlastností.
 * @param {number} lat Šířka
 * @param {number} lon Délka
 */
function CoordinateGenetics(lat, lon) {
    const traits = {};
    const latStr = String(lat.toFixed(8)).replace('.', '');
    const lonStr = String(lon.toFixed(8)).replace('.', '');
    
    // Extrahování číslic
    const L = latStr.split('').map(Number);
    const N = lonStr.split('').map(Number);
    const Digits = L.concat(N);

    // 1. CHAOTICKÝ ZÁKLAD (Seed, Offset, Scale)
    const lat10k = lat * 10000;
    const lon10k = lon * 10000;
    
    // VLASTNOST 1-3: Hlavní chaotický Seed pomocí Tangens a Modulo
    traits.Seed_A = Math.tan(lat10k % 100) * 1234;
    traits.Seed_B = Math.tan(lon10k % 100) * 5678;
    traits.FinalSeed = (traits.Seed_A * traits.Seed_B) / 1000;

    // VLASTNOST 4-5: Základní Offsety pomocí mocnin
    traits.OffsetX = Math.pow(lat10k, 2) * 0.00001;
    traits.OffsetY = Math.pow(lon10k, 2) * 0.00001;

    // VLASTNOST 6-7: Deformační Měřítko (Scale)
    traits.ScaleX = 0.0025 + (Math.sin(traits.FinalSeed * 0.0001) * 0.002);
    traits.ScaleY = 0.0025 + (Math.cos(traits.FinalSeed * 0.0001) * 0.002);

    // 2. PRAVIDLA ZÁVISLÁ NA ČÍSLICÍCH (Shape, Color, Rotation)
    
    // Pravidlo A (Vlastnost 8): Tvar uprostřed (5. číslo v Lat)
    const fifthDigitLat = L[4] || 0; // Pátá číslice v Lat (index 4 po odstranění tečky)
    traits.ShapeMode = 0; // 0 = default, 1 = organický, 2 = pavučina, 3 = diagonální

    if (fifthDigitLat === 0) {
        traits.ShapeMode = 3; // Diagonální
        traits.ColorBias = 'blue';
        traits.FrequencyMod = 1.5;
    } else if (fifthDigitLat < 5) {
        traits.ShapeMode = 1; // Organický/Rozmazaný
        traits.ColorBias = 'green';
        traits.FrequencyMod = 0.5;
    } else {
        traits.ShapeMode = 2; // Pavučina/Ostře linkovaný
        traits.ColorBias = 'red';
        traits.FrequencyMod = 2.0;
    }

    // Pravidlo B (Vlastnost 9-11): Rotace a "Varhánky" (Poslední 4 čísla)
    const lastFourLon = N.slice(-4);
    const sumLastFour = lastFourLon.reduce((a, b) => a + b, 0);

    traits.RotationFactor = 0;
    traits.WarpingIntensity = 0;

    if (sumLastFour > 20) {
        // Rotace sudých číslic
        const evenRotation = N.filter(d => d % 2 === 0).reduce((a, b) => a + b, 0);
        traits.RotationFactor = evenRotation * 0.1; // Rotace
        traits.WarpingIntensity = 1.0; // Varhánky (silná deformace)
        traits.ColorHeat = 1; // Teplý k sobě (heatmap efekt)
    } else {
        traits.RotationFactor = 0;
        traits.WarpingIntensity = 0.1; // Jen lehká deformace
        traits.ColorHeat = 0; // Studený/Mono
    }
    
    // VLASTNOST 12: Náhodnost zrnitosti (z poslední číslice Lon)
    traits.GrainIntensity = 0.3 + (N[N.length - 1] / 9 * 0.7);

    // VLASTNOST 13-50: Vytvoření dalších 38 proměnných pro extrémní detail
    // Tyto proměnné chaoticky modifikují Perlinův šum a barvy.
    // Používá se kombinace sčítání, násobení, sin, cos a modulo na různých indexech číslic.
    
    for (let k = 0; k < 38; k++) {
        const i = k % Digits.length; // Index číslice
        const j = (k + 5) % Digits.length; // Posunutý index

        const d_i = Digits[i] || 1;
        const d_j = Digits[j] || 1;

        // Chaotické proměnné pro frekvenci a amplitudu
        traits[`F${k}_Mod`] = 1 + (d_i * Math.sin(lat) * 0.5) + (d_j * Math.cos(lon) * 0.5);
        
        // Chaotické proměnné pro barevné posuny
        traits[`C${k}_Shift`] = Math.sin(lat10k + lon10k * d_i) * (d_j + 1) * 20;

        // Modifikace pro warp efekt
        traits[`W${k}_Map`] = (d_i * d_j * lat) % (k + 1);
    }
    
    // VLASTNOST 51: Počet oktáv (ovlivněn součtem prvních 4 číslic)
    const sumFirstFourLat = L.slice(0, 4).reduce((a, b) => a + b, 0);
    traits.Octaves = 3 + Math.min(4, Math.floor(sumFirstFourLat / 5)); // 3 až 7 oktáv

    return traits;
}


// --- FUNKCE PRO VYKRESLOVÁNÍ OBRAZU ---

function generateGrainyImage(lat, lon) {
    // 1. Získání genetických vlastností pro tuto sadu souřadnic
    GENETIC_TRAITS = CoordinateGenetics(lat, lon);
    const T = GENETIC_TRAITS; // Alias pro snadnější použití

    const imgData = ctx.createImageData(canvas.width, canvas.height);
    const data = imgData.data;
    
    // Předvýpočty pro rychlost
    const width = canvas.width;
    const height = canvas.height;
    
    const noiseOffsetX = T.OffsetX * 100 + T.FinalSeed / 1000;
    const noiseOffsetY = T.OffsetY * 100 + T.FinalSeed / 1000;
    
    // Pevný základní Seed, který se mění jen při velkém posunu (kvůli T.FinalSeed)
    const baseSeed = T.FinalSeed * 0.0001;
    
    // Rotace (příprava matice rotace)
    const rot = T.RotationFactor * Math.PI / 180;
    const cosR = Math.cos(rot);
    const sinR = Math.sin(rot);
    const centerX = width / 2;
    const centerY = height / 2;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;

            // A. Aplikace rotace a varhánků (Warping)
            let fx = x - centerX;
            let fy = y - centerY;
            
            // Základní rotace
            let rotatedX = fx * cosR - fy * sinR;
            let rotatedY = fx * sinR + fy * cosR;

            // Varhánky (Warping) – Používá se sinusoida
            const warpX = Math.sin(fy * 0.02 * T.WarpingIntensity) * 10;
            const warpY = Math.cos(fx * 0.02 * T.WarpingIntensity) * 10;
            
            rotatedX += warpX * T.WarpingIntensity;
            rotatedY += warpY * T.WarpingIntensity;
            
            // B. Perlinův šum s Genetickými vlastnostmi
            const nx = (rotatedX * T.ScaleX * T.FrequencyMod) + noiseOffsetX;
            const ny = (rotatedY * T.ScaleY * T.FrequencyMod) + noiseOffsetY;
            
            let n = 0;
            let amplitude = 1;
            let frequency = 1;
            
            // Víceoktávový šum
            for (let oct = 0; oct < T.Octaves; oct++) {
                n += perlin.noise(nx * frequency, ny * frequency + baseSeed) * amplitude;
                amplitude *= 0.5;
                frequency *= 2;
            }
            
            n = (n + 1) / 2; // Normalizace 0..1

            // C. Speciální Filtry pro Tvar (ShapeMode)
            let finalN = n;
            
            if (T.ShapeMode === 1) { // Organický tvar uprostřed (nižší frekvence šumu do středu)
                const dist = Math.sqrt(fx * fx + fy * fy) / width;
                finalN = n * (1 - dist * 0.5); 
            } else if (T.ShapeMode === 2) { // Pavučina (hrubé filtrování pro linky)
                 finalN = (n > 0.49 && n < 0.51) ? 0.0 : 1.0;
            } else if (T.ShapeMode === 3) { // Diagonální
                 finalN = n + ((rotatedX + rotatedY) / width) * 0.5;
            }
            
            // D. Vykreslování pixelu
            const grain = (Math.random() - 0.5) * T.GrainIntensity * 255;
            const base_value = finalN * 255;
            
            let r, g, b;
            
            // Barevné schéma (ColorHeat)
            if (T.ColorHeat === 1) { // Teplý k sobě (červené, žluté)
                 r = Math.floor(Math.max(0, Math.min(255, base_value + grain + T.C1_Shift)));
                 g = Math.floor(Math.max(0, Math.min(255, base_value * 0.8 + grain * 0.8)));
                 b = Math.floor(Math.max(0, Math.min(255, base_value * 0.4 + grain * 0.4 - T.C2_Shift)));
            } else { // Studený/Mono
                 r = Math.floor(Math.max(0, Math.min(255, base_value + grain * 0.5 + T.C1_Shift * 0.1)));
                 g = Math.floor(Math.max(0, Math.min(255, base_value + grain + T.C2_Shift * 0.1)));
                 b = Math.floor(Math.max(0, Math.min(255, base_value + grain * 1.5 - T.C3_Shift * 0.1)));
            }
            
            data[i] = r;
            data[i+1] = g;
            data[i+2] = b;
            data[i+3] = 255;
        }
    }

    ctx.putImageData(imgData, 0, 0);
    // Aktualizace statusu s aplikovanými pravidly
    statusEl.textContent = `Tvar: ${['Default','Organický','Pavučina','Diagonální'][T.ShapeMode]}, Rotace: ${T.RotationFactor.toFixed(2)} rad, Varhánky: ${T.WarpingIntensity.toFixed(1)}`;
}


// --- OBSLUHA VSTUPU A KOLA (Zůstává beze změny) ---

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
    document.body.style.userSelect = 'none';
});

document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const rect = wheel.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
    const delta = angle - startAngle;
    wheelRotation = startRotation + delta;

    const meters = (wheelRotation / (Math.PI * 2)) * 20;
    const LAT_DEGREE_METER = 111132;
    const LON_DEGREE_METER = 111132 * Math.cos(baseLat * (Math.PI / 180));
    
    const latDelta = (meters * 0.8) / LAT_DEGREE_METER; 
    const lonDelta = (meters * 0.2) / LON_DEGREE_METER;

    lat = parseFloat((baseLat + latDelta).toFixed(7));
    lon = parseFloat((baseLon + lonDelta).toFixed(7));
    
    updateCoords();
});

document.addEventListener('mouseup', () => {
    isDragging = false;
    document.body.style.userSelect = '';
});

// Inicializace po načtení DOM
document.addEventListener('DOMContentLoaded', () => {
    updateCoords();
});
