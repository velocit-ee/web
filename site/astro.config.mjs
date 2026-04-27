import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import mdx from "@astrojs/mdx";

// https://astro.build/config
//
// @astrojs/sitemap is intentionally NOT wired here — current versions throw
// `reduce of undefined` on our build. We'll add it back when stable; for now
// robots.txt + good link hygiene cover indexing.
export default defineConfig({
  site: "https://velocit.ee",
  trailingSlash: "ignore",
  integrations: [
    tailwind({
      // We supply our own root CSS that imports Tailwind directives manually,
      // so the integration only needs to wire the build pipeline.
      applyBaseStyles: false,
    }),
    mdx(),
  ],
  build: {
    // Express serves site/dist as static; output assets under /_assets so they
    // never collide with /api/*.
    assets: "_assets",
  },
  vite: {
    server: {
      // Astro dev runs on 4321; let it stay there. Express runs on 3000.
      // For dev, hit http://localhost:4321 directly. For prod, Express serves
      // the built output and proxies /api/* itself.
    },
  },
});
