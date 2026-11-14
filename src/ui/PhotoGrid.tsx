import type { Photo } from "./photo";
import { strings } from "./strings";

function PhotoCard({ photo }: { photo: Photo }) {
  const { state } = photo;
  return (
    <li class="card">
      <div class="card-image">
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
          <span class="card-status card-error" title={state.detail}>
            {strings.decodeFailed}
          </span>
        )}
      </div>
      <p class="card-name" title={photo.file.name}>
        {photo.file.name}
      </p>
    </li>
  );
}

export function PhotoGrid({ photos }: { photos: readonly Photo[] }) {
  return (
    <ul class="grid">
      {photos.map((photo) => (
        <PhotoCard key={photo.id} photo={photo} />
      ))}
    </ul>
  );
}
