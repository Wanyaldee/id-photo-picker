import { PERSON_CONFIDENCE_HIGH, PERSON_CONFIDENCE_LOW, SEGMENTER_MODEL_FILE } from "./config";
import { cleanPersonMask, personAlphaMask } from "./mask";
import type { SegmentRequest, SegmentResult } from "./messages";

type Waiting = { resolve: (result: SegmentResult) => void };

let worker: Worker | null = null;
let nextId = 1;
const waiting = new Map<number, Waiting>();

// One long-lived worker, started on first use. If it crashes, every request
// in flight fails with the crash message and the next request starts a fresh
// worker.
function getWorker(): Worker {
  if (worker) return worker;
  const created = new Worker(new URL("./backgroundWorker.ts", import.meta.url), {
    type: "module",
  });
  created.onmessage = (event: MessageEvent<SegmentResult>) => {
    waiting.get(event.data.id)?.resolve(event.data);
    waiting.delete(event.data.id);
  };
  created.onerror = (event) => {
    for (const [id, entry] of waiting) entry.resolve({ id, ok: false, detail: event.message });
    waiting.clear();
    created.terminate();
    worker = null;
  };
  worker = created;
  return created;
}

function segmentPerson(bitmap: ImageBitmap): Promise<SegmentResult> {
  return new Promise((resolve) => {
    const id = nextId++;
    waiting.set(id, { resolve });
    const request: SegmentRequest = {
      id,
      bitmap,
      mediapipeBaseUrl: new URL("mediapipe/", document.baseURI).href,
      modelFile: SEGMENTER_MODEL_FILE,
    };
    getWorker().postMessage(request, [bitmap]);
  });
}

function newCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context is unavailable");
  return [canvas, context];
}

// Returns a new canvas showing the person from `source` on a plain `color`
// background. `source` is not modified, so the caller can still use the
// original if this rejects.
//
// Only the background is replaced: person pixels are copied unchanged (no
// smoothing, recolouring or reshaping of the face).
export async function replaceBackground(
  source: HTMLCanvasElement,
  color: string,
): Promise<HTMLCanvasElement> {
  const result = await segmentPerson(await createImageBitmap(source));
  if (!result.ok) throw new Error(result.detail);

  // The mask is small (model resolution); drawing it scaled lets the canvas
  // interpolate it smoothly up to the photo's size.
  const [maskCanvas, maskContext] = newCanvas(result.width, result.height);
  const cleaned = cleanPersonMask(
    result.confidence,
    result.width,
    result.height,
    PERSON_CONFIDENCE_LOW,
    PERSON_CONFIDENCE_HIGH,
  );
  const alpha = personAlphaMask(cleaned, PERSON_CONFIDENCE_LOW, PERSON_CONFIDENCE_HIGH);
  maskContext.putImageData(new ImageData(alpha, result.width, result.height), 0, 0);

  const [person, personContext] = newCanvas(source.width, source.height);
  personContext.drawImage(source, 0, 0);
  // Keep the photo only where the mask is opaque.
  personContext.globalCompositeOperation = "destination-in";
  personContext.imageSmoothingQuality = "high";
  personContext.drawImage(maskCanvas, 0, 0, source.width, source.height);

  const [output, outputContext] = newCanvas(source.width, source.height);
  outputContext.fillStyle = color;
  outputContext.fillRect(0, 0, source.width, source.height);
  outputContext.drawImage(person, 0, 0);
  return output;
}
