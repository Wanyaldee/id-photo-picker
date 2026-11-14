// Background replacement settings.

export type BackgroundChoice = "none" | "white" | "lightBlue";

// Plain backgrounds offered for the export. The light blue is the pale tone
// commonly used by ID-photo booths.
export const BACKGROUND_COLORS: Record<Exclude<BackgroundChoice, "none">, string> = {
  white: "#ffffff",
  lightBlue: "#cfe2f3",
};

// The segmenter gives each pixel a confidence (0..1) of belonging to the
// person. Below LOW the pixel becomes background, above HIGH it stays fully
// person, and in between it is blended, which softens the cut-out edge
// instead of leaving a hard, jagged outline.
export const PERSON_CONFIDENCE_LOW = 0.35;
export const PERSON_CONFIDENCE_HIGH = 0.65;

// File under public/mediapipe/models/.
export const SEGMENTER_MODEL_FILE = "selfie_multiclass_256x256.tflite";
// In the multiclass model, mask 0 is "background"; the person is everything
// else (hair, skin, clothes, accessories).
export const BACKGROUND_MASK_INDEX = 0;
