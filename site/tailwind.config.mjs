/** @type {import('tailwindcss').Config} */
//
// velocit.ee design tokens — sourced from the redesign brief
// (palette: charcoal + blue + green; fonts: JetBrains Mono + Space Grotesk).
// Old brown accents intentionally dropped.
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      colors: {
        // Backgrounds — pure near-black charcoal, no green tint anywhere
        bg:        "#0d0d10",
        surface:   "#141418",
        surface2:  "#1c1c22",
        surface3:  "#222228",

        // Borders
        border:    "#2a2a35",
        "border-hi": "#383848",

        // Text
        cream:     "#e8eaf0",
        text:      "#c8cdd8",
        muted:     "#6b7280",
        dim:       "#3d4149",

        // Blue — primary accent, CTAs, active states, data streams
        blue:      "#3b82f6",
        "blue-hi": "#60a5fa",
        "blue-lo": "#1d4ed8",
        "blue-dim":"rgba(59,130,246,0.12)",

        // Green — success, verification pass, .ee domain, go signals
        green:     "#22c55e",
        "green-hi":"#4ade80",
        "green-lo":"#16a34a",
        "green-dim":"rgba(34,197,94,0.08)",

        // Cyan — info, secondary data signals
        cyan:      "#22d3ee",

        // Status colors (mac traffic lights, status bar)
        ok:        "#4ade80",
        warn:      "#febc2e",
        crit:      "#ff5f57",
      },
      fontFamily: {
        // Mono = JetBrains Mono for terminal/log content, status bars, labels
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
        // Sans = Space Grotesk for headings, body prose, navigation, buttons
        sans: ['"Space Grotesk"', "ui-sans-serif", "system-ui", "sans-serif"],
        log:  ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      letterSpacing: {
        tightest: "-0.045em",
      },
      maxWidth: {
        wrap: "1100px",
        prose: "68ch",
      },
      keyframes: {
        cursor: {
          "0%":   { opacity: "1" },
          "50%":  { opacity: "0" },
          "100%": { opacity: "1" },
        },
        lbar: {
          "0%, 100%": { opacity: "0.4", transform: "scaleX(0.6)" },
          "50%":      { opacity: "1",   transform: "scaleX(1)"   },
        },
        led: {
          "0%, 100%": { opacity: "0.3" },
          "50%":      { opacity: "1"   },
        },
        tlin: {
          "0%":   { opacity: "0", transform: "translateY(2px)" },
          "100%": { opacity: "1", transform: "none" },
        },
        rackin: {
          "0%":   { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "none" },
        },
        textin: {
          "0%":   { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "none" },
        },
        pillin: {
          "0%":   { opacity: "0", transform: "translateX(10px)" },
          "100%": { opacity: "1", transform: "none" },
        },
      },
      animation: {
        cursor: "cursor 1.05s steps(1) infinite",
        lbar:   "lbar 3s ease-in-out infinite",
        led:    "led 2s ease-in-out infinite",
        tlin:   "tlin 0.35s ease both",
        rackin: "rackin 1s ease 0.7s both",
        textin: "textin 0.8s ease 0.3s both",
        pillin: "pillin 0.7s ease 1.4s both",
      },
      boxShadow: {
        "active-blue": "inset 0 0 20px rgba(59,130,246,0.12)",
        focus:         "0 0 0 1px #3b82f6, 0 0 0 4px rgba(59,130,246,0.25)",
      },
    },
  },
  plugins: [],
};
