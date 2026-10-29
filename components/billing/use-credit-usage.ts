"use client";
import { useCallback,useEffect,useState } from 'react';
import { useAuth } from '@/components/auth/provider';
import type { CreditUsage } from '@/lib/billing/public-types';
export function useCreditUsage(){const {user}=useAuth(),uid=user?.uid;const [state,setState]=useState<{uid?:string;data?:CreditUsage;error?:string;loading:boolean}>({loading:true});
 const [revision,setRevision]=useState(0),refresh=useCallback(()=>setRevision(v=>v+1),[]);
 useEffect(()=>{const controller=new AbortController();if(!uid){setState({loading:false});return;}setState(previous=>({uid,loading:true,data:previous.uid===uid?previous.data:undefined}));
 let expired=false;const timeout=window.setTimeout(()=>{expired=true;controller.abort();setState({uid,loading:false,error:'Billing took too long to load. Please retry.'});},15000);
 fetch('/api/ai-credits',{cache:'no-store',signal:controller.signal}).then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.error||'Usage could not be loaded.');if(!controller.signal.aborted)setState({uid,data,loading:false});}).catch(()=>{if(!controller.signal.aborted&&!expired)setState({uid,loading:false,error:'Could not load AI Credits. Please retry.'});}).finally(()=>window.clearTimeout(timeout));return()=>{window.clearTimeout(timeout);controller.abort();};},[uid,revision]);
 useEffect(()=>{window.addEventListener('openui-credits-changed',refresh);window.addEventListener('focus',refresh);return()=>{window.removeEventListener('openui-credits-changed',refresh);window.removeEventListener('focus',refresh);};},[refresh]);
 return {...(state.uid===uid?state:{loading:true,data:undefined,error:undefined}),refresh};
}
