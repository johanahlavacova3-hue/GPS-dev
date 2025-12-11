import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
// ---- GLOBÁLNÍ STAV A KONSTANTY ----
let baseLat = 0.5;
let baseLon = 0.5;
let offsetLat = 0;
let offsetLon = 0;
// Konstanta pro převod pixelů tažení na stupně souřadnic.
// 100px posunu v joysticku by mělo odpovídat maximálnímu offsetu.
const MAX_PIXEL_OFFSET = 75; // Polovina šířky joystick-outer (150px / 2)
const MAX_DEGREE_OFFSET_LAT = 0.0005; // Max posun na šířce (cca 50m)
const MAX_DEGREE_OFFSET_LON = 0.0008; // Max posun na délce (cca 50m)
let isDragging = false;
let joystickOuter, joystickHandle;
// ... (ZÁKLADNÍ NASTAVENÍ SCÉNY) ...
const scene = new THREE.Scene();
const canvas = document.querySelector('#c');
const gpsInput = document.querySelector('#gps-input');
const currentCoordsDisplay = document.querySelector('#current-coords');
// Získání elementů joysticku
joystickOuter = document.querySelector('#joystick-outer');
joystickHandle = document.querySelector('#joystick-handle');
// Zbytek inicializace scény je stejný
const initialWidth = canvas.clientWidth || 1000;
const initialHeight = canvas.clientHeight || 1000;
const camera = new THREE.PerspectiveCamera(75, initialWidth / initialHeight, 0.1, 1000);
camera.position.z = 15; 
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true }); // Přidáno alpha: true pro průhlednost
renderer.setSize(initialWidth, initialHeight);
renderer.setClearColor(0x000000, 0); // Nastaveno na průhledné
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2; 
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; 
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);
const filmPass = new FilmPass(0.7, 0.025, 648, false);
composer.addPass(filmPass);
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
// ---- GENERÁTOR TVARU S VAZBOU NA GPS (Stejný) ----
let currentShape = null; 
function generateRandomShape(seedX = 0.5, seedY = 0.5) {
    if (currentShape) {
        scene.remove(currentShape);
        currentShape.geometry.dispose(); 
        currentShape.material.dispose();
    }
    seed = Math.floor((seedX + seedY) * 100000);
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
    const tubeGeometry = new THREE.TubeGeometry(curve, 400, 0.8, 32, true);
    const solidMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff, roughness: 0.8, metalness: 0.0,       
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
    const finalLat = baseLat + offsetLat;
    const finalLon = baseLon + offsetLon;
    
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
            baseLat = lat;
            baseLon = lon;
            offsetLat = 0; 
            offsetLon = 0; 
            // Resetování kolečka do středu
            joystickHandle.style.transform = `translate(-50%, -50%)`;
            runGeneration();
            return;
        }
    }
    baseLat = 0.5;
    baseLon = 0.5;
    offsetLat = 0; 
    offsetLon = 0; 
    joystickHandle.style.transform = `translate(-50%, -50%)`;
    runGeneration();
}
gpsInput.addEventListener('change', (e) => {
    parseBaseGps(e.target.value);
});
// ---- NOVINKA: Logika Tažení Joysticku ----
function getCoords(e) {
    return e.touches ? e.touches[0] : e;
}
function startDrag(e) {
    e.preventDefault();
    isDragging = true;
    joystickHandle.style.transition = 'none'; // Vypne animaci při tažení
}
function onDrag(e) {
    if (!isDragging) return;
    const coords = getCoords(e);
    
    // Získání pozice vnějšího kolečka
    const outerRect = joystickOuter.getBoundingClientRect();
    const centerX = outerRect.left + outerRect.width / 2;
    const centerY = outerRect.top + outerRect.height / 2;
    
    // Vypočet pixelového posunu
    let dx = coords.clientX - centerX;
    let dy = coords.clientY - centerY;
    
    // Omezení pohybu na rádius vnějšího kolečka (MAX_PIXEL_OFFSET)
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > outerRect.width / 2) {
        const angle = Math.atan2(dy, dx);
        dx = Math.cos(angle) * outerRect.width / 2;
        dy = Math.sin(angle) * outerRect.height / 2;
    }
    // Korekce na max offset pro transformaci handle (musíme brát v potaz jeho vlastní rozměry, ale pro jednoduchost použijeme outerRect)
    const handleMaxOffset = outerRect.width / 2;
    
    // Posun handle elementu (vypočítaný posun + korekce na střed -50%)
    joystickHandle.style.left = `${50 + (dx / handleMaxOffset) * 50}%`;
    joystickHandle.style.top = `${50 + (dy / handleMaxOffset) * 50}%`;
    joystickHandle.style.transform = `translate(-50%, -50%)`;
    
    // Převod pixelového posunu na souřadnicový offset
    // Lon (délka) se mapuje na X (dx)
    // Lat (šířka) se mapuje na Y (dy), ale s obrácenou osou (nahoru = +Lat)
    offsetLon = (dx / MAX_PIXEL_OFFSET) * MAX_DEGREE_OFFSET_LON;
    offsetLat = -(dy / MAX_PIXEL_OFFSET) * MAX_DEGREE_OFFSET_LAT;
    
    // Generování Meshe na základě nového offsetu
    runGeneration();
}
function stopDrag() {
    if (!isDragging) return;
    
    isDragging = false;
    joystickHandle.style.transition = 'transform 0.2s, left 0.2s, top 0.2s, background 0.2s';
    
    // Po uvolnění vrátíme handle do středu (a tím vynulujeme offset)
    joystickHandle.style.left = `50%`;
    joystickHandle.style.top = `50%`;
    joystickHandle.style.transform = `translate(-50%, -50%)`;
    
    offsetLat = 0;
    offsetLon = 0;
    runGeneration(); // Vygenerujeme Mesh zpět s nulovým offsetem
}
// Přidání listenerů pro drag and drop
joystickHandle.addEventListener('mousedown', startDrag);
document.addEventListener('mousemove', onDrag);
document.addEventListener('mouseup', stopDrag);
// Podpora pro dotykové obrazovky
joystickHandle.addEventListener('touchstart', startDrag);
document.addEventListener('touchmove', onDrag, { passive: false });
document.addEventListener('touchend', stopDrag);

