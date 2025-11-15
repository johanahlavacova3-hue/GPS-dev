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

// === Perlin noise ===
class Perlin {
  constructor() {
    this.p = new Array(512);
    this.permutation = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
    for(let i=0;i<256;i++) this.p[i] = this.p[i+256] = this.permutation[i];
  }
  noise(x,y){
    const X=Math.floor(x)&255, Y=Math.floor(y)&255;
    x-=Math.floor(x); y-=Math.floor(y);
    const u=this.fade(x), v=this.fade(y);
    const a=this.p[X]+Y, b=this.p[X+1]+Y;
    return this.lerp(v,this.lerp(u,this.grad(this.p[a],x,y),this.grad(this.p[b],x-1,y)),this.lerp(u,this.grad(this.p[a+1],x,y-1),this.grad(this.p[b+1],x-1,y-1)));
  }
  fade(t){return t*t*t*(t*(t*6-15)+10);}
  lerp(t,a,b){return a+t*(b-a);}
  grad(hash,x,y){const h=hash&15;const u=h<8?x:y;const v=h<4?y:h===12||h===14?x:0;return ((h&1)===0?u:-u)+((h&2)===0?v:-v);}
}
const perlin=new Perlin();

// === CoordinateGenetics ===
function CoordinateGenetics(lat,lon){
  const traits={};
  const lat10k=lat*10000, lon10k=lon*10000;
  traits.OffsetX = Math.pow(lat10k,2)*0.00001;
  traits.OffsetY = Math.pow(lon10k,2)*0.00001;
  traits.FinalSeed = Math.tan(lat10k%100)*1234 * Math.tan(lon10k%100)*5678 / 1000;
  traits.GrainIntensity = 0.8; // základní grain uvnitř objektu
  return traits;
}

// === GENEROVÁNÍ MLHAVÉHO OBJEKTU UPROSTŘED ===
function generateCentralObject(lat, lon){
  if(!ctx) return;
  GENETIC_TRAITS = CoordinateGenetics(lat,lon);
  const T = GENETIC_TRAITS;
  const w = canvas.width, h = canvas.height;
  const imgData = ctx.createImageData(w,h);
  const data = imgData.data;

  const cx=w/2, cy=h/2;
  const radius = Math.min(w,h)*0.35;
  const DEFORM_SCALE = Number(blurSlider.value)*0.001 + 0.03;
  const EDGE_SOFTNESS = 0.3;
  const GRAIN = Number(grainSlider.value);

  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
      const i=(y*w+x)*4;
      const dx=x-cx, dy=y-cy;
      const dist=Math.sqrt(dx*dx+dy*dy)/radius;
      if(dist>1){ data[i+3]=0; continue; }

      const nx = dx*DEFORM_SCALE + T.OffsetX*100;
      const ny = dy*DEFORM_SCALE + T.OffsetY*100;
      let n = (perlin.noise(nx, ny + T.FinalSeed*0.001)+1)/2;

      let alpha = 1 - dist;
      alpha *= 1 - n*EDGE_SOFTNESS;

      const grain = (Math.random()-0.5)*T.GrainIntensity*255*GRAIN;
      const base = n*255 + grain;
      const gray = Math.max(0, Math.min(255, base));

      data[i]=data[i+1]=data[i+2]=gray;
      data[i+3]=Math.floor(alpha*255);
    }
  }

  ctx.clearRect(0,0,w,h);
  ctx.putImageData(imgData,0,0);
}

// === parsování GPS ===
function parseCoords(str){
  const m=str.match(/([\d.]+)N?,\s*([\d.]+)E?/i);
  if(m) return {lat:parseFloat(m[1]), lon:parseFloat(m[2])};
  return null;
}
function updateCoords(){ 
  currentCoordsEl.textContent = `${lat.toFixed(7)}N, ${lon.toFixed(7)}E`;
  generateCentralObject(lat,lon);
}

// === events ===
input.addEventListener('change',()=>{
  const p=parseCoords(input.value);
  if(p){ baseLat=p.lat;baseLon=p.lon; lat=baseLat; lon=baseLon; updateCoords(); }
  else statusEl.textContent='Neplatný formát (použij: 50.123N, 13.456E)';
});
blurSlider.addEventListener('input',updateCoords);
grainSlider.addEventListener('input',updateCoords);

// === reset ===
resetBtn.addEventListener('click',()=>{
  baseLat=DEFAULT_LAT; baseLon=DEFAULT_LON;
  lat=baseLat; lon=baseLon;
  input.value=`${baseLat.toFixed(7)}N, ${baseLon.toFixed(7)}E`;
  updateCoords();
});

// === joystick ===
const JOY_MAX_PX=40; const JOY_MAX_METERS=10;
let dragging=false;
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function startDrag(e){dragging=true; knob.setPointerCapture(e.pointerId);}
function stopDrag(e){
  dragging=false;
  knob.style.transition='transform 200ms cubic-bezier(.2,.8,.2,1)';
  knob.style.transform='translate(0px,0px)';
  lat=baseLat; lon=baseLon; updateCoords();
  setTimeout(()=> knob.style.transition='',250);
}
function moveDrag(e){
  if(!dragging) return;
  const rect=joystick.getBoundingClientRect();
  const cx=rect.left+rect.width/2, cy=rect.top+rect.height/2;
  const dx=e.clientX-cx, dy=e.clientY-cy;
  const dist=Math.sqrt(dx*dx+dy*dy);
  const scale=dist>JOY_MAX_PX?JOY_MAX_PX/dist:1;
  const mx=dx*scale, my=dy*scale;
  knob.style.transform=`translate(${mx}px, ${my}px)`;

  const metersY=-(my/JOY_MAX_PX)*JOY_MAX_METERS;
  const metersX=(mx/JOY_MAX_PX)*JOY_MAX_METERS;
  const LAT_DEGREE_METER=111132;
  const LON_DEGREE_METER=111132*Math.cos(baseLat*(Math.PI/180));
  lat=parseFloat((baseLat+metersY/LAT_DEGREE_METER).toFixed(7));
  lon=parseFloat((baseLon+metersX/LON_DEGREE_METER).toFixed(7));
  updateCoords();
}
knob.addEventListener('pointerdown',startDrag);
knob.addEventListener('pointermove',moveDrag);
knob.addEventListener('pointerup',stopDrag);
knob.addEventListener('pointercancel',stopDrag);
knob.addEventListener('lostpointercapture',stopDrag);
joystick.addEventListener('pointerdown',(e)=>{startDrag(e);moveDrag(e);});
joystick.addEventListener('pointermove',moveDrag);
joystick.addEventListener('pointerup',stopDrag);

document.addEventListener('DOMContentLoaded',()=>{
  input.value=`${baseLat.toFixed(7)}N, ${baseLon.toFixed(7)}E`;
  updateCoords();
});
