// Turns per-pixel person confidence into an alpha mask. Pure function.
//
// Returns RGBA bytes (black, with alpha) ready for ImageData:
// alpha = 0 below `low`, 255 above `high`, and a smoothstep curve between,
// so the edge fades without a visible kink at either end.
export function personAlphaMask(
  confidence: Float32Array,
  low: number,
  high: number,
): Uint8ClampedArray<ArrayBuffer> {
  const rgba = new Uint8ClampedArray(confidence.length * 4);
  const range = high - low;
  for (let i = 0; i < confidence.length; i++) {
    const value = confidence[i] ?? 0;
    const t = range > 0 ? Math.max(0, Math.min(1, (value - low) / range)) : value >= high ? 1 : 0;
    rgba[i * 4 + 3] = Math.round(255 * t * t * (3 - 2 * t));
  }
  return rgba;
}

// Marks every pixel connected to `start` (4 neighbours) for which `inside`
// holds, writing `label` into `labels`. Returns how many pixels were marked.
// Iterative with an explicit stack: recursion would overflow on large areas.
function floodFill(
  start: number,
  label: number,
  labels: Int32Array,
  inside: (index: number) => boolean,
  width: number,
  height: number,
): number {
  const stack = [start];
  labels[start] = label;
  let size = 0;
  while (stack.length > 0) {
    const index = stack.pop() ?? 0;
    size += 1;
    const x = index % width;
    const y = (index - x) / width;
    const neighbours = [
      x > 0 ? index - 1 : -1,
      x < width - 1 ? index + 1 : -1,
      y > 0 ? index - width : -1,
      y < height - 1 ? index + width : -1,
    ];
    for (const next of neighbours) {
      if (next >= 0 && labels[next] === 0 && inside(next)) {
        labels[next] = label;
        stack.push(next);
      }
    }
  }
  return size;
}

// Repairs the two segmentation faults seen on real portraits (ADR 0005):
//
// 1. Stray pieces: something in the background (a flag, a lamp) is marked as
//    person but is not attached to the person. Regions are formed from every
//    pixel that would be at least faintly visible (confidence >= `low`); only
//    the largest is kept and the rest, including their faint halos, become
//    background.
// 2. Holes: a patch inside the person (a white shirt) is marked as
//    background. Starting from the image border and walking through pixels
//    that are not fully opaque (confidence < `high`), everything reached is
//    real background or the person's soft outer edge. Whatever is not reached
//    is enclosed by solid person, so it is made solid too — the hole and the
//    soft ring around it.
//
// `low` and `high` are the same limits personAlphaMask uses. Pixels that are
// not changed keep their original confidence, so the outer edge stays soft.
export function cleanPersonMask(
  confidence: Float32Array,
  width: number,
  height: number,
  low: number,
  high: number,
): Float32Array {
  const cleaned = new Float32Array(confidence);

  // 1. Keep only the largest visible region.
  const isVisible = (index: number) => (confidence[index] ?? 0) >= low;
  const regions = new Int32Array(confidence.length);
  let largestLabel = 0;
  let largestSize = 0;
  let nextLabel = 1;
  for (let index = 0; index < confidence.length; index++) {
    if (regions[index] !== 0 || !isVisible(index)) continue;
    const size = floodFill(index, nextLabel, regions, isVisible, width, height);
    if (size > largestSize) {
      largestSize = size;
      largestLabel = nextLabel;
    }
    nextLabel += 1;
  }
  for (let index = 0; index < confidence.length; index++) {
    if (isVisible(index) && regions[index] !== largestLabel) cleaned[index] = 0;
  }

  // 2. Make everything enclosed by solid person solid.
  const isNotSolid = (index: number) => (cleaned[index] ?? 0) < high;
  const outside = new Int32Array(confidence.length);
  const seed = (index: number) => {
    if (outside[index] === 0 && isNotSolid(index)) {
      floodFill(index, 1, outside, isNotSolid, width, height);
    }
  };
  for (let x = 0; x < width; x++) {
    seed(x);
    seed((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    seed(y * width);
    seed(y * width + width - 1);
  }
  for (let index = 0; index < confidence.length; index++) {
    if (isNotSolid(index) && outside[index] === 0) cleaned[index] = 1;
  }
  return cleaned;
}
