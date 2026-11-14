import { DEFAULT_CONFIG, type ScoringConfig } from "../scoring/config";
import { FIELD_GROUPS } from "./settingsFields";
import { strings } from "./strings";

type Props = { config: ScoringConfig; onChange: (config: ScoringConfig) => void };

// One slider per weight and threshold. Changes re-score every photo at once
// (scoring is a pure function of the stored measurements).
export function SettingsPanel({ config, onChange }: Props) {
  return (
    <details class="settings">
      <summary>{strings.settingsTitle}</summary>
      <p class="settings-note">{strings.settingsNote}</p>
      <button type="button" onClick={() => onChange(DEFAULT_CONFIG)}>
        {strings.settingsReset}
      </button>
      <div class="settings-groups">
        {FIELD_GROUPS.map((group) => (
          <fieldset key={group.id}>
            <legend>{strings.settingGroups[group.id]}</legend>
            {group.fields.map((field) => (
              <label key={field.key} class="settings-field">
                <span>{strings.settingFields[field.key]}</span>
                <input
                  type="range"
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  value={config[field.key]}
                  onInput={(event) =>
                    onChange({ ...config, [field.key]: Number(event.currentTarget.value) })
                  }
                />
                <output>{config[field.key]}</output>
              </label>
            ))}
          </fieldset>
        ))}
      </div>
    </details>
  );
}
