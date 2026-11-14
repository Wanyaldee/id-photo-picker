import { autoCrop, fractionInside, OUTPUT_WIDTH_PX } from "../crop/autoCrop";
import type { ScoringConfig } from "./config";
import type { Analysis, FaceMeasurements, Rect } from "./types";

export type ItemKey =
  | "focus"
  | "eyes"
  | "mouth"
  | "pose"
  | "exposure"
  | "composition"
  | "resolution";

export type ReasonKey =
  | "blurry"
  | "eyesClosed"
  | "mouthOpen"
  | "strongSmile"
  | "turnedSideways"
  | "lookingUpOrDown"
  | "headTilted"
  | "tooDark"
  | "tooBright"
  | "overexposed"
  | "underexposed"
  | "unevenLight"
  | "notEnoughMargin"
  | "lowResolution";

export type ExclusionKey = "noFace" | "multipleFaces";

export type ItemScore = { key: ItemKey; score: number; weight: number };

export type PhotoScore =
  | { kind: "excluded"; reason: ExclusionKey; faceCount: number }
  | {
      kind: "scored";
      total: number; // 0..100
      items: ItemScore[];
      reasons: ReasonKey[];
      // The automatic 3:4 frame, in image pixels. May reach outside the photo.
      crop: Rect;
    };

// Straight line from 0 at `zeroAt` to 1 at `oneAt`, clamped to 0..1.
// `zeroAt` may be above or below `oneAt`, so the same function serves
// "higher is better" and "lower is better" measurements.
export function ramp(value: number, zeroAt: number, oneAt: number): number {
  if (zeroAt === oneAt) return value >= oneAt ? 1 : 0;
  return Math.max(0, Math.min(1, (value - zeroAt) / (oneAt - zeroAt)));
}

// An item is the minimum of its parts: one bad part is not rescued by a good
// one. Each part names the reason shown when it is the problem.
type Part = { score: number; reason: ReasonKey };

function exposureParts(face: FaceMeasurements, c: ScoringConfig): Part[] {
  return [
    { score: ramp(face.meanLuma, c.lumaTooDark, c.lumaGoodMin), reason: "tooDark" },
    { score: ramp(face.meanLuma, c.lumaTooBright, c.lumaGoodMax), reason: "tooBright" },
    {
      score: ramp(face.overexposedFraction, c.clippedBad, c.clippedAllowed),
      reason: "overexposed",
    },
    {
      score: ramp(face.underexposedFraction, c.clippedBad, c.clippedAllowed),
      reason: "underexposed",
    },
    {
      score: ramp(face.sideImbalance, c.sideImbalanceBad, c.sideImbalanceAllowed),
      reason: "unevenLight",
    },
  ];
}

function itemParts(
  face: FaceMeasurements,
  crop: Rect,
  imageWidth: number,
  imageHeight: number,
  c: ScoringConfig,
): Record<ItemKey, Part[]> {
  const poseScore = (degrees: number) => ramp(Math.abs(degrees), c.poseBadDeg, c.poseGoodDeg);
  return {
    focus: [{ score: ramp(face.sharpness, c.focusBlurry, c.focusSharp), reason: "blurry" }],
    eyes: [{ score: ramp(face.eyeBlink, c.eyeBlinkClosed, c.eyeBlinkOpen), reason: "eyesClosed" }],
    mouth: [
      { score: ramp(face.jawOpen, c.jawOpen, c.jawClosed), reason: "mouthOpen" },
      { score: ramp(face.smile, c.smileTooStrong, c.smileAllowed), reason: "strongSmile" },
    ],
    pose: [
      { score: poseScore(face.yawDeg), reason: "turnedSideways" },
      { score: poseScore(face.pitchDeg), reason: "lookingUpOrDown" },
      { score: poseScore(face.rollDeg), reason: "headTilted" },
    ],
    exposure: exposureParts(face, c),
    composition: [
      {
        score: ramp(fractionInside(crop, imageWidth, imageHeight), c.cropFitBad, 1),
        reason: "notEnoughMargin",
      },
    ],
    resolution: [
      {
        score: ramp(crop.width / OUTPUT_WIDTH_PX, c.resolutionBadRatio, 1),
        reason: "lowResolution",
      },
    ],
  };
}

function weightOf(key: ItemKey, c: ScoringConfig): number {
  const weights: Record<ItemKey, number> = {
    focus: c.weightFocus,
    eyes: c.weightEyes,
    mouth: c.weightMouth,
    pose: c.weightPose,
    exposure: c.weightExposure,
    composition: c.weightComposition,
    resolution: c.weightResolution,
  };
  return weights[key];
}

const ITEM_ORDER: ItemKey[] = [
  "focus",
  "eyes",
  "mouth",
  "pose",
  "exposure",
  "composition",
  "resolution",
];

// Scores one analysed photo. Pure: same inputs, same output, no DOM.
//
// total = 100 × (Σ weight·item / Σ weight) × eyesFactor
// where eyesFactor goes from 1 (eyes open) down to eyesClosedMultiplier.
export function scorePhoto(
  analysis: Analysis,
  imageWidth: number,
  imageHeight: number,
  config: ScoringConfig,
): PhotoScore {
  if (analysis.faceCount === 0 || !analysis.face) {
    return {
      kind: "excluded",
      reason: analysis.faceCount > 1 ? "multipleFaces" : "noFace",
      faceCount: analysis.faceCount,
    };
  }
  if (analysis.faceCount > 1) {
    return { kind: "excluded", reason: "multipleFaces", faceCount: analysis.faceCount };
  }

  const face = analysis.face;
  const crop = autoCrop(face);
  const parts = itemParts(face, crop, imageWidth, imageHeight, config);

  const items: ItemScore[] = [];
  const reasons: ReasonKey[] = [];
  let weighted = 0;
  let weightSum = 0;
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
}
