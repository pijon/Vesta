import type { DailyLog, FastingState, FastingEntry, FoodLogItem, Recipe, ResolvedPlannedMealIntake } from '../types';
import { DEFAULT_FAST_BREAK_CALORIES, MAX_PLAUSIBLE_FAST_HOURS } from '../constants';
import { mealKey, mealProtein, slotFor, slotLabel } from './planUtils';
import { isNutritionNumber, mealNutrition } from './recipeNutrition';

export interface IntakeSnapshots {
  log: DailyLog;
  completedMealIds: string[];
  fasting: FastingState;
  history: FastingEntry[];
}
export interface IntakeMutation extends IntakeSnapshots { items: FoodLogItem[] }
export const validateResolvedIntake = (entry: ResolvedPlannedMealIntake): void => {
  if (!entry.key || entry.key !== mealKey(entry.meal) || !Number.isFinite(entry.at) || !isNutritionNumber(entry.calories)) throw new Error('Enter valid personal meal calories and time.');
  if (!['recipe','manual','estimate'].includes(entry.source)) throw new Error('Confirm the personal calorie amount.');
  const nutrition=mealNutrition(entry.meal);
  if (entry.source==='recipe' && (!nutrition.complete || nutrition.budget || entry.calories!==nutrition.knownCalories)) throw new Error('Confirm calories for the whole meal, including sides.');
};
export const assertUniqueMealKeys = (meals: Recipe[]): void => {
  const keys=meals.map(mealKey);
  if(new Set(keys).size!==keys.length) throw new Error('Please edit and re-save this older plan so each meal has its own identity.');
};
const result = (s:IntakeSnapshots,items:FoodLogItem[]=[]):IntakeMutation=>({...s,items});

export const applyIntakeToSnapshots = (s:IntakeSnapshots,entries:ResolvedPlannedMealIntake[],ids:{items:Record<string,string>;history:string}):IntakeMutation => {
  entries.forEach(validateResolvedIntake);
  assertUniqueMealKeys(entries.map(e=>e.meal));
  const log={...s.log,items:[...s.log.items]};
  const completed=new Set(s.completedMealIds);
  const items:FoodLogItem[]=[];
  const added:FoodLogItem[]=[];
  for(const entry of [...entries].sort((a,b)=>a.at-b.at)) {
    let item=log.items.find(i=>i.planInstanceId===entry.key);
    if(!item) {
      const protein=entry.source==='recipe'?mealProtein(entry.meal):isNutritionNumber(entry.personal?.protein)?entry.personal.protein:undefined;
      item={id:ids.items[entry.key],name:entry.name?.trim()||entry.meal.name,calories:entry.calories,
        timestamp:entry.at,type:slotLabel(slotFor(entry.meal)),tags:entry.meal.tags,
        isPacked:entry.meal.isPacked,isLeftover:entry.meal.isLeftover,planInstanceId:entry.key,
        caloriesEstimated:entry.caloriesEstimated,...(protein!==undefined?{protein}:{})};
      if(!item.id) throw new Error('Missing intake identity.');
      log.items.push(item);added.push(item);
    }
    items.push(item);completed.add(entry.key);
  }
  let fasting={...s.fasting};const history=[...s.history];
  const breaking=added.filter(i=>i.calories>(s.fasting.config.fastBreakCalories??DEFAULT_FAST_BREAK_CALORIES));
  const first=breaking[0]?.timestamp,last=breaking.at(-1)?.timestamp,previous=s.fasting.lastAteTime;
  if(first!==undefined && previous!==null && first>previous) {
    const hours=(first-previous)/3_600_000;
    if(hours<=MAX_PLAUSIBLE_FAST_HOURS) {
      log.maxFastingHours=Math.max(log.maxFastingHours||0,hours);
      if(hours>=fasting.config.targetFastHours) history.push({id:ids.history,startTime:previous,endTime:first,durationHours:hours,isSuccess:true});
    }
  }
  if(last!==undefined) fasting={...fasting,lastAteTime:Math.max(previous??0,last)};
  return {log,completedMealIds:[...completed],fasting,history,items};
};

