import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, BookOpen, ChefHat, Copy, MapPin, MoveRight, Package, Plus, Repeat, Shuffle, Trash2, UserRound, UserX, UsersRound, X,
} from 'lucide-react';
import { MealSlot, Recipe } from '../types';
import { Sheet } from './Sheet';
import { SelectionPill } from './SelectionPill';
import { mealVisualFor } from '../utils/mealVisual';
import { MEAL_SLOTS, PLANNABLE_SLOTS, isBudgetMeal, isQuickMeal, mealKcalLabel } from '../utils/planUtils';
import { parseLocalDate } from '../utils/dateUtils';

interface PlannerMealSheetProps {
  meal: Recipe;
  date: string;
  slot: MealSlot;
  /** Dates offered for move and copy */
  dates: string[];
  /** Name of the family member who planned a family meal */
  addedByName?: string;
  /** Names of the other family members not eating this family meal */
  outNames?: string[];
  inFamily: boolean;
  onView: () => void;
  onCook: () => void;
  onSwap: () => void;
  onAddSide: () => void;
  onRemoveSide: (index: number) => void;
  onMove: (date: string, slot: MealSlot) => void;
  onCopy: (date: string, slot: MealSlot) => void;
  onPlanLeftovers: () => void;
  /** Replace a home-cooked quick meal's shopping items */
  onSetShopping: (items: string[]) => void;
  onTogglePacked: () => void;
  /** Share the meal with the family, or keep it just for the user */
  onSetFamilyMeal: (family: boolean) => void;
  /** The user isn't eating this family meal */
  onNotEating: () => void;
  onRemove: () => void;
  /** Fill an eating-out budget with the real place and meal */
  onDecideEatingOut: () => void;
  onClose: () => void;
}

const dayName = (date: string, style: 'long' | 'short' = 'long') =>
  parseLocalDate(date).toLocaleDateString(undefined, { weekday: style, day: 'numeric', month: 'short' });

