# 0004: Crop frame and export

Date: 2026-11-14

## Context

Milestone 4: the user adjusts a fixed 3:4 frame (drag / resize), starting from
the position computed from the face, and exports 354×472 px or a larger file,
as PNG or JPEG, named `元名_idphoto.ext`. The output size must be covered by
a test.

## Decision

- `src/crop/frame.ts` — pure geometry: `fitFrame`, `moveFrame`,
  `resizeFrame`, `centeredFrame`, `exportSize`, `exportFileName`.
- `src/crop/export.ts` — the only DOM part: decode the file again, draw the
  framed area onto a canvas of the export size, encode, download.
- `src/ui/CropEditor.tsx` — an SVG overlay in image-pixel coordinates: dimmed
  outside, draggable frame, two dashed guide lines (head top, chin).
  Resize by slider, mouse wheel or `+`/`-`; arrow keys nudge.
- `src/ui/ExportPanel.tsx` — live preview drawn from the `<img>` already on
  screen, size and format choice, export button.
- Photos without a single face can still be cropped by hand from a centred
  frame: the final choice belongs to the person (CLAUDE.md §1).

## Reason

```ts
export function fitFrame(frame: Rect, imageWidth: number, imageHeight: number): Rect {
  const widest = maxFrameWidth(imageWidth, imageHeight);
  const width = clamp(frame.width, Math.min(MIN_FRAME_WIDTH_PX, widest), widest);
  const height = width / ASPECT_WIDTH_OVER_HEIGHT;
  const centerX = frame.x + frame.width / 2;
  const centerY = frame.y + frame.height / 2;
  return {
    x: clamp(centerX - width / 2, 0, imageWidth - width),
    y: clamp(centerY - height / 2, 0, imageHeight - height),
    width,
    height,
  };
}

export function exportSize(kind: ExportSizeKind, frameWidth: number): Size {
  const printUnit = OUTPUT_WIDTH_PX / 3; // 118; also OUTPUT_HEIGHT_PX / 4
  if (kind === "print") return { width: OUTPUT_WIDTH_PX, height: OUTPUT_HEIGHT_PX };
  const unit = Math.max(printUnit, Math.floor(frameWidth / 3));
  return { width: unit * 3, height: unit * 4 };
}
```

- Every frame change goes through `fitFrame`, and the height is always
  recomputed from the width: the ratio cannot drift after many drags, and the
  frame can never leave the photo, so the export never contains empty pixels.
- Width is clamped first, around the old centre, then the position: resizing
  near an edge keeps the frame where the user put it as far as possible.
- `MIN_FRAME_WIDTH_PX = 30`, capped by `widest` so a photo narrower than 30 px
  still yields a valid frame.
- `exportSize("large")` works in whole units of 3×4: a width that is not a
  multiple of 3 (e.g. 1001) would give a fractional height; rounding down to
  999×1332 keeps the ratio exact and never upscales. The lower bound of one
  print unit means "large" is never smaller than "print".
- The frame is kept in image pixels, not screen pixels: the same numbers
  drive the overlay (SVG `viewBox`), the preview and the export, so what is
  framed is what is exported regardless of dialog size.
- The export decodes the file again (`createImageBitmap(file)`) instead of
  reusing the on-screen `<img>`: it is released right after drawing, and
  milestone 5 needs a bitmap it can hand to the segmenter.
- JPEG quality 0.92: the conventional "visually lossless" setting; PNG is the
  default because the file name in §4 is `.png`.
- `tabindex` (lower case) on the SVG `<rect>`: SVG attribute names are
  case-sensitive and Preact passes them through, so `tabIndex` left the frame
  unfocusable (found in the browser run).

## Alternatives rejected

- Corner handles for resizing: more code and hit-testing for the same result
  as slider + wheel; can be added later without changing `frame.ts`.
- A crop library (e.g. Cropper.js): an extra dependency for one fixed-ratio
  rectangle.
- Rendering the export from the preview canvas: limited to the preview's
  resolution.
- Writing 300 dpi metadata into the file: canvas encoders cannot; it would
  need a PNG/JFIF chunk writer. The pixel size already equals 30×40 mm at
  300 dpi.

## Consequences

- The exported file carries no DPI metadata; print software must be told the
  size (30×40 mm).
- A frame narrower than 354 px is upscaled on export; the panel warns.
- Touch pinch-to-zoom is not implemented (drag works; resize via slider).
- The frame resets when the dialog is closed and reopened.

## Verification

`vp check`:

```
pass: All 52 files are correctly formatted (647ms, 12 threads)
pass: Found no warnings, lint errors, or type errors in 41 files (1.9s, 12 threads)
```

`vp test run` (includes `tests/frame.test.ts`: print size is exactly 354×472
for any frame; large size is exact 3:4):

```
 Test Files  10 passed (10)
      Tests  59 passed (59)
```

Browser run against `vp build` + `vp preview`, headless Chromium; exported
files were saved and decoded again to read their real size:

```
chawla initial frame: 539,378,842,1123 (image 1920x2400)
after drag (+60,-30 screen px): 722,287,842,1123
after drag far up-left: 0,0,842,1123
slider to max: 0,0,1800,2400
slider to 600: 600,800,600,800
after keys → ↓ -: 597,792,630,840
after reset: 539,378,842,1123
  export print-png: chawla_idphoto.png -> 354x472 magic=89504e47
  export print-jpg: chawla_idphoto.jpg -> 354x472 magic=ffd8ffe0
  large label: 大きいサイズ 840 × 1120 px
  export large-jpg: chawla_idphoto.jpg -> 840x1120 magic=ffd8ffe0
no_face initial frame: 240,240,1440,1920
  export noface: no_face_idphoto.png -> 354x472 magic=89504e47
tiny frame: 67,46,107,142 | warning: 枠の幅が 107 px しかなく、354 px に引き伸ばされます。ぼやけて見えることがあります。
  export tiny: tiny_idphoto.png -> 354x472 magic=89504e47
  export tiny-large: tiny_idphoto.png -> 354x472 magic=89504e47
melvin (landscape 1920x1536) frame: 618,293,436,581
external: [] errors: []
```

(The `after keys` line is from the rerun after the `tabindex` fix; before it
the frame did not move.)

- The exported `chawla_idphoto.png` and the dialog screenshot were looked at
  by the agent: head and shoulders framed as shown in the preview.

Run by: Claude Fable 5.2 (AI agent), 2026-11-14

**Not verified:**

- The real export pipeline is not part of `vp test` / CI — only the size
  arithmetic is. The browser script lives outside the repo.
- Mouse-wheel resize and touch dragging.
- Photos with EXIF rotation (frame vs. exported pixels).
- Firefox, Safari.
