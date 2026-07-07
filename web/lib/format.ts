export const pct = (v: number): string => `${(v * 100).toFixed(0)}%`;

export const pct1 = (v: number): string => `${(v * 100).toFixed(1)}%`;

export const money = (v: number): string =>
  v < 0.01 && v > 0 ? `$${v.toFixed(4)}` : `$${v.toFixed(2)}`;

export const num = (v: number): string => v.toLocaleString("en-US");

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export const truncate = (s: string, n = 90): string =>
  s.length <= n ? s : s.slice(0, n - 1) + "…";
