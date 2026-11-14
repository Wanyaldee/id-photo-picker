import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { isSameOriginUrl } from "../src/analysis/networkGuard";

const root = join(import.meta.dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

// docs/adr/0006-no-telemetry.md: @mediapipe/tasks-vision >= 1.0.0 posts usage
// metrics to Google. These tests fail if such a version is installed again.

test("the MediaPipe dependency is pinned to an exact version", () => {
  const version = JSON.parse(read("package.json")).dependencies["@mediapipe/tasks-vision"];
  expect(version).toMatch(/^\d+\.\d+\.\d+$/);
});

test("the installed MediaPipe bundle contains no http(s) endpoint", () => {
  const bundle = read("node_modules/@mediapipe/tasks-vision/vision_bundle.mjs");
  expect(bundle.match(/https?:\/\/[a-z0-9.-]+\.[a-z]{2,}[^\s"'`]*/gi) ?? []).toEqual([]);
});

test("both workers install the network guard before anything else", () => {
  for (const path of ["src/analysis/photoWorker.ts", "src/background/backgroundWorker.ts"]) {
    const firstImport = read(path)
      .split("\n")
      .find((line) => line.startsWith("import "));
    expect(firstImport, path).toMatch(/networkGuard";$/);
  }
});

test("every worker file is covered by the guard test above", () => {
  const workers = ["src/analysis", "src/background"].flatMap((dir) =>
    readdirSync(join(root, dir))
      .filter((name) => name.endsWith("Worker.ts"))
      .map((name) => `${dir}/${name}`),
  );
  expect(workers.sort()).toEqual([
    "src/analysis/photoWorker.ts",
    "src/background/backgroundWorker.ts",
  ]);
});

test("the guard allows the app's own origin and in-memory URLs only", () => {
  const base = "https://user.github.io/id-photo-picker/assets/worker.js";
  const origin = "https://user.github.io";
  const allowed = (url: string) => isSameOriginUrl(url, base, origin);
  expect(allowed("https://user.github.io/id-photo-picker/mediapipe/models/x.task")).toBe(true);
  expect(allowed("../mediapipe/wasm/vision_wasm_module_internal.wasm")).toBe(true);
  expect(allowed("blob:https://user.github.io/1234")).toBe(true);
  expect(allowed("data:image/png;base64,AAAA")).toBe(true);

  expect(allowed("https://odml.pa.googleapis.com/v1/log")).toBe(false);
  expect(allowed("http://user.github.io/x")).toBe(false); // other scheme = other origin
  expect(allowed("https://user.github.io.evil.example/x")).toBe(false);
  expect(allowed("//cdn.example.com/lib.js")).toBe(false);
  expect(allowed("https://user.github.io:8443/x")).toBe(false);
});
