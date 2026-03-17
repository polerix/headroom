import { startFaceTracking } from './face-tracker.js';

let isAudioInitialized = false;
export let audioVolume = 0;
export let isSpacebarPressed = false;
let audioContext, analyser, microphone, audioStream;
let dataArray;
let audioFeedbackEnabled = true;

const AUDIO_FFT_SIZE = 256;
const AUDIO_SMOOTHING = 0.5;

export async function initAudio() {
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
    }
}

export function updateAudioVolume(sensitivity = 60.0, threshold = 10) {
    if (!isAudioInitialized) {
        audioVolume = isSpacebarPressed ? 100 : 0;
        return audioVolume;
    }

    analyser.getByteFrequencyData(dataArray);

    let sum = 0;
    const startBin = 2; // ~150Hz
    const endBin = 30; // ~2.5kHz

    for (let i = startBin; i < endBin; i++) {
        const val = dataArray[i];
        if (val > threshold) {
            sum += (val - threshold);
        }
    }

    const average = sum / (endBin - startBin);

    if (isSpacebarPressed) {
        audioVolume = 100;
    } else {
        const rawVol = (average / 255) * 100 * (sensitivity / 50.0);
        audioVolume = Math.min(rawVol, 100);
    }
    return audioVolume;
}

export function cleanupAudio() {
    if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
    }
    if (audioContext && audioContext.state !== 'closed') {
        audioContext.close();
    }
}

// Simple key listener for spacebar debugging
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') isSpacebarPressed = true;
});
document.addEventListener('keyup', (e) => {
    if (e.code === 'Space') isSpacebarPressed = false;
});
