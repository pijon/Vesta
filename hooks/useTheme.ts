import { useEffect, useState } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';

/** Read before React mounts by the script in index.html, so keep the key in sync there. */
export const THEME_KEY = 'vesta_theme';

const readPreference = (): ThemePreference => {
    try {
        const saved = localStorage.getItem(THEME_KEY);
        if (saved === 'light' || saved === 'dark') return saved;
    } catch { /* storage blocked: follow the system */ }
    return 'system';
};

const systemQuery = () => window.matchMedia('(prefers-color-scheme: dark)');

/**
 * The theme preference and whether dark mode is on now. 'system' follows the device,
 * including when it switches at sunset. Sets the `dark` class on <html>.
 */
export const useTheme = () => {
    const [preference, setPreference] = useState<ThemePreference>(readPreference);
    const [systemDark, setSystemDark] = useState(() => systemQuery().matches);

    useEffect(() => {
        const query = systemQuery();
        const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
        query.addEventListener('change', onChange);
        return () => query.removeEventListener('change', onChange);
    }, []);

    const isDark = preference === 'dark' || (preference === 'system' && systemDark);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', isDark);
    }, [isDark]);

    const changePreference = (next: ThemePreference) => {
        setPreference(next);
        try {
            if (next === 'system') localStorage.removeItem(THEME_KEY);
            else localStorage.setItem(THEME_KEY, next);
        } catch { /* storage blocked: applies for this visit only */ }
    };

    return { preference, isDark, setPreference: changePreference };
};
