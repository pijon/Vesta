import React, { useEffect, useState } from 'react';
import { Avatar, Tint } from '../types';

/**
 * The metric tints, in picker order. Avatars keep the light tint in dark mode too: the figures
 * are drawn in black ink, which would vanish on the dark tints.
 */
export const TINTS: { tint: Tint; label: string; hex: string }[] = [
    { tint: 'calories', label: 'Tomato', hex: '#FFD9CC' },
    { tint: 'fasting', label: 'Butter', hex: '#FFE9A8' },
    { tint: 'weight', label: 'Green', hex: '#D3EEDC' },
    { tint: 'water', label: 'Sky', hex: '#D6EBFF' },
    { tint: 'workout', label: 'Pink', hex: '#FFD9E4' },
];

const tintHex = (tint: Tint) => (TINTS.find(t => t.tint === tint) ?? TINTS[0]).hex;

const hash = (text: string) => [...text].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

/** A stable avatar for someone who hasn't picked one: a figure from their uid, on a tint from it */
export const defaultAvatar = (uid: string): Avatar => ({ seed: uid, tint: TINTS[hash(uid) % TINTS.length].tint });

/** The avatar to draw: the chosen one if it's valid, else the default */
export const resolveAvatar = (avatar: Avatar | undefined, uid: string): Avatar =>
    avatar && typeof avatar.seed === 'string' && avatar.seed && TINTS.some(t => t.tint === avatar.tint) ? avatar : defaultAvatar(uid);

/** A fresh figure for the picker */
export const randomSeed = () => crypto.randomUUID().slice(0, 8);

type Draw = (avatar: Avatar) => string;

// The figures' artwork is large (about 110 kB gzipped), so it loads in its own chunk after the
// page; until then an avatar is its plain tint. Each figure is drawn once per seed and tint.
let draw: Draw | null = null;
let loading: Promise<Draw> | null = null;
const drawn = new Map<string, string>();

const loadDraw = (): Promise<Draw> => loading ??= Promise.all([import('@dicebear/core'), import('@dicebear/open-peeps')])
    .then(([{ createAvatar }, openPeeps]) => {
        draw = ({ seed, tint }) => {
            const key = `${seed}|${tint}`;
            let uri = drawn.get(key);
            if (!uri) {
                uri = createAvatar(openPeeps, {
                    seed,
                    radius: 50,
                    backgroundColor: [tintHex(tint).slice(1)],
                    maskProbability: 0,
                }).toDataUri();
                drawn.set(key, uri);
            }
            return uri;
        };
        return draw;
    })
    .catch(e => { loading = null; throw e; }); // try again on the next avatar

/** The avatar as a data URI: an Open Peeps figure (Pablo Stanley, CC0, via DiceBear) on its round tint */
export const drawAvatar = async (avatar: Avatar): Promise<string> => (draw ?? await loadDraw())(avatar);

interface MemberAvatarProps {
    avatar?: Avatar;
    /** For the default when no avatar is chosen */
    uid: string;
    /** Diameter in px */
    size?: number;
    className?: string;
}

/** A member's avatar: a hand-drawn figure on a round tint. Decorative: the name goes next to it. */
export const MemberAvatar: React.FC<MemberAvatarProps> = ({ avatar, uid, size = 44, className = '' }) => {
    const resolved = resolveAvatar(avatar, uid);
    const [uri, setUri] = useState<string | null>(() => draw?.(resolved) ?? null);

    useEffect(() => {
        let cancelled = false;
        drawAvatar(resolved)
            .then(next => { if (!cancelled) setUri(next); })
            .catch(e => console.warn('Could not draw the avatar', e));
        return () => { cancelled = true; };
    }, [resolved.seed, resolved.tint]);

    return uri ? (
        <img
            src={uri}
            alt=""
            width={size}
            height={size}
            className={`shrink-0 rounded-full select-none ${className}`}
            draggable={false}
        />
    ) : (
        <span
            className={`shrink-0 rounded-full inline-block ${className}`}
            style={{ width: size, height: size, background: tintHex(resolved.tint) }}
            aria-hidden="true"
        />
    );
};

/** The family as its people: members' avatars overlapping, standing in for a crest */
export const FamilyFaces: React.FC<{ members: { id: string; avatar?: Avatar }[]; size?: number; max?: number }> = ({ members, size = 48, max = 5 }) => {
    const shown = members.slice(0, max);
    const extra = members.length - shown.length;
    return (
        <span className="flex shrink-0 items-center" aria-hidden="true">
            {shown.map((member, i) => (
                <MemberAvatar
                    key={member.id}
                    avatar={member.avatar}
                    uid={member.id}
                    size={size}
                    className={`border-[3px] border-[var(--surface)] box-content ${i > 0 ? '-ml-3' : ''}`}
                />
            ))}
            {extra > 0 && (
                <span
                    className="-ml-3 rounded-full bg-surface-sunken border-[3px] border-[var(--surface)] box-content flex items-center justify-center text-sm font-bold text-main"
                    style={{ width: size, height: size }}
                >
                    +{extra}
                </span>
            )}
        </span>
    );
};
