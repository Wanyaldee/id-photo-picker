import { DEFAULT_CONFIG, type ScoringConfig } from "../scoring/config";

// Only weights and thresholds are stored — never photos or results
// (CLAUDE.md §5).
const STORAGE_KEY = "id-photo-picker.scoring-config.v1";

// Takes stored JSON and returns a complete config: known keys with finite
// numbers override the defaults; anything else (old keys, wrong types,
// corrupt JSON) is ignored, so a stale entry can never break scoring.
export function mergeStoredConfig(defaults: ScoringConfig, json: string | null): ScoringConfig {
  if (!json) return defaults;
  let stored: unknown;
  try {
    stored = JSON.parse(json);
  } catch {
    return defaults;
  }
  if (typeof stored !== "object" || stored === null) return defaults;
  const merged = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof ScoringConfig)[]) {
    const value = (stored as Record<string, unknown>)[key];
    if (typeof value === "number" && Number.isFinite(value)) merged[key] = value;
  }
  return merged;
}

export function loadConfig(): ScoringConfig {
  try {
    return mergeStoredConfig(DEFAULT_CONFIG, localStorage.getItem(STORAGE_KEY));
  } catch {
    // Storage can be blocked (private mode, policy); the defaults still work.
    return DEFAULT_CONFIG;
  }
}

// Returns false when the browser refuses to store, so the UI can say that
// the change will not survive a reload.
export function saveConfig(config: ScoringConfig): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    return true;
  } catch {
    return false;
  }
}