// ---- EXPORT FUNKCE ----
function downloadPNG() {
    // Pro průhledné PNG nastavíme renderer na průhledný
    renderer.setClearColor(0x000000, 0);
    composer.render(); // Renderujeme scénu
    const dataURL = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = 'mesh.png';
    link.href = dataURL;
    link.click();
    // Vrátíme zpět na černé pozadí, pokud je potřeba
    renderer.setClearColor(0x000000, 1);
}

function downloadSTL() {
    if (!currentShape) return;
    const exporter = new STLExporter();
    const stlString = exporter.parse(currentShape, { binary: false });
    const blob = new Blob([stlString], { type: 'text/plain' });
    const link = document.createElement('a');
    link.download = 'mesh.stl';
    link.href = URL.createObjectURL(blob);
    link.click();
}

function downloadGLB() {
    if (!currentShape) return;
    const exporter = new GLTFExporter();
    exporter.parse(currentShape, (gltf) => {
        const output = JSON.stringify(gltf, null, 2);
        const blob = new Blob([output], { type: 'text/plain' });
        const link = document.createElement('a');
        link.download = 'mesh.glb'; // GLTFExporter produkuje GLB, pokud nastavíme binary: true
        link.href = URL.createObjectURL(blob);
        link.click();
    }, { binary: true });
}

// Přidání listenerů pro tlačítka
document.getElementById('download-png').addEventListener('click', downloadPNG);
document.getElementById('download-stl').addEventListener('click', downloadSTL);

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
parseBaseGps(gpsInput.value || '0.5, 0.5'); 
window.addEventListener('resize', () => {
    const newWidth = canvas.clientWidth;
    const newHeight = canvas.clientHeight;
    camera.aspect = newWidth / newHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(newWidth, newHeight);
    composer.setSize(newWidth, newHeight); 
});
animate();
