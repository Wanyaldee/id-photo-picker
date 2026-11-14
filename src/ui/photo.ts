// One loaded photo as the UI sees it. `file` is only a handle to the user's
// file — the decoded pixels are not kept; the thumbnail is the only image
// data held per photo.
export type Photo = {
  id: number;
  file: File;
  state:
    | { kind: "pending" }
    | { kind: "ready"; thumbnailUrl: string; width: number; height: number }
    | { kind: "failed"; detail: string };
};
