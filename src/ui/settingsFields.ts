import type { ScoringConfig } from "../scoring/config";

// Slider ranges for the settings panel. Labels are in strings.ts.
export type Field = { key: keyof ScoringConfig; min: number; max: number; step: number };
export type FieldGroup = {
  id: "weights" | "focus" | "eyes" | "mouth" | "pose" | "exposure" | "framing";
  fields: Field[];
};

const weight = (key: keyof ScoringConfig): Field => ({ key, min: 0, max: 40, step: 1 });
const unit = (key: keyof ScoringConfig): Field => ({ key, min: 0, max: 1, step: 0.01 });
const luma = (key: keyof ScoringConfig): Field => ({ key, min: 0, max: 255, step: 1 });

export const FIELD_GROUPS: FieldGroup[] = [
  {
    id: "weights",
    fields: [
      weight("weightFocus"),
      weight("weightEyes"),
      weight("weightMouth"),
      weight("weightPose"),
      weight("weightExposure"),
      weight("weightComposition"),
      weight("weightResolution"),
    ],
  },
  {
    id: "focus",
    fields: [
      { key: "focusSharp", min: 0, max: 1000, step: 5 },
      { key: "focusBlurry", min: 0, max: 300, step: 1 },
    ],
  },
  {
    id: "eyes",
    fields: [unit("eyeBlinkOpen"), unit("eyeBlinkClosed"), unit("eyesClosedMultiplier")],
  },
  {
    id: "mouth",
    fields: [unit("jawClosed"), unit("jawOpen"), unit("smileAllowed"), unit("smileTooStrong")],
  },
  {
    id: "pose",
    fields: [
      { key: "poseGoodDeg", min: 0, max: 45, step: 0.5 },
      { key: "poseBadDeg", min: 0, max: 45, step: 0.5 },
    ],
  },
  {
    id: "exposure",
    fields: [
      luma("lumaTooDark"),
      luma("lumaGoodMin"),
      luma("lumaGoodMax"),
      luma("lumaTooBright"),
      { key: "clippedAllowed", min: 0, max: 0.5, step: 0.01 },
      { key: "clippedBad", min: 0, max: 0.5, step: 0.01 },
      unit("sideImbalanceAllowed"),
      unit("sideImbalanceBad"),
    ],
  },
  {
    id: "framing",
    fields: [
      { key: "cropFitBad", min: 0.5, max: 1, step: 0.01 },
      { key: "resolutionBadRatio", min: 0.1, max: 1, step: 0.01 },
      unit("tagThreshold"),
    ],
  },
];
