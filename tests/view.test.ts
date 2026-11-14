import { expect, test } from "vite-plus/test";
import type { PhotoScore } from "../src/scoring/score";
import { type Row, visibleRows } from "../src/ui/view";

const scored = (total: number): PhotoScore => ({
  kind: "scored",
  total,
  items: [],
  reasons: [],
  crop: { x: 0, y: 0, width: 3, height: 4 },
});
const excluded = (reason: "noFace" | "multipleFaces"): PhotoScore => ({
  kind: "excluded",
  reason,
  faceCount: reason === "noFace" ? 0 : 2,
});

function row(id: number, name: string, score: PhotoScore | null): Row {
  return { photo: { id, file: new File([], name), state: { kind: "pending" } }, score };
}

const rows = [
  row(1, "img10.jpg", scored(40)),
  row(2, "img2.jpg", excluded("noFace")),
  row(3, "img1.jpg", scored(90)),
  row(4, "img3.jpg", null),
  row(5, "img4.jpg", excluded("multipleFaces")),
];
const ids = (result: Row[]) => result.map((r) => r.photo.id);

test("score order: best first, then excluded, then unscored", () => {
  expect(ids(visibleRows(rows, { sort: "score", filter: "all", minScore: 0 }))).toEqual([
    3, 1, 2, 5, 4,
  ]);
});

test("name order sorts numbers naturally; loaded order is unchanged", () => {
  expect(ids(visibleRows(rows, { sort: "name", filter: "all", minScore: 0 }))).toEqual([
    3, 2, 4, 5, 1,
  ]);
  expect(ids(visibleRows(rows, { sort: "loaded", filter: "all", minScore: 0 }))).toEqual([
    1, 2, 3, 4, 5,
  ]);
});

test("filters by candidate, excluded, and a specific exclusion reason", () => {
  const view = (filter: Parameters<typeof visibleRows>[1]["filter"]) =>
    ids(visibleRows(rows, { sort: "loaded", filter, minScore: 0 }));
  expect(view("candidates")).toEqual([1, 3]);
  expect(view("excluded")).toEqual([2, 5]);
  expect(view("noFace")).toEqual([2]);
  expect(view("multipleFaces")).toEqual([5]);
});

test("minimum score hides low-scoring photos but not excluded ones", () => {
  expect(ids(visibleRows(rows, { sort: "loaded", filter: "all", minScore: 50 }))).toEqual([
    2, 3, 4, 5,
  ]);
});

test("does not reorder the input array", () => {
  visibleRows(rows, { sort: "score", filter: "all", minScore: 0 });
  expect(ids(rows)).toEqual([1, 2, 3, 4, 5]);
});
