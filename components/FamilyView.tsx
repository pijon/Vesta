import React, { useEffect, useMemo, useState } from 'react';
import { UsersRound } from 'lucide-react';
import { AppView } from '../types';
import { FamilySettings } from './FamilySettings';
import { familyData } from '../services/pageData';
import { getFamilyDinnersInRange } from '../services/storageService';
import { currentUid } from '../services/firebase';
import { usePrewarmed } from '../utils/prewarm';
import { addDays } from '../utils/planUtils';
import { localDateString } from '../utils/dateUtils';
import { FamilyDay, groupFamilyDinners } from '../utils/familyWeek';

interface FamilyViewProps {
    onNavigate: (view: AppView) => void;
}

const dayLabel = (date: string, today: string) =>
    date === today ? 'Today' : new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long' });

export const FamilyView: React.FC<FamilyViewProps> = ({ onNavigate }) => {
    const family = usePrewarmed(familyData);
    const inFamily = !!family;
    const [days, setDays] = useState<FamilyDay[] | null>(null);
    const today = localDateString();
    const dates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(today, i)), [today]);

    // Runs again each time the page is shown, so dinners other members planned appear
    useEffect(() => {
        if (!family) { setDays(null); return; }
        let cancelled = false;
        getFamilyDinnersInRange(dates[0], dates[6]).then(byDate => {
            if (!cancelled) setDays(groupFamilyDinners(byDate, family.names, currentUid(), dates));
        });
        return () => { cancelled = true; };
    }, [family, dates]);

    const planned = days?.filter(d => d.dinners.length > 0) ?? [];

    return (
        <div className="space-y-4">
            {inFamily && (
                <>
                    <section className="card p-5 md:p-6 space-y-4" aria-labelledby="family-dinners-heading">
                        <div>
                            <h2 id="family-dinners-heading" className="heading-2">This week's dinners</h2>
                            <p className="text-sm text-muted mt-0.5">Shared with everyone in the family.</p>
                        </div>
                        {days === null ? (
                            <div className="space-y-2" aria-busy="true" aria-label="Loading dinners">
                                <div className="h-14 rounded-[14px] bg-surface-sunken animate-pulse" />
                                <div className="h-14 rounded-[14px] bg-surface-sunken animate-pulse" />
                            </div>
                        ) : planned.length === 0 ? (
                            <div className="rounded-[14px] bg-surface-sunken p-4 flex flex-wrap items-center justify-between gap-3">
                                <p className="text-sm text-muted">No family dinners planned yet. Plan one and everyone sees it.</p>
                                <button onClick={() => onNavigate(AppView.PLANNER)} className="btn-primary btn-sm">Open Planner</button>
                            </div>
                        ) : (
                            <ul className="space-y-2">
                                {planned.map(day => (
                                    <li key={day.date} className="rounded-[14px] bg-surface-sunken p-4">
                                        <h3 className="font-display font-extrabold">{dayLabel(day.date, today)}</h3>
                                        <ul className="mt-1 space-y-1">
                                            {day.dinners.map(dinner => (
                                                <li key={dinner.id} className="flex items-baseline justify-between gap-3">
                                                    <span className="min-w-0 truncate">{dinner.name}</span>
                                                    <span className="text-xs text-muted shrink-0">
                                                        {dinner.addedBy ? `${dinner.addedBy} · ` : ''}{Math.round(dinner.calories)} kcal
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                </>
            )}

            <section className="card p-5 md:p-6 space-y-4" aria-labelledby="family-group-heading">
                <div className="flex items-center gap-2">
                    <UsersRound size={20} className="text-muted" aria-hidden="true" />
                    <h2 id="family-group-heading" className="heading-2">{inFamily ? 'Your family' : 'Family'}</h2>
                </div>
                <FamilySettings />
            </section>
        </div>
    );
};
