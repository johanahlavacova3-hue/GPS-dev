// main.js
const offset = new THREE.Vector3((Math.random()-0.5),(Math.random()-0.5),(Math.random()-0.5));
offset.multiplyScalar(strength*0.6);
vertex.add(offset);
pos.setXYZ(i, vertex.x, vertex.y, vertex.z);
}
pos.needsUpdate = true;
geom.computeVertexNormals();

if(hullMesh){ scene.remove(hullMesh); hullMesh.geometry.dispose(); hullMesh=null; }
}

function applySkin(){
const geom = workingMesh.geometry;
const pos = geom.attributes.position;
const pts = [];
const v = new THREE.Vector3();
for(let i=0;i<pos.count;i++){ v.fromBufferAttribute(pos,i); pts.push(v.clone()); }

const hullGeo = new ConvexGeometry(pts);
const mat = new THREE.MeshStandardMaterial({color:0xffb14d, metalness:0.1, roughness:0.6});
if(hullMesh){ scene.remove(hullMesh); hullMesh.geometry.dispose(); }
hullMesh = new THREE.Mesh(hullGeo, mat);
hullMesh.position.copy(workingMesh.position);
scene.add(hullMesh);
}

function applySmooth(level=2){
if(!hullMesh){
let geom = workingMesh.geometry.clone();
geom = geom.toNonIndexed();
const mod = new SubdivisionModifier(level);
const smoothGeo = mod.modify(geom);
const mat = new THREE.MeshStandardMaterial({color:0x9b59ff, metalness:0.05, roughness:0.4});

scene.remove(workingMesh);
workingMesh.geometry.dispose();
workingMesh = new THREE.Mesh(smoothGeo, mat);
scene.add(workingMesh);
} else {
let geom = hullMesh.geometry.clone();
geom = geom.toNonIndexed();
const mod = new SubdivisionModifier(level);
const smoothGeo = mod.modify(geom);

scene.remove(hullMesh);
hullMesh.geometry.dispose();
hullMesh = new THREE.Mesh(smoothGeo, new THREE.MeshStandardMaterial({color:0xffb14d}));
scene.add(hullMesh);
}
}

function resetAll(){
if(hullMesh){ scene.remove(hullMesh); hullMesh.geometry.dispose(); hullMesh=null; }
if(workingMesh){ scene.remove(workingMesh); workingMesh.geometry.dispose(); }
workingMesh = new THREE.Mesh(originalGeom.clone(), new THREE.MeshStandardMaterial({color:0x2ea3ff, metalness:0.1, roughness:0.5}));
scene.add(workingMesh);
}

function onWindowResize(){
camera.aspect = canvasWrap.clientWidth / canvasWrap.clientHeight;
camera.updateProjectionMatrix();
renderer.setSize(canvasWrap.clientWidth, canvasWrap.clientHeight);
}

function animate(){
requestAnimationFrame(animate);
controls.update();
renderer.render(scene, camera);
}
