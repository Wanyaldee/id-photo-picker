import { CLIP_BLACK_LUMA, CLIP_WHITE_LUMA } from "./config";

// Pixel statistics. Pure functions over plain arrays so they run the same in
// a worker and in tests.

// RGBA bytes -> one luma value (0..255) per pixel, Rec. 601 weights.
export function lumaFromRgba(rgba: Uint8ClampedArray, pixelCount: number): Float32Array {
  const luma = new Float32Array(pixelCount);
  for (let i = 0; i < pixelCount; i++) {
    const r = rgba[i * 4] ?? 0;
    const g = rgba[i * 4 + 1] ?? 0;
    const b = rgba[i * 4 + 2] ?? 0;
    luma[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return luma;
}

// Variance of the Laplacian: the standard cheap focus measure. The Laplacian
// (4-neighbour kernel) responds to edges; a sharp image has strong edges and
// therefore a wide spread of responses, a blurred one has a narrow spread.
// Border pixels are skipped.
export function laplacianVariance(luma: Float32Array, width: number, height: number): number {
  if (width < 3 || height < 3) return 0;
  let sum = 0;
  let sumOfSquares = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const response =
        (luma[i - width] ?? 0) +
        (luma[i + width] ?? 0) +
        (luma[i - 1] ?? 0) +
        (luma[i + 1] ?? 0) -
        4 * (luma[i] ?? 0);
      sum += response;
      sumOfSquares += response * response;
    }
  }
  const count = (width - 2) * (height - 2);
  const mean = sum / count;
  return sumOfSquares / count - mean * mean;
}

// Copies the centre of a luma image, leaving out `marginX` of the width on
// each side and `marginY` of the height at top and bottom.
export function innerRegion(
  luma: Float32Array,
  width: number,
  height: number,
  marginX: number,
  marginY: number,
): { luma: Float32Array; width: number; height: number } {
  const left = Math.floor(width * marginX);
  const top = Math.floor(height * marginY);
  const innerWidth = Math.max(0, width - 2 * left);
  const innerHeight = Math.max(0, height - 2 * top);
  const inner = new Float32Array(innerWidth * innerHeight);
  for (let y = 0; y < innerHeight; y++) {
    const start = (top + y) * width + left;
    inner.set(luma.subarray(start, start + innerWidth), y * innerWidth);
  }
  return { luma: inner, width: innerWidth, height: innerHeight };
}

export type ExposureStats = {
  meanLuma: number;
  overexposedFraction: number;
  underexposedFraction: number;
  // |left half mean − right half mean| / brighter half. 0 = evenly lit.
  sideImbalance: number;
};

export function exposureStats(luma: Float32Array, width: number, height: number): ExposureStats {
  const count = width * height;
  if (count === 0) {
    return { meanLuma: 0, overexposedFraction: 0, underexposedFraction: 0, sideImbalance: 0 };
  }
  const half = Math.floor(width / 2);
  let leftSum = 0;
  let rightSum = 0;
  let over = 0;
  let under = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = luma[y * width + x] ?? 0;
      if (x < half) leftSum += value;
      else rightSum += value;
      if (value >= CLIP_WHITE_LUMA) over += 1;
      else if (value <= CLIP_BLACK_LUMA) under += 1;
    }
  }
  const leftMean = half > 0 ? leftSum / (half * height) : 0;
  const rightMean = rightSum / ((width - half) * height);
  const brighter = Math.max(leftMean, rightMean);
  return {
    meanLuma: (leftSum + rightSum) / count,
    overexposedFraction: over / count,
    underexposedFraction: under / count,
    sideImbalance: brighter > 0 ? Math.abs(leftMean - rightMean) / brighter : 0,
  };
}
