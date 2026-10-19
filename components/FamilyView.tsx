import React, { useEffect, useState } from 'react';
import { Avatar, Group } from '../types';
import {
    joinGroup, leaveGroup, renameGroup, getUserGroup, getGroupMembersDetails, ensureInviteCode,
    newInviteCode, removeMember, familyAdmin, FAMILY_NAME_MAX_LENGTH, MemberDetails,
} from '../services/groupService';
import { FamilyFaces, MemberAvatar, resolveAvatar } from './MemberAvatar';
import { AvatarPicker } from './AvatarPicker';
import { FamilyUpdates } from './FamilyUpdates';
import { recordFamilyUpdate } from '../services/activityService';
import { currentUid } from '../services/firebase';
import { familyData } from '../services/pageData';
import { ensureWarm } from '../utils/prewarm';
import { CircleAlert, Check, Copy, LogIn, LogOut, Pencil, RefreshCw, Share2, UserMinus } from 'lucide-react';

type Member = MemberDetails;

interface FamilyViewProps {
    /** The user's own avatar, from their stats (fresher than the family's copy of their profile) */
    myAvatar?: Avatar;
    onSaveAvatar: (avatar: Avatar) => Promise<void> | void;
}

const errorText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

/** Destructive confirm button: rose, for leaving the family or removing someone */
const dangerButton = 'btn-sm inline-flex items-center gap-1.5 min-h-9 px-4 rounded-full font-semibold bg-error text-on-ink hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] disabled:opacity-60';

/**
 * The Family page: who's in the family and how to change that. The admin can remove members;
 * anyone can invite with the code, rename the family or leave. Each member picks their own avatar,
 * and the family is shown as its members' faces, with what they've been up to. Family meals are in the planner.
 */
