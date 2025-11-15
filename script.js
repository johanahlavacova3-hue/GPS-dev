const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const input = document.getElementById('coords-input');
const currentCoordsEl = document.getElementById('coords');
const statusEl = document.getElementById('status');

const blurSlider = document.getElementById('blur-slider');
const grainSlider = document.getElementById('grain-slider');

const joystick = document.getElementById('joystick');
const knob = document.getElementById('joystick-knob');

const resetBtn = document.getElementById('reset-btn');

const DEFAULT_LAT = 50.0561814;
const DEFAULT_LON = 13.2822869;

let lat = DEFAULT_LAT;
let lon = DEFAULT_LON;

let baseLat = DEFAULT_LAT;
let baseLon = DEFAULT_LON;

let GENETIC_TRAITS = {};

// === Perlin Noise ===
class Perlin {
    constructor() {
        this.p = new Array(512);
        this.permutation = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];

        for (let i = 0; i < 256; i++) {
            this.p[i] = this.p[i + 256] = this.permutation[i];
        }
    }
    noise(x, y) {
        const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
        x -= Math.floor(x);
        y -= Math.floor(y);
        const u = this.fade(x), v = this.fade(y);
        const a = this.p[X] + Y, b = this.p[X + 1] + Y;
        return this.lerp(
            v,
            this.lerp(u, this.grad(this.p[a], x, y), this.grad(this.p[b], x - 1, y)),
            this.lerp(u, this.grad(this.p[a + 1], x, y - 1), this.grad(this.p[b + 1], x - 1, y - 1))
        );
    }
    fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    lerp(t, a, b) { return a + t * (b - a); }
    grad(h, x, y) {
        const hh = h & 15;
        const u = hh < 8 ? x : y;
        const v = hh < 4 ? y : hh === 12 || hh === 14 ? x : 0;
        return ((hh & 1) === 0 ? u : -u) + ((hh & 2) === 0 ? v : -v);
    }
}
const perlin = new Perlin();


// === Coordinate Genetics ===
function CoordinateGenetics(lat, lon) {
    const traits = {};

    const lat10k = lat * 10000, lon10k = lon * 10000;

    traits.OffsetX = Math.pow(lat10k, 2) * 0.00001;
    traits.OffsetY = Math.pow(lon10k, 2) * 0.00001;

    traits.FinalSeed = Math.tan(lat10k % 100) * 1234 * Math.tan(lon10k % 100) * 5678 / 1000;

    traits.GrainIntensity = 0.8;

    return traits;
}


// === ORGANICKÝ TVAR UPROSTŘED (vylepšený o kontury a textury) ===
function generateCentralObject(lat, lon) {

    GENETIC_TRAITS = CoordinateGenetics(lat, lon);
    const T = GENETIC_TRAITS;

    const w = canvas.width;
    const h = canvas.height;

    const img = ctx.createImageData(w, h);
    const d = img.data;

    const cx = w / 2;
    const cy = h / 2;

    const BASE_RADIUS = Math.min(w, h) * 0.25;

    const SHAPE_LAYERS = 3 + Math.floor(Math.random() * 3);

    const SOFTNESS = 0.85;
    const DEFORM = 0.35;
    const BLUR_NOISE_SCALE = 0.009;

    const shapeFields = [];

    for (let s = 0; s < SHAPE_LAYERS; s++) {
        const points = [];
        const pointCount = 5 + Math.floor(Math.random() * 8);

        for (let i = 0; i < pointCount; i++) {
            const ang = (Math.PI * 2 * i) / pointCount;
            const radius =
                BASE_RADIUS *
                (0.6 + Math.random() * 0.8) *
                (1 + perlin.noise(i * 0.22, (T.FinalSeed + s) * 0.002) * DEFORM);

            points.push({
                x: cx + Math.cos(ang) * radius,
                y: cy + Math.sin(ang) * radius
            });
        }
        shapeFields.push(points);
    }


    function softField(px, py) {

        let fieldValue = 0;

        for (let l = 0; l < shapeFields.length; l++) {
            const pts = shapeFields[l];
            let minDist = Infinity;

            // distance to polygon edges
            for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {

                const x1 = pts[j].x, y1 = pts[j].y;
                const x2 = pts[i].x, y2 = pts[i].y;

                const A = px - x1;
                const B = py - y1;
                const C = x2 - x1;
                const D = y2 - y1;

                const dot = A * C + B * D;
                const lenSq = C * C + D * D;

                let t = dot / lenSq;
                t = Math.max(0, Math.min(1, t));

                const ex = x1 + t * C;
                const ey = y1 + t * D;

                const dx = px - ex;
                const dy = py - ey;

                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < minDist) minDist = dist;
            }

            let inside = false;
            for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
                const xi = pts[i].x, yi = pts[i].y;
                const xj = pts[j].x, yj = pts[j].y;

                const intersect =
                    (yi > py) !== (yj > py) &&
                    px < ((xj - xi) * (py - yi)) / ((yj - yi) + 0.00001) + xi;

                if (intersect) inside = !inside;
            }

            let layerField = inside ? 1 - minDist / (BASE_RADIUS * SOFTNESS) : 0;

            const n = perlin.noise(px * BLUR_NOISE_SCALE, py * BLUR_NOISE_SCALE);
            layerField *= 0.7 + n * 0.3;

            fieldValue = Math.max(fieldValue, layerField);
        }

        return fieldValue;
    }


    // === vykreslení pixelů ===
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {

            const i = (y * w + x) * 4;

            let f = softField(x, y);

            if (f <= 0) {
                d[i + 3] = 0;
                continue;
            }


            // --- EXTRA CONTOURS ---------------------------------------------------
            // několik vrstev vnitřního halo (zvýrazní organickou tvarovost bez hran)
            const contour = perlin.noise(x * 0.02, y * 0.02) * 0.15;
            f = Math.min(1, f + contour);


            // --- EXTRA TEXTURE ----------------------------------------------------
            // jemné vláknité struktury uvnitř (mikroskopický materiál)
            const fib =
                perlin.noise(x * 0.05 + T.OffsetX * 10, y * 0.01 + T.OffsetY * 10) * 0.25 -
                perlin.noise(x * 0.01, y * 0.07) * 0.25;

            const extraTex = fib * 0.6;
            const finalField = Math.max(0, Math.min(1, f + extraTex));


            // grain
            const grain = (Math.random() - 0.5) * 45 * T.GrainIntensity;

            // basic grayscale tone
            let n = perlin.noise(
                x * 0.01 + T.OffsetX * 50,
                y * 0.01 + T.OffsetY * 50
            );
            n = (n + 1) / 2;

            const gray = Math.min(255, Math.max(0, n * 255 + grain));

            d[i] = gray;
            d[i + 1] = gray;
            d[i + 2] = gray;
            d[i + 3] = Math.floor(finalField * 255);
        }
    }

    ctx.clearRect(0, 0, w, h);
    ctx.putImageData(img, 0, 0);
}


