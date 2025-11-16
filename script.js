import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ---- Základní nastavení scény ----
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
// ZMĚNA: Přiblížíme kameru, aby byl objekt výraznější.
camera.position.z = 15; 

const canvas = document.querySelector('#c');
const renderer = new THREE.WebGLRenderer({ 
    canvas: canvas,
    antialias: true 
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000); 

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; 

// ---- NOVINKA: Světla ----
// Pro zobrazení pevného materiálu (Mesh) je nutné přidat světla
const ambientLight = new THREE.AmbientLight(0x404040, 2); // Měkké globální světlo
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 3.0); // Silnější bílé světlo
directionalLight.position.set(5, 10, 7.5); // Světlo přichází zešikma shora
scene.add(directionalLight);

// ---- NOVINKA: Funkce pro vytvoření zrnité textury (Bump Map) ----
function createGrainyTexture() {
    const size = 128; // Velikost textury pro šum
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const imageData = ctx.createImageData(size, size);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        // Náhodná hodnota šedi (zrno)
        const val = Math.random() * 255;
        data[i] = val;     // R
        data[i + 1] = val; // G
        data[i + 2] = val; // B
        data[i + 3] = 255; // A (plná viditelnost)
    }
    ctx.putImageData(imageData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping; 
    texture.wrapT = THREE.RepeatWrapping; 
    texture.needsUpdate = true;
    return texture;
}

const grainyBumpTexture = createGrainyTexture();


// ---- Generování 3D tvaru ----

let currentShape = null; 

function generateRandomShape() {
    // 1. Vyčištění
    if (currentShape) {
        scene.remove(currentShape);
        currentShape.geometry.dispose(); 
        currentShape.material.dispose();
    }

    // 2. Body (použijeme kompaktnější body z předchozí verze pro "více u sebe")
    const points = [];
    let currentPos = new THREE.Vector3(0, 0, 0);

    for (let i = 0; i < 20; i++) { 
        const randomDirection = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2
        ).normalize(); 

        // ZMĚNA: Kompaktnější tvar (menší kroky)
        const randomLength = Math.random() * 2 + 1.5; 
        currentPos.add(randomDirection.multiplyScalar(randomLength));
        points.push(currentPos.clone());
    }

    // 3. Křivka
    const curve = new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.5);

    // 4. Geometrie trubice
    const tubeGeometry = new THREE.TubeGeometry(
        curve, 
        300, 
        2.0,  // ZMĚNA: Tlustší roura (rádius 2.0)
        16,   // Více segmentů v řezu pro lepší kulatost
        true
    );

    // 5. Vytvoříme materiál (ZMĚNA: Solid MeshStandardMaterial)
    const solidMaterial = new THREE.MeshStandardMaterial({
        color: 0x909090,        // Středně šedá barva
        roughness: 0.9,         // Velmi matný povrch (dobře ukáže zrno)
        metalness: 0.0,         // Není kov
        
        // Klíčová část: Použijeme texturu šumu jako "mapu hrbolů"
        bumpMap: grainyBumpTexture,
        bumpScale: 0.8,         // ZMĚNA: Mega zrnitost! (z 0.15 na 0.8)
    });

    // 6. Vytvoříme finální objekt (ZMĚNA: Mesh, ne Points)
    currentShape = new THREE.Mesh(tubeGeometry, solidMaterial);
    
    // Náhodné pootočení
    currentShape.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
    );

    // 7. Přidáme objekt do scény
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
