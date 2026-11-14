import { useRef, useState } from "preact/hooks";
import type { PhotoResult } from "../analysis/messages";
import { processPhotos } from "../analysis/processPhotos";
import { pickImages } from "./files";
import { Loader } from "./Loader";
import type { Photo } from "./photo";
import { PhotoGrid } from "./PhotoGrid";
import { strings } from "./strings";

type Progress = { done: number; total: number };

function applyResult(photo: Photo, result: PhotoResult): Photo {
  if (photo.id !== result.id) return photo;
  if (!result.ok) return { ...photo, state: { kind: "failed", detail: result.detail } };
  return {
    ...photo,
    state: {
      kind: "ready",
      thumbnailUrl: URL.createObjectURL(result.thumbnail),
      width: result.width,
      height: result.height,
    },
  };
}

function revokeThumbnails(photos: readonly Photo[]) {
  for (const photo of photos) {
    if (photo.state.kind === "ready") URL.revokeObjectURL(photo.state.thumbnailUrl);
  }
}

export function App() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const nextId = useRef(1);
  const abort = useRef<AbortController | null>(null);

  async function addFiles(files: File[]) {
    const picked = pickImages(files);
    const notes: string[] = [];
    if (picked.heicCount > 0) notes.push(strings.heicSkipped(picked.heicCount));
    if (picked.otherCount > 0) notes.push(strings.otherSkipped(picked.otherCount));
    if (picked.images.length === 0) {
      setMessages([strings.noImagesFound, ...notes]);
      return;
    }

    const added: Photo[] = picked.images.map((file) => ({
      id: nextId.current++,
      file,
      state: { kind: "pending" },
    }));
    setPhotos((current) => [...current, ...added]);
    setMessages(notes);
    setProgress({ done: 0, total: added.length });

    const controller = new AbortController();
    abort.current = controller;
    let done = 0;
    await processPhotos(
      added,
      (result) => {
        done += 1;
        setPhotos((current) => current.map((photo) => applyResult(photo, result)));
        setProgress({ done, total: added.length });
      },
      controller.signal,
    );
    abort.current = null;
    setProgress(null);

    if (controller.signal.aborted && done < added.length) {
      // Photos that never started have nothing to show; drop them.
      setPhotos((current) => current.filter((photo) => photo.state.kind !== "pending"));
      setMessages([...notes, strings.cancelled(added.length - done)]);
    }
  }

  function clearAll() {
    revokeThumbnails(photos);
    setPhotos([]);
    setMessages([]);
  }

  const busy = progress !== null;

  return (
    <main class="app">
      <header class="app-header">
        <h1>{strings.appTitle}</h1>
        <p>{strings.appLead}</p>
      </header>
      <p class="notice">{strings.privacyNote}</p>
      <p class="notice">{strings.usageNote}</p>

      <Loader
        disabled={busy}
        onFiles={(files) => void addFiles(files)}
        onError={(message) => setMessages([message])}
      />

      {progress && (
        <div class="progress" role="status">
          <span>{strings.progress(progress.done, progress.total)}</span>
          <progress value={progress.done} max={progress.total} />
          <button type="button" onClick={() => abort.current?.abort()}>
            {strings.cancel}
          </button>
        </div>
      )}

      {messages.map((message) => (
        <p key={message} class="message" role="alert">
          {message}
        </p>
      ))}

      {photos.length > 0 && (
        <div class="toolbar">
          <span>{strings.photoCount(photos.length)}</span>
          <button type="button" disabled={busy} onClick={clearAll}>
            {strings.clearAll}
          </button>
        </div>
      )}
      <PhotoGrid photos={photos} />
    </main>
  );
}