export const FamilyView: React.FC<FamilyViewProps> = ({ myAvatar, onSaveAvatar }) => {
    const [group, setGroup] = useState<Group | null>(null);
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [inviteCodeInput, setInviteCodeInput] = useState('');
    /** The name being typed while renaming; null when not renaming */
    const [nameDraft, setNameDraft] = useState<string | null>(null);
    /** The member whose removal is being confirmed */
    const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
    const [confirmLeave, setConfirmLeave] = useState(false);
    const [codeCopied, setCodeCopied] = useState(false);
    const [pickingAvatar, setPickingAvatar] = useState(false);

    const loadGroup = async () => {
        setLoading(true);
        try {
            let g = await getUserGroup();
            if (g) {
                try {
                    g = await ensureInviteCode(g);
                } catch (e) {
                    console.error('Error updating invite code:', e);
                }
            }
            setGroup(g);
            setMembers(g ? await getGroupMembersDetails(g.memberIds) : []);
        } catch (e) {
            console.error('Error loading group:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadGroup(); }, []);

    /** Runs a change to the family, showing its error; refreshes what other pages know about the family */
    const run = async (action: () => Promise<void>, fallback: string) => {
        setBusy(true);
        setError(null);
        setNotice(null);
        try {
            await action();
            void ensureWarm(familyData, true);
        } catch (e) {
            setError(errorText(e, fallback));
        } finally {
            setBusy(false);
        }
    };

    const handleRename = () => {
        if (!group || nameDraft === null) return;
        if (nameDraft.trim() === group.name) { setNameDraft(null); return; }
        run(async () => {
            const name = await renameGroup(group.id, nameDraft);
            setGroup({ ...group, name });
            setNameDraft(null);
        }, "We couldn't rename the family. Try again.");
    };

    const handleRemove = (member: Member) => {
        if (!group) return;
        run(async () => {
            const updated = await removeMember(group, member.id);
            setGroup(updated);
            setMembers(list => list.filter(m => m.id !== member.id));
            setConfirmRemove(null);
            setNotice(`${member.name} is no longer in ${group.name}. The invite code has changed, so they can't rejoin with the old one.`);
        }, `We couldn't remove ${member.name}. Try again.`);
    };

    const handleNewCode = () => {
        if (!group) return;
        run(async () => {
            setGroup(await newInviteCode(group));
            setNotice('New invite code. The old one no longer works.');
        }, "We couldn't make a new code. Try again.");
    };

    const handleJoin = () => {
        if (!inviteCodeInput.trim()) return;
        run(async () => {
            await joinGroup(inviteCodeInput);
            void recordFamilyUpdate({ type: 'joined' });
            setInviteCodeInput('');
            await loadGroup();
        }, "That code didn't work. Check it and try again.");
    };

    const handleLeave = () => {
        if (!group) return;
        run(async () => {
            // Leaving starts a new family of one
            await leaveGroup(group.id);
            setConfirmLeave(false);
            await loadGroup();
        }, "We couldn't leave the family. Try again.");
    };

    const handleCopyCode = () => {
        if (!group?.inviteCode) return;
        navigator.clipboard.writeText(group.inviteCode);
        setCodeCopied(true);
        setTimeout(() => setCodeCopied(false), 2000);
    };

    const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
    const handleShare = () => {
        if (!group) return;
        navigator.share({
            title: `Join ${group.name} on Vesta`,
            text: `Join ${group.name} on Vesta with the code ${group.inviteCode}. New to Vesta? Enter it when you set up. Already have an account? Open Family and enter it there.`,
        }).catch(() => { /* dismissed */ });
    };

    if (loading && !group) {
        return (
            <div className="card p-5 md:p-6 space-y-2" aria-busy="true" aria-label="Loading family">
                <div className="h-16 rounded-[14px] bg-surface-sunken animate-pulse" />
                <div className="h-16 rounded-[14px] bg-surface-sunken animate-pulse" />
            </div>
        );
    }

    if (!group) {
        return (
            <div className="card p-5 md:p-6 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted">We couldn't load your family.</p>
                <button onClick={loadGroup} className="btn-secondary btn-sm">Try again</button>
            </div>
        );
    }

    const me = currentUid();
    const admin = familyAdmin(group);
    const isAdmin = admin === me;
    const isSolo = group.memberIds.length < 2;
    // Your own avatar from your stats is fresher than the family's copy of your profile
    const faces = members.map(m => (m.id === me && myAvatar ? { ...m, avatar: myAvatar } : m));

    return (
        <div className="space-y-4">
            {error && (
                <div className="rounded-[14px] bg-error-bg text-error text-sm p-3 flex items-center gap-2" role="alert">
                    <CircleAlert size={16} className="shrink-0" aria-hidden="true" />
                    {error}
                </div>
            )}
            {notice && (
                <div className="rounded-[14px] bg-weight-bg text-weight-text text-sm p-3 flex items-center gap-2" role="status">
                    <Check size={16} className="shrink-0" aria-hidden="true" />
                    {notice}
                </div>
            )}

            {/* The family: its name and who's in it */}
            <section className="card p-5 md:p-6" aria-labelledby="family-name-heading">
                {nameDraft !== null ? (
                    <form
                        className="flex flex-col sm:flex-row gap-2"
                        onSubmit={(e) => { e.preventDefault(); handleRename(); }}
                        onKeyDown={(e) => { if (e.key === 'Escape') setNameDraft(null); }}
                    >
                        <label htmlFor="family-name" className="sr-only">Family name</label>
                        <input
                            id="family-name"
                            type="text"
                            value={nameDraft}
                            maxLength={FAMILY_NAME_MAX_LENGTH}
                            onChange={e => setNameDraft(e.target.value)}
                            className="input w-full"
                            autoFocus
                        />
                        <div className="flex gap-2 shrink-0">
                            <button type="submit" disabled={!nameDraft.trim() || busy} className="btn-primary btn-sm">Save</button>
                            <button type="button" onClick={() => setNameDraft(null)} className="btn-ghost btn-sm">Cancel</button>
                        </div>
                    </form>
                ) : (
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                            {/* No crest: the family is its people (alone, your row below says it) */}
                            {!isSolo && <FamilyFaces members={faces} size={52} />}
                            <h2 id="family-name-heading" className={`heading-2 truncate ${isSolo ? '' : 'mt-3'}`}>{group.name}</h2>
                            <p className="text-sm text-muted mt-0.5">
                                {isSolo ? 'Just you so far' : `${group.memberIds.length} members`}
                            </p>
                        </div>
                        <button
                            onClick={() => setNameDraft(group.name)}
                            className="icon-btn !bg-transparent hover:!bg-surface-sunken shrink-0"
                            aria-label="Rename family"
                            title="Rename family"
                        >
                            <Pencil size={16} aria-hidden="true" />
                        </button>
                    </div>
                )}

                <ul className="mt-4">
                    {members.map(member => {
                        const isYou = member.id === me;
                        const isMemberAdmin = member.id === admin;
                        const confirming = confirmRemove === member.id;
                        return (
                            <li key={member.id} className="border-t border-border first:border-t-0 py-2.5">
                                <div className="flex items-center gap-3">
                                    {isYou ? (
                                        <button
                                            onClick={() => setPickingAvatar(true)}
                                            className="relative shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] active:scale-95 transition-transform"
                                            aria-label="Choose your avatar"
                                            title="Choose your avatar"
                                        >
                                            <MemberAvatar avatar={myAvatar ?? member.avatar} uid={member.id} />
                                            <span className="absolute -bottom-0.5 -right-0.5 size-5 rounded-full bg-surface-sunken border-2 border-[var(--surface)] flex items-center justify-center text-main" aria-hidden="true">
                                                <Pencil size={11} strokeWidth={2.5} />
                                            </span>
                                        </button>
                                    ) : (
                                        <MemberAvatar avatar={member.avatar} uid={member.id} />
                                    )}
                                    <span className="flex-1 min-w-0">
                                        <span className="block font-semibold truncate">{member.name}{isYou ? ' (you)' : ''}</span>
                                        <span className="block text-sm text-muted">{isMemberAdmin ? 'Family admin' : 'Member'}</span>
                                    </span>
                                    {isAdmin && !isYou && !confirming && (
                                        <button
                                            onClick={() => { setConfirmRemove(member.id); setConfirmLeave(false); }}
                                            className="icon-btn !bg-transparent hover:!bg-error-bg hover:!text-error text-muted shrink-0"
                                            aria-label={`Remove ${member.name} from the family`}
                                            title="Remove from family"
                                        >
                                            <UserMinus size={18} aria-hidden="true" />
                                        </button>
                                    )}
                                </div>
                                {confirming && (
                                    <div role="alertdialog" aria-label={`Remove ${member.name}?`} className="mt-2 rounded-[14px] bg-error-bg p-4 space-y-3">
                                        <p className="text-sm">
                                            <span className="font-semibold">Remove {member.name}?</span> Recipes and family meals stay with {group.name}. Next time they open Vesta they'll start a family of their own, with copies of the recipes they added or have planned.
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            <button onClick={() => handleRemove(member)} disabled={busy} className={dangerButton}>
                                                <UserMinus size={16} aria-hidden="true" /> Remove
                                            </button>
                                            <button onClick={() => setConfirmRemove(null)} className="btn-ghost btn-sm">Cancel</button>
                                        </div>
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>

                {!isSolo && (
                    <div className="border-t border-border mt-1 pt-3">
                        {confirmLeave ? (
                            <div role="alertdialog" aria-label="Leave family?" className="rounded-[14px] bg-error-bg p-4 space-y-3">
                                <p className="text-sm">
                                    <span className="font-semibold">Leave {group.name}?</span> The family keeps all its recipes and family meals. You'll start a family of your own with copies of the recipes you added.
                                    {isAdmin && ' Someone else in the family becomes its admin.'}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    <button onClick={handleLeave} disabled={busy} className={dangerButton}>
                                        <LogOut size={16} aria-hidden="true" /> Leave family
                                    </button>
                                    <button onClick={() => setConfirmLeave(false)} className="btn-ghost btn-sm">Stay</button>
                                </div>
                            </div>
                        ) : (
                            <button onClick={() => { setConfirmLeave(true); setConfirmRemove(null); }} className="btn-ghost btn-sm -ml-3 !text-error hover:!bg-error-bg">
                                <LogOut size={16} aria-hidden="true" /> Leave family
                            </button>
                        )}
                    </div>
                )}
            </section>

            {!isSolo && <FamilyUpdates me={me} members={faces} />}

            {/* Adding someone: the code to share */}
            <section className="card p-5 md:p-6" aria-labelledby="invite-heading">
                <h2 id="invite-heading" className="heading-3">Invite someone</h2>
                <p className="text-sm text-muted mt-0.5">
                    They enter this code on their Family page. Everyone shares the family's recipes and family meals.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                        onClick={handleCopyCode}
                        className="inline-flex items-center gap-2 rounded-full bg-surface-sunken pl-4 pr-3 min-h-11 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                        aria-label={codeCopied ? 'Invite code copied' : `Copy invite code ${group.inviteCode}`}
                    >
                        <span className="font-mono font-bold text-lg tracking-wider">{group.inviteCode}</span>
                        {codeCopied ? <Check size={16} className="text-weight-text" aria-hidden="true" /> : <Copy size={16} className="text-muted" aria-hidden="true" />}
                    </button>
                    {canShare && (
                        <button onClick={handleShare} className="btn-primary btn-sm">
                            <Share2 size={16} aria-hidden="true" /> Share
                        </button>
                    )}
                    <button onClick={handleNewCode} disabled={busy} className="btn-ghost btn-sm" title="The old code stops working">
                        <RefreshCw size={16} aria-hidden="true" /> New code
                    </button>
                </div>
            </section>

            {pickingAvatar && me && (
                <AvatarPicker
                    uid={me}
                    initial={resolveAvatar(myAvatar, me)}
                    onSave={async avatar => {
                        await onSaveAvatar(avatar);
                        setMembers(list => list.map(m => (m.id === me ? { ...m, avatar } : m)));
                    }}
                    onClose={() => setPickingAvatar(false)}
                />
            )}

            {/* Joining another family: only from a family of one */}
            {isSolo && (
                <form
                    className="card p-5 md:p-6 space-y-3"
                    aria-labelledby="join-heading"
                    onSubmit={(e) => { e.preventDefault(); handleJoin(); }}
                >
                    <div className="flex items-center gap-3">
                        <span className="icon-tile tile-water size-10 shrink-0 flex items-center justify-center"><LogIn size={18} aria-hidden="true" /></span>
                        <div>
                            <h2 id="join-heading" className="heading-3">Join a family</h2>
                            <p className="text-sm text-muted">Use the code someone shared. Your recipes come with you.</p>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <label htmlFor="invite-code" className="sr-only">Invite code</label>
                        <input
                            id="invite-code"
                            type="text"
                            placeholder="Invite code"
                            autoCapitalize="characters"
                            value={inviteCodeInput}
                            onChange={e => setInviteCodeInput(e.target.value)}
                            className="input w-full font-mono"
                        />
                        <button type="submit" disabled={!inviteCodeInput.trim() || busy} className="btn-secondary btn-sm shrink-0">
                            Join family
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
};
