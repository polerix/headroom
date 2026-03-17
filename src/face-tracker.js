import {
    FaceLandmarker,
    FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.mjs";

let faceLandmarker;
let runningMode = "VIDEO";
let webcamRunning = false;
let lastVideoTime = -1;
export let latestFaceLandmarks = null;
export let latestFaceBlendshapes = null;

const createFaceLandmarker = async () => {
    const filesetResolver = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm"
    );
    faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: "GPU"
        },
        outputFaceBlendshapes: true,
        runningMode,
        numFaces: 1
    });
    console.log("Face Landmarker created");
};

createFaceLandmarker();

export const startFaceTracking = async (videoElement) => {
    if (webcamRunning) {
        console.log("Webcam is already running. Not starting again.");
        return;
    }

    const constraints = {
        video: true
    };

    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        videoElement.srcObject = stream;
        videoElement.addEventListener("loadeddata", predictWebcam);
        webcamRunning = true;
        console.log("Webcam access granted and tracking started");
    } catch (err) {
        console.error("Error accessing webcam: ", err);
    }
};

async function predictWebcam() {
    if (!faceLandmarker) {
        console.log("Face Landmarker not created yet. Retrying...");
        setTimeout(predictWebcam, 500);
        return;
    }

    const videoElement = document.getElementById("webcam-video");

    if (runningMode === "VIDEO") {
        if (videoElement.currentTime !== lastVideoTime) {
            lastVideoTime = videoElement.currentTime;
            const results = faceLandmarker.detectForVideo(videoElement, performance.now());
            if (results.faceLandmarks) {
                latestFaceLandmarks = results.faceLandmarks;
            }
            if (results.faceBlendshapes) {
                latestFaceBlendshapes = results.faceBlendshapes;
            }
        }
    }

    // Call this function again to keep predicting when the browser is ready
    if (webcamRunning) {
        window.requestAnimationFrame(predictWebcam);
    }
}
