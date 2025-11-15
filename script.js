// --- VÝBĚR PRVKŮ ---
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const input = document.getElementById('coords-input');
const currentCoordsEl = document.getElementById('current-coords');
const statusEl = document.getElementById('status');

const joystickBase = document.getElementById('joystick-base');
const joystickHandle = document.getElementById('joystick-handle');


// --- KONSTANTY A ZÁKLADNÍ PROMĚNNÉ ---
const DEFAULT_LAT = 50.0561814;
const DEFAULT_LON = 13.2822869;
let lat = DEFAULT_LAT;
let lon = DEFAULT_LON;
let baseLat = DEFAULT_LAT;
let baseLon = DEFAULT_LON;

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
        const X = Math.floor(x) & 255; const Y = Math.floor(y) & 255;
        x -= Math.floor(x); y -= Math.floor(y);
        const u = this.fade(x); const v = this.fade(y);
        const a = this.p[X] + Y; const b = this.p[X + 1] + Y;
        return this.lerp(v, this.lerp(u, this.grad(this.p[a], x, y), this.grad(this.p[b], x - 1, y)),
                        this.lerp(u, this.grad(this.p[a + 1], x, y - 1), this.grad(this.p[b + 1], x - 1, y - 1)));
    }
    fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    lerp(t, a, b) { return a + t * (b - a); }
    grad(hash, x, y) {
        const h = hash & 15; const u = h < 8 ? x : y;
        const v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }
}
const perlin = new Perlin();

// --- FUNKCE: GENETIKA SOUŘADNIC (Upraveno pro 3D Fade) ---
function CoordinateGenetics(lat, lon) {
    const traits = {};
    const latStr = String(lat.toFixed(8)).replace('.', '');
    const lonStr = String(lon.toFixed(8)).replace('.', '');
    const L = latStr.split('').map(Number);
    const N = lonStr.split('').map(Number);
    const Digits = L.concat(N);

    // 1. CHAOTICKÝ ZÁKLAD
    const lat10k = lat * 10000;
    const lon10k = lon * 10000;
    traits.Seed_A = Math.tan(lat10k % 100) * 1234;
    traits.Seed_B = Math.tan(lon10k % 100) * 5678;
    traits.FinalSeed = (traits.Seed_A * traits.Seed_B) / 1000;
    traits.OffsetX = Math.pow(lat10k, 2) * 0.00001;
    traits.OffsetY = Math.pow(lon10k, 2) * 0.00001;
    traits.ScaleX = 0.0015 + (Math.sin(traits.FinalSeed * 0.0001) * 0.001);
    traits.ScaleY = 0.0015 + (Math.cos(traits.FinalSeed * 0.0001) * 0.001);

    // 2. PRAVIDLA ZÁVISLÁ NA ČÍSLICÍCH
    const fifthDigitLat = L[4] || 0;
    traits.ShapeMode = 0; 
    if (fifthDigitLat === 0) { traits.ShapeMode = 3; } 
    else if (fifthDigitLat < 5) { traits.ShapeMode = 1; } 
    else { traits.ShapeMode = 2; } 

    // Rotace (zůstává)
    const lastFourLon = N.slice(-4);
    const sumLastFour = lastFourLon.reduce((a, b) => a + b, 0);
    traits.RotationFactor = 0;
    traits.WarpingIntensity = 0.0;
    if (sumLastFour > 20) {
        const evenRotation = N.filter(d => d % 2 === 0).reduce((a, b) => a + b, 0);
        traits.RotationFactor = evenRotation * 0.05; 
        traits.WarpingIntensity = 0.8; 
    } else {
        traits.WarpingIntensity = 0.2; 
    }
    
    // Vlastnosti pro "Nostalgii"
    traits.GrainIntensity = 0.8 + (N[N.length - 1] / 9 * 0.2); 
    traits.VignetteIntensity = 0.5 + (L[0] / 9) * 0.5; 
    
    const sumDigits = L.reduce((a, b) => a + b, 0);
    traits.PosterizationLevels = 4 + (sumDigits % 5); 
    
    // Úprava pro 3D FADE (pomalejší pokles = jemnější hloubka)
    const sumFirstFourLat = L.slice(0, 4).reduce((a, b) => a + b, 0);
    traits.Octaves = 4 + Math.min(3, Math.floor(sumFirstFourLat / 8)); 
    // Nový parametr pro sílu nízkofrekvenčního "fade"
    traits.LowFreqWeight = 0.5 + Math.sin(lat * 10) * 0.5; 

    return traits;
}


