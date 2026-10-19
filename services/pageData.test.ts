import {it,expect,vi} from 'vitest';
import type {Recipe} from '../types';
vi.mock('./storageService',()=>({getEatingOutDishes:async()=>[],getRecipes:async()=>[
 {name:'Tea',calories:0,calorieStatus:'known'}, {name:'Soup',calories:900,calorieStatus:'unknown'}, {name:'Old',calories:0}, {name:'Stew',calories:400}
] as Recipe[],getFoodItemsSince:async()=>[{name:'Soup',calories:300,timestamp:10},{name:'Bad',calories:Infinity,timestamp:20}]}));
vi.mock('./groupService',()=>({}));
const {knownFoodsData}=await import('./pageData');
it('keeps confirmed zero and personal log fallback without accepting unavailable recipe numbers',async()=>{
 expect(await knownFoodsData.load()).toEqual(expect.arrayContaining([
 expect.objectContaining({name:'Tea',calories:0,source:'recipe'}),expect.objectContaining({name:'Soup',calories:300,source:'log'}),expect.objectContaining({name:'Stew',calories:400})]));
 expect((await knownFoodsData.load()).map(f=>f.name)).not.toContain('Old');
 expect((await knownFoodsData.load()).map(f=>f.name)).not.toContain('Bad');
});
