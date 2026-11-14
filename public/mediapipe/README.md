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

## wasm/ (not in git)

- What: the WebAssembly runtime of `@mediapipe/tasks-vision`
  (`vision_wasm_module_internal.js` / `.wasm`).
- Copied from `node_modules/@mediapipe/tasks-vision/wasm/` by
  `scripts/copy-mediapipe-wasm.mjs` on `npm install`, so it always matches the
  installed package version.
- License: Apache License 2.0 (The MediaPipe Authors).
