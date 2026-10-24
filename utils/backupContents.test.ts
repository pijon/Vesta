import { describe, expect, it } from 'vitest';
import { recipesOnlyCount } from './backupContents';

describe('recipesOnlyCount', () => {
  it('counts the recipes in a recipes-only file', () => {
    expect(recipesOnlyCount('{"recipes": [{"name": "A"}, {"name": "B"}]}')).toBe(2);
    expect(recipesOnlyCount('{"recipes": []}')).toBe(0);
  });

  it('treats anything more as a full backup', () => {
    expect(recipesOnlyCount('{"recipes": [], "days": {}}')).toBeNull();
    expect(recipesOnlyCount('{"stats": {}}')).toBeNull();
    expect(recipesOnlyCount('{"recipes": {}}')).toBeNull();
    expect(recipesOnlyCount('[]')).toBeNull();
    expect(recipesOnlyCount('not json')).toBeNull();
  });
});
