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

// === Perlin ===
class Perlin {
  constructor() {
    this.p = new Array(512);
    this.permutation = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
    for (let i = 0; i < 256; i++) this.p[i] = this.p[i+256] = this.permutation[i];
  }
  noise(x,y){
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    const u = this.fade(x);
    const v = this.fade(y);
    const a = this.p[X]+Y;
    const b = this.p[X+1]+Y;
    return this.lerp(v,this.lerp(u,this.grad(this.p[a],x,y),this.grad(this.p[b],x-1,y)),this.lerp(u,this.grad(this.p[a+1],x,y-1),this.grad(this.p[b+1],x-1,y-1)));
  }
  fade(t){ return t*t*t*(t*(t*6-15)+10); }
  lerp(t,a,b){ return a+t*(b-a); }
  grad(hash,x,y){
    const h = hash & 15;
    const u = h<8 ? x : y;
    const v = h<4 ? y : h===12||h===14 ? x : 0;
    return ((h&1)===0 ? u : -u) + ((h&2)===0 ? v : -v);
  }
}
const perlin = new Perlin();

// === CoordinateGenetics ===
function CoordinateGenetics(lat, lon) {
  const traits = {};
  const latStr = String(lat.toFixed(8)).replace('.','');
  const lonStr = String(lon.toFixed(8)).replace('.','');
  const L = latStr.split('').map(Number);
  const N = lonStr.split('').map(Number);
  const Digits = L.concat(N);

  const lat10k = lat * 10000;
  const lon10k = lon * 10000;

  traits.Seed_A = Math.tan(lat10k % 100) * 1234;
  traits.Seed_B = Math.tan(lon10k % 100) * 5678;
  traits.FinalSeed = (traits.Seed_A * traits.Seed_B) / 1000;

  traits.OffsetX = Math.pow(lat10k, 2) * 0.00001;
  traits.OffsetY = Math.pow(lon10k, 2) * 0.00001;
  traits.ScaleX = 0.002 + Math.sin(traits.FinalSeed * 0.0001) * 0.0025;
  traits.ScaleY = 0.002 + Math.cos(traits.FinalSeed * 0.0001) * 0.0025;

  const fifthDigitLat = L[4] || 0;
  traits.ShapeMode = fifthDigitLat === 0 ? 3 : fifthDigitLat < 5 ? 1 : 2;

  const lastFour = N.slice(-4);
  const sumLastFour = lastFour.reduce((a,b)=>a+b,0);

  if (sumLastFour > 20) {
    traits.RotationFactor = N.filter(d=>d%2===0).reduce((a,b)=>a+b,0) * 0.07;
    traits.WarpingIntensity = 1.2;
    traits.ColorHeat = 1;
  } else {
    traits.RotationFactor = 0;
    traits.WarpingIntensity = 0.25;
    traits.ColorHeat = 0;
  }

  traits.GrainIntensity = 0.6 + (N[N.length-1]/9)*0.5;

  for (let k=0; k<38; k++){
    const i = k % Digits.length;
    const d = Digits[i] || 1;
    traits[`F${k}_Mod`] = 1 + d * Math.sin(lat * k) * 0.4;
    traits[`C${k}_Shift`] = Math.sin(lat10k * d + lon10k * k) * 50;
  }

  traits.C1_Shift = traits.C1_Shift || 0;
  traits.C2_Shift = traits.C2_Shift || 0;

  const sumFirst4 = L.slice(0,4).reduce((a,b)=>a+b,0);
  traits.Octaves = 5 + Math.min(3, Math.floor(sumFirst4/7));

  return traits;
}

