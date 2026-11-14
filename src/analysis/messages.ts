import type { Analysis } from "../scoring/types";

// Messages between the page and the photo worker.

export type PhotoRequest = {
  id: number;
  file: File;
  // Absolute URL of the directory holding wasm/ and models/. The worker
  // cannot derive it: its own script lives under assets/, and the app may be
  // served from any sub-path.
  mediapipeBaseUrl: string;
};

export type PhotoResult =
  | {
      id: number;
      ok: true;
      thumbnail: Blob;
      width: number;
      height: number;
      analysis: Analysis;
    }
  | {
      id: number;
      ok: false;
      // decode-failed: the file is not a readable image.
      // analysis-failed: the face model could not be loaded or run.
      reason: "decode-failed" | "analysis-failed";
      detail: string;
    };
