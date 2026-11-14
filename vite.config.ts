import preact from "@preact/preset-vite";
import type { Plugin } from "vite-plus";
import { defineConfig, lazyPlugins } from "vite-plus";

// Photos must never leave the device (CLAUDE.md §5). GitHub Pages cannot send
// response headers, so the policy ships as a <meta> tag in the built HTML.
// - connect-src 'self': fetch/XHR/WebSocket only to our own origin (wasm + model files).
// - 'wasm-unsafe-eval': MediaPipe compiles its WASM runtime; no JS eval is allowed.
// - blob:/data: on img/worker: photos are shown through object URLs created in the page.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self'",
  "img-src 'self' blob: data:",
  "worker-src 'self' blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join("; ");

// Build only: the dev server injects inline <style> tags and an HMR socket,
// which this policy would block.
function cspMetaTag(): Plugin {
  return {
    name: "csp-meta-tag",
    apply: "build",
    transformIndexHtml: () => [
      {
        tag: "meta",
        attrs: {
          "http-equiv": "Content-Security-Policy",
          content: CONTENT_SECURITY_POLICY,
        },
        injectTo: "head-prepend",
      },
    ],
  };
}

export default defineConfig({
  fmt: {},
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
  // Relative base: the same build works at https://<user>.github.io/<repo>/
  // and from any other sub-path without knowing the repo name.
  base: "./",
  plugins: lazyPlugins(() => [preact(), cspMetaTag()]),
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
