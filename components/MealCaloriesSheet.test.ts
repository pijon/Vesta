// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,Root} from 'react-dom/client';
import {it,expect,vi,beforeEach,afterEach} from 'vitest';
import type {Recipe} from '../types';
const ai=vi.hoisted(()=>({estimate:vi.fn()}));
vi.mock('../services/geminiService',()=>({estimateMealCalories:ai.estimate}));
const {MealCaloriesSheet}=await import('./MealCaloriesSheet');
let root:Root,container:HTMLDivElement;
const meal:Recipe={id:'r',name:'Soup',calories:0,calorieStatus:'unknown',ingredients:[],tags:[],servings:1};
beforeEach(()=>{vi.useFakeTimers();Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});container=document.createElement('div');document.body.append(container);root=createRoot(container);ai.estimate.mockReset();});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.useRealTimers();});
const click=async(text:string)=>act(async()=>{[...document.querySelectorAll('button')].find(b=>b.textContent===text)!.click();});
const enter=async(value:string)=>act(async()=>{const input=document.querySelector('input')!;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});
const submit=async()=>act(async()=>{document.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
it('accepts explicit zero, retains failed answers and retries',async()=>{
 const save=vi.fn().mockRejectedValueOnce(new Error('Offline')).mockResolvedValue(undefined);
 await act(async()=>root.render(React.createElement(MealCaloriesSheet,{meal,onSave:save,onSkip:()=>{},onClose:()=>{}})));
 await submit();expect(save).not.toHaveBeenCalled();await enter('0');await submit();
 expect(save).toHaveBeenCalledWith(0,false);expect(document.querySelector('[role="alert"]')?.textContent).toBe('Offline');expect(document.querySelector('input')!.value).toBe('0');
 await submit();expect(save).toHaveBeenCalledTimes(2);
});
it('blocks duplicate save and all dismissal routes during commit, then allows normal dismissal',async()=>{
 let finish!:()=>void;const save=vi.fn(()=>new Promise<void>(r=>{finish=r;})),close=vi.fn(),skip=vi.fn();
 await act(async()=>root.render(React.createElement(MealCaloriesSheet,{meal,onSave:save,onSkip:skip,onClose:close})));
 await enter('500');await submit();await submit();
 await act(async()=>{document.querySelector<HTMLButtonElement>('[aria-label="Close"]')!.click();document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));document.querySelector<HTMLElement>('.modal-backdrop')!.click();});
 await click('Skip this meal');await act(async()=>vi.advanceTimersByTime(500));
 expect(save).toHaveBeenCalledTimes(1);expect(close).not.toHaveBeenCalled();expect(skip).not.toHaveBeenCalled();expect(document.querySelector('.is-closing')).toBeNull();
 await act(async()=>finish());await act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));await act(async()=>vi.advanceTimersByTime(500));expect(close).toHaveBeenCalledTimes(1);
});
it('ignores late estimates after a manual edit or meal identity change',async()=>{
 let finish!:(n:number)=>void;ai.estimate.mockImplementation(()=>new Promise<number>(r=>{finish=r;}));const save=vi.fn();
 const props={meal,onSave:save,onSkip:()=>{},onClose:()=>{}};
 await act(async()=>root.render(React.createElement(MealCaloriesSheet,props)));await click('Estimate from the name');await enter('321');await act(async()=>finish(900));expect(document.querySelector('input')!.value).toBe('321');expect(save).not.toHaveBeenCalled();
 await click('Estimate from the name');await act(async()=>root.render(React.createElement(MealCaloriesSheet,{...props,meal:{...meal,id:'new'}})));await act(async()=>finish(850));expect(document.querySelector('input')!.value).toBe('');
});
