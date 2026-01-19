import React from 'react';
import { Meal } from '../types';
import { getRecipeTheme } from '../utils';
import { RecipeIllustration } from './RecipeIllustration';

interface RecipeCardProps {
  meal: Meal;
  onClick?: () => void;
  actionLabel?: string;
  onAction?: (e: React.MouseEvent) => void;
  showMacros?: boolean;
  onToggleFavorite?: (e: React.MouseEvent) => void;
  // Sharing props
  // Sharing props
  isInGroup?: boolean; // Deprecated?
  isOwned?: boolean;  // NEW: true if current user owns this recipe
  ownerName?: string; // NEW: name of recipe owner (for family recipes)
  // onShare?: (e: React.MouseEvent) => void; // Removed
  onCopyToLibrary?: (e: React.MouseEvent) => void; // NEW: copy family recipe
  // Quick Add to Plan
  onAddToPlan?: (e: React.MouseEvent) => void;
}

export const RecipeCard: React.FC<RecipeCardProps> = ({
  meal,
  onClick,
  actionLabel,
  onAction,
  showMacros = true,
  onToggleFavorite,
  isInGroup,
  isOwned = true,
  ownerName,
  // onShare,
  onCopyToLibrary,
  onAddToPlan
}) => {
  const theme = getRecipeTheme(meal.tags);

  return (
    <div
      onClick={onClick}
      className={`glass-panel rounded-3xl overflow-hidden transition-all duration-300 flex flex-col h-full group ${onClick ? 'cursor-pointer hover:shadow-xl dark:hover:shadow-primary/5 hover:-translate-y-1' : ''}`}
    >
      {/* Card Header / Illustration */}
      <div className={`relative h-48 md:h-56 overflow-hidden ${!meal.image ? theme.bg : 'bg-neutral-100 dark:bg-neutral-800'} transition-colors duration-300`}>
        {meal.image ? (
          <img
            src={meal.image}
            alt={meal.name}
            className="w-full h-full object-cover transform transition-transform duration-700 group-hover:scale-110"
          />
        ) : (
          <RecipeIllustration
            className="w-full h-full transform transition-transform duration-700 group-hover:scale-110"
            theme={{
              bg: theme.bg,
              text: theme.text,
              accent: theme.bg.includes('bg-slate') ? '#94a3b8' : undefined // Default accent backup
            }}
          />
        )}

        {/* Badges */}
        <div className="absolute top-3 left-3 md:top-4 md:left-4 flex gap-1.5 md:gap-2 flex-wrap max-w-[75%] md:max-w-[70%]">
          {/* Owner Badge (for family recipes) */}
          {/* Owner Badge (for family recipes) */}
          {!isOwned && ownerName && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm backdrop-blur-md bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800 flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              {ownerName}
            </span>
          )}
          {meal.tags?.slice(0, 3).map(tag => (
            <span key={tag} className={`px-2.5 md:px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm backdrop-blur-md bg-surface/90 dark:bg-surface/60 ${theme.text}`}>
              {tag}
            </span>
          ))}
          {meal.servings > 1 && (
            <span className="bg-surface/90 dark:bg-surface/60 backdrop-blur-md px-2.5 md:px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-muted shadow-sm">
              {meal.servings} Servings
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="absolute top-3 right-3 md:top-4 md:right-4 flex flex-col gap-2">
          {/* Copy to My Library Button (for family recipes) */}
          {!isOwned && onCopyToLibrary && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCopyToLibrary(e);
              }}
              className="p-2.5 rounded-full shadow-md backdrop-blur-md transition-all duration-300 bg-black/20 text-white hover:bg-surface/90 hover:text-blue-600 hover:scale-110"
              title="Copy to My Recipes"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </button>
          )}

          {/* Favorite Button - only for owned recipes */}
          {isOwned && onToggleFavorite && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onToggleFavorite) onToggleFavorite(e);
              }}
              className={`p-2.5 rounded-full shadow-md backdrop-blur-md transition-all duration-300 ${meal.isFavorite
                ? 'bg-surface/90 text-red-500 hover:bg-surface hover:scale-110'
                : 'bg-black/20 text-white hover:bg-surface/90 hover:text-red-500 hover:scale-110'
                }`}
              title={meal.isFavorite ? "Remove from favourites" : "Add to favourites"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill={meal.isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
              </svg>
            </button>
          )}

          {/* Add to Plan Button */}
          {onAddToPlan && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddToPlan(e);
              }}
              className="p-2.5 rounded-full shadow-md backdrop-blur-md transition-all duration-300 bg-black/20 text-white hover:bg-surface/90 hover:text-emerald-600 hover:scale-110"
              title="Add to Today"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><line x1="12" y1="14" x2="12" y2="18"></line><line x1="10" y1="16" x2="14" y2="16"></line></svg>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 md:p-6 flex flex-col flex-1">
        <div className="mb-4">
          <div className="flex justify-between items-start gap-3 mb-2">
            <h3 className="text-lg md:text-xl font-bold text-main leading-tight font-serif transition-colors line-clamp-2"
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
              onMouseLeave={(e) => e.currentTarget.style.color = ''}
            >
              {meal.name}
            </h3>
            <span className="flex-shrink-0 text-sm font-bold bg-calories-bg px-2.5 py-1 rounded-lg border border-calories-border" style={{ color: 'var(--calories)' }}>
              {meal.calories}
            </span>
          </div>
        </div>

        {/* Macros */}
        {showMacros && (
          <div className="flex gap-2 mb-6">
            {[
              { label: 'P', value: meal.protein, color: 'badge-amber border border-amber-100 dark:border-amber-800' },
              { label: 'F', value: meal.fat, color: 'badge-amber border border-amber-100 dark:border-amber-800' },
              { label: 'C', value: meal.carbs, color: 'badge-sky border border-sky-100 dark:border-sky-800' }
            ].map((macro, i) => (
              <div key={i} className={`flex-1 flex flex-col items-center justify-center py-2 rounded-xl transition-colors ${macro.color}`}>
                <span className="text-[10px] uppercase font-bold opacity-70">{macro.label}</span>
                <span className="text-sm font-bold">{macro.value || '-'}</span>
              </div>
            ))}
          </div>
        )}

        {onAction && (
          <div className="mt-auto pt-4 border-t border-border">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAction(e);
              }}
              className="w-full btn-primary text-sm shadow-md hover:shadow-lg active:scale-95"
            >
              {actionLabel || 'Select'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};