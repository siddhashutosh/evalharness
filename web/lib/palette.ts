// Data-mark colors — the VALIDATED palette from the dataviz design system.
// Categorical (dark steps) validated: contrast >= 3:1 on the dark card surface,
// CVD in the floor band (legal because bars carry direct value labels).
// Status colors are reserved and never reused as a series hue.

// Fixed categorical order — assigned to scorers in first-seen order, never cycled.
export const SERIES: string[] = [
  "#3987e5", // blue
  "#199e70", // aqua
  "#c98500", // yellow
  "#008300", // green
  "#9085e9", // violet
];

export const STATUS = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
} as const;

// Diverging pair for baseline deltas (improved vs regressed) + neutral midpoint.
export const DIVERGING = {
  up: "#0ca30c", // improved
  down: "#d03b3b", // regressed
  neutral: "#898781",
} as const;

const _assignments = new Map<string, string>();

/** Deterministically map a scorer name to a fixed categorical slot. */
export function scorerColor(name: string, order: string[]): string {
  const idx = order.indexOf(name);
  if (idx >= 0) return SERIES[idx % SERIES.length];
  if (!_assignments.has(name)) {
    _assignments.set(name, SERIES[_assignments.size % SERIES.length]);
  }
  return _assignments.get(name)!;
}
