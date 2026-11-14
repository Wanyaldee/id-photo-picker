import { expect, test } from "vite-plus/test";
import { DEFAULT_CONFIG } from "../src/scoring/config";
import { ramp, scorePhoto } from "../src/scoring/score";
import type { Analysis, FaceMeasurements } from "../src/scoring/types";

// A well-shot portrait in a 3000x4000 photo with plenty of margin.
const goodFace: FaceMeasurements = {
  foreheadTopY: 1300,
  chinY: 2300,
  centerX: 1500,
  eyeBlink: 0.1,
  jawOpen: 0.02,
  smile: 0.2,
  yawDeg: 1,
  pitchDeg: -2,
  rollDeg: 0.5,
  sharpness: 300,
  meanLuma: 150,
  overexposedFraction: 0,
  underexposedFraction: 0.01,
  sideImbalance: 0.05,
};

const one = (face: Partial<FaceMeasurements> = {}): Analysis => ({
  faceCount: 1,
  face: { ...goodFace, ...face },
});

function scored(analysis: Analysis, width = 3000, height = 4000, config = DEFAULT_CONFIG) {
  const result = scorePhoto(analysis, width, height, config);
  if (result.kind !== "scored") throw new Error(`expected a scored photo, got ${result.reason}`);
  return result;
}

test("ramp is linear between its ends and clamped outside, in either direction", () => {
  expect(ramp(5, 0, 10)).toBe(0.5);
  expect(ramp(-1, 0, 10)).toBe(0);
  expect(ramp(11, 0, 10)).toBe(1);
  expect(ramp(5, 10, 0)).toBe(0.5); // lower is better
  expect(ramp(12, 10, 0)).toBe(0);
});

test("no face and several faces are excluded with a reason", () => {
  expect(scorePhoto({ faceCount: 0, face: null }, 100, 100, DEFAULT_CONFIG)).toEqual({
    kind: "excluded",
    reason: "noFace",
    faceCount: 0,
  });
  expect(scorePhoto({ faceCount: 3, face: null }, 100, 100, DEFAULT_CONFIG)).toEqual({
    kind: "excluded",
    reason: "multipleFaces",
    faceCount: 3,
  });
});

test("a good portrait scores 100 with no reasons", () => {
  const result = scored(one());
  expect(result.total).toBeCloseTo(100, 6);
  expect(result.reasons).toEqual([]);
  expect(result.items.map((item) => item.key)).toEqual([
    "focus",
    "eyes",
    "mouth",
    "pose",
    "exposure",
    "composition",
    "resolution",
  ]);
});

test("closed eyes lose the eyes item and halve what is left", () => {
  const result = scored(one({ eyeBlink: 0.9 }));
  // Weighted average is 80/100 (eyes weight 20 lost), then × 0.5.
  expect(result.total).toBeCloseTo(40, 6);
  expect(result.reasons).toEqual(["eyesClosed"]);
});

test("each fault produces its own reason", () => {
  const cases: [Partial<FaceMeasurements>, string][] = [
    [{ sharpness: 10 }, "blurry"],
    [{ jawOpen: 0.5 }, "mouthOpen"],
    [{ smile: 0.95 }, "strongSmile"],
    [{ yawDeg: -25 }, "turnedSideways"],
    [{ pitchDeg: 22 }, "lookingUpOrDown"],
    [{ rollDeg: 18 }, "headTilted"],
    [{ meanLuma: 40 }, "tooDark"],
    [{ meanLuma: 245 }, "tooBright"],
    [{ overexposedFraction: 0.3 }, "overexposed"],
    [{ underexposedFraction: 0.3 }, "underexposed"],
    [{ sideImbalance: 0.5 }, "unevenLight"],
  ];
  for (const [fault, reason] of cases) {
    const result = scored(one(fault));
    expect(result.reasons, reason).toEqual([reason]);
    expect(result.total, reason).toBeLessThan(100);
  }
});

test("pose: 5° is free, 10° is a mild deduction, 20° scores zero", () => {
  const poseScore = (yawDeg: number) =>
    scored(one({ yawDeg })).items.find((item) => item.key === "pose")?.score;
  expect(poseScore(5)).toBe(1);
  expect(poseScore(10)).toBeCloseTo(2 / 3, 6);
  expect(poseScore(-20)).toBe(0);
});

test("a face cut off by the photo edge is short of margin", () => {
  // Same face, but the photo ends right under the chin.
  const result = scored(one(), 3000, 2350);
  expect(result.reasons).toContain("notEnoughMargin");
});

test("a small face in a small photo is low resolution", () => {
  // Forehead-to-chin 90 px -> frame is about 160 px wide, under half of 354.
  const result = scored(one({ foreheadTopY: 300, chinY: 390, centerX: 400 }), 800, 1000);
  expect(result.reasons).toEqual(["lowResolution"]);
  expect(result.crop.width).toBeLessThan(354 * 0.5);
});

test("weights change the total; zero weight removes an item's influence", () => {
  const blurry = one({ sharpness: 10 });
  expect(scored(blurry).total).toBeCloseTo(80, 6);
  const noFocus = { ...DEFAULT_CONFIG, weightFocus: 0 };
  expect(scored(blurry, 3000, 4000, noFocus).total).toBeCloseTo(100, 6);
});

test("all weights zero gives 0 rather than NaN", () => {
  const zero = {
    ...DEFAULT_CONFIG,
    weightFocus: 0,
    weightEyes: 0,
    weightMouth: 0,
    weightPose: 0,
    weightExposure: 0,
    weightComposition: 0,
    weightResolution: 0,
  };
  expect(scored(one(), 3000, 4000, zero).total).toBe(0);
});
