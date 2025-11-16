import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ---- Základní nastavení scény ----
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 15; // Posunul jsem kameru blíž, protože objekt bude kompaktnější

const canvas = document.querySelector('#c');
const renderer = new THREE.WebGLRenderer({ 
    canvas: canvas,
    antialias: true // Necháme vyhlazování, zrnitý bude materiál
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000); // Černé pozadí

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// ---- NOVINKA: Světla ----
// Pevné materiály (Mesh) potřebují světlo, aby byly vidět.
const ambientLight = new THREE.AmbientLight(0x404040, 2); // Měkké globální světlo
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 2.5); // Ostré světlo (jako slunce)
directionalLight.position.set(5, 10, 7.5); // Světlo přichází zešikma shora
scene.add(directionalLight);

// ---- NOVINKA: Funkce pro vytvoření zrnité textury ----
function createGrainyTexture() {
    const size = 128; // Stačí malá textura, bude se opakovat
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const imageData = ctx.createImageData(size, size);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        // Náhodná hodnota šedi (pro "zrno")
        const val = Math.random() * 255;
        data[i] = val;     // R
        data[i + 1] = val; // G
        data[i + 2] = val; // B
        data[i + 3] = 255; // A (plná viditelnost)
    }
    ctx.putImageData(imageData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping; // Opakovat texturu vodorovně
    texture.wrapT = THREE.RepeatWrapping; // Opakovat texturu svisle
    texture.needsUpdate = true;
    return texture;
}

// Vytvoříme texturu jen jednou
const grainyBumpTexture = createGrainyTexture();

// ---- Generování 3D tvaru ----

let currentShape = null;

function generateRandomShape() {
    if (currentShape) {
        scene.remove(currentShape);
        currentShape.geometry.dispose();
        currentShape.material.dispose();
    }

    // 1. Náhodné body (ZMĚNA: "více u sebe")
    const points = [];
    let currentPos = new THREE.Vector3(0, 0, 0);

    for (let i = 0; i < 20; i++) {
        const randomDirection = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2
        ).normalize();

        // ZMĚNA: Menší "kroky", aby byl tvar kompaktnější
        const randomLength = Math.random() * 2 + 1.5; // (Bylo: 5 + 3)
        currentPos.add(randomDirection.multiplyScalar(randomLength));
        points.push(currentPos.clone());
    }

    const curve = new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.5);

    // 2. Geometrie trubice (ZMĚNA: "širší roura")
    const tubeGeometry = new THREE.TubeGeometry(
        curve,
        300,  // Segmenty podél trubky
        2.0,  // ZMĚNA: Rádius (tloušťka) (Bylo: 0.8)
        16,   // Segmenty v řezu (více, aby byla kulatější)
        true  // Uzavřená
    );

    // 3. Materiál (ZMĚNA: "mega grainy solid material")
    const solidMaterial = new THREE.MeshStandardMaterial({
        color: 0xe0e0e0,      // Světle šedá, skoro bílá
        roughness: 0.7,       // Matný povrch (0 = lesk, 1 = mat)
        metalness: 0.1,       // Trochu kovový odlesk
        
        // Klíčová část: Použijeme zrnitou texturu jako "mapu hrbolů"
        bumpMap: grainyBumpTexture,
        bumpScale: 0.15, // Jak moc je zrnitost vidět (vylaďte si)
    });

    // 4. Finální objekt (ZMĚNA: Mesh, ne Points)
    currentShape = new THREE.Mesh(tubeGeometry, solidMaterial);
    
    currentShape.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
    );

    scene.add(currentShape);
}

// ---- Animační smyčka ----

function animate() {
    requestAnimationFrame(animate);

    if (currentShape) {
         currentShape.rotation.x += 0.001;
         currentShape.rotation.y += 0.002;
    }

    controls.update();
    renderer.render(scene, camera);
}

// ---- Spuštění a interakce ----
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener('click', generateRandomShape);

generateRandomShape(); // Vygenerujeme první tvar
animate(); // Spustíme animaci
