import { useEffect, useRef, useState } from "preact/hooks";
import { estimateHeadTopY } from "../crop/autoCrop";
import type { PhotoScore } from "../scoring/score";
import type { FaceMeasurements } from "../scoring/types";
import type { Photo } from "./photo";
import { strings } from "./strings";

type ReadyPhoto = Photo & { state: Extract<Photo["state"], { kind: "ready" }> };
type Props = { photo: ReadyPhoto; score: PhotoScore; onClose: () => void };

// The full-size photo is shown straight from the user's file through an
// object URL, which is released when the dialog closes.
function useFileUrl(file: File): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const created = URL.createObjectURL(file);
    setUrl(created);
    return () => URL.revokeObjectURL(created);
  }, [file]);
  return url;
}

// 3:4 frame plus head-top and chin lines, drawn in image-pixel coordinates
// over the photo.
function Guides({ photo, score }: { photo: ReadyPhoto; score: PhotoScore }) {
  const face = photo.state.analysis.face;
  if (score.kind !== "scored" || !face) return null;
  const { width, height } = photo.state;
  const { crop } = score;
  const stroke = Math.max(width, height) / 300;
  const line = (y: number) => (
    <line x1={crop.x} x2={crop.x + crop.width} y1={y} y2={y} stroke-dasharray={stroke * 4} />
  );
  return (
    <svg class="guides" viewBox={`0 0 ${width} ${height}`} stroke-width={stroke} aria-hidden="true">
      <rect x={crop.x} y={crop.y} width={crop.width} height={crop.height} />
      {line(estimateHeadTopY(face))}
      {line(face.chinY)}
    </svg>
  );
}

function measurementRows(face: FaceMeasurements): [string, string][] {
  const m = strings.measure;
  const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
  return [
    [m.sharpness, face.sharpness.toFixed(0)],
    [m.eyeBlink, face.eyeBlink.toFixed(2)],
    [m.jawOpen, face.jawOpen.toFixed(2)],
    [m.smile, face.smile.toFixed(2)],
    [m.yaw, face.yawDeg.toFixed(1)],
    [m.pitch, face.pitchDeg.toFixed(1)],
    [m.roll, face.rollDeg.toFixed(1)],
    [m.meanLuma, face.meanLuma.toFixed(0)],
    [m.overexposed, percent(face.overexposedFraction)],
    [m.underexposed, percent(face.underexposedFraction)],
    [m.sideImbalance, face.sideImbalance.toFixed(2)],
  ];
}

function ScoreBreakdown({ photo, score }: { photo: ReadyPhoto; score: PhotoScore }) {
  if (score.kind === "excluded") {
    return (
      <p class="tag tag-excluded">
        {score.reason === "multipleFaces" && score.faceCount > 1
          ? strings.multipleFacesCount(score.faceCount)
          : strings.exclusions[score.reason]}
      </p>
    );
  }
  const face = photo.state.analysis.face;
  return (
    <>
      <p class="detail-total">
        {strings.totalScore}: <strong>{Math.round(score.total)}</strong>
      </p>
      <p class="detail-reasons">
        {score.reasons.length === 0
          ? strings.noReasons
          : score.reasons.map((reason) => (
              <span key={reason} class="tag">
                {strings.reasons[reason]}
              </span>
            ))}
      </p>
      <h3>{strings.itemScores}</h3>
      <table class="detail-table">
        <tbody>
          {score.items.map((item) => (
            <tr key={item.key}>
              <th scope="row">{strings.items[item.key]}</th>
              <td>
                <meter min={0} max={1} low={0.6} optimum={1} value={item.score} />
              </td>
              <td>{Math.round(item.score * 100)}</td>
              <td class="muted">{strings.itemWeight(item.weight)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p class="muted">
        {strings.cropSize(Math.round(score.crop.width), Math.round(score.crop.height))}
      </p>
      {face && (
        <>
          <h3>{strings.measurements}</h3>
          <table class="detail-table">
            <tbody>
              {measurementRows(face).map(([label, value]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  <td>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}

export function Detail({ photo, score, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const url = useFileUrl(photo.file);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  return (
    // `onClose` also fires for Esc, so the parent state always follows.
    <dialog ref={dialog} class="detail" onClose={onClose}>
      <header class="detail-header">
        <h2>{photo.file.name}</h2>
        <button type="button" onClick={() => dialog.current?.close()}>
          {strings.close}
        </button>
      </header>
      <div class="detail-body">
        <div class="detail-photo">
          {url && <img src={url} alt={photo.file.name} decoding="async" />}
          <Guides photo={photo} score={score} />
        </div>
        <div class="detail-side">
          <ScoreBreakdown photo={photo} score={score} />
          <p class="muted">{strings.imageSize(photo.state.width, photo.state.height)}</p>
          {score.kind === "scored" && <p class="muted">{strings.guideLegend}</p>}
          <p class="muted">{strings.finalCheckNote}</p>
        </div>
      </div>
    </dialog>
  );
}
