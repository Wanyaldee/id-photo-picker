import { useEffect, useRef, useState } from "preact/hooks";
import { BACKGROUND_COLORS, type BackgroundChoice } from "../background/config";
import { replaceBackground } from "../background/replaceBackground";
import { OUTPUT_HEIGHT_PX, OUTPUT_WIDTH_PX } from "../crop/autoCrop";
import { canvasToBlob, downloadBlob, renderCrop } from "../crop/export";
import { type ExportFormat, exportFileName, exportSize, type ExportSizeKind } from "../crop/frame";
import type { Rect } from "../scoring/types";
import { strings } from "./strings";

// While the frame is being dragged the background is not recomputed on every
// move; it runs once the frame has been still for this long.
const BACKGROUND_PREVIEW_DELAY_MS = 250;

const BACKGROUNDS: BackgroundChoice[] = ["none", "white", "lightBlue"];
const FORMATS: ExportFormat[] = ["png", "jpeg"];

type Props = {
  file: File;
  frame: Rect;
  // The <img> already showing the photo; the preview is drawn from it.
  image: HTMLImageElement | null;
};

function drawFrame(target: HTMLCanvasElement, image: HTMLImageElement, frame: Rect) {
  const context = target.getContext("2d");
  if (!context) return;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    frame.x,
    frame.y,
    frame.width,
    frame.height,
    0,
    0,
    target.width,
    target.height,
  );
}

// Live preview of the framed area, plus background, size and format choices
// and the export button.
export function ExportPanel({ file, frame, image }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [background, setBackground] = useState<BackgroundChoice>("none");
  const [sizeKind, setSizeKind] = useState<ExportSizeKind>("print");
  const [format, setFormat] = useState<ExportFormat>("png");
  const [busy, setBusy] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Any failure of the background step falls back to "none", so the photo can
  // always be exported with its original background (CLAUDE.md §7-5).
  function backgroundFailed(cause: unknown) {
    setBackground("none");
    setError(strings.backgroundFailed(String(cause)));
  }

  useEffect(() => {
    const target = canvas.current;
    if (!target || !image) return;
    // Show the plain crop at once; the background version replaces it when
    // it is ready.
    drawFrame(target, image, frame);
    if (background === "none") return;

    let stale = false;
    setPreviewing(true);
    const timer = setTimeout(() => {
      const source = document.createElement("canvas");
      source.width = target.width;
      source.height = target.height;
      drawFrame(source, image, frame);
      replaceBackground(source, BACKGROUND_COLORS[background])
        .then((result) => {
          // The frame or the choice changed while this was running.
          if (!stale) target.getContext("2d")?.drawImage(result, 0, 0);
        }, backgroundFailed)
        .finally(() => {
          if (!stale) setPreviewing(false);
        });
    }, BACKGROUND_PREVIEW_DELAY_MS);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [image, frame, background]);

  async function exportPhoto() {
    setBusy(true);
    setError(null);
    try {
      let rendered = await renderCrop(file, frame, exportSize(sizeKind, frame.width));
      if (background !== "none") {
        try {
          rendered = await replaceBackground(rendered, BACKGROUND_COLORS[background]);
        } catch (cause) {
          // Do not silently export something other than what was previewed.
          backgroundFailed(cause);
          return;
        }
      }
      downloadBlob(await canvasToBlob(rendered, format), exportFileName(file.name, format));
    } catch (cause) {
      setError(strings.exportFailed(String(cause)));
    } finally {
      setBusy(false);
    }
  }

  const large = exportSize("large", frame.width);
  const sizeLabels: Record<ExportSizeKind, string> = {
    print: strings.exportSizePrint,
    large: strings.exportSizeLarge(large.width, large.height),
  };

  return (
    <section class="export">
      <h3>{strings.exportTitle}</h3>
      <div class="export-options">
        <fieldset>
          <legend>{strings.backgroundLegend}</legend>
          {BACKGROUNDS.map((choice) => (
            <label key={choice}>
              <input
                type="radio"
                name="background"
                checked={background === choice}
                onChange={() => {
                  setError(null);
                  setBackground(choice);
                }}
              />
              {strings.backgrounds[choice]}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>{strings.exportSizeLegend}</legend>
          {(["print", "large"] as const).map((kind) => (
            <label key={kind}>
              <input
                type="radio"
                name="size"
                checked={sizeKind === kind}
                onChange={() => setSizeKind(kind)}
              />
              {sizeLabels[kind]}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>{strings.exportFormatLegend}</legend>
          {FORMATS.map((choice) => (
            <label key={choice}>
              <input
                type="radio"
                name="format"
                checked={format === choice}
                onChange={() => setFormat(choice)}
              />
              {choice === "png" ? "PNG" : "JPEG"}
            </label>
          ))}
        </fieldset>
      </div>

      {/* Shown at the real print size (354 x 472) so the cut-out edge can be
          judged before exporting. */}
      <figure class="export-preview">
        <canvas
          ref={canvas}
          width={OUTPUT_WIDTH_PX}
          height={OUTPUT_HEIGHT_PX}
          aria-label={strings.exportPreviewLabel}
        />
        <figcaption class="muted">
          {previewing
            ? strings.backgroundWorking
            : background === "none"
              ? strings.exportPreviewCaption
              : strings.backgroundCheckEdges}
        </figcaption>
      </figure>

      {frame.width < OUTPUT_WIDTH_PX && (
        <p class="tag tag-excluded">{strings.exportUpscaleWarning(Math.round(frame.width))}</p>
      )}
      {error && (
        <p class="message" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        class="primary"
        disabled={busy || previewing}
        onClick={() => void exportPhoto()}
      >
        {busy ? strings.exporting : strings.exportButton(exportFileName(file.name, format))}
      </button>
    </section>
  );
}
