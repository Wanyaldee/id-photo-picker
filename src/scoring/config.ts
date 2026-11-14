// Every weight and threshold used for scoring. The settings panel shows one
// slider per key of ScoringConfig, and the user's changes are stored in
// localStorage (numbers only — never photos).
//
// Each scored item maps a measurement onto 0..1 with a straight line between
// a "full marks" value and a "zero marks" value (see `ramp` in score.ts).

export type ScoringConfig = {
  weightFocus: number;
  weightEyes: number;
  weightMouth: number;
  weightPose: number;
  weightExposure: number;
  weightComposition: number;
  weightResolution: number;

  focusSharp: number;
  focusBlurry: number;

  eyeBlinkOpen: number;
  eyeBlinkClosed: number;
  eyesClosedMultiplier: number;

  jawClosed: number;
  jawOpen: number;
  smileAllowed: number;
  smileTooStrong: number;

  poseGoodDeg: number;
  poseBadDeg: number;

  lumaTooDark: number;
  lumaGoodMin: number;
  lumaGoodMax: number;
  lumaTooBright: number;
  clippedAllowed: number;
  clippedBad: number;
  sideImbalanceAllowed: number;
  sideImbalanceBad: number;

  cropFitBad: number;
  resolutionBadRatio: number;

  tagThreshold: number;
};

export const DEFAULT_CONFIG: ScoringConfig = {
  // Weights are relative; the total is normalised, so they need not sum to
  // 100 (the defaults do, to read as percentages). Focus, eyes and pose are
  // the faults that cannot be fixed by cropping, so they weigh the most.
  weightFocus: 20,
  weightEyes: 20,
  weightMouth: 10,
  weightPose: 20,
  weightExposure: 15,
  weightComposition: 10,
  weightResolution: 5,

  // Variance of the Laplacian over the face, after the face is resampled to
  // FACE_SAMPLE_WIDTH_PX wide (8-bit luma). Measured on sample portraits
  // (docs/adr/0003-scoring.md): sharp studio portraits read 119–538, the same
  // photo with a 3 px blur reads 6.
  focusSharp: 100,
  focusBlurry: 20,

  // MediaPipe eyeBlink blendshape. Relaxed open eyes read about 0.05–0.2;
  // a blink reads above 0.6.
  eyeBlinkOpen: 0.25,
  eyeBlinkClosed: 0.6,
  // Closed eyes make a photo unusable however good the rest is, so on top of
  // the weighted item the total is multiplied by a factor that falls from 1
  // (eyes open) to this value (eyes closed).
  eyesClosedMultiplier: 0.5,

  // jawOpen blendshape: a closed mouth reads below ~0.05, talking ~0.3+.
  jawClosed: 0.08,
  jawOpen: 0.35,
  // A slight smile is fine on a résumé photo; a broad grin is not.
  smileAllowed: 0.5,
  smileTooStrong: 0.9,

  // Largest of |yaw|, |pitch|, |roll|. Up to 5° is indistinguishable from
  // frontal; CLAUDE.md §3 names ±10° as where deductions should bite (score
  // 0.67 here, and the tag appears just past it); 20° is clearly turned.
  poseGoodDeg: 5,
  poseBadDeg: 20,

  // Mean 8-bit luma of the inner face (skin). The lower limits are set low on
  // purpose: correctly exposed dark skin reads around 70–90, and must not be
  // reported as "too dark". Below 30 any face is lost in shadow; above 240
  // any face is washed out.
  lumaTooDark: 30,
  lumaGoodMin: 65,
  lumaGoodMax: 200,
  lumaTooBright: 240,
  // Fraction of inner-face pixels that are clipped white or black. Pupils,
  // lashes and small highlights make up a few percent; 20% means lost detail.
  clippedAllowed: 0.05,
  clippedBad: 0.2,
  // |left − right| / brighter side, comparing the two halves of the inner
  // face. Ordinary studio key lighting measures 0.25–0.3 on the sample
  // portraits; 0.6 is one side clearly in shadow.
  sideImbalanceAllowed: 0.3,
  sideImbalanceBad: 0.6,

  // Fraction of the automatic 3:4 crop that lies inside the photo. Below 1
  // the photo lacks margin somewhere; below 0.85 the crop is not usable.
  cropFitBad: 0.85,
  // Crop width relative to the 354 px needed for print. At 1 no upscaling is
  // needed; at 0.5 the print would be visibly soft.
  resolutionBadRatio: 0.5,

  // An item scoring below this shows its reason as a tag on the card.
  tagThreshold: 0.6,
};

// --- Fixed values (not user-adjustable) -----------------------------------

// The face is resampled to this width before measuring sharpness, so the
// number means "how sharp is the face at roughly print size" rather than
// depending on how many megapixels the camera has. In a 354 px wide ID photo
// the face is about 200–250 px wide.
export const FACE_SAMPLE_WIDTH_PX = 256;

// 8-bit luma at or beyond these counts as clipped.
export const CLIP_WHITE_LUMA = 250;
export const CLIP_BLACK_LUMA = 10;

// Exposure is measured on the inner part of the face box only: the outer
// 20% on each side and 15% at top and bottom are mostly hair, ears and
// background, which would be counted as "clipped black" for dark hair.
export const FACE_INNER_MARGIN_X = 0.2;
export const FACE_INNER_MARGIN_Y = 0.15;
