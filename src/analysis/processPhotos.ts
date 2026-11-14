import { WORKER_COUNT } from "./config";
import { runOnLanes } from "./lanes";
import type { PhotoRequest, PhotoResult } from "./messages";

export type PhotoJob = { id: number; file: File };

// Sends one request to a worker and resolves with its reply. Each worker
// handles one photo at a time (see runOnLanes), so the next message it posts
// is the reply to this request. A crashed worker resolves as a failed photo
// rather than hanging the batch.
function requestPhoto(worker: Worker, job: PhotoJob): Promise<PhotoResult> {
  return new Promise((resolve) => {
    worker.onmessage = (event: MessageEvent<PhotoResult>) => resolve(event.data);
    worker.onerror = (event) =>
      resolve({ id: job.id, ok: false, reason: "decode-failed", detail: event.message });
    const request: PhotoRequest = { id: job.id, file: job.file };
    worker.postMessage(request);
  });
}

// Processes `jobs` on a small pool of workers, reporting each result as it
// arrives. Resolves when every job is done or, after abort, when the photos
// already in flight have finished. Workers are terminated at the end so their
// memory is released between batches.
export async function processPhotos(
  jobs: readonly PhotoJob[],
  onResult: (result: PhotoResult) => void,
  signal: AbortSignal,
): Promise<void> {
  const workers = Array.from(
    { length: Math.min(WORKER_COUNT, jobs.length) },
    () => new Worker(new URL("./photoWorker.ts", import.meta.url), { type: "module" }),
  );
  try {
    await runOnLanes(
      jobs.length,
      workers.length,
      async (itemIndex, laneIndex) => {
        const job = jobs[itemIndex];
        const worker = workers[laneIndex];
        if (!job || !worker) return;
        onResult(await requestPhoto(worker, job));
      },
      signal,
    );
  } finally {
    for (const worker of workers) worker.terminate();
  }
}
