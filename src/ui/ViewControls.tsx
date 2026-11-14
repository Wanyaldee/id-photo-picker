import { strings } from "./strings";
import type { FilterKey, SortKey, ViewOptions } from "./view";

const SORTS: SortKey[] = ["score", "name", "loaded"];
const FILTERS: FilterKey[] = ["all", "candidates", "excluded", "noFace", "multipleFaces"];

type Props = { options: ViewOptions; onChange: (options: ViewOptions) => void };

// Sort, filter and minimum-score controls for the grid.
export function ViewControls({ options, onChange }: Props) {
  return (
    <div class="controls">
      <label>
        {strings.sortLabel}
        <select
          value={options.sort}
          onChange={(event) => onChange({ ...options, sort: event.currentTarget.value as SortKey })}
        >
          {SORTS.map((key) => (
            <option key={key} value={key}>
              {strings.sorts[key]}
            </option>
          ))}
        </select>
      </label>
      <label>
        {strings.filterLabel}
        <select
          value={options.filter}
          onChange={(event) =>
            onChange({ ...options, filter: event.currentTarget.value as FilterKey })
          }
        >
          {FILTERS.map((key) => (
            <option key={key} value={key}>
              {strings.filters[key]}
            </option>
          ))}
        </select>
      </label>
      <label>
        {strings.minScoreLabel(options.minScore)}
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={options.minScore}
          onInput={(event) => onChange({ ...options, minScore: Number(event.currentTarget.value) })}
        />
      </label>
    </div>
  );
}
