// Messages between the page and the photo worker.

export type PhotoRequest = {
  id: number;
  file: File;
};

export type PhotoResult =
  | { id: number; ok: true; thumbnail: Blob; width: number; height: number }
  | { id: number; ok: false; reason: "decode-failed"; detail: string };
