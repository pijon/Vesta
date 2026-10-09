/**
 * Calendar dates are stored as YYYY-MM-DD in the user's local time zone.
 * Never derive them from toISOString(), which gives the UTC date and puts
 * entries made just after local midnight on the previous day.
 */

/** Local calendar date of `date` (default: now) as YYYY-MM-DD. */
export const localDateString = (date: Date = new Date()): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

/**
 * Parses YYYY-MM-DD as local midnight. `new Date('YYYY-MM-DD')` parses as
 * UTC midnight, which is the previous local day west of UTC.
 */
export const parseLocalDate = (dateString: string): Date => {
    const [y, m, d] = dateString.split('-').map(Number);
    return new Date(y, m - 1, d);
};
