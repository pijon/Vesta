import React, { useState } from 'react';
import { Check, Shuffle } from 'lucide-react';
import { Avatar } from '../types';
import { Sheet } from './Sheet';
import { MemberAvatar, TINTS, randomSeed } from './MemberAvatar';

/** Figures offered at a time */
const CHOICES = 12;

const freshSeeds = () => Array.from({ length: CHOICES }, randomSeed);

interface AvatarPickerProps {
    uid: string;
    /** The avatar as it is now (resolved, so never empty) */
    initial: Avatar;
    onSave: (avatar: Avatar) => Promise<void> | void;
    onClose: () => void;
}

/** Choose your avatar: a figure from a grid (shuffle for more) and the colour behind it. */
export const AvatarPicker: React.FC<AvatarPickerProps> = ({ uid, initial, onSave, onClose }) => {
    const [seed, setSeed] = useState(initial.seed);
    const [tint, setTint] = useState(initial.tint);
    // The current figure stays first, so it can be picked again after browsing
    const [seeds, setSeeds] = useState(() => [initial.seed, ...freshSeeds().slice(1)]);
    const [saving, setSaving] = useState(false);

    const save = async () => {
        setSaving(true);
        try {
            await onSave({ seed, tint });
            onClose();
        } finally {
            setSaving(false);
        }
    };

    return (
        <Sheet
            title="Your avatar"
            subtitle="Your family sees it next to your name."
            onClose={onClose}
            footer={
                <button onClick={save} disabled={saving} className="btn-primary btn-block">
                    {saving ? 'Saving…' : 'Save'}
                </button>
            }
        >
            <div className="flex justify-center py-2">
                <MemberAvatar avatar={{ seed, tint }} uid={uid} size={112} />
            </div>

            <fieldset className="mt-4">
                <legend className="text-sm font-semibold mb-2">Colour</legend>
                <div className="flex flex-wrap gap-3">
                    {TINTS.map(t => (
                        <button
                            key={t.tint}
                            type="button"
                            onClick={() => setTint(t.tint)}
                            aria-pressed={tint === t.tint}
                            aria-label={t.label}
                            title={t.label}
                            className={`size-11 rounded-full flex items-center justify-center text-[#1B1B1B] outline-offset-2 focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)] ${tint === t.tint ? 'outline-2 outline-[var(--ink)]' : ''}`}
                            style={{ background: t.hex }}
                        >
                            {tint === t.tint && <Check size={18} strokeWidth={3} aria-hidden="true" />}
                        </button>
                    ))}
                </div>
            </fieldset>

            <div className="mt-5" role="group" aria-labelledby="avatar-figure-label">
                <div className="flex items-center justify-between gap-3 mb-2">
                    <p id="avatar-figure-label" className="text-sm font-semibold">Figure</p>
                    <button type="button" onClick={() => setSeeds([seed, ...freshSeeds().slice(1)])} className="btn-ghost btn-sm -mr-3">
                        <Shuffle size={16} aria-hidden="true" /> More
                    </button>
                </div>
                <div className="grid grid-cols-4 gap-3">
                    {seeds.map((s, i) => (
                        <button
                            key={s}
                            type="button"
                            onClick={() => setSeed(s)}
                            aria-pressed={seed === s}
                            aria-label={`Figure ${i + 1}`}
                            className={`aspect-square rounded-full flex items-center justify-center outline-offset-2 focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)] ${seed === s ? 'outline-[3px] outline-[var(--ink)]' : ''}`}
                        >
                            <MemberAvatar avatar={{ seed: s, tint }} uid={uid} size={64} className="w-full h-auto" />
                        </button>
                    ))}
                </div>
            </div>
        </Sheet>
    );
};
