import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";

// https://astro.build/config
//
// Tailwind 3 runs through postcss.config.mjs — the deprecated
// @astrojs/tailwind integration capped at Astro 5 and was only a wrapper
// around the same PostCSS setup. tailwind.config.mjs (the design tokens)
// is unchanged.
export default defineConfig({
  site: "https://velocit.ee",
  trailingSlash: "ignore",
  integrations: [mdx()],
  build: {
    // Static output is served by the Cloudflare Worker (assets binding) in
    // production and by Express locally; assets live under /_assets so they
    // never collide with /api/*.
    assets: "_assets",
  },
});
