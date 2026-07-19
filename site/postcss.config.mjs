// Tailwind 3 via PostCSS. The deprecated @astrojs/tailwind integration was
// only a wrapper around exactly this — dropping it unblocks Astro 7 while
// keeping tailwind.config.mjs and the whole design-token theme untouched.
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
