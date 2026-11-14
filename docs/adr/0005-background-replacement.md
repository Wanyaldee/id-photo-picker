# 0005: Background replacement

Date: 2026-11-14

## Context

Milestone 5: optionally replace the background with plain white or light
blue, always show a preview in which the cut-out edge can be checked, and
still allow export with the original background when the step fails.
CLAUDE.md §8 left open whether a model bundled with MediaPipe is accurate
enough; it was to be decided by looking at results.

## Decision

- Model: MediaPipe `selfie_multiclass_256x256` (Apache-2.0, 16 MB), run by
  `ImageSegmenter` in its own worker (`src/background/backgroundWorker.ts`).
  Chosen by the owner on 2026-11-14 after the comparison below.
- The segmenter runs on the **cropped frame**, not the whole photo, so the
  256×256 mask is spent on head and shoulders only.
- `cleanPersonMask` (pure) removes stray pieces and fills holes;
  `personAlphaMask` (pure) turns confidence into a soft alpha.
- `replaceBackground(canvas, color)` composites person over the colour and
  returns a new canvas; the same function produces the preview and the
  export.
- The preview is shown at the real print size (354×472). Any failure switches
  the choice back to "unchanged" and says so; export then works as in
  milestone 4.
- Only background pixels change. Person pixels are copied as they are (§1:
  no retouching).

## Reason

```ts
export function cleanPersonMask(confidence, width, height, low, high): Float32Array {
  const cleaned = new Float32Array(confidence);

  // 1. Keep only the largest visible region.
  const isVisible = (index: number) => (confidence[index] ?? 0) >= low;
  ...
  for (let index = 0; index < confidence.length; index++) {
    if (isVisible(index) && regions[index] !== largestLabel) cleaned[index] = 0;
  }

  // 2. Make everything enclosed by solid person solid.
  const isNotSolid = (index: number) => (cleaned[index] ?? 0) < high;
  ... // flood fill from every border pixel through isNotSolid pixels
  for (let index = 0; index < confidence.length; index++) {
    if (isNotSolid(index) && outside[index] === 0) cleaned[index] = 1;
  }
  return cleaned;
}
```

- Step 1 groups pixels at `>= low` (0.35), the level at which a pixel starts
  to be visible in `personAlphaMask`. A first version grouped at 0.5 and left
  a faint ring around each removed piece, because the piece's 0.35–0.5 halo
  was not part of it.
- Step 2 floods through pixels `< high` (0.65), i.e. anything not fully
  opaque. The flood reaches the real background and the person's soft outer
  edge, but cannot pass solid person; what it does not reach is enclosed. A
  first version only filled pixels below 0.5 and left the hole's soft rim
  visible as an outline on a shirt.
- 4-neighbour connectivity: two regions touching only at a corner are not
  joined by the canvas's interpolation either.
- Explicit stack in `floodFill`: recursion would exceed the call stack on a
  65 536-pixel mask.
- `low`/`high` are passed in, not re-declared: cleanup and alpha must agree
  on what "visible" and "solid" mean.

```ts
const t = range > 0 ? Math.max(0, Math.min(1, (value - low) / range)) : value >= high ? 1 : 0;
rgba[i * 4 + 3] = Math.round(255 * t * t * (3 - 2 * t));
```

- A blend band (0.35–0.65) instead of a 0.5 threshold: a hard threshold on a
  256 px mask scaled up to 354+ px gives a stair-stepped outline.
- Smoothstep instead of a straight line: no visible kink where the band
  starts and ends.

```ts
personContext.drawImage(source, 0, 0);
personContext.globalCompositeOperation = "destination-in";
personContext.imageSmoothingQuality = "high";
personContext.drawImage(maskCanvas, 0, 0, source.width, source.height);
```

- The mask is drawn scaled by the canvas, which interpolates it; no
  hand-written resampling.
