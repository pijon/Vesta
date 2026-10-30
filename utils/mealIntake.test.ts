import {it,expect} from 'vitest';
import type {Recipe,ResolvedPlannedMealIntake} from '../types';
import {applyIntakeToSnapshots,removeIntakeFromSnapshots,restoreIntakeToSnapshots,retimeFasting,updateIntakeInSnapshots,validateResolvedIntake,assertUniqueMealKeys,IntakeSnapshots} from './mealIntake';
const meal:Recipe={id:'r',instanceId:'m',name:'Soup',calories:400,protein:20,ingredients:[],tags:[],servings:1};
const entry=(extra:Partial<ResolvedPlannedMealIntake>={}):ResolvedPlannedMealIntake=>({key:'m',meal,at:20*3_600_000,calories:400,source:'recipe',caloriesEstimated:false,...extra});
const snapshot=():IntakeSnapshots=>({log:{date:'2026-10-19',items:[],workouts:[],waterIntake:100,status:'complete'},completedMealIds:['other'],fasting:{lastAteTime:3_600_000,config:{protocol:'16:8',targetFastHours:16}},history:[]});
const ids={items:{m:'item'},history:'fast'};
it('requires personal confirmation for unknown roots, sides and budgets',()=>{
 for(const m of [{...meal,calorieStatus:'unknown' as const},{...meal,sides:[{...meal,calories:0}]},{...meal,quick:{budget:true}}]) {
 expect(()=>validateResolvedIntake(entry({meal:m}))).toThrow('Confirm');
 expect(()=>validateResolvedIntake(entry({meal:m,calories:0,source:'manual'}))).not.toThrow();
 }
 for(const calories of [-1,NaN,Infinity,'0']) expect(()=>validateResolvedIntake(entry({calories:calories as number,source:'manual'}))).toThrow();
});
it('deduplicates committed keys and preserves unrelated state and shared recipes',()=>{
 const s=snapshot(),original=JSON.stringify(meal);
 const next=applyIntakeToSnapshots(s,[entry()],ids);
 expect(next.log).toMatchObject({waterIntake:100,status:'complete',maxFastingHours:19});
 expect(next.history).toHaveLength(1);expect(next.items[0]).toMatchObject({id:'item',calories:400,protein:20,planInstanceId:'m'});
 const retry=applyIntakeToSnapshots(next,[entry()],ids);expect(retry.log.items).toHaveLength(1);expect(retry.history).toHaveLength(1);expect(JSON.stringify(meal)).toBe(original);
});
it('does not break fasting for zero or invent a fast for backdated food',()=>{
 const zero=applyIntakeToSnapshots(snapshot(),[entry({source:'manual',calories:0})],ids);
 expect(zero.fasting.lastAteTime).toBe(3_600_000);expect(zero.history).toEqual([]);
 const s=snapshot();s.fasting.lastAteTime=30*3_600_000;
 const late=applyIntakeToSnapshots(s,[entry()],ids);expect(late.history).toEqual([]);expect(late.fasting.lastAteTime).toBe(s.fasting.lastAteTime);
});
it('removes one linked entry and exactly restores historical personal intake without new fasting',()=>{
 const s=applyIntakeToSnapshots(snapshot(),[entry({source:'estimate',calories:650,caloriesEstimated:true})],ids);
 const removed=removeIntakeFromSnapshots(s,meal);expect(removed.completedMealIds).toEqual(['other']);
 const restored=restoreIntakeToSnapshots(removed,s.items[0]);expect(restored.log.items).toEqual(s.items);expect(restored.history).toEqual(s.history);
 expect(restoreIntakeToSnapshots(restored,s.items[0]).log.items).toHaveLength(1);
 const edited=updateIntakeInSnapshots(restored,{...s.items[0],calories:700});expect(edited.log.items[0].calories).toBe(700);expect(edited.history).toEqual(s.history);
});
it('rejects ambiguous older duplicate meal identities',()=>expect(()=>assertUniqueMealKeys([{...meal,instanceId:undefined},{...meal,instanceId:undefined}])).toThrow('re-save'));
it('moves last night\'s fast and the last time eaten when a meal logged late is set to an earlier time',()=>{
 const at=(h:number,m=0)=>new Date(2026,9,19,h,m).getTime();
 const fasting={lastAteTime:at(10,30),config:{protocol:'16:8' as const,targetFastHours:16}};
 const breakfast={id:'b',name:'Oats',calories:400,timestamp:at(10,30)};
 const coffee={id:'c',name:'Coffee',calories:20,timestamp:at(7)};
 const log={date:'2026-10-19',items:[coffee,breakfast],workouts:[],waterIntake:0,maxFastingHours:16.5};
 const moved=retimeFasting(log,fasting,{...breakfast,timestamp:at(8)});
 expect(moved.log.maxFastingHours).toBe(14);expect(moved.fasting.lastAteTime).toBe(at(8));
 expect(moved.log.items.find(i=>i.id==='b')?.timestamp).toBe(at(8));
 // Only the last time eaten follows a later meal; the fast still ended at breakfast
 const lunch={id:'l',name:'Soup',calories:500,timestamp:at(12)};
 const later=retimeFasting({...log,items:[breakfast,lunch]},{...fasting,lastAteTime:at(12)},{...lunch,timestamp:at(13)});
 expect(later.log.maxFastingHours).toBe(16.5);expect(later.fasting.lastAteTime).toBe(at(13));
 // A coffee moving changes nothing
 const same=retimeFasting(log,fasting,{...coffee,timestamp:at(6)});
 expect(same.fasting).toBe(fasting);expect(same.log.maxFastingHours).toBe(16.5);
});
