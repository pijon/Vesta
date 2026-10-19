import {it,expect,vi,beforeEach,afterEach} from 'vitest';
import type {Recipe,ResolvedPlannedMealIntake} from '../types';
const account=vi.hoisted(()=>({uid:'a'}));
vi.mock('./firebase',()=>({db:{},auth:{get currentUser(){return {uid:account.uid};}}}));
vi.mock('firebase/firestore',async()=>({... (await import('../test/fakeFirestore')).fakeFirestore.api,runTransaction:(await import('../test/transactionFirestore')).runTestTransaction}));
const {fakeFirestore:store}=await import('../test/fakeFirestore');
const {transactionControl:control,resetTransaction}=await import('../test/transactionFirestore');
const service=await import('./mealLogService');
const date='2026-10-19',at=new Date(2026,9,19,12).getTime();
const meal:Recipe={id:'r',instanceId:'m',name:'Soup',calories:0,calorieStatus:'unknown',ingredients:[],tags:[],servings:1,familyMeal:true};
const entry:ResolvedPlannedMealIntake={key:'m',meal,at,calories:550,source:'estimate',caloriesEstimated:true};
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(at);store.reset();resetTransaction();account.uid='a';store.docs.set('users/a/data/preferences',{version:1,experience:'tracking',profileSetupComplete:true,trackingSetupComplete:true});store.docs.set('groups/g/dinners/'+date,{meals:{m:meal}});});
afterEach(()=>vi.useRealTimers());
it('atomically logs personal intake and completion without shared writes; retries and repeat taps dedupe',async()=>{
 control.retry=true;const original=JSON.stringify(store.docs.get('groups/g/dinners/'+date));
 const result=await service.commitPlannedMealIntake('a',date,[entry]);
 expect(result.log.items).toMatchObject([{calories:550,caloriesEstimated:true,planInstanceId:'m'}]);
 expect(result.completedMealIds).toEqual(['m']);
 expect(store.writes.every(path=>path.startsWith('users/a/'))).toBe(true);
 expect(JSON.stringify(store.docs.get('groups/g/dinners/'+date))).toBe(original);
 expect((await service.commitPlannedMealIntake('a',date,[entry])).log.items).toHaveLength(1);
});
it('failed commit writes no completion, diary or fasting and can retry',async()=>{
 control.fail=true;await expect(service.commitPlannedMealIntake('a',date,[entry])).rejects.toThrow('commit failed');
 expect(store.writes).toEqual([]);expect(store.docs.has('users/a/days/'+date)).toBe(false);
 control.fail=false;expect((await service.commitPlannedMealIntake('a',date,[entry])).items).toHaveLength(1);
});
it('preserves fresh unrelated log/day fields and exactly restores personal history',async()=>{
 store.docs.set('users/a/logs/'+date,{date,items:[{id:'other',name:'Coffee',calories:10,timestamp:at}],workouts:[],waterIntake:700,status:'complete',extra:'keep'});
 store.docs.set('users/a/days/'+date,{date,meals:[],completedMealIds:['other'],tips:'keep'});
 const result=await service.commitPlannedMealIntake('a',date,[entry]);const item=result.items[0];
 await service.updatePlannedMealIntake('a',date,{...item,calories:600});
 expect((await service.deletePlannedMealIntake('a',date,item.id)).completedMealIds).toEqual(['other']);
 const undo=await service.restorePlannedMealIntake('a',date,item);
 expect(undo.items[0]).toEqual(item);expect(undo.log).toMatchObject({waterIntake:700,status:'complete'});
 expect(store.docs.get('users/a/days/'+date)).toMatchObject({tips:'keep',meals:[]});
 expect((await service.removePlannedMealIntake('a',date,meal)).completedMealIds).toEqual(['other']);
});
it('rejects planning mode, incomplete setup, malformed records and changed ownership without writes',async()=>{
 for(const patch of [{experience:'planning'},{trackingSetupComplete:false}]) {
 store.docs.set('users/a/data/preferences',{version:1,experience:'tracking',profileSetupComplete:true,trackingSetupComplete:true,...patch});
 await expect(service.commitPlannedMealIntake('a',date,[entry])).rejects.toThrow('setup');expect(store.writes).toEqual([]);
 }
 store.docs.set('users/a/data/preferences',{version:1,experience:'tracking',profileSetupComplete:true,trackingSetupComplete:true});
 store.docs.set('users/a/logs/'+date,{date,items:'bad',workouts:[],waterIntake:0});
 await expect(service.commitPlannedMealIntake('a',date,[entry])).rejects.toThrow('safely');
 store.docs.delete('users/a/logs/'+date);control.beforeRead=()=>{account.uid='b';};
 await expect(service.commitPlannedMealIntake('a',date,[entry])).rejects.toThrow('account changed');expect(store.writes).toEqual([]);
});
it('ignores wrong-owner publication after a commit',async()=>{
 control.beforeCommit=()=>{account.uid='b';};
 await expect(service.commitPlannedMealIntake('a',date,[entry])).rejects.toThrow('account changed');
 expect(localStorage.getItem('fast800_cache_dailyLog_'+date)).toBeNull();
});
