# 0006: No telemetry — pin MediaPipe, guard worker network access

Date: 2026-11-14

Status: Accepted — the pin was made by the AI agent without asking first and
approved by the project owner on 2026-11-15.

## Context

CLAUDE.md §1 and §5 rule out analytics and any network transmission, and the
README promises "photos never leave this device" and that this can be checked
in the Network tab.

While listing external URLs in the build for milestone 6, this appeared in
the worker bundles:

```
2 https://odml.pa.googleapis.com/v1/log
```

`@mediapipe/tasks-vision` 1.2.3 (the version installed for milestone 3)
creates a logger for every task and POSTs to that URL with `fetch` every 60
seconds and on `close()`. Its README has a "Privacy Notice" (last modified
June 5, 2026): input data is not sent, but "MediaPipe Tasks APIs send metrics
about the performance and utilization of the APIs in your app to Google", and
the app author must obtain user consent. There is no option to turn it off.

The earlier browser runs did not see the request because each finished in
under 60 seconds. The `<meta>` CSP of the page cannot be relied on here:
dedicated workers loaded from a network URL take their policy from the worker
script's own response headers, which GitHub Pages does not let us set.

Versions checked by unpacking the npm tarballs:

| Version | Published  | Logging endpoint | Module-worker WASM |
| ------- | ---------- | ---------------- | ------------------ |
| 0.10.21 | 2025-02-06 | no               | no                 |
| 0.10.35 | 2026-04-27 | no               | yes                |
| 1.0.1   | 2026-07-31 | yes              | yes                |
| 1.1.1   | 2026-10-14 | yes              | yes                |
| 1.2.3   | 2026-11-11 | yes              | yes                |

## Decision

1. Pin `@mediapipe/tasks-vision` to exactly `0.10.35`, the last release
   without the logger that still has the ES-module WASM loader.
2. `src/analysis/networkGuard.ts` is the first import of both workers. It
   wraps `fetch` to reject any URL outside the worker's own origin and
   removes `XMLHttpRequest`, `WebSocket`, `EventSource` and `WebTransport`
   from the worker scope.
3. `tests/privacy.test.ts` fails if the dependency is not an exact version,
   if the installed bundle contains any http(s) endpoint, or if a worker does
   not import the guard first.
4. The WASM runtime is now copied by a Vite plugin at `buildStart` instead of
   an npm `postinstall` script.

## Reason

```ts
export function isSameOriginUrl(url: string, baseUrl: string, origin: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url, baseUrl);
  } catch {
    return false;
  }
  if (parsed.protocol === "blob:" || parsed.protocol === "data:") return true;
  return parsed.origin === origin;
}

export function installNetworkGuard(): void {
  const originalFetch = self.fetch.bind(self);
  self.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    return allowed(url) ? originalFetch(input, init) : Promise.reject(blocked(url));
  };
  for (const name of ["XMLHttpRequest", "WebSocket", "EventSource", "WebTransport"] as const) {
    Reflect.deleteProperty(self, name);
  }
}

if (typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope) {
  installNetworkGuard();
}
```

- Pinning alone would hold only until someone runs `npm update`; the guard
  alone would leave a library that keeps trying to phone home. Each covers the
  other's failure, and the test makes a silent upgrade fail CI.
- The comparison is on `URL.origin` after resolving against the worker's own
  URL, not on a string prefix: `https://user.github.io.evil.example/` and
  `//cdn.example.com/x` must not pass (both are in the tests).
- An unparsable URL is refused rather than passed through.
- `blob:` and `data:` are allowed: they name in-memory data and cannot reach
  a server.
- `fetch` is wrapped rather than removed because MediaPipe loads the WASM
  binary and the model with it. The other four APIs are not used by the app
  or by MediaPipe 0.10.35 (the browser run below works without them), so they
  are removed instead of wrapped — nothing to get wrong.
- Installed as an import side effect and placed first: ES imports are
  evaluated in order, so the guard is in place before the MediaPipe module's
  code runs. The `WorkerGlobalScope` check keeps the module importable in the
  Node test run.
