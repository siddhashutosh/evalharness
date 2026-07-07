import Link from "next/link";

export function Nav({ active }: { active?: "home" | "dashboard" }) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-ink-bg/60 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-neon-fuchsia to-neon-cyan text-sm font-black text-ink-bg shadow-glow">
            e
          </span>
          <span className="font-display text-lg font-bold tracking-tight">
            eval<span className="gradient-text">harness</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1.5 text-sm">
          <Link
            href="/"
            className={`rounded-lg px-3 py-1.5 transition ${
              active === "home" ? "bg-white/10 text-white" : "text-white/60 hover:text-white"
            }`}
          >
            Overview
          </Link>
          <Link
            href="/dashboard"
            className={`rounded-lg px-3 py-1.5 transition ${
              active === "dashboard"
                ? "bg-white/10 text-white"
                : "text-white/60 hover:text-white"
            }`}
          >
            Dashboard
          </Link>
          <a
            href="https://github.com/siddhashutosh/evalharness"
            target="_blank"
            rel="noreferrer"
            className="ml-1 rounded-lg border border-white/15 px-3 py-1.5 text-white/80 transition hover:bg-white/10"
          >
            GitHub ↗
          </a>
        </nav>
      </div>
    </header>
  );
}
