/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  // Velocitee tokens — match BRAND.md exactly. Tailwind utilities expose them
  // as bg-bg, text-cream, border-border, etc.
  theme: {
    extend: {
      colors: {
        bg:        "#0b0e09",
        surface:   "#111510",
        surface2:  "#171d15",
        border:    "#232d1f",
        green:     "#5a9e6a",
        "green-hi":"#7dc48a",
        brown:     "#9b7a4e",
        "brown-hi":"#c4a06a",
        cream:     "#d4ccb4",
        text:      "#b8c4a8",
        muted:     "#5e7055",
        dim:       "#3a4a34",
        // Status colors for the modeline / log lines.
        ok:        "#7dc48a",
        warn:      "#c4a06a",
        crit:      "#a85a5a",
      },
      fontFamily: {
        // IBM Plex Mono is the brand mono; JetBrains Mono is a fallback used
        // sparingly inside terminal-tile widgets where the slightly different
        // shape adds character to log dumps. Plex Sans handles long-form prose.
        mono: ['"IBM Plex Mono"', '"JetBrains Mono"', "ui-monospace", "monospace"],
        sans: ['"IBM Plex Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
        log:  ['"JetBrains Mono"', '"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      fontSize: {
        // tighter scale than Tailwind's default — terminal feel
        "2xs": ["0.65rem", { lineHeight: "1rem", letterSpacing: "0.04em" }],
        "xs":  ["0.72rem", { lineHeight: "1.1rem" }],
        "sm":  ["0.82rem", { lineHeight: "1.25rem" }],
        "base":["0.92rem", { lineHeight: "1.55rem" }],
        "lg":  ["1.05rem", { lineHeight: "1.55rem" }],
        "xl":  ["1.25rem", { lineHeight: "1.6rem" }],
        "2xl": ["1.55rem", { lineHeight: "1.7rem", letterSpacing: "-0.02em" }],
        "3xl": ["1.95rem", { lineHeight: "1.05",   letterSpacing: "-0.025em" }],
        "4xl": ["2.45rem", { lineHeight: "1.05",   letterSpacing: "-0.03em"  }],
        "5xl": ["3.20rem", { lineHeight: "1.04",   letterSpacing: "-0.035em" }],
        "6xl": ["4.20rem", { lineHeight: "1.02",   letterSpacing: "-0.04em"  }],
      },
      letterSpacing: {
        tightest: "-0.045em",
      },
      maxWidth: {
        wrap: "1100px",
        prose: "68ch",
      },
      keyframes: {
        // CRT-style cursor that blinks on the off-beat.
        cursor: {
          "0%, 49%": { opacity: "1" },
          "50%, 100%": { opacity: "0" },
        },
        // Slow scanline that drifts down the page — atmosphere, not noise.
        scanline: {
          "0%":   { transform: "translateY(-30%)" },
          "100%": { transform: "translateY(130vh)" },
        },
        // Type-on effect for the hero terminal log.
        typeon: {
          "0%":  { opacity: "0", transform: "translateX(-2px)" },
          "60%": { opacity: "1", transform: "translateX(0)"   },
          "100%":{ opacity: "1" },
        },
        // Modeline tick — half-second pulse on a status indicator.
        tick: {
          "0%, 100%": { opacity: "0.4" },
          "50%":      { opacity: "1"   },
        },
      },
      animation: {
        cursor: "cursor 1.05s steps(1) infinite",
        scanline: "scanline 12s linear infinite",
        typeon: "typeon 0.4s ease-out both",
        tick: "tick 2s ease-in-out infinite",
      },
      backgroundImage: {
        // Faint hairline grid. Used as an atmospheric background.
        grid:
          "linear-gradient(to right, #1a2218 1px, transparent 1px), " +
          "linear-gradient(to bottom, #1a2218 1px, transparent 1px)",
        // Phosphor glow under the green accent — visible on hover.
        phosphor:
          "radial-gradient(circle at center, #7dc48a 0%, transparent 60%)",
      },
      backgroundSize: {
        grid: "44px 44px",
      },
      boxShadow: {
        // 1-px inner border + dark drop, like a Proxmox card.
        tile:    "inset 0 0 0 1px #232d1f, 0 8px 24px -12px rgba(0,0,0,0.6)",
        "tile-hi": "inset 0 0 0 1px #5a9e6a, 0 12px 32px -12px rgba(125,196,138,0.18)",
        // Glow on focus rings.
        focus:   "0 0 0 1px #5a9e6a, 0 0 0 4px rgba(90,158,106,0.25)",
      },
    },
  },
  plugins: [],
};
