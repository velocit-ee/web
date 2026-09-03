/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      colors: {
        // Backgrounds — clean grayscale
        bg:        "#0a0a0a",
        surface:   "#121212",
        surface2:  "#1a1a1a",
        surface3:  "#242424",

        // Borders
        border:    "#2a2a2a",
        "border-hi": "#333333",

        // Text
        cream:     "#f3f4f6",
        text:      "#d1d5db",
        muted:     "#9ca3af",
        dim:       "#4b5563",

        // Primary Accent — Professional Blue
        blue:      "#2563eb",
        "blue-hi": "#3b82f6",
        "blue-lo": "#1d4ed8",
        "blue-dim":"rgba(37,99,235,0.1)",

        // Secondary Accent — Neutral Green
        green:     "#16a34a",
        "green-hi":"#22c55e",
        "green-lo":"#15803d",
        "green-dim":"rgba(22,163,74,0.1)",

        // Status
        ok:        "#22c55e",
        warn:      "#eab308",
        crit:      "#ef4444",
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
        // Professional sans-serif stack
        sans: ['"Inter"', "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        log:  ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      letterSpacing: {
        tightest: "-0.02em",
      },
      maxWidth: {
        wrap: "1100px",
        prose: "68ch",
      },
      boxShadow: {
        focus: "0 0 0 2px #2563eb",
      },
    },
  },
  plugins: [],
};
