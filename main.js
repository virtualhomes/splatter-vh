import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Splatter } from 'splatter-three';
import GUI from 'lil-gui';

// --- WebGL2 context ---
const options = { antialias: false, alpha: true, powerPreference: 'high-performance' };
const canvas = document.createElement('canvas');
const context = canvas.getContext('webgl2', options);
if (!context) {
    alert('WebGL2 not supported in this browser');
    throw new Error('WebGL2 not supported');
}
document.body.appendChild(canvas);

// --- Renderer ---
const renderer = new THREE.WebGLRenderer({ canvas, context });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

// --- Splatter ---
const splatter = new Splatter(context, { splatId: '33k-cxw' });
splatter.setTransform(new THREE.Matrix4().makeRotationX(130 / 180 * Math.PI));

// --- Scene ---
const scene = new THREE.Scene();
scene.add(new THREE.GridHelper(10, 10));

// --- Lights ---
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 10, 7.5);
scene.add(light);
scene.add(new THREE.AmbientLight(0xffffff));

// --- Camera & Controls ---
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
camera.position.set(3, 3, 3);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.25;
controls.rotateSpeed = 0.5;

// --- Marker ball ---
const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 16, 8),
    new THREE.MeshStandardMaterial({ color: 0xffff00 })
);
scene.add(ball);

// --- Splatter Shader ---
splatter.addUniform('vec3', 'uWeights');
splatter.setShaderEffect(`float gray = dot(color, uWeights);`);
splatter.setClipTest(`if (length(position) + radius > 10.0) { return false; }`);

// --- Tooltip ---
const tooltip = document.createElement('div');
tooltip.innerText = 'WASL Model';
tooltip.style.position = 'absolute';
tooltip.style.padding = '4px 8px';
tooltip.style.background = 'rgba(0,0,0,0.7)';
tooltip.style.color = 'white';
tooltip.style.borderRadius = '4px';
tooltip.style.pointerEvents = 'none';
tooltip.style.transform = 'translate(-50%, -100%)';
document.body.appendChild(tooltip);

// --- Raycaster & Mouse ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let clickableObjects = [];
let lastClickedMesh = null;

// --- Load GLB ---
let model;
const loader = new GLTFLoader();
loader.load('./wasl.glb', (gltf) => {
    model = gltf.scene;

    // Recenter model
    const box = new THREE.Box3().setFromObject(model);
    const center = new THREE.Vector3();
    box.getCenter(center);
    model.position.sub(center);
    scene.add(model);

    // Collect all meshes for raycasting and clone materials
    model.traverse((child) => {
        if (child.isMesh) {
            child.material = child.material.clone(); // each mesh gets its own material
            clickableObjects.push(child);
        }
    });

    // --- lil-gui ---
    const gui = new GUI();
    const modelFolder = gui.addFolder('GLB Transform');

    // Position
    const positionFolder = modelFolder.addFolder('Position');
    positionFolder.add(model.position, 'x', -10, 10, 0.01).name('X');
    positionFolder.add(model.position, 'y', -10, 10, 0.01).name('Y');
    positionFolder.add(model.position, 'z', -10, 10, 0.01).name('Z');
    const posAll = { all: 0 };
    positionFolder.add(posAll, 'all', -10, 10, 0.01).name('All').onChange(v => model.position.set(v, v, v));

    // Rotation
    const rotation = {
        x: THREE.MathUtils.radToDeg(model.rotation.x),
        y: THREE.MathUtils.radToDeg(model.rotation.y),
        z: THREE.MathUtils.radToDeg(model.rotation.z),
        all: 0
    };
    const rotationFolder = modelFolder.addFolder('Rotation');
    rotationFolder.add(rotation, 'x', -180, 180, 1).name('X').onChange(v => model.rotation.x = THREE.MathUtils.degToRad(v));
    rotationFolder.add(rotation, 'y', -180, 180, 1).name('Y').onChange(v => model.rotation.y = THREE.MathUtils.degToRad(v));
    rotationFolder.add(rotation, 'z', -180, 180, 1).name('Z').onChange(v => model.rotation.z = THREE.MathUtils.degToRad(v));
    rotationFolder.add(rotation, 'all', -180, 180, 1).name('All').onChange(v => {
        const rad = THREE.MathUtils.degToRad(v);
        model.rotation.set(rad, rad, rad);
    });

    // Scale
    const scaleFolder = modelFolder.addFolder('Scale');
    scaleFolder.add(model.scale, 'x', 0.01, 10, 0.01).name('X');
    scaleFolder.add(model.scale, 'y', 0.01, 10, 0.01).name('Y');
    scaleFolder.add(model.scale, 'z', 0.01, 10, 0.01).name('Z');
    const scaleAll = { all: 1 };
    scaleFolder.add(scaleAll, 'all', 0.01, 10, 0.01).name('All').onChange(v => model.scale.set(v, v, v));

    modelFolder.open();
    positionFolder.open();
    rotationFolder.open();
    scaleFolder.open();

}, undefined, (error) => { console.error('Error loading GLB:', error); });

