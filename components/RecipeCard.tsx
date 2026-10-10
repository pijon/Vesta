import React from 'react';
import { Meal } from '../types';
import { mealVisualFor } from '../utils/mealVisual';
import { Heart, CalendarPlus, Copy, UsersRound } from 'lucide-react';

interface RecipeCardProps {
  meal: Meal;
  onClick?: () => void;
  actionLabel?: string;
  onAction?: (e: React.MouseEvent) => void;
  showMacros?: boolean;
  onToggleFavorite?: (e: React.MouseEvent) => void;
  /** @deprecated use isOwned */
  isInGroup?: boolean;
  /** True when the current user owns this recipe */
  isOwned?: boolean;
  /** Owner's display name, for family recipes */
  ownerName?: string;
  /** Copy a family recipe into the user's own library */
  onCopyToLibrary?: (e: React.MouseEvent) => void;
  /** Quick add to today's plan */
  onAddToPlan?: (e: React.MouseEvent) => void;
}

/** Recipe tile: photo (or meal-type tint), name, calories and macros, with round quick actions. */
export const RecipeCard: React.FC<RecipeCardProps> = ({
  meal,
  onClick,
  actionLabel,
  onAction,
  showMacros = true,
  onToggleFavorite,
  isOwned = true,
  ownerName,
  onCopyToLibrary,
  onAddToPlan
}) => {
  const visual = mealVisualFor(meal);
  const calorieTone = meal.calories > 500 ? 'badge-calories' : meal.calories >= 300 ? 'badge-fasting' : 'badge-weight';

  const quickAction = (label: string, onPress: (e: React.MouseEvent) => void, icon: React.ReactNode, active = false) => (
    <button
      onClick={(e) => { e.stopPropagation(); onPress(e); }}
      aria-label={label}
      aria-pressed={active || undefined}
      className={`size-9 md:size-10 flex items-center justify-center rounded-full bg-surface shadow-[var(--elev-sm)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] ${active ? 'text-primary' : 'text-main hover:bg-surface-sunken'}`}
    >
      {icon}
    </button>
  );

  return (
    <article className={`card flex flex-col h-full overflow-hidden ${onClick ? 'card-hover' : ''}`}>
      <div className="relative m-2 mb-0">
        <button
          onClick={onClick}
          disabled={!onClick}
          className="block w-full rounded-[14px] overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
          aria-label={`Open ${meal.name}`}
        >
          {meal.image ? (
            <img src={meal.image} alt="" loading="lazy" className="w-full aspect-[4/3] object-cover" />
          ) : (
            <span className={`w-full aspect-[4/3] flex items-center justify-center ${visual.tint}`}>
              <visual.Icon size={48} strokeWidth={1.5} aria-hidden="true" />
            </span>
          )}
        </button>

        <div className="absolute top-1.5 right-1.5 md:top-2 md:right-2 flex flex-col gap-1.5 md:gap-2">
          {isOwned && onToggleFavorite && quickAction(
            meal.isFavorite ? 'Remove from favourites' : 'Add to favourites',
            onToggleFavorite,
            <Heart size={18} fill={meal.isFavorite ? 'currentColor' : 'none'} />,
            !!meal.isFavorite
          )}
          {onAddToPlan && quickAction('Add to today', onAddToPlan, <CalendarPlus size={18} />)}
          {!isOwned && onCopyToLibrary && quickAction('Copy to my recipes', onCopyToLibrary, <Copy size={18} />)}
        </div>
      </div>

      <div className="p-3 md:p-4 flex flex-col flex-1 gap-1.5 md:gap-2">
        <button
          onClick={onClick}
          disabled={!onClick}
          className="text-left rounded focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
          tabIndex={-1}
        >
          <h3 className="font-display font-extrabold text-[15px] leading-5 md:text-[17px] md:leading-6 line-clamp-2">{meal.name}</h3>
        </button>
        <p className="text-xs text-muted">
          {visual.label}
          {meal.servings > 1 && ` · Serves ${meal.servings}`}
        </p>

        <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
          <span className={`badge ${calorieTone}`}>{meal.calories} kcal</span>
          {showMacros ? (
            <>
              <span className="badge badge-neutral">P {meal.protein ?? '–'}</span>
              <span className="badge badge-neutral">F {meal.fat ?? '–'}</span>
              <span className="badge badge-neutral">C {meal.carbs ?? '–'}</span>
            </>
          ) : (
            !!meal.protein && <span className="badge badge-neutral">{meal.protein} g protein</span>
          )}
          {!isOwned && ownerName && (
            <span className="badge badge-workout"><UsersRound size={12} aria-hidden="true" /> {ownerName.split(' ')[0]}</span>
          )}
        </div>

        {onAction && (
          <button
            onClick={(e) => { e.stopPropagation(); onAction(e); }}
            className="btn-primary btn-sm btn-block mt-2"
          >
            {actionLabel || 'Select'}
          </button>
        )}
      </div>
    </article>
  );
};
