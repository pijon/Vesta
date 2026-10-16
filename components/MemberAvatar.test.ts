import { describe, expect, it } from 'vitest';
import { defaultAvatar, drawAvatar, resolveAvatar } from './MemberAvatar';
import { Tint } from '../types';

describe('avatars', () => {
  it('gives everyone a stable default figure from their uid', async () => {
    expect(defaultAvatar('abc')).toEqual(defaultAvatar('abc'));
    expect(defaultAvatar('abc').seed).toBe('abc');
    expect(await drawAvatar(defaultAvatar('abc'))).toBe(await drawAvatar(defaultAvatar('abc')));
  });

  it('draws a different figure for a different seed', async () => {
    expect(await drawAvatar({ seed: 'a', tint: 'water' })).not.toBe(await drawAvatar({ seed: 'b', tint: 'water' }));
    expect(await drawAvatar({ seed: 'a', tint: 'water' })).toMatch(/^data:image\/svg\+xml/);
  });

  it('draws a chosen avatar, and the default for one it cannot draw', () => {
    expect(resolveAvatar({ seed: 'ab12cd34', tint: 'water' }, 'abc')).toEqual({ seed: 'ab12cd34', tint: 'water' });
    expect(resolveAvatar({ seed: '', tint: 'water' }, 'abc')).toEqual(defaultAvatar('abc'));
    expect(resolveAvatar({ seed: 'x', tint: 'purple' as Tint }, 'abc')).toEqual(defaultAvatar('abc'));
    expect(resolveAvatar(undefined, 'abc')).toEqual(defaultAvatar('abc'));
  });
});
