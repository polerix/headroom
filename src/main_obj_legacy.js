import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import GamepadController from './gamepad-controller.js';
import { startFaceTracking, latestFaceLandmarks } from './face-tracker.js';
import { InputManager } from './input-manager.js';

// ============ CONSTANTS ============
// Model & Geometry
const MODEL_SCALE = 5.0;
const MOUTH_PLANE_SIZE = 0.15;
const MOUTH_PLANE_OFFSET_X = 0;
const MOUTH_PLANE_OFFSET_Y = -0.17;
const MOUTH_PLANE_OFFSET_Z = 0.15;

// Animation & Rotation
const ROTATION_SPEED = 0.02;
const CAMERA_MOVE_SPEED = 0.05;
const CAMERA_ROTATE_SPEED = 0.02;
const EYE_LOOK_UP_OFFSET = -0.3;
const EYE_LOOK_DOWN_OFFSET = 0.3;
const EYE_LOOK_LEFT_OFFSET = -0.4;
const EYE_LOOK_RIGHT_OFFSET = 0.4;
const EYE_SMOOTHING = 0.1;
const SHADES_TOGGLE_Y = 5.0;
const SHADES_LERP_UP_SPEED = 0.05;
const SHADES_LERP_DOWN_SPEED = 0.15;

// Audio & Input
const SPACEBAR_OPEN_SPEED = 0.05;
const SPACEBAR_CLOSE_SPEED = 0.02;
const MAX_MOUTH_OPEN = 1.0;
const AUDIO_THRESHOLD = 10;
const AUDIO_SENSITIVITY = 60.0;
const AUDIO_FFT_SIZE = 256;
const AUDIO_SMOOTHING = 0.5;
const AUDIO_FREQUENCY_START = 2;
const AUDIO_FREQUENCY_END = 30;

// UI & Performance
const FPS_UPDATE_INTERVAL = 500; // ms
const LOW_PROCESS_TARGET_FPS = 24; // target fps in low-process mode
const SETTINGS_STORAGE_KEY = 'headroom-settings';
const THEME_COLORS = {
    green: { primary: '#00ff41', secondary: '#004411', accent: '#4040ff' },
    cyan: { primary: '#00ffff', secondary: '#004444', accent: '#0044ff' },
    magenta: { primary: '#ff00ff', secondary: '#440044', accent: '#4400ff' },
    yellow: { primary: '#ffff00', secondary: '#444400', accent: '#ffaa00' }
};

// Lighting & Materials
const AMBIENT_LIGHT_COLOR = 0x4040ff;
const AMBIENT_LIGHT_INTENSITY = 0.5;
const DIRECTIONAL_LIGHT_COLOR = 0x00ff41;
const DIRECTIONAL_LIGHT_INTENSITY = 2;
const FILL_LIGHT_COLOR = 0xff00ff;
const FILL_LIGHT_INTENSITY = 1;
const DEFAULT_WIREFRAME_COLOR = 0x00ff41;
const DEFAULT_EMISSIVE_COLOR = 0x004411;
const CYBER_OPACITY = 0.6;
const MATERIAL_METALNESS = 0.8;
const MATERIAL_ROUGHNESS = 0.2;

// ============ GLOBAL STATE ============
let scene, camera, renderer, objectGroup, mesh;
let lowProcessMode = false;
let lastFrameTime = 0;
let originalVertices = null;
let currentVertices = null;
let gamepadController = null; // Controller input handler

// Parts for specific control
let eyeLeft, eyeRight, shadesMesh, mouthPlane;
let mouthTextures = {};
let eyeTargetX = 0, eyeTargetY = 0;
let eyeCurrentX = 0, eyeCurrentY = 0;

// Face Tracking State
let baseColor1001 = null;
let baseColor1002 = null;
let texOffsetX = 0, texOffsetY = 0;
let texScaleX = 1, texScaleY = 1;
let headTargetRotX = 0, headTargetRotY = 0, headTargetRotZ = 0;
let headTargetPosX = 0, headTargetPosY = 0, headTargetPosZ = 0;
let headCurrentRotX = 0, headCurrentRotY = 0, headCurrentRotZ = 0;
let headCurrentPosX = 0, headCurrentPosY = 0, headCurrentPosZ = 0;
const HEAD_SMOOTHING = 0.15;
let headCalibration = { rX: 0, rY: 0, rZ: 0, pX: 0, pY: 0, pZ: 0 };
let isCalibratingThisFrame = false;

// Manual Input State
let inputRotX = 0;
let inputRotY = 0;

let shadesTargetY = 0;
let shadesCurrentY = 0;
let isShadesOff = false;
let renderMode = 'CYBER'; // 'WF', 'FLAT', 'CYBER', 'OPAQUE'


// Audio & Input State
let isAudioInitialized = false;
let audioContext, analyser, microphone, audioStream;
let dataArray;
let audioVolume = 0;
let isSpacebarPressed = false;
let isShiftPressed = false;
let spacebarMouthOpen = 0;

// UI & Performance State
let showFPS = false;
let lastFPSUpdate = 0;
let frameCount = 0;
let audioFeedbackEnabled = true;
let currentTheme = 'green';
let isDraggingCamera = false;
let lastMouseX = 0;
let lastMouseY = 0;
let cameraRotationX = 0;
let cameraRotationY = 0;

// Movement & Rotation State
const keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    KeyW: false,
    KeyS: false,
    KeyA: false,
    KeyD: false,
    KeyI: false,
    KeyK: false,
    KeyJ: false,
    KeyL: false,
    Digit1: false,
    Digit2: false,
    Digit3: false,
    Digit4: false
};

// ============ UTILITY FUNCTIONS ============

// Theme Management
function setTheme(themeName) {
    const theme = THEME_COLORS[themeName] || THEME_COLORS.green;
    currentTheme = themeName;
    document.documentElement.style.setProperty('--neon-green', theme.primary);
    document.documentElement.style.setProperty('--glass-border', `rgba(${hexToRgb(theme.primary).join(', ')}, 0.2)`);
    document.documentElement.style.setProperty('--glass-bg', `rgba(${hexToRgb(theme.primary).join(', ')}, 0.05)`);
    localStorage.setItem(`${SETTINGS_STORAGE_KEY}-theme`, themeName);
}

