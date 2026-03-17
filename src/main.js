import * as THREE from 'three';
import { initScene, render } from './scene.js';
import { AvatarManager } from './avatar.js';
import { UIManager } from './ui.js';
import { initAudio, updateAudioVolume, cleanupAudio } from './audio-tracker.js';
import { latestFaceLandmarks, latestFaceBlendshapes } from './face-tracker.js';

// Global State
let scene, camera, renderer;
let avatar;
let ui;

// Tracking State
let headTargetRotX = 0, headTargetRotY = 0, headTargetRotZ = 0;
let headCurrentRotX = 0, headCurrentRotY = 0, headCurrentRotZ = 0;
const HEAD_SMOOTHING = 0.15;

const clock = new THREE.Clock();

async function init() {
    // 1. Initialize HTML/UI
    const canvas = document.getElementById('webgl-canvas');
    const overlay = document.getElementById('start-overlay');
    const startBtn = document.getElementById('start-btn');

    ui = new UIManager();
    ui.init();

    // 2. Initialize Three.js Scene
    const sceneSetup = initScene(canvas);
    scene = sceneSetup.scene;
    camera = sceneSetup.camera;
    renderer = sceneSetup.renderer;

    // 3. Initialize Avatar Manager
    avatar = new AvatarManager(scene);

    // Load a GLB/VRM base test model here
    await avatar.loadModel('/models/test_avatar.vrm');

    // 4. Connect Start Button
    startBtn.addEventListener('click', () => {
        initAudio(); // Starts Face Tracking + Audio Context
        overlay.style.opacity = '0';
        setTimeout(() => {
            overlay.style.display = 'none';
            document.querySelector('.system-status').innerText = 'SYSTEM_ONLINE /// TRACKING_ACTIVE';
        }, 500);
    });

    // Cleanup
    window.addEventListener('beforeunload', cleanupAudio);
    window.addEventListener('unload', cleanupAudio);

    // 5. Drag and Drop VRM
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file && (file.name.endsWith('.vrm') || file.name.endsWith('.glb'))) {
            document.querySelector('.system-status').innerText = 'SYSTEM_ONLINE /// LOADING_AVATAR...';
            const url = URL.createObjectURL(file);
            avatar.loadModel(url).catch(err => {
                console.error(err);
                document.querySelector('.system-status').innerText = 'SYSTEM_ERROR /// LOAD_FAILED';
            });
        }
    });

    // 6. Start Render Loop
    animate();
}

function updateFaceTracking() {
    if (!latestFaceLandmarks) return;

    // Map FaceLandmarks (Spatial Position) to Head Rotation
    const nose = latestFaceLandmarks[1];
    const leftEye = latestFaceLandmarks[33];
    const rightEye = latestFaceLandmarks[263];
    const chin = latestFaceLandmarks[152];

    if (nose && leftEye && rightEye && chin) {
        // Yaw (Y-axis rotation)
        const eyeCenterBaseX = (leftEye.x + rightEye.x) / 2;
        headTargetRotY = (nose.x - eyeCenterBaseX) * -3.0;

        // Pitch (X-axis rotation)
        const faceHeight = chin.y - ((leftEye.y + rightEye.y) / 2);
        const noseYOffset = nose.y - ((leftEye.y + rightEye.y) / 2);
        headTargetRotX = (noseYOffset / faceHeight - 0.45) * -2.0;

        // Roll (Z-axis rotation)
        const dY = rightEye.y - leftEye.y;
        const dX = rightEye.x - leftEye.x;
        headTargetRotZ = Math.atan2(dY, dX);
    }

    // Map FaceBlendshapes (ARKit) to Morph Targets
    if (latestFaceBlendshapes && latestFaceBlendshapes.categories) {
        const arkit = {};
        latestFaceBlendshapes.categories.forEach(shape => {
            arkit[shape.categoryName] = shape.score;
        });

        if (avatar && avatar.vrm) {
            // Standard VRM 1.0 Semantic Mapping
            avatar.setBlendshape('aa', arkit.jawOpen || 0);
            avatar.setBlendshape('blinkLeft', arkit.eyeBlinkLeft || 0);
            avatar.setBlendshape('blinkRight', arkit.eyeBlinkRight || 0);
            avatar.setBlendshape('happy', Math.max(arkit.mouthSmileLeft || 0, arkit.mouthSmileRight || 0));
            avatar.setBlendshape('sad', Math.max(arkit.mouthFrownLeft || 0, arkit.mouthFrownRight || 0));
            avatar.setBlendshape('angry', Math.max(arkit.browDownLeft || 0, arkit.browDownRight || 0));
        } else {
            // Fallback for native raw GLBs
            latestFaceBlendshapes.categories.forEach(shape => {
                avatar.setBlendshape(shape.categoryName, shape.score);
            });
        }
    }
}

function updateAudioFallback() {
    const vol = updateAudioVolume(ui.settings.audioSensitivity, ui.settings.audioThreshold);
    const audioMouthOpen = Math.min((vol / 100) * 1.5, 1.0);

    // Provide a fallback for voice-based lip sync if webcam face tracking drops
    if (!latestFaceBlendshapes && avatar) {
        if (avatar.vrm) {
            avatar.setBlendshape('aa', audioMouthOpen);
        } else {
            avatar.setBlendshape('jawOpen', audioMouthOpen);
        }
    }
}

function animate() {
    requestAnimationFrame(animate);

    const deltaTime = clock.getDelta();

    // 1. Process Tracking Data
    updateFaceTracking();
    updateAudioFallback();

    // 2. Smooth Head Rotation (Slerp-like Lerp)
    headCurrentRotX += (headTargetRotX - headCurrentRotX) * HEAD_SMOOTHING;
    headCurrentRotY += (headTargetRotY - headCurrentRotY) * HEAD_SMOOTHING;
    headCurrentRotZ += (headTargetRotZ - headCurrentRotZ) * HEAD_SMOOTHING;

    // 3. Apply to Avatar Skeleton
    if (avatar) {
        // VRM Humanoid bones use camelCase, head/neck
        const euler = new THREE.Euler(headCurrentRotX, headCurrentRotY, headCurrentRotZ, 'XYZ');
        avatar.setBoneRotation('head', euler);
        avatar.setBoneRotation('neck', euler); // Distribute rotation across both 

        avatar.update(deltaTime);
    }

    // 4. Render Frame
    render(scene, camera);
}

// Boot
init();
