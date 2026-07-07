import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-inter)", "sans-serif"],
      },
      colors: {
        // Vibrant chrome accents (UI only, not data marks).
        ink: {
          bg: "#0a0812",
          panel: "#171526",
          raised: "#1f1c33",
        },
        neon: {
          fuchsia: "#e879f9",
          violet: "#a78bfa",
          cyan: "#22d3ee",
        },
        // Validated data palette (see lib/palette.ts — kept in sync).
        series: {
          1: "#3987e5",
          2: "#199e70",
          3: "#c98500",
          4: "#008300",
          5: "#9085e9",
        },
        status: {
          good: "#0ca30c",
          warning: "#fab219",
          serious: "#ec835a",
          critical: "#d03b3b",
        },
      },
      boxShadow: {
        glow: "0 0 40px -10px rgba(168,139,250,0.5)",
        "glow-cyan": "0 0 40px -12px rgba(34,211,238,0.55)",
      },
      keyframes: {
        "gradient-pan": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(12,163,12,0.5)" },
          "70%": { boxShadow: "0 0 0 10px rgba(12,163,12,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(12,163,12,0)" },
        },
        "pulse-ring-red": {
          "0%": { boxShadow: "0 0 0 0 rgba(208,59,59,0.5)" },
          "70%": { boxShadow: "0 0 0 10px rgba(208,59,59,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(208,59,59,0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "gradient-pan": "gradient-pan 8s ease infinite",
        "fade-up": "fade-up 0.5s ease-out both",
        "pulse-ring": "pulse-ring 2s infinite",
        "pulse-ring-red": "pulse-ring-red 2s infinite",
        shimmer: "shimmer 1.5s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
