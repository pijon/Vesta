// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,Root} from 'react-dom/client';
import {it,expect,vi,beforeEach,afterEach} from 'vitest';
import type {Recipe} from '../types';
vi.mock('./ImageInput',()=>({ImageInput:()=>null}));
vi.mock('./Sheet',()=>({Sheet:({children,footer}:{children:React.ReactNode;footer:React.ReactNode})=>React.createElement('div',null,children,footer)}));
const {RecipeEditModal}=await import('./RecipeEditModal');
let root:Root,container:HTMLDivElement;
const recipe:Recipe={id:'r',name:'Soup',calories:0,ingredients:[],tags:[],servings:1};
beforeEach(()=>{Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});container=document.createElement('div');document.body.append(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();});
const click=async(text:string)=>act(async()=>{[...container.querySelectorAll('button')].find(b=>b.textContent===text)!.click();});
const enter=async(input:HTMLInputElement,value:string)=>act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});
it('preserves untouched legacy zero, but explicitly confirms zero',async()=>{
 const save=vi.fn();await act(async()=>root.render(React.createElement(RecipeEditModal,{recipe,onSave:save,onCancel:()=>{}})));
 await click('Save changes');expect(save.mock.calls[0][1]).toEqual({nutrition:'preserve'});
 await click('Confirm 0 kcal');await click('Save changes');expect(save.mock.calls[1]).toEqual([expect.objectContaining({calories:0,calorieStatus:'known'}),{nutrition:'replace'}]);
});
it('keeps blank nutrition absent and retains edits after a failed awaited save',async()=>{
 const save=vi.fn().mockRejectedValue(new Error('offline'));
 await act(async()=>root.render(React.createElement(RecipeEditModal,{recipe:{...recipe,calories:400},onSave:save,onCancel:()=>{}})));
 await enter(container.querySelector('input[type="number"]')!,'');await click('Save changes');
 expect(save.mock.calls[0][0]).toMatchObject({calories:0,calorieStatus:'unknown',protein:undefined});
 expect(container.querySelector('[role="alert"]')?.textContent).toContain('still here');
 expect(container.querySelector<HTMLInputElement>('input[type="number"]')!.value).toBe('');
});
it('planning editor mounts no nutrition controls and always preserves',async()=>{
 const save=vi.fn();await act(async()=>root.render(React.createElement(RecipeEditModal,{recipe:{...recipe,calories:450},experience:'planning',onSave:save,onCancel:()=>{}})));
 expect(container.querySelector('input[type="number"]')).toBeNull();await click('Save changes');expect(save).toHaveBeenCalledWith(expect.objectContaining({calories:450}),{nutrition:'preserve'});
});
const type=async(textarea:HTMLTextAreaElement,value:string)=>act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(textarea,value);textarea.dispatchEvent(new Event('input',{bubbles:true}));});
it('edits and clears the description',async()=>{
 const save=vi.fn();await act(async()=>root.render(React.createElement(RecipeEditModal,{recipe:{...recipe,description:'A long book intro'},onSave:save,onCancel:()=>{}})));
 const field=container.querySelector<HTMLTextAreaElement>('#recipe-description')!;
 expect(field.value).toBe('A long book intro');
 await type(field,'  Short note ');await click('Save changes');expect(save.mock.calls[0][0].description).toBe('Short note');
 await type(field,'');await click('Save changes');expect(save.mock.calls[1][0].description).toBeUndefined();
});
it('keeps an import source when the description is left empty',async()=>{
 const save=vi.fn();await act(async()=>root.render(React.createElement(RecipeEditModal,{recipe:{...recipe,description:'Imported from https://example.com/soup'},onSave:save,onCancel:()=>{}})));
 expect(container.querySelector<HTMLTextAreaElement>('#recipe-description')!.value).toBe('');
 await click('Save changes');expect(save.mock.calls[0][0].description).toBe('Imported from https://example.com/soup');
});
