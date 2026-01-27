import React, { useState, useEffect } from 'react';
import { Group } from '../types';
import { createGroup, joinGroup, leaveGroup, getUserGroup, getGroupMembersDetails } from '../services/groupService';
import { auth } from '../services/firebase';

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
            const g = await getUserGroup();
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
            setError(e.message || "Failed to create group");
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
            setError(e.message || "Failed to join group. Check code.");
            setLoading(false);
        }
    };

    const handleLeaveGroup = async () => {
        if (!group) return;
        if (!confirm("Are you sure you want to leave this family group?")) return;

        setLoading(true);
        try {
            await leaveGroup(group.id);
            setGroup(null);
        } catch (e: any) {
            setError(e.message || "Failed to leave group");
        } finally {
            setLoading(false);
        }
    };

    if (loading && !group) return <div className="py-8 text-center text-charcoal/60 dark:text-stone-400 text-sm">Loading family settings...</div>;

    return (
        <div className="space-y-4">
            {error && (
                <div className="bg-error-bg text-error text-sm p-3 rounded-lg flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    {error}
                </div>
            )}

            {!group ? (
                // No Group State
                <div className="space-y-6">
                    <div className="bg-[var(--surface)] rounded-3xl p-6 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                            </div>
                            <div>
                                <h5 className="font-bold text-lg text-[var(--text-main)]">Create a Family</h5>
                                <p className="text-sm text-[var(--text-secondary)]">Start a group to share recipes.</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Family Name (e.g. The Smiths)"
                                value={newGroupName}
                                onChange={e => setNewGroupName(e.target.value)}
                                className="flex-1 px-4 py-2 rounded-xl bg-[var(--input-bg)] border-none focus:ring-2 focus:ring-primary/20 text-[var(--text-main)] placeholder-[var(--text-muted)]"
                            />
                            <button
                                onClick={handleCreateGroup}
                                disabled={!newGroupName.trim() || loading}
                                className="px-6 py-2 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
                            >
                                Create
                            </button>
                        </div>
                    </div>

                    <div className="bg-[var(--surface)] rounded-3xl p-6 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-[var(--text-secondary)]/10 flex items-center justify-center text-[var(--text-secondary)]">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>
                            </div>
                            <div>
                                <h5 className="font-bold text-lg text-[var(--text-main)]">Join a Family</h5>
                                <p className="text-sm text-[var(--text-secondary)]">Enter invite code.</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="6-digit Code"
                                value={inviteCodeInput}
                                onChange={e => setInviteCodeInput(e.target.value)}
                                className="flex-1 px-4 py-2 rounded-xl bg-[var(--input-bg)] border-none focus:ring-2 focus:ring-primary/20 text-[var(--text-main)] placeholder-[var(--text-muted)]"
                            />
                            <button
                                onClick={handleJoinGroup}
                                disabled={!inviteCodeInput.trim() || loading}
                                className="px-6 py-2 bg-[var(--card-bg)] text-[var(--text-main)] rounded-xl font-bold hover:bg-[var(--input-bg)] transition-colors border border-transparent hover:border-border disabled:opacity-50"
                            >
                                Join
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                // Active Group State
                <div className="bg-[var(--surface)] shadow-soft rounded-[2rem] p-6 relative overflow-hidden transition-all duration-500 hover:shadow-lg">
                    {/* Decorative Background */}
                    <div className="absolute top-0 right-0 p-12 opacity-[0.03] text-[var(--text-main)] pointer-events-none transform translate-x-1/4 -translate-y-1/4">
                        <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                    </div>

                    <div className="relative z-10">
                        {/* Header */}
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <h5 className="text-2xl font-serif font-bold text-[var(--text-main)] mb-1">{group.name}</h5>
                                <div className="flex items-center gap-2">
                                    <span className="badge-sm badge-sage">
                                        {group.memberIds.length} Member{group.memberIds.length !== 1 ? 's' : ''}
                                    </span>
                                    {group.ownerId === auth.currentUser?.uid && (
                                        <span className="badge-sm badge-terracotta">Admin</span>
                                    )}
                                </div>
                            </div>

                            <div className="text-center bg-[var(--card-bg)] backdrop-blur-md rounded-2xl p-3 shadow-sm border border-border/50">
                                <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)] mb-1">Invite Code</p>
                                <div className="flex items-center gap-2">
                                    <span className="text-xl font-mono font-bold tracking-widest text-[var(--text-main)]">{group.inviteCode}</span>
                                    <button
                                        onClick={() => navigator.clipboard.writeText(group.inviteCode)}
                                        className="p-1.5 hover:bg-[var(--input-bg)] rounded-lg text-[var(--text-secondary)] transition-colors"
                                        title="Copy Code"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Members List */}
                        <div className="space-y-4 mb-8">
                            <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] ml-1">Family Members</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {members.map(member => (
                                    <div key={member.id} className="flex items-center gap-3 p-3 rounded-2xl bg-[var(--card-bg)] border border-border/50 hover:bg-[var(--input-bg)] transition-colors">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-sm ${member.id === group.ownerId ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-[var(--surface)] text-[var(--text-main)]'}`}>
                                            {member.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex flex-col leading-tight">
                                            <span className="font-bold text-[var(--text-main)]">{member.name}</span>
                                            <span className="text-[10px] text-[var(--text-secondary)]">
                                                {member.id === group.ownerId ? 'Family Admin' : 'Member'}
                                                {member.id === auth.currentUser?.uid ? ' (You)' : ''}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={handleLeaveGroup}
                            className="text-xs text-error hover:text-red-600 font-bold flex items-center gap-1.5 transition-colors px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg -ml-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                            Leave Family Group
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
