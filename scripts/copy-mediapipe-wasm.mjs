// Copies MediaPipe's WASM runtime from node_modules into public/, so the app
// serves it from its own origin instead of a CDN (CLAUDE.md §2, §5).
// Runs on `npm install` (postinstall). The copy is git-ignored: it always
// matches the installed @mediapipe/tasks-vision version.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules/@mediapipe/tasks-vision/wasm");
const to = join(root, "public/mediapipe/wasm");

// Only the ES-module variant is needed: the analysis runs in module workers.
const files = ["vision_wasm_module_internal.js", "vision_wasm_module_internal.wasm"];

mkdirSync(to, { recursive: true });
for (const file of files) {
  copyFileSync(join(from, file), join(to, file));
}
console.log(`Copied MediaPipe WASM runtime to ${to}`);
