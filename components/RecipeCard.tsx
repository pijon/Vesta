import { mealKcalLabel } from '../utils/planUtils';
import React, { useState } from 'react';
import { Meal } from '../types';
import { mealVisualFor } from '../utils/mealVisual';
import { grams } from '../utils/planUtils';
import { CalendarCheck, CalendarPlus, Heart, UsersRound } from 'lucide-react';

interface RecipeCardProps {
  meal: Meal;
  onClick?: () => void;
  actionLabel?: string;
  onAction?: (e: React.MouseEvent) => void;
  showMacros?: boolean;
  onToggleFavorite?: (e: React.MouseEvent) => void;
  /** Name of the family member who added it, when not the current user */
  ownerName?: string;
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

/**
 * Photo, or a softly tinted placeholder with the food icon when there's no photo. With `plate` the icon
 * sits on a plate (a surface circle), and `plate` sizes it against the placeholder.
 */
const RecipeThumb: React.FC<{ meal: Meal; className: string; iconSize: number; zoom?: boolean; plate?: string }> = ({ meal, className, iconSize, zoom, plate }) => {
  const visual = mealVisualFor(meal);
  // A photo that won't load shows the meal's icon instead of a broken image
  const [failed, setFailed] = useState(false);
  if (meal.image && !failed) {
    // Sunken while the photo loads, so the tile isn't a blank card
    return (
      <img
        src={meal.image}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className={`${className} object-cover bg-surface-sunken ${zoom ? 'motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-[1.04]' : ''}`}
      />
    );
  }
  return (
    <span className={`${className} flex items-center justify-center ${visual.tint}`}>
      {plate ? (
        <span className={`${plate} rounded-full bg-surface flex items-center justify-center shadow-[var(--elev-sm)]`}>
          <visual.Icon size={iconSize} strokeWidth={2.25} aria-hidden="true" />
        </span>
      ) : (
        <visual.Icon size={iconSize} strokeWidth={2.25} aria-hidden="true" />
      )}
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
  ownerName,
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
          <RecipeThumb meal={meal} className="w-full aspect-[4/3]" iconSize={36} zoom plate="h-[62%] aspect-square" />
        </button>

        {onToggleFavorite && (
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
        {ownerName && (
          <span className="absolute top-2 left-2 badge badge-neutral !py-0.5 shadow-[var(--elev-sm)]"><UsersRound size={12} aria-hidden="true" /> {ownerName.split(' ')[0]}</span>
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
        {/* Phones show just the highlight when there is one: the meal type is what the filters are for */}
        <p className="text-xs text-muted truncate">
          {highlight ? <><span className="max-sm:hidden">{visual.label} · </span>{highlight}</> : visual.label}
        </p>

        <div className="flex items-end justify-between gap-2 mt-auto pt-2">
          <p className="min-w-0 leading-none">
            <span className="font-display font-extrabold text-lg">{mealKcalLabel(meal)}</span>
            <span className="text-xs font-semibold text-muted"></span>
            {showMacros ? (
              <span className="block text-xs text-muted mt-1">P {meal.protein != null ? grams(meal.protein) : '–'} · F {meal.fat != null ? grams(meal.fat) : '–'} · C {meal.carbs != null ? grams(meal.carbs) : '–'}</span>
            ) : (
              !!meal.protein && <span className="block text-xs text-muted mt-1 whitespace-nowrap">{grams(meal.protein)} g protein</span>
            )}
          </p>
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
  /** Name of the family member who added it, when not the current user */
  ownerName?: string;
  onToggleFavorite?: (e: React.MouseEvent) => void;
  onAddToPlan?: (e: React.MouseEvent) => void;
  plannedLabel?: string;
  /** e.g. "Last had 3 weeks ago" */
  historyLabel?: string;
  /** Tags worth showing (style, diet, cuisine) */
  tags?: string[];
}

/** Compact list row for scanning a large library. */
export const RecipeRow: React.FC<RecipeRowProps> = ({
  meal, onClick, ownerName, onToggleFavorite, onAddToPlan, plannedLabel, historyLabel, tags = [],
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
        <RecipeThumb meal={meal} className="size-12 sm:size-14 shrink-0 rounded-full" iconSize={16} />
        <span className="flex-1 min-w-0">
          <span className="font-semibold leading-snug line-clamp-2">{meal.name}</span>
          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 mt-1 text-xs text-muted">
            <span><span className="font-semibold text-main">{mealKcalLabel(meal)}</span></span>
            {!!meal.protein && <span>· {grams(meal.protein)} g protein</span>}
            <span>· {visual.label}</span>
            {tags.slice(0, 2).map(t => <span key={t} className="hidden sm:inline">· {t}</span>)}
            {plannedLabel && <span className="badge badge-ink !py-0"><CalendarCheck size={11} aria-hidden="true" /> {plannedLabel}</span>}
            {!plannedLabel && historyLabel && <span>· {historyLabel}</span>}
            {ownerName && <span className="badge badge-neutral !py-0"><UsersRound size={11} aria-hidden="true" /> {ownerName.split(' ')[0]}</span>}
          </span>
        </span>
      </button>
      {onToggleFavorite && iconButton(
        meal.isFavorite ? 'Remove from favourites' : 'Add to favourites',
        onToggleFavorite,
        <Heart size={18} fill={meal.isFavorite ? 'currentColor' : 'none'} />,
        !!meal.isFavorite,
      )}
      {onAddToPlan && iconButton('Add to plan', onAddToPlan, <CalendarPlus size={18} />)}
    </li>
  );
};

interface RecipeShelfCardProps {
  meal: Meal;
  onClick: () => void;
  onToggleFavorite?: (e: React.MouseEvent) => void;
  plannedLabel?: string;
  /** The line under the name, e.g. "Last had 5 weeks ago" or "524 kcal" */
  detail: string;
}

/** Smaller card for a shelf: photo with a heart, the name and one line. */
export const RecipeShelfCard: React.FC<RecipeShelfCardProps> = ({ meal, onClick, onToggleFavorite, plannedLabel, detail }) => (
  <article className="group card card-hover overflow-hidden w-[148px] md:w-[168px] shrink-0 snap-start">
    <div className="relative">
      <button
        onClick={onClick}
        className="block w-full overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--focus-ring)]"
        aria-label={`Open ${meal.name}`}
      >
        <RecipeThumb meal={meal} className="w-full aspect-[4/3]" iconSize={26} zoom plate="h-[58%] aspect-square" />
      </button>
      {onToggleFavorite && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(e); }}
          aria-label={meal.isFavorite ? 'Remove from favourites' : 'Add to favourites'}
          aria-pressed={!!meal.isFavorite}
          className={`hit-target absolute top-1.5 right-1.5 size-8 flex items-center justify-center rounded-full bg-surface shadow-[var(--elev-sm)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] ${meal.isFavorite ? 'text-primary' : 'text-main'}`}
        >
          <Heart size={15} fill={meal.isFavorite ? 'currentColor' : 'none'} />
        </button>
      )}
      {plannedLabel && (
        <span className="absolute left-1.5 bottom-1.5 badge badge-ink !py-0.5 !text-[11px]"><CalendarCheck size={11} aria-hidden="true" /> {plannedLabel}</span>
      )}
    </div>
    <button onClick={onClick} tabIndex={-1} className="block w-full text-left px-2.5 pt-2 pb-2.5">
      <h3 className="font-display font-extrabold text-sm leading-[18px] line-clamp-2 min-h-9">{meal.name}</h3>
      <p className="text-xs text-muted mt-0.5 truncate">{detail}</p>
    </button>
  </article>
);
