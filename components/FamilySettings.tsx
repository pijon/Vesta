import React, { useState, useEffect } from 'react';
import { Group } from '../types';
import { createGroup, joinGroup, leaveGroup, getUserGroup, getGroupMembersDetails, ensureInviteCode } from '../services/groupService';
import { auth } from '../services/firebase';
import { AlertCircle, Check, Copy, LogIn, LogOut, UsersRound } from 'lucide-react';

export const FamilySettings: React.FC = () => {
    const [group, setGroup] = useState<Group | null>(null);
    const [members, setMembers] = useState<{ id: string, name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [inviteCodeInput, setInviteCodeInput] = useState('');
    const [newGroupName, setNewGroupName] = useState('');
    const [error, setError] = useState<string | null>(null);

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

    const handleCreateGroup = async () => {
        if (!newGroupName.trim()) return;
        setLoading(true);
        setError(null);
        try {
            await createGroup(newGroupName);
            await loadGroup();
        } catch (e: any) {
            setError(e.message || "We couldn't create the family. Try again.");
            setLoading(false);
        }
    };

    const handleJoinGroup = async () => {
        if (!inviteCodeInput.trim()) return;
        setLoading(true);
        setError(null);
        try {
            await joinGroup(inviteCodeInput);
            await loadGroup();
        } catch (e: any) {
            setError(e.message || "That code didn't work. Check it and try again.");
            setLoading(false);
        }
    };

    const handleLeaveGroup = async () => {
        if (!group) return;
        if (!confirm("Leave this family? You'll stop seeing their shared recipes and plans.")) return;

        setLoading(true);
        try {
            await leaveGroup(group.id);
            setGroup(null);
        } catch (e: any) {
            setError(e.message || "We couldn't leave the family. Try again.");
        } finally {
            setLoading(false);
        }
    };

    const [codeCopied, setCodeCopied] = useState(false);
    const handleCopyCode = () => {
        if (!group?.inviteCode) return;
        navigator.clipboard.writeText(group.inviteCode);
        setCodeCopied(true);
        setTimeout(() => setCodeCopied(false), 2000);
    };

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
                    <AlertCircle size={16} aria-hidden="true" />
                    {error}
                </div>
            )}

            {!group ? (
                <div className="grid sm:grid-cols-2 gap-3">
                    <form
                        className="rounded-[14px] bg-surface-sunken p-4 space-y-3"
                        onSubmit={(e) => { e.preventDefault(); handleCreateGroup(); }}
                    >
                        <div className="flex items-center gap-3">
                            <span className="size-10 rounded-full bg-calories-bg text-calories-text flex items-center justify-center shrink-0"><UsersRound size={20} aria-hidden="true" /></span>
                            <div>
                                <h3 className="heading-4">Start a family</h3>
                                <p className="text-sm text-muted">Invite others with a code.</p>
                            </div>
                        </div>
                        <label htmlFor="family-name" className="sr-only">Family name</label>
                        <input
                            id="family-name"
                            type="text"
                            placeholder="The Andersons"
                            value={newGroupName}
                            onChange={e => setNewGroupName(e.target.value)}
                            className="input w-full"
                        />
                        <button type="submit" disabled={!newGroupName.trim() || loading} className="btn-primary btn-sm btn-block">
                            Create family
                        </button>
                    </form>

                    <form
                        className="rounded-[14px] bg-surface-sunken p-4 space-y-3"
                        onSubmit={(e) => { e.preventDefault(); handleJoinGroup(); }}
                    >
                        <div className="flex items-center gap-3">
                            <span className="size-10 rounded-full bg-water-bg text-water-text flex items-center justify-center shrink-0"><LogIn size={20} aria-hidden="true" /></span>
                            <div>
                                <h3 className="heading-4">Join a family</h3>
                                <p className="text-sm text-muted">Use the code someone shared.</p>
                            </div>
                        </div>
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
                        <button type="submit" disabled={!inviteCodeInput.trim() || loading} className="btn-secondary btn-sm btn-block">
                            Join family
                        </button>
                    </form>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] bg-surface-sunken p-4">
                        <div className="min-w-0">
                            <h3 className="heading-3 truncate">{group.name}</h3>
                            <p className="text-sm text-muted">
                                {group.memberIds.length} {group.memberIds.length === 1 ? 'member' : 'members'}
                                {group.ownerId === auth.currentUser?.uid ? ' · You manage this family' : ''}
                            </p>
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
                    </div>

                    <ul className="space-y-1">
                        {members.map(member => {
                            const isOwner = member.id === group.ownerId;
                            const isYou = member.id === auth.currentUser?.uid;
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

                    <button onClick={handleLeaveGroup} className="btn-ghost btn-sm text-error hover:bg-error-bg">
                        <LogOut size={16} aria-hidden="true" /> Leave family
                    </button>
                </div>
            )}
        </div>
    );
};
