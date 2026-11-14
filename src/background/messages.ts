// Messages between the page and the background (segmentation) worker.

export type SegmentRequest = {
  id: number;
  // The cropped photo. Transferred, so the page no longer owns it.
  bitmap: ImageBitmap;
  mediapipeBaseUrl: string;
  modelFile: string;
};

export type SegmentResult =
  | {
      id: number;
      ok: true;
      // Person confidence per pixel (0..1), row by row, at the model's own
      // resolution (256 x 256 for the bundled model).
      confidence: Float32Array;
      width: number;
      height: number;
    }
  | { id: number; ok: false; detail: string };
