import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js';
// NOVÉ IMPORTY PRO EXPORT
import { STLExporter } from 'three/addons/exporters/STLExporter.js'; 
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';


// ---- GLOBÁLNÍ STAV A KONSTANTY ----

let baseLat = 0.5;
let baseLon = 0.5;
let offsetLat = 0;
let offsetLon = 0;

const MAX_PIXEL_OFFSET = 75; 
const MAX_DEGREE_OFFSET_LAT = 0.0005; 
const MAX_DEGREE_OFFSET_LON = 0.0008; 

let isDragging = false;
let joystickOuter, joystickHandle;

// ---- NOVÉ: EXPORTÉRY ----
const stlExporter = new STLExporter();
const gltfExporter = new GLTFExporter();


// ... (ZÁKLADNÍ NASTAVENÍ SCÉNY) ...
const scene = new THREE.Scene();
const canvas = document.querySelector('#c');
const gpsInput = document.querySelector('#gps-input');
const currentCoordsDisplay = document.querySelector('#current-coords');
// NOVÉ: Získání UI prvků pro export
const exportMessage = document.querySelector('#export-message');
const exportPngButton = document.querySelector('#export-png-button');
const exportGlbButton = document.querySelector('#export-glb-button');
const exportStlButton = document.querySelector('#export-stl-button');

// Získání elementů joysticku
joystickOuter = document.querySelector('#joystick-outer');
joystickHandle = document.querySelector('#joystick-handle');


// Zbytek inicializace scény je stejný
const initialWidth = canvas.clientWidth || 1000;
const initialHeight = canvas.clientHeight || 1000;
const camera = new THREE.PerspectiveCamera(75, initialWidth / initialHeight, 0.1, 1000);
camera.position.z = 15; 

// ZMĚNA: Přidáno 'alpha: true' pro průhledné PNG
const renderer = new THREE.WebGLRenderer({ 
    canvas: canvas, 
    antialias: true, 
    alpha: true 
});
renderer.setSize(initialWidth, initialHeight);
renderer.setClearColor(0x000000); 
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
    const curve = new THREE.CatmKullRomCurve3(points, true, 'catmullrom', 0.5);
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
            joystickHandle.style.left = `50%`;
            joystickHandle.style.top = `50%`;
            joystickHandle.style.transform = `translate(-50%, -50%)`;
            runGeneration();
            return;
        }
    }
    baseLat = 0.5;
    baseLon = 0.5;
    offsetLat = 0; 
    offsetLon = 0; 
    joystickHandle.style.left = `50%`;
    joystickHandle.style.top = `50%`;
    joystickHandle.style.transform = `translate(-50%, -50%)`;
    runGeneration();
}

gpsInput.addEventListener('change', (e) => {
    parseBaseGps(e.target.value);
});


// ---- Logika Tažení Joysticku (Stejná) ----

function getCoords(e) {
    return e.touches ? e.touches[0] : e;
}

function startDrag(e) {
    e.preventDefault();
    isDragging = true;
    joystickHandle.style.transition = 'none'; 
}

function onDrag(e) {
    if (!isDragging) return;

    const coords = getCoords(e);
    
    const outerRect = joystickOuter.getBoundingClientRect();
    const centerX = outerRect.left + outerRect.width / 2;
    const centerY = outerRect.top + outerRect.height / 2;
    
    let dx = coords.clientX - centerX;
    let dy = coords.clientY - centerY;
    
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > outerRect.width / 2) {
        const angle = Math.atan2(dy, dx);
        dx = Math.cos(angle) * outerRect.width / 2;
        dy = Math.sin(angle) * outerRect.height / 2;
    }

    const handleMaxOffset = outerRect.width / 2;
    
    joystickHandle.style.left = `${50 + (dx / handleMaxOffset) * 50}%`;
    joystickHandle.style.top = `${50 + (dy / handleMaxOffset) * 50}%`;
    joystickHandle.style.transform = `translate(-50%, -50%)`;
    
    offsetLon = (dx / MAX_PIXEL_OFFSET) * MAX_DEGREE_OFFSET_LON;
    offsetLat = -(dy / MAX_PIXEL_OFFSET) * MAX_DEGREE_OFFSET_LAT;
    
    runGeneration();
}