function updateTextureMapping() {
    if (baseColor1001) {
        baseColor1001.offset.set(texOffsetX, texOffsetY);
        baseColor1001.repeat.set(texScaleX, texScaleY);
        baseColor1001.needsUpdate = true;
    }
    if (baseColor1002) {
        baseColor1002.offset.set(texOffsetX, texOffsetY);
        baseColor1002.repeat.set(texScaleX, texScaleY);
        baseColor1002.needsUpdate = true;
    }
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
    ] : [0, 255, 65];
}

// Settings Management
function saveSettings() {
    const settings = {
        audioSensitivity: AUDIO_SENSITIVITY,
        audioThreshold: AUDIO_THRESHOLD,
        cameraSpeed: CAMERA_MOVE_SPEED,
        rotationSpeed: ROTATION_SPEED,
        showFPS,
        audioFeedback: audioFeedbackEnabled,
        theme: currentTheme,
        headCalibration: headCalibration,
        texOffsetX, texOffsetY, texScaleX, texScaleY
    };
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

function loadSettings() {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (saved) {
        try {
            const settings = JSON.parse(saved);
            // Update global constants
            window.AUDIO_SENSITIVITY = settings.audioSensitivity || AUDIO_SENSITIVITY;
            window.AUDIO_THRESHOLD = settings.audioThreshold || AUDIO_THRESHOLD;
            window.CAMERA_MOVE_SPEED = settings.cameraSpeed || CAMERA_MOVE_SPEED;
            window.ROTATION_SPEED = settings.rotationSpeed || ROTATION_SPEED;
            showFPS = settings.showFPS || false;
            audioFeedbackEnabled = settings.audioFeedback !== false;
            currentTheme = settings.theme || 'green';
            if (settings.headCalibration) {
                headCalibration = settings.headCalibration;
            }
            if (settings.texOffsetX !== undefined) texOffsetX = settings.texOffsetX;
            if (settings.texOffsetY !== undefined) texOffsetY = settings.texOffsetY;
            if (settings.texScaleX !== undefined) texScaleX = settings.texScaleX;
            if (settings.texScaleY !== undefined) texScaleY = settings.texScaleY;

            // Update UI elements to reflect loaded settings
            const audioSensSlider = document.getElementById('audio-sensitivity');
            const audioThreshSlider = document.getElementById('audio-threshold');
            const cameraSpeedSlider = document.getElementById('camera-speed');
            const rotationSpeedSlider = document.getElementById('rotation-speed');
            const audioFeedbackCheckbox = document.getElementById('audio-feedback');
            const themeSelect = document.getElementById('theme-select');

            if (audioSensSlider) {
                audioSensSlider.value = window.AUDIO_SENSITIVITY;
                document.getElementById('audio-sensitivity-value').textContent = window.AUDIO_SENSITIVITY;
            }
            if (audioThreshSlider) {
                audioThreshSlider.value = window.AUDIO_THRESHOLD;
                document.getElementById('audio-threshold-value').textContent = window.AUDIO_THRESHOLD;
            }
            if (cameraSpeedSlider) {
                cameraSpeedSlider.value = window.CAMERA_MOVE_SPEED;
                document.getElementById('camera-speed-value').textContent = window.CAMERA_MOVE_SPEED;
            }
            if (rotationSpeedSlider) {
                rotationSpeedSlider.value = window.ROTATION_SPEED;
                document.getElementById('rotation-speed-value').textContent = window.ROTATION_SPEED;
            }
            if (audioFeedbackCheckbox) {
                audioFeedbackCheckbox.checked = audioFeedbackEnabled;
            }
            if (themeSelect) {
                themeSelect.value = currentTheme;
            }

            const toSlider = document.getElementById('tex-offset-x');
            if (toSlider) {
                document.getElementById('tex-offset-x').value = texOffsetX;
                document.getElementById('tex-offset-y').value = texOffsetY;
                document.getElementById('tex-scale-x').value = texScaleX;
                document.getElementById('tex-scale-y').value = texScaleY;
                document.getElementById('tex-offset-x-val').textContent = texOffsetX;
                document.getElementById('tex-offset-y-val').textContent = texOffsetY;
                document.getElementById('tex-scale-x-val').textContent = texScaleX;
                document.getElementById('tex-scale-y-val').textContent = texScaleY;
            }

            setTheme(currentTheme);
            updateTextureMapping();
        } catch (e) {
            console.error('Failed to load settings:', e);
        }
    }
}

// URL State Export/Import
function exportStateAsURL() {
    const state = {
        camera: {
            x: camera.position.x,
            y: camera.position.y,
            z: camera.position.z,
            rotX: cameraRotationX,
            rotY: cameraRotationY
        },
        render: renderMode,
        theme: currentTheme,
        audioSensitivity: AUDIO_SENSITIVITY,
        audioThreshold: AUDIO_THRESHOLD,
        headCalibration: headCalibration,
        texOffsetX, texOffsetY, texScaleX, texScaleY
    };
    const encoded = btoa(JSON.stringify(state));
    const url = `${window.location.origin}${window.location.pathname}?state=${encoded}`;
    console.log('State URL:', url);
    alert(`State URL copied! (Check console for full URL)\n\n${url}`);
    navigator.clipboard.writeText(url).catch(() => console.log('Could not copy to clipboard'));
}

function importStateFromURL() {
    const params = new URLSearchParams(window.location.search);
    const state = params.get('state');
    if (state) {
        try {
            const data = JSON.parse(atob(state));
            if (data.camera && camera) {
                camera.position.set(data.camera.x, data.camera.y, data.camera.z);
                cameraRotationX = data.camera.rotX;
                cameraRotationY = data.camera.rotY;
            }
            if (data.render) renderMode = data.render;
            if (data.theme) setTheme(data.theme);
            if (data.audioSensitivity) AUDIO_SENSITIVITY = data.audioSensitivity;
            if (data.audioThreshold) AUDIO_THRESHOLD = data.audioThreshold;
            if (data.headCalibration) headCalibration = data.headCalibration;
            if (data.texOffsetX !== undefined) texOffsetX = data.texOffsetX;
            if (data.texOffsetY !== undefined) texOffsetY = data.texOffsetY;
            if (data.texScaleX !== undefined) texScaleX = data.texScaleX;
            if (data.texScaleY !== undefined) texScaleY = data.texScaleY;
            updateTextureMapping();
            console.log('State restored from URL');
        } catch (e) {
            console.error('Failed to import state:', e);
        }
    }
}

// Performance Monitor
function updateFPS() {
    const now = performance.now();
    if (now - lastFPSUpdate > FPS_UPDATE_INTERVAL) {
        const fps = Math.round((frameCount * 1000) / (now - lastFPSUpdate));
        document.getElementById('fps-display').textContent = fps;
        frameCount = 0;
        lastFPSUpdate = now;
        return fps;
    }
    return null;
}

// Modal Management
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('show');
    }
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
    }
}

