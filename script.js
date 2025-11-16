import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ---- Základní nastavení scény ----

// Scéna
const scene = new THREE.Scene();

// Kamera (perspektivní, aby měla hloubku)
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 20; // Posuneme kameru dozadu

// Renderer (kreslíř)
const canvas = document.querySelector('#c');
const renderer = new THREE.WebGLRenderer({ 
    canvas: canvas,
    antialias: true // Vyhlazování hran
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000); // Černé pozadí, jako na obrázcích

// Ovládání myší (orbit controls) - umožňuje otáčet objektem
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // Plynulé zpomalení pohybu

// ---- Generování 3D tvaru ----

let currentShape = null; // Proměnná pro uložení aktuálního tvaru

function generateRandomShape() {
    // 1. Pokud už nějaký tvar existuje, smažeme ho
    if (currentShape) {
        scene.remove(currentShape);
        currentShape.geometry.dispose(); // Uvolníme paměť
        currentShape.material.dispose();
    }

    // 2. Vytvoříme náhodné body v 3D prostoru
    const points = [];
    let currentPos = new THREE.Vector3(0, 0, 0);

    for (let i = 0; i < 20; i++) { // 20 hlavních "uzlů"
        const randomDirection = new THREE.Vector3(
            (Math.random() - 0.5) * 2, // náhodný směr x
            (Math.random() - 0.5) * 2, // náhodný směr y
            (Math.random() - 0.5) * 2  // náhodný směr z
        ).normalize(); // Normalizujeme (délka vektoru bude 1)

        const randomLength = Math.random() * 5 + 3; // Náhodná délka kroku
        currentPos.add(randomDirection.multiplyScalar(randomLength));
        points.push(currentPos.clone());
    }

    // 3. Vytvoříme plynulou křivku, která prochází všemi body
    // true = křivka se na konci spojí s začátkem (uzavřená smyčka)
    const curve = new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.5);

    // 4. Vytvoříme geometrii "trubice" podél této křivky
    // (křivka, počet segmentů podél, rádius, počet segmentů v řezu, uzavřená)
    const tubeGeometry = new THREE.TubeGeometry(curve, 300, 0.8, 12, true);

    // 5. Vytvoříme materiál - MRAČNO BODŮ
    // Toto je klíč k dosažení vzhledu z obrázku genderA.png
    const pointsMaterial = new THREE.PointsMaterial({
        color: 0xffffff, // Bílá barva bodů
        size: 0.1,       // Velikost každého bodu
        sizeAttenuation: true // Body dál od kamery budou menší
    });

    // 6. Vytvoříme finální objekt Points (ne Mesh)
    currentShape = new THREE.Points(tubeGeometry, pointsMaterial);
    
    // Náhodně objekt pootočíme
    currentShape.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
    );

    // 7. Přidáme objekt do scény
    scene.add(currentShape);
}

// ---- Animační smyčka ----

function animate() {
    requestAnimationFrame(animate); // Požádá prohlížeč o další snímek

    // Plynule otáčíme celým tvarem (pokud nějaký je)
    if (currentShape) {
         currentShape.rotation.x += 0.001;
         currentShape.rotation.y += 0.002;
    }

    controls.update(); // Aktualizuje ovládání myší
    renderer.render(scene, camera); // Vykreslí scénu
}

// ---- Spuštění a interakce ----

// Přizpůsobení velikosti okna
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Generování nového tvaru při kliknutí
window.addEventListener('click', generateRandomShape);

// Vygenerujeme první tvar hned po načtení
generateRandomShape();

// Spustíme animační smyčku
animate();
