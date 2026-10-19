import {it,expect,vi} from 'vitest';
const remote=vi.hoisted(()=>({value:{} as Record<string,unknown>,request:undefined as {contents:string;config:{responseSchema:{required:string[]}}}|undefined}));
vi.mock('./firebase',()=>({functions:{}}));
vi.mock('firebase/functions',()=>({httpsCallable:()=>async(request:typeof remote.request)=>{remote.request=request;return {data:{text:JSON.stringify(remote.value)}};}}));
const {parseRecipeText}=await import('./geminiService');
it.each([0,500,null,undefined,-1,'400'])('faithfully extracts nutrition %s without inventing missing values',async calories=>{
 remote.value={name:'Soup',ingredients:[],calories,protein:null,fat:-1,carbs:0};
 const result=await parseRecipeText('Soup. No additional nutrition stated.');
 expect(result.calories).toBe(typeof calories==='number'&&calories>=0?calories:undefined);
 expect(result.calorieStatus).toBe(typeof calories==='number'&&calories>=0?'known':'unknown');
 expect(result.protein).toBeUndefined();expect(result.fat).toBeUndefined();expect(result.carbs).toBe(0);
 expect(remote.request.contents).toContain('Never estimate or invent nutrition');
 expect(remote.request.config.responseSchema.required).not.toContain('calories');
});
