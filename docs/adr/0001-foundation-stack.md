# 0001: Foundation stack — Vite+, Preact, build-time CSP

Date: 2026-11-14

## Context

The project started from CLAUDE.md alone. §8 listed open questions (UI
framework, expected photo count, HEIC, repo name, README language), and §2
left the lint tool open ("Biome or ESLint+Prettier"). §5 requires a
Content-Security-Policy with `connect-src 'self'`, and the app is deployed to
GitHub Pages, which cannot send custom response headers.

## Decision

Answers given by the owner on 2026-11-14:

| Question        | Decision                                                    |
| --------------- | ----------------------------------------------------------- |
| UI framework    | Preact                                                      |
| Expected count  | Up to a few hundred photos per session                      |
| HEIC            | Not supported; README tells users to convert to JPEG        |
| Repo name       | `id-photo-picker`                                           |
| README language | Japanese only                                               |
| Toolchain       | Vite+ (`vp`), on the owner's instruction during milestone 1 |

Vite+ provides dev server, build, Vitest, Oxlint, Oxfmt and type checking, so
no separate lint/format/tsc dependency is installed. The CSP is injected into
`dist/index.html` as a `<meta>` tag by a small build-only plugin.

Dependency licenses checked with `npm view <pkg> license` on 2026-11-14:
`vite-plus` MIT, `preact` MIT, `@preact/preset-vite` MIT.

## Reason

```ts
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

function cspMetaTag(): Plugin {
  return {
    name: "csp-meta-tag",
    apply: "build",
    transformIndexHtml: () => [
      {
        tag: "meta",
        attrs: { "http-equiv": "Content-Security-Policy", content: CONTENT_SECURITY_POLICY },
        injectTo: "head-prepend",
      },
    ],
  };
}

export default defineConfig({
  base: "./",
  plugins: lazyPlugins(() => [preact(), cspMetaTag()]),
  test: { include: ["tests/**/*.test.ts"] },
});
```

- `<meta>` tag, not a header: GitHub Pages serves static files only and has no
  header configuration. `frame-ancestors` and `report-uri` are ignored in a
  meta policy, so they are not listed.
- `connect-src 'self'`: the browser itself refuses fetch/XHR/WebSocket/beacon
  to any other origin, so "photos do not leave the device" does not depend on
  every future line of code being careful.
- `'wasm-unsafe-eval'` in `script-src`: MediaPipe (milestone 3) compiles a
  WASM binary. This keyword allows WASM compilation only; JS `eval` stays
  blocked. It is added now so the policy is not loosened later without notice.
- `img-src blob: data:` and `worker-src blob:`: photos are displayed through
  `URL.createObjectURL`, which produces `blob:` URLs.
- `form-action 'none'`: the app has no form submission; this closes the one
  navigation-based way to post data that `connect-src` does not cover.
- `apply: "build"`: the dev server injects inline `<style>` tags, which
  `style-src 'self'` would block. Production CSS is a linked file.
- `injectTo: "head-prepend"`: a meta policy only applies to elements parsed
  after it, so it must precede the script and stylesheet tags.
- `base: "./"`: asset URLs become relative, so the build works under
  `https://<user>.github.io/id-photo-picker/` without hard-coding the repo
  name.
- `lazyPlugins(...)`: written by `vp migrate`; it keeps `vp check`/`lint`/`fmt`
  from loading the Vite plugins they do not need.

Why the answers to §8 look like this:

- Preact: the list, filters, sliders and crop frame all hold state that must
  stay in sync; hand-written DOM updates for that would be more code than the
  ~4 kB library.
- A few hundred photos: full-size decoded bitmaps cannot all stay in memory
  (a 12 MP photo is ~48 MB as RGBA), so milestone 2 keeps only small
  thumbnails and re-decodes the original when one photo is opened.
- No HEIC: only Safari decodes it natively; the usual decoder (libheif) is
  LGPL and adds several MB of WASM.

## Alternatives rejected

- Biome (first scaffold): removed when the owner chose Vite+; two formatters
  in one repo would fight over the same files.
- Plain Vite + Vitest + tsc: same engines, but three configs and three
  commands instead of `vite.config.ts` and `vp check`.
- Plain DOM: no dependency, but re-rendering the grid on filter/weight
  changes would be hand-written.
- Svelte: least UI code, but adds a compiler and `.svelte` files to type
  checking and tests.
- CSP in `index.html` directly: breaks `vp dev` (inline styles, HMR socket).

## Consequences

- Contributors need Vite+ (`vp`) or can use the npm scripts, which call the
  `vp` binary from the local `vite-plus` devDependency.
- `vite` is aliased to `@voidzero-dev/vite-plus-core` in `package.json`;
  imports must come from `vite-plus` / `vite-plus/test` (a lint rule enforces
  it).
- The CSP is not active in `vp dev`. Privacy checks must be done against
  `vp build` + `vp preview`.
- A meta CSP cannot be verified by response headers; milestone 6 must check
  it in a real browser.

## Verification

`vp check` (after formatting):

```
pass: All 11 files are correctly formatted (639ms, 12 threads)
pass: Found no warnings, lint errors, or type errors in 5 files (1.6s, 12 threads)
```

Type checking is live: a temporary file `export const x: number = "a";`
produced `typescript(TS2322): Type 'string' is not assignable to type 'number'.`

`vp test run`:

```
 RUN  v5.1.0 /home/ko200/id-photo-picker

 Test Files  1 passed (1)
      Tests  1 passed (1)
```

`vp build`:

```
✓ 9 modules transformed.
dist/index.html                  0.80 kB │ gzip: 0.45 kB
dist/assets/index-DMZ_QsNf.css   1.04 kB │ gzip: 0.45 kB
dist/assets/index-DU4ByvIa.js   12.18 kB │ gzip: 5.48 kB
✓ built in 175ms
```

`dist/index.html` contains the CSP `<meta>` as the first element of `<head>`.

Run by: Claude Fable 5.2 (AI agent), 2026-11-14

**Not verified:**

- The page in a real browser (rendering, and that the CSP does not block the
  built script/stylesheet). No browser was driven in this milestone.
- The GitHub Actions workflow; nothing has been pushed yet.
