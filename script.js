// ZMĚNA: Už zde nejsou žádné "import" příkazy.
// Knihovna THREE a OrbitControls jsou načteny globálně z index.html

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

// ZMĚNA: Musíme použít "THREE.OrbitControls", protože OrbitControls
// je nyní vlastností globálního objektu THREE.
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// ---- Světla ----
const ambientLight = new THREE.AmbientLight(0x404040, 2);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 2.5);
directionalLight.position.set(5, 10, 7.5);
scene.add(directionalLight);

// ---- Funkce pro texturu ----
// (Tato funkce zůstává 100% stejná)
function createGrainyTexture() {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(size, size);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        const val = Math.random() * 255;
        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
        data[i + 3] = 255;
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
// (Tato funkce zůstává 100% stejná)
let currentShape = null;
function generateRandomShape() {
    if (currentShape) {
        scene.remove(currentShape);
        currentShape.geometry.dispose();
        currentShape.material.dispose();
    }

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

    const curve = new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.5);
    const tubeGeometry = new THREE.TubeGeometry(curve, 300, 2.0, 16, true);

    const solidMaterial = new THREE.MeshStandardMaterial({
        color: 0xe0e0e0,
        roughness: 0.7,
        metalness: 0.1,
        bumpMap: grainyBumpTexture,
        bumpScale: 0.15,
    });

    currentShape = new THREE.Mesh(tubeGeometry, solidMaterial);
    currentShape.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
    );
    scene.add(currentShape);
}

// ---- Animační smyčka ----
// (Tato funkce zůstává 100% stejná)
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
// (Tato část zůstává 100% stejná)
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
window.addEventListener('click', generateRandomShape);
generateRandomShape();
animate();