function hideAllModals() {
    document.getElementById('keyboard-modal').classList.remove('show');
    document.getElementById('settings-panel').classList.remove('show');
}

// Audio Visual Feedback
function createAudioVisualFeedback() {
    if (!audioFeedbackEnabled || !mouthPlane) return;
    const intensity = Math.min(audioVolume / 100, 1.0);
    if (mouthPlane.material) {
        mouthPlane.material.emissive.setHex(0xffffff);
        mouthPlane.material.emissiveIntensity = intensity * 0.5;
    }
}

// Mouse Camera Control
function onMouseDown(e) {
    if (!InputManager.getSource('mouse')) return;
    if (e.button === 2) {
        isDraggingCamera = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        e.preventDefault();
    }
}

function onMouseMove(e) {
    if (isDraggingCamera) {
        const deltaX = e.clientX - lastMouseX;
        const deltaY = e.clientY - lastMouseY;
        cameraRotationY += deltaX * 0.005;
        cameraRotationX += deltaY * 0.005;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
    }
}

function onMouseUp() {
    isDraggingCamera = false;
}


// --- Initialization ---
function init() {
    const canvas = document.getElementById('webgl-canvas');
    const overlay = document.getElementById('start-overlay');
    const startBtn = document.getElementById('start-btn');

    // Scene setup
    scene = new THREE.Scene();

    const wrapper = document.querySelector('.canvas-wrapper');
    const initWidth = wrapper ? wrapper.clientWidth : window.innerWidth;
    const initHeight = wrapper ? wrapper.clientHeight : window.innerHeight;

    camera = new THREE.PerspectiveCamera(45, initWidth / initHeight, 0.1, 100);
    camera.position.z = 2.5;

    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(initWidth, initHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Load Textures
    const textureLoader = new THREE.TextureLoader();

    // Texture error handler
    const handleTextureError = (url) => {
        console.error(`Failed to load texture: ${url}`);
        document.querySelector('.system-status').innerText = `TEXTURE_ERROR /// ${url}`;
    };

    baseColor1001 = textureLoader.load(
        '/textures/Max Headroom material Base Color.1001.png',
        undefined,
        undefined,
        () => handleTextureError('Base Color 1001')
    );
    baseColor1002 = textureLoader.load(
        '/textures/Max Headroom material Base Color.1002.png',
        undefined,
        undefined,
        () => handleTextureError('Base Color 1002')
    );
    baseColor1001.colorSpace = THREE.SRGBColorSpace;
    baseColor1001.flipY = false;
    baseColor1002.colorSpace = THREE.SRGBColorSpace;
    baseColor1002.flipY = false;

    // Load Mouth Textures with error handling
    const mouths = ['rest', 'open_ai', 'teeth_e', 'round_o', 'pucker_u', 'closed_m', 'tongue_l_t', 'wide_s_z'];
    mouths.forEach(m => {
        mouthTextures[m] = textureLoader.load(
            `/textures/mouth_${m}.png`,
            undefined,
            undefined,
            () => console.warn(`Could not load mouth texture: ${m}`)
        );
    });



    // Group to hold and rotate the model
    objectGroup = new THREE.Group();
    scene.add(objectGroup);

    // Lighting
    const ambientLight = new THREE.AmbientLight(AMBIENT_LIGHT_COLOR, AMBIENT_LIGHT_INTENSITY);
    scene.add(ambientLight);

    const directLight = new THREE.DirectionalLight(DIRECTIONAL_LIGHT_COLOR, DIRECTIONAL_LIGHT_INTENSITY);
    directLight.position.set(5, 5, 5);
    scene.add(directLight);

    const fillLight = new THREE.PointLight(FILL_LIGHT_COLOR, FILL_LIGHT_INTENSITY);
    fillLight.position.set(-5, 2, -2);
    scene.add(fillLight);


    // Load Model
    const loader = new OBJLoader();
    loader.load(
        '/uploads_files_5692496_max+headroom.obj',
        (object) => {
            // Scale object first so offsets are relative to the scaled size
            object.scale.setScalar(MODEL_SCALE);

            // Center the entire object instead of individual parts
            const box = new THREE.Box3().setFromObject(object);
            const center = box.getCenter(new THREE.Vector3());
            object.position.sub(center);

            // Rotate the model 90 degrees forward to correct the imported orientation
            object.rotation.x = Math.PI / 2;

            // Find all meshes and apply wireframe material
            object.traverse((child) => {
                if (child.isMesh) {
                    console.log("Found mesh:", child.name);

                    if (child.name === 'max_headroom_eye_left') eyeLeft = child;
                    else eyeRight = child;

                    if (child.name === 'max_headroom_shades') {
                        shadesMesh = child;
                        shadesCurrentY = child.position.y;
                        shadesTargetY = child.position.y;
                    }

                    // Handle UDIM Textures:
                    // Usually face is 1001 (UV 0-1), torso/etc is 1002 (UV 1-2).
                    // We can shift the UVs of 1002 meshes back to 0-1 range to use the texture correctly.
                    const isFace = child.name.includes('head') || child.name.includes('eye') || child.name.includes('denture');

                    if (!isFace && child.geometry.attributes.uv) {
                        const uvs = child.geometry.attributes.uv.array;
                        for (let i = 0; i < uvs.length; i += 2) {
                            if (uvs[i] >= 1.0) uvs[i] -= 1.0;
                        }
                        child.geometry.attributes.uv.needsUpdate = true;
                    }

                    // Apply Material based on render mode (initial state is CYBER)
                    child.material = new THREE.MeshStandardMaterial({
                        color: DEFAULT_WIREFRAME_COLOR,
                        map: isFace ? baseColor1001 : baseColor1002,
                        wireframe: true,
                        transparent: true,
                        opacity: CYBER_OPACITY,
                        flatShading: true,
                        emissive: DEFAULT_EMISSIVE_COLOR,
                        metalness: MATERIAL_METALNESS,
                        roughness: MATERIAL_ROUGHNESS
                    });

                    // DO NOT CALL child.geometry.center() - it breaks relative positioning

                    // Target the main head mesh for deformation (lip sync)
                    if (child.name === 'max_headroom') {
                        mesh = child;
                        child.geometry.computeBoundingBox();
                        const posAttribute = child.geometry.attributes.position;
                        originalVertices = new Float32Array(posAttribute.array);
                        currentVertices = posAttribute.array;

                        // Create Mouth Plane (Robot Chicken Style)
                        const geometry = new THREE.PlaneGeometry(MOUTH_PLANE_SIZE, MOUTH_PLANE_SIZE);
                        const material = new THREE.MeshBasicMaterial({
                            map: mouthTextures['rest'],
                            transparent: true,
                            side: THREE.DoubleSide,
                            depthWrite: false // Prevents occlusion issues
                        });
                        mouthPlane = new THREE.Mesh(geometry, material);
                        // Position it slightly in front of the mouth area
                        mouthPlane.position.set(MOUTH_PLANE_OFFSET_X, MOUTH_PLANE_OFFSET_Y, MOUTH_PLANE_OFFSET_Z);
                        child.add(mouthPlane); // Anchor to head
                    }

                    // Trigger initial render mode set
                    setTimeout(updateMaterialMode, 100);

                    // Apply specific offsets for parts that tend to be misaligned in this model
                    if (child.name === 'max_headroom_denture_top' || child.name === 'max_headroom_denture_bottom') {
                        // Fine-tune teeth position if necessary
                        // child.position.y += 0.05; 
                    } else if (child.name === 'max_headroom_shades') {
                        // Fine-tune sunglasses position if necessary
                        // child.position.y += 0.02;
                    }
                }
            });

            objectGroup.add(object);

            // Update loading status
            document.querySelector('.system-status').innerText = 'SYSTEM_ONLINE /// MODEL_LOADED /// AWAITING_AUDIO';
        },
        (xhr) => {
            const percent = Math.round((xhr.loaded / xhr.total) * 100);
            document.querySelector('.system-status').innerText = `SYSTEM_LOADING /// ${percent}%`;
        },
        (error) => {
            console.error('Error loading OBJ:', error);
            document.querySelector('.system-status').innerText = 'SYSTEM_ERROR /// MODEL_FAILED';
        }
    );

    // Initialize Gamepad Controller
    gamepadController = new GamepadController();
    console.log('Gamepad controller initialized - ready for PS4/Xbox controller input');

    // Event Listeners
    window.addEventListener('resize', onWindowResize);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    window.addEventListener('beforeunload', cleanupAudio);
    window.addEventListener('unload', cleanupAudio);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    startBtn.addEventListener('click', () => {
        initAudio();
        overlay.style.opacity = '0';
        setTimeout(() => {
            overlay.style.display = 'none';
            document.querySelector('.system-status').innerText = 'SYSTEM_ONLINE /// AUDIO_SYNC_ACTIVE';
        }, 500);
    });

    // Start Render Loop
    animate();

    // ── Wire DAW Strip buttons (data-key="code" fires synthetic keyboard events) ──
    document.querySelectorAll('.daw-btn[data-key]').forEach(btn => {
        const key = btn.getAttribute('data-key');
        if (!key) return;

        const fireDown = () => {
            const forceShift = btn.getAttribute('data-shift') === 'true';
            onKeyDown({ code: key, key: key, preventDefault: () => { }, shiftKey: forceShift || isShiftPressed });
            btn.classList.add('active');
        };
        const fireUp = () => {
            const forceShift = btn.getAttribute('data-shift') === 'true';
            onKeyUp({ code: key, key: key, preventDefault: () => { }, shiftKey: forceShift || isShiftPressed });
            btn.classList.remove('active');
        };

        btn.addEventListener('mousedown', fireDown);
        btn.addEventListener('touchstart', fireDown, { passive: true });
        btn.addEventListener('mouseup', fireUp);
        btn.addEventListener('mouseleave', fireUp);
        btn.addEventListener('touchend', fireUp, { passive: true });
    });

    // ── SHIFT Toggle ──
    const shiftBtn = document.getElementById('shift-toggle');
    if (shiftBtn) {
        shiftBtn.addEventListener('click', () => {
            isShiftPressed = !isShiftPressed;
            shiftBtn.classList.toggle('active', isShiftPressed);
            shiftBtn.innerText = isShiftPressed ? 'SHIFT ON' : 'SHIFT';
        });
    }

    // ── Header Controls ──
    const helpBtn = document.getElementById('help-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const perfMonitorBtn = document.getElementById('perf-monitor');
    const calibrateBtn = document.getElementById('calibrate-btn');
    const eyeCenterBtn = document.getElementById('eye-center-btn');

    if (calibrateBtn) calibrateBtn.addEventListener('click', () => { isCalibratingThisFrame = true; });
    if (eyeCenterBtn) eyeCenterBtn.addEventListener('click', () => {
        eyeTargetX = 0; eyeTargetY = 0;
    });

    if (helpBtn) helpBtn.addEventListener('click', () => showModal('keyboard-modal'));

    if (settingsBtn) settingsBtn.addEventListener('click', () => {
        document.getElementById('settings-panel').classList.toggle('show');
    });

    if (fullscreenBtn) fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => console.log('Fullscreen failed:', err));
        } else {
            document.exitFullscreen();
        }
    });

    if (perfMonitorBtn) perfMonitorBtn.addEventListener('click', () => {
        showFPS = !showFPS;
        perfMonitorBtn.classList.toggle('active', showFPS);
    });

    // ── Low-Process Mode toggle ──
    const lowProcessBtn = document.getElementById('low-process-btn');
    if (lowProcessBtn) {
        lowProcessBtn.addEventListener('click', () => {
            lowProcessMode = !lowProcessMode;
            lowProcessBtn.classList.toggle('lp-active', lowProcessMode);
            lowProcessBtn.title = lowProcessMode
                ? 'Low-Process ON (~24fps) — click to disable'
                : 'Toggle Low-Process Mode (caps to ~24fps)';
            // Also drop pixel ratio when in LP mode to ease GPU load
            if (renderer) {
                renderer.setPixelRatio(lowProcessMode ? 1 : Math.min(window.devicePixelRatio, 2));
            }
            const statusEl = document.querySelector('.system-status');
            if (statusEl) {
                statusEl.innerText = lowProcessMode
                    ? 'SYSTEM_ONLINE /// LOW_PROCESS_MODE_ACTIVE'
                    : 'SYSTEM_ONLINE /// AUDIO_SYNC_ACTIVE';
            }
        });
    }

    // ── Source fader click toggles (InputManager) ──
    const SOURCE_IDS = [
        { id: 'src-keyboard', source: 'keyboard' },
        { id: 'src-mouse', source: 'mouse' },
        { id: 'src-video', source: 'video' },
        { id: 'src-controller', source: 'controller' },
    ];
    SOURCE_IDS.forEach(({ id, source }) => {
        const el = document.getElementById(id);
        if (!el) return;
        // Init visual state
        _syncSourceUI(el, source, InputManager.getSource(source));
        el.addEventListener('click', () => {
            InputManager.toggleSource(source);
        });
    });

    // Sync UI when InputManager state changes
    window.addEventListener('inputsourcechange', e => {
        const { source, enabled } = e.detail;
        const map = { keyboard: 'src-keyboard', mouse: 'src-mouse', video: 'src-video', controller: 'src-controller' };
        const el = document.getElementById(map[source]);
        if (el) _syncSourceUI(el, source, enabled);
    });

    // ── Gamepad status LED ──
    window.addEventListener('gamepadstatuschange', e => {
        const { connected, name } = e.detail;
        const led = document.getElementById('ctrl-led');
        const label = document.getElementById('ctrl-name');
        if (led) led.classList.toggle('connected', connected);
        if (label) label.textContent = connected ? name : 'NO CTRL';
    });


    // Modal Close Buttons
    const modalCloseBtn = document.getElementById('modal-close');
    const settingsCloseBtn = document.getElementById('settings-close');

    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', () => {
            hideModal('keyboard-modal');
        });
    }

    if (settingsCloseBtn) {
        settingsCloseBtn.addEventListener('click', () => {
            document.getElementById('settings-panel').classList.remove('show');
        });
    }

    // Settings Panel Controls
    const audioSensitivitySlider = document.getElementById('audio-sensitivity');
    const audioThresholdSlider = document.getElementById('audio-threshold');
    const cameraSpeedSlider = document.getElementById('camera-speed');
    const rotationSpeedSlider = document.getElementById('rotation-speed');
    const audioFeedbackCheckbox = document.getElementById('audio-feedback');
    const themeSelect = document.getElementById('theme-select');
    const exportStateBtn = document.getElementById('export-state-btn');
    const resetSettingsBtn = document.getElementById('settings-reset-btn');

    if (audioSensitivitySlider) {
        audioSensitivitySlider.addEventListener('input', (e) => {
            AUDIO_SENSITIVITY = parseFloat(e.target.value);
            document.getElementById('audio-sensitivity-value').textContent = e.target.value;
            saveSettings();
        });
    }

    if (audioThresholdSlider) {
        audioThresholdSlider.addEventListener('input', (e) => {
            AUDIO_THRESHOLD = parseFloat(e.target.value);
            document.getElementById('audio-threshold-value').textContent = e.target.value;
            saveSettings();
        });
    }

    if (cameraSpeedSlider) {
        cameraSpeedSlider.addEventListener('input', (e) => {
            CAMERA_MOVE_SPEED = parseFloat(e.target.value);
            document.getElementById('camera-speed-value').textContent = e.target.value;
            saveSettings();
        });
    }

    if (rotationSpeedSlider) {
        rotationSpeedSlider.addEventListener('input', (e) => {
            ROTATION_SPEED = parseFloat(e.target.value);
            document.getElementById('rotation-speed-value').textContent = e.target.value;
            saveSettings();
        });
    }

    if (audioFeedbackCheckbox) {
        audioFeedbackCheckbox.addEventListener('change', (e) => {
            audioFeedbackEnabled = e.target.checked;
            saveSettings();
        });
    }

    if (themeSelect) {
        themeSelect.addEventListener('change', (e) => {
            setTheme(e.target.value);
        });
    }

    if (exportStateBtn) {
        exportStateBtn.addEventListener('click', exportStateAsURL);
    }

    if (resetSettingsBtn) {
        resetSettingsBtn.addEventListener('click', () => {
            localStorage.removeItem(SETTINGS_STORAGE_KEY);
            location.reload();
        });
    }

    const texOffsetXSlider = document.getElementById('tex-offset-x');
    const texOffsetYSlider = document.getElementById('tex-offset-y');
    const texScaleXSlider = document.getElementById('tex-scale-x');
    const texScaleYSlider = document.getElementById('tex-scale-y');

    if (texOffsetXSlider) {
        texOffsetXSlider.addEventListener('input', (e) => {
            texOffsetX = parseFloat(e.target.value);
            document.getElementById('tex-offset-x-val').textContent = e.target.value;
            updateTextureMapping();
            saveSettings();
        });
    }

    if (texOffsetYSlider) {
        texOffsetYSlider.addEventListener('input', (e) => {
            texOffsetY = parseFloat(e.target.value);
            document.getElementById('tex-offset-y-val').textContent = e.target.value;
            updateTextureMapping();
            saveSettings();
        });
    }

    if (texScaleXSlider) {
        texScaleXSlider.addEventListener('input', (e) => {
            texScaleX = parseFloat(e.target.value);
            document.getElementById('tex-scale-x-val').textContent = e.target.value;
            updateTextureMapping();
            saveSettings();
        });
    }

    if (texScaleYSlider) {
        texScaleYSlider.addEventListener('input', (e) => {
            texScaleY = parseFloat(e.target.value);
            document.getElementById('tex-scale-y-val').textContent = e.target.value;
            updateTextureMapping();
            saveSettings();
        });
    }

    // Close modals on ESC key (handled in onKeyDown)
}


