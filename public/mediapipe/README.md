# Third-party files served by the app

Everything here is loaded from the app's own origin; nothing is fetched from a
CDN at run time.

## models/face_landmarker.task

- What: MediaPipe Face Landmarker model bundle (face detector, face mesh,
  blendshapes), float16, version 1.
- Source: <https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task>
- Documentation: <https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker>
- License: Apache License 2.0 (Google LLC). Full text: <https://www.apache.org/licenses/LICENSE-2.0>
- SHA-256: `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff`
- Downloaded: 2026-11-14. Unmodified.

## models/selfie_multiclass_256x256.tflite

- What: MediaPipe multi-class selfie segmentation model (background, hair,
  body skin, face skin, clothes, others), 256 x 256 input, float32. Used only
  to separate the person from the background; loaded only when the user picks
  a background colour.
- Source: <https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite>
- Documentation: <https://ai.google.dev/edge/mediapipe/solutions/vision/image_segmenter>
- License: Apache License 2.0 (Google LLC).
- SHA-256: `c6748b1253a99067ef71f7e26ca71096cd449baefa8f101900ea23016507e0e0`
- Downloaded: 2026-11-14. Unmodified.

## wasm/ (not in git)

- What: the WebAssembly runtime of `@mediapipe/tasks-vision`
  (`vision_wasm_module_internal.js` / `.wasm`).
- Copied from `node_modules/@mediapipe/tasks-vision/wasm/` by
  `scripts/copy-mediapipe-wasm.mjs` on `npm install`, so it always matches the
  installed package version.
- License: Apache License 2.0 (The MediaPipe Authors).
