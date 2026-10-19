import { beforeEach, it, expect, vi } from 'vitest';
import type { Recipe } from '../types';
const account=vi.hoisted(()=>({uid:'a'}));
vi.mock('./firebase',()=>({db:{},currentUid:()=>account.uid,auth:{get currentUser(){return {uid:account.uid};}}}));
vi.mock('./groupService',async()=>({getMyGroupId:async()=> 'g',toStoredRecipe:(await vi.importActual<typeof import('./groupService')>('./groupService')).toStoredRecipe}));
vi.mock('firebase/firestore',async()=>({... (await import('../test/fakeFirestore')).fakeFirestore.api,runTransaction:(await import('../test/transactionFirestore')).runTestTransaction}));
const {fakeFirestore:store}=await import('../test/fakeFirestore');
const {transactionControl:control,resetTransaction}=await import('../test/transactionFirestore');
const {saveRecipe}=await import('./storageService');
const recipe:Recipe={id:'r',name:'Soup',calories:400,protein:20,ingredients:[],tags:[],servings:1};
beforeEach(()=>{store.reset();resetTransaction();account.uid='a';store.docs.set('groups/g/recipes/r',{...recipe,calories:450,calorieStatus:'known',createdBy:'other',favoritedBy:['other']});});
it('preserves latest nutrition through stale name and image edits and retries',async()=>{
 control.retry=true;
 const saved=await saveRecipe({...recipe,name:'New',image:'https://example.org/a',planOverrides:{calories:123}});
 expect(saved).toMatchObject({name:'New',calories:450,protein:20,createdBy:'other',favoritedBy:['other']});
 expect(store.docs.get('groups/g/recipes/r')).not.toHaveProperty('planOverrides');
 expect(store.writes).toHaveLength(1);
});
it('explicit replacement clears absent macros and retains confirmed zero',async()=>{
 await saveRecipe({...recipe,calories:0,calorieStatus:'known',protein:undefined},{nutrition:'replace'});
 expect(store.docs.get('groups/g/recipes/r')).toMatchObject({calories:0,calorieStatus:'known'});
 expect(store.docs.get('groups/g/recipes/r')).not.toHaveProperty('protein');
});
it('failed commits leave the recipe unchanged',async()=>{
 control.fail=true;await expect(saveRecipe({...recipe,name:'New'})).rejects.toThrow('commit failed');
 expect(store.docs.get('groups/g/recipes/r').name).toBe('Soup');expect(store.writes).toEqual([]);
});
it('rejects changed accounts before writes and invalid explicit values',async()=>{
 control.beforeRead=()=>{account.uid='b';};
 await expect(saveRecipe(recipe)).rejects.toThrow('account changed');expect(store.writes).toEqual([]);
 account.uid='a';control.beforeRead=undefined;
 await expect(saveRecipe({...recipe,calories:NaN,calorieStatus:'known'},{nutrition:'replace'})).rejects.toThrow('valid nutrition');
});
