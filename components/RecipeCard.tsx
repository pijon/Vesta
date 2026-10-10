import React from 'react';
import { Meal } from '../types';
import { mealVisualFor } from '../utils/mealVisual';
import { CalendarCheck, CalendarPlus, Copy, Heart, UsersRound } from 'lucide-react';

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
  /** Open the add-to-plan picker */
  onAddToPlan?: (e: React.MouseEvent) => void;
  /** e.g. "Planned Thu", when the recipe is in the coming plan */
  plannedLabel?: string;
}

/** The most useful extra tag to show on a card, if any. */
const HIGHLIGHT_TAGS = ['quick', 'vegan', 'vegetarian', 'pescatarian', 'high protein', 'batch cook', 'low carb', 'gluten-free'];
export const highlightTag = (tags: string[] = []) => {
  const lower = tags.map(t => t.trim().toLowerCase());
  const tag = HIGHLIGHT_TAGS.find(t => lower.includes(t));
  return tag ? tag.charAt(0).toUpperCase() + tag.slice(1) : undefined;
};

/** Photo, or a softly tinted placeholder with the food icon when there's no photo. */
const RecipeThumb: React.FC<{ meal: Meal; className: string; iconSize: number; zoom?: boolean }> = ({ meal, className, iconSize, zoom }) => {
  const visual = mealVisualFor(meal);
  if (meal.image) {
    return (
      <img
        src={meal.image}
        alt=""
        loading="lazy"
        className={`${className} object-cover ${zoom ? 'motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-[1.04]' : ''}`}
      />
    );
  }
  return (
    <span className={`${className} flex items-center justify-center ${visual.tint}`}>
      <visual.Icon size={iconSize} strokeWidth={1.5} aria-hidden="true" />
    </span>
  );
};

/** Recipe tile for the grid: photo with a favourite heart, name, calories and protein, and a plan button. */
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
  onAddToPlan,
  plannedLabel,
}) => {
  const visual = mealVisualFor(meal);
  const highlight = highlightTag(meal.tags);
  const footerButton = (label: string, onPress: (e: React.MouseEvent) => void, icon: React.ReactNode, text?: string) => (
    <button
      onClick={(e) => { e.stopPropagation(); onPress(e); }}
      aria-label={label}
      title={label}
      className="shrink-0 inline-flex items-center justify-center gap-1.5 min-h-9 min-w-9 px-2 sm:px-2.5 rounded-full text-sm font-semibold bg-surface-sunken text-main hover:bg-border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
    >
      {icon}{text && <span className="hidden sm:inline" aria-hidden="true">{text}</span>}
    </button>
  );

  return (
    <article className={`group card flex flex-col h-full overflow-hidden ${onClick ? 'card-hover' : ''}`}>
      <div className="relative">
        <button
          onClick={onClick}
          disabled={!onClick}
          className="block w-full overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--focus-ring)]"
          aria-label={`Open ${meal.name}`}
        >
          <RecipeThumb meal={meal} className="w-full aspect-[4/3]" iconSize={36} zoom />
        </button>

        {isOwned && onToggleFavorite && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(e); }}
            aria-label={meal.isFavorite ? 'Remove from favourites' : 'Add to favourites'}
            aria-pressed={!!meal.isFavorite}
            title={meal.isFavorite ? 'Remove from favourites' : 'Add to favourites'}
            className={`absolute top-2 right-2 size-9 flex items-center justify-center rounded-full bg-surface shadow-[var(--elev-sm)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] ${meal.isFavorite ? 'text-primary' : 'text-main hover:bg-surface-sunken'}`}
          >
            <Heart size={17} fill={meal.isFavorite ? 'currentColor' : 'none'} />
          </button>
        )}
        {!isOwned && ownerName && (
          <span className="absolute top-2 left-2 badge badge-workout !py-0.5 shadow-[var(--elev-sm)]"><UsersRound size={12} aria-hidden="true" /> {ownerName.split(' ')[0]}</span>
        )}
        {plannedLabel && (
          <span className="absolute left-2 bottom-2 badge badge-ink !py-0.5"><CalendarCheck size={12} aria-hidden="true" /> {plannedLabel}</span>
        )}
      </div>

      <div className="p-3 flex flex-col flex-1 gap-1">
        <button
          onClick={onClick}
          disabled={!onClick}
          className="text-left rounded focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
          tabIndex={-1}
        >
          <h3 className="font-display font-extrabold text-[15px] leading-5 line-clamp-2">{meal.name}</h3>
        </button>
        <p className="text-xs text-muted truncate">
          {visual.label}{highlight && ` · ${highlight}`}
        </p>

        <div className="flex items-end justify-between gap-2 mt-auto pt-2">
          <p className="min-w-0 leading-none">
            <span className="font-display font-extrabold text-lg">{meal.calories}</span>
            <span className="text-xs font-semibold text-muted"> kcal</span>
            {showMacros ? (
              <span className="block text-xs text-muted mt-1">P {meal.protein ?? '–'} · F {meal.fat ?? '–'} · C {meal.carbs ?? '–'}</span>
            ) : (
              !!meal.protein && <span className="block text-xs text-muted mt-1 whitespace-nowrap">{meal.protein} g protein</span>
            )}
          </p>
          {!isOwned && onCopyToLibrary && footerButton('Copy to my recipes', onCopyToLibrary, <Copy size={16} aria-hidden="true" />)}
          {onAddToPlan && footerButton('Add to plan', onAddToPlan, <CalendarPlus size={16} aria-hidden="true" />, 'Plan')}
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

