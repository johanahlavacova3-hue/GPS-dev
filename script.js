import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
// ---- NOVÉ IMPORTY PRO POST-PROCESSING ----
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js'; // Použijeme pro Grain

// ---- Základní nastavení scény ----
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 15; 

const canvas = document.querySelector('#c');
const renderer = new THREE.WebGLRenderer({ 
    canvas: canvas,
    antialias: true 
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000); 
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2; 

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; 

// ---- NOVINKA: Nastavení Composeru pro Post-processing ----
const composer = new EffectComposer(renderer);

// 1. Render Pass: Řekne composeru, co má vykreslit (naši scénu a kameru)
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

// 2. Film Pass: Přidá filmový šum (grain) a prach.
const filmPass = new FilmPass(
    0.7,   // Intenzita zrna (šumu) - ZMĚNA: Vysoká hodnota pro "mega grain"
    0.025, // Intenzita prachu/rušení
    648,   // Frekvence šumu (jak hustě se body objevují)
    false  // Monochrome (černobílý grain)
);
composer.addPass(filmPass);


// ---- Světla (Zůstávají) ----
const ambientLight = new THREE.AmbientLight(0x404040, 1.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 5.0);
directionalLight.position.set(5, 10, 7.5);
scene.add(directionalLight);


// ---- Grain Texture je ODSTRANĚNA ----

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
    const tubeGeometry = new THREE.TubeGeometry(
        curve, 
        400, 
        2.0,  
        32,   
        true
    );

    // 5. Vytvoříme materiál (ZMĚNA: POUZE MATNÝ, ŽÁDNÁ TEXTURA)
    const solidMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,        // Čistě bílá
        roughness: 0.8,         // Matný povrch
        metalness: 0.0,         
        // Bump map odstraněn
    });

    // 6. Finální objekt
    currentShape = new THREE.Mesh(tubeGeometry, solidMaterial);
    scene.add(currentShape);
}

// ---- Animační smyčka (ZMĚNA: Používáme composer) ----

function animate() {
    requestAnimationFrame(animate); 

    if (currentShape) {
         currentShape.rotation.x += 0.001;
         currentShape.rotation.y += 0.002;
    }

    controls.update(); 
    // ZMĚNA: Místo renderer.render() voláme composer.render()
    composer.render(); 
}

// ---- Interakce (Beze změny) ----

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight); // ZMĚNA: Composer také potřebuje update velikosti
});

window.addEventListener('click', generateRandomShape);

generateRandomShape();
animate();