async function initAudio() {
    if (isAudioInitialized) return;
    try {
        const videoElement = document.getElementById('webcam-video');
        startFaceTracking(videoElement);

        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = AUDIO_FFT_SIZE;
        analyser.smoothingTimeConstant = AUDIO_SMOOTHING;
        microphone = audioContext.createMediaStreamSource(audioStream);
        microphone.connect(analyser);
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        isAudioInitialized = true;
        console.log('Audio initialized successfully');
    } catch (err) {
        console.error('Microphone access error:', err);
        const statusEl = document.querySelector('.system-status');
        if (statusEl) {
            statusEl.innerText = 'MICROPHONE_ACCESS_DENIED /// AUDIO_DISABLED';
        }
        alert('Microphone access is required for lip sync. Please allow microphone access in your browser settings.');
    }
}

// Cleanup audio resources on page unload
function cleanupAudio() {
    if (audioStream) {
        audioStream.getTracks().forEach(track => {
            track.stop();
            console.log('Audio stream stopped');
        });
    }
    if (audioContext && audioContext.state !== 'closed') {
        audioContext.close();
    }
}

function onWindowResize() {
    const wrapper = document.querySelector('.canvas-wrapper');
    if (!wrapper || !camera || !renderer) return;
    const width = wrapper.clientWidth;
    const height = wrapper.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

function onKeyDown(event) {
    // Modals / global shortcuts always fire regardless of keyboard source
    if (event.key === '?' || (event.shiftKey && event.code === 'Slash')) {
        showModal('keyboard-modal');
        event.preventDefault();
        return;
    }
    if (event.code === 'Escape') {
        hideAllModals();
        document.getElementById('settings-panel').classList.remove('show');
        event.preventDefault();
        return;
    }
    if (event.code === 'KeyF' && !event.ctrlKey && !event.metaKey) {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => console.log('Fullscreen failed:', err));
        } else {
            document.exitFullscreen();
        }
        event.preventDefault();
        return;
    }
    // Settings shortcut (O key) — from gamepad Options dispatch
    if (event.code === 'KeyO' && !event.ctrlKey) {
        document.getElementById('settings-panel').classList.toggle('show');
        return;
    }

    // Block remaining keyboard input if source is disabled
    if (!InputManager.getSource('keyboard')) return;

    if (keys.hasOwnProperty(event.code)) {
        keys[event.code] = true;
        event.preventDefault();
    }
    if (event.code === 'Space') {
        isSpacebarPressed = true;
        event.preventDefault();
    }
    if (event.code === 'KeyG') {
        isShadesOff = !isShadesOff;
        shadesTargetY = isShadesOff ? SHADES_TOGGLE_Y : 0.0;
    }
    if (event.code === 'Digit1') { renderMode = 'WF'; updateMaterialMode(); }
    if (event.code === 'Digit2') { renderMode = 'FLAT'; updateMaterialMode(); }
    if (event.code === 'Digit3') { renderMode = 'CYBER'; updateMaterialMode(); }
    if (event.code === 'Digit4') { renderMode = 'OPAQUE'; updateMaterialMode(); }

    isShiftPressed = event.shiftKey;
}

