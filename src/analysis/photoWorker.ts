/// <reference lib="webworker" />
import type { Analysis } from "../scoring/types";
import { THUMBNAIL_JPEG_QUALITY, THUMBNAIL_LONG_EDGE_PX } from "./config";
import { analyzeFace } from "./faceAnalyzer";
import type { PhotoRequest, PhotoResult } from "./messages";

async function makeThumbnail(bitmap: ImageBitmap): Promise<Blob> {
  const scale = Math.min(1, THUMBNAIL_LONG_EDGE_PX / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("OffscreenCanvas 2D context is unavailable");
  context.drawImage(bitmap, 0, 0, width, height);
  return canvas.convertToBlob({ type: "image/jpeg", quality: THUMBNAIL_JPEG_QUALITY });
}

// Decodes one photo off the main thread, analyses the face and returns a
// small thumbnail. The full-size bitmap is closed before replying, so the
// worker holds at most one decoded photo at a time.
async function process(request: PhotoRequest): Promise<PhotoResult> {
  const { id } = request;
  let bitmap: ImageBitmap;
  try {
    // Default imageOrientation ("from-image") applies EXIF rotation, so
    // portrait phone photos come out upright.
    bitmap = await createImageBitmap(request.file);
  } catch (error) {
    return { id, ok: false, reason: "decode-failed", detail: String(error) };
  }
  try {
    let analysis: Analysis;
    try {
      analysis = await analyzeFace(bitmap, request.mediapipeBaseUrl);
    } catch (error) {
      return { id, ok: false, reason: "analysis-failed", detail: String(error) };
    }
    const thumbnail = await makeThumbnail(bitmap);
    return { id, ok: true, thumbnail, width: bitmap.width, height: bitmap.height, analysis };
  } catch (error) {
    return { id, ok: false, reason: "decode-failed", detail: String(error) };
  } finally {
    bitmap.close();
  }
}

self.onmessage = (event: MessageEvent<PhotoRequest>) => {
  void process(event.data).then((result) => self.postMessage(result));
};