function stopDrag() {
    if (!isDragging) return;
    
    isDragging = false;
    joystickHandle.style.transition = 'transform 0.2s, left 0.2s, top 0.2s, background 0.2s';
    
    joystickHandle.style.left = `50%`;
    joystickHandle.style.top = `50%`;
    joystickHandle.style.transform = `translate(-50%, -50%)`;
    
    offsetLat = 0;
    offsetLon = 0;
    runGeneration(); 
}

// Přidání listenerů pro drag and drop
joystickHandle.addEventListener('mousedown', startDrag);
document.addEventListener('mousemove', onDrag);
document.addEventListener('mouseup', stopDrag);
joystickHandle.addEventListener('touchstart', startDrag);
document.addEventListener('touchmove', onDrag, { passive: false });
document.addEventListener('touchend', stopDrag);


// ---- NOVÉ: FUNKCE PRO EXPORT ----

// Pomocná funkce pro stažení
function downloadFile(data, filename, mimeType) {
    const link = document.createElement('a');
    link.style.display = 'none';
    document.body.appendChild(link);
    link.href = URL.createObjectURL(new Blob([data], { type: mimeType }));
    link.download = filename;
    link.click();
    document.body.removeChild(link);
}

// Zobrazení zprávy
function showExportMessage(message, isError = false) {
    exportMessage.textContent = message;
    exportMessage.style.color = isError ? '#FF5757' : '#57F87D';
    setTimeout(() => {
        exportMessage.textContent = '';
    }, 3000);
}

// 1. Export STL
function exportSTL() {
    if (!currentShape) {
        showExportMessage('Nejprve vygenerujte model.', true);
        return;
    }
    try {
        const result = stlExporter.parse(currentShape);
        const filename = `gps_model_${baseLat.toFixed(4)}_${baseLon.toFixed(4)}.stl`;
        downloadFile(result, filename, 'application/sla');
        showExportMessage('STL soubor stažen!');
    } catch (error) {
        console.error("Error exporting STL:", error);
        showExportMessage('Chyba při exportu STL.', true);
    }
}

// 2. Export GLB
function exportGLB() {
    if (!currentShape) {
        showExportMessage('Nejprve vygenerujte model.', true);
        return;
    }
    
    gltfExporter.parse(
        currentShape,
        (result) => {
            const filename = `gps_model_${baseLat.toFixed(4)}_${baseLon.toFixed(4)}.glb`;
            const blob = new Blob([result], { type: 'application/octet-stream' });
            downloadFile(blob, filename, 'application/octet-stream');
            showExportMessage('GLB soubor stažen!');
        },
        (error) => {
            console.error('An error happened during GLB export', error);
            showExportMessage('Chyba při exportu GLB.', true);
        },
        { binary: true } // GLB je binární formát
    );
}

// 3. Export PNG s průhledným pozadím
function exportPNG() {
    if (!currentShape) {
        showExportMessage('Nejprve vygenerujte model.', true);
        return;
    }
    
    // 1. Dočasně odstraníme FilmPass (grain filtr), který narušuje průhlednost
    composer.removePass(filmPass);

    // 2. Nastavíme průhledné pozadí rendereru
    renderer.setClearColor(0x000000, 0); 
    renderer.clear();
    renderer.render(scene, camera); // Vykreslíme scénu bez post-processingu

    // 3. Získáme obrázek z Canvasu
    const dataURL = canvas.toDataURL('image/png');
    
    // 4. Obnovíme původní stav (černé pozadí a filtr)
    renderer.setClearColor(0x000000, 1); 
    composer.addPass(filmPass); // Vrátíme grain filtr
    
    // 5. Stažení souboru
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = `gps_model_${baseLat.toFixed(4)}_${baseLon.toFixed(4)}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showExportMessage('PNG obrázek stažen (průhledné pozadí)!');
}

// NOVÉ: Připojení listenerů k tlačítkům
exportPngButton.addEventListener('click', exportPNG);
exportGlbButton.addEventListener('click', exportGLB);
exportStlButton.addEventListener('click', exportSTL);


// ---- ANIMAČNÍ SMYČKA ----

function animate() {
    requestAnimationFrame(animate); 

    if (currentShape) {
         currentShape.rotation.x += 0.001; 
         currentShape.rotation.y += 0.002;
    }

    controls.update(); 
    renderer.clear(); 
    composer.render(); // Vykreslení s grain filtrem
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
