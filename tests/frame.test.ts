import { expect, test } from "vite-plus/test";
import { OUTPUT_HEIGHT_PX, OUTPUT_WIDTH_PX } from "../src/crop/autoCrop";
import {
  centeredFrame,
  exportFileName,
  exportSize,
  fitFrame,
  maxFrameWidth,
  MIN_FRAME_WIDTH_PX,
  moveFrame,
  resizeFrame,
} from "../src/crop/frame";
import type { Rect } from "../src/scoring/types";

const W = 3000;
const H = 4000;

function expectInsideAnd3to4(frame: Rect, imageWidth = W, imageHeight = H) {
  expect(frame.width / frame.height).toBeCloseTo(3 / 4, 10);
  expect(frame.x).toBeGreaterThanOrEqual(0);
  expect(frame.y).toBeGreaterThanOrEqual(0);
  expect(frame.x + frame.width).toBeLessThanOrEqual(imageWidth + 1e-9);
  expect(frame.y + frame.height).toBeLessThanOrEqual(imageHeight + 1e-9);
}

test("maxFrameWidth is limited by whichever side runs out first", () => {
  expect(maxFrameWidth(3000, 4000)).toBe(3000);
  expect(maxFrameWidth(4000, 3000)).toBe(2250); // landscape: height limits
  expect(maxFrameWidth(1000, 4000)).toBe(1000);
});

test("a frame that already fits is returned unchanged", () => {
  const frame = { x: 600, y: 800, width: 900, height: 1200 };
  expect(fitFrame(frame, W, H)).toEqual(frame);
});

test("a frame hanging over an edge is pushed back inside", () => {
  expectInsideAnd3to4(fitFrame({ x: -200, y: -300, width: 900, height: 1200 }, W, H));
  const pushed = fitFrame({ x: 2500, y: 3500, width: 900, height: 1200 }, W, H);
  expect(pushed).toEqual({ x: 2100, y: 2800, width: 900, height: 1200 });
});

test("a frame larger than the image is shrunk to the largest that fits", () => {
  const fitted = fitFrame({ x: -500, y: -500, width: 6000, height: 8000 }, 4000, 3000);
  expect(fitted.width).toBe(2250);
  expect(fitted.height).toBe(3000);
  expectInsideAnd3to4(fitted, 4000, 3000);
});

test("a wrong height in the input cannot break the ratio", () => {
  expectInsideAnd3to4(fitFrame({ x: 100, y: 100, width: 900, height: 5 }, W, H));
});

test("moving stops at the image edge", () => {
  const frame = { x: 600, y: 800, width: 900, height: 1200 };
  expect(moveFrame(frame, 100, -50, W, H)).toEqual({ ...frame, x: 700, y: 750 });
  expect(moveFrame(frame, -10_000, 0, W, H).x).toBe(0);
  expect(moveFrame(frame, 0, 10_000, W, H).y).toBe(H - 1200);
});

test("resizing keeps the centre while there is room", () => {
  const frame = { x: 600, y: 800, width: 900, height: 1200 };
  const resized = resizeFrame(frame, 600, W, H);
  expect(resized).toEqual({ x: 750, y: 1000, width: 600, height: 800 });
});

test("resizing is limited to the image and to the minimum width", () => {
  const frame = { x: 600, y: 800, width: 900, height: 1200 };
  expect(resizeFrame(frame, 99_999, W, H)).toEqual({ x: 0, y: 0, width: 3000, height: 4000 });
  expect(resizeFrame(frame, 1, W, H).width).toBe(MIN_FRAME_WIDTH_PX);
});

test("centeredFrame is 3:4, inside, and in the middle", () => {
  const frame = centeredFrame(4000, 3000);
  expectInsideAnd3to4(frame, 4000, 3000);
  expect(frame.x + frame.width / 2).toBeCloseTo(2000, 10);
  expect(frame.y + frame.height / 2).toBeCloseTo(1500, 10);
});

test("print export is exactly 354 x 472 whatever the frame size", () => {
  for (const frameWidth of [50, 354, 1000, 2999.5]) {
    expect(exportSize("print", frameWidth)).toEqual({ width: 354, height: 472 });
  }
  expect([OUTPUT_WIDTH_PX, OUTPUT_HEIGHT_PX]).toEqual([354, 472]);
});

test("large export uses the frame's own pixels at an exact 3:4", () => {
  expect(exportSize("large", 1500)).toEqual({ width: 1500, height: 2000 });
  // 1001 is not a multiple of 3: rounded down to 999 x 1332.
  expect(exportSize("large", 1001.7)).toEqual({ width: 999, height: 1332 });
  for (const frameWidth of [355, 800.4, 2250, 2999]) {
    const size = exportSize("large", frameWidth);
    expect(size.width * 4).toBe(size.height * 3);
    expect(size.width).toBeLessThanOrEqual(frameWidth);
  }
});

test("large export is never smaller than the print size", () => {
  expect(exportSize("large", 200)).toEqual({ width: 354, height: 472 });
});

test("export file names follow 元名_idphoto.ext", () => {
  expect(exportFileName("IMG_0123.JPG", "png")).toBe("IMG_0123_idphoto.png");
  expect(exportFileName("my.photo.webp", "jpeg")).toBe("my.photo_idphoto.jpg");
  expect(exportFileName("noextension", "png")).toBe("noextension_idphoto.png");
  expect(exportFileName(".hidden", "png")).toBe(".hidden_idphoto.png");
});
