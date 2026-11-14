/// <reference lib="webworker" />
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import type { Classifications, NormalizedLandmark } from "@mediapipe/tasks-vision";
import { FACE_INNER_MARGIN_X, FACE_INNER_MARGIN_Y, FACE_SAMPLE_WIDTH_PX } from "../scoring/config";
import { exposureStats, innerRegion, laplacianVariance, lumaFromRgba } from "../scoring/pixels";
import { headPoseFromMatrix } from "../scoring/pose";
import type { Analysis, Rect } from "../scoring/types";
import { DETECTION_LONG_EDGE_PX, MAX_FACES } from "./config";

// Face-mesh landmark indices (MediaPipe canonical face model).
const FOREHEAD_TOP = 10;
const CHIN = 152;
const CHEEK_EDGE_A = 234;
const CHEEK_EDGE_B = 454;

let landmarkerPromise: Promise<FaceLandmarker> | null = null;

// One landmarker per worker, created on first use. If loading fails the
// rejected promise is kept, so every photo reports the same clear error
// instead of retrying a download that will not succeed.
function getLandmarker(baseUrl: string): Promise<FaceLandmarker> {
  landmarkerPromise ??= (async () => {
    const fileset = await FilesetResolver.forVisionTasks(`${baseUrl}wasm`, true);
    return FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: `${baseUrl}models/face_landmarker.task`,
        // CPU: identical results on every machine, and no dependence on
        // WebGL being available inside a worker.
        delegate: "CPU",
      },
      runningMode: "IMAGE",
      numFaces: MAX_FACES,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
    });
  })();
  return landmarkerPromise;
}

function context2d(canvas: OffscreenCanvas): OffscreenCanvasRenderingContext2D {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("OffscreenCanvas 2D context is unavailable");
  return context;
}

function scaledCopy(bitmap: ImageBitmap, longEdge: number): OffscreenCanvas {
  const scale = Math.min(1, longEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = new OffscreenCanvas(
    Math.max(1, Math.round(bitmap.width * scale)),
    Math.max(1, Math.round(bitmap.height * scale)),
  );
  context2d(canvas).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
}

// Bounding box of the landmarks in image pixels, clipped to the image.
function faceBox(landmarks: NormalizedLandmark[], width: number, height: number): Rect {
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const point of landmarks) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  const x = Math.max(0, minX) * width;
  const y = Math.max(0, minY) * height;
  return {
    x,
    y,
    width: Math.max(1, Math.min(1, maxX) * width - x),
    height: Math.max(1, Math.min(1, maxY) * height - y),
  };
}

// Sharpness and exposure are measured on the face cut from the full-size
// photo and resampled to a fixed width (see FACE_SAMPLE_WIDTH_PX).
function facePixelStats(bitmap: ImageBitmap, box: Rect) {
  const width = FACE_SAMPLE_WIDTH_PX;
  const height = Math.max(3, Math.round((width * box.height) / box.width));
  const canvas = new OffscreenCanvas(width, height);
  const context = context2d(canvas);
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, box.x, box.y, box.width, box.height, 0, 0, width, height);
  const luma = lumaFromRgba(context.getImageData(0, 0, width, height).data, width * height);
  // Sharpness uses the whole face box (eyes, brows and hairline carry the
  // edges); exposure uses only the inner, mostly-skin part.
  const inner = innerRegion(luma, width, height, FACE_INNER_MARGIN_X, FACE_INNER_MARGIN_Y);
  return {
    sharpness: laplacianVariance(luma, width, height),
    ...exposureStats(inner.luma, inner.width, inner.height),
  };
}

function blendshape(classifications: Classifications | undefined, name: string): number {
  return classifications?.categories.find((c) => c.categoryName === name)?.score ?? 0;
}

export async function analyzeFace(bitmap: ImageBitmap, baseUrl: string): Promise<Analysis> {
  const landmarker = await getLandmarker(baseUrl);
  const result = landmarker.detect(scaledCopy(bitmap, DETECTION_LONG_EDGE_PX));
  const faceCount = result.faceLandmarks.length;
  const landmarks = result.faceLandmarks[0];
  if (faceCount !== 1 || !landmarks) return { faceCount, face: null };

  const y = (index: number) => (landmarks[index]?.y ?? 0) * bitmap.height;
  const x = (index: number) => (landmarks[index]?.x ?? 0) * bitmap.width;
  const shapes = result.faceBlendshapes[0];
  const matrix = result.facialTransformationMatrixes[0];

  return {
    faceCount,
    face: {
      foreheadTopY: y(FOREHEAD_TOP),
      chinY: y(CHIN),
      centerX: (x(CHEEK_EDGE_A) + x(CHEEK_EDGE_B)) / 2,
      eyeBlink: Math.max(blendshape(shapes, "eyeBlinkLeft"), blendshape(shapes, "eyeBlinkRight")),
      jawOpen: blendshape(shapes, "jawOpen"),
      smile: (blendshape(shapes, "mouthSmileLeft") + blendshape(shapes, "mouthSmileRight")) / 2,
      ...headPoseFromMatrix(matrix?.data ?? []),
      ...facePixelStats(bitmap, faceBox(landmarks, bitmap.width, bitmap.height)),
    },
  };
}
