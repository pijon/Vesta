# App icon

`vesta-icon.svg` is the source for every icon size; `vesta-icon-maskable.svg` is the same art scaled into Android's 80% safe zone. `public/favicon.svg` is the rounded browser-tab version.

All PNGs in `public/` (`pwa-192x192`, `pwa-512x512`, `pwa-maskable-512x512`, `apple-touch-icon`) and `favicon.ico` (16 + 32) are rendered from these SVGs. Keep them full-bleed squares with no transparency: iOS and Android apply their own corner masks.
