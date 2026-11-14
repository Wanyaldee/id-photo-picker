# 0003: Face analysis and scoring

Date: 2026-11-14

## Context

Milestone 3 implements CLAUDE.md §3: each photo gets a 0–100 score with a
per-item breakdown; photos without exactly one face are excluded with a reason;
weights and thresholds live in `src/scoring/config.ts` and are adjustable by
sliders; scoring logic must be pure and unit-tested.

## Decision

Two stages, split at the worker boundary:

1. **Measure (worker, once per photo)** — `src/analysis/faceAnalyzer.ts` runs
   MediaPipe FaceLandmarker (`@mediapipe/tasks-vision`, Apache-2.0; written
   against 1.2.3, since pinned to 0.10.35 by ADR 0006 with identical scores) and
   returns raw `FaceMeasurements`: landmark positions, blendshapes, head
   angles, and pixel statistics of the face region.
2. **Score (page, on every config change)** — `scorePhoto()` in
   `src/scoring/score.ts` turns measurements + image size + config into a
   total, seven item scores, reason tags and the automatic 3:4 frame.

The model file is committed under `public/mediapipe/models/` (with source,
licence and SHA-256 in `public/mediapipe/README.md`). The WASM runtime is
copied from `node_modules` at build start (originally by a `postinstall`
script; changed in ADR 0006) and git-ignored.

## Reason

### Scoring

```ts
export function ramp(value: number, zeroAt: number, oneAt: number): number {
  if (zeroAt === oneAt) return value >= oneAt ? 1 : 0;
  return Math.max(0, Math.min(1, (value - zeroAt) / (oneAt - zeroAt)));
}
...
for (const key of ITEM_ORDER) {
  const score = Math.min(...parts[key].map((part) => part.score));
  const weight = weightOf(key, config);
  items.push({ key, score, weight });
  weighted += weight * score;
  weightSum += weight;
  for (const part of parts[key]) {
    if (part.score < config.tagThreshold) reasons.push(part.reason);
  }
}
const eyesScore = items.find((item) => item.key === "eyes")?.score ?? 1;
const eyesFactor = config.eyesClosedMultiplier + (1 - config.eyesClosedMultiplier) * eyesScore;
const average = weightSum > 0 ? weighted / weightSum : 0;
return { kind: "scored", total: 100 * average * eyesFactor, items, reasons, crop };
```

- `ramp` with two named ends per measurement, not a curve: every threshold in
  `config.ts` reads as "full marks at X, zero at Y", which is what the sliders
  show and what the owner can explain.
- An item is the `Math.min` of its parts (e.g. exposure = darkness,
  brightness, clipped white, clipped black, side imbalance): a face that is
  half in shadow is not rescued by a good average brightness. Each part
  carries its own reason, so the tag says which fault it was.
- Weighted mean divided by `weightSum`: sliders can be moved freely without
  the total leaving 0–100; `weightSum > 0` guards the all-zero case.
- `eyesFactor`: a plain weighted mean would let a closed-eyes photo with
  everything else perfect score 80 and outrank usable photos. §3 asks for a
  large deduction, so the total is additionally scaled from 1 down to
  `eyesClosedMultiplier` (0.5): that photo scores 40.
- Exclusion (0 or ≥2 faces) is a separate result kind with no number, so an
  excluded photo can never be sorted among candidates by accident.
- Composition is "how much of the automatic 3:4 frame lies inside the photo"
  and resolution is "frame width ÷ 354 px". §3's "face-height ratio" and
  "offset from centre" are both covered by these: a face that is too large or
  too close to an edge makes the frame overflow; a face that is too small
  makes the frame narrower than 354 px.

### Measurement

```ts
const landmarker = await getLandmarker(baseUrl);
const result = landmarker.detect(scaledCopy(bitmap, DETECTION_LONG_EDGE_PX));
...
context.drawImage(bitmap, box.x, box.y, box.width, box.height, 0, 0, width, height);
const luma = lumaFromRgba(context.getImageData(0, 0, width, height).data, width * height);
const inner = innerRegion(luma, width, height, FACE_INNER_MARGIN_X, FACE_INNER_MARGIN_Y);
return {
  sharpness: laplacianVariance(luma, width, height),
  ...exposureStats(inner.luma, inner.width, inner.height),
};
```

- Detection on a 1024 px copy: landmarks are normalised, so positions are the
  same as on the full image; 15 photos analyse in ~3 s on two workers.
- Pixel statistics on the face cut from the **full-size** bitmap and
  resampled to 256 px wide: sharpness then means "sharp at about print size"
  and does not grow with megapixels.
- Exposure on the inner 60% × 70% of the face box: with the full box, dark
  hair counted as "clipped black" (7.5% and 10.6% on two sample portraits;
  0.0% after the change).
- `delegate: "CPU"`: same numbers on every machine; no dependency on GPU
  availability in a worker.
- `FilesetResolver.forVisionTasks(base, true)` + `worker.format: "es"`: the
  package's module loader is imported with `import()`, which works in module
  workers in both `vp dev` and the build.
- Head angles: `R = Ry(yaw)·Rx(pitch)·Rz(roll)` read from the 4×4
  transformation matrix (`src/scoring/pose.ts`); scale is cancelled.

### Calibration data

Five public-domain NASA portraits (Wikimedia Commons; kept outside the repo)
and variants made from one of them on a canvas:

