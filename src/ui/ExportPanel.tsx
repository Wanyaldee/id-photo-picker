import { useEffect, useRef, useState } from "preact/hooks";
import { OUTPUT_HEIGHT_PX, OUTPUT_WIDTH_PX } from "../crop/autoCrop";
import { canvasToBlob, downloadBlob, renderCrop } from "../crop/export";
import { type ExportFormat, exportFileName, exportSize, type ExportSizeKind } from "../crop/frame";
import type { Rect } from "../scoring/types";
import { strings } from "./strings";

// The preview is shown at half the print size.
const PREVIEW_WIDTH = OUTPUT_WIDTH_PX / 2;
const PREVIEW_HEIGHT = OUTPUT_HEIGHT_PX / 2;

type Props = {
  file: File;
  frame: Rect;
  // The <img> already showing the photo; the preview is drawn from it.
  image: HTMLImageElement | null;
};

// Live preview of the framed area, plus size/format choices and the export
// button.
export function ExportPanel({ file, frame, image }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [sizeKind, setSizeKind] = useState<ExportSizeKind>("print");
  const [format, setFormat] = useState<ExportFormat>("png");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const context = canvas.current?.getContext("2d");
    if (!context || !image) return;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      image,
      frame.x,
      frame.y,
      frame.width,
      frame.height,
      0,
      0,
      PREVIEW_WIDTH * 2,
      PREVIEW_HEIGHT * 2,
    );
  }, [image, frame]);

  async function exportPhoto() {
    setBusy(true);
    setError(null);
    try {
      const rendered = await renderCrop(file, frame, exportSize(sizeKind, frame.width));
      downloadBlob(await canvasToBlob(rendered, format), exportFileName(file.name, format));
    } catch (cause) {
      setError(strings.exportFailed(String(cause)));
    } finally {
      setBusy(false);
    }
  }

  const large = exportSize("large", frame.width);
  return (
    <section class="export">
      <h3>{strings.exportTitle}</h3>
      <div class="export-body">
        {/* Backing store is the full print size; CSS shows it at half. */}
        <canvas
          ref={canvas}
          class="export-preview"
          width={PREVIEW_WIDTH * 2}
          height={PREVIEW_HEIGHT * 2}
          aria-label={strings.exportPreviewLabel}
        />
        <div class="export-options">
          <fieldset>
            <legend>{strings.exportSizeLegend}</legend>
            <label>
              <input
                type="radio"
                name="size"
                checked={sizeKind === "print"}
                onChange={() => setSizeKind("print")}
              />
              {strings.exportSizePrint}
            </label>
            <label>
              <input
                type="radio"
                name="size"
                checked={sizeKind === "large"}
                onChange={() => setSizeKind("large")}
              />
              {strings.exportSizeLarge(large.width, large.height)}
            </label>
          </fieldset>
          <fieldset>
            <legend>{strings.exportFormatLegend}</legend>
            <label>
              <input
                type="radio"
                name="format"
                checked={format === "png"}
                onChange={() => setFormat("png")}
              />
              PNG
            </label>
            <label>
              <input
                type="radio"
                name="format"
                checked={format === "jpeg"}
                onChange={() => setFormat("jpeg")}
              />
              JPEG
            </label>
          </fieldset>
          {frame.width < OUTPUT_WIDTH_PX && (
            <p class="tag tag-excluded">{strings.exportUpscaleWarning(Math.round(frame.width))}</p>
          )}
          <button type="button" class="primary" disabled={busy} onClick={() => void exportPhoto()}>
            {busy ? strings.exporting : strings.exportButton(exportFileName(file.name, format))}
          </button>
          {error && (
            <p class="message" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