- Exact version (`0.10.35`, no `^`): a caret range would let `npm install`
  move to any later 0.10.x.
- The copy moved to `buildStart` because `npm install <package>` did not
  re-run the root `postinstall`: after the downgrade, `public/mediapipe/wasm`
  still held the 1.2.3 runtime.

## Alternatives rejected

- Stay on 1.2.3 and rely on the guard: the library would attempt a POST every
  minute and the app would depend on one wrapper being right.
- Stay on 1.2.3 and ask users for consent, as Google's notice requires:
  contradicts the project's reason for existing.
- Patch the logger out of the bundle (`patch-package`): a fragile edit of
  minified code on every update.
- Serve the workers from `blob:` URLs so they inherit the page's CSP: depends
  on inheritance rules that differ between browsers, and MediaPipe's
  `import()` of the WASM loader from a blob worker is one more thing to get
  wrong. The guard does not depend on browser policy.
- Another host that can send CSP headers for worker scripts: CLAUDE.md fixes
  GitHub Pages.

## Consequences

- MediaPipe stays on a release from April 2026; fixes in later versions are
  not available until Google offers an opt-out or the logger is otherwise
  removed. Upgrading means repeating the checks in this ADR.
- Any future worker must import the guard first; the test lists the worker
  files and fails when a new one appears without being added.
- Code running on the main thread is covered only by the page CSP.
- `@types/node` (MIT) was added as a dev dependency for the tests that read
  files.

## Verification

`vp check`:

```
pass: Formatting completed for checked files (1.9s)
pass: Found no warnings, lint errors, or type errors in 48 files (833ms, 12 threads)
```

`vp test run`:

```
 Test Files  12 passed (12)
      Tests  77 passed (77)
```

External URLs in the build after the change
(`grep -ohE "https?://…" dist/assets/*.js dist/index.html`): only the XML
namespace strings `http://www.w3.org/2000/svg`, `…/1999/xhtml`,
`…/1998/Math/MathML`. The WASM loader script contains documentation links in
error messages; the WASM binary contains `type.googleapis.com/…` protobuf
type names, which are identifiers, not endpoints.

Browser run against `vp build` + `vp preview`, headless Chromium: load two
photos, open one, choose a background (so the long-lived worker is running),
call `fetch` from inside the worker, then wait 75 seconds:

```
live workers: [ 'backgroundWorker-2WAfj91W.js' ]
worker guard: {"cross":"Error: Blocked network request to another origin: https://example.com/","same":"ok 200","apis":[]}
waiting 75 s for any delayed (60 s interval) reporting…
mediapipe files requested (proves worker requests are observed): [
  'vision_wasm_module_internal.js',
  'vision_wasm_module_internal.wasm',
  'face_landmarker.task',
  'selfie_multiclass_256x256.tflite',
  'README.md'
]
total requests: 19 | to other origins: []
CSP/blocked console lines: []
```

All earlier browser checks were repeated on 0.10.35 with the same results:
15-photo scoring run (identical scores and tags), crop and export
(354×472 / 840×1120), background replacement on four portraits, and the
background failure fallback.

Run by: Claude Fable 5.2 (AI agent), 2026-11-14

**Not verified:**

- That 1.2.3 actually transmitted: the request was found by reading the
  bundle and Google's notice, not by capturing it on the wire.
- Whether the page's `<meta>` CSP would have blocked it inside a worker in
  each browser.
- Firefox and Safari.

Follow-up, 2026-11-15 (Claude Opus 5.5): after publishing, `CI` and
`Deploy to GitHub Pages` both succeeded on the first push. The same network
check against `https://wanyaldee.github.io/id-photo-picker/` (two synthetic
drawn faces, background set to white, 75 s wait, headless Chromium) gave:

```
live workers: [ 'backgroundWorker-2WAfj91W.js' ]
total requests: 18 | to other origins: []
```