- `destination-in` keeps the photo's own colours and only multiplies alpha.
- A new output canvas is returned and `source` is untouched, so a rejected
  promise leaves the caller with the original crop to export.

### Model comparison (the §8 question)

Four public-domain portraits, exported at 354×472 and at full frame size,
inspected by the agent:

|                                   | selfie_segmenter (250 kB)                         | selfie_multiclass_256x256 (16 MB)                |
| --------------------------------- | ------------------------------------------------- | ------------------------------------------------ |
| Plain studio backdrop (chawla)    | clean                                             | clean; small patch at the bottom edge            |
| Curly hair + flag (clark)         | jagged hair edge; flag patches left on both sides | smoother edge; small trace at one side           |
| Flag beside the shoulder (nelson) | large flag piece left                             | smaller flag piece left; hole in the white shirt |
| Time per preview                  | ~0.35 s                                           | ~0.85 s                                          |

After `cleanPersonMask`, the shirt hole and the detached specks are gone; the
flag piece that touches the shoulder remains.

## Alternatives rejected

- `selfie_segmenter`: a 60× smaller file, but worse edges and more leftovers
  on the same photos.
- MODNet / U²-Net through `onnxruntime-web`: probably better hair edges, but
  a second inference runtime and tens of MB more; not tried, so no measured
  benefit. Offered to the owner and not chosen.
- Running the segmenter on the whole photo and cropping the mask: the head
  would get a fraction of the 256 px.
- Segmenting on the main thread: compiling the 15 MB WASM runtime and
  loading a 16 MB model would stall the dialog.
- Exporting with the original background silently when the step fails: the
  file would differ from the preview without the user knowing.

## Consequences

- Objects that touch the person's outline (a flag behind the shoulder, a
  chair back) stay in the picture; the UI tells the user to check the
  preview and to switch back to "unchanged" if it looks wrong.
- A real gap fully enclosed by the person (a hoop earring, an arm akimbo)
  is filled with the original pixels rather than the new colour.
- Semi-transparent edge pixels keep a trace of the old background colour.
- The repo carries a second binary (16 MB). It is fetched by the browser
  only after a background colour is chosen.
- The large export uses the same 256 px mask, so its edge is softer in
  relation to the image than in the print-size export.

## Verification

`vp check`:

```
pass: Formatting completed for checked files (1.7s)
pass: Found no warnings, lint errors, or type errors in 47 files (854ms, 12 threads)
```

`vp test run`:

```
 Test Files  11 passed (11)
      Tests  72 passed (72)
```

Browser run against `vp build` + `vp preview`, headless Chromium: for each of
four portraits, choose white, export large; choose light blue, export print.

```
default-chawla-white preview ms: 1794 | error: none
default-chawla-blue preview ms: 887 | error: none
default-clark-white preview ms: 981 | error: none
default-clark-blue preview ms: 858 | error: none
default-nelson-white preview ms: 947 | error: none
default-nelson-blue preview ms: 914 | error: none
default-melvin-white preview ms: 908 | error: none
default-melvin-blue preview ms: 849 | error: none
default external: [] errors: []
```

(Timings are from the run before the final cleanup change; the rerun after it
reported no errors and no external requests.)

Failure path — the model request was aborted by the test:

```
message: 背景を処理できなかったため、「そのまま」に戻しました。元の背景のままなら書き出せます。(Error: TypeError: Failed to fetch)
selected background: 0 (0 = そのまま)
fallback export: chawla_idphoto.png
```

- Exported images looked at by the agent after the final change: nelson
  (hole and specks gone, attached flag piece remains), chawla large (clean
  outline, patch at the bottom edge remains).

Run by: Claude Fable 5.2 (AI agent), 2026-11-14

**Not verified:**

- Ordinary indoor photos (walls, furniture, windows) — the samples are studio
  portraits.
- Glasses, hats, headscarves, very light or very fine hair.
- That a retry after a failed model load succeeds (the retry path was added
  but not exercised).
- Firefox, Safari.