interface RecipeRowProps {
  meal: Meal;
  onClick: () => void;
  isOwned: boolean;
  ownerName?: string;
  onToggleFavorite?: (e: React.MouseEvent) => void;
  onAddToPlan?: (e: React.MouseEvent) => void;
  onCopyToLibrary?: (e: React.MouseEvent) => void;
  plannedLabel?: string;
  /** e.g. "Last had 3 weeks ago" */
  historyLabel?: string;
  /** Tags worth showing (style, diet, cuisine) */
  tags?: string[];
}

/** Compact list row for scanning a large library. */
export const RecipeRow: React.FC<RecipeRowProps> = ({
  meal, onClick, isOwned, ownerName, onToggleFavorite, onAddToPlan, onCopyToLibrary, plannedLabel, historyLabel, tags = [],
}) => {
  const visual = mealVisualFor(meal);
  const iconButton = (label: string, onPress: (e: React.MouseEvent) => void, icon: React.ReactNode, active = false) => (
    <button
      onClick={(e) => { e.stopPropagation(); onPress(e); }}
      aria-label={label}
      aria-pressed={active || undefined}
      title={label}
      className={`size-9 sm:size-10 shrink-0 flex items-center justify-center rounded-full transition-colors hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)] ${active ? 'text-primary' : 'text-muted hover:text-main'}`}
    >
      {icon}
    </button>
  );

  return (
    <li className="flex items-center gap-1 rounded-[16px] hover:bg-surface-sunken transition-colors">
      <button
        onClick={onClick}
        className="flex-1 min-w-0 flex items-center gap-3 p-2 text-left rounded-[16px] focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
        aria-label={`Open ${meal.name}`}
      >
        <RecipeThumb meal={meal} className="size-12 sm:size-14 rounded-[12px] shrink-0" iconSize={16} />
        <span className="flex-1 min-w-0">
          <span className="block font-semibold leading-snug line-clamp-2">{meal.name}</span>
          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 mt-1 text-xs text-muted">
            <span><span className="font-semibold text-main">{meal.calories}</span> kcal</span>
            {!!meal.protein && <span>· {meal.protein} g protein</span>}
            <span>· {visual.label}</span>
            {tags.slice(0, 2).map(t => <span key={t} className="hidden sm:inline">· {t}</span>)}
            {plannedLabel && <span className="badge badge-ink !py-0"><CalendarCheck size={11} aria-hidden="true" /> {plannedLabel}</span>}
            {!plannedLabel && historyLabel && <span>· {historyLabel}</span>}
            {!isOwned && ownerName && <span className="badge badge-workout !py-0"><UsersRound size={11} aria-hidden="true" /> {ownerName.split(' ')[0]}</span>}
          </span>
        </span>
      </button>
      {isOwned && onToggleFavorite && iconButton(
        meal.isFavorite ? 'Remove from favourites' : 'Add to favourites',
        onToggleFavorite,
        <Heart size={18} fill={meal.isFavorite ? 'currentColor' : 'none'} />,
        !!meal.isFavorite,
      )}
      {!isOwned && onCopyToLibrary && iconButton('Copy to my recipes', onCopyToLibrary, <Copy size={18} />)}
      {onAddToPlan && iconButton('Add to plan', onAddToPlan, <CalendarPlus size={18} />)}
    </li>
  );
};