/** Everything you can do with one planned meal. */
export const PlannerMealSheet: React.FC<PlannerMealSheetProps> = ({
  meal, date, slot, dates, addedByName, outNames = [], inFamily,
  onView, onCook, onSwap, onAddSide, onRemoveSide, onMove, onCopy, onPlanLeftovers,
  onSetShopping, onTogglePacked, onSetFamilyMeal, onNotEating, onRemove, onDecideEatingOut, onClose,
}) => {
  const [picker, setPicker] = useState<'move' | 'copy' | null>(null);
  const [pickDate, setPickDate] = useState(date);
  const [pickSlot, setPickSlot] = useState<MealSlot>(slot);
  const visual = mealVisualFor(meal);
  const isCustom = isQuickMeal(meal);
  const isBudget = isBudgetMeal(meal);
  const hasRecipe = !isCustom && ((meal.ingredients?.length ?? 0) > 0 || (meal.instructions?.length ?? 0) > 0);

  // A home-cooked quick meal keeps a shopping list of its own, editable after planning. It saves
  // when the field is left, or when the sheet closes with it still focused.
  const hasShopping = isCustom && !isBudget && !meal.isLeftover && (meal.quick?.kind ?? 'home') === 'home';
  const savedShopping = (meal.ingredients || []).join('\n');
  const [shopping, setShopping] = useState(savedShopping);
  const toItems = (text: string) => text.split('\n').map(line => line.trim()).filter(Boolean);
  const saveShopping = () => {
    if (toItems(shopping).join('\n') !== toItems(savedShopping).join('\n')) onSetShopping(toItems(shopping));
  };
  const saveShoppingRef = useRef(saveShopping);
  saveShoppingRef.current = saveShopping;
  useEffect(() => () => saveShoppingRef.current(), []);

  const action = (icon: React.ReactNode, label: string, onClick: () => void, tone: 'default' | 'danger' = 'default', pressed?: boolean) => (
    <li>
      <button
        onClick={onClick}
        aria-pressed={pressed}
        className={`w-full flex items-center gap-3 min-h-12 px-3 rounded-[14px] text-left font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)] ${tone === 'danger' ? 'text-error hover:bg-error-bg' : 'hover:bg-surface-sunken'}`}
      >
        <span className={`size-9 shrink-0 rounded-full flex items-center justify-center ${tone === 'danger' ? 'bg-error-bg' : pressed ? 'bg-water-bg text-water-text' : 'bg-surface-sunken'}`} aria-hidden="true">{icon}</span>
        <span className="flex-1">{label}</span>
      </button>
    </li>
  );

  if (picker) {
    const verb = picker === 'move' ? 'Move' : 'Copy';
    return (
      <Sheet
        title={`${verb} ${meal.name}`}
        subtitle={`Now: ${dayName(date)} · ${MEAL_SLOTS.find(s => s.slot === slot)!.label.toLowerCase()}`}
        onClose={onClose}
        footer={
          <div className="flex gap-2">
            <button onClick={() => setPicker(null)} className="btn-secondary flex-1"><ArrowLeft size={16} aria-hidden="true" /> Back</button>
            <button
              onClick={() => (picker === 'move' ? onMove : onCopy)(pickDate, pickSlot)}
              disabled={picker === 'move' && pickDate === date && pickSlot === slot}
              className="btn-primary flex-1"
            >
              {verb} here
            </button>
          </div>
        }
      >
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-muted mb-2">Day</legend>
          <div className="grid grid-cols-2 gap-2">
            {dates.map(d => (
              <button
                key={d}
                onClick={() => setPickDate(d)}
                aria-pressed={pickDate === d}
                className="chip chip-tile justify-start text-left"
              >
                {dayName(d, 'short')}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="mt-5">
          <legend className="text-sm font-semibold text-muted mb-2">Meal</legend>
          <div className="grid grid-cols-3 gap-2">
            {PLANNABLE_SLOTS.map(s => (
              <button
                key={s.slot}
                onClick={() => setPickSlot(s.slot)}
                aria-pressed={pickSlot === s.slot}
                className="chip chip-tile"
              >
                {s.label}
              </button>
            ))}
          </div>
        </fieldset>
      </Sheet>
    );
  }

  return (
    <Sheet
      title={meal.name}
      subtitle={<>{dayName(date)} · {MEAL_SLOTS.find(s => s.slot === slot)!.label.toLowerCase()} · {mealKcalLabel(meal)}</>}
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          <span className={`badge ${isCustom && meal.quick?.kind ? visual.tint : 'badge-neutral'}`}><visual.Icon size={12} aria-hidden="true" /> {visual.label}</span>
          {isCustom && <span className="badge badge-neutral">No recipe</span>}
          {meal.familyMeal && (
            <span className="badge badge-workout"><UsersRound size={12} aria-hidden="true" /> Family meal{addedByName ? ` · planned by ${addedByName}` : ''}</span>
          )}
          {meal.familyMeal && outNames.length > 0 && <span className="badge badge-neutral"><UserX size={12} aria-hidden="true" /> {outNames.join(', ')} not eating</span>}
          {meal.isLeftover && <span className="badge badge-neutral"><Repeat size={12} aria-hidden="true" /> Leftovers</span>}
          {meal.isPacked && <span className="badge badge-water"><Package size={12} aria-hidden="true" /> Packed</span>}
        </div>

        {/* Eating out and leftovers are the user's own */}
        {inFamily && !meal.isLeftover && !isBudget && (
          <div role="radiogroup" aria-label="Who it's for" className="segmented pill-group grid grid-cols-2 w-full">
            {([[true, 'Family', UsersRound], [false, 'Just me', UserRound]] as const).map(([family, label, Icon]) => (
              <button
                key={label}
                role="radio"
                aria-checked={!!meal.familyMeal === family}
                onClick={() => { if (!!meal.familyMeal !== family) onSetFamilyMeal(family); }}
                className="segment justify-center gap-1.5"
              >
                {!!meal.familyMeal === family && <SelectionPill group="planner-meal-family-pill" />}
                <Icon size={15} aria-hidden="true" /> {label}
              </button>
            ))}
          </div>
        )}

        {hasShopping && (
          <label className="block">
            <span className="block text-sm font-semibold text-muted mb-1.5">Shopping <span className="font-normal">· one per line, for the shopping list</span></span>
            <textarea
              value={shopping}
              onChange={e => setShopping(e.target.value)}
              onBlur={saveShopping}
              rows={3}
              placeholder={'Tortillas\nMinced beef 500 g\nAvocados'}
              className="input w-full resize-none"
            />
          </label>
        )}

        {meal.sides && meal.sides.length > 0 && (
          <section aria-labelledby="sides-heading">
            <h3 id="sides-heading" className="text-sm font-semibold text-muted mb-1">Sides</h3>
            <ul>
              {meal.sides.map((side, i) => (
                <li key={side.instanceId || `${side.id}-${i}`} className="flex items-center gap-3 py-1.5">
                  <span className="flex-1 min-w-0 truncate font-semibold">{side.name}</span>
                  <span className="text-sm text-muted">{mealKcalLabel(side)}</span>
                  <button onClick={() => onRemoveSide(i)} className="icon-btn size-9" aria-label={`Remove side ${side.name}`}><X size={16} /></button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <ul className="-mx-1">
          {(isBudget || meal.quick?.kind === 'out') && action(<MapPin size={18} />, isBudget ? 'Where are you eating?' : 'Change what you\'re having', onDecideEatingOut)}
          {!isCustom && action(<BookOpen size={18} />, 'View recipe', onView)}
          {hasRecipe && action(<ChefHat size={18} />, 'Cook', onCook)}
          {action(<Shuffle size={18} />, 'Swap for another meal', onSwap)}
          {action(<Plus size={18} />, 'Add a side', onAddSide)}
          {!meal.isLeftover && !isBudget && action(<Repeat size={18} />, 'Plan leftovers for lunch tomorrow', onPlanLeftovers)}
          {action(<MoveRight size={18} />, 'Move to another day', () => setPicker('move'))}
          {action(<Copy size={18} />, 'Copy to another day', () => setPicker('copy'))}
          {slot === 'lunch' && action(<Package size={18} />, meal.isPacked ? 'Packed lunch' : 'Mark as packed lunch', onTogglePacked, 'default', !!meal.isPacked)}
          {meal.familyMeal && action(<UserX size={18} />, 'I\'m not eating this', onNotEating)}
          {action(<Trash2 size={18} />, meal.familyMeal ? 'Remove for the whole family' : 'Remove', onRemove, 'danger')}
        </ul>
      </div>
    </Sheet>
  );
};
