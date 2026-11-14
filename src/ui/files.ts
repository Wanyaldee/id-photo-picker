// Picking image files out of a file input, a folder, or a drop.

const SUPPORTED_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];
const SUPPORTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const HEIC_EXTENSIONS = ["heic", "heif"];

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot + 1).toLowerCase();
}

export type FileKind = "supported" | "heic" | "other";

// The MIME type is checked first; files that come out of a dropped folder
// often have an empty type, so the extension is the fallback.
export function classifyFile(name: string, type: string): FileKind {
  const extension = extensionOf(name);
  if (SUPPORTED_TYPES.includes(type) || SUPPORTED_EXTENSIONS.includes(extension)) {
    return "supported";
  }
  if (type === "image/heic" || type === "image/heif" || HEIC_EXTENSIONS.includes(extension)) {
    return "heic";
  }
  return "other";
}

export type PickedFiles = {
  images: File[];
  // HEIC is counted separately so the UI can tell the user to convert them.
  heicCount: number;
  otherCount: number;
};

export function pickImages(files: readonly File[]): PickedFiles {
  const picked: PickedFiles = { images: [], heicCount: 0, otherCount: 0 };
  for (const file of files) {
    const kind = classifyFile(file.name, file.type);
    if (kind === "supported") picked.images.push(file);
    else if (kind === "heic") picked.heicCount += 1;
    else picked.otherCount += 1;
  }
  return picked;
}

function entryFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

// readEntries returns results in chunks (100 at a time in Chrome), so it has
// to be called until it returns an empty array.
async function directoryEntries(directory: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> {
  const reader = directory.createReader();
  const all: FileSystemEntry[] = [];
  for (;;) {
    const chunk = await new Promise<FileSystemEntry[]>((resolve, reject) =>
      reader.readEntries(resolve, reject),
    );
    if (chunk.length === 0) return all;
    all.push(...chunk);
  }
}

async function filesUnder(entry: FileSystemEntry): Promise<File[]> {
  if (entry.isFile) {
    return [await entryFile(entry as FileSystemFileEntry)];
  }
  const children = await directoryEntries(entry as FileSystemDirectoryEntry);
  const nested = await Promise.all(children.map(filesUnder));
  return nested.flat();
}

// Collects every file in a drop, descending into dropped folders.
// The entries must be read from the DataTransfer synchronously: the browser
// empties it as soon as the drop handler returns to the event loop.
export function filesFromDrop(dataTransfer: DataTransfer): Promise<File[]> {
  const entries: FileSystemEntry[] = [];
  const looseFiles: File[] = [];
  for (const item of dataTransfer.items) {
    if (item.kind !== "file") continue;
    const entry = item.webkitGetAsEntry();
    if (entry) {
      entries.push(entry);
    } else {
      const file = item.getAsFile();
      if (file) looseFiles.push(file);
    }
  }
  return Promise.all(entries.map(filesUnder)).then((nested) => [...looseFiles, ...nested.flat()]);
}