// --- FUNKCE PRO VYKRESLOVÁNÍ OBRAZU (Upraveno pro 3D Fade) ---
function generateGrainyImage(lat, lon) {
    GENETIC_TRAITS = CoordinateGenetics(lat, lon);
    const T = GENETIC_TRAITS;

    const imgData = ctx.createImageData(canvas.width, canvas.height);
    const data = imgData.data;
    
    const width = canvas.width;
    const height = canvas.height;
    
    const noiseOffsetX = T.OffsetX * 100 + T.FinalSeed / 1000;
    const noiseOffsetY = T.OffsetY * 100 + T.FinalSeed / 1000;
    const baseSeed = T.FinalSeed * 0.0001;
    
    const rot = T.RotationFactor * Math.PI / 180;
    const cosR = Math.cos(rot);
    const sinR = Math.sin(rot);
    const centerX = width / 2;
    const centerY = height / 2;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            let fx = x - centerX;
            let fy = y - centerY;
            let rotatedX = fx * cosR - fy * sinR;
            let rotatedY = fx * sinR + fy * cosR;
            const warpX = Math.sin(fy * 0.02) * 20 * T.WarpingIntensity;
            const warpY = Math.cos(fx * 0.02) * 20 * T.WarpingIntensity;
            rotatedX += warpX;
            rotatedY += warpY;
            
            const nx = (rotatedX * T.ScaleX * T.F1_Mod) + noiseOffsetX;
            const ny = (rotatedY * T.ScaleY * T.F1_Mod) + noiseOffsetY;
            
            let n = 0;
            let amplitude = 1; 
            let frequency = 1;
            
            // Octave Loop s pomalejším poklesem (0.6 místo 0.5 pro jemnější fade)
            for (let oct = 0; oct < T.Octaves; oct++) {
                n += perlin.noise(nx * frequency, ny * frequency + baseSeed) * amplitude;
                amplitude *= 0.6; 
                frequency *= 2;
            }
            
            // Přidání silné nízkofrekvenční složky pro 3D efekt (světlo/stín)
            n += perlin.noise(nx * 0.1, ny * 0.1 + baseSeed) * -T.LowFreqWeight; 
            
            n = (n + 1) / 2; 

            // Aplikace kontrastu pro "objekt"
            let contrastN = n;
            if (T.ShapeMode === 1) { 
                const dist = Math.sqrt(fx * fx + fy * fy) / width;
                contrastN = n * (1 - Math.pow(dist, 0.5) * 0.7); 
            } else if (T.ShapeMode === 2) { 
                 contrastN = (Math.abs(n - 0.5) < 0.02) ? 0.0 : 1.0; 
            } else if (T.ShapeMode === 3) { 
                 contrastN = n * 0.7 + Math.sin((rotatedX + rotatedY) / width * Math.PI) * 0.3;
            }
            
            // Aplikace "Nostalgie"
            // 1. Vinětace
            const v_dist = Math.sqrt(fx*fx + fy*fy) / (width * 0.7); 
            const vignette = 1.0 - (v_dist * T.VignetteIntensity);
            let finalN = contrastN * vignette;
            
            // 2. Posterizace
            const posterStep = 255 / T.PosterizationLevels;
            let base_value = Math.floor((finalN * 255) / posterStep) * posterStep;

            // 3. Zrnitost
            const grain = (Math.random() - 0.5) * T.GrainIntensity * 255;
            
            // --- Finální pixel (MONOCHROMATICKÝ) ---
            const finalValue = Math.floor(Math.max(0, Math.min(255, base_value + grain)));
            
            data[i] = finalValue;     
            data[i+1] = finalValue;   
            data[i+2] = finalValue;   
            data[i+3] = 255;          
        }
    }
    ctx.putImageData(imgData, 0, 0);
    // Aktualizace statusu 
    statusEl.textContent = `Tvar: ${['Default','Objekt','Linky','Diagonála'][T.ShapeMode]}, Úrovně: ${T.PosterizationLevels}, Fade: ${T.LowFreqWeight.toFixed(2)}`;
}


