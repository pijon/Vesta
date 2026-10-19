import { fakeFirestore } from './fakeFirestore';
type Ref = {path:string};
type Write = {ref:Ref;data:Record<string,unknown>;options?:{merge?:boolean}};
export const transactionControl = { fail:false, retry:false, beforeRead:undefined as (()=>void)|undefined, beforeCommit:undefined as (()=>void)|undefined };
export const runTestTransaction = async (_db:unknown, body:(tx:{get:typeof fakeFirestore.api.getDoc;set:(ref:Ref,data:Record<string,unknown>,options?:{merge?:boolean})=>void})=>Promise<unknown>) => {
  transactionControl.beforeRead?.();
  let writes:Write[]=[];
  const tx={get:fakeFirestore.api.getDoc,set:(ref:Ref,data:Record<string,unknown>,options?:{merge?:boolean})=>{writes.push({ref,data,options});}};
  if(transactionControl.retry) {await body(tx);writes=[];}
  const result=await body(tx);
  transactionControl.beforeCommit?.();
  if(transactionControl.fail) throw new Error('commit failed');
  for(const write of writes) await fakeFirestore.api.setDoc(write.ref,write.data,write.options);
  return result;
};
export const resetTransaction = () => Object.assign(transactionControl,{fail:false,retry:false,beforeRead:undefined,beforeCommit:undefined});
