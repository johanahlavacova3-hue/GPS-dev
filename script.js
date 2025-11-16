import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ---- Základní nastavení scény ----
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
// Kamera blíž pro detail
camera.position.z = 15; 

const canvas = document.querySelector('#c');
const renderer = new THREE.WebGLRenderer({ 
    canvas: canvas,
    antialias: true 
});
renderer.setSize(window.innerWidth, window.innerHeight);
// ZMĚNA: Nastavíme ostřejší černou a silnější kontrast při vykreslování
renderer.setClearColor(0x000000); 
renderer.toneMapping = THREE.ACESFilmicToneMapping; // Moderní tone mapping pro kontrast
renderer.toneMappingExposure = 1.2; // Lehce zesílíme expozici

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; 

// ---- Světla ----
// Zesílíme světla pro ostré stíny
const ambientLight = new THREE.AmbientLight(0x404040, 1.5); // Měkké globální světlo
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 5.0); // ZMĚNA: Velmi silné bílé světlo
directionalLight.position.set(5, 10, 7.5);
scene.add(directionalLight);


// ---- NOVINKA: Funkce pro BINÁRNÍ GRAIN (MAXIMÁLNÍ KONTRAST) ----
function createHighContrastGrainyTexture() {
    const size = 64; // Menší velikost textury pro hrubší grain
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const imageData = ctx.createImageData(size, size);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        // ZMĚNA: Vytváříme čistě černou (0) nebo čistě bílou (255)
        const val = Math.random() < 0.5 ? 0 : 255; 
        data[i] = val;     // R
        data[i + 1] = val; // G
        data[i + 2] = val; // B
        data[i + 3] = 255; // A
    }
    ctx.putImageData(imageData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping; 
    texture.wrapT = THREE.RepeatWrapping;
    // ZMĚNA: NECHceme, aby se textury při zvětšení rozmazaly (filtrovaly)
    texture.magFilter = THREE.NearestFilter; 
    texture.needsUpdate = true;
    return texture;
}

const grainyBumpTexture = createHighContrastGrainyTexture();


// ---- Generování 3D tvaru ----

let currentShape = null; 

function generateRandomShape() {
    // 1. Vyčištění
    if (currentShape) {
        scene.remove(currentShape);
        currentShape.geometry.dispose(); 
        currentShape.material.dispose();
    }

    // 2. Body pro kompaktnější tvar
    const points = [];
    let currentPos = new THREE.Vector3(0, 0, 0);

    for (let i = 0; i < 20; i++) { 
        const randomDirection = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2
        ).normalize(); 

        const randomLength = Math.random() * 2 + 1.5; 
        currentPos.add(randomDirection.multiplyScalar(randomLength));
        points.push(currentPos.clone());
    }

    // 3. Křivka
    const curve = new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.5);

    // 4. Geometrie trubice (tlustá)
    // ZMĚNA: Pro ostrý bump map efekt je vhodné, aby geometrie měla dostatek vrcholů
    const tubeGeometry = new THREE.TubeGeometry(
        curve, 
        400, // Zvýšeno pro detailnější křivku
        2.0,  
        32,   // ZMĚNA: Více segmentů v řezu (lepší pro bump)
        true
    );

    // 5. Vytvoříme materiál (SOLID a OSTRÝ)
    const solidMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,        // ZMĚNA: Čistě bílá barva pro maximální kontrast
        roughness: 0.8,         // Matný povrch
        metalness: 0.0,         
        
        bumpMap: grainyBumpTexture,
        bumpScale: 0.5,         // Sníženo, protože binární grain má silnější vizuální dopad
    });

    // 6. Finální objekt
    currentShape = new THREE.Mesh(tubeGeometry, solidMaterial);
    
    // Náhodné pootočení
    currentShape.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
    );

    scene.add(currentShape);
}

// ---- Animační smyčka a interakce (Beze změny) ----

function animate() {
    requestAnimationFrame(animate); 

    if (currentShape) {
         currentShape.rotation.x += 0.001;
         currentShape.rotation.y += 0.002;
    }

    controls.update(); 
    renderer.render(scene, camera); 
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener('click', generateRandomShape);

generateRandomShape();
animate();
