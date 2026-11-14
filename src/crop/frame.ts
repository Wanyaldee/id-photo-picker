import type { Rect } from "../scoring/types";
import { ASPECT_WIDTH_OVER_HEIGHT, OUTPUT_HEIGHT_PX, OUTPUT_WIDTH_PX } from "./autoCrop";

// Geometry of the 3:4 crop frame, in image pixels. Pure functions: the crop
// editor calls these on every drag, and the tests pin their behaviour.

// The frame can never be narrower than this; below it the handle is too
// small to grab and the result would be a blur anyway.
export const MIN_FRAME_WIDTH_PX = 30;

// Widest 3:4 frame that fits in the image.
export function maxFrameWidth(imageWidth: number, imageHeight: number): number {
  return Math.min(imageWidth, imageHeight * ASPECT_WIDTH_OVER_HEIGHT);
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

// Returns a 3:4 frame that lies fully inside the image: the width is limited
// to what fits (keeping the centre), then the frame is pushed back inside.
// The height is always derived from the width, so the ratio cannot drift.
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

export function moveFrame(
  frame: Rect,
  dx: number,
  dy: number,
  imageWidth: number,
  imageHeight: number,
): Rect {
  return fitFrame({ ...frame, x: frame.x + dx, y: frame.y + dy }, imageWidth, imageHeight);
}

// Changes the frame width around its centre.
export function resizeFrame(
  frame: Rect,
  width: number,
  imageWidth: number,
  imageHeight: number,
): Rect {
  const height = width / ASPECT_WIDTH_OVER_HEIGHT;
  const grown = {
    x: frame.x + (frame.width - width) / 2,
    y: frame.y + (frame.height - height) / 2,
    width,
    height,
  };
  return fitFrame(grown, imageWidth, imageHeight);
}

// Starting frame for a photo without a detected face: centred, 80% of the
// largest frame that fits, so there is visible room to move it.
export function centeredFrame(imageWidth: number, imageHeight: number): Rect {
  const width = maxFrameWidth(imageWidth, imageHeight) * 0.8;
  const height = width / ASPECT_WIDTH_OVER_HEIGHT;
  return { x: (imageWidth - width) / 2, y: (imageHeight - height) / 2, width, height };
}

export type ExportSizeKind = "print" | "large";
export type Size = { width: number; height: number };

// Pixel size of the exported file.
// - print: always 354 x 472 (30 x 40 mm at 300 dpi).
// - large: the frame at the photo's own resolution, rounded down to a whole
//   multiple of 3 x 4 so the ratio is exact, and never smaller than print.
export function exportSize(kind: ExportSizeKind, frameWidth: number): Size {
  const printUnit = OUTPUT_WIDTH_PX / 3; // 118; also OUTPUT_HEIGHT_PX / 4
  if (kind === "print") return { width: OUTPUT_WIDTH_PX, height: OUTPUT_HEIGHT_PX };
  const unit = Math.max(printUnit, Math.floor(frameWidth / 3));
  return { width: unit * 3, height: unit * 4 };
}

export type ExportFormat = "png" | "jpeg";

// "photo.JPG" -> "photo_idphoto.png" (CLAUDE.md §4). Only the last extension
// is replaced; a name without one just gets the suffix.
export function exportFileName(originalName: string, format: ExportFormat): string {
  const dot = originalName.lastIndexOf(".");
  const stem = dot > 0 ? originalName.slice(0, dot) : originalName;
  return `${stem}_idphoto.${format === "png" ? "png" : "jpg"}`;
}
