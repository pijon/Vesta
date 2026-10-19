import type { UserPreferences, UserStats } from '../types';
import { localDateString, parseLocalDate } from './dateUtils';

export const isCalendarDate = (value: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && localDateString(parseLocalDate(value)) === value;

export const parseUserPreferences = (value: unknown): UserPreferences => {
  if (!value || typeof value !== 'object') throw new Error('Your saved setup could not be read. Try again.');
  const data = value as Record<string, unknown>;
  if (data.version !== 1 || (data.experience !== 'planning' && data.experience !== 'tracking')
    || typeof data.profileSetupComplete !== 'boolean' || typeof data.trackingSetupComplete !== 'boolean'
    || (data.trackingSetupComplete && !data.profileSetupComplete)) {
    throw new Error('Your saved setup could not be read. Try again.');
  }
  return { version: 1, experience: data.experience, profileSetupComplete: data.profileSetupComplete, trackingSetupComplete: data.trackingSetupComplete };
};

export const legacyUserPreferences = (stats: Partial<UserStats> | null): UserPreferences | null => {
  if (stats === null) return null;
  const tracked = Array.isArray(stats.weightHistory) && stats.weightHistory.some(entry =>
    entry && typeof entry.date === 'string' && isCalendarDate(entry.date)
    && Number.isFinite(entry.weight) && entry.weight > 0);
  const hasName = typeof stats.name === 'string' && stats.name.trim().length > 0 && stats.name.trim().length <= 100;
  return { version: 1, experience: 'tracking', profileSetupComplete: tracked || hasName, trackingSetupComplete: tracked };
};
