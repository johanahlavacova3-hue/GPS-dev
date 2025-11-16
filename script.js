import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js';

// ---- ZÁKLADNÍ NASTAVENÍ ----
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

// ZMĚNA: Renderer nastavujeme na pevné rozměry z HTML
renderer.setSize(UI_CANVAS_WIDTH, UI_CANVAS_HEIGHT);
renderer.setClearColor(0x000000); 
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2; 

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; 

// ---- POST-PROCESSING (GRAIN FILTER) ----
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

// Film Pass pro zrnění
const filmPass = new FilmPass(
    0.7,   // Intenzita zrna (šumu)
    0.025, // Intenzita rušení
    648,   // Frekvence šumu
    false  // Barva
);
composer.addPass(filmPass);

// ---- SVĚTLA ----
const ambientLight = new THREE.AmbientLight(0x404040, 1.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 5.0);
directionalLight.position.set(5, 10, 7.5);
scene.add(directionalLight);


// ---- POMOCNÁ FUNKCE: Deterministický náhodný generátor (SEED) ----
// Každá GPS hodnota bude generovat stejnou sekvenci čísel.
let seed = 1;
function seededRandom() {
    // Vytvoří pseudo-náhodné číslo na základě aktuálního seedu
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}

// ---- GENERÁTOR TVARU S VAZBOU NA GPS ----

let currentShape = null; 

/**
 * Generuje 3D tvar s pevnými parametry, ale s geometrií závislou na seedu (GPS).
 * @param {number} seedX Seed z délky (např. 49.567)
 * @param {number} seedY Seed ze šířky (např. 16.000)
 */
function generateRandomShape(seedX = 0.5, seedY = 0.5) {
    if (currentShape) {
        scene.remove(currentShape);
        currentShape.geometry.dispose(); 
        currentShape.material.dispose();
    }
    
    // Nastavíme seed pro naši deterministickou funkci
    // Můžeme sečíst seedX a seedY pro kombinovaný efekt
    seed = Math.floor((seedX + seedY) * 100000);

    // 2. Body pro kompaktnější tvar (používáme seededRandom)
    const points = [];
    let currentPos = new THREE.Vector3(0, 0, 0);

    for (let i = 0; i < 20; i++) { 
        // Vytvoříme deterministický směr
        const randomDirection = new THREE.Vector3(
            (seededRandom() - 0.5) * 2,
            (seededRandom() - 0.5) * 2,
            (seededRandom() - 0.5) * 2
        ).normalize(); 

        // Deterministická délka
        const randomLength = seededRandom() * 2 + 1.5; 
        currentPos.add(randomDirection.multiplyScalar(randomLength));
        points.push(currentPos.clone());
    }

    // 3. Křivka
    const curve = new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.5);

    // 4. Geometrie trubice (tlustá, s detaily)
    const tubeGeometry = new THREE.TubeGeometry(
        curve, 
        400, 
        2.0,  
        32,   
        true
    );

    // 5. Matný materiál (bez textury/bump map)
    const solidMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,        
        roughness: 0.8,         
        metalness: 0.0,         
    });

    // 6. Finální objekt
    currentShape = new THREE.Mesh(tubeGeometry, solidMaterial);
    
    // Deterministická počáteční rotace (závisí na GPS)
    currentShape.rotation.set(
        seededRandom() * Math.PI * 2,
        seededRandom() * Math.PI * 2,
        seededRandom() * Math.PI * 2
    );

    scene.add(currentShape);
}

// ---- PARSOVÁNÍ GPS VSTUPU ----
const gpsInput = document.querySelector('#gps-input');

function parseAndGenerate(value) {
    // Odstraníme písmena N, E, S, W a mezery
    const cleanValue = value.replace(/[a-zA-Z\s]/g, '');
    
    // Rozdělíme na základě čárky nebo středníku
    const parts = cleanValue.split(/[,;]/);

    if (parts.length >= 2) {
        const lat = parseFloat(parts[0]);
        const lon = parseFloat(parts[1]);

        if (!isNaN(lat) && !isNaN(lon)) {
            // Použijeme souřadnice k určení seedu
            generateRandomShape(lat, lon);
            console.log(`Vygenerován tvar podle GPS: ${lat}, ${lon}`);
            return;
        }
    }
    // Pokud je vstup neplatný, použijeme defaultní (výchozí) hodnotu
    generateRandomShape(0.5, 0.5); 
}

// ZMĚNA HODNOTY VSTUPNÍHO POLE
gpsInput.addEventListener('change', (e) => {
    parseAndGenerate(e.target.value);
});

// ---- ANIMAČNÍ SMYČKA ----

function animate() {
    requestAnimationFrame(animate); 

    if (currentShape) {
         // Stále plynulá, konstantní rotace, nezávislá na GPS
         currentShape.rotation.x += 0.001; 
         currentShape.rotation.y += 0.002;
    }

    controls.update(); 
    composer.render(); // Vykreslení s filtrem
}

// ---- SPUŠTĚNÍ ----

// Inicializace tvaru s výchozími souřadnicemi
parseAndGenerate(gpsInput.value || '0.5, 0.5'); 

// ZMĚNA: Přizpůsobení resize obsluhuje pevné rozměry canvasu
window.addEventListener('resize', () => {
    // UI prvky se hýbou, ale Canvas je statický, jen se ujistíme, že je vše v pořádku
    renderer.setSize(UI_CANVAS_WIDTH, UI_CANVAS_HEIGHT);
    composer.setSize(UI_CANVAS_WIDTH, UI_CANVAS_HEIGHT); 
});

animate();
