import type { Rect } from "../scoring/types";
import type { ExportFormat, Size } from "./frame";

// High enough that JPEG artefacts are not visible on skin at print size.
const JPEG_QUALITY = 0.92;

// Decodes the user's file and draws the framed part at the output size.
// The original is decoded again here because only thumbnails are kept in
// memory (ADR 0002); the bitmap is released as soon as it has been drawn.
export async function renderCrop(file: File, frame: Rect, size: Size): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D context is unavailable");
    context.imageSmoothingQuality = "high";
    context.drawImage(
      bitmap,
      frame.x,
      frame.y,
      frame.width,
      frame.height,
      0,
      0,
      size.width,
      size.height,
    );
    return canvas;
  } finally {
    bitmap.close();
  }
}

export function canvasToBlob(canvas: HTMLCanvasElement, format: ExportFormat): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("The image could not be encoded"))),
      format === "png" ? "image/png" : "image/jpeg",
      JPEG_QUALITY,
    );
  });
}

// Saves a blob through a temporary <a download> link. The file goes straight
// from memory to the user's download folder; nothing is uploaded.
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  // The download reads the URL asynchronously; release it afterwards.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
