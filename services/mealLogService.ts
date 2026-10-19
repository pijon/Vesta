import { doc, runTransaction } from 'firebase/firestore';
import { auth, db } from './firebase';
import type { CommittedMealIntake, DailyLog, FastingState, FastingEntry, FoodLogItem, Recipe, ResolvedPlannedMealIntake } from '../types';
import { applyIntakeToSnapshots, deleteIntakeFromSnapshots, removeIntakeFromSnapshots, restoreIntakeToSnapshots, updateIntakeInSnapshots, IntakeSnapshots, IntakeMutation } from '../utils/mealIntake';
import { parseUserPreferences, isCalendarDate } from '../utils/userPreferences';
import { localDateString } from '../utils/dateUtils';
import { isNutritionNumber } from '../utils/recipeNutrition';
import { getCacheKey, getCachedDayPlan, saveToCache } from '../utils/cacheService';

const owner = (uid:string) => {if(!uid || auth.currentUser?.uid!==uid) throw new Error('Your account changed. Reload and try again.');};
const validTime = (date:string,at:number) => {if(!Number.isFinite(at)||localDateString(new Date(at))!==date) throw new Error('The meal date changed. Reload and try again.');};
const object = (value:unknown): value is Record<string,unknown> => !!value && typeof value==='object' && !Array.isArray(value);
const malformed = () => new Error('Your saved diary could not be read safely. Reload and try again.');
const readLog = (value:unknown,date:string):DailyLog => {
  if(!object(value)||value.date!==date || !Array.isArray(value.items)||!Array.isArray(value.workouts)||!isNutritionNumber(value.waterIntake)) throw malformed();
  if(value.items.some(i=>!object(i)||typeof i.id!=='string'||typeof i.name!=='string'||!isNutritionNumber(i.calories)||!Number.isFinite(i.timestamp))) throw malformed();
  if(value.workouts.some(w=>!object(w)||typeof w.id!=='string'||!isNutritionNumber(w.caloriesBurned))) throw malformed();
  return value as unknown as DailyLog;
};
const readFasting = (value:unknown):FastingState => {
  if(!object(value)||!(value.lastAteTime===null||isNutritionNumber(value.lastAteTime))||!object(value.config)||typeof value.config.protocol!=='string'||!isNutritionNumber(value.config.targetFastHours)||value.config.targetFastHours===0 || (value.config.fastBreakCalories!==undefined&&!isNutritionNumber(value.config.fastBreakCalories))) throw malformed();
  return value as unknown as FastingState;
};

const transact = async (uid:string,date:string,reduce:(s:IntakeSnapshots)=>IntakeMutation):Promise<CommittedMealIntake> => {
  owner(uid);
  if(!isCalendarDate(date)||date!==localDateString()) throw new Error('The meal date changed. Reload and try again.');
  const refs={preferences:doc(db,'users',uid,'data','preferences'),log:doc(db,'users',uid,'logs',date),day:doc(db,'users',uid,'days',date),fasting:doc(db,'users',uid,'data','fasting'),history:doc(db,'users',uid,'data','fasting_history')};
  const committed=await runTransaction(db,async transaction=>{
    const [preferences,log,day,fasting,history]=await Promise.all([transaction.get(refs.preferences),transaction.get(refs.log),transaction.get(refs.day),transaction.get(refs.fasting),transaction.get(refs.history)]);
    owner(uid);
    const pref=parseUserPreferences(preferences.exists()?preferences.data():null);
    if(pref.experience!=='tracking'||!pref.trackingSetupComplete||!pref.profileSetupComplete) throw new Error('Complete nutrition tracking setup before logging intake.');
    const dayData=day.exists()?day.data():{date,completedMealIds:[]};
    if(!Array.isArray(dayData.completedMealIds)||dayData.completedMealIds.some(k=>typeof k!=='string')) throw malformed();
    if(dayData.meals!==undefined) {
      if(!Array.isArray(dayData.meals)) throw malformed();
      const keys=dayData.meals.map((m:Record<string,unknown>)=>m.instanceId||m.recipeId||m.id);
      if(new Set(keys).size!==keys.length) throw new Error('Please edit and re-save this older plan so each meal has its own identity.');
    }
    const historyData=history.exists()?history.data().entries:[];
    if(!Array.isArray(historyData)||historyData.some(e=>!object(e)||typeof e.id!=='string'||!isNutritionNumber(e.startTime)||!isNutritionNumber(e.endTime)||!isNutritionNumber(e.durationHours)||typeof e.isSuccess!=='boolean')) throw malformed();
    const snapshots:IntakeSnapshots={log:log.exists()?readLog(log.data(),date):{date,items:[],workouts:[],waterIntake:0},completedMealIds:dayData.completedMealIds,
      fasting:fasting.exists()?readFasting(fasting.data()):{lastAteTime:null,config:{protocol:'16:8',targetFastHours:16}},history:historyData as FastingEntry[]};
    const next=reduce(snapshots);
    owner(uid);
    transaction.set(refs.log,next.log,{merge:true});
    transaction.set(refs.day,{date,completedMealIds:next.completedMealIds},{merge:true});
    if(JSON.stringify(next.fasting)!==JSON.stringify(snapshots.fasting)) transaction.set(refs.fasting,next.fasting,{merge:true});
    if(JSON.stringify(next.history)!==JSON.stringify(snapshots.history)) transaction.set(refs.history,{entries:next.history},{merge:true});
    return {log:next.log,completedMealIds:next.completedMealIds,fasting:next.fasting,items:next.items};
  });
  owner(uid);
  saveToCache(getCacheKey('dailyLog',date),committed.log);
  saveToCache(getCacheKey('fasting'),committed.fasting);
  const cached=getCachedDayPlan(date);
  if(cached) saveToCache(getCacheKey('dayPlan',date),{...cached,completedMealIds:committed.completedMealIds});
  return committed;
};

export const commitPlannedMealIntake = (uid:string,date:string,entries:ResolvedPlannedMealIntake[]):Promise<CommittedMealIntake> => {
  entries.forEach(e=>validTime(date,e.at));
  const ids={items:Object.fromEntries(entries.map(e=>[e.key,crypto.randomUUID()])),history:crypto.randomUUID()};
  return transact(uid,date,s=>applyIntakeToSnapshots(s,entries,ids));
};
export const removePlannedMealIntake = (uid:string,date:string,meal:Recipe) => transact(uid,date,s=>removeIntakeFromSnapshots(s,meal));
export const deletePlannedMealIntake = (uid:string,date:string,itemId:string) => transact(uid,date,s=>deleteIntakeFromSnapshots(s,itemId));
export const restorePlannedMealIntake = (uid:string,date:string,item:FoodLogItem) => {validTime(date,item.timestamp);return transact(uid,date,s=>restoreIntakeToSnapshots(s,item));};
export const updatePlannedMealIntake = (uid:string,date:string,item:FoodLogItem) => {validTime(date,item.timestamp);return transact(uid,date,s=>updateIntakeInSnapshots(s,item));};
