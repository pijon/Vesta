// Counts writes made on this device to what App's refresh reads back (day plans, recipes, the
// diary, fasting, stats, which family the user is in). A write counts when it starts and again
// when it's done, so a refresh can tell whether it may have read from before one (see refreshData).
let count = 0;

export const noteLocalWrite = () => { count++; };
export const localWriteCount = () => count;