// === GENEROVÁNÍ OBRAZU ===
function generateGrainyImage(lat, lon){
  if (!ctx) return;
  GENETIC_TRAITS = CoordinateGenetics(lat, lon);
  const T = GENETIC_TRAITS;
  const w = canvas.width;
  const h = canvas.height;
  const imgData = ctx.createImageData(w, h);
  const data = imgData.data;

  const noiseOffsetX = T.OffsetX*100 + T.FinalSeed/1000;
  const noiseOffsetY = T.OffsetY*100 + T.FinalSeed/1000;
  const baseSeed = T.FinalSeed * 0.0001;

  const rot = T.RotationFactor * Math.PI/180;
  const cosR = Math.cos(rot);
  const sinR = Math.sin(rot);
  const cx = w/2;
  const cy = h/2;

  const userBlur = Number(blurSlider.value);
  const userGrain = Number(grainSlider.value);

  for (let y=0; y<h; y++){
    for (let x=0; x<w; x++){
      const i = (y*w + x)*4;
      let fx = x - cx;
      let fy = y - cy;
      let rx = fx*cosR - fy*sinR;
      let ry = fx*sinR + fy*cosR;

      const warp = Math.sin((fx+fy)*0.01 + T.FinalSeed*0.001)*40*T.WarpingIntensity;
      rx += warp * Math.sin(y*0.01);
      ry += warp * Math.cos(x*0.008);

      const nx = (rx*T.ScaleX*T.F1_Mod) + noiseOffsetX;
      const ny = (ry*T.ScaleY*T.F1_Mod) + noiseOffsetY;

      let n = 0, amp=1, freq=1;
      for (let o=0; o<T.Octaves; o++){
        n += perlin.noise(nx*freq, ny*freq + baseSeed)*amp;
        amp *= 0.55;
        freq *= 2;
      }
      n += perlin.noise(nx*0.05, ny*0.05)*-0.3;
      n = (n+1)/2;

      let finalN = n;
      if (T.ShapeMode===1){
        const d = Math.sqrt(fx*fx+fy*fy)/w;
        finalN = n*(1-d*0.7) + d*0.4;
      } else if (T.ShapeMode===2){
        finalN = Math.sin(n*20) > 0.2 ? 1 : 0;
      } else if (T.ShapeMode===3){
        finalN = n*0.4 + ((rx+ry)/w)*0.6;
      }

      const grain = (Math.random()-0.5) * (T.GrainIntensity * userGrain) * 255;
      const base = finalN * 255;
      const gray = Math.max(0, Math.min(255, base + grain));
      data[i] = data[i+1] = data[i+2] = gray;
      data[i+3] = 255;
    }
  }

  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const offCtx = off.getContext('2d');
  offCtx.putImageData(imgData, 0, 0);

  ctx.clearRect(0,0,w,h);
  if (userBlur > 0) {
    ctx.filter = `blur(${userBlur}px)`;
    ctx.drawImage(off, 0, 0);
    ctx.filter = 'none';
  } else {
    ctx.drawImage(off, 0, 0);
  }
}

function parseCoords(str){
  const m = str.match(/([\d.]+)N?,\s*([\d.]+)E?/i);
  if (m) return {lat:parseFloat(m[1]), lon:parseFloat(m[2])};
  return null;
}

function updateCoords(){
  currentCoordsEl.textContent = `${lat.toFixed(7)}N, ${lon.toFixed(7)}E`;
  generateGrainyImage(lat, lon);
}

input.addEventListener('change', () =>{
  const p = parseCoords(input.value);
  if (p){
    baseLat = p.lat;
    baseLon = p.lon;
    lat = baseLat;
    lon = baseLon;
    updateCoords();
  } else {
    statusEl.textContent = 'Neplatný formát (použij: 50.123N, 13.456E)';
  }
});

blurSlider.addEventListener('input', updateCoords);
grainSlider.addEventListener('input', updateCoords);

resetBtn.addEventListener('click', () => {
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
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function startDrag(e){dragging=true; knob.setPointerCapture(e.pointerId);}
function stopDrag(e){
  dragging=false;
  knob.style.transition='transform 200ms cubic-bezier(.2,.8,.2,1)';
  knob.style.transform=`translate(0px,0px)`;
  lat = baseLat; lon = baseLon; updateCoords();
  setTimeout(()=> knob.style.transition='',250);
}
function moveDrag(e){
  if(!dragging) return;
  const rect = joystick.getBoundingClientRect();
  const cx = rect.left + rect.width/2;
  const cy = rect.top + rect.height/2;
  const dx = e.clientX - cx;
  const dy = e.clientY - cy;
  const dist = Math.sqrt(dx*dx+dy*dy);
  const scale = dist>JOY_MAX_PX? JOY_MAX_PX/dist:1;
  const mx = dx*scale;
  const my = dy*scale;
  knob.style.transform=`translate(${mx}px,${my}px)`;

  const metersY = -(my/JOY_MAX_PX)*JOY_MAX_METERS;
  const metersX = (mx/JOY_MAX_PX)*JOY_MAX_METERS;
  const LAT_DEGREE_METER = 111132;
  const LON_DEGREE_METER = 111132 * Math.cos(baseLat*Math.PI/180);
  lat = parseFloat((baseLat+metersY/LAT_DEGREE_METER).toFixed(7));
  lon = parseFloat((baseLon+metersX/LON_DEGREE_METER).toFixed(7));
  updateCoords();
}

knob.addEventListener('pointerdown',startDrag);
knob.addEventListener('pointermove',moveDrag);
knob.addEventListener('pointerup',stopDrag);
knob.addEventListener('pointercancel',stopDrag);
knob.addEventListener('lostpointercapture',stopDrag);

joystick.addEventListener('pointerdown', (e)=>{startDrag(e); moveDrag(e);});
joystick.addEventListener('pointermove', moveDrag);
joystick.addEventListener('pointerup', stopDrag);

document.addEventListener('DOMContentLoaded',()=>{
  input.value=`${baseLat.toFixed(7)}N, ${baseLon.toFixed(7)}E`;
  updateCoords();
});
