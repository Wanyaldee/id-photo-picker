# 0002: Photo loading — two workers, thumbnails only, lane queue

Date: 2026-11-14

## Context

Milestone 2 requires loading many photos (the owner expects up to a few
hundred per session) and showing thumbnails without freezing the UI. A decoded
12 MP photo is ~48 MB of RGBA, so decoded originals cannot be kept.

## Decision

- `src/ui/files.ts` turns a file input, folder input or drop (including
  dropped folders) into a flat list and keeps JPEG / PNG / WebP. HEIC and
  other files are counted and reported on screen.
- `src/analysis/processPhotos.ts` starts `WORKER_COUNT` (2) module workers and
  feeds them with `runOnLanes`, one photo per worker at a time.
- `src/analysis/photoWorker.ts` decodes the file, draws a thumbnail of at most
  320 px on the long edge, returns it as a JPEG `Blob` plus the original
  width/height, and closes the full bitmap.
- The page keeps, per photo: the `File` handle, the thumbnail object URL and
  the dimensions. Nothing is written to storage.
- Cancel aborts the lane queue; photos already in a worker finish, photos not
  yet started are removed from the list.

## Reason

```ts
export async function runOnLanes(itemCount, laneCount, task, signal) {
  let next = 0;
  async function runLane(laneIndex: number): Promise<void> {
    while (next < itemCount && !signal.aborted) {
      const itemIndex = next;
      next += 1;
      await task(itemIndex, laneIndex);
    }
  }
  const lanes = Array.from({ length: Math.min(laneCount, itemCount) }, (_, i) => runLane(i));
  await Promise.all(lanes);
}
```

- A lane is a loop that owns one worker (`laneIndex` → `workers[laneIndex]`).
  Because a lane awaits its task before taking the next index, a worker never
  has two photos at once, which is what lets `requestPhoto` treat "the next
  message from this worker" as the reply without matching ids.
- `next` is read and incremented with no `await` in between, so two lanes
  cannot take the same index (JavaScript runs each lane step to its next
  `await` without interleaving).
- `signal.aborted` is checked only before starting an item: a photo already
  decoding cannot be interrupted cheaply, and letting it finish keeps the list
  consistent (every card is either ready, failed, or removed).
- `task` does not throw; a broken file comes back as `{ ok: false }` and shows
  on its own card, so one bad photo cannot reject `Promise.all` and stop the
  batch.

```ts
bitmap = await createImageBitmap(request.file);
const scale = Math.min(1, THUMBNAIL_LONG_EDGE_PX / Math.max(bitmap.width, bitmap.height));
...
context.drawImage(bitmap, 0, 0, width, height);
const thumbnail = await canvas.convertToBlob({ type: "image/jpeg", quality: THUMBNAIL_JPEG_QUALITY });
...
} finally {
  bitmap.close();
}
```

- Full decode, then scale by `drawImage` — not `createImageBitmap`'s
  `resizeWidth`: the original width/height must be reported (resolution check
  in §3), and milestone 3 will run face analysis on this same full bitmap.
- `Math.min(1, …)`: small images are never upscaled.
- `WORKER_COUNT = 2`: peak decoded memory is ~2 × 48 MB for 12 MP photos, and
  each worker will hold its own MediaPipe model in milestone 3.
- 320 px / JPEG 0.8: cards are ~160 CSS px wide, so 320 px covers 2× displays;
  a thumbnail is ~10–30 kB, so several hundred stay in the low MB.
- `bitmap.close()` in `finally`: releases the decoded pixels immediately
  instead of waiting for garbage collection in the worker.

## Alternatives rejected

- Decode on the main thread with `<img>`/canvas: canvas scaling of 12 MP
  images blocks the UI thread for tens of ms each.
- One worker per photo: unbounded memory with hundreds of photos.
- `navigator.hardwareConcurrency` workers: faster, but memory then scales with
  core count; 100 photos already finish in ~4 s with two.
- Virtualised grid: not needed at a few hundred cards with `loading="lazy"`
  thumbnails; revisit if the expected count grows past ~1000.
- Keeping pending cards after cancel: they would show "loading" forever.

## Consequences

- Opening a photo for cropping (milestone 4) must decode the `File` again.
- Files are processed in list order; the grid order is load order until
  scores exist (milestone 3).
- New files cannot be added while a batch is running (the loader is disabled).
- `webkitdirectory` is passed by object spread because Preact's input typings
  lack it.

## Verification

`vp check`:

```
pass: Formatting completed for checked files (4.6s)
pass: Found no warnings, lint errors, or type errors in 16 files (2.4s, 12 threads)
```

`vp test run`:

```
 Test Files  3 passed (3)
      Tests  9 passed (9)
```

Browser run against `vp build` + `vp preview` (CSP active), headless Chromium
(Playwright build 1248) driven by a script kept outside the repo. Input: 100
synthetic 3000×4000 JPEGs generated in the page, plus one corrupt `.jpg`, one
`.HEIC` and one `.txt`, set on the file input.

```
{ "seconds": "4.0", "sawProgress": true, "maxFrameGapMs": 33, "longTasks": [64],
  "cards": 101, "thumbs": 100, "failed": 1,
  "messages": ["HEIC 形式の 1 枚は読み込めません。事前に JPEG へ変換してください。",
               "写真ではないファイル 1 個は読み飛ばしました。"],
  "imgSize": [240, 320, "blob:"] }
cancel: {"cards":109,"pending":0,"messages":["中断しました。未処理の 92 枚は一覧から外しました。"]}
requests: 79 external: []
console: []
```

- 100 thumbnails and one failed card; largest gap between animation frames
  33 ms; one long task of 64 ms.
- Cancel after 300 ms of a second 100-photo batch: 8 finished, 92 removed.
- No request left the page's origin; no CSP violation in the console.

Run by: Claude Fable 5.2 (AI agent), 2026-11-14

**Not verified:**

- Folder picker and real drag & drop (including dropped folders): headless
  automation set files on the input directly. `filesFromDrop` has not been
  exercised by any test.
- Firefox and Safari.
- Real camera photos (EXIF rotation), and batches of several hundred.