function onKeyUp(event) {
    if (!InputManager.getSource('keyboard')) {
        // Always clear space/shift on keyup regardless of gate state
        if (event.code === 'Space') isSpacebarPressed = false;
        isShiftPressed = event.shiftKey;
        return;
    }
    if (keys.hasOwnProperty(event.code)) keys[event.code] = false;
    if (event.code === 'Space') isSpacebarPressed = false;
    isShiftPressed = event.shiftKey;
}

function updateMaterialMode() {
    if (!objectGroup) return;

    objectGroup.traverse((child) => {
        if (child.isMesh && child !== mouthPlane) {
            // Determine if it should use unlit or shaded material
            if (renderMode === 'WF') {
                // True classic Wireframe: unlit
                if (!(child.material instanceof THREE.MeshBasicMaterial)) {
                    const oldMat = child.material;
                    child.material = new THREE.MeshBasicMaterial({
                        color: 0xffffff,
                        wireframe: true,
                        map: oldMat.map
                    });
                } else {
                    child.material.color.set(0xffffff);
                    child.material.wireframe = true;
                }
            } else {
                // Ensure it's ShadedMaterial for others
                if (!(child.material instanceof THREE.MeshStandardMaterial)) {
                    const oldMat = child.material;
                    child.material = new THREE.MeshStandardMaterial({
                        map: oldMat.map,
                        metalness: 0.8,
                        roughness: 0.2
                    });
                }

                const mat = child.material;
                mat.transparent = false;
                mat.opacity = 1.0;
                mat.wireframe = false;
                mat.flatShading = true;

                switch (renderMode) {
                    case 'FLAT':
                        mat.wireframe = true;
                        mat.color.set(0xffffff);
                        mat.emissive.set(0x000000);
                        break;
                    case 'CYBER':
                        mat.wireframe = true;
                        mat.opacity = CYBER_OPACITY;
                        mat.transparent = true;
                        mat.color.set(DEFAULT_WIREFRAME_COLOR);
                        mat.emissive.set(DEFAULT_EMISSIVE_COLOR);
                        break;
                    case 'OPAQUE':
                        mat.wireframe = false;
                        mat.color.set(0xffffff);
                        mat.emissive.set(0x000000);
                        break;
                }
            }
            child.material.needsUpdate = true;
        }
    });


    const statusEl = document.querySelector('.system-status');
    if (statusEl) {
        statusEl.innerText = `SYSTEM_ONLINE /// RENDER: ${renderMode}`;
    }
}


