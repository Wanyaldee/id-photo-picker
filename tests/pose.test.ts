import { expect, test } from "vite-plus/test";
import { headPoseFromMatrix } from "../src/scoring/pose";

const rad = (deg: number) => (deg * Math.PI) / 180;

type M3 = [number[], number[], number[]];
const mul = (a: M3, b: M3): M3 =>
  [0, 1, 2].map((r) =>
    [0, 1, 2].map((c) => [0, 1, 2].reduce((s, k) => s + (a[r]?.[k] ?? 0) * (b[k]?.[c] ?? 0), 0)),
  ) as M3;

// Builds a column-major 4x4 like MediaPipe's: scale · Ry(yaw)·Rx(pitch)·Rz(roll) + translation.
function matrix(yawDeg: number, pitchDeg: number, rollDeg: number, scale = 1): number[] {
  const [y, p, r] = [rad(yawDeg), rad(pitchDeg), rad(rollDeg)];
  const ry: M3 = [
    [Math.cos(y), 0, Math.sin(y)],
    [0, 1, 0],
    [-Math.sin(y), 0, Math.cos(y)],
  ];
  const rx: M3 = [
    [1, 0, 0],
    [0, Math.cos(p), -Math.sin(p)],
    [0, Math.sin(p), Math.cos(p)],
  ];
  const rz: M3 = [
    [Math.cos(r), -Math.sin(r), 0],
    [Math.sin(r), Math.cos(r), 0],
    [0, 0, 1],
  ];
  const m = mul(mul(ry, rx), rz);
  const data = Array.from({ length: 16 }, () => 0);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) data[col * 4 + row] = scale * (m[row]?.[col] ?? 0);
  }
  data[12] = 3; // translation must be ignored
  data[13] = -2;
  data[14] = -40;
  data[15] = 1;
  return data;
}

test("identity matrix is a frontal face", () => {
  const pose = headPoseFromMatrix(matrix(0, 0, 0));
  expect(pose.yawDeg).toBeCloseTo(0, 6);
  expect(pose.pitchDeg).toBeCloseTo(0, 6);
  expect(pose.rollDeg).toBeCloseTo(0, 6);
});

test("recovers each angle on its own", () => {
  expect(headPoseFromMatrix(matrix(25, 0, 0)).yawDeg).toBeCloseTo(25, 5);
  expect(headPoseFromMatrix(matrix(0, -12, 0)).pitchDeg).toBeCloseTo(-12, 5);
  expect(headPoseFromMatrix(matrix(0, 0, 8)).rollDeg).toBeCloseTo(8, 5);
});

test("recovers combined angles and ignores scale and translation", () => {
  const pose = headPoseFromMatrix(matrix(15, -7, 4, 9.5));
  expect(pose.yawDeg).toBeCloseTo(15, 5);
  expect(pose.pitchDeg).toBeCloseTo(-7, 5);
  expect(pose.rollDeg).toBeCloseTo(4, 5);
});

test("an all-zero matrix does not produce NaN", () => {
  const pose = headPoseFromMatrix(Array.from({ length: 16 }, () => 0));
  expect(pose).toEqual({ yawDeg: 0, pitchDeg: 0, rollDeg: 0 });
});
