import { LIVE_MODELS } from "@/lib/models";

export function LiveMode({
  mode,
  onMode,
  apiKey,
  onApiKey,
  model,
  onModel,
  busy,
}: {
  mode: "demo" | "live";
  onMode: (m: "demo" | "live") => void;
  apiKey: string;
  onApiKey: (v: string) => void;
  model: string;
  onModel: (v: string) => void;
  busy: boolean;
}) {
  return (
    <div className="glass-strong p-5">
      <div className="card-label mb-2">Mode</div>
      <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-black/30 p-1">
        <button
          onClick={() => onMode("demo")}
          disabled={busy}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition disabled:opacity-60 ${
            mode === "demo" ? "bg-white/10 text-white shadow" : "text-white/55 hover:text-white"
          }`}
        >
          Demo
        </button>
        <button
          onClick={() => onMode("live")}
          disabled={busy}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition disabled:opacity-60 ${
            mode === "live"
              ? "bg-gradient-to-r from-neon-fuchsia/30 to-neon-cyan/30 text-white"
              : "text-white/55 hover:text-white"
          }`}
        >
          Live · your key
        </button>
      </div>

      {mode === "demo" ? (
        <p className="mt-3 text-xs text-white/45">
          Simulated, offline, and free — answers are graded deterministically to show the flow.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          <div>
            <label className="card-label mb-1.5 block">Anthropic API key</label>
            <input
              type="password"
              value={apiKey}
              disabled={busy}
              onChange={(e) => onApiKey(e.target.value)}
              placeholder="sk-ant-…"
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-xl border border-white/15 bg-black/40 px-3.5 py-2.5 font-mono text-sm text-white/90 outline-none transition focus:border-neon-violet/60 disabled:opacity-60"
            />
          </div>
          <div>
            <label className="card-label mb-1.5 block">Model</label>
            <div className="relative">
              <select
                value={model}
                disabled={busy}
                onChange={(e) => onModel(e.target.value)}
                className="w-full appearance-none rounded-xl border border-white/15 bg-ink-raised/80 px-3.5 py-2.5 pr-9 text-sm text-white outline-none transition focus:border-neon-violet/60 disabled:opacity-60"
              >
                {LIVE_MODELS.map((m) => (
                  <option key={m.id} value={m.id} className="bg-ink-panel">
                    {m.label}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/50">
                ▾
              </span>
            </div>
          </div>
          <p className="text-xs leading-relaxed text-white/45">
            🔒 Your key is kept in this browser only (sessionStorage), sent per request straight to
            Anthropic, and never stored or logged by this app. Live runs call the real model and
            bill your account. Get a key at{" "}
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noreferrer"
              className="text-neon-cyan hover:underline"
            >
              console.anthropic.com
            </a>
            .
          </p>
        </div>
      )}
    </div>
  );
}
