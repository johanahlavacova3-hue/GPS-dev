import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js';

// ---- ZÁKLADNÍ NASTAVENÍ (Beze změny) ----
const UI_CANVAS_WIDTH = 1320;
const UI_CANVAS_HEIGHT = 1000;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, UI_CANVAS_WIDTH / UI_CANVAS_HEIGHT, 0.1, 1000);
camera.position.z = 15; 

const canvas = document.querySelector('#c');
const renderer = new THREE.WebGLRenderer({ 
    canvas: canvas,
    antialias: true 
});

renderer.setSize(UI_CANVAS_WIDTH, UI_CANVAS_HEIGHT);
renderer.setClearColor(0x000000); 
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2; 

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; 

// ---- POST-PROCESSING (Beze změny) ----
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const filmPass = new FilmPass(
    0.7,   // Intenzita zrna (šumu)
    0.025, // Intenzita rušení
    648,   // Frekvence šumu
    false  
);
composer.addPass(filmPass);

// ---- SVĚTLA (Beze změny) ----
const ambientLight = new THREE.AmbientLight(0x404040, 1.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 5.0);
directionalLight.position.set(5, 10, 7.5);
scene.add(directionalLight);


// ---- POMOCNÁ FUNKCE: Deterministický náhodný generátor (Beze změny) ----
let seed = 1;
function seededRandom() {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}

// ---- GENERÁTOR TVARU S VAZBOU NA GPS (KLÍČOVÉ ZMĚNY) ----

let currentShape = null; 

/**
 * Generuje 3D tvar s vysokou komplexitou pro vazbu.
 * @param {number} seedX Seed z délky (např. 49.567)
 * @param {number} seedY Seed ze šířky (např. 16.000)
 */
function generateRandomShape(seedX = 0.5, seedY = 0.5) {
    if (currentShape) {
        scene.remove(currentShape);
        currentShape.geometry.dispose(); 
        currentShape.material.dispose();
    }
    
    seed = Math.floor((seedX + seedY) * 100000);

    // 2. Body pro KOMPLEXNĚJŠÍ TVAR
    const points = [];
    let currentPos = new THREE.Vector3(0, 0, 0);

    // ZMĚNA: Více uzlů (40 místo 20) pro složitější křivku
    for (let i = 0; i < 40; i++) { 
        const randomDirection = new THREE.Vector3(
            (seededRandom() - 0.5) * 2,
            (seededRandom() - 0.5) * 2,
            (seededRandom() - 0.5) * 2
        ).normalize(); 

        // ZMĚNA: Delší kroky (větší rozptyl) pro volnější vazbu a křížení
        const randomLength = seededRandom() * 4 + 2; 
        currentPos.add(randomDirection.multiplyScalar(randomLength));
        points.push(currentPos.clone());
    }

    // 3. Křivka
    const curve = new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.5);

    // 4. Geometrie trubice 
    const tubeGeometry = new THREE.TubeGeometry(
        curve, 
        400, 
        // ZMĚNA: Tenčí roura (rádius 0.8 místo 2.0) pro jemnější strukturu
        0.8,  
        32,   
        true
    );

    // 5. Matný materiál (beze změny)
    const solidMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,        
        roughness: 0.8,         
        metalness: 0.0,         
    });

    // 6. Finální objekt
    currentShape = new THREE.Mesh(tubeGeometry, solidMaterial);
    
    currentShape.rotation.set(
        seededRandom() * Math.PI * 2,
        seededRandom() * Math.PI * 2,
        seededRandom() * Math.PI * 2
    );

    scene.add(currentShape);
}

// ---- PARSOVÁNÍ GPS VSTUPU (Beze změny) ----
const gpsInput = document.querySelector('#gps-input');

function parseAndGenerate(value) {
    const cleanValue = value.replace(/[a-zA-Z\s]/g, '');
    const parts = cleanValue.split(/[,;]/);

    if (parts.length >= 2) {
        const lat = parseFloat(parts[0]);
        const lon = parseFloat(parts[1]);

        if (!isNaN(lat) && !isNaN(lon)) {
            generateRandomShape(lat, lon);
            console.log(`Vygenerován tvar podle GPS: ${lat}, ${lon}`);
            return;
        }
    }
    generateRandomShape(0.5, 0.5); 
}

gpsInput.addEventListener('change', (e) => {
    parseAndGenerate(e.target.value);
});

// ---- ANIMAČNÍ SMYČKA (Beze změny) ----

function animate() {
    requestAnimationFrame(animate); 

    if (currentShape) {
         currentShape.rotation.x += 0.001; 
         currentShape.rotation.y += 0.002;
    }

    controls.update(); 
    composer.render(); 
}

// ---- SPUŠTĚNÍ (Beze změny) ----

parseAndGenerate(gpsInput.value || '0.5, 0.5'); 

window.addEventListener('resize', () => {
    renderer.setSize(UI_CANVAS_WIDTH, UI_CANVAS_HEIGHT);
    composer.setSize(UI_CANVAS_WIDTH, UI_CANVAS_HEIGHT); 
});

animate();
