import { expect, test } from "vite-plus/test";
import { DEFAULT_CONFIG } from "../src/scoring/config";
import { mergeStoredConfig } from "../src/ui/settings";
import { FIELD_GROUPS } from "../src/ui/settingsFields";

test("nothing stored gives the defaults", () => {
  expect(mergeStoredConfig(DEFAULT_CONFIG, null)).toEqual(DEFAULT_CONFIG);
});

test("stored numbers override defaults; unknown keys are dropped", () => {
  const merged = mergeStoredConfig(
    DEFAULT_CONFIG,
    JSON.stringify({ weightFocus: 33, removedKey: 1 }),
  );
  expect(merged.weightFocus).toBe(33);
  expect(merged.weightEyes).toBe(DEFAULT_CONFIG.weightEyes);
  expect(Object.keys(merged)).toEqual(Object.keys(DEFAULT_CONFIG));
});

test("corrupt or wrongly typed entries fall back to defaults", () => {
  expect(mergeStoredConfig(DEFAULT_CONFIG, "{not json")).toEqual(DEFAULT_CONFIG);
  expect(mergeStoredConfig(DEFAULT_CONFIG, "[1,2]")).toEqual(DEFAULT_CONFIG);
  expect(mergeStoredConfig(DEFAULT_CONFIG, "null")).toEqual(DEFAULT_CONFIG);
  const merged = mergeStoredConfig(DEFAULT_CONFIG, JSON.stringify({ weightFocus: "33" }));
  expect(merged.weightFocus).toBe(DEFAULT_CONFIG.weightFocus);
});

test("every config key has exactly one slider, and each default is within its range", () => {
  const fields = FIELD_GROUPS.flatMap((group) => group.fields);
  expect(fields.map((field) => field.key).sort()).toEqual(Object.keys(DEFAULT_CONFIG).sort());
  for (const field of fields) {
    const value = DEFAULT_CONFIG[field.key];
    expect(value, field.key).toBeGreaterThanOrEqual(field.min);
    expect(value, field.key).toBeLessThanOrEqual(field.max);
  }
});