export const deleteIntakeFromSnapshots = (s:IntakeSnapshots,itemId:string):IntakeMutation => {
  const item=s.log.items.find(i=>i.id===itemId);
  if(!item) return result(s);
  const remaining=s.log.items.filter(i=>i.id!==itemId);
  const clearKey=item.planInstanceId && !remaining.some(i=>i.planInstanceId===item.planInstanceId)?item.planInstanceId:undefined;
  return result({...s,log:{...s.log,items:remaining},completedMealIds:s.completedMealIds.filter(key=>key!==clearKey)});
};
export const removeIntakeFromSnapshots = (s:IntakeSnapshots,meal:Recipe):IntakeMutation => {
  const key=mealKey(meal),nutrition=mealNutrition(meal);
  const item=[...s.log.items].reverse().find(i=>i.planInstanceId===key) ?? [...s.log.items].reverse().find(i=>!i.planInstanceId && nutrition.complete && i.name===meal.name && i.calories===nutrition.knownCalories);
  const next=item?deleteIntakeFromSnapshots(s,item.id):result(s);
  return {...next,completedMealIds:next.completedMealIds.filter(k=>k!==key)};
};
const validateItem = (item:FoodLogItem) => {
  if(!item.id || !item.name.trim() || !item.planInstanceId || !isNutritionNumber(item.calories) || !Number.isFinite(item.timestamp)) throw new Error('Invalid personal intake.');
};
export const restoreIntakeToSnapshots = (s:IntakeSnapshots,item:FoodLogItem):IntakeMutation => {
  validateItem(item);
  const existing=s.log.items.find(i=>i.id===item.id||i.planInstanceId===item.planInstanceId);
  if(existing) return result(s,[existing]);
  return result({...s,log:{...s.log,items:[...s.log.items,{...item}]},completedMealIds:[...new Set([...s.completedMealIds,item.planInstanceId])]},[item]);
};
export const updateIntakeInSnapshots = (s:IntakeSnapshots,item:FoodLogItem):IntakeMutation => {
  validateItem(item);
  const old=s.log.items.find(i=>i.id===item.id);
  if(!old || old.planInstanceId!==item.planInstanceId) throw new Error('That meal entry changed. Reload and try again.');
  const {log,fasting}=retimeFasting(s.log,s.fasting,item);
  return result({...s,fasting,log},[item]);
};

/**
 * A food on the day's log edited (its time, often, when logged late): last night's fast ends at the
 * day's first meal and the last time eaten is its latest, so both follow the edit, earlier as well as later.
 */
export const retimeFasting = (log:DailyLog,fasting:FastingState,item:FoodLogItem):{log:DailyLog;fasting:FastingState} => {
  const limit=fasting.config.fastBreakCalories??DEFAULT_FAST_BREAK_CALORIES;
  const items=log.items.map(i=>i.id===item.id?{...item}:i);
  const times=(list:FoodLogItem[])=>list.filter(i=>i.calories>limit).map(i=>i.timestamp);
  const before=times(log.items),after=times(items);
  const next:DailyLog={...log,items};
  // The fast that ended at the first meal is the day's longest; it shifts with that meal
  if(before.length && after.length && log.maxFastingHours) {
    const hours=log.maxFastingHours+(Math.min(...after)-Math.min(...before))/3_600_000;
    next.maxFastingHours=hours>0 && hours<=MAX_PLAUSIBLE_FAST_HOURS?hours:0;
  }
  if(!after.length) return {log:next,fasting};
  const latest=Math.max(...after),previous=fasting.lastAteTime;
  // Set by this day's food (on or after its start), or older than it: the day's latest meal
  const dayStart=new Date(`${log.date}T00:00`).getTime();
  const lastAteTime=previous===null || previous>=dayStart || latest>previous?latest:previous;
  return {log:next,fasting:lastAteTime===previous?fasting:{...fasting,lastAteTime}};
};
