import { expect, test } from "vite-plus/test";
import { cleanPersonMask, personAlphaMask } from "../src/background/mask";

const alphas = (rgba: Uint8ClampedArray) => Array.from(rgba).filter((_, i) => i % 4 === 3);

test("alpha is 0 below low, 255 above high, and half-way in the middle", () => {
  const mask = personAlphaMask(new Float32Array([0, 0.35, 0.5, 0.65, 1]), 0.35, 0.65);
  expect(alphas(mask)).toEqual([0, 0, 128, 255, 255]);
});

test("alpha rises monotonically through the blend band", () => {
  const steps = Float32Array.from({ length: 31 }, (_, i) => 0.35 + (i * 0.3) / 30);
  const values = alphas(personAlphaMask(steps, 0.35, 0.65));
  for (let i = 1; i < values.length; i++) {
    expect(values[i]).toBeGreaterThanOrEqual(values[i - 1] ?? 0);
  }
});

test("colour channels stay zero; only alpha carries the mask", () => {
  const mask = personAlphaMask(new Float32Array([1, 0]), 0.35, 0.65);
  expect(Array.from(mask)).toEqual([0, 0, 0, 255, 0, 0, 0, 0]);
});

test("low === high is a hard threshold", () => {
  expect(alphas(personAlphaMask(new Float32Array([0.49, 0.5, 0.51]), 0.5, 0.5))).toEqual([
    0, 255, 255,
  ]);
});

// Builds a mask from rows of characters: "#" solid person (0.9), "."
// background (0.1), "+" and "-" soft edge (0.6 and 0.4: visible, not solid).
function mask(rows: string[]) {
  const values: Record<string, number> = { "#": 0.9, ".": 0.1, "+": 0.6, "-": 0.4 };
  const width = rows[0]?.length ?? 0;
  const data = Float32Array.from(rows.join(""), (char) => values[char] ?? 0);
  return { data, width, height: rows.length };
}
function show(data: Float32Array, width: number): string[] {
  const rows: string[] = [];
  for (let start = 0; start < data.length; start += width) {
    rows.push(
      Array.from(data.subarray(start, start + width), (value) =>
        value === 1 ? "F" : value === 0 ? "x" : value >= 0.5 ? "#" : ".",
      ).join(""),
    );
  }
  return rows;
}
const clean = (rows: string[]) => {
  const { data, width, height } = mask(rows);
  return show(cleanPersonMask(data, width, height, 0.35, 0.65), width);
};

test("a stray piece not attached to the person is removed (x)", () => {
  expect(clean([".......", ".###...", ".###.#.", ".###...", "......."])).toEqual([
    ".......",
    ".###...",
    ".###.x.",
    ".###...",
    ".......",
  ]);
});

test("a hole enclosed by the person is filled (F)", () => {
  expect(clean([".....", ".###.", ".#.#.", ".###.", "....."])).toEqual([
    ".....",
    ".###.",
    ".#F#.",
    ".###.",
    ".....",
  ]);
});

test("the soft ring around a hole is made solid together with the hole", () => {
  expect(clean(["#####", "#+++#", "#+.+#", "#+++#", "#####"])).toEqual([
    "#####",
    "#FFF#",
    "#FFF#",
    "#FFF#",
    "#####",
  ]);
});

test("a stray piece is removed together with its faint halo", () => {
  expect(clean(["###....", "###.-+-", "###...."])).toEqual(["###....", "###.xxx", "###...."]);
});

test("background that reaches the border is not a hole", () => {
  // The gap opens to the top edge, like the space between head and shoulder.
  expect(clean(["#.#", "#.#", "###"])).toEqual(["#.#", "#.#", "###"]);
});

test("a person touching the border (shoulders at the bottom) is kept", () => {
  expect(clean(["..#..", ".###.", "#####"])).toEqual(["..#..", ".###.", "#####"]);
});

test("diagonal contact does not connect regions", () => {
  expect(clean(["##..", "##..", "..#.", "...."])).toEqual(["##..", "##..", "..x.", "...."]);
});

test("unchanged pixels keep their original confidence (soft edges survive)", () => {
  const { data, width, height } = mask(["-+#", "-+#"]);
  expect(Array.from(cleanPersonMask(data, width, height, 0.35, 0.65))).toEqual(Array.from(data));
});

test("an all-background or all-person mask is returned as it is", () => {
  expect(clean(["...", "..."])).toEqual(["...", "..."]);
  expect(clean(["###", "###"])).toEqual(["###", "###"]);
});
