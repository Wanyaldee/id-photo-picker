/// <reference lib="webworker" />
import { FilesetResolver, ImageSegmenter } from "@mediapipe/tasks-vision";
import { BACKGROUND_MASK_INDEX } from "./config";
import type { SegmentRequest, SegmentResult } from "./messages";

let segmenterPromise: Promise<ImageSegmenter> | null = null;

// Created on the first request, so users who never change the background
// never download or compile the segmentation model. A failed load is
// forgotten, so choosing a background again retries it.
function getSegmenter(baseUrl: string, modelFile: string): Promise<ImageSegmenter> {
  segmenterPromise ??= (async () => {
    const fileset = await FilesetResolver.forVisionTasks(`${baseUrl}wasm`, true);
    return ImageSegmenter.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: `${baseUrl}models/${modelFile}`, delegate: "CPU" },
      runningMode: "IMAGE",
      outputConfidenceMasks: true,
      outputCategoryMask: false,
    });
  })().catch((error: unknown) => {
    segmenterPromise = null;
    throw error;
  });
  return segmenterPromise;
}

async function segment(request: SegmentRequest): Promise<SegmentResult> {
  const { id, bitmap } = request;
  try {
    const segmenter = await getSegmenter(request.mediapipeBaseUrl, request.modelFile);
    const result = segmenter.segment(bitmap);
    try {
      const background = result.confidenceMasks?.[BACKGROUND_MASK_INDEX];
      if (!background) throw new Error("The segmenter returned no background mask");
      // The mask's buffer is only valid until close(); copy while inverting
      // "background" into "person".
      const confidence = background.getAsFloat32Array().map((value) => 1 - value);
      return { id, ok: true, confidence, width: background.width, height: background.height };
    } finally {
      result.close();
    }
  } catch (error) {
    return { id, ok: false, detail: String(error) };
  } finally {
    bitmap.close();
  }
}

self.onmessage = (event: MessageEvent<SegmentRequest>) => {
  void segment(event.data).then((result) => {
    if (result.ok) self.postMessage(result, [result.confidence.buffer]);
    else self.postMessage(result);
  });
};
