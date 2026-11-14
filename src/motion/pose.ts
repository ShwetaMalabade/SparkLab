// src/motion/pose.ts: MediaPipe Pose Landmarker (lite), on-device only (docs/plan/04 §2).
// Camera frames never leave the browser. Model + WASM are served from /public, so this works with Wi-Fi off.
import type { PoseLandmarker } from "@mediapipe/tasks-vision";

/** One landmark as MediaPipe returns it: x, y in [0, 1] of the frame (y grows downward). */
export type RawLandmark = { x: number; y: number; z: number; visibility: number };

export async function createPose(): Promise<{ landmarker: PoseLandmarker; delegate: "GPU" | "CPU" }> {
  // Imported lazily so the module never runs during server rendering.
  const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
  const vision = await FilesetResolver.forVisionTasks("/mediapipe-wasm");
  const opts = (delegate: "GPU" | "CPU") => ({
    baseOptions: { modelAssetPath: "/models/pose_landmarker_lite.task", delegate },
    runningMode: "VIDEO" as const,
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  try {
    return { landmarker: await PoseLandmarker.createFromOptions(vision, opts("GPU")), delegate: "GPU" };
  } catch {
    // Some laptops fail GPU init.
    return { landmarker: await PoseLandmarker.createFromOptions(vision, opts("CPU")), delegate: "CPU" };
  }
}

/** Runs detection once per new video frame. Returns a stop function. */
export function startLoop(
  video: HTMLVideoElement,
  lm: PoseLandmarker,
  onFrame: (pts: RawLandmark[] | null, t: number) => void,
): () => void {
  let last = -1;
  let running = true;
  let raf = 0;
  const tick = () => {
    if (!running) return;
    if (video.readyState >= 2 && video.currentTime !== last) {
      last = video.currentTime;
      const t = performance.now();
      let pts: RawLandmark[] | null = null;
      try {
        pts = (lm.detectForVideo(video, t).landmarks?.[0] as RawLandmark[] | undefined) ?? null;
      } catch {
        pts = null; // a bad frame must never kill the loop
      }
      onFrame(pts, t);
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => {
    running = false;
    cancelAnimationFrame(raf);
  };
}

let posePromise: ReturnType<typeof createPose> | null = null;
/**
 * One landmarker per page load, shared by every mount. React dev mode mounts effects twice, and two
 * concurrent MediaPipe WASM loads can hang; reusing one instance also makes page-to-page navigation instant.
 */
export function getPose(): ReturnType<typeof createPose> {
  posePromise ??= createPose().catch((e) => {
    posePromise = null; // allow a retry
    throw e;
  });
  return posePromise;
}

/** Asks for the webcam at 640×480 (does not attach it anywhere yet). */
export function openCamera(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" }, audio: false });
}

/** Plays a stream in a <video>. The video gets the UN-mirrored stream (mirroring is CSS only). Returns a stop function. */
export async function attachCamera(video: HTMLVideoElement, stream: MediaStream): Promise<() => void> {
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play();
  return () => {
    stream.getTracks().forEach((tr) => tr.stop());
    if (video.srcObject === stream) video.srcObject = null;
  };
}

/** Opens the webcam at 640×480 and plays it in `video`. */
export async function startCamera(video: HTMLVideoElement): Promise<() => void> {
  const stream = await openCamera();
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play();
  return () => {
    stream.getTracks().forEach((tr) => tr.stop());
    video.srcObject = null;
  };
}

/** Bones drawn by debug views: shoulders, arms, plus nose→shoulder-mid handled by the caller. */
export const UPPER_BONES: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24],
];
