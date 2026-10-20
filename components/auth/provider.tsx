"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { onIdTokenChanged, signOut, type User } from 'firebase/auth';
import { getFirebaseAuth, prepareFirebaseAuth } from '@/lib/firebase/client';
import { authErrorMessage } from '@/lib/firebase/errors';

type AuthState={user:User|null;ready:boolean;error:string;requiresVerification:boolean;establish:(user:User)=>Promise<void>;logout:()=>Promise<void>};
const AuthContext=createContext<AuthState|null>(null);
export function AuthProvider({children}:{children:React.ReactNode}){
  const [user,setUser]=useState<User|null>(null),[ready,setReady]=useState(false),[error,setError]=useState('');
  const [requiresVerification,setRequiresVerification]=useState(false);
  const queue=useRef<Promise<void>>(Promise.resolve());
  const currentUid=useRef<string|null>(null);
  const lastToken=useRef<string|null|undefined>(undefined);
  const sync=useCallback((current:User|null)=>{
    const task=queue.current.catch(()=>{}).then(async()=>{
      const token=current?await current.getIdToken():null;
      if(lastToken.current===token)return;
      const response=await fetch('/api/auth/session',{method:token?'POST':'DELETE',headers:{'Content-Type':'application/json'},...(token?{body:JSON.stringify({idToken:token})}:{})});
      if(response.status===403 && (await response.clone().json()).code==='EMAIL_VERIFICATION_REQUIRED'){lastToken.current=undefined;setRequiresVerification(true);return;}
      if(!response.ok)throw new Error('Unable to establish a secure session. Retry signing in.');
      setRequiresVerification(false);
      lastToken.current=token;
    });
    queue.current=task;
    return task;
  },[]);
  useEffect(()=>{
    let active=true,revision=0;
    let unsubscribe:(()=>void)|undefined;
    (async()=>{
      try{
        await prepareFirebaseAuth();
        if(!active)return;
        unsubscribe=onIdTokenChanged(getFirebaseAuth(),current=>{
          const own=++revision;
          if((current?.uid||null)!==currentUid.current)setReady(false);
          void sync(current).then(()=>{if(active&&own===revision){currentUid.current=current?.uid||null;setUser(current);setError('');setReady(true);}}).catch(failure=>{if(active&&own===revision){setUser(null);setError(authErrorMessage(failure));setReady(true);}});
        });
      }catch(failure){if(active){setError(authErrorMessage(failure));setReady(true);}}
    })();
    return()=>{active=false;revision++;unsubscribe?.();};
  },[sync]);
  const establish=useCallback(async(current:User)=>{await sync(current);currentUid.current=current.uid;setUser(current);setReady(true);setError('');},[sync]);
  const logout=useCallback(async()=>{setReady(false);try{await signOut(getFirebaseAuth());await sync(null);setUser(null);setError('');window.location.assign('/sign-in');}catch(failure){setError(authErrorMessage(failure));setReady(true);throw failure;}},[sync]);
  return <AuthContext.Provider value={{user,ready,error,requiresVerification,establish,logout}}>{children}</AuthContext.Provider>;
}
export function useAuth(){const value=useContext(AuthContext);if(!value)throw new Error('AuthProvider is missing.');return value;}