// --- OBSLUHA VSTUPU A JOYSTICKU (Beze změny) ---

function parseCoords(str) {
    const match = str.match(/([\d.]+)N?,\s*([\d.]+)E?/i);
    if (match) {
        return { lat: parseFloat(match[1]), lon: parseFloat(match[2]) };
    }
    return null;
}

function updateGpsAndGenerate(newLat, newLon) {
    lat = newLat;
    lon = newLon;
    currentCoordsEl.textContent = `${lat.toFixed(7)}N, ${lon.toFixed(7)}E`;
    generateGrainyImage(lat, lon);
}

input.addEventListener('input', () => {
    const parsed = parseCoords(input.value);
    if (parsed) {
        baseLat = parsed.lat;
        baseLon = parsed.lon;
        joystickHandle.style.transform = 'translate(0, 0)';
        updateGpsAndGenerate(baseLat, baseLon);
        statusEl.textContent = "Souřadnice načteny a resetovány";
    } else {
        statusEl.textContent = "Neplatný formát (použij: 50.123N, 13.456E)";
    }
});

let isDragging = false;

function getMetersPerDegree(lat) {
    const LAT_DEGREE_METER = 111132;
    const LON_DEGREE_METER = 111132 * Math.cos(lat * (Math.PI / 180));
    return { lat: LAT_DEGREE_METER, lon: LON_DEGREE_METER };
}

function startDrag(e) {
    e.preventDefault();
    isDragging = true;
    document.body.style.userSelect = 'none';
}

function handleMove(clientX, clientY) {
    if (!isDragging) return;

    const baseRect = joystickBase.getBoundingClientRect();
    const handleRect = joystickHandle.getBoundingClientRect();
    
    const centerX = baseRect.left + baseRect.width / 2;
    const centerY = baseRect.top + baseRect.height / 2;
    
    let deltaX = clientX - centerX;
    let deltaY = clientY - centerY;
    
    const maxDist = (baseRect.width / 2) - (handleRect.width / 2);
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    if (distance > maxDist) {
        deltaX = (deltaX / distance) * maxDist;
        deltaY = (deltaY / distance) * maxDist;
    }
    
    joystickHandle.style.transform = `translate(${deltaX}px, ${deltaY}px)`;

    const normX = deltaX / maxDist; 
    const normY = deltaY / maxDist; 

    const metersLon = normX * 10; 
    const metersLat = -normY * 10;

    const meters = getMetersPerDegree(baseLat);
    
    const latDelta = metersLat / meters.lat; 
    const lonDelta = metersLon / meters.lon;

    const newLat = parseFloat((baseLat + latDelta).toFixed(7));
    const newLon = parseFloat((baseLon + lonDelta).toFixed(7));
    
    updateGpsAndGenerate(newLat, newLon);
}

function endDrag() {
    if (!isDragging) return;
    isDragging = false;
    document.body.style.userSelect = '';
    
    joystickHandle.style.transform = 'translate(0, 0)';
    
    baseLat = lat;
    baseLon = lon;
}

// Event Listenery pro MYŠ
joystickHandle.addEventListener('mousedown', startDrag);
document.addEventListener('mousemove', (e) => handleMove(e.clientX, e.clientY));
document.addEventListener('mouseup', endDrag);

// Event Listenery pro DOTYK (pro mobily)
joystickHandle.addEventListener('touchstart', (e) => startDrag(e.touches[0]));
document.addEventListener('touchmove', (e) => {
    if (isDragging) e.preventDefault();
    handleMove(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: false });
document.addEventListener('touchend', endDrag);

// Inicializace po načtení DOM
document.addEventListener('DOMContentLoaded', () => {
    updateGpsAndGenerate(baseLat, baseLon);
});