| Photo                          | Sharpness | Luma | Side imbalance | Notes                         |
| ------------------------------ | --------- | ---- | -------------- | ----------------------------- |
| chawla                         | 538       | 150  | 0.16           | studio portrait               |
| clark                          | 119       | 163  | 0.04           | film scan; pitch 12°          |
| nelson                         | 157       | 129  | 0.25           | studio key light              |
| hathaway                       | 347       | 139  | 0.26           | studio key light              |
| melvin                         | 218       | 91   | 0.12           | dark skin, well lit; roll 20° |
| chawla, blur 3 px              | 6         | —    | —              |                               |
| chawla, brightness ×0.3        | 59        | 44   | 0.16           |                               |
| chawla, brightness ×2.2        | 1289      | 238  | —              | 70% clipped white             |
| chawla, left half darkened 60% | 374       | 98   | 0.50           |                               |
| chawla, rotated 20°            | 392       | —    | —              | measured roll −19.4°          |

Defaults that follow from it:

- `focusSharp: 100`, `focusBlurry: 20` — every sharp original is ≥ 119; the
  3 px blur is 6.
- `lumaTooDark: 30`, `lumaGoodMin: 65` — the first draft used 60/100 and
  tagged the well-lit dark-skinned portrait (luma 77 on the full box) as "too
  dark". Exposure must not penalise skin tone.
- `sideImbalanceAllowed: 0.3`, `sideImbalanceBad: 0.6` — the first draft
  (0.12/0.4) tagged ordinary studio lighting (0.25–0.29) as "shadow on one
  side".

## Alternatives rejected

- Scoring inside the worker: every slider move would re-analyse all photos.
- Multiplying item scores instead of a weighted mean: one mediocre item drags
  the total to near zero and the weights stop meaning anything.
- Whole-image Laplacian variance: a sharp background would hide a blurred
  face (§3 requires the face region).
- GPU delegate: faster, but results differ slightly by GPU/driver and need
  WebGL in a worker.
- Committing the WASM runtime: 15 MB that would drift from the npm version.
- Downloading the model at build time: the build would depend on an external
  URL staying up.

## Consequences

- Changing a weight or threshold re-scores instantly; changing what is
  _measured_ requires reloading the photos.
- Sharpness depends on contrast: the ×0.3 darkened copy of a sharp photo
  reads 59 instead of 538 and is tagged "blurry" as well as "too dark".
- The smile blendshape reads 0.86–0.97 on every sample (all are open,
  toothy smiles), so all are tagged "strong smile". `smileAllowed` /
  `smileTooStrong` (0.5 / 0.9) have not been calibrated against a slight,
  closed-mouth smile.
- Head top is an estimate (`HEAD_TOP_EXTENSION = 0.3` above the forehead
  landmark); big hair or a hat will be cut by the automatic frame until the
  user adjusts it (milestone 4).
- The repo carries a 3.7 MB binary model.

## Verification

`vp check`:

```
pass: Formatting completed for checked files (1.7s)
pass: Found no warnings, lint errors, or type errors in 36 files (809ms, 12 threads)
```

`vp test run`:

```
 Test Files  9 passed (9)
      Tests  46 passed (46)
```

Browser run against `vp build` + `vp preview` (CSP active), headless
Chromium, 15 inputs (5 portraits + 10 variants):

```
analysed 15 photos in 2.9 s
hathaway.jpg | 91 | 笑顔が強い
nelson.jpg | 90 | 笑顔が強い
chawla.jpg | 90 | 笑顔が強い
half_shadow.jpg | 81 | 笑顔が強い / 片側に影がある
clark.jpg | 81 | 笑顔が強い / 顔が上下を向いている
cut_top.jpg | 79 | 笑顔が強い / 余白が足りない
bright.jpg | 75 | 笑顔が強い / 顔が明るすぎる / 白飛びしている
blur_heavy.jpg | 74 | ピントが甘い / 笑顔が強い
rolled20.jpg | 71 | 笑顔が強い / 顔が傾いている
dark.jpg | 70 | ピントが甘い / 笑顔が強い / 顔が暗い
blur_small.jpg | 69 | ピントが甘い / 笑顔が強い
tiny.jpg | 64 | ピントが甘い / 笑顔が強い / 解像度が足りない
melvin.jpg | 55 | 笑顔が強い / 顔が傾いている
two_faces.jpg | 除外 | 複数の顔が写っています(2 人)
no_face.jpg | 除外 | 顔を検出できませんでした
external requests: []
```

(These scores were taken with `HEAD_HEIGHT_RATIO = 0.62`; it was then changed
to 0.55 after looking at the frame on screen. The run below is after that
change.)

Settings, persistence, filters and sort:

```
default      : chawla.jpg=90, blur_small.jpg=69, two_faces.jpg=除外, no_face.jpg=除外
focus weight0: chawla.jpg=87, blur_small.jpg=86, two_faces.jpg=除外, no_face.jpg=除外
stored       : [ 'id-photo-picker.scoring-config.v1 (559 chars, weightFocus=0)' ]
after reload : chawla.jpg=87, blur_small.jpg=86, two_faces.jpg=除外, no_face.jpg=除外
candidates   : chawla.jpg=87, blur_small.jpg=86
noFace       : no_face.jpg=除外
by name      : blur_small.jpg=86, chawla.jpg=87, no_face.jpg=除外, two_faces.jpg=除外
after reset  : blur_small.jpg=69, chawla.jpg=90, no_face.jpg=除外, two_faces.jpg=除外
indexedDB    : 0 external: []
```

- Detail dialog screenshot checked by the agent: frame, head-top line (at the
  top of the hair) and chin line sit where expected on one portrait.

Run by: Claude Fable 5.2 (AI agent), 2026-11-14

**Not verified:**

- Closed eyes and open mouth on real photos — no licence-clear sample was
  available; only the unit tests cover them.
- Any photo of the owner or of typical phone-camera quality; the calibration
  set is five studio portraits.
- Whether the thresholds rank real candidate sets the way a person would.
- Firefox, Safari, mobile browsers.
