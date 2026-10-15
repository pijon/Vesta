# App icon

The mark is the one in `components/VestaMark.tsx`: a butter (#FFD23F) flame over a cream (#FFF1D6) bowl on a tomato (#FF5533) tile. Change both together.

`vesta-icon.svg` is the source for every icon size; `vesta-icon-maskable.svg` is the same art scaled into Android's 80% safe zone. `public/favicon.svg` is the rounded browser-tab version.

All PNGs in `public/` (`pwa-192x192`, `pwa-512x512`, `pwa-maskable-512x512`, `apple-touch-icon`) are rendered from these SVGs; `favicon.ico` (16 + 32) and `public/resources/logo_light.png` / `logo_dark.png` (288px) from the rounded `public/favicon.svg`. Keep the app icons full-bleed squares with no transparency: iOS and Android apply their own corner masks.

`vesta-badge.svg` is the notification badge (`public/notification-badge.png`, 96px, used by `public/push-sw.js`). Unlike the app icons it must be a white silhouette on a transparent background: Android draws only its alpha channel in the status bar.
