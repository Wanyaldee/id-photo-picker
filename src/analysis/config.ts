// Tuning values for loading and analysing photos.

// Two workers: decoding a 12 MP photo holds ~48 MB of RGBA per worker, and
// each worker will also hold its own MediaPipe model (milestone 3). Two keeps
// peak memory bounded on a laptop while still using a second core.
export const WORKER_COUNT = 2;

// Grid cards are ~160 CSS px wide; 320 px covers 2x displays. Only this
// thumbnail is kept per photo — originals are re-decoded on demand so that a
// few hundred photos do not stay decoded in memory.
export const THUMBNAIL_LONG_EDGE_PX = 320;
export const THUMBNAIL_JPEG_QUALITY = 0.8;

// Face detection runs on a copy scaled to this long edge. Landmarks come back
// in normalised coordinates, so the result is the same as on the full image
// for any face large enough to be an ID photo, at a fraction of the cost.
export const DETECTION_LONG_EDGE_PX = 1024;

// Ask for more than one face so that group photos can be recognised and
// excluded; the exact number beyond two does not matter.
export const MAX_FACES = 4;
