import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js';

// ---- GLOBÁLNÍ STAV A KONSTmANTY ----

let baseLat = 0.5; // Základní souřadnice z GPS inputu
let baseLon = 0.5;
let offsetLat = 0; // Posun z joysticku
let offsetLon = 0;
let joystickInterval = null; // Proměnná pro ukládání intervalu plynulého posunu

// Konstanta pro přepočet 5m na desetinný stupeň (přibližně ve střední Evropě)
const METER_TO_DEGREE_LAT = 0.000045; 
const METER_TO_DEGREE_LON = 0.000071; 


// ---- ZÁKLADNÍ NASTAVENÍ SCÉNY ----

const scene = new THREE.Scene();
const canvas = document.querySelector('#c');
const gpsInput = document.querySelector('#gps-input');
const currentCoordsDisplay = document.querySelector('#current-coords');

// Získání aktuálních rozměrů pro inicializaci
const initialWidth = canvas.clientWidth || 1000;
const initialHeight = canvas.clientHeight || 1000;

const camera = new THREE.PerspectiveCamera(75, initialWidth / initialHeight, 0.1, 1000);
camera.position.z = 15; 

const renderer = new THREE.WebGLRenderer({ 
    canvas: canvas,
    antialias: true 
});

renderer.setSize(initialWidth, initialHeight);
renderer.setClearColor(0x000000); 
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2; 

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; 

// ---- POST-PROCESSING (GRAIN FILTER) ----
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const filmPass = new FilmPass(0.7, 0.025, 648, false);
composer.addPass(filmPass);

// ---- SVĚTLA ----
const ambientLight = new THREE.AmbientLight(0x404040, 1.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 5.0);
directionalLight.position.set(5, 10, 7.7);
scene.add(directionalLight);


// ---- POMOCNÁ FUNKCE: Deterministický náhodný generátor ----
let seed = 1;
function seededRandom() {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}

// ---- GENERÁTOR TVARU S VAZBOU NA GPS ----
let currentShape = null; 

function generateRandomShape(seedX = 0.5, seedY = 0.5) {
    if (currentShape) {
        scene.remove(currentShape);
        currentShape.geometry.dispose(); 
        currentShape.material.dispose();
    }
    
    // Nastavení seedu
    seed = Math.floor((seedX + seedY) * 100000);

    // Generování složité křivky (40 uzlů)
    const points = [];
    let currentPos = new THREE.Vector3(0, 0, 0);

    for (let i = 0; i < 40; i++) { 
        const randomDirection = new THREE.Vector3(
            (seededRandom() - 0.5) * 2,
            (seededRandom() - 0.5) * 2,
            (seededRandom() - 0.5) * 2
        ).normalize(); 

        const randomLength = seededRandom() * 4 + 2; 
        currentPos.add(randomDirection.multiplyScalar(randomLength));
        points.push(currentPos.clone());
    }

    const curve = new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.5);

    // Geometrie tenké propletené trubice
    const tubeGeometry = new THREE.TubeGeometry(curve, 400, 0.8, 32, true);

    // Matný materiál
    const solidMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,        
        roughness: 0.8,         
        metalness: 0.0,         
    });

    currentShape = new THREE.Mesh(tubeGeometry, solidMaterial);
    
    currentShape.rotation.set(
        seededRandom() * Math.PI * 2,
        seededRandom() * Math.PI * 2,
        seededRandom() * Math.PI * 2
    );

    scene.add(currentShape);
}

// ---- GPS LOGIKA: PARSE & GENERATE ----

function runGeneration() {
    // Kombinace základní GPS a offsetu
    const finalLat = baseLat + offsetLat;
    const finalLon = baseLon + offsetLon;
    
    // Zobrazení aktuálních hodnot v UI
    currentCoordsDisplay.innerHTML = 
        `Lat: ${finalLat.toFixed(8)}<br>Lon: ${finalLon.toFixed(8)}`;
    
    generateRandomShape(finalLat, finalLon);
}


function parseBaseGps(value) {
    const cleanValue = value.replace(/[a-zA-Z\s]/g, '');
    const parts = cleanValue.split(/[,;]/);
    
    if (parts.length >= 2) {
        const lat = parseFloat(parts[0]);
        const lon = parseFloat(parts[1]);

        if (!isNaN(lat) && !isNaN(lon)) {
            // Nastavujeme základní hodnoty a vynulujeme offset
            baseLat = lat;
            baseLon = lon;
            offsetLat = 0; 
            offsetLon = 0; 
            runGeneration();
            return;
        }
    }
    // Neplatný nebo prázdný vstup: použijeme default
    baseLat = 0.5;
    baseLon = 0.5;
    offsetLat = 0; 
    offsetLon = 0; 
    runGeneration();
}

// --- JOYSTICK LOGIKA ---

// Funkce, která provádí samotný posun
function performJoystickAction(button) {
    const direction = button.dataset.dir; 
    const value = parseInt(button.dataset.val);
    
    const stepLat = value * METER_TO_DEGREE_LAT;
    const stepLon = value * METER_TO_DEGREE_LON;

    if (direction === 'lat') {
        offsetLat += stepLat;
    } else if (direction === 'lon') {
        offsetLon += stepLon;
    }
    
    runGeneration();
}

// Spustí nepřetržitý posun
function startJoystick(e) {
    const button = e.target.closest('button');
    if (!button) return;

    if (joystickInterval) return;

    // 1. Provedeme první posun ihned
    performJoystickAction(button);

    // 2. Nastavíme interval pro opakované posuny (každých 100ms)
    joystickInterval = setInterval(() => {
        performJoystickAction(button);
    }, 100); 

    e.preventDefault();
}

// Zastaví posun
function stopJoystick() {
    if (joystickInterval) {
        clearInterval(joystickInterval);
        joystickInterval = null;
    }
}

const joystickContainer = document.querySelector('#joystick-container');

// Listenery pro stisk myši/prstu
joystickContainer.querySelectorAll('button').forEach(button => {
    button.addEventListener('mousedown', startJoystick);
    button.addEventListener('touchstart', startJoystick);
});

// Listenery pro uvolnění myši/prstu (globální)
document.addEventListener('mouseup', stopJoystick);
document.addEventListener('touchend', stopJoystick);

// --- LISTENERY UI ---

// Vstupní pole: nastavení základní GPS
gpsInput.addEventListener('change', (e) => {
    parseBaseGps(e.target.value);
});


// ---- ANIMAČNÍ SMYČKA ----

function animate() {
    requestAnimationFrame(animate); 

    if (currentShape) {
         currentShape.rotation.x += 0.001; 
         currentShape.rotation.y += 0.002;
    }

    controls.update(); 
    renderer.clear(); 
    composer.render(); 
}

// ---- SPUŠTĚNÍ & RESIZE ----

// Inicializace na default hodnotách
parseBaseGps(gpsInput.value || '0.5, 0.5'); 

// Obsluha responzivního resize
window.addEventListener('resize', () => {
    const newWidth = canvas.clientWidth;
    const newHeight = canvas.clientHeight;

    camera.aspect = newWidth / newHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(newWidth, newHeight);
    composer.setSize(newWidth, newHeight); 
});

animate();