function updateVisualizer(volume) {
    const bars = document.querySelectorAll('.daw-bar');
    if (!bars.length) return;
    const normVol = Math.min(volume / 100, 1.0);
    bars.forEach((bar, index) => {
        const factor = 1.0 - (Math.abs(2 - index) * 0.18);
        const pct = Math.max(4, normVol * 100 * factor);
        bar.style.height = `${pct}%`;
        if (normVol > 0.6) {
            bar.style.background = 'var(--neon-red)';
            bar.style.boxShadow = '0 0 6px var(--neon-red)';
        } else if (normVol > 0.3) {
            bar.style.background = 'var(--neon-amber)';
            bar.style.boxShadow = '0 0 6px var(--neon-amber)';
        } else {
            bar.style.background = 'var(--neon-green)';
            bar.style.boxShadow = '0 0 4px rgba(0,255,65,0.4)';
        }
    });
}

function deformMesh(mouthOpenAmount) {
    if (!mesh || !originalVertices) return;
    const geometry = mesh.geometry;
    const positions = geometry.attributes.position;
    const bbox = geometry.boundingBox;
    if (!bbox) return;
    const height = bbox.max.y - bbox.min.y;
    const jawThreshold = bbox.min.y + height * 0.35;
    const maxDeformation = height * 0.20 * mouthOpenAmount;
    for (let i = 0; i < originalVertices.length; i += 3) {
        const origY = originalVertices[i + 1];
        positions.array[i] = originalVertices[i];
        positions.array[i + 1] = originalVertices[i + 1];
        positions.array[i + 2] = originalVertices[i + 2];
        if (origY < jawThreshold) {
            const normalizedPos = (jawThreshold - origY) / (jawThreshold - bbox.min.y);
            const factor = Math.pow(normalizedPos, 1.5);
            positions.array[i + 1] -= maxDeformation * factor;
        }
    }
    positions.needsUpdate = true;
}

