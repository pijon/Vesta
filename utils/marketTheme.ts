/**
 * The "Market day" look (the marketTheme dev flag). The flag needs the developer claim, which loads
 * after start-up, so the choice is also remembered on the device: index.html reads MARKET_THEME_KEY
 * before the first paint, so the splash and the login screen match and the app doesn't flash the old
 * look while the claim loads. Keep MARKET_FONTS_URL in sync with the copy in index.html.
 */
export const MARKET_THEME_KEY = 'vesta_marketTheme';
export const MARKET_FONTS_URL = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=DM+Sans:opsz,wght@9..40,400..700&display=swap';
const MARKET_FONTS_ID = 'market-fonts';

/** Whether this device last used the look (for screens shown before sign-in) */
export const marketThemeOnDevice = () => {
  try { return localStorage.getItem(MARKET_THEME_KEY) === '1'; } catch { return false; }
};

/** Turns the look on or off: the class on <html>, its fonts (loaded on first use) and the device memory. */
export const applyMarketTheme = (on: boolean) => {
  document.documentElement.classList.toggle('theme-market', on);
  if (on && !document.getElementById(MARKET_FONTS_ID)) {
    const link = document.createElement('link');
    link.id = MARKET_FONTS_ID;
    link.rel = 'stylesheet';
    link.href = MARKET_FONTS_URL;
    document.head.appendChild(link);
  }
  try { localStorage.setItem(MARKET_THEME_KEY, on ? '1' : '0'); } catch { /* per-device convenience */ }
};