// --- Render Loop ---
function render(deltaTime) {
    frameRequested = false;
    renderer.render(scene, camera);
    splatter.setUniform('uWeights', [0.299, 0.587, 0.114]);
    splatter.render(camera, controls.target);

    // Tooltip
    if (model) {
        const box = new THREE.Box3().setFromObject(model);
        const top = new THREE.Vector3();
        box.getCenter(top);
        top.y += box.getSize(new THREE.Vector3()).y / 2;

        top.project(camera);
        const x = (top.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-top.y * 0.5 + 0.5) * window.innerHeight;

        tooltip.style.left = `${x}px`;
        tooltip.style.top = `${y}px`;
        tooltip.style.display = (top.z > 1 || top.z < -1) ? 'none' : 'block';
    }

    if (controls.update(deltaTime)) update();
}

let frameRequested = false;
function update() {
    if (!frameRequested) {
        requestAnimationFrame(render);
        frameRequested = true;
    }
}

// --- Resize ---
function resize() {
    const [width, height] = [window.innerWidth, window.innerHeight];
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    update();
}

// --- Click Handler ---
let lastTime = -1e3;
function onclick(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(clickableObjects, true);
    if (intersects.length > 0) {
        const obj = intersects[0].object;
        const worldPos = new THREE.Vector3();
        obj.getWorldPosition(worldPos);

        console.log('Clicked object:', obj.name || '(no name)');
        // console.log('World position:', worldPos);

        // Highlight clicked mesh only
        if (lastClickedMesh) lastClickedMesh.material.color.set(lastClickedMesh.currentColor || 0xffffff);
        obj.currentColor = obj.material.color.getHex();
        obj.material.color.set(0xff0000);
        lastClickedMesh = obj;
    }

    // Double-click recenter
    if (performance.now() - lastTime < 300) {
        const pt = splatter.hitTest(camera, [event.clientX, event.clientY]);
        if (pt) {
            controls.target.copy(pt);
            ball.position.copy(pt);
            update();
        }
    }
    lastTime = performance.now();
}

// --- Splatter loaded handler ---
function onloaded(totalLoaded, numDisplayed) {
    if (totalLoaded > splatter.totalSize / 2 || numDisplayed > 1e6) {
        document.getElementById('spinner').style.display = 'none';
    }
}

resize();
update();
function animate() {
    requestAnimationFrame(animate);

    controls.update();        // orbit controls damping
    renderer.render(scene, camera);

    splatter.render(camera, controls.target); // render splats

    // tooltip follows model
    if (model) {
        const box = new THREE.Box3().setFromObject(model);
        const top = new THREE.Vector3();
        box.getCenter(top);
        top.y += box.getSize(new THREE.Vector3()).y / 2;

        top.project(camera);
        const x = (top.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-top.y * 0.5 + 0.5) * window.innerHeight;

        tooltip.style.left = `${x}px`;
        tooltip.style.top = `${y}px`;
        tooltip.style.display = (top.z > 1 || top.z < -1) ? 'none' : 'block';
    }
}
animate();


window.addEventListener('resize', resize);
controls.addEventListener('change', update);
splatter.addEventListener('update', update);
splatter.addEventListener('loaded', onloaded);
canvas.addEventListener('pointerdown', onclick);
