# Hardware visual assets

These SVGs are used as decorative compositional elements in the hero section of the velocit.ee landing page. They're styled with `mix-blend-mode: screen` and a hue-rotated saturation filter so they composite into the dark canvas background as ghost-blue silhouettes.

## What ships now

- `rack-server.svg` — primary hero asset, ~200x260, server rack with 6 1U slots, console panel, and an "ONLINE" readout. Uses `currentColor` for the frame so it inherits the parent's text color (`var(--v-blue-hi)` via the `.hw-asset` class).
- `server-1u.svg` — secondary decorative asset, ~200x60, a single 1U with drive bays and LEDs. Used at low opacity behind the primary asset.

Both files are original artwork, freely licensed under the same terms as the rest of `velocit-ee/web` (MIT for site config; engines content under Apache 2.0). No third-party attribution required.

## Optional swap-in: SVGRepo CC0 assets

The original design brief recommended these CC0-licensed assets from SVGRepo. We're not using them today because (a) the originals above already match the aesthetic and (b) we want to stay self-sufficient on assets. If at any point you'd like to swap one in:

| File to save as              | SVGRepo URL |
|------------------------------|-------------|
| `server-rack-svgrepo.svg`    | https://www.svgrepo.com/svg/28627/server-rack |
| `rack-server-svgrepo.svg`    | https://www.svgrepo.com/svg/352941/rack-server |
| `rack-server-network.svg`    | https://www.svgrepo.com/svg/103969/rack-server-network |
| `rack-servers-svgrepo.svg`   | https://www.svgrepo.com/svg/116094/rack-servers |
| `server-svgrepo.svg`         | https://www.svgrepo.com/svg/474394/server |
| `1u-server-svgrepo.svg`      | https://www.svgrepo.com/svg/474398/1u-server |
| `server-computer.svg`        | https://www.svgrepo.com/svg/147248/server-computer |

After download:

1. Strip any hardcoded `fill="…"` colors — replace with `currentColor` so the velocitee CSS can tint them.
2. Remove `width=` / `height=` from the root `<svg>`; let CSS control sizing.
3. Verify `viewBox` is present.
4. Run `npx svgo --multipass <file>` to optimize.

License: those assets are CC0 1.0 Universal (Public Domain). No attribution required, but a courtesy citation in this file is good form.
