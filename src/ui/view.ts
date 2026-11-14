import type { ExclusionKey, PhotoScore } from "../scoring/score";
import type { Photo } from "./photo";

// A photo with its current score. `score` is null while loading or when the
// file could not be read.
export type Row = { photo: Photo; score: PhotoScore | null };

export type SortKey = "score" | "name" | "loaded";
export type FilterKey = "all" | "candidates" | "excluded" | ExclusionKey;
export type ViewOptions = { sort: SortKey; filter: FilterKey; minScore: number };

function matchesFilter(row: Row, filter: FilterKey): boolean {
  const kind = row.score?.kind;
  switch (filter) {
    case "all":
      return true;
    case "candidates":
      return kind === "scored";
    case "excluded":
      return kind === "excluded";
    default:
      return row.score?.kind === "excluded" && row.score.reason === filter;
  }
}

// Scored photos first (best first), then excluded, then loading/unreadable.
function scoreRank(row: Row): number {
  if (row.score?.kind === "scored") return row.score.total;
  return row.score ? -1 : -2;
}

// Which photos the grid shows, and in what order. The minimum score only
// hides scored photos: an excluded photo has no score to compare.
export function visibleRows(rows: readonly Row[], options: ViewOptions): Row[] {
  const shown = rows.filter(
    (row) =>
      matchesFilter(row, options.filter) &&
      !(row.score?.kind === "scored" && row.score.total < options.minScore),
  );
  if (options.sort === "score") {
    // Array.sort is stable, so ties keep their load order.
    shown.sort((a, b) => scoreRank(b) - scoreRank(a));
  } else if (options.sort === "name") {
    shown.sort((a, b) =>
      a.photo.file.name.localeCompare(b.photo.file.name, undefined, { numeric: true }),
    );
  }
  return shown;
}
