import type { Rect } from "../scoring/types";

// Output of the small export: 30 x 40 mm at 300 dpi (CLAUDE.md §4).
export const OUTPUT_WIDTH_PX = 354;
export const OUTPUT_HEIGHT_PX = 472;
export const ASPECT_WIDTH_OVER_HEIGHT = 3 / 4;

// Face-mesh landmark 10 sits at the top of the forehead, not the top of the
// head. The crown (with hair) is estimated to lie this fraction of the
// forehead-to-chin distance above it. Skull proportions put the bare crown
// about 0.25 above; 0.3 leaves room for typical hair. Hair varies, so this is
// only the starting point — the user adjusts the frame by eye.
export const HEAD_TOP_EXTENSION = 0.3;

// Layout of a 40 x 30 mm résumé photo, as fractions of the crop height. There
// is no official standard for résumé photos beyond "upper body, facing
// front"; these follow the usual studio convention: head (crown to chin)
// about 22 mm of 40 mm, 3–4 mm of background above the head, and enough room
// below the chin for the collar and shoulders.
export const HEAD_HEIGHT_RATIO = 0.55;
export const TOP_MARGIN_RATIO = 0.09;

export type HeadPosition = { foreheadTopY: number; chinY: number; centerX: number };

export function estimateHeadTopY(head: HeadPosition): number {
  return head.foreheadTopY - HEAD_TOP_EXTENSION * (head.chinY - head.foreheadTopY);
}

// The 3:4 frame that puts the head at the conventional size and position.
// The result may extend beyond the photo when there is not enough margin;
// `fractionInside` reports how much of it is usable.
export function autoCrop(head: HeadPosition): Rect {
  const headTopY = estimateHeadTopY(head);
  const height = (head.chinY - headTopY) / HEAD_HEIGHT_RATIO;
  const width = height * ASPECT_WIDTH_OVER_HEIGHT;
  return {
    x: head.centerX - width / 2,
    y: headTopY - TOP_MARGIN_RATIO * height,
    width,
    height,
  };
}

// Fraction (0..1) of `rect`'s area that lies inside an image of the given size.
export function fractionInside(rect: Rect, imageWidth: number, imageHeight: number): number {
  const insideWidth = Math.min(rect.x + rect.width, imageWidth) - Math.max(rect.x, 0);
  const insideHeight = Math.min(rect.y + rect.height, imageHeight) - Math.max(rect.y, 0);
  if (insideWidth <= 0 || insideHeight <= 0 || rect.width <= 0 || rect.height <= 0) return 0;
  return (insideWidth * insideHeight) / (rect.width * rect.height);
}