// === Parsování GPS ===
function parseCoords(str) {
    const m = str.match(/([\d.]+)N?,\s*([\d.]+)E?/i);
    if (m) return { lat: parseFloat(m[1]), lon: parseFloat(m[2]) };
    return null;
}

function updateCoords() {
    currentCoordsEl.textContent = `${lat.toFixed(7)}N, ${lon.toFixed(7)}E`;
    generateCentralObject(lat, lon);
}


// === INPUT ===
input.addEventListener("change", () => {
    const p = parseCoords(input.value);
    if (p) {
        baseLat = p.lat;
        baseLon = p.lon;
        lat = baseLat;
        lon = baseLon;
        updateCoords();
    } else {
        statusEl.textContent = "Neplatný formát (použij: 50.123N, 13.456E)";
    }
});

blurSlider.addEventListener("input", updateCoords);
grainSlider.addEventListener("input", updateCoords);


// === RESET ===
resetBtn.addEventListener("click", () => {
    baseLat = DEFAULT_LAT;
    baseLon = DEFAULT_LON;
    lat = baseLat;
    lon = baseLon;

    input.value = `${baseLat.toFixed(7)}N, ${baseLon.toFixed(7)}E`;
    updateCoords();
});


// === JOYSTICK ===
const JOY_MAX_PX = 40;
const JOY_MAX_METERS = 10;

let dragging = false;

function startDrag(e) {
    dragging = true;
    knob.setPointerCapture(e.pointerId);
}

function stopDrag(e) {
    dragging = false;

    knob.style.transition = "transform 200ms cubic-bezier(.2,.8,.2,1)";
    knob.style.transform = "translate(0px,0px)";

    lat = baseLat;
    lon = baseLon;
    updateCoords();

    setTimeout(() => (knob.style.transition = ""), 250);
}

function moveDrag(e) {
    if (!dragging) return;

    const rect = joystick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const dx = e.clientX - cx;
    const dy = e.clientY - cy;

    const dist = Math.sqrt(dx * dx + dy * dy);
    const scale = dist > JOY_MAX_PX ? JOY_MAX_PX / dist : 1;

    const mx = dx * scale;
    const my = dy * scale;

    knob.style.transform = `translate(${mx}px, ${my}px)`;

    const metersY = -(my / JOY_MAX_PX) * JOY_MAX_METERS;
    const metersX = (mx / JOY_MAX_PX) * JOY_MAX_METERS;

    const LAT_DEGREE_METER = 111132;
    const LON_DEGREE_METER = 111132 * Math.cos(baseLat * (Math.PI / 180));

    lat = parseFloat((baseLat + metersY / LAT_DEGREE_METER).toFixed(7));
    lon = parseFloat((baseLon + metersX / LON_DEGREE_METER).toFixed(7));

    updateCoords();
}

knob.addEventListener("pointerdown", startDrag);
knob.addEventListener("pointermove", moveDrag);
knob.addEventListener("pointerup", stopDrag);
knob.addEventListener("pointercancel", stopDrag);
knob.addEventListener("lostpointercapture", stopDrag);

joystick.addEventListener("pointerdown", (e) => {
    startDrag(e);
    moveDrag(e);
});
joystick.addEventListener("pointermove", moveDrag);
joystick.addEventListener("pointerup", stopDrag);


// === START ===
document.addEventListener("DOMContentLoaded", () => {
    input.value = `${baseLat.toFixed(7)}N, ${baseLon.toFixed(7)}E`;
    updateCoords();
});
