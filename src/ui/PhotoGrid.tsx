import type { PhotoScore } from "../scoring/score";
import { strings } from "./strings";
import type { Row } from "./view";

function exclusionText(score: Extract<PhotoScore, { kind: "excluded" }>): string {
  return score.reason === "multipleFaces" && score.faceCount > 1
    ? strings.multipleFacesCount(score.faceCount)
    : strings.exclusions[score.reason];
}

function ScoreSummary({ score }: { score: PhotoScore }) {
  if (score.kind === "excluded") {
    return (
      <div class="card-summary">
        <span class="badge badge-excluded">{strings.excludedLabel}</span>
        <span class="tag tag-excluded">{exclusionText(score)}</span>
      </div>
    );
  }
  return (
    <div class="card-summary">
      <span class="badge" title={strings.totalScore}>
        {Math.round(score.total)}
      </span>
      {score.reasons.map((reason) => (
        <span key={reason} class="tag">
          {strings.reasons[reason]}
        </span>
      ))}
    </div>
  );
}

function PhotoCard({ row, onOpen }: { row: Row; onOpen: (id: number) => void }) {
  const { photo, score } = row;
  const { state } = photo;
  return (
    <li class="card">
      <button
        type="button"
        class="card-image"
        disabled={state.kind !== "ready"}
        onClick={() => onOpen(photo.id)}
      >
        {state.kind === "ready" && (
          // Width/height reserve the box before the image paints, so the grid
          // does not jump as thumbnails arrive.
          <img
            src={state.thumbnailUrl}
            alt={photo.file.name}
            width={state.width}
            height={state.height}
            loading="lazy"
            decoding="async"
          />
        )}
        {state.kind === "pending" && <span class="card-status">{strings.loading}</span>}
        {state.kind === "failed" && (
          <span class="card-status card-error">
            {state.reason === "decode-failed" ? strings.decodeFailed : strings.analysisFailed}
            {state.reason === "analysis-failed" && <small>{state.detail}</small>}
          </span>
        )}
      </button>
      {score && <ScoreSummary score={score} />}
      <p class="card-name" title={photo.file.name}>
        {photo.file.name}
      </p>
    </li>
  );
}

type Props = { rows: readonly Row[]; onOpen: (id: number) => void };

export function PhotoGrid({ rows, onOpen }: Props) {
  return (
    <ul class="grid">
      {rows.map((row) => (
        <PhotoCard key={row.photo.id} row={row} onOpen={onOpen} />
      ))}
    </ul>
  );
}