function animate(now = 0) {
    requestAnimationFrame(animate);

    // Low-process mode: throttle to ~24fps
    if (lowProcessMode) {
        const minInterval = 1000 / LOW_PROCESS_TARGET_FPS;
        if (now - lastFrameTime < minInterval) return;
    }
    lastFrameTime = now;

    if (InputManager.getSource('video') && latestFaceLandmarks && latestFaceLandmarks.length > 0) {
        const landmarks = latestFaceLandmarks[0];

        // Mouth Control
        const upperLip = landmarks[13];
        const lowerLip = landmarks[14];
        const mouthOpenAmount = Math.min(Math.max((lowerLip.y - upperLip.y) * 5.0 - 0.1, 0.0), 1.0);

        if (mouthPlane) {
            let shape = 'rest';
            if (mouthOpenAmount > 0.8) shape = 'open_ai';
            else if (mouthOpenAmount > 0.5) shape = 'round_o';
            else if (mouthOpenAmount > 0.3) shape = 'teeth_e';
            else if (mouthOpenAmount > 0.1) shape = 'wide_s_z';
            else if (mouthOpenAmount > 0.05) shape = 'closed_m';

            if (mouthPlane.material.map !== mouthTextures[shape]) {
                mouthPlane.material.map = mouthTextures[shape];
            }
            mouthPlane.visible = true;
        }

        // Head Tracking (Rotation)
        const nose = landmarks[1];
        const noseBottom = landmarks[2];
        const leftEye = landmarks[33];
        const rightEye = landmarks[263];
        const chin = landmarks[152];
        const leftCheek = landmarks[234];
        const rightCheek = landmarks[454];

        // Calculate Yaw (Left/Right Turn)
        // Compare cheek depths and nose x position relative to eyes
        const faceCenterX = (leftEye.x + rightEye.x) / 2;
        const noseOffsetX = nose.x - faceCenterX;
        let rawRotY = noseOffsetX * -Math.PI * 1.5;

        // Calculate Pitch (Up/Down Tilt)
        // Compare nose to chin/eyes vertical distance
        const eyeNoseDist = nose.y - ((leftEye.y + rightEye.y) / 2);
        const noseChinDist = chin.y - nose.y;
        const pitchRatio = eyeNoseDist / (eyeNoseDist + noseChinDist);
        let rawRotX = (pitchRatio - 0.45) * Math.PI * 2.0;

        // Calculate Roll (Side to Side Tilt)
        const dx = rightEye.x - leftEye.x;
        const dy = rightEye.y - leftEye.y;
        let rawRotZ = -Math.atan2(dy, dx);

        // Head Tracking (Position)
        const eyeDistance = Math.sqrt(dx * dx + dy * dy);
        // Normalize coordinates to -1 to 1 space for target positions, invert X
        let rawPosX = (nose.x - 0.5) * -4.0;
        let rawPosY = (nose.y - 0.5) * -4.0;

        // Use eye distance for Z index (closer = eyes further apart)
        // Base distance approx 0.12, typical range 0.08 to 0.2
        const baseEyeDist = 0.12;
        let rawPosZ = (baseEyeDist - eyeDistance) * 10.0;

        if (isCalibratingThisFrame) {
            // Absorb current target rotation back into manual input so the model doesn't visually snap
            inputRotX = headTargetRotX;
            inputRotY = headTargetRotY;

            headCalibration = { rX: rawRotX, rY: rawRotY, rZ: rawRotZ, pX: rawPosX, pY: rawPosY, pZ: rawPosZ };
            isCalibratingThisFrame = false;
            saveSettings();
        }

        headTargetRotX = rawRotX - headCalibration.rX;
        headTargetRotY = rawRotY - headCalibration.rY;
        headTargetRotZ = rawRotZ - headCalibration.rZ;
        headTargetPosX = rawPosX - headCalibration.pX;
        headTargetPosY = rawPosY - headCalibration.pY;
        headTargetPosZ = rawPosZ - headCalibration.pZ;


        const eyeMidpoint = {
            x: (leftEye.x + rightEye.x) / 2,
            y: (leftEye.y + rightEye.y) / 2,
        };

        eyeTargetX = (eyeMidpoint.y - 0.5) * 2 * EYE_LOOK_DOWN_OFFSET;
        eyeTargetY = (eyeMidpoint.x - 0.5) * 2 * EYE_LOOK_RIGHT_OFFSET;
    } else {
        // Return to center if tracking lost
        headTargetRotX = 0;
        headTargetRotY = 0;
        headTargetRotZ = 0;
        headTargetPosX = 0;
        headTargetPosY = 0;
        headTargetPosZ = 0;
    }

    // Smooth Eye Movement
    eyeCurrentX += (eyeTargetX - eyeCurrentX) * EYE_SMOOTHING;
    eyeCurrentY += (eyeTargetY - eyeCurrentY) * EYE_SMOOTHING;

    if (eyeLeft) {
        eyeLeft.rotation.x = eyeCurrentX;
        eyeLeft.rotation.y = eyeCurrentY;
    }
    if (eyeRight) {
        eyeRight.rotation.x = eyeCurrentX;
        eyeRight.rotation.y = eyeCurrentY;
    }


    // ========== GAMEPAD INPUT HANDLING ==========
    if (InputManager.getSource('controller') && gamepadController && gamepadController.getConnectedControllers().length > 0) {
        const gamepadHeadRot = gamepadController.getHeadRotation();

        // Head rotation from left stick + d-pad
        inputRotY += gamepadHeadRot.x * ROTATION_SPEED * 1.5;
        inputRotX += gamepadHeadRot.y * ROTATION_SPEED * 1.5;

        // Camera orbit from right stick (when not in eye mode)
        const camRot = gamepadController.getCameraRotation();
        if (Math.abs(camRot.x) > 0 || Math.abs(camRot.y) > 0) {
            camera.rotateY(-camRot.x * CAMERA_ROTATE_SPEED);
            camera.rotateX(-camRot.y * CAMERA_ROTATE_SPEED);
        }

        // Eye movement from right stick (when L2 held)
        const eyeMove = gamepadController.getEyeMovement();
        if (Math.abs(eyeMove.x) > 0 || Math.abs(eyeMove.y) > 0) {
            eyeTargetX += eyeMove.y * EYE_LOOK_DOWN_OFFSET * 0.15;
            eyeTargetY += eyeMove.x * EYE_LOOK_RIGHT_OFFSET * 0.15;
            eyeTargetX = Math.max(-0.4, Math.min(0.4, eyeTargetX));
            eyeTargetY = Math.max(-0.4, Math.min(0.4, eyeTargetY));
        }

        // Jaw: digital (✕) or analog (R2)
        const jawAnalog = gamepadController.getJawAnalog();
        if (gamepadController.isSpacePressed() || jawAnalog > 0.05) {
            isSpacebarPressed = true;
            spacebarMouthOpen = Math.max(spacebarMouthOpen, jawAnalog);
        } else {
            isSpacebarPressed = false;
        }

        // Sunglasses (□)
        if (gamepadController.isSunglassesToggled()) {
            isShadesOff = !isShadesOff;
            shadesTargetY = isShadesOff ? SHADES_TOGGLE_Y : 0.0;
            gamepadController.clearSunglassesToggle();
        }

        // Render mode cycle (▲)
        if (gamepadController.isRenderCycled()) {
            const modes = ['WF', 'FLAT', 'CYBER', 'OPAQUE'];
            const nextIdx = (modes.indexOf(renderMode) + 1) % modes.length;
            renderMode = modes[nextIdx];
            updateMaterialMode();
            gamepadController.clearRenderCycleToggle();
        }

        // Calibrate (○)
        if (gamepadController.isCalibrating()) {
            isCalibratingThisFrame = true;
            gamepadController.clearCalibrateToggle();
        }
    }

    // ========== KEYBOARD INPUT HANDLING ==========
    if (InputManager.getSource('keyboard')) {
        if (keys.ArrowUp) inputRotX -= ROTATION_SPEED;
        if (keys.ArrowDown) inputRotX += ROTATION_SPEED;
        if (keys.ArrowLeft) inputRotY -= ROTATION_SPEED;
        if (keys.ArrowRight) inputRotY += ROTATION_SPEED;
    }

    // Smooth Head Tracking and apply with manual bounds
    headCurrentRotX += (headTargetRotX - headCurrentRotX) * HEAD_SMOOTHING;
    headCurrentRotY += (headTargetRotY - headCurrentRotY) * HEAD_SMOOTHING;
    headCurrentRotZ += (headTargetRotZ - headCurrentRotZ) * HEAD_SMOOTHING;

    headCurrentPosX += (headTargetPosX - headCurrentPosX) * HEAD_SMOOTHING;
    headCurrentPosY += (headTargetPosY - headCurrentPosY) * HEAD_SMOOTHING;
    headCurrentPosZ += (headTargetPosZ - headCurrentPosZ) * HEAD_SMOOTHING;

    if (objectGroup) {
        // Combine smoothed tracked face rotation and interpolated manual rotation
        objectGroup.rotation.x = inputRotX + headCurrentRotX;
        objectGroup.rotation.y = inputRotY + headCurrentRotY;
        objectGroup.rotation.z = headCurrentRotZ;

        // Apply positional tracking
        objectGroup.position.set(headCurrentPosX, headCurrentPosY, headCurrentPosZ);
    }

    if (camera) {
        if (isShiftPressed) {
            if (keys.KeyW) camera.translateY(CAMERA_MOVE_SPEED);
            if (keys.KeyS) camera.translateY(-CAMERA_MOVE_SPEED);
            if (keys.KeyA) camera.translateX(-CAMERA_MOVE_SPEED);
            if (keys.KeyD) camera.translateX(CAMERA_MOVE_SPEED);
        } else {
            if (keys.KeyW) camera.translateZ(CAMERA_MOVE_SPEED);
            if (keys.KeyS) camera.translateZ(-CAMERA_MOVE_SPEED);
            if (keys.KeyA) camera.rotateY(CAMERA_ROTATE_SPEED);
            if (keys.KeyD) camera.rotateY(-CAMERA_ROTATE_SPEED);
        }
        // Apply mouse drag rotation (right-click drag)
        if (isDraggingCamera) {
            camera.rotation.order = 'YXZ';
            camera.rotation.y += cameraRotationY;
            camera.rotation.x += cameraRotationX;
            cameraRotationX = 0;
            cameraRotationY = 0;
        }
    }
    if (isAudioInitialized && analyser) {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        const length = AUDIO_FREQUENCY_END - AUDIO_FREQUENCY_START;
        for (let i = AUDIO_FREQUENCY_START; i < AUDIO_FREQUENCY_END; i++) {
            sum += dataArray[i];
        }
        audioVolume = sum / length;
    } else {
        audioVolume = 0;
    }
    updateVisualizer(audioVolume);

    // 6. Sunglasses Animation
    if (shadesMesh) {
        // Current shades position is relative to the object's original mesh position
        // We use a simple lerp for the "drop" effect
        // If shadesTargetY is 0, it returns to original position
        const lerpSpeed = isShadesOff ? SHADES_LERP_UP_SPEED : SHADES_LERP_DOWN_SPEED;
        shadesCurrentY += (shadesTargetY - shadesCurrentY) * lerpSpeed;
        shadesMesh.position.y = shadesCurrentY;
    }

    // Performance Monitor
    if (showFPS) {
        frameCount++;
        updateFPS();
    }

    // Audio Visual Feedback
    createAudioVisualFeedback();

    if (scene && camera && renderer) {
        renderer.render(scene, camera);
    }
}

// ── InputManager source UI sync helper ──
function _syncSourceUI(el, source, enabled) {
    const led = el.querySelector('.source-led');
    el.classList.toggle('off', !enabled);
    if (led) led.classList.toggle('active', enabled);
}

// Load settings and initialize
loadSettings();
importStateFromURL();
init();
