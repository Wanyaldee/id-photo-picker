import { expect, test } from "vite-plus/test";
import { classifyFile, pickImages } from "../src/ui/files";

test("accepts JPEG, PNG and WebP by MIME type or extension", () => {
  expect(classifyFile("a.jpg", "image/jpeg")).toBe("supported");
  expect(classifyFile("IMG_0001.JPEG", "")).toBe("supported");
  expect(classifyFile("b.PNG", "")).toBe("supported");
  expect(classifyFile("c", "image/webp")).toBe("supported");
});

test("reports HEIC separately so the UI can ask for conversion", () => {
  expect(classifyFile("IMG_0002.HEIC", "")).toBe("heic");
  expect(classifyFile("x", "image/heif")).toBe("heic");
});

test("ignores everything else", () => {
  expect(classifyFile("notes.txt", "text/plain")).toBe("other");
  expect(classifyFile("movie.mov", "video/quicktime")).toBe("other");
  expect(classifyFile("noextension", "")).toBe("other");
});

test("pickImages keeps supported files and counts the rest", () => {
  const files = [
    new File([], "a.jpg", { type: "image/jpeg" }),
    new File([], "b.heic"),
    new File([], "c.txt", { type: "text/plain" }),
    new File([], "d.webp"),
  ];
  const picked = pickImages(files);
  expect(picked.images.map((file) => file.name)).toEqual(["a.jpg", "d.webp"]);
  expect(picked.heicCount).toBe(1);
  expect(picked.otherCount).toBe(1);
});
