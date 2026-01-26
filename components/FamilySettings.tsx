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
                    <div className="bg-water-bg/50 border border-water-border/50 rounded-xl p-4">
                        <h5 className="font-bold mb-2" style={{ color: 'var(--water)' }}>Create a Family</h5>
                        <p className="text-xs mb-3" style={{ color: 'var(--water)' }}>Start a group to share recipes with your family.</p>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Family Name (e.g. The Smiths)"
                                value={newGroupName}
                                onChange={e => setNewGroupName(e.target.value)}
                                className="input flex-1 py-2 text-sm"
                            />
                            <button
                                onClick={handleCreateGroup}
                                disabled={!newGroupName.trim() || loading}
                                className="btn-base btn-sm text-white transition-opacity hover:opacity-90"
                                style={{ backgroundColor: 'var(--water)' }}
                            >
                                Create
                            </button>
                        </div>
                    </div>

                    <div className="border border-border rounded-xl p-4">
                        <h5 className="font-bold text-charcoal dark:text-stone-200 mb-2">Join a Family</h5>
                        <p className="text-xs text-charcoal/60 dark:text-stone-400 mb-3">Enter the invite code from a family member.</p>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="6-digit Code"
                                value={inviteCodeInput}
                                onChange={e => setInviteCodeInput(e.target.value)}
                                className="input flex-1 py-2 text-sm"
                            />
                            <button
                                onClick={handleJoinGroup}
                                disabled={!inviteCodeInput.trim() || loading}
                                className="btn-secondary btn-sm"
                            >
                                Join
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                // Active Group State
                <div className="bg-water-bg/30 border border-water-border/50 rounded-xl p-5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10" style={{ color: 'var(--water)' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                    </div>

                    <div className="relative z-10">
                        <h5 className="text-lg font-bold mb-1" style={{ color: 'var(--water)' }}>{group.name}</h5>
                        <div className="flex items-center gap-2 mb-6">
                            <span className="badge-sm bg-water-bg font-bold" style={{ color: 'var(--water)' }}>
                                {group.memberIds.length} Member{group.memberIds.length !== 1 ? 's' : ''}
                            </span>
                            {group.ownerId === auth.currentUser?.uid && (
                                <span className="badge-sm bg-water-bg font-bold" style={{ color: 'var(--water)' }}>Owner</span>
                            )}
                        </div>

                        <div className="space-y-3 mb-6 bg-white dark:bg-white/5/50 rounded-lg p-3 border border-water-border/20">
                            <p className="text-xs font-bold uppercase tracking-wide opacity-70" style={{ color: 'var(--water)' }}>Members</p>
                            {members.map(member => (
                                <div key={member.id} className="flex items-center gap-3 text-sm">
                                    <div className="w-8 h-8 rounded-full bg-water-bg flex items-center justify-center font-bold text-xs shadow-sm" style={{ color: 'var(--water)' }}>
                                        {member.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex flex-col leading-tight">
                                        <span className="font-medium">{member.name}</span>
                                        <span className="text-[10px] text-charcoal/60 dark:text-stone-400 opacity-80">
                                            {member.id === group.ownerId ? 'Family Admin' : 'Member'}
                                            {member.id === auth.currentUser?.uid ? ' (You)' : ''}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="bg-white dark:bg-white/5/80 backdrop-blur-sm rounded-lg p-3 mb-6 border border-water-border/30">
                            <p className="text-xs font-bold mb-1 uppercase tracking-wide" style={{ color: 'var(--water)' }}>Invite Code</p>
                            <div className="flex items-center justify-between">
                                <span className="text-2xl font-mono font-bold tracking-widest" style={{ color: 'var(--water)' }}>{group.inviteCode}</span>
                                <button
                                    onClick={() => navigator.clipboard.writeText(group.inviteCode)}
                                    className="text-xs bg-water-bg px-3 py-1.5 rounded-md font-bold hover:bg-water-border/50 transition-colors"
                                    style={{ color: 'var(--water)' }}
                                >
                                    Copy
                                </button>
                            </div>
                        </div>

                        <button
                            onClick={handleLeaveGroup}
                            className="text-xs text-error hover:text-error-hover font-medium flex items-center gap-1 transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                            Leave Group
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
