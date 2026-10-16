import React, { useState, useEffect } from 'react';
import { Group } from '../types';
import { joinGroup, leaveGroup, renameGroup, getUserGroup, getGroupMembersDetails, ensureInviteCode, FAMILY_NAME_MAX_LENGTH } from '../services/groupService';
import { currentUid } from '../services/firebase';
import { familyData } from '../services/pageData';
import { ensureWarm } from '../utils/prewarm';
import { CircleAlert, Check, Copy, LogIn, LogOut, CookingPot, Pencil } from 'lucide-react';

export const FamilySettings: React.FC = () => {
    const [group, setGroup] = useState<Group | null>(null);
    const [members, setMembers] = useState<{ id: string, name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [inviteCodeInput, setInviteCodeInput] = useState('');
    const [error, setError] = useState<string | null>(null);
    /** The name being typed while renaming; null when not renaming */
    const [nameDraft, setNameDraft] = useState<string | null>(null);
    const [savingName, setSavingName] = useState(false);

    useEffect(() => {
        loadGroup();
    }, []);

    const loadGroup = async () => {
        setLoading(true);
        try {
            let g = await getUserGroup();
            if (g) {
                try {
                    g = await ensureInviteCode(g);
                } catch (e) {
                    console.error("Error updating invite code:", e);
                }
            }
            setGroup(g);
            if (g) {
                const details = await getGroupMembersDetails(g.memberIds);
                setMembers(details);
            } else {
                setMembers([]);
            }
        } catch (e) {
            console.error("Error loading group:", e);
        } finally {
            setLoading(false);
        }
    };

    const handleRename = async () => {
        if (!group || nameDraft === null) return;
        if (nameDraft.trim() === group.name) { setNameDraft(null); return; }
        setSavingName(true);
        setError(null);
        try {
            const name = await renameGroup(group.id, nameDraft);
            setGroup({ ...group, name });
            setNameDraft(null);
        } catch (e) {
            setError(e instanceof Error && e.message ? e.message : "We couldn't rename the family. Try again.");
        } finally {
            setSavingName(false);
        }
    };

    const handleJoinGroup = async () => {
        if (!inviteCodeInput.trim()) return;
        setLoading(true);
        setError(null);
        try {
            await joinGroup(inviteCodeInput);
            await loadGroup();
            void ensureWarm(familyData, true);
        } catch (e) {
            setError(e instanceof Error && e.message ? e.message : "That code didn't work. Check it and try again.");
            setLoading(false);
        }
    };

    const handleLeaveGroup = async () => {
        if (!group) return;
        setConfirmLeave(false);
        setLoading(true);
        try {
            // Leaving starts a new family of one
            await leaveGroup(group.id);
            await loadGroup();
            void ensureWarm(familyData, true);
        } catch (e) {
            setError(e instanceof Error && e.message ? e.message : "We couldn't leave the family. Try again.");
            setLoading(false);
        }
    };

    const [confirmLeave, setConfirmLeave] = useState(false);
    const [codeCopied, setCodeCopied] = useState(false);
    const handleCopyCode = () => {
        if (!group?.inviteCode) return;
        navigator.clipboard.writeText(group.inviteCode);
        setCodeCopied(true);
        setTimeout(() => setCodeCopied(false), 2000);
    };

    const isSolo = !!group && group.memberIds.length < 2;

    if (loading && !group) {
        return (
            <div className="space-y-2" aria-busy="true" aria-label="Loading family">
                <div className="h-16 rounded-[14px] bg-surface-sunken animate-pulse" />
                <div className="h-16 rounded-[14px] bg-surface-sunken animate-pulse" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {error && (
                <div className="rounded-[14px] bg-error-bg text-error text-sm p-3 flex items-center gap-2" role="alert">
                    <CircleAlert size={16} aria-hidden="true" />
                    {error}
                </div>
            )}

            {!group ? (
                <div className="rounded-[14px] bg-surface-sunken p-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-muted">We couldn't load your family.</p>
                    <button onClick={loadGroup} className="btn-secondary btn-sm">Try again</button>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] bg-surface-sunken p-4">
                        {nameDraft !== null ? (
                            <form
                                className="flex flex-col sm:flex-row gap-2 w-full"
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
                                    <button type="submit" disabled={!nameDraft.trim() || savingName} className="btn-primary btn-sm">Save</button>
                                    <button type="button" onClick={() => setNameDraft(null)} className="btn-ghost btn-sm">Cancel</button>
                                </div>
                            </form>
                        ) : (
                            <>
                                <div className="min-w-0 flex items-center gap-1">
                                    <div className="min-w-0">
                                        <h3 className="heading-3 truncate">{group.name}</h3>
                                        <p className="text-sm text-muted">
                                            {isSolo ? 'Just you so far' : `${group.memberIds.length} members`}
                                            {!isSolo && group.ownerId === currentUid() ? ' · You manage this family' : ''}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setNameDraft(group.name)}
                                        className="icon-btn !bg-transparent hover:!bg-surface shrink-0"
                                        aria-label="Rename family"
                                        title="Rename family"
                                    >
                                        <Pencil size={16} aria-hidden="true" />
                                    </button>
                                </div>
                                <button
                                    onClick={handleCopyCode}
                                    className="inline-flex items-center gap-2 rounded-full bg-surface border border-border pl-4 pr-3 min-h-11 hover:bg-surface-sunken transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                                    aria-label={codeCopied ? 'Invite code copied' : `Copy invite code ${group.inviteCode}`}
                                >
                                    <span className="text-xs text-muted">Invite code</span>
                                    <span className="font-mono font-bold tracking-wider">{group.inviteCode}</span>
                                    {codeCopied ? <Check size={16} className="text-weight-text" aria-hidden="true" /> : <Copy size={16} className="text-muted" aria-hidden="true" />}
                                </button>
                            </>
                        )}
                    </div>

                    {isSolo ? (
                        <>
                            <p className="text-sm text-muted flex items-start gap-2">
                                <CookingPot size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
                                Share the code to cook together: everyone in a family shares its recipes and one dinner plan, which shows up in everyone's planner and shopping list.
                            </p>
                            <form
                                className="rounded-[14px] bg-surface-sunken p-4 space-y-3"
                                onSubmit={(e) => { e.preventDefault(); handleJoinGroup(); }}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="size-10 rounded-full bg-water-bg text-water-text flex items-center justify-center shrink-0"><LogIn size={20} aria-hidden="true" /></span>
                                    <div>
                                        <h3 className="heading-4">Join a family</h3>
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
                                    <button type="submit" disabled={!inviteCodeInput.trim() || loading} className="btn-secondary btn-sm shrink-0">
                                        Join family
                                    </button>
                                </div>
                            </form>
                        </>
                    ) : (
                        <>
                            <ul className="space-y-1">
                                {members.map(member => {
                                    const isOwner = member.id === group.ownerId;
                                    const isYou = member.id === currentUid();
                                    return (
                                        <li key={member.id} className="flex items-center gap-3 px-2 py-2 rounded-[14px]">
                                            <span className={`size-10 shrink-0 rounded-full flex items-center justify-center font-display font-extrabold ${isOwner ? 'bg-fasting-bg text-fasting-text' : 'bg-workout-bg text-workout-text'}`} aria-hidden="true">
                                                {member.name.charAt(0).toUpperCase()}
                                            </span>
                                            <span className="flex-1 min-w-0">
                                                <span className="block font-semibold truncate">{member.name}{isYou ? ' (you)' : ''}</span>
                                                <span className="block text-xs text-muted">{isOwner ? 'Family admin' : 'Member'}</span>
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>

                            <p className="text-sm text-muted flex items-start gap-2">
                                <CookingPot size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
                                Your recipes belong to the family: anyone can plan, edit or delete them. Dinners anyone plans show up in everyone's planner and shopping list.
                            </p>

                            {confirmLeave ? (
                                <div role="alertdialog" aria-label="Leave family?" className="rounded-[14px] bg-error-bg p-4 space-y-3">
                                    <p className="text-sm">
                                        <span className="font-semibold">Leave {group.name}?</span> The family keeps all its recipes and shared dinners. You'll start a family of your own with copies of the recipes you added.
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        <button onClick={handleLeaveGroup} disabled={loading} className="btn-sm inline-flex items-center gap-1.5 min-h-9 px-4 rounded-full font-semibold bg-error text-on-ink hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]">
                                            <LogOut size={16} aria-hidden="true" /> Leave family
                                        </button>
                                        <button onClick={() => setConfirmLeave(false)} className="btn-ghost btn-sm">Stay</button>
                                    </div>
                                </div>
                            ) : (
                                <button onClick={() => setConfirmLeave(true)} className="btn-ghost btn-sm !text-error hover:!bg-error-bg">
                                    <LogOut size={16} aria-hidden="true" /> Leave family
                                </button>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};
