// @vitest-environment jsdom
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {it,expect,vi} from 'vitest';
import type {Recipe} from '../types';
import {DEFAULT_USER_STATS} from '../constants';
import {RecipeCard,RecipeRow} from './RecipeCard';
import {TomorrowCard} from './TomorrowCard';
vi.mock('./Portal',()=>({Portal:({children}:{children:React.ReactNode})=>children}));
vi.mock('../utils/storageUtils',()=>({uploadRecipeImage:vi.fn()}));
vi.mock('../services/firebase',()=>({currentUid:()=> 'a'}));
const {RecipeDetailModal}=await import('./RecipeDetailModal');
const meal:Recipe={id:'r',name:'Soup',calories:400,calorieStatus:'unknown',ingredients:[],tags:[],servings:1};
it.each([RecipeCard,RecipeRow])('renders honest unavailable/legacy/confirmed-zero labels in card variants',Component=>{
 expect(renderToStaticMarkup(React.createElement(Component,{meal}))).toContain('Calories unavailable');
 expect(renderToStaticMarkup(React.createElement(Component,{meal:{...meal,calories:0,calorieStatus:undefined}}))).toContain('Calories need confirmation');
 expect(renderToStaticMarkup(React.createElement(Component,{meal:{...meal,calories:0,calorieStatus:'known'}}))).toContain('0 kcal');
});
it('shows unavailable energy and absent macros in details',()=>{
 const markup=renderToStaticMarkup(React.createElement(RecipeDetailModal,{recipe:meal,onClose:()=>{}}));
 expect(markup).toContain('Calories unavailable');expect(markup).toContain('–');
});
it('Tomorrow shows a subtotal with unknown sides rather than an exact target claim',()=>{
 const markup=renderToStaticMarkup(React.createElement(TomorrowCard,{plan:{date:'2026-10-20',meals:[{...meal,calorieStatus:'known',sides:[meal]}],completedMealIds:[]},stats:DEFAULT_USER_STATS,onPlan:()=>{}}));
 expect(markup).toContain('400 kcal known');expect(markup).toContain('1 part unavailable');expect(markup).not.toContain('of 2000');
});
