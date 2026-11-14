import { expect, test } from "vite-plus/test";
import {
  autoCrop,
  estimateHeadTopY,
  fractionInside,
  HEAD_HEIGHT_RATIO,
  TOP_MARGIN_RATIO,
} from "../src/crop/autoCrop";

const head = { foreheadTopY: 1000, chinY: 2000, centerX: 1500 };

test("the crown is estimated above the forehead landmark", () => {
  expect(estimateHeadTopY(head)).toBe(700);
});

test("the frame is 3:4 and centred on the face", () => {
  const crop = autoCrop(head);
  expect(crop.width / crop.height).toBeCloseTo(3 / 4, 10);
  expect(crop.x + crop.width / 2).toBeCloseTo(1500, 10);
});

test("the head takes the conventional share of the frame", () => {
  const crop = autoCrop(head);
  const headTopY = estimateHeadTopY(head);
  expect((head.chinY - headTopY) / crop.height).toBeCloseTo(HEAD_HEIGHT_RATIO, 10);
  expect((headTopY - crop.y) / crop.height).toBeCloseTo(TOP_MARGIN_RATIO, 10);
});

test("fractionInside is 1 when the frame fits and falls as it leaves the photo", () => {
  const rect = { x: 100, y: 100, width: 300, height: 400 };
  expect(fractionInside(rect, 1000, 1000)).toBe(1);
  expect(fractionInside({ ...rect, x: -150 }, 1000, 1000)).toBeCloseTo(0.5, 10);
  expect(fractionInside({ ...rect, y: 800 }, 1000, 1000)).toBeCloseTo(0.5, 10);
  expect(fractionInside({ ...rect, x: 2000 }, 1000, 1000)).toBe(0);
});
