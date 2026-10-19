/**
 * Whether a user's tracking reminders go out, from their saved experience (users/{uid}/data/preferences,
 * written by the app; see utils/userPreferences.ts there).
 *
 * - send:  tracking, or no saved choice yet (accounts from before the choice existed keep tracking)
 * - quiet: Plan meals, or tracking whose setup isn't finished. Reminders that fall due are marked as
 *          handled without being sent, so switching back to tracking doesn't deliver them all at once
 * - skip:  an unreadable choice. Nothing is sent or marked, and it's logged
 *
 * The saved reminder settings are left as they are either way, ready for when tracking is back.
 */
export type ReminderMode = 'send' | 'quiet' | 'skip';

export const reminderMode = (preferences: unknown): ReminderMode => {
  if (preferences === undefined || preferences === null) return 'send';
  if (typeof preferences !== 'object' || Array.isArray(preferences)) return 'skip';
  const { version, experience, trackingSetupComplete } = preferences as Record<string, unknown>;
  if (version !== 1 || typeof trackingSetupComplete !== 'boolean') return 'skip';
  if (experience === 'planning') return 'quiet';
  if (experience === 'tracking') return trackingSetupComplete ? 'send' : 'quiet';
  return 'skip';
};
