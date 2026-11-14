import { useRef, useState } from "preact/hooks";
import { filesFromDrop } from "./files";
import { strings } from "./strings";

type Props = {
  disabled: boolean;
  onFiles: (files: File[]) => void;
  onError: (message: string) => void;
};

// File picker, folder picker and drop target. All three end in `onFiles`.
export function Loader({ disabled, onFiles, onError }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function onInputChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    onFiles(Array.from(input.files ?? []));
    // Reset so choosing the same files again fires `change`.
    input.value = "";
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (disabled || !event.dataTransfer) return;
    filesFromDrop(event.dataTransfer).then(onFiles, (error: unknown) =>
      onError(strings.dropFailed(String(error))),
    );
  }

  return (
    <section
      class={dragging ? "loader loader-dragging" : "loader"}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <p class="loader-hint">{strings.dropHint}</p>
      <p class="loader-formats">{strings.dropFormats}</p>
      <div class="loader-buttons">
        <button type="button" disabled={disabled} onClick={() => fileInput.current?.click()}>
          {strings.chooseFiles}
        </button>
        <button type="button" disabled={disabled} onClick={() => folderInput.current?.click()}>
          {strings.chooseFolder}
        </button>
      </div>
      <input
        ref={fileInput}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={onInputChange}
      />
      <input
        ref={folderInput}
        type="file"
        hidden
        onChange={onInputChange}
        // `webkitdirectory` (folder picker; supported by all current browsers)
        // is missing from Preact's input typings, so it is passed by spread.
        {...{ webkitdirectory: true }}
      />
    </section>
  );
}
