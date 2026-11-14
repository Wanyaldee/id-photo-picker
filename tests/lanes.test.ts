import { expect, test } from "vite-plus/test";
import { runOnLanes } from "../src/analysis/lanes";

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 1));

test("runs every item exactly once and never exceeds the lane count", async () => {
  const seen: number[] = [];
  let running = 0;
  let peak = 0;
  await runOnLanes(
    10,
    2,
    async (itemIndex) => {
      running += 1;
      peak = Math.max(peak, running);
      await tick();
      seen.push(itemIndex);
      running -= 1;
    },
    new AbortController().signal,
  );
  expect([...seen].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  expect(peak).toBe(2);
});

test("a lane only ever runs one item at a time", async () => {
  const busy = new Set<number>();
  await runOnLanes(
    6,
    3,
    async (_itemIndex, laneIndex) => {
      expect(busy.has(laneIndex)).toBe(false);
      busy.add(laneIndex);
      await tick();
      busy.delete(laneIndex);
    },
    new AbortController().signal,
  );
});

test("stops starting new items after abort", async () => {
  const controller = new AbortController();
  const started: number[] = [];
  await runOnLanes(
    100,
    2,
    async (itemIndex) => {
      started.push(itemIndex);
      if (itemIndex === 3) controller.abort();
      await tick();
    },
    controller.signal,
  );
  // Items 0..3 started before the abort; the other lane may already have
  // been inside its loop check, so nothing beyond index 4 can start.
  expect(started.length).toBeLessThanOrEqual(5);
});

test("zero items resolves without calling the task", async () => {
  let calls = 0;
  await runOnLanes(
    0,
    2,
    async () => {
      calls += 1;
    },
    new AbortController().signal,
  );
  expect(calls).toBe(0);
});
