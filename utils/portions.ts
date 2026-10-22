/** How much of a planned meal was had: the choices when ticking one off or editing its entry */
export const PORTIONS = [0.5, 1, 1.5, 2] as const;

export const portionLabel = (portions: number) => (portions === 0.5 ? '½' : portions === 1.5 ? '1½' : String(portions));

/** An amount logged for `from` portions, scaled to `to` (whole numbers, as the log stores them) */
export const scaleToPortions = (amount: number, from: number, to: number) => Math.round((amount / (from || 1)) * to);
