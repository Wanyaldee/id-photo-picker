// Runs `task` for item indexes 0..itemCount-1 on `laneCount` lanes. Each lane
// takes the next unstarted index when it finishes its current one, so at most
// `laneCount` tasks run at once. A lane maps 1:1 to a Web Worker.
//
// After `signal` aborts, no new item is started; items already running finish.
// `task` must not throw — it reports its own failure per item, so one bad
// photo cannot stop the rest of the batch.
export async function runOnLanes(
  itemCount: number,
  laneCount: number,
  task: (itemIndex: number, laneIndex: number) => Promise<void>,
  signal: AbortSignal,
): Promise<void> {
  let next = 0;
  async function runLane(laneIndex: number): Promise<void> {
    while (next < itemCount && !signal.aborted) {
      const itemIndex = next;
      next += 1;
      await task(itemIndex, laneIndex);
    }
  }
  const lanes = Array.from({ length: Math.min(laneCount, itemCount) }, (_, i) => runLane(i));
  await Promise.all(lanes);
}
