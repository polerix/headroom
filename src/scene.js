import * as THREE from 'three';

let scene, camera, renderer, fillLight;

export function initScene(canvasElement) {
    scene = new THREE.Scene();

    const wrapper = document.querySelector('.canvas-wrapper');
    const width = wrapper ? wrapper.clientWidth : window.innerWidth;
    const height = wrapper ? wrapper.clientHeight : window.innerHeight;

    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 1.4, 1.2);

    renderer = new THREE.WebGLRenderer({ canvas: canvasElement, alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 0); // Explicitly zero-alpha for OBS capturing
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Basic lighting setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    scene.add(ambientLight);

    const directLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directLight.position.set(2, 5, 5);
    scene.add(directLight);

    fillLight = new THREE.PointLight(0x00ff41, 1);
    fillLight.position.set(-5, 0, -2);
    scene.add(fillLight);

    window.addEventListener('resize', () => {
        const wrapper = document.querySelector('.canvas-wrapper');
        if (!wrapper) return;
        camera.aspect = wrapper.clientWidth / wrapper.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(wrapper.clientWidth, wrapper.clientHeight);
    });

    return { scene, camera, renderer };
}

export function render(scene, camera) {
    renderer.render(scene, camera);
}
