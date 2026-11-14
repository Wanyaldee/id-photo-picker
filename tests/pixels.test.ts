import { expect, test } from "vite-plus/test";
import { exposureStats, innerRegion, laplacianVariance, lumaFromRgba } from "../src/scoring/pixels";

function lumaImage(width: number, height: number, value: (x: number, y: number) => number) {
  const luma = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) luma[y * width + x] = value(x, y);
  }
  return luma;
}

// 3x3 box blur, used to show that blurring lowers the focus measure.
function boxBlur(luma: Float32Array, width: number, height: number) {
  return lumaImage(width, height, (x, y) => {
    let sum = 0;
    let count = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
        sum += luma[yy * width + xx] ?? 0;
        count += 1;
      }
    }
    return sum / count;
  });
}

test("lumaFromRgba uses Rec. 601 weights", () => {
  const rgba = new Uint8ClampedArray([255, 255, 255, 255, 255, 0, 0, 255, 0, 0, 0, 255]);
  const luma = lumaFromRgba(rgba, 3);
  expect(luma[0]).toBeCloseTo(255, 3);
  expect(luma[1]).toBeCloseTo(0.299 * 255, 3);
  expect(luma[2]).toBe(0);
});

test("a flat image has zero Laplacian variance", () => {
  expect(
    laplacianVariance(
      lumaImage(16, 16, () => 128),
      16,
      16,
    ),
  ).toBe(0);
});

test("a smooth gradient has zero Laplacian variance (no edges)", () => {
  expect(
    laplacianVariance(
      lumaImage(16, 16, (x) => x * 10),
      16,
      16,
    ),
  ).toBeCloseTo(0, 6);
});

test("blurring an image with edges lowers the Laplacian variance", () => {
  const sharp = lumaImage(32, 32, (x, y) => (((x >> 2) + (y >> 2)) % 2 === 0 ? 200 : 50));
  const blurred = boxBlur(sharp, 32, 32);
  const sharpValue = laplacianVariance(sharp, 32, 32);
  const blurredValue = laplacianVariance(blurred, 32, 32);
  expect(sharpValue).toBeGreaterThan(1000);
  expect(blurredValue).toBeLessThan(sharpValue / 4);
});

test("images too small for the kernel report zero", () => {
  expect(laplacianVariance(new Float32Array(4), 2, 2)).toBe(0);
});

test("exposureStats: mean and clipped fractions", () => {
  // 4x1: black, mid, mid, white.
  const stats = exposureStats(new Float32Array([0, 100, 100, 255]), 4, 1);
  expect(stats.meanLuma).toBeCloseTo(113.75, 5);
  expect(stats.overexposedFraction).toBe(0.25);
  expect(stats.underexposedFraction).toBe(0.25);
});

test("exposureStats: side imbalance compares the two halves", () => {
  const even = exposureStats(
    lumaImage(10, 4, () => 150),
    10,
    4,
  );
  expect(even.sideImbalance).toBe(0);
  const shadowed = exposureStats(
    lumaImage(10, 4, (x) => (x < 5 ? 160 : 80)),
    10,
    4,
  );
  expect(shadowed.sideImbalance).toBeCloseTo(0.5, 5);
});

test("exposureStats: empty input does not divide by zero", () => {
  expect(exposureStats(new Float32Array(0), 0, 0).meanLuma).toBe(0);
});

test("innerRegion keeps the centre and drops the margins", () => {
  // 10x10 image whose value is x + 10*y; margins 20% and 10%.
  const inner = innerRegion(
    lumaImage(10, 10, (x, y) => x + 10 * y),
    10,
    10,
    0.2,
    0.1,
  );
  expect([inner.width, inner.height]).toEqual([6, 8]);
  expect(inner.luma[0]).toBe(12); // x=2, y=1
  expect(inner.luma[inner.luma.length - 1]).toBe(87); // x=7, y=8
});

test("innerRegion with margins that leave nothing returns an empty image", () => {
  const inner = innerRegion(new Float32Array(16), 4, 4, 0.5, 0.5);
  expect(inner.luma.length).toBe(0);
});
